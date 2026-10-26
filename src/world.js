// The churchyard on a stormy night: mossy ground with thousands of wind-blown grass blades, crooked granite gravestones, a stone crypt
// with an iron gate, a gnarled dead oak (the lightning target), a pumpkin patch with two lit jack-o'-lanterns, hay, barrels, a well,
// an iron fence, lantern posts, a hill with a church and dead trees behind, a storm sky with moving clouds, rain, ground mist and fog.
// The player's LANTERN is a real SpotLight with shadows + a soft volumetric cone and dust motes. The LIGHTNING is a branching bolt,
// a flash of the whole sky and yard, and a silent crowd of watching ghosts that only exists in that flash.
import * as THREE from 'three';
import { softTex, smokeTex, ringTex, stoneTex, groundTex, pathTex, barkTex, plankTex, strawTex, brickTex, pumpkinTex, faceTex } from './tex.js';
import { OAK, CRYPT, STONES, PUMPKINS, HAY, BARRELS, WELL, POSTS } from './layout.js';
export const QUALITY = {
  low: { dpr: 1, shadows: false, shadowSize: 512, bloom: .8, msaa: 0, grass: 1600, rain: 900, posts: false, mist: 6, motes: 120 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, msaa: 4, grass: 5200, rain: 2200, posts: true, mist: 12, motes: 260 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, msaa: 4, grass: 9000, rain: 3200, posts: true, mist: 16, motes: 380 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, msaa: 4, grass: 14000, rain: 4200, posts: true, mist: 20, motes: 500 } };
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise2(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const h = (a, b) => hash(a * 57.3 + b * 131.7);
  return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v; }
export function groundY(x, z) { // flat yard, a hill rising behind the fence, gentle rolls outside
  const back = Math.max(0, -z - 6.2), side = Math.max(0, Math.abs(x) - 9); return back * back * .045 + back * .25 + side * .2 + (back + side > 0 ? (noise2(x * .15, z * .15) - .5) * Math.min(1, (back + side) * .3) * 2.5 : 0); }
export const pathX = z => Math.sin(z * .45) * .45 + .15; // the gravel path from the front to the crypt
export function gradeShader() { return { uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .5 }, grain: { value: .028 }, lift: { value: new THREE.Vector3(.006, .009, .022) }, sat: { value: 1.05 }, flash: { value: 0 }, xray: { value: 0 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time, vig, grain, sat, flash, xray, hurt; uniform vec3 lift;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb; float l = dot(x, vec3(.299, .587, .114));
      x = mix(vec3(l), x, sat * (1. - xray * .35)); x += lift * (1. - l); x = mix(x, x * vec3(.92, 1.0, 1.1), xray);
      vec3 xc = clamp(x, 0., 1.); x = mix(x, xc * xc * (3. - 2. * xc), .2);
      vec2 q = vUv - .5; float r2 = dot(q, q) * 2.2; x *= 1. - vig * smoothstep(.15, .9, r2); x += flash * vec3(.14, .17, .24) * (1. - l * .7);
      x = mix(x, x * vec3(1.15, .55, .55), hurt * smoothstep(.1, .9, r2));
      x += (hash(vUv * 900. + fract(time * 7.)) - .5) * grain * (1. - l * .6); gl_FragColor = vec4(x, c.a); }` }; }
// ---------- geometry helpers ----------
function slabShape(kind, w, h) { const s = new THREE.Shape(), hw = w / 2;
  if (kind === 0) { s.moveTo(-hw, 0); s.lineTo(-hw, h - hw); s.absarc(0, h - hw, hw, Math.PI, 0, true); s.lineTo(hw, 0); s.lineTo(-hw, 0); }
  else if (kind === 3) { s.moveTo(-hw, 0); s.lineTo(-hw, h * .78); s.quadraticCurveTo(-hw * .6, h * .95, 0, h); s.quadraticCurveTo(hw * .6, h * .95, hw, h * .78); s.lineTo(hw, 0); s.lineTo(-hw, 0); }
  else { const a = w * .17; s.moveTo(-a, 0); s.lineTo(-a, h * .62); s.lineTo(-hw, h * .62); s.lineTo(-hw, h * .78); s.lineTo(-a, h * .78); s.lineTo(-a, h); s.lineTo(a, h); s.lineTo(a, h * .78); s.lineTo(hw, h * .78); s.lineTo(hw, h * .62); s.lineTo(a, h * .62); s.lineTo(a, 0); s.lineTo(-a, 0); }
  return s; }
function roughen(g, amt, sc = 4) { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = noise2(v.x * sc + v.z * 3.1, v.y * sc - v.z * 1.7) - .5; p.setXYZ(i, v.x + n * amt, v.y + n * amt * .6, v.z + n * amt); } g.computeVertexNormals(); return g; }
function mergeGeos(list) { // non-indexed merge of position/normal/uv
  let n = 0; const gs = list.map(g => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); n += q.attributes.position.count; return q; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const q of gs) { if (!q.attributes.normal) q.computeVertexNormals(); P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); U.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; }
  list.forEach(g => g.dispose()); gs.forEach(g => g.dispose()); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return g; }
export function pumpkinGeo(seg = 64) { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .6)); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), rib = 1 - .1 * Math.pow(1 - Math.abs(Math.cos(a * 4)), 4); const y = v.y; const top = 1 - .35 * Math.exp(-((1 - Math.abs(y)) * 6)) * (y > 0 ? 1 : .6);
    v.x *= rib * top; v.z *= rib * top; v.y = y * .72 + (y > .9 ? -.12 : 0); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
export function stemGeo() { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .62, 0), new THREE.Vector3(.03, .78, 0), new THREE.Vector3(.1, .88, .02)]); return new THREE.TubeGeometry(c, 6, .07, 6, false); }
export function makePumpkinMats(T) { return { skin: new THREE.MeshPhysicalMaterial({ map: T.pumpkin, roughness: .5, clearcoat: .35, clearcoatRoughness: .5, sheen: .3, sheenColor: new THREE.Color('#ffb070'), color: '#ffffff' }),
  stem: new THREE.MeshStandardMaterial({ color: '#3a4a1c', roughness: .85 }) }; }
// ---------- the world ----------
export function createWorld(renderer) {
  const scene = new THREE.Scene(); const W = { scene, t: 0, flash: 0, boltK: 0, crowdK: 0, xray: 0, rainK: 0, hurt: 0, storm: 0, lanternK: 1, posts: [], pumpkins: [], stones: [], shadowCasters: [] };
  scene.background = new THREE.Color('#05070f'); scene.fog = new THREE.FogExp2('#0b1020', .035);
  const T = W.T = { soft: softTex(), smoke: smokeTex(), ring: ringTex(), stone: stoneTex(), ground: groundTex(), path: pathTex(), bark: barkTex(), plank: plankTex(), straw: strawTex(), brick: brickTex(), pumpkin: pumpkinTex(), face0: faceTex(0), face1: faceTex(1) };
  W.soft = T.soft; W.smokeTex = T.smoke; W.ringTex = T.ring;
  // ---- sky dome: storm clouds (value noise fbm), a moon glow behind them, lightning lights the clouds from inside
  const skyU = W.skyU = { time: { value: 0 }, flash: { value: 0 }, boltDir: { value: new THREE.Vector3(-.3, .6, -.75).normalize() }, moonDir: { value: new THREE.Vector3(.45, .42, -.78).normalize() }, storm: { value: 0 } };
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 40, 20), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vD; uniform float time, flash, storm; uniform vec3 boltDir, moonDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), u.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), u.x), u.y); }
      float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
      void main(){ float y = vD.y; vec2 uv = vD.xz / max(y + .35, .08) * 1.3; float c = fbm(uv * .9 + vec2(time * .02, time * .008)); float c2 = fbm(uv * 2.1 - vec2(time * .035, 0.));
        float cl = smoothstep(.35, .78, c * .75 + c2 * .35);
        vec3 top = vec3(.008, .011, .025), hor = vec3(.03, .036, .06); vec3 col = mix(hor, top, smoothstep(-.02, .5, y));
        float m = max(dot(vD, moonDir), 0.); float mg = pow(m, 60.) * 1.4 + pow(m, 8.) * .18; col += vec3(.55, .62, .8) * mg * (1. - cl * .8);
        vec3 cloudC = vec3(.05, .06, .09) + vec3(.16, .18, .24) * pow(m, 4.) * .6; col = mix(col, cloudC * (.7 + c2 * .6), cl * .85);
        float b = max(dot(vD, boltDir), 0.); col += flash * (vec3(.55, .62, .9) * (.25 + cl * .9) * (.35 + pow(b, 3.) * 1.6));
        gl_FragColor = vec4(col, 1.); }` }));
  W.sky.renderOrder = -10; W.sky.frustumCulled = false; scene.add(W.sky);
  // ---- lights: cold moonlight with shadows, a dim sky fill, the lantern posts, a jack-o'-lantern glow, the flash
  W.hemi = new THREE.HemisphereLight('#3a4a7a', '#0a0c10', .22); scene.add(W.hemi);
  W.key = new THREE.DirectionalLight('#9fb4ff', .55); W.key.position.set(6, 14, -9); W.key.target.position.set(0, 0, -.5); W.key.castShadow = true;
  { const sc = W.key.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 9; sc.bottom = -9; sc.near = 2; sc.far = 40; W.key.shadow.bias = -.0006; W.key.shadow.normalBias = .03; } scene.add(W.key, W.key.target);
  W.flashL = new THREE.DirectionalLight('#cfe0ff', 0); W.flashL.position.set(OAK.x - 2, 20, OAK.z + 6); W.flashL.target.position.set(0, 0, 0); scene.add(W.flashL, W.flashL.target);
  W.boltL = new THREE.PointLight('#bcd4ff', 0, 18, 1.6); W.boltL.position.set(OAK.x, 4.5, OAK.z); scene.add(W.boltL);
  // the lantern (the player's light): a warm spotlight with soft edges and shadows
  W.spot = new THREE.SpotLight('#ffcf8f', 60, 24, .3, .55, 1.4); W.spot.position.set(0, 5.5, 6); W.spot.castShadow = true; W.spot.shadow.bias = -.0004; W.spot.shadow.normalBias = .02; W.spot.shadow.camera.near = .5; W.spot.shadow.camera.far = 22;
  W.spotTarget = new THREE.Object3D(); scene.add(W.spot, W.spotTarget); W.spot.target = W.spotTarget;
  W.pumpkinL = new THREE.PointLight('#ff9a3a', 1.6, 4.5, 1.8); W.pumpkinL.position.set(-2.6, .55, 2.95); scene.add(W.pumpkinL);
  W.cryptL = new THREE.PointLight('#62ffb0', 0, 4, 2); W.cryptL.position.set(CRYPT.x - .2, 1.0, CRYPT.z + CRYPT.d / 2 - .3); scene.add(W.cryptL);
  // ---- materials
  T.ground.map.repeat.set(10, 10); T.ground.bump.repeat.set(10, 10); T.path.repeat.set(1, 8); T.brick.map.repeat.set(2, 1.5); T.brick.bump.repeat.set(2, 1.5); T.bark.repeat.set(2, 3); T.plank.repeat.set(2, 1); T.straw.repeat.set(3, 1);
  T.stone.map.offset.set(.5, 0); T.stone.bump.offset.set(.5, 0);
  const M = W.M = { ground: new THREE.MeshStandardMaterial({ map: T.ground.map, bumpMap: T.ground.bump, bumpScale: .6, roughness: .97, color: '#c0c8c0' }),
    path: new THREE.MeshStandardMaterial({ map: T.path, roughness: .95, transparent: true, opacity: .92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    stone: new THREE.MeshStandardMaterial({ map: T.stone.map, bumpMap: T.stone.bump, bumpScale: 1.4, roughness: .88, color: '#c8c8cc' }),
    brick: new THREE.MeshStandardMaterial({ map: T.brick.map, bumpMap: T.brick.bump, bumpScale: 1.2, roughness: .92, color: '#b8b8c0' }),
    darkStone: new THREE.MeshStandardMaterial({ map: T.stone.map, roughness: .9, color: '#7a7a82' }),
    iron: new THREE.MeshStandardMaterial({ color: '#1a1b20', metalness: .85, roughness: .45 }), bark: new THREE.MeshStandardMaterial({ map: T.bark, roughness: .95, color: '#9a9088' }),
    plank: new THREE.MeshStandardMaterial({ map: T.plank, roughness: .85 }), straw: new THREE.MeshStandardMaterial({ map: T.straw, roughness: .95 }), black: new THREE.MeshBasicMaterial({ color: '#000000' }),
    glass: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb050', emissiveIntensity: 2.2, roughness: .3 }), ...makePumpkinMats(T) };
  const add = (geo, mat, x, y, z, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m; };
  // ---- ground + path
  const gg = new THREE.PlaneGeometry(90, 90, 120, 120); gg.rotateX(-Math.PI / 2); { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, groundY(p.getX(i), p.getZ(i))); gg.computeVertexNormals(); }
  W.ground = add(gg, M.ground, 0, 0, 0, false, true);
  { const pts = []; for (let i = 0; i <= 30; i++) { const z = 7 - i * (10 / 30); pts.push(z); } const pg = new THREE.PlaneGeometry(1.15, 10.4, 1, 40); pg.rotateX(-Math.PI / 2); const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i) + 1.9; p.setXYZ(i, p.getX(i) * (1 + (noise2(z * 2, 0) - .5) * .3) + pathX(z), .012, z); } pg.computeVertexNormals(); W.path = add(pg, M.path, 0, 0, 0, false, true); W.path.renderOrder = 1; }
  // ---- gravestones
  for (const [x, z, ry, kind, s, tilt] of STONES) { const g0 = new THREE.Group(); g0.position.set(x, 0, z); g0.rotation.set(tilt * .6, ry, tilt); scene.add(g0);
    let geo; if (kind === 2) { const sh = new THREE.CylinderGeometry(.14, .2, 1.25, 4, 1); sh.rotateY(Math.PI / 4); sh.translate(0, .62 + .14, 0); const tip = new THREE.ConeGeometry(.15, .28, 4); tip.rotateY(Math.PI / 4); tip.translate(0, 1.38 + .14, 0); geo = mergeGeos([sh, tip]); }
    else { const w = kind === 1 ? .78 : .62, h = kind === 1 ? 1.15 : .95; geo = new THREE.ExtrudeGeometry(slabShape(kind, w, h), { depth: .14, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, curveSegments: 14 }); geo.translate(0, .14, -.07); roughen(geo, .012, 6); }
    const m = new THREE.Mesh(geo, M.stone); m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true; g0.add(m);
    const base = new THREE.Mesh(roughen(new THREE.BoxGeometry(kind === 2 ? .5 : .8, .16, kind === 2 ? .5 : .34, 4, 2, 3), .02), M.darkStone); base.position.y = .07; base.scale.setScalar(s); base.castShadow = true; base.receiveShadow = true; g0.add(base);
    W.stones.push(g0); }
  // ---- the crypt: masonry block, columns, pediment, roof, dark doorway with an iron gate, steps, a cross
  { const c = new THREE.Group(); c.position.set(CRYPT.x, 0, CRYPT.z); scene.add(c); W.crypt = c; const { w, d, h } = CRYPT;
    const mk = (g, m, x, y, z, cs = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cs; o.receiveShadow = true; c.add(o); return o; };
    mk(new THREE.BoxGeometry(w, h, d), M.brick, 0, h / 2, 0); mk(new THREE.BoxGeometry(w + .3, .22, d + .3), M.darkStone, 0, .11, 0);
    mk(new THREE.BoxGeometry(w + .25, .16, d + .25), M.darkStone, 0, h + .08, 0);
    const ped = new THREE.Shape(); ped.moveTo(-w / 2 - .15, 0); ped.lineTo(0, .75); ped.lineTo(w / 2 + .15, 0); ped.lineTo(-w / 2 - .15, 0); const pg = new THREE.ExtrudeGeometry(ped, { depth: d + .25, bevelEnabled: false }); pg.translate(0, 0, -(d + .25) / 2); mk(pg, M.darkStone, 0, h + .16, 0);
    for (const sx of [-1, 1]) { mk(new THREE.CylinderGeometry(.12, .14, h - .1, 14), M.stone, sx * (w / 2 - .25), h / 2, d / 2 + .16); mk(new THREE.BoxGeometry(.34, .14, .34), M.darkStone, sx * (w / 2 - .25), .07 + .2, d / 2 + .16); mk(new THREE.BoxGeometry(.34, .14, .34), M.darkStone, sx * (w / 2 - .25), h - .07, d / 2 + .16); }
    mk(new THREE.BoxGeometry(1.0, 1.55, .1), M.black, -.2, .22 + .78, d / 2 + .01, false);
    for (let i = 0; i < 7; i++) mk(new THREE.CylinderGeometry(.018, .018, 1.5, 6), M.iron, -.2 - .42 + i * .14, .22 + .76, d / 2 + .06); mk(new THREE.BoxGeometry(1.0, .04, .04), M.iron, -.2, 1.25, d / 2 + .06); mk(new THREE.BoxGeometry(1.0, .04, .04), M.iron, -.2, .5, d / 2 + .06);
    for (let i = 0; i < 2; i++) mk(new THREE.BoxGeometry(1.4 - i * .2, .1, .35), M.darkStone, -.2, .05 + i * .1, d / 2 + .3 - i * .12);
    const cr = mk(new THREE.BoxGeometry(.08, .5, .08), M.darkStone, 0, h + 1.12, d / 2 - .05); mk(new THREE.BoxGeometry(.3, .08, .08), M.darkStone, 0, h + 1.2, d / 2 - .05); }
  // ---- the dead oak: a gnarled trunk splitting into twisting branches (merged tubes)
  { const parts = []; const rnd = (i) => hash(i * 7.31 + 3); let k = 0; W.oakTips = [];
    const branch = (p0, dir, len, r, depth) => { const pts = [p0.clone()]; let p = p0.clone(), d = dir.clone(); const n = 5; for (let i = 0; i < n; i++) { d.add(new THREE.Vector3((rnd(k++) - .5) * .5, (rnd(k++) - .3) * .25, (rnd(k++) - .5) * .5)).normalize(); p = p.clone().addScaledVector(d, len / n); pts.push(p); }
      const curve = new THREE.CatmullRomCurve3(pts); const tg = new THREE.TubeGeometry(curve, 10, r, 7, false); const pa = tg.attributes.position; // taper along the tube
      const segs = 11, rs = 8; for (let i = 0; i < pa.count; i++) { const ring = Math.floor(i / rs), tt = ring / (segs - 1); const c0 = curve.getPointAt(Math.min(1, tt)); const v = new THREE.Vector3().fromBufferAttribute(pa, i).sub(c0).multiplyScalar(1 - tt * .62).add(c0); pa.setXYZ(i, v.x, v.y, v.z); }
      tg.computeVertexNormals(); parts.push(tg); if (depth === 0) { W.oakTips.push(p.clone()); return; }
      const nb = depth >= 2 ? 3 : 2; for (let b = 0; b < nb; b++) { const t = .55 + b * .18, q = curve.getPointAt(Math.min(.95, t)); const nd = d.clone().add(new THREE.Vector3((rnd(k++) - .5) * 1.6, .35 + rnd(k++) * .5, (rnd(k++) - .5) * 1.6)).normalize(); branch(q, nd, len * (.62 + rnd(k++) * .15), r * .55, depth - 1); } };
    branch(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(.05, 1, .02), 3.1, .34, 3);
    const roots = []; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + .3; const rc = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .5, 0), new THREE.Vector3(Math.cos(a) * .45, .12, Math.sin(a) * .45), new THREE.Vector3(Math.cos(a) * .9, -.05, Math.sin(a) * .9)]); roots.push(new THREE.TubeGeometry(rc, 6, .13, 6, false)); }
    W.oak = add(mergeGeos([...parts, ...roots]), M.bark, OAK.x, 0, OAK.z); W.oak.scale.setScalar(1.15); W.oakTop = new THREE.Vector3(OAK.x, 3.6 * 1.15, OAK.z); W.oakTips = W.oakTips.map(p => p.multiplyScalar(1.15).add(new THREE.Vector3(OAK.x, 0, OAK.z))); }
  // ---- pumpkin patch (two of them are lit jack-o'-lanterns), vines
  { const pg = pumpkinGeo(), sg = stemGeo(); W.pumpkinGeo = pg; W.stemGeo = sg;
    PUMPKINS.forEach(([x, z, s], i) => { const g0 = new THREE.Group(); g0.position.set(x, s * .5, z); g0.rotation.y = hash(i + 4) * 6; g0.scale.set(s * (1 + hash(i) * .12), s, s * (1 + hash(i + 9) * .1)); scene.add(g0);
      const lit = i === 1 || i === 4; const mat = lit ? M.skin.clone() : M.skin; if (lit) { mat.emissiveMap = i === 1 ? T.face0 : T.face1; mat.emissive = new THREE.Color('#ff8a20'); mat.emissiveIntensity = 2.4; mat.map = T.pumpkin; }
      const m = new THREE.Mesh(pg, mat); m.castShadow = true; m.receiveShadow = true; g0.add(m); const st = new THREE.Mesh(sg, M.stem); st.castShadow = true; g0.add(st); if (lit) { g0.rotation.y = 0; W.litPumpkins = (W.litPumpkins || []).concat(mat); } W.pumpkins.push(g0); });
    const vm = new THREE.MeshStandardMaterial({ color: '#25331a', roughness: .9 }); for (let i = 0; i < 6; i++) { const pts = []; let x = -4.4 + i * .65, z = 2.1 + hash(i) * .4; for (let j = 0; j < 6; j++) { pts.push(new THREE.Vector3(x, .03, z)); x += (hash(i * 9 + j) - .5) * .6; z += .3; } add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .025, 5, false), vm, 0, 0, 0, false, true); } }
  // ---- hay bale, barrels, well
  { const hb = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 1.1, 24), M.straw); hb.rotation.z = Math.PI / 2; hb.position.set(HAY.x, .55, HAY.z); hb.castShadow = true; hb.receiveShadow = true; scene.add(hb);
    const hb2 = hb.clone(); hb2.position.set(HAY.x + .5, 1.35, HAY.z - .1); hb2.scale.setScalar(.75); scene.add(hb2);
    for (const [dx, dz, r] of [[0, 0, 0], [.75, .15, .5], [.35, -.62, 1.2]]) { const b = new THREE.Group(); b.position.set(BARRELS.x + dx, 0, BARRELS.z + dz); b.rotation.y = r; scene.add(b);
      const bg = new THREE.CylinderGeometry(.34, .34, .95, 20, 6); const pa = bg.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), k = 1 + .12 * Math.cos(y / .95 * Math.PI); pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); } bg.computeVertexNormals();
      const bm = new THREE.Mesh(bg, M.plank); bm.position.y = .475; bm.castShadow = true; bm.receiveShadow = true; b.add(bm); for (const y of [.15, .8]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.36, .018, 6, 24), M.iron); ring.rotation.x = Math.PI / 2; ring.position.y = y; b.add(ring); } }
    const wl = new THREE.Group(); wl.position.set(WELL.x, 0, WELL.z); scene.add(wl); const ringG = new THREE.CylinderGeometry(.75, .8, .75, 24, 1, true); const wr = new THREE.Mesh(ringG, M.brick); wr.material = M.brick; wr.position.y = .37; wr.castShadow = true; wr.receiveShadow = true; wl.add(wr);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.77, .07, 8, 28), M.darkStone); rim.rotation.x = Math.PI / 2; rim.position.y = .75; wl.add(rim); const hole = new THREE.Mesh(new THREE.CircleGeometry(.72, 24), M.black); hole.rotation.x = -Math.PI / 2; hole.position.y = .5; wl.add(hole);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.5, .1), M.plank); post.position.set(sx * .7, 1.2, 0); post.castShadow = true; wl.add(post); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, .6, 4, 1), M.plank); roof.rotation.y = Math.PI / 4; roof.position.y = 2.2; roof.scale.set(1, 1, .7); roof.castShadow = true; wl.add(roof); }
  // ---- iron fence along the back with spear tips (instanced), side stubs
  { const xs = []; for (let x = -9; x <= 9.01; x += .32) xs.push([x, -5.75]); for (let z = -5.4; z <= -2.2; z += .32) { xs.push([-9, z]); xs.push([9, z]); }
    const bar = new THREE.CylinderGeometry(.016, .016, 1.3, 5); bar.translate(0, .65, 0); const tip = new THREE.ConeGeometry(.04, .14, 5); tip.translate(0, 1.36, 0); const fg = mergeGeos([bar, tip]);
    const fi = new THREE.InstancedMesh(fg, M.iron, xs.length); const m4 = new THREE.Matrix4(); xs.forEach(([x, z], i) => { const tilt = (hash(i * 3.3) - .5) * .06; m4.makeRotationZ(tilt); m4.setPosition(x, groundY(x, z) - .05, z); fi.setMatrixAt(i, m4); }); fi.castShadow = true; scene.add(fi);
    for (const y of [.25, 1.05]) { const r = new THREE.Mesh(new THREE.BoxGeometry(18, .035, .035), M.iron); r.position.set(0, y, -5.75); scene.add(r); } }
  // ---- lantern posts
  POSTS.forEach(([x, z], i) => { const post = add(new THREE.CylinderGeometry(.05, .07, 2.2, 8), M.iron, x, 1.1, z); const arm = add(new THREE.BoxGeometry(.4, .04, .04), M.iron, x + .18, 2.1, z);
    const glass = add(new THREE.BoxGeometry(.2, .28, .2), M.glass, x + .34, 1.88, z, false, false); const cap = add(new THREE.ConeGeometry(.17, .14, 4), M.iron, x + .34, 2.08, z); cap.rotation.y = Math.PI / 4;
    const L = new THREE.PointLight('#ffb35a', 2.6, 7, 1.7); L.position.set(x + .34, 1.85, z); scene.add(L); W.posts.push(L); });
  // ---- hill backdrop: a church with lit windows, dead trees
  { const cy = groundY(5.5, -21); const ch = new THREE.Group(); ch.position.set(5.5, cy - .3, -21); ch.rotation.y = -.25; scene.add(ch); const dm = new THREE.MeshStandardMaterial({ color: '#141620', roughness: 1 });
    const bx = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dm); m.position.set(x, y, z); ch.add(m); return m; }; bx(6, 3.4, 3.4, 0, 1.7, 0); bx(1.8, 6.5, 1.8, -3.6, 3.25, 0);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.6, 4), dm); sp.position.set(-3.6, 8.3, 0); sp.rotation.y = Math.PI / 4; ch.add(sp); const rf = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.5, 1.8, 4, 1), dm); rf.rotation.y = Math.PI / 4; rf.scale.set(1.7, 1, .95); rf.position.set(0, 4.3, 0); ch.add(rf);
    const wm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, .95, .45) }); W.churchWin = wm; for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.38, .8), wm); w.position.set(-1.8 + i * 1.2, 1.9, 1.72); ch.add(w); } const tw = new THREE.Mesh(new THREE.PlaneGeometry(.45, .7), wm); tw.position.set(-3.6, 4.8, .91); ch.add(tw);
    W.church = ch; const tm = new THREE.MeshStandardMaterial({ color: '#0e1016', roughness: 1 });
    for (let i = 0; i < 9; i++) { const x = -15 + i * 3.6 + (hash(i) - .5) * 2, z = -13 - hash(i + 3) * 10; if (Math.abs(x - 5.5) < 4 && z < -17) continue; const t = new THREE.Group(); t.position.set(x, groundY(x, z) - .2, z); scene.add(t);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.06, .16, 3.2, 6), tm); tr.position.y = 1.6; t.add(tr); for (let b = 0; b < 4; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.02, .06, 1.6, 5), tm); br.position.set(0, 2.1 + b * .3, 0); br.rotation.z = (b % 2 ? 1 : -1) * (.6 + hash(i * 5 + b) * .5); br.rotation.y = hash(i + b) * 6; br.translateY(.6); t.add(br); } } }
  // ---- volumetric lantern cone (additive, soft edges, drifting dust) + dust motes caught in the beam
  W.coneU = { time: { value: 0 }, k: { value: 1 }, col: { value: new THREE.Color('#ffcf8f') } };
  { const cg = new THREE.CylinderGeometry(.02, 1, 1, 40, 12, true); cg.translate(0, -.5, 0); cg.rotateX(-Math.PI / 2); // apex at the origin, opening along +z (lookAt aims +z at the light pool)
    W.cone = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: W.coneU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
      vertexShader: 'varying vec3 vN, vV; varying float vL; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vL = position.z; vP = position; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `uniform float time, k; uniform vec3 col; varying vec3 vN, vV; varying float vL; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), u.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), u.x), u.y); }
        void main(){ float edge = abs(dot(normalize(vN), normalize(vV))); float soft = edge * edge; float along = clamp(vL, 0., 1.);
          float fadeIn = smoothstep(0., .18, along); float fadeOut = 1. - smoothstep(.75, 1., along); float a = atan(vP.y, vP.x);
          float rays = .65 + .35 * n(vec2(a * 3.0, along * 2. - time * .25)); float dust = .8 + .2 * n(vec2(a * 9., along * 14. - time * .6));
          gl_FragColor = vec4(col * soft * fadeIn * fadeOut * rays * dust * .085 * k, 1.); }` }));
    W.cone.renderOrder = 5; W.cone.frustumCulled = false; scene.add(W.cone); }
  { const n = 500, p = new Float32Array(n * 3), s = new Float32Array(n); for (let i = 0; i < n; i++) { p[i * 3] = hash(i) - .5; p[i * 3 + 1] = hash(i + 1e3); p[i * 3 + 2] = hash(i + 2e3) - .5; s[i] = .4 + hash(i + 3e3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
    W.motesU = { time: { value: 0 }, apex: { value: new THREE.Vector3() }, tgt: { value: new THREE.Vector3() }, rad: { value: 1.3 }, map: { value: T.soft }, scale: { value: 800 }, k: { value: 1 } };
    W.motes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: W.motesU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float seed; uniform float time, rad, scale; uniform vec3 apex, tgt; varying float vA;
        void main(){ vec3 q = position; vec3 c = tgt + vec3(q.x * rad * 2.6, q.y * 2.6 + .05, q.z * rad * 2.6); c.x += sin(time * .3 * seed + seed * 20.) * .3; c.y = mod(c.y + time * .08 * seed, 2.7); c.z += cos(time * .25 * seed + seed * 11.) * .3;
          vec3 ax = tgt - apex; float L = length(ax); vec3 d = ax / max(L, 1e-3); float t = clamp(dot(c - apex, d) / max(L, 1e-3), 0., 1.2); vec3 cp = apex + d * t * L; float r = length(c - cp); float rr = rad * t + .02;
          vA = (1. - smoothstep(rr * .6, rr, r)) * smoothstep(.1, .4, t); vec4 mv = modelViewMatrix * vec4(c, 1.); gl_PointSize = min(seed * 18. * scale / max(-mv.z, .5) / 800., 9.); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform sampler2D map; uniform float k; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1., .85, .6) * a * vA * .55 * k, 1.); }' }));
    W.motes.frustumCulled = false; W.motes.renderOrder = 6; scene.add(W.motes); }
  // ---- rain (line streaks, shader-animated) and ground mist
  { const n = 4200, p = new Float32Array(n * 2 * 3), e = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const x = (hash(i * 1.7) - .5) * 26, y = hash(i * 2.3) * 14, z = -9 + hash(i * 3.1) * 18; for (let j = 0; j < 2; j++) { p.set([x, y, z], (i * 2 + j) * 3); e[i * 2 + j] = j; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('e', new THREE.BufferAttribute(e, 1)); W.rainU = { time: { value: 0 }, k: { value: 0 }, flash: { value: 0 } };
    W.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: W.rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float e; uniform float time; varying float vE; void main(){ vec3 q = position; q.y = mod(q.y - time * 11., 14.) - .5; q.x += q.y * .12 + e * .05; q.y += e * .45; vE = e; gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.); }',
      fragmentShader: 'uniform float k, flash; varying float vE; void main(){ gl_FragColor = vec4(vec3(.55, .62, .8) * (.065 + vE * .09 + flash * .2) * k, 1.); }' }));
    W.rain.frustumCulled = false; W.rain.renderOrder = 7; scene.add(W.rain); }
  W.mist = []; for (let i = 0; i < 20; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, color: '#6a7898', transparent: true, depthWrite: false, opacity: .12 }));
    s.userData = { x: (hash(i + 101) - .5) * 22, y: .25 + hash(i + 107) * .6, z: -6 + hash(i + 113) * 11, sp: .15 + hash(i + 127) * .3, s: 3 + hash(i + 131) * 3 }; s.scale.set(s.userData.s * 2.4, s.userData.s * .55, 1); scene.add(s); W.mist.push(s); }
  // ---- the lightning bolt (rebuilt for every strike) + its glow
  W.boltM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  W.bolt = new THREE.Mesh(new THREE.BufferGeometry(), W.boltM); W.bolt.frustumCulled = false; W.bolt.renderOrder = 8; W.bolt.visible = false; scene.add(W.bolt);
  W.boltGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.soft, color: new THREE.Color(.6, .75, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); W.boltGlow.scale.set(5, 5, 1); W.boltGlow.position.copy(W.oakTop); W.boltGlow.renderOrder = 9; scene.add(W.boltGlow);
  W.boltSeed = 1;
  // env map for PBR (the stormy sky)
  { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const sk = new THREE.Mesh(W.sky.geometry, W.sky.material); es.add(sk); W.env = pm.fromScene(es, .04).texture; pm.dispose(); scene.environment = W.env; scene.environmentIntensity = .35; }
  return W;
}
// a branching bolt from the clouds into the oak, as camera-facing ribbons (rebuilt per strike, old geometry disposed)
export function buildBolt(W, camPos, seed = 1) { let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const segs = []; const walk = (a, b, w, depth) => { const n = depth === 0 ? 14 : 7; let prev = a.clone(); for (let i = 1; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); if (i < n) { const off = (1 - Math.abs(t - .5) * 2) * .25 + .35; p.x += (r() - .5) * off * (depth ? 1.6 : 2.2); p.z += (r() - .5) * off * 1.4; }
      segs.push([prev, p, w * (1 - t * .5)]); if (depth < 2 && i < n - 1 && r() < (depth ? .25 : .38)) { const e = p.clone().add(new THREE.Vector3((r() - .5) * 6, -2 - r() * 4, (r() - .5) * 3)); walk(p, e, w * .45, depth + 1); } prev = p; } };
  const top = new THREE.Vector3(W.oakTop.x - 3 + r() * 2, 26, W.oakTop.z - 6); walk(top, W.oakTop.clone().add(new THREE.Vector3(0, .1, 0)), .085, 0);
  const pos = []; const up = new THREE.Vector3(); for (const [a, b, w] of segs) { const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(.5), v = camPos.clone().sub(mid); up.crossVectors(d, v).normalize().multiplyScalar(w);
    const a1 = a.clone().add(up), a2 = a.clone().sub(up), b1 = b.clone().add(up), b2 = b.clone().sub(up); pos.push(...a1.toArray(), ...a2.toArray(), ...b1.toArray(), ...b1.toArray(), ...a2.toArray(), ...b2.toArray()); }
  W.bolt.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); W.bolt.geometry = g; }
export function updateWorld(W, t, dt, q, cam, beam) {
  W.t = t; for (const k of ['flash', 'boltK', 'crowdK', 'xray', 'rainK', 'hurt', 'storm', 'lanternK']) W[k] = fin(W[k]);
  W.flash = Math.max(0, W.flash - dt * 2.2); W.hurt = Math.max(0, W.hurt - dt * 1.6); W.boltK = Math.max(0, W.boltK - dt * 3);
  W.sky.position.copy(cam.position); W.skyU.time.value = t; W.skyU.flash.value = W.flash; W.skyU.storm.value = W.storm;
  // lightning: flicker the bolt, light the yard from above with sharp shadows
  W.bolt.visible = W.boltK > .02; W.boltM.opacity = Math.min(1, W.boltK * 1.4) * (.75 + .25 * Math.sin(t * 90)); W.boltGlow.material.opacity = Math.min(.55, W.boltK * .6); W.boltGlow.scale.setScalar(1.4 + W.boltK * 1.2);
  W.flashL.intensity = .65 + W.flash * 5.5; W.boltL.intensity = W.boltK * 60 + W.flash * 8; W.hemi.intensity = .5 + W.flash * .9; W.key.intensity = 1.15 + W.flash * 1.5;
  // the lantern
  if (beam) { const ap = W.spot.position; ap.set(beam.x * .3 + cam.position.x * .25, 5.4, 6.2); W.spotTarget.position.set(beam.x, 0, beam.z); W.spotTarget.updateMatrixWorld();
    const dist = ap.distanceTo(W.spotTarget.position); W.spot.angle = Math.min(.9, Math.atan((beam.r * 1.05) / dist)); W.spot.intensity = 380 * W.lanternK * (dist / 8) * (dist / 8) * (1 + Math.sin(t * 13) * .015 + Math.sin(t * 7.3) * .02); W.spot.distance = dist * 2.2;
    W.cone.position.copy(ap); W.cone.lookAt(W.spotTarget.position); const rr = Math.tan(W.spot.angle) * dist; W.cone.scale.set(rr, rr, dist); W.coneU.time.value = t; W.coneU.k.value = W.lanternK * (1 - W.flash * .8) * .5;
    W.motesU.time.value = t; W.motesU.apex.value.copy(ap); W.motesU.tgt.value.set(beam.x, 0, beam.z); W.motesU.rad.value = rr; W.motesU.k.value = W.lanternK; }
  W.motes.geometry.setDrawRange(0, q.motes);
  // jack-o'-lanterns + posts flicker, crypt glow
  const fl = .85 + Math.sin(t * 11.3) * .08 + Math.sin(t * 23.7) * .05 + Math.sin(t * 5.1) * .04; W.pumpkinL.intensity = 1.6 * fl; (W.litPumpkins || []).forEach(m => m.emissiveIntensity = 2.4 * fl);
  W.posts.forEach((L, i) => { L.intensity = 2.6 * (.9 + Math.sin(t * (9 + i * 3)) * .05 + Math.sin(t * 17 + i) * .04); });
  W.rainU.time.value = t; W.rainU.k.value = W.rainK; W.rainU.flash.value = W.flash; W.rain.visible = W.rainK > .01; W.rain.geometry.setDrawRange(0, q.rain * 2);
  for (let i = 0; i < W.mist.length; i++) { const m = W.mist[i], u = m.userData; m.visible = i < q.mist; let x = u.x + t * u.sp; x = ((x + 12) % 24 + 24) % 24 - 12; m.position.set(x, u.y, u.z); m.material.opacity = .1 + W.flash * .12; }
  W.scene.fog.density = .034 + W.rainK * .004 - W.flash * .012; W.churchWin.color.setRGB(.85 * fl, .5 * fl, .22 * fl);
  if (W.grassU) W.grassU.time.value = t;
}
export function applyWorldQuality(W, q) { if (W.grass) W.grass.count = Math.min(W.grassN, q.grass); W.posts.forEach(L => L.visible = q.posts); W.pumpkinL.visible = true; }
// thousands of grass blades (instanced, wind sway in the vertex shader, lit by the lantern + moon)
export function addGrass(W, avoid) { const N = 14000; const g = new THREE.BufferGeometry(); const P = [0, 0, 0, .05, 0, 0, .008, .45, 0, .045, .45, 0, .026, 1, 0], I = [0, 1, 2, 2, 1, 3, 2, 3, 4];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); g.translate(-.025, 0, 0);
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, side: THREE.DoubleSide }); W.grassU = { time: { value: 0 } };
  m.onBeforeCompile = sh => { sh.uniforms.time = W.grassU.time; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;').replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 ip = instanceMatrix[3]; float sw = sin(time * 1.7 + ip.x * .9 + ip.z * .6) * .5 + sin(time * 3.1 + ip.x * 2.3) * .2; transformed.x += sw * .12 * position.y * position.y; transformed.z += sw * .05 * position.y;`)
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = normalize(vec3(0., .85, .5));'); };
  const im = new THREE.InstancedMesh(g, m, N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(); let k = 0, tries = 0;
  while (k < N && tries < N * 6) { tries++; const x = (hash(tries * 1.13) - .5) * 19, z = -5.5 + hash(tries * 2.71) * 11.5; if (Math.abs(x - pathX(z)) < .55 && z > -2.6) continue; if (avoid(x, z)) continue;
    const hgt = .18 + hash(tries * 3.7) * .32; q.setFromAxisAngle(v.set(0, 1, 0), hash(tries * 5.3) * 6.283); m4.compose(v.set(x, groundY(x, z) - .01, z), q, s.set(1 + hash(tries) * .6, hgt, 1)); im.setMatrixAt(k, m4);
    im.setColorAt(k++, c.setHSL(.22 + hash(tries * 7.1) * .1, .35 + hash(tries * 8.3) * .25, .1 + hash(tries * 9.7) * .1)); }
  im.count = k; W.grassN = k; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; W.scene.add(im); W.grass = im; }
