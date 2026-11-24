// Sky Bricks game view: plays your own well right here in the browser (the rules in rules.js), tells the server
// about every brick you set down, and draws the HUD over the 3D wells: level, lines, name tags, touch pads, results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { MAXG, LOCK_MS, MAX_RESETS, SOFT_MS, fits, spawn, turned, dropY, pieceAt, lock, doHold, decode, encode, fallMs, levelAt } from './rules.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  left: SV('<path d="M15 5l-7 7 7 7"/>', 32), right: SV('<path d="M9 5l7 7-7 7"/>', 32),
  down: SV('<path d="M5 9l7 7 7-7"/>', 30),
  turn: SV('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>', 32),
  drop: SV('<path d="M12 3v12M6 10l6 6 6-6M5 21h14"/>', 30),
  swap: SV('<path d="M7 7h12l-3-3M17 17H5l3 3"/>', 24),
  crown: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 18l-1-10 6 4 4-8 4 8 6-4-1 10z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
};
import { ord } from '../../i18n.js';
import { uiz } from '../../uiz.js';
const clock = ms => { const s = Math.max(0, ms) / 1000; return `${s / 60 | 0}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const DAS = 150, ARR = 38; // hold a direction this long before it repeats, then this fast
const CLEAR_WORDS = ['', '', L('Double!', 'Podwójnie!'), L('Triple!', 'Potrójnie!'), L('Sky high!', 'Pod niebo!')];

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./bricks.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="sb${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L(`Your well of falling bricks. Arrow keys move, up turns, space drops, C sets a brick aside.`, `Twoja studnia ze spadającymi klockami. Strzałki przesuwają, strzałka w górę obraca, spacja zrzuca, C odkłada klocek.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="sb-lvl"></span><span class="chip" id="sb-lines"></span></div>
      <div class="tr"><span class="tcode" id="sb-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="sb-banner" aria-live="polite"></div>
      <div class="shout" id="sb-big" aria-live="assertive"></div>
      <div class="pads" id="sb-pads">
        <div class="move"><button type="button" data-k="left" aria-label="${L(`Move left`, `W lewo`)}">${I.left}</button><button type="button" data-k="right" aria-label="${L(`Move right`, `W prawo`)}">${I.right}</button><button type="button" data-k="soft" class="sm" aria-label="${L(`Fall faster`, `Szybciej w dół`)}">${I.down}</button></div>
        <div class="acts"><button type="button" data-k="hold" class="sm" aria-label="${L(`Set this brick aside`, `Odłóż ten klocek`)}">${I.swap}</button><button type="button" data-k="cw" aria-label="${L(`Turn the brick`, `Obróć klocek`)}">${I.turn}</button><button type="button" data-k="drop" aria-label="${L(`Drop the brick`, `Zrzuć klocek`)}">${I.drop}</button></div>
      </div>
      <p class="keys" id="sb-keys">${L(`Move <b>← →</b> · turn <b>↑</b> or <b>Z X</b> · faster <b>↓</b> · drop <b>Space</b> · set aside <b>C</b>`, `Ruch <b>← →</b> · obrót <b>↑</b> albo <b>Z X</b> · szybciej <b>↓</b> · zrzut <b>Spacja</b> · odłóż <b>C</b>`)}</p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.sb'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let recvAt = 0, tagEls = [], tagKey = '', labHold = null, labNext = null, resultsTimer = 0, bigTimer = 0, lastCount = 99, focus = 0, tideSaid = false;
  // ----- your own well, played here -----
  let st = null, P = null, syncNo = -1, pid = 0, fallAcc = 0, lockT = 0, resets = 0, gy = 0, flash = 0, playing = false;
  const held = { left: 0, right: 0, soft: false }; let dir = 0, dasT = 0, arrT = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, step });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const now = () => (S ? S.t + (performance.now() - recvAt) : 0);

  function sync() {
    if (!scene || !S || !info) return;
    const z = uiz(); scene.setHud((innerWidth <= 1150 ? 122 : 64) * z, (touch ? 152 : 46) * z, (innerWidth > 1150 ? 84 : 0) * z); // the last: room for the chat buttons, bottom right
    scene.setSeats(info, focus); scene.setState(S); pushMine();
  }
  function pushMine() {
    if (!scene) return;
    if (!playing || !st) { scene.setMine(null); return; }
    scene.setMine({ b: st.b, P, gy, hold: st.hold, can: st.can, next: [0, 1, 2].map(i => pieceAt(st.seed, st.nx + i)), pend: st.pend.length, dead: st.dead, flash });
  }

  // take the well as the server has it: at the start, after a hiccup, or coming back after a bot played for you
  function adopt(m) {
    st = { b: decode(S.b[S.me] || ''), seed: S.seed, nx: m.nx, cur: m.cur, hold: m.hold, can: m.can, pend: m.pend.map(([id, hole]) => ({ id, hole })), locks: m.locks, combo: m.combo, lines: m.lines, sent: m.sent, dead: m.dead };
    syncNo = m.sync; newPiece();
  }
  function newPiece() {
    P = st.dead ? null : { ...spawn(st.cur), id: ++pid };
    fallAcc = 0; lockT = 0; resets = 0; if (P) gy = dropY(st.b, P);
  }
  const grounded = () => !fits(st.b, P.k, P.r, P.x, P.y - 1);
  function moved() { if (lockT > 0 && resets < MAX_RESETS) { lockT = 0; resets++; } gy = dropY(st.b, P); }
  const canPlay = () => playing && st && P && !st.dead && S.stage === 'go';
  function move(dx) {
    if (!canPlay() || !fits(st.b, P.k, P.r, P.x + dx, P.y)) return false;
    P.x += dx; moved(); sfx.tick(); return true;
  }
  function turn(d) {
    if (!canPlay()) return;
    const q = turned(st.b, P, d); if (!q) return;
    P.r = q.r; P.x = q.x; P.y = q.y; moved(); sfx.hover();
  }
  function hardDrop() {
    if (!canPlay()) return;
    const far = P.y - gy; P.y = gy;
    if (far > 1) scene?.landed(P);
    setDown(true);
  }
  function hold() {
    if (!canPlay()) return;
    if (!st.can) { sfx.bad(); return; }
    doHold(st); ctx.act({ t: 'h', y0: syncNo }); sfx.draw(); newPiece(); pushMine();
    if (st.dead) iAmOut();
  }
  function setDown(hard) {
    const p = P, g = Math.min(st.pend.length, MAXG), res = lock(st, p.r, p.x, p.y, g);
    if (!res) return; // cannot happen: the brick is resting where the rules put it
    ctx.act({ t: 'l', y0: syncNo, n: st.locks, r: p.r, x: p.x, y: p.y, g });
    const k = res.rows.length;
    if (k) {
      scene?.cleared(S.me, res.rows);
      if (k >= 4) sfx.win(); else if (k >= 2) sfx.set(); else sfx.join();
      const combo = st.combo >= 3 ? L(`${st.combo} in a row`, `${st.combo} z rzędu`) : '';
      if (res.clean) big(L('Clean sweep!', 'Czysto!'), L('the whole well', 'cała studnia'), 1400, 'k3'); else if (k >= 2) big(CLEAR_WORDS[Math.min(4, k)], combo, 1100, 'k' + Math.min(4, k)); else if (st.combo >= 3) big(L(`${st.combo} in a row!`, `${st.combo} z rzędu!`), '', 900, 'k1');
    } else if (hard) sfx.place(); else sfx.plop();
    if (res.took) { sfx.bad(); root.classList.remove('bump'); void root.offsetWidth; root.classList.add('bump'); }
    flash = 0; newPiece(); renderMine();
    if (st.dead) iAmOut();
  }
  function iAmOut() { P = null; sfx.lose(); } // the server says so a moment later, with your place

  // Called before every frame is drawn, with the real time since the last one.
  function step(ms) {
    if (!S) return;
    if (!canPlay()) { pushMine(); return; }
    // a held direction repeats
    const want = held.left && held.right ? (held.left > held.right ? -1 : 1) : held.left ? -1 : held.right ? 1 : 0;
    if (want !== dir) { dir = want; dasT = 0; arrT = 0; }
    else if (dir) { dasT += ms; if (dasT >= DAS) { arrT += ms; while (arrT >= ARR) { arrT -= ARR; if (!move(dir)) break; } } }
    // falling
    const every = held.soft ? Math.min(SOFT_MS, fallMs(S.speed, now())) : fallMs(S.speed, now());
    fallAcc += ms;
    while (fallAcc >= every) {
      if (!grounded()) { P.y--; fallAcc -= every; lockT = 0; } else { fallAcc = 0; break; }
    }
    // resting: a short moment to slide it, then it sets
    if (grounded()) { lockT += ms; flash = Math.min(.5, lockT / LOCK_MS * .5); if (lockT >= LOCK_MS) setDown(false); } else flash = 0;
    pushMine();
  }

  function onFrame(fr) {
    if (!S || !info) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = fr.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, 0)`;
      const mw = Math.max(84, Math.round(t.w)); if (el._w !== mw) { el._w = mw; el.style.maxWidth = mw + 'px'; }
    }
    if (labHold) {
      const show = playing && !!st;
      labHold.hidden = labNext.hidden = !show;
      if (show) { labHold.style.transform = `translate(${fr.hold.x.toFixed(1)}px, ${fr.hold.y.toFixed(1)}px) translate(-50%, -50%)`; labNext.style.transform = `translate(${fr.next.x.toFixed(1)}px, ${fr.next.y.toFixed(1)}px) translate(-50%, -50%)`; }
    }
    renderClock();
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + focus;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="sb-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div>`).join('')
      + `<div class="sb-lab" hidden>${L(`Set aside${touch ? '' : ' <kbd>C</kbd>'}`, `Odłożony${touch ? '' : ' <kbd>C</kbd>'}`)}</div>${L(`<div class="sb-lab" hidden>Next</div>`, `<div class="sb-lab" hidden>Następny</div>`)}`;
    tagEls = [...tagsEl.querySelectorAll('.sb-tag')]; [labHold, labNext] = tagsEl.querySelectorAll('.sb-lab');
  }
  function renderTags() {
    info.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      const x = S.x[i], dead = !!x[0];
      el.classList.toggle('out', dead); el.classList.toggle('hot', !dead && x[3] >= 4);
      setHtml(el.querySelector('.cnt'), dead ? (x[4] ? ord(x[4]) : L('out', 'koniec')) : String(x[1]));
      setHtml(el.querySelector('b'), nameHtml(p.name, p.fl) + (p.bot && p.human ? L(' (away)', ' (poza grą)') : ''));
    });
  }

  // ----- HUD -----
  function renderMine() {
    const i = focus, x = S.x[i]; if (!x) return;
    const lines = playing && st ? st.lines : x[1], sent = playing && st ? Math.max(st.sent, x[2]) : x[2];
    setHtml($('sb-lines'), L(`Lines <b>${lines}</b> · sent <b>${sent}</b>`, `Linie <b>${lines}</b> · wysłane <b>${sent}</b>`));
  }
  function renderClock() {
    if (!S) return;
    const t = now();
    setHtml($('sb-lvl'), S.stage === 'count' ? L('Get ready', 'Przygotuj się') : L(`Level <b>${levelAt(S.ph === 'end' ? S.res?.ms || 0 : t)}</b> · ${clock(S.ph === 'end' ? S.res?.ms || 0 : t)}`, `Poziom <b>${levelAt(S.ph === 'end' ? S.res?.ms || 0 : t)}</b> · ${clock(S.ph === 'end' ? S.res?.ms || 0 : t)}`));
    if (S.stage === 'count') {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    }
    renderBanner(t);
  }
  function renderBanner(t) {
    const el = $('sb-banner'); let msg = '', hot = false;
    const left = S.x.filter(x => !x[0]).length;
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'count') msg = L('Last one standing wins', 'Wygrywa ostatnia osoba w grze');
    else if (S.me >= 0 && S.x[S.me][0]) msg = L(`You are out · ${left} still stacking`, `Koniec gry dla ciebie · w grze zostało: ${left}`);
    else if (S.me < 0) msg = L(`Watching ${nameOf(focus)} · ${left} still stacking`, `Oglądasz: ${nameOf(focus)} · w grze zostało: ${left}`);
    else if (info[S.me]?.bot) msg = L('A bot is stacking for you', 'Bot układa za ciebie');
    else if (t > S.tide) { msg = L('The stone tide is rising!', 'Kamienny przypływ się podnosi!'); hot = true; }
    else if (S.tide - t < 10000) { msg = L(`Stone tide in ${Math.ceil((S.tide - t) / 1000)}s`, `Kamienny przypływ za ${Math.ceil((S.tide - t) / 1000)} s`); hot = true; }
    else if (playing && st && st.pend.length) { msg = L(`${st.pend.length} stone line${st.pend.length === 1 ? '' : 's'} coming. Clear rows to knock them back!`, `Nadchodzą kamienne linie: ${st.pend.length}. Czyść rzędy, żeby je odbić!`); hot = st.pend.length >= 4; }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', hot);
  }
  function render() {
    if (!S || !info) return;
    $('sb-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderMine();
    root.classList.toggle('watching', !playing);
    $('sb-pads').hidden = !playing;
  }

  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('sb-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.classList.add('show'); el.style.setProperty('--ms', ms + 'ms');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('Go!', 'Start!'), '', 900); sfx.turn(); }
    else if (e.t === 'clr') { if (!(mine && playing)) scene?.cleared(e.s, e.k); }
    else if (e.t === 'atk') {
      scene?.attack(e.s, e.to, e.k);
      if (e.to === S.me && playing) { sfx.warn(); ctx.toast(L(`${nameOf(e.s)} sent you ${e.k} stone line${e.k === 1 ? '' : 's'}!`, `${nameOf(e.s)} wysyła ci kamienne linie: ${e.k}!`)); }
      else if (mine && playing) sfx.pop();
    } else if (e.t === 'tide') {
      S.x.forEach((x, i) => { if (!x[0]) scene?.attack(-1, i, 1); });
      if (!tideSaid) { tideSaid = true; big(L('Stone tide!', 'Kamienny przypływ!'), L('lines rise for everyone', 'linie rosną u wszystkich'), 1600, 'k4'); }
      sfx.warn();
    } else if (e.t === 'out') {
      scene?.out(e.s);
      if (mine) { sfx.lose(); big(L('Out!', 'Koniec!'), L(`${ord(e.place)} place`, `${ord(e.place)} miejsce`), 2200, 'k4'); }
      else { sfx.plop(); ctx.toast(L(`${nameOf(e.s)} is out!`, `${nameOf(e.s)} odpada!`)); }
    } else if (e.t === 'end') {
      scene?.cheer(e.w);
      if (e.w === S.me) { sfx.win(); big(L('You win!', 'Wygrana!'), L('last one standing', 'ostatnia osoba w grze'), 2400, 'k3'); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1900);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now(); info = s.seats;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; st = null; P = null; syncNo = -1; tideSaid = false;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    playing = s.me >= 0 && s.ph === 'play' && !!s.mine && !info[s.me]?.bot;
    if (playing) {
      const m = s.mine;
      if (!st || m.sync !== syncNo) adopt(m);
      else if (m.locks === st.locks) { // the server has caught up with every brick sent: its list of stone lines is the truth
        st.pend = m.pend.map(([id, hole]) => ({ id, hole }));
        if (encode(st.b) !== (s.b[s.me] || '') || m.dead !== st.dead) adopt(m);
      }
    } else { st = null; P = null; }
    // who the big well shows: you, or (watching) whoever is still in
    if (s.me >= 0) focus = s.me;
    else if (!(focus < info.length) || s.x[focus]?.[0]) { const k = s.x.findIndex(x => !x[0]); focus = k >= 0 ? k : Math.max(0, s.win); }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win;
    el.innerHTML = `<div class="sheet">
      <h2>${I.crown}${w === S.me ? L('You win!', 'Wygrana!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${L(`Last one standing after ${clock(R.ms)}`, `Ostatnia osoba w grze po ${clock(R.ms)}`)}</p>
      <ol class="sb-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${i === S.me ? 'sb-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          ${L(`<strong>${R.lines[i]} line${R.lines[i] === 1 ? '' : 's'}</strong><small>sent ${R.sent[i]}${R.time[i] ? ' · out at ' + clock(R.time[i]) : ''}</small>`, `<strong>${cnt(R.lines[i], 'line', 'lines', 'linia', 'linie', 'linii')}</strong><small>wysłane ${R.sent[i]}${R.time[i] ? ' · koniec po ' + clock(R.time[i]) : ''}</small>`)}${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
    if (w === S.me) confetti();
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S || !info) return;
    const i = info.findIndex(p => p.id === m.id), t = tagEls[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = t && !t.hidden ? t.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top - 10 : innerHeight * .3;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.setTransform(q, 0, 0, q, 0, 0); // full phone resolution is 4x the pixels for no visible gain
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#7ed957'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .3 }));
    let t = 0;
    const stepC = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(stepC); else cv.width = cv.height = 0;
    };
    stepC();
  }

  // ----- input -----
  let stamp = 0;
  function press(k, on) {
    if (k === 'left' || k === 'right') {
      if (on) { if (!held[k]) { held[k] = ++stamp; dir = 0; move(k === 'left' ? -1 : 1); dir = k === 'left' ? -1 : 1; dasT = 0; arrT = 0; } } else held[k] = 0;
    } else if (k === 'soft') held.soft = on;
    else if (!on) return;
    else if (k === 'cw') turn(1);
    else if (k === 'ccw') turn(-1);
    else if (k === 'drop') hardDrop();
    else if (k === 'hold') hold();
  }
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'soft', KeyS: 'soft', ArrowUp: 'cw', KeyW: 'cw', KeyX: 'cw', KeyZ: 'ccw', KeyQ: 'ccw', Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold' };
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEYMAP[e.code]; if (!k) return;
    if (!root.querySelector('.results').hidden) return;
    e.preventDefault();
    if (e.type === 'keydown') { if (!e.repeat) press(k, true); } else press(k, false);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { held.left = held.right = 0; held.soft = false; root.querySelectorAll('.pads .on').forEach(b => b.classList.remove('on')); };
  addEventListener('blur', onBlur);
  const padsEl = $('sb-pads');
  const pad = (e, on) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    e.preventDefault();
    if (on === b.classList.contains('on')) return;
    b.classList.toggle('on', on);
    if (on) { try { b.setPointerCapture(e.pointerId); } catch {} }
    press(b.dataset.k, on);
  };
  padsEl.addEventListener('pointerdown', e => pad(e, true));
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) padsEl.addEventListener(t, e => pad(e, false));
  padsEl.addEventListener('contextmenu', e => e.preventDefault());

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    b.blur?.(); // so Space drops the next brick instead of pressing this button again
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
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', onBlur);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
