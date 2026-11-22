// Beanstalk Bounce game view: moves your climber in the browser (the physics in tower.js), reports it to the
// server, and draws the HUD over the 3D climb: floor, score, streak meter, the race up the stalk, touch pads and results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { buildTower, newClimber, stepClimber, stormY, newRun, land, expire, streakPts, cheer, zoneOf, zoneName, floorAt, PACES, FLOOR_H, STREAK_MS, SPRING } from './tower.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  left: SV('<path d="M15 5l-7 7 7 7"/>', 34), right: SV('<path d="M9 5l7 7-7 7"/>', 34), up: SV('<path d="M5 14l7-7 7 7"/>', 30),
  leaf: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 20c0-10 6-16 16-16 0 10-6 16-16 16z" fill="#7ed067" stroke="#3b2219" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 19l9-9" stroke="#3b2219" stroke-width="2" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M13 2L5 14h5l-1 8 8-12h-5z" fill="#ffe36b" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
};
import { ord } from '../../i18n.js';

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./bean.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="bb${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L(`The beanstalk climb. Run with the arrow keys or A and D, jump with Space.`, `Wspinaczka po łodydze fasoli. Biegnij strzałkami albo klawiszami A i D, skacz spacją.`)}"></canvas>
    <div class="bb-vig" aria-hidden="true"></div>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bb-floor"></span><span class="chip" id="bb-score"></span></div>
      <div class="tr"><span class="tcode" id="bb-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="bb-banner" aria-live="polite"></div>
      <div class="shout" id="bb-big" aria-live="assertive"></div>
      <ol class="list" id="bb-list" aria-label="${L(`Who is highest`, `Kto jest najwyżej`)}"></ol>
      <div class="bb-alt" id="bb-alt" aria-hidden="true"><i class="bb-storm"></i><div class="bb-dots"></div></div>
      <div class="bb-streak" id="bb-streak" hidden><b></b><span></span><i><u></u></i></div>
      <div class="pads" id="bb-pads">
        <div class="steer"><button type="button" data-k="left" aria-label="${L(`Run left`, `Biegnij w lewo`)}">${I.left}</button><button type="button" data-k="right" aria-label="${L(`Run right`, `Biegnij w prawo`)}">${I.right}</button></div>
        <div class="acts"><button type="button" data-k="jump" aria-label="${L(`Jump`, `Skok`)}">${I.up}<span>${L(`Jump`, `Skok`)}</span></button></div>
      </div>
      <p class="keys" id="bb-keys">${L(`Run <b>← →</b> or <b>A D</b> · jump <b>Space</b> · the faster you run, the higher you jump`, `Bieg <b>← →</b> albo <b>A D</b> · skok <b>Spacja</b> · im szybciej biegniesz, tym wyżej skaczesz`)}</p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bb'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, T = null, mk = null, run = newRun(), climbing = false, dead = false;
  let recvAt = 0, sentAt = 0, goLocal = Infinity, tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, lastCount = 99, lastZone = 0, warnAt = 0, altKey = '', altDots = [], lastHud = 0;
  const keys = new Set(), pads = new Set();
  const clock = () => (goLocal === Infinity ? -9 : (performance.now() - goLocal) / 1000);

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, step, clock });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const leader = () => (S ? S.place.find(i => !S.out[i]) ?? S.place[0] ?? 0 : 0);

  function sync() {
    if (!scene || !S || !info) return;
    scene.setTower(S.seed, S.pace); scene.setSeats(info); scene.setMe(S.me); scene.watch(leader());
  }

  // ----- your climber: moved here every frame -----
  function controls() {
    const lf = keys.has('left') || pads.has('left'), R = keys.has('right') || pads.has('right');
    return { dir: (R ? 1 : 0) - (lf ? 1 : 0), jump: keys.has('jump') || pads.has('jump') };
  }
  let lastStep = 0;
  function step() {
    const now0 = performance.now(), dt = Math.min(.25, lastStep ? (now0 - lastStep) / 1000 : 1 / 60); lastStep = now0;
    if (!S || !scene || !T) return;
    climbing = S.me >= 0 && S.ph === 'play' && info?.[S.me] && !info[S.me].bot && !S.out[S.me] && !dead;
    if (!climbing || !mk) { scene.mine(null); return; }
    const t = clock();
    if (S.stage === 'count' || t < 0) { scene.mine(mk); return; }
    const inp = controls(), n = Math.max(1, Math.ceil(dt / (1 / 60) - .01)), h = dt / n;
    for (let q = 0; q < n; q++) {
      const ts = t - dt + q * h, cue = stepClimber(T, mk, inp, h, ts);
      let streak = 0;
      if (mk.landed >= 0) streak = landed(mk.landed, (ts + h) * 1000);
      if (cue) { scene.cue(cue, mk, streak); sound(cue, streak); }
    }
    const ms = t * 1000, b = expire(run, ms); if (b) banked(b);
    scene.mine(mk); scene.streak(run.st ? run.st.n : 0);
    // the storm
    const gap = mk.y - stormY(S.pace, t);
    if (gap < -.15) { dead = true; ctx.act({ t: 'p', x: +mk.x.toFixed(2), y: +mk.y.toFixed(2), vx: 0, vy: 0, on: mk.on, fc: mk.face }); ctx.act({ t: 'd' }); scene.mine(null); return; }
    root.classList.toggle('danger', gap < 7);
    if (gap < 7 && now0 - warnAt > (gap < 3.5 ? 300 : 650)) { warnAt = now0; sfx.warn(); }
    if (now0 - sentAt > 95) {
      sentAt = now0;
      ctx.act({ t: 'p', x: +mk.x.toFixed(2), y: +mk.y.toFixed(2), vx: +mk.vx.toFixed(2), vy: +mk.vy.toFixed(2), on: mk.on, fc: mk.face });
    }
  }
  // I landed on floor f: count it here for the meter, and tell the server, which keeps the real score
  function landed(f, ms) {
    if (floorAt(T, f).kind === SPRING) scene.bounce(f, ms / 1000);
    if (f === run.last) return 0;
    const r = land(run, f, ms);
    ctx.act({ t: 'l', f, x: +mk.x.toFixed(2), m: Math.round(ms) });
    if (r.ended) banked(r.ended);
    const z = zoneOf(run.best);
    if (z > lastZone) { lastZone = z; sfx.set(); big(zoneName(z), L('Floor ', 'Piętro ') + z * 25, 1800); }
    return r.big && run.st ? run.st.n : 0;
  }
  function banked(b) {
    if (!b.pts) return;
    sfx.set(); big('+' + b.pts, L(`${cheer(b.fl)} ${b.n} big jumps, ${b.fl} floors`, `${cheer(b.fl)} Wielkie skoki: ${b.n}, piętra: ${b.fl}`), 1500);
  }
  function sound(cue, streak) {
    if (cue === 'jump') sfx.pop(); else if (cue === 'spring') sfx.join(); else if (cue === 'wall') sfx.tick(); else if (cue === 'drop') sfx.plop();
    else if (cue === 'land') { if (streak) sfx.draw(); else sfx.place(); }
  }
  // take the climber over from what the server has (the start, or coming back after a bot climbed for you)
  function adopt() {
    const p = S.k[S.me]; if (!p) return;
    mk = newClimber(0, 1);
    Object.assign(mk, { x: p[0], y: p[1], vx: p[2], vy: p[3], on: p[4], face: p[5] });
    run = newRun(); run.last = p[4] >= 0 ? p[4] : Math.max(0, Math.floor(p[1] / FLOOR_H)); run.best = S.fl[S.me] || 0; lastZone = zoneOf(run.best);
  }

  function onFrame(fr) {
    if (!S || !info) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = fr.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
      if (el._off !== t.off) { el._off = t.off; el.classList.toggle('bb-off', !!t.off); el.querySelector('em').textContent = t.off > 0 ? '▲' : t.off < 0 ? '▼' : ''; }
    }
    const now = performance.now();
    if (now - lastHud < 50) return; lastHud = now;
    renderLive(fr);
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="bb-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<em></em><u></u></div>`).join('');
    tagEls = [...tagsEl.children];
  }

  // ----- HUD -----
  function renderList() {
    setHtml($('bb-list'), S.place.map((i, n) => {
      const p = info[i], out = S.out[i];
      return `<li class="${i === S.me ? 'bb-me' : ''}${out ? ' bb-out' : ''}"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 26)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><span>${out ? I.bolt : ''}${S.sc[i]}</span></li>`;
    }).join(''));
  }
  // things that change every moment: the streak meter, the height bar, the countdown
  function renderLive(fr) {
    const t = clock(), me = S.me;
    const myFloor = climbing && mk ? run.best : me >= 0 ? S.fl[me] : S.fl[leader()];
    setHtml($('bb-floor'), `${L(`${I.leaf} Floor <b>${myFloor}</b>`, `${I.leaf} Piętro <b>${myFloor}</b>`)}`);
    setHtml($('bb-score'), me >= 0 ? `${L(`<b>${S.sc[me]}</b> pts`, `<b>${S.sc[me]}</b> pkt`)}` : '');
    const sk = $('bb-streak'), st = climbing ? run.st : null;
    if (st) {
      sk.hidden = false;
      setHtml(sk.querySelector('b'), L(`Streak ×${st.n}`, `Seria ×${st.n}`));
      setHtml(sk.querySelector('span'), st.n >= 2 ? L(`${st.fl} floors · +${streakPts(st)}`, `piętra: ${st.fl} · +${streakPts(st)}`) : L(`${st.fl} floors · keep going!`, `piętra: ${st.fl} · tak trzymaj!`));
      sk.querySelector('u').style.transform = `scaleX(${Math.max(0, Math.min(1, (st.until - t * 1000) / STREAK_MS)).toFixed(3)})`;
      sk.classList.toggle('hot', st.n >= 2);
    } else if (!sk.hidden) sk.hidden = true;
    // the height bar: the storm at the bottom, everyone's dot on the way up
    const ys = S.k.map((k, i) => (i === me && climbing && mk ? mk.y : k[1])), sy = fr.storm;
    const top = Math.max(sy + 70, ...ys.filter((_, i) => !S.out[i])) + 6, lo = sy - 8, span = top - lo;
    $('bb-alt').querySelector('.bb-storm').style.height = `${((sy - lo) / span * 100).toFixed(1)}%`;
    for (let i = 0; i < altDots.length; i++) { const d = altDots[i]; if (!d) continue; d.hidden = !!S.out[i]; d.style.bottom = `${(Math.max(0, Math.min(1, (ys[i] - lo) / span)) * 100).toFixed(1)}%`; }
    // tags pinned to the edge say how many floors away that climber is
    for (let i = 0; i < tagEls.length; i++) { const el = tagEls[i]; if (!el || el.hidden || !el._off) continue; const d = Math.round(ys[i] / FLOOR_H) - Math.round((me >= 0 ? ys[me] : fr.camY) / FLOOR_H), u = el.querySelector('u'), tx = (d > 0 ? '+' : '') + d; if (u.textContent !== tx) u.textContent = tx; }
    if (S.stage === 'count') { const n = Math.ceil(-t); if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); } }
    renderBanner(t);
  }
  function renderBanner(t) {
    const el = $('bb-banner'); let msg = '';
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'count') msg = L(`${PACES[S.pace]?.name || ''} storm · climb as high as you can`, `${PACES[S.pace]?.name || ''} burza · wspinaj się jak najwyżej`);
    else if (S.me >= 0 && (S.out[S.me] || dead)) msg = L(`The storm got you on floor ${S.fl[S.me]}. Watching ${info[leader()]?.name || ''}`, `Burza dopadła cię na piętrze ${S.fl[S.me]}. Oglądasz: ${info[leader()]?.name || ''}`);
    else if (S.me < 0) msg = L(`Watching ${info[leader()]?.name || ''} climb`, `Oglądasz wspinaczkę: ${info[leader()]?.name || ''}`);
    else if (t < 2.2) msg = L('The storm is waking up…', 'Burza się budzi…');
    if (el.textContent !== msg) el.textContent = msg;
  }
  function buildAlt() {
    const key = info.map(p => p.color).join() + S.me;
    if (key === altKey) return; altKey = key;
    const box = $('bb-alt').querySelector('.bb-dots');
    box.innerHTML = info.map((p, i) => `<span class="${i === S.me ? 'bb-mine' : ''}" style="background:${p.color}"></span>`).join('');
    altDots = [...box.children];
  }
  function render() {
    if (!S || !info) return;
    $('bb-code').textContent = Rm?.code || '';
    buildTags(); buildAlt(); renderList();
    root.classList.toggle('watching', S.me < 0 || !!S.out[S.me] || dead);
    if (!climbing) root.classList.remove('danger');
    $('bb-pads').hidden = S.me < 0 || !!S.out[S.me] || S.ph !== 'play';
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('bb-big');
    el.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    scene?.event(e);
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('GO!', 'START!'), '', 900); sfx.turn(); }
    else if (e.t === 'out') {
      if (mine) { dead = true; sfx.lose(); big(L('Zapped!', 'Trafienie!'), L(`The storm caught you on floor ${e.f}`, `Burza dopadła cię na piętrze ${e.f}`), 2200); }
      else { sfx.plop(); ctx.toast(L(`The storm caught ${nameOf(e.s)} on floor ${e.f}`, `Burza dopadła gracza ${nameOf(e.s)} na piętrze ${e.f}`)); }
    } else if (e.t === 'streak') { if (!mine && e.pts >= 150) ctx.toast(L(`${nameOf(e.s)}: ${e.n} big jumps in a row, +${e.pts}`, `${nameOf(e.s)}: ${e.n} wielkich skoków z rzędu, +${e.pts}`)); }
    else if (e.t === 'zone') { if (!mine) ctx.toast(L(`${nameOf(e.s)} is first to ${esc(zoneName(e.z))}!`, `${nameOf(e.s)} jako pierwszy zdobywa strefę ${esc(zoneName(e.z))}!`)); }
    else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1500); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, now = performance.now();
    S = s; recvAt = now;
    if (s.seats) info = s.seats;
    if (!info) return;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; mk = null; dead = false; goLocal = Infinity; run = newRun(); lastZone = 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      root.classList.remove('danger');
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    // the race clock: the update that arrived fastest tells us best when the server said GO
    goLocal = Math.min(goLocal, now - s.t);
    T = buildTowerOnce(s.seed);
    const was = climbing;
    if (s.me >= 0 && s.out[s.me]) dead = true;
    climbing = s.me >= 0 && s.ph === 'play' && !info[s.me]?.bot && !s.out[s.me] && !dead;
    if (climbing && (!mk || !was)) adopt();
    if (!climbing) mk = null;
    render(); sync(); scene?.snap(S);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }
  let towerSeed = null, tower = null;
  function buildTowerOnce(seed) { if (seed !== towerSeed) { towerSeed = seed; tower = buildTower(seed); } return tower; }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win;
    el.innerHTML = `<div class="sheet">
      <h2>${I.leaf}${L(`${w === S.me ? 'You climbed' : `${nameOf(w)} climbed`} the highest!`, `${w === S.me ? 'Jesteś najwyżej!' : `Najwyżej jest ${nameOf(w)}!`}`)}</h2>
      ${L(`<p>Floor ${R.floor[w]} · `, `<p>Piętro ${R.floor[w]} · `)}${esc(zoneName(zoneOf(R.floor[w])))}</p>
      <ol class="bb-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${i === S.me ? 'bb-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34)}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          ${L(`<strong>${R.score[i]} pts</strong><small>floor ${R.floor[i]}${R.bonus[i] ? ` · streaks +${R.bonus[i]}` : ''}</small>`, `<strong>${R.score[i]} pkt</strong><small>piętro ${R.floor[i]}${R.bonus[i] ? ` · serie +${R.bonus[i]}` : ''}</small>`)}${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Climb again', 'Wspinaj się jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
    if (w === S.me) { confetti(); sfx.win(); }
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Climb again', 'Wspinaj się jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S || !info) return;
    const i = info.findIndex(p => p.id === m.id), t = tagEls[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = t && !t.hidden ? t.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top - 10 : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#7ed957'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
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

  // ----- input -----
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(k); else keys.delete(k);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); pads.clear(); };
  addEventListener('blur', onBlur);
  const padsEl = $('bb-pads');
  const press = (e, on) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    e.preventDefault();
    if (on) { pads.add(b.dataset.k); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} } else { pads.delete(b.dataset.k); b.classList.remove('on'); }
  };
  padsEl.addEventListener('pointerdown', e => press(e, true));
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) padsEl.addEventListener(t, e => press(e, false));
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
