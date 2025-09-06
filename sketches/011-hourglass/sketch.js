/* ========= Numbers — Digital Hourglass (v2, time-synced + sand physics) =========
   - Grid-based falling-sand for the bottom chamber (down / down-left / down-right)
   - Exactly matches the clock: grains settled == floor(elapsed * G / DURATION_SECONDS)
   - Stops immediately at 0:00
*/

const DURATION_SECONDS = 60;       // ← set 600 for 10-minute settle
const DOT_SPACING = 10;            // grid cell size & sand grain spacing
const DOT_SIZE = 3.2;              // sand grain diameter
const NECK_WIDTH_F = 0.06;         // neck width fraction of min(width,height)
const NUMBER_SIZE = 88;
const SHOW_PLATE = true;

const BG = 0, FG = 255;

let N = 108;
let startMs, endMs;

// Geometry
let topY0, topY1, botY0, botY1;
let neckX, neckW;
let chamberHalfWTop, chamberHalfWNeck;

// Visual top/bottom dot arrays (for drawing top and , for bottom outline only)
let topDots = [];
let topTotal = 0;

// Bottom chamber sand grid
let cell;                    // = DOT_SPACING
let rowsB;                   // number of grid rows in bottom chamber
let rowRanges = [];          // per-row: { y, xStart, cols }
let occ = [];                // occupancy boolean 2D: occ[row][col]
let settledCount = 0;        // settled grains in bottom grid

let G = 0;                   // total grains to move (top & bottom equalized)
let grainsPerSec = 0;

function getNumParam() {
  const u = new URL(window.location.href);
  const v = u.searchParams.get("num");
  if (!v) return null;
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(2);
  background(BG);

  const p = getNumParam();
  if (p !== null) N = p;

  randomSeed(N);
  noiseSeed(N);

  startMs = millis();
  endMs = startMs + DURATION_SECONDS * 1000;

  computeGeometry();
  layoutTopDots();
  buildBottomGrid();
  normalizeGrainCounts();            // sets G and trims topDots
  grainsPerSec = G / DURATION_SECONDS;

  textFont('ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto');
  textAlign(CENTER, CENTER);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeGeometry();
  layoutTopDots();
  buildBottomGrid();
  normalizeGrainCounts();
  grainsPerSec = G / DURATION_SECONDS;
}

function computeGeometry() {
  const m = min(width, height);
  const pad = m * 0.08;

  topY0 = pad;
  topY1 = height * 0.48;
  botY0 = height * 0.52;
  botY1 = height - pad;

  neckX = width * 0.5;
  neckW = max(8, m * NECK_WIDTH_F);

  chamberHalfWTop  = m * 0.32;
  chamberHalfWNeck = neckW * 0.5;

  cell = DOT_SPACING;
}

function chamberHalfWidthAt(y, isTop) {
  if (isTop) {
    return map(y, topY0, topY1, chamberHalfWTop, chamberHalfWNeck);
  } else {
    return map(y, botY0, botY1, chamberHalfWNeck, chamberHalfWTop);
  }
}

/* ---------- Top chamber layout (for drawing remaining grains) ---------- */
function layoutTopDots() {
  topDots = [];
  for (let y = topY1 - cell * 0.5; y >= topY0; y -= cell) {
    const hw = chamberHalfWidthAt(y, true);
    for (let x = neckX - hw + cell * 0.5; x <= neckX + hw - cell * 0.5; x += cell) {
      topDots.push({ x: x + random(-0.9, 0.9), y: y + random(-0.9, 0.9) });
    }
  }
  topTotal = topDots.length;
}

/* ---------- Bottom grid construction ---------- */
function buildBottomGrid() {
  rowRanges = [];
  occ = [];

  // Grid rows from base (row 0) upward
  rowsB = max(1, Math.floor((botY1 - botY0) / cell));
  for (let r = 0; r < rowsB; r++) {
    const y = botY0 + (rowsB - 1 - r) * cell + cell * 0.5; // row center
    const hw = chamberHalfWidthAt(y, false);
    const xStart = neckX - hw;
    const cols = max(1, Math.floor((hw * 2) / cell));
    rowRanges.push({ y, xStart, cols });
    occ.push(new Array(cols).fill(false));
  }
}

/* Ensure both chambers use same grain count G. We only *move* G grains. */
function normalizeGrainCounts() {
  const bottomCapacity = rowRanges.reduce((sum, rr) => sum + rr.cols, 0);
  G = min(topTotal, bottomCapacity);
  topDots = topDots.slice(0, G);
  // Reset settled counter & occupancy (important on resize)
  for (let r = 0; r < occ.length; r++) occ[r].fill(false);
  settledCount = 0;
}

/* ---------- Physics emission & settling ---------- */
function emitAndSettleOne() {
  // Start near neck (top row of bottom grid)
  const startRow = rowsB - 1;
  const rr = rowRanges[startRow];
  // middle column with slight randomness
  let x = neckX + random(-neckW * 0.15, neckW * 0.15);
  let col = constrain(Math.floor((x - rr.xStart) / cell), 0, rr.cols - 1);
  let row = startRow;

  // Simulate falling until rest; limit steps so it never hangs
  const maxSteps = rowsB * 3;
  for (let step = 0; step < maxSteps; step++) {
    const nextRow = row - 1;
    // Try straight down
    if (nextRow >= 0 && isEmpty(nextRow, col)) { row = nextRow; continue; }
    // Try down-left
    if (nextRow >= 0 && isEmpty(nextRow, col - 1)) { row = nextRow; col = col - 1; continue; }
    // Try down-right
    if (nextRow >= 0 && isEmpty(nextRow, col + 1)) { row = nextRow; col = col + 1; continue; }
    // Else rest here
    occ[row][col] = true;
    settledCount++;
    return true;
  }
  // Fallback: if we didn't settle (edge case), place here
  occ[row][col] = true;
  settledCount++;
  return true;
}

function isEmpty(r, c) {
  if (r < 0 || r >= rowsB) return false;
  const rr = rowRanges[r];
  if (c < 0 || c >= rr.cols) return false;
  return !occ[r][c];
}

/* ---------- Draw ---------- */
function draw() {
  background(BG);

  // Time & exact target
  const now = millis();
  const elapsed = (now - startMs) / 1000;
  const leftMs = max(0, endMs - now);
  const leftS = ceil(leftMs / 1000);

  const targetMoved = min(G, floor(elapsed * grainsPerSec));
  const needToSettle = targetMoved - settledCount;

  // Catch up: settle as many grains as needed this frame to match target
  // Do multiple settles per frame for smoothness
  const settlesThisFrame = constrain(needToSettle, 0, 400); // cap to avoid long frames
  for (let k = 0; k < settlesThisFrame; k++) emitAndSettleOne();

  // Draw hourglass frame
  drawGlass();

  // Draw remaining top grains
  const topVisible = max(0, G - settledCount);
  noStroke(); fill(FG);
  for (let i = 0; i < topVisible; i++) {
    const p = topDots[i];
    circle(p.x, p.y, DOT_SIZE);
  }

  // Draw bottom settled grains (from occ grid)
  for (let r = 0; r < rowsB; r++) {
    const rr = rowRanges[r];
    for (let c = 0; c < rr.cols; c++) {
      if (!occ[r][c]) continue;
      const x = rr.xStart + (c + 0.5) * cell;
      const y = rr.y;
      circle(x, y, DOT_SIZE);
    }
  }

  // HUD
  const prog = G === 0 ? 1 : settledCount / G;
  drawHUD(leftS, prog);

  // Stop exactly at timer end: force final catch-up then freeze
  if (now >= endMs) {
    // Complete any remaining grains immediately
    while (settledCount < G) emitAndSettleOne();
    drawHUD(0, 1);
    noLoop();
  }
}

function drawGlass() {
  stroke(255, 28); strokeWeight(2); noFill();

  // Top polygon
  const tLeftTop  = createVector(neckX - chamberHalfWTop, topY0);
  const tRightTop = createVector(neckX + chamberHalfWTop, topY0);
  const tLeftNeck = createVector(neckX - chamberHalfWNeck, topY1);
  const tRightNeck= createVector(neckX + chamberHalfWNeck, topY1);
  beginShape();
  vertex(tLeftTop.x, tLeftTop.y);
  vertex(tRightTop.x, tRightTop.y);
  vertex(tRightNeck.x, tRightNeck.y);
  vertex(tLeftNeck.x, tLeftNeck.y);
  endShape(CLOSE);

  // Bottom polygon
  const bLeftNeck = createVector(neckX - chamberHalfWNeck, botY0);
  const bRightNeck= createVector(neckX + chamberHalfWNeck, botY0);
  const bLeftBot  = createVector(neckX - chamberHalfWTop, botY1);
  const bRightBot = createVector(neckX + chamberHalfWTop, botY1);
  beginShape();
  vertex(bLeftBot.x, bLeftBot.y);
  vertex(bRightBot.x, bRightBot.y);
  vertex(bRightNeck.x, bRightNeck.y);
  vertex(bLeftNeck.x, bLeftNeck.y);
  endShape(CLOSE);

  // Neck lines
  line(tLeftNeck.x, topY1, bLeftNeck.x, botY0);
  line(tRightNeck.x, topY1, bRightNeck.x, botY0);
}

function drawHUD(leftS, prog) {
  const cx = width * 0.5;
  const numY = height * 0.30;
  const timeY = height * 0.42;

  if (SHOW_PLATE) {
    noStroke(); fill(0, 150);
    const r = min(width, height) * 0.16;
    circle(cx, numY, r * 1.35);
    rectMode(CENTER);
    rect(cx, timeY, r * 1.35, r * 0.45, r * 0.08);
    rectMode(CORNER);
  }

  noStroke(); fill(255);
  textSize(NUMBER_SIZE);
  text(String(N), cx, numY);

  const mm = floor(leftS / 60);
  const ss = leftS % 60;
  const timeStr = nf(mm, 2) + ":" + nf(ss, 2);
  fill(230);
  textSize(NUMBER_SIZE * 0.38);
  text(timeStr, cx, timeY);

  const w = min(width * 0.66, 720);
  const h = 4;
  const x = (width - w) * 0.5;
  const y = height * 0.92;
  fill(70); rect(x, y, w, h, 2);
  fill(255); rect(x, y, w * prog, h, 2);
}
