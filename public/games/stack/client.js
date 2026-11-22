// Tower Stack game view: HUD over the 3D tower. Renders what the server says; sends your drop.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  drop: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h14v7H5z" fill="#fff8ec"/><path d="M12 13v7M8 17l4 4 4-4"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./stack.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="tws">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="tws-info"></span></div>
      <div class="tr"><span class="tcode" id="tws-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="tws-banner" aria-live="polite"></div>
      <div class="shout" id="tws-big" aria-live="assertive"></div>
      <ol class="list" id="tws-list" aria-label="Players"></ol>
      <div class="meter" id="tws-meter" aria-hidden="true"><b>Wobble</b><span><i></i></span></div>
      <div class="dropbar" id="tws-drop"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.tws'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, busy = false;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, shown = [];

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const myTurn = () => S && S.ph === 'play' && S.stage === 'aim' && S.turn === S.me && me() && !me().bot;

  function sync() {
    if (!scene || !S) return;
    scene.setSeats(S.seats, S.me);
    scene.setState(S);
  }

  function onFrame(info) {
    live = info;
    if (busy !== info.busy) { busy = info.busy; renderDrop(); }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // Name and score under every avatar's rock. Scores shown here trail the server by a moment, so a block's
  // points appear when it lands and not when it is let go.
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="tws-tag${i === S.me ? ' tws-you' : ''}" hidden><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span></span></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play');
      const sp = el.lastElementChild, v = String(shown[i] ?? p.pts); if (sp.textContent !== v) sp.textContent = v;
    });
  }
  function floatPts(i, pts) {
    const t = live?.tags?.[i]; if (!t?.show || !pts) return;
    const f = document.createElement('div');
    f.className = 'tws-pts' + (pts < 0 ? ' bad' : ''); f.textContent = signed(pts);
    f.style.left = `${t.x}px`; f.style.top = `${t.y - 30}px`;
    root.append(f); setTimeout(() => f.remove(), 1300);
  }

  // A cue from the 3D scene: the block has landed (or missed). Sounds, the big words and the points.
  function onCue(c) {
    if (!S) return;
    if (c.k === 'thud') { sfx.place(); return; }
    if (c.k !== 'land') return;
    const who = youOr(c.s), mine = c.s === S.me;
    shown = S.seats.map(p => p.pts); buildTags(); renderList(); floatPts(c.s, c.pts);
    if (c.top) { sfx.win(); big('Sky high!', 'Tower finished: +20 for everyone', 2200); confetti(); }
    else if (c.res === 'perfect') { sfx.set(); big('Perfect!', `${who} ${mine ? 'score' : 'scores'} 15`, 1100); }
    else if (c.res === 'ok') sfx.place();
    else if (c.res === 'slip') { sfx.bad(); big('Whoops!', `${mine ? 'Your' : who + '’s'} block slipped off`, 1300); }
    else if (c.res === 'miss') { sfx.bad(); big('Missed!', `${who} dropped it past the tower`, 1300); }
    else if (c.res === 'crash') { sfx.lose(); sfx.plop(); big('Crash!', `${who} knocked it over at ${c.level} block${c.level === 1 ? '' : 's'}`, 2400); }
  }

  // ----- rendering -----
  function renderList() {
    if (!S) return;
    const ord = S.seats.map((_, i) => i).sort((a, b) => (shown[b] ?? S.seats[b].pts) - (shown[a] ?? S.seats[a].pts) || a - b);
    setHtml($('tws-list'), ord.map(i => {
      const p = S.seats[i], now = i === S.turn && S.ph === 'play';
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' me' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${nameHtml(p.name, p.fl)}</b><span>${shown[i] ?? p.pts} pts</span></li>`;
    }).join(''));
  }

  function renderDrop() {
    const el = $('tws-drop');
    if (!S || S.ph !== 'play') { setHtml(el, ''); el.hidden = true; return; }
    el.hidden = false;
    if (myTurn() && !(Date.now() - sent < 1500)) setHtml(el, `<button type="button" class="btn big r dropbtn" data-a="drop">${I.drop}Drop!</button>`);
    else if (S.stage === 'aim') {
      const p = S.seats[S.turn];
      setHtml(el, `<span class="waiting">${avatarHtml(p.color, p.av, 30)}<span>${S.turn === S.me ? (me()?.bot ? 'A bot is dropping for you' : 'Dropping…') : `${nameOf(S.turn)} is lining it up…`}</span></span>`);
    } else setHtml(el, '');
  }

  function renderBanner() {
    const el = $('tws-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.ph === 'end') msg = S.win >= 0 ? `${youOr(S.win)} win${S.win === S.me ? '' : 's'}!` : '';
    else if (myTurn()) msg = S.left >= 0 ? `Your turn · tap to drop · ${secs}s` : 'Your turn · tap to drop';
    else if (S.stage === 'aim') msg = `${nameOf(S.turn)}'s turn`;
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', !!myTurn());
  }

  function render() {
    if (!S) return;
    const n = S.tower.length;
    $('tws-info').textContent = `Tower ${Math.min(S.towerN, S.towers)} of ${S.towers} · ${n} block${n === 1 ? '' : 's'}`;
    $('tws-code').textContent = Rm?.code || '';
    const w = Math.round((1 - (S.steady ?? 1)) * 100), m = $('tws-meter');
    m.hidden = S.ph !== 'play'; m.querySelector('i').style.width = `${Math.max(4, w)}%`; m.classList.toggle('risky', w > 55); m.classList.toggle('danger', w > 80);
    buildTags(); renderList(); renderDrop(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('tws-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? 'You took over a bot. Your turn is coming up!' : `${nameOf(e.s)} took over a bot`); }
    else if (e.t === 'tower') { sfx.draw(); ctx.toast(e.k >= S.towers ? 'Last tower!' : `Tower ${e.k} of ${S.towers}`); }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prev = S ? S.turn + S.stage + S.swing?.n : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; shown = s.seats.map(p => p.pts);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    // points for a drop show when the block lands (the scene's cue). Without the 3D view, or once the turn has moved on, show them now.
    if (!scene || s.stage !== 'drop' || matchMedia('(prefers-reduced-motion: reduce)').matches || s.drop?.ago > 900) shown = s.seats.map(p => p.pts);
    endsAt = performance.now() + Math.max(0, s.left);
    if (!fresh && myTurn() && prev !== s.turn + s.stage + s.swing?.n) { sfx.turn(); lastTick = -1; sent = 0; }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? 'You are the master builder!' : `${nameOf(w)} wins!`}</h2>
      <p>${myPlace ? (myPlace === 1 ? 'Steadiest hands at the table. ' : `You came ${ORD(myPlace)}. `) : ''}The tallest tower reached ${S.res.best} block${S.res.best === 1 ? '' : 's'}.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? ' (you)' : ''}</b><span>${st.placed} stacked · ${st.perfect} perfect · ${st.crashes} crash${st.crashes === 1 ? '' : 'es'}</span></div>
          <strong>${p.pts}<small>pts</small></strong></li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Play again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
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
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 90 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#e5543b'];
    const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
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
    if (sent && Date.now() - sent >= 1500) renderDrop();
    if (myTurn() && S.left >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  function doDrop() {
    if (!myTurn() || Date.now() - sent < 1500) return;
    sent = Date.now(); sfx.click();
    const ms = scene ? scene.hold() : -1;
    ctx.act(ms >= 0 ? { t: 'drop', ms: Math.round(ms) } : { t: 'drop' });
    renderDrop();
  }
  const onKey = e => { if ((e.key === ' ' || e.key === 'Enter') && myTurn() && !e.target.closest?.('input, textarea, button')) { e.preventDefault(); doDrop(); } };
  addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', () => { if (myTurn()) doDrop(); });

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'drop') doDrop();
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
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
