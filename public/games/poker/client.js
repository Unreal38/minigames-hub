// Texas Hold'em game view: HUD over the 3D table. Renders what the server says and sends your bets.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, PL, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { score, handName, bestFive, catOf, HAND_ORDER, RANK_NAMES } from './rules.js';
import { cardHtml } from './cards.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  chip: '<svg class="chipi" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#7ed3b2" stroke="#3b2219" stroke-width="2.4"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff4e2" stroke-width="2.2" stroke-dasharray="3 2.4"/></svg>',
};
const STREET = { drop: L('Throw one away', 'Odrzuć jedną kartę'), pre: 'Pre-flop', flop: L('The flop', 'Flop'), turn: L('The turn', 'Turn'), river: L('The river', 'River'), show: L('Showdown', 'Wyłożenie kart'), deal: L('Shuffling up', 'Tasowanie'), end: L('Game over', 'Koniec gry') };
// Example hands for the rankings panel: [cards, how many of them make the hand] (the rest are dimmed kickers)
const EX = [['Ah Kh Qh Jh Th', 5], ['9s 8s 7s 6s 5s', 5], ['Qc Qd Qh Qs 7d', 4], ['Kh Kd Ks 4c 4h', 5], ['Ad Jd 8d 6d 2d', 5],
  ['Tc 9d 8h 7s 6c', 5], ['7h 7c 7d Ks 2h', 3], ['Jc Jh 5d 5s Ah', 4], ['Ts Th 9c 4d 2s', 2], ['As Jd 8c 5h 3s', 1]]
  .map(([t, n]) => [t.split(' ').map(x => '23456789TJQKA'.indexOf(x[0]) + 13 * 'hdcs'.indexOf(x[1])), n]);
const RANKS_KEY = 'ct_pk_ranks';
// The server names hands and actions in English; these put them into Polish.
const PL_GEN = ['dwójki', 'trójki', 'czwórki', 'piątki', 'szóstki', 'siódemki', 'ósemki', 'dziewiątki', 'dziesiątki', 'waleta', 'damy', 'króla', 'asa'];
const PL_NOM = ['dwójka', 'trójka', 'czwórka', 'piątka', 'szóstka', 'siódemka', 'ósemka', 'dziewiątka', 'dziesiątka', 'walet', 'dama', 'król', 'as'];
const PL_MANY = ['dwójki', 'trójki', 'czwórki', 'piątki', 'szóstki', 'siódemki', 'ósemki', 'dziewiątki', 'dziesiątki', 'walety', 'damy', 'króle', 'asy'];
const PL_OF = ['dwójek', 'trójek', 'czwórek', 'piątek', 'szóstek', 'siódemek', 'ósemek', 'dziewiątek', 'dziesiątek', 'waletów', 'dam', 'króli', 'asów'];
const PL_ON = ['dwójkach', 'trójkach', 'czwórkach', 'piątkach', 'szóstkach', 'siódemkach', 'ósemkach', 'dziewiątkach', 'dziesiątkach', 'waletach', 'damach', 'królach', 'asach'];
const rk = w => RANK_NAMES.findIndex(n => n === w || n + (n === 'Six' ? 'es' : 's') === w);
const HAND_PL = [
  [/^Royal flush$/, () => 'Poker królewski'], [/^Straight flush to the (\w+)$/, a => `Poker do ${PL_GEN[a]}`], [/^Four (\w+)$/, a => `Kareta ${PL_OF[a]}`],
  [/^Full house, (\w+) over (\w+)$/, (a, b) => `Ful, ${PL_MANY[a]} na ${PL_ON[b]}`], [/^Flush, (\w+) high$/, a => `Kolor do ${PL_GEN[a]}`], [/^Straight to the (\w+)$/, a => `Strit do ${PL_GEN[a]}`],
  [/^Three (\w+)$/, a => `Trójka ${PL_OF[a]}`], [/^Two pair, (\w+) and (\w+)$/, (a, b) => `Dwie pary: ${PL_MANY[a]} i ${PL_MANY[b]}`], [/^Pair of (\w+)$/, a => `Para ${PL_OF[a]}`], [/^(\w+) high$/, a => `Wysoka karta: ${PL_NOM[a]}`]];
const hn = s => { if (!PL || !s) return s; for (const [re, f] of HAND_PL) { const m = re.exec(s); if (m) { const a = rk(m[1] || ''), b = rk(m[2] || ''); return (m[1] && a < 0) || (m[2] && b < 0) ? s : f(a, b); } } return s; };
const SAY_PL = { 'Small blind': 'Mała ciemna', 'Big blind': 'Duża ciemna', Fold: 'Pas', Check: 'Czekam', 'All in': 'All in', 'All in!': 'All in!' };
const sayPl = s => (!PL || !s ? s : SAY_PL[s] || s.replace(/^Call (\d+)$/, 'Sprawdzam $1').replace(/^Bet (\d+)$/, 'Stawiam $1').replace(/^Raise to (\d+)$/, 'Podbijam do $1'));
const store = { get() { try { return localStorage.getItem(RANKS_KEY); } catch { return null; } }, set(v) { try { localStorage.setItem(RANKS_KEY, v); } catch {} } };
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./poker.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pk">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags"></div>
    <div class="potlbl" id="pk-pot" hidden></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pk-hand"></span><span class="chip blinds" id="pk-blinds"></span></div>
      <div class="tr"><span class="tcode" id="pk-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <aside class="ranks" id="pk-ranks" aria-label="${L(`Poker hand rankings`, `Ranking układów pokerowych`)}"></aside>
      <div class="banner" id="pk-banner" aria-live="polite"></div>
      <div class="shout" id="pk-big" aria-live="assertive"></div>
      <div class="dock" id="pk-dock">
        <div class="mine" id="pk-mine"></div>
        <div class="acts" id="pk-acts"></div>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pk'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let tagEls = [], tagKey = '', layout = null, raising = false, raiseTo = 0, endsAt = 0, lastTick = -1, myTurnSeen = false;
  let resultsTimer = 0, bigTimer = 0, flat = false;
  const saved = store.get();
  let ranksOpen = saved ? saved === '1' : innerWidth > 1100, ranksKey = '';

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    ranksKey = ''; renderRanks();
    if (S) { scene.sync(S); dockSize(); }
  }).catch(err => {
    console.warn('3D unavailable', err);
    flat = true; root.classList.add('flat'); if (S) render();
  });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));
  const inHand = p => !p.out && !p.fold && p.cards?.length;

  // ----- name tags follow the avatars -----
  function onFrame(info) {
    layout = info;
    if (!S) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w ||= el.offsetWidth || 120) / 2, x = Math.max(half + 4, Math.min(innerWidth - half - 4, t.x)); // keep tags on screen
      el.style.transform = `translate(${x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    const pot = $('pk-pot');
    if (info.pot) pot.style.transform = `translate(${info.pot.x.toFixed(1)}px, ${info.pot.y.toFixed(1)}px) translate(-50%, -140%)`;
  }
  function flatLayout() { // no 3D: put everyone round an ellipse on screen
    const n = S.seats.length, w = innerWidth, h = innerHeight - 230;
    return { tags: S.seats.map((_, i) => { const r = S.me >= 0 ? (i - S.me + n) % n : i, a = Math.PI / 2 + r * Math.PI * 2 / n; return { x: w / 2 + Math.cos(a) * w * .36, y: 90 + h / 2 + Math.sin(a) * h * .36, mine: S.me >= 0 && r === 0 }; }), pot: { x: w / 2, y: 90 + h / 2 } };
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color + p.av.join('')).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => `<div class="tag${i === S.me ? ' mine' : ''}" data-i="${i}"><div class="bub"></div><div class="plate"><span class="tav">${avatarHtml(p.color, p.av, 30)}</span><div class="tx"><b></b><span class="stk"></span></div></div><div class="shown"></div></div>`).join('');
    tagEls = [...tagsEl.children];
  }
  function paintTags() {
    const res = S.handRes;
    for (const el of tagEls) el._w = 0;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      const active = S.turn === i && S.ph === 'play';
      el.classList.toggle('active', active);
      el.classList.toggle('fold', !!p.fold && !p.out);
      el.classList.toggle('out', !!p.out);
      el.classList.toggle('won', !!res && res.pots.some(pt => pt.win.includes(i)) && S.stage === 'show');
      el.classList.toggle('hide', i === S.me);
      const pre = S.stage === 'pre' || S.stage === 'drop';
      const badge = (i === S.dealer ? '<i class="dl" title="' + L('Dealer', 'Rozdający') + '">D</i>' : '')
        + (pre && i === S.sbI && S.sbI !== S.bbI ? `<i class="dl bl" title="${L(`Small blind ${S.sb}`, `Mała ciemna ${S.sb}`)}">SB</i>` : '')
        + (pre && i === S.bbI ? `<i class="dl bl" title="${L(`Big blind ${S.bb}`, `Duża ciemna ${S.bb}`)}">BB</i>` : '');
      setHtml(el.querySelector('.tx b'), `${nameHtml(p.name, p.fl)}${p.bot && p.human ? ' <small>' + L('(away)', '(poza grą)') + '</small>' : ''}${badge}`);
      setHtml(el.querySelector('.stk'), p.out ? L('Out', 'Odpada') : `${I.chip}${p.stack}`);
      const bub = el.querySelector('.bub');
      const say = p.allin && !p.out ? 'All in!' : p.last || '';
      setHtml(bub, say ? esc(sayPl(say)) : ''); bub.className = 'bub' + (say ? ' on' : '') + (/Raise|Bet|All/.test(say) ? ' hot' : /Fold/.test(say) ? ' meh' : '');
      const showCards = S.stage === 'show' && p.cards?.length && p.cards[0] >= 0 && i !== S.me && !p.fold;
      const nm = res?.names?.[i];
      setHtml(el.querySelector('.shown'), showCards ? `<div class="mini">${p.cards.map(c => cardHtml(c, { cls: 'sm' })).join('')}</div>${nm ? `<span>${esc(hn(nm))}</span>` : ''}` : '');
    });
  }

  // ----- the dock: your cards and buttons -----
  function renderMine() {
    const my = me(), el = $('pk-mine');
    if (!my) { setHtml(el, ''); return; } // watchers get the hub's "take a seat" bar instead
    const cards = my.cards || [], all = [...cards, ...S.board];
    const picking = S.stage === 'drop' && cards.length === 3 && cards[0] >= 0;
    if (picking) { // Mango: tap the card to throw away
      setHtml(el, `<div class="hole drop">${cards.map(c => `<button type="button" class="pick" data-a="drop" data-c="${c}" aria-label="${L('Throw away this card', 'Odrzuć tę kartę')}">${cardHtml(c, { cls: 'big' })}<i>${L('Throw', 'Odrzuć')}</i></button>`).join('')}</div>
        <div class="meinfo"><span class="stack">${I.chip}<b>${my.stack}</b></span><span class="hn">${L(`Pick a card to throw away`, `Wybierz kartę do odrzucenia`)}</span></div>`);
      return;
    }
    const best = cards.length === 2 && cards[0] >= 0 ? (all.length >= 5 ? handName(score(all)) : cards[0] % 13 === cards[1] % 13 ? `Pair of ${['Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'][cards[0] % 13]}` : '') : '';
    const five = all.length >= 5 ? new Set(bestFive(all)) : new Set();
    setHtml(el, `<div class="hole${my.fold ? ' folded' : ''}">${cards.length ? cards.map((c, k) => cardHtml(c, { cls: `big${five.has(c) && S.stage === 'show' ? ' lit' : ''}`, k })).join('') : '<span class="pcard ghost big"></span><span class="pcard ghost big"></span>'}</div>
      <div class="meinfo"><span class="stack">${I.chip}<b>${my.stack}</b></span>${my.out ? `<span class="hn">${L('You\'re out. Watch the rest!', 'Odpadasz. Obejrzyj resztę!')}</span>` : my.fold ? `<span class="hn">${L('Folded', 'Pas')}</span>` : best ? `<span class="hn">${esc(hn(best))}</span>` : ''}
      ${my.bet ? `<span class="inbet">${L('In front of you:', 'Przed tobą:')} <b>${my.bet}</b></span>` : ''}</div>`);
  }

  function renderActs() {
    const el = $('pk-acts'), my = me(), o = S.opt;
    if (!my || !o || S.ph !== 'play') {
      raising = false;
      let msg = '';
      if (my && S.stage === 'drop' && !my.out) msg = my.cards?.length === 3 ? L('Thrown-away cards go face down in the middle. Three of them become the flop!', 'Odrzucone karty lądują zakryte na środku. Trzy z nich stają się flopem!') : L(`You threw one away. Waiting for ${S.drop?.need?.length || 'the others'}…`, `Karta odrzucona. Czekamy na pozostałych${S.drop?.need?.length ? ` (${S.drop.need.length})` : ''}…`);
      else if (my && S.ph === 'play' && !my.fold && !my.out && S.turn >= 0) msg = my.allin ? L('You\'re all in. Fingers crossed!', 'Grasz za wszystko. Trzymamy kciuki!') : L(`Waiting for ${nameOf(S.turn)}…`, `Czekamy na ruch: ${nameOf(S.turn)}…`);
      setHtml(el, msg ? `<p class="wait">${msg}</p>` : '');
      return;
    }
    const call = o.toCall, pot = S.pot, opening = S.cur === 0;
    const clamp = v => Math.max(o.minTo, Math.min(o.maxTo, Math.round(v)));
    if (!raiseTo || raiseTo < o.minTo || raiseTo > o.maxTo) raiseTo = o.minTo;
    const verb = opening ? L('Bet', 'Postaw') : L('Raise to', 'Podbij do');
    const presets = [['Min', o.minTo], [L('½ pot', '½ puli'), clamp(S.cur + (pot + call) / 2)], [L('Pot', 'Pula'), clamp(S.cur + pot + call)], ['All in', o.maxTo]];
    const step = Math.max(1, S.bb / 2);
    const sizer = raising ? `<div class="row2"><div class="pills">${presets.map(([l, v]) => `<button type="button" data-a="preset" data-v="${v}" aria-pressed="${raiseTo === v}">${l}</button>`).join('')}</div>
      <div class="slide"><button type="button" class="round sm" data-a="less" aria-label="${L(`Less`, `Mniej`)}">−</button>
      <input type="range" min="${o.minTo}" max="${o.maxTo}" step="${step}" value="${raiseTo}" aria-label="${L(`Raise amount`, `Wysokość podbicia`)}" data-a="slider">
      <button type="button" class="round sm" data-a="more" aria-label="${L(`More`, `Więcej`)}">+</button></div></div>` : '';
    setHtml(el, `${sizer}<div class="row1">
      <button type="button" class="btn big w" data-a="fold" ${call <= 0 ? `title="${L('Checking is free', 'Czekanie nic nie kosztuje')}"` : ''}>${L('Fold', 'Pas')}</button>
      <button type="button" class="btn big m" data-a="call">${call <= 0 ? L('Check', 'Czekaj') : call >= my.stack ? `All in ${call}` : `${L('Call', 'Sprawdź')} ${call}${my.bet > 0 ? ` <small>${L(`(to ${S.cur})`, `(do ${S.cur})`)}</small>` : ''}`}</button>
      ${o.canRaise ? `<button type="button" class="btn big${raising ? ' r' : ''}" data-a="raise" aria-expanded="${raising}">${raising ? `${raiseTo >= o.maxTo ? 'All in' : verb} ${raiseTo}` : opening ? L('Bet…', 'Postaw…') : L('Raise…', 'Podbij…')}</button>` : ''}
      </div>`);
    const sl = el.querySelector('input[type=range]'); if (sl && +sl.value !== raiseTo) sl.value = raiseTo;
  }

  // ----- hand rankings panel (left side) -----
  function myHandIdx() {
    const my = me(), cards = my?.cards || [];
    if (!my || my.fold || cards.length !== 2 || cards[0] < 0) return -1;
    const all = [...cards, ...S.board];
    if (all.length < 5) return cards[0] % 13 === cards[1] % 13 ? 8 : 9; // pre-flop: a pocket pair or high card
    const v = score(all), cat = catOf(v);
    return cat === 8 ? (Math.floor(v / 13 ** 4) % 13 === 12 ? 0 : 1) : 9 - cat;
  }
  function renderRanks() {
    const el = $('pk-ranks'), hi = S ? myHandIdx() : -1, key = ranksOpen + ':' + hi;
    if (key === ranksKey) return; ranksKey = key;
    el.classList.toggle('open', ranksOpen);
    el.innerHTML = `<button type="button" class="rhead" data-a="ranks" aria-expanded="${ranksOpen}"><span>${L(`Hand rankings`, `Ranking układów`)}</span><i aria-hidden="true">${ranksOpen ? '−' : '+'}</i></button>
      ${ranksOpen ? `<ol>${HAND_ORDER.map(([name, how], i) => `<li class="${i === hi ? 'now' : ''}" title="${esc(how)}"><div class="rn"><em>${i + 1}</em><b>${esc(name)}</b>${i === hi ? '<span class="you">' + L('You', 'Ty') + '</span>' : ''}</div>
        <div class="rc">${EX[i][0].map((c, k) => cardHtml(c, { cls: `xs${k >= EX[i][1] ? ' dim' : ''}` })).join('')}</div></li>`).join('')}</ol>` : ''}`;
    scene?.setInset?.(ranksOpen && innerWidth > 1100 ? el.offsetWidth + 14 : 0);
  }

  function dockSize() {
    const d = $('pk-dock'); if (!d || !scene) return;
    const sizer = d.querySelector('.row2'); // opening the raise slider shouldn't make the table jump
    scene.setHud(Math.max(150, d.offsetHeight - (sizer ? sizer.offsetHeight + 10 : 0) + 24));
  }

  function renderTop() {
    $('pk-hand').textContent = (S.variant === 'mango' ? 'Mango · ' : '') + (S.hands ? L(`Hand ${Math.max(1, S.hand)} of ${S.hands}`, `Rozdanie ${Math.max(1, S.hand)} z ${S.hands}`) : L(`Hand ${Math.max(1, S.hand)} · last one standing`, `Rozdanie ${Math.max(1, S.hand)} · do ostatniego gracza`));
    const left = S.levelHands - ((Math.max(1, S.hand) - 1) % S.levelHands) - 1;
    $('pk-blinds').innerHTML = `${L('Blinds', 'Ciemne')} ${S.sb}/${S.bb}${S.next && S.next[1] !== S.bb && (!S.hands || S.hand + left < S.hands) ? `<small> · ${L(`up ${left ? `in ${left}` : 'next hand'}`, `rosną ${left ? `za ${left}` : 'w następnym rozdaniu'}`)}</small>` : ''}`;
    $('pk-code').textContent = Rm?.code || '';
    const pot = $('pk-pot');
    pot.hidden = !S.pot || S.ph !== 'play';
    setHtml(pot, `${L('Pot', 'Pula')} <b>${S.pot}</b>`);
  }

  function renderBanner() {
    const el = $('pk-banner'); let msg = '';
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${youOr(S.win)} win${S.win === S.me ? '' : 's'} the game!`, S.win === S.me ? 'Wygrywasz grę!' : `Grę wygrywa ${nameOf(S.win)}!`) : L('Game over', 'Koniec gry');
    else if (S.stage === 'deal') msg = L('Shuffling up and dealing…', 'Tasowanie i rozdawanie…');
    else if (S.stage === 'drop') msg = L('Everyone throws one card away', 'Każdy odrzuca jedną kartę') + (S.left ? ` · ${secs}s` : '');
    else if (S.stage === 'show' && S.handRes) {
      const p = S.handRes.pots[0], w = p.win;
      msg = w.length > 1 ? `${L('Split pot', 'Podział puli')}: ${w.map(youOr).join(' & ')}` : L(`${youOr(w[0])} win${w[0] === S.me ? '' : 's'} ${S.handRes.pots.reduce((a, x) => a + x.amt, 0)}${p.name ? ` with ${p.name.replace(/^./, c => c.toLowerCase())}` : ''}`, `${w[0] === S.me ? 'Wygrywasz' : nameOf(w[0]) + ' wygrywa'} ${S.handRes.pots.reduce((a, x) => a + x.amt, 0)}${p.name ? `: ${hn(p.name).replace(/^./, c => c.toLowerCase())}` : ''}`);
    } else if (S.turn >= 0) msg = S.turn === S.me ? `${L('Your turn', 'Twoja kolej')}${S.left ? ` · ${secs}s` : ''}` : `${STREET[S.stage]} · ${L(`${nameOf(S.turn)} is thinking`, `${nameOf(S.turn)} myśli`)}${S.left ? ` · ${secs}s` : ''}`;
    else msg = STREET[S.stage] || '';
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.turn === S.me && S.ph === 'play');
    // the active tag's timer ring
    const t = tagEls[S.turn];
    if (t && S.left) t.style.setProperty('--p', Math.max(0, Math.min(1, (endsAt - performance.now()) / (S.timer * 1000))).toFixed(3));
    else if (t) t.style.setProperty('--p', 1);
  }

  function render() {
    if (!S) return;
    buildTags(); renderTop(); paintTags(); renderMine(); renderRanks(); renderActs(); renderBanner();
    if (flat) onFrame(flatLayout());
    requestAnimationFrame(dockSize);
  }

  function big(text, sub = '', ms = 1600) {
    const el = $('pk-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ----- events -> sound & effects -----
  function playEv(e) {
    if (e.t === 'hand') { sfx.draw(); hideResults(); }
    else if (e.t === 'drop') { if (me()?.cards?.length === 3) { sfx.turn(); big(L('Throw one away', 'Odrzuć jedną kartę'), L('Three of the thrown-away cards make the flop', 'Trzy z odrzuconych kart utworzą flop'), 1800); } }
    else if (e.t === 'dropped') { sfx.place(); scene?.nod(e.s); }
    else if (e.t === 'act') {
      if (e.a === 'fold') sfx.draw();
      else if (e.a === 'check') sfx.tick();
      else if (e.a === 'allin') { sfx.place(); sfx.set(); scene?.hop(e.s); if (e.s !== S.me) big(L(`${nameOf(e.s)} is all in!`, `${nameOf(e.s)} gra za wszystko!`), '', 1300); }
      else { sfx.place(); if (e.a === 'raise' || e.a === 'bet') scene?.nod(e.s); }
    } else if (e.t === 'street') { sfx.draw(); setTimeout(() => sfx.place(), 400); if (e.pile) big(L('Mango flop!', 'Flop Mango!'), L('Straight from the thrown-away pile', 'Prosto ze stosu odrzuconych kart'), 1500); }
    else if (e.t === 'reveal') { sfx.set(); big(L('Cards up!', 'Karty na stół!'), L('Everyone still in is all in', 'Wszyscy w grze postawili wszystko'), 1500); }
    else if (e.t === 'show') {
      const won = e.pots.some(p => p.win.includes(S.me));
      setTimeout(() => {
        if (won) { sfx.win(); if (!e.fold) confetti(); } else sfx.set();
        const w = e.pots[0].win;
        if (!e.fold) big(w.length > 1 ? L('Split pot!', 'Podział puli!') : L(`${youOr(w[0])} win${w[0] === S.me ? '' : 's'}!`, w[0] === S.me ? 'Wygrywasz!' : `Wygrywa ${nameOf(w[0])}!`), esc(hn(e.pots[0].name)), 2200);
      }, e.fold ? 300 : 1200);
    } else if (e.t === 'bust') { sfx.lose(); big(L(`${youOr(e.s)} ${e.s === S.me ? 'are' : 'is'} out!`, e.s === S.me ? 'Odpadasz!' : `${nameOf(e.s)} odpada!`), L(`${ORD(S.seats.filter(p => !p.out).length + 1)} place`, `${S.seats.filter(p => !p.out).length + 1}. miejsce`), 2000); }
    else if (e.t === 'blinds') { sfx.turn(); ctx.toast(L(`Blinds go up to ${e.sb}/${e.bb}`, `Ciemne rosną do ${e.sb}/${e.bb}`)); }
    else if (e.t === 'sit') { sfx.join(); ctx.toast(L(`${nameOf(e.s)} took a seat`, `${nameOf(e.s)} siada do stołu`)); scene?.hop(e.s); }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } else sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1800);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); raising = false;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    endsAt = performance.now() + (s.left || 0);
    if (!s.opt) { raising = false; myTurnSeen = false; }
    else if (!myTurnSeen) { myTurnSeen = true; raiseTo = s.opt.minTo; sfx.turn(); if (document.hidden === false && navigator.vibrate) try { navigator.vibrate(30); } catch {} }
    render(); scene?.sync(S);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win, start = S.res.start;
    const mine = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? L('You take the table!', 'Zgarniasz cały stół!') : L(`${nameOf(w)} takes the table!`, `Stół zgarnia ${nameOf(w)}!`)}</h2>
      <p>${mine ? L(`You finished ${ORD(mine)} of ${S.seats.length} after ${S.res.hands} hands.`, `Twoje miejsce: ${mine} z ${S.seats.length}. Rozegrane rozdania: ${S.res.hands}.`) : L(`${S.res.hands} hands played.`, `Rozegrane rozdania: ${S.res.hands}.`)} ${L('Chips are pretend and reset every game.', 'Żetony są na niby i w każdej grze zaczynasz od nowa.')}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = S.res.stacks[i], net = st - start;
        return `<li class="${k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${p.out ? L('knocked out', 'poza grą') : cnt(st, 'chip', 'chips', 'żeton', 'żetony', 'żetonów')}</span></div>
          <strong class="${net > 0 ? 'up' : net < 0 ? 'down' : ''}">${net > 0 ? '+' : ''}${net}</strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  // ----- reactions float up from the sender's name tag -----
  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = layout?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? (t.mine ? innerHeight - 260 : t.y - 60) : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 40}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
    if (i >= 0) scene?.hop(i);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q); // full phone resolution is 4x the pixels for no visible gain
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#e5543b'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
    let t = 0;
    const step = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0;
    };
    step();
  }

  // ----- countdown -----
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if ((S.turn === S.me || (S.stage === 'drop' && S.drop?.need?.includes(S.me))) && S.left) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.warn(); }
    }
  }, 200);

  // ----- input -----
  const send = a => { ctx.act(a); raising = false; };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, o = S?.opt;
    if (a === 'drop') { sfx.click(); ctx.act({ t: 'drop', c: +b.dataset.c }); return; }
    if (a === 'ranks') { sfx.click(); ranksOpen = !ranksOpen; store.set(ranksOpen ? '1' : '0'); renderRanks(); return; }
    if (a === 'fold') { sfx.click(); send({ t: (o?.toCall ?? 0) <= 0 ? 'check' : 'fold' }); if ((o?.toCall ?? 0) <= 0) ctx.toast(L('No bet to you, so you checked for free.', 'Nikt nie postawił, więc czekasz za darmo.')); }
    else if (a === 'call') { sfx.click(); send({ t: (o?.toCall ?? 0) <= 0 ? 'check' : 'call' }); }
    else if (a === 'raise') {
      sfx.click();
      if (!raising) { raising = true; renderActs(); dockSize(); }
      else send(raiseTo >= o.maxTo ? { t: 'allin' } : { t: 'raise', to: raiseTo });
    } else if (a === 'preset') { sfx.pop(); raiseTo = +b.dataset.v; renderActs(); }
    else if (a === 'less' || a === 'more') { sfx.pop(); const st = Math.max(1, S.bb / 2) * (a === 'less' ? -1 : 1) * 2; raiseTo = Math.max(o.minTo, Math.min(o.maxTo, raiseTo + st)); renderActs(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('input', e => {
    if (e.target.dataset.a !== 'slider' || !S?.opt) return;
    raiseTo = +e.target.value;
    const b = root.querySelector('[data-a=raise]'); if (b) b.textContent = `${raiseTo >= S.opt.maxTo ? 'All in' : S.cur === 0 ? L('Bet', 'Postaw') : L('Raise to', 'Podbij do')} ${raiseTo}`;
    root.querySelectorAll('[data-a=preset]').forEach(p => p.setAttribute('aria-pressed', +p.dataset.v === raiseTo));
  });
  const onKey = e => {
    if (!S?.opt || e.target.closest?.('input:not([type=range]), textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f') root.querySelector('[data-a=fold]')?.click();
    else if (k === 'c' || k === 'k') root.querySelector('[data-a=call]')?.click();
    else if (k === 'r' || k === 'b') root.querySelector('[data-a=raise]')?.click();
    else if (k === 'escape' && raising) { raising = false; renderActs(); }
  };
  addEventListener('keydown', onKey);
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pills button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });
  const onResize = () => { for (const el of tagEls) el._w = 0; if (flat && S) onFrame(flatLayout()); ranksKey = ''; renderRanks(); dockSize(); };
  addEventListener('resize', onResize);
  // poker.css can arrive after the first paint (slow connections, people who join mid-hand): until then the hand-rankings
  // panel is page wide and the dock is unstyled, so measure them again whenever their size changes
  const sizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!destroyed) { scene?.setInset?.(ranksOpen && innerWidth > 1100 ? $('pk-ranks').offsetWidth + 14 : 0); dockSize(); } }) : null;
  sizeWatch?.observe($('pk-ranks')); sizeWatch?.observe($('pk-dock'));

  return {
    update,
    room(r) { Rm = r; if (S) { renderTop(); renderMine(); } paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); removeEventListener('keydown', onKey); removeEventListener('resize', onResize); sizeWatch?.disconnect(); scene?.dispose(); },
  };
}
