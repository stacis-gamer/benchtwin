# BenchTwin

A global hub of editable 3D hardware boards. Scan a real board, practice soldering in a safe sandbox, and export every action as robot-ready instructions.

This repo contains **AeroReflow**, the sandbox core: a browser-based 3D soldering chamber with a robot arm controlled by webcam hand gestures.

## Run locally
1. Install Node.js LTS (20 or newer)
2. `git clone https://github.com/stacis-gamer/benchtwin.git`
3. `cd benchtwin`
4. `npm ci`
5. `npm run dev`
6. Open http://localhost:5173 and click **Enable Camera** (allow the permission prompt)

## Controls
- Move your hand: the arm follows
- Transporting mode: fist = grab, open hand = release
- Soldering mode: pinch (OK sign) = heat and solder
- No camera: mouse to move, hold Space to grab or solder, keys 1 and 2 switch modes

**Do not upgrade React.** This project needs React 18 (R3F v8, drei v9).
