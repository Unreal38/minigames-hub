// Burrow Bop game view: plays your own garden right here in the browser (the pop-ups come from rules.js, the same
// list the server has), tells the server about every bop, and draws the HUD over the 3D gardens: hearts, score,
// name tags, the points that float up, results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { LIVES, TOTAL, SLEEP, GOLD, HEART, schedule, newPlayer, resolve } from './rules.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  crown: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 18l-1-10 6 4 4-8 4 8 6-4-1 10z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2.5 12 2.5 8.4 2.5 5.4 4.8 3.2 7.6 3.2c1.8 0 3.4.9 4.4 2.4 1-1.5 2.6-2.4 4.4-2.4 2.8 0 5.1 2.2 5.1 5.2 0 3.6-2.5 7.1-9.5 12.6z" fill="#ff5a7a" stroke="#3b2219" stroke-width="2.2" stroke-linejoin="round"/></svg>',
};
const clock = ms => { const s = Math.max(0, ms) / 1000; return `${s / 60 | 0}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
// the burrows on the keyboard, laid out like the garden: Q W E / A S D / Z X C, or the number pad
const KEYMAP = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8, Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8 };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./bop.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="bb${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L(`Your garden with nine burrows. Click or tap a pet to bop it, or use the keys Q W E, A S D, Z X C.`, `Twój ogródek z dziewięcioma norkami. Kliknij albo dotknij zwierzaka, żeby go pacnąć, albo użyj klawiszy Q W E, A S D, Z X C.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bb-time"></span><span class="chip" id="bb-score"></span><span class="chip combo" id="bb-combo" hidden></span></div>
      <div class="tr"><span class="tcode" id="bb-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="hearts" id="bb-hearts" hidden></div>
      <div class="banner" id="bb-banner" aria-live="polite"></div>
      <div class="shout" id="bb-big" aria-live="assertive"></div>
      <p class="keys" id="bb-keys">${L(`<b>Click</b> a pet to bop it · or use <b>Q W E</b> / <b>A S D</b> / <b>Z X C</b> · don't wake the sleepy ones`, `<b>Kliknij</b> zwierzaka, żeby go pacnąć · albo użyj <b>Q W E</b> / <b>A S D</b> / <b>Z X C</b> · nie budź śpiochów`)}</p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bb'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, lastCount = 99, focus = 0, off = -Infinity, offAt = 0;
  // ----- your own garden, played here -----
  let pops = [], P = null, res = null, ptr = 0, syncNo = -1, playing = false, heartsKey = '', sent = [];
  const snaps = new Map(); // after how many pop-ups: [hearts, score], to compare with the server's count

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, clock: now });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  // The game clock (ms since "Go"): the server's, carried on by this browser's own between messages.
  function now() { return S && S.ph === 'play' ? performance.now() + off : S?.res ? S.res.ms : 0; }

  function sync() {
    if (!scene || !S || !info) return;
    const z = uiz(); scene.setHud((innerWidth <= 700 ? 138 : 118) * z, (touch ? 30 : 50) * z);
    scene.setPops(pops); scene.setSeats(info, focus); scene.setState(S); scene.setMine(canPlay() && !touch);
  }

  // take your game as the server has it: at the start, after a hiccup, or coming back after a bot played for you
  function adopt(m) {
    P = { lv: m.lv, sc: m.sc, cb: m.cb, best: m.best, bops: m.bops, n: m.n };
    res = new Uint8Array(pops.length); res.fill(3, 0, m.b); ptr = m.b;
    for (let k = 0; k < m.r.length; k++) res[m.b + k] = +m.r[k];
    syncNo = m.sync; snaps.clear();
    // bops still on their way to the server count here already
    const t = performance.now(); sent = sent.filter(h => t - h.at < 1500 && !res[h.i]);
    for (const h of sent) { res[h.i] = 1; resolve(P, pops[h.i], true); }
    renderMine();
  }
  const canPlay = () => playing && P && P.lv > 0 && S.stage === 'go' && S.ph === 'play';
  const note = () => { snaps.set(P.n, [P.lv, P.sc]); if (snaps.size > 90) snaps.delete(snaps.keys().next().value); };

  function floaty(h, text, cls = '') {
    const p = scene?.spot(h); if (!p) return;
    const f = document.createElement('div'); f.className = 'bb-pt ' + cls; f.textContent = text;
    f.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px) translate(-50%, -100%)`;
    root.append(f); setTimeout(() => f.remove(), 720);
  }
  function hurt() { root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt'); }

  // pets that ducked before you got to them
  function step() {
    if (!canPlay()) return;
    const t = now(); let lost = false;
    for (let j = ptr; j < pops.length && pops[j].at <= t && P.lv > 0; j++) {
      if (res[j] || pops[j].at + pops[j].up > t) continue;
      res[j] = 2;
      if (resolve(P, pops[j], false).life) { lost = true; scene?.miss(j); floaty(pops[j].hole, '−1 ♥', 'bad'); }
      note();
    }
    while (ptr < pops.length && res[ptr]) ptr++;
    if (lost) { sfx.bad(); hurt(); renderMine(); if (P.lv <= 0) sfx.lose(); }
  }
  // ts: when the click or key press really happened (the page may get to it a moment later on a slow device)
  function hitHole(h, spot, ts) {
    if (!canPlay()) return;
    const t = Math.min(now(), ts > 0 ? ts + off : Infinity); let j = -1;
    for (let k = ptr; k < pops.length && pops[k].at <= t; k++) if (!res[k] && pops[k].hole === h && pops[k].at + pops[k].up > t) { j = k; break; }
    if (j < 0) { scene?.tap(focus, h, spot?.x || 0, spot?.z || 0); sfx.land(); return; }
    const pop = pops[j], c = Math.round(t);
    res[j] = 1; const r = resolve(P, pop, true); note();
    while (ptr < pops.length && res[ptr]) ptr++;
    ctx.act({ t: 'h', y0: syncNo, i: j, c }); sent.push({ i: j, at: performance.now() }); if (sent.length > 24) sent.shift();
    scene?.bop(focus, j, t, pop.kind === SLEEP);
    if (pop.kind === SLEEP) { sfx.bad(); sfx.warn(); hurt(); floaty(h, '−1 ♥', 'bad'); if (P.lv <= 0) sfx.lose(); }
    else {
      sfx.pop();
      if (pop.kind === GOLD) sfx.set(); else if (r.life > 0) sfx.join(); else if (P.cb % 5 === 0) sfx.combo(P.cb / 5);
      floaty(h, '+' + r.pts + (r.life > 0 ? ' ♥' : ''), pop.kind === GOLD ? 'gold' : r.life > 0 ? 'life' : '');
      if (P.cb === 10 || P.cb === 25 || P.cb === 50) big(L(`${P.cb} in a row!`, `${P.cb} z rzędu!`), '', 800, 'k1');
    }
    renderMine();
  }

  function onFrame(fr) {
    if (!S || !info) return;
    step();
    for (let i = 0; i < tagEls.length; i++) {
      const t = fr.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -50%)`;
      const mw = Math.max(70, Math.round(t.w)); if (el._w !== mw) { el._w = mw; el.style.maxWidth = mw + 'px'; }
    }
    renderClock();
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|');
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="bb-tag ntc${tagCls(p)}" hidden>${tagFace(p)}<span class="hp"></span><span class="cnt"></span>${tagBg(p)}</div>`).join('');
    tagEls = [...tagsEl.querySelectorAll('.bb-tag')];
  }
  function renderTags() {
    info.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      const x = S.x[i], lv = Math.max(0, x[0]), dead = lv <= 0;
      el.classList.toggle('out', dead); el.classList.toggle('hot', lv === 1);
      setHtml(el.querySelector('.hp'), '♥'.repeat(lv) + (lv < LIVES ? `<i>${'♥'.repeat(LIVES - lv)}</i>` : ''));
      setHtml(el.querySelector('.cnt'), dead && x[3] ? ord(x[3]) : String(x[1]));
      setHtml(el.querySelector('b'), nameHtml(p.name, p.fl) + (p.bot && p.human ? L(' (away)', ' (poza grą)') : ''));
    });
  }

  // ----- HUD -----
  function renderMine() {
    if (!S) return;
    const x = S.x[focus]; if (!x) return;
    const mine = playing && P && focus === S.me, lv = Math.max(0, mine ? P.lv : x[0]), sc = mine ? P.sc : x[1], cb = mine ? P.cb : x[2];
    setHtml($('bb-score'), L(`Score <b>${sc}</b>`, `Wynik <b>${sc}</b>`));
    const cEl = $('bb-combo'); cEl.hidden = cb < 3; if (cb >= 3) setHtml(cEl, L(`${cb} in a row`, `${cb} z rzędu`));
    const el = $('bb-hearts'), key = focus + ':' + lv;
    el.hidden = S.ph !== 'play' && !S.res;
    if (key !== heartsKey) {
      const [pf, pl] = heartsKey.split(':').map(Number), same = pf === focus;
      el.innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="${i >= lv ? 'gone' : ''}${same && i >= lv && i < pl ? ' lost' : ''}${same && i < lv && i >= pl ? ' back' : ''}">${I.heart}</span>`).join('');
      el.setAttribute('aria-label', L(`${cnt(lv, 'heart', 'hearts', 'serce', 'serca', 'serc')} left`, `Zostało: ${cnt(lv, 'heart', 'hearts', 'serce', 'serca', 'serc')}`));
      heartsKey = key;
    }
  }
  function renderClock() {
    if (!S) return;
    const t = now(), over = S.ph === 'end';
    setHtml($('bb-time'), S.stage === 'count' ? L('Get ready', 'Przygotuj się') : clock(over ? S.res?.ms || 0 : Math.min(TOTAL, Math.max(0, t))));
    if (S.stage === 'count') {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    }
  }
  function renderBanner() {
    const el = $('bb-banner'); let msg = '', hot = false;
    const left = S.x.filter(x => x[0] > 0).length, meOut = S.me >= 0 && S.x[S.me][0] <= 0;
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'count') msg = L('Bop the pets. Let the sleepy ones sleep!', 'Pacaj zwierzaki. Śpiochom daj spać!');
    else if (meOut) msg = focus !== S.me ? L(`You are out · watching ${info[focus]?.name}`, `Koniec gry dla ciebie · oglądasz: ${info[focus]?.name}`) : L(`You are out · ${left} still in`, `Koniec gry dla ciebie · w grze zostało: ${left}`);
    else if (S.me < 0) msg = L(`Watching ${info[focus]?.name} · ${left} still in`, `Oglądasz: ${info[focus]?.name} · w grze zostało: ${left}`);
    else if (info[S.me]?.bot) msg = L('A bot is bopping for you', 'Bot paca za ciebie');
    else if (playing && P && P.lv === 1) { msg = L('Last heart!', 'Ostatnie serce!'); hot = true; }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', hot);
  }
  function render() {
    if (!S || !info) return;
    $('bb-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderMine(); renderBanner();
    root.classList.toggle('watching', !playing);
  }

  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('bb-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.classList.add('show'); el.style.setProperty('--ms', ms + 'ms');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('Go!', 'Start!'), '', 900); sfx.turn(); }
    else if (e.t === 'b') { if (!(mine && playing)) scene?.bop(e.s, e.i, now(), pops[e.i]?.kind === SLEEP); } // your own bops are drawn the moment you make them
    else if (e.t === 'out') {
      scene?.out(e.s);
      if (mine) { sfx.lose(); big(L('Out!', 'Koniec!'), L('no hearts left', 'nie masz już serc'), 2200, 'k4'); }
      else { sfx.plop(); ctx.toast(L(`${nameOf(e.s)} is out!`, `${nameOf(e.s)} odpada!`)); }
    } else if (e.t === 'end') {
      scene?.cheer(e.w);
      if (e.w === S.me) { sfx.win(); big(L('You win!', 'Wygrana!'), '', 2400, 'k3'); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1900);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, tp = performance.now();
    S = s; info = s.seats;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; P = null; res = null; syncNo = -1; off = -Infinity; sent = []; heartsKey = ''; focus = Math.max(0, s.me);
      pops = schedule(s.seed, s.pace);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    // the clock: the quickest message so far is the closest to the server's own time (the rest were held up on the way)
    off = Math.max(off - (tp - offAt) * .002, s.t - tp); offAt = tp;
    playing = s.me >= 0 && s.ph === 'play' && !!s.mine && !info[s.me]?.bot;
    if (playing) {
      const m = s.mine, snap = snaps.get(m.n);
      if (!P || m.sync !== syncNo) adopt(m);
      else if (snap ? snap[0] !== m.lv || snap[1] !== m.sc : m.n > P.n) adopt(m); // the server saw it differently (a bop that arrived too late): its count is the truth
    } else { P = null; res = null; }
    // whose garden is the big one: yours while you have hearts, then somebody still playing
    const live = i => s.x[i]?.[0] > 0;
    if (s.me >= 0 && (live(s.me) || s.ph === 'end')) focus = s.me;
    else if (!(focus < info.length) || (!live(focus) && s.ph === 'play')) { const k = s.x.findIndex(x => x[0] > 0); focus = k >= 0 ? k : Math.max(0, s.win, focus < info.length ? focus : 0); }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win, solo = info.length === 1;
    const sub = solo ? L(`You lasted ${clock(R.time[0] || R.ms)}`, `Twój czas: ${clock(R.time[0] || R.ms)}`) : R.time[w] === 0 && R.ms >= TOTAL ? L(`Highest score after ${clock(TOTAL)}`, `Najwyższy wynik po ${clock(TOTAL)}`) : L(`Last one with a heart after ${clock(R.ms)}`, `Ostatnia osoba z sercem po ${clock(R.ms)}`);
    el.innerHTML = `<div class="sheet">
      <h2>${I.crown}${solo ? L(`${R.sc[0]} points!`, `Punkty: ${R.sc[0]}!`) : w === S.me ? L('You win!', 'Wygrana!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${sub}</p>
      <ol class="bb-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${pbRowCls(p.fl)} ${i === S.me ? 'bb-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong title="${L('Score', 'Wynik')}">${cnt(R.sc[i], 'point', 'points', 'punkt', 'punkty', 'punktów')}</strong><small>${cnt(R.bops[i], 'bop', 'bops', 'pacnięcie', 'pacnięcia', 'pacnięć')}<span class="best">${L(` · best run ${R.best[i]}`, ` · najdłuższa seria ${R.best[i]}`)}</span>${R.time[i] ? ' · ' + clock(R.time[i]) : ''}</small>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.setTransform(q, 0, 0, q, 0, 0);
    const cols = ['#ff9b54', '#ffe46b', '#9be07a', '#8fd0ff', '#b49bff', '#ffb3d1'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .5 }));
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

  // ----- input: click or tap a pet; the mallet follows the mouse -----
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !scene) return; const r = scene.pick(e.clientX, e.clientY); scene.hover(r?.on ? r : null); });
  canvas.addEventListener('pointerleave', () => scene?.hover(null));
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || !scene) return;
    e.preventDefault();
    const r = scene.pick(e.clientX, e.clientY); if (!r || !canPlay()) return;
    if (r.h >= 0) hitHole(r.h, r, e.timeStamp); else if (r.on) { scene.tap(focus, -1, r.x, r.z); sfx.land(); }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const h = KEYMAP[e.code]; if (h == null || !root.querySelector('.results').hidden) return;
    e.preventDefault(); hitHole(h, null, e.timeStamp);
  };
  addEventListener('keydown', onKey);

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
    b.blur?.();
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
      removeEventListener('keydown', onKey);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
void HEART;
