// ===== Numbers: Zen Digit Dissolve + Silent Snowfall (editor-friendly) =====
// - Works in the p5 Web Editor even when URL params are stripped.
// - Toggle modes with 'M' or click the on-screen button.
// - 'R' randomizes the number.
//
// Optional params (work when hosted with real URL):
//   ?num=2025  ?dur=600  ?breath=8  ?mode=zen|snow

let DISPLAY_TEXT = "131";
let RUN_SECONDS = null;   // null = forever
let BREATH_SECONDS = 6;
let MODE = "zen";         // "zen" or "snow"

let pg;                   // offscreen buffer
let particles = [];       // zen particles
let snow = [];            // snowflakes
let lastBuildKey = "";
let startMillis = 0;

// UI
let modeBtn = {x: 12, y: 12, w: 170, h: 32};

const BG = 0;
const FG = 255;
const SAMPLE_STEP = 6;
const TARGET_SCALE = 0.78;
const MARGIN_FRAC = 0.12;
const HUD_FADE = 140;

// ---- Zen tuning ----
const EXHALE_SPREAD = 28;
const EXHALE_JITTER = 0.9;
const INHALE_TIGHTNESS = 0.18;
const DRIFT_NOISE_SCALE = 0.002;
const DRIFT_NOISE_STRENGTH = 0.9;

// ---- Snow tuning ----
const SNOW_MAX = 700;
const SNOW_MIN = 180;
const SNOW_WIND_NOISE = 0.0007;
const SNOW_WIND_TIME = 0.06;
const SNOW_FALL_MIN = 0.25;
const SNOW_FALL_MAX = 1.6;
const SNOW_SIZE_MIN = 10;
const SNOW_SIZE_MAX = 22;
const MELT_RATE = 0.015;
const MELT_FADE = 3.5;
const GROUND_SOFTEN = 0.82;

// ========================= Params =========================
function getParams() {
  // Try query string first
  const u = new URL(window.location.href);
  const qs = u.searchParams;

  // Fallback: also parse hash like #num=2025&mode=snow (handy in the editor)
  const hash = new URLSearchParams(u.hash.replace(/^#/, ""));

  function pick(name, parseFn = (v)=>v) {
    const a = qs.get(name);
    const b = hash.get(name);
    return a !== null ? parseFn(a) : (b !== null ? parseFn(b) : null);
  }

  const n = pick("num", v => v.trim());
  if (n) DISPLAY_TEXT = n;

  const d = pick("dur", v => parseInt(v, 10));
  if (Number.isFinite(d) && d > 0) RUN_SECONDS = d;

  const b = pick("breath", v => parseFloat(v));
  if (Number.isFinite(b) && b > 0.5) BREATH_SECONDS = b;

  const m = pick("mode", v => v.trim().toLowerCase());
  if (m === "zen" || m === "snow") MODE = m;
}

// ========================= Setup =========================
function setup() {
  getParams();
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('monospace'); // stable glyph metrics across systems
  startMillis = millis();
  buildTextParticles();
  buildSnow();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildTextParticles();
  buildSnow();
}

// ========================= Draw =========================
function draw() {
  background(BG);

  const buildKey = DISPLAY_TEXT + "|" + width + "x" + height;
  if (buildKey !== lastBuildKey) {
    buildTextParticles();
    buildSnow();
  }

  if (MODE === "zen") drawZen(); else drawSnow();

  drawHUD();
  drawModeButton();

  if (RUN_SECONDS !== null) {
    const remaining = Math.max(0, RUN_SECONDS - (millis() - startMillis) / 1000);
    drawCountdown(remaining);
  }
}

// ========================= ZEN =========================
function drawZen() {
  const t = millis() / 1000.0;
  const period = BREATH_SECONDS * 2;
  const ph = (t % period) / period; // 0..1
  const tri = ph < 0.5 ? (ph * 2.0) : (2.0 - ph * 2.0); // 0..1..0
  const exhale = 1.0 - tri;

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
}

function flowForce(x, y, t) {
  const s = 0.0013;
  const nx = noise(x * s, y * s, t * 0.07);
  const ny = noise((x + 999) * s, (y - 777) * s, t * 0.07);
  const ang = map(nx, 0, 1, -PI, PI);
  const magnitude = map(ny, 0, 1, 0.2, 1.0);
  return createVector(cos(ang), sin(ang)).mult(magnitude);
}

// ========================= SNOW =========================
function buildSnow() {
  const area = width * height;
  const target = constrain(floor(map(area, 320*568, 1920*1080, 220, SNOW_MAX)), SNOW_MIN, SNOW_MAX);
  snow = [];
  const groundY = height - min(width, height) * (MARGIN_FRAC * 0.8);
  for (let i = 0; i < target; i++) {
    snow.push(makeFlake(random(width), random(-height, 0), groundY));
  }
}

function makeFlake(x, y, groundY) {
  const ch = DISPLAY_TEXT.charAt(floor(random(DISPLAY_TEXT.length))) || "0";
  const s = random(SNOW_SIZE_MIN, SNOW_SIZE_MAX);
  return {
    x, y,
    vy: random(SNOW_FALL_MIN, SNOW_FALL_MAX),
    life: 1.0,
    size: s,
    baseSize: s,
    state: "air",      // "air" -> "melt" -> respawn
    char: ch,
    ground: groundY,
    seed: random(10000)
  };
}

function drawSnow() {
  const t = millis() / 1000.0;

  // very faint ghost of the number form
  if (pg) {
    push();
    tint(255, 18);
    image(pg, 0, 0);
    pop();
  }

  drawGround();

  noStroke();
  fill(FG);
  textAlign(CENTER, CENTER);

  for (let f of snow) {
    if (f.state === "air") {
      const wind = (noise(f.x * SNOW_WIND_NOISE, f.y * SNOW_WIND_NOISE, t * SNOW_WIND_TIME) - 0.5) * 1.2;
      f.x += wind + 0.35 * sin((t + f.seed) * 1.4);
      f.y += f.vy;

      if (f.x < -30) f.x = width + 30;
      if (f.x > width + 30) f.x = -30;

      if (f.y >= f.ground) {
        f.y = f.ground;
        f.state = "melt";
      }

      push();
      fill(FG, 220);
      textSize(f.size);
      text(f.char, f.x, f.y);
      pop();

    } else {
      f.life -= MELT_RATE;
      f.size = max(0, f.baseSize * f.life);
      f.y = lerp(f.y, f.ground + 2, 1.0 - GROUND_SOFTEN);

      push();
      fill(FG, max(0, 200 - (1.0 - f.life) * 200 * MELT_FADE));
      textSize(max(0.01, f.size));
      text(f.char, f.x, f.y);
      pop();

      if (f.life <= 0.02 || f.size <= 0.2) {
        const groundY = height - min(width, height) * (MARGIN_FRAC * 0.8);
        const nf = makeFlake(random(width), random(-height * 0.5, -10), groundY);
        Object.assign(f, nf);
      }
    }
  }
}

function drawGround() {
  const gY = height - min(width, height) * (MARGIN_FRAC * 0.8);
  for (let i = 0; i < 18; i++) {
    const a = map(i, 0, 17, 22, 0);
    stroke(FG, a);
    line(0, gY + i, width, gY + i);
  }
}

// ========================= HUD / UI =========================
function drawHUD() {
  push();
  textAlign(LEFT, BOTTOM);
  textSize(14);
  fill(FG, HUD_FADE);
  noStroke();
  const modeTxt = MODE === 'zen' ? 'ZEN (breathe dissolve)' : 'SNOW (silent snowfall)';
  text(modeTxt, 14, height - 12);
  pop();
}

function drawModeButton() {
  // Button bg
  push();
  noStroke();
  fill(255, 16);
  rect(modeBtn.x, modeBtn.y, modeBtn.w, modeBtn.h, 6);
  // Label
  fill(255, 190);
  textAlign(LEFT, CENTER);
  textSize(14);
  text(`Mode: ${MODE}  (click)`, modeBtn.x + 10, modeBtn.y + modeBtn.h/2 + 1);
  pop();
}

function mousePressed() {
  if (mouseX >= modeBtn.x && mouseX <= modeBtn.x + modeBtn.w &&
      mouseY >= modeBtn.y && mouseY <= modeBtn.y + modeBtn.h) {
    MODE = (MODE === "zen") ? "snow" : "zen";
  }
}

// ========================= Build Text (shared) =========================
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
  pg.textFont('monospace');

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

  // Sample for zen particles
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

// ========================= Input =========================
function keyTyped() {
  if (key === 'r') {
    DISPLAY_TEXT = String(floor(random(1, 9999)));
    buildTextParticles();
    buildSnow();
  } else if (key === 'm') {
    MODE = (MODE === "zen") ? "snow" : "zen";
  }
}
