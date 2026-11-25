// Piotruś game view: HUD over the 3D table. Renders what the server says and sends which card you reach for and take.
// Your own hand is the only one this page ever receives; the cards you draw from are just positions.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { PIOTR, DECKS, petName } from './rules.js';
import { cardHtml, backHtml, fillPics, picOf } from './cards.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  cards: '<svg class="pi-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2.5" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 16 12)"/></svg>',
  mix: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h4l8 10h6M3 17h4l2.5-3M14.5 10L17 7h4M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./piotr.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pio">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pi-info"></span></div>
      <div class="tr"><span class="tcode" id="pi-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pi-banner" aria-live="polite"></div>
      <div class="shout" id="pi-big" aria-live="assertive"></div>
      <div class="pi-dock" id="pi-dock"><div class="pi-ctl" id="pi-ctl"></div><div class="pi-hand" id="pi-hand"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pio'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, aim = -1, mouse = true, hadPiotr = false;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });
  picOf(PIOTR); // have the pictures drawn before they are needed
  for (let p = 0; p < DECKS.big; p++) picOf(p * 2);

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; fillPics(el); } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && me() && !me().bot);
  const mini = c => cardHtml(c, { cls: 'xs' });
  const cb = i => S.seats[i]?.fl?.cb | 0;

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x)); // keep the tag on the screen when its player is half off it
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150 * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  // keep the 3D table clear of your hand at the bottom
  function layout() { if (scene) scene.setHud(Math.max($('pi-dock').offsetHeight + 30, innerWidth < 700 ? 250 : 240) * uiz()); }

  // ----- name tags over the avatars: name, cards left, and their last draw -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="pi-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const last = S.ph === 'play' && S.stage !== 'deal' && S.stage !== 'pairs' ? S.last : null;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'play'); el.classList.toggle('safe', !!p.out); el.classList.toggle('give', i === S.from && S.stage === 'play');
      setHtml(el.querySelector('.plate .cnt'), p.out ? L(`${ord(p.out)} out`, `${p.out}. bez kart`) : `${I.cards}${p.n}`);
      setHtml(el.firstElementChild, last && last.s === i && last.pair >= 0 ? `<span class="top">${mini(last.pair * 2)}${mini(last.pair * 2 + 1)}</span>` : S.ph === 'end' && i === S.loser ? `<span class="top">${mini(PIOTR)}</span>` : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = false) {
    const t = live?.tags?.[i]; if (!t || i === S.me) return;
    const f = document.createElement('div');
    f.className = 'pi-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- your hand, and the cards you pick from -----
  function rowsOf(n, cw) { // how to fit n cards of width cw: rows, cards per row and the gap between them
    const wide = innerWidth >= 700, rows = !wide && n > 8 ? 2 : 1, per = Math.ceil(n / rows) || 1;
    const room = Math.min(innerWidth - (wide ? 60 : 28), 980), gap = per > 1 ? Math.min(6, (room - per * cw) / (per - 1)) : 0;
    return { rows, per, gap };
  }
  function renderDock() {
    const p = me(), hand = $('pi-hand'), ctl = $('pi-ctl');
    if (!S || S.ph !== 'play' || !p) { setHtml(hand, ''); setHtml(ctl, ''); layout(); return; }
    const turn = myTurn(), busy = Date.now() - sent < 900, wide = innerWidth >= 700, start = S.stage === 'deal' || S.stage === 'pairs';
    if (!turn) aim = -1;
    // your cards, in the order the others see their backs; at the start the pairs you were dealt sit beside them and then go to the table
    const mine = p.hand || [], firsts = start ? (p.first || []).flatMap(q => [q * 2, q * 2 + 1]) : [];
    const cw = wide ? 74 : 54, all = mine.length + firsts.length, { rows, per, gap } = rowsOf(all, cw);
    hand.style.setProperty('--gap', gap.toFixed(1) + 'px'); hand.style.setProperty('--w', cw + 'px');
    const giving = S.stage === 'play' && S.from === S.me;
    const cell = (c, k, cls) => `<span class="pi-slot${cls}${k % per === 0 ? ' first' : ''}">${cardHtml(c)}</span>`;
    const cells = [...mine.map((c, k) => [c, (giving && S.aim === k ? ' aimed' : '') + (S.stage === 'took' && S.got === c && S.last?.s === S.me ? ' new' : '')]), ...firsts.map(c => [c, S.stage === 'pairs' ? ' pair gone' : ' pair'])];
    setHtml(hand, p.out ? '' : Array.from({ length: rows }, (_, r) => `<div class="pi-rowc">${cells.slice(r * per, (r + 1) * per).map(([c, cls], k) => cell(c, k, cls)).join('')}</div>`).join(''));
    hand.classList.toggle('two', rows === 2);
    const mixBtn = mine.length > 1 && !start ? `<button type="button" class="btn sm pi-mix" data-a="mix" title="${L('Shuffle your cards (S)', 'Potasuj swoje karty (S)')}">${I.mix}<span>${L('Shuffle', 'Potasuj')}</span></button>` : '';
    if (p.out) setHtml(ctl, `<span class="pi-wait safe"><span>${L(`You are out of cards, so you are safe. ${ord(p.out)} place!`, `Nie masz już kart, więc nic ci nie grozi. ${p.out}. miejsce!`)}</span></span>`);
    else if (S.stage === 'deal') setHtml(ctl, `<span class="pi-wait"><span>${L(`Dealing the cards…`, `Rozdawanie kart…`)}</span></span>`);
    else if (S.stage === 'pairs') setHtml(ctl, `<span class="pi-wait"><span>${firsts.length ? L(`Your pairs go to the table: ${firsts.length / 2}`, `Twoje pary idą na stół: ${firsts.length / 2}`) : L('No pairs in your hand this time', 'Tym razem nie masz żadnej pary')}</span></span>`);
    else if (turn && !busy) {
      const g = S.seats[S.from], n = g.n, bw = wide ? 62 : 46, r = rowsOf(n, bw);
      const backs = Array.from({ length: n }, (_, k) => `<button type="button" class="pi-pick${aim === k ? ' sel' : ''}${k % r.per === 0 ? ' first' : ''}" data-a="pick" data-k="${k}" aria-label="${L(`Card ${k + 1} of ${n}`, `Karta ${k + 1} z ${n}`)}">${backHtml(cb(S.from))}</button>`);
      setHtml(ctl, `<div class="pi-from"><span class="pi-wait">${avatarHtml(g.color, g.av, 30)}<span>${L(`Draw one card from ${nameOf(S.from)}`, `Wyciągnij jedną kartę (od: ${nameOf(S.from)})`)}</span></span>
        <div class="pi-picks${r.rows === 2 ? ' two' : ''}" style="--gap:${r.gap.toFixed(1)}px;--w:${bw}px">${Array.from({ length: r.rows }, (_, j) => `<div class="pi-rowc">${backs.slice(j * r.per, (j + 1) * r.per).join('')}</div>`).join('')}</div>
        <p class="pi-hint">${aim >= 0 && !mouse ? L('Tap the same card again to take it.', 'Dotknij tej samej karty jeszcze raz, żeby ją wziąć.') : L(`${nameOf(S.from)} can see which card you reach for.`, `${nameOf(S.from)} widzi, po którą kartę sięgasz.`)}</p></div>`);
    } else if (S.stage === 'play' && S.turn >= 0) {
      const t = S.seats[S.turn];
      const msg = S.turn === S.me ? (p.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…'))
        : giving ? L(`${nameOf(S.turn)} is choosing one of your cards…`, `${nameOf(S.turn)} wybiera jedną z twoich kart…`) : L(`${nameOf(S.turn)} is choosing a card…`, `${nameOf(S.turn)} wybiera kartę…`);
      setHtml(ctl, `<div class="pi-line"><span class="pi-wait${giving ? ' hot' : ''}">${avatarHtml(t.color, t.av, 30)}<span>${msg}</span></span>${mixBtn}</div>`);
    } else if (S.stage === 'took' && S.last) {
      const T = S.last, mineNow = T.s === S.me;
      const msg = T.pair >= 0 ? L(`${mineNow ? 'You make' : nameOf(T.s) + ' makes'} a pair: ${petName(T.pair * 2)}`, `${mineNow ? 'Masz parę' : nameOf(T.s) + ' ma parę'}: ${petName(T.pair * 2)}`)
        : mineNow ? (S.got === PIOTR ? L('You drew the Piotruś! Keep a straight face.', 'Masz Piotrusia! Zachowaj kamienną twarz.') : L(`You drew ${petName(S.got)}. No pair.`, `Masz kartę: ${petName(S.got)}. Bez pary.`))
        : L(`${nameOf(T.s)} takes a card from ${T.from === S.me ? 'you' : nameOf(T.from)}. No pair.`, `${nameOf(T.s)} bierze kartę (od: ${T.from === S.me ? 'ciebie' : nameOf(T.from)}). Bez pary.`);
      setHtml(ctl, `<div class="pi-line"><span class="pi-wait${mineNow && S.got === PIOTR ? ' bad' : ''}"><span>${msg}</span></span>${mixBtn}</div>`);
    } else setHtml(ctl, '');
    layout();
  }

  function renderBanner() {
    const el = $('pi-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '', narrow = innerWidth < 700;
    if (S.ph === 'end') msg = S.loser >= 0 ? (S.loser === S.me ? L('You are left with the Piotruś!', 'Zostajesz z Piotrusiem!') : narrow ? `Piotruś: ${nameOf(S.loser)}` : L(`${nameOf(S.loser)} is left with the Piotruś!`, `${nameOf(S.loser)} zostaje z Piotrusiem!`)) : '';
    else if (S.stage === 'deal') msg = L('Dealing', 'Rozdawanie');
    else if (S.stage === 'pairs') msg = L('Everyone lays down their pairs', 'Wszyscy odkładają pary');
    else if (myTurn()) msg = (narrow ? L('Your turn', 'Twoja kolej') : L(`Your turn · draw a card from ${nameOf(S.from)}`, `Twoja kolej · wyciągnij kartę (od: ${nameOf(S.from)})`)) + t;
    else if (S.stage === 'play' && S.turn >= 0) msg = narrow ? L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`) : S.from === S.me ? L(`${nameOf(S.turn)} draws from you`, `${nameOf(S.turn)} ciągnie kartę od ciebie`) : L(`${nameOf(S.turn)} draws from ${nameOf(S.from)}`, `${nameOf(S.turn)} ciągnie kartę (od: ${nameOf(S.from)})`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    const total = DECKS[S.deck] || 12;
    $('pi-info').textContent = innerWidth < 700 ? L(`Pairs: ${S.heap.length}/${total}`, `Pary: ${S.heap.length}/${total}`) : L(`Pairs on the table: ${S.heap.length} of ${total}`, `Pary na stole: ${S.heap.length} z ${total}`);
    $('pi-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pi-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`; fillPics(el);
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'take') {
      sfx.draw();
      if (e.pair >= 0) {
        setTimeout(() => !destroyed && sfx.set(), 450);
        if (e.s === S.me) big(L('A pair!', 'Para!'), `${mini(e.pair * 2)}${mini(e.pair * 2 + 1)} ${petName(e.pair * 2)}`, 1500);
        else floatAt(e.s, L('pair!', 'para!'));
      } else if (e.s === S.me && S.got === PIOTR) { sfx.plop(); big('Piotruś!', L('Only you know. Shuffle and keep a straight face.', 'Wiesz o tym tylko ty. Potasuj karty i zachowaj kamienną twarz.'), 2000); }
      else if (e.from === S.me && hadPiotr && !(me()?.hand || []).includes(PIOTR)) { sfx.win(); big(L('Phew!', 'Uff!'), L(`${nameOf(e.s)} took the Piotruś from you`, `${nameOf(e.s)} zabiera ci Piotrusia`), 1800); }
    } else if (e.t === 'shuf') { scene?.shuffle(e.s); sfx.whoosh?.(); }
    else if (e.t === 'out') {
      if (e.s === S.me) { sfx.win(); confetti(); big(L('Safe!', 'Bezpiecznie!'), e.place === 1 ? L('First one out of cards', 'Pierwsze miejsce, zero kart') : L(`You are out of cards, ${ord(e.place)} place`, `Nie masz już kart, ${e.place}. miejsce`), 2200); }
      else { sfx.set(); ctx.toast(L(`${nameOf(e.s)} is out of cards and safe`, `${nameOf(e.s)} nie ma już kart`)); }
    } else if (e.t === 'end') {
      if (e.loser === S.me) sfx.lose();
      setTimeout(() => { if (!destroyed) big(e.loser === S.me ? L('Piotruś is yours!', 'Piotruś zostaje u ciebie!') : L(`${nameOf(e.loser)} has the Piotruś!`, `${nameOf(e.loser)} zostaje z Piotrusiem!`), S.res?.called ? L('The game was stopped: fewest cards left does best', 'Gra została przerwana: im mniej kart, tym lepiej') : L('Everyone else is out of cards', 'Wszyscy pozostali pozbyli się kart'), 2400); }, 900);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 3600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; aim = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'deal' && s.stageLeft > 500) { let k = 0; const flick = () => { if (destroyed || k++ > 8 || S.stage !== 'deal') return; sfx.draw(); setTimeout(flick, 230); }; flick(); }
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    const now = s.turn + '/' + s.stage + '/' + s.mv;
    if (!fresh && was !== now) {
      if (myTurn()) { sfx.turn(); lastTick = -1; sent = 0; aim = -1; }
      if (s.stage === 'pairs' && s.heap.length) { sfx.place(); setTimeout(() => !destroyed && sfx.set(), 500); }
    }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
    hadPiotr = (me()?.hand || []).includes(PIOTR);
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    const head = S.loser === S.me ? L('You are left with the Piotruś!', 'Zostajesz z Piotrusiem!') : myPlace === 1 ? L('First one out!', 'Pierwsze miejsce!') : L(`${nameOf(S.loser)} is left with the Piotruś!`, `${nameOf(S.loser)} zostaje z Piotrusiem!`);
    const sub = S.loser === S.me ? L('Everyone else got rid of their cards. Better luck next deal.', 'Wszyscy inni pozbyli się kart. Powodzenia w następnym rozdaniu.') : myPlace ? L(`You got out ${ord(myPlace)} of ${n}.`, `Twoje miejsce: ${myPlace} z ${n}.`) : '';
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub} ${L(`${cnt(S.res.moves, 'card', 'cards')} drawn in all.`, `Łącznie wyciągnięte karty: ${S.res.moves}.`)}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = p.st, lost = i === S.loser;
        return `<li class="${k === 0 ? 'won' : ''}${lost ? ' lost' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(st.pairs, 'pair')} laid down · ${cnt(st.took, 'card')} drawn`, `pary: ${st.pairs} · dobrane karty: ${st.took}`)}</span></div>
          <strong>${lost ? mini(PIOTR) : `<span>${p.out ? L('Safe', 'Bezpiecznie') : ''}</span>`}<small>${lost ? 'Piotruś' : S.res.left[i] ? L(`${cnt(S.res.left[i], 'card')} left`, `zostało kart: ${S.res.left[i]}`) : L('out of cards', 'bez kart')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'))}</div></div>`;
    fillPics(el);
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
    if (sent && Date.now() - sent >= 900) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  // Reaching for a card is shown to everyone at the table; it is sent only when it changes.
  function setAim(k) {
    if (!myTurn() || k === aim) return;
    aim = k; ctx.act({ t: 'aim', k });
    root.querySelectorAll('.pi-pick').forEach(b => b.classList.toggle('sel', +b.dataset.k === k));
  }
  function take(k) {
    if (!myTurn() || Date.now() - sent < 900 || !(k >= 0 && k < S.seats[S.from].n)) return;
    sent = Date.now(); aim = -1; sfx.click(); ctx.act({ t: 'take', k }); renderDock();
  }
  function mix() { if (S?.ph === 'play' && (me()?.hand || []).length > 1) { sfx.click(); ctx.act({ t: 'shuffle' }); } }
  const onKey = e => {
    if (!S || S.ph !== 'play' || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') mix();
    else if (!myTurn()) return;
    else if (k === 'arrowleft' || k === 'arrowright') { const n = S.seats[S.from].n; mouse = true; setAim(aim < 0 ? (k === 'arrowleft' ? n - 1 : 0) : (aim + (k === 'arrowleft' ? n - 1 : 1)) % n); }
    else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button') && aim >= 0) take(aim);
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderDock(); };
  addEventListener('resize', onResize);
  root.addEventListener('pointerdown', e => { mouse = e.pointerType === 'mouse'; }, true);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'pick') { const k = +b.dataset.k; if (mouse || aim === k) take(k); else { sfx.hover(); setAim(k); renderDock(); } } // on a touch screen the first tap reaches, the second takes
    else if (a === 'mix') mix();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const pk = e.target.closest('.pi-pick');
    if (pk && e.pointerType === 'mouse') { if (+pk.dataset.k !== aim) sfx.hover(); setAim(+pk.dataset.k); return; }
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });
  root.addEventListener('pointerout', e => { // the hand moves away from the cards
    if (e.pointerType === 'mouse' && e.target.closest('.pi-picks') && !e.relatedTarget?.closest?.('.pi-picks')) setAim(-1);
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
