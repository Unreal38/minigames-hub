// Pawperty game view: HUD over the 3D board. Renders what the server says and sends your choices.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, PL, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { TILES, GROUPS, STREET, CARDS, PET_NAME, LV_NAMES, LV_MAX, BATH_FEE, PASS_GO, MS, rentOf, fullStreet } from './board.js';
import { nameHtml, titleHtml, frameCls, cardBg, cardBgCls, pbSync } from '../../cosmetics.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  // a treat: the game's money
  bone: '<svg class="pw-bone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 4.2a2.7 2.7 0 0 1 2.6 3.3l7.7 7.7a2.7 2.7 0 1 1 1 4.6 2.7 2.7 0 1 1-4.6-1L5.2 11.1a2.7 2.7 0 1 1-1-4.6 2.7 2.7 0 0 1 2-2.3z" fill="#e2a868" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  tub: '<svg class="pw-ico" viewBox="0 0 24 24" aria-label="' + L('in the bath', 'w kąpieli') + '"><path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" fill="#8fd4ff" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="7" r="2" fill="#fff" stroke="currentColor" stroke-width="1.5"/><circle cx="13" cy="5" r="1.4" fill="#fff" stroke="currentColor" stroke-width="1.5"/></svg>',
  duck: '<svg class="pw-ico" viewBox="0 0 24 24" aria-label="' + L('has a rubber duck', 'ma gumową kaczkę') + '"><path d="M4 14c0 4 3 6 8 6s8-2 8-6c-2 1-4 1-6 0 1-1 2-3 1-5a4 4 0 0 0-7 1c-1 0-3 0-3 1s1 1 2 1c0 1-1 2-3 2z" fill="#ffd84a" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  eyes: '<svg class="pw-ico" viewBox="0 0 24 24" aria-label="' + L('next rent is free', 'następny czynsz za darmo') + '"><circle cx="8" cy="12" r="4.4" fill="#fff" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="12" r="4.4" fill="#fff" stroke="currentColor" stroke-width="1.8"/><circle cx="8.6" cy="12.6" r="2.3" fill="currentColor"/><circle cx="16.6" cy="12.6" r="2.3" fill="currentColor"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const treats = n => `<span class="pw-t">${I.bone}${n}</span>`;

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./paw.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pw">
    <canvas class="g3d" aria-label="${L(`The Pawperty board. Tap a tile to read about it.`, `Plansza Łapolis. Dotknij pola, żeby o nim przeczytać.`)}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="pw-info"></span></div>
      <div class="tr"><span class="tcode" id="pw-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pw-banner" aria-live="polite"></div>
      <ol class="pw-list" id="pw-list" aria-label="${L(`Players and their treats`, `Gracze i ich przysmaki`)}"></ol>
      <div class="pw-log" id="pw-log" aria-hidden="true"></div>
      <div class="pw-deed" id="pw-deed" hidden></div>
      <div class="pw-aim" id="pw-aim" hidden></div>
      <div class="pw-zoom" id="pw-zoom" hidden></div>
      <div class="shout" id="pw-big" aria-live="assertive"></div>
      <div class="pw-dock" id="pw-dock"><div class="pw-build" id="pw-build"></div><div class="pw-ctl" id="pw-ctl"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pw'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, pics = {};
  let resultsTimer = 0, bigTimer = 0, zoomTimer = 0, endsAt = 0, lastTick = -1, sent = 0, pinned = -1, cash = [], logLines = [], cardN = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame: info => { live = info; paintAim(info); }, onStep: s => { if (S && (s === S.me || s === S.turn)) sfx.tick(); }, onThumbs: t => { pics = t; if (S) render(); } });
    layout(); if (S) scene.setState(S);
    globalThis.__pwDebug?.(scene);
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  // a little flag over the tile the roll leads to
  let aimKey = '';
  function paintAim(info) {
    const el = $('pw-aim'), on = !!(info.aimOn && S && S.ph === 'play' && info.aim);
    if (!on) { if (aimKey) { aimKey = ''; el.hidden = true; } return; }
    const a = info.aim, key = a.i + '/' + a.s;
    if (key !== aimKey) { aimKey = key; const t = TILES[a.i]; el.innerHTML = `${a.s === S.me ? L('You land on', 'Stajesz na polu') : L('Lands on', 'Staje na polu')} <b>${esc(t.name)}</b>`; el.style.setProperty('--c', S.seats[a.s]?.color || '#fff'); el.hidden = false; }
    el.style.transform = `translate(${Math.round(Math.max(90, Math.min(info.w - 90, a.x)) / uiz())}px, ${Math.round(Math.max(70, a.y) / uiz())}px) translate(-50%, -100%)`; // inside the (zoomed) HUD
  }
  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));
  const yours = i => (i === S.me ? 'your' : nameOf(i) + '’s');
  const mine = () => !!(S && S.ph === 'play' && S.turn === S.me && me() && !me().bot);
  const myTurn = () => mine() && ['roll', 'buy', 'done'].includes(S.stage);
  // raising treats: what I owe right now (the game waits while I pick what to sell)
  const myDebt = () => (S && S.ph === 'play' && S.stage === 'raise' && me() && !me().bot ? (S.debts || []).filter(d => d.s === S.me) : []);
  const owing = () => myDebt().length > 0;
  const toWhom = d => (d.to >= 0 ? (d.to === S.me ? L('you', 'ciebie') : nameOf(d.to)) : d.to === -2 ? L('the jar', 'słoik') : L('the bank', 'bank'));
  const busy = () => Date.now() - sent < 900;
  const shopName = i => esc(TILES[i].name), petName = i => PET_NAME[TILES[i].pet];
  const pic = (i, cls = '') => (pics[TILES[i].pet] ? `<img class="pw-pet ${cls}" src="${pics[TILES[i].pet]}" alt="${petName(i)}">` : `<span class="pw-pet none ${cls}" style="background:${GROUPS[TILES[i].g].col}"></span>`);

  // The board keeps one size all game: room is kept for the buttons, and the upgrade strip floats over the lawn's edge.
  function layout() {
    if (!scene) return;
    const wide = innerWidth >= 1100, phone = innerWidth < 700;
    const z = uiz();
    scene.setHud((phone ? 150 : 112) * z, (wide ? 250 : 0) * z, wide ? 76 * z : Math.max((phone ? 164 : 128) * z, $('pw-list').getBoundingClientRect().bottom + 12));
  }

  // ----- what happened, in words -----
  // the same lines in Polish: present tense, with a "you" and a "they" form of each verb
  function sayPl(e) {
    const i = e.i, s = e.s === S.me, W = (you, they) => (s ? you : `${nameOf(e.s)} ${they}`);
    switch (e.t) {
      case 'go': return `${W('Mijasz Wycieraczkę', 'mija Wycieraczkę')}: +${e.amt}`;
      case 'buy': return `${W('Adoptujesz zwierzaka', 'adoptuje zwierzaka')}: ${petName(i)} (${shopName(i)})`;
      case 'skip': return `${W('Zostawiasz zwierzaka w pudełku', 'zostawia zwierzaka w pudełku')}: ${petName(i)}`;
      case 'poor': return `${W('Nie stać cię na sklepik', 'nie ma na sklepik')}: ${shopName(i)}`;
      case 'rent': return e.o === S.me ? `${nameOf(e.s)} płaci ci ${e.amt} czynszu (${shopName(i)})` : `${W('Płacisz', 'płaci')} ${e.amt} czynszu (${shopName(i)}, właściciel: ${nameOf(e.o)})`;
      case 'tiptoe': return `Ciii! ${petName(i)} drzemie. ${W('Przechodzisz na paluszkach za darmo', 'przechodzi na paluszkach za darmo')}`;
      case 'eyes': return `${W('Robisz maślane oczy', 'robi maślane oczy')}: ${petName(i)} nie bierze czynszu`;
      case 'rub': return `${petName(i)} cieszy się na ${s ? 'twój widok' : 'widok gracza ' + nameOf(e.s)}: +${e.amt}`;
      case 'card': return W('Dobierasz kartę Głupawki', 'dobiera kartę Głupawki');
      case 'vet': return W(`Płacisz weterynarzowi ${e.amt}`, `płaci weterynarzowi ${e.amt}`);
      case 'bowl': return `${W('Znajdujesz pełną miskę przysmaków', 'znajduje pełną miskę przysmaków')}: +${e.amt}`;
      case 'lost': return e.amt ? W(`Zabierasz ${e.amt} ze słoika Znalezione!`, `zabiera ${e.amt} ze słoika Znalezione!`) : 'Słoik Znalezione był pusty';
      case 'mud': return W('Wskakujesz w błotną kałużę', 'wskakuje w błotną kałużę');
      case 'bath': return W('Idziesz do Kąpieli', 'idzie do Kąpieli');
      case 'duck': return W('Piszczysz gumową kaczką i omijasz kąpiel', 'piszczy gumową kaczką i omija kąpiel');
      case 'free': return e.how === 'dbl' ? W('Wyrzucasz dublet i wyskakujesz z wanny', 'wyrzuca dublet i wyskakuje z wanny') : W(`Płacisz ${e.amt} i wychodzisz z wanny`, `płaci ${e.amt} i wychodzi z wanny`);
      case 'soak': return W('Dalej się moczysz', 'dalej się moczy');
      case 'three': return `Trzy dublety z rzędu! ${W('Za dużo emocji', 'ma za dużo emocji')}`;
      case 'again': return W('Rzucasz jeszcze raz', 'rzuca jeszcze raz');
      case 'build': return `${W('Budujesz', 'buduje')}: ${LV_NAMES[e.lv]} (${shopName(i)})`;
      case 'sellup': return `${W('Sprzedajesz ulepszenie, żeby zapłacić', 'sprzedaje ulepszenie, żeby zapłacić')} (${shopName(i)})`;
      case 'sell': return `${W('Oddajesz sklepik, żeby zapłacić', 'oddaje sklepik, żeby zapłacić')} (${shopName(i)})`;
      case 'raise': return e.who.length === 1 ? (e.who[0] === S.me ? 'Brakuje ci przysmaków: wybierz, co sprzedać' : `${nameOf(e.who[0])} wybiera, co sprzedać, żeby zapłacić`) : 'Kilku graczy wybiera, co sprzedać, żeby zapłacić';
      case 'paid': return `${W('Spłacasz', 'spłaca')} ${e.amt} (${e.to >= 0 ? (e.to === S.me ? 'dla ciebie' : 'dla: ' + nameOf(e.to)) : e.to === -2 ? 'do słoika' : 'do banku'})`;
      case 'forgive': return `Życzliwy sąsiad daruje ${s ? 'ci' : 'graczowi ' + nameOf(e.s)} ${e.amt} przysmaków`;
      case 'naps': return e.tiles.length ? cnt(e.tiles.length, '', '', 'zwierzak przysnął', 'zwierzaki przysnęły', 'zwierzaków przysnęło') : '';
      case 'topdog': return W('Już prowadzisz', 'już prowadzi');
      case 'sit': return W('Przejmujesz miejsce bota', 'przejmuje miejsce bota');
      default: return '';
    }
  }
  function say(e) {
    const A = youOr(e.s), i = e.i, s = e.s === S.me;
    if (PL) return sayPl(e);
    switch (e.t) {
      case 'go': return `${A} passed the Welcome Mat: +${e.amt}`;
      case 'buy': return `${A} adopted ${petName(i)} and the ${shopName(i)}`;
      case 'skip': return `${A} left ${petName(i)} in the box`;
      case 'poor': return `${A} can’t afford the ${shopName(i)}`;
      case 'rent': return `${A} paid ${e.o === S.me ? 'you' : nameOf(e.o)} ${e.amt} at the ${shopName(i)}`;
      case 'tiptoe': return `Shh! ${petName(i)} is napping. ${A} tiptoe${s ? '' : 's'} past for free`;
      case 'eyes': return `${A} did puppy eyes at ${petName(i)}: no rent`;
      case 'rub': return `${petName(i)} was happy to see ${s ? 'you' : nameOf(e.s)}: +${e.amt}`;
      case 'card': return `${A} drew a Zoomies card`;
      case 'vet': return `${A} paid the vet ${e.amt}`;
      case 'bowl': return `${A} found a full treat bowl: +${e.amt}`;
      case 'lost': return e.amt ? `${A} found ${e.amt} treats in the Lost & Found!` : `The Lost & Found jar was empty`;
      case 'mud': return `${A} jumped in a muddy puddle`;
      case 'bath': return `${A} ${s ? 'are' : 'is'} off to Bath Time`;
      case 'duck': return `${A} squeaked ${s ? 'your' : 'a'} rubber duck and skipped the bath`;
      case 'free': return e.how === 'dbl' ? `${A} rolled doubles and hopped out of the tub` : `${A} paid ${e.amt} to get out of the tub`;
      case 'soak': return `${A} ${s ? 'are' : 'is'} still soaking`;
      case 'three': return `Three doubles in a row! ${A} got too excited`;
      case 'again': return `${A} roll${s ? '' : 's'} again`;
      case 'build': return `${A} built a ${LV_NAMES[e.lv]} at the ${shopName(i)}`;
      case 'sellup': return `${A} sold an upgrade at the ${shopName(i)} to pay up`;
      case 'sell': return `${A} gave the ${shopName(i)} back to pay up`;
      case 'raise': return e.who.length === 1 ? (e.who[0] === S.me ? 'You are short of treats: pick what to sell' : `${nameOf(e.who[0])} is picking what to sell to pay up`) : 'A few players are picking what to sell to pay up';
      case 'paid': return `${A} paid up ${e.amt} to ${e.to >= 0 ? (e.to === S.me ? 'you' : nameOf(e.to)) : e.to === -2 ? 'the jar' : 'the bank'}`;
      case 'forgive': return `A kind neighbour let ${s ? 'you' : nameOf(e.s)} off ${e.amt} treats`;
      case 'naps': return e.tiles.length ? `${e.tiles.length} pet${e.tiles.length === 1 ? '' : 's'} dozed off` : '';
      case 'topdog': return `${A} ${s ? 'are' : 'is'} already top dog`;
      case 'sit': return `${A} took over a bot`;
      default: return '';
    }
  }
  function log(html) {
    if (!html) return;
    logLines.push(html); if (logLines.length > 5) logLines.shift();
    $('pw-log').innerHTML = logLines.map((l, k) => `<div${k === logLines.length - 1 ? ' class="new"' : ''}>${l}</div>`).join('');
  }
  function floatAt(i, text, bad) {
    const t = live?.toks?.[i]; if (!t) return;
    const f = document.createElement('div');
    f.className = 'pw-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${Math.max(30, Math.min(innerWidth - 30, t.x))}px`; f.style.top = `${Math.max(120, t.y)}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  // ----- players -----
  function renderList() {
    setHtml($('pw-list'), S.seats.map((p, i) => {
      const n = S.own.filter(o => o === i).length, now = i === S.turn && S.ph === 'play';
      const sets = GROUPS.map((g, k) => (fullStreet(k, i, S.own) ? `<i style="background:${g.col}" title="${g.name}"></i>` : '')).join('');
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' pw-me' : ''}${cardBgCls(p.fl, 1)}" style="--c:${esc(p.color)}">${cardBg(p.fl)}${avatarHtml(p.color, p.av, 34)}<div><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
        <span class="pw-row">${treats(p.cash)}<em>${cnt(n, 'shop', 'shops', 'sklepik', 'sklepiki', 'sklepików')}</em>${sets ? `<span class="pw-sets">${sets}</span>` : ''}${p.inBath ? I.tub : ''}${p.duck ? I.duck : ''}${p.eyes ? I.eyes : ''}</span></div></li>`;
    }).join(''));
    pbSync($('pw-list'));
  }

  // ----- the card for one tile -----
  function deedHtml(i, offer) {
    const t = TILES[i];
    if (t.k !== 'shop') return `<div class="pw-dhead" style="background:#ffb547"><b>${esc(t.name)}</b></div><p>${esc(t.blurb)}${t.k === 'lost' ? L(` There ${S.jar === 1 ? 'is' : 'are'} ${treats(S.jar)} in the jar now.`, ` Teraz w słoiku: ${treats(S.jar)}.`) : ''}</p>`;
    const G = GROUPS[t.g], o = S.own[i], lv = S.lv[i], full = o >= 0 && fullStreet(t.g, o, S.own), have = STREET[t.g].filter(j => o >= 0 ? S.own[j] === o : S.own[j] === S.me).length;
    const row = (k, label, val) => `<li class="${o >= 0 && lv === k ? 'on' : ''}"><span>${label}</span>${treats(val)}</li>`;
    const who = o < 0 ? (offer ? '' : `<p class="pw-own">${L('Nobody has adopted this one yet.', 'Tego zwierzaka nikt jeszcze nie adoptował.')}</p>`)
      : `<p class="pw-own"><i style="background:${esc(S.seats[o].color)}"></i>${o === S.me ? L('Yours', 'Twój') : L(`${nameOf(o)}’s`, `Właściciel: ${nameOf(o)}`)}${S.nap[i] ? L(' · napping, no rent', ' · drzemie, bez czynszu') : ` · ${L('rent now', 'czynsz teraz')} ${treats(rentOf(i, S.own, S.lv))}`}</p>`;
    return `<div class="pw-dhead" style="background:${G.col};color:${G.ink}"><span>${G.name}</span><b>${esc(t.name)}</b></div>
      <div class="pw-dbody"><div>${pic(i)}<p class="pw-run">${L('Run by', 'Prowadzi:')} <b>${petName(i)}</b></p>${who}
        <ul class="pw-rents">${row(0, full ? L('Rent (street ×2)', 'Czynsz (uliczka ×2)') : L('Rent', 'Czynsz'), t.rent[0] * (full ? 2 : 1))}${row(1, LV_NAMES[1], t.rent[1] * (full ? 2 : 1))}${row(2, LV_NAMES[2], t.rent[2] * (full ? 2 : 1))}${row(3, LV_NAMES[3], t.rent[3])}</ul>
        <p class="pw-small">${L('Costs', 'Cena')} ${treats(t.price)} · ${L('each upgrade', 'każde ulepszenie')} ${treats(t.up)} · ${o < 0 || o === S.me ? L(`you have ${have} of 3 on this street`, `masz ${have} z 3 na tej uliczce`) : L(`${have} of 3 on this street`, `${have} z 3 na tej uliczce`)}</p></div></div>`;
  }
  function renderDeed() {
    const el = $('pw-deed'), offer = S.ph === 'play' && S.stage === 'buy' ? S.offer : -1, i = pinned >= 0 ? pinned : offer;
    el.hidden = i < 0;
    if (i < 0) { el._h = ''; return; }
    setHtml(el, deedHtml(i, i === offer && pinned < 0) + (pinned >= 0 ? '<button type="button" class="round pw-x" data-a="unpin" aria-label="' + L('Close', 'Zamknij') + '">×</button>' : ''));
    el.classList.toggle('offer', pinned < 0);
  }

  // ----- controls -----
  function renderDock() {
    const p = me(), ctl = $('pw-ctl'), bld = $('pw-build');
    if (!S || S.ph !== 'play') { setHtml(ctl, ''); setHtml(bld, ''); return; }
    const t = S.seats[S.turn];
    if (S.stage === 'raise') { renderRaise(ctl, bld); layout(); return; }
    if (myTurn() && !busy()) {
      if (S.stage === 'roll' && p.inBath) setHtml(ctl, `<p class="pw-hint">${L(`You are in the tub. Roll doubles to hop out${p.tries ? ` (${3 - p.tries} tr${3 - p.tries === 1 ? 'y' : 'ies'} left)` : ''}, or pay your way out.`, `Siedzisz w wannie. Wyrzuć dublet, żeby wyskoczyć${p.tries ? ` (zostało prób: ${3 - p.tries})` : ''}, albo zapłać za wyjście.`)}</p>
        <div class="pw-go"><button type="button" class="btn big" data-a="roll">${L(`Roll for doubles`, `Rzuć na dublet`)}</button>${p.cash >= BATH_FEE ? `<button type="button" class="btn big w" data-a="pay">${L('Pay', 'Zapłać')} ${treats(BATH_FEE)}${L(' to hop out', ', żeby wyjść')}</button>` : ''}</div>`);
      else if (S.stage === 'roll') setHtml(ctl, `<div class="pw-go"><button type="button" class="btn big pw-pulse" data-a="roll">${L(`Roll the dice`, `Rzuć kośćmi`)}</button></div>`);
      else if (S.stage === 'buy') setHtml(ctl, `<div class="pw-go"><button type="button" class="btn big" data-a="buy">${L('Adopt for', 'Adoptuj za')} ${treats(TILES[S.offer].price)}</button><button type="button" class="btn big w" data-a="pass">${L(`No thanks`, `Nie, dziękuję`)}</button></div>`);
      else setHtml(ctl, `<div class="pw-go"><button type="button" class="btn big" data-a="end">${L(`End turn`, `Zakończ turę`)}</button></div>`);
    } else if (S.turn >= 0) {
      const what = S.stage === 'buy' ? L(`is looking at the ${shopName(S.offer)}`, `ogląda sklepik: ${shopName(S.offer)}`) : S.stage === 'card' ? L('drew a Zoomies card', 'dobiera kartę Głupawki') : S.stage === 'roll' ? (t.inBath ? L('is in the tub', 'siedzi w wannie') : L('is about to roll', 'zaraz rzuca')) : S.stage === 'done' ? L('is finishing up', 'kończy turę') : L('is on the move', 'jest w drodze');
      setHtml(ctl, `<span class="pw-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p?.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : S.stage === 'walk' ? L('Off you go…', 'W drogę…') : S.stage === 'card' ? L('Zoomies!', 'Głupawka!') : '…') : `${nameOf(S.turn)} ${what}`}</span></span>`);
    } else setHtml(ctl, '');
    const can = myTurn() && !busy() ? S.can : [];
    setHtml(bld, can.length ? `<span class="pw-blbl">${L(`Upgrade a shop`, `Ulepsz sklepik`)}</span><div class="pw-ups">${can.map(i => { const t2 = TILES[i], lv = S.lv[i] + 1;
      return `<button type="button" data-a="build" data-i="${i}" style="--g:${GROUPS[t2.g].col}">${pic(i, 'sm')}<span><b>${LV_NAMES[lv]}</b><small>${esc(t2.name)} · ${treats(t2.up)}</small></span></button>`; }).join('')}</div>` : '');
    layout();
  }

  // Short of treats: every shop you own, with what selling its top upgrade or the whole shop brings in.
  function renderRaise(ctl, bld) {
    const debt = myDebt(), p = me();
    if (!debt.length) {
      const who = [...new Set((S.debts || []).map(d => d.s))].filter(i => i !== S.me);
      const w = who[0] ?? S.turn, wp = S.seats[w];
      setHtml(ctl, `<span class="pw-wait">${avatarHtml(wp.color, wp.av, 30)}<span>${who.length > 1 ? L('Players are picking what to sell…', 'Gracze wybierają, co sprzedać…') : L(`${nameOf(w)} is picking what to sell…`, `${nameOf(w)} wybiera, co sprzedać…`)}</span></span>`);
      setHtml(bld, ''); return;
    }
    const owe = debt.reduce((t, d) => t + d.amt, 0), short = Math.max(0, owe - p.cash), d0 = debt[0];
    const why = d0.why === 'rent' ? L(`Rent at the ${shopName(d0.i)} for ${toWhom(d0)}`, `Czynsz: ${shopName(d0.i)} (dla: ${toWhom(d0)})`)
      : d0.why === 'vet' ? L('The vet bill', 'Rachunek u weterynarza') : d0.why === 'bath' ? L('The bath fee', 'Opłata za kąpiel') : L(`A Zoomies card: pay ${toWhom(d0)}`, `Karta Głupawki: zapłać (${toWhom(d0)})`);
    setHtml(ctl, `<p class="pw-hint pw-owe">${why}: ${treats(owe)}. ${L(`You have ${treats(p.cash)}, so you are`, `Masz ${treats(p.cash)}, więc brakuje ci`)} <b>${treats(short)}</b>${L(' short.', '.')}<br><small>${L('Pick what to sell. The game waits for you.', 'Wybierz, co sprzedać. Gra na ciebie czeka.')}</small></p>
      <div class="pw-go"><button type="button" class="btn big w" data-a="autosell">${L('Sell for me', 'Sprzedaj za mnie')}</button></div>`);
    const shops = S.own.map((o, i) => (o === S.me ? i : -1)).filter(i => i >= 0).sort((a, b) => TILES[a].g - TILES[b].g || a - b);
    const btn = (i, a, label, val) => `<button type="button" data-a="${a}" data-i="${i}" title="${esc(label)}" style="--g:${GROUPS[TILES[i].g].col}">${pic(i, 'sm')}<span><b>${label}</b><small>${esc(TILES[i].name)}</small></span><em class="pw-gain">+${treats(val)}</em></button>`;
    setHtml(bld, `<span class="pw-blbl">${L('Sell back at half price', 'Sprzedaj za pół ceny')}</span><div class="pw-ups pw-sells">${shops.map(i => {
      const t2 = TILES[i], lv = S.lv[i];
      return (lv ? btn(i, 'sellup', LV_NAMES[lv], t2.up / 2) : '')
        + btn(i, 'sell', lv ? L('Shop and upgrades', 'Sklepik z ulepszeniami') : L('Shop', 'Sklepik'), t2.price / 2 + t2.up / 2 * lv);
    }).join('')}</div>`);
  }

  function renderBanner() {
    const el = $('pw-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.left >= 0 && (myTurn() || owing()) ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${S.win === S.me ? 'You are top dog' : nameOf(S.win) + ' is top dog'}!`, S.win === S.me ? 'Wygrywasz!' : `Wygrywa ${nameOf(S.win)}!`) : '';
    else if (owing()) msg = L('Short of treats', 'Brakuje przysmaków') + t;
    else if (myTurn()) msg = (S.stage === 'buy' ? L(`Adopt ${petName(S.offer)}?`, `Adoptować zwierzaka (${petName(S.offer)})?`) : S.stage === 'done' ? L('Upgrade or end your turn', 'Ulepsz sklepik albo zakończ turę') : me().inBath ? L('Your turn · you are in the tub', 'Twoja kolej · siedzisz w wannie') : S.dbl ? L('Doubles! Roll again', 'Dublet! Rzuć jeszcze raz') : L('Your turn · roll the dice', 'Twoja kolej · rzuć kośćmi')) + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn() || owing());
  }

  function render() {
    if (!S) return;
    setHtml($('pw-info'), S.ph === 'end' ? L(`${S.rounds} rounds played`, `Rozegrane rundy: ${S.rounds}`) : `${L('Round', 'Runda')} ${S.round} ${L('of', 'z')} ${S.rounds}<span class="pw-jar"> · ${L('jar', 'słoik')} ${treats(S.jar)}</span>`);
    $('pw-code').textContent = Rm?.code || '';
    renderList(); renderDeed(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pw-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function showCard(c) {
    if (c.n === cardN) return; cardN = c.n;
    const left = MS.card + 700 - c.ago; if (left < 500) return;
    const el = $('pw-zoom');
    el.innerHTML = `<div class="pw-zcard"><span class="pw-ztop">${L('Zoomies!', 'Głupawka!')}</span><p>${esc(CARDS[c.id])}</p><span class="pw-zwho">${avatarHtml(S.seats[c.s].color, S.seats[c.s].av, 26)}${c.s === S.me ? L('Your card', 'Twoja karta') : L(nameOf(c.s) + '’s card', 'Karta gracza ' + nameOf(c.s))}</span></div>`;
    el.hidden = false; sfx.draw(); scene?.effect('card', { s: c.s });
    clearTimeout(zoomTimer); zoomTimer = setTimeout(() => { el.hidden = true; }, left);
  }

  function playEv(e) {
    const line = say(e); if (line) log(line);
    const s = e.s === S.me;
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(s ? L('You took over a bot. Good luck!', 'Przejmujesz miejsce bota. Powodzenia!') : L(`${nameOf(e.s)} took over a bot`, `${nameOf(e.s)} przejmuje miejsce bota`)); }
    else if (e.t === 'buy') { sfx.set(); if (s) big(L('Adopted!', 'Adopcja!'), L(`${petName(e.i)} moves in at the ${shopName(e.i)}`, `${petName(e.i)} wprowadza się (${shopName(e.i)})`)); }
    else if (e.t === 'rent') { if (s) { sfx.bad(); big(`−${e.amt}`, L(`Rent at ${yours(e.o)} ${shopName(e.i)}`, `Czynsz: ${shopName(e.i)} (${nameOf(e.o)})`), 1300); scene?.effect('ouch', { s: e.s }); } else if (e.o === S.me) { sfx.win(); big(`+${e.amt}`, L(`${nameOf(e.s)} pays you rent`, `${nameOf(e.s)} płaci ci czynsz`), 1300); scene?.effect('coins', { s: e.o }); } else sfx.plop(); }
    else if (e.t === 'tiptoe') { sfx.pop(); if (s || e.o === S.me) big(L('Shh…', 'Ciii…'), L(`${petName(e.i)} is napping: no rent`, `${petName(e.i)} drzemie: bez czynszu`), 1400); }
    else if (e.t === 'eyes') { sfx.pop(); if (s) big(L('Puppy eyes!', 'Maślane oczy!'), L('No rent this time', 'Tym razem bez czynszu'), 1300); }
    else if (e.t === 'rub') { sfx.pop(); scene?.effect('hearts', { i: e.i }); }
    else if (e.t === 'bowl') { sfx.set(); scene?.effect('coins', { s: e.s }); }
    else if (e.t === 'go') { sfx.set(); scene?.effect('coins', { s: e.s }); }
    else if (e.t === 'lost') { if (e.amt) { scene?.effect('jar'); scene?.effect('coins', { s: e.s, n: 24 }); s ? sfx.win() : sfx.set(); if (s) big(`+${e.amt}`, L('Finders keepers!', 'Znalezione, nie kradzione!'), 1500); } }
    else if (e.t === 'bath' || e.t === 'mud' || e.t === 'three') { sfx.warn(); if (s && e.t !== 'mud') big(L('Bath Time!', 'Kąpiel!'), e.t === 'three' ? L('Three doubles in a row', 'Trzy dublety z rzędu') : L('Into the tub you go', 'Marsz do wanny'), 1400); }
    else if (e.t === 'duck') { sfx.pop(); if (s) big(L('Squeak!', 'Kwak!'), L('Your rubber duck got you out of it', 'Gumowa kaczka ratuje cię przed kąpielą'), 1400); }
    else if (e.t === 'free') { sfx.set(); scene?.effect('splash'); }
    else if (e.t === 'build') { sfx.place(); }
    else if (e.t === 'sell' || e.t === 'sellup') { sfx.bad(); if (s) ctx.toast(say(e)); }
    else if (e.t === 'forgive') { if (s) ctx.toast(say(e)); }
    else if (e.t === 'again') { if (s) sfx.turn(); }
    else if (e.t === 'naps') { if (e.tiles.length) sfx.plop(); }
    else if (e.t === 'round') { if (e.r === S.rounds) big(L('Last round!', 'Ostatnia runda!'), L('Richest player after this wins', 'Po niej wygrywa najbogatszy gracz'), 1800); }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } scene?.effect('party', { s: e.w });
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + (S.roll?.n || 0) : '';
    const before = cash;
    S = s; cash = s.seats.map(p => p.cash);
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; pinned = -1; logLines = []; $('pw-log').innerHTML = ''; cardN = 0; $('pw-zoom').hidden = true;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    } else cash.forEach((c, i) => { const d = c - (before[i] ?? c); if (d) setTimeout(() => !destroyed && floatAt(i, (d > 0 ? '+' : '−') + Math.abs(d), d < 0), 60 + i * 90); });
    endsAt = performance.now() + Math.max(0, s.left);
    if (s.roll && !fresh && s.roll.ago < 200) { sfx.draw(); setTimeout(() => !destroyed && sfx.place(), MS.roll * .85); }
    if (s.card && s.stage === 'card') showCard(s.card);
    if (!fresh && (myTurn() || owing()) && was !== s.turn + '/' + s.stage + '/' + (s.roll?.n || 0)) { sfx.turn(); lastTick = -1; sent = 0; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? L('You are top dog!', 'Wygrywasz!') : L(`${nameOf(w)} is top dog!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${myPlace ? (myPlace === 1 ? L('The richest paws in town. ', 'Najbogatsze łapki w mieście. ') : L(`You came ${ORD(myPlace)}. `, `Twoje miejsce: ${myPlace}. `)) : ''}${L('Treats in hand plus everything spent on shops and upgrades.', 'Przysmaki w ręce plus wszystko, co poszło na sklepiki i ulepszenia.')}</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], shops = S.own.filter(o => o === i).length;
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${cnt(shops, 'shop', 'shops', 'sklepik', 'sklepiki', 'sklepików')} · ${L(`${p.cash} treats in hand · ${p.st.got} rent collected`, `przysmaki w ręce: ${p.cash} · zebrany czynsz: ${p.st.got}`)}</span></div>
          <strong>${treats(S.res.worth[i])}<small>${L('in total', 'łącznie')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.toks?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 30 : innerHeight * .62;
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
    if ((myTurn() || owing()) && S.left >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go(a) {
    if (owing()) { if (busy() || !['sell', 'sellup', 'autosell'].includes(a.t)) return; sent = Date.now() - 600; sfx.click(); ctx.act(a); return; }
    if (!myTurn() || busy()) return;
    if (a.t !== 'build') sent = Date.now();
    sfx.click(); ctx.act(a); renderDock();
  }
  function pin(i) { pinned = i; scene?.pin(i); renderDeed(); }
  const onKey = e => {
    if (e.target.closest?.('input, textarea, button') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && pinned >= 0) { pin(-1); return; }
    if (!myTurn()) return;
    if (k === ' ' || k === 'enter') go({ t: S.stage === 'roll' ? 'roll' : S.stage === 'buy' ? 'buy' : 'end' });
    else if (k === 'n' && S.stage === 'buy') go({ t: 'pass' });
    else if (k === 'p' && S.stage === 'roll' && me().inBath) go({ t: 'pay' });
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);
  // a tap on the board (not a drag) opens that tile's card
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down || !scene || !S || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (i >= 0 && i !== pinned) { sfx.click(); pin(i); } else if (pinned >= 0) pin(-1);
  });

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (['roll', 'pay', 'buy', 'pass', 'end'].includes(a)) go({ t: a });
    else if (a === 'build') go({ t: 'build', i: +b.dataset.i });
    else if (a === 'sell' || a === 'sellup' || a === 'autosell') go({ t: a, i: +b.dataset.i || 0 });
    else if (a === 'unpin') pin(-1);
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pw-ups button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(zoomTimer); scene?.dispose();
    },
  };
}
