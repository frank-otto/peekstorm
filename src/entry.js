import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createWorld, updateWorld, gradeShader, applyWorldQuality, QUALITY, buildBolt, addGrass } from './world.js';
import { createGhostKit, updateGhosts, ghostScreenPos, decoyPos } from './ghosts.js';
import { createFX, sparks, puff, updateFX, seedFX } from './fx.js';
import { Hunt, botStep, DIFF, NIGHTS, STRIKE_LEN } from './rules.js';
import { STONES, CRYPT, OAK, HAY, BARRELS, WELL, PUMPKINS, SPOTS, PSPOTS } from './layout.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const fmt = n => Math.round(fin(n)).toLocaleString('en-US');
const ROMAN = ['I', 'II', 'III'];
let fxSeed = (window.__psSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { fxSeed = (fxSeed + 0x6D2B79F5) >>> 0; let t = fxSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function autoLang() { try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return /^de\b|^de-/i.test(l) ? 'de' : 'en'; } catch (e) { return 'en'; } }
const S = { state: 'intro', mode: 'night', night: clamp(+ls.get('ps-night', '0') || 0, 0, 2), lang: ls.get('ps-lang', '') || autoLang(), diff: ls.get('ps-diff', 'medium'), kids: ls.get('ps-kids', '0') === '1', q: ls.get('ps-q', ''), qUser: !!ls.get('ps-q', ''),
  name: ls.get('ps-name', 'Player') || 'Player', gt: 0, ts: 1, player: 0, duel: [null, null], result: null, stars: 0, more: false, auto: false, botAcc: .92, botOpt: {}, introT: 0, titleT: -1, endT: 0, punch: 0, newBest: false,
  hintT: -1, camX: 0, wideK: 0, xrayT: 0, crowdT: 0, lanternT: 1, menuT: 3 };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;
let isTouch = matchMedia && matchMedia('(pointer: coarse)').matches;

// ---------------- renderer / scene / post ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__psPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(50, 1, .1, 400);
const F = createFX(scene, W.soft, W.smokeTex); F.floor = .02;
const K = createGhostKit(W, W.pumpkinGeo, W.stemGeo, W.M);
addGrass(W, (x, z) => { if (Math.abs(x - CRYPT.x) < CRYPT.w / 2 + .25 && Math.abs(z - CRYPT.z) < CRYPT.d / 2 + .25) return true; for (const s of STONES) if (Math.hypot(x - s[0], z - s[1]) < .42 * s[4]) return true;
  if (Math.hypot(x - WELL.x, z - WELL.z) < .85 || Math.hypot(x - HAY.x, z - HAY.z) < .8 || Math.hypot(x - BARRELS.x, z - BARRELS.z) < .75 || Math.hypot(x - OAK.x, z - OAK.z) < .55) return true; for (const p of PUMPKINS) if (Math.hypot(x - p[0], z - p[1]) < p[2] * .9) return true; return false; });
let composer, bloom, gradePass, rtOwn;
function disposeComposer() { if (!composer) return; for (const p of composer.passes) { if (p.dispose) p.dispose(); } composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); if (rtOwn) rtOwn.dispose(); composer = null; }
function buildComposer() { disposeComposer();
  const q = QUALITY[S.q]; rtOwn = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  composer = new EffectComposer(renderer, rtOwn); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .4, 1.0); { const hp = bloom.materialHighPassFilter; hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( 2.2 ) );'); hp.needsUpdate = true; } // clamp hot spots: glow, never glare
  composer.addPass(bloom); composer.addPass(new OutputPass()); gradePass = new ShaderPass(gradeShader()); composer.addPass(gradePass); }
function applyQuality(qn, user) {
  if (!QUALITY[qn]) qn = 'mid'; S.q = qn; if (user) { S.qUser = true; ls.set('ps-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; for (const L of [W.key, W.spot]) { L.castShadow = q.shadows; if (q.shadows) L.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } }
  applyWorldQuality(W, q); scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } });
  buildComposer(); resize(); qLabels(); }
function qLabels() { const b = $('btnQ2'); if (b) { b.textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('qAuto')}`; b.title = t('qL'); } }
let VW = 1, VH = 1;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } camera.aspect = VW / VH; camera.updateProjectionMatrix(); }

// ---------------- run state ----------------
let Q = null; const timers = []; const after = (s, f) => timers.push({ t: S.gt + s, f });
const music = new Player();
const bestKey = () => `ps-best-${S.mode}-${S.mode === 'night' || S.mode === 'duel' ? S.night : 'x'}-${dkey()}`;
function resetVisuals() { timers.length = 0; S.ts = 1; S.punch = 0; W.flash = 0; W.hurt = 0; W.boltK = 0; W.xray = 0; W.crowdK = 0; S.xrayT = 0; S.crowdT = 0; S.lanternT = 1; W.lanternK = 1; S.wideK = 0;
  for (let i = 0; i < F.life.length; i++) F.life[i] = 0; for (const p of F.puffs) { p.life = 0; p.s.visible = false; } $('banner').classList.remove('show'); window.__banners = []; window.__pops = []; }
function seedOf() { return S.mode === 'duel' ? (S.duelSeed || 1818) : (window.__psQSeed ?? ((Date.now() & 0xffff) + 1)); }
function start(mode = 'night') { S.mode = ['night', 'endless', 'duel'].includes(mode) ? mode : 'night';
  if (S.mode === 'duel' && S.player !== 1) { S.player = 0; S.duel = [null, null]; S.duelSeed = window.__psQSeed ?? ((Date.now() & 0xffff) + 7); }
  resetVisuals(); Q = new Hunt({ mode: S.mode, night: S.mode === 'endless' ? 2 : S.night, diff: dkey(), seed: seedOf() }); S.state = 'play'; S.result = null; S.more = false; S.auto = !!window.__psAuto;
  Q.setBeam(0, .6); W.rainK = Q.N.rain; music.start('hunt', S.gt + .2, { force: true, bpm: [96, 100, 108][Q.night] + (S.mode === 'endless' ? 6 : 0), tr: [0, -2, 1][Q.night] }); A.sfx.lantern(); seedFX(1818);
  S.hintT = S.gt; camSnap = true; handleEvents(); setUI(); applyLang(); }
function endRun(res) { if (S.state !== 'play') return; S.result = res; S.endT = S.gt;
  const snap = () => ({ score: Q.score, caught: Q.caught, best: Q.best, strikes: Q.strikes, frozen: Q.frozenCaught, acc: accOf(Q), res });
  if (S.mode === 'duel' && res !== 'quit') { S.duel[S.player] = snap(); if (S.player === 0) { S.state = 'handover'; S.player = 1; A.sfx.turn(); music.start('menu', S.gt + .5, { force: true }); setUI(); applyLang(); return; } }
  S.stars = Q.stars(); S.newBest = false;
  if (S.mode !== 'duel' && res !== 'quit') { const b = +ls.get(bestKey(), '0') || 0; if (Q.score > b) { ls.set(bestKey(), String(Q.score)); S.newBest = Q.score > 0; } }
  S.state = 'end'; if (res === 'win') { A.sfx.win(); for (let i = 0; i < S.stars; i++) after(.45 + i * .35, () => A.sfx.star(i)); } else if (res !== 'quit') A.sfx.fail();
  music.start('menu', S.gt + 1.2, { force: true }); showEnd(); setUI(); }
const accOf = q => q.taps ? q.caught / q.taps : 0;
function toMenu() { S.state = 'menu'; S.more = false; S.player = 0; resetVisuals(); Q = menuHunt(); S.auto = false; S.titleT = -1; $('opening').style.opacity = 0;
  hideHint(); W.rainK = .15; music.start('menu', S.gt + .1, { force: true }); setUI(); applyLang(); }
// behind the menu the yard is alive: a gentle demo hunt (the bot sweeps the lantern, ghosts peek and dash)
function menuHunt() { const h = new Hunt({ mode: 'endless', night: 1, diff: 'kids', seed: 4242 }); h.decoys.length = 0; h.oil = 1e9; h.oilMax = 1e9; for (let i = 0; i < 12; i++) h.step(.1); h.ev = []; h.setBeam(0, .4); return h; }
function startIntro() { S.state = 'intro'; S.introT = 0; S.titleT = -1; resetVisuals(); seedFX(77); music.stop(); camSnap = true;
  // frame 0 is already mid-LIGHTNING: the bolt hits the oak, the whole churchyard flashes white and every hiding ghost glows through the stones
  Q = new Hunt({ mode: 'night', night: 2, diff: 'medium', seed: 9090 }); Q.conc = 7; Q.quota = 99; for (let i = 0; i < 12; i++) Q.step(.1); Q.fill(); Q.ev = []; Q.setBeam(1.2, -1.4); Q.storm = 1; Q.strike(); Q.ev = []; Q.cineT = .25;
  W.rainK = 1; strikeVisuals(true); W.flash = .85; W.boltK = 1; W.xray = 1; W.crowdK = 1; W.lanternK = .35; S.intro = { stage: 0 }; A.sfx.intro(); setUI(); applyLang(); }
function endIntro() { $('opening').style.opacity = 0; S.titleT = -1; }

// ---------------- the LIGHTNING REVEAL (shared by the opening, the game and the share card) ----------------
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _sp = new THREE.Vector3();
const EMBER = ['#ffffff', '#cfe6ff', '#9ad0ff', '#ffe2a8'];
function strikeVisuals(quiet) { W.boltSeed = (W.boltSeed || 7) + 13; buildBolt(W, camera.position, W.boltSeed); W.boltK = 1; W.flash = 1; S.punch = 1; S.xrayT = 1; S.crowdT = 1; S.lanternT = .35;
  sparks(F, _v.copy(W.oakTop), 90, { colors: EMBER, speed: 4.5, up: 2.5, life: 1.4, size: .09, grav: 3 }); puff(F, _v.copy(W.oakTop), 2.2, '#9aa4c0');
  after(.09, () => { W.boltK = 1; W.flash = Math.max(W.flash, .7); }); after(.24, () => { W.boltK = .9; W.flash = Math.max(W.flash, .55); }); after(.55, () => { W.flash = Math.max(W.flash, .35); });
  if (!quiet) { banner(t('strikeBanner')); after(1.0, () => toast(t('watching'))); } }
function strikeOff() { S.xrayT = 0; S.crowdT = 0; S.lanternT = 1; }

// ---------------- events from the rules → visuals + sound ----------------
const panOf = x => clamp((x - camera.position.x) / 6, -.85, .85);
function handleEvents() {
  if (!Q) return; const evs = Q.ev; if (!evs.length) return; Q.ev = [];
  const live = S.state === 'play', menu = S.state === 'menu' || S.state === 'end' || S.state === 'handover';
  if (!live) { if (menu) for (const e of evs) { if (e.t === 'peek' && rng() < .5) A.sfx.peek(panOf(e.x), true); } return; }
  const gp = id => { const g = Q.ghosts.find(q => q.id === id); return g ? _w.set(g.x, .9, g.z) : null; };
  for (const e of evs) {
    switch (e.t) {
      case 'go': A.sfx.go(); break;
      case 'peek': A.sfx.peek(panOf(e.x), Q.kids); break;
      case 'spotted': { const g = Q.ghosts.find(q => q.id === e.id); if (g) A.sfx.spotted(panOf(g.x)); break; }
      case 'flee': { const g = Q.ghosts.find(q => q.id === e.id); if (g) { A.sfx.flee(panOf(g.x), e.why); if (e.why === 'nerve' && live) popAt(t('fled'), '#9fb2d8', 'small', _v.set(g.x, 1.2, g.z)); } break; }
      case 'catch': { const p = new THREE.Vector3(e.x, .9, e.z); A.sfx.catch(e, panOf(e.x), Q.kids); const col = e.kind === 'shade' ? '#c08aff' : e.kind === 'mimic' ? '#8aff6a' : '#bfe8ff';
        sparks(F, p, e.frozen ? 60 : 38, { colors: [col, '#ffffff', '#ffe2a8'], speed: 2.6, up: 1.6, life: .9, size: .07, grav: .7 }); S.punch = Math.max(S.punch, .35);
        const tag = e.frozen ? t('frozen') : e.midair ? t('midair') : e.peek ? t('peekBonus') : t('caught'); popAt(`${tag} +${fmt(e.pts)}`, col, 'j', p.clone().setY(1.5));
        if ([3, 6, 9, 12, 15, 20].includes(e.combo)) banner(`🔥 ${e.combo} ${t('combo')} · ×${e.mult}`); hideHint(); break; }
      case 'tapMiss': A.sfx.tapMiss(); break;
      case 'decoy': { const d = Q.decoys[e.i]; const p = d ? decoyPos(d, new THREE.Vector3()) : null; A.sfx.decoy(e.kind, p ? panOf(p.x) : 0, Q.kids); if (!Q.kids) W.hurt = Math.max(W.hurt, .35);
        popAt(`${t(e.kind === 'cat' ? 'decoyCat' : 'decoyOwl')}${e.cost ? ` −${e.cost} ${t('decoyCost')}` : ''}`, '#ffd27a', 'small', p ? p.setY(p.y + .6) : null); break; }
      case 'decoyMove': A.sfx.decoyMove(e.kind); break;
      case 'stormReady': A.sfx.stormReady(); banner(t('stormReady')); W.flash = Math.max(W.flash, .25); after(1.4, () => { if (Q && Q.canStrike()) toast(t('strikeTip')); }); break;
      case 'strike': A.sfx.strike(); strikeVisuals(false); break;
      case 'strikeEnd': A.sfx.strikeEnd(); strikeOff(); toast(t('strikeEnd')); break;
      case 'wave': A.sfx.wave(); toast('👻 ' + t('wave')); break;
      case 'lowOil': A.sfx.lowOil(); toast('🔥 ' + t('lowOil')); break;
      case 'refill': A.sfx.refill(); toast(t('refill')); break;
      case 'clear': A.sfx.clear(); banner('🎃 ' + t('clear')); if (e.bonus) after(.6, () => popAt(`🔥 +${fmt(e.bonus)}`, '#ffd27a', 'j', null));
        for (let i = 0; i < 5; i++) after(.3 + i * .35, () => sparks(F, _v.set((rng() - .5) * 9, 4 + rng() * 2.5, -3 - rng() * 2), 110, { colors: ['#9ad0ff', '#ffffff', '#ffb04a', '#c08aff'], speed: 3.4, up: .5, life: 1.6, size: .12, grav: 1.4 })); break;
      case 'end': after(e.res === 'win' ? .2 : 1.0, () => endRun(e.res)); break;
    }
  }
}

// ---------------- camera ----------------
let camSnap = true; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
// the yard seen from the front gate, a little above: landscape sees the whole churchyard, portrait follows the lantern sideways
function playCam(tp, tl) { const a = VW / VH; const bx = Q ? Q.beam.x : 0; const k = smooth((a - .8) / .7); // portrait: steep, close, follows the lantern · landscape: the whole churchyard
  const H = lerp(9, 7, k), D = lerp(7.4, 10, k), Lz = lerp(.2, -.8, k) - (1 - k) * clamp((640 - VH) / 90, 0, 1) * .55, vf = lerp(62, 44, k); // portrait: yard between ~26 % and ~77 % of the height (HUD above, thumb zone below)
  const dist = Math.hypot(H, D - Lz), hw = Math.tan(THREE.MathUtils.degToRad(vf / 2)) * a * dist; const span = Math.max(0, 6.9 - hw * .85); const tx = clamp(bx * .6, -span, span);
  S.camX = camSnap ? tx : lerp(S.camX, tx, .06); const x = lerp(S.camX, 0, S.wideK * .5);
  tp.set(x, H + S.wideK * 1.4, D + S.wideK * 1.8); tl.set(x * .96, S.wideK * .8, Lz); return vf * (1 + S.wideK * .1); }
function menuCam(tp, tl) { const a = VW / VH, portrait = a < 1; const s = Math.sin(S.gt * .09);
  tp.set(s * 2.2, 2.6 + Math.sin(S.gt * .07) * .2, portrait ? 9.6 : 8.6); tl.set(s * .8, 1.6, -2.5); return portrait ? 66 : 44; }
function introCam(tp, tl) { const it = S.introT, pv = VW < VH; // low, close to the struck oak, pushing in; then it rises into the play view
  const k1 = smooth(it / 2.4); const p0 = new THREE.Vector3(-1.2, 1.5, pv ? 5.6 : 4.6), l0 = new THREE.Vector3(-3.4, 2.6, -3.4); const p1 = new THREE.Vector3(-.4, 1.8, pv ? 4.4 : 3.6), l1 = new THREE.Vector3(-2.6, 2.0, -3.2);
  const k2 = smooth((it - 2.6) / 2.2); const fp = new THREE.Vector3(), fl = new THREE.Vector3(); const f2 = menuCam(fp, fl);
  tp.copy(p0.lerp(p1, k1)).lerp(fp, k2); tl.copy(l0.lerp(l1, k1)).lerp(fl, k2); return lerp(pv ? 70 : 50, f2, k2); }
function updateCamera(dt) {
  const tp = new THREE.Vector3(), tl = new THREE.Vector3(); let fov = 50, rate = 3.5;
  const strikeOn = Q && Q.state === 'strike' && S.state === 'play'; S.wideK = lerp(S.wideK, strikeOn ? 1 : 0, Math.min(1, dt * (strikeOn ? 3 : 1.6)));
  if (S.state === 'menu' || S.state === 'end' || S.state === 'handover') fov = menuCam(tp, tl); else if (S.state === 'intro') { fov = introCam(tp, tl); rate = 30; } else fov = playCam(tp, tl);
  S.punch = fin(S.punch) * Math.exp(-dt * 5); fov += S.punch * -2.5;
  if (camSnap) { camPos.copy(tp); camLook.copy(tl); camSnap = false; } else { const kk = 1 - Math.exp(-dt * rate); camPos.lerp(tp, kk); camLook.lerp(tl, Math.min(1, kk * 1.3)); }
  const sh = W.boltK * .05 + Math.max(0, S.punch) * .02; camera.position.copy(camPos).add(_sp.set(Math.sin(S.gt * 53) * sh, Math.cos(S.gt * 47) * sh, 0)); camera.lookAt(camLook);
  if (S.camOv) { camera.position.set(...S.camOv.p); camera.lookAt(_sp.set(...S.camOv.l)); fov = S.camOv.f; } // test/screenshot hook only
  camera.fov = clamp(fin(fov, 50), 30, 95); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

// ---------------- input: point the lantern, tap the ghosts ----------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy, out) { ndc.set(cx / VW * 2 - 1, -(cy / VH) * 2 + 1); ray.setFromCamera(ndc, camera); const r = ray.ray;
  if (r.direction.y > -.02) { r.at(30, out); out.y = 0; return out; } return r.intersectPlane(ground, out) || out.set(0, 0, 0); }
function aimAt(cx, cy) { if (!Q || S.state !== 'play') return; const p = groundAt(cx, cy, _v); Q.setBeam(p.x, p.z + .25); } // aim a little behind: a finger points at the bottom of a ghost
function toScreen(p) { _sp.copy(p).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; }
function pxPerM(p) { const a = toScreen(p), b = toScreen(_w.copy(p).add(_sp.set(0, 1, 0))); return Math.abs(a.y - b.y); }
function ghostTargets() { const out = []; if (!Q) return out; for (const v of K.pool) { if (v.id < 0 || v.caughtT >= 0 || !v.root.visible && v.kind !== 'shade') continue; const g = Q.ghosts.find(q => q.id === v.id); if (!g || !g.alive) continue;
    const c = ghostScreenPos(v, new THREE.Vector3()); const s = toScreen(c); if (s.z > 1) continue; out.push({ g, s, r: Math.max(30, pxPerM(c) * (v.kind === 'mimic' ? .42 : .55)) }); } return out; }
function tapAt(cx, cy) { if (!Q || S.state !== 'play' || !(Q.state === 'hunt' || Q.state === 'strike')) return null; A.unlock();
  let best = null, bd = 1e9; for (const o of ghostTargets()) { if (!Q.catchable(o.g)) continue; const d = Math.hypot(o.s.x - cx, o.s.y - cy); if (d < Math.max(o.r, 34) && d < bd) { bd = d; best = o; } }
  if (best) { const r = Q.tap(best.g.id); handleEvents(); return r.ok ? 'catch' : 'miss'; }
  for (let i = 0; i < Q.decoys.length; i++) { const d = Q.decoys[i]; if (d.spot < 0) continue; const p = decoyPos(d, new THREE.Vector3()); const s = toScreen(p); const r = Math.max(28, pxPerM(p) * .35);
    if (Math.hypot(s.x - cx, s.y - cy) < r && (Q.state === 'strike' || Math.hypot(d.x - Q.beam.x, (d.z - Q.beam.z) * .78) < Q.beam.r * 1.2)) { Q.tapDecoy(i); handleEvents(); return 'decoy'; } }
  Q.tap(-1); handleEvents(); return 'miss'; }
function tapAtBeam() { if (!Q) return; let best = null, bd = 1e9; for (const g of Q.ghosts) { if (!Q.catchable(g)) continue; const d = Math.hypot(g.x - Q.beam.x, g.z - Q.beam.z); if (d < bd && (d < Q.beam.r * 1.4 || Q.state === 'strike')) { bd = d; best = g; } }
  if (best) { Q.tap(best.id); } else Q.tap(-1); handleEvents(); }
function doStrike() { if (!Q || S.state !== 'play') return false; A.unlock(); const ok = Q.strike(); handleEvents(); setUI(); return ok; }
let dragId = null, downAt = null;
canvas.addEventListener('pointerdown', e => { if (S.state !== 'play' || !Q) return; e.preventDefault(); if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); }
  dragId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} downAt = { x: e.clientX, y: e.clientY };
  // a tap both points the lantern there and tries to catch what is under the finger
  const r = tapAt(e.clientX, e.clientY); if (r !== 'catch') aimAt(e.clientX, e.clientY); });
canvas.addEventListener('pointermove', e => { if (S.state !== 'play' || !Q) return; if (e.pointerType === 'mouse' || dragId === e.pointerId) aimAt(e.clientX, e.clientY); });
const up = e => { if (dragId === e.pointerId) dragId = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('btnBolt').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doStrike(); }); $('btnBolt').addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) doStrike(); });
const keys = new Set();
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; const k = e.key;
  if (S.state === 'intro' && !e.repeat && (k === ' ' || k === 'Enter')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'handover' && (k === ' ' || k === 'Enter')) { e.preventDefault(); $('btnGo').click(); return; }
  if (k === 'Escape') { if (S.state === 'play') { endRun('quit'); toMenu(); } else if (S.more) { S.more = false; setUI(); } else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && !S.more && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('btnPlay').click(); return; }
  if (S.state !== 'play') return; const kl = k.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(kl)) { e.preventDefault(); keys.add(kl); return; }
  if (e.repeat) return; if (k === ' ') { e.preventDefault(); A.unlock(); tapAtBeam(); } else if (kl === 'l' || k === 'Enter') { e.preventDefault(); doStrike(); } });
window.addEventListener('keyup', e => keys.delete((e.key || '').toLowerCase())); window.addEventListener('blur', () => keys.clear());
function keyAim(dt) { if (!Q || !keys.size) return; let dx = 0, dz = 0; if (keys.has('arrowleft') || keys.has('a')) dx--; if (keys.has('arrowright') || keys.has('d')) dx++; if (keys.has('arrowup') || keys.has('w')) dz--; if (keys.has('arrowdown') || keys.has('s')) dz++;
  Q.setBeam(Q.beam.x + dx * 6.5 * dt, Q.beam.z + dz * 5 * dt); }

// ---------------- UI ----------------
const nightName = () => `${t('night')} ${ROMAN[S.night]} · ${t('n' + S.night)}`;
function modeName() { return S.mode === 'duel' ? t('duelT') : S.mode === 'endless' ? t('endless') : nightName(); }
function setUI() { const st = S.state; const b = document.body; b.dataset.state = st; b.dataset.mode = S.mode; b.dataset.kids = S.kids ? '1' : '0'; b.classList.toggle('touch', isTouch);
  if (st !== 'menu') S.more = false; $('menu').classList.toggle('show', st === 'menu'); $('more').classList.toggle('show', st === 'menu' && !!S.more); b.dataset.more = S.more ? '1' : '0'; $('btnGear').setAttribute('aria-expanded', S.more ? 'true' : 'false');
  $('end').classList.toggle('show', st === 'end'); $('handover').classList.toggle('show', st === 'handover');
  if (st !== 'play' || !Q) { delete b.dataset.phase; b.classList.remove('cine'); $('btnBolt').classList.remove('ready'); return; }
  b.dataset.phase = Q.state; b.classList.toggle('cine', Q.state === 'strike');
  $('hScore').textContent = fmt(Q.score); $('hCombo').textContent = `${Q.combo} ×${Q.mult}`; $('cCombo').classList.toggle('hot', Q.mult >= 2 || Q.state === 'strike');
  $('hFound').textContent = Q.mode === 'endless' ? `👻 ${Q.caught}` : `👻 ${Q.caught}/${Q.quota}`;
  const oil = clamp(Q.oil / Math.max(1, Q.oilMax), 0, 1); $('oilB').style.transform = `scaleX(${oil.toFixed(4)})`; $('oilRow').classList.toggle('low', oil < .2 && !Q.kids);
  const sk = Q.state === 'strike' ? 1 - clamp(Q.cineT / STRIKE_LEN, 0, 1) : clamp(Q.storm, 0, 1); $('stormB').style.transform = `scaleX(${sk.toFixed(4)})`;
  const ready = Q.canStrike(); $('btnBolt').classList.toggle('ready', ready); $('btnBolt').classList.toggle('active', Q.state === 'strike'); $('btnBolt').style.setProperty('--k', clamp(Q.storm, 0, 1).toFixed(3)); $('btnBolt').disabled = !ready;
  $('mNight').textContent = S.mode === 'endless' ? `♾ ${t('endless').replace('♾ ', '')}` : S.mode === 'duel' ? `${t(S.player ? 'p2' : 'p1')} · ${t('n' + S.night)}` : nightName(); $('mNightR').textContent = S.kids ? t('kidsT') : t(S.diff); }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN'; $('btnLang').setAttribute('aria-label', S.lang === 'en' ? 'Deutsch' : 'English');
  $('keysTip').textContent = t('keysHint'); $('oSub').textContent = t('countdown');
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').classList.toggle('off', S.kids);
  document.querySelectorAll('#nights button').forEach(b => b.classList.toggle('on', +b.dataset.n === S.night));
  $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnSound2').textContent = t(A.isMuted() ? 'soundOff' : 'soundOn'); qLabels(); $('btnSkip').textContent = '▶ ' + (isTouch ? (S.lang === 'de' ? 'Tippen zum Spielen' : 'Tap to play') : (S.lang === 'de' ? 'Klicken zum Spielen' : 'Click to play'));
  $('playL').textContent = `${nightName()} · ${S.kids ? t('kidsT') : t(S.diff)}`; $('btnGear').setAttribute('aria-label', t('gear')); $('btnBolt').setAttribute('aria-label', t('strike')); $('boltL').textContent = t('strike');
  if (S.state === 'handover') { $('hoT').textContent = t(S.player ? 'duelTurn2' : 'duelTurn1'); $('hoS').textContent = S.duel[0] ? `${t('p1')}: ${fmt(S.duel[0].score)}` : ''; }
  if (S.hintT >= 0) showHintText(); if (S.state === 'end') showEnd(); setUI(); }
function showEnd() { const duel = S.mode === 'duel', r = S.result; let title;
  if (duel) { const a = S.duel[0], b = S.duel[1]; title = !a || !b ? t('quitT') : a.score > b.score ? t('duelWin1') : b.score > a.score ? t('duelWin2') : t('duelTie'); $('eScore').textContent = a && b ? `${fmt(a.score)} : ${fmt(b.score)}` : fmt(Q ? Q.score : 0); }
  else { title = r === 'win' ? t('win') : r === 'quit' ? t('quitT') : S.mode === 'endless' ? t('endlessEnd') : t('fail'); $('eScore').textContent = fmt(Q ? Q.score : 0); }
  $('eTitle').textContent = title; $('eMode').textContent = `${modeName()} · ${S.kids ? t('kidsT') : t(S.diff)}`;
  $('eStars').innerHTML = S.mode === 'night' && r === 'win' ? [0, 1, 2].map(i => `<i class="${i < S.stars ? 'on' : ''}">★</i>`).join('') : '';
  $('eBest').textContent = duel ? '' : S.newBest ? t('newBest') : `${t('bestL')}: ${fmt(+ls.get(bestKey(), '0') || 0)}`;
  const pct = x => `${Math.round(fin(x) * 100)}%`;
  $('eStats').innerHTML = duel && S.duel[0] && S.duel[1] ? [0, 1].map(i => `<div><b>${t(i ? 'p2' : 'p1')}</b> 👻 ${S.duel[i].caught} · 🔥 ${S.duel[i].best} · ⚡ ${S.duel[i].strikes} · 🎯 ${pct(S.duel[i].acc)}</div>`).join('')
    : Q && Q.ghosts ? `<div>👻 ${t('stCaught')}: <b>${Q.caught}</b> · 🔥 ${t('stBest')}: <b>${Q.best}</b></div><div>⚡ ${t('stStrikes')}: <b>${Q.strikes}</b> · ❄ ${t('stFrozen')}: <b>${Q.frozenCaught}</b> · 💨 ${t('stMid')}: <b>${Q.midair}</b></div><div>🎯 ${t('acc')}: <b>${pct(accOf(Q))}</b>${Q.decoyHits ? ` · 🐈‍⬛ ${t('stDecoy')}: <b>${Q.decoyHits}</b>` : ''}</div>` : '';
  $('btnAgain').textContent = duel ? t('againD') : t('again'); $('eName').value = S.name; }
function showHintText() { $('hintT').textContent = t(isTouch ? 'hintTouch' : 'hintKeys'); $('hintG').textContent = t('hintGoal'); }
function hideHint() { if (S.hintT < 0) return; S.hintT = -1; $('hint').classList.remove('show'); }
function popAt(txt, col, cls, at) { (window.__pops = window.__pops || []).push(txt); let x = 0, y = -VH * .08; if (at) { _sp.copy(at).project(camera); if (_sp.z < 1) { x = clamp(_sp.x * .5 * VW, -VW * .36, VW * .36); y = clamp(-_sp.y * .5 * VH, -VH * .36, VH * .3); } }
  const el = document.createElement('div'); el.className = 'pop ' + (cls || ''); el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = y + 'px'; el.dataset.t0 = S.gt; $('pops').appendChild(el); const hw = el.offsetWidth / 2 + 8; if (hw * 2 < VW) el.style.left = clamp(x, -VW / 2 + hw, VW / 2 - hw) + 'px'; if ($('pops').children.length > 8) $('pops').firstChild.remove(); }
function banner(s) { if (!s) return; (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.dataset.t0 = S.gt; el.classList.add('show'); el.style.transform = 'translate(-50%,-50%)'; el.dataset.fit = Math.min(1, innerWidth * .92 / Math.max(1, el.scrollWidth)).toFixed(3); }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); el.dataset.t0 = S.gt; }
// off-screen peek markers: a ghost giggling outside the view shows a little glowing arrow at the screen edge
const edgeEls = [...document.querySelectorAll('.edge')];
function updateEdges() { let n = 0; if (S.state === 'play' && Q && Q.state === 'hunt') for (const g of Q.ghosts) { if (!g.alive || g.st !== 'peek' || n >= edgeEls.length) continue; const s = toScreen(_v.set(g.x, .8, g.z)); if (s.x > 18 && s.x < VW - 18) continue;
    const el = edgeEls[n++]; el.style.display = 'block'; const left = s.x < VW / 2; el.style.left = left ? '6px' : ''; el.style.right = left ? '' : '6px'; el.style.top = clamp(s.y, VH * .25, VH * .75) + 'px'; el.textContent = left ? '◀👻' : '👻▶'; }
  for (let i = n; i < edgeEls.length; i++) edgeEls[i].style.display = 'none'; }
function updateOverlays() {
  const bn = $('banner'); if (bn.classList.contains('show')) { const a = S.gt - (+bn.dataset.t0), fit = +bn.dataset.fit || 1; const k = a < .18 ? a / .18 : a > 1.5 ? Math.max(0, 1 - (a - 1.5) / .3) : 1; bn.style.opacity = k; bn.style.transform = `translate(-50%,-50%) scale(${((a < .18 ? 1 + .4 * (1 - a / .18) : 1 + a * .02) * fit).toFixed(3)})`; if (a > 1.85) bn.classList.remove('show'); }
  const ts = $('toast'); if (ts.classList.contains('show') && S.gt - (+ts.dataset.t0) > 2.4) ts.classList.remove('show');
  if (S.state === 'play' && S.hintT >= 0) { const a = S.gt - S.hintT; $('hint').classList.toggle('show', a > .2 && a < 6.5 && !document.body.classList.contains('cine')); if (a >= 6.5) hideHint(); }
  for (const el of [...$('pops').children]) { const a = S.gt - (+el.dataset.t0); if (a > 1.0) { el.remove(); continue; } el.style.opacity = a < .08 ? a / .08 : 1 - Math.max(0, (a - .6) / .4); el.style.transform = `translate(-50%,-50%) translateY(${-a * 44}px) scale(${a < .1 ? .6 + a / .1 * .5 : 1.1 - Math.min(.1, a * .2)})`; }
  const op = $('opening'); if (S.state === 'intro' && S.titleT >= 0) { const a = S.introT - S.titleT; const sIn = a < .28 ? 3.2 - 2.2 * smooth(a / .28) : 1; const rec = smooth((a - 1.6) / 2.2);
    op.style.opacity = a < .08 ? a / .08 : 1 - smooth((a - 2.6) / 1.0); $('oTitle').style.transform = `translateY(${-rec * VH * .14}px) scale(${(sIn * (1 - rec * .5)).toFixed(3)})`; } else if (S.state !== 'intro') op.style.opacity = 0;
  updateEdges(); }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
// ---------------- buttons ----------------
$('btnPlay').onclick = () => { A.unlock(); start('night'); };
$('btnGear').onclick = () => { if (S.state === 'play') return; A.unlock(); if (S.state !== 'menu') toMenu(); S.more = !S.more; A.sfx.ui(); setUI(); };
$('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnEndless').onclick = () => { A.unlock(); start('endless'); }; $('btnDuel').onclick = () => { A.unlock(); S.player = 0; start('duel'); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; S.kids = false; ls.set('ps-diff', S.diff); ls.set('ps-kids', '0'); A.sfx.ui(); applyLang(); });
document.querySelectorAll('#nights button').forEach(b => b.onclick = () => { S.night = +b.dataset.n; ls.set('ps-night', String(S.night)); A.sfx.ui(); applyLang(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('ps-kids', S.kids ? '1' : '0'); A.sfx.ui(); applyLang(); };
$('btnQ2').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % o.length], true); A.sfx.ui(); };
$('btnIntro').onclick = () => { A.unlock(); startIntro(); };
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('ps-lang', S.lang); A.sfx.ui(); applyLang(); };
const toggleSound = () => { A.unlock(); A.setMuted(!A.isMuted()); ls.set('ps-mute', A.isMuted() ? '1' : '0'); applyLang(); }; $('btnSound').onclick = toggleSound; $('btnSound2').onclick = toggleSound;
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); toMenu(); };
$('btnAgain').onclick = () => { A.unlock(); if (S.mode === 'duel') { S.player = 0; start('duel'); } else start(S.mode); }; $('btnMenu').onclick = () => toMenu();
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnGo').onclick = () => { A.unlock(); start('duel'); }; $('handover').addEventListener('click', e => { if (e.target.id !== 'btnGo') $('btnGo').click(); });
$('eName').addEventListener('keydown', e => e.stopPropagation()); $('eName').addEventListener('input', () => { S.name = ($('eName').value || '').slice(0, 18); });
if (ls.get('ps-mute', '0') === '1') A.setMuted(true);
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into Night I (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('night'); }
function introTap(e) { if (S.state !== 'intro' || (e.target && e.target.closest && e.target.closest('#top'))) return; if (e.pointerType === 'touch' && !isTouch) isTouch = true; eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true);
for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) window.addEventListener(ev, () => { A.unlock(); setTimeout(audioBadge, 80); }, { capture: true, passive: true }); // iOS: resume audio inside a real user gesture
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } }, { passive: true });
window.addEventListener('resize', resize);
// ---------------- share card (1080×1350, no URL) ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim().slice(0, 18) || 'Player'; ls.set('ps-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const strikes = S.mode === 'duel' ? (S.duel[0]?.strikes || 0) + (S.duel[1]?.strikes || 0) : Q ? Q.strikes : 0;
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const keep = ['flash', 'boltK', 'xray', 'crowdK', 'lanternK', 'hurt'].map(k => [k, W[k]]);
  // the card shows the lightning moment: bolt in the oak, the watching crowd glowing through the dark
  W.boltSeed = 4041; buildBolt(W, _v.set(0, 3.4, 9), W.boltSeed); W.boltK = strikes > 0 ? .9 : 0; W.flash = strikes > 0 ? .35 : 0; W.xray = 0; W.crowdK = strikes > 0 ? 1 : .55; W.lanternK = .8; W.hurt = 0;
  camera.aspect = CW / CH; camera.fov = 56; camera.position.set(0, 3.4, 9.2); camera.lookAt(-.6, 1.6, -3); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  updateGhosts(K, null, S.gt, 0, camera, W); updateWorld(W, S.gt, 0, QUALITY.high, camera, { x: -.8, z: -.6, r: 1.6 }); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); keep.forEach(([kk, v]) => W[kk] = v); resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(6,6,18,.88)'); gr.addColorStop(.2, 'rgba(6,6,18,.1)'); gr.addColorStop(.58, 'rgba(6,6,18,.05)'); gr.addColorStop(.72, 'rgba(6,6,18,.8)'); gr.addColorStop(1, 'rgba(6,6,18,.97)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(8,8,30,.9)', lw = 8) => { if (lw) { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); } k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 124); txt('PEEKSTORM', CW / 2, 128, '#f2f6ff', 'rgba(20,10,60,.92)', 12);
  const duel = S.mode === 'duel' && S.duel[0] && S.duel[1];
  if (duel) { k.font = Fo(700, 112); txt(`${fmt(S.duel[0].score)} : ${fmt(S.duel[1].score)}`, CW / 2, 1040, '#f4f8ff', 'rgba(10,20,70,.9)', 14); k.font = Fo(600, 50); txt($('eTitle').textContent, CW / 2, 1110, '#bfe8ff'); k.font = Fo(500, 34); txt(`${t('p1')} · ${t('p2')}`, CW / 2, 190, '#ffffff'); }
  else { k.font = Fo(600, 46); txt(`${modeName()} · ${S.kids ? t('kidsT') : t(S.diff)}`, CW / 2, 962, '#cfe2ff'); k.font = Fo(700, 150); txt(fmt(Q ? Q.score : 0), CW / 2, 1104, '#ffffff', 'rgba(10,20,70,.9)', 16);
    if (S.result === 'win' && S.mode === 'night') { k.font = Fo(700, 70); txt('★'.repeat(S.stars) + '☆'.repeat(3 - S.stars), CW / 2, 1182, '#ffd27a', 'rgba(30,20,0,.9)', 8); } else { k.font = Fo(600, 46); txt($('eTitle').textContent || '', CW / 2, 1178, '#bfe8ff'); }
    k.font = Fo(500, 34); txt(`${t('by')} ${S.name}`, CW / 2, 190, '#ffffff'); }
  if (strikes > 0) { k.save(); k.translate(CW - 172, 350); k.rotate(-.16); k.fillStyle = 'rgba(16,14,50,.92)'; k.strokeStyle = '#bfe8ff'; k.lineWidth = 6; k.beginPath(); k.arc(0, 0, 118, 0, 7); k.fill(); k.stroke();
    k.font = Fo(700, 58); txt('⚡', 0, -16, '#fff', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 23); txt(S.lang === 'de' ? 'BLITZ' : 'LIGHTNING', 0, 30, '#bfe8ff', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 34); txt('x' + strikes, 0, 72, '#fff', 'rgba(0,0,0,0)', 0); k.restore(); }
  const caught = duel ? S.duel[0].caught + S.duel[1].caught : Q && Q.ghosts ? Q.caught : 0, best = duel ? Math.max(S.duel[0].best, S.duel[1].best) : Q && Q.ghosts ? Q.best : 0;
  k.font = Fo(600, 40); txt(`👻 ${caught} · 🔥 ${best} · ${t('cardTag')}`, CW / 2, 1262, '#ffffff'); k.font = Fo(500, 30); txt(t('credit'), CW / 2, 1316, '#9fb2d8', 'rgba(0,0,0,0)', 0);
  return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-peekstorm.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Peekstorm · ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-peekstorm.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved')); }
// ---------------- simulation ----------------
let ambT = 5;
function beds() { const play = S.state === 'play' && Q; const rain = W.rainK; A.loop('rain', rain * .22, 1, 1.5); A.loop('wind', .05 + rain * .05 + (W.xray * .1), 1, 1); A.loop('night_loop', .07, 1, 1.5); A.loop('eerie_loop', play && Q.state === 'strike' ? .14 : play && Q.oil < 12 && !Q.kids ? .08 : 0, 1, 1); }
function ambient(dt) { ambT -= dt; if (ambT <= 0) { ambT = 8 + rng() * 9; const r = rng(); if (r < .3) A.sfx.owl(); else if (r < .55) A.sfx.crow(); else A.sfx.far(); if (W.rainK > .5 && rng() < .6) { A.play('thunder_soft', .18, .9 + rng() * .2, .3, .7); W.flash = Math.max(W.flash, .18); } } }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20)); // never step backwards, never jump
  let want = 1; const cineQ = Q && Q.state === 'strike' && (S.state === 'play' || S.state === 'intro');
  if (cineQ) { const u = Q.cineT; want = u < .12 ? 1 : u < 1.1 ? .32 : u < 1.7 ? lerp(.32, 1, smooth((u - 1.1) / .6)) : 1; }
  S.ts = clamp(fin(want, 1), .05, 1.5); const gdt = dt * S.ts; S.gt += gdt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i] && timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'hurt', 'boltK', 'xray', 'crowdK', 'lanternK', 'rainK', 'storm']) if (!Number.isFinite(W[k])) W[k] = 0; for (const k of ['punch', 'camX', 'wideK']) if (!Number.isFinite(S[k])) S[k] = 0; // NaN guards
  if (S.state === 'play' && Q) { music.I = clamp(Q.combo / 9 + (Q.canStrike() ? .4 : 0) + (Q.oil < 15 && !Q.kids ? .3 : 0), 0, 1); music.vol = Q.state === 'strike' ? .25 : 1; } else { music.I = .2; music.vol = 1; } music.step(S.gt);
  ambient(gdt); beds();
  if (S.state === 'intro') { S.introT += dt; const it = S.introT;
    if (Q && Q.state === 'strike') { Q.cineT = Math.min(Q.cineT, STRIKE_LEN - .3); if (it < 1.6) { if (rng() < dt * 2.2) { W.boltK = Math.max(W.boltK, .8); W.flash = Math.max(W.flash, .4); } } }
    if (it > 2.0 && S.intro.stage === 0) { S.intro.stage = 1; strikeOff(); S.lanternT = 0; A.sfx.rewind(); }
    if (it > 2.0 && it < 2.9) { Q.cineT = STRIKE_LEN; } // let the rules end the strike: the ghosts duck back into hiding
    if (it > 2.9 && S.intro.stage === 1) { S.intro.stage = 2; S.lanternT = 1; A.sfx.lantern(); const g = Q.ghosts.find(q => q.alive && q.kind !== 'mimic' && q.st === 'hide') || Q.ghosts.find(q => q.alive); if (g) { g.st = 'peek'; g.stT = -1.6; g.peekT = 9; Q.setBeam(g.x, g.z); A.sfx.peek(0, false); } }
    if (it >= 3.6 && S.intro.stage < 3) { S.intro.stage = 3; S.titleT = it; A.sfx.title(); W.flash = .35; S.punch = .7; }
    if (Q) { Q.step(gdt); Q.ev = []; } if (S.titleT >= 0 && it - S.titleT > 3.8) toMenu(); }
  else if (S.state === 'play' && Q) { const was = Q.state; keyAim(gdt); Q.step(gdt); handleEvents();
    if (S.auto) { botStep(Q, S.botAcc, rng, gdt, S.botOpt); handleEvents(); }
    if (Q && Q.state !== was) setUI(); }
  else if (Q) { botStep(Q, .9, rng, gdt, { strike: false, react: .5, speed: 2.2 }); Q.oil = 1e9; Q.step(gdt); handleEvents(); }
  // lightning visuals ease
  W.xray = lerp(W.xray, S.xrayT, Math.min(1, gdt * (S.xrayT ? 12 : 3))); W.crowdK = lerp(W.crowdK, S.crowdT, Math.min(1, gdt * (S.crowdT ? 5 : 1.8))); W.lanternK = lerp(W.lanternK, S.lanternT, Math.min(1, gdt * (S.lanternT >= 1 ? 10 : 5)));
  W.storm = Q ? clamp(Q.storm, 0, 1) : 0; if (Q && Q.state === 'strike') W.flash = Math.max(W.flash, .16 * Math.min(1, (STRIKE_LEN - Q.cineT) * 2)); // the storm keeps the yard lit while the ghosts are revealed if (Q && Q.state === 'strike' && Q.cineT > .5 && Q.cineT < 2.6 && rng() < gdt * 1.4) { W.flash = Math.max(W.flash, .3); W.boltK = Math.max(W.boltK, .5); }
  updateCamera(dt);
  updateGhosts(K, Q, S.gt, gdt, camera, W);
  updateWorld(W, S.gt, gdt, QUALITY[S.q], camera, Q ? Q.beam : null); updateFX(F, gdt, VH * 1.5 * renderer.getPixelRatio());
  bloom.strength = .5 * QUALITY[S.q].bloom * (1 + W.flash * .2); const gu = gradePass.uniforms; gu.time.value = S.gt; gu.flash.value = W.flash; gu.xray.value = W.xray * .9; gu.hurt.value = W.hurt;
  updateOverlays(); if ((S.uiT = (S.uiT || 0) + dt) > .1) { S.uiT = 0; setUI(); } }
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++; // ignore the first 6 s (shader compile, decode)
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__psNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }
applyQuality(S.q); resize();
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__psManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); if (!window.__psManual) render(); requestAnimationFrame(frameLoop); }
if (window.__psSkipIntro) { startIntro(); toMenu(); } else startIntro();
applyLang(); audioBadge();
step(0); requestAnimationFrame(frameLoop);
window.__ps = { S, W, K, F, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, render, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  start, end: endRun, toMenu, startIntro, endIntro, playNow, hunt: () => Q, auto: (v, acc, opt) => { S.auto = !!v; if (acc != null) S.botAcc = acc; if (opt) S.botOpt = opt; },
  fillStorm: () => { if (Q) Q.storm = 1; }, strike: doStrike, tapAt, aimAt, tapAtBeam, setUI, applyLang, handleEvents, ghostTargets: () => ghostTargets().map(o => ({ id: o.g.id, x: o.s.x, y: o.s.y, r: o.r, ok: Q.catchable(o.g), st: o.g.st, kind: o.g.kind })),
  decoyScreen: i => { const d = Q && Q.decoys[i]; if (!d || d.spot < 0) return null; return toScreen(decoyPos(d, new THREE.Vector3())); }, spots: () => [...SPOTS, ...PSPOTS].map(s => toScreen(new THREE.Vector3(s.x, .6, s.z))), beamScreen: () => Q ? toScreen(_v.set(Q.beam.x, 0, Q.beam.z)) : null,
  card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .9), fps, fpsTick, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state,
  mem: () => ({ ...renderer.info.memory, programs: renderer.info.programs ? renderer.info.programs.length : 0 }),
  screen: (x, y, z) => toScreen(new THREE.Vector3(x, y, z)), cam: () => ({ p: camera.position.toArray(), fov: camera.fov }),
  sparks: () => { let n = 0; for (let i = 0; i < F.life.length; i++) if (F.life[i] > 0) n++; return n; }, _dbg: { scene, camera, composer, bloom, THREE } };
// shader warm-up: compile every hidden object (bolt, X-ray, crowd, decoys, sparks) once at load, so the first lightning does not hitch
try { const hid = []; scene.traverse(o => { if (!o.visible) { hid.push(o); o.visible = true; } }); renderer.compile(scene, camera); hid.forEach(o => { o.visible = false; }); } catch (e) {}
document.body.classList.add('ready');
