function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(42);

  // Read ?num=123 if provided
  const params = new URLSearchParams(window.location.search);
  const n = params.get('num') ?? '—';
  text(`Hello Numbers: ${n}`, width/2, height/2);
}

function draw() {
  noStroke();
  fill(255, 16);
  ellipse(random(width), random(height), 16, 16);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
