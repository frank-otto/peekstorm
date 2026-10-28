// Peekstorm rules engine (pure logic, no rendering, runs in node for the simulation tests).
// Ghosts hide in spots behind the props. The lantern beam (x, z, r) reveals a ghost over ~0.3 s; a revealed ghost loses its nerve and
// dashes to another spot. Tap a revealed / peeking / dashing ghost to catch it. Catches charge the STORM; a full storm lets the player
// call the LIGHTNING REVEAL: time slows, every ghost freezes and glows (×2). Quota of ghosts per night within the lantern oil.
import { SPOTS, PSPOTS, YARD } from './layout.js';
export const DIFF = {
  kids:   { quota: 10, oil: 100, oilBonus: 3,   nerve: 2.6, revealT: .22, peekEvery: 4.5, peekLen: 1.7, beamR: 1.65, conc: 3, decoys: 0, shade: 0,   stormGain: .34, decoyCost: 0, swap: 0 },
  easy:   { quota: 12, oil: 85, oilBonus: 2.5, nerve: 1.6, revealT: .26, peekEvery: 7,   peekLen: 1.0, beamR: 1.45, conc: 3, decoys: 1, shade: .15, stormGain: .26, decoyCost: 3, swap: 0 },
  medium: { quota: 15, oil: 80, oilBonus: 1.6, nerve: 1.05, revealT: .3, peekEvery: 9,   peekLen: .68, beamR: 1.3,  conc: 4, decoys: 2, shade: .25, stormGain: .2,  decoyCost: 4, swap: 1 },
  hard:   { quota: 18, oil: 75, oilBonus: 1.2, nerve: .68, revealT: .34, peekEvery: 11,  peekLen: .6,  beamR: 1.15, conc: 4, decoys: 3, shade: .38, stormGain: .17, decoyCost: 5, swap: 1 } };
export const NIGHTS = [ // I Pumpkin Patch · II Old Churchyard · III Storm Night
  { mimic: .35, shadeK: 0, rain: 0, swapEvery: 0, decoyK: .5, storm0: .35 },
  { mimic: .2, shadeK: 1, rain: .25, swapEvery: 0, decoyK: 1, storm0: .2 },
  { mimic: .2, shadeK: 1.4, rain: 1, swapEvery: 7, decoyK: 1.5, storm0: .1 } ];
export const TYPES = { sheet: { pts: 100, nerveK: 1, revK: 1 }, mimic: { pts: 150, nerveK: 1.5, revK: 1.15 }, shade: { pts: 200, nerveK: .55, revK: 1.25 } };
export const STRIKE_LEN = 3.6; // game seconds of the lightning reveal (the game also slows time)
function mulberry(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
export class Hunt {
  constructor({ mode = 'night', night = 0, diff = 'medium', seed = 1 } = {}) {
    this.mode = mode; this.night = clamp(night | 0, 0, 2); this.diffName = DIFF[diff] ? diff : 'medium'; this.kids = this.diffName === 'kids';
    this.D = { ...DIFF[this.diffName] }; this.N = NIGHTS[mode === 'endless' ? 1 : this.night]; this.rnd = mulberry(seed >>> 0 || 1); this.seed = seed;
    this.quota = mode === 'endless' ? Infinity : this.D.quota; this.oil = mode === 'endless' ? 45 : this.D.oil; this.oilMax = this.oil;
    this.state = 'count'; this.t = 0; this.stT = 0; this.ev = []; this.ghosts = []; this.nextId = 1; this.caught = 0; this.spawned = 0; this.score = 0; this.combo = 0; this.best = 0; this.lastCatch = -99;
    this.storm = this.N.storm0; this.stormReady = false; this.strikes = 0; this.frozenCaught = 0; this.midair = 0; this.decoyHits = 0; this.taps = 0; this.misses = 0; this.cineT = 0; this.byType = { sheet: 0, mimic: 0, shade: 0 };
    this.beam = { x: 0, z: 0, r: this.D.beamR, on: true }; this.res = null; this.wave = 0; this.swapT = this.N.swapEvery || 0;
    this.decoys = []; const nd = Math.round(this.D.decoys * this.N.decoyK); for (let i = 0; i < nd; i++) this.decoys.push({ id: i, kind: i % 2 ? 'owl' : 'cat', spot: -1, x: 0, z: 0, hop: 0, look: 0 });
    this.decoys.forEach(d => this.placeDecoy(d, true));
    this.conc = this.mode === 'endless' ? 3 : this.D.conc;
  }
  get mult() { return Math.min(4, 1 + Math.floor(this.combo / 3)); }
  get acc() { return this.taps ? (this.caught / this.taps) : 0; }
  get remaining() { return this.quota - this.caught; }
  emit(t, o = {}) { this.ev.push({ t, ...o }); }
  // ---- spots ----
  freeSpots(kind, avoidBeam = true, except = -1) { const L = kind === 'mimic' ? PSPOTS : SPOTS; const used = new Set(this.ghosts.filter(g => g.alive && g.kind === kind).map(g => g.spot).concat(this.ghosts.filter(g => g.alive && g.kind === kind && g.to >= 0).map(g => g.to)));
    if (kind !== 'mimic') this.decoys.forEach(d => used.add(d.spot));
    const out = []; for (let i = 0; i < L.length; i++) { if (used.has(i) || i === except) continue; if (avoidBeam && Math.hypot(L[i].x - this.beam.x, L[i].z - this.beam.z) < this.beam.r * 1.6) continue; out.push(i); } return out; }
  spotPos(kind, i) { const s = (kind === 'mimic' ? PSPOTS : SPOTS)[i]; return s; }
  placeDecoy(d, first) { const cands = []; for (let i = 0; i < SPOTS.length; i++) { const k = SPOTS[i].k; if ((d.kind === 'cat' && k === 'stone') || (d.kind === 'owl' && (k === 'oak' || k === 'crypt' || k === 'stone'))) if (!this.ghosts.some(g => g.alive && g.spot === i && g.kind !== 'mimic') && !this.decoys.some(o => o !== d && o.spot === i)) cands.push(i); }
    if (!cands.length) return; const i = cands[Math.floor(this.rnd() * cands.length)]; d.spot = i; d.x = SPOTS[i].x; d.z = SPOTS[i].z + .5; d.hop = first ? 0 : 1; d.next = 9 + this.rnd() * 9; }
  pickKind() { const r = this.rnd(); const sh = this.D.shade * this.N.shadeK; if (r < sh) return 'shade'; if (r < sh + this.N.mimic && this.freeSpots('mimic').length) return 'mimic'; return 'sheet'; }
  spawn() { const kind = this.pickKind(); let fs = this.freeSpots(kind); if (!fs.length) fs = this.freeSpots(kind, false); if (!fs.length) return null;
    const spot = fs[Math.floor(this.rnd() * fs.length)], p = this.spotPos(kind, spot);
    const g = { id: this.nextId++, kind, spot, to: -1, x: p.x, z: p.z, fx: p.x, fz: p.z, alive: true, st: 'hide', rev: 0, nerveT: 0, peekT: this.D.peekEvery * (.4 + this.rnd() * .9), stT: 0, flT: 0, flLen: .6, frozen: false, born: this.t, side: this.rnd() < .5 ? -1 : 1 };
    this.ghosts.push(g); this.spawned++; this.emit('spawn', { id: g.id, kind }); return g; }
  fill() { const alive = this.ghosts.filter(g => g.alive).length; const want = Math.min(this.conc, this.remaining - 0); let n = alive; while (n < want && n + this.caught < this.quota) { if (!this.spawn()) break; n++; } }
  flee(g, why = 'nerve') { let fs = this.freeSpots(g.kind, true, g.spot); if (!fs.length) fs = this.freeSpots(g.kind, false, g.spot); if (!fs.length) { g.nerveT = 0; return; }
    // prefer a spot away from the beam
    fs.sort((a, b) => { const A = this.spotPos(g.kind, a), B = this.spotPos(g.kind, b); return Math.hypot(B.x - this.beam.x, B.z - this.beam.z) - Math.hypot(A.x - this.beam.x, A.z - this.beam.z); });
    const pick = fs[Math.floor(this.rnd() * Math.min(3, fs.length))]; const p = this.spotPos(g.kind, pick);
    g.to = pick; g.fx = g.x; g.fz = g.z; g.tx = p.x; g.tz = p.z; g.st = 'flee'; g.flT = 0; g.flLen = clamp(Math.hypot(p.x - g.x, p.z - g.z) * .09, .45, 1.1) / (g.kind === 'shade' ? 1.25 : 1) * (this.kids ? 1.4 : 1); g.nerveT = 0;
    this.emit('flee', { id: g.id, kind: g.kind, why }); }
  // ---- input ----
  setBeam(x, z) { this.beam.x = clamp(fin(x, this.beam.x), YARD.x0, YARD.x1); this.beam.z = clamp(fin(z, this.beam.z), YARD.z0, YARD.z1); }
  // tap-to-shine: the ghost hiding closest to the tapped spot is startled and pops up for a clear moment (a catch window)
  startle(x, z) { if (this.state !== 'hunt') return null; let best = null, bd = this.beam.r * 1.8;
    for (const g of this.ghosts) { if (!g.alive || g.st !== 'hide') continue; const d = Math.hypot(g.x - x, (g.z - z) * .78); if (d < bd) { bd = d; best = g; } }
    if (best) { best.st = 'peek'; best.stT = 0; best.startled = true; best.peekLen = this.kids ? 2.8 : Math.max(1.3, this.D.peekLen * 2); this.emit('startle', { id: best.id, kind: best.kind, x: best.x }); } return best; }
  catchable(g) { return g.alive && (this.state === 'strike' || g.st === 'peek' || g.st === 'flee' || g.rev > .35); }
  tap(id) { if (!(this.state === 'hunt' || this.state === 'strike')) return { ok: false }; this.taps++;
    const g = this.ghosts.find(q => q.id === id); if (!g || !this.catchable(g)) { this.misses++; this.combo = 0; // a clumsy grab makes noise: every peeking ghost ducks back behind its stone
      if (!this.kids && this.state === 'hunt') for (const q of this.ghosts) if (q.alive && q.st === 'peek') { q.st = 'hide'; q.stT = 0; q.peekT = this.D.peekEvery * (.8 + this.rnd() * .6); }
      this.emit('tapMiss', {}); return { ok: false }; }
    const frozen = this.state === 'strike', midair = g.st === 'flee';
    if (this.t - this.lastCatch < 4.0) this.combo++; else this.combo = 1; this.lastCatch = this.t; this.best = Math.max(this.best, this.combo);
    const pts = Math.round(TYPES[g.kind].pts * this.mult * (frozen ? 2 : 1) + (midair ? 50 : 0) + (g.st === 'peek' && !frozen ? 25 : 0));
    this.score += pts; this.caught++; this.byType[g.kind]++; if (frozen) this.frozenCaught++; if (midair) this.midair++;
    g.alive = false; g.st = 'caught'; this.oil = Math.min(this.oilMax + 20, this.oil + this.D.oilBonus);
    if (!frozen) { this.storm = Math.min(1, this.storm + this.D.stormGain); }
    this.emit('catch', { id: g.id, kind: g.kind, pts, combo: this.combo, mult: this.mult, frozen, midair, x: g.x, z: g.z, peek: g.st === 'peek' });
    if (this.mode === 'endless' && this.caught % 6 === 0) { this.conc = Math.min(6, this.conc + 1); this.D.nerve = Math.max(.45, this.D.nerve * .88); this.D.oilBonus = Math.max(.5, this.D.oilBonus * .85); this.D.peekEvery *= 1.1; this.wave++; this.emit('wave', { n: this.wave }); }
    if (this.caught >= this.quota) { this.state = 'clear'; this.stT = 0; const bonus = Math.round(Math.max(0, this.oil) * 20); this.score += bonus; this.emit('clear', { bonus }); }
    return { ok: true, pts }; }
  tapDecoy(i) { if (!(this.state === 'hunt' || this.state === 'strike')) return; const d = this.decoys[i]; if (!d) return; this.taps++; this.decoyHits++; this.combo = 0;
    if (!this.kids) this.oil = Math.max(0, this.oil - this.D.decoyCost); this.emit('decoy', { kind: d.kind, i, cost: this.kids ? 0 : this.D.decoyCost }); d.next = Math.min(d.next, .6); }
  canStrike() { return this.state === 'hunt' && this.storm >= 1; }
  strike() { if (!this.canStrike()) return false; this.state = 'strike'; this.cineT = 0; this.storm = 0; this.stormReady = false; this.strikes++;
    for (const g of this.ghosts) if (g.alive) { g.frozen = true; if (g.st === 'flee') { g.x = g.fx + (g.tx - g.fx) * Math.min(1, g.flT / g.flLen); g.z = g.fz + (g.tz - g.fz) * Math.min(1, g.flT / g.flLen); } }
    this.emit('strike', { n: this.ghosts.filter(g => g.alive).length }); return true; }
  // ---- clock ----
  step(dt) { dt = clamp(fin(dt), 0, .1); this.t += dt; this.stT += dt; const D = this.D;
    if (this.state === 'count') { if (this.stT >= 1.1) { this.state = 'hunt'; this.stT = 0; this.fill(); this.emit('go'); } return; }
    if (this.state === 'end') return;
    if (this.state === 'clear') { if (this.stT > 3.4 && !this.res) { this.res = 'win'; this.state = 'end'; this.emit('end', { res: 'win' }); } return; }
    if (this.state === 'strike') { this.cineT += dt; for (const g of this.ghosts) if (g.alive) g.rev = 1;
      if (this.cineT >= STRIKE_LEN) { this.state = 'hunt'; for (const g of this.ghosts) if (g.alive) { g.frozen = false; g.rev = 0; if (g.st === 'flee') { g.st = 'hide'; g.spot = g.to; g.to = -1; g.x = g.tx; g.z = g.tz; } this.flee(g, 'thunder'); } this.emit('strikeEnd', {}); this.fill(); }
      return; }
    // ---- hunt ----
    this.oil -= dt; if (this.oil <= 10 && !this.lowWarned && !this.kids) { this.lowWarned = true; this.emit('lowOil'); } if (this.oil > 14) this.lowWarned = false;
    if (this.oil <= 0) { if (this.kids && this.mode !== 'endless') { this.oil = 30; this.emit('refill'); } else { this.oil = 0; this.state = 'end'; this.res = this.mode === 'endless' ? 'over' : 'fail'; this.emit('end', { res: this.res }); return; } }
    this.storm = Math.min(1, this.storm + dt * (this.kids ? .02 : .008)); if (this.storm >= 1 && !this.stormReady) { this.stormReady = true; this.emit('stormReady'); }
    if (D.swap && this.N.swapEvery) { this.swapT -= dt; if (this.swapT <= 0) { this.swapT = this.N.swapEvery * (.7 + this.rnd() * .6); const hid = this.ghosts.filter(g => g.alive && g.st === 'hide' && g.kind !== 'mimic'); if (hid.length) this.flee(hid[Math.floor(this.rnd() * hid.length)], 'swap'); } }
    const b = this.beam;
    for (const g of this.ghosts) { if (!g.alive) continue; g.stT += dt;
      if (g.st === 'flee') { g.flT += dt; const k = Math.min(1, g.flT / g.flLen), e = k * k * (3 - 2 * k); g.x = g.fx + (g.tx - g.fx) * e; g.z = g.fz + (g.tz - g.fz) * e; g.rev = Math.max(g.rev - dt * 2, 0);
        if (k >= 1) { g.st = 'hide'; g.spot = g.to; g.to = -1; g.stT = 0; g.peekT = D.peekEvery * (.6 + this.rnd() * .8); g.side = this.rnd() < .5 ? -1 : 1; this.emit('land', { id: g.id }); } continue; }
      const d = Math.hypot(g.x - b.x, (g.z - b.z) * .78), lit = b.on && d < b.r * (g.kind === 'mimic' ? .8 : 1);
      if (lit) g.rev = Math.min(1, g.rev + dt / (D.revealT * TYPES[g.kind].revK)); else g.rev = Math.max(0, g.rev - dt * 1.4);
      if (lit && g.rev >= 1) { if (g.nerveT === 0) this.emit('spotted', { id: g.id, kind: g.kind }); g.nerveT += dt; if (g.nerveT >= D.nerve * TYPES[g.kind].nerveK) this.flee(g); }
      else if (!lit) g.nerveT = Math.max(0, g.nerveT - dt * .5);
      if (g.st === 'hide') { g.peekT -= dt; if (g.peekT <= 0 && !lit) { g.st = 'peek'; g.stT = 0; this.emit('peek', { id: g.id, kind: g.kind, x: g.x }); } }
      else if (g.st === 'peek' && g.stT >= (g.peekLen || D.peekLen)) { g.st = 'hide'; g.peekLen = 0; g.startled = false; g.stT = 0; g.peekT = D.peekEvery * (.6 + this.rnd() * .8); } }
    for (const d of this.decoys) { d.next -= dt; d.hop = Math.max(0, d.hop - dt * 2); d.look += dt; if (d.next <= 0) { this.placeDecoy(d, false); this.emit('decoyMove', { kind: d.kind }); } }
    this.fill(); }
  stars() { if (this.res !== 'win') return 0; const q = this.D.quota; return this.score >= q * 520 ? 3 : this.score >= q * 340 ? 2 : 1; }
}
// a human-like autoplayer for tests and the video: it does NOT know where ghosts hide – it reacts to what a player can see (peeks, ghosts in
// the beam, dashing ghosts, the lightning) after a reaction delay, otherwise it sweeps the beam along a tour of the hiding spots.
// opt.cheat = true lets it aim at hidden ghosts (used to script the video quickly).
export function botStep(Q, acc, rnd, dt, opt = {}) {
  if (!(Q.state === 'hunt' || Q.state === 'strike')) return null;
  if (Q.canStrike() && opt.strike !== false) { Q.strike(); return 'strike'; }
  const B = Q._bot || (Q._bot = { react: 0, tour: [], seen: 0, aim: null });
  if (Q.state === 'strike') { const f = Q.ghosts.find(g => g.alive); if (f && rnd() < Math.min(1, dt * (opt.strikeRate || 5))) { Q.tap(f.id); return 'tap'; } return null; }
  const alive = Q.ghosts.filter(g => g.alive); if (!alive.length) return null;
  const perceived = alive.filter(g => g.st === 'peek' || g.rev > .35 || g.st === 'flee' || opt.cheat);
  const vis = perceived.find(g => Q.catchable(g));
  if (vis) { B.react += dt; if (B.react > (opt.react ?? .32)) { B.react = 0; if (rnd() < acc) { Q.tap(vis.id); return 'tap'; } Q.tap(-1); return 'miss'; } } else B.react = 0;
  let tgt = perceived.length ? perceived.reduce((a, g) => Math.hypot(g.x - Q.beam.x, g.z - Q.beam.z) < Math.hypot(a.x - Q.beam.x, a.z - Q.beam.z) ? g : a, perceived[0]) : null;
  let tx, tz;
  if (tgt) { tx = tgt.st === 'flee' ? tgt.tx : tgt.x; tz = tgt.st === 'flee' ? tgt.tz : tgt.z; }
  else { if (!B.tour.length) { const L = SPOTS.map((s, i) => i).concat(PSPOTS.map((s, i) => -1 - i)); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; } B.tour = L; }
    const k = B.tour[0], s = k >= 0 ? SPOTS[k] : PSPOTS[-1 - k]; tx = s.x; tz = s.z; if (Math.hypot(tx - Q.beam.x, tz - Q.beam.z) < .3) { B.dwell = (B.dwell || 0) + dt; if (B.dwell > .25) { B.tour.shift(); B.dwell = 0; } } }
  const sp = (opt.speed || 7) * dt, dx = tx - Q.beam.x, dz = tz - Q.beam.z, d = Math.hypot(dx, dz); if (d > 1e-3) Q.setBeam(Q.beam.x + dx / d * Math.min(d, sp), Q.beam.z + dz / d * Math.min(d, sp));
  return null; }
