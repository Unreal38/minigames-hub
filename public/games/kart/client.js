// Kart Island Race game view: drives your kart in the browser (the physics in track.js), reports it to the server,
// and draws the HUD over the 3D race: place, lap, item slot, a minimap, touch controls and the results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { buildTrack, newKart, stepKart, bump, autoDrive, locate, progOf, TRACKS, driftFlags } from './track.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  left: SV('<path d="M15 5l-7 7 7 7"/>', 34), right: SV('<path d="M9 5l7 7-7 7"/>', 34),
  brake: SV('<path d="M12 5v14M6 13l6 6 6-6"/>', 26),
  flag: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3v18" stroke="#3b2219" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4h12v9H7z" fill="#fff4e2" stroke="#3b2219" stroke-width="2"/><path d="M7 4h4v3H7zM15 4h4v3h-4zM11 7h4v3h-4zM7 10h4v3H7zM15 10h4v3h-4z" fill="#3b2219"/></svg>',
};
// the power-ups, drawn as little stickers
export const ITEM_INFO = {
  peel: { name: L('Banana peel', 'Skórka od banana'), tip: L('drops behind you', 'spada za tobą'), svg: '<svg viewBox="0 0 48 48"><path d="M24 10c-2 6-1 12 0 16" stroke="#6b4a2c" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M24 26c-8-2-14 4-16 12 6-3 11-5 16-6zM24 26c8-2 14 4 16 12-6-3-11-5-16-6zM24 26c-3 6-3 11 0 16 3-5 3-10 0-16z" fill="#ffd23f" stroke="#3b2219" stroke-width="2.5" stroke-linejoin="round"/></svg>' },
  jelly: { name: L('Wobbly jelly', 'Rozchwiana galaretka'), tip: L('chases the kart ahead', 'goni gokart przed tobą'), svg: '<svg viewBox="0 0 48 48"><path d="M12 38l3-20h18l3 20z" fill="#ff7ab0" stroke="#3b2219" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 18h20" stroke="#ffb3d1" stroke-width="3"/><circle cx="24" cy="12" r="5" fill="#e5243b" stroke="#3b2219" stroke-width="2.5"/><path d="M17 26c3 2 11 2 14 0" stroke="#ffffff" stroke-width="2" opacity=".7" fill="none"/></svg>' },
  chili: { name: L('Chili boost', 'Ostra papryczka'), tip: L('a hot burst of speed', 'ostry zastrzyk prędkości'), svg: '<svg viewBox="0 0 48 48"><path d="M30 10c-2 3-3 4-6 5" stroke="#5b8f3a" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M24 15c8-1 12 6 8 15-4 9-14 12-22 10 8-4 12-10 12-17 0-4 0-6 2-8z" fill="#e5543b" stroke="#3b2219" stroke-width="2.5" stroke-linejoin="round"/><path d="M27 20c1 3 0 6-2 9" stroke="#ff9a7a" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>' },
  bubble: { name: L('Bubble shield', 'Bańka ochronna'), tip: L('blocks the next hit', 'blokuje następne trafienie'), svg: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="#9fe6ff" fill-opacity=".55" stroke="#3b2219" stroke-width="2.5"/><path d="M15 19c2-4 5-6 9-6" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="31" cy="30" r="2.5" fill="#fff"/></svg>' },
  cloud: { name: L('Sleepy cloud', 'Senna chmurka'), tip: L('slows everyone ahead', 'spowalnia wszystkich przed tobą'), svg: '<svg viewBox="0 0 48 48"><path d="M12 32a7 7 0 0 1 1-14 10 10 0 0 1 19-2 8 8 0 0 1 4 16z" fill="#ffffff" stroke="#3b2219" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 6h6l-6 6h6M36 14h4l-4 4h4" stroke="#3b2219" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M18 26c1 1 3 1 4 0M26 26c1 1 3 1 4 0" stroke="#3b2219" stroke-width="2" stroke-linecap="round" fill="none"/></svg>' },
};
const ITEM_KEYS = Object.keys(ITEM_INFO);
import { ord } from '../../i18n.js';
const clock = ms => { if (!(ms > 0)) return '–'; const s = ms / 1000; return `${s / 60 | 0}:${(s % 60).toFixed(2).padStart(5, '0')}`; };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./kart.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  const touch = matchMedia('(pointer: coarse)').matches;
  app.innerHTML = `<div class="kr${touch ? ' touch' : ''}">
    <canvas class="g3d" aria-label="${L(`The kart race. Steer with the arrow keys or A and D, Space to drift, E to use your item.`, `Wyścig gokartów. Skręcaj strzałkami albo klawiszami A i D, Spacja to drift, E używa przedmiotu.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="kr-lap"></span><span class="chip" id="kr-time"></span></div>
      <div class="tr"><span class="tcode" id="kr-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="kr-banner" aria-live="polite"></div>
      <div class="lights" id="kr-lights" hidden><i></i><i></i><i></i></div>
      <div class="shout" id="kr-big" aria-live="assertive"></div>
      <ol class="list" id="kr-list" aria-label="${L(`Race order`, `Kolejność w wyścigu`)}"></ol>
      <div class="place" id="kr-place" aria-live="polite"></div>
      <button type="button" class="kr-item" id="kr-slot" data-a="use" aria-label="${L(`Use your item`, `Użyj przedmiotu`)}"></button>
      <svg class="map" id="kr-map" aria-hidden="true"></svg>
      <div class="pads" id="kr-pads">
        <div class="steer"><button type="button" data-k="left" aria-label="${L(`Steer left`, `Skręć w lewo`)}">${I.left}</button><button type="button" data-k="right" aria-label="${L(`Steer right`, `Skręć w prawo`)}">${I.right}</button></div>
        <div class="acts"><button type="button" data-k="brake" class="sm" aria-label="${L(`Brake`, `Hamuj`)}">${I.brake}</button><button type="button" data-k="drift" aria-label="Drift">Drift</button></div>
      </div>
      <p class="keys" id="kr-keys">${L(`Steer <b>← →</b> or <b>A D</b> · drift <b>Space</b> · item <b>E</b> · brake <b>↓</b>`, `Skręt <b>← →</b> lub <b>A D</b> · drift <b>Spacja</b> · przedmiot <b>E</b> · hamulec <b>↓</b>`)}</p>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.kr'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, info = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, T = null, mk = null, driving = false;
  let recvAt = 0, sentAt = 0, tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, lastPlace = 0, lastCount = 99, mapKey = '', mapDots = [], lastItem = null, rollTick = 0, steerV = 0;
  const keys = new Set(), pads = new Set();

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, step });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const myItem = () => (S && S.me >= 0 ? S.it[S.me] : null);
  const itemReady = () => { const it = myItem(); return it && performance.now() - recvAt >= it[1]; };

  function sync() {
    if (!scene || !S || !info) return;
    scene.setTrack(S.track); scene.setSeats(info); scene.setMe(S.me); scene.watch(S.place[0] ?? 0);
  }

  // ----- your kart: driven here every frame -----
  function controls() {
    const Lf = keys.has('left') || pads.has('left'), R = keys.has('right') || pads.has('right');
    const want = (Lf ? 1 : 0) - (R ? 1 : 0);
    return { steer: want, gas: 1, brake: keys.has('brake') || pads.has('brake') ? 1 : 0, drift: keys.has('drift') || pads.has('drift') ? 1 : 0 };
  }
  let lastStep = 0;
  function step() {
    // real time since the last frame, so a slow device still drives at full speed (in small steps)
    const now0 = performance.now(), dt = Math.min(.25, lastStep ? (now0 - lastStep) / 1000 : 1 / 60); lastStep = now0;
    if (!S || !scene || !T) return;
    driving = S.me >= 0 && S.ph === 'play' && info?.[S.me] && !info[S.me].bot;
    if (!driving || !mk) { scene.mine(null); return; }
    const fin = S.fin[S.me] > 0;
    let inp;
    if (S.stage === 'count') { inp = { steer: 0, gas: 0, brake: 1, drift: 0 }; mk.v = 0; }
    else if (fin) inp = autoDrive(T, mk, { lane: 1.5 });
    else inp = controls();
    steerV += ((inp.steer || 0) - steerV) * Math.min(1, dt * (Math.abs(inp.steer) > Math.abs(steerV) ? 9 : 14));
    let cue = null;
    const n = Math.ceil(dt / (1 / 60) - .01);
    const raceT = (S.t + now0 - recvAt) / 1000; // the race clock: pets, geysers and hammers move by it
    if (fin) inp = autoDrive(T, mk, { lane: 1.5, t: raceT });
    for (let k = 0; k < n; k++) cue = stepKart(T, mk, { ...inp, steer: fin ? inp.steer : steerV }, dt / n, fin ? .7 : 1, S.stage === 'race' ? raceT : null) || cue;
    mk.steerVis = steerV;
    // bump into the others
    const live = scene.live();
    for (let i = 0; i < live.length; i++) if (i !== S.me && live[i] && bump(mk, live[i], true, false) && mk.v > 10 && Math.random() < .1) sfx.tick();
    if (cue === 'fall') { sfx.plop(); big(L('Whoops!', 'Ojej!'), L('A cloud will bring you back', 'Chmurka odstawi cię na trasę'), 1300); }
    else if (cue === 'respawn') sfx.pop();
    else if (cue === 'bonk') sfx.place();
    else if (cue === 'jump') sfx.draw();
    else if (cue === 'land') sfx.place();
    else if (cue?.startsWith('bonk-')) { sfx.bad(); big(cue === 'bonk-gey' ? L('Splash!', 'Chlup!') : L('Bonk!', 'Bęc!'), cue === 'bonk-pet' ? L('Steer round the pets', 'Omijaj zwierzaki') : '', 1100); }
    else if (cue === 'mini' || cue === 'pad') sfx.join();
    scene.mine(mk);
    const now = performance.now();
    if (S.stage === 'race' && now - sentAt > 95) {
      sentAt = now;
      const f = (mk.fall > 0 ? 1 : 0) | (mk.spin > 0 ? 2 : 0) | (mk.boost > 0 ? 4 : 0) | (mk.slow > 0 ? 8 : 0) | (mk.dr > 0 ? 32 : 0) | (mk.dr < 0 ? 64 : 0) | (mk.grass ? 128 : 0) | (mk.ghost > 0 ? 256 : 0) | driftFlags(mk.charge);
      ctx.act({ t: 'p', x: +mk.x.toFixed(2), z: +mk.z.toFixed(2), h: +mk.h.toFixed(3), v: +mk.v.toFixed(2), f, c: Math.round(now) });
    }
  }
  // take the kart over from what the server has (the start, or coming back after a bot drove for you)
  function adopt() {
    const p = S.k[S.me]; if (!p) return;
    mk = newKart(T, 0);
    Object.assign(mk, { x: p[0], z: p[1], y: p[2], h: p[3], v: S.stage === 'race' ? p[4] : 0 });
    const l = locate(T, mk.x, mk.z, -1, mk.y); Object.assign(mk, { i: l.i, s: l.s, lat: l.lat, lap: S.lap[S.me] }); mk.prog = progOf(T, mk);
  }
  function useItem() {
    if (!driving || S.stage !== 'race' || !itemReady()) return;
    const it = myItem();
    ctx.act({ t: 'use' });
    if (it[0] === 'chili' && mk) { mk.boost = Math.max(mk.boost, 1.6); sfx.join(); }
    else sfx.pop();
    S.it[S.me] = null; renderSlot();
  }

  function onFrame(fr) {
    if (!S || !info) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = fr.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      placer.add(el, t.x, t.y, Math.max(.6, Math.min(1, 26 / t.d)));
    }
    // minimap dots
    const live = scene.live();
    for (let i = 0; i < mapDots.length; i++) { const p = live[i], d = mapDots[i]; if (!p || !d) continue; d.setAttribute('cx', p.x.toFixed(1)); d.setAttribute('cy', p.z.toFixed(1)); }
    renderClock();
  }

  function buildTags() {
    const key = info.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = info.map(p => `<div class="kr-tag${tagCls(p)}" hidden>${tagFace(p)}${tagBg(p)}</div>`).join('');
    tagEls = [...tagsEl.children]; placer.reset();
  }

  function buildMap() {
    const key = S.track + '|' + info.map(p => p.color).join() + S.me;
    if (key === mapKey) return; mapKey = key;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, d = '';
    for (let i = 0; i < T.n; i += 3) { x0 = Math.min(x0, T.x[i]); x1 = Math.max(x1, T.x[i]); z0 = Math.min(z0, T.z[i]); z1 = Math.max(z1, T.z[i]); d += (i ? 'L' : 'M') + T.x[i].toFixed(1) + ' ' + T.z[i].toFixed(1); }
    const pad = 16, el = $('kr-map');
    el.setAttribute('viewBox', `${x0 - pad} ${z0 - pad} ${x1 - x0 + pad * 2} ${z1 - z0 + pad * 2}`);
    const bridges = []; let st = -1;
    for (let i = 0; i <= T.n; i++) { const b = T.br[i % T.n]; if (b && st < 0) st = i; if ((!b || i === T.n) && st >= 0) { let p = ''; for (let k = st; k <= i; k++) p += (k === st ? 'M' : 'L') + T.x[k % T.n].toFixed(1) + ' ' + T.z[k % T.n].toFixed(1); bridges.push(p); st = -1; } }
    const order = info.map((_, i) => i).sort((a, b) => (a === S.me) - (b === S.me));
    el.innerHTML = `<path d="${d}Z" class="mroad"/><path d="${d}Z" class="mline"/>${bridges.map(p => `<path d="${p}" class="mbridge"/>`).join('')}
      <rect x="${T.x[0] - 5}" y="${T.z[0] - 5}" width="10" height="10" class="mstart" transform="rotate(${-Math.atan2(T.tx[0], T.tz[0]) * 180 / Math.PI} ${T.x[0]} ${T.z[0]})"/>
      ${order.map(i => `<circle r="${i === S.me ? 8 : 6}" fill="${info[i].color}" class="${i === S.me ? 'mme' : ''}" data-i="${i}"/>`).join('')}`;
    mapDots = []; for (const c of el.querySelectorAll('circle')) mapDots[+c.dataset.i] = c;
  }

  // ----- HUD -----
  function renderList() {
    setHtml($('kr-list'), S.place.map((i, n) => {
      const p = info[i], fin = S.fin[i];
      return `<li class="${pbRowCls(p.fl)} ${i === S.me ? 'kr-me' : ''}${fin ? ' fin' : ''}"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 26, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b>${fin ? `<span>${clock(fin)}</span>` : ''}${rowBg(p.fl)}</li>`;
    }).join(''));
    pbRows($('kr-list'));
  }
  function renderPlace() {
    const el = $('kr-place');
    if (S.me < 0) { setHtml(el, ''); return; }
    const pl = S.place.indexOf(S.me) + 1;
    setHtml(el, `<b>${pl}</b><sup>${ord(pl).slice(String(pl).length)}</sup><span>${L('of', 'z')} ${S.place.length}</span>`);
    if (pl !== lastPlace) { if (lastPlace && S.stage === 'race') { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } lastPlace = pl; }
  }
  function renderSlot() {
    const el = $('kr-slot'), it = myItem(), off = S.items === 'off' || S.me < 0;
    el.hidden = off;
    if (off) return;
    if (!it) { setHtml(el, '<span class="kr-none">?</span>'); el.classList.remove('ready', 'rolling'); el._k = null; return; }
    const ready = itemReady();
    el.classList.toggle('rolling', !ready); el.classList.toggle('ready', ready);
    if (ready) { if (el._k !== it[0]) { el._k = it[0]; setHtml(el, `${ITEM_INFO[it[0]].svg}<small>${ITEM_INFO[it[0]].name}</small><kbd>${touch ? L('tap', 'dotknij') : 'E'}</kbd>`); sfx.set(); } }
    else { el._k = null; }
  }
  function renderClock() {
    if (!S) return;
    const t = S.t + (performance.now() - recvAt);
    const myFin = S.me >= 0 ? S.fin[S.me] : 0;
    setHtml($('kr-time'), clock(myFin || (S.stage === 'race' || S.ph === 'end' ? t : 0)));
    // the item roulette flips through pictures until it lands
    const it = myItem(), el = $('kr-slot');
    if (it && !itemReady() && performance.now() - rollTick > 90) { rollTick = performance.now(); const k = ITEM_KEYS[(Math.floor(performance.now() / 90)) % ITEM_KEYS.length]; setHtml(el, ITEM_INFO[k].svg); sfx.tick(); }
    else if (it && itemReady() && el._k !== it[0]) renderSlot();
    // the start lights
    if (S.stage === 'count') {
      const left = -t, n = Math.ceil(left / 1000), lights = $('kr-lights');
      lights.hidden = false;
      const lit = left > 0 ? Math.max(0, Math.min(3, 4 - n)) : 3;
      lights.querySelectorAll('i').forEach((x, k) => x.classList.toggle('on', k < lit));
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    } else if (!$('kr-lights').hidden) $('kr-lights').hidden = true;
    renderBanner(t);
  }
  function renderBanner(t) {
    const el = $('kr-banner'); let msg = '';
    if (S.ph === 'play' && S.stage === 'count') msg = `${TRACKS[S.track]?.name} · ${cnt(S.laps, 'lap', 'laps', 'okrążenie', 'okrążenia', 'okrążeń')}`;
    else if (S.ph === 'play' && S.after >= 0) { const left = Math.max(0, S.after - (performance.now() - recvAt)); msg = L(`${nameOf(S.place[0])} is home! ${Math.ceil(left / 1000)}s left`, `${nameOf(S.place[0])} na mecie! Zostało ${Math.ceil(left / 1000)} s`); }
    else if (S.me < 0 && S.ph === 'play') msg = L(`Watching ${nameOf(S.place[0])} lead`, `Oglądasz. Prowadzi: ${nameOf(S.place[0])}`);
    if (el.textContent !== msg) el.textContent = msg;
  }
  function render() {
    if (!S || !info) return;
    const lap = Math.max(1, Math.min(S.laps, (S.me >= 0 ? S.lap[S.me] : S.lap[S.place[0]]) + 1));
    setHtml($('kr-lap'), S.me >= 0 && S.fin[S.me] ? `${I.flag} ${L('Finished', 'Meta')}` : `${L('Lap', 'Okrążenie')} <b>${lap}</b>/${S.laps}`);
    $('kr-code').textContent = Rm?.code || '';
    buildTags(); buildMap(); renderList(); renderPlace(); renderSlot();
    root.classList.toggle('watching', S.me < 0);
    $('kr-pads').hidden = !driving && S.me < 0;
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('kr-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    scene?.event(e);
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('GO!', 'START!'), '', 900); sfx.turn(); }
    else if (e.t === 'hit') {
      if (mine) { if (mk) { mk.spin = 1.25; mk.dr = 0; mk.charge = 0; } sfx.bad(); big(e.k === 'peel' ? L('Slipped!', 'Poślizg!') : L('Splat!', 'Plask!'), e.by >= 0 && e.by !== S.me ? L(`${nameOf(e.by)} got you`, `Trafia cię: ${nameOf(e.by)}`) : '', 1200); }
      else { sfx.pop(); if (e.by === S.me) ctx.toast(L(`Your ${e.k === 'peel' ? 'banana peel' : 'jelly'} got ${nameOf(e.s)}!`, `${e.k === 'peel' ? 'Twoja skórka od banana' : 'Twoja galaretka'} trafia gracza ${nameOf(e.s)}!`)); }
    } else if (e.t === 'pop') { if (mine) { sfx.plop(); ctx.toast(L('Your bubble saved you!', 'Bańka cię ratuje!')); } }
    else if (e.t === 'zzz') {
      if ((e.hit || []).includes(S.me)) { if (mk) mk.slow = 2.8; sfx.lose(); big(L('Sleepy…', 'Senność…'), L(`${nameOf(e.s)} sent a sleepy cloud`, `Senna chmurka od gracza ${nameOf(e.s)}`), 1400); }
      else if (mine) ctx.toast(L(`Sleepy cloud over ${e.hit.length} kart${e.hit.length === 1 ? '' : 's'} ahead!`, `Senna chmurka nad ${cnt(e.hit.length, 'kart', 'karts', 'gokartem', 'gokartami', 'gokartami')} przed tobą!`));
    } else if (e.t === 'box') { if (mine && !e.none) sfx.draw(); }
    else if (e.t === 'lap') { if (mine) { sfx.set(); big(e.lap === S.laps ? L('Final lap!', 'Ostatnie okrążenie!') : L(`Lap ${e.lap}`, `Okrążenie ${e.lap}`), '', 1300); } }
    else if (e.t === 'fin') {
      if (mine) { sfx.win(); if (e.place <= 3) confetti(); big(e.place === 1 ? L('You win!', 'Wygrana!') : L(`${ord(e.place)} place!`, `${ord(e.place)} miejsce!`), clock(e.ms), 2600); }
      else if (e.place === 1) ctx.toast(L(`${nameOf(e.s)} crossed the line first!`, `Pierwsze miejsce na mecie: ${nameOf(e.s)}!`));
    } else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1600); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now();
    if (s.seats) info = s.seats;
    if (!info) return;
    const wasDriving = driving;
    driving = S.me >= 0 && S.ph === 'play' && !info[S.me]?.bot;
    T = buildTrack(S.track);
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastPlace = 0; lastCount = 99; mk = null;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    if (driving && (!mk || !wasDriving)) adopt();
    if (!driving) mk = null;
    render(); sync(); scene?.snap(S);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win;
    el.innerHTML = `<div class="sheet">
      <h2>${I.flag}${w === S.me ? L('You win the race!', 'Wygrywasz wyścig!') : L(`${nameOf(w)} wins the race!`, `Wyścig wygrywa ${nameOf(w)}!`)}</h2>
      <p>${esc(TRACKS[S.track]?.name)} · ${cnt(S.laps, 'lap', 'laps', 'okrążenie', 'okrążenia', 'okrążeń')}</p>
      <ol class="kr-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${pbRowCls(p.fl)} ${i === S.me ? 'kr-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${R.times[i] ? clock(R.times[i]) : L('did not finish', 'bez mety')}</strong><small>${R.best[i] ? L('best lap ', 'najlepsze okrążenie ') + clock(R.best[i]) : ''}</small>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Race again', 'Ścigaj się jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
    if (w === S.me) confetti();
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Race again', 'Ścigaj się jeszcze raz'));
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
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.setTransform(q, 0, 0, q, 0, 0); // full phone resolution is 4x the pixels for no visible gain
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
      if (++t < 200 && !destroyed) requestAnimationFrame(stepC); else cv.width = cv.height = 0;
    };
    stepC();
  }

  // ----- input -----
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'brake', KeyS: 'brake', Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift' };
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = KEYMAP[e.code];
    if (e.type === 'keydown' && (e.code === 'KeyE' || e.code === 'KeyX' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyX' || e.code === 'Enter')) { useItem(); e.preventDefault(); } return; }
    if (!k) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(k); else keys.delete(k);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  const onBlur = () => { keys.clear(); pads.clear(); };
  addEventListener('blur', onBlur);
  // touch pads: hold to steer, drift or brake; several fingers at once
  const padsEl = $('kr-pads');
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
    if (a === 'use') useItem();
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
