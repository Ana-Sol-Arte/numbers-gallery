// ===== Numbers: Zen Digit Dissolve + Spinning Particle Sphere (organic flip) =====
// - Foreground: your breathe/dissolve text particles.
// - Background: faux-3D spinning particle sphere.
// - Organic spin reversals: slows to a gentle stop, then accelerates the other way.
//
// URL params:
//   ?num=137
//   ?dur=600
//   ?breath=8
//   ?sphere=1
//   ?sdens=1800
//   ?sspin=0.12         // radians/sec base speed
//   ?salpha=120         // 0..255 dot alpha
//   ?sradius=0.35       // sphere radius as fraction of min(width,height) (default 0.48)
//   ?sflip=30           // flip every N seconds (0 disables flipping)
//   ?sease=2            // seconds: easing window centered on each flip (default 2)

let DISPLAY_TEXT = "131";
let RUN_SECONDS = null;
let BREATH_SECONDS = 8;

// ---- Text-particle fields ----
let pg;
let particles = [];
let lastBuildKey = "";
let startMillis = 0;

// Colors
const BG = 0;
const FG = 255;

// Text particle sampling/layout
const SAMPLE_STEP = 6;
const TARGET_SCALE = 0.78;
const MARGIN_FRAC = 0.12;

// Motion tuning
const EXHALE_SPREAD = 28;
const EXHALE_JITTER = 0.9;
const INHALE_TIGHTNESS = 0.18;
const DRIFT_NOISE_SCALE = 0.002;
const DRIFT_NOISE_STRENGTH = 0.9;

// HUD
const HUD_FADE = 140;

// ---- Sphere layer ----
let SPHERE_ENABLED = true;
let SPHERE_POINTS_APPROX = 1600;
let SPHERE_SPIN = 0.10;          // base angular speed (rad/sec)
let SPHERE_BASE_ALPHA = 110;
let SPHERE_RADIUS_FRAC = 0.48;
let SPHERE_FLIP_SEC = 30;        // flip interval (0 disables)
let SPHERE_EASE_SEC = 2;         // easing window duration (seconds)

// Integrated angles (for perfectly smooth motion)
let spherePts = [];
let sphereRadius = 200;
let sphereAngleY = 0;
let sphereAngleX = 0;
let lastTimeSec = null;

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

  const srad = u.searchParams.get("sradius");
  if (srad !== null) {
    const v = parseFloat(srad);
    if (Number.isFinite(v) && v > 0 && v < 1.2) SPHERE_RADIUS_FRAC = v;
  }

  const flip = u.searchParams.get("sflip");
  if (flip !== null) {
    const v = parseFloat(flip);
    if (Number.isFinite(v) && v >= 0) SPHERE_FLIP_SEC = v; // 0 = disable flipping
  }

  const ease = u.searchParams.get("sease");
  if (ease !== null) {
    const v = parseFloat(ease);
    if (Number.isFinite(v) && v >= 0) SPHERE_EASE_SEC = v; // 0 = no easing
  }
}

function setup() {
  getParams();
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
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
  const t = millis() / 1000.0;
  const period = BREATH_SECONDS * 2;
  const phase = (t % period) / period;                 // 0..1
  const tri = phase < 0.5 ? (phase * 2.0) : (2.0 - phase * 2.0); // 0..1..0
  const exhale = 1.0 - tri;                            // 1 at most dissolved

  noStroke();
  for (let p of particles) {
    const n = noise(p.home.x * DRIFT_NOISE_SCALE, p.home.y * DRIFT_NOISE_SCALE, t * 0.15);
    const ang = p.theta + n * TWO_PI;
    const spread = EXHALE_SPREAD * (0.4 + EXHALE_JITTER * p.rand);
    const drift = createVector(cos(ang), sin(ang)).mult(spread * exhale);

    const f = flowForce(p.home.x, p.home.y, t).mult(DRIFT_NOISE_STRENGTH * exhale);
    drift.add(f);

    const target = p5.Vector.add(p.home, drift);

    const easing = lerp(1.0 - INHALE_TIGHTNESS, 0.08, exhale);
    p.pos.x = lerp(p.pos.x, target.x, easing);
    p.pos.y = lerp(p.pos.y, target.y, easing);

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
  const minDim = min(width, height);
  sphereRadius = minDim * SPHERE_RADIUS_FRAC;

  // Fibonacci sphere
  const N = SPHERE_POINTS_APPROX;
  spherePts = [];
  const phi = (1 + Math.sqrt(5)) / 2;
  const ga = 2 * Math.PI * (1 - 1 / phi);

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const z = 1 - 2 * t;             // 1..-1
    const r = Math.sqrt(max(0, 1 - z * z));
    const theta = ga * i;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    spherePts.push({ x, y, z });
  }
}

function drawSphereLayer() {
  const t = millis() / 1000.0;

  // Compute dt for integration (cap to avoid huge jumps on tab switch)
  if (lastTimeSec === null) lastTimeSec = t;
  const dt = constrain(t - lastTimeSec, 0, 0.1);
  lastTimeSec = t;

  // Determine spin direction and easing factor
  let dir = 1;
  let ease = 1;

  if (SPHERE_FLIP_SEC > 0) {
    const cycles = floor(t / SPHERE_FLIP_SEC);
    dir = (cycles % 2 === 0 ? 1 : -1);

    if (SPHERE_EASE_SEC > 0) {
      const mod = t % SPHERE_FLIP_SEC;
      const half = SPHERE_EASE_SEC / 2;
      const dist = Math.min(mod, SPHERE_FLIP_SEC - mod); // time from nearest flip boundary

      if (dist < half) {
        // Raised-cosine from 0 → 1 across the window edge
        const r = dist / half;                  // 0..1
        ease = 0.5 * (1 - Math.cos(Math.PI * r)); // 0 at boundary → 1 at edge
      } else {
        ease = 1;
      }
    }
  }

  // Integrate angles with eased angular velocity
  const omegaY = dir * SPHERE_SPIN * ease;
  const omegaX = dir * (SPHERE_SPIN * 0.33) * ease;

  sphereAngleY += omegaY * dt;
  sphereAngleX += omegaX * dt;

  const sinY = Math.sin(sphereAngleY), cosY = Math.cos(sphereAngleY);
  const sinX = Math.sin(sphereAngleX), cosX = Math.cos(sphereAngleX);

  const cx = width / 2;
  const cy = height / 2;
  const R = sphereRadius;
  const persp = 0.85;

  // Depth-sort so far points draw first
  let tmp = [];
  for (let p of spherePts) {
    // Rotate (Y then X)
    let x =  p.x * cosY + p.z * sinY;
    let z = -p.x * sinY + p.z * cosY;
    let y =  p.y * cosX - z   * sinX;
        z =  p.y * sinX + z   * cosX;

    // Simple perspective
    const s = 1 + persp * z;
    const px = cx + x * R * s;
    const py = cy + y * R * s;

    const a = constrain(SPHERE_BASE_ALPHA * (0.6 + 0.6 * (z + 1) * 0.5), 10, 255);
    const size = 1.3 + 1.7 * (z + 1) * 0.5;

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
  const minDim = min(width, height);
  const margin = minDim * MARGIN_FRAC;
  const targetH = minDim * TARGET_SCALE;

  pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.background(0);
  pg.fill(255);
  pg.noStroke();
  pg.textAlign(CENTER, CENTER);

  let ts = max(12, targetH);
  pg.textSize(ts);

  const availW = width - margin * 2;
  let wText = pg.textWidth(DISPLAY_TEXT);
  if (wText > availW) {
    ts = ts * (availW / wText);
    ts = max(12, ts);
    pg.textSize(ts);
  }

  pg.text(DISPLAY_TEXT, width / 2, height / 2);

  pg.loadPixels();
  particles = [];
  const pw = pg.width;
  const ph = pg.height;

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

function keyTyped() {
  if (key === 'r') {
    DISPLAY_TEXT = String(floor(random(1, 9999)));
    buildTextParticles();
  }
}
