// node tools/sim.mjs – balance simulation of the rules with a human-like bot (good / weak player), 4 seeds per row
import { Hunt, botStep } from '../src/rules.js';
let s = 99; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const P = { good: { acc: .9, react: .42, speed: 5.5 }, weak: { acc: .6, react: .75, speed: 3.2 } };
for (const mode of ['night', 'endless']) for (const night of (mode === 'night' ? [0, 1, 2] : [1])) for (const diff of ['kids', 'easy', 'medium', 'hard']) for (const pn of ['good', 'weak']) {
  const out = []; for (const seed of [11, 22, 33, 44]) { const Q = new Hunt({ mode, night, diff, seed }); let t = 0; const p = P[pn];
  while (Q.state !== 'end' && t < 600) { const dt = Q.state === 'strike' ? 1 / 60 * .35 : 1 / 60; botStep(Q, p.acc, rnd, dt, p); Q.step(dt); t += 1 / 60; Q.ev.length = 0; }
  out.push(`${Q.res}:${Q.caught}/${Q.quota === Infinity ? '∞' : Q.quota}:${Q.score}:${Q.stars()}★:${t.toFixed(0)}s:k${Q.strikes}`); }
  console.log(mode, night, diff, pn, out.join('  ')); }
