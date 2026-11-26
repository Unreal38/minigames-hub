// Hay Hunch view: the HUD over the 3D field. Solo and with no table: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode), rules() }
// The server deals the field and keeps it secret; this page only shows the bales that have been flipped.
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { srvText } from '../../lang/server.js';
import { N, MAX_LV, coinsFor } from './rules.js';
import { uiz } from '../../uiz.js';

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
const MARKS = [['pet', 1, pawSvg, L('Pet', 'Zwierzak')], ['1', 2, '1', '1'], ['2', 4, '2', '2'], ['3', 8, '3', '3']];

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
    <canvas class="g3d" aria-label="${L(`The hay field`, `Pole z sianem`)}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="hh-lv"></span><span class="chip hh-coins" id="hh-coins"></span></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="home" aria-label="${L(`Back to the hub`, `Wróć do Zatoki`)}">${I.door}</button></div>
      <div class="banner" id="hh-banner" aria-live="polite"></div>
      <div class="shout" id="hh-big" aria-live="assertive"></div>
      <div class="hh-bottom" id="hh-bottom"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" id="hh-res" hidden></div>
    <div class="gate" id="hh-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.hh'), $ = id => root.querySelector('#' + id);
  let canvas = root.querySelector('.g3d');
  let S = null, scene = null, destroyed = false, fieldId = null, overShown = null, resTimer = 0, bigTimer = 0, quiet = 0, retry = 0, rebuildTimer = 0;
  let marks = Array(N * N).fill(0), markMode = false, markKind = 1, cursor = -1, touchPick = -1, busy = 0;
  const send = a => { ctx.send(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) ctx.toast(L('Hay Hunch did not answer. Check your connection. If the game was just updated, the server needs a restart.', 'Gra Szukanie w sianie nie odpowiada. Sprawdź połączenie. Jeśli gra była właśnie aktualizowana, serwer wymaga restartu.'), true); }, 4000); };
  // Ask for the field until it comes. The first ask can be lost: the connection may be coming back (a phone waking up)
  // and the app drops messages while the socket is closed, so the page used to wait forever with no field and no HUD.
  function askField() {
    clearInterval(retry); send({ t: 'open' });
    retry = setInterval(() => { if (destroyed || S || !$('hh-gate').hidden) return clearInterval(retry); ctx.send({ t: 'open' }); }, 1500);
  }

  // The 3D field. A browser can take a WebGL context away at any time (too many open at once, a phone going to sleep,
  // a GPU reset). three.js then draws nothing and only the sky-blue page behind the canvas is left, so when that
  // happens the scene is built again on a fresh canvas, showing the same field.
  let sceneMod = null;
  function buildScene() {
    (sceneMod ||= import('./scene3d.js')).then(m => {
      if (destroyed || scene) return;
      try { scene = m.createScene(canvas, { onFrame: null }); }
      catch (err) { console.warn('3D unavailable', err); root.classList.add('flat'); return; }
      root.classList.remove('flat');
      const me = ctx.me(); if (me) scene.setAvatar(me.color, me.av);
      if (S) { scene.setState(S); scene.setMarks(marks); scene.setPicked(touchPick); }
      layout();
    }).catch(err => { console.warn('3D unavailable', err); sceneMod = null; root.classList.add('flat'); });
  }
  function rebuildScene() {
    rebuildTimer = 0;
    if (destroyed) return;
    try { scene?.dispose(); } catch {}
    scene = null;
    const fresh = document.createElement('canvas'); fresh.className = 'g3d'; fresh.setAttribute('aria-label', canvas.getAttribute('aria-label') || '');
    canvas.replaceWith(fresh); bindCanvas(fresh);
    buildScene();
  }

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  function layout() {
    if (!scene) return;
    const top = innerWidth < 700 ? 104 : 64, z = uiz();
    scene.setHud((($('hh-bottom').offsetHeight || 90) + 24) * z, top * z);
  }
  const saveMarks = () => LS.set('hh_marks', { id: fieldId, m: marks });
  const canFlip = i => S && !S.over && i >= 0 && i < N * N && S.cells[i] < 0 && Date.now() - busy > 350;

  // ----- painting -----
  function render() {
    if (!S) return;
    const lv = S.over === 'clear' || S.over === 'pet' ? S.res.from : S.level;
    setHtml($('hh-lv'), L(`Level <b>${lv}</b><small>/${MAX_LV}</small>`, `Poziom <b>${lv}</b><small>/${MAX_LV}</small>`));
    setHtml($('hh-coins'), L(`${coinSvg}<b>${S.paid}</b><small>/${S.daily} today</small>`, `${coinSvg}<b>${S.paid}</b><small>/${S.daily} dziś</small>`));
    $('hh-coins').title = S.paid >= S.daily ? L('You have every coin Hay Hunch pays today. Fields still count for the rankings.', 'Masz już wszystkie monety, jakie ta gra dziś wypłaca. Pola nadal liczą się do rankingów.') : L(`Clearing a field pays coins, up to ${S.daily} a day.`, `Za oczyszczone pole są monety, najwyżej ${S.daily} dziennie.`);
    const el = $('hh-banner');
    let msg = '';
    if (S.over === 'clear') msg = L('Field cleared!', 'Pole oczyszczone!');
    else if (S.over === 'pet') msg = L('You woke a pet!', 'Zwierzak się obudził!');
    else if (S.over === 'bank') msg = L('Harvest taken home', 'Zbiory zabrane do domu');
    else msg = L(`Find the carrot bundles · <b>${S.found}</b> of ${S.goal}`, `Znajdź pęczki marchewek · <b>${S.found}</b> z ${S.goal}`);
    setHtml(el, msg);
    const harvest = S.over === 'pet' ? 0 : S.harvest;
    const touch = touchPick >= 0 && !markMode;
    setHtml($('hh-bottom'), `
      <div class="hh-dock">
        <div class="hh-harvest" ${L(`aria-label="Harvest"><span>Harvest</span>`, `aria-label="Zbiory"><span>Zbiory</span>`)}<b class="${S.over === 'pet' ? 'lost' : ''}">${harvest ? '×' + harvest.toLocaleString() : '–'}</b></div>
        ${touch ? `<button type="button" class="btn hh-flip" data-a="flip">${L(`Flip it`, `Odwróć`)}</button>` : ''}
        <button type="button" class="btn ghost hh-mark${markMode ? ' on' : ''}" data-a="mark" aria-pressed="${markMode}" title="${L(`Mark bales with your guesses (M)`, `Oznaczaj bele swoimi typami (M)`)}">${L(`${pawSvg}Mark</button>`, `${pawSvg}Oznacz</button>`)}
      </div>
      ${markMode ? `<div class="hh-marks" role="group" aria-label="${L(`Mark to put on a bale`, `Znak do postawienia na beli`)}">${MARKS.map(([k, bit, ic, label]) => `<button type="button" class="${markKind === bit ? 'on' : ''}" data-a="kind" data-bit="${bit}" aria-pressed="${markKind === bit}" aria-label="${L(`Mark ${label}`, `Znak: ${label}`)}">${ic}</button>`).join('')}<span>${L(`Tap bales to mark them`, `Dotykaj bel, żeby je oznaczyć`)}</span></div>`
        : `<p class="hh-hint">${L(`${S.over ? 'Look under every bale, then start the next field.' : innerWidth < 700 ? 'Tap a bale, then tap it again to flip it.' : 'Click a bale to flip it. Right-click marks a pet.'} Signs show ${carrotSvg} carrots and ${napSvg} napping pets in their row or column.`, `${S.over ? 'Zajrzyj pod każdą belę, a potem zacznij następne pole.' : innerWidth < 700 ? 'Dotknij beli, a potem dotknij jej jeszcze raz, żeby ją odwrócić.' : 'Kliknij belę, żeby ją odwrócić. Prawy przycisk oznacza zwierzaka.'} Tabliczki pokazują ${carrotSvg} marchewki i ${napSvg} śpiące zwierzaki w swoim rzędzie albo kolumnie.`)}</p>`}`);
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
    const lvLine = r.to > r.from ? L(`Up to <b>level ${r.to}</b>`, `W górę na <b>poziom ${r.to}</b>`) : r.to < r.from ? L(`Down to <b>level ${r.to}</b>`, `W dół na <b>poziom ${r.to}</b>`) : L(`Staying on <b>level ${r.to}</b>`, `Zostajesz na <b>poziomie ${r.to}</b>`);
    const title = S.over === 'clear' ? L('Field cleared!', 'Pole oczyszczone!') : S.over === 'pet' ? L('Oops, a napping pet!', 'Ups, śpiący zwierzak!') : L('Harvest taken home', 'Zbiory zabrane do domu');
    const lead = S.over === 'clear' ? L(`You found every carrot bundle.`, 'Wszystkie pęczki marchewek znalezione.') : S.over === 'pet' ? L(`It woke up and the harvest${r.lost ? ` of ×${r.lost.toLocaleString()}` : ''} scattered.`, `Obudził się, a zbiory${r.lost ? ` (×${r.lost.toLocaleString()})` : ''} się rozsypały.`) : L('Safe and sound. Only cleared fields pay coins.', 'Całe i bezpieczne. Monety są tylko za oczyszczone pola.');
    const coins = S.over !== 'clear' ? '' : r.coins ? `<li>${coinSvg}<b>+${cnt(r.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}</b>${r.capped ? `<small>${L('today’s coins are all collected', 'dzisiejsze monety są już zebrane')}</small>` : ''}</li>` : `<li>${coinSvg}<b>${L('No coins', 'Bez monet')}</b><small>${L(`you have all ${S.daily} for today`, `masz już wszystkie ${S.daily} na dziś`)}</small></li>`;
    el.innerHTML = `<div class="sheet hh-sheet ${S.over}">
      <h2>${title}</h2><p>${lead}</p>
      <ul class="hh-sum">
        ${S.over !== 'pet' ? `<li>${carrotSvg}<b>×${r.pts.toLocaleString()}</b><small>${L(`harvest points`, `punkty zbiorów`)}</small></li>` : ''}
        ${coins}
        <li class="lvl"><b>${lvLine}</b>${r.to < MAX_LV && S.over === 'clear' ? `${L(`<small>next clear pays ${coinsFor(r.to)}</small>`, `<small>następne oczyszczone pole daje ${coinsFor(r.to)}</small>`)}` : ''}</li>
      </ul>
      <p class="hh-best">${L(`Best field ×${(S.best || 0).toLocaleString()} · ${S.cleared} cleared`, `Najlepsze pole ×${(S.best || 0).toLocaleString()} · oczyszczone: ${S.cleared}`)}</p>
      <div class="row"><button type="button" class="btn big" data-a="next">${L(`Next field`, `Następne pole`)}</button><button type="button" class="btn ghost" data-a="look">${L(`Look at the field`, `Obejrzyj pole`)}</button></div></div>`;
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
        if (s.over === 'clear') { setTimeout(() => !destroyed && (sfx.win(), scene?.cheer(true)), 500); big(L('Field cleared!', 'Pole oczyszczone!'), r.coins ? L(`+${r.coins} coins · level ${r.to}`, `+${cnt(r.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')} · poziom ${r.to}`) : L(`level ${r.to}`, `poziom ${r.to}`), 2000, 'k3'); }
        else if (s.over === 'pet') big(L('Oops!', 'Ups!'), L(`You woke a napping pet`, 'Śpiący zwierzak się obudził'), 1800, 'k0');
        else { sfx.join(); big(L('Harvest taken!', 'Zbiory zabrane!'), `×${r.pts.toLocaleString()}`, 1500, 'k2'); }
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
  function bindCanvas(cv) {
    canvas = cv;
    cv.tileScreen = i => scene?.tileScreen(i) || null; // where a bale is on screen (used by browser tests)
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!destroyed && !rebuildTimer) rebuildTimer = setTimeout(rebuildScene, 400); });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !scene || !S || S.over) return;
      const i = scene.pick(e.clientX, e.clientY), ok = canFlip(i) || (markMode && i >= 0 && S.cells[i] < 0);
      if (i !== cursor) { cursor = i; scene.setHover(ok ? i : -1); if (ok) sfx.hover(); }
      cv.style.cursor = ok ? 'pointer' : '';
    });
    cv.addEventListener('pointerleave', () => { cursor = -1; scene?.setHover(-1); });
    cv.addEventListener('contextmenu', e => {
      e.preventDefault(); if (!scene) return;
      const i = scene.pick(e.clientX, e.clientY); if (i >= 0) mark(i, 1);
    });
    cv.addEventListener('click', e => {
      if (!scene || !S || S.over) return;
      const i = scene.pick(e.clientX, e.clientY);
      if (i < 0 || S.cells[i] >= 0) { if (touchPick >= 0) { touchPick = -1; scene.setPicked(-1); render(); } return; }
      if (markMode) return mark(i);
      // a mouse flips at once; a finger picks the bale first, so a slip does not wake a pet
      if (e.pointerType === 'mouse' || (!e.pointerType && matchMedia('(hover: hover)').matches) || touchPick === i) flip(i);
      else { touchPick = i; scene.setPicked(i); sfx.click(); render(); }
    });
  }
  bindCanvas(canvas);
  buildScene();
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
    else return;
    e.preventDefault(); cursor = c; scene?.setHover(c);
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);

  function next() { if (!S?.over) return; sfx.click(); hideResults(); send({ t: 'next' }); }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'flip') flip(touchPick);
    else if (a === 'mark') { sfx.click(); markMode = !markMode; touchPick = -1; scene?.setPicked(-1); render(); }
    else if (a === 'kind') { sfx.click(); markKind = +b.dataset.bit; render(); }
    else if (a === 'next') next();
    else if (a === 'look') { sfx.click(); hideResults(); setHtml($('hh-bottom'), `<div class="hh-dock"><button type="button" class="btn big" data-a="next">${L(`Next field`, `Następne pole`)}</button></div>`); layout(); }
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
        gate(`<h2>${L('Hay Hunch', 'Szukanie w sianie')}</h2><p>${L(`Your level and best fields are kept between visits, so Hay Hunch needs an account. It only takes a username and a password.`, `Twój poziom i najlepsze pola zapisują się między wizytami, więc ta gra wymaga konta. Wystarczy nazwa użytkownika i hasło.`)}</p>
          <div class="row"><button type="button" class="btn big" data-a="account" data-mode="register">${L(`Create account`, `Załóż konto`)}</button><button type="button" class="btn ghost" data-a="account" data-mode="login">${L(`Log in`, `Zaloguj się`)}</button></div>
          <button type="button" class="btn ghost" data-a="home">${L(`Back to the hub`, `Wróć do Zatoki`)}</button>`);
        return;
      }
      gate(null);
      if (m.err) { sfx.bad(); ctx.toast(esc(srvText(m.err)), true); }
      if (m.s) update(m.s);
    },
    me() { const me = ctx.me(); if (me) scene?.setAvatar(me.color, me.av); if (me?.user && !S) askField(); },
    reopen() { askField(); },
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearTimeout(resTimer); clearTimeout(bigTimer); clearTimeout(quiet); clearInterval(retry); clearTimeout(rebuildTimer); scene?.dispose();
    },
  };
}
