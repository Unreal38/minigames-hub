// Small pictures of single wardrobe items: your own avatar wearing the item, framed on the part of the body it
// belongs to (a hat shows the head, shoes show the feet, things for the back are seen from behind).
// Drawn with one hidden renderer and cached as data URLs, like the round portraits.
import * as THREE from 'three';
import { avatar3d, disposeAvatar } from './avatar3d.js';
import { cleanAv, AV_KEYS } from './avatar.js';

const SIZE = 132, cache = new Map();
let rd = null, dead = false;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 40);
scene.add(new THREE.HemisphereLight('#ffffff', '#d8c8c0', 1.7));
{ const d = new THREE.DirectionalLight('#fff4dd', 1.9); d.position.set(2.5, 5, 6); scene.add(d); }

// Which framing each slot gets.
const VIEW = { hat: 'hat', hair: 'hat', hairC: 'hat', neck: 'bust', top: 'torso', color: 'torso', body: 'full', height: 'full',
  bottom: 'legs', botC: 'legs', shoes: 'feet', shoeC: 'feet', back: 'back' }; // everything else: the face
const IX = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));

// A data URL of the avatar wearing entry i of slot k ('' if 3D is not available). k 'color' takes a hex in i.
export function itemPic(k, i, color, av) {
  const a = cleanAv(av); let c = color;
  if (k === 'color') c = i; else if (k in IX) a[IX[k]] = i;
  // a hood or a hat would hide the hair being picked, and a costume hood would hide the hat
  if (k === 'hair' || k === 'hairC') a[IX.hat] = 0;
  if (k === 'eyes' || k === 'eyeC' || k === 'brows') a[IX.glasses] = 0; // glasses would cover them
  const view = VIEW[k] || 'face', key = view + c + a.join('.');
  if (cache.has(key)) return cache.get(key);
  if (dead) return '';
  try {
    if (!rd) { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setSize(SIZE, SIZE, false); }
    const g = avatar3d(c, a, { pose: 'stand' }), u = g.userData, H = u.headH, Y = u.headY, foot = -.76;
    g.rotation.y = view === 'back' ? Math.PI - .5 : -.3; scene.add(g);
    const at = (y, d, up = 0) => { cam.position.set(0, y + up, d); cam.lookAt(0, y, 0); };
    if (view === 'face') at(Y - H * .02, H * 3.3, H * .1);
    else if (view === 'hat') at(Y + H * .32, H * 5.2, H * .2);
    else if (view === 'bust') at(Y - H * .5, H * 3.9, H * .1);
    else if (view === 'torso') at((Y - H * .5 + foot) / 2 + .12, 5.6);
    else if (view === 'legs') at(foot + .62, 4.3, .2);
    else if (view === 'feet') at(foot + .2, 3.7, .6);
    else if (view === 'back') at((Y + foot) / 2 + .1, 6.6, .4);
    else at((Y + H * .5 + foot) / 2, 9.2, .3);
    rd.render(scene, cam);
    const url = rd.domElement.toDataURL('image/png');
    scene.remove(g); disposeAvatar(g);
    if (cache.size > 600) cache.clear();
    cache.set(key, url); return url;
  } catch (e) { dead = true; return ''; }
}
