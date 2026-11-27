// Word Reef game view: HUD over the 3D table. Renders what the server says; you lay tiles from your tray on the
// board here (tap a tile then a square, or drag it), see what the play would score, and send it. Words are never
// checked on this page: the others get a few seconds to challenge every play.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { readPlay, boardOf, value, alphabet, WILD, FULL_BONUS, CHAL_BONUS } from './rules.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { uiz } from '../../uiz.js';
import { reefLook, paintReefMotif } from '../../pieceskins.js';
// your own tile set (Wardrobe kind rt) on the HUD tiles: colours plus the little corner picture
const motifUrl = new Map();
function tileLookVars(el, k) {
  const T = reefLook(k);
  if (!motifUrl.has(k)) { let u = 'none'; if (T.motif) { const c = document.createElement('canvas'); c.width = c.height = 64; paintReefMotif(c.getContext('2d'), 64, k); u = `url(${c.toDataURL()})`; } motifUrl.set(k, u); }
  el.style.setProperty('--rf-face', T.face); el.style.setProperty('--rf-body', T.body); el.style.setProperty('--rf-ink', T.ink); el.style.setProperty('--rf-motif', motifUrl.get(k));
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6"/></svg>',
};
const pts = n => L(`${n} pts`, `${n} pkt`);
const tilesW = n => cnt(n, 'tile', 'tiles', 'płytka', 'płytki', 'płytek');
const up = w => esc(String(w).toUpperCase());
// why a set of tiles is not a play yet (readPlay's err)
const WHY = {
  line: () => L('Your tiles have to be in one row or one column.', 'Płytki muszą leżeć w jednym rzędzie albo w jednej kolumnie.'),
  gap: () => L('Leave no gaps: the tiles have to make one word with the letters between them.', 'Bez przerw: płytki muszą tworzyć jedno słowo razem z literami między nimi.'),
  middle: () => L('The first word has to cover the star in the middle.', 'Pierwsze słowo musi przykryć gwiazdę na środku.'),
  alone: () => L('Join your word to the letters already on the island.', 'Połącz swoje słowo z literami, które już leżą na wyspie.'),
  short: () => L('A word needs at least two letters.', 'Słowo musi mieć co najmniej dwie litery.'),
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./reef.css', import.meta.url).href; document.head.append(l);
}

// a tile drawn in HTML (your tray, the letter picker, the results)
export const tileHtml = (l, lang, { wild = false, cls = '' } = {}) => `<span class="rf-tile${wild || l === WILD ? ' wild' : ''}${cls ? ' ' + cls : ''}"><b>${l === WILD ? '' : esc(l.toUpperCase())}</b>${wild || l === WILD ? '' : `<i>${value(lang, l)}</i>`}</span>`;

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="rf">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="rf-info"></span><div class="rf-board" id="rf-board"></div></div>
      <div class="tr"><span class="tcode" id="rf-code"></span>
        <button type="button" class="round" data-a="zoomout" id="rf-zoom" hidden aria-label="${L('See the whole island', 'Pokaż całą wyspę')}">${I.out}</button>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="rf-banner" aria-live="polite"></div>
      <div class="rf-last" id="rf-last"></div>
      <div class="shout" id="rf-big" aria-live="assertive"></div>
      <div class="rf-dock" id="rf-dock"><div class="rf-ctl" id="rf-ctl"></div><div class="rf-rack" id="rf-rack"></div></div>
      <div class="rf-pick" id="rf-pick" hidden></div>
    </div>
    <div class="rf-ghost" id="rf-ghost" hidden></div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.rf'), $ = id => root.querySelector('#' + id);
  root._rf = { state: () => S, px: i => live?.px?.(i), zoomed: () => !!scene?.zoomed(), hand: () => ({ draft: draft.length, sel, order: order.join('') }) }; // for the browser test: what the page shows, and where a square is on the screen
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, chalEnds = 0, chalStart = 0, chalKey = '', lastTick = -1, sent = 0;
  // your tray as you have arranged it, the tiles you have put on the board, the tile you picked up, swap marks
  let lastPend = [], order = [], draft = [], sel = -1, swapping = false, marks = new Set(), picking = null, rackKey = '';

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); scene.setDraft(draft); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  let mySk = -1; const syncLook = () => { const k = Math.max(0, me()?.fl?.rt | 0); if (k !== mySk) { mySk = k; tileLookVars(root, k); } };
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && me() && !me().bot);
  const busy = () => Date.now() - sent < 1500;
  const judge = () => !!(S && S.stage === 'chal' && S.pend && S.me >= 0 && S.pend.s !== S.me && me() && !me().bot);
  const B = () => boardOf(S.board);
  const preview = () => (draft.length ? readPlay(B(), S.cells, S.wild, draft.map(t => ({ i: t.i, l: t.l, w: t.w })), S.lang) : null);
  const inDraft = k => draft.some(t => t.k === k);

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 100) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      placer.add(el, t.x, t.y);
    }
    const z = $('rf-zoom'), want = !scene?.zoomed();
    if (z.hidden !== want) z.hidden = want;
  }
  // Fixed room for the HUD (not the panel's height right now), so the island never jumps while you play. On a wide
  // screen your tray and buttons sit in a column on the right; otherwise under the island.
  function layout() {
    const side = innerWidth >= 1100 && innerWidth / innerHeight >= 1.3;
    root.classList.toggle('side', side);
    if (!scene) return;
    const z = uiz(), phone = innerWidth < 600;
    scene.setHud(side ? { top: 64 * z, bottom: 24 * z, left: 210 * z, right: 470 * z } : { top: (innerWidth < 900 ? 112 : 64) * z, bottom: (phone ? 196 : 206) * z, left: 0, right: 0 });
  }
  const needZoom = () => innerWidth < 900 && scene && scene.cellPx() < 34 * uiz();

  // ----- the score list and the name tags -----
  function renderBoard() {
    setHtml($('rf-board'), S.seats.map((p, i) => `<div class="${pbRowCls(p.fl)} rf-s profrow${i === S.turn && S.stage === 'play' ? ' now' : ''}${i === S.me ? ' me' : ''}"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b><span class="n">${p.n}</span><strong>${S.score[i]}</strong>${rowBg(p.fl)}</div>`).join(''));
    pbRows($('rf-board'));
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="rf-tag"${i === S.me ? ' hidden' : ''}><div class="plate${tagCls(p)}">${tagFace(p)}${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    S.seats.forEach((p, i) => tagEls[i]?.classList.toggle('now', i === S.turn && S.stage === 'play'));
    tagsEl.classList.toggle('pick', !myTurn()); // tags open profile cards while you are not placing tiles under them
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function renderLast() {
    const w = S.words?.[S.words.length - 1], el = $('rf-last');
    setHtml(el, w && S.ph === 'play' ? `<span>${L('Last', 'Ostatnio')}: <b>${w.words.map(up).join(', ')}</b> +${w.pts} · ${nameOf(w.s)}</span>` : '');
  }

  // ----- your tray -----
  function syncRack() {
    const mine = me()?.rack || [];
    const key = mine.slice().sort().join('');
    if (key === rackKey) return;
    rackKey = key;
    const pool = mine.slice(), out = [];
    for (const l of order) { const k = pool.indexOf(l); if (k >= 0) { out.push(l); pool.splice(k, 1); } }
    order = [...out, ...pool]; draft = []; sel = -1; marks.clear(); swapping = false; picking = null;
    scene?.setDraft(draft);
  }
  function renderRack() {
    const p = me(), el = $('rf-rack');
    if (!S || S.ph !== 'play' || !p || !p.rack) { setHtml(el, ''); return; }
    const turn = myTurn() && !busy();
    el.className = 'rf-rack' + (turn ? ' turn' : '') + (swapping ? ' swap' : '');
    setHtml(el, order.map((l, k) => inDraft(k) ? `<span class="rf-slot" aria-hidden="true"></span>`
      : `<button type="button" class="rf-t${sel === k ? ' sel' : ''}${marks.has(k) ? ' mark' : ''}" data-a="tile" data-k="${k}" aria-label="${l === WILD ? L('wild tile', 'pusta płytka') : esc(l.toUpperCase()) + ', ' + pts(value(S.lang, l))}">${tileHtml(l, S.lang)}</button>`).join(''));
  }
  function renderCtl() {
    const el = $('rf-ctl'), p = me();
    if (!S || S.ph !== 'play' || S.stage === 'start') { setHtml(el, S?.stage === 'start' ? `<span class="rf-wait"><span>${L('Handing out the tiles…', 'Rozdawanie płytek…')}</span></span>` : ''); return; }
    if (S.stage === 'chal' && S.pend) return setHtml(el, chalHtml());
    if (S.stage === 'told') return setHtml(el, '');
    if (myTurn() && !busy()) {
      if (swapping) {
        const n = marks.size;
        return setHtml(el, `<p class="rf-hint">${L('Tap the tiles you want to throw back in the bag. You get new ones and your turn ends.', 'Dotknij płytek, które chcesz wrzucić z powrotem do worka. Dostaniesz nowe, a twoja kolejka się skończy.')}</p>
          <div class="rf-go"><button type="button" class="btn big m" data-a="doswap"${n && n <= S.bag ? '' : ' disabled'}>${n ? L(`Swap ${tilesW(n)}`, `Wymień: ${n}`) : L('Swap', 'Wymień')}</button><button type="button" class="btn big w" data-a="cancel">${L('Cancel', 'Anuluj')}</button></div>`);
      }
      const pv = preview();
      let hint;
      if (!draft.length) hint = sel >= 0 ? L('Now tap a square on the island.', 'Teraz dotknij pola na wyspie.') : !S.cells.some(Boolean) ? L('Make the first word across the star in the middle. Tap a tile, then a square.', 'Ułóż pierwsze słowo przez gwiazdę na środku. Dotknij płytki, a potem pola.') : L('Tap a tile, then a square (or drag it there).', 'Dotknij płytki, a potem pola (albo przeciągnij ją tam).');
      else if (pv.ok) hint = `${pv.words.map(w => `<b>${up(w.w)}</b> ${w.pts}`).join(' · ')}${pv.full ? ` · ${L('full tray', 'cały stojak')} +${FULL_BONUS}` : ''}${pv.nests.length ? ` · ${L('nest', 'gniazdo')} +${pv.nests.length * 10}` : ''}`;
      else hint = (WHY[pv.err] || WHY.gap)();
      const canSwap = S.bag > 0;
      return setHtml(el, `<p class="rf-hint${pv && !pv.ok ? ' bad' : ''}">${hint}</p>
        <div class="rf-go">
          <button type="button" class="btn big rf-play" data-a="play"${pv?.ok ? '' : ' disabled'}>${pv?.ok ? L(`Play +${pv.pts}`, `Zagraj +${pv.pts}`) : L('Play', 'Zagraj')}</button>
          ${draft.length ? `<button type="button" class="btn w" data-a="recall">${L('Take back', 'Cofnij')}</button>` : `<button type="button" class="btn w" data-a="shuffle">${L('Shuffle', 'Tasuj')}</button>`}
          <button type="button" class="btn w" data-a="swap"${canSwap ? '' : ' disabled'}>${L('Swap', 'Wymień')}</button>
          <button type="button" class="btn w" data-a="pass">${L('Pass', 'Pas')}</button>
        </div>`);
    }
    if (S.turn >= 0) {
      const t = S.seats[S.turn];
      return setHtml(el, `<span class="rf-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p?.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`);
    }
    setHtml(el, '');
  }
  // the words just played, and Challenge / Looks fine for everyone else
  function chalHtml() {
    const P = S.pend, secs = '<b class="rf-secs"></b>', mine = P.s === S.me;
    const words = `<div class="rf-words">${P.words.map(w => `<span><b>${up(w.w)}</b>${w.pts}</span>`).join('')}${P.full ? `<span class="x">${L('full tray', 'cały stojak')} +${FULL_BONUS}</span>` : ''}${P.nests.length ? `<span class="x">${L('nest', 'gniazdo')} +${P.nests.length * 10}</span>` : ''}<span class="sum">= ${P.pts}</span></div>`;
    const bar = '<div class="rf-clock"><i></i></div>';
    if (mine) return `<div class="rf-chal">${words}<p>${L(`Your words are down. The others can challenge them for ${secs}s.`, `Twoje słowa leżą. Pozostali mogą je sprawdzić jeszcze przez ${secs} s.`)}</p>${bar}</div>`;
    if (!judge()) return `<div class="rf-chal">${words}<p>${L(`${nameOf(P.s)} plays. Challenge time: ${secs}s`, `Gra: ${nameOf(P.s)}. Czas na sprawdzenie: ${secs} s`)}</p>${bar}</div>`;
    const done = P.fine.includes(S.me);
    return `<div class="rf-chal">${words}<p>${done ? L('Waiting for the others…', 'Czekamy na pozostałych…') : L(`Is every word real? If one is not, challenge and it comes back off. If they all are, ${nameOf(P.s)} gets +${CHAL_BONUS}.`, `Czy każde słowo istnieje? Jeśli któreś nie, sprawdź je, a płytki wrócą. Jeśli wszystkie są dobre, ${nameOf(P.s)} dostaje +${CHAL_BONUS}.`)}</p>
      ${done ? '' : `<div class="rf-go"><button type="button" class="btn big rf-chalbtn" data-a="chal">${L('Challenge!', 'Sprawdzam!')}</button><button type="button" class="btn big m" data-a="fine">${L('Looks fine', 'W porządku')}</button></div>`}${bar}</div>`;
  }

  // the challenge clock: the markup above never changes during one challenge, so the bar is not rebuilt;
  // a bar that does get rebuilt picks up where it was through a negative animation delay
  function syncClock() {
    const box = $('rf-ctl');
    for (const b of box.querySelectorAll('.rf-secs')) { const t = String(Math.max(0, Math.ceil((chalEnds - performance.now()) / 1000))); if (b.textContent !== t) b.textContent = t; }
    const i = box.querySelector('.rf-clock i'); if (!i) return;
    const key = chalStart + ':' + Math.round(chalEnds);
    if (i._k === key) return;
    i._k = key;
    const total = Math.max(1, chalEnds - chalStart), gone = Math.min(total, performance.now() - chalStart);
    i.style.animation = 'none'; void i.offsetWidth;
    i.style.animation = `rfclock ${total}ms linear ${-gone}ms both`;
  }

  function renderBanner() {
    const el = $('rf-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? (S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`)) : L('A draw', 'Remis');
    else if (S.stage === 'start') msg = S.turn === S.me ? L('You start', 'Zaczynasz') : L(`${nameOf(S.turn)} starts`, `Zaczyna ${nameOf(S.turn)}`);
    else if (S.stage === 'chal') msg = L('Challenge?', 'Sprawdzasz?');
    else if (myTurn()) msg = L('Your turn', 'Twoja kolej') + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn() || judge());
  }

  function render() {
    if (!S) return; syncLook();
    $('rf-info').textContent = L(`Bag: ${S.bag}`, `Worek: ${S.bag}`) + ` · ${S.lang === 'pl' ? 'PL' : 'EN'}`;
    $('rf-code').textContent = Rm?.code || '';
    syncRack(); renderBoard(); renderLast(); renderRack(); renderCtl(); if (S.stage === 'chal') syncClock(); renderBanner(); renderPick();
    scene?.setDraft(draft);
    layout();
  }

  function big(text, sub = '', ms = 1700) {
    const el = $('rf-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text) {
    const p = live?.px?.(i); if (!p) return;
    const f = document.createElement('div');
    f.className = 'rf-pts'; f.textContent = text;
    f.style.left = `${p[0]}px`; f.style.top = `${p[1]}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  function playEv(e) {
    if (e.t === 'play') { setTimeout(() => !destroyed && sfx.thunk(), 380); if (e.s !== S.me && judge()) sfx.turn(); }
    else if (e.t === 'stand') {
      sfx.set(); scene?.kick(.04);
      if (lastPend.length) floatAt(lastPend[lastPend.length >> 1].i, `+${e.pts}`);
      if (e.full) big(L('Full tray!', 'Cały stojak!'), `+${FULL_BONUS} · ${e.s === S.me ? L('you', 'ty') : nameOf(e.s)}`, 1900);
      else if (e.nests) big(L('A pet wakes up!', 'Zwierzak się budzi!'), `+${e.nests * 10}`, 1600);
    } else if (e.t === 'chal') {
      const by = e.by === S.me ? L('You challenge', 'Sprawdzasz') : L(`${nameOf(e.by)} challenges`, `Sprawdza: ${nameOf(e.by)}`);
      if (!e.ok) { sfx.bad(); scene?.kick(.08); big(L('Not a word!', 'Nie ma takiego słowa!'), `${by} · ${e.bad.map(up).join(', ')}`, 2400); }
      else { sfx.set(); big(L('All words stand!', 'Wszystkie słowa są dobre!'), `${by} · +${CHAL_BONUS} ${e.s === S.me ? L('for you', 'dla ciebie') : L(`for ${nameOf(e.s)}`, `dla: ${nameOf(e.s)}`)}`, 2400); }
    } else if (e.t === 'swap') { sfx.draw(); ctx.toast(e.s === S.me ? L(`You swap ${tilesW(e.k)}`, `Wymieniasz płytki: ${e.k}`) : L(`${nameOf(e.s)} swaps ${tilesW(e.k)}`, `${nameOf(e.s)} wymienia płytki: ${e.k}`)); }
    else if (e.t === 'pass') { sfx.bad(); if (e.s === S.me) big(L('Pass', 'Pas'), e.auto ? L('Out of time', 'Koniec czasu') : '', 1300); else ctx.toast(L(`${nameOf(e.s)} passes`, `${nameOf(e.s)} pasuje`)); }
    else if (e.t === 'start') sfx.pop();
    else if (e.t === 'end') {
      if (S.win === S.me && S.me >= 0) { sfx.win(); confetti(); } else if (S.me >= 0) setTimeout(() => !destroyed && sfx.lose(), 600);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 3200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, wasTurn = S ? S.turn + S.stage : '', was = S ? S.mv : -1;
    S = s;
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (s.pend) {
      const now = performance.now(), ends = now + s.pend.left;
      // a new challenge starts the clock; later pushes only move the end when it really moved (bots-only cut), not for network jitter
      const k = s.pend.s + JSON.stringify(s.pend.tiles);
      if (k !== chalKey || !chalStart) { chalKey = k; chalStart = now; chalEnds = ends; }
      else if (Math.abs(ends - chalEnds) > 400) chalEnds = ends;
      lastPend = s.pend.tiles;
    } else { chalStart = 0; chalKey = ''; }
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; order = []; rackKey = ''; draft = []; sel = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    if (!fresh && was !== s.mv) { sent = 0; if (myTurn() && wasTurn !== s.turn + s.stage) { sfx.turn(); lastTick = -1; } }
    if (!myTurn() && draft.length && s.stage !== 'chal') { draft = []; sel = -1; }
    if (s.stage !== 'play' || s.turn !== s.me) { swapping = false; marks.clear(); }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length, R = S.res;
    const myPlace = S.me >= 0 ? R.places[S.me] : 0;
    const head = S.win < 0 ? L('A draw', 'Remis') : S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    const sub = myPlace ? L(`You finish ${ord(myPlace)} of ${n}.`, `Twoje miejsce: ${myPlace} z ${n}.`) : '';
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub} ${R.out >= 0 ? L(`${R.out === S.me ? 'You' : nameOf(R.out)} used up every tile.`, R.out === S.me ? 'Wykładasz wszystkie płytki.' : `${nameOf(R.out)} wykłada wszystkie płytki.`) : L('Nobody could score any more.', 'Nikt nie mógł już zdobyć punktów.')}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${pbRowCls(p.fl)} ${R.places[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${R.places[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${st.best ? L(`best word ${up(st.best)} (${st.bestPts})`, `najlepsze słowo: ${up(st.best)} (${st.bestPts})`) : L('no words', 'bez słów')}${R.left[i] ? ` · ${L('tiles left', 'zostało')} −${R.left[i]}` : ''}</span></div>
          <strong><span>${S.score[i]}</span><small>${L('points', 'pkt')}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#5cc3e8'];
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
    if (S.stage === 'chal') syncClock();
    if (sent && Date.now() - sent >= 1500) { sent = 0; render(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 250);

  // ----- the letter picker for a wild tile -----
  function renderPick() {
    const el = $('rf-pick');
    el.hidden = !picking || !S;
    if (el.hidden) { el._h = ''; return; }
    setHtml(el, `<div class="sheet"><h3>${L('Which letter is it?', 'Jaka to litera?')}</h3><p>${L('A wild tile can be any letter. It scores 0.', 'Pusta płytka może być dowolną literą. Jest warta 0 pkt.')}</p>
      <div class="rf-abc">${alphabet(S.lang).map(l => `<button type="button" data-a="letter" data-l="${l}">${esc(l.toUpperCase())}</button>`).join('')}</div>
      <button type="button" class="btn w" data-a="nopick">${L('Cancel', 'Anuluj')}</button></div>`);
  }

  // ----- input -----
  function put(k, i) {
    if (!myTurn() || busy() || k < 0 || inDraft(k) || i < 0) return false;
    if (!S.cells[i] && B().kinds[i] !== '#' && !draft.some(t => t.i === i)) {
      if (order[k] === WILD) { picking = { k, i }; sel = -1; sfx.click(); render(); return true; }
      draft.push({ i, l: order[k], w: 0, k }); sel = -1; sfx.place(); render(); return true;
    }
    return false;
  }
  function tapCell(i) {
    if (!myTurn() || busy() || swapping) { if (needZoom() && !scene.zoomed() && i >= 0) { scene.zoom(i); sfx.click(); } return; }
    const d = draft.findIndex(t => t.i === i);
    if (d >= 0) { const [t] = draft.splice(d, 1); sel = t.k; sfx.pop(); render(); return; } // picked back up: tap another square to move it
    if (i < 0) return;
    if (needZoom() && !scene.zoomed()) { scene.zoom(i); sfx.click(); return; }
    if (sel >= 0) { if (!put(sel, i)) sfx.bad(); else if (scene.zoomed()) scene.zoom(i); return; } // zoomed in: follow the word along
    // nothing in hand: the next tile in the tray goes here
    const k = order.findIndex((_, j) => !inDraft(j));
    if (k >= 0 && !S.cells[i] && B().kinds[i] !== '#' && put(k, i) && scene.zoomed()) scene.zoom(i);
  }
  function go(a) {
    if (!myTurn() || busy()) return;
    sent = Date.now(); sfx.click(); ctx.act(a); scene?.zoom(-1); render();
  }
  function sendPlay() {
    const pv = preview(); if (!pv?.ok) { sfx.bad(); return; }
    go({ t: 'play', tiles: draft.map(t => ({ i: t.i, l: t.l, w: t.w })) });
  }
  function shuffle() { for (let i = order.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [order[i], order[j]] = [order[j], order[i]]; } draft = []; sel = -1; sfx.draw(); render(); }

  // drag a tile from the tray onto the island
  let drag = null;
  const ghost = $('rf-ghost');
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('.rf-t'); if (!b || !myTurn() || swapping || busy()) return;
    drag = { k: +b.dataset.k, x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
  });
  addEventListener('pointermove', onMove);
  function onMove(e) {
    if (drag && e.pointerId === drag.id) {
      if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 9) { drag.on = true; ghost.innerHTML = tileHtml(order[drag.k], S.lang); ghost.hidden = false; sel = drag.k; renderRack(); }
      if (drag.on) { ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; scene?.setHover(scene.cellAt(e.clientX, e.clientY - 30)); }
      return;
    }
    if (e.pointerType === 'mouse' && scene && e.target === canvas && myTurn() && (sel >= 0 || !swapping)) scene.setHover(scene.cellAt(e.clientX, e.clientY));
  }
  addEventListener('pointerup', onUp);
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; ghost.hidden = true; scene?.setHover(-1);
    if (!d.on) return;
    root._noClick = true; setTimeout(() => { root._noClick = false; }, 50);
    const i = scene ? scene.cellAt(e.clientX, e.clientY - 30) : -1;
    if (!put(d.k, i)) { sel = -1; render(); }
  }
  // zoomed in, dragging the island slides it along
  let pan = null;
  canvas.addEventListener('pointerdown', e => { if (scene?.zoomed()) pan = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; });
  canvas.addEventListener('pointermove', e => {
    if (!pan || e.pointerId !== pan.id) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 10) return;
    pan.moved = true; pan.x = e.clientX; pan.y = e.clientY; scene.pan(dx, dy);
  });
  canvas.addEventListener('pointerup', e => { if (pan?.moved) { root._noClick = true; setTimeout(() => { root._noClick = false; }, 50); } pan = null; });
  canvas.addEventListener('click', e => { if (scene && !root._noClick) tapCell(scene.cellAt(e.clientX, e.clientY)); });
  canvas.addEventListener('pointerleave', () => scene?.setHover(-1));

  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (picking && k === 'Escape') { picking = null; render(); }
    else if (!myTurn()) { if (judge() && k === 'Enter') { e.preventDefault(); ctx.act({ t: 'fine' }); } return; }
    else if (k === 'Enter') sendPlay();
    else if (k === 'Escape') { draft = []; sel = -1; swapping = false; marks.clear(); render(); }
    else if (k === 'Backspace' && draft.length) { draft.pop(); render(); }
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) render(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    if (root._noClick) return;
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'tile') {
      const k = +b.dataset.k;
      if (swapping) { if (marks.has(k)) marks.delete(k); else marks.add(k); sfx.click(); render(); return; }
      if (!myTurn() || busy()) { sfx.bad(); return; }
      sel = sel === k ? -1 : k; sfx.click(); render();
    }
    else if (a === 'play') sendPlay();
    else if (a === 'recall') { draft = []; sel = -1; sfx.pop(); render(); }
    else if (a === 'shuffle') shuffle();
    else if (a === 'swap') { draft = []; sel = -1; swapping = true; marks.clear(); sfx.click(); render(); }
    else if (a === 'cancel') { swapping = false; marks.clear(); render(); }
    else if (a === 'doswap') { const ls = [...marks].map(k => order[k]); swapping = false; marks.clear(); go({ t: 'swap', tiles: ls }); }
    else if (a === 'pass') go({ t: 'pass' });
    else if (a === 'chal') { sfx.click(); ctx.act({ t: 'chal' }); }
    else if (a === 'fine') { sfx.click(); ctx.act({ t: 'fine' }); }
    else if (a === 'letter') { const p = picking; picking = null; if (p && myTurn()) { draft.push({ i: p.i, l: b.dataset.l, w: 1, k: p.k }); sfx.place(); } render(); }
    else if (a === 'nopick') { picking = null; render(); }
    else if (a === 'zoomout') { scene?.zoom(-1); sfx.click(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .rf-t');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
