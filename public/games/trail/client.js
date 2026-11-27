// Friendship Trail game view: the HUD over the 3D island. Draws what the server says and sends your choices.
// Messages never hold the game up (Kuba): each one stays on top until the next one replaces it, then drops into the
// little list of the last three under it. The camera follows whoever is playing; the Whole map button pulls back to
// the island, with labels and outlines on the wild pets, stalls and special stones.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { music } from '../../music.js';
import { L } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { petImg, petPics } from '../../petpic.js';
import { uiz } from '../../uiz.js';
import { SPECIES } from '../farm/data.js';
import { stoneSvg, TREAT_SVG } from './icons.js';
import {
  NODES, FORKS, routeName, near, matchup, oddsOf, priceOf, ITEMS, ITEM_IDS, ITEM_MAX, LURE, HERD_MAX, STONES, SEASON_RULE, WX_RULE,
  POOL, RIBBONS, EL_NAME, EL_COL, PACT_ROUNDS, ribbonsOf, showPts, landsOf,
} from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  me: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  noteOff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13" opacity=".45"/><circle cx="6.5" cy="18" r="2.5" opacity=".45"/><circle cx="17.5" cy="16" r="2.5" opacity=".45"/><path d="M3 3l18 18"/></svg>',
  treat: TREAT_SVG, // Pawperty's bone: the site's one treat icon
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
const WX_NAME = { sunny: L('Sunny', 'Słonecznie'), cloudy: L('Cloudy', 'Pochmurno'), rain: L('Rain', 'Deszcz'), wind: L('Windy', 'Wietrznie'), rainbow: L('Rainbow', 'Tęcza'), aurora: L('Aurora', 'Zorza') };
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
        ${music.available ? `<button type="button" class="round" data-a="music" aria-pressed="${music.on}" aria-label="${L('Toggle music', 'Włącz lub wyłącz muzykę')}" title="${L('Music', 'Muzyka')}">${music.on ? I.note : I.noteOff}</button>` : ''}
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="tt-news" aria-live="polite"><div class="tt-host" id="tt-host"><span class="hp">${petImg(HOST, 50, 'tt-hpi')}</span><div class="banner" id="tt-banner"></div></div><div class="tt-log" id="tt-log"></div></div>
      <div class="tt-side" id="tt-side"></div>
      <div class="tt-die" id="tt-die" hidden></div>
      <div class="shout" id="tt-big" aria-live="assertive"></div>
      <div class="tt-splash" id="tt-splash" aria-hidden="true"></div>
      <div class="tt-dock" id="tt-dock"></div>
      <div class="tt-ov" id="tt-ov" hidden></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.tt'), $ = id => root.querySelector('#' + id);
  petPics(root.querySelector('.tt-news'));
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl), marksEl = root.querySelector('.tt-marks');
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
  let peekUntil = 0; // each round opens with a short look over the whole island, so everyone sees where the wild pets are
  let lastPendK = '';
  function camFocus() {
    if (!scene || !S) return;
    const turnish = S.ph === 'play' && ['turn', 'rolled', 'walk', 'land', 'next'].includes(S.stage) && S.turn >= 0 || (S.pend && !['pact'].includes(S.pend.k));
    scene.focus(turnish ? (S.pend && S.pend.k !== 'pact' ? S.pend.s : S.turn) : -1);
    scene.setMap(mapOn || Date.now() < peekUntil);
    scene.setFork?.(S.ph === 'play' && S.pend?.k === 'fork' ? S.pl[S.pend.s].pos : null, S.pend?.opts || []);
    scene.setLineup?.(lineMode());
    { const pk = S.pend ? S.pend.k + S.pend.s + ':' + (S.pend.id ?? '') : ''; if (pk !== lastPendK) { lastPendK = pk; if (S.pend?.k === 'meet') scene.emote?.(S.pend.s, 'surprise'); if (['shop', 'well', 'bench'].includes(S.pend?.k)) landFx(S.pend.k === 'shop' ? 'stall' : S.pend.k, S.pend.s, 0); } } // a wild pet: jump back in surprise
    scene.setThink?.(S.ph === 'play' && S.pend && ['card', 'fork', 'shop', 'meet', 'well', 'bench', 'lure'].includes(S.pend.k) ? S.pend.s : -1); // hand on chin while choosing
    root.classList.toggle('lineup', ['intro', 'order'].includes(lineMode())); root.classList.toggle('intro', S?.ph === 'play' && S.stage === 'intro');
  }
  // the start line-up: the intro, the roll for the first turn, and the moment the order is announced
  const lineMode = () => (!S ? null : S.show && (S.stage === 'show' || S.ph === 'end') ? 'show' : S.ph !== 'play' ? null : S.stage === 'intro' ? 'intro' : S.stage === 'order' || (S.stage === 'next' && S.turn < 0 && S.round === 1) ? 'order' : null);
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
    // name tags never pile on each other (the start line-up, two players on one stone): whoever's go it is keeps
    // their spot, then you, then the rest; a tag that would cover one already placed steps up above it
    const now = S ? nowSeat() : -1, ord = tagEls.map((_, i) => i).sort((a, b) => (b === now) - (a === now) || isMe(b) - isMe(a) || a - b);
    const put = [];
    for (const i of ord) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      el.style.visibility = t.on ? '' : 'hidden';
      if (!t.on) continue;
      const pl = el.lastElementChild, w = pl._w ||= pl.offsetWidth, h = pl._h ||= pl.offsetHeight;
      let y = t.y;
      for (let k = 0; k < put.length + 1; k++) {
        const hit = put.find(r => Math.abs(r.x - t.x) < (r.w + w) / 2 + 2 && Math.abs(r.y - y) < (r.h + h) / 2 + 1);
        if (!hit) break; y = hit.y - (hit.h + h) / 2 - 2;
      }
      put.push({ x: t.x, y, w, h });
      el.style.zIndex = i === now ? 3 : isMe(i) ? 2 : 1;
      placer.add(el, t.x, t.y);
    }
    // labels for the wild pets, stalls and special stones once the camera has pulled back far enough
    const show = info.zoom > .55 && scene;
    marksEl.classList.toggle('on', !!show);
    if (!show) return;
    const list = scene.marks(), seen = new Set();
    const placed = []; // labels never sit on top of each other: wild pets first, then honey, then stones; a label that would cover another moves up, else hides
    list.sort((a, b) => (a.k === 'wild' ? 0 : a.k === 'honey' ? 1 : 2) - (b.k === 'wild' ? 0 : b.k === 'honey' ? 1 : 2));
    for (const m of list) {
      if (m.k === 'stone' && m.kind === 'picnic') continue; // picnics are many and their icon says it all: fewer labels keep the map readable (Kuba 2026-11-27)
      const k = m.k === 'wild' ? 'w' + m.w.id : m.k === 'honey' ? 'h' + m.pos : 's' + m.i; seen.add(k);
      let el = markEls.get(k);
      if (!el) {
        el = document.createElement('div');
        if (m.k === 'wild') { el.className = 'tt-mark wild'; el.style.setProperty('--el', EL_COL[m.w.el]); el.innerHTML = `<b>${esc(petName(m.w.sp))}</b><small>${EL_NAME[m.w.el]}${m.w.rare ? ' · ' + RARE[m.w.rare] : ''}</small>`; }
        else if (m.k === 'honey') { el.className = 'tt-mark honey'; el.innerHTML = `<b>${L('Honey Pot', 'Garnek miodu')}</b><small>${nm(S.honey[m.pos])}</small>`; }
        else { el.className = 'tt-mark stone ' + m.kind; el.innerHTML = `<b>${stoneSvg(m.kind)}${STONE_NAME[m.kind]}</b>`; }
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
    // the clear band starts under the top bar, or under Tux's news where it sits at the top (phones); on desktop the news
    // is in the bottom-left corner now and must not count as top HUD, or the player in focus lands at the bottom edge
    const nw = root.querySelector('.tt-news')?.getBoundingClientRect(), bar = root.querySelector('.hud .tl')?.getBoundingClientRect();
    const top = Math.max(bar?.bottom || 80, nw && nw.height && nw.top < innerHeight / 2 ? nw.bottom : 0);
    const dock = $('tt-dock').getBoundingClientRect();
    // the camera keeps the bottom third clear for choices, so a tall panel (the stall) never covers the player
    scene?.setHud(top, Math.max(dock.height ? innerHeight - dock.top : 0, innerHeight * .3));
  }

  // ----- name tags -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map(p => `<div class="tt-tag"><div class="bub"></div><div class="plate${tagCls(p)}">${tagFace(p)}<span class="cnt"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
      tagsEl.classList.add('pick');
    }
    const now = performance.now();
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', S.ph === 'play' && (nowSeat() === i));
      const cnt = el.querySelector('.cnt'), was = cnt._h;
      setHtml(cnt, `${I.treat}${S.pl[i].treats}`); if (cnt._h !== was) el.lastElementChild._w = 0; // its width changed
      const b = bubbles.get(i);
      const bb = el.firstElementChild, was2 = bb._h; setHtml(bb, b && b.until > now ? b.html : ''); if (bb._h !== was2 && bb._h) petPics(bb);
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
    const rib = ribbonsOf(S.pl), pts = showPts(S.pl, rib), top = Math.max(...pts); const plc = placesOf();
    const firstChip = i => { const k = S.first?.key?.[i]; return S.stage === 'order' && k?.length ? `<span class="tt-fr" title="${L('Roll for the first turn', 'Rzut o pierwszeństwo')}">${k.join(' · ')}</span>` : ''; };
    const rows = (S.order?.length === S.seats.length ? S.order : S.seats.map((_, i) => i)).map(i => { const p = S.seats[i];
      const q = S.pl[i], egg = q.egg ? `<span class="tt-egg" title="${L(`Mystery Egg: hatches in ${q.egg} turn${q.egg > 1 ? 's' : ''}`, `Tajemnicze jajo: wykluje się za ${q.egg} tur${q.egg > 1 ? 'y' : 'ę'}`)}"></span>` : '';
      const items = q.items.map(k => `<span class="tt-it" title="${esc(ITEMS[k].name)}">${itemIc(k, 'tt-iis')}</span>`).join('');
      const pact = q.pact ? `<span class="tt-pact" title="${L(`Buddy pact with ${nm(q.pact.w)}`, `Pakt z: ${nm(q.pact.w)}`)}">♥ ${nm(q.pact.w)}</span>` : '';
      const held = Object.keys(RIBBONS).filter(k => rib[k].includes(i)).map(k => RIBBONS[k]);
      const ptsTip = L(`Pet Show points if it ended now: ${q.herd.length} for friends + ${held.length * 2} for ribbons${held.length ? ' (' + held.join(', ') + ')' : ''}`, `Punkty na Pokazie, gdyby był teraz: ${q.herd.length} za przyjaciół + ${held.length * 2} za wstęgi${held.length ? ' (' + held.join(', ') + ')' : ''}`);
      return `<div class="${pbRowCls(p.fl)} profrow tt-row${nowSeat() === i && S.ph === 'play' ? ' now' : ''}${isMe(i) ? ' mine' : ''}">${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}
        <div class="tt-rw"><div class="tt-rn"><span class="tt-rk p${plc[i]}" title="${ordW(plc[i])} ${L('place', 'miejsce')}">${plc[i]}</span><b>${nameHtml(p.name, p.fl)}</b><span class="tt-sp${pts[i] === top ? ' lead' : ''}" title="${esc(ptsTip)}">★${pts[i]}</span><span class="tt-tr">${I.treat}${q.treats}</span>${firstChip(i)}</div>
        <div class="tt-herd">${q.herd.map(f => `<span class="tt-pet${f.start ? ' st' : ''}${f.cheer ? '' : ' used'}" style="--el:${EL_COL[f.el]}" title="${esc(`${f.name || petName(f.sp)} · ${EL_NAME[f.el]}${f.cheer ? '' : L(' · has cheered', ' · już kibicował')}`)}">${pet(f, 24)}</span>`).join('')}${egg}</div>
        ${items || pact ? `<div class="tt-extra">${items}${pact}</div>` : ''}</div>${rowBg(p.fl)}</div>`;
    }).join('') + `<div class="tt-key"><span class="tt-sp">★</span>${L('Pet Show points', 'punkty na Pokazie')}<span class="tt-tr">${I.treat}</span>${L('treats', 'przysmaki')}</div>`;
    setHtml($('tt-side'), rows); petPics($('tt-side')); pbRows($('tt-side'));
  }

  // ----- messages, bottom left on desktop (the top middle was too busy): the newest in Tux's bubble, the last two under it, fading -----
  function say(html) {
    if (LOG[0] === html) return;
    LOG.unshift(html); LOG.length = Math.min(LOG.length, 3);
    const b = $('tt-banner'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    const h = $('tt-host'); h.classList.remove('talk'); void h.offsetWidth; h.classList.add('talk');
    $('tt-log').innerHTML = LOG.slice(1).map((x, i) => `<div style="opacity:${(.92 - i * .2).toFixed(2)}">${x}</div>`).join('');
    layout();
  }
  // places by Pet Show points, then treats (ties share a place), like the end of the game
  function placesOf() {
    const pts = showPts(S.pl), key = i => pts[i] * 1000 + S.pl[i].treats;
    return S.seats.map((_, i) => 1 + S.seats.filter((_, j) => key(j) > key(i)).length);
  }
  const ordW = n => L(['1st', '2nd', '3rd'][n - 1] || n + 'th', n + '.');
  // whose turn, as a band across the screen in their colour (the Mario Party lesson: a turn change you can't miss)
  let splashT = 0;
  function splash(s) {
    const el = $('tt-splash'), p = S.seats[s]; if (!el || !p) return;
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<div class="in">${avatarHtml(p.color, p.av, 54, frameCls(p.fl))}<div><b>${isMe(s) ? L('Your turn!', 'Twoja kolej!') : L(`${nm(s)}'s turn`, `Kolej: ${nm(s)}`)}</b><small>${L(`Round ${S.round} of ${S.rounds}`, `Runda ${S.round} z ${S.rounds}`)} · ${ordW(placesOf()[s])} ${L('place', 'miejsce')}</small></div></div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(splashT); splashT = setTimeout(() => el.classList.remove('show'), 2400);
  }
  // the steps left, counting down over the walker's head stone by stone
  const stepsLeft = new Map();
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
    // the clock is filled in after the redraw, so a time tick never rebuilds the cards under it (no blink)
    const t = timeLeft(), clock = t >= 0 && S.timer ? '<span class="tt-clock"></span>' : '';
    if (S.stage === 'intro') html = introHtml();
    else if (S.stage === 'cheer') html = cheerHtml(clock);
    else if (myPend() && busyLeft() > 0) html = `<div class="tt-wait"><span>${L('Wait for it…', 'Chwileczkę…')}</span></div>`;
    else if (myPend()) html = pendHtml(S.pend, clock);
    else if (S.pend && S.ph === 'play') {
      const w = S.seats[S.pend.s];
      const what = { first: L('rolls to see who goes first', 'rzuca, kto zaczyna'), card: L('is picking a trail card', 'wybiera kartę szlaku'), fork: L('is picking a route', 'wybiera trasę'), shop: L('is at the stall', 'jest przy straganie'),
        meet: L('meets a wild pet', 'spotyka dzikiego zwierzaka'), well: L('is at the Wishing Well', 'stoi przy studni życzeń'), bench: L('is on the Pact Bench', 'siedzi na ławce paktu'),
        pact: L('is thinking about a pact', 'myśli o pakcie'), lure: L('eyes a pet to lure', 'chce zwabić zwierzaka') }[S.pend.k] || L('is thinking', 'myśli');
      html = `<div class="tt-wait">${avatarHtml(w.color, w.av, 30)}<span>${isMe(S.pend.s) ? L('A bot plays for you', 'Bot gra za ciebie') : `${nm(S.pend.s)} ${what}…`}</span></div>`;
    }
    const kind = S.stage + '|' + (S.pend ? S.pend.k + S.pend.s : '') + '|' + (myPend() ? 1 : 0);
    if (html && kind !== el._kind) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
    el._kind = kind;
    setHtml(el, html); petPics(el);
    const ck = el.querySelector('.tt-clock'); if (ck) { const tx = t + 's'; if (ck.textContent !== tx) ck.textContent = tx; ck.classList.toggle('late', t <= 5); }
    layout();
  }
  const btn = (a, label, sub = '', attrs = '', cls = '') => `<button type="button" class="btn ${cls}" data-a="${a}" ${attrs}><span class="l">${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
  // a choice tile: a picture, a name and a line of detail, with an optional price chip; every tile in a row is the same size
  const opt = (a, ic, t, sub = '', attrs = '', cls = '', price = '') => `<button type="button" class="btn tt-opt ${cls}" data-a="${a}" ${attrs}><span class="ic">${ic}</span><span class="tx"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${price}</button>`;
  const priceTag = c => `<span class="tt-price">${I.treat}${c}</span>`;
  // a trail card in your hand: its number, and where it takes you (a wild pet's stone glows pink)
  // a trail card's face: how far it goes and what it lands on, seen from stone `pos`
  function cardFace(d, pos) {
    const { ends, fork } = landsOf(pos, d);
    const pets = ends.map(at => S.wild.find(w => w.pos === at)).filter(Boolean);
    const at = ends[0], kind = NODES[at]?.kind;
    const where = pets.length ? L(`Wild ${esc(petName(pets[0].sp))}!`, `Dziki ${esc(petName(pets[0].sp))}!`) : fork && ends.length > 1 ? L('Fork ahead: you pick', 'Rozwidlenie: ty wybierasz') : esc(STONES[kind] || '');
    return { where, cls: pets.length ? ' hot' : kind === 'bramble' && ends.length === 1 ? ' bad' : '',
      inner: `<b>${d}</b><small>${L(d === 1 ? 'stone' : 'stones', d === 1 ? 'kamień' : d < 5 ? 'kamienie' : 'kamieni')}</small><span>${pets.length ? pet(pets[0], 30) : fork && ends.length > 1 ? '' : stoneSvg(kind)}${where}</span>` };
  }
  function cardHtml(d, i) {
    const c = cardFace(d, S.pl[S.me].pos);
    return `<button type="button" class="btn tt-tc${c.cls}" data-a="card" data-i="${i}" aria-label="${L(`Walk ${d}`, `Idź o ${d}`)}: ${c.where}">
      ${c.inner}</button>`;
  }
  function pendHtml(P, clock) {
    const p = S.pl[S.me];
    const head = (h, sub = '') => `<div class="tt-q"><b>${h}</b>${clock}${sub ? `<span>${sub}</span>` : ''}</div>`;
    if (P.k === 'first') {
      const tie = S.first?.tie?.includes(S.me);
      return `${head(tie ? L('A tie! Roll again', 'Remis! Rzuć jeszcze raz') : L('Who goes first?', 'Kto zaczyna?'), tie ? L('Only the tied players roll again', 'Rzucają tylko gracze z remisem') : L('Everyone rolls once. The highest roll starts, then the rest in order of their rolls.', 'Każdy rzuca raz. Zaczyna najwyższy wynik, potem reszta według rzutów.'))}
        <div class="tt-acts">${btn('roll', L('Roll the die', 'Rzuć kością'), '', '', 'big')}</div>`;
    }
    if (P.k === 'card') {
      const armed = [p.berry && ITEMS.berry.name, p.whistle && ITEMS.whistle.name, p.charm && ITEMS.charm.name].filter(Boolean);
      const items = p.items.map((k, i) => opt('item', itemIc(k), `${L('Use', 'Użyj')}: ${esc(ITEMS[k].name)}`, k === 'honey' && p.pos < 0 ? L('Not in the start meadow', 'Nie na łące startowej') : esc(ITEMS[k].tx), `data-k="${k}" data-n="${i}"${k === 'honey' && p.pos < 0 ? ' disabled' : ''}`)).join('');
      const hint = L('Play a card to walk exactly that many stones. Each card shows where it takes you.', 'Zagraj kartę, by przejść dokładnie tyle kamieni. Każda karta pokazuje, dokąd cię zaprowadzi.');
      const swaps = (P.f || []).map(i => { const f = p.herd[i]; return opt('redraw', pet(f, 34), L(`New cards from ${esc(f.name || petName(f.sp))}`, `Nowe karty od: ${esc(f.name || petName(f.sp))}`), f.el === 'Spark' ? L('swaps your hand, every round', 'wymienia ci karty, co rundę') : L('swaps your hand, once', 'wymienia ci karty, raz'), `data-f="${i}"`); }).join('');
      return `${head(L('Your turn: pick a trail card', 'Twoja kolej: wybierz kartę szlaku'), armed.length ? L(`Ready: ${armed.join(', ')}`, `Gotowe: ${armed.join(', ')}`) : hint)}
        <div class="tt-hand">${p.hand.map((d, i) => cardHtml(d, i)).join('')}</div>
        ${items || swaps ? `<div class="tt-acts">${items}${swaps}</div>` : ''}`;
    }
    if (P.k === 'fork') return `${head(L('Which way?', 'Którędy?'), L('Glowing stones have a wild pet: stop exactly on one to meet it', 'Świecące kamienie mają dzikiego zwierzaka: zatrzymaj się dokładnie na nim, by go spotkać'))}
      <div class="tt-acts">${P.opts.map(j => { const n = petsAhead(j); return opt('fork', `<svg class="tt-ii" viewBox="0 0 32 32" aria-hidden="true"><path d="M15 6v23" ${IK}/><path d="M6 8h16l4 3.5-4 3.5H6z" fill="#ffc93c" ${IK}/><path d="M26 17H10l-4 3.5 4 3.5h16z" fill="#fff6e2" ${IK}/></svg>`, esc(routeName(j)), n ? L(`${n} wild pet${n > 1 ? 's' : ''} on the way`, `dzikie zwierzaki po drodze: ${n}`) : L('no wild pets in sight', 'nie widać dzikich zwierzaków'), `data-j="${j}"`, (n ? 'hot ' : '') + 'r' + P.opts.indexOf(j)); }).join('')}</div>`;
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
    const step = (n, en, pl) => `<li><i>${n}</i><span>${L(en, pl)}</span></li>`;
    return `<div class="tt-q tt-cheerq"><b>${L('Minigame next! Who cheers you on?', 'Za chwilę minigra! Kto ci kibicuje?')}</b>${clock}</div>
      <ol class="tt-steps">${step(1, 'Pick a friend from your herd', 'Wybierz przyjaciela ze stada')}${step(2, 'Everyone plays the minigame', 'Wszyscy grają w minigrę')}${step(3, 'Finish behind someone? Your friend lifts you one place up', 'Skończysz za kimś? Przyjaciel podnosi cię o miejsce wyżej')}</ol>
      <div class="tt-acts">${can.map(k => opt('cheer', pet(p.herd[k], 34), esc(p.herd[k].name || petName(p.herd[k].sp)), EL_NAME[p.herd[k].el], `data-i="${k}"`)).join('')}</div>
      <p class="tt-note">${L('A friend who lifts you is used up until a Hot Spring. If they don\'t need to help, they stay ready.', 'Przyjaciel, który cię podniesie, odpoczywa do gorącego źródła. Jeśli nie musi pomagać, zostaje gotowy.')}</p>
      <div class="tt-acts">${btn('cheer', L('No cheering this time', 'Tym razem bez kibica'), '', 'data-i="-1"', 'ghost')}</div>`;
  }
  function petsAhead(j) { let n = 0, at = j; const seen = new Set(); for (let k = 0; k < 6; k++) { for (const w of S.wild) if (!seen.has(w.id) && w.pos === at) { seen.add(w.id); n++; } at = NODES[at].next[0]; } return n; }

  // ----- Tux's intro: one sentence at a time in the big banner at the bottom, while the camera is on him -----
  function introStep() {
    const lines = INTRO_LINES(S), ms = S.introMs || 29000, el = ms - Math.max(0, S.stageLeft - (Date.now() - stateAt));
    // each line stays up in step with how long it is to read (Kuba 2026-11-27: too fast), not an even share
    const w = lines.map(x => 30 + x.replace(/<[^>]+>/g, '').length), tot = w.reduce((a, b) => a + b, 0), u = el / (ms - 500) * tot;
    let k = 0, acc = w[0]; while (k < lines.length - 1 && u >= acc) acc += w[++k];
    return { lines, k };
  }
  const INTRO_LINES = S => [
    L(`Hello, hello! I'm <b>Tux</b>, your host tonight!`, `Witam, witam! Jestem <b>Tux</b> i prowadzę dzisiejszą zabawę!`),
    L('Welcome to the <b>Friendship Trail</b>!', 'Witajcie na <b>Szlaku przyjaźni</b>!'),
    L(`Whoever has the most <b>Pet Show points</b> after ${S.rounds} rounds wins.`, `Wygrywa ten, kto po ${S.rounds} rundach ma najwięcej <b>punktów na Pokazie</b>.`),
    L('Every friend in your herd is 1 point, and every ribbon is 2.', 'Każdy przyjaciel w stadzie to 1 punkt, a każda wstęga to 2.'),
    L('Each turn you play one of your <b>trail cards</b> and walk exactly that many stones. At a fork, you pick the way.', 'W każdej turze zagrywasz jedną z <b>kart szlaku</b> i idziesz dokładnie o tyle kamieni. Na rozwidleniu sam wybierasz drogę.'),
    L('Stop exactly on a <b>glowing stone</b> to make friends with its wild pet.', 'Zatrzymaj się dokładnie na <b>świecącym kamieniu</b>, by zaprzyjaźnić się z jego dzikim zwierzakiem.'),
    L('Friends can swap your cards for new ones and cheer for you in minigames.', 'Przyjaciele mogą wymienić ci karty na nowe i kibicują ci w minigrach.'),
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
  // the standings so far, under each minigame's results (Mario Party shows them between turns): place, points, treats
  function standingsHtml() {
    const plc = placesOf(), pts = showPts(S.pl), order = S.seats.map((_, i) => i).sort((a, b) => plc[a] - plc[b]);
    return `<div class="tt-stand"><b>${L(`Standings after round ${S.round} of ${S.rounds}`, `Stan po rundzie ${S.round} z ${S.rounds}`)}</b>${order.map(i => `<div class="${pbRowCls(S.seats[i].fl)} profrow r${isMe(i) ? ' mine' : ''}"><span class="tt-rk p${plc[i]}">${plc[i]}</span>${avatarHtml(S.seats[i].color, S.seats[i].av, 24, frameCls(S.seats[i].fl))}<span class="nm"><b>${nameHtml(S.seats[i].name, S.seats[i].fl)}</b></span><span class="tt-sp">★${pts[i]}</span><span class="tt-tr">${I.treat}${S.pl[i].treats}</span>${rowBg(S.seats[i].fl)}</div>`).join('')}</div>`;
  }
  // ----- the big overlays: the minigame wheel, minigame results, the Pet Show (the intro is the 3D line-up) -----
  function renderOv() {
    const el = $('tt-ov');
    if (!S || S.ph !== 'play') { ovHide(el); return; }
    let key = S.stage === 'mini' ? 'wheel' : S.stage, html = ''; // wheel -> mini is the same card: no slide-out and pop-in again as the curtain shuts
    if (S.stage === 'wheel' || S.stage === 'mini') {
      key += S.mini?.game;
      const pool = POOL.filter(g => g.max >= S.seats.length), pick = S.mini?.game;
      html = `<div class="tt-card tt-wcard"><h2>${L('Minigame time!', 'Czas na minigrę!')}</h2><div class="tt-wheel" data-pick="${esc(pick)}">${pool.map(g => `<span data-g="${g.id}"><img src="/gamepics/${g.id}-s.jpg" alt="" decoding="async"><b>${esc(g.name)}</b><small>${esc(g.cut)}</small></span>`).join('')}</div><p class="tt-sub">${L('Everyone plays at once. Places pay treats: 1st gets the most.', 'Grają wszyscy naraz. Miejsca dają przysmaki, najwięcej za 1.')}</p></div>`;
    } else if (S.stage === 'minires' && S.miniRes) {
      const R = S.miniRes; key += R.game;
      html = `<div class="tt-card"><h2>${esc(gameName(R.game))}</h2><ol class="tt-mres">${R.order.map((i, k) => { const ch = R.cheered.find(c => c.s === i);
        return `<li class="${pbRowCls(S.seats[i].fl)} profrow" style="animation-delay:${k * 120}ms"><i class="pos">${k + 1}</i>${avatarHtml(S.seats[i].color, S.seats[i].av, 32, frameCls(S.seats[i].fl))}<b>${nameHtml(S.seats[i].name, S.seats[i].fl)}</b>${ch ? `<span class="tt-cheer">${pet({ sp: ch.sp }, 22)}${L('cheered up a place', 'awans dzięki kibicowi')}</span>` : ''}<strong>+${R.pay[k]} ${I.treat}</strong>${rowBg(S.seats[i].fl)}</li>`; }).join('')}</ol>
        ${standingsHtml()}
        ${R.pact ? `<p class="tt-sub">${L(`Buddy pact bonus: ${nm(R.pact[0])} and ${nm(R.pact[1])} get +3 each`, `Premia paktu: ${nm(R.pact[0])} i ${nm(R.pact[1])} dostają po +3`)}</p>` : ''}</div>`;
    } else { ovHide(el); return; }
    if (key !== ovKey) {
      // a new card: the old one (if any) slides away first, then the new one rises in over a soft dimmed backdrop
      const swap = ovKey && !el.hidden; ovKey = key; clearTimeout(ovTimer);
      const show = () => { if (destroyed || ovKey !== key) return; el.innerHTML = html; petPics(el); pbRows(el); el.classList.remove('out'); el.hidden = false; void el.offsetWidth; el.classList.add('in'); if (S.stage === 'wheel') spinWheel(); };
      if (swap) { el.classList.add('out'); ovTimer = setTimeout(show, 260); } else show();
    }
  }
  function spinWheel() {
    const box = $('tt-ov').querySelector('.tt-wheel'); if (!box) return;
    const items = [...box.children], pick = box.dataset.pick, end = items.findIndex(x => x.dataset.g === pick);
    const total = Math.max(0, S.stageLeft - 900), steps = items.length * 2 + (end >= 0 ? end : 0); let k = 0;
    const step = () => { if (destroyed || !box.isConnected) return;
      items.forEach((x, j) => x.classList.toggle('on', j === k % items.length)); sfx.tick();
      if (k >= steps) { items[k % items.length].classList.add('won'); sfx.set(); wheelDone = true; music.sting(); say(L(`Minigame: <b>${esc(gameName(pick))}</b>`, `Minigra: <b>${esc(gameName(pick))}</b>`)); return; }
      k++; const u = k / steps; setTimeout(step, 50 + (total / steps) * 2 * u * u); };
    step();
  }

  // ----- events -----
  function who(s, you, they) { return isMe(s) ? you : they.replace('{n}', `<b>${nm(s)}</b>`); }
  function playEv(e) {
    const s = e.s, P = e.s != null ? S.seats[s] : null; void P;
    switch (e.t) {
      case 'round': big(L(`Round ${e.r}`, `Runda ${e.r}`), L(`of ${S.rounds}`, `z ${S.rounds}`), 1500); say(L(`Round ${e.r} of ${S.rounds}: the wild pets wait on the glowing stones`, `Runda ${e.r} z ${S.rounds}: dzikie zwierzaki czekają na świecących kamieniach`));
        peekUntil = Date.now() + 3200; camFocus(); setTimeout(() => !destroyed && camFocus(), 3250); break;
      case 'firstgo': big(L('Who goes first?', 'Kto zaczyna?'), L('Everyone rolls a die', 'Każdy rzuca kością'), 1800); say(L('Everyone rolls a die. The highest roll goes first.', 'Każdy rzuca kością. Zaczyna najwyższy wynik.')); break;
      case 'first': scene?.peek?.(s, 1900); scene?.emote?.(s, 'throw'); throwDice(s, [e.d], e.d); sfx.draw(); say(who(s, L(`You roll <b>${e.d}</b>`, `Wyrzucasz <b>${e.d}</b>`), L(`{n} rolls <b>${e.d}</b>`, `{n} wyrzuca <b>${e.d}</b>`)) + (e.tie ? L(' in the tie-break', ' w dogrywce') : '')); break;
      case 'firsttie': say(L(`A tie! ${e.who.map(nm).join(', ')} roll again.`, `Remis! ${e.who.map(nm).join(', ')} rzucają jeszcze raz.`)); break;
      case 'order': scene?.peek?.(-1, 0); big(L(`${nm(e.order[0])} goes first`, `Zaczyna: ${nm(e.order[0])}`), e.order.map((i, k) => `${k + 1}. ${nm(i)}`).join(' · '), 2600); say(L(`Turn order: ${e.order.map(nm).join(', ')}`, `Kolejność: ${e.order.map(nm).join(', ')}`)); break;
      case 'turn': scene?.emote?.(s, 'wave'); say(who(s, L('Your turn', 'Twoja kolej'), L("{n}'s turn", 'Kolej: {n}'))); splash(s); if (isMe(s)) sfx.turn(); break;
      case 'card': scene?.emote?.(s, 'point'); stepsLeft.set(s, e.d); sfx.draw(); { const c = cardFace(e.d, S.pl[s].pos); bubble(s, `<span class="tt-pc${c.cls}">${c.inner}</span>`, 2200); } /* the played card rises over the player before the walk (Kuba 2026-11-27) */ say(who(s, L(`You play a <b>${e.d}</b>`, `Zagrywasz <b>${e.d}</b>`), L(`{n} plays a <b>${e.d}</b>`, `{n} zagrywa <b>${e.d}</b>`))); break;
      case 'redraw': sfx.whoosh?.(); say(who(s, L(`Your ${esc(petName(e.sp))} swaps your cards`, `Twój ${esc(petName(e.sp))} wymienia ci karty`), L(`{n}'s ${esc(petName(e.sp))} swaps their cards`, `${esc(petName(e.sp))} wymienia karty graczowi {n}`))); break;
      case 'boost': say(who(s, L(`Fewest friends: your ${esc(petName(e.sp))} can swap your cards again`, `Najmniej przyjaciół: twój ${esc(petName(e.sp))} znów może wymienić ci karty`), L(`Fewest friends: {n}'s ${esc(petName(e.sp))} can swap cards again`, `Najmniej przyjaciół: {n} znów może wymienić karty (${esc(petName(e.sp))})`))); break;
      case 'fork': scene?.emote?.(s, 'point'); say(who(s, L(`You take the ${esc(routeName(e.j))}`, `Wybierasz: ${esc(routeName(e.j))}`), L(`{n} takes the ${esc(routeName(e.j))}`, `{n} wybiera: ${esc(routeName(e.j))}`))); break;
      case 'hop': scene?.walk(s, e.path); { let k = 0; const hopSfx = () => { if (destroyed || k++ >= e.path.length) return; sfx.plop?.();
        const n = stepsLeft.get(s); if (n > 0) { stepsLeft.set(s, n - 1); if (n - 1 > 0) bubble(s, `<span class="tt-stp">${n - 1}</span>`, 520); }
        setTimeout(hopSfx, 420); }; hopSfx(); } break;
      case 'stone': stoneEv(e); break;
      case 'slide': scene?.emote?.(s, 'slide'); say(who(s, L('Icy brambles! You slide 2 stones on', 'Oblodzone jeżyny! Ślizgasz się 2 kamienie dalej'), L('Icy brambles! {n} slides 2 stones on', 'Oblodzone jeżyny! {n} ślizga się 2 kamienie dalej'))); sfx.whoosh?.(); break;
      case 'honey': landFx('honey', s, -e.v, () => { say(L(`${isMe(s) ? 'You step' : nm(s) + ' steps'} in ${isMe(e.o) ? 'your' : nm(e.o) + "'s"} honey: ${treatsW(e.v)} to ${isMe(e.o) ? 'you' : nm(e.o)}`, `${isMe(s) ? 'Wchodzisz' : nm(s) + ' wchodzi'} w miód gracza ${nm(e.o)}: ${treatsW(e.v)} dla ${isMe(e.o) ? 'ciebie' : nm(e.o)}`)); scene?.cue(s, 'lose'); floatAt(scene?.seatPx(s), '−' + e.v, 'bad'); }); break;
      case 'egg': landFx('egg', s, 0, () => { say(who(s, L('You find a Mystery Egg. It hatches in 2 turns', 'Znajdujesz tajemnicze jajo. Wykluje się za 2 tury'), L('{n} finds a Mystery Egg', '{n} znajduje tajemnicze jajo'))); scene?.cue(s, 'item'); sfx.set(); }); break;
      case 'hatch': say(L(`${isMe(s) ? 'Your' : nm(s) + "'s"} egg hatches: <b>${esc(petName(e.sp))}</b>!`, `Jajo ${isMe(s) ? 'się wykluwa' : 'gracza ' + nm(s) + ' się wykluwa'}: <b>${esc(petName(e.sp))}</b>!`)); scene?.cue(s, 'friend'); sfx.win?.(); break;
      case 'den': landFx('den', s, 0, () => { say(L(`A rare <b>${esc(petName(e.sp))}</b> comes out of the den!`, `Z nory wychodzi rzadki <b>${esc(petName(e.sp))}</b>!`)); sfx.set(); }); break;
      case 'called': landFx('', s, 0, () => { say(L(`The Pet Whistle calls <b>${esc(petName(e.sp))}</b> over`, `Gwizdek przywołuje: <b>${esc(petName(e.sp))}</b>`)); sfx.whoosh?.(); }); break;
      case 'full': landFx('', s, 0, () => { say(who(s, L('Your herd is full', 'Twoje stado jest pełne'), L("{n}'s herd is full", 'Stado gracza {n} jest pełne'))); }); break;
      case 'bought': say(L(`${isMe(s) ? 'You win' : nm(s) + ' wins'} <b>${esc(petName(e.sp))}</b> over with ${treatsW(e.c)}`, `${isMe(s) ? 'Przekonujesz' : nm(s) + ' przekonuje'} <b>${esc(petName(e.sp))}</b> za ${treatsW(e.c)}`)); scene?.cue(s, 'friend', SPECIES[e.sp]?.el); sfx.win?.(); bubble(s, `<span class="hot">♥</span>`); break;
      case 'showdown':
        if (e.ok) { say(L(`${esc(petName(e.sp))} wins <b>${esc(petName(e.wsp))}</b> over! It joins ${isMe(s) ? 'your' : nm(s) + "'s"} herd`, `${esc(petName(e.sp))} przekonuje: <b>${esc(petName(e.wsp))}</b>! Dołącza do stada ${isMe(s) ? 'twojego' : 'gracza ' + nm(s)}`)); scene?.cue(s, 'friend', SPECIES[e.wsp]?.el); sfx.win?.(); bubble(s, `<span class="hot">♥</span>`); if (isMe(s)) big(L('New friend!', 'Nowy przyjaciel!'), esc(petName(e.wsp)), 1300); }
        else { say(L(`${esc(petName(e.wsp))} isn't won over by ${esc(petName(e.sp))}`, `${esc(petName(e.wsp))} nie daje się przekonać (${esc(petName(e.sp))})`)); scene?.cue(s, 'miss'); sfx.bad?.(); }
        break;
      case 'flee': say(L(`${esc(petName(e.sp))} runs off down the trail`, `${esc(petName(e.sp))} ucieka dalej szlakiem`)); break;
      case 'leave': say(who(s, L(`You leave ${esc(petName(e.sp))} be`, `Zostawiasz: ${esc(petName(e.sp))}`), L(`{n} leaves ${esc(petName(e.sp))} be`, `{n} zostawia: ${esc(petName(e.sp))}`))); break;
      case 'use': say(who(s, L(`You use the ${esc(ITEMS[e.k].name)}`, `Używasz: ${esc(ITEMS[e.k].name)}`), L(`{n} uses the ${esc(ITEMS[e.k].name)}`, `{n} używa: ${esc(ITEMS[e.k].name)}`))); scene?.cue(s, 'item'); sfx.set(); break;
      case 'buy': scene?.emote?.(s, 'item'); say(who(s, L(`You buy the ${esc(ITEMS[e.k].name)}`, `Kupujesz: ${esc(ITEMS[e.k].name)}`), L(`{n} buys the ${esc(ITEMS[e.k].name)}`, `{n} kupuje: ${esc(ITEMS[e.k].name)}`))); sfx.pop(); break;
      case 'well': say(e.res === 'pet' ? L(`A wish comes true: a rare <b>${esc(petName(e.sp))}</b> appears!`, `Życzenie się spełnia: pojawia się rzadki <b>${esc(petName(e.sp))}</b>!`)
        : e.res === 'item' ? L(`The well gives ${isMe(s) ? 'you' : nm(s)} the ${esc(ITEMS[e.k].name)}`, `Studnia daje ${isMe(s) ? 'ci' : 'graczowi ' + nm(s)}: ${esc(ITEMS[e.k].name)}`)
        : e.res === 'treats' ? L(`The well gives ${isMe(s) ? 'you' : nm(s)} 8 treats`, `Studnia daje ${isMe(s) ? 'ci' : 'graczowi ' + nm(s)} 8 przysmaków`)
        : who(s, L('You walk past the well', 'Mijasz studnię'), L('{n} walks past the well', '{n} mija studnię'))); if (e.res !== 'no') { landFx('well', s, 0); scene?.cue(s, 'item'); sfx.set(); } break;
      case 'offer': say(L(`${isMe(s) ? 'You offer' : nm(s) + ' offers'} ${isMe(e.o) ? 'you' : nm(e.o)} a buddy pact`, `${isMe(s) ? 'Proponujesz' : nm(s) + ' proponuje'} pakt: ${isMe(e.o) ? 'tobie' : nm(e.o)}`)); if (isMe(e.o)) sfx.turn(); break;
      case 'pact': say(L(`${nm(s)} and ${nm(e.o)} are buddies for ${PACT_ROUNDS} rounds`, `${nm(s)} i ${nm(e.o)} mają pakt na ${PACT_ROUNDS} rundy`)); scene?.cue(s, 'gain'); scene?.cue(e.o, 'gain'); sfx.set(); break;
      case 'nopact': say(L(`${nm(e.o)} says no thanks to the pact`, `${nm(e.o)} odmawia paktu`)); break;
      case 'pactend': say(L(`The pact of ${nm(s)} and ${nm(e.o)} ends`, `Pakt: ${nm(s)} i ${nm(e.o)} dobiega końca`)); break;
      case 'lure': scene?.emote?.(s, 'surprise'); say(L(`${isMe(s) ? 'You lure' : nm(s) + ' lures'} <b>${esc(petName(e.sp))}</b> away from ${isMe(e.o) ? 'you' : nm(e.o)}`, `${isMe(s) ? 'Zwabiasz' : nm(s) + ' zwabia'} <b>${esc(petName(e.sp))}</b> od ${isMe(e.o) ? 'ciebie' : 'gracza ' + nm(e.o)}`)); scene?.cue(s, 'friend', SPECIES[e.sp]?.el); scene?.cue(e.o, 'miss'); sfx.whoosh?.(); break;
      case 'cheerask': say(L('Pick a friend to cheer you on in the minigame', 'Wybierz przyjaciela, który pokibicuje ci w minigrze')); if (S.cheer && !S.cheer.done) sfx.turn(); break;
      case 'wheel': say(L('The minigame wheel spins…', 'Koło minigier się kręci…')); break;
      case 'minires': { const k = e.order.indexOf(S.me); if (k === 0) sfx.win(); say(L(`${esc(gameName(e.game))}: ${nm(e.order[0])} wins`, `${esc(gameName(e.game))}: wygrywa ${nm(e.order[0])}`)); break; }
      case 'show': runShow(0); break;
      case 'late': if (isMe(s)) big(L('Out of time!', 'Koniec czasu!'), L('The safe choice was made for you', 'Wybrano za ciebie bezpieczną opcję'), 1400); else bubble(s, `<span>${L('Too slow!', 'Za wolno!')}</span>`); break;
      case 'end': {
        const won = S.res?.place[S.me] === 1; if (won) { sfx.win(); confetti(); } else sfx.lose?.(); scene?.cue(S.win, 'win');
        big(won ? L('You win!', 'Wygrywasz!') : L(`${nm(S.win)} wins!`, `${nm(S.win)} wygrywa!`), L('The Pet Show is over', 'Pokaz zwierzaków dobiegł końca'), 2200);
        clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400); break;
      }
    }
  }
  function stoneEv(e) {
    const s = e.s;
    const msg = {
      treat: [L(`You get ${treatsW(e.v)}`, `Dostajesz ${treatsW(e.v)}`), L(`{n} gets ${treatsW(e.v)}`, `{n} dostaje ${treatsW(e.v)}`)],
      picnic: [L(`Picnic! You get ${treatsW(e.v)}`, `Piknik! Dostajesz ${treatsW(e.v)}`), L(`Picnic! {n} gets ${treatsW(e.v)}`, `Piknik! {n} dostaje ${treatsW(e.v)}`)],
      spring: [L(`The Hot Spring: your friends rest, +${e.v}`, `Gorące źródło: przyjaciele odpoczywają, +${e.v}`), L(`{n} rests at the Hot Spring, +${e.v}`, `{n} odpoczywa w gorącym źródle, +${e.v}`)],
      bramble: [L(`Brambles! You lose ${treatsW(-e.v)}`, `Jeżyny! Tracisz ${treatsW(-e.v)}`), L(`Brambles! {n} loses ${treatsW(-e.v)}`, `Jeżyny! {n} traci ${treatsW(-e.v)}`)],
      guarded: [L('The brambles miss you', 'Jeżyny cię omijają'), L('The brambles miss {n}', 'Jeżyny omijają: {n}')],
      nest0: [L('The nest is empty for you now', 'Gniazdo jest teraz dla ciebie puste'), L('The nest is empty for {n}', 'Gniazdo jest puste dla: {n}')],
      bench0: [L('Nobody is free for a pact', 'Nikt nie jest wolny do paktu'), L('Nobody is free for a pact with {n}', 'Nikt nie jest wolny do paktu z: {n}')],
    }[e.kind];
    const after = () => { if (destroyed) return; const px = scene?.seatPx(s); if (msg) say(who(s, msg[0], msg[1])); // Tux tells it once they stand on the stone
      if (e.v > 0) { floatAt(px, '+' + e.v, 'good'); scene?.cue(s, 'gain'); sfx.combo?.(1); }
      else if (e.v < 0) { floatAt(px, '−' + -e.v, 'bad'); scene?.cue(s, 'lose'); sfx.bad?.(); } };
    landFx(e.kind, s, e.v, after);
  }
  // the stone shows what it does once the player has hopped onto it (Kuba 2026-11-27)
  function landFx(kind, s, v, then) { if (scene?.stoneFx) scene.stoneFx(null, kind, s, v, then); else then?.(); }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; stateAt = Date.now();
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; bubbles.clear(); LOG.length = 0;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      showRan = false; showTimers.forEach(clearTimeout); showTimers = []; scene?.setPodium?.(null); scene?.stepOut?.([]);
      if (s.ph === 'end') { if (s.show) scene?.setPodium?.(showPlaces()); showResults(); }
      else if (s.stage === 'show') runShow(Math.max(0, SHOW_MS - s.stageLeft));
      else say(s.stage === 'intro' ? L('Welcome to the Friendship Trail!', 'Witaj na Szlaku przyjaźni!') : s.turn >= 0 ? who(s.turn, L('Your turn', 'Twoja kolej'), L("{n}'s turn", 'Kolej: {n}')) : L('Back on the trail', 'Z powrotem na szlaku'));
    } else for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); } // hops go to the scene before the new positions
    render(); scene?.setState(s); camFocus(); tune();
  }
  // the music follows the stage (music.js). Once the wheel has landed its flourish plays and then nothing, so the minigame starts in quiet
  let wheelDone = false;
  function tune() {
    if (S.ph !== 'end' && (S.stage === 'wheel' || S.stage === 'mini')) { if (S.stage === 'wheel' && !wheelDone) music.cue('wheel'); else if (!wheelDone) music.stop(); return; }
    wheelDone = false;
    music.cue(S.ph === 'end' ? 'podium' : S.stage === 'intro' ? 'intro' : S.stage === 'show' ? 'show' : 'trail');
  }
  function render() {
    if (!S) return;
    setHtml($('tt-info'), `${L(`Round ${Math.min(S.round, S.rounds)}/${S.rounds}`, `Runda ${Math.min(S.round, S.rounds)}/${S.rounds}`)}<span class="tt-n"> · ${SEASON_NAME[S.season]} · ${WX_NAME[S.wx]}</span>`);
    $('tt-code').textContent = Rm?.code || '';
    buildTags(); renderSide(); renderDock(); renderOv();
  }

  // ----- the Pet Show: back in the meadow, Tux hands out the ribbons one by one, then a 1-2-3 podium (Kuba 2026-11-27) -----
  const SHOW_MS = 21000, RIB_AT = 2600, RIB_EACH = 2500;
  let showTimers = [], showRan = false;
  const showPlaces = () => { const { pts } = S.show, T = S.pl.map(p => p.treats);
    return S.seats.map((_, i) => 1 + S.seats.filter((__, j) => pts[j] > pts[i] || (pts[j] === pts[i] && T[j] > T[i])).length); };
  function runShow(from) {
    if (!S?.show || showRan) return; showRan = true;
    showTimers.forEach(clearTimeout); showTimers = [];
    const at = (ms, fn) => { if (ms >= from) showTimers.push(setTimeout(() => { if (!destroyed && S?.show) fn(); }, ms - from)); };
    at(0, () => { say(L('The Pet Show! Everyone back to the meadow', 'Pokaz zwierzaków! Wszyscy wracają na łąkę')); big(L('The Pet Show', 'Pokaz zwierzaków'), L('Ribbons for the best herds', 'Wstęgi dla najlepszych stad'), 2200); sfx.set(); });
    const keys = Object.keys(RIBBONS);
    keys.forEach((k, j) => at(RIB_AT + j * RIB_EACH, () => {
      const who = S.show.rib[k] || [];
      scene?.stepOut?.(who);
      say(`<b>${esc(RIBBONS[k])}</b>: ${who.length ? who.map(nm).join(', ') : L('nobody this time', 'tym razem nikt')}`);
      big(esc(RIBBONS[k]), who.length ? who.map(nm).join(', ') : L('nobody', 'nikt'), RIB_EACH - 200);
      who.forEach(i => scene?.cue(i, 'friend')); if (who.includes(S.me)) sfx.win(); else sfx.set();
    }));
    const podAt = RIB_AT + keys.length * RIB_EACH + 300;
    at(podAt, () => {
      scene?.stepOut?.([]); const pl = showPlaces(); scene?.setPodium?.(pl);
      const top = S.seats.map((_, i) => i).filter(i => pl[i] === 1);
      say(L(`The winner of the Pet Show: <b>${top.map(nm).join(', ')}</b>!`, `Zwycięzca Pokazu: <b>${top.map(nm).join(', ')}</b>!`));
      top.forEach(i => scene?.cue(i, 'win')); S.seats.forEach((_, i) => { if (pl[i] === 2 || pl[i] === 3) scene?.emote?.(i, 'cheer'); else if (pl[i] > 3) scene?.emote?.(i, 'wave'); });
    });
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
        return `<li class="${pbRowCls(p.fl)} ${place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${isMe(i) ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${q.herd.length} friend${q.herd.length === 1 ? '' : 's'} · ${q.wins} minigame win${q.wins === 1 ? '' : 's'} · ${treatsW(q.treats)}`, `przyjaciele: ${q.herd.length} · wygrane minigry: ${q.wins} · ${treatsW(q.treats)}`)}</span>
          <span class="tt-herd">${q.herd.map(f => pet(f, 26)).join('')}</span>${rs.length ? `<span class="tt-rbs">${rs.map(k => `<span class="rib">${esc(RIBBONS[k])}</span>`).join('')}</span>` : ''}</div>
          <strong><span>${ptsW(S.res.pts[i])}</span></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Walk the trail again', 'Przejdź szlak jeszcze raz'))}</div></div>`;
    petPics(el); pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
    if (a === 'music') { const on = music.toggle(); b.innerHTML = on ? I.note : I.noteOff; b.setAttribute('aria-pressed', on); sfx.click(); return; }
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
    else if (a === 'card') send({ t: 'card', i: +d.i });
    else if (a === 'redraw') send({ t: 'redraw', f: +d.f });
    else if (a === 'item') send({ t: 'item', k: d.k });
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
      destroyed = true; music.stop(); document.body.classList.remove('in-game'); removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(dieTimer); showTimers.forEach(clearTimeout); scene?.dispose();
    },
  };
}
void FORKS; void STONES; void HERD_MAX;
