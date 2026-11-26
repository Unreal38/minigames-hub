// Blast Bay game view: walks your own avatar round the maze (rules.js does the stepping), plants pop seeds and kicks
// them through the server, and draws the HUD over the 3D isle: the round and the clock, who is still standing, your
// boosts, the shouts, the joystick and seed button on phones, and the results.
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { Q, OPEN, ELS, EL_COL, BOON, ARENAS, START, SPD_STEP, CRUMBLE_S, steer, faceOf } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  seed: SV('<path d="M12 21c-4 0-6.5-2.6-6.5-6.2C5.5 10.8 9 8 12 8s6.5 2.8 6.5 6.8C18.5 18.4 16 21 12 21z"/><path d="M12 8c0-2 1-3.6 3-4.6M12 8c-.4-1.8-1.6-3-3.4-3.4"/>', 34),
  star: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.5 9.3l6.6-.8z" fill="#ffd34d" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`; };
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./blast.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="bb${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L('Blast Bay. Walk with W A S D or the arrow keys, Space plants a pop seed.', 'Zatoka Bum. Chodź klawiszami W A S D albo strzałkami, spacja sadzi nasiono.')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bb-round"></span><span class="chip" id="bb-time"></span></div>
      <div class="tr"><span class="tcode" id="bb-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="banner" id="bb-banner" aria-live="polite"></div>
      <div class="shout" id="bb-big" aria-live="assertive"></div>
      <ol class="list" id="bb-list" aria-label="${L('Players', 'Gracze')}"></ol>
      <div class="bb-stats" id="bb-stats" aria-label="${L('Your boosts', 'Twoje wzmocnienia')}"></div>
      <button type="button" class="bb-seed" data-a="seed" id="bb-seed">${I.seed}<span>${L('Seed', 'Nasiono')}</span>${touch ? '' : '<kbd>Space</kbd>'}</button>
      <div class="bb-joy" id="bb-joy" aria-hidden="true"><i></i></div>
      <p class="keys" id="bb-keys">${L('Walk <b>W A S D</b> or arrows · plant a seed <b>Space</b>', 'Chodź <b>W A S D</b> albo strzałkami · sadź nasiono <b>spacją</b>')}</p>
    </div>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bb'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, recvAt = 0;
  let grid = null, built = '', tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, roundKey = '', snapN = -1, sentAt = 0, sent = '', kickAt = 0;
  const me = { x: 0, y: 0, f: 0, moving: false, on: false };
  const keys = new Set(); let joy = null, keyOrder = [];
  const planted = new Map(); // tiles I planted on, until the server's seed shows up: key -> time

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { frame: onFrame });
    sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const standing = i => !!(S?.a?.[i]?.[3] & 1);
  const playing = () => S && S.me >= 0 && S.ph === 'play' && info?.[S.me] && !info[S.me].bot;
  const canWalk = () => playing() && S.stage === 'play' && standing(S.me);
  const sinceRecv = () => performance.now() - recvAt;

  // the maze as the server last sent it, and the tiles you may step on
  function free(x, y) {
    if (!grid || x < 0 || y < 0 || x >= S.w || y >= S.h || grid[y * S.w + x] !== OPEN) return false;
    for (const b of S.b || []) if (Math.round(b[1] / Q) === x && Math.round(b[2] / Q) === y && !b[5]) return planted.has(x + ',' + y) && Math.abs(me.x - x) < .8 && Math.abs(me.y - y) < .8;
    return true;
  }
  const seedAt = (x, y) => (S.b || []).find(b => Math.round(b[1] / Q) === x && Math.round(b[2] / Q) === y);

  function sync() {
    if (!scene || !S || !info || !grid) return;
    const key = S.gid + ':' + S.round;
    if (built !== key) { built = key; scene.build(S.arena, S.w, S.h, grid); }
    scene.setSeats(info.map(p => ({ color: p.color, av: p.av })), S.me);
    scene.snapPlayers(S.a);
    scene.setSeeds(S.b || [], performance.now());
    scene.setItems(S.it || []);
    scene.setFalls(S.fall || []);
    scene.setGrid(grid);
  }

  // ----- your own walking, every frame -----
  let lastStep = 0;
  function step() {
    const now = performance.now(), dt = Math.min(.1, lastStep ? (now - lastStep) / 1000 : 1 / 60); lastStep = now;
    if (!S || !scene || !me.on) return;
    me.moving = false;
    if (canWalk()) {
      let ix = 0, iy = 0;
      if (joy) { ix = joy[0]; iy = joy[1]; }
      else { const k = keyOrder[keyOrder.length - 1]; if (k && MOVE[k]) [ix, iy] = MOVE[k]; }
      const spd = S.my?.spd || START.spd;
      const went = steer(me, ix, iy, spd * dt, free);
      if (went) { me.f = faceOf(went[0], went[1]); me.moving = true; }
      else if (ix || iy) tryKick(ix, iy, now);
      const msg = Math.round(me.x * Q) + ',' + Math.round(me.y * Q) + ',' + me.f;
      if (msg !== sent && now - sentAt > 90) { sentAt = now; sent = msg; ctx.act({ t: 'p', x: Math.round(me.x * Q), y: Math.round(me.y * Q), f: me.f }); }
    }
    scene.setMine({ x: me.x, y: me.y, f: me.f, moving: me.moving });
    for (const [k, t] of planted) if (now - t > 3500) planted.delete(k);
  }
  // walking into a seed with the Stone boost kicks it
  function tryKick(ix, iy, now) {
    if (!S.my?.kick || now - kickAt < 300) return;
    const dx = Math.abs(ix) >= Math.abs(iy) ? Math.sign(ix) : 0, dy = dx ? 0 : Math.sign(iy);
    const cx = Math.round(me.x), cy = Math.round(me.y), b = seedAt(cx + dx, cy + dy);
    if (!b || Math.abs(me.x - cx) > .1 || Math.abs(me.y - cy) > .1) return;
    kickAt = now; ctx.act({ t: 'k', id: b[0], dx, dy }); sfx.thunk();
  }
  function plant() {
    if (!canWalk()) return;
    const x = Math.round(me.x), y = Math.round(me.y), my = S.my || {};
    if (seedAt(x, y) || planted.has(x + ',' + y)) return;
    if ((my.out || 0) + [...planted.keys()].filter(k => !seedAt(...k.split(',').map(Number))).length >= (my.max || 1)) { ctx.toast(L('All your seeds are planted. Wait for one to pop.', 'Wszystkie nasiona już posadzone. Poczekaj, aż któreś pęknie.')); return; }
    planted.set(x + ',' + y, performance.now());
    ctx.act({ t: 'b', x, y }); scene?.localSeed(x, y); sfx.place();
  }

  // ----- each frame: name tags, the clock -----
  function onFrame(folk) {
    step();
    if (!S || !info) return;
    for (let i = 0; i < tagEls.length; i++) {
      const f = folk[i], el = tagEls[i]; if (!f || !el) continue;
      const show = f.on && i !== S.me;
      if (!show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${f.sx.toFixed(1)}px, ${f.sy.toFixed(1)}px) translate(-50%, -100%)`;
    }
    renderClock();
  }
  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="bb-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b></div>`).join('');
    tagEls = [...tagsEl.children];
  }

  // ----- HUD -----
  const stars = i => { const w = S.wins[i] || 0; return '★'.repeat(Math.min(w, S.goal)) + '☆'.repeat(Math.max(0, S.goal - w)); };
  function renderList() {
    setHtml($('bb-list'), info.map((p, i) => `<li class="${i === S.me ? 'bb-me ' : ''}${standing(i) ? '' : 'out'}">${avatarHtml(p.color, p.av, 24)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><em aria-label="${cnt(S.wins[i] || 0, 'round win', 'round wins', 'wygrana runda', 'wygrane rundy', 'wygranych rund')}">${stars(i)}</em></li>`).join(''));
  }
  function renderStats() {
    const my = S.my, el = $('bb-stats');
    if (!my || S.ph !== 'play') { setHtml(el, ''); return; }
    const sp = Math.round((my.spd - START.spd) / SPD_STEP) + 1;
    const chip = (elm, txt, on = true) => `<span class="${on ? '' : 'off'}"><i style="background:${EL_COL[elm]}"></i>${txt}</span>`;
    setHtml(el, chip('Tide', L(`Seeds ${my.max}`, `Nasiona ${my.max}`)) + chip('Ember', L(`Reach ${my.range}`, `Zasięg ${my.range}`)) + chip('Spark', L(`Speed ${sp}`, `Szybkość ${sp}`))
      + chip('Stone', L('Kick', 'Kopnięcie'), my.kick) + chip('Leaf', L('Bubble', 'Bańka'), my.shield));
  }
  function renderClock() {
    if (!S) return;
    const tm = $('bb-time');
    if (S.stage === 'play') {
      const t = S.t + sinceRecv(), crumbling = S.crumble && t >= CRUMBLE_S * 1000;
      setHtml(tm, `${crumbling ? `<i>${L('Crumbling', 'Kruszy się')} </i>` : ''}<b>${clock(t)}</b>`); tm.classList.toggle('hurry', crumbling);
    } else if (S.stage === 'count') setHtml(tm, `<i>${L('Get ready', 'Przygotuj się')} </i><b>${Math.max(1, Math.ceil((S.left - sinceRecv()) / 1000))}</b>`);
    else setHtml(tm, '');
    renderBanner();
  }
  function renderBanner() {
    const el = $('bb-banner'); let msg = '';
    if (S.ph !== 'play') msg = '';
    else if (S.me < 0) msg = L('You’re watching', 'Oglądasz');
    else if (S.stage === 'over') msg = S.last >= 0 ? L(`Round to ${info[S.last]?.name || ''}`, `Runda dla: ${info[S.last]?.name || ''}`) : L('A draw round', 'Runda bez zwycięzcy');
    else if (!standing(S.me)) msg = L('Caught! Watch the rest of the round', 'Złapany! Popatrz na resztę rundy');
    else if (S.stage === 'count') msg = ARENAS[S.arena]?.name || '';
    if (el.textContent !== msg) el.textContent = msg;
    const seedB = $('bb-seed'), on = canWalk() || (playing() && S.stage === 'count' && standing(S.me));
    if (seedB.hidden === on) seedB.hidden = !on;
    const left = Math.max(0, (S.my?.max || 1) - (S.my?.out || 0));
    seedB.classList.toggle('off', left === 0);
  }
  function render() {
    if (!S || !info) return;
    setHtml($('bb-round'), S.ph === 'play' ? `<i>${L('Round', 'Runda')} </i><b>${S.round}</b><small> · ${L(`first to ${S.goal}`, `do ${S.goal} wygranych`)}</small>` : '');
    $('bb-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderStats();
    root.classList.toggle('watching', S.me < 0);
    $('bb-joy').hidden = !touch || !playing();
  }
  function big(text, sub = '', ms = 1400, color = '') {
    const el = $('bb-big');
    el.innerHTML = `<b${color ? ` style="color:${color}"` : ''}>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'r') { big(L(`Round ${e.r}`, `Runda ${e.r}`), ARENAS[e.arena]?.name || '', 2200); sfx.draw(); }
    else if (e.t === 'go') { big(L('Go!', 'Start!'), '', 900); sfx.turn(); }
    else if (e.t === 'pl') { if (!mine) sfx.land(); }
    else if (e.t === 'x') { scene?.blast(e.c); sfx.boom(); }
    else if (e.t === 'k') { if (!mine) sfx.thunk(); }
    else if (e.t === 'sh') { scene?.pop(e.s); if (mine) { big(L('Saved!', 'Uratowany!'), L('Your leaf bubble popped', 'Twoja listkowa bańka pękła'), 1400, '#8fe07a'); sfx.plop(); } }
    else if (e.t === 'p') {
      scene?.boon(e.s, e.el);
      if (mine) { ctx.toast(`${e.sp ? esc(spName(e.sp)) + ': ' : ''}${BOON[ELS[e.el]]}`); sfx.set(); } else sfx.pop();
    } else if (e.t === 'c') {
      scene?.caught(e.s);
      if (mine) { big(e.fell ? L('You fell!', 'Spadasz!') : L('Caught!', 'Złapany!'), e.fell ? L('The ground gave way', 'Ziemia się osunęła') : e.by === S.me ? L('By your own seed', 'Twoim własnym nasionem') : e.by >= 0 ? L(`By ${nameOf(e.by)}'s seed`, `Nasiono: ${nameOf(e.by)}`) : '', 1800); sfx.lose(); }
      else { ctx.toast(e.fell ? L(`${nameOf(e.s)} fell off the edge`, `${nameOf(e.s)} spada z krawędzi`) : e.by === S.me ? L(`You caught ${nameOf(e.s)}!`, `Łapiesz: ${nameOf(e.s)}!`) : L(`${nameOf(e.s)} got caught`, `${nameOf(e.s)} – złapany`)); sfx.pop(); }
    } else if (e.t === 'cr') { big(L('The edge is crumbling!', 'Krawędź się kruszy!'), L('Head for the middle', 'Uciekaj do środka'), 1800, '#ffb547'); sfx.warn(); }
    else if (e.t === 'w') {
      if (e.s === S.me) { big(L('You take the round!', 'Wygrywasz rundę!'), stars(S.me), 2600); sfx.win(); scene?.cheer(e.s); }
      else if (e.s >= 0) { big(L(`${nameOf(e.s)} takes the round`, `Rundę wygrywa ${nameOf(e.s)}`), stars(e.s), 2600); sfx.turn(); scene?.cheer(e.s); }
      else { big(L('Nobody left!', 'Nikt nie został!'), L('A draw round', 'Runda bez zwycięzcy'), 2400); sfx.turn(); }
    } else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1400); }
  }
  let spNames = null;
  import('../farm/data.js').then(m => { spNames = m.SPECIES; }).catch(() => {});
  const spName = sp => spNames?.[sp]?.name || '';

  function adopt() {
    const a = S.a?.[S.me]; if (!a) { me.on = false; return; }
    me.x = a[0] / Q; me.y = a[1] / Q; me.f = a[2] & 3; me.on = true; sent = ''; planted.clear();
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now();
    if (s.seats) info = s.seats;
    if (s.g) grid = Uint8Array.from(s.g, c => +c);
    if (!info) return;
    if (fresh) { gid = s.gid; hideResults(); clearTimeout(resultsTimer); roundKey = ''; snapN = -1; lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0; if (s.ph === 'end') showResults(); }
    // a new round (or the server says we are off): take your place from the server
    const key = s.gid + ':' + s.round + ':' + (s.me >= 0 && info[s.me]?.bot ? 'b' : '');
    if (key !== roundKey) { roundKey = key; if (s.me >= 0) adopt(); else me.on = false; }
    if (s.my && s.my.snap !== snapN) { if (snapN >= 0) adopt(); snapN = s.my.snap; }
    if (s.me >= 0 && info[s.me]?.bot) adopt(); // away: a bot walks you, follow it
    if (s.me >= 0 && !standing(s.me)) me.on = !!S.a?.[s.me];
    if (fresh && s.ph === 'play' && s.stage === 'count') big(L(`Round ${s.round}`, `Runda ${s.round}`), ARENAS[s.arena]?.name || '', 2200);
    render(); sync();
    if (!fresh) { for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); } }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = R.order[0];
    el.innerHTML = `<div class="sheet">
      <h2>${I.star}${R.place[S.me] === 1 ? L('You win Blast Bay!', 'Wygrywasz Zatokę Bum!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${cnt(S.round, 'round', 'rounds', 'runda', 'rundy', 'rund')}</p>
      <ol class="bb-podium">${R.order.map(i => { const p = info[i];
        const bits = [L(`lasted past ${cnt(R.surv[i], 'player', 'players')}`, `przetrwanych graczy: ${R.surv[i]}`), R.boons[i] ? L(`${cnt(R.boons[i], 'pet', 'pets')} freed`, `uwolnione zwierzaki: ${R.boons[i]}`) : ''].filter(Boolean).join(' · ');
        return `<li class="${i === S.me ? 'bb-me' : ''}${R.place[i] === 1 ? ' won' : ''}" style="animation-delay:${R.order.indexOf(i) * 90}ms"><em>${R.place[i]}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${cnt(R.wins[i], 'round win', 'round wins', 'wygrana runda', 'wygrane rundy', 'wygranych rund')}</strong><small>${bits}</small>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
    if (R.place[S.me] === 1) scene?.cheer(S.me);
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
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top - 10 : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  // ----- input -----
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.type === 'keydown' && !e.repeat && (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter')) { if (playing()) { plant(); e.preventDefault(); } return; }
    if (!MOVE[e.code]) return;
    e.preventDefault();
    if (e.type === 'keydown') { if (!keys.has(e.code)) { keys.add(e.code); keyOrder.push(e.code); } }
    else { keys.delete(e.code); keyOrder = keyOrder.filter(k => k !== e.code); }
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); keyOrder = []; joy = null; };
  addEventListener('blur', onBlur);
  const joyEl = $('bb-joy'), knob = joyEl.firstChild; let joyId = null;
  const joyMove = e => { const r = joyEl.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } knob.style.transform = `translate(${(x * R * .62).toFixed(1)}px,${(y * R * .62).toFixed(1)}px)`; joy = l < .22 ? [0, 0] : [x, y]; };
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joyEl.setPointerCapture(joyId); joyEl.classList.add('on'); joyMove(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy = null; knob.style.transform = ''; joyEl.classList.remove('on'); };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  canvas.draggable = false; for (const ev of ['dragstart', 'selectstart', 'contextmenu']) canvas.addEventListener(ev, e => e.preventDefault());
  // the seed button plants on press (not on release), so a quick thumb is never late
  $('bb-seed').addEventListener('pointerdown', e => { e.preventDefault(); plant(); });

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
  root.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .round'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover(); });

  return {
    update,
    room(r) { Rm = r; if (S) { render(); sync(); } paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', onBlur);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
