/* ===========================================================
   Numbers — Breathing Garden (Monochrome + Gentle Audio)
   -----------------------------------------------------------
   - Black background, white/grey rings + central number.
   - Calm concentric pulses synced to a “breath”.
   - Optional soft tone that swells with the breath.
   - Seed = auction number from ?n= or ?num= (fallback 123).
   - No external sound libraries required.
   - Creates its own minimal sound toggle UI automatically.
   -----------------------------------------------------------
   Quick knobs:
     RING_ALPHA, BASE_STROKE, NUM_FONT_SIZE, FADE_TRAIL,
     MAX_RINGS, RING_SPACING
     BREATH_* (timing), AUDIO_GAIN (loudness), baseFreqFromSeed()
   =========================================================== */

// ===== Seed =====
function getSeed() {
  const url = new URL(window.location.href);
  let v = url.searchParams.get("n");
  if (v === null) v = url.searchParams.get("num");
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : 123;
}
const N = getSeed();

// ===== Deterministic RNG from seed =====
function makeRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function rand() {
    // Numerical Recipes LCG
    s = (1664525 * s + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff;
  };
}
const rng = makeRNG(N);

// ===== Visual Palette (locked) =====
const BG = 0;          // black
const FG = 255;        // white
const RING_ALPHA = 60; // transparency for rings (0–255)

// ===== Visual Parameters =====
const MAX_RINGS = 28;
const BASE_STROKE = 1.5;
const NUM_FONT_SIZE = 0.22;           // fraction of min(width,height)
const FADE_TRAIL = 18;                 // higher = more persistence
const RING_SPACING = 12 + Math.floor(rng() * 10);
const SUBTLE_WOBBLE = 0.015 + rng() * 0.02;

// ===== Breath Timing (seconds), seeded by N =====
const BREATH_IN       = 3.5 + (N % 5) * 0.25;
const BREATH_HOLD_TOP = (N % 2 === 0) ? 0.6 : 0.0;
const BREATH_OUT      = 5.0 + (N % 7) * 0.25;
const BREATH_HOLD_BOT = (N % 3 === 0) ? 0.6 : 0.0;

function breathPhaseTime(seconds) {
  // Returns { phase, t } where t in [0..1] describes expansion
  const total = BREATH_IN + BREATH_HOLD_TOP + BREATH_OUT + BREATH_HOLD_BOT;
  let s = seconds % total;

  if (s < BREATH_IN) return { phase: "inhale",  t: s / BREATH_IN };
  s -= BREATH_IN;

  if (s < BREATH_HOLD_TOP) return { phase: "holdTop", t: 1 };
  s -= BREATH_HOLD_TOP;

  if (s < BREATH_OUT) return { phase: "exhale", t: 1 - (s / BREATH_OUT) };
  // hold at bottom
  return { phase: "holdBot", t: 0 };
}

// ===== Audio (Web Audio, no external libs) =====
const AUDIO_GAIN = 0.06; // overall loudness (keep small!)

let audio = {
  ctx: null,
  out: null,
  oscA: null,
  oscB: null,
  gain: null,
  running: false
};

function baseFreqFromSeed(n) {
  // Smooth mapping (A2=110Hz upward ~ 2 octaves)
  // Swap for a pentatonic mapping if you prefer (see comment below).
  return 110 * Math.pow(2, (n % 24) / 12);
  /*
  // Pentatonic example:
  const scale = [0, 2, 4, 7, 9]; // semitone steps
  const step = scale[n % scale.length] + 12 * Math.floor((n % 20) / scale.length);
  return 110 * Math.pow(2, step / 12);
  */
}

function setupAudio() {
  if (audio.ctx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // Two slightly detuned sines -> warm beating
  const oscA = ctx.createOscillator();  oscA.type = "sine";
  const oscB = ctx.createOscillator();  oscB.type = "sine";
  const gain = ctx.createGain();        gain.gain.value = 0.0; // start silent
  const out  = ctx.createGain();        out.gain.value = 0.9;

  const f0 = baseFreqFromSeed(N);
  oscA.frequency.value = f0;
  oscB.frequency.value = f0 * 1.0015;
  oscB.detune.value = 5; // a few cents

  oscA.connect(gain).connect(out).connect(ctx.destination);
  oscB.connect(gain);

  oscA.start(); oscB.start();

  audio.ctx = ctx; audio.out = out; audio.oscA = oscA; audio.oscB = oscB; audio.gain = gain;
}

function startAudio() {
  setupAudio();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  audio.running = true;
  updateSoundButton(true);
}

function stopAudio() {
  if (!audio.ctx) return;
  audio.running = false;
  // quick click-free fade-out
  audio.gain.gain.setTargetAtTime(0.0, audio.ctx.currentTime, 0.05);
  updateSoundButton(false);
}

function setBreathGain01(t) {
  if (!audio.running || !audio.gain) return;
  // Raised cosine: smooth in/out
  const v = 0.5 - 0.5 * Math.cos(Math.PI * t);
  const target = AUDIO_GAIN * v;
  audio.gain.gain.linearRampToValueAtTime(target, audio.ctx.currentTime + 0.03);
}

// ===== Minimal UI (auto-created) =====
let uiBtn;

function ensureUI() {
  if (document.getElementById("numbers-audio-btn")) return;

  const ui = document.createElement("div");
  ui.style.position = "fixed";
  ui.style.left = "12px";
  ui.style.top = "12px";
  ui.style.opacity = "0.6";
  ui.style.font = "12px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ui.style.color = "#fff";
  ui.style.userSelect = "none";
  ui.style.zIndex = "9999";

  const btn = document.createElement("button");
  btn.id = "numbers-audio-btn";
  btn.textContent = "► sound";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid currentColor";
  btn.style.borderRadius = "999px";
  btn.style.background = "transparent";
  btn.style.padding = ".25rem .6rem";
  btn.style.color = "#fff";

  btn.addEventListener("click", () => audio.running ? stopAudio() : startAudio());
  ui.appendChild(btn);
  document.body.appendChild(ui);
  uiBtn = btn;

  // Start audio on first gesture (helps on iOS/Safari). Remove if undesired.
  window.addEventListener("pointerdown", () => { if (!audio.running) startAudio(); }, { once: true });
}

function updateSoundButton(isOn) {
  const el = uiBtn || document.getElementById("numbers-audio-btn");
  if (!el) return;
  el.textContent = isOn ? "❚❚ sound" : "► sound";
}

// ===== p5.js Sketch =====
function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  background(BG);
  noFill();
  stroke(FG);
  strokeWeight(BASE_STROKE);
  ensureUI();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  background(BG);
}

function draw() {
  // Soft trail
  noStroke();
  fill(BG, FADE_TRAIL);
  rect(0, 0, width, height);

  const now = millis() / 1000;
  const b = breathPhaseTime(now);
  setBreathGain01(b.t);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.48;

  // Rings
  stroke(FG, RING_ALPHA);
  strokeWeight(BASE_STROKE);
  const step = RING_SPACING;

  let count = 0;
  for (let r = 8; r < maxRadius && count < MAX_RINGS; r += step, count++) {
    // rings expand/contract with breath + tiny jitter so it's not perfectly rigid
    const rr = r * (0.45 + 0.55 * b.t);
    const jx = (noise(r * 0.01, frameCount * 0.003) - 0.5) * SUBTLE_WOBBLE * r;
    const jy = (noise(r * 0.01 + 999, frameCount * 0.003) - 0.5) * SUBTLE_WOBBLE * r;
    ellipse(cx + jx, cy + jy, rr * 2, rr * 2);
  }

  // Central number
  fill(FG);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(Math.min(width, height) * NUM_FONT_SIZE);
  text(N.toString(), cx, cy);
}

// Optional keyboard toggle (S)
function keyPressed() {
  if (key === 's' || key === 'S') {
    audio.running ? stopAudio() : startAudio();
  }
}
