// Pet Parade game view: HUD over the 3D table. Renders what the server says and sends the cards you play.
// Your own hand is the only one this page ever receives (and, at the end, what everyone was left holding).
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { cardHtml, fillCards, preload, colName, colDot, faceName } from './cards.js';
import { fits, playable, isWild, faceOf, HEX, GIFT, ROCK } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  cards: '<svg class="pp-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2.5" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 16 12)"/></svg>',
  cw: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M18 2v4.5h-4.5"/></svg>',
  ccw: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M6 2v4.5h4.5"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const cardsWord = n => L(`${n} card${n === 1 ? '' : 's'}`, `${n} ${n === 1 ? 'kartę' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'karty' : 'kart'}`);

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./parade.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pp">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pp-info"></span></div>
      <div class="tr"><span class="tcode" id="pp-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pp-banner" aria-live="polite"></div>
      <div class="pp-top" id="pp-top" hidden></div>
      <div class="pp-deck" id="pp-deck" hidden></div>
      <div class="shout" id="pp-big" aria-live="assertive"></div>
      <div class="pp-catch" id="pp-catch"></div>
      <div class="pp-dock" id="pp-dock"><div class="pp-ctl" id="pp-ctl"></div><div class="pp-hand" id="pp-hand"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pp'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, wild = -1, dealUntil = 0, dealTimer = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; fillCards(el); } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && (S.stage === 'play' || S.stage === 'drawn') && S.turn === S.me && me() && !me().bot);
  const dealing = () => performance.now() < dealUntil;
  const busy = () => Date.now() - sent < 1000;
  const topCard = () => S.pile[S.pile.length - 1];
  const mini = c => cardHtml(c, { cls: 'xs' });
  const canCatch = () => !!(S && S.ph === 'play' && S.open >= 0 && S.open !== S.me && S.me >= 0);
  const canCall = () => { const p = me(); if (!p || p.bot || S.ph !== 'play') return false; return (S.open === S.me && p.n === 1) || (myTurn() && p.n === 2 && !p.called); };

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150).toFixed(1)}px) translate(-50%, -100%)`;
    }
    const b = $('pp-top'); b.style.left = `${info.pile.x.toFixed(1)}px`; b.style.top = `${info.pile.y.toFixed(1)}px`;
    const d = $('pp-deck'); d.style.left = `${info.stock.x.toFixed(1)}px`; d.style.top = `${info.stock.y.toFixed(1)}px`;
  }
  function layout() { if (scene) scene.setHud(Math.max($('pp-dock').offsetHeight + 30, innerWidth < 700 ? 250 : 240)); }

  // ----- name tags: name, cards left, "Last one!", and their last move -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="pp-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const last = S.ph === 'play' ? S.last : null;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play' && S.stage !== 'deal'); el.classList.toggle('one', p.n === 1 && S.ph === 'play');
      setHtml(el.querySelector('.plate .cnt'), `${I.cards}${p.n}`);
      let bub = '';
      if (S.open === i) bub = `<span class="forgot">${L('Forgot!', 'Zapomniał!')}</span>`;
      else if (p.called && p.n === 1 && S.ph === 'play') bub = `<span class="one">${L('Last one!', 'Ostatnia!')}</span>`;
      else if (last && last.s === i) bub = last.t === 'play' ? `<span class="top">${mini(last.c)}</span>` : `<span class="took">${L('drew', 'dobiera')} ${last.k}</span>`;
      setHtml(el.firstElementChild, bub);
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = true) {
    const t = live?.tags?.[i]; if (!t || i === S.me) return;
    const f = document.createElement('div');
    f.className = 'pp-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- your hand and the buttons -----
  function renderDock() {
    const p = me(), hand = $('pp-hand'), ctl = $('pp-ctl');
    if (!S || S.ph !== 'play' || !p) { setHtml(hand, ''); setHtml(ctl, ''); layout(); return; }
    const turn = myTurn() && !busy() && !dealing(), mine = p.hand || [], t = topCard();
    const n = mine.length, wide = innerWidth >= 700, cw = wide ? 74 : 54, rows = !wide && n > 9 ? 2 : 1, per = Math.ceil(n / rows);
    const room = Math.min(innerWidth - (wide ? 60 : 28), 980), gap = per > 1 ? Math.min(6, (room - per * cw) / (per - 1)) : 0;
    if (!turn) wild = -1;
    const can = c => turn && (S.stage === 'drawn' ? c === S.drawn : fits(c, t, S.col, S.owe));
    hand.style.setProperty('--gap', gap.toFixed(1) + 'px');
    const btn = (c, k) => `<button type="button" class="pp-card${can(c) ? ' ok' : ''}${c === wild ? ' sel' : ''}${c === S.drawn ? ' new' : ''}${k % per === 0 ? ' first' : ''}" data-a="card" data-c="${c}"${can(c) ? '' : ' aria-disabled="true"'}>${cardHtml(c, { cls: 'big' })}</button>`;
    setHtml(hand, Array.from({ length: rows }, (_, r) => `<div class="pp-rowc">${mine.slice(r * per, (r + 1) * per).map((c, k) => btn(c, k)).join('')}</div>`).join(''));
    hand.classList.toggle('two', rows === 2); hand.classList.toggle('turn', turn);
    const callBtn = canCall() ? `<button type="button" class="btn big y pp-pulse" data-a="call">${L('Last one!', 'Ostatnia!')}</button>` : '';
    if (dealing() || S.stage === 'deal') setHtml(ctl, `<span class="pp-wait"><span>${L(`Dealing the cards…`, `Rozdawanie kart…`)}</span></span>`);
    else if (turn && wild >= 0) {
      setHtml(ctl, `<div class="pp-go pp-cols">${[0, 1, 2, 3].map(i => `<button type="button" class="btn big pp-colb" style="--el:${HEX[i]}" data-a="col" data-i="${i}">${colName(i)}</button>`).join('')}
        <button type="button" class="btn big ghost" data-a="nocol">${L('Back', 'Wróć')}</button></div><p class="pp-hint">${faceOf(wild) === ROCK ? L('Pick the colour that comes next. The next player takes 4.', 'Wybierz kolor, który będzie dalej. Następny gracz dobiera 4.') : L('Pick the colour that comes next.', 'Wybierz kolor, który będzie dalej.')}</p>`);
    } else if (turn) {
      const opts = S.stage === 'drawn' ? [S.drawn] : playable(mine, t, S.col, S.owe);
      let hint, main;
      if (S.stage === 'drawn') { main = `<button type="button" class="btn big" data-a="keep">${L('Keep it', 'Zatrzymaj')}</button>`; hint = L(`You drew ${esc(faceName(S.drawn))}. It fits: tap it to play it now, or keep it.`, `Dobierasz: ${esc(faceName(S.drawn))}. Pasuje: dotknij jej, żeby ją od razu zagrać, albo ją zatrzymaj.`); }
      else if (S.owe > 0) { main = `<button type="button" class="btn big r" data-a="draw">${L(`Take ${S.owe}`, `Weź ${S.owe}`)}</button>`; hint = opts.length ? L(`Pass it on with a ${faceOf(t) === GIFT ? 'Gift or a Rockslide' : 'Rockslide'}, or take all ${S.owe}.`, `Przekaż dalej ${faceOf(t) === GIFT ? 'Prezentem albo Lawiną' : 'Lawiną'} albo weź wszystkie (${S.owe}).`) : L(`You have nothing to pass it on with: take ${S.owe}.`, `Nie masz czym przekazać dalej: weź ${S.owe}.`); }
      else { main = `<button type="button" class="btn big${opts.length ? ' ghost' : ' r'}" data-a="draw">${L('Draw a card', 'Dobierz kartę')}</button>`; hint = opts.length ? L(`Play ${S.col === 1 ? 'an' : 'a'} ${esc(colName(S.col))} card, a matching ${faceOf(t) <= 9 ? 'number' : 'sign'} or a grey wild card.`, `Zagraj kartę ${esc(colName(S.col))}, pasującą ${faceOf(t) <= 9 ? 'liczbę' : 'akcję'} albo szarą kartę dowolnego koloru.`) : L('Nothing fits. Draw a card.', 'Nic nie pasuje. Dobierz kartę.'); }
      const say = opts.length ? callBtn : ''; // nothing to play yet: no need to call
      if (say && n === 2) hint = L('Two cards left: say “Last one!” before you play, or you can be caught.', 'Zostały dwie karty: powiedz „Ostatnia!”, zanim zagrasz, bo inaczej ktoś cię złapie.');
      setHtml(ctl, `<div class="pp-go">${say}${main}</div><p class="pp-hint">${hint}</p>`);
    } else if (S.turn >= 0) {
      const w = S.seats[S.turn];
      setHtml(ctl, `${callBtn ? `<div class="pp-go">${callBtn}</div>` : ''}<span class="pp-wait">${avatarHtml(w.color, w.av, 30)}<span>${S.turn === S.me ? (p.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`);
    } else setHtml(ctl, '');
    // anyone may catch a player who forgot "Last one!"
    setHtml($('pp-catch'), canCatch() ? `<button type="button" class="btn big r pp-pulse" data-a="catch">${L(`Catch ${nameOf(S.open)}!`, `Złap: ${nameOf(S.open)}!`)}</button>` : '');
    layout();
  }

  function renderBanner() {
    const el = $('pp-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), tl = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? (S.win === S.me ? L('You are out of cards!', 'Pozbywasz się wszystkich kart!') : L(`${nameOf(S.win)} is out of cards!`, `${nameOf(S.win)} nie ma już kart!`)) : '';
    else if (S.stage === 'deal') msg = S.turn === S.me ? L('Dealing · you start', 'Rozdawanie · zaczynasz') : L(`Dealing · ${nameOf(S.turn)} starts`, `Rozdawanie · zaczyna ${nameOf(S.turn)}`);
    else if (myTurn()) msg = (S.owe ? L(`Your turn · take ${S.owe} or pass it on`, `Twoja kolej · weź ${S.owe} albo przekaż dalej`) : S.stage === 'drawn' ? L('Play the card you drew, or keep it', 'Zagraj dobraną kartę albo ją zatrzymaj') : L('Your turn', 'Twoja kolej')) + tl;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  // the colour in play and the direction, over the played cards; how many are left in the deck
  function renderTop() {
    const el = $('pp-top'), d = $('pp-deck'), show = S.ph === 'play' && S.stage !== 'deal';
    el.hidden = d.hidden = !show; if (!show) return;
    setHtml(el, `<b style="--el:${HEX[S.col]}">${colDot(S.col)}${colName(S.col)}</b><span class="dir" title="${S.dir > 0 ? L('Play goes clockwise', 'Gra idzie zgodnie z ruchem wskazówek zegara') : L('Play goes anticlockwise', 'Gra idzie przeciwnie do ruchu wskazówek zegara')}">${S.dir > 0 ? I.cw : I.ccw}</span>${S.owe ? `<em>+${S.owe}</em>` : ''}`);
    setHtml(d, `${I.cards}${S.stockN}`);
  }

  function render() {
    if (!S) return;
    $('pp-info').textContent = S.ph === 'end' ? L(`${S.res?.moves || S.mv} moves played`, `ruchów: ${S.res?.moves || S.mv}`) : L(`${S.seats.length} players${S.stack === 'on' ? ' · passing on' : ''}`, `graczy: ${S.seats.length}${S.stack === 'on' ? ' · przekazywanie' : ''}`);
    $('pp-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner(); renderTop();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pp-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'play') {
      e.s === S.me ? sfx.place() : sfx.pop();
      const f = faceOf(e.c);
      if (isWild(e.c)) { sfx.set(); big(f === ROCK ? L('Rockslide!', 'Lawina!') : L('Pebble!', 'Kamyk!'), `${colDot(e.col)} ${L(`${e.s === S.me ? 'You pick' : nameOf(e.s) + ' picks'} ${colName(e.col)}`, `${e.s === S.me ? 'Wybierasz' : nameOf(e.s) + ' wybiera'}: ${colName(e.col)}`)}`, 1500); }
    } else if (e.t === 'turn') { sfx.set(); big(L('Turnabout!', 'Zawrotka!'), e.dir > 0 ? L('Play goes clockwise now', 'Teraz zgodnie z ruchem wskazówek zegara') : L('Play goes the other way now', 'Teraz w drugą stronę'), 1300); }
    else if (e.t === 'skip') { scene?.cue(e.s, 'skip'); if (e.s === S.me) big(L('You miss a turn', 'Tracisz kolejkę'), '', 1300); else floatAt(e.s, 'zZ'); }
    else if (e.t === 'draw') {
      sfx.draw(); if (e.k > 1) setTimeout(() => !destroyed && sfx.draw(), 140);
      if (e.why && e.k) { if (e.s === S.me) big(`+${e.k}`, e.why === 'rock' ? L('A Rockslide! You take 4', 'Lawina! Dobierasz 4') : e.why === 'gift' ? L('A Gift for you: take 2', 'Prezent dla ciebie: dobierasz 2') : L(`You take ${cardsWord(e.k)}`, `Dobierasz ${cardsWord(e.k)}`), 1400); else floatAt(e.s, '+' + e.k); }
    } else if (e.t === 'call') { scene?.cue(e.s, 'call'); sfx.set(); if (e.s === S.me) big(L('Last one!', 'Ostatnia!'), L('Everyone knows you are nearly out', 'Wszyscy wiedzą, że już prawie kończysz'), 1300); else ctx.toast(L(`${nameOf(e.s)}: “Last one!”`, `${nameOf(e.s)}: „Ostatnia!”`)); }
    else if (e.t === 'catch') {
      scene?.cue(e.s, 'catch'); sfx.lose?.();
      big(e.s === S.me ? L('Caught!', 'Złapany!') : L(`${nameOf(e.s)} is caught!`, `${nameOf(e.s)} złapany!`), L(`${e.by === S.me ? 'You' : nameOf(e.by)} noticed the missing “Last one!” · +${e.k}`, `${e.by === S.me ? 'Zauważasz' : nameOf(e.by) + ' zauważa'} brak „Ostatnia!” · +${e.k}`), 1700);
    } else if (e.t === 'reshuffle') ctx.toast(L('The played cards are shuffled into a new deck', 'Zagrane karty tasują się w nową talię'));
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } else sfx.lose?.();
      big(e.w === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(e.w)} wins!`, `${nameOf(e.w)} wygrywa!`), S.res?.called ? L('The table was called: fewest points left wins', 'Stół zamknięty: wygrywa najmniej punktów w ręce') : L('First one out of cards', 'Pierwszy bez kart'), 2200);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s;
    const p = me(); if (p?.hand) preload(p.hand);
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; wild = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'deal' && s.dealLeft > 500) {
        dealUntil = performance.now() + s.dealLeft; let k = 0;
        const flick = () => { if (destroyed || k++ > 7 || !dealing()) return; sfx.draw(); setTimeout(flick, 230); }; flick();
        clearTimeout(dealTimer); dealTimer = setTimeout(() => { if (!destroyed && S) render(); }, s.dealLeft + 30);
      }
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (!fresh && myTurn() && was !== s.turn + '/' + s.stage + '/' + s.mv) { if (s.stage === 'play') sfx.turn(); lastTick = -1; sent = 0; wild = -1; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    const head = S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `${nameOf(S.win)} wygrywa!`);
    const sub = S.res.called ? L('The table was called after a very long game: fewest points left wins.', 'Gra trwała bardzo długo, więc stół został zamknięty: wygrywa najmniej punktów w ręce.')
      : myPlace > 1 ? L(`You came ${ORD(myPlace)} of ${n}. Everyone after the winner is placed by the points left in their hand.`, `Twoje miejsce: ${myPlace} z ${n}. Po zwycięzcy liczą się punkty kart w ręce: im mniej, tym lepiej.`) : myPlace === 1 ? L('First one out of cards.', 'Pierwszy bez kart.') : '';
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub} ${L(`${S.res.moves} moves in all.`, `Łącznie ruchów: ${S.res.moves}.`)}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = p.st, left = p.hand || [];
        return `<li class="${k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${st.played} played · ${st.drawn} drawn${st.caught ? ` · caught ${st.caught}×` : ''}`, `zagrane: ${st.played} · dobrane: ${st.drawn}${st.caught ? ` · złapany ${st.caught}×` : ''}`)}</span>
          ${left.length ? `<span class="pp-left">${left.slice(0, 12).map(mini).join('')}${left.length > 12 ? `<small>+${left.length - 12}</small>` : ''}</span>` : ''}</div>
          <strong><span>${left.length ? L(`${S.res.pts[i]} pts`, `${S.res.pts[i]} pkt`) : L('Out!', 'Bez kart!')}</span><small>${left.length ? cardsWord(left.length) : ''}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'))}</div></div>`;
    fillCards(el);
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
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return;
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q); // full phone resolution is 4x the pixels for no visible gain
    const cols = [...HEX, '#fff4e2', '#ff8fab'];
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
    if (sent && !busy()) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go(a) {
    if (!myTurn() || dealing() || busy()) return;
    sent = Date.now(); wild = -1; sfx.click(); ctx.act(a); renderDock();
  }
  function tapCard(c) {
    const p = me(); if (!myTurn() || dealing() || busy() || !p) return false;
    const ok = S.stage === 'drawn' ? c === S.drawn : fits(c, topCard(), S.col, S.owe);
    if (!ok) return false;
    if (isWild(c)) { wild = c; sfx.click(); renderDock(); return true; } // pick the colour first
    go({ t: 'play', c }); return true;
  }
  function call() { if (!canCall()) return; sfx.click(); ctx.act({ t: 'call' }); me().called = true; renderDock(); }
  function caught() { if (!canCatch()) return; sfx.click(); ctx.act({ t: 'catch' }); }
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || !S) return;
    const k = e.key.toLowerCase();
    if (k === 'l') call();
    else if (k === 'c') caught();
    else if (!myTurn()) return;
    else if (k === 'd') { if (S.stage === 'play') go({ t: 'draw' }); }
    else if (k === 'k') { if (S.stage === 'drawn') go({ t: 'keep' }); }
    else if (wild >= 0 && '1234'.includes(k)) go({ t: 'play', c: wild, col: +k - 1 });
    else if (k === 'enter' && !e.target.closest?.('button')) { const o = S.stage === 'drawn' ? [S.drawn] : playable(me().hand, topCard(), S.col, S.owe).sort((a, b) => isWild(a) - isWild(b)); if (o.length) tapCard(o[0]); }
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderDock(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'card') { if (!tapCard(+b.dataset.c) && myTurn()) { sfx.bad?.(); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); } }
    else if (a === 'col') { if (wild >= 0) go({ t: 'play', c: wild, col: +b.dataset.i }); }
    else if (a === 'nocol') { wild = -1; sfx.click(); renderDock(); }
    else if (a === 'draw') go({ t: 'draw' });
    else if (a === 'keep') go({ t: 'keep' });
    else if (a === 'call') call();
    else if (a === 'catch') caught();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pp-card.ok');
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
