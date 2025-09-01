/* ===== Numbers — Breathing Garden =====
    Calm concentric pulses + gentle tone synced to a “breath”.
    - Seed = auction number from ?n= or ?num= (falls back to 123)
    - Respects system dark/light theme
    - No external sound libs; uses Web Audio (optional)
    - Tweakable section marked with ⭐

    Controls:
    - Click / tap or UI button: start/stop sound (if blocked initially)
    - Key 'S': toggle sound
*/

// ---------- Seed & Params ----------
function getSeed() {
  const url = new URL(window.location.href);
  let v = url.searchParams.get("n");
  if (v === null) v = url.searchParams.get("num");
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : 123;
}
const N = getSeed();

// Simple deterministic PRNG (LCG) from seed
function makeRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function rand() {
     // LCG constants from Numerical Recipes
     s = (1664525 * s + 1013904223) >>> 0;
     return (s & 0xfffffff) / 0xfffffff;
  };
}
const rng = makeRNG(N);

// ---------- Theme ----------
const isDark = window.matchMedia &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches;

// palette driven by theme
const BG = isDark ? 0 : 255;
const FG = isDark ? 255 : 0;

// ---------- ⭐ Tweakables ----------
const MAX_RINGS = 28;           // max visible rings
const BASE_STROKE = 1.5;        // ring thickness baseline
const NUM_FONT_SIZE = 0.22;     // fraction of min(width,height)
const FADE_TRAIL = 18;          // background fade each frame (0–255), higher = more ghosting
const RING_GLOW = 26;           // alpha of rings (0–255)
const RING_SPACING = 12 + Math.floor(rng()*10);  // px gap between rings
const SUBTLE_WOBBLE = 0.015 + rng()*0.02;        // ring jitter amplitude

// Breath period (in seconds) seeded by N:
const BREATH_IN  = 3.5 + (N % 5) * 0.25; // inhale seconds
const BREATH_OUT = 5.0 + (N % 7) * 0.25; // exhale seconds
const BREATH_HOLD_TOP = (N % 2 === 0) ? 0.6 : 0.0; // (optional) pause after inhale
const BREATH_HOLD_BOT = (N % 3 === 0) ? 0.6 : 0.0; // (optional) pause after exhale

// Sound (Hz) seeded by N:
const BASE_FREQ = 110 * Math.pow(2, (N % 24) / 12); // musical-ish mapping
const DETUNE = (rng() - 0.5) * 6; // few cents drift for warmth

// ---------- Audio (optional) ----------
let audio = {
  ctx: null,
  osc: null,
  gain: null,
  running: false
};

function setupAudio() {
  if (audio.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = BASE_FREQ;
  osc.detune.value = DETUNE;
  gain.gain.value = 0.0;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  audio.ctx = ctx; audio.osc = osc; audio.gain = gain;
}

function setBreathGain(t) {
  // t = 0..1 along current breath phase; map to smooth envelope
  // Use a raised cosine for gentle ease-in/out
  const v = 0.5 - 0.5 * Math.cos(Math.PI * t);
  const target = 0.06 * v; // very low volume
  if (audio.gain) audio.gain.gain.linearRampToValueAtTime(target, audio.ctx.currentTime + 0.02);
}

function startAudio() {
  setupAudio();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  audio.running = true;
  document.getElementById("toggleAudio").textContent = "❚❚ sound";
}
function stopAudio() {
  if (!audio.ctx) return;
  audio.running = false;
  if (audio.gain) audio.gain.gain.setTargetAtTime(0.0, audio.ctx.currentTime, 0.05);
  document.getElementById("toggleAudio").textContent = "► sound";
}

// ---------- Breath timeline ----------
function breathPhaseTime(seconds) {
  // Returns {phase:"inhale"|"holdTop"|"exhale"|"holdBot", t:[0..1], elapsedInPhase}
  let s = seconds % (BREATH_IN + BREATH_HOLD_TOP + BREATH_OUT + BREATH_HOLD_BOT);
  if (s < BREATH_IN) return { phase: "inhale",  t: s / BREATH_IN, elapsed: s };
  s -= BREATH_IN;
  if (s < BREATH_HOLD_TOP) return { phase: "holdTop", t: 1, elapsed: s };
  s -= BREATH_HOLD_TOP;
  if (s < BREATH_OUT) return { phase: "exhale",  t: 1 - (s / BREATH_OUT), elapsed: s };
  s -= BREATH_OUT;
  return { phase: "holdBot", t: 0, elapsed: s };
}

// ---------- p5 Sketch ----------
let labelEl;

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  labelEl = document.getElementById("label");
  const btn = document.getElementById("toggleAudio");
  btn.addEventListener("click", () => {
     if (!audio.running) startAudio(); else stopAudio();
  });

  // initial canvas
  background(BG);
  noFill();
  stroke(FG);
  strokeWeight(BASE_STROKE);

  // info label
  updateLabel(0);
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  background(BG);
}

function keyPressed() {
  if (key === 's' || key === 'S') {
     if (!audio.running) startAudio(); else stopAudio();
  }
}

function draw() {
  // gentle fade trail
  push();
  noStroke();
  fill(BG, FADE_TRAIL);
  rect(0, 0, width, height);
  pop();

  const now = millis() / 1000;
  const b = breathPhaseTime(now);
  if (audio.running) setBreathGain(b.t);

  // center
  const cx = width * 0.5;
  const cy = height * 0.5;

  // ring scale based on breath t (0 collapsed .. 1 expanded)
  const maxRadius = min(width, height) * 0.48;
  const radiusBase = 8; // start radius
  const scale = b.t;

  // draw concentric rings outward from center
  stroke(FG, RING_GLOW);
  strokeWeight(BASE_STROKE + scale * 0.6);

  const wobble = SUBTLE_WOBBLE;
  const step = RING_SPACING;
  let count = 0;
  for (let r = radiusBase; r < maxRadius && count < MAX_RINGS; r += step, count++) {
     const rr = r * (0.45 + 0.55 * scale); // rings expand/contract with breath
     const jx = (noise(r * 0.01, frameCount * 0.003) - 0.5) * wobble * r;
     const jy = (noise(r * 0.01 + 999, frameCount * 0.003) - 0.5) * wobble * r;
     ellipse(cx + jx, cy + jy, rr * 2, rr * 2);
  }

  // central number, steady anchor
  push();
  fill(FG);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(min(width, height) * NUM_FONT_SIZE);
  // slightly breathe the letterspacing via scale if desired:
  text(N.toString(), cx, cy);
  pop();

  updateLabel(now);
}

function updateLabel(nowSeconds) {
  const label = `n = ${N}  •  breath: in ${BREATH_IN.toFixed(1)}s | hold ${BREATH_HOLD_TOP.toFixed(1)}s | out ${BREATH_OUT.toFixed(1)}s | hold ${BREATH_HOLD_BOT.toFixed(1)}s`;
  if (labelEl) labelEl.textContent = label;
}

// Helpful: start audio on first user gesture anywhere
window.addEventListener("pointerdown", () => { if (!audio.running) startAudio(); }, { once: true });
