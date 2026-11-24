// Chess game view: HUD over the 3D board. Renders what the server says; you tap a piece, then the square it goes to.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { fromBoard, legal, mFrom, mTo, mPromo, mFlag, pieceName } from './rules.js';
import { pieceSvg } from './glyphs.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 5h11l-2 4 2 4H5" fill="currentColor" fill-opacity=".25"/></svg>',
  shake: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h5l3-3 3 3h7"/><path d="M8 12l3 4 2-2 2 2 3-4"/></svg>',
};
const VALUE = [0, 1, 3, 3, 5, 9, 0];
const LETTER = { N: 2, B: 3, R: 4, Q: 5, K: 6 };
// "Nxf3+" with the letter swapped for a little picture of the piece, so it reads the same in every language
const fig = (san, side) => esc(san).replace(/^[NBRQK]/, c => pieceSvg(LETTER[c], side, 'in')).replace(/=([NBRQ])/, (_, c) => '=' + pieceSvg(LETTER[c], side, 'in'));
function clockText(ms) {
  if (ms <= 0) return '0:00';
  if (ms < 20000) return `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}.${Math.floor(ms % 1000 / 100)}`;
  const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let cssLink = null;
function loadCss() {
  if (cssLink) return cssLink;
  cssLink = document.createElement('link'); cssLink.rel = 'stylesheet'; cssLink.href = new URL('./chess.css', import.meta.url).href; document.head.append(cssLink);
  return cssLink;
}

export function mount(app, ctx) {
  const css = loadCss();
  // sizes measured before the stylesheet arrived are wrong (name tags as wide as the window): measure again once it is in
  if (!css.sheet) css.addEventListener('load', () => { if (!destroyed && S) { render(); layout(); } }, { once: true });
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="ch">
    <canvas class="g3d" aria-label="${L('The chessboard', 'Szachownica')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="ch-info"></span></div>
      <div class="tr"><span class="tcode" id="ch-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="ch-banner" aria-live="polite"></div>
      <div class="shout" id="ch-big" aria-live="assertive"></div>
      <div class="ch-promo" id="ch-promo" hidden></div>
      <div class="ch-dock" id="ch-dock"><div class="ch-ask" id="ch-ask"></div><div class="ch-moves" id="ch-moves"></div><div class="ch-btns" id="ch-btns"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ch'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, recvAt = 0, lastTick = -1, sent = 0;
  let sel = -1, targets = [], cursor = -1, pend = null, moves = [], movesFor = '', armed = 0, movesShown = -1;
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
    if (key !== movesFor) { const p = S.pos; moves = legal(fromBoard(p.b, p.turn, p.castle, p.ep, p.half, p.full)); movesFor = key; }
    return moves;
  }
  const movesFrom = s => allMoves().filter(m => mFrom(m) === s);
  const mine = s => { const p = S.pos.b[s]; return !!p && (p >> 3) === sideOf(S.me); };

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, (innerWidth < 700 ? 196 : 96) * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() { if (scene) scene.setHud(Math.max($('ch-dock').offsetHeight + 30, 70)); }

  // ----- name tags over the avatars: side, name, clock, and what they have taken -----
  function clockNow(i) {
    if (!S.clock) return -1;
    let ms = S.clock[i];
    if (S.ph === 'play' && i === S.turn) ms -= Math.max(0, performance.now() - recvAt - (S.grace || 0));
    return Math.max(0, ms);
  }
  function material(side) { let v = 0; for (const p of S.pos.b) if (p && (p >> 3) === side) v += VALUE[p & 7]; return v; }
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me + '/' + S.white + '/' + !!S.clock;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="ch-tag"><div class="bub"></div><div class="plate">${pieceSvg(6, sideOf(i))}<b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}${i === S.me ? `<span class="you">${L('you', 'ty')}</span>` : ''}${S.clock ? '<span class="cnt clk"></span>' : ''}</div><div class="capt"></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn);
      const lead = material(sideOf(i)) - material(1 - sideOf(i));
      const got = S.caps[i].slice().sort((a, b) => VALUE[b] - VALUE[a] || b - a);
      setHtml(el.querySelector('.capt'), got.length || lead > 0 ? `<span>${got.map(t => pieceSvg(t, 1 - sideOf(i))).join('')}${lead > 0 ? `<em>+${lead}</em>` : ''}</span>` : '');
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
    const el = $('ch-moves');
    if (movesShown === S.gid + S.moves.length) return; movesShown = S.gid + S.moves.length;
    if (!S.moves.length) { el.innerHTML = `<span class="none">${L('White moves first', 'Zaczynają białe')}</span>`; return; }
    el.innerHTML = S.moves.map((m, i) => `${i % 2 ? '' : `<i>${i / 2 + 1}.</i>`}<span class="${i === S.moves.length - 1 ? 'last' : ''}">${fig(m, i % 2)}</span>`).join('');
    el.scrollLeft = el.scrollWidth;
  }
  function renderDock() {
    const p = me(), ask = $('ch-ask'), btns = $('ch-btns');
    if (!S || S.ph !== 'play') { setHtml(ask, ''); setHtml(btns, ''); layout(); return; }
    let a = '';
    if (p && !p.bot && S.offer === 1 - S.me) a = `<span class="ch-wait go"><span>${L(`${nameOf(S.offer)} offers a draw`, `Propozycja remisu: ${nameOf(S.offer)}`)}</span><button type="button" class="btn sm m" data-a="draw">${L('Accept', 'Przyjmij')}</button><button type="button" class="btn sm paper" data-a="nodraw">${L('Decline', 'Odrzuć')}</button></span>`;
    else if (p && S.offer === S.me) a = `<span class="ch-wait"><span>${L('Draw offered. Waiting for an answer…', 'Remis zaproponowany. Czekasz na odpowiedź…')}</span></span>`;
    else if (myTurn() && !busy() && p.st.moved < 2 && sel < 0) a = `<span class="ch-wait go">${pieceSvg(1, sideOf(S.me))}<span>${L('Tap a piece to see where it can go', 'Dotknij figury, żeby zobaczyć jej ruchy')}</span></span>`;
    else if (S.turn >= 0 && S.turn !== S.me) { const t = S.seats[S.turn]; a = `<span class="ch-wait">${avatarHtml(t.color, t.av, 28)}<span>${L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`; }
    else if (p?.bot && S.turn === S.me) a = `<span class="ch-wait"><span>${L('A bot is playing for you', 'Bot gra za ciebie')}</span></span>`;
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
    stalemate: L('Stalemate: no legal move and no check', 'Pat: brak ruchu, a król nie jest szachowany'),
    material: L('Not enough pieces left to mate', 'Za mało figur, żeby dać mata'),
    fifty: L('50 moves without a capture or a pawn move', '50 ruchów bez bicia i bez ruchu pionem'),
    repeat: L('The same position three times', 'Trzy razy ta sama pozycja'),
    agree: L('Draw by agreement', 'Remis za zgodą obu stron'),
    timedraw: L('Time ran out, but the other side could not mate', 'Czas minął, ale druga strona nie ma czym dać mata'),
  });
  function endLine() {
    const R = S.res, w = S.win;
    if (w < 0) return L('Draw', 'Remis') + ' · ' + HOW()[R.how];
    const lost = 1 - w;
    if (R.how === 'mate') return w === S.me ? L('Checkmate! You win', 'Szach-mat! Wygrywasz') : L(`Checkmate! ${nameOf(w)} wins`, `Szach-mat! Wygrywa ${nameOf(w)}`);
    if (R.how === 'resign') return lost === S.me ? L(`You resign. ${nameOf(w)} wins`, `Poddajesz partię. Wygrywa ${nameOf(w)}`) : L(`${nameOf(lost)} resigns. ${w === S.me ? 'You win' : nameOf(w) + ' wins'}`, `${nameOf(lost)} poddaje partię. ${w === S.me ? 'Wygrywasz' : 'Wygrywa ' + nameOf(w)}`);
    return lost === S.me ? L(`Out of time. ${nameOf(w)} wins`, `Koniec czasu. Wygrywa ${nameOf(w)}`) : L(`${nameOf(lost)} is out of time. ${w === S.me ? 'You win' : nameOf(w) + ' wins'}`, `Koniec czasu: ${nameOf(lost)}. ${w === S.me ? 'Wygrywasz' : 'Wygrywa ' + nameOf(w)}`);
  }
  function renderBanner() {
    const el = $('ch-banner'); let msg = '';
    if (!S) return;
    const chk = S.check >= 0 ? ' · ' + L('check!', 'szach!') : '';
    if (S.ph === 'end') msg = endLine();
    else if (myTurn()) msg = L('Your move', 'Twój ruch') + chk;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s move`, `Ruch: ${nameOf(S.turn)}`) + chk;
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    $('ch-info').textContent = L(`Move ${S.pos.full}`, `Ruch ${S.pos.full}`) + ' · ' + (S.clock ? S.clockName : L('no clock', 'bez zegara'));
    $('ch-code').textContent = Rm?.code || '';
    buildTags(); renderMoves(); renderDock(); renderBanner();
    if (!myTurn()) { select(-1); cursor = -1; scene?.setCursor(-1); closePromo(); }
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('ch-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'move') {
      if (e.cap) { sfx.thunk?.(); setTimeout(() => !destroyed && sfx.pop(), 200); } else e.s === S.me ? sfx.place() : sfx.plop?.();
      if (e.promo) setTimeout(() => !destroyed && sfx.combo?.(), 260);
      if (e.check && S.ph === 'play') { setTimeout(() => !destroyed && sfx.warn?.(), 240); big(L('Check!', 'Szach!'), '', 1000); }
    } else if (e.t === 'offer') { if (e.s !== S.me) sfx.pop(); note(e.s, L('Draw?', 'Remis?'), 3200); }
    else if (e.t === 'decline') note(e.s, L('No draw', 'Bez remisu'));
    else if (e.t === 'end') {
      const mate = e.how === 'mate';
      if (e.w === S.me) { sfx.win(); confetti(); big(mate ? L('Checkmate!', 'Szach-mat!') : L('You win!', 'Wygrana!'), mate ? L('You win', 'Wygrywasz') : e.how === 'time' ? L('Your opponent ran out of time', 'Przeciwnikowi skończył się czas') : L('Your opponent resigned', 'Przeciwnik poddaje partię'), 2300); }
      else if (e.w < 0) { sfx.set(); big(L('Draw!', 'Remis!'), HOW()[e.how], 2500); }
      else { S.me >= 0 ? sfx.lose() : sfx.set(); big(mate ? L('Checkmate!', 'Szach-mat!') : L(`${nameOf(e.w)} wins!`, `Wygrywa ${nameOf(e.w)}!`), mate ? L(`${nameOf(e.w)} wins`, `Wygrywa ${nameOf(e.w)}`) : e.how === 'time' ? L('Out of time', 'Koniec czasu') : L('Resignation', 'Partia poddana'), 2300); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2700);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.mv : '';
    S = s; recvAt = performance.now();
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; sel = -1; targets = []; cursor = -1; pend = null; armed = 0; movesShown = -1; notes[0] = notes[1] = null;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.mv === 0) big(s.me < 0 ? L('Chess', 'Szachy') : s.me === s.white ? L('You play White', 'Grasz białymi') : L('You play Black', 'Grasz czarnymi'), s.me === s.white ? L('You move first', 'Zaczynasz') : L(`${nameOf(s.white)} moves first`, `Zaczyna: ${nameOf(s.white)}`), 1600);
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
    const why = tie ? HOW()[R.how] : R.how === 'mate' ? L('Checkmate', 'Szach-mat') : R.how === 'resign' ? L('Resignation', 'Partia poddana') : L('Out of time', 'Koniec czasu');
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${why} · ${cnt(R.moves, 'move', 'moves', 'ruch', 'ruchy', 'ruchów')}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], pos = tie ? 1 : k + 1, side = sideOf(i);
        return `<li class="${!tie && k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${pos}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${pieceSvg(6, side)}${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${side ? L('Black', 'Czarne') : L('White', 'Białe')} · ${L(`${cnt(S.caps[i].length, 'capture', 'captures')}`, `bicia: ${S.caps[i].length}`)}</span></div>
          <strong><span>${tie ? '½' : k === 0 ? '1' : '0'}</span></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Rematch', 'Rewanż'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Rematch', 'Rewanż'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
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
    if (sent && !busy()) { sent = 0; renderDock(); }
    if (armed && armed < Date.now()) { armed = 0; renderDock(); }
    if (myTurn() && S.clock) {
      const n = Math.ceil(clockNow(S.me) / 1000);
      if (n !== lastTick && n <= 10 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 100);

  // ----- input: tap a piece, then where it goes (or move a cursor with the arrow keys and press Enter) -----
  function select(s) {
    if (s === sel) return;
    sel = s; targets = s >= 0 ? movesFrom(s).map(m => ({ t: mTo(m), cap: !!S.pos.b[mTo(m)] || !!(mFlag(m) & 1) })).filter((x, i, a) => a.findIndex(y => y.t === x.t) === i) : [];
    scene?.setSelect(s, targets);
    if (S && S.ph === 'play') renderDock();
  }
  function send(f, t, p) {
    sent = Date.now(); select(-1); closePromo(); cursor = -1; scene?.setCursor(-1);
    ctx.act({ t: 'move', f, to: t, p }); renderDock();
  }
  function closePromo() { pend = null; const el = $('ch-promo'); if (!el.hidden) { el.hidden = true; el.innerHTML = ''; } }
  function askPromo(f, t) {
    pend = { f, t };
    const el = $('ch-promo'), side = sideOf(S.me);
    el.innerHTML = `<b>${L('Promote to', 'Zamień piona na')}</b><div>${[['q', 5], ['r', 4], ['b', 3], ['n', 2]].map(([k, ty]) => `<button type="button" class="ch-pick" data-p="${k}" aria-label="${esc(pieceName(ty))}">${pieceSvg(ty, side)}</button>`).join('')}</div>`;
    el.hidden = false;
    // the HUD may be zoomed on computers: the square's place is in screen pixels, left/top are in the HUD's own
    const z = uiz(), at = scene?.squarePx(t), w = el.offsetWidth * z, h = el.offsetHeight * z;
    if (at) { el.style.left = Math.max(8, Math.min(innerWidth - w - 8, at.x - w / 2)) / z + 'px'; el.style.top = Math.max(70, Math.min(innerHeight - h - 8, at.y + 26)) / z + 'px'; }
    sfx.pop();
  }
  function tap(s) {
    if (!myTurn() || busy()) return;
    if (pend) { closePromo(); select(-1); return; }
    if (sel >= 0 && targets.some(x => x.t === s)) {
      const promo = movesFrom(sel).some(m => mTo(m) === s && mPromo(m));
      if (promo) { askPromo(sel, s); return; }
      sfx.click(); send(sel, s);
      return;
    }
    if (s >= 0 && s !== sel && mine(s)) {
      if (movesFrom(s).length) { sfx.hover(); select(s); } else { sfx.bad?.(); select(-1); }
      return;
    }
    select(-1);
  }
  const onMove = e => {
    if (e.pointerType === 'touch' || !scene || !S) return;
    let hot = false;
    if (myTurn() && !busy()) { const s = scene.squareAt(e.clientX, e.clientY); hot = s >= 0 && ((mine(s) && movesFrom(s).length > 0) || targets.some(x => x.t === s)); }
    canvas.classList.toggle('pick', hot);
  };
  let downAt = null;
  const onDown = e => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 14) { downAt = null; return; }
    downAt = null;
    if (scene && myTurn()) { cursor = -1; scene.setCursor(-1); tap(scene.squareAt(e.clientX, e.clientY)); }
  };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, flip = scene?.flipped() ? -1 : 1;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
    if (d) {
      if (cursor < 0) cursor = sel >= 0 ? sel : (S.me === S.white ? 12 : 52);
      else { const f = Math.max(0, Math.min(7, (cursor & 7) + d[0] * flip)), r = Math.max(0, Math.min(7, (cursor >> 3) + d[1] * flip)); cursor = r * 8 + f; }
      scene?.setCursor(cursor); sfx.hover();
    } else if ((k === 'Enter' || k === ' ') && cursor >= 0 && !e.target.closest?.('button')) tap(cursor);
    else if (k === 'Escape' && (sel >= 0 || pend)) { closePromo(); select(-1); }
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) { closePromo(); renderDock(); } };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const pk = e.target.closest('[data-p]');
    if (pk && pend) { sfx.click(); send(pend.f, pend.t, pk.dataset.p); return; }
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
    const b = e.target.closest('.btn, .round, .ch-pick');
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
