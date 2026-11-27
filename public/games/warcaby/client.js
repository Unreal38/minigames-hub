// Warcaby game view: HUD over the 3D board. Renders what the server says; you tap a piece, then the square it goes to
// (for a capture with several hops, the last square, or each landing square in turn when two ways end in the same place).
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { fromBoard, legal, count } from './rules.js';
import { discSvg } from './glyphs.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 5h11l-2 4 2 4H5" fill="currentColor" fill-opacity=".25"/></svg>',
  shake: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h5l3-3 3 3h7"/><path d="M8 12l3 4 2-2 2 2 3-4"/></svg>',
};
function clockText(ms) {
  if (ms <= 0) return '0:00';
  if (ms < 20000) return `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}.${Math.floor(ms % 1000 / 100)}`;
  const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let cssLink = null;
function loadCss() {
  if (cssLink) return cssLink;
  cssLink = document.createElement('link'); cssLink.rel = 'stylesheet'; cssLink.href = new URL('./warcaby.css', import.meta.url).href; document.head.append(cssLink);
  return cssLink;
}

export function mount(app, ctx) {
  const css = loadCss();
  // sizes measured before the stylesheet arrived are wrong (name tags as wide as the window): measure again once it is in
  if (!css.sheet) css.addEventListener('load', () => { if (!destroyed && S) { render(); layout(); } }, { once: true });
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="wc">
    <canvas class="g3d" aria-label="${L('The draughts board', 'Plansza do warcabów')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="wc-info"></span></div>
      <div class="tr"><span class="tcode" id="wc-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="wc-banner" aria-live="polite"></div>
      <div class="shout" id="wc-big" aria-live="assertive"></div>
      <div class="wc-dock" id="wc-dock"><div class="wc-ask" id="wc-ask"></div><div class="wc-moves" id="wc-moves"></div><div class="wc-btns" id="wc-btns"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.wc'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, recvAt = 0, lastTick = -1, sent = 0;
  let sel = -1, steps = [], targets = [], cursor = -1, moves = [], movesFor = '', armed = 0, movesShown = -1;
  const notes = [null, null]; // a short bubble over a player's tag: { text, until }

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const sideOf = i => (i === S.white ? 0 : 1);
  const myTurn = () => !!(S && S.ph === 'play' && S.turn === S.me && me() && !me().bot);
  const busy = () => Date.now() - sent < 1500;
  // every legal move in the position on screen (worked out here with the same rules the server uses)
  function allMoves() {
    const key = S.gid + '/' + S.mv;
    if (key !== movesFor) { const p = S.pos; moves = legal(fromBoard(p.b, p.turn, p.quiet, p.eg)); movesFor = key; }
    return moves;
  }
  const movesFrom = s => allMoves().filter(m => m.f === s);
  const mine = s => { const p = S.pos.b[s]; return !!p && (p >> 2) === sideOf(S.me); };
  const forced = () => { const m = allMoves(); return m.length > 0 && m[0].caps.length > 0; };
  // the moves of the picked piece that still fit the landing squares tapped so far
  const cands = () => movesFrom(sel).filter(m => steps.every((x, i) => m.path[i + 1] === x));
  const same = (a, b) => a.t === b.t && a.caps.length === b.caps.length && a.caps.every(c => b.caps.includes(c));

  function onFrame(info) {
    live = info;
    const xs = [];
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4; xs[i] = { x: Math.max(half, Math.min(innerWidth - half, t.x)), half };
    }
    // on a phone the two players sit close together, so their tags would overlap: spread them apart around their middle
    if (xs[0] && xs[1]) {
      const [a, b] = xs[0].x <= xs[1].x ? [xs[0], xs[1]] : [xs[1], xs[0]], over = a.x + a.half - (b.x - b.half);
      if (over > 0) {
        a.x -= over / 2; b.x += over / 2;
        if (a.x < a.half) { b.x += a.half - a.x; a.x = a.half; }
        if (b.x > innerWidth - b.half) { a.x -= b.x - (innerWidth - b.half); b.x = innerWidth - b.half; a.x = Math.max(a.half, a.x); }
      }
    }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el || !xs[i]) continue;
      el.style.transform = `translate(${xs[i].x.toFixed(1)}px, ${Math.max(t.y, (innerWidth < 700 ? 196 : 96) * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() { if (scene) scene.setHud(Math.max($('wc-dock').offsetHeight + 30, 70)); }

  // ----- name tags over the avatars: side, name, clock, and what they have taken -----
  function clockNow(i) {
    if (!S.clock) return -1;
    let ms = S.clock[i];
    if (S.ph === 'play' && i === S.turn) ms -= Math.max(0, performance.now() - recvAt - (S.grace || 0));
    return Math.max(0, ms);
  }
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me + '/' + S.white + '/' + !!S.clock;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="wc-tag"><div class="bub"></div><div class="plate">${discSvg(false, sideOf(i))}<b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}${i === S.me ? `<span class="you">${L('you', 'ty')}</span>` : ''}${S.clock ? '<span class="cnt clk"></span>' : ''}</div><div class="capt"></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn);
      const [men, kings] = S.caps[i], other = 1 - sideOf(i);
      setHtml(el.querySelector('.capt'), men + kings ? `<span>${men ? `${discSvg(false, other)}<b>×${men}</b>` : ''}${kings ? `${discSvg(true, other)}<b>×${kings}</b>` : ''}</span>` : '');
      const n = notes[i];
      setHtml(el.firstElementChild, n && n.until > Date.now() ? `<span>${n.text}</span>` : '');
    });
    paintClocks();
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function paintClocks() {
    if (!S || !S.clock) return;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]?.querySelector('.clk'); if (!el) return;
      const ms = clockNow(i), txt = clockText(ms);
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('low', ms < 30000); el.classList.toggle('run', S.ph === 'play' && i === S.turn);
    });
  }
  function note(i, text, ms = 2600) { notes[i] = { text, until: Date.now() + ms }; if (S) buildTags(); setTimeout(() => { if (!destroyed && S) buildTags(); }, ms + 60); }

  // ----- bottom: a draw offer to answer, the moves so far, and the draw / resign buttons -----
  function renderMoves() {
    const el = $('wc-moves');
    if (movesShown === S.gid + S.moves.length) return; movesShown = S.gid + S.moves.length;
    if (!S.moves.length) { el.innerHTML = `<span class="none">${L('White moves first', 'Zaczynają białe')}</span>`; return; }
    el.innerHTML = S.moves.map((m, i) => `${i % 2 ? '' : `<i>${i / 2 + 1}.</i>`}<span class="${i === S.moves.length - 1 ? 'last' : ''}">${esc(m)}</span>`).join('');
    el.scrollLeft = el.scrollWidth;
  }
  function renderDock() {
    const p = me(), ask = $('wc-ask'), btns = $('wc-btns');
    if (!S || S.ph !== 'play') { setHtml(ask, ''); setHtml(btns, ''); layout(); return; }
    let a = '';
    if (p && !p.bot && S.offer === 1 - S.me) a = `<span class="wc-wait go"><span>${L(`${nameOf(S.offer)} offers a draw`, `Propozycja remisu: ${nameOf(S.offer)}`)}</span><button type="button" class="btn sm m" data-a="draw">${L('Accept', 'Przyjmij')}</button><button type="button" class="btn sm paper" data-a="nodraw">${L('Decline', 'Odrzuć')}</button></span>`;
    else if (p && S.offer === S.me) a = `<span class="wc-wait"><span>${L('Draw offered. Waiting for an answer…', 'Remis zaproponowany. Czekasz na odpowiedź…')}</span></span>`;
    else if (myTurn() && !busy() && forced() && sel < 0) a = `<span class="wc-wait go must">${discSvg(false, sideOf(S.me))}<span>${L('You must take', 'Musisz bić')}${allMoves()[0].caps.length > 1 ? ': ' + cnt(allMoves()[0].caps.length, 'piece', 'pieces', 'pionek', 'pionki', 'pionków') : ''}</span></span>`;
    else if (myTurn() && !busy() && sel >= 0 && steps.length) a = `<span class="wc-wait go"><span>${L('Tap the next square to land on', 'Dotknij kolejnego pola, na które skaczesz')}</span></span>`;
    else if (myTurn() && !busy() && p.st.moved < 2 && sel < 0) a = `<span class="wc-wait go">${discSvg(false, sideOf(S.me))}<span>${L('Tap a piece to see where it can go', 'Dotknij pionka, żeby zobaczyć jego ruchy')}</span></span>`;
    else if (S.turn >= 0 && S.turn !== S.me) { const t = S.seats[S.turn]; a = `<span class="wc-wait">${avatarHtml(t.color, t.av, 28)}<span>${L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`; }
    else if (p?.bot && S.turn === S.me) a = `<span class="wc-wait"><span>${L('A bot is playing for you', 'Bot gra za ciebie')}</span></span>`;
    setHtml(ask, a);
    let b = '';
    if (p && !p.bot) {
      const sure = armed > Date.now();
      b = `<button type="button" class="btn sm paper" data-a="draw" ${S.canOffer && S.mv >= 2 ? '' : 'disabled'}>${I.shake}<span>${L('Offer a draw', 'Zaproponuj remis')}</span></button>
        <button type="button" class="btn sm ${sure ? "r" : "paper"}" data-a="resign">${I.flag}<span>${sure ? L('Tap again to resign', 'Dotknij jeszcze raz, żeby poddać') : L('Resign', 'Poddaj partię')}</span></button>`;
    }
    setHtml(btns, b); layout();
  }

  const HOW = () => ({
    repeat: L('The same position three times', 'Trzy razy ta sama pozycja'),
    kings: L('25 moves each with only kings and no capture', 'Po 25 ruchów samymi damkami bez bicia'),
    endgame: L('A lone king held out to the end', 'Samotna damka wytrzymała do końca'),
    agree: L('Draw by agreement', 'Remis za zgodą obu stron'),
  });
  const WHY = how => ({ wiped: L('Every piece taken', 'Wszystkie pionki zbite'), blocked: L('No move left', 'Brak ruchu'), resign: L('Resignation', 'Partia poddana'), time: L('Out of time', 'Koniec czasu') }[how]);
  function endLine() {
    const R = S.res, w = S.win;
    if (w < 0) return L('Draw', 'Remis') + ' · ' + HOW()[R.how];
    const lost = 1 - w, you = w === S.me;
    if (R.how === 'wiped' || R.how === 'blocked') return (R.how === 'wiped' ? L(`${lost === S.me ? 'All your' : nameOf(lost) + '’s'} pieces are gone`, `Koniec pionków: ${lost === S.me ? 'twoich' : nameOf(lost)}`) : L(`${lost === S.me ? 'You have' : nameOf(lost) + ' has'} no move left`, `Brak ruchu: ${lost === S.me ? 'ty' : nameOf(lost)}`)) + '. ' + (you ? L('You win', 'Wygrywasz') : L(`${nameOf(w)} wins`, `Wygrywa ${nameOf(w)}`));
    if (R.how === 'resign') return lost === S.me ? L(`You resign. ${nameOf(w)} wins`, `Poddajesz partię. Wygrywa ${nameOf(w)}`) : L(`${nameOf(lost)} resigns. ${you ? 'You win' : nameOf(w) + ' wins'}`, `${nameOf(lost)} poddaje partię. ${you ? 'Wygrywasz' : 'Wygrywa ' + nameOf(w)}`);
    return lost === S.me ? L(`Out of time. ${nameOf(w)} wins`, `Koniec czasu. Wygrywa ${nameOf(w)}`) : L(`${nameOf(lost)} is out of time. ${you ? 'You win' : nameOf(w) + ' wins'}`, `Koniec czasu: ${nameOf(lost)}. ${you ? 'Wygrywasz' : 'Wygrywa ' + nameOf(w)}`);
  }
  function renderBanner() {
    const el = $('wc-banner'); let msg = '';
    if (!S) return;
    const take = S.ph === 'play' && forced() ? ' · ' + L('take!', 'bicie!') : '';
    if (S.ph === 'end') msg = endLine();
    else if (myTurn()) msg = L('Your move', 'Twój ruch') + take;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s move`, `Ruch: ${nameOf(S.turn)}`) + take;
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    $('wc-info').textContent = `${S.size}×${S.size} · ` + L(`Move ${Math.floor(S.mv / 2) + 1}`, `Ruch ${Math.floor(S.mv / 2) + 1}`) + ' · ' + (S.clock ? S.clockName : L('no clock', 'bez zegara'));
    $('wc-code').textContent = Rm?.code || '';
    buildTags(); renderMoves(); renderDock(); renderBanner();
    if (!myTurn()) { select(-1); cursor = -1; scene?.setCursor(-1); scene?.setHover(-1); }
    paintMust();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('wc-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'move') {
      const hops = Math.max(1, e.cap), gap = 340;
      if (e.cap) { for (let i = 0; i < e.cap; i++) setTimeout(() => !destroyed && (i ? sfx.pop() : sfx.thunk?.() || sfx.pop()), 180 + i * gap); }
      else e.s === S.me ? sfx.place() : sfx.plop?.();
      if (e.cap >= 3) setTimeout(() => !destroyed && big(L(`${e.cap} in one go!`, `${e.cap} naraz!`), '', 1300), hops * gap);
      if (e.k) setTimeout(() => { if (destroyed) return; sfx.combo?.(); big(L('Crowned!', 'Damka!'), e.s === S.me ? L('Your man is a king now', 'Twój pionek zostaje damką') : L(`${nameOf(e.s)} has a new king`, `Nowa damka: ${nameOf(e.s)}`), 1300); }, hops * gap + 120);
    } else if (e.t === 'offer') { if (e.s !== S.me) sfx.pop(); note(e.s, L('Draw?', 'Remis?'), 3200); }
    else if (e.t === 'decline') note(e.s, L('No draw', 'Bez remisu'));
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); big(L('You win!', 'Wygrana!'), WHY(e.how) || '', 2300); }
      else if (e.w < 0) { sfx.set(); big(L('Draw!', 'Remis!'), HOW()[e.how], 2500); }
      else { S.me >= 0 ? sfx.lose() : sfx.set(); big(L(`${nameOf(e.w)} wins!`, `Wygrywa ${nameOf(e.w)}!`), WHY(e.how) || '', 2300); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2700 + Math.min(4, S.last?.caps?.length || 0) * 300);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.mv : '';
    S = s; recvAt = performance.now();
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; sel = -1; steps = []; targets = []; cursor = -1; armed = 0; movesShown = -1; notes[0] = notes[1] = null;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.mv === 0) big(s.me < 0 ? L('Checkers', 'Warcaby') : s.me === s.white ? L('You play White', 'Grasz białymi') : L('You play Black', 'Grasz czarnymi'), s.me === s.white ? L('You move first', 'Zaczynasz') : L(`${nameOf(s.white)} moves first`, `Zaczyna: ${nameOf(s.white)}`), 1600);
    }
    if (was !== s.turn + '/' + s.mv) { sent = 0; if (!fresh && myTurn()) { sfx.turn(); lastTick = -1; } }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, tie = S.win < 0;
    const order = tie ? [S.white, 1 - S.white] : [S.win, 1 - S.win];
    const head = tie ? L('It’s a draw!', 'Remis!') : S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    const why = tie ? HOW()[R.how] : WHY(R.how);
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${why} · ${cnt(R.moves, 'move', 'moves', 'ruch', 'ruchy', 'ruchów')}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], pos = tie ? 1 : k + 1, side = sideOf(i);
        return `<li class="${pbRowCls(p.fl)} ${!tie && k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${pos}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${discSvg(false, side)}${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${side ? L('Black', 'Czarne') : L('White', 'Białe')} · ${L(`${cnt(S.caps[i][0] + S.caps[i][1], 'piece', 'pieces')} taken`, `zbite: ${S.caps[i][0] + S.caps[i][1]}`)} · ${L(`${cnt(left(side), 'piece', 'pieces')} left`, `zostało: ${left(side)}`)}</span></div>
          <strong><span>${tie ? '½' : k === 0 ? '1' : '0'}</span></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Rematch', 'Rewanż'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Rematch', 'Rewanż'));
  }
  const left = side => { const c = count(S.pos.b)[side]; return c[0] + c[1]; };
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
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
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
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
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    step();
  }

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    paintClocks();
    if (sent && !busy()) { sent = 0; renderDock(); paintMust(); }
    if (armed && armed < Date.now()) { armed = 0; renderDock(); }
    if (myTurn() && S.clock) {
      const n = Math.ceil(clockNow(S.me) / 1000);
      if (n !== lastTick && n <= 10 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 100);

  // ----- input: tap a piece, then where it goes (or move a cursor with the arrow keys and press Enter) -----
  // Captures that must be made glow under the pieces that can make them while nothing is picked.
  function paintMust() {
    if (!scene || !S) return;
    scene.setMust(myTurn() && sel < 0 && !busy() && forced() ? [...new Set(allMoves().map(m => m.f))] : []);
  }
  function select(s) {
    if (s === sel && !steps.length) return;
    sel = s; steps = [];
    showTargets();
    if (S && S.ph === 'play') renderDock();
  }
  // dots: where the piece can land next (and where each way ends); red rings: the pieces it will take on those ways;
  // orange tiles: the landing squares tapped so far
  function showTargets() {
    const list = [];
    targets = [];
    if (sel >= 0) {
      const c = cands(), next = new Set(), ends = new Set(), victims = new Set();
      for (const m of c) { next.add(m.path[steps.length + 1]); ends.add(m.t); m.caps.forEach(v => victims.add(v)); }
      targets = [...new Set([...next, ...ends])].filter(x => x !== undefined && x !== sel);
      for (const t of targets) list.push({ s: t, kind: 'dot' });
      for (const v of victims) list.push({ s: v, kind: 'ring' });
      for (const t of steps) list.push({ s: t, kind: 'step' });
    }
    scene?.setSelect(sel, list);
    paintMust();
  }
  function send(m) {
    sent = Date.now(); sel = -1; steps = []; targets = []; scene?.setSelect(-1, []); cursor = -1; scene?.setCursor(-1); scene?.setHover(-1);
    ctx.act({ t: 'move', path: m.path }); renderDock(); paintMust();
  }
  function tap(s) {
    if (!myTurn() || busy()) return;
    if (sel >= 0 && targets.includes(s)) {
      const c = cands();
      // the last square of a way: if every way that ends there takes the same pieces, that is the move
      const fin = c.filter(m => m.t === s);
      if (fin.length && fin.every(m => same(m, fin[0])) && !(fin[0].path.length > steps.length + 2 && c.some(m => m.path[steps.length + 1] === s && m.t !== s))) { sfx.click(); send(fin[0]); return; }
      // otherwise a step on the way: keep going until only one way is left
      if (c.some(m => m.path[steps.length + 1] === s)) {
        steps.push(s);
        const left = cands();
        if (left.length && left.every(m => same(m, left[0]))) { sfx.click(); send(left[0]); return; }
        sfx.hover(); showTargets(); renderDock(); return;
      }
    }
    if (s >= 0 && (s !== sel || steps.length) && mine(s)) {
      if (movesFrom(s).length) { sfx.hover(); select(s); } else { sfx.bad?.(); select(-1); if (forced()) note(S.me, L('You must take', 'Musisz bić'), 1800); }
      return;
    }
    select(-1);
  }
  // squares a tap can do something with right now: where the picked piece can go, and my pieces that can move
  const useful = s => s >= 0 && (targets.includes(s) || (mine(s) && movesFrom(s).length > 0));
  const onMove = e => {
    if (e.pointerType === 'touch' || !scene || !S) return;
    let s = -1;
    if (myTurn() && !busy()) { s = scene.squareAt(e.clientX, e.clientY, useful); if (!useful(s)) s = -1; }
    canvas.classList.toggle('pick', s >= 0); scene.setHover(s);
  };
  let downAt = null;
  const onDown = e => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 14) { downAt = null; return; }
    downAt = null;
    if (scene && myTurn()) { cursor = -1; scene.setCursor(-1); scene.setHover(-1); tap(scene.squareAt(e.clientX, e.clientY, useful)); }
  };
  canvas._wc = { at: s => scene?.squarePx(s, .06), state: () => S }; // for browser tests: where a square is on screen, and what is shown
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
  const onLeave = () => { scene?.setHover(-1); canvas.classList.remove('pick'); };
  canvas.addEventListener('pointerleave', onLeave);
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, flip = scene?.flipped() ? -1 : 1, n = S.size;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
    if (d) {
      if (cursor < 0) cursor = sel >= 0 ? (steps.length ? steps[steps.length - 1] : sel) : (allMoves()[0]?.f ?? 0);
      else { const c = Math.max(0, Math.min(n - 1, (cursor % n) + d[0] * flip)), r = Math.max(0, Math.min(n - 1, Math.floor(cursor / n) + d[1] * flip)); cursor = r * n + c; }
      scene?.setCursor(cursor); sfx.hover();
    } else if ((k === 'Enter' || k === ' ') && cursor >= 0 && !e.target.closest?.('button')) tap(cursor);
    else if (k === 'Escape' && sel >= 0) select(-1);
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderDock(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'draw') { sfx.click(); ctx.act({ t: 'draw' }); }
    else if (a === 'nodraw') { sfx.click(); ctx.act({ t: 'nodraw' }); }
    else if (a === 'resign') {
      sfx.click();
      if (armed > Date.now()) { armed = 0; ctx.act({ t: 'resign' }); } else { armed = Date.now() + 3500; renderDock(); }
    }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
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
