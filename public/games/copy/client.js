// Copycat Isle game view: walks your own player (layout.js does the bumping into things), turns you into things,
// boops, sniffs and squeaks through the server, and draws the HUD over the 3D island: the clock, who is who, a
// minimap with the squeaks on it, the buttons (and a joystick on phones), and the results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { seasonLookNow } from '../../season3d.js';
import * as LY from './layout.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  copy: SV('<path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5L12 14.4 7.5 16.8l.9-5L4.8 8.3l5-.7z"/><path d="M5 20h14"/>', 30),
  boop: SV('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 17.5 4.5 15l-1-3.2a1.4 1.4 0 0 1 2.5-1.2L8 13"/>', 30),
  lock: SV('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 24),
  unlock: SV('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>', 24),
  squeak: SV('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>', 24),
  sniff: SV('<circle cx="12" cy="15" r="3.6"/><circle cx="6" cy="9.5" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="9.5" r="2"/>', 24),
  eye: SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 18),
  ghost: SV('<path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5L14 20l-2-1.5L10 20l-2-1.5z"/><circle cx="10" cy="10" r=".8" fill="currentColor"/><circle cx="14" cy="10" r=".8" fill="currentColor"/>', 18),
  hide: SV('<path d="M4 18c2-6 14-6 16 0"/><path d="M8 12.5l1-3M16 12.5l-1-3M12 11V7"/>', 18),
  seek: SV('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>', 18),
  star: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.5 9.3l6.6-.8z" fill="#ffd34d" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
const SNIFF = [
  { w: L('Cold', 'Zimno'), s: L('Nobody hiding near you', 'Nikt się tu nie chowa'), c: '#7fb6ff' },
  { w: L('Cool', 'Chłodno'), s: L('Someone is somewhere around', 'Ktoś jest gdzieś w okolicy'), c: '#7ee0d0' },
  { w: L('Warm!', 'Ciepło!'), s: L('Someone is quite close', 'Ktoś jest dość blisko'), c: '#ffb547' },
  { w: L('Hot!', 'Gorąco!'), s: L('Someone is right by you', 'Ktoś jest tuż obok'), c: '#ff5a6e' },
];
const ROLE_NAME = [L('hiding', 'chowa się'), L('seeking', 'szuka'), L('found', 'znaleziono')];
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`; };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./copy.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches, season = seasonLookNow(), winter = season === 'winter';
  app.innerHTML = `<div class="cc${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L('Copycat Isle. Walk with W A S D or the arrow keys, drag to look round, E to copy or boop.', 'Wyspa Przebierańców. Chodź klawiszami W A S D albo strzałkami, przeciągnij, żeby się rozejrzeć, E kopiuje albo pstryka.')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="cc-round"></span><span class="chip" id="cc-time"></span></div>
      <div class="tr"><span class="tcode" id="cc-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="banner" id="cc-banner" aria-live="polite"></div>
      <div class="shout" id="cc-big" aria-live="assertive"></div>
      <ol class="list" id="cc-list" aria-label="${L('Players', 'Gracze')}"></ol>
      <div class="cc-map" aria-hidden="true"><canvas id="cc-map" width="300" height="300"></canvas><span id="cc-area"></span></div>
      <div class="cc-acts" id="cc-acts">
        <button type="button" class="cc-side" data-a="lock" id="cc-lock"></button>
        <button type="button" class="cc-side" data-a="squeak" id="cc-sq"></button>
        <button type="button" class="cc-side" data-a="sniff" id="cc-sniff"></button>
        <button type="button" class="cc-main" data-a="main" id="cc-main"></button>
      </div>
      <div class="cc-joy" id="cc-joy" aria-hidden="true"><i></i></div>
      <p class="keys" id="cc-keys"></p>
    </div>
    <div class="cc-blind" id="cc-blind" hidden><div><b id="cc-count"></b><span>${L('Eyes covered! The hiders are finding their spots…', 'Oczy zakryte! Chowający szukają kryjówek…')}</span><small>${L('Your pet is sniffing the air beside you.', 'Twój zwierzak węszy obok ciebie.')}</small></div></div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.cc'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, recvAt = 0;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, petsKey = '', myKey = '', dizzyTill = 0, sentAt = 0, sent = '', aimT = null;
  const me = { x: 0, z: 0, h: 0, k: -1, lock: 0, vx: 0, vz: 0, spd: 0, on: false };
  const keys = new Set(); let joy = null;
  const pings = []; // squeaks on the minimap: [x, z, time, mine]

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { season, frame: onFrame, stage: () => S?.stage });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const myRole = () => (S && S.me >= 0 ? S.role[S.me] : -1); // 0 hiding, 1 seeking, 2 found
  const playing = () => S && S.me >= 0 && S.ph === 'play' && info?.[S.me] && !info[S.me].bot;
  const leftMs = () => S ? Math.max(0, S.left - (performance.now() - recvAt)) : 0;

  function sync() {
    if (!scene || !S || !info) return;
    scene.setSeats(info.map(p => ({ color: p.color, av: p.av })), S.me);
    const byId = new Map((Rm?.players || []).map(p => [p.id, p.pet || null]));
    const pets = info.map((p, i) => (p.id ? byId.get(p.id) : null) || (p.bot ? null : { sp: ['mossbun', 'cindercub', 'puddlepup'][i % 3], lv: 12 })), k = JSON.stringify(pets); // no isle pet yet (guests): a starter pet tags along
    if (k !== petsKey) { petsKey = k; scene.setPets(pets); }
    scene.snap(S);
  }

  // ----- your own walking, every frame -----
  let lastStep = 0;
  function step() {
    const now = performance.now(), dt = Math.min(.1, lastStep ? (now - lastStep) / 1000 : 1 / 60); lastStep = now;
    if (!S || !scene || !me.on) return;
    const role = myRole(), hide = S.stage === 'hide';
    const frozen = !playing() || (role === 1 && hide) || S.stage === 'break' || now < dizzyTill;
    let ix = 0, iz = 0;
    if (!frozen) {
      if (joy) { ix = joy[0]; iz = joy[1]; }
      else { for (const k of keys) { const d = MOVE[k]; if (d) { ix += d[0]; iz += d[1]; } } const l = Math.hypot(ix, iz); if (l) { ix /= l; iz /= l; } }
    }
    const yaw = scene.yaw(), cy = Math.cos(yaw), sy = Math.sin(yaw);
    let wx = ix * cy + iz * sy, wz = -ix * sy + iz * cy;
    const ghost = role === 2, speed = (me.k >= 0 && role === 0 ? LY.PROP_SPEED : LY.SPEED) * (ghost ? 1.25 : 1);
    const pond = LY.inPond(me.x, me.z);
    let vx = wx * speed, vz = wz * speed;
    if (pond && !ghost && winter) { const k = Math.min(1, dt * 1.6); me.vx += (vx - me.vx) * k; me.vz += (vz - me.vz) * k; vx = me.vx; vz = me.vz; } // ice: you slide
    else { if (pond && !ghost) { vx *= .55; vz *= .55; } me.vx = vx; me.vz = vz; }                                        // shallow water: you wade
    const ox = me.x, oz = me.z;
    if (vx || vz) {
      const r = me.k >= 0 && role === 0 ? Math.max(LY.BODY_R, LY.KINDS[KIND_LIST[me.k]].r * .8) : LY.BODY_R;
      let x, z;
      if (ghost) { x = Math.max(-LY.EDGE, Math.min(LY.EDGE, me.x + vx * dt)); z = Math.max(-LY.EDGE, Math.min(LY.EDGE, me.z + vz * dt)); }
      else {
        [x, z] = LY.walk(me.x, me.z, vx * dt, vz * dt, r);
        // the loose things block you too (a decoy you can walk through would give itself away)
        for (const [ox2, oz2, k] of scene.objects()) { const R = LY.KINDS[KIND_LIST[k]].r + r, dx = x - ox2, dz = z - oz2, d = Math.hypot(dx, dz); if (d < R && d > 1e-3) { x = ox2 + dx / d * R; z = oz2 + dz / d * R; } }
        if (LY.blocked(x, z, r * .7)) { x = ox; z = oz; me.vx = me.vz = 0; }
      }
      me.x = x; me.z = z;
      const went = Math.hypot(x - ox, z - oz);
      if (went > 1e-3 && !(me.lock && me.k >= 0 && role === 0) && (wx || wz)) me.h = Math.atan2(wx, wz);
      me.spd = went / Math.max(dt, 1e-3) / LY.SPEED;
    } else me.spd = 0;
    scene.setMine({ x: me.x, z: me.z, h: me.h, k: role === 0 ? me.k : -1, spd: me.spd, dizzy: now < dizzyTill ? 1 : 0 });
    // tell the server about ten times a second while something changed
    const msg = Math.round(me.x * LY.Q) + ',' + Math.round(me.z * LY.Q) + ',' + Math.round(me.h * 100);
    if (msg !== sent && now - sentAt > 100 && playing() && !(role === 1 && hide)) { sentAt = now; sent = msg; const [x, z, h] = msg.split(',').map(Number); ctx.act({ t: 'p', x, z, h }); }
    // what E would act on
    aimT = null;
    if (playing() && (S.stage === 'hide' || S.stage === 'seek')) {
      if (role === 0 && (hide || (S.my?.copies > 0))) aimT = scene.aim(me.x, me.z, LY.COPY_REACH);
      else if (role === 1 && !hide) aimT = scene.aim(me.x, me.z, LY.BOOP_REACH);
      if (aimT && role === 0 && aimT.k === me.k) aimT = null;
    }
    scene.target(aimT, role === 1 ? '#ff6f91' : '#ffd34d');
  }
  const KIND_LIST = Object.keys(LY.KINDS);
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

  // ----- acting -----
  function main(t = aimT) {
    if (!playing()) return;
    const role = myRole();
    if (!t) { ctx.toast(role === 1 ? L('Walk up to something and boop it', 'Podejdź do czegoś i pstryknij') : L('Walk up to something to copy it', 'Podejdź do czegoś, żeby to skopiować')); return; }
    const id = t.p !== undefined ? { p: t.p } : { d: t.d };
    if (role === 0) {
      if (S.stage === 'seek' && !(S.my?.copies > 0)) { ctx.toast(L('No copies left this round', 'Nie masz już kopii w tej rundzie')); return; }
      ctx.act({ t: 'copy', ...(id.p !== undefined ? { i: id.p } : { d: id.d }) });
      me.k = t.k; sfx.pop(); if (S.my && S.stage === 'seek') S.my.copies--;
      renderActs();
    } else if (role === 1 && S.stage === 'seek') {
      if (performance.now() < dizzyTill) return;
      ctx.act({ t: 'boop', ...id }); sfx.click();
    }
  }
  function tapAt(px, py) {
    if (!scene || !playing()) return;
    const t = scene.pick(px, py); if (!t) return;
    const role = myRole(), reach = role === 1 ? LY.BOOP_REACH : LY.COPY_REACH, r = LY.KINDS[KIND_LIST[t.k]].r;
    if (Math.hypot(t.x - me.x, t.z - me.z) - r > reach + .4) { ctx.toast(L('Too far away. Walk closer.', 'Za daleko. Podejdź bliżej.')); return; }
    if (role === 0 && t.k === me.k) return;
    main(t);
  }
  function lock() {
    if (!playing() || myRole() !== 0 || me.k < 0) return;
    me.lock = me.lock ? 0 : 1; ctx.act({ t: 'lock', on: !!me.lock, h: Math.round(me.h * 100) }); sfx.set();
    ctx.toast(me.lock ? L('Turn locked: you keep facing this way', 'Obrót zablokowany: patrzysz cały czas w tę stronę') : L('Turn unlocked', 'Obrót odblokowany'));
    renderActs();
  }
  function squeak() { if (!playing() || myRole() !== 0 || S.stage !== 'seek') return; if (S.my?.sqIn > performance.now() - recvAt) return; ctx.act({ t: 'sq' }); }
  function sniff() { if (!playing() || myRole() !== 1 || S.stage !== 'seek') return; if ((S.my?.sniffIn || 0) > performance.now() - recvAt) { ctx.toast(L('Your pet needs a moment to sniff again', 'Zwierzak potrzebuje chwili, żeby znów powęszyć')); return; } ctx.act({ t: 'sniff' }); }

  // ----- each frame: tags, minimap, the clock -----
  function onFrame(folk, W, H) {
    step();
    if (!S || !info) return;
    for (let i = 0; i < tagEls.length; i++) {
      const f = folk[i], el = tagEls[i]; if (!f || !el) continue;
      const show = f.on && i !== S.me && (S.role[i] === 1 || myRole() !== 1 || S.ph !== 'play');
      if (!show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${f.sx.toFixed(1)}px, ${f.sy.toFixed(1)}px) translate(-50%, -100%) scale(${Math.max(.6, Math.min(1, 14 / f.dist)).toFixed(2)})`;
    }
    drawMap(folk);
    renderClock();
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + S.me + S.role.join('');
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map((p, i) => `<div class="cc-tag${S.role[i] === 1 ? ' seek' : S.role[i] === 2 ? ' gone' : ''}" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b></div>`).join('');
    tagEls = [...tagsEl.children];
  }

  // the minimap: the island drawn once, people and squeaks on top
  const mapEl = $('cc-map'), mg = mapEl.getContext('2d'), base = document.createElement('canvas'); base.width = base.height = 300;
  const MS = 300 / (LY.SIZE * 2 + 2), mx = x => (x + LY.SIZE + 1) * MS;
  (function paintBase() {
    const g = base.getContext('2d'), R = (x1, z1, x2, z2, c) => { g.fillStyle = c; g.fillRect(mx(x1), mx(z1), (x2 - x1) * MS, (z2 - z1) * MS); };
    g.fillStyle = winter ? '#eef4fb' : '#9ad46a'; g.beginPath(); g.roundRect(mx(-LY.SIZE), mx(-LY.SIZE), LY.SIZE * 2 * MS, LY.SIZE * 2 * MS, 18); g.fill();
    const path = winter ? '#cfd6e6' : '#e8d9bd';
    R(-7, -7, 7, 7, winter ? '#c3c9da' : '#dccdb4'); R(-1.5, -22, 1.5, -7, path); R(-1.5, 7, 1.5, 13, path); R(-24, -1.5, -7, 1.5, path); R(7, -1.5, 21, 1.5, path);
    R(8, 9, 26, 25, winter ? '#e0d6c8' : '#e6d3b8');
    R(LY.HILL.x1, LY.HILL.z1, LY.HILL.x2, LY.HILL.z2, '#a8a196'); R(LY.HILL.x1 + .4, LY.HILL.z1 + .4, LY.HILL.x2 - .4, LY.HILL.z2 - .4, winter ? '#ffffff' : '#7fbf56'); R(LY.RAMP.x1, LY.RAMP.z1, LY.RAMP.x2, LY.RAMP.z2, '#b77b4a');
    R(LY.BARN.x1, LY.BARN.z1, LY.BARN.x2, LY.BARN.z2, '#d9b27a');
    g.fillStyle = winter ? '#9fd6f2' : '#6ec6f5'; g.beginPath(); g.ellipse(mx(LY.POND.x), mx(LY.POND.z), LY.POND.rx * MS, LY.POND.rz * MS, 0, 0, 6.283); g.fill();
    const LOOKC = { barn: '#c0463e', fence: '#8a5a3c', snow: winter ? '#b8c6dc' : '#8a5a3c', hedge: '#3f8c4a' };
    for (const w of LY.WALLS) { g.strokeStyle = LOOKC[w[5]]; g.lineWidth = Math.max(2, w[6] * MS); for (const [a, b] of LY.wallRuns(w)) { g.beginPath(); if (w[0] === 'x') { g.moveTo(mx(a), mx(w[3])); g.lineTo(mx(b), mx(w[3])); } else { g.moveTo(mx(w[3]), mx(a)); g.lineTo(mx(w[3]), mx(b)); } g.stroke(); } }
    g.fillStyle = '#2f7a4a'; for (const s of LY.SCENERY) if (s[0] === 'tree' || s[0] === 'pine') { g.beginPath(); g.arc(mx(s[1]), mx(s[2]), (s[0] === 'tree' ? 2.2 : 1) * MS, 0, 6.283); g.fill(); }
    g.fillStyle = '#e8a85a'; g.fillRect(mx(LY.HUT.x - 1.5), mx(LY.HUT.z - 1.5), 3 * MS, 3 * MS);
    g.fillStyle = '#ffffff'; g.fillRect(mx(19.5), mx(-22.5), 3 * MS, 3 * MS);
  })();
  function drawMap(folk) {
    mg.clearRect(0, 0, 300, 300); mg.drawImage(base, 0, 0);
    const now = performance.now(), mineRole = myRole();
    for (let n = pings.length - 1; n >= 0; n--) { const [x, z, t] = pings[n], u = (now - t) / 3200; if (u >= 1) { pings.splice(n, 1); continue; }
      mg.strokeStyle = `rgba(255, 196, 40, ${1 - u})`; mg.lineWidth = 5; mg.beginPath(); mg.arc(mx(x), mx(z), (2 + u * 5) * MS, 0, 6.283); mg.stroke(); }
    for (let i = 0; i < folk.length; i++) {
      const f = folk[i]; if (!f?.vis || !f.placed || i === S.me) continue;
      if (mineRole === 1 && S.role[i] !== 1 && S.ph === 'play') continue;
      mg.fillStyle = info[i]?.color || '#fff'; mg.strokeStyle = S.role[i] === 1 ? '#e5343b' : '#3b2219'; mg.lineWidth = 4; mg.globalAlpha = S.role[i] === 2 ? .45 : 1;
      mg.beginPath(); mg.arc(mx(f.x), mx(f.z), 7, 0, 6.283); mg.fill(); mg.stroke(); mg.globalAlpha = 1;
    }
    if (me.on && S.me >= 0) { // you: an arrow pointing the way you face
      const x = mx(me.x), z = mx(me.z), a = me.h; mg.fillStyle = '#ffffff'; mg.strokeStyle = '#3b2219'; mg.lineWidth = 4;
      mg.beginPath(); mg.moveTo(x + Math.sin(a) * 13, z + Math.cos(a) * 13); mg.lineTo(x + Math.sin(a + 2.4) * 9, z + Math.cos(a + 2.4) * 9); mg.lineTo(x + Math.sin(a - 2.4) * 9, z + Math.cos(a - 2.4) * 9); mg.closePath(); mg.stroke(); mg.fill();
    }
    const area = me.on ? LY.areaAt(me.x, me.z) : null, nm = area ? (area.id === 'fort' && !winter ? L('The fort', 'Fort') : area.name) : '';
    const el = $('cc-area'); if (el.textContent !== nm) el.textContent = nm;
  }

  // ----- HUD -----
  function renderList() {
    const order = info.map((_, i) => i).sort((a, b) => S.pts[b] - S.pts[a] || a - b);
    setHtml($('cc-list'), order.map(i => {
      const p = info[i], r = S.role[i], icon = r === 1 ? I.seek : r === 2 ? I.ghost : I.hide;
      return `<li class="${i === S.me ? 'cc-me ' : ''}r${r}"><span class="ic" title="${ROLE_NAME[r]}">${icon}</span>${avatarHtml(p.color, p.av, 24)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><em>${S.pts[i]}</em></li>`;
    }).join(''));
  }
  function renderActs() {
    const role = myRole(), on = playing() && (S.stage === 'hide' || S.stage === 'seek');
    $('cc-acts').hidden = !on || role === 2 || (role === 1 && S.stage === 'hide');
    const mainB = $('cc-main'), lockB = $('cc-lock'), sqB = $('cc-sq'), snB = $('cc-sniff'), kb = t => touch ? '' : `<kbd>${t}</kbd>`;
    if (role === 0) {
      const left = S.stage === 'seek' ? S.my?.copies ?? 0 : -1;
      setHtml(mainB, `${I.copy}<span>${L('Copy', 'Kopiuj')}</span>${left >= 0 ? `<small>${cnt(left, 'left', 'left', 'zostało', 'zostały', 'zostało')}</small>` : ''}${kb('E')}`);
      mainB.classList.toggle('off', left === 0);
      lockB.hidden = me.k < 0; setHtml(lockB, `${me.lock ? I.lock : I.unlock}<span>${me.lock ? L('Locked', 'Zablokowany') : L('Lock turn', 'Zablokuj obrót')}</span>${kb('R')}`); lockB.classList.toggle('on', !!me.lock);
      sqB.hidden = S.stage !== 'seek'; setHtml(sqB, `${I.squeak}<span>${L('Squeak', 'Pisk')} <i>+1</i></span>${kb('Q')}`);
      snB.hidden = true;
    } else {
      setHtml(mainB, `${I.boop}<span>${L('Boop', 'Pstryk')}</span>${kb('E')}`); mainB.classList.remove('off');
      lockB.hidden = true; sqB.hidden = true; snB.hidden = false;
      setHtml(snB, `${I.sniff}<span>${L('Sniff', 'Węsz')}</span>${kb('F')}`);
    }
  }
  function renderClock() {
    if (!S) return;
    const left = leftMs(), stage = S.stage, role = myRole(), now = performance.now() - recvAt;
    const tm = $('cc-time'); setHtml(tm, stage === 'hide' ? `<i>${L('Hide', 'Chowanie')} </i><b>${clock(left)}</b>` : stage === 'seek' ? `<i>${L('Seek', 'Szukanie')} </i><b>${clock(left)}</b>` : stage === 'break' ? `<i>${L('Next round', 'Następna runda')} </i><b>${clock(left)}</b>` : '');
    tm.classList.toggle('hurry', stage === 'seek' && left < 20000);
    // the seekers' blindfold
    const blind = playing() && role === 1 && stage === 'hide';
    if ($('cc-blind').hidden === blind) $('cc-blind').hidden = !blind;
    if (blind) setHtml($('cc-count'), String(Math.ceil(left / 1000)));
    // cooldowns on the buttons
    if (S.my) {
      const sq = $('cc-sq'), sn = $('cc-sniff');
      const sqW = Math.max(0, S.my.sqIn - now), snW = Math.max(0, S.my.sniffIn - now);
      sq.classList.toggle('wait', sqW > 0); sq.style.setProperty('--cd', (sqW / LY.SQUEAK_WAIT).toFixed(3));
      sn.classList.toggle('wait', snW > 0); sn.style.setProperty('--cd', (snW / (LY.SNIFF_S * 1000)).toFixed(3));
      const bonus = sq.querySelector('i'); if (bonus) bonus.hidden = S.my.sqN >= LY.SQUEAK_MAX;
    }
    renderBanner();
  }
  function renderBanner() {
    const el = $('cc-banner'), role = myRole(), st = S.stage; let msg = '';
    if (S.ph !== 'play') msg = '';
    else if (S.me < 0) msg = L('You’re watching the hunt', 'Oglądasz polowanie');
    else if (st === 'break') msg = L('Round over', 'Koniec rundy');
    else if (role === 2) msg = L('You were found! Float about and watch', 'Znaleziono cię! Unoś się i patrz');
    else if (role === 1 && st === 'hide') msg = L('Wait in the pet hut…', 'Poczekaj w budce…');
    else if (role === 1) msg = L('Find them! Boop anything that looks odd', 'Znajdź ich! Pstrykaj wszystko, co wygląda podejrzanie');
    else if (st === 'hide') msg = me.k < 0 ? L('Walk up to something and copy it', 'Podejdź do czegoś i to skopiuj') : L('Find a good spot and keep still', 'Znajdź dobre miejsce i nie ruszaj się');
    else if (S.my?.nextSq >= 0) { const s = Math.ceil(Math.max(0, S.my.nextSq - (performance.now() - recvAt)) / 1000); msg = s <= 5 ? L(`You squeak in ${s}…`, `Piśniesz za ${s}…`) : L('Keep still… they are looking', 'Nie ruszaj się… szukają cię'); }
    if (el.textContent !== msg) el.textContent = msg;
  }
  function render() {
    if (!S || !info) return;
    setHtml($('cc-round'), S.ph === 'play' ? `<i>${L('Round', 'Runda')} </i><b>${S.round + 1}</b>/${S.rounds}` : '');
    $('cc-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderActs();
    root.classList.toggle('watching', S.me < 0);
    root.classList.toggle('seeker', myRole() === 1);
    $('cc-joy').hidden = !touch || !playing();
    $('cc-keys').innerHTML = touch ? '' : myRole() === 1 ? L('Walk <b>W A S D</b> · look round: drag · boop <b>E</b> · sniff <b>F</b>', 'Chodź <b>W A S D</b> · rozglądaj się: przeciągnij · pstryk <b>E</b> · węsz <b>F</b>')
      : L('Walk <b>W A S D</b> · look round: drag · copy <b>E</b> · lock turn <b>R</b> · squeak <b>Q</b>', 'Chodź <b>W A S D</b> · rozglądaj się: przeciągnij · kopiuj <b>E</b> · blokada obrotu <b>R</b> · pisk <b>Q</b>');
  }

  function big(text, sub = '', ms = 1400, color = '') {
    const el = $('cc-big');
    el.innerHTML = `<b${color ? ` style="color:${color}"` : ''}>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function roundIntro() {
    const role = myRole(), seekers = (S.seekers || []).map(nameOf).join(L(' and ', ' i '));
    if (S.me < 0) big(L(`Round ${S.round + 1}`, `Runda ${S.round + 1}`), L(`Seeking: ${seekers}`, `Szuka: ${seekers}`), 2200);
    else if (role === 1) big(L('You seek!', 'Szukasz!'), L('Count to 30 with your pet', 'Policz do 30 ze zwierzakiem'), 2400);
    else big(L('Hide!', 'Chowaj się!'), L(`${seekers} will come looking in 30 seconds`, `Za 30 sekund szuka: ${seekers}`), 2400);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'round') { roundIntro(); sfx.draw(); }
    else if (e.t === 'seek') { big(L('Ready or not!', 'Szukam!'), myRole() === 1 ? L('Here you come', 'Ruszaj na poszukiwania') : L('Keep very still', 'Nie ruszaj się'), 1500); sfx.warn(); }
    else if (e.t === 'auto') { if (mine) ctx.toast(L('Out of time! You turned into the nearest thing.', 'Koniec czasu! Zamieniasz się w najbliższą rzecz.')); }
    else if (e.t === 'cp') { if (mine) sfx.pop(); }
    else if (e.t === 'c') {
      scene?.caught(e.x, e.z, e.by, e.k);
      if (mine) { big(L('Found!', 'Znaleziono cię!'), L(`${nameOf(e.by)} booped you`, `Pstryka cię: ${nameOf(e.by)}`), 2000); sfx.lose(); }
      else if (e.by === S.me) { big(L('Gotcha!', 'Mam cię!'), L(`It was ${nameOf(e.s)}${e.fast ? ' · fast find +2' : ''}`, `Pod spodem: ${nameOf(e.s)}${e.fast ? ' · szybko +2' : ''}`), 1800); sfx.win(); confetti(); }
      else { ctx.toast(L(`${nameOf(e.by)} found ${nameOf(e.s)}!`, `${nameOf(e.by)} znajduje: ${nameOf(e.s)}!`)); sfx.pop(); }
    } else if (e.t === 'm') {
      scene?.miss(e.s, e.x, e.z);
      if (mine) { dizzyTill = performance.now() + LY.DIZZY_MS; big(L('Dizzy!', 'Kręci się w głowie!'), L('That was just a thing', 'To była zwykła rzecz'), 1500); sfx.bad(); }
    } else if (e.t === 'sq') {
      scene?.squeak(e.x, e.z, e.own); pings.push([e.x, e.z, performance.now()]);
      const d = me.on ? Math.hypot(e.x - me.x, e.z - me.z) : 20;
      if (mine) { sfx.pop(); if (e.own) ctx.toast(L('Squeak! +1 for being brave', 'Pisk! +1 za odwagę')); }
      else if (d < 26) { sfx.tick(); if (d < 12) sfx.pop(); }
    } else if (e.t === 'sn') {
      const v = SNIFF[e.lv] || SNIFF[0]; scene?.sniffed(S.me, e.lv); big(v.w, v.s, 1800, v.c); sfx.set();
    } else if (e.t === 'over') {
      big(e.all ? L('Everyone found!', 'Wszyscy znalezieni!') : L('Time’s up!', 'Koniec czasu!'), e.all ? L('The seekers win the round', 'Rundę wygrywają szukający') : L('The hiders who kept still score extra', 'Kto się utrzymał, dostaje bonus'), 2400);
      sfx.turn();
    } else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1600); }
  }

  function adopt() {
    const a = S.a?.[S.me];
    if (!a) { me.on = false; return; }
    me.x = a[0] / LY.Q; me.z = a[1] / LY.Q; me.h = a[2] / 100; me.vx = me.vz = 0; me.on = true;
    me.k = S.role[S.me] === 0 ? a[4] ?? -1 : -1; me.lock = S.role[S.me] === 0 ? a[3] | 0 : 0;
    sent = ''; scene?.setView(me.h + Math.PI, .5);
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now();
    if (s.seats) info = s.seats;
    if (!info) return;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); myKey = '';
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    // a new round (or a new role): take your place from the server
    const key = s.gid + ':' + s.round + ':' + (s.me >= 0 ? s.role[s.me] : 'w') + ':' + (s.me >= 0 && info[s.me]?.bot ? 'b' : '');
    if (key !== myKey) { myKey = key; if (s.me >= 0) adopt(); else me.on = false; }
    if (fresh && s.ph === 'play') roundIntro();
    if (s.me >= 0 && S.role[s.me] === 0 && S.a?.[s.me]) { const k = S.a[s.me][4]; if (k >= 0 && me.k < 0) me.k = k; }
    if (S.my?.dizzy > 0) dizzyTill = Math.max(dizzyTill, performance.now() + S.my.dizzy);
    if (!me.on && s.me >= 0 && S.a?.[s.me]) adopt();
    render(); sync();
    if (!fresh) { for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); } }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = R.order[0];
    el.innerHTML = `<div class="sheet">
      <h2>${I.star}${w === S.me ? L('You win Copycat Isle!', 'Wygrywasz Wyspę Przebierańców!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${cnt(S.rounds, 'round', 'rounds', 'runda', 'rundy', 'rund')}</p>
      <ol class="cc-podium">${R.order.map((i, n) => { const p = info[i], st = R.stat[i];
        const bits = [st.caught ? L(`found ${cnt(st.caught, 'hider')}`, `znalezieni: ${st.caught}`) : '', L(`hid ${clock(st.lived * 1000)}`, `w ukryciu ${clock(st.lived * 1000)}`), st.found ? L(`caught ${st.found}×`, `wpadki: ${st.found}`) : ''].filter(Boolean).join(' · ');
        return `<li class="${i === S.me ? 'cc-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${cnt(R.pts[i], 'point', 'points', 'punkt', 'punkty', 'punktów')}</strong><small>${bits}</small>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
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
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top - 10 : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
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
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.type === 'keydown' && !e.repeat) {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { main(); e.preventDefault(); return; }
      if (e.code === 'KeyR') { lock(); return; }
      if (e.code === 'KeyQ') { squeak(); return; }
      if (e.code === 'KeyF') { sniff(); return; }
    }
    if (!MOVE[e.code]) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(e.code); else keys.delete(e.code);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); joy = null; };
  addEventListener('blur', onBlur);
  // the joystick (phones)
  const joyEl = $('cc-joy'), knob = joyEl.firstChild; let joyId = null;
  const joyMove = e => { const r = joyEl.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, z = (e.clientY - r.top - R) / R; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } knob.style.transform = `translate(${(x * R * .62).toFixed(1)}px,${(z * R * .62).toFixed(1)}px)`; joy = l < .18 ? [0, 0] : [x, z]; };
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joyEl.setPointerCapture(joyId); joyEl.classList.add('on'); joyMove(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy = null; knob.style.transform = ''; joyEl.classList.remove('on'); };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  // dragging the island turns the view; a short tap acts on what is under it; two fingers or the wheel zoom
  const pts = new Map(); let down = null, pinch = 0, drag = false;
  canvas.draggable = false; for (const ev of ['dragstart', 'selectstart', 'contextmenu']) canvas.addEventListener(ev, e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, [e.clientX, e.clientY]); drag = false;
    if (pts.size === 1) down = { x: e.clientX, y: e.clientY }; else { down = null; const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', e => { const was = pts.get(e.pointerId); if (!was) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) scene?.zoom(pinch / d); pinch = d; return; }
    if (drag || (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8)) { drag = true; down = null; scene?.turn(-(e.clientX - was[0]) * .008, (e.clientY - was[1]) * .004); } });
  const up = e => { const tap = down && !drag && pts.size === 1; pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (tap) tapAt(e.clientX, e.clientY); down = null; if (!pts.size) drag = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); down = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); scene?.zoom(e.deltaY > 0 ? 1.1 : .9); }, { passive: false });

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'main') main();
    else if (a === 'lock') lock();
    else if (a === 'squeak') squeak();
    else if (a === 'sniff') sniff();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
