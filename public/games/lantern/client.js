// Lantern Night's page: the 3D island (scene3d.js) with the lantern's darkness, name tags, the chore list and chores,
// the action buttons, the island map, meetings with voting, the ferry and the results.
// Your own player walks here (scene3d.js) and the server checks every chore, lull, ring and vote.
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { myBurst } from '../../winfx.js';
import { uiz } from '../../uiz.js';
import { SPECIES } from '../farm/data.js';
import { EL_PL } from '../../lang/farm-pl.js';
import { PL } from '../../i18n.js';
import { STATIONS, spotOf, LOGS, ROPES, BELL, REACH, LULL_REACH, REPORT_REACH, R_WALK, SIZE_WORD } from './layout.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const near = (m, x, z, r) => !!m && Math.hypot(m.x - x, m.z - z) <= r;
const elName = el => (PL ? EL_PL[el] || el : el);
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  map: SV('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  view: SV('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  lantern: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 4h6M12 2v2" stroke="#3b2219" stroke-width="2" stroke-linecap="round"/><path d="M7 7h10l-1 12H8z" fill="#ffd34d" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><path d="M6 7h12M7 19h10" stroke="#3b2219" stroke-width="2.2" stroke-linecap="round"/><path d="M12 10c1.6 1.6 1.6 4 0 5.4-1.6-1.4-1.6-3.8 0-5.4z" fill="#ff8a3c"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3c-4 0-6 3-6 7 0 3-2 5-2 6h16c0-1-2-3-2-6 0-4-2-7-6-7z" fill="#f2b92e" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="19" r="2.2" fill="#3b2219"/></svg>',
};
const ROLE = { isle: () => L('Islander', 'Wyspiarz'), sneak: () => L('Sneak', 'Łasuch') };
const SIDE = { isle: () => L('Islanders', 'Wyspiarze'), sneak: () => L('Sneaks', 'Łasuchy') };
const WHY = {
  ferry: () => L('Every Sneak left on the ferry.', 'Wszystkie Łasuchy odpłynęły promem.'),
  chores: () => L('The islanders finished every chore.', 'Wyspiarze skończyli wszystkie prace.'),
  many: () => L('The Sneaks are as many as the islanders still awake.', 'Łasuchów jest tyle, ilu wyspiarzy jeszcze nie śpi.'),
  'ferry-gone': () => L('Nobody tied the ferry in time: it drifted away.', 'Nikt nie zdążył przywiązać promu: odpłynął.'),
  empty: () => L('Too few players were left at the table.', 'Przy stole zostało za mało graczy.'),
};

let cssLoaded = false;
function loadCss() { if (cssLoaded) return; cssLoaded = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./lantern.css', import.meta.url).href; document.head.append(l); }

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="ln${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L('The island at dusk. Walk with the arrow keys or WASD, Space does the action.', 'Wyspa o zmierzchu. Chodź strzałkami albo WASD, Spacja wykonuje akcję.')}"></canvas>
    <div class="ln-dark" id="ln-dark" aria-hidden="true"></div>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl">
        <button type="button" class="chip ln-role" id="ln-role" aria-label="${L('Your card: press and hold to look', 'Twoja karta: przytrzymaj, żeby zerknąć')}"></button>
        <span class="chip ln-bar" id="ln-bar"><span class="ln-barl">${L('Chores', 'Prace')}</span><i><u id="ln-barf"></u></i></span>
        <span class="chip ln-alert" id="ln-alert" hidden></span>
      </div>
      <div class="tr"><span class="tcode" id="ln-code"></span>
        <button type="button" class="round" data-a="view" id="ln-view" hidden aria-label="${L('Reset the view', 'Przywróć widok')}">${I.view}</button>
        <button type="button" class="round" data-a="map" aria-label="${L('Island map', 'Mapa wyspy')}">${I.map}</button>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <ul class="ln-jobs" id="ln-jobs" aria-label="${L('Your chores', 'Twoje prace')}"></ul>
      <div class="banner" id="ln-banner" aria-live="polite"></div>
      <div class="shout" id="ln-big" aria-live="assertive"></div>
      <div class="ln-joy" id="ln-joy" aria-hidden="true"><i></i></div>
      <div class="ln-acts" id="ln-acts"></div>
      <p class="keys" id="ln-keys">${L('Walk <b>WASD</b> or <b>arrows</b> · action <b>Space</b> · turn <b>Q E</b> · map <b>M</b>', 'Chodzenie <b>WASD</b> lub <b>strzałki</b> · akcja <b>Spacja</b> · obrót <b>Q E</b> · mapa <b>M</b>')}</p>
      <div class="ln-map" id="ln-map" hidden></div>
      <div class="ln-job" id="ln-job" hidden></div>
    </div>
    <div class="ln-intro" id="ln-intro" hidden></div>
    <div class="ln-meet" id="ln-meet" hidden></div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ln'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), dark = $('ln-dark');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, seatsKey = '';
  let recvAt = 0, tagEls = [], bedEls = new Map(), resultsTimer = 0, bigTimer = 0, job = null, rope = -1, actKey = '', jobsKey = '', meetKey = '', votes = 0;
  const keys = new Set();

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { send: a => ctx.act(a), frame: onFrame });
    if (S) sync(true);
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const mine = () => (S && S.me >= 0 ? S.me : -1);
  const you = () => S?.you || null;
  const sneak = () => you()?.role === 'sneak';
  const outMe = () => mine() >= 0 && (S.at[mine()]?.[3] || 0) > 0;
  const ended = () => S?.ph === 'end';
  const left = () => Math.max(0, (S?.left || 0) - (performance.now() - recvAt));
  const meP = () => scene?.me();

  function sync(fresh = false) {
    if (!scene || !S || !info) return;
    const key = info.map(p => p.name + p.color + JSON.stringify(p.av)).join('|') + S.me + JSON.stringify(S.pet);
    if (fresh || key !== seatsKey) { seatsKey = key; scene.setSeats(info, S.pet, S.me); buildTags(); }
    scene.setAt(S.at, S.you?.j | 0);
    scene.setBeds(S.beds);
    scene.freeze(S.stage !== 'walk' || mine() < 0 || !!job || rope >= 0 || ended());
    scene.setView(S.stage === 'walk' || ended() ? 'walk' : 'hide');
    rings();
  }
  // gold rings on your chores still to do (Sneaks get rings on their pretend list too), white on the bell and sleepers
  function rings() {
    const y = you(), list = [];
    if (y && S.stage === 'walk') { for (const [st, done] of y.jobs) if (!done) { const [x, z] = spotOf(STATIONS[st]); list.push([x, z, '#ffd34d']); }
      if (S.mis?.k === 'dark' && !sneak() && !outMe()) { const [x, z] = spotOf(STATIONS[0]); list.push([x, z, '#ff8a3c']); }
      if (S.mis?.k === 'ropes' && !sneak() && !outMe()) for (const [x, z] of ROPES) list.push([x, z, '#ff8a3c']); }
    scene?.setRings(list);
  }

  // ---- the lantern: darkness everywhere but round you (players who are out, watchers and the end see everything)
  function paintDark() {
    const m = meP(), y = you(), on = !!(m && y && S.stage === 'walk' && !outMe() && !ended());
    dark.classList.toggle('on', on);
    if (!on) return;
    const [x, yy, ppm] = scene.project(m.x, .8, m.z), r = Math.max(40, y.glow * ppm);
    dark.style.transform = `translate(${x.toFixed(1)}px, ${yy.toFixed(1)}px) translate(-50%, -50%) scale(${(r / 100).toFixed(3)})`;
  }

  // ---- name tags over people you can see, and "Zzz" over sleepers
  function buildTags() {
    const team = new Set(you()?.team || []);
    tagsEl.innerHTML = info.map((p, i) => `<div class="ln-tag${i === S.me ? ' me' : ''}${team.has(i) && i !== S.me ? ' mate' : ''}" hidden>${team.has(i) && i !== S.me ? '<i class="ln-eye" title="Sneak"></i>' : ''}<b>${nameHtml(p.name, p.fl)}</b></div>`).join('');
    tagEls = [...tagsEl.children]; bedEls = new Map();
  }
  function onFrame(folk, me, beds) {
    if (!S || !info) return;
    for (const [s, m] of folk) { const el = tagEls[s]; if (!el) continue; const show = m.on && (S.stage === 'walk' || ended());
      if (el.hidden === show) el.hidden = !show; if (show) el.style.transform = `translate(${m.sx.toFixed(1)}px, ${m.sy.toFixed(1)}px) translate(-50%, -100%)`;
      el.classList.toggle('pet', (m.out || 0) > 0);
      if (show) { const g = dark.classList.contains('on') && m !== me && me ? you()?.glow || 0 : 0, k = g ? Math.max(0, Math.min(1, (1 - Math.hypot(m.x - me.x, m.z - me.z) / g) / .3)) : 1, o = k.toFixed(2); // tags fade out at the lantern's edge, with the people
        if (el.style.opacity !== (o === '1.00' ? '' : o)) el.style.opacity = o === '1.00' ? '' : o; } }
    for (const [s, b] of beds) { let el = bedEls.get(s); if (!el) { el = document.createElement('div'); el.className = 'ln-zzz'; el.innerHTML = `<span>Zzz</span><b>${nameOf(s)}</b>`; tagsEl.append(el); bedEls.set(s, el); }
      el.hidden = !b.on; if (b.on) el.style.transform = `translate(${b.sx.toFixed(1)}px, ${b.sy.toFixed(1)}px) translate(-50%, -100%)`; }
    for (const [s, el] of bedEls) if (!beds.has(s)) { el.remove(); bedEls.delete(s); }
    paintDark();
    if (S.stage === 'walk' && !ended()) { paintActs(); if (job && !near(meP(), ...spotOf(STATIONS[you()?.jobs[job.i]?.[0] ?? 0]), REACH + .5)) closeJob(); if (rope >= 0 && !near(meP(), ...ROPES[rope], REACH + .4)) letRope(); }
    paintMap(); paintClock();
    $('ln-view').hidden = !scene.turned();
  }

  // ---- what you can do where you stand
  function options() {
    const m = meP(), y = you(); if (!m || !y || S.stage !== 'walk' || ended()) return [];
    const out = outMe(), o = [], isSneak = sneak();
    if (!out) { const bed = S.beds.find(b => !b[3] && near(m, b[1], b[2], REPORT_REACH)); if (bed) o.push({ a: 'ring', main: true, label: L('Ring for a meeting', 'Zwołaj naradę'), sub: L(`${nameOf(bed[0])} is asleep!`, `${nameOf(bed[0])} śpi!`), cls: 'alarm' }); }
    if (!out && !isSneak && S.mis?.k === 'ropes') ROPES.forEach(([x, z], i) => { if (near(m, x, z, REACH)) o.push({ a: 'rope', i, main: true, label: rope === i ? L('Let go', 'Puść linę') : L('Hold the rope', 'Trzymaj linę'), sub: L('Two of you, both ropes at once', 'Dwie osoby, obie liny naraz'), cls: 'alarm' }); });
    if (!out && !isSneak && S.mis?.k === 'dark' && near(m, ...spotOf(STATIONS[0]), REACH)) o.push({ a: 'relight', main: true, label: L('Relight the lighthouse', 'Zapal latarnię'), cls: 'alarm' });
    y.jobs.forEach(([st, done], i) => { if (!done && near(m, ...spotOf(STATIONS[st]), REACH)) o.push({ a: 'job', i, main: true, label: STATIONS[st].job(), sub: isSneak ? L('Pretend: it fills nothing', 'Udawaj: to nic nie daje') : '' }); });
    if (!out && near(m, ...BELL, REACH)) o.push({ a: 'bell', main: true, label: L('Ring the bell', 'Zadzwoń dzwonem'), sub: y.bell ? L('Once a game: calls a meeting', 'Raz na grę: zwołuje naradę') : L('You already rang it', 'Już dzwoniono'), off: !y.bell || !!S.mis });
    if (isSneak && !out) {
      const t = target(); o.push({ a: 'lull', label: L('Lull', 'Uśpij'), sub: y.lull > 0 ? `${Math.ceil(left2(y.lull) / 1000)} s` : t >= 0 ? nameOf(t) : L('Nobody near', 'Nikogo obok'), off: t < 0 || left2(y.lull) > 0, cls: 'sneak' });
      const lg = LOGS.findIndex(([x, z]) => near(m, x, z, REACH)); if (lg >= 0) o.push({ a: 'hop', label: L('Crawl through the log', 'Przejdź przez kłodę'), off: left2(y.hop) > 0, cls: 'sneak' });
      o.push({ a: 'prank', label: L('Prank', 'Psikus'), sub: S.mis ? L('One is on', 'Już trwa') : left2(y.prank) > 0 ? `${Math.ceil(left2(y.prank) / 1000)} s` : '', off: !!S.mis || left2(y.prank) > 0, cls: 'sneak' });
    }
    return o;
  }
  const left2 = ms => Math.max(0, ms - (performance.now() - recvAt));
  function target() { // the nearest islander a Sneak could lull right now
    const m = meP(), folk = scene?.folk(); if (!m || !folk) return -1; let best = -1, bd = LULL_REACH;
    for (const [s, o] of folk) { if (s === S.me || !S.at[s] || S.at[s][3] || (you().team || []).includes(s)) continue; const d = Math.hypot(o.x - m.x, o.z - m.z); if (d <= bd) { bd = d; best = s; } }
    return best;
  }
  function paintActs() {
    const o = options(), key = JSON.stringify(o);
    if (key === actKey) return; actKey = key;
    $('ln-acts').innerHTML = o.map((b, n) => `<button type="button" class="ln-act${b.main ? ' main' : ''}${b.cls ? ' ' + b.cls : ''}" data-n="${n}"${b.off ? ' disabled' : ''}><b>${b.label}</b>${b.sub ? `<small>${b.sub}</small>` : ''}</button>`).join('');
    $('ln-acts')._o = o;
  }
  function doAct(b) {
    if (!b || b.off) return;
    if (b.a === 'job') return openJob(b.i);
    if (b.a === 'rope') { if (rope === b.i) return letRope(); rope = b.i; ctx.act({ t: 'rope', i: b.i, on: true }); sfx.click(); scene?.freeze(true); actKey = ''; return; }
    if (b.a === 'lull') { const t = target(); if (t >= 0) { ctx.act({ t: 'lull', s: t }); sfx.plop(); } return; }
    if (b.a === 'hop') { ctx.act({ t: 'hop' }); sfx.pop(); return; }
    if (b.a === 'prank') return openPrank();
    if (b.a === 'bell' || b.a === 'ring' || b.a === 'relight') { ctx.act({ t: b.a }); sfx.click(); }
  }
  function letRope() { if (rope < 0) return; ctx.act({ t: 'rope', i: rope, on: false }); rope = -1; actKey = ''; scene?.freeze(false); }
  const mainAct = () => { const o = $('ln-acts')._o || options(); doAct(o.find(b => b.main && !b.off) || o.find(b => !b.off)); };

  // ---- chores: small one-thumb jobs
  function openJob(i) {
    const st = STATIONS[you().jobs[i][0]]; job = { i, kind: st.kind, t0: performance.now(), n: 0 };
    ctx.act({ t: 'cs', i }); scene?.freeze(true); sfx.click();
    const el = $('ln-job'); el.hidden = false;
    const head = `<div class="ln-jhead"><b>${st.job()}</b><span>${st.name()}</span><button type="button" class="round sm" data-a="jclose" aria-label="${L('Close', 'Zamknij')}">×</button></div>`;
    if (st.kind === 'hold') el.innerHTML = `${head}<p>${L('Press and hold until the wheel is full.', 'Przytrzymaj, aż koło się wypełni.')}</p><button type="button" class="ln-hold" id="ln-hold"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="bg"/><circle cx="50" cy="50" r="40" class="fg" id="ln-holdc" pathLength="100"/></svg><span>${L('Hold', 'Trzymaj')}</span></button>`;
    else if (st.kind === 'taps') { const pics = st.id === 'barn' ? ['🥕', '🍎', '🌽', '🥬', '🍓', '🥜'] : ['🍪', '🧁', '🥐', '🍩', '🍬', '🥨'];
      el.innerHTML = `${head}<p>${st.id === 'barn' ? L('Tap every treat to put it in a bowl.', 'Dotknij każdego smakołyku, żeby włożyć go do miski.') : L('Tap every snack to put it on the shelf.', 'Dotknij każdej przekąski, żeby odłożyć ją na półkę.')}</p><div class="ln-taps">${pics.map((p, k) => `<button type="button" data-tap="${k}" style="--x:${(8 + (k * 37) % 76)}%;--y:${(10 + (k * 53) % 70)}%">${p}</button>`).join('')}</div>`; }
    else if (st.kind === 'seq') { const order = [1, 2, 3, 4, 5].sort(() => Math.random() - .5);
      el.innerHTML = `${head}<p>${L('Light the lamps in order: 1, 2, 3, 4, 5.', 'Zapal lampy po kolei: 1, 2, 3, 4, 5.')}</p><div class="ln-seq">${order.map(k => `<button type="button" data-seq="${k}">${I.lantern}<b>${k}</b></button>`).join('')}</div>`; }
    else { const lo = 55 + Math.random() * 20 | 0; job.lo = lo; job.hi = lo + 16;
      el.innerHTML = `${head}<p>${st.id === 'garden' ? L('Hold to pour and let go in the green band.', 'Przytrzymaj, żeby lać, i puść w zielonym pasku.') : L('Hold to pull and let go in the green band.', 'Przytrzymaj, żeby ciągnąć, i puść w zielonym pasku.')}</p><div class="ln-fill"><i style="bottom:${lo}%;height:${job.hi - lo}%"></i><u id="ln-fillv"></u></div><button type="button" class="btn m" id="ln-pour">${st.id === 'garden' ? L('Pour', 'Lej') : L('Pull', 'Ciągnij')}</button>`; }
    jobLoop();
  }
  function jobLoop() {
    if (!job) return;
    const el = $('ln-job');
    if (job.kind === 'hold') { const c = $('ln-holdc'); if (c) { job.v = Math.max(0, Math.min(1, (job.v || 0) + (job.down ? 1 / 150 : -1 / 90))); c.style.strokeDasharray = `${(job.v * 100).toFixed(1)} 100`; if (job.v >= 1) return doneJob(); } }
    if (job.kind === 'fill') { const v = $('ln-fillv'); job.v = Math.max(0, Math.min(100, (job.v || 0) + (job.down ? 1.1 : 0))); if (v) v.style.height = job.v + '%'; if (job.v >= 100) { job.v = 0; sfx.bad(); } }
    if (el && !el.hidden) requestAnimationFrame(jobLoop);
  }
  function doneJob() {
    if (!job) return;
    const i = job.i, wait = Math.max(0, 2700 - (performance.now() - job.t0)); // the server knows how long a chore takes: never send it early
    const el = $('ln-job'); el.classList.add('done'); setHtml(el, `<div class="ln-jdone">✓ ${L('Done!', 'Gotowe!')}</div>`); sfx.win?.(); job = { ...job, finished: true };
    setTimeout(() => { if (destroyed) return; ctx.act({ t: 'cd', i }); closeJob(); }, wait);
  }
  function closeJob() { const el = $('ln-job'); el.hidden = true; el.classList.remove('done'); el._h = ''; job = null; actKey = ''; if (scene && S) scene.freeze(S.stage !== 'walk' || rope >= 0); }
  $('ln-job').addEventListener('pointerdown', e => {
    if (!job || job.finished) return;
    if (e.target.closest('#ln-hold, #ln-pour')) { e.preventDefault(); job.down = true; e.target.closest('button').setPointerCapture?.(e.pointerId); }
    const tap = e.target.closest('[data-tap]'); if (tap && !tap.disabled) { tap.disabled = true; tap.classList.add('ok'); sfx.pop(); if (++job.n >= 6) doneJob(); }
    const sq = e.target.closest('[data-seq]'); if (sq && !sq.disabled) { if (+sq.dataset.seq === job.n + 1) { sq.disabled = true; sq.classList.add('ok'); sfx.set(); if (++job.n >= 5) doneJob(); } else { sfx.bad(); job.n = 0; for (const b of $('ln-job').querySelectorAll('[data-seq]')) { b.disabled = false; b.classList.remove('ok'); } } }
  });
  const upJob = () => { if (!job || !job.down) return; job.down = false; if (job.kind === 'fill') { if (job.v >= job.lo && job.v <= job.hi) doneJob(); else { sfx.bad(); job.v = 0; } } };
  $('ln-job').addEventListener('pointerup', upJob); $('ln-job').addEventListener('pointercancel', upJob);

  function openPrank() {
    const el = $('ln-job'); el.hidden = false; job = null;
    el.innerHTML = `<div class="ln-jhead"><b>${L('Pick a prank', 'Wybierz psikusa')}</b><button type="button" class="round sm" data-a="jclose" aria-label="${L('Close', 'Zamknij')}">×</button></div>
      <div class="ln-pranks"><button type="button" class="btn w" data-prank="dark">💡 <b>${L('Lighthouse out', 'Zgaś latarnię')}</b><small>${L('Islanders see much less until someone relights it', 'Wyspiarze widzą dużo mniej, póki ktoś jej nie zapali')}</small></button>
      <button type="button" class="btn w" data-prank="ropes">⛴️ <b>${L('Untie the ferry', 'Odwiąż prom')}</b><small>${L('Two islanders must hold both ropes within 40 s, or you win', 'Dwoje wyspiarzy musi złapać obie liny w 40 s, inaczej wygrywacie')}</small></button></div>`;
  }

  // ---- the island map
  function paintMap() {
    const el = $('ln-map'); if (el.hidden || !S) return;
    const R = R_WALK + 3, px = v => (v + R) / (2 * R) * 100, m = meP(), y = you();
    const todo = new Set((y?.jobs || []).filter(j => !j[1]).map(j => j[0]));
    const html = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${(R_WALK + 1) / (2 * R) * 100}" class="isle"/>
      ${STATIONS.map((st, i) => `<g class="${todo.has(i) ? 'todo' : ''}"><circle cx="${px(st.x)}" cy="${px(st.z)}" r="3.4"/><text x="${px(st.x)}" y="${px(st.z) + 7.5}">${esc(st.name())}</text></g>`).join('')}
      <circle cx="50" cy="50" r="2.4" class="fire"/>${sneak() ? LOGS.map(([x, z]) => `<circle cx="${px(x)}" cy="${px(z)}" r="1.8" class="log"/>`).join('') : ''}
      ${m ? `<circle cx="${px(m.x)}" cy="${px(m.z)}" r="2.2" class="me"/>` : ''}</svg>`;
    setHtml(el, `<div class="ln-mapbox"><button type="button" class="round sm" data-a="map" aria-label="${L('Close', 'Zamknij')}">×</button>${html}</div>`);
  }

  // ---- the chore list, the bar, the role card, alerts
  function paintJobs() {
    const y = you(); const el = $('ln-jobs');
    if (!y || ended()) { setHtml(el, ''); return; }
    setHtml(el, `<li class="ln-jt">${sneak() ? L('Pretend chores', 'Udawane prace') : L('Your chores', 'Twoje prace')}</li>${y.jobs.map(([st, done]) => `<li class="${done ? 'done' : ''}">${done ? '✓' : '•'} ${STATIONS[st].job()} <span>${STATIONS[st].name()}</span></li>`).join('')}`);
  }
  function paintTop() {
    const y = you(), [d, a] = S.bar || [0, 1];
    $('ln-barf').style.width = `${a ? d / a * 100 : 0}%`;
    $('ln-bar').setAttribute('aria-label', L(`Chores done: ${d} of ${a}`, `Zrobione prace: ${d} z ${a}`));
    const role = $('ln-role'); role.hidden = !y;
    if (y) setHtml(role, `${I.lantern}<b class="ln-peek">${outMe() ? L('Out: you are your pet now', 'Poza grą: teraz jesteś zwierzakiem') : L('Your card', 'Twoja karta')}</b><b class="ln-real">${ROLE[y.role]()}</b>`);
    role.classList.toggle('sneaky', sneak());
    const al = $('ln-alert'), mis = S.mis;
    if (mis && S.stage === 'walk') { al.hidden = false; setHtml(al, mis.k === 'dark' ? L('💡 The lighthouse is out! Relight it.', '💡 Latarnia zgasła! Zapal ją.') : `⛴️ ${L('The ferry is drifting! Hold both ropes', 'Prom odpływa! Złapcie obie liny')} <b id="ln-misT"></b>`); }
    else al.hidden = true;
  }
  function paintClock() {
    if (!S) return;
    const t = Math.ceil(left() / 1000), mt = $('ln-meetT'); if (mt) mt.textContent = t ? `${t} s` : '';
    const mi = $('ln-misT'); if (mi && S.mis?.left) mi.textContent = `${Math.ceil(Math.max(0, S.mis.left - (performance.now() - recvAt)) / 1000)} s`;
  }
  function paintBanner() {
    let msg = '';
    if (mine() < 0 && S.ph === 'play') msg = L('You are watching. Sit down for the next game.', 'Oglądasz. Usiądź do następnej gry.');
    else if (outMe() && S.stage === 'walk') msg = L('You are out: finish chores as your pet. Only other pets hear you.', 'Jesteś poza grą: dokończ prace jako zwierzak. Słyszą cię tylko inne zwierzaki.');
    const el = $('ln-banner'); if (el.textContent !== msg) el.textContent = msg;
  }

  // ---- intro card, meeting, ferry
  function paintIntro() {
    const el = $('ln-intro'), y = you();
    if (S.stage !== 'intro' || !y) { el.hidden = true; return; }
    el.hidden = false;
    const mates = (y.team || []).filter(i => i !== S.me);
    const pet = S.pet[S.me], spn = SPECIES[pet?.sp]?.name || '';
    setHtml(el, `<div class="ln-card ${y.role}"><small>${L('Your card', 'Twoja karta')}</small><h2>${ROLE[y.role]()}</h2>
      <p>${y.role === 'sneak' ? L('Lull islanders to sleep when nobody is looking, crawl through hollow logs and play pranks. Don\'t get sent away on the ferry!', 'Usypiaj wyspiarzy, gdy nikt nie patrzy, przechodź przez puste kłody i rób psikusy. Nie daj się wysłać promem!') : L('Do your chores round the island, keep your eyes open and find the Sneaks before they lull everyone.', 'Rób swoje prace na wyspie, miej oczy otwarte i znajdź Łasuchy, zanim uśpią wszystkich.')}</p>
      ${mates.length ? `<p class="ln-mates">${L('Your fellow Sneak', 'Drugi Łasuch')}: <b>${mates.map(nameOf).join(', ')}</b></p>` : ''}
      <p class="ln-pet">${L('Your pet tonight', 'Twój zwierzak na dziś')}: <b>${esc(spn)}</b> · ${elName(pet?.el)} · ${SIZE_WORD(pet?.f)}</p></div>`);
  }
  function clueText(c) {
    if (!c || !c.clue) return '';
    if (c.clue === 'el') return L(`Pawprints by the sleeper: a ${elName(c.el)} pet was here.`, `Ślady łap przy śpiochu: był tu zwierzak żywiołu ${elName(c.el)}.`);
    return L(`Pawprints by the sleeper: ${SIZE_WORD(c.f)} prints, a ${['baby', 'young', 'grown-up'][c.f]} pet.`, `Ślady łap przy śpiochu: ${SIZE_WORD(c.f)} odciski, ${['mały', 'młody', 'dorosły'][c.f]} zwierzak.`);
  }
  function paintMeet() {
    const el = $('ln-meet');
    if (S.stage !== 'meet' && S.stage !== 'ferry') { el.hidden = true; meetKey = ''; return; }
    el.hidden = false;
    const m = S.meet, me = mine(), awake = me >= 0 && !outMe(), y = you(), out = S.out;
    const key = JSON.stringify([S.stage, m, S.voted, S.last, out, y?.vote, S.pet.length]); if (key === meetKey) return; meetKey = key;
    if (S.stage === 'ferry') {
      const g = S.last?.gone ?? -1, side = S.last?.side;
      setHtml(el, `<div class="sheet ln-ferry"><h2>⛴️ ${g >= 0 ? L(`${nameOf(g)} leaves on the ferry`, `${nameOf(g)} odpływa promem`) : L('Nobody leaves this time', 'Tym razem nikt nie odpływa')}</h2>
        <p>${g < 0 ? L('A tie, or more players skipped.', 'Remis albo więcej osób wstrzymało się od głosu.') : side ? (side === 'sneak' ? L(`${nameOf(g)} was a Sneak!`, `${nameOf(g)} to Łasuch!`) : L(`${nameOf(g)} was an islander.`, `${nameOf(g)} to wyspiarz.`)) : L('Nobody knows which side they were on.', 'Nikt nie wie, po której stronie grał.')}</p>
        <ul class="ln-tally">${info.map((p, i) => S.last?.tally[i] ? `<li>${avatarHtml(p.color, p.av, 24)}<b>${nameHtml(p.name, p.fl)}</b><span>${S.last.tally[i]}</span></li>` : '').join('')}${S.last?.skip ? `<li><b>${L('Skipped', 'Wstrzymani')}</b><span>${S.last.skip}</span></li>` : ''}</ul></div>`);
      return;
    }
    const caller = m.by, clue = m.bed;
    const head = clue ? L(`${nameOf(caller)} found ${nameOf(clue.s)} asleep!`, `${nameOf(caller)} znajduje śpiącego gracza: ${nameOf(clue.s)}!`) : L(`${nameOf(caller)} rang the bell!`, `${nameOf(caller)} dzwoni dzwonem!`);
    const part = m.part === 'news' ? L('Gather round the fire…', 'Wszyscy do ogniska…') : m.part === 'talk' ? L('Talk it over. You can vote already.', 'Naradźcie się. Można już głosować.') : L('Vote now!', 'Głosujcie!');
    const team = new Set(y?.team || []);
    setHtml(el, `<div class="sheet ln-vote"><h2>${I.bell} ${head}</h2>${clue?.clue ? `<p class="ln-clue">🐾 ${clueText(clue)}</p>` : ''}
      <p class="ln-part">${part} <b id="ln-meetT"></b></p>
      <ul class="ln-who">${info.map((p, i) => { const gone = out[i] > 0, pet = S.pet[i];
        return `<li class="${gone ? 'gone' : ''}${i === me ? ' mine' : ''}${team.has(i) && i !== me ? ' mate' : ''}"><button type="button" data-vote="${i}"${!awake || gone || y?.vote !== null || m.part === 'news' ? ' disabled' : ''}>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}
          <b>${nameHtml(p.name, p.fl)}</b><small>${gone ? (out[i] === 2 ? L('left on the ferry', 'odpłynął promem') : out[i] === 3 ? L('left the table', 'odszedł od stołu') : L('asleep', 'śpi')) : `${esc(SPECIES[pet?.sp]?.name || '')} · ${elName(pet?.el)} · ${SIZE_WORD(pet?.f)}`}</small>
          ${S.voted[i] ? `<em>${L('voted', 'głos')}</em>` : ''}${y?.vote === i ? '<i>✓</i>' : ''}</button></li>`; }).join('')}</ul>
      ${awake ? `<button type="button" class="btn w sm" data-vote="-1"${y.vote !== null || m.part === 'news' ? ' disabled' : ''}>${y.vote === -1 ? '✓ ' : ''}${L('Skip the vote', 'Wstrzymaj się')}</button>` : `<p class="ln-note">${me >= 0 ? L('You are out: you can watch, but not vote.', 'Jesteś poza grą: możesz patrzeć, ale nie głosujesz.') : L('Watching', 'Oglądasz')}</p>`}
      <p class="ln-note">${L('Talk on voice, or open the chat.', 'Rozmawiajcie na głosowym albo otwórzcie czat.')}</p></div>`);
  }

  function big(text, sub = '', ms = 1800) {
    const el = $('ln-big'); el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function playEv(e) {
    if (e.t === 'go') { closeJob(); letRope(); if (S.stage === 'walk') { big(L('Off you go!', 'Do roboty!'), sneak() ? L('Lull, hop, prank', 'Usypiaj, przechodź, psikuj') : L('Chores, and eyes open', 'Prace i oczy szeroko otwarte'), 1600); sfx.turn(); } }
    else if (e.t === 'meet') { closeJob(); letRope(); sfx.warn(); }
    else if (e.t === 'voted') sfx.tick();
    else if (e.t === 'ferry') { sfx.draw(); if (e.s >= 0) scene?.sail(e.s); }
    else if (e.t === 'lull') { if (e.s === S.me) { closeJob(); letRope(); sfx.lose(); big(L('Zzz…', 'Zzz…'), L('You were lulled to sleep. Keep helping as your pet!', 'Ktoś cię uśpił. Pomagaj dalej jako zwierzak!'), 3000); } else { sfx.plop(); const b = S.beds.find(x => x[0] === e.s); if (b) scene?.burst(b[1], b[2], ['#d6d0ff', '#ffffff']); } }
    else if (e.t === 'prank') { sfx.bad(); big(e.k === 'dark' ? L('Lights out!', 'Zgasło światło!') : L('The ferry is loose!', 'Prom się odwiązał!'), e.k === 'dark' ? L('Relight the lighthouse', 'Zapalcie latarnię') : L('Two of you: hold both ropes at the dock', 'We dwoje: złapcie obie liny na przystani'), 2200); }
    else if (e.t === 'fixed') { sfx.set(); ctx.toast(e.k === 'dark' ? L('The lighthouse shines again.', 'Latarnia znów świeci.') : L('The ferry is tied up again.', 'Prom znów jest przywiązany.')); if (e.k === 'ropes') letRope(); }
    else if (e.t === 'end') { closeJob(); letRope(); clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1800); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now();
    if (s.seats) info = s.seats;
    if (!info) return;
    if (fresh) { gid = s.gid; hideResults(); clearTimeout(resultsTimer); closeJob(); rope = -1; lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0; if (s.ph === 'end') showResults(); else sfx.draw(); }
    $('ln-code').textContent = Rm?.code || '';
    const jk = JSON.stringify([S.you?.jobs, S.you?.role, outMe(), S.ph]); if (jk !== jobsKey) { jobsKey = jk; paintJobs(); actKey = ''; }
    sync(fresh); paintTop(); paintBanner(); paintIntro(); paintMeet();
    root.classList.toggle('watching', mine() < 0); root.classList.toggle('walk', S.stage === 'walk' && !ended());
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, me = mine(), won = R.side && S.role?.[me] === R.side;
    const order = info.map((_, i) => i).sort((a, b) => (S.role[b] === R.side) - (S.role[a] === R.side) || (R.out[a] > 0) - (R.out[b] > 0));
    el.innerHTML = `<div class="sheet"><h2>${I.lantern} ${R.side ? L(`${SIDE[R.side]()} win!`, `Wygrywają ${SIDE[R.side]()}!`) : L('Game over', 'Koniec gry')}</h2><p>${WHY[R.why]?.() || ''}</p>
      <ol class="ln-podium">${order.map((i, n) => { const p = info[i], w = S.role[i] === R.side;
        return `<li class="${i === me ? 'ln-me' : ''}${w ? ' won' : ''}" style="animation-delay:${n * 80}ms">${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === me ? L(' (you)', ' (ty)') : ''}</b>
          <strong class="ln-r ${S.role[i]}">${ROLE[S.role[i]]()}</strong><small>${R.out[i] === 1 ? L('lulled to sleep', 'uśpiony') : R.out[i] === 2 ? L('left on the ferry', 'odpłynął promem') : R.out[i] === 3 ? L('left the table', 'odszedł od stołu') : L('awake to the end', 'do końca na nogach')}${S.role[i] === 'isle' ? ` · ${cnt(R.chores[i], 'chore', 'chores', 'praca', 'prace', 'prac')}` : ''}</small>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
    if (won) { if (!myBurst()) scene?.shower('me'); }
  }
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length; if (n > votes) sfx.pop(); votes = n;
    box.innerHTML = againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S || !info) return;
    const i = info.findIndex(p => p.id === m.id), t = tagEls[i];
    const f = document.createElement('div'); f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = t && !t.hidden ? t.getBoundingClientRect() : null;
    f.style.left = `${(r ? r.left + r.width / 2 : innerWidth / 2) - 32}px`; f.style.top = `${(r ? r.top - 10 : innerHeight * .6) - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  // ---- walking: keys, the joystick, taps on the ground; turning with Q/E or a drag
  const KEY = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  let joy = null;
  const typing = () => !!document.activeElement?.closest?.('input, textarea, [contenteditable]');
  function pushMove() { if (!scene) return; if (joy) return scene.setMove(joy[0], joy[1]); let x = 0, z = 0; for (const k of keys) { x += KEY[k][0]; z += KEY[k][1]; } const l = Math.hypot(x, z); scene.setMove(l ? x / l : 0, l ? z / l : 0); }
  const onKey = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing()) return;
    if (e.type === 'keydown' && !e.repeat) {
      if (e.code === 'Space' || e.code === 'Enter') { if (!job && S?.stage === 'walk') { e.preventDefault(); mainAct(); } return; }
      if (e.code === 'KeyQ' || e.code === 'KeyE') { scene?.turn(e.code === 'KeyQ' ? -.18 : .18); return; }
      if (e.code === 'KeyM') { toggleMap(); return; }
      if (e.code === 'Escape') { if (!$('ln-job').hidden) closeJob(); $('ln-map').hidden = true; return; }
    }
    if (!KEY[e.code]) return;
    if (e.type === 'keydown') { e.preventDefault(); keys.add(e.code); if (rope >= 0) letRope(); } else keys.delete(e.code);
    pushMove();
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); joy = null; pushMove(); };
  addEventListener('blur', onBlur);
  const joyEl = $('ln-joy'), knob = joyEl.firstChild; let joyId = null;
  const joyMove = e => { const r = joyEl.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, z = (e.clientY - r.top - R) / R; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } knob.style.transform = `translate(${(x * R * .62 / uiz()).toFixed(1)}px,${(z * R * .62 / uiz()).toFixed(1)}px)`; joy = l < .18 ? [0, 0] : [x, z]; if (rope >= 0 && l > .5) letRope(); pushMove(); };
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joyEl.setPointerCapture(joyId); joyEl.classList.add('on'); joyMove(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy = null; knob.style.transform = ''; joyEl.classList.remove('on'); pushMove(); };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  // a drag on the island turns the view; a short tap walks there
  let drag = null;
  canvas.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch {} });
  canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true; if (drag.moved) scene?.turn(-dx * .006, dy * .003); });
  canvas.addEventListener('pointerup', e => { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (d.moved || !scene || S?.stage !== 'walk' || job) return; const g = scene.groundAt(e.clientX, e.clientY); if (g) { if (rope >= 0) letRope(); scene.walkTo(g[0], g[1]); } });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); scene?.setZoom(scene.zoom() * (e.deltaY > 0 ? .92 : 1.08)); }, { passive: false });
  for (const t of ['dragstart', 'selectstart', 'contextmenu']) canvas.addEventListener(t, e => e.preventDefault());

  // the role card: press and hold to peek (so nobody on the sofa reads it)
  const roleEl = $('ln-role');
  roleEl.addEventListener('pointerdown', e => { e.preventDefault(); roleEl.classList.add('peek'); try { roleEl.setPointerCapture(e.pointerId); } catch {} });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) roleEl.addEventListener(t, () => roleEl.classList.remove('peek'));

  function toggleMap() { const el = $('ln-map'); el.hidden = !el.hidden; el._h = ''; if (!el.hidden) paintMap(); sfx.click(); }
  root.addEventListener('click', e => {
    const act = e.target.closest('.ln-act'); if (act) { doAct($('ln-acts')._o?.[+act.dataset.n]); return; }
    const pr = e.target.closest('[data-prank]'); if (pr) { ctx.act({ t: 'prank', k: pr.dataset.prank }); closeJob(); return; }
    const v = e.target.closest('[data-vote]'); if (v && !v.disabled) { ctx.act({ t: 'vote', s: +v.dataset.vote }); sfx.click(); return; }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'jclose') { sfx.click(); closeJob(); }
    else if (a === 'map') toggleMap();
    else if (a === 'view') scene?.resetView();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .round, .ln-act'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover(); });

  return {
    update,
    room(r) { Rm = r; $('ln-code').textContent = Rm?.code || ''; paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', onBlur);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.destroy(); scene = null;
    },
  };
}
