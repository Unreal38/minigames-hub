// Small pictures of single wardrobe items: your own avatar wearing the item, framed on the part of the body it
// belongs to (a hat shows the head, shoes show the feet, things for the back are seen from behind).
// Drawn with one hidden renderer and cached as data URLs, like the round portraits.
import * as THREE from 'three';
import { avatar3d, disposeAvatar, hidesBottom } from './avatar3d.js';
import { cleanAv, AV_KEYS } from './avatar.js';

const SIZE = 132, cache = new Map();
let rd = null, dead = false;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, .1, 40);
scene.add(new THREE.HemisphereLight('#ffffff', '#d8c8c0', 1.7));
{ const d = new THREE.DirectionalLight('#fff4dd', 1.9); d.position.set(2.5, 5, 6); scene.add(d); }

// Which framing each slot gets.
const VIEW = { hat: 'hat', hair: 'hat', hairC: 'hat', neck: 'bust', top: 'torso', color: 'torso', body: 'full', height: 'full',
  bottom: 'legs', botC: 'legs', shoes: 'feet', shoeC: 'feet', back: 'back', hand: 'hand' }; // everything else: the face
const IX = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));

// A data URL of the avatar wearing entry i of slot k ('' if 3D is not available). k 'color' takes a hex in i.
export function itemPic(k, i, color, av) {
  const a = cleanAv(av); let c = color;
  if (k === 'color') c = i; else if (k in IX) a[IX[k]] = i;
  // a hood or a hat would hide the hair being picked, and a costume hood would hide the hat
  if (k === 'hair' || k === 'hairC') a[IX.hat] = 0;
  if (k === 'eyes' || k === 'eyeC' || k === 'brows') a[IX.glasses] = 0; // glasses would cover them
  // the dino onesie's full head (no hat on) would hide the face and hair being picked: show them under a plain T-shirt
  if (a[IX.top] === 23 && a[IX.hat] === 0 && ['face', 'skin', 'eyes', 'eyeC', 'brows', 'nose', 'mouth', 'marks', 'hair', 'hairC', 'facial', 'glasses'].includes(k)) a[IX.top] = 0;
  // a dress or a costume would hide the bottom being picked: show it under a plain T-shirt
  if ((k === 'bottom' || k === 'botC') && hidesBottom(a[IX.top])) a[IX.top] = 0;
  if (k === 'shoes' || k === 'shoeC') { if (a[IX.top] === 15 || a[IX.top] === 32) a[IX.top] = 0; if (a[IX.bottom] === 6) a[IX.bottom] = 0; } // a kimono or long skirt hides the shoes
  if (k === 'neck') { if (a[IX.facial] === 4) a[IX.facial] = 0; if (a[IX.top] === 25) a[IX.top] = 0; } // a full beard or the ghost sheet hides it
  if (k === 'back' && (a[IX.hair] === 4 || a[IX.hair] === 15)) a[IX.hair] = 6; // long hair hides it, so a bob of the same colour
  const view = VIEW[k] || 'face', key = view + c + a.join('.');
  if (cache.has(key)) return cache.get(key);
  if (dead) return '';
  try {
    if (!rd) { const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setSize(SIZE, SIZE, false); }
    const g = avatar3d(c, a, { pose: 'stand' }), u = g.userData, H = u.headH, Y = u.headY;
    g.rotation.y = view === 'back' ? Math.PI - .5 : -.3; scene.add(g); g.updateWorldMatrix(true, true);
    // framed on the model's real sizes: the bottom of the shoes, the hips (top of the legs), the neck and the top of the head
    const box = new THREE.Box3().setFromObject(g), foot = box.min.y, top = box.max.y, neck = Y - H * .5;
    const lb = new THREE.Box3(); for (const l of u.legs || []) lb.expandByObject(l);
    const hip = lb.isEmpty() ? (neck + foot) / 2 : lb.max.y, legW = lb.isEmpty() ? 1 : lb.max.x - lb.min.x; // broad builds have wide legs
    // aim at y and fit a span of h (world units) into the picture, the camera raised by up
    const fit = (y, h, up = 0, x = 0) => { const d = h / 2 / Math.tan(cam.fov * Math.PI / 360); cam.position.set(x, y + up, d); cam.lookAt(x, y, 0); };
    if (view === 'face') fit(Y - H * .02, H * 1.4, H * .1);
    else if (view === 'hat') fit(Y + H * .32, H * 2.2, H * .2);
    else if (view === 'bust') fit(neck + H * .05, H * 1.55, H * .1);
    else if (view === 'torso' && hidesBottom(a[IX.top])) fit((neck + foot) / 2 + .1, (neck - foot) * 1.2, .1); // dresses and costumes go down to the feet
    else if (view === 'torso') fit((neck + hip) / 2 + H * .03, Math.max((neck - hip) * 2, legW * 1.6), .1);
    else if (view === 'legs') fit((hip + foot) / 2 - .1, Math.max((hip - foot) * 2.05, legW * 1.35), .2);
    else if (view === 'hand' && u.arms?.[1]) { // the holding arm and whatever is in it (the arm and the item are one piece)
      const hb = new THREE.Box3().setFromObject(u.arms[1]), c = hb.getCenter(new THREE.Vector3()), sz = hb.getSize(new THREE.Vector3());
      fit(c.y, Math.max(sz.y * 1.2, sz.x * 1.5, H * 1.1), .1, c.x * .7); }
    else if (view === 'feet') fit(foot + .4, Math.max(1.75, legW * 1.6), .3);
    else fit((top + foot) / 2, (top - foot) * 1.04, .3); // the whole avatar, also for things on the back
    rd.render(scene, cam);
    const url = rd.domElement.toDataURL('image/png');
    scene.remove(g); disposeAvatar(g);
    if (cache.size > 600) cache.clear();
    cache.set(key, url); return url;
  } catch (e) { dead = true; return ''; }
}
