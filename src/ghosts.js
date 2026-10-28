// The hiders and the watchers: sheet ghosts (soft cloth with a waving hem, cheeky face, little arms), shades (dark, glowing violet eyes),
// pumpkin mimics (identical to the real pumpkins until their carved face flickers green), the decoys (a black cat, owls – yellow eyes),
// the X-ray glow every ghost gets in the LIGHTNING REVEAL, the catch animation (sucked into the lantern) and the silent watching crowd.
import * as THREE from 'three';
import { OAK, CRYPT, SPOTS } from './layout.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k;
export function ghostGeo(seg = 36) { const pts = [[.43, 0], [.41, .1], [.37, .28], [.34, .46], [.33, .6], [.32, .72], [.28, .84], [.2, .94], [.1, 1.0], [0, 1.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g; }
function ghostMat(base, emis) { const m = new THREE.MeshStandardMaterial({ color: base, emissive: emis, emissiveIntensity: .35, roughness: .62, metalness: 0, transparent: true, side: THREE.DoubleSide });
  m.userData.u = { uTime: { value: 0 }, uRim: { value: .4 }, uRimC: { value: new THREE.Color(emis) }, uFreeze: { value: 0 } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uFreeze;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float ang = atan(position.z, position.x); float hem = clamp(1. - position.y / .3, 0., 1.); float sp = mix(4., 22., uFreeze);
      transformed.y += sin(ang * 7. + uTime * sp) * .045 * hem; float rr = 1. + .07 * sin(ang * 5. + uTime * 3.) * hem; transformed.x *= rr; transformed.z *= rr;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRim; uniform vec3 uRimC;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fr = 1. - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0., 1.); totalEmissiveRadiance += uRimC * fr * fr * uRim;`); };
  m.customProgramCacheKey = () => 'ghostMat'; return m; }
function xrayMat(col) { return new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, col: { value: new THREE.Color(col) }, time: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  vertexShader: 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform float k, time; uniform vec3 col; varying vec3 vN, vV; void main(){ float f = 1. - clamp(abs(dot(normalize(vN), normalize(vV))), 0., 1.); float a = (.18 + f * f * 1.1) * (.85 + .15 * sin(time * 20.)); gl_FragColor = vec4(col * a * k, 1.); }' }); }
export function createGhostKit(W, pumpkinGeo, stemGeo, M) {
  const scene = W.scene, G = ghostGeo(), K = { pool: [], decoys: [], scene, G };
  const eyeG = new THREE.SphereGeometry(1, 14, 10), armG = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 8; i++) { const root = new THREE.Group(); root.visible = false; scene.add(root);
    const body = new THREE.Group(); root.add(body); const sheetM = ghostMat('#c4cede', '#8fb8ff'), shadeM = ghostMat('#20142e', '#7a3aff');
    const mesh = new THREE.Mesh(G, sheetM); mesh.castShadow = true; body.add(mesh);
    const eyeM = new THREE.MeshStandardMaterial({ color: '#05060a', roughness: .2, emissive: '#000000' }); const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(eyeG, eyeM); e.position.set(s * .1, .72, .285); e.scale.set(.055, .08, .03); body.add(e); return e; });
    const mouth = new THREE.Mesh(eyeG, eyeM); mouth.position.set(0, .56, .315); mouth.scale.set(.05, .035, .02); body.add(mouth);
    const arms = [-1, 1].map(s => { const a = new THREE.Mesh(armG, sheetM); a.position.set(s * .36, .42, .05); a.scale.set(.1, .07, .08); body.add(a); return a; });
    const xm = xrayMat('#7ff0ff'); const xr = new THREE.Mesh(G, xm); xr.renderOrder = 20; xr.scale.setScalar(1.04); body.add(xr);
    const pumpM = M.skin.clone(); pumpM.emissiveMap = W.T.face0; pumpM.emissive = new THREE.Color('#60ff70'); pumpM.emissiveIntensity = 0; const pk = new THREE.Group(); const pm = new THREE.Mesh(pumpkinGeo, pumpM); pm.castShadow = true; pm.receiveShadow = true; pk.add(pm); const st = new THREE.Mesh(stemGeo, M.stem); pk.add(st); pk.scale.setScalar(.5); pk.position.y = .25; root.add(pk);
    const pxm = xrayMat('#8aff6a'); const pxr = new THREE.Mesh(pumpkinGeo, pxm); pxr.renderOrder = 20; pxr.scale.setScalar(1.06); pk.add(pxr);
    K.pool.push({ root, body, mesh, eyes, mouth, arms, eyeM, sheetM, shadeM, xr, xm, pk, pm, pumpM, pxr, pxm, id: -1, kind: '', vis: 0, caughtT: -1, from: new THREE.Vector3(), lean: 0, side: 1 }); }
  // decoys: a black cat (sits on gravestones) and owls (oak, crypt roof)
  const catM = new THREE.MeshStandardMaterial({ color: '#0b0b10', roughness: .65 }), owlM = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: .8 }), yEye = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd23a', emissiveIntensity: 2.6 });
  for (let i = 0; i < 6; i++) { const cat = i % 2 === 0, g = new THREE.Group(); g.visible = false; scene.add(g); const m = cat ? catM : owlM;
    const part = (geo, x, y, z, sx, sy, sz, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
    if (cat) { part(eyeG, 0, .17, 0, .13, .17, .16); const head = part(eyeG, 0, .38, .05, .1, .09, .09); for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.04, .09, 4), m); ear.position.set(s * .06, .47, .04); ear.rotation.z = -s * .25; g.add(ear); }
      const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, .05, -.12), new THREE.Vector3(.12, .05, -.2), new THREE.Vector3(.2, .2, -.16), new THREE.Vector3(.18, .34, -.1)]), 10, .022, 5), m); g.add(tail);
      for (const s of [-1, 1]) part(eyeG, s * .04, .395, .13, .022, .016, .01, yEye); }
    else { part(eyeG, 0, .2, 0, .13, .2, .12); part(eyeG, 0, .43, .01, .12, .1, .1); for (const s of [-1, 1]) { part(eyeG, s * .05, .44, .09, .035, .035, .015, yEye); const t = new THREE.Mesh(new THREE.ConeGeometry(.025, .07, 4), m); t.position.set(s * .07, .53, 0); g.add(t); } }
    K.decoys.push({ g, cat, idx: -1, base: new THREE.Vector3(), hopT: 0 }); }
  // the watching crowd (only in the lightning): dozens of ghost silhouettes on the hill, in the trees, on the crypt, in the church windows
  { const pos = []; const add = (x, y, z, s) => pos.push([x, y, z, s]);
    for (let i = 0; i < 26; i++) { const x = -10 + i * .8 + Math.sin(i * 7.7) * .3, z = -7.2 - (i % 3) * 1.6 - Math.abs(Math.sin(i * 3.1)) * 1.2; const gy = Math.max(0, -z - 6.2); add(x, gy * gy * .045 + gy * .25 + .02, z, .7 + (i % 4) * .08); }
    for (const tp of (W.oakTips || []).slice(0, 7)) add(tp.x, tp.y - .25, tp.z, .45);
    add(CRYPT.x - .8, CRYPT.h + .95, CRYPT.z, .55); add(CRYPT.x + .7, CRYPT.h + .2, CRYPT.z + .5, .5);
    for (let i = 0; i < 6; i++) add(-8.5 + i * 3.4, 0, -4.9 - (i % 2) * .6, .75);
    const n = pos.length; const cm = new THREE.ShaderMaterial({ uniforms: { k: { value: 0 }, time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec3 vN, vV; varying float vH; void main(){ vec4 p = vec4(position, 1.); vec3 nn = normal; \n#ifdef USE_INSTANCING\n p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn; \n#endif\n vec4 mv = modelViewMatrix * p; vN = normalize(normalMatrix * nn); vV = normalize(-mv.xyz); vH = position.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float k, time; varying vec3 vN, vV; varying float vH; void main(){ float f = 1. - clamp(abs(dot(normalize(vN), normalize(vV))), 0., 1.); float a = (.25 + f * f * .9) * smoothstep(0., .25, vH); gl_FragColor = vec4(vec3(.55, .85, 1.1) * a * k, 1.); }' });
    K.crowd = new THREE.InstancedMesh(ghostGeo(16), cm, n); K.crowd.frustumCulled = false; K.crowd.renderOrder = 4; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    pos.forEach(([x, y, z, sc], i) => { m4.compose(v.set(x, y, z), q.setFromAxisAngle(v.clone().set(0, 1, 0), Math.atan2(-x * .05, 1)), s.set(sc, sc, sc)); m4.setPosition(x, y, z); K.crowd.setMatrixAt(i, m4); }); K.crowd.visible = false; scene.add(K.crowd);
    // their eyes: tiny dark dots don't read at that size → two bright pinpricks each
    const ep = new Float32Array(n * 2 * 3); pos.forEach(([x, y, z, sc], i) => { ep.set([x - .1 * sc, y + .72 * sc, z + .3 * sc, x + .1 * sc, y + .72 * sc, z + .3 * sc], i * 6); });
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); K.crowdEyes = new THREE.Points(eg, new THREE.PointsMaterial({ color: new THREE.Color(.02, .03, .06), map: W.soft, size: 7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
    K.crowdEyes.visible = false; K.crowdEyes.renderOrder = 5; scene.add(K.crowdEyes); K.crowdN = n; }
  return K; }
// spot-dependent perch height for decoys
export function decoyY(d) { const k = SPOTS[d.spot] ? SPOTS[d.spot].k : 'stone'; return k === 'oak' ? 2.25 : (k === 'crypt' || k === 'door') ? CRYPT.h + .18 : 1.02; }
export function decoyPos(d, out) { const k = SPOTS[d.spot] ? SPOTS[d.spot].k : 'stone'; if (k === 'oak') return out.set(OAK.x + (d.spot % 2 ? -.7 : .8), 2.25 + (d.spot % 2 ? .3 : 0), OAK.z + .1);
  if (k === 'crypt' || k === 'door') return out.set(CRYPT.x + (d.spot % 2 ? .7 : -.6), CRYPT.h + .18, CRYPT.z + .5); return out.set(d.x, 1.0, d.z); }
// per frame: map rule ghosts to pooled visuals
const _to = new THREE.Vector3(); const GS = 1.3; // ghost size on screen (v1: .82)
export function updateGhosts(K, Q, t, dt, cam, W, opts = {}) {
  const live = new Map(); if (Q) for (const g of Q.ghosts) if (g.alive || g.st === 'caught') live.set(g.id, g);
  for (const v of K.pool) { if (v.id >= 0 && !live.has(v.id) && v.caughtT < 0) { v.id = -1; v.root.visible = false; } }
  if (Q) for (const g of Q.ghosts) { let v = K.pool.find(p => p.id === g.id); if (!v) { if (!g.alive) continue; v = K.pool.find(p => p.id < 0); if (!v) continue; v.id = g.id; v.kind = g.kind; v.caughtT = -1; v.vis = 0; v.lean = 0; v.root.visible = true; v.side = g.side;
      const shade = g.kind === 'shade'; v.mesh.material = shade ? v.shadeM : v.sheetM; v.arms.forEach(a => a.material = v.mesh.material); v.xm.uniforms.col.value.set(shade ? '#c08aff' : '#7ff0ff'); v.eyeM.emissive.set(shade ? '#b070ff' : '#000000'); }
    const mim = g.kind === 'mimic'; v.mesh.visible = !mim; v.eyes.forEach(e => e.visible = !mim); v.mouth.visible = !mim; v.arms.forEach(a => a.visible = !mim); v.xr.visible = !mim; v.pk.visible = mim;
    if (!g.alive && v.caughtT < 0) { v.caughtT = 0; v.from.copy(v.root.position); }
    if (v.caughtT >= 0) continue;
    const strike = Q.state === 'strike'; const frz = strike ? 1 : 0;
    const pl = g.peekLen || Q.D.peekLen; const peek = g.st === 'peek' ? smooth(Math.min(g.stT / .18, 1, (pl - g.stT) / .2)) : 0; v.lean = lerp(v.lean, peek, Math.min(1, dt * 14)); if (g.st !== 'peek') v.side = g.side;
    let x = g.x, z = g.z, y = .04 + Math.sin(t * 2.2 + g.id) * .04;
    if (g.st === 'flee') { const k = Math.min(1, g.flT / g.flLen); y += Math.sin(k * Math.PI) * (mim ? .9 : .6); }
    const up = g.startled && g.st === 'peek' ? 1 : 0; x += v.side * .42 * v.lean * (1 - up * .6); y += .1 * v.lean + up * v.lean * (.55 + Math.sin(t * 6 + g.id) * .06); // startled: it pops straight up
    v.root.position.set(x, y, z); const face = Math.atan2(cam.position.x - x, cam.position.z - z); v.root.rotation.y = face; v.body.rotation.z = -v.side * .38 * v.lean + (strike ? Math.sin(t * 40 + g.id) * .03 : 0); v.body.rotation.x = g.st === 'flee' ? .25 : 0;
    const flee = g.st === 'flee' ? 1 : 0; const vis = mim ? 1 : clamp(Math.max(g.rev * 1.05, v.lean * .92, flee * .8, frz, opts.allVis || 0), 0, 1); v.vis = lerp(v.vis, vis, Math.min(1, dt * 12));
    const tell = Math.max(v.lean, g.rev, flee, frz);
    if (!mim) { const m = v.mesh.material; m.opacity = v.vis * (g.kind === 'shade' ? .92 : .9); m.depthWrite = v.vis > .9; m.emissiveIntensity = (g.kind === 'shade' ? .25 : .22) + tell * .25 + frz * .4; m.userData.u.uTime.value = t + g.id; m.userData.u.uRim.value = .7 + tell * .9 + frz; m.userData.u.uFreeze.value = frz; v.mesh.castShadow = v.vis > .6;
      v.eyeM.opacity = 1; v.eyeM.transparent = true; v.eyes.forEach(e => { e.material.opacity = Math.max(v.vis, g.kind === 'shade' ? .9 : 0); e.scale.set(.055 * (1 + frz * .45), .08 * (1 + frz * .55), .03); }); v.eyeM.emissiveIntensity = g.kind === 'shade' ? 1.2 + tell * 2 : 0;
      v.mouth.scale.set(.05 * (1 + frz * .5 + v.lean * .3), .035 * (1 + frz * 1.6 + v.lean * .6), .02); v.root.visible = v.vis > .01 || g.kind === 'shade';
      v.arms.forEach((a, i) => { const s = i ? 1 : -1; const wave = v.lean * Math.sin(t * 14 + i * 2) * .1 + frz * .25; a.position.set(s * (.36 + v.lean * .04), .42 + wave + frz * .18, .05 + frz * .06); });
      const sq = g.st === 'flee' ? 1.18 : 1 + frz * .05; v.body.scale.set(GS / Math.sqrt(sq), GS * sq, GS / Math.sqrt(sq)); }
    else { v.pumpM.emissiveIntensity = (Math.max(v.lean, g.rev * .8, flee) * (1.6 + Math.sin(t * 30) * .6) + frz * 1.5); v.pk.rotation.z = Math.sin(t * 28) * .06 * Math.max(v.lean, g.rev); v.pk.position.y = .25 + v.lean * .12 * Math.abs(Math.sin(t * 9)); v.root.visible = true; v.root.rotation.y = face; v.body.scale.setScalar(1); }
    const xk = W.xray * (g.alive ? 1 : 0); v.xm.uniforms.k.value = xk; v.xm.uniforms.time.value = t; v.xr.visible = !mim && xk > .01; v.pxm.uniforms.k.value = xk; v.pxr.visible = mim && xk > .01; }
  // catch animation: spin, shrink and fly into the lantern
  for (const v of K.pool) { if (v.caughtT < 0) continue; v.caughtT += dt; const k = Math.min(1, v.caughtT / .7), e = k * k; const to = _to.set(v.from.x * .8 + W.spot.position.x * .2, v.from.y + 2.9, v.from.z + .9); // spirals up toward the lantern and vanishes in a sparkle
    v.root.position.set(lerp(v.from.x, to.x, e), lerp(v.from.y, to.y, e) + Math.sin(k * Math.PI) * .8, lerp(v.from.z, to.z, e)); v.root.rotation.y += dt * 18; const s = (1 - k * .9) * GS; v.body.scale.setScalar(s);
    if (v.kind !== 'mimic') { v.mesh.material.opacity = .95 * (1 - k * .5); v.mesh.material.emissiveIntensity = 1.4; v.mesh.material.userData.u.uRim.value = 2; } else v.pumpM.emissiveIntensity = 3;
    v.xr.visible = false; v.pxr.visible = false; if (k >= 1) { v.caughtT = -1; v.id = -1; v.root.visible = false; } }
  // decoys
  K.decoys.forEach((d, i) => { const r = Q && Q.decoys[i]; if (!r || r.spot < 0) { d.g.visible = false; return; } d.g.visible = true; const p = decoyPos(r, new THREE.Vector3()); if (d.idx !== r.spot) { d.idx = r.spot; d.hopT = r.hop > 0 ? .5 : 0; d.g.visible = true; }
    if (d.cat !== (r.kind === 'cat')) { /* pool order matches: even = cat */ }
    d.hopT = Math.max(0, d.hopT - dt); d.g.position.set(p.x, p.y + Math.sin(d.hopT / .5 * Math.PI) * .4, p.z); d.g.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) + Math.sin(t * .7 + i) * .3; d.g.scale.setScalar(r.kind === 'cat' ? 1.25 : 1.1); });
  // crowd
  const ck = W.crowdK; K.crowd.visible = ck > .01; K.crowd.material.uniforms.k.value = ck; K.crowd.material.uniforms.time.value = t; K.crowdEyes.visible = ck > .01; K.crowdEyes.material.opacity = ck;
}
export function ghostScreenPos(v, out) { return out.set(v.root.position.x, v.root.position.y + (v.kind === 'mimic' ? .25 : .75), v.root.position.z); }
