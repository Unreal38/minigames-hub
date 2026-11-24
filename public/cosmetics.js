// Account cosmetics, shared by the server (what may be bought and worn) and the client (how it looks).
// Unlike avatar items these belong to the account, not the avatar: a name colour, a frame round your picture,
// a title, an effect when you win, sticker packs, and (see THEMES) looks for cards, dice, golf balls and karts.
//
// Each kind has a two-letter key and a list; entry 0 is the free default. What a player has on is stored on the
// profile as cos = { nm: 3, fr: 1, ... } and bought entries as ids like 'nm:3' in owned (next to avatar items).
// Only append to these lists: saved choices are indexes.
//   p: price in coins            s: seasonal drop (see SEASONS in avatar.js)
//   earn: unlocked by playing instead of bought: { g: game id, w: wins there } or { w: wins overall } or { n: games played } or { d: days in a row solving the Mystery Pet }
//         or { lv: account level } or { any: wins in any one game }
//   pk: part of a thank-you pack (PACK in avatar.js): not for sale, handed out with the pack, e.g. 'kofi' for Ko-fi supporters
//         or { top: best place ever held in the overall ranking } or { sp: pet species in the Pet Farm album }
import { seasonOn, SEASONS } from './avatar.js';
import { levelOf } from './ranks.js';
import { L, PL } from './i18n.js';

export const COS = {
  nm: { label: 'Name colour', items: [{ n: 'Plain' }, { n: 'Sunset', p: 120 }, { n: 'Ocean', p: 120 }, { n: 'Mint', p: 100 }, { n: 'Candy', p: 150 },
    { n: 'Gold', p: 220 }, { n: 'Fire', p: 220 }, { n: 'Rainbow', p: 300 }, { n: 'Sparkle', p: 260 }, { n: 'Frost', p: 160, s: 'winter' }, { n: 'Spooky', p: 160, s: 'halloween' }, { n: 'Latte', pk: 'kofi' },
    { n: 'Blossom', p: 160, s: 'spring' }, { n: 'Tropical', p: 160, s: 'summer' }, { n: 'Thunder', p: 180 }, { n: 'Pebble', p: 120 }] },
  fr: { label: 'Profile frame', items: [{ n: 'None' }, { n: 'Cloud', p: 120 }, { n: 'Vine', p: 120 }, { n: 'Hearts', p: 140 }, { n: 'Stars', p: 180 },
    { n: 'Gold', p: 250 }, { n: 'Flame', p: 220 }, { n: 'Rainbow', p: 280 }, { n: 'Snow', p: 160, s: 'winter' }, { n: 'Coffee ring', pk: 'kofi' },
    { n: 'Blossom', p: 160, s: 'spring' }, { n: 'Seashells', p: 160, s: 'summer' }, { n: 'Pumpkins', p: 160, s: 'halloween' }, { n: 'Lightning', p: 200 }, { n: 'Pebbles', p: 140 }] },
  // Card backgrounds: what sits behind your name wherever your card shows (waiting rooms, your profile card, the wardrobe plate, the account menu).
  // The art is CSS and SVG (style.css .pbN, public/cardbg/). t: 'p' pattern, 's' game scene, 'a' animated, 'e' earned. d: dark art, so the text on it turns light.
  pb: { label: 'Card background', items: [{ n: 'None' },
    { n: 'Paw prints', p: 80, t: 'p' }, { n: 'Checkers', p: 80, t: 'p' }, { n: 'Stars', p: 90, t: 'p' }, { n: 'Hearts', p: 90, t: 'p' }, { n: 'Confetti', p: 100, t: 'p' },
    { n: 'Hot Pot table', p: 200, t: 's' }, { n: 'Beanstalk sky', p: 200, t: 's' }, { n: 'Pet Farm meadow', p: 200, t: 's' }, { n: 'Kart island', p: 220, t: 's' }, { n: 'Card table', p: 220, t: 's' },
    { n: 'Drifting clouds', p: 350, t: 'a' }, { n: 'Falling petals', p: 350, t: 'a' }, { n: 'Twinkling night', p: 400, t: 'a', d: 1 },
    { n: 'Podium', t: 'e', earn: { top: 3 } }, { n: 'Golden champion', t: 'e', a: 1, earn: { top: 1 } }, { n: 'Egg nest', t: 'e', earn: { sp: 10 } }, { n: 'Pet parade', t: 'e', earn: { sp: 30 } }, { n: 'Café', t: 'p', pk: 'kofi' },
    { n: 'Leaf sprouts', p: 100, t: 'p' }, { n: 'Ember flames', p: 100, t: 'p' }, { n: 'Tide waves', p: 100, t: 'p' }, { n: 'Spark bolts', p: 100, t: 'p' }, { n: 'Stone pebbles', p: 100, t: 'p' }, // the Pet Farm's elements
    { n: 'Bubble lagoon', p: 200, t: 's' }, { n: 'Dartboard', p: 200, t: 's' }, { n: 'Dice table', p: 200, t: 's' }, { n: 'Mini golf green', p: 220, t: 's' },
    { n: 'Beach', p: 220, t: 's', s: 'summer' }, { n: 'Pumpkin patch', p: 220, t: 's', d: 1, s: 'halloween' }, { n: 'Snowy night', p: 350, t: 'a', d: 1, s: 'winter' }, { n: 'Thunderstorm', p: 400, t: 'a', d: 1 }] },
  ti: { label: 'Title', items: [{ n: 'None' },
    { n: 'Pot Wizard', earn: { g: 'hotpot', w: 5 } }, { n: 'Card Shark', earn: { g: 'poker', w: 5 } }, { n: 'Kart Menace', earn: { g: 'kart', w: 5 } },
    { n: 'Marble Whisperer', earn: { g: 'marbles', w: 5 } }, { n: 'Ladder Legend', earn: { g: 'ladders', w: 5 } }, { n: 'Ludo Lord', earn: { g: 'ludo', w: 5 } },
    { n: 'Tower Titan', earn: { g: 'stack', w: 5 } }, { n: 'Hole in One', earn: { g: 'golf', w: 5 } }, { n: 'Smooth Liar', earn: { g: 'dice', w: 5 } },
    { n: 'Top Dog', earn: { g: 'paw', w: 5 } }, { n: 'Head Chef', earn: { g: 'kitchen', w: 5 } }, { n: 'Treasure Hunter', earn: { g: 'dig', w: 5 } },
    { n: 'Regular', earn: { n: 25 } }, { n: 'Champion', earn: { w: 50 } },
    { n: 'Snack Lord', p: 100 }, { n: 'Lucky Duck', p: 100 }, { n: 'Just Vibing', p: 80 }, { n: 'Sore Loser', p: 80 }, { n: 'Bot Bully', p: 120 },
    { n: 'Certified Goblin', p: 150 }, { n: 'Big Spender', p: 400 },
    { n: 'Trick Taker', earn: { g: 'tys', w: 5 } }, { n: 'Brick Boss', earn: { g: 'bricks', w: 5 } }, { n: 'Bean Bouncer', earn: { g: 'bean', w: 5 } }, { n: 'Pet Detective', earn: { d: 7 } }, { n: 'Party Roller', earn: { g: 'pips', w: 5 } }, { n: 'Bullseye', earn: { g: 'darts', w: 5 } }, { n: 'Coffee’s on me', pk: 'kofi' }, { n: 'Three in a Row', earn: { g: 'ttt', w: 5 } }, { n: 'Double Six', earn: { g: 'domino', w: 5 } }, { n: 'Parade Leader', earn: { g: 'parade', w: 5 } }, { n: 'Coconut Captain', earn: { g: 'cove', w: 5 } }, { n: 'Eagle Eye', earn: { g: 'bingo', w: 5 } },
    { n: 'Bubble Buster', earn: { g: 'lagoon', w: 5 } }, { n: 'Nine of Hearts', earn: { g: 'pan', w: 5 } }, { n: 'Pair Master', earn: { g: 'piotr', w: 5 } }, { n: 'Pet Collector', earn: { sp: 20 } }, { n: 'Makao Master', earn: { g: 'makao', w: 5 } }, { n: 'Quick Sketch', earn: { g: 'kal', w: 5 } }] },
  wn: { label: 'Win effect', items: [{ n: 'None' }, { n: 'Confetti', p: 150 }, { n: 'Hearts', p: 150 }, { n: 'Fish rain', p: 200 }, { n: 'Fireworks', p: 250 },
    { n: 'Coin shower', p: 300 }, { n: 'Snowfall', p: 180, s: 'winter' }, { n: 'Coffee break', pk: 'kofi' },
    { n: 'Blossoms', p: 180, s: 'spring' }, { n: 'Bubbles', p: 180, s: 'summer' }, { n: 'Bats', p: 180, s: 'halloween' }, { n: 'Paw prints', p: 160 }] },
  sp: { label: 'Sticker packs', multi: true, items: [{ n: 'Basics', e: [] }, { n: 'Party', p: 100, e: ['🎉', '🥳', '💃', '🪩', '🍾', '👑'] },
    { n: 'Critters', p: 100, e: ['🐸', '🦆', '🐱', '🐶', '🦖', '🐢'] }, { n: 'Chaos', p: 120, e: ['💀', '🤡', '👀', '🫠', '🙈', '🧠'] }, { n: 'Café', pk: 'kofi', e: ['☕', '🥐', '🍩', '🧋', '🍪', '🫶'] },
    { n: 'Grumpy', p: 120, e: ['😤', '😠', '😡', '💢', '😾', '🙄'] }, { n: 'Drama', earn: { n: 50 }, e: ['🥺', '😩', '😱', '🤯', '💔', '🧂'] },
    { n: 'Love', p: 100, e: ['🥰', '😍', '🤗', '😘', '💖', '🌸'] }, { n: 'Hype', p: 120, e: ['😎', '✨', '💪', '🏆', '⚡', '🚀'] },
    { n: 'Sleepy', p: 100, e: ['😴', '🥱', '💤', '🌙', '🛌', '🧸'] }, { n: 'Hmm', p: 100, e: ['🤔', '🧐', '🤨', '😏', '🤫', '🫣'] },
    { n: 'Winter', p: 100, s: 'winter', e: ['⛄', '🎄', '🎁', '🧣', '🦌', '🔔'] }] },
  // Table themes: how your own things look in the games (public/skins.js paints them). Everyone at the table sees them.
  cb: { label: 'Card back', where: 'Your cards in Texas Hold’em, Tysiąc, Pan and Piotruś, and the deck you see in Hot Pot.', items: [{ n: 'Classic' }, { n: 'Sky', p: 100 }, { n: 'Midnight', p: 120 }, { n: 'Candy', p: 120 }, { n: 'Koi', p: 180 }, { n: 'Gold leaf', p: 250 }, { n: 'Coffee beans', pk: 'kofi' },
    { n: 'Leaf', p: 150 }, { n: 'Ember', p: 150 }, { n: 'Tide', p: 150 }, { n: 'Spark', p: 150 }, { n: 'Stone', p: 150 }] }, // the Pet Farm's five elements
  // Dice skins: shape, face art and pips for each are in public/dice3d.js (SKINS, same order).
  dc: { label: 'Dice', where: 'Your dice in Liar’s Dice, Pip Party, Ludo, Snakes & Ladders and Pawperty.', items: [{ n: 'Classic' }, { n: 'Ruby gem', p: 100 }, { n: 'Carved jade', p: 100 }, { n: 'Bubblegum', p: 100 }, { n: 'Starry midnight', p: 120 }, { n: 'Solid gold', p: 250 },
    { n: 'Oak wood', p: 120 }, { n: 'Ice crystal', p: 220 }, { n: 'Paw prints', p: 150 }, { n: 'Lava rock', p: 200 }, { n: 'Snowball', p: 160, s: 'winter' }, { n: 'Choc-chip cookie', p: 140 }, { n: 'Mossy stone', p: 150 }, { n: 'Pixel', p: 120 }, { n: 'Sugar cube', pk: 'kofi' }] },
  gb: { label: 'Golf ball', where: 'Your ball in Mini Golf Party.', items: [{ n: 'Classic' }, { n: '8-ball', p: 100 }, { n: 'Watermelon', p: 120 }, { n: 'Planet', p: 150 }, { n: 'Eyeball', p: 150 }, { n: 'Gold', p: 250 }, { n: 'Latte art', pk: 'kofi' }, { n: 'Bubble', p: 150 }, { n: 'Fireball', p: 150 }, { n: 'Beach ball', p: 120, s: 'summer' }] },
  kp: { label: 'Kart paint', where: 'Your kart in Kart Island Race.', items: [{ n: 'Classic' }, { n: 'Racing stripes', p: 120 }, { n: 'Checkers', p: 120 }, { n: 'Flames', p: 150 }, { n: 'Galaxy', p: 200 }, { n: 'Gold', p: 300 }, { n: 'Mocha', pk: 'kofi' }, { n: 'Lightning', p: 180 }, { n: 'Ocean waves', p: 150 }, { n: 'Candy stripes', p: 150 }] },
  // The profile isle: the floating island your avatar and pets stand on, on the hub and in your profile card (public/isle3d.js builds them).
  // Decor is not sold here: it is up to DECOR_SLOTS of the decorations on the player's own Pet Farm, kept as cos.ip = ['windmill', 'pond'].
  // Grounds are the Pet Farm's islands (same names and colours as its world map), plus two that are earned. Indexes are saved: append only.
  ig: { label: 'Ground', where: 'Make your isle look like one of the Pet Farm islands. Everyone sees it on your profile card, and your Pet Farm island wears it too.', items: [{ n: 'Meadow' }, { n: 'Weather Peak', p: 220 }, { n: 'Pebble Ridge', p: 150 }, { n: 'Fruit Grove', p: 180 },
    { n: 'Veggie Patch', p: 180 }, { n: 'Mossy Woods', p: 120 }, { n: 'Tidepool Cove', p: 150 }, { n: 'Sweet Shop Isle', p: 200 }, { n: 'Ember Hills', p: 180 },
    { n: 'Golden isle', earn: { lv: 20 } }, { n: 'Champion’s isle', earn: { any: 50 } }, { n: 'Bakery Bluff', p: 200 }, { n: 'Coral Reef', p: 200 }, { n: 'Starfall Isle', p: 220 }, { n: 'Thunder Meadow', p: 220 }] },
  ib: { label: 'Rock base', where: 'What hangs under your isle and your Pet Farm island.', items: [{ n: 'Classic' }, { n: 'Crystal cluster', p: 200 }, { n: 'Floating chunks', p: 150 }, { n: 'Waterfall', p: 250 }, { n: 'Hanging roots', p: 150 }] },
  ik: { label: 'Sky', where: 'The sky behind your isle and your Pet Farm island.', items: [{ n: 'Clear' }, { n: 'Sunset', p: 120 }, { n: 'Starry night', p: 150 }, { n: 'Aurora', p: 220 }, { n: 'Rainbow', p: 150 }] },
};
export const COS_KEYS = Object.keys(COS);
// Kinds where one entry is worn at a time (sticker packs are simply all usable once bought).
export const WORN = COS_KEYS.filter(k => !COS[k].multi);
export const DECOR_SLOTS = 3;
// The game pieces that float round a player's isle. Free: cos.fp lists the ones picked, in order (none saved = the classic set, an empty list = none).
export const PIECES = { marble: 'Marble', die: 'Die', pawn: 'Ludo pawn', card: 'Card', chip: 'Poker chip', golf: 'Golf ball', block: 'Tower blocks', tyre: 'Kart tyre', coin: 'Coin', star: 'Star', bean: 'Magic bean', pot: 'Hot pot', paw: 'Paw print', dart: 'Dart', bubble: 'Bubble', egg: 'Pet egg' };
export const PIECE_SLOTS = 6, PIECE_DEFAULT = ['marble', 'die', 'pawn', 'card', 'chip', 'golf'];
export const piecesOf = me => !Array.isArray(me?.cos?.fp) ? PIECE_DEFAULT : me.cos.fp.filter((t, n, a) => Object.hasOwn(PIECES, t) && a.indexOf(t) === n).slice(0, PIECE_SLOTS);
export const decorOf = me => (Array.isArray(me?.cos?.ip) ? me.cos.ip : []).filter((t, n, a) => typeof t === 'string' && /^[a-z]{2,16}$/.test(t) && a.indexOf(t) === n).slice(0, DECOR_SLOTS);
const GAME_NAMES = { hotpot: 'Hot Pot', poker: 'Texas Hold’em', kart: 'Kart Island Race', marbles: 'Marble Rush', ladders: 'Snakes & Ladders', ludo: 'Ludo', stack: 'Tower Stack',
  golf: 'Mini Golf Party', dice: 'Liar’s Dice', paw: 'Pawperty', kitchen: 'Cozy Kitchen Rush', dig: 'Treasure Dig', tys: 'Tysiąc', bricks: 'Sky Bricks', lagoon: 'Bubble Lagoon', bean: 'Beanstalk Bounce', pips: 'Pip Party', darts: 'Sky Darts', piotr: 'Piotruś', ttt: 'Tic-Tac-Toe', bj: 'Blackjack', domino: 'Dominoes', parade: 'Pet Parade', cove: 'Cove Clash', pool: 'Sky Pool', bingo: 'Sky Bingo', pan: 'Pan', makao: 'Makao', kal: 'Sketch & Guess' };

if (PL) { Object.assign(GAME_NAMES, { hotpot: 'Gorący kociołek', kart: 'Wyspiarskie gokarty', marbles: 'Wyścig kulek', ladders: 'Węże i drabiny', ludo: 'Chińczyk', stack: 'Chwiejna wieża',
  golf: 'Imprezowy minigolf', dice: 'Kości kłamcy', paw: 'Łapolis', kitchen: 'Gorączka w kuchni', dig: 'Poszukiwacze skarbów', bricks: 'Podniebne klocki', lagoon: 'Bąbelkowa laguna', bean: 'Fasolowe skoki', pips: 'Oczkomania', darts: 'Podniebne rzutki', ttt: 'Kółko i krzyżyk', domino: 'Domino', parade: 'Parada Zwierzaków', cove: 'Bitwa w zatoce', pool: 'Podniebny bilard', bingo: 'Podniebne bingo', kal: 'Kalambury' }); (await import('./lang/items-pl.js')).plCosmetics(COS, PIECES); }

export const cosItem = (k, i) => COS[k]?.items[i] || null;
export const cosPackIds = name => COS_KEYS.flatMap(k => COS[k].items.map((it, i) => it.pk === name ? k + ':' + i : null).filter(Boolean));
export const cosPrice = (k, i) => cosItem(k, i)?.p || 0;
export const cosOnSale = (k, i, now) => seasonOn(cosItem(k, i)?.s, now);
export const cosSeason = (k, i) => SEASONS[cosItem(k, i)?.s] || null;
// How far along an earned entry is: [have, need, what]. me is a profile or the client's own "me".
export function earnProgress(it, me) {
  const e = it?.earn; if (!e) return null;
  if (e.top) return [me?.bestPos >= 1 && me.bestPos <= e.top ? 1 : 0, 1, e.top === 1 ? L('reach 1st place in the overall ranking', 'zajmij 1. miejsce w rankingu ogólnym') : L(`reach the top ${e.top} of the overall ranking`, `wejdź do pierwszej ${e.top} rankingu ogólnego`)];
  if (e.sp) return [Math.min(e.sp, me?.petSp | 0), e.sp, L(`${e.sp} pet species in your Pet Farm album`, `${e.sp} gatunków zwierzaków w albumie Farmy zwierzaków`)];
  if (e.d) return [Math.min(e.d, me?.daily?.best || 0), e.d, L(`${e.d} Mystery Pets solved in a row`, `Zagadkowy zwierzak odgadnięty ${e.d} dni z rzędu`)];
  if (e.lv) return [Math.min(e.lv, levelOf(me?.xp || 0)), e.lv, L(`reach level ${e.lv}`, `osiągnij poziom ${e.lv}`)];
  if (e.any) return [Math.min(e.any, Math.max(0, ...Object.values(me?.byGame || {}).map(g => g?.wins || 0))), e.any, L(`${e.any} wins in any one game`, `${e.any} wygranych w jednej dowolnej grze`)];
  if (e.g) return [Math.min(e.w, me?.byGame?.[e.g]?.wins || 0), e.w, L(`${e.w} wins in ${GAME_NAMES[e.g] || e.g}`, `${e.w} wygranych w grze ${GAME_NAMES[e.g] || e.g}`)];
  if (e.w) return [Math.min(e.w, me?.wins || 0), e.w, L(`${e.w} wins in any games`, `${e.w} wygranych w dowolnych grach`)];
  return [Math.min(e.n, me?.games || 0), e.n, L(`${e.n} games played`, `${e.n} rozegranych gier`)];
}
// May this player wear (or use) entry i of kind k?
export function cosHas(me, k, i) {
  const it = cosItem(k, i); if (!it) return false;
  if (i === 0) return true;
  if (it.earn) { const [a, b] = earnProgress(it, me); return a >= b; }
  return !!me?.owned?.includes(k + ':' + i);
}
// What others see: only what is worn and really unlocked, with zeros left out. { nm, fr, ti, wn, ... }
export function flairOf(me) {
  const out = {}, cos = me?.cos || {};
  for (const k of WORN) { const i = cos[k] | 0; if (i > 0 && cosHas(me, k, i)) out[k] = i; }
  if (Array.isArray(cos.fp)) out.fp = piecesOf(me);
  const ip = decorOf(me); if (ip.length) out.ip = ip; // the server drops any the farm no longer has (store.flair)
  return out;
}

// ---------- stickers ----------
// Reactions 0..11 are the free ones (react.js). From 12 on come the sticker packs, six per pack, in pack order.
export const STICKER_BASE = 12;
export const STICKERS = COS.sp.items.flatMap((p, pi) => p.e.map(e => ({ e, pack: pi })));
export const stickerPack = k => STICKERS[k - STICKER_BASE]?.pack ?? -1;
export const stickersOf = me => STICKERS.map((s, j) => ({ ...s, k: STICKER_BASE + j })).filter(s => cosHas(me, 'sp', s.pack));

// ---------- how it looks (browser) ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idx = (fl, k) => { const i = fl?.[k] | 0; return i > 0 && cosItem(k, i) ? i : 0; };
// A player's name in their name colour. Safe to put straight into HTML.
export const nameHtml = (name, fl) => { const i = idx(fl, 'nm'); return i ? `<span class="nmfx nm${i}">${esc(name)}</span>` : esc(name); };
export const titleOf = fl => { const i = idx(fl, 'ti'); return i ? COS.ti.items[i].n : ''; };
export const titleHtml = fl => { const t = titleOf(fl); return t ? `<span class="ttl">${esc(t)}</span>` : ''; };
// The class to give avatarHtml() so the picture gets the player's frame.
// The picture behind a player's card. Put cardBgCls(fl) on the card and cardBg(fl) inside it as the first child.
export const cardBg = fl => { const i = idx(fl, 'pb'); return i ? `<i class="pbg pb${i}" aria-hidden="true"></i>` : ''; };
// light = 1 in game panels that keep their own text colours: the art is only washed in the panel's colour, never flips the text.
export const cardBgCls = (fl, light) => { const i = idx(fl, 'pb'); return i ? ` haspb${COS.pb.items[i].d && !light ? ' pbd' : ''}` : ''; };
// Card art redrawn by a re-render would restart its animation; this starts new pictures in step with the page clock.
export const pbSync = el => { if (!el) return; const t = `${(-performance.now() / 1000).toFixed(2)}s`; for (const b of el.querySelectorAll('.pbg:not([style])')) b.style.setProperty('--pbt', t); };
export const frameCls = fl => { const i = idx(fl, 'fr'); return i ? `frm fr${i}` : ''; };
