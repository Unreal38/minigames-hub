// Avatar options shared by the server (validation), the creator, the 3D model and the little round pictures.
//
// An avatar is a list of 22 numbers, one per entry of AV_KEYS, each an index into the list of the same name in OPT.
// The player's own colour is the top colour, so it is not stored here.
// Only append to these lists: saved avatars store indexes.
//
// Avatars saved before the chibi rework were 8 numbers [skin, hair, hair colour, extra, eyes, mouth, outfit, detail].
// cleanAv() converts those on the fly, so old saves and old browsers keep their look.
import { PL } from './i18n.js';

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
  back: ['None'], // things worn on the back: all from the shop. Added later, so avatars saved with 21 numbers get 0 here.
};

// ---------- the coin shop ----------
// Everything above is free forever. Items added here cost coins (the account currency earned by playing) and are
// appended after the free ones, so saved avatars keep their indexes. PRICE['hat:14'] = 120; no entry means free.
// A third entry makes an item seasonal: SEASON['hat:37'] = 'winter'. It is only sold while that season's drop is on
// (see SEASONS); whoever bought it keeps it and can wear it all year.
export const PRICE = {}, SEASON = {};
const shop = (k, items) => { for (const [v, price, season] of items) { OPT[k].push(v); const id = k + ':' + (OPT[k].length - 1); PRICE[id] = price; if (season) SEASON[id] = season; } };
shop('hat', [['Top hat', 120], ['Party hat', 60], ['Pirate hat', 150], ['Viking helmet', 180], ['Halo', 250], ['Propeller cap', 140],
  ['Frog hat', 160], ['Santa hat', 90], ['Wizard hat', 160], ['Flower crown', 110], ['Devil horns', 120], ['Antennae', 80],
  ['Cowboy hat', 150], ['Mushroom cap', 140], ['Unicorn horn', 220]]);
shop('glasses', [['Star glasses', 90], ['Heart glasses', 90], ['Monocle', 110], ['Eye patch', 70], ['Goggles', 120]]);
shop('neck', [['Gold medal', 150], ['Hero cape', 200], ['Flower lei', 100], ['Bell collar', 70], ['Pearls', 120], ['Bandana', 70]]);
shop('top', [['Flower shirt', 110], ['Tuxedo', 180], ['Hero suit', 200], ['Knight armour', 220], ['Space suit', 200]]);
shop('eyes', [['Spiral', 80], ['Closed X', 60], ['Starry', 90]]);
shop('marks', [['Star sticker', 50], ['Heart cheeks', 60], ['Bandage', 50], ['Whiskers', 70]]);
shop('mouth', [['Fangs', 60], ['Tongue out', 50], ['Wavy', 40]]);
shop('shoes', [['Rain boots', 80], ['Roller skates', 140]]);
shop('hairC', [['#9ff0d0', 60], ['#c9b3ff', 60], ['#ffd700', 80], ['#2bb5a8', 60], ['#c2185b', 60], ['#bcd6f0', 70]]);
shop('eyeC', [['#e33b3b', 50], ['#ff9ad5', 50], ['#20c4c4', 50], ['#ffd23f', 60]]);
shop('botC', [['#ff8fab', 30], ['#ffc94d', 30], ['#111111', 30]]);
shop('shoeC', [['#ff8fab', 30], ['#7ed3b2', 30], ['#a070f0', 30]]);

// The fun wardrobe: silly hats, whole costumes (a costume is a top that also dresses the legs and, with no hat on,
// pulls its hood up), things for your back, and four seasonal drops.
shop('hat', [['Traffic cone', 130], ['Frog bucket hat', 150], ['Giant headphones', 140], ['Astronaut helmet', 200], ['Knight helmet', 190],
  ['Rubber duck', 170], ['Cheese wedge', 120], ['Pumpkin head', 160, 'halloween'], ['Reindeer antlers', 110, 'winter'], ['Earmuffs', 90, 'winter'],
  ['Pineapple hat', 140, 'summer'], ['Tulip hat', 120, 'spring']]);
shop('glasses', [['3D glasses', 80], ['Clown nose', 70], ['Snorkel mask', 110, 'summer']]);
shop('neck', [['Candy scarf', 100, 'winter']]);
shop('top', [['Dino onesie', 260], ['Banana suit', 240], ['Ghost sheet', 220, 'halloween'], ['Bee costume', 220, 'spring'], ['Ugly sweater', 130, 'winter'],
  ['Bear hoodie', 170], ['Skeleton suit', 200, 'halloween'], ['Duck floatie', 150, 'summer']]);
shop('back', [['Backpack', 90], ['Angel wings', 220], ['Fairy wings', 180], ['Jetpack', 240], ['Turtle shell', 150], ['Balloon', 100],
  ['Bat wings', 160, 'halloween'], ['Gift sack', 120, 'winter'], ['Surfboard', 150, 'summer'], ['Butterfly wings', 170, 'spring']]);

// Thank-you packs: items nobody can buy with coins. PACK['hat:41'] = 'kofi'. They are handed out whole by the server
// (store.grantPack) and, like paid items, can only be worn once they are in the player's owned list.
// The Supporter pack is one item per Wardrobe slot for people who chipped in on Ko-fi.
export const PACK = {};
const pack = (name, items) => { for (const [k, v] of items) { OPT[k].push(v); PACK[k + ':' + (OPT[k].length - 1)] = name; } };
pack('kofi', [['hat', 'Coffee mug hat'], ['glasses', 'Café glasses'], ['neck', 'Coffee bean necklace'], ['top', 'Barista sweater'], ['bottom', 'Cuffed trousers'], ['shoes', 'Cocoa slippers'], ['back', 'Takeaway cup']]);
// Filling the gaps (2026-11-24, after the pack so its indexes stay): the first bottoms and more shoes for sale, and four hats after the Pet Farm's elements
// (a Leaf sprout, an Ember candle like Flickit's, a Tide wave like Ripplet's, a Spark storm cloud).
shop('bottom', [['Cargo trousers', 90], ['Tutu', 110], ['Plaid kilt', 120], ['Swim shorts', 80, 'summer']]);
shop('shoes', [['Paw slippers', 110], ['Light-up sneakers', 120], ['Flippers', 90, 'summer'], ['Ice skates', 130, 'winter']]);
shop('hat', [['Sprout', 120], ['Candle flame', 140], ['Wave curl', 140], ['Storm cloud', 160]]);

export const packOf = (k, i) => PACK[k + ':' + i] || null;
export const packIds = name => Object.keys(PACK).filter(id => PACK[id] === name);
// Does this item have to be in the owned list before it can be worn (bought, or part of a pack)?
const locks = id => PRICE[id] || PACK[id];
export const needsOwning = (k, i) => !!locks(k + ':' + i);

// Seasonal drops: [first month, day, last month, day], both ends included. Winter runs over the new year.
export const SEASONS = {
  winter: { name: 'Winter drop', span: [11, 15, 2, 28], ends: 'the end of February', back: 'mid-November' },
  spring: { name: 'Spring drop', span: [3, 1, 5, 31], ends: 'the end of May', back: 'March' },
  summer: { name: 'Summer drop', span: [6, 1, 8, 31], ends: 'the end of August', back: 'June' },
  halloween: { name: 'Halloween drop', span: [10, 1, 11, 7], ends: '7 November', back: 'October' },
};
export const seasonOn = (name, now = new Date()) => {
  const s = SEASONS[name]; if (!s) return true;
  const [m0, d0, m1, d1] = s.span, at = (now.getMonth() + 1) * 100 + now.getDate(), a = m0 * 100 + d0, b = m1 * 100 + d1;
  return a <= b ? at >= a && at <= b : at >= a || at <= b;
};
// Which season is on at `now`, with its first and last day (local dates at noon). Between drops it says which one comes next:
// { key, start, end } while one runs, { key: null, start: <day after the last one>, end: <day before the next>, next } in a gap.
export function seasonNow(now = new Date()) {
  const day = (y, m, d) => new Date(y, m - 1, d, 12), y = now.getFullYear(), runs = [];
  for (const [key, { span: [m0, d0, m1, d1] }] of Object.entries(SEASONS))
    for (const yy of [y - 1, y, y + 1]) runs.push({ key, start: day(yy, m0, d0), end: day(m0 * 100 + d0 <= m1 * 100 + d1 ? yy : yy + 1, m1, d1) });
  runs.sort((a, b) => a.start - b.start);
  const t = day(y, now.getMonth() + 1, now.getDate()), on = runs.find(r => r.start <= t && t <= r.end);
  if (on) return on;
  const next = runs.find(r => r.start > t), prev = runs.filter(r => r.end < t).pop();
  const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  return { key: null, start: plus(prev.end, 1), end: plus(next.start, -1), next };
}
export const seasonOf = (k, i) => SEASON[k + ':' + i] || null;
// Can this item be bought right now? (Anything not seasonal always can.)
export const onSale = (k, i, now) => seasonOn(SEASON[k + ':' + i], now);

export const priceOf = (k, i) => PRICE[k + ':' + i] || 0;
// Takes off anything paid that is not in owned (a list like ['hat:14']), so nobody wears what they have not bought.
export const wearable = (a, owned = []) => { const have = new Set(owned); return cleanAv(a).map((v, i) => locks(AV_KEYS[i] + ':' + v) && !have.has(AV_KEYS[i] + ':' + v) ? 0 : v); };
export const lockedIn = (a, owned = []) => { const have = new Set(owned); return cleanAv(a).map((v, i) => AV_KEYS[i] + ':' + v).filter(id => locks(id) && !have.has(id)); };

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
  ['Extras', [['hat', 'Hat'], ['glasses', 'Glasses'], ['neck', 'Neck'], ['back', 'Back']]],
];

// In Polish the names above are swapped for the Polish ones (browser only: the server always keeps English).
if (PL) (await import('./lang/items-pl.js')).plAvatar(OPT, AV_TABS, SEASONS);

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

// Lists from before a slot was added are shorter (21 numbers before 'back'): the missing slots are 0.
export const cleanAv = a => Array.isArray(a) && a.length >= 21 && a.length <= AV_KEYS.length ? AV_MAX.map((m, i) => int(a[i] ?? 0, m)) : fromOld(a);

export const randomAv = () => {
  const o = AV_KEYS.map(k => { let v; do v = Math.random() * OPT[k].length | 0; while (locks(k + ':' + v)); return v; }), r = (k, p) => { if (Math.random() < p) o[IX[k]] = 0; };
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
