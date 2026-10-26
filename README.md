# 👻 Peekstorm

Day 18 of a daily Halloween web-game series – **2 days to Halloween 🎃**

A cinematic 3D ghost hunt in a stormy churchyard at night. Ghosts hide behind crooked gravestones, the stone crypt, the dead oak, the well, the hay bales – and some pretend to be pumpkins in the pumpkin patch. Sweep your lantern across the yard, listen for giggles, watch for peeking eyes, and tap a ghost while it is in your light, peeking out or dashing away. Stay on one too long and it loses its nerve and bolts to a new hiding place.

**The hook – THE LIGHTNING REVEAL.** Every catch charges the storm. When it is full, tap ⚡: a bolt splits the sky and hits the old oak, time slows, the whole churchyard flashes white – and every hiding ghost glows through the stones, frozen mid-move. Catch them for **double points** before the dark returns. And in that flash you see it: the hill, the fence, the trees and the church are full of ghosts. **They were watching all along.**

## How to play
- **Drag** (or move the mouse) to point the lantern; **tap / click** a ghost to catch it. Keys: arrows / WASD aim, **Space** catches in the light, **L** calls the lightning, **Esc** menu.
- A ghost can be caught while it is lit, peeking out or in mid-air. Catches within 4 s build a combo (×2 at 3, ×3 at 6, up to ×4). Peek catches and mid-air catches give bonus points.
- **Yellow eyes are a cat or an owl** – tapping them costs lantern oil and the combo.
- The lantern burns down; every catch adds a little oil. If it goes out, the night is lost. Leftover oil is a bonus when the yard is clear. 1 to 3 stars per night.
- Ghosts peeking outside the view show a small arrow at the screen edge.

**Nights:** I Pumpkin Patch (pumpkin mimics) · II Old Churchyard (dark shades, drizzle) · III Storm Night (heavy rain, more decoys, ghosts that swap hiding places).
**Modes:** Night · **Endless Hunt** (every catch refuels, the ghosts get bolder wave by wave) · **Player 1 vs Player 2** hot-seat duel (same yard, same ghosts, highest score wins).
**Difficulty:** Easy / Medium / Hard (number of ghosts, how fast they lose their nerve, peek length, lantern width, decoys). **Kids mode:** friendly ghosts that peek out often and stay longer, a wide lantern, no decoy penalty – and the lantern never runs out.

**One tap to play.** The game opens in the middle of the lightning: frame one already shows the bolt in the oak and every ghost glowing through the stones. Then it goes dark, the lantern clicks on, a ghost peeks out and the title lands. Tap (or click) anywhere and you are straight in Night I, sound on, with a short hint. After the opening the start screen has one big PLAY button; Endless Hunt, the duel, nights, difficulty, kids mode, quality, sound and the intro replay sit behind the small ⚙. The language follows the browser (German for German browsers, English otherwise) with a tiny DE/EN switch (remembered). A 1080×1350 score card to save or share. Quality is automatic (Normal, steps down only if the frame rate stays low).

## Tech
- Three.js (WebGL): extruded granite gravestones with engraved bump maps, a stone crypt with an iron gate, a dead oak from merged tubes, PBR pumpkins with carved glowing faces, thousands of instanced wind-blown grass blades, an iron fence, a hill with a lit church, a storm-cloud sky shader that lights up with every flash, rain streaks, ground mist, exponential fog, moonlight + lantern spot light with shadows, a volumetric light cone with dust motes, PMREM environment light, HDR bloom with a clamped high-pass (glow, no glare), colour grade.
- Ghosts with a waving-hem shader and a fresnel rim, an X-ray pass that shows them through the stones during the lightning, pumpkin mimics, a cat and owl decoy, and an instanced crowd of watching ghosts.
- A pure, deterministic rules engine (`src/rules.js`): hiding spots, reveal + nerve under the beam, peeks, flight arcs, decoys, combo, storm meter → lightning freeze, oil, endless waves, identical duel yards, kids rules, and a human-like autoplayer (it only reacts to what a player can see) for tests and the video. It only emits events; visuals and sounds react to them.
- Frame-rate independent clock (out-of-order frame stamps give dt = 0) with NaN guards; GPU resources are disposed on quality changes and bolts are rebuilt without leaks (leak-tested).
- Sounds: real CC0 recordings only, no oscillators; original sample-based music. See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
python3 test/test_game.py     # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py   # phones: WebKit iPhone + Chromium Pixel, real taps, portrait + landscape
```

Built with Grok Bot · @Frank_AI_Lab. Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).
