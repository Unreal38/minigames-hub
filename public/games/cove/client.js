// Cove Clash game view: HUD over the 3D bays. Renders what the server says, lets you arrange your boats before the
// game (drag to move, tap to turn) and sends the square you shoot at.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { boardName, cellsOf, fits, randomFleet, SEA } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  boat: '<svg class="cv-bi" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h18l-3 6H6z" fill="currentColor" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><path d="M12 3v8M12 4l6 5h-6" fill="#fff4e2" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const FLY = 800; // ms a coconut is in the air (the scene's FLY)

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./cove.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="cv">
    <canvas class="g3d" aria-label="${L('The two bays', 'Dwie zatoki')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="cv-info"></span></div>
      <div class="tr"><span class="tcode" id="cv-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="cv-banner" aria-live="polite"></div>
      <div class="cv-fleets" id="cv-fleets"></div>
      <div class="shout" id="cv-big" aria-live="assertive"></div>
      <div class="cv-dock" id="cv-dock"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.cv'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, setupEnds = 0, lockUntil = 0, lastTick = -1, sent = 0, cursor = -1;
  let lay = null, bad = new Set(), drag = null, laySent = '', hitNote = 0;
  const timers = new Set(), later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); pushLayout(); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const playing = () => !!(S && S.ph === 'play' && me() && !me().bot);
  const arranging = () => playing() && S.stage === 'setup' && !S.ready[S.me];
  const myTurn = () => playing() && S.stage === 'play' && S.turn === S.me;
  const canFire = c => myTurn() && performance.now() >= lockUntil && Date.now() - sent >= 1500 && c >= 0 && S.sea[1 - S.me][c] === SEA;

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = t.k < .9 ? `translate(${x.toFixed(1)}px, ${t.yb.toFixed(1)}px) translate(-50%, 0)` : `translate(${x.toFixed(1)}px, ${Math.max(t.y, innerWidth < 700 ? 112 : 64).toFixed(1)}px) translate(-50%, -100%)`;
      el.classList.toggle('under', t.k < .9);
    }
  }
  function layout() { if (scene) scene.setHud(Math.max($('cv-dock').offsetHeight + 30, 84)); }

  // ----- arranging your boats -----
  const N = () => S.n;
  function check() { bad = new Set(lay.map((_, i) => i).filter(i => !fits(lay, i, N()))); }
  function pushLayout() { if (!scene) return; if (arranging() && lay) scene.setLayout(lay.map(b => ({ ...b, sunk: false })), bad, drag ? drag.i : -1); else scene.setLayout(null); }
  function sendLayout() {
    if (!lay || bad.size) return;
    const key = lay.map(b => b.c + '/' + b.v).join();
    if (key === laySent) return;
    laySent = key; ctx.act({ t: 'layout', boats: lay.map(b => [b.c, b.v]) });
  }
  // keep a boat's first square inside the bay
  function clamp(b, r, q) { const n = N(); r = Math.max(0, Math.min(b.v ? n - b.len : n - 1, r)); q = Math.max(0, Math.min(b.v ? n - 1 : n - b.len, q)); return r * n + q; }
  function boatAt(c) { for (let i = 0; i < lay.length; i++) if ((cellsOf(lay[i], N()) || []).includes(c)) return i; return -1; }

  // ----- name tags over the avatars: name, boats still afloat -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="cv-tag"><div class="bub"></div><div class="plate"><i class="dot" style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}${i === S.me ? `<span class="you">${L('you', 'ty')}</span>` : ''}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'play');
      setHtml(el.querySelector('.plate .cnt'), `${I.boat}${S.left[i].length}`);
      setHtml(el.firstElementChild, S.stage === 'setup' && S.ready[i] ? `<span>${L('Ready!', 'Gotowe!')}</span>` : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }

  // both fleets as rows of little boats: the ones already sunk are greyed out
  function renderFleets() {
    const el = $('cv-fleets');
    if (!S || S.stage === 'setup') { setHtml(el, ''); return; }
    const mine = S.me >= 0 ? S.me : 0, order = [1 - mine, mine];
    setHtml(el, order.map(i => {
      const left = S.left[i].slice(), p = S.seats[i];
      const pips = S.lens.map(len => { const k = left.indexOf(len), up = k >= 0; if (up) left.splice(k, 1); return `<i class="${up ? '' : 'gone'}" style="--n:${len};--c:${esc(p.color)}"></i>`; }).join('');
      return `<div class="row${i === mine ? ' own' : ''}"><b>${i === S.me ? L('Your boats', 'Twoje łódki') : nameOf(i)}</b><span class="pips">${pips}</span></div>`;
    }).join(''));
  }

  function renderDock() {
    const p = me(), dock = $('cv-dock');
    if (!S || S.ph !== 'play') { setHtml(dock, ''); layout(); return; }
    let html = '';
    if (S.stage === 'setup') {
      if (!playing()) html = `<span class="cv-wait"><span class="pl">${L('The players are arranging their boats…', 'Gracze ustawiają swoje łódki…')}</span></span>`;
      else if (!S.ready[S.me]) {
        html = `<p class="cv-hint${bad.size ? ' bad' : ''}">${bad.size ? L('Boats can’t touch, not even at the corners. Move the red ones.', 'Łódki nie mogą się stykać, nawet rogami. Przesuń czerwone.') : L('Drag a boat to move it. Tap it to turn it.', 'Przeciągnij łódkę, żeby ją przesunąć. Dotknij jej, żeby ją obrócić.')}</p>
          <div class="cv-btns"><button type="button" class="btn ghost" data-a="shuffle">${L('Shuffle', 'Wylosuj')}</button><button type="button" class="btn" data-a="ready"${bad.size ? ' disabled' : ''}>${L('Ready', 'Gotowe')}</button></div>`;
      } else html = `<span class="cv-wait"><span class="pl">${L(`Waiting for ${nameOf(1 - S.me)}…`, `Czekamy: ${nameOf(1 - S.me)}…`)}</span></span><div class="cv-btns"><button type="button" class="btn ghost sm" data-a="unready">${L('Change my boats', 'Zmień ustawienie')}</button></div>`;
    } else if (S.stage === 'go') html = `<span class="cv-wait"><span class="pl">${L('Everyone is ready!', 'Wszyscy gotowi!')}</span></span>`;
    else if (myTurn()) {
      html = `<span class="cv-wait go"><span class="pl">${L(`Tap a square in ${nameOf(1 - S.me)}’s bay`, `Dotknij pola w zatoce (${nameOf(1 - S.me)})`)}</span></span>`;
      if (Date.now() < hitNote) html += `<p class="cv-hint">${L('A hit gives you another shot.', 'Trafienie daje kolejny strzał.')}</p>`;
    } else if (S.turn >= 0) {
      const t = S.seats[S.turn];
      html = `<span class="cv-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? L('A bot is playing for you', 'Bot gra za ciebie') : L(`${nameOf(S.turn)} is aiming…`, `${nameOf(S.turn)} celuje…`)}</span></span>`;
    }
    setHtml(dock, html); layout();
  }

  function renderBanner() {
    const el = $('cv-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    else if (S.stage === 'setup') msg = (playing() ? L('Arrange your boats', 'Ustaw swoje łódki') : L('Boats are being arranged', 'Trwa ustawianie łódek')) + ` · ${Math.max(0, Math.ceil((setupEnds - performance.now()) / 1000))}s`;
    else if (S.stage === 'go') msg = S.starter === S.me ? L('You shoot first', 'Zaczynasz') : L(`${nameOf(S.starter)} shoots first`, `Zaczyna: ${nameOf(S.starter)}`);
    else if (myTurn()) msg = L('Your shot', 'Twój strzał') + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s shot`, `Strzela: ${nameOf(S.turn)}`) + (S.turn === S.me ? '' : t);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn() || arranging());
  }

  function render() {
    if (!S) return;
    $('cv-info').textContent = `${boardName(S.board)} · ${S.n}×${S.n}`;
    $('cv-code').textContent = Rm?.code || '';
    buildTags(); renderFleets(); renderDock(); renderBanner();
    canvas.classList.toggle('pick', myTurn() || arranging());
    if (!myTurn()) { cursor = -1; scene?.setHover(-1, -1); }
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('cv-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  const boatWord = len => (len === 1 ? L('a 1-square boat', 'łódka na 1 pole') : L(`a ${len}-square boat`, `łódka na ${len} pola`));
  function playEv(e) {
    if (e.t === 'fire') {
      sfx.whoosh();
      later(() => {
        const mineShot = e.s === S.me, atMe = S.me >= 0 && !mineShot;
        if (e.r === 'miss') { sfx.plop(); }
        else if (e.r === 'hit') { sfx.thunk(); sfx.pop(); if (mineShot) { hitNote = Date.now() + 4000; renderDock(); } }
        else {
          sfx.boom(); later(() => sfx.set(), 180);
          if (S.ph !== 'end') big(L('Sunk!', 'Zatopiona!'), mineShot ? boatWord(e.boat.len) : atMe ? L(`Your boat (${e.boat.len})`, `Twoja łódka (${e.boat.len})`) : `${nameOf(1 - e.s)}: ${boatWord(e.boat.len)}`, 1500);
        }
      }, FLY);
    } else if (e.t === 'start') { sfx.turn(); big(L('Coconuts away!', 'Kokosy w ruch!'), e.s === S.me ? L('You shoot first', 'Zaczynasz') : L(`${nameOf(e.s)} shoots first`, `Zaczyna: ${nameOf(e.s)}`), 1500); }
    else if (e.t === 'end') {
      later(() => {
        if (e.w === S.me) { sfx.win(); confetti(); big(L('You win!', 'Wygrana!'), L('The whole fleet is sunk', 'Cała flota zatopiona'), 2200); }
        else { S.me >= 0 ? sfx.lose() : sfx.set(); big(L(`${nameOf(e.w)} wins!`, `Wygrywa ${nameOf(e.w)}!`), '', 2200); }
      }, FLY + 500);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, FLY + 3100);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '', wasStage = S?.stage;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; cursor = -1; lay = null; laySent = ''; drag = null; hitNote = 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    if (s.stage === 'setup' && s.me >= 0 && (!lay || s.ready[s.me])) { lay = s.boats[s.me].map(b => ({ c: b.c, len: b.len, v: b.v })); laySent = lay.map(b => b.c + '/' + b.v).join(); check(); }
    if (s.stage !== 'setup') { lay = null; drag = null; }
    endsAt = performance.now() + Math.max(0, s.tLeft); setupEnds = performance.now() + s.setupLeft; lockUntil = performance.now() + (s.lock || 0);
    const now = s.turn + '/' + s.stage + '/' + s.mv;
    if (!fresh && was !== now) { sent = 0; lastTick = -1; if (myTurn() && (wasStage !== 'play' || was.split('/')[0] !== String(s.me))) later(() => sfx.turn(), s.lock || 0); }
    render(); scene?.setState(s); pushLayout();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, total = S.lens.reduce((a, b) => a + b, 0);
    const order = [S.win, 1 - S.win];
    const head = S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    const sub = L(`The whole fleet went down in ${cnt(R.shots[S.win], 'shot', 'shots')}.`, `Cała flota zatopiona. Oddane strzały: ${R.shots[S.win]}.`);
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], sunk = S.lens.length - R.left[1 - i];
        return `<li class="${k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${p.st.hits} of ${total} squares hit · ${cnt(p.st.shots, 'shot', 'shots')}`, `trafione pola: ${p.st.hits} z ${total} · strzały: ${p.st.shots}`)}</span></div>
          <strong><span>${sunk}</span><small>${L(sunk === 1 ? 'boat sunk' : 'boats sunk', 'zatopione łódki')}</small></strong>${paidHtml(Rm, i)}</li>`;
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
    for (const el of tagEls) el._w = el.offsetWidth; // the first measure can come before the stylesheet has loaded
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (sent && Date.now() - sent >= 1500) { sent = 0; renderDock(); }
    if (hitNote && Date.now() >= hitNote) { hitNote = 0; renderDock(); }
    const left = arranging() ? setupEnds : myTurn() && S.tLeft >= 0 ? endsAt : 0;
    if (left) {
      const n = Math.ceil((left - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function fire(c) {
    if (!canFire(c)) { if (myTurn() && c >= 0 && S.sea[1 - S.me][c] !== SEA) sfx.bad(); return; }
    sent = Date.now(); cursor = -1; scene?.setHover(-1, -1); sfx.click(); ctx.act({ t: 'fire', c });
  }
  const at = e => (scene ? scene.pick(e.clientX, e.clientY) : null);
  let downAt = null;
  const onDown = e => {
    downAt = { x: e.clientX, y: e.clientY };
    if (!arranging() || !lay) return;
    const p = at(e); if (!p || p.b !== S.me) return;
    const i = boatAt(p.c); if (i < 0) return;
    const b = lay[i], n = N(), off = b.v ? (p.c / n | 0) - (b.c / n | 0) : p.c % n - b.c % n;
    drag = { i, off, moved: false, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch {}
    sfx.click(); pushLayout();
  };
  const onMove = e => {
    if (drag) {
      const p = at(e); if (!p || p.b !== S.me) return;
      const b = lay[drag.i], n = N(), r = (p.c / n | 0) - (b.v ? drag.off : 0), q = p.c % n - (b.v ? 0 : drag.off), c = clamp(b, r, q);
      if (c !== b.c) { b.c = c; drag.moved = true; check(); sfx.hover(); pushLayout(); renderDock(); }
      return;
    }
    if (e.pointerType === 'touch' || !myTurn()) return;
    const p = at(e); cursor = -1;
    if (p && p.b === 1 - S.me && canFire(p.c)) scene?.setHover(p.b, p.c); else scene?.setHover(-1, -1);
  };
  const onLeave = () => { if (cursor < 0 && !drag) scene?.setHover(-1, -1); };
  const onUp = e => {
    const tap = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) <= 14; downAt = null;
    if (drag) {
      const d = drag; drag = null;
      if (!d.moved && tap) { // a tap turns the boat round the square you touched
        const b = lay[d.i], n = N();
        if (b.len > 1) { const r = (b.c / n | 0) + (b.v ? d.off : 0), q = b.c % n + (b.v ? 0 : d.off); b.v = b.v ? 0 : 1; b.c = clamp(b, r - (b.v ? d.off : 0), q - (b.v ? 0 : d.off)); sfx.place(); }
      } else sfx.plop();
      check(); pushLayout(); renderDock(); sendLayout();
      return;
    }
    if (!tap || !myTurn()) return;
    const p = at(e); if (p && p.b === 1 - S.me) fire(p.c);
  };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = S.n, k = e.key;
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k];
    if (d) {
      if (cursor < 0) cursor = (n * n + n) >> 1;
      else { const r = Math.max(0, Math.min(n - 1, (cursor / n | 0) + d[0])), q = Math.max(0, Math.min(n - 1, cursor % n + d[1])); cursor = r * n + q; }
      scene?.setHover(1 - S.me, cursor); sfx.hover();
    } else if ((k === 'Enter' || k === ' ') && cursor >= 0 && !e.target.closest?.('button')) { const c = cursor; fire(c); cursor = c; if (S.sea[1 - S.me][c] === SEA) scene?.setHover(1 - S.me, c); }
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
    else if (a === 'shuffle') { if (!arranging()) return; sfx.draw(); lay = randomFleet(S.board).map(x => ({ c: x.c, len: x.len, v: x.v })); check(); pushLayout(); renderDock(); sendLayout(); }
    else if (a === 'ready') { if (!arranging() || bad.size) return; sfx.click(); sendLayout(); ctx.act({ t: 'ready', on: true }); }
    else if (a === 'unready') { sfx.click(); ctx.act({ t: 'ready', on: false }); }
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
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); for (const t of timers) clearTimeout(t); scene?.dispose();
    },
  };
}
