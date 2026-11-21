// Little pictures of Pet Farm pets for the rest of the site (the companion beside you in a waiting room).
// The 3D pet models are loaded only when a picture is first asked for, and each picture is drawn once and kept.
const shots = new Map(); // key -> data URL ('' while it could not be drawn)
let kit = null, R = null, S = null, C = null;
const keyOf = p => p.sp + '|' + (p.lv < 5 ? 0 : p.lv < 12 ? 1 : 2) + '|' + (p.look ? JSON.stringify(p.look) : '');
// The picture if it is already drawn, else ''.
export const petPicNow = p => (p && shots.get(keyOf(p))) || '';
export async function petPic(p, size = 128) {
  if (!p?.sp) return '';
  const k = keyOf(p); if (shots.has(k)) return shots.get(k);
  try {
    kit ||= Promise.all([import('three'), import('./games/farm/pets3d.js'), import('./games/farm/models.js'), import('./games/farm/data.js')]);
    const [THREE, { petModel }, { disposeModel }, { formOf }] = await kit;
    if (shots.has(k)) return shots.get(k);
    if (!R) {
      R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1);
      S = new THREE.Scene(); C = new THREE.PerspectiveCamera(30, 1, .1, 50);
      S.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4); S.add(l);
    }
    const g = petModel(p.sp, formOf(p.lv | 0), p.look || null);
    R.setSize(size, size, false); S.add(g);
    const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), d = box.getSize(new THREE.Vector3()).length() / 2 / Math.sin(15 * Math.PI / 180) * .78;
    C.position.set(ctr.x + d * .5, ctr.y + d * .3, ctr.z + d * .8); C.lookAt(ctr);
    R.render(S, C); const u = R.domElement.toDataURL('image/png'); S.remove(g); disposeModel(g);
    shots.set(k, u); return u;
  } catch (e) { console.warn('no pet picture', e); shots.set(k, ''); return ''; }
}
// Fill every <img data-pet='{"sp":..}'> under root with its picture once it is drawn.
export function petPics(root = document) {
  for (const im of root.querySelectorAll('img[data-pet]:not([src])')) {
    let p; try { p = JSON.parse(im.dataset.pet); } catch { continue; }
    petPic(p).then(u => { if (u) im.src = u; else im.remove(); });
  }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// An <img> for a pet; call petPics() after putting it on the page.
export const petImg = (p, size = 56, cls = 'petpal') => { const u = petPicNow(p);
  return p?.sp ? `<img class="${cls}" width="${size}" height="${size}" alt="${esc(p.name || 'Pet')}" title="${esc(p.name || 'Pet')}${p.lv ? ' · level ' + (p.lv | 0) : ''}" data-pet="${esc(JSON.stringify({ sp: p.sp, lv: p.lv | 0, look: p.look || null }))}"${u ? ` src="${u}"` : ''}>` : ''; };
