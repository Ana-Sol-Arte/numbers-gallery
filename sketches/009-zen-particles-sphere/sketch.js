// ===== Numbers: Zen Digit Dissolve + Spinning Particle Sphere (p5.js single-file) =====
// - Monochrome. The displayed number comes from ?num=... (default "131").
// - Your existing breathe/dissolve text-particle effect remains unchanged.
// - NEW: a faux-3D, slowly spinning particle sphere rendered BEHIND the number.
//        Uses 2D canvas (no WEBGL), uniform points, simple perspective, depth-based alpha.
//
// URL params:
//   ?num=137         -> number/string to display
//   ?dur=600         -> run time in seconds (shows tiny countdown HUD); omit to run indefinitely
//   ?breath=8        -> seconds for one inhale OR one exhale (default 8)
//   ?sphere=1        -> enable sphere (default 1)
//   ?sdens=1800      -> approximate number of sphere dots (default 1600)
//   ?sspin=0.12      -> sphere spin speed (radians/sec; default 0.1)
//   ?salpha=120      -> base alpha 0..255 for sphere dots (default 110)

let DISPLAY_TEXT = "131";
let RUN_SECONDS = null;      // null = run indefinitely
let BREATH_SECONDS = 8;

// ---- Text-particle fields (unchanged core) ----
let pg;                      // offscreen buffer to rasterize text
let particles = [];
let lastBuildKey = "";
let startMillis = 0;

// Colors
const BG = 0;                // background: black
const FG = 255;              // foreground: white

// Text particle sampling/layout
const SAMPLE_STEP = 6;       // pixel step (bigger = fewer particles, faster)
const TARGET_SCALE = 0.78;   // fraction of min(width,height) for text height
const MARGIN_FRAC = 0.12;    // canvas margin around text box

// Motion tuning
const EXHALE_SPREAD = 28;
const EXHALE_JITTER = 0.9;
const INHALE_TIGHTNESS = 0.18;
const DRIFT_NOISE_SCALE = 0.002;
const DRIFT_NOISE_STRENGTH = 0.9;

// HUD
const HUD_FADE = 140;

// ---- Sphere layer (new) ----
let SPHERE_ENABLED = true;
let SPHERE_POINTS_APPROX = 1600;   // ~number of dots
let SPHERE_SPIN = 0.10;            // radians/sec
let SPHERE_BASE_ALPHA = 110;       // dot alpha (0..255)

let spherePts = [];                // original unit-sphere points
let sphereRadius = 200;            // pixels; computed from canvas

function getParams() {
  const u = new URL(window.location.href);

  const n = u.searchParams.get("num");
  if (n !== null && n.trim() !== "") DISPLAY_TEXT = n.trim();

  const d = u.searchParams.get("dur");
  if (d !== null) {
    const sec = parseInt(d, 10);
    if (Number.isFinite(sec) && sec > 0) RUN_SECONDS = sec;
  }

  const b = u.searchParams.get("breath");
  if (b !== null) {
    const sec = parseFloat(b);
    if (Number.isFinite(sec) && sec > 0.5) BREATH_SECONDS = sec;
  }

  const sOn = u.searchParams.get("sphere");
  if (sOn !== null) SPHERE_ENABLED = sOn !== "0";

  const dens = u.searchParams.get("sdens");
  if (dens !== null) {
    const v = parseInt(dens, 10);
    if (Number.isFinite(v) && v > 50) SPHERE_POINTS_APPROX = v;
  }

  const spin = u.searchParams.get("sspin");
  if (spin !== null) {
    const v = parseFloat(spin);
    if (Number.isFinite(v) && v >= 0) SPHERE_SPIN = v;
  }

  const salpha = u.searchParams.get("salpha");
  if (salpha !== null) {
    const v = parseInt(salpha, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 255) SPHERE_BASE_ALPHA = v;
  }
}

function setup() {
  getParams();
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1); // predictable sampling
  startMillis = millis();

  buildTextParticles();
  buildSphere();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildTextParticles();
  buildSphere();
}

function draw() {
  background(BG);

  // Rebuild text particles on size/text change
  const buildKey = DISPLAY_TEXT + "|" + width + "x" + height;
  if (buildKey !== lastBuildKey) buildTextParticles();

  // --- 1) SPHERE LAYER (behind) ---
  if (SPHERE_ENABLED) {
    drawSphereLayer();
  }

  // --- 2) DIGIT DISSOLVE LAYER (front) ---
  // Triangle-wave breath: tri goes 0..1..0 over a full inhale+exhale
  const t = millis() / 1000.0;
  const period = BREATH_SECONDS * 2;
  const phase = (t % period) / period;                 // 0..1
  const tri = phase < 0.5 ? (phase * 2.0) : (2.0 - phase * 2.0); // 0..1..0
  const exhale = 1.0 - tri;                            // 1 at most dissolved

  noStroke();
  for (let p of particles) {
    // Outward drift direction seeded by per-particle theta and noise
    const n = noise(p.home.x * DRIFT_NOISE_SCALE, p.home.y * DRIFT_NOISE_SCALE, t * 0.15);
    const ang = p.theta + n * TWO_PI;
    const spread = EXHALE_SPREAD * (0.4 + EXHALE_JITTER * p.rand);
    const drift = createVector(cos(ang), sin(ang)).mult(spread * exhale);

    // Flow field push during exhale
    const f = flowForce(p.home.x, p.home.y, t).mult(DRIFT_NOISE_STRENGTH * exhale);
    drift.add(f);

    // Target = home + drift
    const target = p5.Vector.add(p.home, drift);

    // Ease toward target (looser on exhale, tighter on inhale)
    const easing = lerp(1.0 - INHALE_TIGHTNESS, 0.08, exhale);
    p.pos.x = lerp(p.pos.x, target.x, easing);
    p.pos.y = lerp(p.pos.y, target.y, easing);

    // Slightly brighter when formed
    const alpha = 200 + 55 * tri;
    fill(FG, alpha);
    circle(p.pos.x, p.pos.y, p.size);
  }

  if (RUN_SECONDS !== null) {
    const remaining = Math.max(0, RUN_SECONDS - (millis() - startMillis) / 1000);
    drawCountdown(remaining);
  }
}

// ---------------- Sphere layer ----------------

function buildSphere() {
  // Sphere radius fits nicely behind the text and within margins
  const minDim = min(width, height);
  sphereRadius = minDim * 0.48;

  // Make ~SPHERE_POINTS_APPROX points on a unit sphere using Fibonacci spiral
  const N = SPHERE_POINTS_APPROX;
  spherePts = [];
  const phi = (1 + Math.sqrt(5)) / 2;    // golden ratio
  const ga = 2 * Math.PI * (1 - 1 / phi);// golden angle

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);               // 0..1
    const z = 1 - 2 * t;                  // 1..-1
    const r = Math.sqrt(max(0, 1 - z * z));
    const theta = ga * i;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    spherePts.push({ x, y, z });
  }
}

function drawSphereLayer() {
  const t = millis() / 1000.0;

  // Slow rotation around Y plus a hint of X for parallax
  const aY = t * SPHERE_SPIN;
  const aX = t * (SPHERE_SPIN * 0.33);

  const sinY = Math.sin(aY), cosY = Math.cos(aY);
  const sinX = Math.sin(aX), cosX = Math.cos(aX);

  // Perspective-ish projection params
  const cx = width / 2;
  const cy = height / 2;
  const R = sphereRadius;
  const persp = 0.85; // how much closer points appear when z→1

  // Sort by depth so far points draw first (subtle but nice)
  // Compute once per frame into a temp array
  let tmp = [];
  for (let p of spherePts) {
    // Rotate (Y then X)
    let x =  p.x * cosY + p.z * sinY;
    let z = -p.x * sinY + p.z * cosY;
    let y =  p.y * cosX - z   * sinX;
        z =  p.y * sinX + z   * cosX;

    // Simple perspective scale (larger when closer)
    const s = 1 + persp * z; // z in [-1,1] → scale in [1-persp, 1+persp]
    const px = cx + x * R * s;
    const py = cy + y * R * s;

    // Depth-based alpha and size (front side brighter/larger)
    const a = constrain(SPHERE_BASE_ALPHA * (0.6 + 0.6 * (z + 1) * 0.5), 10, 255);
    const size = 1.3 + 1.7 * (z + 1) * 0.5; // 1.3..3.0

    tmp.push({ px, py, z, a, size });
  }

  tmp.sort((A, B) => A.z - B.z); // far → near

  noStroke();
  for (let d of tmp) {
    fill(255, d.a);
    circle(d.px, d.py, d.size);
  }
}

// --------------- Text dissolve helpers ---------------

function flowForce(x, y, t) {
  const s = 0.0013;
  const nx = noise(x * s, y * s, t * 0.07);
  const ny = noise((x + 999) * s, (y - 777) * s, t * 0.07);
  const ang = map(nx, 0, 1, -PI, PI);
  const magnitude = map(ny, 0, 1, 0.2, 1.0);
  return createVector(cos(ang), sin(ang)).mult(magnitude);
}

function drawCountdown(remainingSec) {
  const mm = floor(remainingSec / 60);
  const ss = floor(remainingSec % 60);
  const txt = nf(mm, 2) + ":" + nf(ss, 2);
  push();
  textAlign(RIGHT, BOTTOM);
  textSize(14);
  fill(FG, HUD_FADE);
  noStroke();
  text(txt, width - 14, height - 12);
  pop();
}

function buildTextParticles() {
  // Layout: fit text height to TARGET_SCALE of min dimension, respecting margins.
  const minDim = min(width, height);
  const margin = minDim * MARGIN_FRAC;
  const targetH = minDim * TARGET_SCALE;

  // Create offscreen buffer and draw centered white text on black
  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.background(0);
  pg.fill(255);
  pg.noStroke();
  pg.textAlign(CENTER, CENTER);

  // Start with height target
  let ts = max(12, targetH);
  pg.textSize(ts);

  // If too wide for available width, shrink proportionally
  const availW = width - margin * 2;
  let wText = pg.textWidth(DISPLAY_TEXT);
  if (wText > availW) {
    ts = ts * (availW / wText);
    ts = max(12, ts);
    pg.textSize(ts);
  }

  // Draw the text centered
  pg.text(DISPLAY_TEXT, width / 2, height / 2);

  // Sample entire buffer (simple + robust)
  pg.loadPixels();
  particles = [];
  const pw = pg.width;
  const ph = pg.height;

  // Threshold for white pixels
  for (let y = 0; y < ph; y += SAMPLE_STEP) {
    for (let x = 0; x < pw; x += SAMPLE_STEP) {
      const idx = 4 * (y * pw + x);
      const r = pg.pixels[idx + 0];
      const g = pg.pixels[idx + 1];
      const b = pg.pixels[idx + 2];
      const a = pg.pixels[idx + 3];
      if (a > 10 && (r + g + b) > 500) {
        particles.push(makeParticle(x, y));
      }
    }
  }

  lastBuildKey = DISPLAY_TEXT + "|" + width + "x" + height;
}

function makeParticle(x, y) {
  const jitter = random(-2, 2);
  return {
    home: createVector(x, y),
    pos: createVector(x + jitter, y + jitter),
    size: random(1.6, 2.4),
    theta: random(TWO_PI),
    rand: random()
  };
}

// Quick test: press 'r' to swap in a random number
function keyTyped() {
  if (key === 'r') {
    DISPLAY_TEXT = String(floor(random(1, 9999)));
    buildTextParticles();
  }
}
