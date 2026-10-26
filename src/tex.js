// Procedural canvas textures (no image files): weathered gravestone granite with an engraved cross, mossy churchyard ground,
// bark, old planks, straw, crypt masonry, gravel path, pumpkin skin + a carved face (emissive), soft sprites, smoke and a ring.
import * as THREE from 'three';
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let seed = 11; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export function tex(c, { srgb = true, rep = true, mip = true } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t; }
function dots(k, w, h, n, a) { for (let i = 0; i < n; i++) { k.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${R() * a})`; k.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } }
function blotch(k, S, n, hue, sat, l0, l1, a, r0 = 6, r1 = 50) { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, rr = r0 + R() * (r1 - r0), l = l0 + R() * (l1 - l0); const g = k.createRadialGradient(x, y, 0, x, y, rr);
  g.addColorStop(0, `hsla(${hue + (R() - .5) * 20},${sat}%,${l}%,${a})`); g.addColorStop(1, `hsla(${hue},${sat}%,${l}%,0)`); k.fillStyle = g; k.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }
export function softTex() { const [c, k] = cv(64, 64); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return tex(c, { srgb: false, rep: false }); }
export function smokeTex() { const [c, k] = cv(128, 128); for (let i = 0; i < 26; i++) { const x = 34 + R() * 60, y = 34 + R() * 60, r = 14 + R() * 26; const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); } return tex(c, { rep: false }); }
export function ringTex() { const S = 256, [c, k] = cv(S, S); const g = k.createRadialGradient(128, 128, 70, 128, 128, 126); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.62, 'rgba(255,255,255,.15)'); g.addColorStop(.8, 'rgba(255,255,255,1)'); g.addColorStop(.9, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  k.fillStyle = g; k.fillRect(0, 0, S, S); return tex(c, { srgb: false, rep: false }); }
export function stoneTex() { // granite slab: blotches, lichen, moss at the foot, an engraved cross + R.I.P. in the middle of the face (u .5, v .62)
  const S = 512, [c, k] = cv(S, S), [b, q] = cv(S, S); k.fillStyle = '#6f6e72'; k.fillRect(0, 0, S, S); q.fillStyle = '#808080'; q.fillRect(0, 0, S, S);
  blotch(k, S, 240, 230, 6, 30, 52, .45); blotch(q, S, 200, 0, 0, 35, 65, .35);
  for (let i = 0; i < 90; i++) { k.fillStyle = `rgba(${120 + R() * 40 | 0},${140 + R() * 40 | 0},${70 + R() * 30 | 0},${.14 + R() * .2})`; k.beginPath(); k.ellipse(R() * S, R() * S, 4 + R() * 18, 3 + R() * 12, R() * 3, 0, 7); k.fill(); }
  const mg = k.createLinearGradient(0, S, 0, S * .72); mg.addColorStop(0, 'rgba(46,70,30,.85)'); mg.addColorStop(1, 'rgba(46,70,30,0)'); k.fillStyle = mg; k.fillRect(0, S * .72, S, S * .28);
  for (let i = 0; i < 400; i++) { k.fillStyle = `rgba(${40 + R() * 40 | 0},${70 + R() * 50 | 0},${20 + R() * 20 | 0},${.3 + R() * .4})`; const x = R() * S, y = S - Math.pow(R(), 2) * S * .3; k.fillRect(x, y, 2 + R() * 3, 2 + R() * 3); }
  k.strokeStyle = 'rgba(10,10,14,.5)'; for (let i = 0; i < 18; i++) { k.lineWidth = .7 + R() * 1.6; k.beginPath(); let x = R() * S, y = R() * S; k.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (R() - .5) * 50; y += (R() - .5) * 50; k.lineTo(x, y); } k.stroke(); }
  // engraving (dark groove + light lower lip) – bump map gets a matching groove
  const eng = (ctx, dark, lite) => { ctx.save(); ctx.translate(S * .5, S * .38); ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = dark; ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, 40); ctx.moveTo(-30, -22); ctx.lineTo(30, -22); ctx.stroke();
    ctx.font = 'bold 50px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = dark; ctx.fillText('R.I.P.', 0, 106); if (lite) { ctx.strokeStyle = lite; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -48); ctx.lineTo(4, 44); ctx.stroke(); } ctx.restore(); };
  eng(k, 'rgba(20,18,22,.78)', 'rgba(255,255,255,.12)'); eng(q, 'rgba(0,0,0,.9)', null);
  dots(k, S, S, 7000, .12); dots(q, S, S, 5000, .25); return { map: tex(c), bump: tex(b, { srgb: false }) }; }
export function groundTex() { // churchyard ground: dark grass, dirt patches, fallen leaves
  const S = 512, [c, k] = cv(S, S), [b, q] = cv(S, S); k.fillStyle = '#1f2a1c'; k.fillRect(0, 0, S, S); q.fillStyle = '#7a7a7a'; q.fillRect(0, 0, S, S);
  blotch(k, S, 300, 95, 25, 9, 20, .5, 8, 40); blotch(k, S, 60, 30, 25, 12, 20, .45, 20, 70); blotch(q, S, 200, 0, 0, 30, 70, .3, 6, 30);
  for (let i = 0; i < 4000; i++) { const x = R() * S, y = R() * S; k.strokeStyle = `hsla(${80 + R() * 40},${30 + R() * 25}%,${12 + R() * 18}%,.6)`; k.lineWidth = 1; k.beginPath(); k.moveTo(x, y); k.lineTo(x + (R() - .5) * 3, y - 3 - R() * 6); k.stroke(); }
  for (let i = 0; i < 160; i++) { const x = R() * S, y = R() * S; k.fillStyle = `hsla(${15 + R() * 30},${55 + R() * 30}%,${18 + R() * 18}%,.85)`; k.beginPath(); k.ellipse(x, y, 3 + R() * 4, 1.5 + R() * 2.5, R() * 3, 0, 7); k.fill(); }
  dots(k, S, S, 6000, .1); return { map: tex(c), bump: tex(b, { srgb: false }) }; }
export function pathTex() { const S = 256, [c, k] = cv(S, S); k.fillStyle = '#3a342c'; k.fillRect(0, 0, S, S); for (let i = 0; i < 1800; i++) { const l = 18 + R() * 30; k.fillStyle = `hsl(${30 + R() * 20},${8 + R() * 10}%,${l}%)`; k.beginPath(); k.ellipse(R() * S, R() * S, 1.5 + R() * 3.5, 1 + R() * 2.5, R() * 3, 0, 7); k.fill(); } dots(k, S, S, 3000, .15); return tex(c); }
export function barkTex() { const S = 256, [c, k] = cv(S, S); k.fillStyle = '#2a2420'; k.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const x = R() * S; k.strokeStyle = `rgba(${R() < .5 ? '0,0,0' : '120,105,90'},${.15 + R() * .35})`; k.lineWidth = 1 + R() * 4; k.beginPath(); k.moveTo(x, 0); let xx = x; for (let y = 0; y <= S; y += 16) { xx += (R() - .5) * 6; k.lineTo(xx, y); } k.stroke(); }
  dots(k, S, S, 3000, .2); return tex(c); }
export function plankTex() { const S = 256, [c, k] = cv(S, S); for (let i = 0; i < 8; i++) { k.fillStyle = `hsl(${24 + R() * 10},${30 + R() * 15}%,${15 + R() * 9}%)`; k.fillRect(i * 32, 0, 32, S); k.fillStyle = 'rgba(0,0,0,.6)'; k.fillRect(i * 32, 0, 2, S);
    for (let j = 0; j < 30; j++) { k.strokeStyle = `rgba(0,0,0,${.1 + R() * .2})`; k.lineWidth = 1; k.beginPath(); const x = i * 32 + 3 + R() * 26; k.moveTo(x, 0); k.bezierCurveTo(x + (R() - .5) * 8, S * .3, x + (R() - .5) * 8, S * .7, x, S); k.stroke(); } } dots(k, S, S, 2000, .15); return tex(c); }
export function strawTex() { const S = 256, [c, k] = cv(S, S); k.fillStyle = '#7a6230'; k.fillRect(0, 0, S, S); for (let i = 0; i < 2600; i++) { const x = R() * S, y = R() * S, a = (R() - .5) * .6; k.strokeStyle = `hsla(${38 + R() * 12},${45 + R() * 30}%,${25 + R() * 35}%,.7)`; k.lineWidth = 1 + R(); k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); k.stroke(); } return tex(c); }
export function brickTex() { const S = 512, [c, k] = cv(S, S), [b, q] = cv(S, S); k.fillStyle = '#26252a'; k.fillRect(0, 0, S, S); q.fillStyle = '#000'; q.fillRect(0, 0, S, S);
  const bh = 42, bw = 96; for (let r = 0; r < S / bh; r++) for (let i = -1; i < S / bw + 1; i++) { const x = i * bw + (r % 2) * bw / 2, y = r * bh; const l = 26 + R() * 14; k.fillStyle = `hsl(${220 + R() * 30},${5 + R() * 6}%,${l}%)`; k.fillRect(x + 3, y + 3, bw - 6, bh - 6); q.fillStyle = `rgb(${170 + R() * 60 | 0},${170},${170})`; q.fillRect(x + 3, y + 3, bw - 6, bh - 6); }
  blotch(k, S, 140, 100, 25, 14, 24, .35, 10, 50); blotch(k, S, 60, 230, 5, 10, 16, .4, 20, 80); dots(k, S, S, 6000, .14); return { map: tex(c), bump: tex(b, { srgb: false }) }; }
export function pumpkinTex() { const S = 256, [c, k] = cv(S, S); const g = k.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#6a3a0c'); g.addColorStop(.18, '#d8701a'); g.addColorStop(.5, '#f08a24'); g.addColorStop(.85, '#c85e14'); g.addColorStop(1, '#5a3008'); k.fillStyle = g; k.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { const x = R() * S, y = R() * S; k.fillStyle = `rgba(${R() < .5 ? '255,200,120' : '90,40,0'},${R() * .12})`; k.fillRect(x, y, 1 + R() * 3, 4 + R() * 10); } return tex(c); }
export function faceTex(kind = 0) { // carved jack-o'-lantern face as an emissive mask (white = glowing cut)
  const S = 256, [c, k] = cv(S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S); k.fillStyle = '#fff'; k.save(); k.translate(S / 2, S / 2);
  const tri = (x, y, w, h, flip) => { k.beginPath(); k.moveTo(x - w, y + (flip ? -h : h) * .5); k.lineTo(x + w, y + (flip ? -h : h) * .5); k.lineTo(x, y - (flip ? -h : h) * .5); k.closePath(); k.fill(); };
  if (kind === 0) { tri(-38, -22, 20, 34); tri(38, -22, 20, 34); k.beginPath(); k.moveTo(-64, 26); for (let i = 0; i <= 8; i++) k.lineTo(-64 + i * 16, 26 + (i % 2 ? 16 : 0) + Math.sin(i / 8 * Math.PI) * 18); for (let i = 8; i >= 0; i--) k.lineTo(-64 + i * 16, 22 + Math.sin(i / 8 * Math.PI) * 30 - 6); k.closePath(); k.fill(); }
  else { k.beginPath(); k.ellipse(-36, -20, 18, 22, -.3, 0, 7); k.fill(); k.beginPath(); k.ellipse(36, -20, 18, 22, .3, 0, 7); k.fill(); k.beginPath(); k.ellipse(0, 40, 46, 18, 0, 0, Math.PI); k.fill(); tri(0, 6, 8, 12); }
  k.restore(); return tex(c, { rep: false }); }
