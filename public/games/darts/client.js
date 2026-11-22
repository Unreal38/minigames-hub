// Sky Darts game view: HUD over the 3D board. Renders what the server says; turns your pointer into an aim,
// a hold into a steady hand, and letting go into a throw.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';
import { R, DARTS, MS, HAND, score, outText } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const clampAim = v => Math.max(-R.frame, Math.min(R.frame, v));

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./darts.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="sdt">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="sdt-info"></span></div>
      <div class="tr"><span class="tcode" id="sdt-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="sdt-banner" aria-live="polite"></div>
      <div class="shout" id="sdt-big" aria-live="assertive"></div>
      <ol class="list" id="sdt-list" aria-label="Players"></ol>
      <div class="turn" id="sdt-turn"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.sdt'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, lastCue = 0;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, shown = [], shownDarts = 0;
  // the aim: where you point (board units), what is steering it, and since when the hand has been held still
  const aim = { x: 0, y: .3, cursor: null, holdAt: 0, touch: null, key: false, lab: '', dartN: -1, warned: false };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); render(); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const myTurn = () => S && S.ph === 'play' && S.stage === 'aim' && S.turn === S.me && me() && !me().bot;
  const canThrow = () => myTurn() && Date.now() - sent > 1200;
  const dbl = () => S.out === 'double', small = () => innerWidth < 700;

  function sync() {
    if (!scene || !S) return;
    scene.setSeats(S.seats, S.me);
    scene.setState(S);
  }

  function onFrame(info) {
    live = info;
    // the mouse steers the aim directly; keep it under the cursor even while the camera settles
    if (myTurn()) {
      if (aim.cursor && !aim.touch) { const p = scene.toBoard(aim.cursor[0], aim.cursor[1]); if (p) { aim.x = clampAim(p[0]); aim.y = clampAim(p[1]); } }
      if (aim.keys) { const k = aim.keys, sp = .012; aim.x = clampAim(aim.x + ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) * sp); aim.y = clampAim(aim.y + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * sp); }
      scene.setAim({ x: aim.x, y: aim.y, hold: aim.holdAt ? performance.now() - aim.holdAt : -1 });
    } else scene.setAim(null);
    const lab = info.aimLab ? score(info.aimLab[0], info.aimLab[1]).lab : '';
    if (lab !== aim.lab) { aim.lab = lab; const el = root.querySelector('#sdt-aim'); if (el) el.textContent = lab || '–'; }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="sdt-tag${i === S.me ? ' sdt-you' : ''}" hidden><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play');
      const sp = el.lastElementChild, v = String(shown[i] ?? p.rem); if (sp.textContent !== v) sp.textContent = v;
    });
  }
  function floatAt(x, y, text, cls = '') {
    const f = document.createElement('div');
    f.className = 'sdt-pts ' + cls; f.textContent = text;
    f.style.left = `${x}px`; f.style.top = `${y}px`;
    root.append(f); setTimeout(() => f.remove(), 1300);
  }
  const settle = () => { shown = S.seats.map(p => p.rem); shownDarts = S.darts.length; };

  // A cue from the 3D scene: a dart has been thrown, or has just landed.
  function onCue(c) {
    if (!S) return;
    if (c.k === 'throw') { sfx.whoosh(); return; }
    if (c.k !== 'hit' || c.n === lastCue) return;
    lastCue = c.n;
    settle(); render();
    const who = youOr(c.s), mine = c.s === S.me;
    if (c.v) sfx.thunk(); else sfx.place();
    floatAt(c.sx, c.sy - 26, c.lab === 'Miss' ? 'Miss' : c.lab, c.bust ? 'bad' : c.m === 3 ? 't' : c.m === 2 ? 'd' : c.v ? '' : 'bad');
    if (c.out) { sfx.win(); big(mine ? 'Game shot!' : 'Checkout!', `${who} finish${mine ? '' : 'es'} from ${c.got}`, 2400); if (mine) confetti(); }
    else if (c.bust) { sfx.bad(); big('Bust!', `${mine ? 'Your' : who + '’s'} score goes back to ${S.seats[c.s].rem}`, 1700); }
    else if (c.fin && c.got === 180) { sfx.win(); big('180!', `${who} hit${mine ? '' : 's'} the maximum`, 2000); confetti(); }
    else if (c.num === 25 && c.m === 2) { sfx.set(); big('Bullseye!', '', 1100); }
    else if (c.fin && c.got >= 100) { sfx.set(); big('Ton!', `${who} score${mine ? '' : 's'} ${c.got}`, 1300); }
    else if (c.m === 3 && c.num >= 17) sfx.set();
  }

  // ----- rendering -----
  function renderList() {
    if (!S) return;
    setHtml($('sdt-list'), S.seats.map((p, i) => {
      const now = i === S.turn && S.ph === 'play';
      const legs = S.legsTo > 1 ? `<em>${'●'.repeat(p.legs)}${'○'.repeat(Math.max(0, S.legsTo - p.legs))}</em>` : '';
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' me' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${nameHtml(p.name, p.fl)}</b>${legs}<span>${shown[i] ?? p.rem}</span></li>`;
    }).join(''));
  }

  function renderTurn() {
    const el = $('sdt-turn');
    if (!S || S.ph !== 'play') { setHtml(el, ''); el.hidden = true; return; }
    el.hidden = false;
    const p = S.seats[S.turn], ds = S.darts.slice(0, shownDarts), bust = ds.some(d => d.bust), sum = bust ? 0 : ds.reduce((t, d) => t + d.v, 0);
    const left = shown[S.turn] ?? p.rem, slots = Array.from({ length: DARTS }, (_, k) => {
      const d = ds[k]; return `<i class="${d ? (d.bust ? 'bad' : d.m === 3 ? 't' : d.m === 2 ? 'd' : d.v ? 'hit' : 'bad') : k === ds.length && S.stage === 'aim' ? 'next' : ''}">${d ? esc(d.lab) : ''}</i>`;
    }).join('');
    const hint = S.stage === 'aim' && !bust ? outText(left, DARTS - ds.length, dbl()) : '';
    const mine = myTurn(), touch = matchMedia('(pointer: coarse)').matches;
    const flat = root.classList.contains('flat');
    el.classList.toggle('mine', !!mine);
    setHtml(el, `<div class="row">${avatarHtml(p.color, p.av, 34)}<div class="slots">${slots}</div><div class="sum"><b>${bust ? 'Bust' : sum}</b><small>this turn</small></div><div class="sum left"><b>${left}</b><small>left</small></div></div>
      ${hint ? `<div class="out">Finish: <b>${esc(hint)}</b></div>` : ''}
      ${mine ? (flat ? '<button type="button" class="btn big r" data-a="lob">Throw</button>'
        : `<div class="tip"><span>Aiming at <b id="sdt-aim">${esc(aim.lab) || '–'}</b></span><span>${touch ? 'Drag to aim, hold still to steady, lift to throw' : 'Hold the button to steady your hand, let go to throw'}</span></div>`) : ''}`);
  }

  function renderBanner() {
    const el = $('sdt-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.ph === 'end') msg = S.win >= 0 ? `${youOr(S.win)} win${S.win === S.me ? '' : 's'}!` : '';
    else if (myTurn()) msg = `Your throw · ${small() ? `${S.darts.length + 1}/${DARTS}` : `dart ${S.darts.length + 1} of ${DARTS}`}${S.left >= 0 ? ` · ${secs}s` : ''}`;
    else if (S.turn === S.me) msg = me()?.bot ? 'A bot is throwing for you' : 'Your throw';
    else msg = `${nameOf(S.turn)} is throwing`;
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', !!myTurn());
  }

  function render() {
    if (!S) return;
    const rd = Math.min(S.round, S.rounds);
    $('sdt-info').textContent = small() ? `${S.legsTo > 1 ? `Leg ${S.leg} · ` : ''}Round ${rd}/${S.rounds}` : `${S.legsTo > 1 ? `Leg ${S.leg} · ` : ''}Round ${rd} of ${S.rounds} · ${S.start} ${S.out === 'double' ? 'double out' : 'any finish'}`;
    $('sdt-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderTurn(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('sdt-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? 'You took over a bot. Your throw is coming up!' : `${nameOf(e.s)} took over a bot`); }
    else if (e.t === 'leg') { sfx.draw(); ctx.toast(`${youOr(e.w)} took the leg. Leg ${e.k} starts!`); }
    else if (e.t === 'cap') ctx.toast(`Last round over: ${youOr(e.s)} had the least left and take${e.s === S.me ? '' : 's'} the leg`);
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 3000);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prevDart = S?.dart?.n;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; lastCue = s.last?.n || 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    // a dart's score shows when it lands (the scene's cue), not when it is let go
    const inAir = scene && !reduced && !fresh && s.stage === 'fly' && s.last && s.last.ago < MS.fly && s.last.n !== lastCue;
    if (!inAir) settle(); else shownDarts = Math.max(0, s.darts.length - 1);
    endsAt = performance.now() + Math.max(0, s.left);
    if (s.dart && s.dart.n !== prevDart) { // a new dart is up
      aim.holdAt = 0; aim.touch = null; aim.key = false; lastTick = -1; sent = 0;
      if (myTurn() && !fresh && s.dart.k === 0) sfx.turn();
    }
    render(); sync();
    if (!scene && s.last && s.last.n !== lastCue && !fresh) onCue({ k: 'hit', ...s.last, sx: innerWidth / 2, sy: innerHeight * .4 });
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? 'You win the match!' : `${nameOf(w)} wins!`}</h2>
      <p>${myPlace ? (myPlace === 1 ? 'Steady hand, sharp eye. ' : `You came ${ORD(myPlace)}. `) : ''}${S.start} ${S.out === 'double' ? 'double out' : 'any finish'}${S.legsTo > 1 ? `, first to ${S.legsTo} legs` : ''}.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st, avg = st.darts ? (st.scored / st.darts * 3).toFixed(1) : '0';
        const main = S.legsTo > 1 ? `${p.legs}<small>leg${p.legs === 1 ? '' : 's'}</small>` : p.rem === 0 ? 'Out!<small>finished</small>' : `${p.rem}<small>left</small>`;
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? ' (you)' : ''}</b><span>avg ${avg} · best turn ${st.best}${st.t180 ? ` · ${st.t180}× 180` : ''} · ${st.busts} bust${st.busts === 1 ? '' : 's'}</span></div>
          <strong>${main}</strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Play again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Play again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 60 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (reduced) return;
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
    if (myTurn()) {
      if (S.left >= 0) { const n = Math.ceil((endsAt - performance.now()) / 1000); if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); } }
      // the arm is getting tired: a little warning tick
      if (aim.holdAt && performance.now() - aim.holdAt > HAND.tire && !aim.warned) { aim.warned = true; sfx.warn(); }
    }
  }, 200);

  // ----- throwing -----
  function startHold() { if (!canThrow() || aim.holdAt) return false; aim.holdAt = performance.now(); aim.warned = false; return true; }
  function letGo() {
    if (!aim.holdAt) return;
    const hold = performance.now() - aim.holdAt; aim.holdAt = 0;
    if (!canThrow() || !scene) return;
    sent = Date.now();
    ctx.act({ t: 'throw', x: +aim.x.toFixed(4), y: +aim.y.toFixed(4), ms: Math.round(scene.dartMs()), hold: Math.round(hold) });
  }
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { aim.cursor = [e.clientX, e.clientY]; aim.touch = null; return; }
    const t = aim.touch; if (!t || t.id !== e.pointerId || !scene) return;
    const k = scene.pxPerUnit() || 200;
    aim.x = clampAim(aim.x + (e.clientX - t.x) / k); aim.y = clampAim(aim.y - (e.clientY - t.y) / k);
    t.x = e.clientX; t.y = e.clientY;
  });
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { if (e.button !== 0) return; aim.cursor = [e.clientX, e.clientY]; aim.touch = null; }
    else { aim.cursor = null; aim.touch = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
    if (startHold()) { try { canvas.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); }
  });
  const onUp = e => { if (e.pointerType !== 'mouse' && aim.touch?.id !== e.pointerId) return; aim.touch = null; letGo(); };
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { aim.touch = null; aim.holdAt = 0; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  const onKey = e => {
    if (e.target.closest?.('input, textarea, button') || !myTurn()) return;
    if (ARROWS.includes(e.key)) { e.preventDefault(); aim.cursor = null; (aim.keys ||= {})[e.key] = true; }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) { aim.key = true; startHold(); } }
  };
  const onKeyUp = e => {
    if (ARROWS.includes(e.key) && aim.keys) aim.keys[e.key] = false;
    else if ((e.key === ' ' || e.key === 'Enter') && aim.key) { aim.key = false; letGo(); }
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'lob') { if (canThrow()) { sent = Date.now(); ctx.act({ t: 'throw', x: 0, y: .3 }); } } // no 3D on this device: a plain throw at the board
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
