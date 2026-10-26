// The churchyard layout, shared by the rules (hiding spots) and the 3D world (props). Units ≈ metres; the camera looks towards −z.
// Every hiding spot sits just BEHIND a prop as seen from the camera, so a hidden ghost is covered until it peeks or the lantern finds it.
export const OAK = { x: -4.7, z: -3.4 };          // the dead oak: the lightning always strikes here
export const CRYPT = { x: 3.9, z: -3.7, w: 2.7, d: 2.2, h: 2.3 };
export const STONES = [ // [x, z, rotY, kind (0 round slab, 1 cross, 2 obelisk, 3 pointed slab), scale, tilt]
  [-2.5, -1.3, .12, 0, 1.05, .06], [-.65, -1.15, -.08, 1, 1.1, -.04], [1.25, -1.35, .18, 3, 1.0, .1],
  [-3.55, .75, -.2, 3, .95, -.08], [-1.5, .9, .05, 0, 1.0, .12], [.6, .7, -.15, 2, 1.1, 0], [2.6, .85, .22, 0, .95, -.1],
  [-1.85, -2.85, .1, 1, 1.15, .05], [.25, -3.0, -.12, 0, 1.15, -.07], [1.95, -2.75, .25, 3, 1.05, .08] ];
export const PUMPKINS = [[-3.6, 2.35, .62], [-2.6, 2.95, .5], [-1.75, 2.3, .58], [-3.25, 3.45, .45], [-2.05, 3.55, .52], [-1.0, 3.1, .44], [-4.3, 3.0, .4]]; // real pumpkins [x, z, size]
// empty places in the patch where a pumpkin MIMIC can sit – it looks exactly like the real ones until it gives itself away
export const PMIMIC = [[-3.05, 2.55], [-2.2, 2.6], [-1.3, 2.65], [-2.75, 3.6], [-1.55, 3.6], [-3.9, 2.85]];
export const HAY = { x: 3.25, z: 2.35 }; export const BARRELS = { x: 5.55, z: .2 }; export const WELL = { x: 4.9, z: -1.25 };
export const POSTS = [[-5.9, 1.2], [6.2, -2.4]]; // lantern posts (warm point lights)
// hiding spots for sheet ghosts and shades (behind props); pumpkin mimics use the pumpkin positions
export const SPOTS = [
  ...STONES.map(([x, z]) => ({ x, z: z - .5, k: 'stone' })),
  { x: OAK.x + .55, z: OAK.z - .55, k: 'oak' }, { x: OAK.x - .65, z: OAK.z - .4, k: 'oak' },
  { x: CRYPT.x - .2, z: CRYPT.z + CRYPT.d / 2 + .15, k: 'door' }, { x: CRYPT.x + CRYPT.w / 2 + .45, z: CRYPT.z - .3, k: 'crypt' }, { x: CRYPT.x - CRYPT.w / 2 - .45, z: CRYPT.z - .5, k: 'crypt' },
  { x: HAY.x, z: HAY.z - .7, k: 'hay' }, { x: BARRELS.x, z: BARRELS.z - .7, k: 'barrel' }, { x: WELL.x - .1, z: WELL.z - .85, k: 'well' } ];
export const PSPOTS = PMIMIC.map(([x, z]) => ({ x, z, s: .5, k: 'pumpkin' }));
export const YARD = { x0: -6.6, x1: 6.8, z0: -5.2, z1: 4.0 }; // where the beam may go
