// Bubble Lagoon game view: plays your own lagoon right here in the browser (the rules in rules.js), tells the server
// about every shot, and draws the HUD over the 3D lagoons: pets freed, the reef's timer, name tags, results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { MAXG, HURRY, RELOAD, SPEED, AMAX, LIM, trace, lock, decode, encode, rowsDue, nextRowIn } from './rules.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  crown: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 18l-1-10 6 4 4-8 4 8 6-4-1 10z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const clock = ms => { const s = Math.max(0, ms) / 1000; return `${s / 60 | 0}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const GUIDE = 13; // how far the dotted aiming line reaches

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./lagoon.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="bl${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L(`Your lagoon of pet bubbles. Aim with the mouse or the arrow keys, shoot with a click or Space, swap bubbles with Shift.`, `Twoja laguna z bąbelkami. Celuj myszką albo strzałkami, strzelaj kliknięciem albo spacją, zamieniaj bąbelki klawiszem Shift.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bl-time"></span><span class="chip" id="bl-score"></span></div>
      <div class="tr"><span class="tcode" id="bl-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="bl-banner" aria-live="polite"></div>
      <div class="shout" id="bl-big" aria-live="assertive"></div>
      <p class="keys" id="bl-keys">${L(`Aim with the <b>mouse</b> or <b>← →</b> · shoot: <b>click</b> or <b>Space</b> · swap: <b>right click</b> or <b>Shift</b>`, `Celuj <b>myszką</b> albo <b>← →</b> · strzał: <b>klik</b> albo <b>spacja</b> · zamiana: <b>prawy przycisk</b> albo <b>Shift</b>`)}</p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bl'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let recvAt = 0, tagEls = [], tagKey = '', labNext = null, resultsTimer = 0, bigTimer = 0, lastCount = 99, focus = 0, frame = null;
  // ----- your own lagoon, played here -----
  let st = null, syncNo = -1, playing = false, aim = 0, sw = 0, fly = null, reload = 0, idle = 0, path = null, pathKey = '', hurryN = 0;
  const held = { left: false, right: false }; let turnT = 0;

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
    scene.setHud(innerWidth <= 1150 ? 122 : 64, touch ? 26 : 46, innerWidth > 1150 ? 84 : 0); // the last: room for the chat buttons, bottom right
    scene.setSeats(info, focus); scene.setState(S); pushMine();
  }
  function pushMine() {
    if (!scene) return;
    if (!playing || !st) { scene.setMine(null); return; }
    const key = aim + '|' + st.locks + '|' + syncNo;
    if (key !== pathKey) { pathKey = key; path = st.dead ? null : trace(st, aim)?.path || null; }
    let f = null;
    if (fly) { // where along its path the shot is right now
      let d = fly.d; f = { x: fly.path[0][0], y: fly.path[0][1], k: fly.k };
      for (let i = 0; i + 1 < fly.path.length; i++) { const [ax, ay] = fly.path[i], [bx, by] = fly.path[i + 1], seg = Math.hypot(bx - ax, by - ay);
        if (d <= seg || i + 2 === fly.path.length) { const u = seg ? Math.min(1, d / seg) : 1; f.x = ax + (bx - ax) * u; f.y = ay + (by - ay) * u; break; } d -= seg; }
    }
    scene.setMine({ b: st.b, par: st.par, cur: sw ? st.nxt : st.cur, nxt: sw ? st.cur : st.nxt, aim, path, guide: GUIDE, fly: f, pend: st.pend.length, dead: st.dead, ready: Math.max(.2, 1 - reload / RELOAD) });
  }

  // take the lagoon as the server has it: at the start, after a hiccup, or coming back after a bot played for you
  function adopt(m) {
    st = { ...decode(S.b[S.me] || '0'), seed: S.seed, rows: m.rows, nx: m.nx, cur: m.cur, nxt: m.nxt, eg: m.eg, pend: m.pend.map(id => ({ id })), locks: m.locks, streak: m.streak, freed: m.freed, sent: m.sent, dead: m.dead };
    syncNo = m.sync; fly = null; sw = 0; reload = 0; idle = 0; pathKey = '';
  }
  const canPlay = () => playing && st && !st.dead && S.stage === 'go';
  function fire() {
    if (!canPlay() || fly || reload > 0) return;
    const tr = trace(st, aim); if (!tr) return;
    let len = 0; for (let i = 0; i + 1 < tr.path.length; i++) len += Math.hypot(tr.path[i + 1][0] - tr.path[i][0], tr.path[i + 1][1] - tr.path[i][1]);
    fly = { path: tr.path, len, d: 0, k: sw ? st.nxt : st.cur, a: aim, w: sw };
    sfx.whoosh();
  }
  function swap() {
    if (!canPlay() || fly || st.cur === st.nxt) return;
    sw ^= 1; sfx.draw();
  }
  function land() {
    const f = fly; fly = null;
    const g = Math.min(st.pend.length, MAXG), k = Math.max(st.rows, rowsDue(S.speed, now()));
    const res = lock(st, f.a, f.w, g, k);
    if (!res) return; // cannot happen: the same rules worked out this very path
    ctx.act({ t: 's', y0: syncNo, n: st.locks, a: f.a, w: f.w, g, k });
    scene?.landed(res);
    sw = 0; reload = RELOAD; idle = 0; hurryN = 0; pathKey = '';
    const p = res.popped.length, d = res.dropped.length;
    if (p) {
      if (d >= 4) sfx.boom(); else sfx.pop();
      if (st.streak >= 2) sfx.combo(st.streak);
      if (res.clean) big(L('Clean sweep!', 'Czysto!'), L('the whole lagoon', 'cała laguna'), 1400, 'k3');
      else if (d >= 3) big(L(`${d} dropped!`, `${d} w dół!`), res.out ? L(`${cnt(res.out, 'egg', 'eggs', 'jajko', 'jajka', 'jajek')} sent`, `Wysyłasz: ${cnt(res.out, 'egg', 'eggs', 'jajko', 'jajka', 'jajek')}`) : L('eggs knocked back', 'jajka odbite'), 1100, d >= 6 ? 'k4' : 'k2');
      else if (st.streak >= 3) big(L(`${st.streak} in a row!`, `${st.streak} z rzędu!`), '', 800, 'k1');
    } else sfx.plop();
    if (res.took) { sfx.bad(); root.classList.remove('bump'); void root.offsetWidth; root.classList.add('bump'); }
    if (res.added) sfx.thunk();
    renderMine();
    if (st.dead) sfx.lose(); // the server says so a moment later, with your place
  }

  // Called before every frame is drawn, with the real time since the last one.
  function step(ms) {
    if (!S) return;
    if (!canPlay()) { pushMine(); return; }
    // the arrow keys swing the launcher: gently at first, faster while held
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir) { turnT += ms; aim = Math.max(-AMAX, Math.min(AMAX, aim + dir * ms * (turnT < 180 ? .25 : Math.min(1.5, .35 + turnT / 900)))); } else turnT = 0;
    aim = Math.round(aim);
    if (reload > 0) reload = Math.max(0, reload - ms);
    if (fly) { fly.d += SPEED * ms / 1000; if (fly.d >= fly.len) land(); }
    else {
      // dawdle and the launcher fires by itself
      idle += ms;
      const left = Math.ceil((HURRY - idle) / 1000);
      if (left <= 3 && left > 0 && left !== hurryN) { hurryN = left; sfx.tick(); }
      if (idle >= HURRY) fire();
    }
    pushMine();
  }

  function onFrame(fr) {
    if (!S || !info) return;
    frame = fr;
    for (let i = 0; i < tagEls.length; i++) {
      const t = fr.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, 0)`;
      const mw = Math.max(84, Math.round(t.w)); if (el._w !== mw) { el._w = mw; el.style.maxWidth = mw + 'px'; }
    }
    if (labNext) {
      const show = canPlay();
      if (labNext.hidden !== !show) labNext.hidden = !show;
      if (show) {
        labNext.style.transform = `translate(${fr.next.x.toFixed(1)}px, ${(fr.next.y + fr.px * .5).toFixed(1)}px) translate(-50%, 0)`;
        const left = Math.ceil((HURRY - idle) / 1000), hurry = !fly && left <= 3;
        setHtml(labNext, hurry ? L(`Shoot! ${left}`, `Strzelaj! ${left}`) : L(`Next`, `Następny`));
        labNext.classList.toggle('hurry', hurry);
      }
    }
    renderClock();
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + focus;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="bl-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div>`).join('') + `<div class="bl-lab" hidden></div>`;
    tagEls = [...tagsEl.querySelectorAll('.bl-tag')]; labNext = tagsEl.querySelector('.bl-lab');
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
    const freed = playing && st ? st.freed : x[1], sent = playing && st ? Math.max(st.sent, x[2]) : x[2];
    setHtml($('bl-score'), L(`Pets freed <b>${freed}</b> · eggs sent <b>${sent}</b>`, `Uwolnione <b>${freed}</b> · wysłane jajka <b>${sent}</b>`));
  }
  function renderClock() {
    if (!S) return;
    const t = now(), over = S.ph === 'end';
    setHtml($('bl-time'), S.stage === 'count' ? L('Get ready', 'Przygotuj się') : over ? clock(S.res?.ms || 0) : L(`${clock(t)} · new row in <b>${Math.ceil(nextRowIn(S.speed, t) / 1000)}</b> s`, `${clock(t)} · nowy rząd za <b>${Math.ceil(nextRowIn(S.speed, t) / 1000)}</b> s`));
    if (S.stage === 'count') {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    }
    renderBanner();
  }
  function renderBanner() {
    const el = $('bl-banner'); let msg = '', hot = false;
    const left = S.x.filter(x => !x[0]).length;
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'count') msg = L('Last one afloat wins', 'Wygrywa ostatnia osoba na wodzie');
    else if (S.me >= 0 && S.x[S.me][0]) msg = L(`You are out · ${left} still afloat`, `Koniec gry dla ciebie · na wodzie zostało: ${left}`);
    else if (S.me < 0) msg = L(`Watching ${nameOf(focus)} · ${left} still afloat`, `Oglądasz: ${nameOf(focus)} · na wodzie zostało: ${left}`);
    else if (info[S.me]?.bot) msg = L('A bot is shooting for you', 'Bot strzela za ciebie');
    else if (playing && st && st.b.length >= LIM - 1) { msg = L('Almost over the line! Pop the lowest bubbles!', 'Tuż przy linii! Zbijaj najniższe bąbelki!'); hot = true; }
    else if (playing && st && st.pend.length) { msg = L(`${cnt(st.pend.length, 'egg', 'eggs', 'jajko', 'jajka', 'jajek')} coming. Pop bubbles to knock them back!`, `Nadciągają jajka: ${st.pend.length}. Zbijaj bąbelki, żeby je odbić!`); hot = st.pend.length >= 4; }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', hot);
  }
  function render() {
    if (!S || !info) return;
    $('bl-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderMine();
    root.classList.toggle('watching', !playing);
  }

  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('bl-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.classList.add('show'); el.style.setProperty('--ms', ms + 'ms');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('Go!', 'Start!'), '', 900); sfx.turn(); idle = 0; }
    else if (e.t === 'atk') {
      scene?.attack(e.s, e.to, e.k);
      if (e.to === S.me && playing) { sfx.warn(); ctx.toast(L(`${nameOf(e.s)} sent you ${cnt(e.k, 'egg', 'eggs', 'jajko', 'jajka', 'jajek')}!`, `${nameOf(e.s)} wysyła ci jajka: ${e.k}!`)); }
    } else if (e.t === 'clean') { if (!mine) ctx.toast(L(`${nameOf(e.s)} cleared the whole lagoon!`, `${nameOf(e.s)}: cała laguna wyczyszczona!`)); }
    else if (e.t === 'out') {
      scene?.out(e.s);
      if (mine) { sfx.lose(); big(L('Out!', 'Koniec!'), L(`${ord(e.place)} place`, `${ord(e.place)} miejsce`), 2200, 'k4'); }
      else { sfx.plop(); ctx.toast(L(`${nameOf(e.s)} is out!`, `${nameOf(e.s)} odpada!`)); }
    } else if (e.t === 'end') {
      scene?.cheer(e.w);
      if (e.w === S.me) { sfx.win(); big(L('You win!', 'Wygrana!'), L('last one afloat', 'ostatnia osoba na wodzie'), 2400, 'k3'); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1900);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now(); info = s.seats;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; st = null; syncNo = -1; aim = 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    playing = s.me >= 0 && s.ph === 'play' && !!s.mine && !info[s.me]?.bot;
    if (playing) {
      const m = s.mine;
      if (!st || m.sync !== syncNo) adopt(m);
      else if (m.locks === st.locks) { // the server has caught up with every shot sent: its list of eggs is the truth
        st.pend = m.pend.map(id => ({ id }));
        if (encode(st) !== (s.b[s.me] || '') || m.dead !== st.dead || m.cur !== st.cur || m.nxt !== st.nxt) adopt(m);
      }
    } else { st = null; fly = null; }
    // who the big lagoon shows: you, or (watching) whoever is still in
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
      <p>${L(`Last one afloat after ${clock(R.ms)}`, `Ostatnia osoba na wodzie po ${clock(R.ms)}`)}</p>
      <ol class="bl-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${i === S.me ? 'bl-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong title="${L('Pets freed', 'Uwolnione zwierzaki')}">${cnt(R.freed[i], 'pet', 'pets', 'zwierzak', 'zwierzaki', 'zwierzaków')}</strong><small>${L(`${cnt(R.sent[i], 'egg', 'eggs', 'jajko', 'jajka', 'jajek')} sent`, `jajka: ${R.sent[i]}`)}${R.time[i] ? ' · ' + clock(R.time[i]) : ''}</small>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
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
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
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
      if (++t < 200 && !destroyed) requestAnimationFrame(stepC); else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    stepC();
  }

  // ----- input: point to aim (mouse or finger), let go to shoot; the bubble marked "Next" swaps -----
  let aiming = false;
  const onNext = e => frame && Math.hypot(e.clientX - frame.next.x, e.clientY - frame.next.y) < Math.max(28, frame.px * .6);
  const point = e => { const r = scene?.aimAt(e.clientX, e.clientY); if (r && !r.below) aim = r.a; return r; };
  canvas.addEventListener('pointermove', e => { if (canPlay() && (aiming || e.pointerType === 'mouse')) point(e); });
  canvas.addEventListener('pointerdown', e => {
    if (!canPlay() || e.button > 0) return;
    e.preventDefault();
    if (onNext(e)) { swap(); return; }
    aiming = true; try { canvas.setPointerCapture(e.pointerId); } catch {}
    point(e);
  });
  canvas.addEventListener('pointerup', e => {
    if (!aiming) return; aiming = false;
    const r = point(e);
    if (r && !r.below) fire(); // let go under the launcher: no shot
  });
  canvas.addEventListener('pointercancel', () => { aiming = false; });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); swap(); });
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire', Enter: 'fire', ArrowDown: 'swap', KeyS: 'swap', KeyC: 'swap', ShiftLeft: 'swap', ShiftRight: 'swap' };
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEYMAP[e.code]; if (!k) return;
    if (!root.querySelector('.results').hidden) return;
    e.preventDefault();
    const down = e.type === 'keydown';
    if (k === 'left' || k === 'right') held[k] = down;
    else if (down && !e.repeat) { if (k === 'fire') fire(); else swap(); }
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { held.left = held.right = false; aiming = false; };
  addEventListener('blur', onBlur);

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
    b.blur?.(); // so Space shoots the next bubble instead of pressing this button again
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
