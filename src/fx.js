// GPU spark points (additive, soft) + smoke puffs
import * as THREE from 'three';
const MAXP = 2600;
let rs = 12345; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; }; export function seedFX(v) { rs = (v >>> 0) % 2147483646 + 1; }
export function createFX(scene, soft, smokeTex) {
  const F = { scene };
  const geo = new THREE.BufferGeometry();
  F.pos = new Float32Array(MAXP * 3); F.col = new Float32Array(MAXP * 3); F.size = new Float32Array(MAXP); F.alpha = new Float32Array(MAXP);
  F.vel = new Float32Array(MAXP * 3); F.life = new Float32Array(MAXP); F.max = new Float32Array(MAXP); F.grav = new Float32Array(MAXP); F.s0 = new Float32Array(MAXP); F.n = 0; F.cursor = 0; F.floor = -.4;
  geo.setAttribute('position', new THREE.BufferAttribute(F.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(F.col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(F.size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(F.alpha, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: soft }, scale: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); vA = alpha * smoothstep(.35, 1.1, -mv.z); gl_PointSize = min(size * scale / -mv.z, 40.); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }` });
  F.points = new THREE.Points(geo, mat); F.points.frustumCulled = false; scene.add(F.points); F.geo = geo; F.mat = mat;
  F.puffs = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: '#8a7a9a', transparent: true, opacity: 0, depthWrite: false })); s.visible = false; scene.add(s); F.puffs.push({ s, life: 0, max: 1, v: new THREE.Vector3(), g: 1 }); }
  return F;
}
export function sparks(F, at, n, opt = {}) {
  const c = new THREE.Color(); const cols = (opt.colors || ['#ffffff']).map(x => new THREE.Color(x));
  for (let k = 0; k < n; k++) {
    const i = F.cursor; F.cursor = (F.cursor + 1) % MAXP; F.n = Math.max(F.n, F.cursor === 0 ? MAXP : F.cursor);
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), sp = (opt.speed || 3) * (.35 + rnd() * .8);
    F.pos[i * 3] = at.x; F.pos[i * 3 + 1] = at.y; F.pos[i * 3 + 2] = at.z;
    F.vel[i * 3] = Math.cos(a) * s * sp + (opt.vx || 0); F.vel[i * 3 + 1] = u * sp + (opt.up || 0); F.vel[i * 3 + 2] = Math.sin(a) * s * sp + (opt.vz || 0);
    c.copy(cols[k % cols.length]); F.col[i * 3] = c.r; F.col[i * 3 + 1] = c.g; F.col[i * 3 + 2] = c.b;
    F.max[i] = F.life[i] = (opt.life || 1) * (.6 + rnd() * .8); F.grav[i] = opt.grav ?? 3; F.s0[i] = (opt.size || .12) * (.5 + rnd());
  }
}
export function puff(F, at, n, color, big = 1) {
  let k = 0; for (const p of F.puffs) { if (p.life > 0) continue; if (k++ >= n) break;
    p.life = p.max = 1 + rnd() * .7; p.s.visible = true; p.s.material.color.set(color || '#8a7a9a'); p.s.position.copy(at).add(new THREE.Vector3((rnd() - .5) * .8, rnd() * .4, (rnd() - .5) * .8));
    p.v.set((rnd() - .5) * 1.6, .6 + rnd(), (rnd() - .5) * 1.6); p.g = big * (1 + rnd()); p.s.material.rotation = rnd() * 6; }
}
export function updateFX(F, dt, scale) {
  F.mat.uniforms.scale.value = scale;
  for (let i = 0; i < F.n; i++) {
    if (F.life[i] <= 0) { F.alpha[i] = 0; continue; }
    F.life[i] -= dt; const k = Math.max(0, F.life[i] / F.max[i]);
    F.vel[i * 3 + 1] -= F.grav[i] * dt; F.vel[i * 3] *= (1 - dt * 1.2); F.vel[i * 3 + 2] *= (1 - dt * 1.2);
    F.pos[i * 3] += F.vel[i * 3] * dt; F.pos[i * 3 + 1] += F.vel[i * 3 + 1] * dt; F.pos[i * 3 + 2] += F.vel[i * 3 + 2] * dt;
    if (F.pos[i * 3 + 1] < F.floor) { F.pos[i * 3 + 1] = F.floor; F.vel[i * 3 + 1] *= -.3; }
    F.alpha[i] = Math.min(1, k * 2.5); F.size[i] = F.s0[i] * (.4 + k * .6);
  }
  F.geo.attributes.position.needsUpdate = true; F.geo.attributes.color.needsUpdate = true; F.geo.attributes.size.needsUpdate = true; F.geo.attributes.alpha.needsUpdate = true;
  for (const p of F.puffs) { if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max; p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.2);
    p.s.scale.setScalar(p.g * (.6 + k * 2.2)); p.s.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.3)) * .5; if (p.life <= 0) p.s.visible = false; }
}
