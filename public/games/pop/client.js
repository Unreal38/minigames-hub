// Pet Pop view: the HUD over the 3D shelf. Solo and with no table: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode), rules() }
// The server owns the shelf. This page checks a swap, shows it at once, and then plays back the steps the server
// answers with (what popped, what dropped in).
import { sfx } from '../../sfx.js';
import { L, cnt, num, word } from '../../i18n.js';
import { srvText } from '../../lang/server.js';
import { petImg, petPics } from '../../petpic.js';
import { W, H, N, KINDS, KIND_COLOR, isPet, isBale, kindOf, movable, canSwap, findMove } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
};
const coinSvg = '<svg class="pp-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffc93c" stroke="#3b2219" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c98a1a" stroke-width="1.6"/></svg>';
const baleSvg = '<svg class="pp-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="13" rx="2" fill="#f2c94c" stroke="#3b2219" stroke-width="2"/><path d="M8 6v13M16 6v13" stroke="#c98a1e" stroke-width="2.4"/></svg>';
const star = on => `<svg class="pp-star${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.4l6.6-.9z" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const petName = k => KINDS[k][0].toUpperCase() + KINDS[k].slice(1); // Pet Farm names are the same in every language
const coins = n => cnt(n, 'coin', 'coins', 'moneta', 'monety', 'monet');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./pop.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pp">
    <canvas class="g3d" aria-label="${L('The pet shelf', 'Półka ze zwierzakami')}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="pp-lv"></span><span class="chip" id="pp-coins"></span></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="home" aria-label="${L('Back to the hub', 'Wróć do Zatoki')}">${I.door}</button></div>
      <div class="pp-top" id="pp-top" aria-live="polite"></div>
      <div class="shout" id="pp-big" aria-live="assertive"></div>
      <div class="pp-bottom" id="pp-bottom"></div>
    </div>
    <div class="results" id="pp-res" hidden></div>
    <div class="gate" id="pp-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.pp'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  canvas.cellScreen = i => scene?.cellScreen(i) || null;   // where a cubby is on screen (used by browser tests)
  canvas.board = () => scene?.board() || null; canvas.fps = () => scene?.fps(); canvas.stats = () => scene?.stats();
  canvas.idle = () => !!scene && !scene.busy() && !pending; // and whether the shelf has stopped moving
  let S = null, scene = null, destroyed = false, shelfId = null, pending = false, resTimer = 0, bigTimer = 0, quiet = 0, hintTimer = 0;
  let shown = null;       // the numbers on screen: they tick up while the steps play, then the server's take over
  let picked = -1, cursor = -1, drag = null;
  const send = a => { ctx.send(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) { pending = false; ctx.toast(L('Pet Pop did not answer. Check your connection. If the game was just updated, the server needs a restart.', 'Gra Zwierzakowe trójki nie odpowiada. Sprawdź połączenie. Jeśli gra była właśnie aktualizowana, serwer wymaga restartu.'), true); } }, 4000); };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas);
    const me = ctx.me(); if (me) scene.setAvatar(me.color, me.av);
    if (S) scene.setBoard(S.b, 'fresh');
    layout(); armHint();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; };
  function layout() {
    if (!scene) return;
    const top = $('pp-top').getBoundingClientRect();
    scene.setHud((($('pp-bottom').offsetHeight || 60) + 22) * uiz(), Math.round(top.bottom) + 10);
  }
  const snap = s => ({ left: s.left, score: s.score, have: s.goals.map(g => g.have) });

  // ----- painting -----
  function render() {
    if (!S || !shown) return;
    setHtml($('pp-lv'), L(`Level <b>${S.lv}</b>`, `Poziom <b>${S.lv}</b>`));
    setHtml($('pp-coins'), `${coinSvg}<b>${S.paid}</b><small>/${S.daily} ${L('today', 'dziś')}</small>`);
    $('pp-coins').title = S.paid >= S.daily ? L('You have every coin Pet Pop pays today. Levels still count for the rankings.', 'Masz już wszystkie monety, jakie ta gra dziś wypłaca. Poziomy nadal liczą się do rankingów.') : L(`Clearing a level pays coins, up to ${S.daily} a day.`, `Za ukończony poziom są monety, najwyżej ${S.daily} dziennie.`);
    const goals = S.goals.map((g, k) => {
      const have = shown.have[k], done = have >= g.n;
      const pic = g.k === 'pet' ? `<i class="pp-pet" style="background:${KIND_COLOR[g.kind]}">${petImg({ sp: KINDS[g.kind], lv: 20, name: petName(g.kind) }, 40, 'pp-petimg')}</i>` : `<i class="pp-pet hay">${baleSvg}</i>`;
      const what = g.k === 'pet' ? L(`Pop ${g.n} ${petName(g.kind)}`, `Zbierz: ${petName(g.kind)} × ${g.n}`) : L(`Break ${cnt(g.n, 'hay bale')}`, `Rozbij bele siana: ${g.n}`);
      return `<span class="pp-goal${done ? ' done' : ''}" title="${what}" aria-label="${what}, ${have}/${g.n}">${pic}<b>${done ? '✓' : `${have}<small>/${g.n}</small>`}</b></span>`;
    }).join('');
    const low = shown.left <= 3 && !S.over;
    if (setHtml($('pp-top'), `<div class="pp-goals">${goals}</div><div class="pp-moves${low ? ' low' : ''}"><b>${shown.left}</b><span>${word(shown.left, 'move', 'moves', 'ruch', 'ruchy', 'ruchów')}</span></div>`)) petPics($('pp-top'));
    const touch = matchMedia('(hover: none)').matches;
    setHtml($('pp-bottom'), `<div class="pp-dock"><div class="pp-score"><span>${L('Score', 'Wynik')}</span><b>${num(shown.score)}</b></div>
      ${S.over && $('pp-res').hidden ? `<button type="button" class="btn big" data-a="next">${S.over === 'win' ? L('Next level', 'Następny poziom') : L('Try again', 'Spróbuj jeszcze raz')}</button>`
        : `<p class="pp-hint">${touch ? L('Swipe a pet onto its neighbour to line up three of a kind.', 'Przesuń zwierzaka na sąsiada, żeby ustawić trzy takie same w rzędzie.') : L('Drag a pet onto its neighbour (or click one, then the other) to line up three of a kind.', 'Przeciągnij zwierzaka na sąsiada (albo kliknij jednego, potem drugiego), żeby ustawić trzy takie same w rzędzie.')}</p>`}</div>`);
    layout();
  }
  function big(text, sub = '', ms = 1300, cls = '') {
    const el = $('pp-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text, pts = 0) {
    const p = scene?.cellScreen(i, .3); if (!p) return;
    const f = document.createElement('div');
    f.className = 'pp-pts'; f.textContent = text; f.style.fontSize = `${Math.round(Math.min(46, 22 + pts / 40))}px`;
    f.style.left = `${p.x}px`; f.style.top = `${p.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1000);
  }

  function showResults() {
    if (!S?.over) return;
    const r = S.res || {}, el = $('pp-res'), win = S.over === 'win';
    const coinLine = !win ? '' : r.coins ? `<li>${coinSvg}<b>+${coins(r.coins)}</b>${r.capped ? `<small>${L('today’s coins are all collected', 'dzisiejsze monety są już zebrane')}</small>` : ''}</li>`
      : `<li>${coinSvg}<b>${L('No coins', 'Bez monet')}</b><small>${L(`you have all ${S.daily} for today`, `masz już wszystkie ${S.daily} na dziś`)}</small></li>`;
    const missing = S.goals.filter(g => g.have < g.n).map(g => g.k === 'pet' ? `${petName(g.kind)} × ${g.n - g.have}` : L(cnt(g.n - g.have, 'hay bale'), `${cnt(g.n - g.have, '', '', 'bela siana', 'bele siana', 'bel siana')}`)).join(', ');
    el.innerHTML = `<div class="sheet pp-sheet ${S.over}">
      <h2>${win ? L(`Level ${S.lv} cleared!`, `Poziom ${S.lv} ukończony!`) : L('Out of moves', 'Koniec ruchów')}</h2>
      ${win ? `<div class="pp-stars" role="img" aria-label="${L(`${r.stars} of 3 stars`, `Gwiazdki: ${r.stars} z 3`)}">${[1, 2, 3].map(k => star(k <= r.stars)).join('')}</div>` : ''}
      <p>${win ? (r.left ? L(`Done with ${cnt(r.left, 'move')} to spare. Spare moves earn stars.`, `W zapasie: ${cnt(r.left, '', '', 'ruch', 'ruchy', 'ruchów')}. Zapasowe ruchy dają gwiazdki.`) : L('Done on the very last move!', 'Udało się w ostatnim ruchu!')) : L(`Still missing: ${missing}. The level stays the same, with a fresh shelf.`, `Zabrakło: ${missing}. Poziom zostaje ten sam, z nową półką.`)}</p>
      <ul class="pp-sum">
        <li><b>${num(r.pts)}</b><small>${win && r.bonus ? L(`points, ${num(r.bonus)} of them for spare moves`, `pkt, w tym ${num(r.bonus)} za zapasowe ruchy`) : L('points', 'pkt')}</small></li>
        ${coinLine}
      </ul>
      <p class="pp-best">${L(`Best score ${num(S.best)} · highest level cleared ${S.top || '–'}`, `Rekord ${num(S.best)} · najwyższy ukończony poziom: ${S.top || '–'}`)}</p>
      <div class="row"><button type="button" class="btn big" data-a="next">${win ? L(`Level ${r.next}`, `Poziom ${r.next}`) : L('Try again', 'Spróbuj jeszcze raz')}</button><button type="button" class="btn ghost" data-a="look">${L('Look at the shelf', 'Obejrzyj półkę')}</button></div></div>`;
    el.hidden = false; render();
    el.querySelector('[data-a="next"]').focus({ preventScroll: true });
  }
  function hideResults() { $('pp-res').hidden = true; clearTimeout(resTimer); }
  function finish() { // the shelf has stopped: show how it ended
    if (!S?.over) return;
    const r = S.res;
    if (S.over === 'win') { sfx.win(); scene?.cheer(true); big(L('Level cleared!', 'Poziom ukończony!'), r.coins ? `+${coins(r.coins)}` : '', 1900, 'k3'); }
    else { sfx.lose(); scene?.oops(); big(L('Out of moves', 'Koniec ruchów'), '', 1600, 'k0'); }
    clearTimeout(resTimer); resTimer = setTimeout(() => !destroyed && showResults(), S.over === 'win' ? 2000 : 1500);
  }

  // ----- the server's answers -----
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function update(m) {
    const s = m.s, fresh = s.id !== shelfId, was = S;
    S = s;
    if (fresh) {
      shelfId = s.id; pending = false; hideResults(); picked = cursor = -1; shown = snap(s);
      scene?.setBoard(s.b, 'fresh'); scene?.setPicked(-1); scene?.setHover(-1);
      if (was) sfx.draw();
      if (s.over) showResults();
      render(); armHint(); return;
    }
    if (m.steps && scene) {
      if (!pending) scene.swap(m.sw[0], m.sw[1]); // the move was made on another screen of this account
      pending = false; shown.left = s.left;
      render();
      scene.run(m.steps, (st, before) => {
        if (destroyed || st.shuf) { if (st.shuf) big(L('Shuffle!', 'Tasowanie!'), L('no swap was left', 'nie było już ruchu'), 1200, 'k2'); return; }
        // count what pops towards the goals, the same way the server did
        let pets = Array(KINDS.length).fill(0), hay = 0;
        for (const i of st.clr) { const v = before[i]; if (isPet(v)) pets[kindOf(v)]++; else if (isBale(v)) hay++; }
        S.goals.forEach((g, k) => { shown.have[k] = Math.min(g.n, shown.have[k] + (g.k === 'pet' ? pets[g.kind] : hay)); });
        shown.score += st.pts;
        if (st.fx.length) { sfx.whoosh(); sfx.boom(); scene.cheer(false); } else if (st.n > 1) sfx.combo(st.n); else if (st.mk.length) sfx.set(); else sfx.pop();
        if (st.clr.length) floatAt(st.clr[st.clr.length >> 1], '+' + st.pts, st.pts);
        const gain = S.goals.map(g => g.k === 'pet' ? pets[g.kind] : hay);
        if (st.n === 3) big(L('Pawsome!', 'Brawo!'), '', 900, 'k2'); else if (st.n === 4) big(L('Stampede!', 'Lawina!'), '', 900, 'k2'); else if (st.n >= 5 && st.n % 2) big(L('Pet party!', 'Szał zwierzaków!'), '', 900, 'k3');
        render();
        $('pp-top').querySelectorAll('.pp-goal').forEach((el, k) => { if (gain[k]) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } });
      }, () => {
        if (destroyed) return;
        if (!same(scene.board(), S.b)) scene.setBoard(S.b); // should never happen: the server's shelf wins
        shown = snap(S); render(); finish(); armHint();
      });
      return;
    }
    // no steps: the swap was refused, or this is just the state again
    pending = false;
    if (scene && (m.no || !scene.busy()) && !same(scene.board(), s.b)) scene.setBoard(s.b);
    shown = snap(s); render(); armHint();
  }

  function gate(html) { const g = $('pp-gate'); if (!html) { g.hidden = true; return; } g.innerHTML = `<div class="sheet">${html}</div>`; g.hidden = false; }

  // ----- input -----
  const ready = () => S && !S.over && scene && !pending && !scene.busy();
  const grabbable = i => i >= 0 && i < N && movable(scene.board()[i]);
  function armHint() { // after a quiet while, two pets that can be swapped start hopping
    clearTimeout(hintTimer); scene?.hint(null);
    hintTimer = setTimeout(() => { if (!destroyed && ready()) scene.hint(findMove(scene.board())); }, 7000);
  }
  function setPicked(i) { picked = i; scene?.setPicked(i); }
  function trySwap(a, b) {
    setPicked(-1); armHint();
    if (!ready() || b < 0 || b >= N) return;
    if (!canSwap(scene.board(), a, b)) { sfx.bad(); scene.nudge(a, b); return; }
    sfx.click(); scene.swap(a, b); pending = true; send({ t: 'swap', a, b });
  }
  const neighbour = (i, dx, dy) => { const c = i % W + dx, r = (i / W | 0) + dy; return c < 0 || r < 0 || c >= W || r >= H ? -1 : r * W + c; };
  canvas.addEventListener('pointerdown', e => {
    if (!ready() || (e.pointerType === 'mouse' && e.button)) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (!grabbable(i)) { setPicked(-1); return; }
    drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId, was: picked };
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (picked >= 0 && picked !== i && canSwap(scene.board(), picked, i)) { drag = null; return trySwap(picked, i); }
    setPicked(i); sfx.hover(); armHint();
  });
  canvas.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, need = Math.max(12, scene.cellPx() * .32);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < need) return;
      const from = drag.i; drag = null;
      return trySwap(from, Math.abs(dx) > Math.abs(dy) ? neighbour(from, Math.sign(dx), 0) : neighbour(from, 0, Math.sign(dy)));
    }
    if (e.pointerType !== 'mouse' || !scene) return;
    const i = scene.pick(e.clientX, e.clientY), ok = ready() && grabbable(i);
    if (i !== cursor) { cursor = i; scene.setHover(ok ? i : -1); }
    canvas.style.cursor = ok ? 'grab' : '';
  });
  const drop = e => { if (drag && e.pointerId === drag.id) { if (drag.was === drag.i) setPicked(-1); drag = null; } }; // a second tap on the same pet lets it go
  canvas.addEventListener('pointerup', drop); canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('pointerleave', () => { cursor = -1; scene?.setHover(-1); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (!S || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || !$('pp-gate').hidden) return;
    const k = e.key.toLowerCase();
    if (S.over) { if ((k === 'enter' || k === 'n') && !e.target.closest?.('button')) { e.preventDefault(); next(); } return; }
    const d = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
    if (d) {
      e.preventDefault();
      if (picked >= 0) return trySwap(picked, neighbour(picked, d[0], d[1]));
      const to = neighbour(cursor >= 0 ? cursor : 27, d[0], d[1]); if (to >= 0) { cursor = to; scene?.setHover(to); }
    } else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button')) {
      e.preventDefault(); if (picked >= 0) setPicked(-1); else if (ready() && grabbable(cursor)) { setPicked(cursor); sfx.hover(); }
    } else if (k === 'escape') setPicked(-1);
  };
  addEventListener('keydown', onKey);
  const onResize = () => { render(); layout(); };
  addEventListener('resize', onResize);

  function next() { if (!S?.over || pending) return; sfx.click(); hideResults(); send({ t: 'next' }); }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'next') next();
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

  return {
    msg(m) {
      if (destroyed) return;
      clearTimeout(quiet);
      if (m.need === 'account') {
        gate(`<h2>${L('Pet Pop', 'Zwierzakowe trójki')}</h2><p>${L('Your level and best scores are kept between visits, so Pet Pop needs an account. It only takes a username and a password.', 'Twój poziom i rekordy zapisują się między wizytami, więc ta gra wymaga konta. Wystarczy nazwa użytkownika i hasło.')}</p>
          <div class="row"><button type="button" class="btn big" data-a="account" data-mode="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn ghost" data-a="account" data-mode="login">${L('Log in', 'Zaloguj się')}</button></div>
          <button type="button" class="btn ghost" data-a="home">${L('Back to the hub', 'Wróć do Zatoki')}</button>`);
        return;
      }
      gate(null);
      if (m.err) { pending = false; sfx.bad(); ctx.toast(esc(srvText(m.err)), true); }
      if (m.s) update(m);
    },
    me() { const me = ctx.me(); if (me) scene?.setAvatar(me.color, me.av); if (me?.user && !S) send({ t: 'open' }); },
    reopen() { send({ t: 'open' }); },
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearTimeout(resTimer); clearTimeout(bigTimer); clearTimeout(quiet); clearTimeout(hintTimer); scene?.dispose();
    },
  };
}
