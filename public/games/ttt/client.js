// Tic-Tac-Toe game view: HUD over the 3D board. Renders what the server says and sends the square you pick.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';
import { place } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
// a player's mark as a small picture in their colour: seat 0 is the cross, seat 1 the nought
const markSvg = (s, color) => `<svg class="tt-mk" viewBox="0 0 24 24" aria-hidden="true">${s === 0
  ? `<path d="M5 5l14 14M19 5L5 19" stroke="#3b2219" stroke-width="8" stroke-linecap="square"/><path d="M5 5l14 14M19 5L5 19" stroke="${esc(color)}" stroke-width="4.4" stroke-linecap="square"/>`
  : `<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" fill="${esc(color)}" stroke="#3b2219" stroke-width="2"/><path d="M10 7.6h4l2.4 2.4v4L14 16.4h-4L7.6 14v-4z" fill="#fff4e2" stroke="#3b2219" stroke-width="2"/>`}</svg>`;

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./ttt.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="tt">
    <canvas class="g3d" aria-label="${L('The board', 'Plansza')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="tt-info"></span></div>
      <div class="tr"><span class="tcode" id="tt-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="tt-banner" aria-live="polite"></div>
      <div class="tt-board" id="tt-score"></div>
      <div class="shout" id="tt-big" aria-live="assertive"></div>
      <div class="tt-dock" id="tt-dock"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.tt'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, cursor = -1;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && me() && !me().bot);
  const canPlace = c => myTurn() && Date.now() - sent >= 1200 && !!place(S.board, S.order, S.me, c, S.mode);

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, innerWidth < 700 ? 200 : 150).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() { if (scene) scene.setHud(Math.max($('tt-dock').offsetHeight + 34, 100)); }

  // ----- name tags over the avatars: mark, name, round wins -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="tt-tag"><div class="bub"></div><div class="plate">${markSvg(i, p.color)}<b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}${i === S.me ? `<span class="you">${L('you', 'ty')}</span>` : ''}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'play');
      setHtml(el.querySelector('.plate .cnt'), String(S.wins[i]));
      setHtml(el.firstElementChild, S.stage === 'round' && S.roundWin === i ? `<span>${L('+1 round', '+1 runda')}</span>` : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }

  function renderDock() {
    const p = me(), dock = $('tt-dock');
    if (!S || S.ph !== 'play') { setHtml(dock, ''); layout(); return; }
    const busy = Date.now() - sent < 1200;
    let html = '';
    if (S.stage === 'round') html = `<span class="tt-wait"><span style="padding-left:10px">${L('Next round coming up…', 'Zaraz następna runda…')}</span></span>`;
    else if (myTurn() && !busy) {
      html = `<span class="tt-wait go">${markSvg(S.me, p.color)}<span>${L('Tap a square to place your mark', 'Dotknij pola, żeby postawić swój znak')}</span></span>`;
      if (S.keep && S.fade >= 0) html += `<p class="tt-hint">${L('Your faded mark vanishes when you place this one.', 'Twój wyblakły znak zniknie, gdy postawisz ten.')}</p>`;
      else if (S.keep) html += `<p class="tt-hint">${L(`You only keep your ${S.keep} newest marks.`, `Na planszy zostają tylko twoje ${S.keep} najnowsze znaki.`)}</p>`;
      else if (S.k !== 3) html += `<p class="tt-hint">${L(`Line up ${S.k} to win the round.`, `Ułóż ${S.k} w linii, żeby wygrać rundę.`)}</p>`;
    } else if (S.turn >= 0) {
      const t = S.seats[S.turn];
      html = `<span class="tt-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p?.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span></span>`;
    }
    setHtml(dock, html); layout();
  }

  function renderBanner() {
    const el = $('tt-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win < 0 ? L('The match is a draw', 'Mecz kończy się remisem') : S.win === S.me ? L('You win the match!', 'Wygrywasz mecz!') : L(`${nameOf(S.win)} wins the match!`, `Mecz wygrywa: ${nameOf(S.win)}`);
    else if (S.stage === 'round') msg = S.roundWin < 0 ? L('Draw · nobody takes this round', 'Remis · nikt nie wygrywa tej rundy') : S.roundWin === S.me ? L('You take the round!', 'Wygrywasz rundę!') : L(`${nameOf(S.roundWin)} takes the round`, `Rundę wygrywa: ${nameOf(S.roundWin)}`);
    else if (myTurn()) msg = L('Your turn', 'Twoja kolej') + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`) + (S.turn === S.me ? '' : t);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    const a = S.me === 1 ? 1 : 0, b = 1 - a; // your score on the left, like your seat
    $('tt-info').textContent = (S.to > 1 ? L(`Round ${S.round} · first to ${S.to}`, `Runda ${S.round} · do ${S.to} wygranych`) : S.round > 1 ? L(`Round ${S.round} · next win takes it`, `Runda ${S.round} · gra do pierwszej wygranej`) : L('One round', 'Jedna runda'));
    $('tt-code').textContent = Rm?.code || '';
    setHtml($('tt-score'), `${markSvg(a, S.seats[a].color)}<span>${S.wins[a]} : ${S.wins[b]}</span>${markSvg(b, S.seats[b].color)}${S.draws ? `<small>${L(`draws: ${S.draws}`, `remisy: ${S.draws}`)}</small>` : ''}`);
    buildTags(); renderDock(); renderBanner();
    canvas.classList.toggle('pick', myTurn());
    if (!myTurn()) { cursor = -1; scene?.setHover(-1, -1); }
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('tt-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'place') { e.s === S.me ? sfx.place() : sfx.pop(); setTimeout(() => !destroyed && sfx.thunk?.(), 170); if (e.gone >= 0) sfx.whoosh?.(); }
    else if (e.t === 'round') {
      const last = S.ph === 'end';
      if (e.w < 0) { sfx.set(); if (!last) big(L('Draw!', 'Remis!'), S.keep ? L('Too many marks without a line', 'Za dużo znaków bez linii') : L('The board is full', 'Plansza jest pełna'), 1900); }
      else if (e.w === S.me) { sfx.win(); if (!last) { confetti(); big(L('Your round!', 'Twoja runda!'), `${e.wins[S.me]} : ${e.wins[1 - S.me]}`, 1900); } }
      else { S.me >= 0 ? sfx.lose() : sfx.set(); if (!last) big(L(`${nameOf(e.w)} takes it`, `Runda: ${nameOf(e.w)}`), S.me >= 0 ? `${e.wins[S.me]} : ${e.wins[1 - S.me]}` : `${e.wins[0]} : ${e.wins[1]}`, 1900); }
    } else if (e.t === 'start') { sfx.turn(); big(L(`Round ${e.round}`, `Runda ${e.round}`), e.s === S.me ? L('You start', 'Zaczynasz') : L(`${nameOf(e.s)} starts`, `Zaczyna: ${nameOf(e.s)}`), 1300); }
    else if (e.t === 'end') {
      if (e.w === S.me) { confetti(); big(L('You win!', 'Wygrana!'), L('The match is yours', 'Mecz jest twój'), 2200); }
      else big(e.w < 0 ? L('Draw!', 'Remis!') : L(`${nameOf(e.w)} wins!`, `Wygrywa ${nameOf(e.w)}!`), e.w < 0 ? L('Nobody takes the match', 'Nikt nie wygrywa meczu') : '', 2200);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; cursor = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.mv === 0 && s.round === 1) big(L('Round 1', 'Runda 1'), s.turn === s.me ? L('You start', 'Zaczynasz') : L(`${nameOf(s.turn)} starts`, `Zaczyna: ${nameOf(s.turn)}`), 1300);
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (!fresh && myTurn() && was !== s.turn + '/' + s.stage + '/' + s.mv) { sfx.turn(); lastTick = -1; sent = 0; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res;
    const order = [0, 1].sort((a, b) => R.wins[b] - R.wins[a]);
    const head = R.tie ? L('It’s a draw!', 'Remis!') : S.win === S.me ? L('You win the match!', 'Wygrywasz mecz!') : L(`${nameOf(S.win)} wins the match!`, `Wygrywa ${nameOf(S.win)}!`);
    const sub = L(`${cnt(R.rounds, 'round', 'rounds')} played`, `Rozegrane rundy: ${R.rounds}`) + (R.draws ? L(`, ${cnt(R.draws, 'draw', 'draws')}.`, `, w tym remisy: ${R.draws}.`) : '.');
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], pos = R.tie ? 1 : k + 1;
        return `<li class="${!R.tie && k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${pos}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${markSvg(i, p.color)}${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(p.st.placed, 'mark', 'marks')} placed`, `postawione znaki: ${p.st.placed}`)}</span></div>
          <strong><span>${R.wins[i]}</span><small>${L(R.wins[i] === 1 ? 'round won' : 'rounds won', 'wygrane rundy')}</small></strong>${paidHtml(Rm, i)}</li>`;
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
    renderBanner();
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input: point at a square (or move with the arrow keys) and tap -----
  function go(c) {
    if (!myTurn() || Date.now() - sent < 1200) return;
    if (!place(S.board, S.order, S.me, c, S.mode)) { sfx.bad?.(); return; }
    sent = Date.now(); cursor = -1; scene?.setHover(-1, -1); sfx.click(); ctx.act({ t: 'place', c }); renderDock();
  }
  const point = e => { if (!scene) return -1; const c = scene.cellAt(e.clientX, e.clientY); return c; };
  const onMove = e => { if (e.pointerType === 'touch') return; const c = point(e); cursor = -1; scene?.setHover(canPlace(c) ? c : -1, S ? S.me : -1); };
  const onLeave = () => { if (cursor < 0) scene?.setHover(-1, -1); };
  let downAt = null;
  const onDown = e => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 14) { downAt = null; return; }
    downAt = null;
    const c = point(e); if (c >= 0 && myTurn()) go(c);
  };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = S.n, k = e.key;
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k];
    if (d) {
      if (cursor < 0) cursor = (n * n) >> 1;
      else { const r = Math.max(0, Math.min(n - 1, (cursor / n | 0) + d[0])), q = Math.max(0, Math.min(n - 1, cursor % n + d[1])); cursor = r * n + q; }
      for (let i = 0; i < n * n && !canPlace(cursor); i++) cursor = (cursor + (d[0] + d[1] > 0 ? 1 : n * n - 1)) % (n * n); // skip taken squares
      scene?.setHover(cursor, S.me); sfx.hover();
    } else if ((k === 'Enter' || k === ' ') && cursor >= 0 && !e.target.closest?.('button')) go(cursor);
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
