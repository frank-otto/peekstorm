// WebAudio for the embedded CC0 recordings (window.PS_SOUNDS): ghost giggles and whispers, thunder and rain for the storm, the lantern's match,
// creaking gates, a cat and owls, booms, choir, bells, wind, and a real contrabass, pizzicato, organ, harp, xylophone and timpani (VSCO 2 CE).
// Nothing is synthesized; the churchyard echo is a generated convolution reverb.
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 },
  xy: { C5: 72, G5: 79, C6: 84 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.6) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
function kick() { try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {} } // a silent sample inside the gesture unlocks iOS Safari
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); kick(); } return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+: play even with the ring/silent switch on silent
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9; if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } kick();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.PS_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind' || b === 'heart') - (a.endsWith('_loop') || a === 'wind' || a === 'heart')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__psAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
export const sfx = {
  ui() { play('knock', .22, 1.0, 0, .15); },
  lantern() { play('match', .4, 1, 0, .3); play('iron_creak', .08, 1.6, .05, .3); },
  go() { play('bell_far', .3, 1, 0, .7); play('whisper', .2, 1, .3, .7, 0, -.3); },
  peek(pan, kids) { play(kids ? 'giggle_kids' : 'giggle', kids ? .2 : .16, (kids ? 1.05 : 1.15) * jit(.08), 0, .55, 1.0, pan); if (R() < .35) play('whisper', .08, 1.2 * jit(), .1, .7, 1.2, pan); },
  spotted(pan) { play('squeak_kids', .12, 1.25 * jit(.08), 0, .4, 0, pan); },
  flee(pan, why) { play('whoosh', why === 'thunder' ? .12 : .24, 1.25 * jit(), 0, .5, 0, pan); play('swish_a', .14, 1.1 * jit(), .05, .4, 0, pan); if (why === 'nerve' && R() < .5) play('giggle', .1, 1.4 * jit(), .15, .6, .8, pan); },
  catch(e, pan, kids) { const m = Math.min(e.combo, 8); play('magic', .32, 1 + m * .03, 0, .6, 0, pan); play('swoosh_rise', .22, 1.2, 0, .5, 0, pan); note('hp', 62 + [0, 3, 5, 7, 10, 12, 15, 17, 19][m], .22, 0, .02, .6, pan); note('xy', 74 + [0, 3, 5, 7, 10, 12, 15, 17, 19][m], .12, 0, .05, .5, pan);
    if (e.kind === 'mimic') { play('thump', .3, 1.2, 0, .4, 0, pan); play('giggle_kids', .14, .8, .05, .6, .8, pan); } if (e.kind === 'shade') play('whisper', .2, .8, 0, .7, 1, pan);
    if (e.frozen) { play('glass', .16, 1.5 * jit(), 0, .6, 0, pan); play('sparkle', .18, 1.1, 0, .6, 0, pan); } if (e.midair) play('tinkle', .22, 1.2, 0, .6, 0, pan); if (e.combo >= 3 && e.combo % 3 === 0) { play('choir_ah', .2, 1, .05, .7); play('bell_strike', .18, 1.1, .05, .6); } },
  tapMiss() { play('swish_b', .05, 1.3 * jit(), 0, .2); },
  decoy(kind, pan, kids) { if (kind === 'cat') { play('meow', .42, 1 * jit(.05), 0, .4, 0, pan); } else { play('owl', .35, 1, 0, .6, 0, pan); play('flap_1', .3, 1, .05, .4, 0, pan); } if (!kids) { play('heart', .3, 1.1, .1, .2); note('cb', 31, .16, 0, .05, .4); } },
  decoyMove(kind) { if (kind === 'owl' && R() < .5) play('flap_1', .12, 1 * jit(), 0, .4, 0, (R() - .5)); },
  stormReady() { play('rumble', .42, 1, 0, .5); play('thunder_soft', .35, 1, .1, .6); play('riser', .22, 1, 0, .5); },
  // THE LIGHTNING REVEAL
  strike() { play('crack', .6, .7, 0, .4); play('thunder_big', .95, 1, 0, .6); play('boom_cine', .85, .85, 0, .5); play('sub', .7, 1, 0, .2); play('boom_bass', .6, .9, .02, .4);
    play('thunder', .55, .95, .35, .7); play('ghosts', .5, .95, .25, .7, 3); play('choir_swell', .38, .9, .15, .7); play('whisper', .28, .9, .5, .8, 2, -.5); play('whisper', .22, 1.1, .8, .8, 2, .5); [26, 33].forEach((m, i) => note('ped', m, .4, 3.2, .1 + i * .02, .8)); [50, 53, 57].forEach((m, i) => note('org', m, .14, 3, .12 + i * .02, .8)); },
  strikeEnd() { play('thunder_soft', .38, .9, 0, .6); play('swoosh_rise', .3, .7, 0, .5); for (let i = 0; i < 3; i++) play('giggle', .1, 1.2 + i * .1, .1 + i * .12, .6, .8, (i - 1) * .7); },
  clear() { play('success', .45, .95, 0, .5); play('choir_ah', .4, 1, .1, .7); play('bells_peal', .35, 1, .2, .7); play('fw_burst', .3, 1, .5, .5); play('fw_burst_b', .28, 1, .9, .5, 0, .4); play('fw_crackle', .25, 1, 1.0, .6); play('magic', .3, .9, .3, .6); },
  lowOil() { play('heart', .4, 1, 0, .2); play('heart', .3, 1, .55, .2); },
  refill() { play('match', .35, 1, 0, .3); play('magic', .25, 1.1, .1, .5); },
  wave() { play('gate_creak', .25, 1, 0, .6); play('stinger', .2, 1, .2, .6); },
  win() { play('success', .4, 1, 0, .5); play('applause', .2, 1, .4, .5, 2.5); play('giggle_kids', .15, 1, .6, .6); },
  star(i) { play('bell_strike', .42, [.9, 1, 1.12][i] || 1, 0, .6); play('harp', .25, [.9, 1, 1.12][i] || 1, .02, .6); },
  fail() { [50, 53, 56].forEach((m, i) => note('org', m, .2, 2, i * .04, .7)); note('ped', 26, .4, 2.4, 0, .7); play('thunder_soft', .3, 1, .1, .6); play('giggle', .2, .8, .4, .7, 1.4); play('wind', .3, .9, 0, .4, 2); },
  turn() { play('bell_far', .38, 1, 0, .6); play('gate_creak', .2, 1, .3, .6); },
  owl() { play('owl', .1, 1, 0, .6, 0, (R() - .5) * 1.4); }, crow() { play('crow', .09, .95 * jit(), 0, .6, 0, (R() - .5) * 1.2); },
  far() { const n = rr(['howl', 'gate_creak', 'iron_creak', 'bell_far', 'whisper']); play(n, n === 'whisper' ? .07 : .09, 1 * jit(.04), 0, .8, 0, (R() - .5) * 1.4); },
  intro() { this.strike(); },
  rewind() { play('glissup', .3, .7, 0, .6); play('swoosh_rise', .35, .6, 0, .6); },
  title() { play('boom_cine', .9, .9, 0, .5); play('hit_dram', .6, .85, 0, .5); play('thunder_soft', .4, 1, .05, .6); [26, 38].forEach((m, i) => note('ped', m, .5, 3, i * .02, .7)); [50, 57, 62, 65].forEach((m, i) => note('org', m, .2, 3, .03 + i * .02, .7)); play('giggle', .18, 1.1, .5, .7, 1, .4); }
};
