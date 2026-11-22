// Treasure Dig game view: HUD over the 3D field. Renders what the server says and sends the tile you dig.
// Nothing under the grass reaches this page until someone digs it.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';
import { PTS, TRAP } from './rules.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
// little pictures for the HUD
const GEMC = { 1: '#4db5ff', 2: '#ff5c8a' };
export const gemSvg = (k = 1) => k === 3
  ? '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="11" rx="2" fill="#b9794a" stroke="#3b2219" stroke-width="2"/><path d="M3 9q0-5 9-5t9 5z" fill="#c98a52" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><rect x="10" y="9" width="4" height="5" fill="#ffc93c" stroke="#3b2219" stroke-width="1.6"/></svg>'
  : `<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l4-5h10l4 5-9 12z" fill="${GEMC[k]}" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><path d="M7 9l2-3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`;
export const bombSvg = '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="14" r="7.5" fill="#2b2430" stroke="#3b2219" stroke-width="2"/><path d="M15.5 8.5l2.5-3" stroke="#8a5a3c" stroke-width="2.4" stroke-linecap="round"/><circle cx="19" cy="4.4" r="2" fill="#ffd84a"/><circle cx="8.5" cy="11.5" r="1.6" fill="#fff" opacity=".5"/></svg>';
const sparkSvg = '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#ffd84a" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>';

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./dig.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="td">
    <canvas class="g3d" aria-label="The treasure field"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="td-info"></span></div>
      <div class="tr"><span class="tcode" id="td-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="td-banner" aria-live="polite"></div>
      <div class="shout" id="td-big" aria-live="assertive"></div>
      <div class="td-bottom" id="td-bottom">
        <div class="td-dock" id="td-dock"></div>
        <ol class="td-list" id="td-list" aria-label="Players and their points"></ol>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.td'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  canvas.tileScreen = i => scene?.tileScreen(i) || null; // where a tile is on screen (used by browser tests)
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, digN = 0, revealTimer = 0;
  let cursor = -1, touchPick = -1, revealed = true;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'turn' && S.turn === S.me && me() && !me().bot);
  const gemsOf = st => st.gems + st.big + st.chest;

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 100) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 60).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() {
    if (!scene) return;
    const top = innerWidth < 700 ? 104 : 64;
    scene.setHud(Math.max($('td-bottom').offsetHeight + 24, innerWidth < 700 ? 150 : 110), top);
  }

  // ----- name tags: name and points -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="td-tag${i === S.me ? ' mine' : ''}"><div class="plate"><i style="background:${esc(p.color)}"></i><b>${i === S.me ? 'You' : nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play' && S.stage !== 'start');
      const cnt = el.querySelector('.plate span'), v = String(shownPts(i)); if (cnt._h !== v) { cnt._h = v; cnt.textContent = v; }
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  // points as the screen shows them: the latest dig only counts once its tile has been dug open
  const shownFinds = i => gemsOf(S.seats[i].st) - (!revealed && S.dig?.s === i && S.dig.kind >= 1 && S.dig.kind <= 3 ? 1 : 0);
  const shownPts = i => S.seats[i].pts - (!revealed && S.dig?.s === i ? S.dig.pts : 0);

  function renderList() {
    const order = S.seats.map((_, i) => i);
    setHtml($('td-list'), order.map(i => {
      const p = S.seats[i], st = p.st, now = i === S.turn && S.ph === 'play' && S.stage !== 'start';
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' td-me' : ''}">${avatarHtml(p.color, p.av, 28)}<b>${i === S.me ? 'You' : nameHtml(p.name, p.fl)}</b><strong>${shownPts(i)}</strong><span class="td-found" aria-label="${shownFinds(i)} finds">${gemSvg(1)}${shownFinds(i)}</span></li>`;
    }).join(''));
  }

  function renderDock() {
    const el = $('td-dock');
    if (!S || S.ph !== 'play') { setHtml(el, ''); return; }
    const L = S.left;
    const stock = `<span class="td-stock" aria-label="Still buried">${gemSvg(1)}${L.gem}${gemSvg(2)}${L.big}${L.chest ? gemSvg(3) + L.chest : ''}<em>${bombSvg}${L.trap}</em></span>`;
    if (myTurn() && Date.now() - sent > 1200) {
      const touch = touchPick >= 0;
      setHtml(el, `<div class="td-you"><b>${S.chain ? 'Found one! Dig again' : 'Your turn'}</b>
        <span>${touch ? 'Tap the tile again, or' : innerWidth < 700 ? 'Tap a grass tile, then tap it again to dig.' : 'Click a grass tile to dig it.'}</span>
        ${touch ? '<button type="button" class="btn" data-a="dig">Dig here</button>' : ''}</div>
        <p class="td-hint">${stock}<span>A number counts the <b>traps</b> touching that tile. ${sparkSvg} means a gem is buried next door.</span></p>`);
    } else setHtml(el, `<p class="td-hint">${stock}</p>`);
    layout();
  }

  function renderBanner() {
    const el = $('td-banner'); if (!S) return;
    let msg = '';
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? `${S.win === S.me ? 'You win' : nameOf(S.win) + ' wins'}!` : '';
    else if (S.stage === 'start') msg = `The field is ready · ${S.turn === S.me ? 'you dig' : nameOf(S.turn) + ' digs'} first`;
    else if (S.stage === 'dig') msg = `${S.dig.s === S.me ? 'You dig' : nameOf(S.dig.s) + ' digs'}…`;
    else if (myTurn()) msg = (S.chain ? 'Dig again' : 'Your turn · pick a tile') + t;
    else if (S.turn >= 0) msg = `${nameOf(S.turn)} is ${S.chain ? 'digging again' : 'choosing a tile'}`;
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    const L = S.left, gems = L.gem + L.big + L.chest;
    $('td-info').textContent = S.ph === 'end' ? 'All the treasure is dug up' : `${gems} treasure${gems === 1 ? '' : 's'} left`;
    $('td-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1500, cls = '') {
    const el = $('td-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text, bad) {
    const p = scene?.tileScreen(i); if (!p) return;
    const f = document.createElement('div');
    f.className = 'td-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${p.x}px`; f.style.top = `${p.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // the moment the shovel is done: say what came out
  function reveal(d, late) {
    revealed = true; render();
    if (late) return;
    const who = d.s === S.me ? 'You' : nameOf(d.s), mine = d.s === S.me;
    if (d.kind >= 1 && d.kind <= 3) {
      floatAt(d.i, `+${d.pts}`, false);
      const what = d.kind === 3 ? 'Golden chest!' : d.kind === 2 ? 'Big gem!' : 'A gem!';
      big(what, `${who} ${mine ? 'find' : 'finds'} ${d.pts} point${d.pts === 1 ? '' : 's'}${d.chain > 1 ? ` · ${d.chain} in a row` : ''} · dig again`, d.kind === 3 ? 2200 : 1400, 'k' + d.kind);
      if (d.kind === 3) { sfx.win(); if (mine) confetti(); } else sfx.set();
    } else if (d.kind === 4) {
      setTimeout(() => { if (destroyed) return; sfx.lose(); floatAt(d.i, d.pts ? `${d.pts}` : '0', true); big('Trap!', `${who} ${mine ? 'lose' : 'loses'} ${-d.pts || 0} point${d.pts === -1 ? '' : 's'}`, 1600, 'k4'); }, 750);
      sfx.warn();
    } else { sfx.plop(); if (d.late && d.s === S.me) ctx.toast('Out of time: the game dug a tile for you'); }
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? 'You took over a bot. Good luck!' : `${nameOf(e.s)} took over a bot`); }
    else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(() => { showResults(); if (S?.win === S?.me) { sfx.win(); confetti(); } }, 2600); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, wasMine = myTurn();
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; cursor = -1; touchPick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0; digN = s.dig?.n || 0; revealed = true;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (s.dig && s.dig.n !== digN) { // a new dig: tell what came out once the shovel is done
      digN = s.dig.n; const d = s.dig, wait = d.walk + s.ms.dig - d.ago;
      revealed = wait <= 0; clearTimeout(revealTimer);
      if (wait > 0) { revealTimer = setTimeout(() => !destroyed && reveal(d, false), wait); for (const k of [.2, .6]) { const at = d.walk + s.ms.dig * k - d.ago; if (at > 0) setTimeout(() => !destroyed && sfx.plop(), at); } }
      else reveal(d, wait < -800);
      touchPick = -1;
    }
    if (!wasMine && myTurn()) { sfx.turn(); lastTick = -1; sent = 0; if (cursor < 0 || s.tiles[cursor] >= 0) cursor = -1; }
    if (!myTurn()) { scene?.setHover(-1); touchPick = -1; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    const finds = st => [st.chest ? `${gemSvg(3)}${st.chest}` : '', `${gemSvg(2)}${st.big}`, `${gemSvg(1)}${st.gems}`, st.traps ? `${bombSvg}${st.traps}` : ''].filter(Boolean).join('');
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? 'Richest digger on the island!' : `${nameOf(w)} wins!`}</h2>
      <p>${myPlace ? (myPlace === 1 ? 'You dug up the most treasure. ' : `You came ${ORD(myPlace)}. `) : ''}Every gem has been found.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i];
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? ' (you)' : ''}</b><span class="td-finds">${finds(p.st)}</span></div>
          <strong>${p.pts}<small>points</small></strong></li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Dig again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Dig again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 30 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const cols = ['#4db5ff', '#ff5c8a', '#ffc93c', '#7ed3b2', '#fff4e2', '#e5543b'];
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

  // ----- input -----
  const canDig = i => myTurn() && i >= 0 && S.tiles[i] < 0 && Date.now() - sent > 1200;
  function dig(i) {
    if (!canDig(i)) return;
    sent = Date.now(); sfx.click(); ctx.act({ t: 'dig', i }); touchPick = -1; scene?.setHover(-1); renderDock();
  }
  function aim(i) { cursor = i; scene?.setHover(canDig(i) ? i : -1); }
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene || !myTurn()) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (i !== cursor) { aim(i); if (canDig(i)) sfx.hover(); }
    canvas.style.cursor = canDig(i) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { if (touchPick < 0) scene?.setHover(-1); });
  canvas.addEventListener('click', e => {
    if (!scene || !myTurn()) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (!canDig(i)) return;
    // a mouse digs at once; a finger picks the tile first, so a slip does not dig the wrong one
    if (e.pointerType === 'mouse' || (!e.pointerType && matchMedia('(hover: hover)').matches) || touchPick === i) dig(i);
    else { touchPick = i; aim(i); sfx.click(); renderDock(); }
  });
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), w = S.w, h = S.h;
    let c = cursor >= 0 ? cursor : (h >> 1) * w + (w >> 1);
    if (k === 'arrowup') c = Math.max(c % w, c - w); else if (k === 'arrowdown') c = c + w < w * h ? c + w : c;
    else if (k === 'arrowleft') c = c % w ? c - 1 : c; else if (k === 'arrowright') c = c % w < w - 1 ? c + 1 : c;
    else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button')) { dig(cursor); e.preventDefault(); return; }
    else return;
    e.preventDefault(); aim(c); touchPick = -1;
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'dig') dig(touchPick);
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
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(revealTimer); scene?.dispose();
    },
  };
}
