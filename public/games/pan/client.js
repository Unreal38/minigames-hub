// Pan game view: HUD over the 3D table. Renders what the server says and sends the cards you play.
// Your own hand is the only one this page ever receives.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { cardHtml } from '../poker/cards.js';
import { RANK_NAMES } from '../poker/rules.js';
import { rankOf, canPlay, drawCount, plays, top, NINE_H } from './rules.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  cards: '<svg class="pn-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2.5" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 16 12)"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const rankWord = (r, many) => { const w = RANK_NAMES[r].toLowerCase(); return many ? (w === 'six' ? 'sixes' : w + 's') : w; };
const aRank = r => (r === 12 ? 'an ' : 'a ') + rankWord(r); // "an ace", "a nine"
const orHigher = r => (r === 12 ? 'an ace' : aRank(r) + ' or higher');
// Polish rank words, nine to ace: [plural, "tap a ...", "beats a ..."]
const RANK_PL = [['dziewiątki', 'dziewiątkę', 'dziewiątki'], ['dziesiątki', 'dziesiątkę', 'dziesiątki'], ['walety', 'waleta', 'waleta'], ['damy', 'damę', 'damy'], ['króle', 'króla', 'króla'], ['asy', 'asa', 'asa']];
const rankPl = (r, f) => RANK_PL[r - 7]?.[f] || rankWord(r, !f);
const orHigherPl = r => (r === 12 ? 'asa' : rankPl(r, 1) + ' albo wyższej karty');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  for (const f of ['../poker/poker.css', './pan.css']) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL(f, import.meta.url).href; document.head.append(l); }
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pn">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pn-info"></span></div>
      <div class="tr"><span class="tcode" id="pn-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pn-banner" aria-live="polite"></div>
      <div class="pn-top" id="pn-top" hidden></div>
      <div class="shout" id="pn-big" aria-live="assertive"></div>
      <div class="pn-dock" id="pn-dock"><div class="pn-ctl" id="pn-ctl"></div><div class="pn-hand" id="pn-hand"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pn'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, pick = -1, dealUntil = 0, dealTimer = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && me() && !me().bot);
  const dealing = () => performance.now() < dealUntil;
  const mini = cs => cs.map(c => cardHtml(c, { cls: 'xs' })).join('');

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x)); // keep the tag on the screen when its player is half off it
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150 * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
    const b = $('pn-top'); b.style.left = `${(info.pile.x / uiz()).toFixed(1)}px`; b.style.top = `${(info.pile.y / uiz()).toFixed(1)}px`; // inside the (zoomed) HUD
  }
  // keep the 3D table clear of your hand at the bottom
  function layout() { if (scene) scene.setHud(Math.max($('pn-dock').offsetHeight + 30, innerWidth < 700 ? 250 : 240) * uiz()); }

  // ----- name tags over the avatars: name, cards left, and their last move -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="pn-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const last = S.ph === 'play' && S.stage === 'play' ? S.last : null;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'play'); el.classList.toggle('safe', !!p.out);
      setHtml(el.querySelector('.plate .cnt'), p.out ? L(`${ORD(p.out)} out`, `${p.out}. bez kart`) : `${I.cards}${p.n}`);
      setHtml(el.firstElementChild, last && last.s === i ? (last.t === 'play' ? `<span class="top">${mini(last.cards)}${last.back ? '<u>↩</u>' : ''}</span>` : `<span class="took">${L('took', 'bierze')} ${last.cards.length}</span>`) : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = true) {
    const t = live?.tags?.[i]; if (!t || i === S.me) return;
    const f = document.createElement('div');
    f.className = 'pn-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- your hand and the buttons -----
  function renderDock() {
    const p = me(), hand = $('pn-hand'), ctl = $('pn-ctl');
    if (!S || S.ph !== 'play' || !p) { setHtml(hand, ''); setHtml(ctl, ''); layout(); return; }
    const turn = myTurn(), busy = Date.now() - sent < 1200, mine = p.hand || [];
    if (p.out) { setHtml(hand, ''); setHtml(ctl, `<span class="pn-wait safe"><span>${L(`You are out of cards, so you are safe. ${ORD(p.out)} place!`, `Nie masz już kart, więc nic ci nie grozi. ${p.out}. miejsce!`)}</span></span>`); layout(); return; }
    const n = mine.length, wide = innerWidth >= 700, cw = wide ? 74 : 54, rows = !wide && n > 8 ? 2 : 1, per = Math.ceil(n / rows);
    const room = Math.min(innerWidth - (wide ? 60 : 28), 980), gap = per > 1 ? Math.min(6, (room - per * cw) / (per - 1)) : 0;
    if (!turn || busy) pick = -1;
    const picked = c => pick === rankOf(c) && can(c);
    const can = c => turn && !busy && !dealing() && canPlay(mine, S.pile, [c]);
    hand.style.setProperty('--gap', gap.toFixed(1) + 'px'); hand.style.setProperty('--per', per);
    const btn = (c, k) => `<button type="button" class="pn-card${can(c) ? ' ok' : ''}${picked(c) ? ' sel' : ''}${k % per === 0 ? ' first' : ''}" data-a="card" data-c="${c}"${can(c) ? '' : ' aria-disabled="true"'}>${cardHtml(c, { cls: 'big' })}</button>`;
    setHtml(hand, Array.from({ length: rows }, (_, r) => `<div class="pn-rowc">${mine.slice(r * per, (r + 1) * per).map((c, k) => btn(c, k)).join('')}</div>`).join(''));
    hand.classList.toggle('two', rows === 2); hand.classList.toggle('turn', turn && !busy);
    if (dealing() || S.stage === 'deal') setHtml(ctl, `<span class="pn-wait"><span>${L(`Dealing the cards…`, `Rozdawanie kart…`)}</span></span>`);
    else if (turn && !busy) {
      const k = drawCount(S.pile), sets = plays(mine, S.pile).filter(cs => cs.length > 1), t = S.pile.length ? rankOf(top(S.pile)) : -1;
      const stuck = t >= 0 ? mine.filter(c => rankOf(c) < t).length : 0;
      let hint = '';
      if (sets.some(cs => rankOf(cs[0]) === pick)) hint = L(`Press the button to play all the ${rankWord(pick, true)} together, or tap one of them again to play only that card.`, `Naciśnij przycisk, żeby położyć wszystkie ${rankPl(pick, 0)} razem, albo dotknij jeszcze raz jednej z tych kart, żeby położyć tylko ją.`);
      else if (!S.pile.length) hint = L('You hold the nine of hearts, so you start with it.', 'Masz dziewiątkę kier, więc zaczynasz od niej.');
      else if (!plays(mine, S.pile).length) hint = L(`Nothing you hold beats ${aRank(t)}. Pick up ${k === 1 ? 'the top card' : 'the top ' + k}.`, `Żadna twoja karta nie przebija ${rankPl(t, 2)}. Weź ${k === 1 ? 'wierzchnią kartę' : 'wierzchnie karty (' + k + ')'}.`);
      else if (stuck) hint = L(`Tap ${orHigher(t)} to play it. Your lower card${stuck === 1 ? '' : 's'} can only go once the pile is picked back down.`, `Dotknij ${orHigherPl(t)}, żeby zagrać. Niższe karty położysz dopiero wtedy, gdy ktoś zbierze karty ze stosu.`);
      else hint = t === 7 ? L('Tap any card to play it.', 'Dotknij dowolnej karty, żeby zagrać.') : L(`Tap ${orHigher(t)} to play it.`, `Dotknij ${orHigherPl(t)}, żeby zagrać.`);
      setHtml(ctl, `<div class="pn-go">
          ${sets.map((cs, j) => `<button type="button" class="btn big m${rankOf(cs[0]) === pick ? ' pn-pulse' : ''}" data-a="set" data-j="${j}">${L(`Play ${cs.length === 4 ? 'all four' : 'three'} ${rankWord(rankOf(cs[0]), true)}`, `Połóż ${cs.length === 4 ? 'cztery' : 'trzy'} ${rankPl(rankOf(cs[0]), 0)}`)}</button>`).join('')}
          ${S.pile.length ? `<button type="button" class="btn big r" data-a="draw"${k ? '' : ' disabled'}>${k ? `${L('Take', 'Weź')} ${k} ${mini(S.pile.slice(-k))}` : L('Nothing to take', 'Nie ma czego brać')}</button>` : ''}
        </div><p class="pn-hint">${hint}</p>`);
    } else if (S.stage === 'play' && S.turn >= 0) {
      const t = S.seats[S.turn];
      setHtml(ctl, `<span class="pn-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`);
    } else setHtml(ctl, '');
    layout();
  }

  function renderBanner() {
    const el = $('pn-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.pan >= 0 ? L(`${S.pan === S.me ? 'You are' : nameOf(S.pan) + ' is'} the Pan!`, S.pan === S.me ? 'Zostajesz Panem!' : `${nameOf(S.pan)} zostaje Panem!`) : '';
    else if (S.stage === 'deal') msg = innerWidth < 700 ? L(`${S.turn === S.me ? 'You start' : nameOf(S.turn) + ' starts'}`, S.turn === S.me ? 'Zaczynasz' : `Zaczyna ${nameOf(S.turn)}`) : L(`Dealing · ${S.turn === S.me ? 'you have' : nameOf(S.turn) + ' has'} the nine of hearts and ${S.turn === S.me ? 'start' : 'starts'}`, `Rozdawanie · ${S.turn === S.me ? 'masz dziewiątkę kier i zaczynasz' : nameOf(S.turn) + ' ma dziewiątkę kier i zaczyna'}`);
    else if (myTurn()) msg = (innerWidth < 700 ? L('Your turn', 'Twoja kolej') : S.last?.back && S.last.s !== S.me ? L(`${nameOf(S.last.s)}’s spade sends it back to you`, `Pik gracza ${nameOf(S.last.s)} cofa kolejkę do ciebie`) : S.pile.length ? L('Your turn · play a card or pick up', 'Twoja kolej · połóż kartę albo weź ze stosu') : L('Your turn · start with the nine of hearts', 'Twoja kolej · zacznij od dziewiątki kier')) + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`) + (S.last?.back && innerWidth >= 700 ? L(' · a spade sent it backwards', ' · pik cofnął kolejkę') : '');
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  // the card everyone has to beat, as a label over the pile
  function renderTop() {
    const el = $('pn-top'), show = S.ph === 'play' && S.stage === 'play' && S.pile.length > 0;
    el.hidden = !show; if (!show) return;
    setHtml(el, `<span>${L(`${S.pile.length} in the pile`, `na stosie: ${S.pile.length}`)}</span><b>${L('beat', 'przebij')} ${cardHtml(top(S.pile), { cls: 'xs' })}</b>`);
  }

  function render() {
    if (!S) return;
    const left = S.seats.filter(p => !p.out).length;
    $('pn-info').textContent = S.ph === 'end' ? L(`${S.res?.moves || S.mv} moves played`, `ruchów: ${S.res?.moves || S.mv}`) : L(`${left} still holding cards`, `z kartami: ${left}`);
    $('pn-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner(); renderTop();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pn-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'play') {
      e.s === S.me ? sfx.place() : sfx.pop();
      if (e.cards.length > 1) { sfx.set(); big(L(`${e.cards.length === 4 ? 'Four' : 'Three'} ${rankWord(rankOf(e.cards[e.cards.length - 1]), true)}!`, `${e.cards.length === 4 ? 'Cztery' : 'Trzy'} ${rankPl(rankOf(e.cards[e.cards.length - 1]), 0)}!`), L(`${e.s === S.me ? 'You put' : nameOf(e.s) + ' puts'} them all down at once`, e.s === S.me ? 'Kładziesz wszystkie naraz' : `${nameOf(e.s)} kładzie wszystkie naraz`), 1600); }
    } else if (e.t === 'draw') { sfx.draw(); setTimeout(() => !destroyed && sfx.draw(), 140); floatAt(e.s, '+' + e.k); if (e.s === S.me) sfx.plop(); }
    else if (e.t === 'out') {
      if (e.s === S.me) { sfx.win(); confetti(); big(L('Safe!', 'Bezpiecznie!'), e.place === 1 ? L('First one out of cards', 'Pierwsze miejsce, zero kart') : L(`You are out of cards, ${ORD(e.place)} place`, `Nie masz już kart, ${e.place}. miejsce`), 2200); }
      else { sfx.set(); ctx.toast(L(`${nameOf(e.s)} is out of cards and safe`, `${nameOf(e.s)} nie ma już kart`)); }
    } else if (e.t === 'end') {
      if (e.pan === S.me) sfx.lose();
      big(e.pan === S.me ? L('You are the Pan!', 'Zostajesz Panem!') : L(`${nameOf(e.pan)} is the Pan!`, `${nameOf(e.pan)} zostaje Panem!`), S.res?.called ? L('Nobody would pick the pile back up, so the most cards loses', 'Nikt nie chciał zebrać stosu, więc przegrywa ten, kto ma najwięcej kart') : L('Last one left holding cards', 'Ostatni gracz z kartami'), 2200);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; pick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'deal' && s.dealLeft > 500) { // cards flutter out before you can touch them
        dealUntil = performance.now() + s.dealLeft; let k = 0;
        const flick = () => { if (destroyed || k++ > 7 || !dealing()) return; sfx.draw(); setTimeout(flick, 230); }; flick();
        clearTimeout(dealTimer); dealTimer = setTimeout(() => { if (!destroyed && S) render(); }, s.dealLeft + 30);
      }
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (!fresh && myTurn() && was !== s.turn + '/' + s.stage + '/' + s.mv) { sfx.turn(); lastTick = -1; sent = 0; pick = -1; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    const head = S.pan === S.me ? L('You are the Pan!', 'Zostajesz Panem!') : myPlace === 1 ? L('First one out!', 'Pierwsze miejsce!') : L(`${nameOf(S.pan)} is the Pan!`, `${nameOf(S.pan)} zostaje Panem!`);
    const sub = S.res.called ? L('Nobody would pick the pile back up, so the table was called: fewest cards left does best.', 'Nikt nie chciał zebrać stosu, więc gra została przerwana: im mniej kart, tym lepiej.')
      : S.pan === S.me ? L('Everyone else got rid of their cards. Better luck next deal.', 'Wszyscy inni pozbyli się kart. Powodzenia w następnym rozdaniu.') : myPlace ? L(`You got out ${ORD(myPlace)} of ${n}.`, `Twoje miejsce: ${myPlace} z ${n}.`) : '';
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub} ${L(`${S.res.moves} moves in all.`, `Łącznie ruchów: ${S.res.moves}.`)}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = p.st, pan = i === S.pan;
        return `<li class="${k === 0 ? 'won' : ''}${pan ? ' pan' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${st.played} card${st.played === 1 ? '' : 's'} played · ${st.drawn} picked up`, `położone karty: ${st.played} · wzięte: ${st.drawn}`)}</span></div>
          <strong><span>${pan ? 'Pan' : p.out ? L('Safe', 'Bezpiecznie') : ''}</span><small>${S.res.left[i] ? L(`${S.res.left[i]} card${S.res.left[i] === 1 ? '' : 's'} left`, `zostało kart: ${S.res.left[i]}`) : L('out of cards', 'bez kart')}</small></strong>${paidHtml(Rm, i)}</li>`;
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

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
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
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0;
    };
    step();
  }

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go(a) {
    if (!myTurn() || dealing() || Date.now() - sent < 1200) return;
    if (a.t === 'play' && !canPlay(me().hand, S.pile, a.cards)) { sfx.bad?.(); return; }
    if (a.t === 'draw' && !drawCount(S.pile)) return;
    sent = Date.now(); pick = -1; sfx.click(); ctx.act(a); renderDock();
  }
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 't') go({ t: 'draw' });
    else if (k === 'enter' && !e.target.closest?.('button')) { const o = plays(me().hand, S.pile).filter(cs => cs.length === 1).sort((a, b) => rankOf(a[0]) - rankOf(b[0]))[0]; if (o) go({ t: 'play', cards: o }); }
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderDock(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'card') {
      const c = +b.dataset.c, r = rankOf(c);
      // Holding a whole set you may play together: the first tap lifts the set and points at the button, a second tap plays the one card.
      if (b.classList.contains('ok') && pick !== r && plays(me().hand, S.pile).some(cs => cs.length > 1 && cs.includes(c))) { pick = r; sfx.click(); renderDock(); }
      else if (b.classList.contains('ok')) go({ t: 'play', cards: [c] }); else if (myTurn()) { sfx.bad?.(); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); }
    }
    else if (a === 'set') { const cs = plays(me().hand, S.pile).filter(x => x.length > 1)[+b.dataset.j]; if (cs) go({ t: 'play', cards: cs }); }
    else if (a === 'draw') go({ t: 'draw' });
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pn-card.ok');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(dealTimer); scene?.dispose();
    },
  };
}
