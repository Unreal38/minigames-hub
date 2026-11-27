// Friendship Trail game view: the HUD over the 3D island. Draws what the server says and sends your choices.
// Messages never hold the game up (Kuba): each one stays on top until the next one replaces it, then drops into the
// little list of the last three under it. The camera follows whoever is playing; the Whole map button pulls back to
// the island, with labels and outlines on the wild pets, stalls and special stones.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { petImg, petPics } from '../../petpic.js';
import { uiz } from '../../uiz.js';
import { SPECIES } from '../farm/data.js';
import {
  NODES, FORKS, routeName, near, matchup, oddsOf, priceOf, ITEMS, ITEM_IDS, ITEM_MAX, LURE, HERD_MAX, STONES, SEASON_RULE, WX_RULE,
  POOL, RIBBONS, EL_NAME, EL_COL, PACT_ROUNDS, ribbonsOf, showPts,
} from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  me: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  treat: '<svg class="tt-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="#e8b25a" stroke="#8a5a32" stroke-width="2"/><circle cx="9" cy="10" r="1.4" fill="#8a5a32"/><circle cx="14.5" cy="9" r="1.2" fill="#8a5a32"/><circle cx="13" cy="14.5" r="1.4" fill="#8a5a32"/></svg>',
};
// little sticker pictures of the stall's items (ink outlines, their own colours, so they read on day and night panels)
const IK = 'stroke="#3b2219" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const ITEM_SVG = {
  whistle: `<path d="M5 13h15a7 7 0 1 1-7 7v-2H5z" fill="#7cc6ff" ${IK}/><circle cx="20" cy="20" r="2.4" fill="#3b2219"/><path d="M8 13V9h6" fill="none" ${IK}/><path d="M26 7l2-2M23 5l1-2M27 11l3-1" fill="none" ${IK}/>`,
  berry: `<path d="M16 11c-2-4-6-5-9-4 2 3 5 4 9 4zM16 11c2-4 6-5 9-4-2 3-5 4-9 4z" fill="#6cc04a" ${IK}/><circle cx="11" cy="19" r="5" fill="#d23b6c" ${IK}/><circle cx="21" cy="19" r="5" fill="#8a3bd2" ${IK}/><circle cx="16" cy="25" r="5" fill="#e5543b" ${IK}/><circle cx="14.5" cy="23.5" r="1.2" fill="#fff"/>`,
  spy: `<path d="M4 20l5-2 2 5-5 2z" fill="#c98a52" ${IK}/><path d="M9 18l11-6 3 6-12 5z" fill="#ffc93c" ${IK}/><path d="M20 12l6-3 3 7-6 2z" fill="#c98a52" ${IK}/><path d="M14 23l-2 6M16 22l3 7" fill="none" ${IK}/><circle cx="27.5" cy="12.5" r="1.3" fill="#d4f1ff"/>`,
  honey: `<rect x="7" y="6" width="18" height="5" rx="2" fill="#fff4e2" ${IK}/><path d="M8 11h16c2 3 2 12-1 15-2 2-12 2-14 0-3-3-3-12-1-15z" fill="#ffb547" ${IK}/><path d="M11 15c2 2 4 0 5 2s3 1 5-1" fill="none" stroke="#fff3b0" stroke-width="2" stroke-linecap="round"/>`,
  charm: `<path d="M16 3v5" fill="none" ${IK}/><path d="M16 8l2.6 5.4 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" fill="#ff9fc8" ${IK}/><circle cx="16" cy="17" r="2.6" fill="#fff6e2" ${IK}/><path d="M12 25l-2 5 3-1 1 2 2-5M20 25l2 5-3-1-1 2-2-5" fill="#b994f0" ${IK}/>`,
  pouch: `<path d="M10 9c2 2 10 2 12 0l-2 4c5 3 7 8 5 12-2 3-16 3-18 0-2-4 0-9 5-12z" fill="#c98a52" ${IK}/><path d="M11 13h10" fill="none" ${IK}/><circle cx="16" cy="20" r="3" fill="#ffd36b" ${IK}/>`,
};
const itemIc = (k, cls = 'tt-ii') => `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true">${ITEM_SVG[k] || ''}</svg>`;
const petName = sp => SPECIES[sp]?.name || sp;
// The match host: a Pet Farm Petalpuff who explains the rules at the start and calls out what happens (Kuba 2026-11-27).
const HOST = { sp: 'tuxpurr', lv: 14, name: 'Tux' }; // the host: a Pet Farm Tuxpurr in his bow tie and top hat (Kuba 2026-11-27)
const RARE = [L('common', 'pospolity'), L('uncommon', 'niepospolity'), L('rare', 'rzadki')];
const STONE_NAME = {
  stall: L('Stall', 'Stragan'), nest: L('Egg Nest', 'Gniazdo'), bench: L('Pact Bench', 'Ławka paktu'), well: L('Wishing Well', 'Studnia życzeń'),
  spring: L('Hot Spring', 'Gorące źródło'), den: L('Rare Den', 'Nora rzadkich'), picnic: L('Picnic', 'Piknik'),
};
const SEASON_NAME = { winter: L('Winter', 'Zima'), spring: L('Spring', 'Wiosna'), summer: L('Summer', 'Lato'), autumn: L('Autumn', 'Jesień') };
const WX_NAME = { sunny: L('Sunny', 'Słonecznie'), cloudy: L('Cloudy', 'Pochmurno'), rain: L('Rain', 'Deszcz'), wind: L('Windy', 'Wietrznie'), rainbow: L('Rainbow', 'Tęcza') };
const MATCH = { strong: L('strong', 'silny'), even: L('even', 'równy'), weak: L('weak', 'słaby') };
const gameName = id => POOL.find(g => g.id === id)?.name || id;
const treatsW = n => L(`${n} treat${n === 1 ? '' : 's'}`, `${n} ${n === 1 ? 'przysmak' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'przysmaki' : 'przysmaków'}`);
const ptsW = n => L(`${n} pt${n === 1 ? '' : 's'}`, `${n} pkt`);

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./trail.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="tt">
    <canvas class="g3d" aria-label="${L('The Friendship Trail island', 'Wyspa Szlaku przyjaźni')}"></canvas>
    <div class="tt-marks" aria-hidden="true"></div>
    <div class="tags"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="tt-info"></span>
        <button type="button" class="chip tt-mapbtn" data-a="map" aria-pressed="false"></button></div>
      <div class="tr"><span class="tcode" id="tt-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="tt-news" aria-live="polite"><div class="tt-host" id="tt-host"><span class="hp">${petImg(HOST, 50, 'tt-hpi')}</span><div class="banner" id="tt-banner"></div></div><div class="tt-log" id="tt-log"></div></div>
      <div class="tt-side" id="tt-side"></div>
      <div class="tt-die" id="tt-die" hidden></div>
      <div class="shout" id="tt-big" aria-live="assertive"></div>
      <div class="tt-dock" id="tt-dock"></div>
      <div class="tt-ov" id="tt-ov" hidden></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.tt'), $ = id => root.querySelector('#' + id);
  petPics(root.querySelector('.tt-news'));
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), marksEl = root.querySelector('.tt-marks');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, stateAt = 0, sent = 0;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, dieTimer = 0, lastTick = -1, mapOn = false, ovKey = '';
  const LOG = []; // newest first
  const bubbles = new Map();

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); camFocus(); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nm = i => esc(S.seats[i]?.name);
  const nowSeat = () => (S.stage === 'order' ? S.pend?.s ?? -1 : S.stage === 'intro' ? -1 : S.turn); // whose go it is (the roll for the first turn too)
  const isMe = i => i === S?.me && S.me >= 0;
  const busyLeft = () => (S ? Math.max(0, S.busy - (Date.now() - stateAt)) : 0);
  const myPend = () => !!(S && S.ph === 'play' && S.pend && isMe(S.pend.s) && !me()?.bot);
  const ready = () => myPend() && busyLeft() <= 0 && Date.now() - sent > 700;
  const pet = (f, size = 30, cls = 'tt-pi') => petImg({ sp: f.sp, lv: 14, look: f.look || null, name: f.name || petName(f.sp) }, size, cls);

  // ----- the camera follows whoever is playing; between rounds it shows the whole island -----
  function camFocus() {
    if (!scene || !S) return;
    const turnish = S.ph === 'play' && ['turn', 'walk', 'land', 'next'].includes(S.stage) || (S.pend && !['pact'].includes(S.pend.k));
    scene.focus(turnish ? (S.pend && S.pend.k !== 'pact' ? S.pend.s : S.turn) : -1);
    scene.setMap(mapOn);
    scene.setLineup?.(lineMode());
    root.classList.toggle('lineup', !!lineMode()); root.classList.toggle('intro', S?.ph === 'play' && S.stage === 'intro');
  }
  // the start line-up: the intro, the roll for the first turn, and the moment the order is announced
  const lineMode = () => (!S || S.ph !== 'play' ? null : S.stage === 'intro' ? 'intro' : S.stage === 'order' || (S.stage === 'next' && S.turn < 0 && S.round === 1) ? 'order' : null);
  function paintMapBtn() {
    const b = root.querySelector('.tt-mapbtn');
    b.setAttribute('aria-pressed', mapOn ? 'true' : 'false');
    setHtml(b, mapOn ? `${I.me}<span>${L('Back to the player', 'Wróć do gracza')}</span>` : `${I.map}<span>${L('Whole map', 'Cała mapa')}</span>`);
  }
  paintMapBtn();

  // ----- every frame: name tags over heads, and the whole-map labels -----
  const markEls = new Map();
  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      el.style.visibility = t.on ? '' : 'hidden';
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    // labels for the wild pets, stalls and special stones once the camera has pulled back far enough
    const show = info.zoom > .55 && scene;
    marksEl.classList.toggle('on', !!show);
    if (!show) return;
    const list = scene.marks(), seen = new Set();
    const narrow = innerWidth < 760;
    const placed = []; // labels never sit on top of each other: wild pets first, then honey, then stones; a label that would cover another moves up, else hides
    list.sort((a, b) => (a.k === 'wild' ? 0 : a.k === 'honey' ? 1 : 2) - (b.k === 'wild' ? 0 : b.k === 'honey' ? 1 : 2));
    for (const m of list) {
      if (narrow && m.k === 'stone' && m.kind === 'picnic') continue; // phones: fewer labels, so the rest stay readable
      const k = m.k === 'wild' ? 'w' + m.w.id : m.k === 'honey' ? 'h' + m.pos : 's' + m.i; seen.add(k);
      let el = markEls.get(k);
      if (!el) {
        el = document.createElement('div');
        if (m.k === 'wild') { el.className = 'tt-mark wild'; el.style.setProperty('--el', EL_COL[m.w.el]); el.innerHTML = `<b>${esc(petName(m.w.sp))}</b><small>${EL_NAME[m.w.el]}${m.w.rare ? ' · ' + RARE[m.w.rare] : ''}</small>`; }
        else if (m.k === 'honey') { el.className = 'tt-mark honey'; el.innerHTML = `<b>${L('Honey Pot', 'Garnek miodu')}</b><small>${nm(S.honey[m.pos])}</small>`; }
        else { el.className = 'tt-mark stone ' + m.kind; el.innerHTML = `<b>${STONE_NAME[m.kind]}</b>`; }
        marksEl.append(el); markEls.set(k, el);
      }
      const w = el._w ||= el.offsetWidth, h = el._h ||= el.offsetHeight;
      let y = m.y, ok = false;
      for (let t = 0; t < 3 && !ok; t++) { ok = !placed.some(r => Math.abs(r.x - m.x) < (r.w + w) / 2 + 2 && Math.abs(r.y - y) < (r.h + h) / 2 + 2); if (!ok) y -= h * .7; }
      el.style.visibility = ok ? '' : 'hidden';
      if (ok) placed.push({ x: m.x, y, w, h });
      el.style.transform = `translate(${m.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [k, el] of markEls) if (!seen.has(k)) { el.remove(); markEls.delete(k); }
  }
  function layout() {
    const side = $('tt-side').getBoundingClientRect(); root.style.setProperty('--side-b', (side.bottom / uiz()).toFixed(0) + 'px'); // phones: the news sits under the player strip, however many rows it has
    const top = (root.querySelector('.tt-news')?.getBoundingClientRect().bottom || 80);
    const dock = $('tt-dock').getBoundingClientRect();
    // the camera keeps the bottom third clear for choices, so a tall panel (the stall) never covers the player
    scene?.setHud(top, Math.max(dock.height ? innerHeight - dock.top : 0, innerHeight * .3));
  }

  // ----- name tags -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map(p => `<div class="tt-tag"><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
      tagsEl.classList.add('pick');
    }
    const now = performance.now();
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', S.ph === 'play' && (nowSeat() === i));
      setHtml(el.querySelector('.cnt'), `${I.treat}${S.pl[i].treats}`);
      const b = bubbles.get(i);
      setHtml(el.firstElementChild, b && b.until > now ? b.html : '');
    });
  }
  function bubble(i, html, ms = 1800) { bubbles.set(i, { html, until: performance.now() + ms }); setTimeout(() => !destroyed && S && buildTags(), ms + 30); if (S) buildTags(); }
  function floatAt(p, text, cls = '') {
    if (!p) return;
    const f = document.createElement('div'); f.className = 'tt-pts ' + cls; f.textContent = text;
    f.style.left = `${p.x / uiz()}px`; f.style.top = `${p.y / uiz()}px`; root.querySelector('.hud').append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- the players down the side: treats, herd, items, pact -----
  function renderSide() {
    const rib = ribbonsOf(S.pl), pts = showPts(S.pl, rib), top = Math.max(...pts);
    const firstChip = i => { const k = S.first?.key?.[i]; return S.stage === 'order' && k?.length ? `<span class="tt-fr" title="${L('Roll for the first turn', 'Rzut o pierwszeństwo')}">${k.join(' · ')}</span>` : ''; };
    const rows = (S.order?.length === S.seats.length ? S.order : S.seats.map((_, i) => i)).map(i => { const p = S.seats[i];
      const q = S.pl[i], egg = q.egg ? `<span class="tt-egg" title="${L(`Mystery Egg: hatches in ${q.egg} turn${q.egg > 1 ? 's' : ''}`, `Tajemnicze jajo: wykluje się za ${q.egg} tur${q.egg > 1 ? 'y' : 'ę'}`)}"></span>` : '';
      const items = q.items.map(k => `<span class="tt-it" title="${esc(ITEMS[k].name)}">${itemIc(k, 'tt-iis')}</span>`).join('');
      const pact = q.pact ? `<span class="tt-pact" title="${L(`Buddy pact with ${nm(q.pact.w)}`, `Pakt z: ${nm(q.pact.w)}`)}">♥ ${nm(q.pact.w)}</span>` : '';
      const held = Object.keys(RIBBONS).filter(k => rib[k].includes(i)).map(k => RIBBONS[k]);
      const ptsTip = L(`Pet Show points if it ended now: ${q.herd.length} for friends + ${held.length * 2} for ribbons${held.length ? ' (' + held.join(', ') + ')' : ''}`, `Punkty na Pokazie, gdyby był teraz: ${q.herd.length} za przyjaciół + ${held.length * 2} za wstęgi${held.length ? ' (' + held.join(', ') + ')' : ''}`);
      return `<div class="profrow tt-row${nowSeat() === i && S.ph === 'play' ? ' now' : ''}${isMe(i) ? ' mine' : ''}">${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}
        <div class="tt-rw"><div class="tt-rn"><b>${nameHtml(p.name, p.fl)}</b><span class="tt-sp${pts[i] === top ? ' lead' : ''}" title="${esc(ptsTip)}">★${pts[i]}</span><span class="tt-tr">${I.treat}${q.treats}</span>${firstChip(i)}</div>
        <div class="tt-herd">${q.herd.map(f => `<span class="tt-pet${f.start ? ' st' : ''}${f.cheer ? '' : ' used'}" style="--el:${EL_COL[f.el]}">${pet(f, 24)}</span>`).join('')}${egg}</div>
        ${items || pact ? `<div class="tt-extra">${items}${pact}</div>` : ''}</div></div>`;
    }).join('');
    setHtml($('tt-side'), rows); petPics($('tt-side'));
  }

  // ----- messages: the newest on top until the next one; the last three under it -----
  function say(html) {
    if (LOG[0] === html) return;
    LOG.unshift(html); LOG.length = Math.min(LOG.length, 4);
    const b = $('tt-banner'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    const h = $('tt-host'); h.classList.remove('talk'); void h.offsetWidth; h.classList.add('talk');
    $('tt-log').innerHTML = LOG.slice(1).map((x, i) => `<div style="opacity:${(.92 - i * .2).toFixed(2)}">${x}</div>`).join('');
    layout();
  }
  function big(text, sub = '', ms = 1600) {
    const el = $('tt-big'); el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieFace = d => `<span class="face">${Array.from({ length: 9 }, (_, k) => `<i${PIPS[d]?.includes(k) ? ' class="on"' : ''}></i>`).join('')}</span>`;
  // the dice fly in 3D in the roller's own dice skin; the flat picture is only for when there is no 3D view
  function throwDice(s, list, d, extra = '', was = null) {
    const num = was != null ? `<span><s>${was}</s> → ${d}</span>` : `<span>${d}</span>`;
    if (scene?.roll) { scene.roll(s, list); setTimeout(() => !destroyed && bubble(s, num, 2600), 700); } else { showDie(list, extra); bubble(s, num, 2600); } }
  function showDie(list, extra = '') {
    const el = $('tt-die'); el.hidden = false;
    el.innerHTML = list.map(d => `<span class="die rolling">${dieFace(1 + (Math.random() * 6 | 0))}</span>`).join('') + extra;
    const dice = [...el.querySelectorAll('.die')]; let k = 0;
    const spin = () => { if (destroyed) return; if (k++ < 6) { dice.forEach(x => { x.innerHTML = dieFace(1 + (Math.random() * 6 | 0)); }); setTimeout(spin, 70); } else dice.forEach((x, j) => { x.classList.remove('rolling'); x.innerHTML = dieFace(list[j]); }); };
    spin();
    clearTimeout(dieTimer); dieTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ----- what you can do now (the dock at the bottom) -----
  const timeLeft = () => (S?.tLeft >= 0 ? Math.max(0, Math.ceil((S.tLeft - (Date.now() - stateAt)) / 1000)) : -1);
  function renderDock() {
    const el = $('tt-dock');
    if (!S || S.ph !== 'play') { setHtml(el, ''); return; }
    let html = '';
    const t = timeLeft(), clock = t >= 0 && S.timer ? `<span class="tt-clock${t <= 5 ? ' late' : ''}">${t}s</span>` : '';
    if (S.stage === 'intro') html = introHtml();
    else if (S.stage === 'cheer') html = cheerHtml(clock);
    else if (myPend() && busyLeft() > 0) html = `<div class="tt-wait"><span>${L('Wait for it…', 'Chwileczkę…')}</span></div>`;
    else if (myPend()) html = pendHtml(S.pend, clock);
    else if (S.pend && S.ph === 'play') {
      const w = S.seats[S.pend.s];
      const what = { first: L('rolls to see who goes first', 'rzuca, kto zaczyna'), roll: L('is about to roll', 'zaraz rzuca'), reroll: L('is deciding on a reroll', 'myśli o przerzucie'), fork: L('is picking a route', 'wybiera trasę'), shop: L('is at the stall', 'jest przy straganie'),
        meet: L('meets a wild pet', 'spotyka dzikiego zwierzaka'), well: L('is at the Wishing Well', 'stoi przy studni życzeń'), bench: L('is on the Pact Bench', 'siedzi na ławce paktu'),
        pact: L('is thinking about a pact', 'myśli o pakcie'), lure: L('eyes a pet to lure', 'chce zwabić zwierzaka') }[S.pend.k] || L('is thinking', 'myśli');
      html = `<div class="tt-wait">${avatarHtml(w.color, w.av, 30)}<span>${isMe(S.pend.s) ? L('A bot plays for you', 'Bot gra za ciebie') : `${nm(S.pend.s)} ${what}…`}</span></div>`;
    }
    const kind = S.stage + '|' + (S.pend ? S.pend.k + S.pend.s : '') + '|' + (myPend() ? 1 : 0);
    if (html && kind !== el._kind) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
    el._kind = kind;
    setHtml(el, html); petPics(el);
    layout();
  }
  const btn = (a, label, sub = '', attrs = '', cls = '') => `<button type="button" class="btn ${cls}" data-a="${a}" ${attrs}><span class="l">${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
  // a choice tile: a picture, a name and a line of detail, with an optional price chip; every tile in a row is the same size
  const opt = (a, ic, t, sub = '', attrs = '', cls = '', price = '') => `<button type="button" class="btn tt-opt ${cls}" data-a="${a}" ${attrs}><span class="ic">${ic}</span><span class="tx"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${price}</button>`;
  const priceTag = c => `<span class="tt-price">${I.treat}${c}</span>`;
  function pendHtml(P, clock) {
    const p = S.pl[S.me];
    const head = (h, sub = '') => `<div class="tt-q"><b>${h}</b>${clock}${sub ? `<span>${sub}</span>` : ''}</div>`;
    if (P.k === 'first') {
      const tie = S.first?.tie?.includes(S.me);
      return `${head(tie ? L('A tie! Roll again', 'Remis! Rzuć jeszcze raz') : L('Who goes first?', 'Kto zaczyna?'), tie ? L('Only the tied players roll again', 'Rzucają tylko gracze z remisem') : L('Everyone rolls once. The highest roll starts, then the rest in order of their rolls.', 'Każdy rzuca raz. Zaczyna najwyższy wynik, potem reszta według rzutów.'))}
        <div class="tt-acts">${btn('roll', L('Roll the die', 'Rzuć kością'), '', '', 'big')}</div>`;
    }
    if (P.k === 'roll') {
      const armed = [p.spy && ITEMS.spy.name, p.berry && ITEMS.berry.name, p.whistle && ITEMS.whistle.name, p.charm && ITEMS.charm.name].filter(Boolean);
      const items = p.items.map((k, i) => opt('item', itemIc(k), `${L('Use', 'Użyj')}: ${esc(ITEMS[k].name)}`, k === 'honey' && p.pos < 0 ? L('Not in the start meadow', 'Nie na łące startowej') : esc(ITEMS[k].tx), `data-k="${k}" data-n="${i}"${k === 'honey' && p.pos < 0 ? ' disabled' : ''}`)).join('');
      const hint = S.round <= 2 ? L('Roll, then walk that many stones. Stop exactly on a glowing stone to meet its wild pet.', 'Rzuć i przejdź tyle kamieni. Zatrzymaj się dokładnie na świecącym kamieniu, by spotkać dzikiego zwierzaka.') : '';
      return `${head(L('Your turn', 'Twoja kolej'), armed.length ? L(`Ready: ${armed.join(', ')}`, `Gotowe: ${armed.join(', ')}`) : p.items.length ? L('Use an item first, or just roll', 'Najpierw użyj przedmiotu albo od razu rzucaj') : hint)}
        ${items ? `<div class="tt-acts">${items}</div>` : ''}<div class="tt-acts">${btn('roll', L('Roll the die', 'Rzuć kością'), '', '', 'big')}</div>`;
    }
    if (P.k === 'reroll') return `${head(L(`You rolled ${S.die}`, `Wyrzucasz ${S.die}`), L('A friend can reroll for you, once per friend', 'Przyjaciel może przerzucić za ciebie, każdy raz'))}
      <div class="tt-acts">${P.f.map(i => { const f = p.herd[i]; return opt('reroll', pet(f, 34), L(`Reroll with ${esc(f.name || petName(f.sp))}`, `Przerzuć: ${esc(f.name || petName(f.sp))}`), f.el === 'Spark' ? L('can reroll every round', 'może przerzucać co rundę') : L('once per friend', 'raz na przyjaciela'), `data-i="${i}"`); }).join('')}</div><div class="tt-acts">${btn('keep', L(`Walk ${S.die}`, `Idź o ${S.die}`), '', '', 'big')}</div>`;
    if (P.k === 'fork') return `${head(L('Which way?', 'Którędy?'), L('Glowing stones have a wild pet: stop exactly on one to meet it', 'Świecące kamienie mają dzikiego zwierzaka: zatrzymaj się dokładnie na nim, by go spotkać'))}
      <div class="tt-acts">${P.opts.map(j => { const n = petsAhead(j); return opt('fork', `<svg class="tt-ii" viewBox="0 0 32 32" aria-hidden="true"><path d="M15 6v23" ${IK}/><path d="M6 8h16l4 3.5-4 3.5H6z" fill="#ffc93c" ${IK}/><path d="M26 17H10l-4 3.5 4 3.5h16z" fill="#fff6e2" ${IK}/></svg>`, esc(routeName(j)), n ? L(`${n} wild pet${n > 1 ? 's' : ''} on the way`, `dzikie zwierzaki po drodze: ${n}`) : L('no wild pets in sight', 'nie widać dzikich zwierzaków'), `data-j="${j}"`, n ? 'hot' : ''); }).join('')}</div>`;
    if (P.k === 'shop') return `${head(L('The stall', 'Stragan'), L(`You have ${treatsW(p.treats)} and ${p.items.length}/${ITEM_MAX} items`, `Masz ${treatsW(p.treats)} i przedmioty: ${p.items.length}/${ITEM_MAX}`))}
      <div class="tt-acts shop">${ITEM_IDS.map(k => opt('buy', itemIc(k), esc(ITEMS[k].name), esc(ITEMS[k].tx), `data-k="${k}"${ITEMS[k].c > p.treats || p.items.length >= ITEM_MAX ? ' disabled' : ''}`, '', priceTag(ITEMS[k].c))).join('')}</div>
      <div class="tt-acts">${btn('buy', L('Walk on', 'Idź dalej'), '', 'data-k=""')}</div>`;
    if (P.k === 'meet') {
      const w = S.wild.find(x => x.id === P.id); if (!w) return '';
      const c = Math.max(1, priceOf(w.rare) - (S.season === 'autumn' ? 2 : 0));
      return `<div class="tt-q"><span class="tt-wild" style="--el:${EL_COL[w.el]}">${pet(w, 52)}</span><b>${L(`A wild ${esc(petName(w.sp))}!`, `Dziki ${esc(petName(w.sp))}!`)}</b>${clock}<span>${EL_NAME[w.el]} · ${RARE[w.rare]}${p.berry ? L(' · Berry Bundle ready', ' · Pęczek jagód gotowy') : ''}</span></div>
        <div class="tt-acts">${p.herd.map((f, k) => { const m = matchup(f.el, w.el), o = Math.round(oddsOf(f.el, w.el, p.berry) * 100);
          return opt('meet', pet(f, 34), `${esc(f.name || petName(f.sp))} <span class="tt-odds">${o}%</span>`, `${EL_NAME[f.el]} · ${MATCH[m]}`, `data-k="${k}"`, m === 'strong' ? 'hot' : ''); }).join('')}
          ${opt('treat', `<span class="tt-big-ic">${I.treat}</span>`, L(`Give ${treatsW(c)}`, `Daj ${treatsW(c)}`), L('always works', 'zawsze działa'), p.treats < c ? 'disabled' : '', '', priceTag(c))}</div>
        <div class="tt-acts">${btn('skip', L('Leave it be', 'Zostaw go'), '', '', 'ghost')}</div>`;
    }
    if (P.k === 'well') return `${head(STONE_NAME.well, L('5 treats for a wish: a rare pet, an item or 8 treats', 'Życzenie za 5 przysmaków: rzadki zwierzak, przedmiot albo 8 przysmaków'))}<div class="tt-acts">${btn('well', L('Make a wish', 'Pomyśl życzenie'), '', 'data-y="1"', 'big')}${btn('well', L('No thanks', 'Nie, dziękuję'), '', 'data-y=""', 'ghost')}</div>`;
    if (P.k === 'bench') return `${head(STONE_NAME.bench, L(`Offer a buddy pact for ${PACT_ROUNDS} rounds: +3 treats when your buddy makes a friend, no luring each other, +3 each if you both finish top 2 in a minigame`, `Zaproponuj pakt na ${PACT_ROUNDS} rundy: +3 przysmaki, gdy kumpel zdobędzie przyjaciela, żadnego wabienia siebie nawzajem, po +3, gdy oboje skończycie minigrę w pierwszej dwójce`))}
      <div class="tt-acts">${P.opts.map(o => opt('bench', avatarHtml(S.seats[o].color, S.seats[o].av, 34), nm(o), L('offer a pact', 'zaproponuj pakt'), `data-o="${o}"`)).join('')}</div>
      <div class="tt-acts">${btn('bench', L('No pact', 'Bez paktu'), '', 'data-o="-1"', 'ghost')}</div>`;
    if (P.k === 'pact') return `${head(L(`${nm(P.from)} offers you a buddy pact`, `${nm(P.from)} proponuje ci pakt`), L(`${PACT_ROUNDS} rounds: +3 treats when your buddy makes a friend, and no luring each other`, `${PACT_ROUNDS} rundy: +3 przysmaki, gdy kumpel zdobędzie przyjaciela, i żadnego wabienia siebie nawzajem`))}
      <div class="tt-acts">${btn('pact', L('Shake on it', 'Przybij piątkę'), '', 'data-y="1"', 'big')}${btn('pact', L('No thanks', 'Nie, dziękuję'), '', 'data-y=""', 'ghost')}</div>`;
    if (P.k === 'lure') { const q = S.pl[P.o], f = q.herd[q.herd.length - 1];
      return `${head(L(`Lure ${nm(P.o)}'s newest friend?`, `Zwabić najnowszego przyjaciela gracza ${nm(P.o)}?`), L(`${LURE} treats and ${esc(petName(f.sp))} joins you`, `${LURE} przysmaków i ${esc(petName(f.sp))} dołącza do ciebie`))}
      <div class="tt-acts">${opt('lure', pet(f, 34), L(`Lure ${esc(petName(f.sp))}`, `Zwab: ${esc(petName(f.sp))}`), L('joins your herd', 'dołącza do twojego stada'), 'data-y="1"', 'hot', priceTag(LURE))}</div><div class="tt-acts">${btn('lure', L('Leave them be', 'Zostaw'), '', 'data-y=""', 'ghost')}</div>`; }
    return '';
  }
  function cheerHtml(clock) {
    if (!S.cheer || S.cheer.done || me()?.bot) return `<div class="tt-wait"><span>${L('Friends are picking who cheers…', 'Przyjaciele wybierają, kto kibicuje…')}</span>${clock}</div>`;
    const p = S.pl[S.me], can = p.herd.map((f, k) => (f.cheer ? k : -1)).filter(k => k >= 0);
    return `<div class="tt-q"><b>${L('Who cheers you on?', 'Kto ci kibicuje?')}</b>${clock}<span>${L('A cheering friend moves you up one place in the next minigame if you finish behind someone. Each friend cheers once.', 'Kibicujący przyjaciel przesuwa cię o jedno miejsce w górę w następnej minigrze, jeśli skończysz za kimś. Każdy kibicuje raz.')}</span></div>
      <div class="tt-acts">${can.map(k => opt('cheer', pet(p.herd[k], 34), esc(p.herd[k].name || petName(p.herd[k].sp)), EL_NAME[p.herd[k].el], `data-i="${k}"`)).join('')}</div>
      <div class="tt-acts">${btn('cheer', L('Save them for later', 'Zachowaj na później'), '', 'data-i="-1"', 'ghost')}</div>`;
  }
  function petsAhead(j) { let n = 0, at = j; const seen = new Set(); for (let k = 0; k < 6; k++) { for (const w of S.wild) if (!seen.has(w.id) && w.pos === at) { seen.add(w.id); n++; } at = NODES[at].next[0]; } return n; }

  // ----- Tux's intro: one sentence at a time in the big banner at the bottom, while the camera is on him -----
  function introStep() {
    const lines = INTRO_LINES(S), ms = S.introMs || 29000, el = ms - Math.max(0, S.stageLeft - (Date.now() - stateAt));
    return { lines, k: Math.max(0, Math.min(lines.length - 1, Math.floor(el / (ms - 500) * lines.length))) };
  }
  const INTRO_LINES = S => [
    L(`Hello, hello! I'm <b>Tux</b>, your host tonight!`, `Witam, witam! Jestem <b>Tux</b> i prowadzę dzisiejszą zabawę!`),
    L('Welcome to the <b>Friendship Trail</b>!', 'Witajcie na <b>Szlaku przyjaźni</b>!'),
    L(`Whoever has the most <b>Pet Show points</b> after ${S.rounds} rounds wins.`, `Wygrywa ten, kto po ${S.rounds} rundach ma najwięcej <b>punktów na Pokazie</b>.`),
    L('Every friend in your herd is 1 point, and every ribbon is 2.', 'Każdy przyjaciel w stadzie to 1 punkt, a każda wstęga to 2.'),
    L('Roll the die and walk the trail. At a fork, you pick the way.', 'Rzuć kością i idź szlakiem. Na rozwidleniu sam wybierasz drogę.'),
    L('Stop exactly on a <b>glowing stone</b> to make friends with its wild pet.', 'Zatrzymaj się dokładnie na <b>świecącym kamieniu</b>, by zaprzyjaźnić się z jego dzikim zwierzakiem.'),
    L('Friends reroll your die and cheer for you in minigames.', 'Przyjaciele przerzucają twoją kość i kibicują ci w minigrach.'),
    L('After every round we all play a <b>quick minigame</b>. Better places win more treats.', 'Po każdej rundzie gramy w <b>szybką minigrę</b>. Lepsze miejsca dają więcej przysmaków.'),
    `${esc(SEASON_RULE[S.season])} ${esc(WX_RULE[S.wx])}`,
    L("Now, let's roll to see who goes first!", 'A teraz rzućmy, kto zaczyna!'),
  ];
  // skip the intro by vote: it ends once every person at the table has pressed it (bots don't vote)
  function skipHtml() {
    const ppl = S.seats.map((x, i) => i).filter(i => S.seats[i].human && !S.seats[i].bot), v = (S.skipV || []).filter(i => ppl.includes(i)).length;
    if (!ppl.length) return '';
    const mine = S.me >= 0 && ppl.includes(S.me), voted = (S.skipV || []).includes(S.me), cnt = ppl.length > 1 ? ` <i class="tt-vc">${v}/${ppl.length}</i>` : '';
    return `<div class="tt-acts">${mine && !voted ? btn('skipintro', L('Skip the intro', 'Pomiń wstęp') + cnt, '', '', 'ghost') : `<span class="tt-skipw">${L('Waiting for everyone to skip', 'Czekamy, aż wszyscy pominą')}${cnt}</span>`}</div>`;
  }
  // the how-to-play card for the intro, in the dock under the line-up
  function introHtml() {
    const { lines, k } = introStep();
    return `<div class="tt-introbar"><span class="hp">${petImg(HOST, 112, 'tt-hpi')}</span>
      <div class="tt-ibub"><b class="who">Tux</b><p>${lines[k]}</p><span class="tt-idots">${lines.map((_, j) => `<i${j <= k ? ' class="on"' : ''}></i>`).join('')}</span></div>
      ${skipHtml()}</div>`;
  }
  // the overlay leaves with a short fade and sink instead of vanishing
  let ovTimer = 0;
  function ovHide(el) {
    if (!ovKey && el.hidden) return; ovKey = ''; clearTimeout(ovTimer);
    if (el.hidden) return;
    el.classList.add('out'); ovTimer = setTimeout(() => { if (!ovKey && !destroyed) { el.hidden = true; el.classList.remove('out', 'in'); } }, 300);
  }
  // ----- the big overlays: the minigame wheel, minigame results, the Pet Show (the intro is the 3D line-up) -----
  function renderOv() {
    const el = $('tt-ov');
    if (!S || S.ph !== 'play') { ovHide(el); return; }
    let key = S.stage, html = '';
    if (S.stage === 'wheel' || S.stage === 'mini') {
      key += S.mini?.game;
      const pool = POOL.filter(g => g.max >= S.seats.length), pick = S.mini?.game;
      html = `<div class="tt-card"><h2>${L('Minigame time!', 'Czas na minigrę!')}</h2><div class="tt-wheel" data-pick="${esc(pick)}">${pool.map(g => `<span data-g="${g.id}">${esc(g.name)}<small>${esc(g.cut)}</small></span>`).join('')}</div><p class="tt-sub">${L('Everyone plays at once. Places pay treats: 1st gets the most.', 'Grają wszyscy naraz. Miejsca dają przysmaki, najwięcej za 1.')}</p></div>`;
    } else if (S.stage === 'minires' && S.miniRes) {
      const R = S.miniRes; key += R.game;
      html = `<div class="tt-card"><h2>${esc(gameName(R.game))}</h2><ol class="tt-mres">${R.order.map((i, k) => { const ch = R.cheered.find(c => c.s === i);
        return `<li style="animation-delay:${k * 120}ms"><i class="pos">${k + 1}</i>${avatarHtml(S.seats[i].color, S.seats[i].av, 32)}<b>${nm(i)}</b>${ch ? `<span class="tt-cheer">${pet({ sp: ch.sp }, 22)}${L('cheered up a place', 'awans dzięki kibicowi')}</span>` : ''}<strong>+${R.pay[k]} ${I.treat}</strong></li>`; }).join('')}</ol>
        ${R.pact ? `<p class="tt-sub">${L(`Buddy pact bonus: ${nm(R.pact[0])} and ${nm(R.pact[1])} get +3 each`, `Premia paktu: ${nm(R.pact[0])} i ${nm(R.pact[1])} dostają po +3`)}</p>` : ''}</div>`;
    } else if (S.stage === 'show' && S.show) {
      const { rib, pts } = S.show, order = S.seats.map((_, i) => i).sort((a, b) => pts[b] - pts[a]);
      html = `<div class="tt-card wide"><h2>${L('The Pet Show', 'Pokaz zwierzaków')}</h2><p class="tt-sub">${L('A rosette for every friend in your herd, and 2 points for every ribbon', 'Rozeta za każdego przyjaciela w stadzie i 2 punkty za każdą wstęgę')}</p>
        <div class="tt-ribs">${Object.entries(RIBBONS).map(([k, n], j) => `<div class="tt-rib" style="animation-delay:${300 + j * 450}ms"><span class="rib">${esc(n)}</span><span>${rib[k].length ? rib[k].map(nm).join(', ') : L('nobody', 'nikt')}</span></div>`).join('')}</div>
        <ol class="tt-mres">${order.map(i => `<li><i class="pos">${ptsW(pts[i])}</i>${avatarHtml(S.seats[i].color, S.seats[i].av, 32)}<b>${nm(i)}</b><span class="tt-herd">${S.pl[i].herd.map(f => pet(f, 24)).join('')}</span></li>`).join('')}</ol></div>`;
    } else { ovHide(el); return; }
    if (key !== ovKey) {
      // a new card: the old one (if any) slides away first, then the new one rises in over a soft dimmed backdrop
      const swap = ovKey && !el.hidden; ovKey = key; clearTimeout(ovTimer);
      const show = () => { if (destroyed || ovKey !== key) return; el.innerHTML = html; petPics(el); el.classList.remove('out'); el.hidden = false; void el.offsetWidth; el.classList.add('in'); if (S.stage === 'wheel') spinWheel(); };
      if (swap) { el.classList.add('out'); ovTimer = setTimeout(show, 260); } else show();
    }
  }
  function spinWheel() {
    const box = $('tt-ov').querySelector('.tt-wheel'); if (!box) return;
    const items = [...box.children], pick = box.dataset.pick, end = items.findIndex(x => x.dataset.g === pick);
    const total = Math.max(0, S.stageLeft - 900), steps = items.length * 2 + (end >= 0 ? end : 0); let k = 0;
    const step = () => { if (destroyed || !box.isConnected) return;
      items.forEach((x, j) => x.classList.toggle('on', j === k % items.length)); sfx.tick();
      if (k >= steps) { items[k % items.length].classList.add('won'); sfx.set(); say(L(`Minigame: <b>${esc(gameName(pick))}</b>`, `Minigra: <b>${esc(gameName(pick))}</b>`)); return; }
      k++; const u = k / steps; setTimeout(step, 50 + (total / steps) * 2 * u * u); };
    step();
  }

  // ----- events -----
  function who(s, you, they) { return isMe(s) ? you : they.replace('{n}', `<b>${nm(s)}</b>`); }
  function playEv(e) {
    const s = e.s, P = e.s != null ? S.seats[s] : null; void P;
    switch (e.t) {
      case 'round': big(L(`Round ${e.r}`, `Runda ${e.r}`), L(`of ${S.rounds}`, `z ${S.rounds}`), 1500); say(L(`Round ${e.r} of ${S.rounds}`, `Runda ${e.r} z ${S.rounds}`)); break;
      case 'firstgo': big(L('Who goes first?', 'Kto zaczyna?'), L('Everyone rolls a die', 'Każdy rzuca kością'), 1800); say(L('Everyone rolls a die. The highest roll goes first.', 'Każdy rzuca kością. Zaczyna najwyższy wynik.')); break;
      case 'first': throwDice(s, [e.d], e.d); sfx.draw(); say(who(s, L(`You roll <b>${e.d}</b>`, `Wyrzucasz <b>${e.d}</b>`), L(`{n} rolls <b>${e.d}</b>`, `{n} wyrzuca <b>${e.d}</b>`)) + (e.tie ? L(' in the tie-break', ' w dogrywce') : '')); break;
      case 'firsttie': say(L(`A tie! ${e.who.map(nm).join(', ')} roll again.`, `Remis! ${e.who.map(nm).join(', ')} rzucają jeszcze raz.`)); break;
      case 'order': big(L(`${nm(e.order[0])} goes first`, `Zaczyna: ${nm(e.order[0])}`), e.order.map((i, k) => `${k + 1}. ${nm(i)}`).join(' · '), 2600); say(L(`Turn order: ${e.order.map(nm).join(', ')}`, `Kolejność: ${e.order.map(nm).join(', ')}`)); break;
      case 'turn': say(who(s, L('Your turn', 'Twoja kolej'), L("{n}'s turn", 'Kolej: {n}'))); if (isMe(s)) sfx.turn(); break;
      case 'roll': throwDice(s, e.b ? [e.a, e.b] : [e.d], e.d); sfx.draw(); say(who(s, L(`You roll <b>${e.d}</b>`, `Wyrzucasz <b>${e.d}</b>`), L(`{n} rolls <b>${e.d}</b>`, `{n} wyrzuca <b>${e.d}</b>`)) + (e.b ? L(' with the Spyglass', ' z Lunetą') : '')); break;
      case 'reroll': throwDice(s, [e.d], e.d, pet({ sp: e.sp }, 34, 'tt-dpi'), e.was); sfx.whoosh?.(); say(L(`${esc(petName(e.sp))} rerolls for ${isMe(s) ? 'you' : nm(s)}: <s>${e.was}</s> → <b>${e.d}</b>. The new roll replaces the old one`, `${esc(petName(e.sp))} przerzuca dla ${isMe(s) ? 'ciebie' : nm(s)}: <s>${e.was}</s> → <b>${e.d}</b>. Nowy rzut zastępuje stary`)); petPics($('tt-die')); break;
      case 'boost': say(who(s, L(`Fewest friends: your ${esc(petName(e.sp))} can reroll again this turn`, `Najmniej przyjaciół: twój ${esc(petName(e.sp))} znów może przerzucić w tej turze`), L(`Fewest friends: {n}'s ${esc(petName(e.sp))} can reroll again`, `Najmniej przyjaciół: {n} znów może przerzucić (${esc(petName(e.sp))})`))); break;
      case 'fork': say(who(s, L(`You take the ${esc(routeName(e.j))}`, `Wybierasz: ${esc(routeName(e.j))}`), L(`{n} takes the ${esc(routeName(e.j))}`, `{n} wybiera: ${esc(routeName(e.j))}`))); break;
      case 'hop': scene?.walk(s, e.path); { let k = 0; const hopSfx = () => { if (destroyed || k++ >= e.path.length) return; sfx.plop?.(); setTimeout(hopSfx, 420); }; hopSfx(); } break;
      case 'stone': stoneEv(e); break;
      case 'slide': say(who(s, L('Icy brambles! You slide 2 stones on', 'Oblodzone jeżyny! Ślizgasz się 2 kamienie dalej'), L('Icy brambles! {n} slides 2 stones on', 'Oblodzone jeżyny! {n} ślizga się 2 kamienie dalej'))); sfx.whoosh?.(); break;
      case 'honey': say(L(`${isMe(s) ? 'You step' : nm(s) + ' steps'} in ${isMe(e.o) ? 'your' : nm(e.o) + "'s"} honey: ${treatsW(e.v)} to ${isMe(e.o) ? 'you' : nm(e.o)}`, `${isMe(s) ? 'Wchodzisz' : nm(s) + ' wchodzi'} w miód gracza ${nm(e.o)}: ${treatsW(e.v)} dla ${isMe(e.o) ? 'ciebie' : nm(e.o)}`)); scene?.cue(s, 'lose'); floatAt(scene?.seatPx(s), '−' + e.v, 'bad'); break;
      case 'egg': say(who(s, L('You find a Mystery Egg. It hatches in 2 turns', 'Znajdujesz tajemnicze jajo. Wykluje się za 2 tury'), L('{n} finds a Mystery Egg', '{n} znajduje tajemnicze jajo'))); scene?.cue(s, 'item'); sfx.set(); break;
      case 'hatch': say(L(`${isMe(s) ? 'Your' : nm(s) + "'s"} egg hatches: <b>${esc(petName(e.sp))}</b>!`, `Jajo ${isMe(s) ? 'się wykluwa' : 'gracza ' + nm(s) + ' się wykluwa'}: <b>${esc(petName(e.sp))}</b>!`)); scene?.cue(s, 'friend'); sfx.win?.(); break;
      case 'den': say(L(`A rare <b>${esc(petName(e.sp))}</b> comes out of the den!`, `Z nory wychodzi rzadki <b>${esc(petName(e.sp))}</b>!`)); sfx.set(); break;
      case 'called': say(L(`The Pet Whistle calls <b>${esc(petName(e.sp))}</b> over`, `Gwizdek przywołuje: <b>${esc(petName(e.sp))}</b>`)); sfx.whoosh?.(); break;
      case 'full': say(who(s, L('Your herd is full', 'Twoje stado jest pełne'), L("{n}'s herd is full", 'Stado gracza {n} jest pełne'))); break;
      case 'bought': say(L(`${isMe(s) ? 'You win' : nm(s) + ' wins'} <b>${esc(petName(e.sp))}</b> over with ${treatsW(e.c)}`, `${isMe(s) ? 'Przekonujesz' : nm(s) + ' przekonuje'} <b>${esc(petName(e.sp))}</b> za ${treatsW(e.c)}`)); scene?.cue(s, 'friend', SPECIES[e.sp]?.el); sfx.win?.(); bubble(s, `<span class="hot">♥</span>`); break;
      case 'showdown':
        if (e.ok) { say(L(`${esc(petName(e.sp))} wins <b>${esc(petName(e.wsp))}</b> over! It joins ${isMe(s) ? 'your' : nm(s) + "'s"} herd`, `${esc(petName(e.sp))} przekonuje: <b>${esc(petName(e.wsp))}</b>! Dołącza do stada ${isMe(s) ? 'twojego' : 'gracza ' + nm(s)}`)); scene?.cue(s, 'friend', SPECIES[e.wsp]?.el); sfx.win?.(); bubble(s, `<span class="hot">♥</span>`); if (isMe(s)) big(L('New friend!', 'Nowy przyjaciel!'), esc(petName(e.wsp)), 1300); }
        else { say(L(`${esc(petName(e.wsp))} isn't won over by ${esc(petName(e.sp))}`, `${esc(petName(e.wsp))} nie daje się przekonać (${esc(petName(e.sp))})`)); scene?.cue(s, 'miss'); sfx.bad?.(); }
        break;
      case 'flee': say(L(`${esc(petName(e.sp))} runs off down the trail`, `${esc(petName(e.sp))} ucieka dalej szlakiem`)); break;
      case 'leave': say(who(s, L(`You leave ${esc(petName(e.sp))} be`, `Zostawiasz: ${esc(petName(e.sp))}`), L(`{n} leaves ${esc(petName(e.sp))} be`, `{n} zostawia: ${esc(petName(e.sp))}`))); break;
      case 'use': say(who(s, L(`You use the ${esc(ITEMS[e.k].name)}`, `Używasz: ${esc(ITEMS[e.k].name)}`), L(`{n} uses the ${esc(ITEMS[e.k].name)}`, `{n} używa: ${esc(ITEMS[e.k].name)}`))); scene?.cue(s, 'item'); sfx.set(); break;
      case 'buy': say(who(s, L(`You buy the ${esc(ITEMS[e.k].name)}`, `Kupujesz: ${esc(ITEMS[e.k].name)}`), L(`{n} buys the ${esc(ITEMS[e.k].name)}`, `{n} kupuje: ${esc(ITEMS[e.k].name)}`))); sfx.pop(); break;
      case 'well': say(e.res === 'pet' ? L(`A wish comes true: a rare <b>${esc(petName(e.sp))}</b> appears!`, `Życzenie się spełnia: pojawia się rzadki <b>${esc(petName(e.sp))}</b>!`)
        : e.res === 'item' ? L(`The well gives ${isMe(s) ? 'you' : nm(s)} the ${esc(ITEMS[e.k].name)}`, `Studnia daje ${isMe(s) ? 'ci' : 'graczowi ' + nm(s)}: ${esc(ITEMS[e.k].name)}`)
        : e.res === 'treats' ? L(`The well gives ${isMe(s) ? 'you' : nm(s)} 8 treats`, `Studnia daje ${isMe(s) ? 'ci' : 'graczowi ' + nm(s)} 8 przysmaków`)
        : who(s, L('You walk past the well', 'Mijasz studnię'), L('{n} walks past the well', '{n} mija studnię'))); if (e.res !== 'no') { scene?.cue(s, 'item'); sfx.set(); } break;
      case 'offer': say(L(`${isMe(s) ? 'You offer' : nm(s) + ' offers'} ${isMe(e.o) ? 'you' : nm(e.o)} a buddy pact`, `${isMe(s) ? 'Proponujesz' : nm(s) + ' proponuje'} pakt: ${isMe(e.o) ? 'tobie' : nm(e.o)}`)); if (isMe(e.o)) sfx.turn(); break;
      case 'pact': say(L(`${nm(s)} and ${nm(e.o)} are buddies for ${PACT_ROUNDS} rounds`, `${nm(s)} i ${nm(e.o)} mają pakt na ${PACT_ROUNDS} rundy`)); scene?.cue(s, 'gain'); scene?.cue(e.o, 'gain'); sfx.set(); break;
      case 'nopact': say(L(`${nm(e.o)} says no thanks to the pact`, `${nm(e.o)} odmawia paktu`)); break;
      case 'pactend': say(L(`The pact of ${nm(s)} and ${nm(e.o)} ends`, `Pakt: ${nm(s)} i ${nm(e.o)} dobiega końca`)); break;
      case 'lure': say(L(`${isMe(s) ? 'You lure' : nm(s) + ' lures'} <b>${esc(petName(e.sp))}</b> away from ${isMe(e.o) ? 'you' : nm(e.o)}`, `${isMe(s) ? 'Zwabiasz' : nm(s) + ' zwabia'} <b>${esc(petName(e.sp))}</b> od ${isMe(e.o) ? 'ciebie' : 'gracza ' + nm(e.o)}`)); scene?.cue(s, 'friend', SPECIES[e.sp]?.el); scene?.cue(e.o, 'miss'); sfx.whoosh?.(); break;
      case 'cheerask': say(L('Pick a friend to cheer you on in the minigame', 'Wybierz przyjaciela, który pokibicuje ci w minigrze')); if (S.cheer && !S.cheer.done) sfx.turn(); break;
      case 'wheel': say(L('The minigame wheel spins…', 'Koło minigier się kręci…')); break;
      case 'minires': { const k = e.order.indexOf(S.me); if (k === 0) sfx.win(); say(L(`${esc(gameName(e.game))}: ${nm(e.order[0])} wins`, `${esc(gameName(e.game))}: wygrywa ${nm(e.order[0])}`)); break; }
      case 'show': say(L('The Pet Show!', 'Pokaz zwierzaków!')); sfx.set(); break;
      case 'late': if (isMe(s)) big(L('Out of time!', 'Koniec czasu!'), L('The safe choice was made for you', 'Wybrano za ciebie bezpieczną opcję'), 1400); else bubble(s, `<span>${L('Too slow!', 'Za wolno!')}</span>`); break;
      case 'end': {
        const won = S.res?.place[S.me] === 1; if (won) { sfx.win(); confetti(); } else sfx.lose?.(); scene?.cue(S.win, 'win');
        big(won ? L('You win!', 'Wygrywasz!') : L(`${nm(S.win)} wins!`, `${nm(S.win)} wygrywa!`), L('The Pet Show is over', 'Pokaz zwierzaków dobiegł końca'), 2200);
        clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400); break;
      }
    }
  }
  function stoneEv(e) {
    const s = e.s, px = scene?.seatPx(s);
    const msg = {
      treat: [L(`You get ${treatsW(e.v)}`, `Dostajesz ${treatsW(e.v)}`), L(`{n} gets ${treatsW(e.v)}`, `{n} dostaje ${treatsW(e.v)}`)],
      picnic: [L(`Picnic! You get ${treatsW(e.v)}`, `Piknik! Dostajesz ${treatsW(e.v)}`), L(`Picnic! {n} gets ${treatsW(e.v)}`, `Piknik! {n} dostaje ${treatsW(e.v)}`)],
      spring: [L(`The Hot Spring: your friends rest, +${e.v}`, `Gorące źródło: przyjaciele odpoczywają, +${e.v}`), L(`{n} rests at the Hot Spring, +${e.v}`, `{n} odpoczywa w gorącym źródle, +${e.v}`)],
      bramble: [L(`Brambles! You lose ${treatsW(-e.v)}`, `Jeżyny! Tracisz ${treatsW(-e.v)}`), L(`Brambles! {n} loses ${treatsW(-e.v)}`, `Jeżyny! {n} traci ${treatsW(-e.v)}`)],
      guarded: [L('The brambles miss you', 'Jeżyny cię omijają'), L('The brambles miss {n}', 'Jeżyny omijają: {n}')],
      nest0: [L('The nest is empty for you now', 'Gniazdo jest teraz dla ciebie puste'), L('The nest is empty for {n}', 'Gniazdo jest puste dla: {n}')],
      bench0: [L('Nobody is free for a pact', 'Nikt nie jest wolny do paktu'), L('Nobody is free for a pact with {n}', 'Nikt nie jest wolny do paktu z: {n}')],
    }[e.kind];
    if (msg) say(who(s, msg[0], msg[1]));
    if (e.v > 0) { floatAt(px, '+' + e.v, 'good'); scene?.cue(s, 'gain'); sfx.combo?.(1); }
    else if (e.v < 0) { floatAt(px, '−' + -e.v, 'bad'); scene?.cue(s, 'lose'); sfx.bad?.(); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; stateAt = Date.now();
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; bubbles.clear(); LOG.length = 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else say(s.stage === 'intro' ? L('Welcome to the Friendship Trail!', 'Witaj na Szlaku przyjaźni!') : s.turn >= 0 ? who(s.turn, L('Your turn', 'Twoja kolej'), L("{n}'s turn", 'Kolej: {n}')) : L('Back on the trail', 'Z powrotem na szlaku'));
    } else for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); } // hops go to the scene before the new positions
    render(); scene?.setState(s); camFocus();
  }
  function render() {
    if (!S) return;
    setHtml($('tt-info'), `${L(`Round ${Math.min(S.round, S.rounds)}/${S.rounds}`, `Runda ${Math.min(S.round, S.rounds)}/${S.rounds}`)}<span class="tt-n"> · ${SEASON_NAME[S.season]} · ${WX_NAME[S.wx]}</span>`);
    $('tt-code').textContent = Rm?.code || '';
    buildTags(); renderSide(); renderDock(); renderOv();
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), place = S.res.place, n = S.seats.length;
    const firsts = S.seats.map((_, i) => i).filter(i => place[i] === 1);
    const head = firsts.includes(S.me) ? (firsts.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : L(`${nm(S.win)} wins!`, `${nm(S.win)} wygrywa!`);
    const mine = S.me >= 0 ? place[S.me] : 0;
    const rib = S.show?.rib || {}, ribsOf = i => Object.keys(RIBBONS).filter(k => rib[k]?.includes(i));
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>${mine > 1 ? `<p>${L(`You came ${mine} of ${n}.`, `Twoje miejsce: ${mine} z ${n}.`)}</p>` : ''}
      <ol class="score">${S.res.order.map((i, k) => { const p = S.seats[i], q = S.pl[i], rs = ribsOf(i);
        return `<li class="${place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${isMe(i) ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${q.herd.length} friend${q.herd.length === 1 ? '' : 's'} · ${q.wins} minigame win${q.wins === 1 ? '' : 's'} · ${treatsW(q.treats)}`, `przyjaciele: ${q.herd.length} · wygrane minigry: ${q.wins} · ${treatsW(q.treats)}`)}</span>
          <span class="tt-herd">${q.herd.map(f => pet(f, 26)).join('')}</span>${rs.length ? `<span class="tt-rbs">${rs.map(k => `<span class="rib">${esc(RIBBONS[k])}</span>`).join('')}</span>` : ''}</div>
          <strong><span>${ptsW(S.res.pts[i])}</span></strong>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Walk the trail again', 'Przejdź szlak jeszcze raz'))}</div></div>`;
    petPics(el); el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length; if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Walk the trail again', 'Przejdź szlak jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div'); f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t?.on ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.on ? t.y - 30 : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`; root.append(f); setTimeout(() => f.remove(), 1600);
  }
  function confetti() {
    if (myBurst()) return;
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
    const cols = ['#3f9a52', '#e0592f', '#2f86cc', '#d9a400', '#fff4e2', '#ff8fab'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0] }));
    let t = 0;
    const step = () => { g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0; };
    step();
  }

  // the clock: the countdown, and the moment your choice unlocks after the walk or message it waits for
  let wasReady = false;
  let introK = -1;
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    const r = ready();
    if (r !== wasReady) { wasReady = r; renderDock(); }
    if (S.stage === 'intro') { const k = introStep().k; if (k !== introK) { introK = k; renderDock(); } }
    if (S.tLeft >= 0) { const n = timeLeft(); if (n !== lastTick) { lastTick = n; renderDock(); if ((myPend() || (S.stage === 'cheer' && S.cheer && !S.cheer.done)) && n <= 3 && n > 0) sfx.tick(); } }
  }, 200);

  // ----- input -----
  function send(a) { if (Date.now() - sent < 400) return; sent = Date.now(); sfx.click(); ctx.act(a); setTimeout(() => !destroyed && renderDock(), 750); }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, d = b.dataset;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; return; }
    if (a === 'rules') { sfx.click(); ctx.rules(); return; }
    if (a === 'leave') { sfx.click(); ctx.leave(); return; }
    if (a === 'map') { sfx.click(); mapOn = !mapOn; paintMapBtn(); camFocus(); return; }
    if (a === 'again') { sfx.click(); ctx.again(); return; }
    if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); return; }
    if (a === 'lobby') { sfx.click(); ctx.toLobby(); return; }
    if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); return; }
    if (a === 'cheer') { if (S?.stage === 'cheer') send({ t: 'cheer', i: +d.i }); return; }
    if (a === 'skipintro') { if (S?.stage === 'intro') send({ t: 'skip' }); return; }
    if (!ready()) return;
    if (a === 'roll') send({ t: 'roll' });
    else if (a === 'item') send({ t: 'item', k: d.k });
    else if (a === 'keep') send({ t: 'reroll', i: -1 });
    else if (a === 'reroll') send({ t: 'reroll', i: +d.i });
    else if (a === 'fork') send({ t: 'fork', j: +d.j });
    else if (a === 'buy') send({ t: 'shop', k: d.k || null });
    else if (a === 'meet') send({ t: 'meet', k: +d.k });
    else if (a === 'treat') send({ t: 'meet', treat: true });
    else if (a === 'skip') send({ t: 'meet', skip: true });
    else if (a === 'well') send({ t: 'well', yes: !!d.y });
    else if (a === 'bench') send({ t: 'bench', o: +d.o });
    else if (a === 'pact') send({ t: 'pact', yes: !!d.y });
    else if (a === 'lure') send({ t: 'lure', yes: !!d.y });
  });
  root.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .round'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover(); });
  const onKey = e => { if (e.key === 'm' && !e.target.closest('input, textarea')) { mapOn = !mapOn; paintMapBtn(); camFocus(); } };
  addEventListener('keydown', onKey);
  const onResize = () => layout(); addEventListener('resize', onResize);

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(dieTimer); scene?.dispose();
    },
  };
}
void FORKS; void STONES; void HERD_MAX;
