// Account cosmetics, shared by the server (what may be bought and worn) and the client (how it looks).
// Unlike avatar items these belong to the account, not the avatar: a name colour, a frame round your picture,
// a title, an effect when you win, sticker packs, and (see THEMES) looks for cards, dice, golf balls and karts.
//
// Each kind has a two-letter key and a list; entry 0 is the free default. What a player has on is stored on the
// profile as cos = { nm: 3, fr: 1, ... } and bought entries as ids like 'nm:3' in owned (next to avatar items).
// Only append to these lists: saved choices are indexes.
//   p: price in coins            s: seasonal drop (see SEASONS in avatar.js)
//   earn: unlocked by playing instead of bought: { g: game id, w: wins there } or { w: wins overall } or { n: games played }
import { seasonOn, SEASONS } from './avatar.js';

export const COS = {
  nm: { label: 'Name colour', items: [{ n: 'Plain' }, { n: 'Sunset', p: 120 }, { n: 'Ocean', p: 120 }, { n: 'Mint', p: 100 }, { n: 'Candy', p: 150 },
    { n: 'Gold', p: 220 }, { n: 'Fire', p: 220 }, { n: 'Rainbow', p: 300 }, { n: 'Sparkle', p: 260 }, { n: 'Frost', p: 160, s: 'winter' }, { n: 'Spooky', p: 160, s: 'halloween' }] },
  fr: { label: 'Profile frame', items: [{ n: 'None' }, { n: 'Cloud', p: 120 }, { n: 'Vine', p: 120 }, { n: 'Hearts', p: 140 }, { n: 'Stars', p: 180 },
    { n: 'Gold', p: 250 }, { n: 'Flame', p: 220 }, { n: 'Rainbow', p: 280 }, { n: 'Snow', p: 160, s: 'winter' }] },
  ti: { label: 'Title', items: [{ n: 'None' },
    { n: 'Pot Wizard', earn: { g: 'hotpot', w: 5 } }, { n: 'Card Shark', earn: { g: 'poker', w: 5 } }, { n: 'Kart Menace', earn: { g: 'kart', w: 5 } },
    { n: 'Marble Whisperer', earn: { g: 'marbles', w: 5 } }, { n: 'Ladder Legend', earn: { g: 'ladders', w: 5 } }, { n: 'Ludo Lord', earn: { g: 'ludo', w: 5 } },
    { n: 'Tower Titan', earn: { g: 'stack', w: 5 } }, { n: 'Hole in One', earn: { g: 'golf', w: 5 } }, { n: 'Smooth Liar', earn: { g: 'dice', w: 5 } },
    { n: 'Top Dog', earn: { g: 'paw', w: 5 } }, { n: 'Head Chef', earn: { g: 'kitchen', w: 5 } }, { n: 'Treasure Hunter', earn: { g: 'dig', w: 5 } },
    { n: 'Regular', earn: { n: 25 } }, { n: 'Champion', earn: { w: 50 } },
    { n: 'Snack Lord', p: 100 }, { n: 'Lucky Duck', p: 100 }, { n: 'Just Vibing', p: 80 }, { n: 'Sore Loser', p: 80 }, { n: 'Bot Bully', p: 120 },
    { n: 'Certified Goblin', p: 150 }, { n: 'Big Spender', p: 400 },
    { n: 'Trick Taker', earn: { g: 'tys', w: 5 } }, { n: 'Brick Boss', earn: { g: 'bricks', w: 5 } }, { n: 'Bean Bouncer', earn: { g: 'bean', w: 5 } }] },
  wn: { label: 'Win effect', items: [{ n: 'None' }, { n: 'Confetti', p: 150 }, { n: 'Hearts', p: 150 }, { n: 'Fish rain', p: 200 }, { n: 'Fireworks', p: 250 },
    { n: 'Coin shower', p: 300 }, { n: 'Snowfall', p: 180, s: 'winter' }] },
  sp: { label: 'Sticker packs', multi: true, items: [{ n: 'Basics', e: [] }, { n: 'Party', p: 100, e: ['🎉', '🥳', '💃', '🪩', '🍾', '👑'] },
    { n: 'Critters', p: 100, e: ['🐸', '🦆', '🐱', '🐶', '🦖', '🐢'] }, { n: 'Chaos', p: 120, e: ['💀', '🤡', '👀', '🫠', '🙈', '🧠'] }] },
  // Table themes: how your own things look in the games (public/skins.js paints them). Everyone at the table sees them.
  cb: { label: 'Card back', where: 'Your cards in Texas Hold’em and the deck you see in Hot Pot.', items: [{ n: 'Classic' }, { n: 'Sky', p: 100 }, { n: 'Midnight', p: 120 }, { n: 'Candy', p: 120 }, { n: 'Koi', p: 180 }, { n: 'Gold leaf', p: 250 }] },
  dc: { label: 'Dice', where: 'Your dice in Liar’s Dice.', items: [{ n: 'Classic' }, { n: 'Ruby', p: 100 }, { n: 'Jade', p: 100 }, { n: 'Bubblegum', p: 100 }, { n: 'Midnight', p: 120 }, { n: 'Gold', p: 250 }] },
  gb: { label: 'Golf ball', where: 'Your ball in Mini Golf Party.', items: [{ n: 'Classic' }, { n: '8-ball', p: 100 }, { n: 'Watermelon', p: 120 }, { n: 'Planet', p: 150 }, { n: 'Eyeball', p: 150 }, { n: 'Gold', p: 250 }] },
  kp: { label: 'Kart paint', where: 'Your kart in Kart Island Race.', items: [{ n: 'Classic' }, { n: 'Racing stripes', p: 120 }, { n: 'Checkers', p: 120 }, { n: 'Flames', p: 150 }, { n: 'Galaxy', p: 200 }, { n: 'Gold', p: 300 }] },
};
export const COS_KEYS = Object.keys(COS);
// Kinds where one entry is worn at a time (sticker packs are simply all usable once bought).
export const WORN = COS_KEYS.filter(k => !COS[k].multi);
const GAME_NAMES = { hotpot: 'Hot Pot', poker: 'Texas Hold’em', kart: 'Kart Island Race', marbles: 'Marble Rush', ladders: 'Snakes & Ladders', ludo: 'Ludo', stack: 'Tower Stack',
  golf: 'Mini Golf Party', dice: 'Liar’s Dice', paw: 'Pawperty', kitchen: 'Cozy Kitchen Rush', dig: 'Treasure Dig', tys: 'Tysiąc', bricks: 'Sky Bricks', bean: 'Beanstalk Bounce' };

export const cosItem = (k, i) => COS[k]?.items[i] || null;
export const cosPrice = (k, i) => cosItem(k, i)?.p || 0;
export const cosOnSale = (k, i, now) => seasonOn(cosItem(k, i)?.s, now);
export const cosSeason = (k, i) => SEASONS[cosItem(k, i)?.s] || null;
// How far along an earned entry is: [have, need, what]. me is a profile or the client's own "me".
export function earnProgress(it, me) {
  const e = it?.earn; if (!e) return null;
  if (e.g) return [Math.min(e.w, me?.byGame?.[e.g]?.wins || 0), e.w, `${e.w} wins in ${GAME_NAMES[e.g] || e.g}`];
  if (e.w) return [Math.min(e.w, me?.wins || 0), e.w, `${e.w} wins in any games`];
  return [Math.min(e.n, me?.games || 0), e.n, `${e.n} games played`];
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
export const frameCls = fl => { const i = idx(fl, 'fr'); return i ? `frm fr${i}` : ''; };
