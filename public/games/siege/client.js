// Sugar Siege game view: the HUD over the 3D island (whose turn, the clock, the wind, the teams), the slingshot aim
// (drag from your pet, pull back, let go), walking and jumping, the snack tray, the name tags with fullness bars,
// and the results. The server plays the match (server/games/siege.js); this page draws it and sends what you do.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { seasonLookNow } from '../../season3d.js';
import * as R from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  left: SV('<path d="M15 5l-7 7 7 7"/>', 30), right: SV('<path d="M9 5l7 7-7 7"/>', 30), jump: SV('<path d="M5 18c2-8 7-12 14-12"/><path d="M14 4l5 2-2 5"/>', 30),
  star: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.5 9.3l6.6-.8z" fill="#ffd34d" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
const secs = ms => Math.max(0, Math.ceil(ms / 1000));

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./siege.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches, season = seasonLookNow();
  app.innerHTML = `<div class="sg${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L('Sugar Siege. Drag back from your pet and let go to throw. A and D walk, W jumps, 1 to 9 pick a snack.', 'Słodkie Oblężenie. Przeciągnij od swojego zwierzaka do tyłu i puść, żeby rzucić. A i D chodzenie, W skok, 1–9 wybór przekąski.')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <svg class="sg-aim" aria-hidden="true"><circle id="sg-ring" r="0" fill="none" stroke="#ffffffb0" stroke-width="3" stroke-dasharray="6 7"/><line id="sg-band0" stroke="#2b2230" stroke-width="8" stroke-linecap="round"/><line id="sg-band" stroke="#ffc93c" stroke-width="4" stroke-linecap="round"/></svg>
    <div class="hud">
      <div class="tl"><span class="chip" id="sg-round"></span><span class="chip" id="sg-time"></span><span class="chip" id="sg-wind"></span></div>
      <div class="tr"><span class="tcode" id="sg-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="banner" id="sg-banner" aria-live="polite"></div>
      <div class="shout" id="sg-big" aria-live="assertive"></div>
      <ol class="list" id="sg-list" aria-label="${L('Teams', 'Drużyny')}"></ol>
      <div class="sg-walk" id="sg-walk">
        <button type="button" data-w="-1" aria-label="${L('Walk left', 'Idź w lewo')}">${I.left}</button>
        <button type="button" data-a="jump" aria-label="${L('Jump', 'Skok')}">${I.jump}</button>
        <button type="button" data-w="1" aria-label="${L('Walk right', 'Idź w prawo')}">${I.right}</button>
      </div>
      <div class="sg-tray" id="sg-tray" role="toolbar" aria-label="${L('Snacks', 'Przekąski')}"></div>
      <div class="sg-sinfo" id="sg-sinfo" aria-live="polite" hidden></div>
      <p class="keys" id="sg-keys"></p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.sg'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, pinfo = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, recvAt = 0;
  let tagEls = [], tagKey = '', petsKey = '', seatsKey = '', resultsTimer = 0, bigTimer = 0, snack = 'pie', aimSentAt = 0, tideSaid = false;
  let aiming = null, walkD = 0, walkSentAt = 0;
  const keys = new Set();

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { season, frame: onFrame });
    if (S) sync(true);
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const petName = i => esc(pinfo?.[i]?.[4] || '');
  const mySeat = () => (S && S.me >= 0 && info?.[S.me] && !info[S.me].bot ? S.me : -1);
  const myTurn = () => S && S.ph === 'play' && mySeat() >= 0 && S.turn === S.me && (S.stage === 'aim' || S.stage === 'retreat') && S.pets?.[S.ap]?.[4] === 0;
  const canThrow = () => myTurn() && S.stage === 'aim';
  const leftMs = () => S && S.left >= 0 ? Math.max(0, S.left - (performance.now() - recvAt)) : -1;
  // the snacks a team can have: the basics, plus the element snacks its pets bring
  const teamSnacks = t => { const els = new Set((pinfo || []).filter(p => p[0] === t).map(p => R.elementOf(p[1]))); return R.SNACK_KEYS.filter(k => R.BASIC.includes(k) || els.has(R.SNACKS[k].el)); };

  function sync(force) {
    if (!scene || !S || !info) return;
    const sk = JSON.stringify(info.map(p => [p.color, p.av]));
    if (sk !== seatsKey || force) { seatsKey = sk; scene.setSeats(info); }
    if (pinfo) { const pk = S.gid + JSON.stringify(pinfo); if (pk !== petsKey || force) { petsKey = pk; scene.setPets(pinfo, info.map((_, t) => R.teamCol(t))); } }
    if (S.hs && S.ops) { if (force || S.gid !== scene._gid || !scene.addOps(S.ops)) { scene.setWorld(S.hs, S.ops); scene._gid = S.gid; } }
    scene.snap(S);
  }

  // ----- each frame: tags, the aim, walking -----
  function onFrame(pets) {
    if (!S || !pinfo) return;
    for (let i = 0; i < tagEls.length; i++) {
      const p = pets[i], el = tagEls[i]; if (!p || !el) continue;
      if (!p.on) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      const tf = `translate(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px) translate(-50%, -100%)`;
      if (el._tf !== tf) { el._tf = tf; el.style.transform = tf; } // only touch the page when a tag moved
    }
    // the slingshot band while you pull, the arc for everyone else's aim
    const band = $('sg-band'), band0 = $('sg-band0'), ring = $('sg-ring');
    if (aiming && canThrow()) {
      const v = aimVec();
      if (v) {
        for (const b of [band, band0]) { b.setAttribute('x1', v.sx); b.setAttribute('y1', v.sy); b.setAttribute('x2', aiming.x); b.setAttribute('y2', aiming.y); }
        ring.setAttribute('cx', v.sx); ring.setAttribute('cy', v.sy); ring.setAttribute('r', v.full);
        band.setAttribute('stroke', v.pw > .94 ? '#ff6b6b' : '#ffc93c');
        root.classList.add('aiming'); scene?.arc(S.ap, snack, v.a, v.pw, R.ARC_DOTS[S.arc] ?? 9);
        const now = performance.now(); if (now - aimSentAt > 150) { aimSentAt = now; ctx.act({ t: 'aim', a: +v.a.toFixed(3), p: +v.pw.toFixed(3), k: snack }); }
      } else { root.classList.remove('aiming'); scene?.arc(-1); }
    } else {
      root.classList.remove('aiming');
      if (S.aim && S.stage === 'aim' && !(S.turn === S.me && mySeat() >= 0)) scene?.arc(S.ap, S.aim.k, S.aim.a, S.aim.pw, R.ARC_DOTS[S.arc] ?? 9);
      else scene?.arc(-1);
    }
    // walking: held buttons or keys, repeated so the server keeps you moving
    const d = myTurn() && !aiming ? (walkBtn || ((keys.has('KeyA') || keys.has('ArrowLeft')) ? -1 : 0) + ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0)) : 0;
    const now = performance.now();
    if (d !== walkD || (d && now - walkSentAt > 350)) { if (d || walkD) ctx.act({ t: 'in', d }); walkD = d; walkSentAt = now; }
    renderClock();
  }
  let walkBtn = 0;

  function aimVec() {
    if (!aiming || !scene || !S) return null;
    const p = scene.petAt(S.ap); if (!p) return null;
    const [sx, sy] = scene.project(p.x, p.y + .5);
    const dx = sx - aiming.x, dy = sy - aiming.y, len = Math.hypot(dx, dy), r = canvas.getBoundingClientRect(), full = Math.min(r.width, r.height) * .34;
    if (len < 6) return null;
    return { a: Math.atan2(-dy, dx), pw: Math.min(1, len / full), sx, sy, full }; // pull back: the snack flies the other way
  }

  function buildTags() {
    const key = S.gid + (pinfo || []).map(p => p[4]).join('|') + S.ap + S.stage + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = (pinfo || []).map((p, i) => `<div class="sg-tag${i === S.ap && (S.stage === 'aim' || S.stage === 'retreat') ? ' act' : ''}${p[0] === S.me && mySeat() >= 0 ? ' mine' : ''}" style="--tc:${R.teamCol(p[0])}" hidden><span class="z"><i>Z</i><i>Z</i><i>Z</i></span><b>${p[0] === S.me && mySeat() >= 0 ? '<s>★</s>' : ''}${esc(p[4])}</b><i class="bar"><u></u></i></div>`).join('');
    tagEls = [...tagsEl.children]; paintTags();
  }
  function paintTags() {
    S.pets?.forEach((a, i) => { const el = tagEls[i]; if (!el) return;
      const u = el.querySelector('u'), w = a[3] + '%'; if (u.style.width !== w) { u.style.width = w; u.style.background = a[3] > 75 ? '#ff3d6b' : a[3] > 45 ? '#ffaa1f' : '#3fbf55'; }
      el.classList.toggle('zz', a[4] > 0); });
  }

  // ----- HUD -----
  function renderList() {
    const order = info.map((_, i) => i);
    setHtml($('sg-list'), order.map(t => {
      const p = info[t], mine = (S.pets || []).map((a, i) => [a, i]).filter(([, i]) => pinfo?.[i]?.[0] === t);
      const up = mine.filter(([a]) => a[4] === 0).length;
      const dots = mine.map(([a]) => `<i class="pd${a[4] ? ' zz' : ''}" style="--f:${a[4] ? 100 : a[3]}%"></i>`).join('');
      return `<li class="${t === S.me ? 'sg-me ' : ''}${S.out?.[t] ? 'out ' : ''}${t === S.turn && S.ph === 'play' ? 'now' : ''}" style="--tc:${R.teamCol(t)}"><i class="tm" aria-hidden="true"></i>${avatarHtml(p.color, p.av, 24)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><span class="pds" title="${L(`${up} awake`, `nie śpi: ${up}`)}">${dots}</span></li>`;
    }).join(''));
  }
  function renderTray() {
    const show = canThrow() && !!pinfo;
    $('sg-tray').hidden = !show; $('sg-sinfo').hidden = !show;
    $('sg-walk').hidden = !(touch && myTurn());
    if (!show) return;
    const am = S.ammo?.[S.me] || {}, list = teamSnacks(S.me);
    if (!(am[snack] > 0)) snack = 'pie';
    setHtml($('sg-tray'), list.map((k, n) => { const c = am[k] ?? 0; return `<button type="button" class="sg-snack${k === snack ? ' on' : ''}${R.SNACKS[k].el ? ' el' : ''}" data-s="${k}" ${c > 0 ? '' : 'disabled'} title="${esc(R.snackName(k) + ': ' + R.snackHelp(k))}" aria-pressed="${k === snack}">
      <span class="em">${R.SNACKS[k].em}</span><span class="nm">${esc(R.snackShort(k))}</span><span class="n">${c >= 99 ? '∞' : c > 0 ? '×' + c : L('used', 'zużyte')}</span>${touch ? '' : `<kbd>${n + 1}</kbd>`}</button>`; }).join(''));
    // what the picked snack does, in words
    setHtml($('sg-sinfo'), `<b><span class="em">${R.SNACKS[snack].em}</span>${esc(R.snackName(snack))}</b><p>${esc(R.snackHelp(snack))}</p><ul>${R.snackFacts(snack).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`);
  }
  function renderClock() {
    if (!S) return;
    const left = leftMs(), tm = $('sg-time');
    setHtml(tm, left >= 0 && S.ph === 'play' ? `<b>${secs(left)}</b>` : '');
    tm.classList.toggle('hurry', S.stage === 'aim' && left >= 0 && left < 6000);
    renderBanner();
  }
  function renderBanner() {
    const el = $('sg-banner'); let msg = '';
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'intro') msg = L('Overfeed the other teams’ pets!', 'Przekarm zwierzaki innych drużyn!');
    else if (S.stage === 'aim') msg = S.turn === S.me && mySeat() >= 0 ? L(`Your turn: ${petName(S.ap)}`, `Twoja kolej: ${petName(S.ap)}`) : L(`${nameOf(S.turn)}: ${petName(S.ap)}`, `Kolej: ${nameOf(S.turn)} (${petName(S.ap)})`);
    else if (S.stage === 'fly') msg = L('Incoming snack!', 'Leci przekąska!');
    else if (S.stage === 'retreat') msg = S.turn === S.me && mySeat() >= 0 ? L('Run for cover!', 'Uciekaj w bezpieczne miejsce!') : L(`${nameOf(S.turn)} runs for cover`, `Ucieczka: ${nameOf(S.turn)}`);
    if (el.textContent !== msg) el.textContent = msg;
  }
  function renderWind() {
    const w = S.wind || 0, n = Math.ceil(Math.abs(w) * 3), arrows = Math.abs(w) < .05 ? '·' : (w < 0 ? '◀' : '▶').repeat(n);
    setHtml($('sg-wind'), `<i>${L('Wind', 'Wiatr')} </i><b>${arrows}</b>`);
  }
  function render() {
    if (!S || !info) return;
    setHtml($('sg-round'), S.ph === 'play' ? `<i>${L('Round', 'Runda')} </i><b>${S.round}</b>${S.round > R.TIDE_ROUND ? `<em>${L('tide', 'przypływ')}</em>` : ''}` : '');
    $('sg-code').textContent = Rm?.code || '';
    renderWind(); buildTags(); paintTags(); renderList(); renderTray();
    root.classList.toggle('watching', mySeat() < 0);
    root.classList.toggle('myturn', !!myTurn());
    $('sg-keys').innerHTML = touch || !myTurn() ? '' : L('Walk <b>A D</b> · jump <b>W</b> · snacks <b>1–9</b> · drag back from your pet to throw · drag elsewhere to look, scroll to zoom', 'Chodzenie <b>A D</b> · skok <b>W</b> · przekąski <b>1–9</b> · przeciągnij od zwierzaka do tyłu, żeby rzucić · przeciągnij gdzie indziej, żeby się rozejrzeć, kółko przybliża');
  }

  function big(text, sub = '', ms = 1400, color = '') {
    const el = $('sg-big');
    el.innerHTML = `<b${color ? ` style="color:${color}"` : ''}>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function pop(x, y, text, cls = '') {
    if (!scene) return;
    const [sx, sy] = scene.project(x, y), el = document.createElement('div');
    el.className = 'sg-pop ' + cls; el.textContent = text; el.style.left = sx + 'px'; el.style.top = sy + 'px';
    tagsEl.append(el); setTimeout(() => el.remove(), 1150);
  }
  const petXY = i => { const a = S.pets?.[i]; return a ? [a[0] / 100, a[1] / 100] : [0, 0]; };

  function playEv(e) {
    if (e.t === 'turn') {
      if (e.s === S.me && mySeat() >= 0) { big(L('Your turn!', 'Twoja kolej!'), L(`${petName(e.p)} · drag back from it and let go`, `${petName(e.p)} · przeciągnij od niego do tyłu i puść`), 1700); sfx.turn(); if (navigator.vibrate) try { navigator.vibrate(40); } catch {} }
      scene?.follow(); aiming = null;
    } else if (e.t === 'throw') { sfx.whoosh(); }
    else if (e.t === 'splash') {
      scene?.splash(e); sfx.plop(); if (e.k === 'cake') sfx.boom();
      const f = R.SNACKS[e.k];
      if (f.grow) pop(e.x, e.y + .8, L('Sprout!', 'Wyrasta!'));
      else if (f.bridge) pop(e.x, e.y + .8, L('Candy bridge!', 'Cukrowy most!'));
      else pop(e.x, e.y + .6, e.k === 'cake' ? L('SPLAT!!', 'CHLUP!!') : e.k === 'mini' ? L('pop', 'pyk') : L('SPLAT!', 'CHLUP!'), e.k === 'cake' ? 'big' : '');
      for (const [i, got] of e.hits || []) if (got > 0) { const [x, y] = petXY(i); setTimeout(() => pop(x, y + 1.6, '+' + got, 'num'), 120); }
      const teams = new Set((e.hits || []).filter(h => h[1] > 0).map(h => pinfo?.[h[0]]?.[0])); if (teams.size && !teams.has(S.turn)) scene?.cheer(S.turn);
    } else if (e.t === 'plop') { scene?.plop(e); sfx.plop(); }
    else if (e.t === 'crash' || e.t === 'sea') {
      const [x, y] = petXY(e.p), t = pinfo?.[e.p]?.[0];
      if (e.t === 'crash') { scene?.crash(e.p); setTimeout(() => pop(x, y + 2, L('Sugar crash!', 'Cukrowy zjazd!'), 'big'), 350); }
      else { scene?.seaNap(e.p); pop(x, S.water + 1.4, L('Splash! Napping on a float', 'Plusk! Drzemka na kółku'), 'big'); }
      scene?.cheer(t, true);
      if (t === S.me && mySeat() >= 0) sfx.bad(); else sfx.set();
    } else if (e.t === 'late') { if (e.s === S.me) ctx.toast(L('Out of time! Your turn passes.', 'Koniec czasu! Kolej przechodzi dalej.')); }
    else if (e.t === 'run') { if (S.turn === S.me && mySeat() >= 0) sfx.tick(); }
    else if (e.t === 'tide') { if (!tideSaid) { tideSaid = true; big(L('Sugar tide!', 'Słodki przypływ!'), L('The sea rises a block every turn', 'Morze podnosi się o klocek co turę'), 2400, '#7fd1e8'); sfx.warn(); } }
    else if (e.t === 'out') { ctx.toast(L(`${nameOf(e.s)}: every pet is asleep`, `${nameOf(e.s)}: wszystkie zwierzaki śpią`)); }
    else if (e.t === 'end') { scene?.win(e.w); clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1800); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    if (fresh && !s.seats) return; // wait for the full picture of a new match
    S = s; recvAt = performance.now();
    if (s.seats) info = s.seats;
    if (s.info) pinfo = s.info;
    if (!info) return;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); tideSaid = s.round > R.TIDE_ROUND; snack = 'pie'; aiming = null;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'intro') big(L('Sugar Siege!', 'Słodkie Oblężenie!'), L('Overfeed the other teams’ pets until they doze off', 'Przekarm zwierzaki innych drużyn, aż zasną'), 2400);
    }
    render(); sync(fresh);
    if (!fresh) { for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); } }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), Rs = S.res, w = Rs.order[0];
    const meWon = mySeat() >= 0 && Rs.place[S.me] === 1;
    el.innerHTML = `<div class="sheet">
      <h2>${I.star}${meWon ? L('Your team wins Sugar Siege!', 'Twoja drużyna wygrywa Słodkie Oblężenie!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${cnt(S.round, 'round', 'rounds', 'runda', 'rundy', 'rund')}</p>
      <ol class="sg-podium">${Rs.order.map((t, n) => { const p = info[t], st = Rs.st[t];
        const bits = [Rs.awake[t] ? L(`${Rs.awake[t]} awake`, `nie śpi: ${Rs.awake[t]}`) : L('all asleep', 'wszystkie śpią'), L(`fed ${st.hits}%`, `nakarmione: ${st.hits}%`)].join(' · ');
        return `<li class="${t === S.me ? 'sg-me' : ''}${Rs.place[t] === 1 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${Rs.place[t]}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${t === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${cnt(Rs.awake[t], 'pet awake', 'pets awake', 'zwierzak nie śpi', 'zwierzaki nie śpią', 'zwierzaków nie śpi')}</strong><small>${bits}</small>${paidHtml(Rm, t)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
    if (meWon) { confetti(); sfx.win(); } else if (mySeat() >= 0) sfx.lose();
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
    const t = info.findIndex(p => p.id === m.id), list = $('sg-list').children[t];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = list ? list.getBoundingClientRect() : null;
    const x = r ? r.right + 30 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top + r.height / 2 : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 32}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.setTransform(q, 0, 0, q, 0, 0);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#7ed957'];
    const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
    let t = 0;
    const stepC = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (++t < 200 && !destroyed) requestAnimationFrame(stepC); else cv.width = cv.height = 0;
    };
    stepC();
  }

  // ----- input -----
  function jump() { if (myTurn()) ctx.act({ t: 'jump', d: walkBtn || ((keys.has('KeyA') || keys.has('ArrowLeft')) ? -1 : 0) + ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0) }); } // the way you hold
  function pick(k) { if (!canThrow() || !(S.ammo?.[S.me]?.[k] > 0)) return; snack = k; sfx.click(); renderTray(); }
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.type === 'keydown' && !e.repeat) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') { jump(); e.preventDefault(); return; }
      const n = /^Digit([1-9])$/.exec(e.code); if (n && S && mySeat() >= 0) { const k = teamSnacks(S.me)[+n[1] - 1]; if (k) pick(k); return; }
    }
    if (!['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(e.code); else keys.delete(e.code);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); walkBtn = 0; aiming = null; };
  addEventListener('blur', onBlur);
  // walk buttons (phones): hold to walk
  for (const b of root.querySelectorAll('[data-w]')) {
    b.addEventListener('pointerdown', e => { e.preventDefault(); walkBtn = +b.dataset.w; b.classList.add('held'); try { b.setPointerCapture(e.pointerId); } catch {} });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { if (walkBtn === +b.dataset.w) walkBtn = 0; b.classList.remove('held'); });
  }
  // the island: a drag that starts on your pet aims, any other drag looks round; two fingers or the wheel zoom
  const pts = new Map(); let pan = null, pinch = 0;
  canvas.draggable = false; for (const ev of ['dragstart', 'selectstart', 'contextmenu']) canvas.addEventListener(ev, e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { aiming = null; pan = null; const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); return; }
    if (canThrow() && scene) {
      const p = scene.petAt(S.ap), [sx, sy] = p ? scene.project(p.x, p.y + .5) : [-1e4, 0], r = canvas.getBoundingClientRect();
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < Math.max(70, r.height * .09)) { aiming = { id: e.pointerId, x: e.clientX, y: e.clientY }; walkBtn = 0; return; }
    }
    pan = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointermove', e => {
    const was = pts.get(e.pointerId); if (!was) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) scene?.zoom(pinch / d); pinch = d; return; }
    if (aiming && aiming.id === e.pointerId) { aiming.x = e.clientX; aiming.y = e.clientY; return; }
    if (pan) { scene?.pan(e.clientX - was[0], e.clientY - was[1]); }
  });
  const up = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) pan = null;
    if (aiming && aiming.id === e.pointerId) {
      const v = aimVec(); aiming = null; scene?.arc(-1); root.classList.remove('aiming');
      if (v && v.pw > .08 && canThrow()) { ctx.act({ t: 'throw', k: snack, a: +v.a.toFixed(4), p: +v.pw.toFixed(4) }); sfx.whoosh(); }
      else if (canThrow()) ctx.act({ t: 'aim', a: 0, p: 0, k: snack });
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); if (aiming?.id === e.pointerId) { aiming = null; scene?.arc(-1); } pan = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); scene?.zoom(e.deltaY > 0 ? 1.1 : .9); }, { passive: false });

  root.addEventListener('click', e => {
    const s = e.target.closest('[data-s]'); if (s && !s.disabled) { pick(s.dataset.s); return; }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'jump') jump();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .round, .sg-snack'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover(); });

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
