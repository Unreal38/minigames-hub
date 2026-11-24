// Pet Mahjong, the solo game: the HUD over the 3D board. No table: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode), rules() }
// The server owns the board. This page checks a pair with the shared rules, takes it off at once, and the server
// confirms it (or puts the board back the way it really is).
import { sfx } from '../../sfx.js';
import { L, cnt, num } from '../../i18n.js';
import { srvText } from '../../lang/server.js';
import { layout, layoutName, isFree, canPair, tilesLeft, kindName, HINT_COST, IDLE_MS } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  hint: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  mix: svg('<path d="M3 7h3.5c5 0 6 10 11 10H21M3 17h3.5c1.6 0 2.8-1 3.8-2.4M21 7h-3.5c-1.6 0-2.8 1-3.8 2.4"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>'),
  again: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
};
const coinSvg = '<svg class="mj-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffc93c" stroke="#3b2219" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c98a1a" stroke-width="1.6"/></svg>';
const star = on => `<svg class="mj-star${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.4l6.6-.9z" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const coins = n => cnt(n, 'coin', 'coins', 'moneta', 'monety', 'monet');
export const clock = ms => { const s = Math.max(0, ms) / 1000; return `${s / 60 | 0}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const NAME = L('Pet Mahjong', 'Zwierzakowy mahjong');

// Solo and the race share mahj.css, but the hub keeps only the open game's own sheets switched on (gameCss in
// app.js), so each of the two adds its own <link>: one shared link was switched off when the other game opened.
const cssFor = new Set();
export function loadCss(who = 'solo') {
  if (cssFor.has(who)) return; cssFor.add(who);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./mahj.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="mj">
    <canvas class="g3d" aria-label="${L('The board of tiles. Tap two free tiles with the same picture.', 'Plansza z płytkami. Wskaż dwie wolne płytki z tym samym obrazkiem.')}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="mj-lv"></span><span class="chip" id="mj-coins"></span></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="home" aria-label="${L('Back to the hub', 'Wróć do Zatoki')}">${I.door}</button></div>
      <div class="mj-top" id="mj-top" aria-live="polite"></div>
      <div class="shout" id="mj-big" aria-live="assertive"></div>
      <div class="mj-bottom" id="mj-bottom"></div>
    </div>
    <div class="results" id="mj-res" hidden></div>
    <div class="gate" id="mj-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.mj'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  canvas.tileScreen = i => scene?.tileScreen(i) || null;   // where a tile is on screen (used by browser tests)
  canvas.board = () => scene?.board() || null; canvas.fps = () => scene?.fps(); canvas.stats = () => scene?.stats();
  canvas.idle = () => !!scene && !scene.busy() && !pending;
  let S = null, lay = null, scene = null, destroyed = false, boardId = null, pending = 0, resTimer = 0, bigTimer = 0, quiet = 0, recvAt = 0, clockTimer = 0;
  let picked = -1, cursor = -1;
  const send = a => { ctx.send(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) { pending = 0; ctx.toast(L('Pet Mahjong did not answer. Check your connection. If the game was just updated, the server needs a restart.', 'Zwierzakowy mahjong nie odpowiada. Sprawdź połączenie. Jeśli gra była właśnie aktualizowana, serwer wymaga restartu.'), true); } }, 4000); };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas);
    const me = ctx.me(); if (me) scene.setAvatar(me.color, me.av);
    if (S) { scene.setLayout(lay); scene.setBoard(S.b, 'fresh'); }
    place();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; };
  function place() {
    if (!scene) return;
    const top = $('mj-top').getBoundingClientRect();
    scene.setHud((($('mj-bottom').offsetHeight || 60) + 22) * uiz(), Math.round(top.bottom) + 8);
  }
  const board = () => scene?.board() || S?.b || [];
  const nowMs = () => !S ? 0 : S.ms + (S.run ? Math.min(IDLE_MS, performance.now() - recvAt) : 0);

  // ----- painting -----
  function renderClock() {
    if (!S) return;
    const el = $('mj-time'); if (!el) return;
    const ms = nowMs(), late = ms > S.par;
    el.textContent = clock(ms); el.parentElement.classList.toggle('late', late && !S.over);
  }
  function render() {
    if (!S) return;
    setHtml($('mj-lv'), L(`Level <b>${S.lv}</b>`, `Poziom <b>${S.lv}</b>`) + `<small>· ${esc(layoutName(S.lay))}</small>`);
    setHtml($('mj-coins'), `${coinSvg}<b>${S.paid}</b><small>/${S.daily} ${L('today', 'dziś')}</small>`);
    $('mj-coins').title = S.paid >= S.daily ? L('You have every coin Pet Mahjong pays today. Levels still count for the rankings.', 'Masz już wszystkie monety, jakie ta gra dziś wypłaca. Poziomy nadal liczą się do rankingów.') : L(`Clearing a level pays coins, up to ${S.daily} a day.`, `Za ukończony poziom są monety, najwyżej ${S.daily} dziennie.`);
    const left = tilesLeft(board());
    setHtml($('mj-top'), `<div class="mj-stat"><b>${left}</b><span>${L('tiles left', 'zostało płytek')}</span></div>
      <div class="mj-stat mj-clock" title="${L(`Finish within ${clock(S.par)} for a star`, `Skończ w ${clock(S.par)}, a dostaniesz gwiazdkę`)}"><b id="mj-time">${clock(nowMs())}</b><span>${L(`star until ${clock(S.par)}`, `gwiazdka do ${clock(S.par)}`)}</span></div>
      <div class="mj-stat"><b>${num(S.score)}</b><span>${L('points', 'punkty')}</span></div>`);
    renderClock();
    const stuck = S.stuck && !S.over && !pending;
    setHtml($('mj-bottom'), `<div class="mj-dock">
      ${S.over && $('mj-res').hidden ? `<button type="button" class="btn big" data-a="next">${S.over === 'win' ? L('Next level', 'Następny poziom') : L('Try again', 'Spróbuj jeszcze raz')}</button>`
        : `${stuck ? `<p class="mj-note">${L('No pair is left. Shuffle the tiles to go on.', 'Nie ma już żadnej pary. Wymieszaj płytki, żeby grać dalej.')}</p>` : ''}
        <button type="button" class="btn w mj-tool" data-a="hint" ${stuck ? 'disabled' : ''} title="${L(`Shows a pair. Costs ${HINT_COST} points.`, `Pokazuje parę. Kosztuje ${HINT_COST} punktów.`)}">${I.hint}<span>${L('Hint', 'Podpowiedź')}</span></button>
        <button type="button" class="btn ${stuck ? 'pulse' : 'w'} mj-tool" data-a="shuf" title="${L('Mixes the tiles that are left. Costs a star.', 'Miesza płytki, które zostały. Kosztuje gwiazdkę.')}">${I.mix}<span>${L('Shuffle', 'Wymieszaj')}</span></button>
        <button type="button" class="btn w mj-tool" data-a="new" title="${L('Deals this level again from the start.', 'Rozdaje ten poziom od nowa.')}">${I.again}<span>${L('New deal', 'Nowe rozdanie')}</span></button>`}</div>`);
    place();
  }
  function big(text, sub = '', ms = 1300, cls = '') {
    const el = $('mj-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text) {
    const p = scene?.tileScreen(i, .6); if (!p) return;
    const f = document.createElement('div');
    f.className = 'mj-pts'; f.textContent = text; f.style.left = `${p.x}px`; f.style.top = `${p.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1000);
  }

  function showResults() {
    if (!S?.over) return;
    const r = S.res || {}, el = $('mj-res'), win = S.over === 'win';
    const coinLine = !win ? '' : r.coins ? `<li>${coinSvg}<b>+${coins(r.coins)}</b>${r.capped ? `<small>${L('today’s coins are all collected', 'dzisiejsze monety są już zebrane')}</small>` : ''}</li>`
      : `<li>${coinSvg}<b>${L('No coins', 'Bez monet')}</b><small>${L(`you have all ${S.daily} for today`, `masz już wszystkie ${S.daily} na dziś`)}</small></li>`;
    const tick = (ok, text) => `<li class="${ok ? 'yes' : 'no'}"><i>${ok ? '★' : '☆'}</i>${text}</li>`;
    el.innerHTML = `<div class="sheet mj-sheet ${S.over}">
      <h2>${win ? L(`Level ${S.lv} cleared!`, `Poziom ${S.lv} ukończony!`) : L('No way to go on', 'Nie da się grać dalej')}</h2>
      ${win ? `<div class="mj-stars" role="img" aria-label="${L(`${r.stars} of 3 stars`, `Gwiazdki: ${r.stars} z 3`)}">${[1, 2, 3].map(k => star(k <= r.stars)).join('')}</div>
        <ul class="mj-ticks">${tick(true, L('Board cleared', 'Plansza wyczyszczona'))}${tick(r.fast, L(`In ${clock(r.ms)} (star until ${clock(S.par)})`, `Czas ${clock(r.ms)} (gwiazdka do ${clock(S.par)})`))}${tick(r.clean, L('Without shuffling', 'Bez mieszania'))}</ul>`
        : `<p>${L(`The last ${cnt(r.left, 'tile')} lie on top of each other, so no shuffle can free them. The level stays the same, with a fresh deal.`, `Ostatnie płytki (${r.left}) leżą jedna na drugiej i żadne mieszanie ich nie uwolni. Poziom zostaje ten sam, z nowym rozdaniem.`)}</p>`}
      <ul class="mj-sum">
        <li><b>${num(r.pts)}</b><small>${win && r.bonus ? L(`points, ${num(r.bonus)} of them for speed`, `pkt, w tym ${num(r.bonus)} za tempo`) : L('points', 'pkt')}</small></li>
        ${coinLine}
      </ul>
      <p class="mj-best">${L(`Best score ${num(S.best)} · highest level cleared ${S.top || '–'}`, `Rekord ${num(S.best)} · najwyższy ukończony poziom: ${S.top || '–'}`)}</p>
      <div class="row"><button type="button" class="btn big" data-a="next">${win ? L(`Level ${r.next}`, `Poziom ${r.next}`) : L('Try again', 'Spróbuj jeszcze raz')}</button>${win ? '' : `<button type="button" class="btn ghost" data-a="look">${L('Look at the board', 'Obejrzyj planszę')}</button>`}</div></div>`;
    el.hidden = false; render();
    el.querySelector('[data-a="next"]').focus({ preventScroll: true });
  }
  function hideResults() { $('mj-res').hidden = true; clearTimeout(resTimer); }
  function finish() {
    if (!S?.over) return;
    const r = S.res;
    if (S.over === 'win') { sfx.win(); scene?.cheer(0, true); big(L('Board cleared!', 'Plansza wyczyszczona!'), r.coins ? `+${coins(r.coins)}` : '', 1900, 'k3'); }
    else { sfx.lose(); scene?.oops(0); big(L('Stuck!', 'Zablokowane!'), '', 1600, 'k0'); }
    clearTimeout(resTimer); resTimer = setTimeout(() => !destroyed && showResults(), S.over === 'win' ? 2000 : 1500);
  }

  // ----- the server's answers -----
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function update(m) {
    const s = m.s, fresh = s.id !== boardId, was = S;
    S = s; recvAt = performance.now(); lay = layout(s.lay);
    if (fresh) {
      boardId = s.id; pending = 0; hideResults(); setPicked(-1); cursor = -1;
      scene?.setLayout(lay); scene?.setBoard(s.b, 'fresh'); scene?.hint(null);
      if (was) sfx.draw();
      if (s.over) showResults();
      render(); return;
    }
    if (m.took || m.no) pending = Math.max(0, pending - 1);
    if (m.took) {
      if (m.pts) floatAt(m.took[1], '+' + m.pts);
      if (s.streak >= 2) big(L('Quick!', 'Szybko!'), `×${s.streak + 1}`, 700, 'k2');
    }
    if (m.mixed && scene) { scene.setBoard(s.b, 'mix'); sfx.draw(); big(L('Shuffled!', 'Wymieszane!'), '', 900, 'k2'); setPicked(-1); }
    else if (scene && !pending && !same(scene.board(), s.b)) scene.setBoard(s.b); // a move from another screen, or the server said no
    if (m.hint && scene) { scene.hint(m.hint); sfx.hover(); }
    if (m.no) sfx.bad();
    render();
    if (s.over && (m.took || m.lost)) finish();
  }

  function gate(html) { const g = $('mj-gate'); if (!html) { g.hidden = true; return; } g.innerHTML = `<div class="sheet">${html}</div>`; g.hidden = false; }

  // ----- input -----
  const ready = () => S && !S.over && scene && lay;
  function setPicked(i) { picked = i; scene?.setPicked(i); }
  function tap(i) {
    if (!ready() || i < 0) { setPicked(-1); return; }
    const b = scene.board();
    if (!isFree(lay, b, i)) { sfx.bad(); scene.bad(i); return; }
    scene.hint(null);
    if (picked === i) { setPicked(-1); sfx.hover(); return; }
    if (picked >= 0 && canPair(lay, b, picked, i)) {
      const a = picked; setPicked(-1);
      sfx.pop(); scene.take(a, i); scene.hop(0); pending++; send({ t: 'pair', a, b: i });
      render(); return;
    }
    setPicked(i); sfx.click();
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (!ready()) return;
    tap(scene.pick(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene) return;
    const i = scene.pick(e.clientX, e.clientY), ok = ready() && i >= 0 && isFree(lay, scene.board(), i);
    if (i !== cursor) { cursor = i; scene.setHover(ok ? i : -1); }
    canvas.style.cursor = ok ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { cursor = -1; scene?.setHover(-1); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (!S || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || !$('mj-gate').hidden) return;
    const k = e.key.toLowerCase();
    if (S.over) { if ((k === 'enter' || k === 'n') && !e.target.closest?.('button')) { e.preventDefault(); next(); } return; }
    if (k === 'h') { e.preventDefault(); hint(); } else if (k === 'escape') setPicked(-1);
  };
  addEventListener('keydown', onKey);
  const onResize = () => { render(); place(); };
  addEventListener('resize', onResize);
  clockTimer = setInterval(renderClock, 500);

  function next() { if (!S?.over || pending) return; sfx.click(); hideResults(); send({ t: 'next' }); }
  function hint() { if (!ready() || pending || S.stuck) return; sfx.click(); send({ t: 'hint' }); }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'next') next();
    else if (a === 'hint') hint();
    else if (a === 'shuf') { if (ready() && !pending) { sfx.click(); send({ t: 'shuf' }); } }
    else if (a === 'new') { if (ready() && !pending) { sfx.click(); send({ t: 'new' }); } }
    else if (a === 'look') { sfx.click(); hideResults(); render(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'home') { sfx.click(); ctx.home(); }
    else if (a === 'account') { sfx.click(); ctx.account(b.dataset.mode); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });
  canvas.tap = tap; canvas.kindAt = i => { const v = board()[i]; return v >= 0 ? kindName(v) : ''; };

  return {
    msg(m) {
      if (destroyed) return;
      clearTimeout(quiet);
      if (m.need === 'account') {
        gate(`<h2>${NAME}</h2><p>${L('Your level and best scores are kept between visits, so Pet Mahjong needs an account. It only takes a username and a password.', 'Twój poziom i rekordy zapisują się między wizytami, więc ta gra wymaga konta. Wystarczy nazwa użytkownika i hasło.')}</p>
          <div class="row"><button type="button" class="btn big" data-a="account" data-mode="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn ghost" data-a="account" data-mode="login">${L('Log in', 'Zaloguj się')}</button></div>
          <button type="button" class="btn ghost" data-a="home">${L('Back to the hub', 'Wróć do Zatoki')}</button>`);
        return;
      }
      gate(null);
      if (m.err) { pending = 0; sfx.bad(); ctx.toast(esc(srvText(m.err)), true); }
      if (m.s) update(m);
    },
    me() { const me = ctx.me(); if (me) scene?.setAvatar(me.color, me.av); if (me?.user && !S) send({ t: 'open' }); },
    reopen() { send({ t: 'open' }); },
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearTimeout(resTimer); clearTimeout(bigTimer); clearTimeout(quiet); clearInterval(clockTimer); scene?.dispose();
    },
  };
}
