// Hay Hunch view: the HUD over the 3D field. Solo and with no table: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode), rules() }
// The server deals the field and keeps it secret; this page only shows the bales that have been flipped.
import { sfx } from '../../sfx.js';
import { N, MAX_LV, coinsFor } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
};
export const carrotSvg = '<svg class="hh-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l2-5M12 7l3-4M10 8l-5-2" stroke="#3f9a52" stroke-width="2.6" stroke-linecap="round"/><path d="M6 9q5-4 9 0L8 22q-1 1-1.5 0z" fill="#ff8a3c" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>';
export const napSvg = '<svg class="hh-ic" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="6.5" cy="7" rx="3" ry="4.2" fill="#c9b5f0" stroke="#3b2219" stroke-width="1.8"/><ellipse cx="17.5" cy="7" rx="3" ry="4.2" fill="#c9b5f0" stroke="#3b2219" stroke-width="1.8"/><circle cx="12" cy="14" r="8" fill="#c9b5f0" stroke="#3b2219" stroke-width="1.8"/><path d="M7.5 13.5q1.5 1.5 3 0M13.5 13.5q1.5 1.5 3 0" stroke="#3b2219" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const coinSvg = '<svg class="hh-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffc93c" stroke="#3b2219" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c98a1a" stroke-width="1.6"/></svg>';
const pawSvg = '<svg class="hh-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#c9b5f0" stroke="#3b2219" stroke-width="2"/><g fill="#3b2219"><circle cx="8" cy="9" r="1.9"/><circle cx="12" cy="7.4" r="1.9"/><circle cx="16" cy="9" r="1.9"/><ellipse cx="12" cy="14.2" rx="3.6" ry="3"/></g></svg>';
const MARKS = [['pet', 1, pawSvg, 'Pet'], ['1', 2, '1', '1'], ['2', 4, '2', '2'], ['3', 8, '3', '3']];

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./hay.css', import.meta.url).href;
  document.head.append(l);
}
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="hh">
    <canvas class="g3d" aria-label="The hay field"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="hh-lv"></span><span class="chip hh-coins" id="hh-coins"></span></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="home" aria-label="Back to the hub">${I.door}</button></div>
      <div class="banner" id="hh-banner" aria-live="polite"></div>
      <div class="shout" id="hh-big" aria-live="assertive"></div>
      <div class="hh-bottom" id="hh-bottom"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" id="hh-res" hidden></div>
    <div class="gate" id="hh-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.hh'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  canvas.tileScreen = i => scene?.tileScreen(i) || null; // where a bale is on screen (used by browser tests)
  let S = null, scene = null, destroyed = false, fieldId = null, overShown = null, resTimer = 0, bigTimer = 0, quiet = 0;
  let marks = Array(N * N).fill(0), markMode = false, markKind = 1, cursor = -1, touchPick = -1, busy = 0;
  const send = a => { ctx.send(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) ctx.toast('Hay Hunch did not answer. Check your connection. If the game was just updated, the server needs a restart.', true); }, 4000); };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame: null });
    const me = ctx.me(); if (me) scene.setAvatar(me.color, me.av);
    if (S) { scene.setState(S); scene.setMarks(marks); }
    layout();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  function layout() {
    if (!scene) return;
    const top = innerWidth < 700 ? 104 : 64;
    scene.setHud(($('hh-bottom').offsetHeight || 90) + 24, top);
  }
  const saveMarks = () => LS.set('hh_marks', { id: fieldId, m: marks });
  const canFlip = i => S && !S.over && i >= 0 && i < N * N && S.cells[i] < 0 && Date.now() - busy > 350;

  // ----- painting -----
  function render() {
    if (!S) return;
    const lv = S.over === 'clear' || S.over === 'pet' ? S.res.from : S.level;
    setHtml($('hh-lv'), `Level <b>${lv}</b><small>/${MAX_LV}</small>`);
    setHtml($('hh-coins'), `${coinSvg}<b>${S.paid}</b><small>/${S.daily} today</small>`);
    $('hh-coins').title = S.paid >= S.daily ? 'You have every coin Hay Hunch pays today. Fields still count for the rankings.' : `Clearing a field pays coins, up to ${S.daily} a day.`;
    const el = $('hh-banner');
    let msg = '';
    if (S.over === 'clear') msg = 'Field cleared!';
    else if (S.over === 'pet') msg = 'You woke a pet!';
    else if (S.over === 'bank') msg = 'Harvest taken home';
    else msg = `Find the carrot bundles · <b>${S.found}</b> of ${S.goal}`;
    setHtml(el, msg);
    const harvest = S.over === 'pet' ? 0 : S.harvest;
    const touch = touchPick >= 0 && !markMode;
    setHtml($('hh-bottom'), `
      <div class="hh-dock">
        <div class="hh-harvest" aria-label="Harvest"><span>Harvest</span><b class="${S.over === 'pet' ? 'lost' : ''}">${harvest ? '×' + harvest.toLocaleString() : '–'}</b></div>
        ${touch ? `<button type="button" class="btn hh-flip" data-a="flip">Flip it</button>` : ''}
        <button type="button" class="btn hh-bank" data-a="bank" ${!S.over && S.harvest ? '' : 'disabled'} title="Keep this harvest for the rankings and start a new field at this level. Only cleared fields pay coins.">Take the harvest</button>
        <button type="button" class="btn ghost hh-mark${markMode ? ' on' : ''}" data-a="mark" aria-pressed="${markMode}" title="Mark bales with your guesses (M)">${pawSvg}Mark</button>
      </div>
      ${markMode ? `<div class="hh-marks" role="group" aria-label="Mark to put on a bale">${MARKS.map(([k, bit, ic, label]) => `<button type="button" class="${markKind === bit ? 'on' : ''}" data-a="kind" data-bit="${bit}" aria-pressed="${markKind === bit}" aria-label="Mark ${label}">${ic}</button>`).join('')}<span>Tap bales to mark them</span></div>`
        : `<p class="hh-hint">${S.over ? 'Look under every bale, then start the next field.' : innerWidth < 700 ? 'Tap a bale, then tap it again to flip it.' : 'Click a bale to flip it. Right-click marks a pet.'} Signs show ${carrotSvg} carrots and ${napSvg} napping pets in their row or column.</p>`}`);
    layout();
  }

  function big(text, sub = '', ms = 1500, cls = '') {
    const el = $('hh-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text, cls = '') {
    const p = scene?.tileScreen(i, 1.2); if (!p) return;
    const f = document.createElement('div');
    f.className = 'hh-pts ' + cls; f.textContent = text;
    f.style.left = `${p.x}px`; f.style.top = `${p.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1400);
  }

  function showResults() {
    if (!S?.over) return;
    const r = S.res || {}, el = $('hh-res');
    const lvLine = r.to > r.from ? `Up to <b>level ${r.to}</b>` : r.to < r.from ? `Down to <b>level ${r.to}</b>` : `Staying on <b>level ${r.to}</b>`;
    const title = S.over === 'clear' ? 'Field cleared!' : S.over === 'pet' ? 'Oops, a napping pet!' : 'Harvest taken home';
    const lead = S.over === 'clear' ? `You found every carrot bundle.` : S.over === 'pet' ? `It woke up and the harvest${r.lost ? ` of ×${r.lost.toLocaleString()}` : ''} scattered.` : 'Safe and sound. Only cleared fields pay coins.';
    const coins = S.over !== 'clear' ? '' : r.coins ? `<li>${coinSvg}<b>+${r.coins} coins</b>${r.capped ? '<small>today’s coins are all collected</small>' : ''}</li>` : `<li>${coinSvg}<b>No coins</b><small>you have all ${S.daily} for today</small></li>`;
    el.innerHTML = `<div class="sheet hh-sheet ${S.over}">
      <h2>${title}</h2><p>${lead}</p>
      <ul class="hh-sum">
        ${S.over !== 'pet' ? `<li>${carrotSvg}<b>×${r.pts.toLocaleString()}</b><small>harvest points</small></li>` : ''}
        ${coins}
        <li class="lvl"><b>${lvLine}</b>${r.to < MAX_LV && S.over === 'clear' ? `<small>next clear pays ${coinsFor(r.to)}</small>` : ''}</li>
      </ul>
      <p class="hh-best">Best field ×${(S.best || 0).toLocaleString()} · ${S.cleared} cleared</p>
      <div class="row"><button type="button" class="btn big" data-a="next">Next field</button><button type="button" class="btn ghost" data-a="look">Look at the field</button></div></div>`;
    el.hidden = false;
    el.querySelector('[data-a="next"]').focus({ preventScroll: true });
  }
  function hideResults() { $('hh-res').hidden = true; clearTimeout(resTimer); }

  function update(s) {
    const prev = S, fresh = s.id !== fieldId;
    S = s;
    if (fresh) {
      fieldId = s.id; hideResults(); overShown = s.over ? s.id : null; touchPick = -1; cursor = -1;
      const saved = LS.get('hh_marks'); marks = saved?.id === s.id && Array.isArray(saved.m) ? saved.m.slice(0, N * N) : Array(N * N).fill(0);
      if (prev) { sfx.draw(); }
      if (s.over) showResults();
    } else if (prev) {
      // what just came up
      const i = s.open.findIndex((o, k) => o && !prev.open[k]);
      if (i >= 0) {
        const v = s.cells[i];
        if (v === 0) { sfx.lose(); scene?.oops(); floatAt(i, 'Zzz… !', 'bad'); }
        else { if (v >= 2) { sfx.set(); scene?.cheer(false); } else sfx.plop(); floatAt(i, '×' + v, 'k' + v); }
        marks[i] = 0; saveMarks();
      }
      if (s.over && overShown !== s.id) {
        overShown = s.id;
        const r = s.res;
        if (s.over === 'clear') { setTimeout(() => !destroyed && (sfx.win(), scene?.cheer(true)), 500); big('Field cleared!', r.coins ? `+${r.coins} coins · level ${r.to}` : `level ${r.to}`, 2000, 'k3'); }
        else if (s.over === 'pet') big('Oops!', `You woke a napping pet`, 1800, 'k0');
        else { sfx.join(); big('Harvest taken!', `×${r.pts.toLocaleString()}`, 1500, 'k2'); }
        clearTimeout(resTimer); resTimer = setTimeout(() => !destroyed && showResults(), s.over === 'bank' ? 1300 : 2300);
      }
    }
    scene?.setState(s); scene?.setMarks(marks); scene?.setPicked(touchPick);
    render();
  }

  function gate(html) { const g = $('hh-gate'); if (!html) { g.hidden = true; return; } g.innerHTML = `<div class="sheet">${html}</div>`; g.hidden = false; }

  // ----- input -----
  function flip(i) {
    if (!canFlip(i)) return;
    busy = Date.now(); sfx.click(); send({ t: 'flip', i }); touchPick = -1; scene?.setPicked(-1); scene?.setHover(-1);
  }
  function mark(i, bit = markKind) {
    if (!S || S.over || S.cells[i] >= 0) return;
    marks[i] ^= bit; saveMarks(); scene?.setMarks(marks); sfx.pop();
  }
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene || !S || S.over) return;
    const i = scene.pick(e.clientX, e.clientY), ok = canFlip(i) || (markMode && i >= 0 && S.cells[i] < 0);
    if (i !== cursor) { cursor = i; scene.setHover(ok ? i : -1); if (ok) sfx.hover(); }
    canvas.style.cursor = ok ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { cursor = -1; scene?.setHover(-1); });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault(); if (!scene) return;
    const i = scene.pick(e.clientX, e.clientY); if (i >= 0) mark(i, 1);
  });
  canvas.addEventListener('click', e => {
    if (!scene || !S || S.over) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (i < 0 || S.cells[i] >= 0) { if (touchPick >= 0) { touchPick = -1; scene.setPicked(-1); render(); } return; }
    if (markMode) return mark(i);
    // a mouse flips at once; a finger picks the bale first, so a slip does not wake a pet
    if (e.pointerType === 'mouse' || (!e.pointerType && matchMedia('(hover: hover)').matches) || touchPick === i) flip(i);
    else { touchPick = i; scene.setPicked(i); sfx.click(); render(); }
  });
  const onKey = e => {
    if (!S || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || !$('hh-gate').hidden) return;
    const k = e.key.toLowerCase();
    if (S.over) { if ((k === 'enter' || k === 'n') && !$('hh-res').hidden && !e.target.closest?.('button')) { e.preventDefault(); next(); } return; }
    let c = cursor >= 0 ? cursor : (N >> 1) * N + (N >> 1);
    if (k === 'arrowup') c = c >= N ? c - N : c; else if (k === 'arrowdown') c = c + N < N * N ? c + N : c;
    else if (k === 'arrowleft') c = c % N ? c - 1 : c; else if (k === 'arrowright') c = c % N < N - 1 ? c + 1 : c;
    else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button')) { e.preventDefault(); if (cursor >= 0) flip(cursor); return; }
    else if (k === 'p' || k === '0') { if (cursor >= 0) mark(cursor, 1); return; }
    else if (k === '1' || k === '2' || k === '3') { if (cursor >= 0) mark(cursor, 1 << +k); return; }
    else if (k === 'm') { markMode = !markMode; render(); return; }
    else if (k === 'b') { if (S.harvest) bank(); return; }
    else return;
    e.preventDefault(); cursor = c; scene?.setHover(c);
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);

  function bank() { if (!S || S.over || !S.harvest) return; sfx.click(); send({ t: 'bank' }); }
  function next() { if (!S?.over) return; sfx.click(); hideResults(); send({ t: 'next' }); }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'flip') flip(touchPick);
    else if (a === 'bank') bank();
    else if (a === 'mark') { sfx.click(); markMode = !markMode; touchPick = -1; scene?.setPicked(-1); render(); }
    else if (a === 'kind') { sfx.click(); markKind = +b.dataset.bit; render(); }
    else if (a === 'next') next();
    else if (a === 'look') { sfx.click(); hideResults(); setHtml($('hh-bottom'), `<div class="hh-dock"><button type="button" class="btn big" data-a="next">Next field</button></div>`); layout(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'home') { sfx.click(); ctx.home(); }
    else if (a === 'account') { sfx.click(); ctx.account(b.dataset.mode); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .hh-marks button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    msg(m) {
      if (destroyed) return;
      clearTimeout(quiet);
      if (m.need === 'account') {
        gate(`<h2>Hay Hunch</h2><p>Your level and best fields are kept between visits, so Hay Hunch needs an account. It only takes a username and a password.</p>
          <div class="row"><button type="button" class="btn big" data-a="account" data-mode="register">Create account</button><button type="button" class="btn ghost" data-a="account" data-mode="login">Log in</button></div>
          <button type="button" class="btn ghost" data-a="home">Back to the hub</button>`);
        return;
      }
      gate(null);
      if (m.err) { sfx.bad(); ctx.toast(esc(m.err), true); }
      if (m.s) update(m.s);
    },
    me() { const me = ctx.me(); if (me) scene?.setAvatar(me.color, me.av); if (me?.user && !S) send({ t: 'open' }); },
    reopen() { send({ t: 'open' }); },
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearTimeout(resTimer); clearTimeout(bigTimer); clearTimeout(quiet); scene?.dispose();
    },
  };
}
