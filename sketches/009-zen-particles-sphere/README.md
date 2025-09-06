# Numbers: Zen Dissolve + Particle Sphere

This project combines the **Zen Digit Dissolve** animation with a **spinning particle sphere** behind the auction number.

## Files
- `index.html` — Loads p5.js and your sketch.
- `sketch.js` — Main animation code (digits + sphere).
- `README.md` — Instructions for setup and usage.

## How to Run
1. Clone or copy this folder into your local machine.
2. Open the folder in **Visual Studio Code**.
3. Make sure you have the **Live Server** extension installed.
4. Right-click `index.html` → **Open with Live Server** (or click **Go Live** in the bottom-right).
5. Your browser will open and run the sketch.

## URL Parameters
You can control the animation via URL query parameters:

- `?num=137` → Number/string to display (default `131`).
- `?dur=600` → Run time in seconds (shows a countdown); omit to run indefinitely.
- `?breath=8` → Seconds for one inhale/exhale (default `8`).
- `?sphere=0` → Disable the background sphere (default is `1`, enabled).
- `?sdens=1800` → Approximate number of sphere particles (default `1600`).
- `?sspin=0.12` → Sphere spin speed in radians/sec (default `0.1`).
- `?salpha=120` → Base alpha (opacity) for sphere dots (default `110`).

### Example
