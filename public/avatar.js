// Avatar options shared by the server (validation), the creator, the 3D model and the little round pictures.
//
// An avatar is a list of 21 numbers, one per entry of AV_KEYS, each an index into the list of the same name in OPT.
// The player's own colour is the top colour, so it is not stored here.
// Only append to these lists: saved avatars store indexes.
//
// Avatars saved before the chibi rework were 8 numbers [skin, hair, hair colour, extra, eyes, mouth, outfit, detail].
// cleanAv() converts those on the fly, so old saves and old browsers keep their look.
export const SKINS = ['#ffe3c8', '#f6c9a0', '#dba577', '#a9714a', '#7d4f30', '#5a3a22', '#c68863', '#3f281a'];
export const HAIR_COLS = ['#3b2219', '#7a4a2b', '#e8b84a', '#d9534a', '#f1ede6', '#6fb7e8', '#ff8fab', '#9b6fd6', '#5cb85c', '#ff8c42', '#8a8f98', '#1c1412'];
export const EYE_COLS = ['#6b4326', '#2a1d17', '#8a6a2c', '#4f8a4a', '#3f7fc4', '#7d8b96', '#c08a2a', '#8a5cc4'];
export const BOTTOM_COLS = ['#3d5a80', '#2f3640', '#c9b48a', '#6b4f3a', '#f1ede6', '#2d6a4f', '#8a2f3f', '#7b6fd6'];
export const SHOE_COLS = ['#f4f4f4', '#2b2b2b', '#8a5a3c', '#d9584e', '#3f7fc4', '#ffc94d'];

export const OPT = {
  body: ['Slim', 'Average', 'Athletic', 'Broad', 'Curvy', 'Sturdy'],
  height: ['Short', 'Medium', 'Tall'],
  skin: SKINS,
  face: ['Round', 'Oval', 'Square', 'Heart', 'Long'],
  eyes: ['Round', 'Almond', 'Narrow', 'Wide', 'Sleepy', 'Sparkle', 'Droopy', 'Dot', 'Happy', 'Cat', 'Lashes', 'Wink', 'Hearts'],
  eyeC: EYE_COLS,
  brows: ['Straight', 'Arched', 'Thick', 'Thin', 'Angled', 'Soft', 'None'],
  nose: ['Button', 'Pointed', 'Wide', 'Long', 'Snub'],
  mouth: ['Smile', 'Grin', 'Flat', 'Open', 'Smirk', 'Pout', 'Cat'],
  marks: ['None', 'Freckles', 'Blush', 'Mole'],
  hair: ['Bun', 'Short', 'Pigtails', 'Spiky', 'Long', 'Bald', 'Bob', 'Ponytail', 'Curly', 'Mohawk', 'Buzz', 'Side part', 'Quiff', 'Afro', 'Braids', 'Wavy'],
  hairC: HAIR_COLS,
  facial: ['None', 'Stubble', 'Mustache', 'Goatee', 'Full beard', 'Chin strap', 'Handlebar'],
  top: ['T-shirt', 'Hoodie', 'Jacket', 'Sweater', 'Striped tee', 'Tank top', 'Dress', 'Apron', 'Overalls', 'Suit', 'Sailor top', 'Cardigan', 'Turtleneck', 'Polo', 'Varsity jacket', 'Kimono', 'Puffer vest', 'Jersey'],
  bottom: ['Trousers', 'Jeans', 'Shorts', 'Skirt', 'Joggers', 'Pleated skirt', 'Long skirt', 'Leggings', 'Wide trousers'],
  botC: BOTTOM_COLS,
  shoes: ['Sneakers', 'Boots', 'Sandals', 'High tops', 'Loafers', 'Bunny slippers'],
  shoeC: SHOE_COLS,
  hat: ['None', 'Beanie', 'Cap', 'Chef hat', 'Crown', 'Cat ears', 'Headphones', 'Flower', 'Bow', 'Bucket hat', 'Beret', 'Straw hat', 'Bunny ears', 'Witch hat'],
  glasses: ['None', 'Glasses', 'Round glasses', 'Sunglasses'],
  neck: ['None', 'Scarf', 'Bow tie', 'Necklace', 'Tie'],
};
export const AV_KEYS = Object.keys(OPT);
export const AV_COLOR_KEYS = ['skin', 'eyeC', 'hairC', 'botC', 'shoeC'];
export const AV_MAX = AV_KEYS.map(k => OPT[k].length - 1);
const IX = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));
const DEFAULTS = { body: 1, height: 1 }; // everything else starts at 0

// The creator's tabs: [title, [[key, label], ...]]. 'color' is the player's colour, shown as the top colour.
export const AV_TABS = [
  ['Body', [['body', 'Build'], ['height', 'Height'], ['skin', 'Skin']]],
  ['Face', [['face', 'Face shape'], ['eyes', 'Eyes'], ['eyeC', 'Eye colour'], ['brows', 'Brows'], ['nose', 'Nose'], ['mouth', 'Mouth'], ['marks', 'Face marks']]],
  ['Hair', [['hair', 'Hair style'], ['hairC', 'Hair colour'], ['facial', 'Facial hair']]],
  ['Outfit', [['top', 'Top'], ['color', 'Top colour'], ['bottom', 'Bottom'], ['botC', 'Bottom colour'], ['shoes', 'Shoes'], ['shoeC', 'Shoe colour']]],
  ['Extras', [['hat', 'Hat'], ['glasses', 'Glasses'], ['neck', 'Neck']]],
];

const int = (v, max) => { v = +v; return Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0; };

// Old 8-number avatars -> the new list.
const OLD_MAX = [5, 9, 9, 8, 4, 4, 4, 3];
function fromOld(a) {
  const [sk, hair, hc, acc, ey, mo, fit, det] = OLD_MAX.map((m, i) => int(Array.isArray(a) ? a[i] : 0, m));
  const o = AV_KEYS.map(k => DEFAULTS[k] || 0), set = (k, v) => { o[IX[k]] = v; };
  set('skin', sk); set('hair', hair); set('hairC', hc);
  set('hat', [0, 3, 0, 8, 5, 4, 7, 6, 0][acc]); set('glasses', acc === 2 ? 1 : acc === 8 ? 3 : 0);
  set('eyes', [0, 8, 4, 5, 11][ey]);       // Round, Happy, Sleepy, Sparkle, Wink
  set('mouth', [0, 3, 6, 5, 1][mo]);       // Smile, Open, Cat, Tiny -> Pout, Tongue -> Grin
  set('top', [0, 7, 0, 4, 0][fit]); set('neck', fit === 2 ? 1 : fit === 4 ? 2 : 0); // Plain, Apron, Scarf, Stripes, Bow tie
  if (det === 1) set('marks', 1); if (det === 2) set('facial', 2); if (det === 3) set('facial', 4);
  return o;
}

export const cleanAv = a => Array.isArray(a) && a.length === AV_KEYS.length ? AV_MAX.map((m, i) => int(a[i], m)) : fromOld(a);

export const randomAv = () => {
  const o = AV_MAX.map(m => Math.random() * (m + 1) | 0), r = (k, p) => { if (Math.random() < p) o[IX[k]] = 0; };
  r('facial', .6); r('hat', .6); r('glasses', .65); r('neck', .65); r('marks', .6);
  if (Math.random() < .7) o[IX.hairC] = [0, 1, 2, 3, 10, 11][Math.random() * 6 | 0];
  return o;
};

// Avatar as a plain object { body, height, skin, ... } of indexes.
export const avObj = a => Object.fromEntries(cleanAv(a).map((v, i) => [AV_KEYS[i], v]));

const safeCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ff8fab';

// The round pictures in lists are snapshots of the 3D head. portraits.js plugs its renderer in here once three.js
// has loaded; until then (or without WebGL) a simple flat head stands in.
let portraitOf = null;
export const setPortraitSource = fn => { portraitOf = fn; };
const flatHead = (c, a) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M10 104c0-22 18-31 40-31s40 9 40 31z" fill="${c}"/><circle cx="50" cy="46" r="29" fill="${SKINS[a.skin]}"/>${a.hair === 5 ? '' : `<path d="M20 46c0-24 14-33 30-33s30 9 30 33c-9-10-19-14-30-14s-21 4-30 14z" fill="${HAIR_COLS[a.hairC]}"/>`}<circle cx="39" cy="52" r="4.5" fill="#2a1712"/><circle cx="61" cy="52" r="4.5" fill="#2a1712"/><path d="M45 62q5 5 10 0" fill="none" stroke="#2a1712" stroke-width="2.4" stroke-linecap="round"/></svg>`;

export function avatarHtml(color, av, size = 52, cls = '') {
  const c = safeCol(color), a = cleanAv(av);
  let url = ''; try { url = portraitOf ? portraitOf(c, a) : ''; } catch { url = ''; }
  return url
    ? `<span class="avatar ${cls}" style="--c:${c};--s:${size}px;background-image:url(${url})"></span>`
    : `<span class="avatar ${cls}" style="--c:${c};--s:${size}px">${flatHead(c, avObj(a))}</span>`;
}
