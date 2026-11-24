// Pet Farm view: the HUD over the 3D farm. Shows what the server says and sends what the player wants to do.
// Unlike the table games this one has no room: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode) }
import { boostName, boostWhat } from '../../wheeltext.js';
import { sfx } from '../../sfx.js';
import { myBurst } from '../../winfx.js';
import { MOVES, STATUS, STAT_NAME, KIT, LEARN, ROLE_NAME, movesAt, XMOVE_LV, TURN_S, STRONG, effect } from './battle.js';
import { COATS, PATTERNS, PART, TALENTS, STAR_NAME, BREED_LV, CUDDLE_H, speciesOdds, hatchHours, coatHex, kinCoat, coatName, variantOdds } from './breed.js';
import { MAT_INFO, ITEMS, MATS, SPECIES, FAMILIES, familyOf, atHome, elOf, variantOf, STARTERS, ELEMENTS, FORMS, RARITY, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, GIFTS, RECIPES, WORTH, SWAP_KEEP, SWAP_MAX, STORED, swapDeal, BERRIES, UPGRADES, UP_MAX, lvOf, lvMax, maxOf, SHELF_MAX, SHELF_NAME, upCost, whatUp, TRAIN_XP, WORK, canWork, workPct, formOf, xpFor, tripLoot, canAfford, countOf, costText, elName } from './data.js';
import { matIcon } from './icons.js';
import { L, PL, cnt, word } from '../../i18n.js';
import { srvText, addServerText } from '../../lang/server.js';
if (PL) { const pl = await import('../../lang/farm-pl.js'); addServerText(pl.SRV_TEXT, pl.SRV_FORMS); }
import { WEATHER, weatherAt } from './data.js';
import { flairOf, piecesOf } from '../../cosmetics.js';
import { islePic, isleCached } from '../../islepic.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  turn: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};
// little pictures for the one-line summary of parties out and eggs in the Nest
const tripIcon = '<svg class="pfsi" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 21V4" stroke="#5a3a2e" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#ff8f6b" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/></svg>';
const eggIcon = '<svg class="pfsi" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3c4 0 7 6.5 7 11a7 7 0 0 1-14 0c0-4.5 3-11 7-11z" fill="#fff3c9" stroke="#5a3a2e" stroke-width="2"/><circle cx="9.5" cy="13" r="1.4" fill="#8fd16a"/><circle cx="14" cy="16.5" r="1.2" fill="#8fd16a"/><circle cx="13.5" cy="10" r="1" fill="#8fd16a"/></svg>';
// Small material badges: a coloured block with the amount beside it.
const BASIC = ['wood', 'stone', 'fiber', 'coins'];
// Weather and time of day: tiny pictures for the chip at the top and the window behind it.
const WX_ICON = {
  sunny: '<circle cx="12" cy="12" r="5" fill="#ffc94d" stroke="#5a3a2e" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#5a3a2e" stroke-width="2" stroke-linecap="round"/>',
  cloudy: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18z" fill="#fff" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/>',
  rain: '<path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 14z" fill="#cfe0f0" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/><path d="M8 17l-1 4M12 17l-1 4M16 17l-1 4" stroke="#4f9df0" stroke-width="2" stroke-linecap="round"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6" fill="none" stroke="#5a3a2e" stroke-width="2" stroke-linecap="round"/>',
  rainbow: '<path d="M3 18a9 9 0 0 1 18 0" fill="none" stroke="#e8615a" stroke-width="2.4"/><path d="M6 18a6 6 0 0 1 12 0" fill="none" stroke="#ffc94d" stroke-width="2.4"/><path d="M9 18a3 3 0 0 1 6 0" fill="none" stroke="#6fb7e8" stroke-width="2.4"/>',
  moon: '<path d="M16 3a9 9 0 1 0 5 13A7.5 7.5 0 0 1 16 3z" fill="#fff3b8" stroke="#5a3a2e" stroke-width="2" stroke-linejoin="round"/>',
};
const wxIcon = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${WX_ICON[k] || ''}</svg>`;
const DAY_PL = { Night: 'Noc', Morning: 'Poranek', Daytime: 'Dzień', Sunset: 'Zachód słońca', Evening: 'Wieczór' }, dayName = h => L(dayPart(h), DAY_PL[dayPart(h)]);
const dayPart = h => h < 4.6 || h >= 21 ? 'Night' : h < 8 ? 'Morning' : h < 17 ? 'Daytime' : h < 19.5 ? 'Sunset' : 'Evening';
const mat = (k, n, cls = '') => `<span class="mat ${cls}" title="${MATS[k]}">${matIcon(k)}${n}<small>${MATS[k].toLowerCase()}</small></span>`;
const costHtml = (cost, inv) => Object.keys(cost || {}).length ? Object.entries(cost).map(([k, n]) => mat(k, n, inv && (inv[k] || 0) < n ? 'short' : '')).join('') : `<span class="mat">${L('Free', 'Za darmo')}</span>`;
const wait = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? L(`${m / 60 | 0}h ${m % 60}m`, `${m / 60 | 0} godz. ${m % 60} min`) : L(`${m}m`, `${m} min`); };
const span = min => min >= 60 ? cnt(min / 60, 'hour', 'hours', 'godzina', 'godziny', 'godzin') : cnt(min, 'minute', 'minutes', 'minuta', 'minuty', 'minut');
const elTags = p => elTag(elOf(p)) + (SPECIES[p.sp].el2 ? elTag(SPECIES[p.sp].el2) : '');
// Each place to explore drawn as its matching isle ground (COS.ig index, same island as the profile isle) on its own sky: [top, bottom].
const ZONE_ISLE = { woods: [5, '#b9e4ff', '#e9f8ff'], cove: [6, '#93d6ff', '#d9f3ff'], ridge: [2, '#c6d3e8', '#eef2f8'], hills: [8, '#ffc79a', '#ffeccf'], meadow: [14, '#cfdcff', '#f6f1c6'],
  grove: [3, '#bfe9ff', '#fff3d2'], patch: [4, '#c9e6ff', '#eef8e2'], bakery: [11, '#ffd9b5', '#fff3e2'], sweets: [7, '#ffcde8', '#fff0f8'], reef: [12, '#a2e2f4', '#e0f8ff'],
  peak: [1, '#d6e6f7', '#ffffff'], night: [13, '#3b2f73', '#7a68b8'] };
const zoneSky = k => { const z = ZONE_ISLE[k]; if (!z) return ''; const u = isleCached('zn', z[0]); return `<span class="zsky" aria-hidden="true"><img class="zpic" data-ig="${z[0]}" alt=""${u ? ` src="${u}"` : ''} width="160" height="160"></span>`; };
const HEART_D = 'M8 14.2 2.4 8.8A3.4 3.4 0 0 1 8 4.3a3.4 3.4 0 0 1 5.6 4.5Z';
const HEART = (w = 14) => `<svg viewBox="0 0 16 16" width="${w}" height="${w}" aria-hidden="true"><path d="${HEART_D}" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const HEART_O = (w = 18) => `<svg viewBox="0 0 16 16" width="${w}" height="${w}" aria-hidden="true"><path d="${HEART_D}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
// favourite pets come first in every pet list (a stable sort keeps the list's own order inside each group)
const favFirst = list => list.map((p, i) => ({ p, i })).sort((a, b) => (b.p.fav ? 1 : 0) - (a.p.fav ? 1 : 0) || a.i - b.i).map(x => x.p);
const favMark = p => p?.fav ? `<span class="pffav" role="img" title="${L('Favourite', 'Ulubiony')}" aria-label="${L('Favourite', 'Ulubiony')}">${HEART(12)}</span>` : '';
const LOCK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="2.5" y="7" width="11" height="8" rx="2" fill="currentColor"/></svg>';
const zoneVars = k => ZONE_ISLE[k] ? ` style="--s1:${ZONE_ISLE[k][1]};--s2:${ZONE_ISLE[k][2]}"` : '';
const elTag = e => `<span class="el" style="--c:${ELEMENTS[e]}">${elName(e)}</span>`;
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + L(' and ', ' i ') + a.at(-1);

let cssLoaded = false;
// Little pictures for menus and pet chips: about 120 of them, so they are drawn a few at a time after the island
// shows (drawing them all at once held the island back for seconds). Kept for the whole visit to the site.
const thumbs = {}, thumbAll = () => [...Object.keys(ITEMS), ...Object.keys(SPECIES).map(s => 'pet:' + s)];
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./farm.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pf">
    <canvas class="g3d" aria-label="${L(`Your farm`, `Twoja farma`)}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="pf-title">${L('Pet Farm', 'Farma zwierzaków')}</span><div class="pfmatsrow"><div class="mats" id="pf-mats"></div><button type="button" class="round pfmatsmore" data-a="matsmore" aria-expanded="false" aria-label="${L('Show all materials', 'Pokaż wszystkie materiały')}"><i class="pfcaret" aria-hidden="true"></i></button></div></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="home" aria-label="${L(`Back to the hub`, `Wróć do Zatoki`)}">${I.door}</button></div>
      <div class="bl" id="pf-main"></div>
      <div class="pfcard" id="pf-card" hidden></div>
      <div class="bt" id="pf-bt" hidden></div>
      <div class="bfl" id="pf-fl"></div>
      <div class="dock"><div class="ghostbar" id="pf-ghost" hidden></div><div class="build" id="pf-build" hidden></div></div>
    </div>
    <div class="gate" id="pf-panel" hidden></div>
    <div class="gate" id="pf-gate" hidden></div>
    <div class="pfload" id="pf-load" role="status"><span class="pfegg" aria-hidden="true"></span>${L('Walking to the farm…', 'Idziemy na farmę…')}</div>
  </div>`;
  const root = app.querySelector('.pf'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  let F = null, scene = null, destroyed = false, mode = 'load', edit = false, tab = 'b', pick = null, card = null, panel = null, tripAt = 0, nestAt = 0, lastType = null, lastSpot = null;
  // Every request gets an answer. If none comes, say so instead of leaving a button that seems dead.
  let quiet = 0;
  const say = ctx.send;
  ctx = { ...ctx, send(a) { say(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) ctx.toast(L('The farm did not answer. Check your connection. If the game was just updated, the server needs a restart.', 'Farma nie odpowiada. Sprawdź połączenie. Jeśli gra była właśnie aktualizowana, serwer wymaga restartu.'), true); }, 4000); } };
  let sumOpen = false, navOpen = false, matsOpen = false; // phone HUD: trip/egg details, the menu, every material
  let where = 'home', world = null, V = null; // home, map (the neighbourhood), or visit (someone else's farm, in V)
  let B = null, shown = null, playing = false, foes = null, line = '', blogs = [], lastEl = null, ranks = null;
  let elOpen = false; // the elements guide in a battle
  let logOpen = (() => { try { const v = localStorage.getItem('pf_blog'); return v ? v === '1' : innerWidth > 900; } catch { return innerWidth > 900; } })();
  const lookKey = () => JSON.stringify([ctx.me()?.color, ctx.me()?.av]); let look = lookKey();
  let mapShown = null, counter = null; // counter: an offer to pre-fill once we have walked to the other farm
  let user = ctx.me()?.user || null, lastTrip = { zone: 'woods', trip: 'stroll', pets: [] }, lastTeam = [], liveAt = 0, gardenAt = 0, heldInvite = null;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onPick, onGhost: paintGhost });
    sync();
  }).catch(err => { console.warn('3D unavailable', err); $('pf-load').hidden = true; root.classList.add('flat'); });
  // The loading note stays until the farm itself has been drawn: its shaders are built first (a few at a time, so the page
  // keeps moving), and only once the farm's own data is in, not for an empty island. The little pictures start after that.
  let revealed = false;
  function reveal() {
    if (revealed || !scene || mode === 'load') return; revealed = true;
    const done = () => { if (destroyed || $('pf-load').hidden) return; $('pf-load').hidden = true; thumbGo = true; thumbLater(1500); };
    setTimeout(done, 30000); // whatever happens, never leave the note up for good
    scene.warm().then(() => scene.drawn?.()).then(done);
  }

  // A picture not drawn yet shows a soft tile and is swapped in when ready; ones on screen are drawn first.
  const thumbWant = new Set(); let thumbRest = null, thumbT = 0, thumbGo = false;
  const thumbImg = (k, alt) => `<img src="${thumbs[k]}" alt="${esc(alt)}" width="56" height="56">`;
  const thumb = (k, alt = '') => { if (thumbs[k]) return thumbImg(k, alt); if (k in thumbs) return '<span class="nothumb"></span>'; thumbWant.add(k); thumbLater(20); return `<span class="nothumb" data-th="${esc(k)}" data-alt="${esc(alt)}"></span>`; };
  function thumbLater(ms) { if (!thumbT && thumbGo && !destroyed) thumbT = setTimeout(thumbStep, ms); }
  function thumbStep() {
    thumbT = 0; if (destroyed || !scene) return;
    thumbRest ||= thumbAll();
    // pictures on screen right now get a bigger share of the turn; the rest are drawn a few milliseconds at a time
    const t0 = performance.now(), front = thumbWant.size > 0, budget = front ? 60 : 10, done = [];
    while (performance.now() - t0 < budget) {
      const k = front ? thumbWant.values().next().value : thumbRest.pop(); if (k === undefined) break;
      thumbWant.delete(k); if (k in thumbs) continue;
      const u = scene.thumbs([k])[k]; thumbs[k] = u || ''; if (u) done.push(k);
    }
    for (const k of done) for (const el of root.querySelectorAll(`.nothumb[data-th="${CSS.escape(k)}"]`)) el.outerHTML = thumbImg(k, el.dataset.alt || '');
    if (thumbWant.size || thumbRest.length) thumbT = setTimeout(thumbStep, thumbWant.size ? 16 : 40);
  }

  // A pet's own picture: its real form, coat and markings.
  const face = (p, alt = '') => { const u = p && scene?.portrait?.(p.sp, formOf(p.lv || 1), p.look || null); return u ? `<img src="${u}" alt="${esc(alt || p.name || '')}" width="56" height="56">` : thumb('pet:' + p?.sp, alt); };
  const stars = n => `<span class="stars" aria-label="${L(`${n} of 5 stars`, `${n} z 5 gwiazdek`)}">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const swatch = (c, name) => `<span class="sw" title="${name}"><i style="background:${c}"></i>${name}</span>`;
  const nestTxt = n => n.stage === 'cuddle' ? L(`An egg will appear in ${wait(n.left)}.`, `Jajko pojawi się za ${wait(n.left)}.`) : n.stage === 'egg' ? L(`The egg hatches in ${wait(n.left)}.`, `Jajko wykluje się za ${wait(n.left)}.`) : L('The egg is ready to hatch!', 'Jajko jest gotowe do wyklucia!');
  const cannotPair = p => p.lv < BREED_LV ? L(`Needs level ${BREED_LV}`, `Wymaga poziomu ${BREED_LV}`) : p.rest > 0 ? L(`Resting for ${wait(p.rest)}`, `Odpoczywa jeszcze ${wait(p.rest)}`) : outNow().includes(p.id) ? L('Away exploring', 'Na wyprawie') : inNest(p.id) ? L('Already in the Nest', 'Już w Gnieździe') : F.train.ids.includes(p.id) ? L('Training at the yard', 'Trenuje na placu') : '';
  // The hour is the player's own clock; the weather is the same for everyone (a test or the pf_sky setting can pin both).
  const skyNow = () => { const d = new Date(); let hour = d.getHours() + d.getMinutes() / 60, w = { ...weatherAt(), ...(WEATHER[F?.weather] ? { kind: F.weather, ...WEATHER[F.weather] } : {}) };
    try { const [h, k] = (localStorage.getItem('pf_sky') || '').split(','); if (h !== '' && !isNaN(+h)) hour = +h; if (WEATHER[k]) w = { ...w, kind: k, ...WEATHER[k] }; } catch { /* no storage */ }
    return { hour, w }; };
  let skyKey = '';
  // One job at a time: why a pet cannot be picked for something right now ('' when it can).
  const inNest = id => F.nests.some(n => n.stage === 'cuddle' && (n.a === id || n.b === id));
  const busyFor = (p, job) => p.lodge ? L('stored in the Pet Lodge', 'w Schronisku') : job === 'defend' ? '' : outAll().includes(p.id) ? 'exploring' : inNest(p.id) ? L('cuddling in the Nest', 'przytula się w Gnieździe') : job === 'send' && p.held ? L('promised in a trade', 'obiecany w wymianie') : '';
  const freeWhy = p => F.pets.length < 2 ? L('Your farm keeps at least one pet.', 'Na farmie musi zostać przynajmniej jeden zwierzak.') : p.held ? L(`${p.name} is promised in a trade. Take the offer back first.`, `${p.name} jest w ofercie wymiany. Najpierw wycofaj ofertę.`) : outAll().includes(p.id) ? L(`${p.name} is out exploring. Welcome it home first.`, `${p.name} jest na wyprawie. Najpierw przywitaj drużynę w domu.`) : inNest(p.id) ? L(`${p.name} is cuddling in the Nest.`, `${p.name} przytula się w Gnieździe.`) : '';
  const freeFor = job => id => { const p = F.pets.find(x => x.id === id); return p && !busyFor(p, job); };
  const outNow = () => F.trips.filter(t => t.left > 0).flatMap(t => t.pets), outAll = () => F.trips.flatMap(t => t.pets); // away right now; away or waiting to be welcomed
  // What a pet is up to right now, for the pet list. away: it is not on the island, so the camera cannot find it.
  // What a farmhouse level opens besides new places to explore.
  const HOUSE_OPENS = { 4: [() => L('the Pet Lodge', 'Schronisko zwierzaków')],
    5: [() => L('land up to 24 by 24', 'ziemię do 24 na 24')] };
  let cardBack = null; // the window a pet card was opened from with its "i" button, so the card can go back to it
  const infoBtn = (id, name, cls = 'pfinfo') => `<button type="button" class="${cls}" data-a="pcard" data-id="${id}" title="${L('Open its card', 'Otwórz kartę')}" aria-label="${L(`Open the card of ${esc(name)}`, `Otwórz kartę: ${esc(name)}`)}">i</button>`;
  // Every own pet in a list or picker gets a small "i" next to it that opens its card (the pet itself picks or finds it).
  function addInfo() {
    const box = $('pf-panel'); if (where === 'visit' || !F || box.hidden) return;
    for (const b of box.querySelectorAll('.pickpet[data-id], .petrow[data-id]')) {
      const p = F.pets.find(x => x.id === b.dataset.id); if (!p || b.parentElement.classList.contains('pfiw')) continue;
      const w = document.createElement('span'); w.className = 'pfiw' + (b.classList.contains('petrow') ? ' row' : ''); b.replaceWith(w); w.append(b); w.insertAdjacentHTML('beforeend', infoBtn(p.id, p.name));
    }
  }
  const LODGE_PAGE = 36, ldSort = () => { try { return localStorage.getItem('pf_lsort') || 'sp'; } catch { return 'sp'; } };
  // said wherever a new pet arrives: when the island is full it goes straight into the Pet Lodge
  const inLodge = id => F.pets.find(x => x.id === id)?.lodge ? L('The island is full, so it is waiting in your Pet Lodge.', 'Na wyspie nie ma miejsca, więc czeka w Schronisku.') : '';
  const shelfName = id => id && F.shelves?.find(x => x.id === id)?.name;
  const petStatus = p => { const t = F.trips.find(t => t.pets.includes(p.id)), job = Object.entries(F.work || {}).find(([, id]) => id === p.id);
    return t ? (t.left > 0 ? { away: true, cls: 'out', text: L(`Exploring ${ZONES[t.zone].name}, back in ${wait(t.left)}`, `Na wyprawie: ${ZONES[t.zone].name}, powrót za ${wait(t.left)}`), short: L(`Exploring, back in ${wait(t.left)}`, `Na wyprawie, powrót za ${wait(t.left)}`) } : { away: true, cls: 'back', text: L(`Back from ${ZONES[t.zone].name}: welcome the party`, `Wraca: ${ZONES[t.zone].name}. Przywitaj drużynę`), short: L('Back: welcome the party', 'Wraca: przywitaj drużynę') })
      : inNest(p.id) ? { cls: 'job', text: L('Cuddling in the Nest', 'Przytula się w Gnieździe') }
      : F.train.ids.includes(p.id) ? { cls: 'job', text: L('Training at the yard', 'Trenuje na placu') }
      : job ? { cls: 'job', text: L(`Helping at the ${ITEMS[job[0]].name}`, `Pomaga: ${ITEMS[job[0]].name}`) }
      : p.held ? { cls: '', text: L('Promised in a trade', 'W ofercie wymiany') }
      : p.rest > 0 ? { cls: '', text: L(`Resting for ${wait(p.rest)}`, `Odpoczywa jeszcze ${wait(p.rest)}`) }
      : p.lodge ? { away: true, cls: 'out', text: L(`In the Pet Lodge${shelfName(p.shelf) ? ': ' + esc(shelfName(p.shelf)) : ''}`, `W Schronisku${shelfName(p.shelf) ? ': ' + esc(shelfName(p.shelf)) : ''}`) }
      : { cls: '', text: L('Free to play', 'Wolny, bawi się') }; };
  const favBtn = (p, cls = '') => `<button type="button" class="pfheart${cls}" data-a="fav" data-id="${p.id}" aria-pressed="${!!p.fav}" title="${p.fav ? L('Remove from favourites', 'Usuń z ulubionych') : L('Mark as favourite', 'Dodaj do ulubionych')}" aria-label="${p.fav ? L(`Remove ${esc(p.name)} from favourites`, `Usuń z ulubionych: ${esc(p.name)}`) : L(`Mark ${esc(p.name)} as a favourite`, `Dodaj do ulubionych: ${esc(p.name)}`)}">${p.fav ? HEART(18) : HEART_O(18)}</button>`;
  const petSort = () => { try { return localStorage.getItem('pf_psort') || 'new'; } catch { return 'new'; } };
  // ---------- painting ----------
  function sync() {
    if (F) for (const t of [...F.trips, F.trip, ...F.nests, F.nest]) if (t && t.due) t.left = Math.max(0, t.due - Date.now());
    paintGate(); paintTop(); paintMain(); paintBuild(); paintCard(); paintPanel(); paintBattle();
    if (!scene) return;
    { const { hour, w } = skyNow(); scene.setSky(hour, w.kind); skyKey = w.kind + dayPart(hour); }
    { const isl = where === 'visit' && V ? V.isle || {} : flairOf(ctx.me()); scene.setLook({ ig: isl.ig | 0, ib: isl.ib | 0, ik: isl.ik | 0, fp: piecesOf({ cos: { fp: isl.fp } }) }); } // the island wears its owner's isle look
    if (mode === 'starter') { scene.setFarm(null); scene.setStarters(pick || ''); }
    else { const meAv = { color: ctx.me()?.color, av: ctx.me()?.av }; if (where === 'visit' && V) scene.setOwner({ color: V.color, av: V.av }, [meAv]); else scene.setOwner(meAv, where === 'home' ? F?.guests || [] : []); scene.setStarters(null); scene.setFarm(mode !== 'farm' ? null : where === 'visit' && V ? V : F); scene.setEdit(edit); }
    const map = mode === 'farm' && where === 'map' && !B && world ? world : null;
    if (map !== mapShown) { mapShown = map; scene.setWorld(map, map && { ...F, name: F.owner, color: ctx.me()?.color, av: ctx.me()?.av, isle: flairOf(ctx.me()) }, map ? Object.entries(ZONES).map(([key, z]) => ({ key, name: z.name, el: z.el, theme: z.theme, out: F.trips.some(t => t.zone === key), fly: F.trips.filter(t => t.zone === key).map(t => ({ left: t.left, total: TRIPS[t.trip].min * 60000 }))[0], note: F.trips.some(t => t.zone === key) ? (F.trips.some(t => t.zone === key && t.left > 0) ? L('your party is here', 'twoja drużyna jest tutaj') : L('your party is back', 'twoja drużyna wróciła')) : F.house < z.house ? L(`farmhouse level ${z.house}`, `dom na poziomie ${z.house}`) : L('tap to explore', 'dotknij, żeby zwiedzać') })) : []); }
    scene.setBattle(!!B && mode === 'farm'); if (B) for (const s of [0, 1]) scene.ringPet(s, shown.sides[s].pets[shown.sides[s].on]);
    reveal();
  }
  function paintTop() {
    $('pf-title').textContent = B ? (B.mode === 'live' ? L(`Live battle with ${B.foe}`, `Bitwa na żywo: ${B.foe}`) : B.mode === 'arena' ? L(`Match against ${B.foe}`, `Mecz: ${B.foe}`) : B.mode === 'wild' ? L(`Meeting ${B.foe}`, `Spotkanie: ${B.foe}`) : L('Practice battle', 'Bitwa treningowa')) : where === 'map' && F ? L('The neighbourhood', 'Okolica') : where === 'visit' && V ? L(`${V.name}'s farm`, `Farma gracza ${V.name}`) : F ? L(`${F.owner}'s farm`, `Farma gracza ${F.owner}`) : L('Pet Farm', 'Farma zwierzaków');
    const mb = root.querySelector('.pfmatsrow'); mb.hidden = !(F && mode === 'farm' && !B); mb.classList.toggle('open', matsOpen); mb.querySelector('.pfmatsmore').setAttribute('aria-expanded', matsOpen);
    $('pf-mats').innerHTML = F && mode === 'farm' && !B ? Object.keys(MATS).filter(k => BASIC.includes(k) || F.inv[k]).map(k => `<button type="button" class="matbtn" data-a="matinfo" data-mat="${k}" title="${MATS[k]}${L(`. From: ${MAT_INFO[k][0]} For: ${MAT_INFO[k][1]}`, `. Skąd: ${MAT_INFO[k][0]} Do czego: ${MAT_INFO[k][1]}`)}">${mat(k, F.inv[k] || 0)}</button>`).join('') + (() => { const { hour, w } = skyNow(), night = dayPart(hour) === 'Night'; return `<button type="button" class="matbtn" data-a="wxinfo" title="${w.name}. ${w.bonus}"><span class="mat wxchip">${wxIcon(night && w.kind === 'sunny' ? 'moon' : w.kind)}${night && w.kind === 'sunny' ? L('Clear night', 'Pogodna noc') : w.name}</span></button>`; })() : '';
  }
  function paintMain() {
    const el = $('pf-main');
    if (mode !== 'farm' || edit || B) { el.innerHTML = ''; return; }
    if (where === 'map') {
      el.innerHTML = `<button type="button" class="btn big" data-a="gohome">${L(`Back to my farm`, `Wróć na moją farmę`)}</button><button type="button" class="btn w" data-a="friends">${L(`Friends`, `Znajomi`)}</button><button type="button" class="btn w" data-a="ranks">${L(`Ranking`, `Ranking`)}</button><span class="chip">${!world ? L('Looking around…', 'Rozglądam się…') : world.length ? L('Tap an island to visit. Drag to turn, scroll or pinch to zoom.', 'Dotknij wyspy, żeby ją odwiedzić. Przeciągnij, żeby obrócić, przewiń lub rozsuń palce, żeby przybliżyć.') : L('No other farms yet. They appear here when friends start one.', 'Nie ma jeszcze innych farm. Pojawią się tu, gdy znajomi założą swoje.')}</span>`;
      return;
    }
    if (where === 'visit' && V) {
      el.innerHTML = `<button type="button" class="btn big" data-a="map">${L(`Back to the map`, `Wróć na mapę`)}</button>
        <button type="button" class="btn m" data-a="help" ${V.helps > 0 ? '' : 'disabled'}>${L(`Help out (${V.helps} left)`, `Pomóż (zostało: ${V.helps})`)}</button>
        <button type="button" class="btn m" data-a="giftopen" ${V.gift ? '' : 'disabled'}>${V.gift ? L('Leave a gift', 'Zostaw prezent') : L('Gift left today', 'Prezent już dziś zostawiony')}</button>
        <button type="button" class="btn w" data-a="trade">${L(`Trade`, `Wymiana`)}</button>
        ${countOf(F, 'flag') && V.team ? '<button type="button" class="btn w" data-a="duel">' + L('Challenge', 'Wyzwij') + '</button>' : ''}
        <button type="button" class="btn w" data-a="livego">${L(`Live battle`, `Bitwa na żywo`)}</button>
        <button type="button" class="btn w" data-a="compare">${L(`Compare albums`, `Porównaj albumy`)}</button>
        ${V.pal ? `<span class="chip">${L(`Friendship ${V.pal}`, `Przyjaźń ${V.pal}`)}</span>` : ''}`;
      return;
    }
    // Big farms have many parties out, eggs in the Nest and materials: each kind gets one line, and on phones the
    // menu folds into one button, so the HUD never covers the farm (a high-level farm filled a phone screen).
    const out = F.trips.filter(t => t.left > 0).sort((a, b) => a.left - b.left), home = F.trips.filter(t => !(t.left > 0));
    const eggs = F.nests.filter(n => n.stage !== 'ready').sort((a, b) => a.left - b.left), hatch = F.nests.filter(n => n.stage === 'ready');
    const tripLine = t => L(`Back from ${ZONES[t.zone].name} in ${wait(t.left)}`, `${ZONES[t.zone].name}: powrót za ${wait(t.left)}`);
    const eggLine = n => `${n.stage === 'cuddle' ? L('Egg in', 'Jajko za') : L('Hatches in', 'Wykluje się za')} ${wait(n.left)}`;
    const same = list => list[list.length - 1].left - list[0].left < 60000; // all due in the same minute: no "first"
    const more = out.length + eggs.length > 1 && (out.length > 1 || eggs.length > 1);
    const sum = !more ? '' : `<button type="button" class="chip pfsum" data-a="pfsum" aria-expanded="${sumOpen}"><span class="pfsuml">${[
      out.length > 1 ? `<span>${tripIcon}${same(out) ? L(`${cnt(out.length, 'party', 'parties')} out · back in ${wait(out[0].left)}`, `${cnt(out.length, '', '', 'wyprawa', 'wyprawy', 'wypraw')} · powrót za ${wait(out[0].left)}`) : L(`${cnt(out.length, 'party', 'parties')} out · first back in ${wait(out[0].left)}`, `${cnt(out.length, '', '', 'wyprawa', 'wyprawy', 'wypraw')} · pierwsza wraca za ${wait(out[0].left)}`)}</span>` : out.length ? `<span>${tripIcon}${tripLine(out[0])}</span>` : '',
      eggs.length > 1 ? `<span>${eggIcon}${L(`${cnt(eggs.length, 'egg')} · first in ${wait(eggs[0].left)}`, `${cnt(eggs.length, '', '', 'jajko', 'jajka', 'jajek')} · pierwsze za ${wait(eggs[0].left)}`)}</span>` : eggs.length ? `<span>${eggIcon}${eggLine(eggs[0])}</span>` : ''].filter(Boolean).join('')}</span><i class="pfcaret" aria-hidden="true"></i></button>`
      + (sumOpen ? `<div class="pfsumlist">${out.map(t => `<span class="chip">${tripLine(t)}</span>`).join('')}${eggs.map(n => `<span class="chip">${eggLine(n)}</span>`).join('')}</div>` : '');
    const stat = (!countOf(F, 'gate') ? '<span class="chip">' + L('Build an Expedition Gate to send pets exploring', 'Zbuduj Bramę wypraw, żeby wysyłać zwierzaki na wyprawy') + '</span>' : '')
      + (home.length ? `<button type="button" class="btn m" data-a="collect" data-id="${home[0].id}">${home.length > 1 ? L(`Welcome the parties back (${home.length})`, `Przywitaj drużyny (${home.length})`) : L(`Welcome them back${F.trips.length > 1 ? ` from ${ZONES[home[0].zone].name}` : ''}`, `Przywitaj drużynę${F.trips.length > 1 ? ` (${ZONES[home[0].zone].name})` : ''}`)}</button>` : '')
      + (hatch.length ? `<button type="button" class="btn m" data-a="hatch" data-slot="${hatch[0].slot}">${hatch.length > 1 ? L(`Hatch the eggs (${hatch.length})`, `Wykluj jajka (${hatch.length})`) : L(`Hatch the egg`, `Wykluj jajko`)}</button>` : '')
      + (F.wild ? `<button type="button" class="btn m" data-a="wildfight">${L(`Battle the wild ${SPECIES[F.wild.sp].name}`, `Walcz z dzikim zwierzakiem: ${SPECIES[F.wild.sp].name}`)}</button>` : '')
      + (F.garden.ripe ? `<button type="button" class="btn m" data-a="berries">${L(`Pick berries (${F.garden.ripe * BERRIES})`, `Zbierz jagody (${F.garden.ripe * BERRIES})`)}</button>` : '')
      + (more ? sum : (out.length ? `<span class="chip">${tripLine(out[0])}</span>` : '') + (eggs.length ? `<span class="chip">${eggLine(eggs[0])}</span>` : ''))
      + (countOf(F, 'gate') && F.trips.length < F.partyMax ? `<button type="button" class="btn m" data-a="explore">${F.trips.length ? L('Send another party', 'Wyślij kolejną drużynę') : L('Send pets exploring', 'Wyślij zwierzaki na wyprawę')}</button>` : '');
    const mails = F.mail.length + F.trades.filter(t => t.dir === 'in').length;
    el.innerHTML = `${stat ? `<div class="pfstat">${stat}</div>` : ''}<div class="pfrow"><button type="button" class="btn big" data-a="edit">${L(`Edit farm`, `Urządź farmę`)}</button>
      <button type="button" class="btn w pfmenu" data-a="pfmenu" aria-expanded="${navOpen}">${I.menu}${L('Menu', 'Menu')}${mails ? `<span class="pfbadge">${mails}</span>` : ''}</button>
      <div class="pfnav${navOpen ? ' open' : ''}">
      <button type="button" class="btn w" data-a="map">${L(`World map`, `Mapa świata`)}</button>
      <button type="button" class="btn w" data-a="friends">${L(`Friends`, `Znajomi`)}</button>
      <button type="button" class="btn w" data-a="ranks">${L(`Ranking`, `Ranking`)}</button>
      <button type="button" class="btn w" data-a="pets">${L(`My pets`, `Moje zwierzaki`)} ${F.pets.length}</button>
      <button type="button" class="btn w" data-a="album">${L(`Pet Album`, `Album zwierzaków`)}</button>
      ${F.mail.length + F.trades.length ? `<button type="button" class="btn w" data-a="mail">${L('Mail', 'Poczta')} ${mails || ''}</button>` : ''}</div></div>`;
  }
  // ---------- expeditions ----------
  const helperOf = type => F.pets.find(p => p.id === F.work?.[type]);
  const helpRow = type => { const w = WORK[type], h = helperOf(type); // the helper line on a building's card
    return h ? `<p class="helpon">${face(h)}<span>${L(`<b>${esc(h.name)}</b> ${w.job}. ${w.what(workPct(h, type))}.`, `<b>${esc(h.name)}</b> ${w.job}. ${w.what(workPct(h, type))}.`)}</span></p><button type="button" class="btn sm w" data-a="workopen" data-type="${type}">${L(`Change helper`, `Zmień pomocnika`)}</button>`
      : `<p class="hint">${L(`${elTag(w.el)} pets can help here.`, `Tu mogą pomagać zwierzaki żywiołu ${elTag(w.el)}.`)}</p><button type="button" class="btn sm w" data-a="workopen" data-type="${type}">${L(`Choose a helper`, `Wybierz pomocnika`)}</button>`; };
  const boostRow = type => { const on = F.buff?.[type], n = F.tokens?.[type] || 0; // Lucky Wheel boosters on a building's card
    return (on ? `<p class="helpon boost"><span><b>${boostName(type)}</b> ${on.left ? L(`runs for ${wait(on.left)} more.`, `działa jeszcze ${wait(on.left)}.`) : L(`${cnt(on.uses, 'use', 'uses')} left.`, `pozostało użyć: ${on.uses}.`)}</span></p>` : '')
      + (n && !on ? `<p class="hint">${boostWhat(type)}</p><button type="button" class="btn sm m" data-a="boost" data-type="${type}">${L(`Start booster (${n})`, `Włącz wzmocnienie (${n})`)}</button>` : n ? `<p class="hint">${L(`Boosters waiting: ${n}.`, `Czekające wzmocnienia: ${n}.`)}</p>` : ''); };
  const petRow = (p, extra = '') => `${favMark(p)}${face(p)}<b>${esc(p.name)}</b><small>${L(`Level ${p.lv}${extra}`, `Poziom ${p.lv}${extra}`)}</small>`;
  function paintPanel() { paintPanelNow(); addInfo(); }
  function paintPanelNow() {
    // where the send panel was scrolled, so a tap on a place or a pet does not jump it back
    const box = $('pf-panel'), was = box.querySelector('.tripp .dests') && panel?.kind === 'send' ? { t: box.querySelector('.tripp').scrollTop, d: box.querySelector('.dests').scrollLeft, p: box.querySelector('.party')?.scrollLeft || 0 } : null;
    if (!panel || mode !== 'farm' || (edit && panel.kind !== 'buy')) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (panel.kind === 'buy') { // a closer look at something from the build menu before paying for it
      const type = panel.type, it = ITEMS[type], have = countOf(F, type), up = UPGRADES[type], most = maxOf(F, type);
      const gift = F.stash[type] || 0;
      const why = gift ? '' : it.wheel && !have ? L('This one cannot be bought. It is a prize of the Lucky Wheel on the main page, one free spin a day.', 'Tego nie da się kupić. To nagroda z Koła szczęścia na stronie głównej: jeden darmowy obrót dziennie.') : it.pals && F.palpts < it.pals ? L(`Unlocks at ${it.pals} friendship points (you have ${F.palpts}). You earn them by helping out and leaving gifts.`, `Odblokuje się przy ${it.pals} punktach przyjaźni (masz ${F.palpts}). Zdobywasz je, pomagając innym i zostawiając prezenty.`)
        : it.craft && Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)) < it.craft ? (it.craft > 1 ? L(`Needs a level ${it.craft} Workshop. Tap your Workshop to improve it.`, `Wymaga Warsztatu na poziomie ${it.craft}. Dotknij swojego Warsztatu, żeby go ulepszyć.`) : L('Needs a Workshop on your farm. It is under Buildings.', 'Wymaga Warsztatu na farmie. Znajdziesz go w Budynkach.'))
        : it.house && F.house < it.house ? L(`Needs a level ${it.house} farmhouse. Tap your farmhouse to improve it.`, `Wymaga domu na poziomie ${it.house}. Dotknij domu, żeby go ulepszyć.`)
        : most && have >= most ? (type === 'hut' ? L(`You already have ${have}, the most a farm can hold. For more pets, build a Pet Lodge${F.house < 4 ? ' (it needs a level 4 farmhouse)' : ''}: it stores up to 300.`, `Masz już ${have}, więcej farma nie pomieści. Żeby mieć więcej zwierzaków, zbuduj Schronisko${F.house < 4 ? ' (wymaga domu na poziomie 4)' : ''}: pomieści do 300.`) : L(`You already have ${most === 1 ? 'one, and one is the most a farm can hold' : `${have}, the most a farm can hold`}.`, `Masz już ${have}, a więcej farma nie pomieści.`))
        : !canAfford(F.inv, it.cost) ? L('You do not have enough materials yet.', 'Nie masz jeszcze dość materiałów.') : '';
      const size = it.w === it.h ? (it.w < 1 ? L('Half a tile', 'Pół kratki') : it.w === 1 ? L('One tile', 'Jedna kratka') : L(`${it.w} by ${it.h} tiles`, `${it.w} na ${it.h} kratki`)) : L(`${it.w} by ${it.h} tiles`, `${it.w} na ${it.h} kratki`);
      box.innerHTML = `<div class="panel tripp buy"><div class="buytop">${thumb(type, it.name)}<div><h2>${it.name}</h2><p>${it.desc}</p></div></div>
        <p class="hint">${size}${it.walk ? L(' · pets can walk over it', ' · zwierzaki mogą po tym chodzić') : ''}${most ? L(` · you have ${have} of ${most}`, ` · masz ${have} z ${most}`) : have ? L(` · you have ${have}`, ` · masz ${have}`) : ''}${up ? L(` · can be improved to level ${lvMax(type)}`, ` · można ulepszyć do poziomu ${lvMax(type)}`) : ''}</p>
        <p><b>${L(`Price`, `Cena`)}</b></p><div class="cost">${gift ? `<span class="mat">${L(`Free: a gift from a friend (${gift} to place)`, `Za darmo: prezent od znajomego (do postawienia: ${gift})`)}</span>` : costHtml(it.cost, F.inv)}</div>
        <p class="hint">${why || L('After buying, drag it to where you want it. Selling it later gives everything back.', 'Po zakupie przeciągnij to tam, gdzie chcesz. Przy sprzedaży wraca cały koszt.')}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button>
          <button type="button" class="btn big m" data-a="buy" data-type="${type}" ${why ? 'disabled' : ''}>${gift ? L('Place it', 'Postaw') : L('Buy and place', 'Kup i postaw')}</button></div></div>`;
      return;
    }
    if (panel.kind === 'team') { // who fights (or defends), in order: the first one leads
      const away = outAll(), what = panel.mode === 'defend' ? L('Defence team', 'Drużyna obrony') : panel.mode === 'live' ? L(`Live battle with ${esc(panel.foeName)}`, `Bitwa na żywo: ${esc(panel.foeName)}`) : panel.mode === 'arena' ? L(`Match against ${esc(panel.foeName)}`, `Mecz: ${esc(panel.foeName)}`) : L('Practice battle', 'Bitwa treningowa');
      const pets = favFirst(F.pets.filter(p => !p.lodge)).map(p => { const i = panel.pets.indexOf(p.id), out = busyFor(p, panel.mode);
        return `<button type="button" class="pickpet${out ? ' off' : ''}" data-a="team" data-id="${p.id}" data-why="${out}" aria-pressed="${i >= 0}">${i >= 0 ? `<span class="num">${i + 1}</span>` : ''}
          ${petRow(p, out ? ' · ' + out : ' · ' + elName(elOf(p)))}</button>`; }).join('');
      const note = panel.mode === 'live' ? `${L(`You both play at the same time, with ${TURN_S} seconds to choose each turn. Everyone fights at level 20. ${panel.invite ? '' : `${esc(panel.foeName)} has to be online to say yes.`}`, `Gracie jednocześnie i macie ${TURN_S} sekund na wybór w każdej turze. Wszyscy walczą na poziomie 20. ${panel.invite ? '' : `${esc(panel.foeName)} musi być online, żeby się zgodzić.`}`)}`
        : panel.mode === 'defend' ? L('These pets defend your farm when another player challenges you. They fight at level 20 and are played by the game.', 'Te zwierzaki bronią twojej farmy, gdy wyzwie cię inny gracz. Walczą na poziomie 20, a steruje nimi gra.')
        : panel.mode === 'arena' ? `${L(`Everyone fights at level 20 with all four moves. ${F.fights.arena > 0 ? `Rewarded matches left today: ${F.fights.arena}.` : 'No rewarded matches left today, so this one is just for fun.'}`, `Wszyscy walczą na poziomie 20 i mają wszystkie cztery ruchy. ${F.fights.arena > 0 ? `Mecze z nagrodą na dziś: ${F.fights.arena}.` : 'Na dziś nie ma już meczów z nagrodą, więc ten jest tylko dla zabawy.'}`)}`
        : `${L(`Your pets fight at their own level against partners of the same level. ${F.fights.practice > 0 ? `Practice fights that give experience today: ${F.fights.practice}.` : 'No more experience from practice today, but you can still fight for fun.'}`, `Twoje zwierzaki walczą na swoim poziomie z partnerami na tym samym poziomie. ${F.fights.practice > 0 ? `Walki treningowe z doświadczeniem na dziś: ${F.fights.practice}.` : 'Dziś trening nie daje już doświadczenia, ale nadal możesz walczyć dla zabawy.'}`)}`;
      box.innerHTML = `<div class="panel tripp"><h2>${what}</h2><p>${L(`Pick up to ${PARTY}. The first one you tap leads.`, `Wybierz najwyżej ${PARTY}. Pierwszy dotknięty prowadzi.`)}</p>
        <div class="party">${pets}</div><p class="hint">${note}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button>
          <button type="button" class="btn big m" data-a="${panel.mode === 'defend' ? 'defend' : 'fight'}" ${panel.pets.length ? '' : 'disabled'}>${panel.mode === 'defend' ? L('Save team', 'Zapisz drużynę') : panel.mode === 'live' ? (panel.invite ? L('Join the battle', 'Dołącz do bitwy') : L('Send the invitation', 'Wyślij zaproszenie')) : 'Start'}</button></div></div>`;
      return;
    }
    if (panel.kind === 'work') { // who helps at this building
      const type = panel.type, w = WORK[type], now = helperOf(type), jobs = Object.entries(F.work || {});
      const pets = favFirst(F.pets.filter(p => !p.lodge && canWork(p, type)).sort((a, b) => workPct(b, type) - workPct(a, type))).map(p => { const out = busyFor(p, 'train'), other = jobs.find(([k, id]) => id === p.id && k !== type);
        return `<button type="button" class="pickpet${out ? ' off' : ''}" data-a="workpick" data-id="${p.id}" data-why="${out}" aria-pressed="${now?.id === p.id}">${petRow(p, ` · ${STAR_NAME[w.stat]} ${p.stars?.[w.stat] || 3}★ · <b>${workPct(p, type)}%</b>` + (out ? ' · ' + out : other ? L(` · leaves the ${ITEMS[other[0]].name}`, ` · zostawi pracę: ${ITEMS[other[0]].name}`) : F.train.ids.includes(p.id) ? L(' · stops training', ' · przerwie trening') : ''))}</button>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Helper at the ${ITEMS[type].name}`, `Pomocnik: ${ITEMS[type].name}`)}</h2>
        <p>${L(`One ${elTag(w.el)} pet can work here. ${w.what('X')}, where X grows with the pet's level and its ${STAR_NAME[w.stat]} stars. A pet has one job at a time: sending it exploring, training or to the Nest ends its work here.`, `Może tu pracować jeden zwierzak żywiołu ${elTag(w.el)}. ${w.what('X')}, a X rośnie z poziomem zwierzaka i jego gwiazdkami cechy ${STAR_NAME[w.stat]}. Zwierzak ma jedno zajęcie naraz: wyprawa, trening albo Gniazdo kończą jego pracę tutaj.`)}</p>
        <div class="party">${pets || `<p class="hint">${L(`You have no ${w.el} pets yet. ${Object.values(ZONES).filter(z => z.el === w.el).slice(0, 2).map(z => z.name).join(' and ')} are good places to look.`, `Nie masz jeszcze zwierzaków żywiołu ${elName(w.el)}. Warto ich poszukać tutaj: ${Object.values(ZONES).filter(z => z.el === w.el).slice(0, 2).map(z => z.name).join(', ')}.`)}</p>`}</div>
        <div class="row end">${now ? `<button type="button" class="btn w" data-a="workoff" data-type="${type}">${L(`Send ${esc(now.name)} home`, `Odeślij do domu: ${esc(now.name)}`)}</button>` : ''}<button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'train') {
      const gone = outAll(), pets = favFirst(F.pets.filter(p => !p.lodge)).map(p => { const on = panel.pets.includes(p.id), full = p.lv >= MAX_LV, out = busyFor(p, 'train');
        return `<button type="button" class="pickpet${full || out ? ' off' : ''}" data-a="trainpick" data-id="${p.id}" data-why="${out}" aria-pressed="${on}">${petRow(p, out ? ' · ' + out : full ? L(' · fully grown', ' · w pełni dorosły') : L(' · level ', ' · poziom ') + p.lv)}</button>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Who trains at the yard?`, `Kto trenuje na placu?`)}</h2><p>${L(`Pick up to ${F.train.slots}. Each one earns ${TRAIN_XP} experience an hour, even while you are away. A pet that is out exploring or cuddling in the Nest cannot train, and sending a pet exploring ends its training.`, `Wybierz najwyżej ${F.train.slots}. Każdy zdobywa ${TRAIN_XP} doświadczenia na godzinę, także pod twoją nieobecność. Zwierzak na wyprawie albo w Gnieździe nie może trenować, a wysłanie go na wyprawę kończy trening.`)}</p>
        <div class="party">${pets}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button><button type="button" class="btn big m" data-a="trainsave">${L(`Save`, `Zapisz`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'compare') { // my album next to the neighbour's: who could help whom
      const has = (al, sp) => al?.[sp]?.some(Boolean), all = Object.keys(SPECIES);
      const theirs = all.filter(sp => has(V.album, sp) && !has(F.album, sp)), mine = all.filter(sp => has(F.album, sp) && !has(V.album, sp));
      const names = l => l.length ? l.map(sp => `<span class="chip">${thumb('pet:' + sp)}${SPECIES[sp].name}</span>`).join('') : '<span class="hint">' + L('Nothing right now.', 'Na razie nic.') + '</span>';
      const rows = all.map(sp => `<div class="cmp"><span>${has(F.album, sp) || has(V.album, sp) ? thumb('pet:' + sp) + SPECIES[sp].name : '<span class="nothumb">?</span>' + L('Not found yet', 'Jeszcze nieodkryty')}</span><b class="${has(F.album, sp) ? 'got' : ''}">${has(F.album, sp) ? '✓' : '–'}</b><b class="${has(V.album, sp) ? 'got' : ''}">${has(V.album, sp) ? '✓' : '–'}</b></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Your album and ${esc(V.name)}'s`, `Twój album i album gracza ${esc(V.name)}`)}</h2>
        <p><b>${L(`${esc(V.name)} has found, and you have not:`, `${esc(V.name)} ma, a ty jeszcze nie:`)}</b></p><div class="cmplist">${names(theirs)}</div>
        <p><b>${L(`You have found, and ${esc(V.name)} has not:`, `Ty masz, a ${esc(V.name)} jeszcze nie:`)}</b></p><div class="cmplist">${names(mine)}</div>
        <p class="hint">${L(`A trade or a playdate can fill the gaps.`, `Braki można uzupełnić wymianą albo wspólną zabawą zwierzaków.`)}</p>
        <div class="cmp head"><span>${L('Pet', 'Zwierzak')}</span><b>${L('You', 'Ty')}</b><b>${esc(V.name)}</b></div><div class="cmprows">${rows}</div>
        <div class="row end"><button type="button" class="btn big m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'wx') { // the weather now, what it gives, and the other kinds
      const { hour, w } = skyNow();
      box.innerHTML = `<div class="panel tripp"><h2 class="icoh">${wxIcon(w.kind, 40)}${w.name}</h2>
        <p>${L(`<b>${dayPart(hour)}</b> on your clock. The weather is the same for everyone and changes in about ${wait(w.left)}.`, `<b>${dayName(hour)}</b> na twoim zegarze. Pogoda jest taka sama dla wszystkich i zmieni się za około ${wait(w.left)}.`)}</p>
        <p class="wxnow"><b>${L(`Right now:`, `Teraz:`)}</b> ${w.bonus}</p>
        <p class="hint">${L(`Weather never takes anything away. Each kind only adds a little something.`, `Pogoda nigdy niczego nie zabiera. Każda coś od siebie dodaje.`)}</p>
        <div class="wxlist">${Object.entries(WEATHER).map(([k, x]) => `<div class="wxrow${k === w.kind ? ' on' : ''}">${wxIcon(k, 28)}<div><b>${x.name}</b><small>${x.bonus}</small></div></div>`).join('')}</div>
        <div class="row end"><button type="button" class="btn big m" data-a="shut">${L(`Got it`, `Jasne`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'mat') { // what a material is, where it comes from and what it is for
      const k = panel.mat, cap = k !== 'coins' && F.cap && ['wood', 'stone', 'fiber', 'shells', 'coal', 'berries'].includes(k);
      box.innerHTML = `<div class="panel tripp"><h2 class="icoh">${matIcon(k, 40)}${MATS[k]}</h2><div class="mats">${mat(k, F.inv[k] || 0)}</div>
        <p><b>${L(`Where it comes from`, `Skąd się bierze`)}</b><br>${MAT_INFO[k][0]}</p><p><b>${L(`What it is for`, `Do czego służy`)}</b><br>${MAT_INFO[k][1]}</p>
        ${cap ? `<p class="hint">${L(`Your farm can hold ${F.cap} of these. A Storage Barn holds more.`, `Twoja farma pomieści ${F.cap} sztuk. Stodoła pomieści więcej.`)}</p>` : ''}
        <div class="row end"><button type="button" class="btn big m" data-a="shut">${L(`Got it`, `Jasne`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'cook') {
      const kLv = Math.max(0, ...F.items.filter(i => i.type === 'kitchen').map(lvOf));
      const rows = Object.entries(RECIPES).map(([k, r]) => `<button type="button" class="zone${canAfford(F.inv, r.cost) && kLv >= (r.lv || 1) ? '' : ' off'}" data-a="cook" data-what="${k}" data-lv="${kLv >= (r.lv || 1) ? '' : r.lv}">${matIcon(k, 34)}<b>${r.name}</b><small>${kLv >= (r.lv || 1) ? r.desc : L(`Needs a level ${r.lv} Kitchen.`, `Wymaga Kuchni na poziomie ${r.lv}.`)}</small><span class="cost">${costHtml(r.cost, F.inv)}</span><small>${L(`You have ${F.inv[k] || 0}`, `Masz: ${F.inv[k] || 0}`)}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Kitchen`, `Kuchnia`)}</h2><p>${L(`You have ${F.inv.berries || 0} berries${F.inv.sunberry ? ` and ${F.inv.sunberry} sunberries` : ''}. To feed a treat, tap a pet on your farm.`, `Masz jagody: ${F.inv.berries || 0}${F.inv.sunberry ? ` i słoneczne jagody: ${F.inv.sunberry}` : ''}. Żeby podać smakołyk, dotknij zwierzaka na farmie.`)}</p>
        <div class="zones">${rows}</div><div class="row end"><button type="button" class="btn big m" data-a="shut">${L(`Done`, `Gotowe`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'swap') { // the Workshop swaps one material for another: pick what you give and what you get, see the deal, press Swap
      const wLv = Math.max(1, ...F.items.filter(i => i.type === 'workshop').map(lvOf)), keep = Math.round(SWAP_KEEP[wLv - 1] * 100);
      const have = m => F.inv[m] || 0, room = m => STORED.includes(m) ? Math.max(0, (F.cap || Infinity) - have(m)) : Infinity;
      const g = panel.give, k = panel.get, d = g && k ? swapDeal(g, k, wLv) : null;
      const most = d?.get ? Math.min(SWAP_MAX, Math.floor(have(g) / d.pay), Math.floor(room(k) / d.get)) : 0, n = Math.max(1, Math.min(panel.n || 1, most || 1)); panel.n = n;
      const pay = d ? d.pay * n : 0, got = d ? d.get * n : 0, off = !d?.get ? 'pick' : have(g) < pay ? 'few' : got > room(k) ? 'room' : '';
      const chip = (side, m) => { const on = side === 'give' ? m === g : m === k, dd = side === 'give' && k && m !== k ? swapDeal(m, k, wLv) : null, dim = side === 'give' && (!have(m) || dd && have(m) < dd.pay);
        return `<button type="button" class="swmat${dim ? ' off' : ''}" data-a="${side === 'give' ? 'swgive' : 'swget'}" data-mat="${m}" aria-pressed="${on}">${matIcon(m, 30)}<b>${MATS[m]}</b><small>${have(m)}</small></button>`; };
      const side = (cls, title, m, amount, after) => `<div class="swside ${cls}${m ? '' : ' empty'}"><small class="swlab">${title}</small>${m ? `${matIcon(m, 46)}<b class="swn">${amount}</b><span class="swname">${MATS[m]}</span><small>${after}</small>` : `<span class="swq" aria-hidden="true">?</span><span class="swname">${L('Not picked yet', 'Jeszcze nie wybrano')}</span>`}</div>`;
      const why = off === 'few' ? L(`You have ${have(g)}, and one swap needs ${d.pay}.`, `Masz ${have(g)}, a jedna wymiana wymaga ${d.pay}.`)
        : off === 'room' ? L(`Your storage holds ${F.cap} of each, so there is no room for that many. Spend some, or build a Storage Barn.`, `Magazyn mieści ${F.cap} każdego materiału, więc nie ma na tyle miejsca. Wydaj trochę albo zbuduj Stodołę.`)
        : !g || !k ? L('Pick what you give and what you get.', 'Wybierz, co dajesz i co dostajesz.') : '';
      const mats = Object.keys(WORTH), top = box.querySelector('.panel')?.scrollTop || 0;
      box.innerHTML = `<div class="panel tripp swapp"><h2>${L('Swap materials', 'Wymiana materiałów')}</h2>
        <p>${L('Give the Workshop something you have plenty of, and get something you need.', 'Daj Warsztatowi coś, czego masz dużo, a dostaniesz to, czego potrzebujesz.')}</p>
        <div class="swpicks">
          <section><h3>${L('1. You give', '1. Dajesz')}</h3><div class="swmats">${mats.map(m => chip('give', m)).join('')}</div></section>
          <section><h3>${L('2. You get', '2. Dostajesz')}</h3><div class="swmats">${mats.map(m => chip('get', m)).join('')}</div></section>
        </div>
        <div class="swdeal">
          ${side('give', L('You give', 'Dajesz'), g, pay || '', g ? L(`You have ${have(g)}`, `Masz: ${have(g)}`) : '')}
          <button type="button" class="swflip" data-a="swflip" ${g && k ? '' : 'disabled'} aria-label="${L('Turn the swap around', 'Odwróć wymianę')}" title="${L('Turn the swap around', 'Odwróć wymianę')}"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 8h13m-4-4 4 4-4 4M20 16H7m4-4-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          ${side('get', L('You get', 'Dostajesz'), k, got || '', k ? (d?.get && !off ? L(`You will have ${have(k) + got}`, `Będziesz mieć: ${have(k) + got}`) : L(`You have ${have(k)}`, `Masz: ${have(k)}`)) : '')}
        </div>
        ${d?.get ? `<div class="swhow"><div class="pills swapn" role="group" aria-label="${L('How many swaps at once', 'Ile wymian naraz')}">
          <button type="button" data-a="swn" data-n="${n - 1}" ${n > 1 ? '' : 'disabled'} aria-label="${L('Fewer', 'Mniej')}">−</button><span class="swtimes">×${n}</span><button type="button" data-a="swn" data-n="${n + 1}" ${n < most ? '' : 'disabled'} aria-label="${L('More', 'Więcej')}">+</button><button type="button" data-a="swn" data-n="${most}" ${most > 1 && n < most ? '' : 'disabled'}>${L('Most', 'Maks.')}</button></div>
          <small class="swrate">${L('One swap:', 'Jedna wymiana:')} <span>${d.pay} ${matIcon(g, 18)}</span> → <span>${d.get} ${matIcon(k, 18)}</span></small></div>` : ''}
        ${why ? `<p class="swwhy${off === 'pick' ? '' : ' bad'}">${why}</p>` : ''}
        <p class="hint">${L(`The Workshop keeps a small cut: at level ${wLv} you get back ${keep}% of the value.${wLv < SWAP_KEEP.length ? ' Improve it for better swaps.' : ''}`, `Warsztat bierze małą prowizję: na poziomie ${wLv} oddaje ${keep}% wartości.${wLv < SWAP_KEEP.length ? ' Ulepsz go, żeby wymieniać korzystniej.' : ''}`)}</p>
        <div class="row end"><button type="button" class="btn big w" data-a="shut">${L('Done', 'Gotowe')}</button><button type="button" class="btn big m" data-a="swdo" ${off ? 'disabled' : ''}>${d?.get ? L(`Swap ×${n}`, `Wymień ×${n}`) : L('Swap', 'Wymień')}</button></div></div>`;
      const pn = box.querySelector('.panel'); if (pn) pn.scrollTop = top;
      return;
    }
    if (panel.kind === 'gift') {
      const rows = Object.entries(GIFTS).filter(([k]) => BASIC.includes(k) || F.inv[k]).map(([k, n]) => `<button type="button" class="zone${(F.inv[k] || 0) < n ? ' off' : ''}" data-a="gift" data-mat="${k}">${matIcon(k, 30)}<b>${n} ${MATS[k].toLowerCase()}</b><small>${L(`You have ${F.inv[k] || 0}`, `Masz: ${F.inv[k] || 0}`)}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`A gift for ${esc(V.name)}`, `Prezent dla gracza ${esc(V.name)}`)}</h2><p>${L(`It comes out of your own stock and lands in their Mailbox. One gift a day for each neighbour.`, `Prezent pochodzi z twoich zapasów i trafia do Skrzynki pocztowej sąsiada. Jeden prezent dziennie na sąsiada.`)}</p>
        <div class="zones">${rows}</div>
        <p>${L(`<b>Or a decoration.</b> You pay for it, and they can place it for free.`, `<b>Albo ozdoba.</b> Ty płacisz, a sąsiad stawia ją za darmo.`)}</p>
        <div class="zones">${Object.entries(ITEMS).filter(([, it]) => it.kind === 'd' && !it.pals && !it.wheel && !(it.craft && Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)) < it.craft) && canAfford(F.inv, it.cost)).map(([k, it]) => `<button type="button" class="zone" data-a="gift" data-item="${k}">${thumb(k)}<b>${it.name}</b><span class="cost">${costHtml(it.cost, F.inv)}</span></button>`).join('') || '<span class="hint">' + L('You cannot afford any decoration right now.', 'Na razie nie stać cię na żadną ozdobę.') + '</span>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'trade') { // build an offer for the farm being visited
      const T = panel, away = outNow();
      const petBtn = (x, sideKey, off) => `<button type="button" class="pickpet${off ? ' off' : ''}" data-a="tradepet" data-side="${sideKey}" data-id="${x.id}" aria-pressed="${T[sideKey].pets.includes(x.id)}">${petRow(x, off ? ' · ' + off : T[sideKey].pets.includes(x.id) ? L(' · in the offer', ' · w ofercie') : '')}</button>`;
      const FOOD = ['sunberry', 'cookie', 'cake', 'juice', 'pie', 'tonic'];
      const mats = (sideKey, inv) => Object.keys(MATS).filter(k => k !== 'coins').filter(k => T[sideKey].mats[k] || (inv ? inv[k] > 0 : T.more || !FOOD.includes(k))).map(k => { const n = T[sideKey].mats[k] || 0, max = inv ? inv[k] || 0 : 9999;
        return `<div class="tm${n ? ' on' : ''}">${matIcon(k, 30)}<span class="tmn"><b>${MATS[k]}</b>${inv ? `${L(`<small>You have ${inv[k] || 0}</small>`, `<small>Masz: ${inv[k] || 0}</small>`)}` : ''}</span>
          <span class="step"><button type="button" data-a="tmstep" data-d="-1" aria-label="${L(`Less ${MATS[k]}`, `Mniej: ${MATS[k]}`)}">−</button><input class="field" type="number" inputmode="numeric" min="0" max="${max}" data-tm="${sideKey}" data-mat="${k}" value="${n || ''}" placeholder="0" aria-label="${L(`${MATS[k]}, how many`, `${MATS[k]}, ile`)}"><button type="button" data-a="tmstep" data-d="1" aria-label="${L(`More ${MATS[k]}`, `Więcej: ${MATS[k]}`)}">+</button></span></div>`; }).join('');
      const mine = favFirst(F.pets).map(x => petBtn(x, 'give', x.held ? L('promised', 'obiecany') : away.includes(x.id) ? 'exploring' : inNest(x.id) ? L('in the Nest', 'w Gnieździe') : F.def.includes(x.id) && F.pets.length > 3 ? '' : '')).join('');
      const theirs = V.pets.map(x => petBtn(x, 'want', x.can ? '' : L('staying', 'zostaje'))).join('');
      box.innerHTML = `<div class="panel tripp trade"><h2>${L(`Trade with ${esc(V.name)}`, `Wymiana z graczem ${esc(V.name)}`)}</h2>
        <p>${L(`Choose what you give and what you want back. Your side is set aside until ${esc(V.name)} answers from their Mailbox, or for a week.`, `Wybierz, co dajesz i co chcesz w zamian. Twoja część jest odłożona, aż ${esc(V.name)} odpowie ze swojej Skrzynki pocztowej, najdłużej przez tydzień.`)}</p>
        <section class="tside give"><h3>${L(`You give`, `Dajesz`)}</h3><p class="hint">${L(`Tap a pet to add it, up to three. Use the plus and minus buttons for materials.`, `Dotknij zwierzaka, żeby go dodać (najwyżej trzy). Materiały ustawisz przyciskami plus i minus.`)}</p><div class="party">${mine}</div><div class="tmrow">${mats('give', F.inv) || '<span class="hint">' + L('You have no materials to offer.', 'Nie masz materiałów do zaoferowania.') + '</span>'}</div></section>
        <section class="tside want"><h3>${L(`You ask for`, `Prosisz o`)}</h3><div class="party">${theirs || '<span class="hint">' + L('Their pets are all away.', 'Wszystkie zwierzaki sąsiada są poza farmą.') + '</span>'}</div><div class="tmrow">${mats('want', null)}</div>
          ${T.more ? '' : '<button type="button" class="btn sm w" data-a="trademore">' + L('Show food and treats too', 'Pokaż też jedzenie i smakołyki') + '</button>'}</section>
        <div class="tsum" role="status">${tradeSum()}</div>
        <div class="row end stick"><button type="button" class="btn w" data-a="shut">${L(`Not now`, `Nie teraz`)}</button><button type="button" class="btn big m" data-a="offer" ${tradeEmpty() ? 'disabled' : ''}>${L(`Send the offer`, `Wyślij ofertę`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'mail') {
      const box2 = !!countOf(F, 'mailbox');
      const rows = F.mail.map(m => { const got = m.pet ? `<span class="mat">${thumb('pet:' + m.pet.sp)}${SPECIES[m.pet.sp]?.name || ''}${m.pet.el ? ' · ' + elTag(m.pet.el) : ''}</span>` : m.boost ? `<span class="mat">${boostName(m.boost)}</span>` : m.item ? `<span class="mat">${thumb(m.item)}${ITEMS[m.item]?.name || L('A decoration', 'Ozdoba')}</span>` : m.got && Object.entries(m.got).map(([k, n]) => mat(k, n)).join('');
        const text = m.k === 'wheel' ? `<b>${L('A Lucky Wheel prize', 'Nagroda z Koła szczęścia')}</b>${m.pet ? `<small>${L('A baby pet. It needs a free bed.', 'Mały zwierzak. Potrzebuje wolnego łóżka.')}</small>` : m.boost ? `<small>${boostWhat(m.boost)}</small>` : ''}` : m.k === 'gift' ? `<b>${L(`A gift from ${esc(m.from)}`, `Prezent od gracza ${esc(m.from)}`)}</b>${m.text ? `<small>${esc(m.text)}</small>` : ''}` : m.k === 'note' ? `<b>${esc(srvText(m.text))}</b>` : m.k === 'date' ? `<b>${L(`${esc(m.from)} came for a playdate with ${esc(m.pet)}</b><small>A thank-you is inside.`, `${esc(m.from)}: wspólna zabawa z twoim zwierzakiem ${esc(m.pet)}</b><small>W środku czeka podziękowanie.`)}</small>` : m.k === 'help' ? `<b>${L(`${esc(m.from)} helped out</b><small>${m.n} ${m.n === 1 ? 'time' : 'times'} today. Thank them with a visit.`, `${esc(m.from)} pomaga na twojej farmie</b><small>Dziś ${cnt(m.n, 'time', 'times', 'raz', 'razy', 'razy')}. Podziękuj wizytą.`)}</small>`
          : `<b>${L(`${esc(m.from)} challenged your farm</b><small>${m.held ? 'Your team held. You earned 5 coins.' : 'Your team lost this one. Nothing was taken.'}`, `${esc(m.from)} rzuca wyzwanie twojej farmie</b><small>${m.held ? 'Twoja drużyna się obroniła. Dostajesz 5 monet.' : 'Tym razem twoja drużyna przegrała. Nic nie przepada.'}`)}</small>`;
        return `<div class="letter"><div>${text}${got ? `<div class="mats">${got}</div>` : ''}</div>${m.got || m.item || m.pet || m.boost ? `<button type="button" class="btn sm m" data-a="claim" data-id="${m.id}" ${box2 ? '' : 'disabled'}>${L(`Open`, `Otwórz`)}</button>` : ''}</div>`; }).join('');
      const side = x => [...x.pets.map(q => q ? `<span class="kin">${face(q)}<small>${esc(q.name)}${L(`<br>level ${q.lv}`, `<br>poziom ${q.lv}`)}</small></span>` : '<span class="kin"><span class="nothumb">?</span><small>' + L('a pet that moved on', 'zwierzak, którego już tu nie ma') + '</small></span>'), ...Object.entries(x.mats).map(([k, n]) => mat(k, n))].join('') || '' + L('<span class="hint">nothing</span>', '<span class="hint">nic</span>') + '';
      const deals = F.trades.map(t => `<div class="letter deal"><div><b>${L(`${t.dir === 'in' ? `${esc(t.who)} offers a trade` : `Your offer to ${esc(t.who)}`}`, `${t.dir === 'in' ? `${esc(t.who)} proponuje wymianę` : `Twoja oferta dla gracza ${esc(t.who)}`}`)}</b><small>${L(`${t.dir === 'in' ? 'Answer' : 'Waits'} for ${t.left > 36 * 3600000 ? Math.round(t.left / 86400000) + ' days' : wait(t.left)} more.`, `${t.dir === 'in' ? 'Czas na odpowiedź' : 'Oferta czeka jeszcze'}: ${t.left > 36 * 3600000 ? Math.round(t.left / 86400000) + ' dni' : wait(t.left)}.`)}</small>
          <div class="swap"><div><small>${L(`${t.dir === 'in' ? 'You get' : 'You give'}`, `${t.dir === 'in' ? 'Dostajesz' : 'Dajesz'}`)}</small><div class="mats">${side(t.give)}</div></div><div><small>${L(`${t.dir === 'in' ? 'You give' : 'You get'}`, `${t.dir === 'in' ? 'Dajesz' : 'Dostajesz'}`)}</small><div class="mats">${side(t.want)}</div></div></div></div>
          <div class="dealbtns">${t.dir === 'in' ? `<button type="button" class="btn sm m" data-a="tradeyes" data-id="${t.id}">${L(`Accept`, `Przyjmij`)}</button><button type="button" class="btn sm w" data-a="tradecounter" data-id="${t.id}">${L(`Counter`, `Kontroferta`)}</button><button type="button" class="btn sm ghost-ink" data-a="tradeno" data-id="${t.id}">${L(`Decline`, `Odrzuć`)}</button>` : `<button type="button" class="btn sm w" data-a="tradecancel" data-id="${t.id}">${L(`Take it back`, `Wycofaj`)}</button>`}</div></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Mailbox`, `Skrzynka pocztowa`)}</h2>${box2 ? '' : '<p>' + L('Build a Mailbox on your farm to open gifts.', 'Zbuduj na farmie Skrzynkę pocztową, żeby otwierać prezenty.') + '</p>'}
        ${deals}${rows || (deals ? '' : '<p class="hint">' + L('Nothing new. Gifts, trade offers and news from neighbours land here.', 'Nic nowego. Trafiają tu prezenty, oferty wymiany i wieści od sąsiadów.') + '</p>')}
        <div class="row end">${box2 && F.mail.some(m => !m.got && !m.item && !m.pet && !m.boost) ? '<button type="button" class="btn w" data-a="mailread">' + L('Clear the news', 'Wyczyść wieści') + '</button>' : ''}<button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'nest') { // choose the two parents and see what the egg might hold
      const fr = panel.friend, pool = F.pets, pk = panel.pick;
      const A = pool.find(x => x.id === pk[0]), Bp = fr ? fr.pet : pool.find(x => x.id === pk[1]);
      const rows = favFirst(pool).map(x => { const why = cannotPair(x), on = pk.includes(x.id);
        return `<button type="button" class="pickpet${why ? ' off' : ''}" data-a="nestpick" data-id="${x.id}" aria-pressed="${on}">${petRow(x, why ? ' · ' + why : '')}</button>`; }).join('');
      let pre = '';
      if (A && Bp) {
        const odds = speciesOdds(A.sp, Bp.sp), genes = [...new Set([...(A.col || [0]), ...(Bp.col || [0])])], parts = [A, Bp].filter(x => x.sp !== (x === A ? Bp : A).sp).map(x => PART[x.sp]);
        const marks = [...new Set([...(A.pat || []), ...(Bp.pat || [])])];
        const vars = Object.entries(odds.filter(o => !o.hybrid).reduce((m, o) => { for (const [e, c] of variantOdds(o.sp, A, Bp)) m[e] = Math.max(m[e] || 0, c); return m; }, {}));
        pre = `<div class="pre"><b>${L(`What might hatch`, `Co może się wykluć`)}</b>
          <div class="odds">${odds.map(o => o.hybrid && !F.album[o.sp] ? `<span class="odd"><span class="nothumb">?</span><small>${L(`Something new · ${Math.round(o.p * 100)}%`, `Coś nowego · ${Math.round(o.p * 100)}%`)}</small></span>` : `<span class="odd">${thumb('pet:' + o.sp, SPECIES[o.sp].name)}<small>${SPECIES[o.sp].name} · ${Math.round(o.p * 100)}%</small></span>`).join('')}</div>
          <p>${L('Coat', 'Futro')}: ${genes.map(g => swatch(g ? COATS[g].c : coatHex({ sp: odds[0].sp, col: [0] }), COATS[g].name)).join('')}<span class="hint">${L(` or a colour one of them is hiding.`, ` albo kolor, który któreś z nich ukrywa.`)}</span></p>
          ${vars.length ? `<p>${L('Element', 'Żywioł')}: ${vars.map(([e, c]) => `${elTag(e)} ${Math.round(c * 100)}%`).join(' ')}<span class="hint">${L(` chance the baby hatches as a variant with that element instead of its own.`, ` szans, że maluch wykluje się jako odmiana z tym żywiołem zamiast własnego.`)}</span></p>` : ''}
          ${familyOf(A.sp) && familyOf(A.sp) === familyOf(Bp.sp) && (A.sp !== Bp.sp || kinCoat(A) !== kinCoat(Bp)) ? `<p>${L(`Same family (${FAMILIES[familyOf(A.sp)][0].toLowerCase()}): the baby takes its build from one parent and its coat from either, ${coatName(kinCoat(A))} or ${coatName(kinCoat(Bp))}.`, `Ta sama rodzina (${FAMILIES[familyOf(A.sp)][0].toLowerCase()}): maluch bierze budowę po jednym rodzicu, a futro po którymkolwiek: ${coatName(kinCoat(A))} albo ${coatName(kinCoat(Bp))}.`)}</p>` : ''}
          ${marks.length ? `<p>${L(`Markings it may get: ${list(marks.map(k => PATTERNS[k].toLowerCase()))}.`, `Możliwe znaczenia: ${list(marks.map(k => PATTERNS[k].toLowerCase()))}.`)}</p>` : ''}
          ${parts.length ? `<p>${L(`It may borrow ${list(parts)}.`, `Może odziedziczyć: ${list(parts)}.`)}</p>` : ''}
          <p class="hint">${L(`The egg appears after ${CUDDLE_H} hours and hatches ${[...new Set([Math.min(...odds.map(o => hatchHours(o.sp))), Math.max(...odds.map(o => hatchHours(o.sp)))])].join(' to ')} hours later. Both rest for a while afterwards.`, `Jajko pojawi się po ${CUDDLE_H} godz., a wykluje się ${[...new Set([Math.min(...odds.map(o => hatchHours(o.sp))), Math.max(...odds.map(o => hatchHours(o.sp)))])].join('–')} godz. później. Potem oboje rodzice chwilę odpoczywają.`)}</p></div>`;
      }
      box.innerHTML = `<div class="panel tripp"><h2>${L(`${fr ? `Playdate with ${esc(fr.pet.name)}` : 'The Nest'}`, `${fr ? `Wspólna zabawa: ${esc(fr.pet.name)}` : 'Gniazdo'}`)}</h2>
        <p>${L(`${fr ? `Pick one of your pets to meet ${esc(fr.name)}'s ${esc(fr.pet.name)}. The egg comes home to your Nest.` : 'Pick two pets. Any two can have an egg together, and the baby takes after both.'}`, `${fr ? `Wybierz swojego zwierzaka na spotkanie: ${esc(fr.pet.name)} (${esc(fr.name)}). Jajko trafi do twojego Gniazda.` : 'Wybierz dwa zwierzaki. Każda para może mieć jajko, a maluch dziedziczy po obojgu.'}`)}</p>
        ${fr ? `<div class="party"><span class="pickpet" aria-pressed="true">${petRow(fr.pet, ' · ' + esc(fr.name))}</span></div>` : ''}
        <div class="party">${rows}</div>${pre}
        <div class="row end stick"><button type="button" class="btn w" data-a="shut">${L(`Not now`, `Nie teraz`)}</button><button type="button" class="btn big m" data-a="pair" ${A && Bp ? '' : 'disabled'}>${L(`Off to the Nest`, `Do Gniazda`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'born') { // the egg just hatched
      const p = F.pets.find(x => x.id === panel.id); if (!p) { panel = null; box.hidden = true; return; }
      const s = SPECIES[p.sp], [ma, pa] = p.par || [], got = [];
      if (p.look?.coat || p.look?.coat2) got.push(p.blend ? L('a blended coat', 'mieszane futro') : p.two != null ? L('a two-tone coat', 'dwukolorowe futro') : L(`a ${COATS[p.col[0]].name.toLowerCase()} coat`, `futro w kolorze: ${COATS[p.col[0]].name.toLowerCase()}`));
      if (p.pat?.length) got.push(list(p.pat.map(k => PATTERNS[k].toLowerCase())));
      if (p.look?.cat) got.push(L(`${coatName(p.cat)} from the ${SPECIES[p.cat].name} side`, `${coatName(p.cat)} (po rodzinie ${SPECIES[p.cat].name})`));
      if (variantOf(p)) got.push(L(`the ${p.el} element instead of ${s.el}`, `żywioł ${elName(p.el)} zamiast ${elName(s.el)}`));
      if (p.feat) got.push(PART[p.feat] + L(' from the ' + SPECIES[p.feat].name + ' side', ` (po rodzinie ${SPECIES[p.feat].name})`));
      if (p.xmove) got.push(L(`the move ${MOVES[p.xmove].name}`, `ruch ${MOVES[p.xmove].name}`));
      box.innerHTML = `<div class="panel tripp born"><h2>${L(`${p.sparkle ? 'A sparkling ' : 'A baby '}${s.name} hatched!`, `${p.sparkle ? 'Wykluwa się błyszczący maluch: ' : 'Wykluwa się maluch: '}${s.name}!`)}</h2>
        <div class="bornpic">${face(p, s.name)}</div>
        <p>${elTags(p)} ${s.blurb}</p>
        ${got.length ? `<p>${L('It has', 'Ma')} ${list(got)}.</p>` : `<p>${L('It looks just like its family.', 'Wygląda zupełnie jak jego rodzina.')}</p>`}${inLodge(p.id) ? `<p class="hint">${inLodge(p.id)}</p>` : ''}
        ${ma ? `<div class="tree"><span class="kin">${face(ma)}<small>${esc(ma.name)}</small></span><span class="plus">+</span><span class="kin">${face(pa)}<small>${esc(pa.name)}</small></span></div>` : ''}
        <div class="row end"><button type="button" class="btn w" data-a="petpage" data-id="${p.id}">${L(`Traits and family`, `Cechy i rodzina`)}</button><button type="button" class="btn m" data-a="shut">${L(`So cute!`, `Ale słodziak!`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'pet') { // everything about one pet, and its family tree
      const p = F.pets.find(x => x.id === panel.id); if (!p) { panel = null; box.hidden = true; return; }
      const s = SPECIES[p.sp], kin = k => k ? `<span class="kin">${face(k)}<small>${esc(k.name)}${k.own && k.own !== F.owner ? `${L(`<br>${esc(k.own)}'s`, `<br>(${esc(k.own)})`)}` : ''}</small></span>` : '';
      const tree = p.par ? `<p><b>${L(`Family`, `Rodzina`)}</b></p><div class="tree">${p.par.map(k => `<span class="branch">${kin(k)}${k.par?.length ? `<span class="gp">${k.par.map(kin).join('')}</span>` : ''}</span>`).join('')}</div>` : `<p class="hint">${L(`${p.from ? `Found in ${ZONES[p.from]?.name || 'the wild'}.` : 'Your first friend on the farm.'}`, `${p.from ? `Znaleziony tutaj: ${ZONES[p.from]?.name || 'w dziczy'}.` : 'Twój pierwszy przyjaciel na farmie.'}`)}</p>`;
      box.innerHTML = `<div class="panel tripp"><h2 class="pfname">${esc(p.name)}${favBtn(p, ' big')}</h2>
        <div class="leafpage">${face(p, s.name)}<div><p>${elTags(p)} ${s.name} · ${FORMS[formOf(p.lv)]} · ${L('Level', 'Poziom')} ${p.lv}${p.sparkle ? L(' · ✨ Sparkling', ' · ✨ Błyszczący') : ''}</p>
          <p class="hint">${L(`${p.first && p.first !== ctx.me()?.user ? `First raised by ${esc(p.first)}. ` : ''}${p.rest > 0 ? `Resting for ${wait(p.rest)} before the next egg. ` : ''}${p.open ? 'Friends who visit can pick it for a playdate.' : ''}`, `${p.first && p.first !== ctx.me()?.user ? `Pierwszy opiekun: ${esc(p.first)}. ` : ''}${p.rest > 0 ? `Odpoczywa jeszcze ${wait(p.rest)} przed kolejnym jajkiem. ` : ''}${p.open ? 'Odwiedzający znajomi mogą go wybrać do wspólnej zabawy.' : ''}`)}</p></div></div>
        <div class="starsrow">${STAR_NAME.map((n, i) => `<span>${n} ${stars(p.stars?.[i] || 3)}</span>`).join('')}</div>
        <p><b>${TALENTS[p.talent || 0].name}.</b> ${TALENTS[p.talent || 0].blurb}</p>
        <p>${L('Coat', 'Futro')}: ${swatch(coatHex(p), p.blend ? L('Blend', 'Mieszane') : COATS[p.col[0]].name)}${p.col.length > 1 ? ` ${L('hiding', 'ukrywa')} ${swatch(p.col[1] ? COATS[p.col[1]].c : coatHex({ sp: p.sp, col: [0] }), COATS[p.col[1]].name)}` : `<span class="hint"> ${L('Its hidden colour shows after two eggs.', 'Ukryty kolor pokaże się po dwóch jajkach.')}</span>`}</p>
        ${p.pat?.length ? `<p>${L(`Markings: ${list(p.pat.map(k => PATTERNS[k].toLowerCase()))}.`, `Znaczenia: ${list(p.pat.map(k => PATTERNS[k].toLowerCase()))}.`)}</p>` : ''}
        ${variantOf(p) ? `<p>${L(`${elTag(p.el)} variant: a ${s.name} is ${s.el} by nature. This one fights as ${p.el} and its first move is ${MOVES[movesAt(p.sp, 1, null, p.el)[0]].name}.`, `Odmiana ${elTag(p.el)}: ${s.name} ma z natury żywioł ${elName(s.el)}. Ten walczy jako ${elName(p.el)}, a jego pierwszy ruch to ${MOVES[movesAt(p.sp, 1, null, p.el)[0]].name}.`)}</p>` : ''}
        ${p.look?.cat ? `<p>${L(`Wears ${coatName(p.cat)} from the ${SPECIES[p.cat].name} side of its family.`, `Futro: ${coatName(p.cat)}, po rodzinie ${SPECIES[p.cat].name}.`)}</p>` : ''}
        ${p.feat ? `<p>${L(`Has ${PART[p.feat]} from its ${SPECIES[p.feat].name} family.`, `Po rodzinie ${SPECIES[p.feat].name} ma: ${PART[p.feat]}.`)}</p>` : ''}
        ${p.xmove ? `<p>${L(`Knows ${MOVES[p.xmove].name} from its other parent${p.lv < XMOVE_LV ? ` (wakes up at level ${XMOVE_LV})` : ''}.`, `Zna ruch ${MOVES[p.xmove].name} po drugim rodzicu${p.lv < XMOVE_LV ? ` (obudzi się na poziomie ${XMOVE_LV})` : ''}.`)}</p>` : ''}
        ${tree}
        ${panel.free ? `<div class="freeask"><p>${L(`<b>Let ${esc(p.name)} go free?</b> It leaves your farm for good and cannot come back. Its page in your Pet Album stays, and it leaves you a few berries as a thank-you.`, `<b>Wypuścić zwierzaka ${esc(p.name)} na wolność?</b> Opuści farmę na dobre i nie będzie mógł wrócić. Jego strona w Albumie zostaje, a w podziękowaniu zostawi ci kilka jagód.`)}</p>
          <div class="row end"><button type="button" class="btn m" data-a="freeno">${L(`Keep ${esc(p.name)}`, `${esc(p.name)} zostaje`)}</button><button type="button" class="btn r" data-a="freeyes" data-id="${p.id}">${L(`Yes, let it go free`, `Tak, wypuść na wolność`)}</button></div></div>`
        : `<div class="row end"><button type="button" class="btn w${freeWhy(p) ? ' off' : ''}" data-a="freeask" data-why="${esc(freeWhy(p))}">${L(`Let go free`, `Wypuść na wolność`)}</button><button type="button" class="btn w" data-a="petopen" data-id="${p.id}">${p.open ? L('Stop playdates', 'Wyłącz wspólne zabawy') : L('Allow playdates', 'Pozwól na wspólne zabawy')}</button><button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div>`}</div>`;
      return;
    }
    if (panel.kind === 'bye') { // a pet was just let go
      const g = panel.gone;
      box.innerHTML = `<div class="panel tripp byepet"><h2>${L(`Goodbye, ${esc(g.name)}!`, `Do widzenia, ${esc(g.name)}!`)}</h2>
        <div class="byeface">${face(g, SPECIES[g.sp].name)}</div>
        <p>${L(`${esc(g.name)} gave you one last nuzzle and set off to explore the islands on its own.`, `${esc(g.name)} przytula się jeszcze raz na pożegnanie i rusza zwiedzać wyspy na własną łapę.`)}</p>
        <p class="hint">${L(`It left you ${panel.got} berries as a thank-you. Its page stays in your Pet Album.`, `W podziękowaniu zostawia ci jagody: ${panel.got}. Jego strona zostaje w Albumie zwierzaków.`)}</p>
        <div class="row end"><button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'lodge') { // the Pet Lodge: storage for many pets, sorted into the owner's own collections
      const shelves = F.shelves || [], inside = F.pets.filter(p => p.lodge), isle = F.pets.filter(p => !p.lodge);
      if (panel.tab !== 'isle' && panel.tab !== 'all' && panel.tab !== 'none' && !shelves.some(x => x.id === panel.tab)) panel.tab = 'all';
      const tab = panel.tab, sh = shelves.find(x => x.id === tab);
      const pool = tab === 'isle' ? isle : tab === 'all' ? inside : tab === 'none' ? inside.filter(p => !shelfName(p.shelf)) : inside.filter(p => p.shelf === tab);
      const order = { lv: (a, b) => b.lv - a.lv || b.xp - a.xp, name: (a, b) => a.name.localeCompare(b.name, PL ? 'pl' : 'en'), el: (a, b) => Object.keys(ELEMENTS).indexOf(elOf(a)) - Object.keys(ELEMENTS).indexOf(elOf(b)) || b.lv - a.lv,
        sp: (a, b) => SPECIES[a.sp].name.localeCompare(SPECIES[b.sp].name, PL ? 'pl' : 'en') || b.lv - a.lv };
      const vis = pool.map((p, i) => ({ p, i })).sort((a, b) => order[panel.sort] ? order[panel.sort](a.p, b.p) : b.i - a.i).map(x => x.p);
      panel.sel = panel.sel.filter(id => vis.some(p => p.id === id));
      const pages = Math.max(1, Math.ceil(vis.length / LODGE_PAGE)); panel.page = Math.min(panel.page || 0, pages - 1); // a page at a time, so hundreds of pets stay quick
      const pill = (a, k, v, label) => `<button type="button" data-a="${a}" data-v="${v}" aria-pressed="${k === v}">${label}</button>`;
      const count = (n, label) => `${label} <small>${n}</small>`;
      const tabs = [pill('ldtab', tab, 'isle', count(isle.length, L('On the island', 'Na wyspie'))), pill('ldtab', tab, 'all', count(inside.length, L('Everyone inside', 'Wszyscy w środku'))),
        ...(shelves.length ? [pill('ldtab', tab, 'none', count(inside.filter(p => !shelfName(p.shelf)).length, L('Not sorted', 'Bez kolekcji')))] : []),
        ...shelves.map(x => pill('ldtab', tab, x.id, count(inside.filter(p => p.shelf === x.id).length, esc(x.name)))),
        shelves.length < SHELF_MAX ? `<button type="button" data-a="ldnew">+ ${L('New collection', 'Nowa kolekcja')}</button>` : ''].join('');
      const cells = vis.slice(panel.page * LODGE_PAGE, (panel.page + 1) * LODGE_PAGE).map(p => { const s = SPECIES[p.sp], on = panel.sel.includes(p.id);
        return `<div class="ldwrap"><button type="button" class="ldcell${on ? ' on' : ''}" data-a="ldpick" data-id="${p.id}" aria-pressed="${on}">${face(p, s.name)}<b>${esc(p.name)}${p.sparkle ? ' ✨' : ''}</b><small>${p.name === s.name ? '' : s.name + ' · '}${L('lv', 'poz.')} ${p.lv}</small><span class="prtags">${elTags(p)}</span></button>`
          + `${infoBtn(p.id, p.name, 'ldinfo')}</div>`; }).join('');
      const n = panel.sel.length, lodgeFree = Math.max(0, F.lodgeRoom - inside.length), isleFree = Math.max(0, F.room - isle.length);
      const acts = !n ? `<p class="hint">${tab === 'isle' ? L('Tap pets to pick them, then store them in the Lodge.', 'Dotknij zwierzaków, żeby je wybrać, i przenieś je do Schroniska.') : L('Tap pets to pick them, then sort them into a collection or move them back to the island.', 'Dotknij zwierzaków, żeby je wybrać, a potem dodaj je do kolekcji albo przenieś z powrotem na wyspę.')}</p>`
        : tab === 'isle' ? `<div class="ldacts"><span class="hint">${L(`Picked: ${n}`, `Wybrane: ${n}`)}</span><button type="button" class="btn sm m" data-a="ldin" data-v="" ${n > lodgeFree ? 'disabled' : ''}>${L('Store in the Lodge', 'Do Schroniska')}</button>${shelves.map(x => `<button type="button" class="btn sm w" data-a="ldin" data-v="${x.id}" ${n > lodgeFree ? 'disabled' : ''}>${L(`Store in ${esc(x.name)}`, `Do kolekcji ${esc(x.name)}`)}</button>`).join('')}</div>${n > lodgeFree ? `<p class="hint">${L(`The Lodge has room for ${lodgeFree} more.`, `W Schronisku zmieści się jeszcze ${lodgeFree}.`)}</p>` : ''}`
        : `<div class="ldacts"><span class="hint">${L(`Picked: ${n}. Move to`, `Wybrane: ${n}. Przenieś do`)}</span>${shelves.filter(x => x.id !== tab).map(x => `<button type="button" class="btn sm w" data-a="ldput" data-v="${x.id}">${esc(x.name)}</button>`).join('')}${shelves.length && tab !== 'none' && tab !== 'all' ? `<button type="button" class="btn sm w" data-a="ldput" data-v="">${L('Not sorted', 'Bez kolekcji')}</button>` : ''}<button type="button" class="btn sm m" data-a="ldout" ${n > isleFree ? 'disabled' : ''}>${L('Back to the island', 'Na wyspę')}</button></div>${n > isleFree ? `<p class="hint">${L(`The island has ${isleFree} free beds. Build or improve a Pet Hut for more.`, `Wolne łóżka na wyspie: ${isleFree}. Zbuduj albo ulepsz Chatkę zwierzaków, żeby było ich więcej.`)}</p>` : ''}`;
      const shelfRow = sh ? `<form class="ldname" data-shelf="${sh.id}"><input class="field" id="pf-shelf" maxlength="${SHELF_NAME}" value="${esc(sh.name)}" aria-label="${L('Collection name', 'Nazwa kolekcji')}" autocomplete="off"><button class="btn sm w">${L('Rename', 'Zmień nazwę')}</button>
          <button type="button" class="btn sm w" data-a="ldmove" data-v="left" aria-label="${L('Move this collection left', 'Przesuń kolekcję w lewo')}" ${shelves[0] === sh ? 'disabled' : ''}>◀</button><button type="button" class="btn sm w" data-a="ldmove" data-v="right" aria-label="${L('Move this collection right', 'Przesuń kolekcję w prawo')}" ${shelves.at(-1) === sh ? 'disabled' : ''}>▶</button>
          <button type="button" class="btn sm w" data-a="lddel">${L('Delete collection', 'Usuń kolekcję')}</button></form>` : '';
      box.innerHTML = `<div class="panel tripp pets lodgep"><h2>${L('Pet Lodge', 'Schronisko zwierzaków')}</h2>
        <p>${L(`${inside.length} of ${F.lodgeRoom} stored inside, ${isle.length} of ${F.room} beds taken on the island. Stored pets rest indoors: move them back out to the island to send them anywhere.`, `W środku: ${inside.length} z ${F.lodgeRoom}. Na wyspie zajęte łóżka: ${isle.length} z ${F.room}. Zwierzaki w Schronisku odpoczywają pod dachem: przenieś je na wyspę, żeby gdzieś je wysłać.`)}</p>
        <div class="pfsort ldtabs"><div class="pills">${tabs}</div></div>${shelfRow}
        <div class="pfsort"><span class="hint">${L('Sort', 'Kolejność')}</span><div class="pills">${pill('ldsort', panel.sort || 'new', 'new', L('Newest', 'Najnowsze'))}${pill('ldsort', panel.sort || 'new', 'sp', L('Species', 'Gatunek'))}${pill('ldsort', panel.sort || 'new', 'lv', L('Level', 'Poziom'))}${pill('ldsort', panel.sort || 'new', 'name', L('Name', 'Imię'))}${pill('ldsort', panel.sort || 'new', 'el', L('Element', 'Żywioł'))}</div>
          ${vis.length ? `<button type="button" class="btn sm w" data-a="ldall">${n === Math.min(vis.length, LODGE_PAGE) && n ? L('Pick none', 'Odznacz') : L('Pick this page', 'Wybierz stronę')}</button>` : ''}</div>
        ${acts}
        ${cells ? `<div class="ldgrid">${cells}</div>` : `<p class="hint">${tab === 'isle' ? L('No pets on the island.', 'Na wyspie nie ma zwierzaków.') : L('Nobody here yet.', 'Nikogo tu jeszcze nie ma.')}</p>`}
        ${pages > 1 ? `<div class="row ldpages"><button type="button" class="btn sm w" data-a="ldpage" data-v="-1" ${panel.page ? '' : 'disabled'}>◀</button><span class="hint">${L(`Page ${panel.page + 1} of ${pages}`, `Strona ${panel.page + 1} z ${pages}`)}</span><button type="button" class="btn sm w" data-a="ldpage" data-v="1" ${panel.page < pages - 1 ? '' : 'disabled'}>▶</button></div>` : ''}
        <div class="row end"><button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'pets') { // every pet on the farm: tap one to find it on the island
      const els = [...new Set(F.pets.map(elOf))], favs = F.pets.some(p => p.fav), on = els.includes(panel.el) || (panel.el === 'fav' && favs) ? panel.el : '';
      const order = { lv: (a, b) => b.lv - a.lv || b.xp - a.xp, name: (a, b) => a.name.localeCompare(b.name, PL ? 'pl' : 'en'), el: (a, b) => Object.keys(ELEMENTS).indexOf(elOf(a)) - Object.keys(ELEMENTS).indexOf(elOf(b)) || b.lv - a.lv };
      const vis = favFirst(F.pets.map((p, i) => ({ p, i })).filter(x => !x.p.lodge).filter(x => !on || (on === 'fav' ? x.p.fav : elOf(x.p) === on)).sort((a, b) => order[panel.sort] ? order[panel.sort](a.p, b.p) : b.i - a.i).map(x => x.p));
      const pill = (a, k, v, label) => `<button type="button" data-a="${a}" data-v="${v}" aria-pressed="${k === v}">${label}</button>`;
      const rows = vis.map(p => { const s = SPECIES[p.sp], st = petStatus(p);
        // one fixed shape per card: picture with its level badge, then name, species and stage on one line, element chips in a row, and the status on at most two lines
        return `<div class="petcell"><button type="button" class="petrow${st.away ? ' away' : ''}${p.fav ? ' fav' : ''}" data-a="petfind" data-id="${p.id}"><span class="prpic">${face(p, s.name)}<span class="prlv" title="${L(`Level ${p.lv}`, `Poziom ${p.lv}`)}">${L('Lv', 'poz.')} ${p.lv}</span></span><span class="pr"><b>${esc(p.name)}${p.sparkle ? ' ✨' : ''}</b>
          <small>${p.name === s.name ? '' : s.name + ' · '}${FORMS[formOf(p.lv)]}</small><span class="prtags">${elTags(p)}</span><em class="${st.cls}" title="${esc(st.text)}">${st.short || st.text}</em></span></button>${favBtn(p)}</div>`; }).join('');
      box.innerHTML = `<div class="panel tripp pets"><h2>${L(`My pets`, `Moje zwierzaki`)}</h2>
        <p>${L(`${F.pets.filter(p => !p.lodge).length} of ${F.room} beds on the island taken${F.lodgeRoom ? `, and ${F.pets.filter(p => p.lodge).length} of ${F.lodgeRoom} places in the Pet Lodge` : ''}. Tap a pet to find it on the farm. Tap the heart to make it a favourite: favourites come first wherever you pick pets.`, `Zajęte łóżka na wyspie: ${F.pets.filter(p => !p.lodge).length} z ${F.room}${F.lodgeRoom ? `, a miejsca w Schronisku: ${F.pets.filter(p => p.lodge).length} z ${F.lodgeRoom}` : ''}. Dotknij zwierzaka, żeby znaleźć go na farmie. Dotknij serca, żeby dodać go do ulubionych: ulubione są pierwsze wszędzie, gdzie wybierasz zwierzaki.`)}</p>
        <div class="pfsort"><span class="hint">${L('Sort', 'Kolejność')}</span><div class="pills">${pill('petsort', panel.sort || 'new', 'new', L('Newest', 'Najnowsze'))}${pill('petsort', panel.sort || 'new', 'lv', L('Level', 'Poziom'))}${pill('petsort', panel.sort || 'new', 'name', L('Name', 'Imię'))}${pill('petsort', panel.sort || 'new', 'el', L('Element', 'Żywioł'))}</div></div>
        ${els.length > 1 || favs ? `<div class="pfsort"><span class="hint">${L('Show', 'Pokaż')}</span><div class="pills">${pill('petel', on, '', L('All', 'Wszystkie'))}${favs ? pill('petel', on, 'fav', `<i class="pfheartdot">${HEART(12)}</i>${L('Favourites', 'Ulubione')}`) : ''}${(els.length > 1 ? els : []).map(e => pill('petel', on, e, `<i class="dot" style="--c:${ELEMENTS[e]}"></i>${elName(e)}`)).join('')}</div></div>` : ''}
        <div class="petlist">${rows}</div>
        <div class="row end">${F.lodgeRoom ? `<button type="button" class="btn w" data-a="lodgeopen">${L(`Pet Lodge (${F.pets.filter(p => p.lodge).length} inside)`, `Schronisko (w środku: ${F.pets.filter(p => p.lodge).length})`)}</button>` : ''}<button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'album') {
      const zoneOf = sp => Object.values(ZONES).find(z => sp in z.wild)?.name;
      const total = Object.keys(SPECIES).length, own = sp => F.album[sp]?.some(Boolean), have = Object.keys(SPECIES).filter(own).length;
      if (panel.sp && F.album[panel.sp]) { // one page of the album: owned, or only seen so far
        const sp = panel.sp, d = SPECIES[sp], a = F.album[sp], seen = !own(sp), k = KIT[sp], mine = F.pets.filter(x => x.sp === sp);
        const fm = a[panel.form] ? panel.form : Math.max(0, a.lastIndexOf(1)), pic = !seen && scene?.portrait?.(sp, fm, null); // the stage on show: any one already raised
        box.innerHTML = `<div class="panel tripp"><h2>${d.name}</h2>
          <div class="leafpage${seen ? ' seen' : ''}">${pic ? `<img class="formpic" src="${pic}" alt="${d.name}, ${FORMS[fm].toLowerCase()}" width="96" height="96">` : thumb('pet:' + sp, d.name)}<div><p>${elTag(d.el)}${d.el2 ? elTag(d.el2) : ''} ${RARITY[d.rare] || ''} · ${ROLE_NAME[k.role] || ''}</p><p class="hint">${d.blurb}</p></div></div>
          ${!seen && !d.el2 ? `<p><b>${L(`Elements raised:`, `Wychowane żywioły:`)}</b> ${Object.keys(ELEMENTS).map(e => `<span class="el${(F.vars?.[sp] || [d.el]).includes(e) ? '' : ' off'}" style="--c:${ELEMENTS[e]}">${elName(e)}</span>`).join(' ')}<span class="hint"> ${L('Pair it with a pet of another element for a chance of a variant.', 'Połącz go w parę ze zwierzakiem innego żywiołu, a może wykluje się odmiana.')}</span></p>` : ''}
          ${seen ? `<p>${L(`<b>Seen, not raised yet.</b> You met one at a neighbour's farm or in a battle. ${zoneOf(sp) ? 'Send a party to its home to find your own.' : d.hint || ''}`, `<b>Widziany, jeszcze niewychowany.</b> Taki zwierzak był na farmie sąsiada albo w bitwie. ${zoneOf(sp) ? 'Wyślij drużynę tam, gdzie mieszka, żeby znaleźć własnego.' : d.hint || ''}`)}</p>` : ''}
          ${familyOf(sp) ? `<p>${L(`<b>Family:</b> ${FAMILIES[familyOf(sp)][0]}. ${FAMILIES[familyOf(sp)][1].filter(x => x !== sp).map(x => own(x) || F.album[x] ? SPECIES[x].name : '?').join(', ')} ${FAMILIES[familyOf(sp)][1].length > 2 ? 'are' : 'is'} kin.`, `<b>Rodzina:</b> ${FAMILIES[familyOf(sp)][0]}. Krewni: ${FAMILIES[familyOf(sp)][1].filter(x => x !== sp).map(x => own(x) || F.album[x] ? SPECIES[x].name : '?').join(', ')}.`)}</p>` : ''}
          <p>${L(`<b>Lives in</b> ${zoneOf(sp) || 'no wild place: it only hatches from eggs'}. <b>On your farm:</b> ${mine.length ? mine.map(x => `${esc(x.name)} (level ${x.lv})`).join(', ') : 'none right now'}.`, `<b>Mieszka:</b> ${zoneOf(sp) || 'nigdzie w dziczy, wykluwa się tylko z jajek'}. <b>Na twojej farmie:</b> ${mine.length ? mine.map(x => `${esc(x.name)} (poziom ${x.lv})`).join(', ') : 'teraz żaden'}.`)}</p>
          <div class="formrow">${FORMS.map((f, i) => a[i] ? `<button type="button" class="chip got${i === fm ? ' on' : ''}" data-a="leafform" data-form="${i}" aria-pressed="${i === fm}" title="${L(`Show the ${f.toLowerCase()} form`, `Pokaż formę: ${f.toLowerCase()}`)}">${f} ✓</button>` : `<span class="chip not" title="${L(`Not raised yet`, `Jeszcze niewychowany`)}">${f}</span>`).join('')}</div>
          ${a.filter(Boolean).length > 1 ? '<p class="hint">' + L('Tap a stage to see how it looks.', 'Dotknij etapu, żeby zobaczyć, jak wygląda.') + '</p>' : ''}
          <p><b>${L(`Moves`, `Ruchy`)}</b></p><div class="mvlist">${k.moves.map((m, i) => `<span class="chip">${MOVES[m].name}${L(`<small> level ${LEARN[i]}</small>`, `<small> poziom ${LEARN[i]}</small>`)}</span>`).join('')}</div>
          <div class="row end"><button type="button" class="btn w" data-a="album">${L(`All pets`, `Wszystkie zwierzaki`)}</button><button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
        return;
      }
      const cells = Object.entries(SPECIES).map(([sp, d]) => { const a = F.album[sp];
        return own(sp) ? `<button type="button" class="leaf" data-a="leaf" data-sp="${sp}">${thumb('pet:' + sp, d.name)}<b>${d.name}</b>${elTag(d.el)}<span class="forms" title="${L(`Baby, young, adult`, `Maluch, podrostek, dorosły`)}">${a.map((x, i) => `<i class="${x ? 'on' : ''}" title="${FORMS[i]}"></i>`).join('')}</span></button>`
          : a ? `<button type="button" class="leaf seen" data-a="leaf" data-sp="${sp}">${thumb('pet:' + sp, d.name)}<b>${d.name}</b><small>${L(`Seen, not raised yet`, `Widziany, jeszcze niewychowany`)}</small></button>`
          : `<div class="leaf no"><span class="nothumb">?</span><b>${L(`Not found yet`, `Jeszcze nieodkryty`)}</b><small>${zoneOf(sp) || d.hint || ''}</small></div>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Pet Album`, `Album zwierzaków`)}</h2><p>${L(`${have} of ${total} species found${Object.keys(F.album).length > have ? ` and ${Object.keys(F.album).length - have} more seen` : ''}. Tap a pet to read its page. The three dots are the baby, young and adult forms you have raised. Your farm has room for ${F.allRoom} pets and ${F.pets.length} live there now. Coats found: ${F.coats.length} of ${COATS.length}. Markings found: ${F.marks.length} of ${Object.keys(PATTERNS).length}.`, `Odkryte gatunki: ${have} z ${total}${Object.keys(F.album).length > have ? `, a widziane: jeszcze ${Object.keys(F.album).length - have}` : ''}. Dotknij zwierzaka, żeby przeczytać jego stronę. Trzy kropki to wychowane formy: maluch, podrostek i dorosły. Na farmie jest miejsce dla ${F.allRoom} zwierzaków, a mieszka ich teraz ${F.pets.length}. Odkryte kolory futra: ${F.coats.length} z ${COATS.length}. Odkryte znaczenia: ${F.marks.length} z ${Object.keys(PATTERNS).length}.`)}</p>
        <div class="album">${cells}</div>
        <div class="row end"><button type="button" class="btn m" data-a="shut">${L(`Close`, `Zamknij`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'ranks') {
      const rows = (ranks || []).map((r, i) => `<div class="rk${r.me ? ' you' : ''}"><span class="rkn${i < 3 ? ' top' + (i + 1) : ''}">${i + 1}</span><div><b>${esc(r.name)}${r.me ? L(' (you)', ' (ty)') : ''}</b><small>${L(`Best pet level ${r.top} · ${r.pets} ${r.pets === 1 ? 'pet' : 'pets'}`, `Najlepszy zwierzak: poziom ${r.top} · ${cnt(r.pets, 'pet', 'pets', 'zwierzak', 'zwierzaki', 'zwierzaków')}`)}</small></div>
        <span class="faces">${r.team.map(t => thumb('pet:' + t.sp, SPECIES[t.sp]?.name)).join('')}</span><span class="rkp"><b>${r.pts}</b><small>${L(`points`, `punkty`)}</small></span></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>${L(`Ranking`, `Ranking`)}</h2><p>${L(`Every player's ladder points, highest first. ${countOf(F, 'flag') ? 'Win Arena matches to climb: 10 points for a win, 2 for a loss.' : 'Build an Arena Flag to fight for ladder points.'}`, `Punkty rankingowe wszystkich graczy, od najwyższych. ${countOf(F, 'flag') ? 'Wygrywaj mecze na Arenie, żeby piąć się w górę: 10 punktów za wygraną, 2 za porażkę.' : 'Zbuduj Flagę areny, żeby walczyć o punkty rankingowe.'}`)}</p>
        <div class="rks">${ranks ? rows : '<p class="hint">' + L('Counting points…', 'Liczę punkty…') + '</p>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Close`, `Zamknij`)}</button>${countOf(F, 'flag') ? '<button type="button" class="btn m" data-a="arena">' + L('Find a match', 'Znajdź mecz') + '</button>' : ''}</div></div>`;
      return;
    }
    if (panel.kind === 'foes') {
      const rows = (foes || []).map(f => `<button type="button" class="foe" data-a="foe" data-id="${esc(f.id)}"><b>${esc(f.name)}</b><small>${L(`${f.npc ? 'Neighbour' : 'Player'} · ${f.pts} points`, `${f.npc ? 'Sąsiad' : 'Gracz'} · ${f.pts} pkt`)}</small>
        <span class="faces">${f.team.map(t => thumb('pet:' + t.sp, SPECIES[t.sp]?.name)).join('')}</span></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Arena</h2><p>${L(`You have ${F.pts} ladder points. Rewarded matches left today: ${F.fights.arena}.`, `Masz punktów rankingowych: ${F.pts}. Mecze z nagrodą na dziś: ${F.fights.arena}.`)}</p>
        <div class="foes">${foes ? rows : '<p class="hint">' + L('Looking for opponents…', 'Szukam przeciwników…') + '</p>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button><button type="button" class="btn w" data-a="defteam">${L(`Choose defence team`, `Wybierz drużynę obrony`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'invite') {
      box.innerHTML = `<div class="panel tripp"><h2>${L(`${esc(panel.from)} invites you to a live battle`, `${esc(panel.from)} zaprasza cię na bitwę na żywo`)}</h2>
        <p>${L(`You both pick moves at the same time, with ${TURN_S} seconds for each turn. Everyone fights at level 20, and both of you earn coins and experience.`, `Wybieracie ruchy jednocześnie i macie ${TURN_S} sekund na każdą turę. Wszyscy walczą na poziomie 20, a obie strony dostają monety i doświadczenie.`)}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="duelno">${L(`Not now`, `Nie teraz`)}</button>
          <button type="button" class="btn big m" data-a="duelpick">${L(`Pick my team`, `Wybierz drużynę`)}</button></div></div>`;
      return;
    }
    if (panel.kind === 'prize') {
      const z = panel.prize, who = F.pets.filter(p => panel.ids.includes(p.id));
      const rows = z.counted ? who.map(p => { const g = z.grew.find(x => x.id === p.id);
        return `<div class="backpet">${thumb('pet:' + p.sp)}<div><b>${esc(p.name)}</b><small>${L(`+${z.xp} experience${g ? ` · <em>${g.form ? `grew up into its ${FORMS[g.form].toLowerCase()} form` : `reached level ${g.lv}`}</em>` : ''}`, `+${z.xp} doświadczenia${g ? ` · <em>${g.form ? `nowa forma: ${FORMS[g.form].toLowerCase()}` : `poziom ${g.lv}`}</em>` : ''}`)}</small></div></div>`; }).join('') : '';
      box.innerHTML = `<div class="panel tripp back"><h2>${L(`${z.won ? 'You won!' : panel.quit ? 'You left the ring' : 'You lost this one'}`, `${z.won ? 'Wygrana!' : panel.quit ? 'Walka przerwana' : 'Tym razem porażka'}`)}</h2>
        ${z.counted ? `<div class="mats">${z.coins ? mat('coins', '+' + z.coins) : ''}${z.rank ? `<span class="mat">${L(`+${z.rank} rank experience`, `+${z.rank} doświadczenia rangi`)}</span>` : ''}${z.pts ? `<span class="mat">${L(`+${z.pts} ladder points`, `+${z.pts} pkt rankingowych`)}</span>` : ''}</div>${rows}${z.joined && F.pets.find(p => p.id === z.joined) ? `<div class="backpet found">${thumb('pet:' + F.pets.find(p => p.id === z.joined).sp)}<div>${L(`<b>The wild ${SPECIES[F.pets.find(p => p.id === z.joined).sp].name} came home with you!</b><small>${inLodge(z.joined) || 'It has moved in on your farm.'}</small>`, `<b>Dziki zwierzak (${SPECIES[F.pets.find(p => p.id === z.joined).sp].name}) wraca z tobą do domu!</b><small>${inLodge(z.joined) || 'Zamieszkał na twojej farmie.'}</small>`)}</div></div>` : ''}${z.noroom ? '<p class="hint">' + L('It wanted to come along, but every bed is taken. Build a Pet Hut to make room.', 'Chciał pójść z wami, ale wszystkie łóżka są zajęte. Zbuduj Chatkę zwierzaków, żeby zrobić miejsce.') + '</p>' : ''}` : `<p class="hint">${L(`${panel.quit ? 'Giving up earns nothing.' : 'No rewards left for today, so that one was just for fun.'}`, `${panel.quit ? 'Za poddanie się nie ma nagrody.' : 'Na dziś nie ma już nagród, więc ta walka była tylko dla zabawy.'}`)}</p>`}
        <button type="button" class="btn big m" data-a="shut">${L(`Back to the farm`, `Wróć na farmę`)}</button></div>`;
      return;
    }
    if (panel.kind === 'send') {
      const z = ZONES[panel.zone], party = F.pets.filter(p => panel.pets.includes(p.id));
      const zones = Object.entries(ZONES).map(([k, zn]) => {
        const locked = F.house < zn.house;
        const gives = list(Object.keys(zn.gives).filter(m => m !== 'coins').map(m => MATS[m].toLowerCase()));
        return `<button type="button" class="zone dest${locked ? ' off' : ''}" data-a="zone" data-zone="${k}" aria-pressed="${panel.zone === k}"${zoneVars(k)}${locked ? ` title="${L(`Opens at farmhouse level ${zn.house}`, `Otwiera się, gdy dom ma poziom ${zn.house}`)}"` : ''}>${zoneSky(k)}
          ${locked ? `<span class="dlock">${LOCK}${L(`Farmhouse level ${zn.house}`, `Dom: poziom ${zn.house}`)}</span>` : panel.zone === k ? '<span class="dtick" aria-hidden="true">✓</span>' : ''}
          <span class="dcap"><b>${zn.name}</b><span class="dline">${elTag(zn.el)}<small>${gives}</small></span></span></button>`;
      }).join('');
      const trips = Object.entries(TRIPS).map(([k, tr]) => `<button type="button" data-a="trip" data-trip="${k}" aria-pressed="${panel.trip === k}">${tr.name}<small>${span(tr.min)}</small></button>`).join('');
      const pets = favFirst(F.pets.filter(p => !p.lodge)).map(p => `<button type="button" class="pickpet${busyFor(p, 'send') ? ' off' : ''}" data-a="party" data-id="${p.id}" data-why="${busyFor(p, 'send')}" aria-pressed="${panel.pets.includes(p.id)}">
        ${petRow(p, busyFor(p, 'send') ? ' · ' + busyFor(p, 'send') : F.train.ids.includes(p.id) ? L(' · training (ends if sent)', ' · trenuje (wyprawa przerwie trening)') : Object.values(F.work || {}).includes(p.id) ? L(' · helping at a building (ends if sent)', ' · pomaga przy budynku (wyprawa to przerwie)') : atHome(z, p.sp, elOf(p)) ? L(' · +25% here', ' · +25% tutaj') : '')}</button>`).join('');
      const est = party.length ? Object.entries(tripLoot(panel.zone, panel.trip, party)).map(([k, n]) => [k, Math.round(n)]).filter(([, n]) => n > 0).map(([k, n]) => mat(k, '~' + n)).join('') : '';
      const full = F.pets.length >= F.allRoom;
      if (panel.step === 'where') { // step 1 of 2: the whole panel is the places, so nothing hides below them
        box.innerHTML = `<div class="panel tripp sendwhere"><h2>${L(`Send pets exploring`, `Wyślij zwierzaki na wyprawę`)}</h2>
          <h3 class="tstep"><span class="tnum">1</span>${L('Where to? Tap an island.', 'Dokąd? Dotknij wyspy.')}<span class="tcount">${L('next: who goes', 'potem: kto idzie')}</span></h3>
          <div class="dests">${zones}</div>
          <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">${L(`Not now`, `Nie teraz`)}</button></div></div>`;
      } else {
      // step 2 of 2: the island they picked, what it gives, then how long and who goes
      const wild = Object.entries(z.wild).sort((a, b) => b[1] - a[1]).map(([sp]) => F.album?.[sp] ? `<span class="wildpet" title="${esc(SPECIES[sp].name)}">${thumb('pet:' + sp, SPECIES[sp].name)}</span>` : `<span class="wildpet unknown" title="${L('Not met yet', 'Jeszcze nie spotkany')}">?</span>`).join('');
      const perPet = Object.entries(z.gives).filter(([m]) => m !== 'coins').map(([m, n]) => mat(m, '~' + (n < 1 ? n : Math.round(n)))).join('');
      box.innerHTML = `<div class="panel tripp sendwho"><h2>${L(`Send pets exploring`, `Wyślij zwierzaki na wyprawę`)}</h2>
        <div class="zsum"${zoneVars(panel.zone)}><div class="dest zbig">${zoneSky(panel.zone)}</div>
          <div class="zinfo"><b class="zname">${z.name}</b><span class="dline">${elTag(z.el)}<small>${z.blurb}</small></span>
            <span class="hint">${L('Each pet brings back about this much an hour:', 'Każdy zwierzak przynosi mniej więcej tyle na godzinę:')}</span><div class="mats">${perPet}</div>
            <span class="hint">${L('Wild pets live here. The ones you have not met yet show as ?', 'Tu żyją dzikie zwierzaki. Te, których jeszcze nie znasz, mają znak ?')}</span><div class="wilds">${wild}</div>
            <button type="button" class="btn sm w" data-a="where">◀ ${L('Pick another island', 'Wybierz inną wyspę')}</button></div></div>
        <h3 class="tstep"><span class="tnum">2</span>${L('For how long?', 'Na jak długo?')}</h3>
        <div class="pills trips">${trips}</div>
        <h3 class="tstep"><span class="tnum">3</span>${L(`Who goes? Pick up to ${PARTY}.`, `Kto idzie? Wybierz najwyżej ${PARTY}.`)} <span class="tcount">${party.length} / ${PARTY}</span></h3>
        <div class="party">${pets}</div>
        <div class="est">${party.length ? `${L(`<span class="hint">Should bring back</span>`, `<span class="hint">Powinni przynieść</span>`)}<div class="mats">${est}</div>` : '<span class="hint">' + L('Tap a pet to add it to the party.', 'Dotknij zwierzaka, żeby dodać go do drużyny.') + '</span>'}</div>
        <p class="hint">${L(`${full ? 'Every bed is taken, so no wild pet can move in. Build a Pet Hut to make room.' : `Chance a wild pet follows them home: ${Math.round((F.first ? 1 : TRIPS[panel.trip].find) * 100)}%.`}`, `${full ? 'Wszystkie łóżka są zajęte, więc żaden dziki zwierzak się nie wprowadzi. Zbuduj Chatkę zwierzaków, żeby zrobić miejsce.' : `Szansa, że dziki zwierzak wróci z drużyną: ${Math.round((F.first ? 1 : TRIPS[panel.trip].find) * 100)}%.`}`)}</p>
        ${(() => { const w = skyNow().w; return ['sunny', 'wind', 'rainbow'].includes(w.kind) ? `<p class="wxnow">${wxIcon(w.kind)} <b>${w.name}:</b> ${w.bonus}</p>` : ''; })()}
        <div class="row end sendbar"><button type="button" class="btn ghost-ink" data-a="where">${L(`Back`, `Wstecz`)}</button>
          <button type="button" class="btn big m" data-a="send" ${party.length ? '' : 'disabled'}>${L(`Send ${party.length ? list(party.map(p => esc(p.name))) : 'them'}`, `Wyślij${party.length ? ': ' + list(party.map(p => esc(p.name))) : ''}`)}</button></div></div>`;
      }
    } else {
      const b = panel.back, z = ZONES[b.zone], found = b.found && F.pets.find(p => p.id === b.found);
      const who = F.pets.filter(p => b.pets.includes(p.id));
      const rows = who.map(p => { const g = b.grew.find(x => x.id === p.id);
        return `<div class="backpet">${thumb('pet:' + p.sp)}<div><b>${esc(p.name)}</b><small>${L(`+${b.xp} experience${g ? ` · <em>${g.form ? `grew up into its ${FORMS[g.form].toLowerCase()} form` : `reached level ${g.lv}`}</em>` : ''}`, `+${b.xp} doświadczenia${g ? ` · <em>${g.form ? `nowa forma: ${FORMS[g.form].toLowerCase()}` : `poziom ${g.lv}`}</em>` : ''}`)}</small></div></div>`; }).join('');
      const wnote = b.w === 'sunny' ? L('They set off in the sun and carried 20% more.', 'Wyruszyli w słońcu i przynieśli 20% więcej.') : b.w === 'wind' ? L('A tailwind brought them home sooner.', 'Wiatr w plecy pomógł im wrócić szybciej.') : b.w === 'rainbow' ? L('They set off under a rainbow, so wild pets were easier to meet.', 'Wyruszyli pod tęczą, więc łatwiej było spotkać dzikie zwierzaki.') : '';
      box.innerHTML = `<div class="panel tripp back"><h2>${L(`Back from ${z.name}</h2>`, `Powrót: ${z.name}</h2>`)}${wnote ? `<p class="hint">${wxIcon(b.w)} ${wnote}</p>` : ''}
        <div class="mats">${Object.entries(b.loot).map(([k, n]) => mat(k, '+' + n)).join('') || '<span class="hint">' + L('They came back empty-handed this time.', 'Tym razem wrócili z pustymi łapami.') + '</span>'}</div>
        ${rows}
        ${found ? `<div class="backpet found">${thumb('pet:' + found.sp)}<div>${L(`<b>A wild ${SPECIES[found.sp].name} followed them home!</b>`, `<b>Dziki zwierzak (${SPECIES[found.sp].name}) wraca z nimi do domu!</b>`)}<small>${elTag(SPECIES[found.sp].el)} ${RARITY[SPECIES[found.sp].rare]} · ${SPECIES[found.sp].blurb}${inLodge(found.id) ? ' ' + inLodge(found.id) : ''}</small></div></div>` : ''}
        ${b.wild && F.wild ? `<div class="backpet found">${thumb('pet:' + b.wild.sp)}<div>${L(`<b>A wild ${SPECIES[b.wild.sp].name} stood in their way!</b><small>Level ${b.wild.lv}. Win a short battle and it may come home with you. Losing costs nothing. It waits for half an hour.</small>`, `<b>Dziki zwierzak (${SPECIES[b.wild.sp].name}) staje im na drodze!</b><small>Poziom ${b.wild.lv}. Wygraj krótką bitwę, a może wróci z tobą do domu. Porażka nic nie kosztuje. Poczeka pół godziny.</small>`)}</div><button type="button" class="btn sm m" data-a="wildfight">${L(`Battle it`, `Walcz`)}</button></div>` : ''}
        ${b.spilt ? `<p class="hint">${L(`Your storage is full (${F.cap} of each), so some of it was left behind. ${countOf(F, 'barn') ? 'Spend or swap some to make room.' : 'A Storage Barn makes room for more.'}`, `Magazyn jest pełny (${F.cap} każdego materiału), więc część została na miejscu. ${countOf(F, 'barn') ? 'Wydaj trochę albo wymień w Warsztacie, żeby zrobić miejsce.' : 'Stodoła pomieści więcej.'}`)}</p>` : ''}
        ${b.full ? '<p class="hint">' + L('A wild pet wanted to come along, but every bed is taken. Build a Pet Hut to make room.', 'Dziki zwierzak chciał pójść z nimi, ale wszystkie łóżka są zajęte. Zbuduj Chatkę zwierzaków, żeby zrobić miejsce.') + '</p>' : ''}
        <button type="button" class="btn big m" data-a="shut">${L(`Great`, `Świetnie`)}</button></div>`;
    }
    const dests = box.querySelector('.dests');
    if (dests && was) { box.querySelector('.tripp').scrollTop = was.t; dests.scrollLeft = was.d; const pr = box.querySelector('.party'); if (pr) pr.scrollLeft = was.p; }
    else if (dests) { const on = dests.querySelector('[aria-pressed=true]'); if (on && dests.scrollWidth > dests.clientWidth) dests.scrollLeft = on.offsetLeft - (dests.clientWidth - on.offsetWidth) / 2; } // a swiping row (phone): start at the chosen place
    if (box.querySelector('img.zpic:not([src])')) drawZonePics();
  }
  // The island pictures are small 3D renders: draw one a frame so the picker opens at once, then keep them cached.
  let zpBusy = false;
  function drawZonePics() {
    if (zpBusy) return; zpBusy = true; let tries = 0;
    const step = () => {
      const im = !destroyed && $('pf-panel')?.querySelector('img.zpic:not([src])'), u = im && islePic('zn', +im.dataset.ig);
      if (!im) { zpBusy = false; return; }
      if (!u) { if (++tries < 20) setTimeout(() => requestAnimationFrame(step), 250); else zpBusy = false; return; } // the picture maker is still loading: try again shortly
      for (const x of $('pf-panel').querySelectorAll(`img.zpic[data-ig="${im.dataset.ig}"]`)) x.src = u;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // ---------- battles ----------
  const side = s => shown.sides[s], act = s => side(s).pets[side(s).on];
  const hpWas = [null, null]; let hurt = -1;
  const flash = big => { const f = $('pf-fl'); if (!f) return; f.classList.remove('flash', 'flashbig'); f.offsetWidth; f.classList.add(big ? 'flashbig' : 'flash'); };
  const who = s => !s ? esc(act(0).name) : B.mode === 'arena' || B.live ? L(`${esc(B.foe)}'s ${esc(act(1).name)}`, `${esc(act(1).name)} (${esc(B.foe)})`) : L(`The other side's ${esc(act(1).name)}`, `${esc(act(1).name)} (przeciwnik)`);
  function plate(s) {
    const u = act(s), pct = Math.round(u.hp / u.max * 100);
    const tags = [...Object.keys(u.status).map(k => `<span class="st bad" title="${STATUS[k].blurb}">${STATUS[k].name}</span>`),
      ...Object.entries(u.up).filter(([, n]) => n).map(([k, n]) => `<span class="st ${n > 0 ? 'good' : 'bad'}">${STAT_NAME[k]} ${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`)].join('');
    const was = hpWas[s]?.id === u.id ? hpWas[s].pct : pct; hpWas[s] = { id: u.id, pct };
    return `<div class="bplate ${s ? 'p1' : 'p0'}${hurt === s ? ' hurt' : ''}"><div class="bwho"><b>${esc(u.name)}</b>${elTag(u.el)}${L(`<small>Level ${u.lv}</small>`, `<small>Poziom ${u.lv}</small>`)}</div>
      <div class="bhp${pct < 25 ? ' low' : pct < 55 ? ' mid' : ''}"><u style="width:${was}%" data-to="${pct}"></u><i style="width:${was}%" data-to="${pct}"></i><span>${u.hp} / ${u.max}</span></div>
      <div class="btags">${tags}<span class="dots">${side(s).pets.map(x => `<i class="${x.hp > 0 ? '' : 'out'}"></i>`).join('')}</span></div></div>`;
  }
  function paintBattle() {
    const el = $('pf-bt');
    el.hidden = !B || mode !== 'farm';
    if (el.hidden) { el.innerHTML = ''; return; }
    for (const s of [0, 1]) scene?.ringState(s, act(s).hp > 0 ? Object.keys(act(s).status) : [], act(s).hp > 0 && act(s).hp < act(s).max * .25);
    const me = side(0), u = act(0), busy = playing || B.over !== null || (B.live && B.waiting);
    const clock = B.live && B.over === null && !playing ? `<span class="bclock" id="pf-clock">${Math.max(0, Math.ceil((liveAt - Date.now()) / 1000))}</span>` : '';
    const moves = u.moves.map(id => { const m = MOVES[id], cd = u.cd[id] || 0;
      const what = m.pow ? L(`Power ${m.pow}`, `Moc ${m.pow}`) : m.heal ? L('Heals', 'Leczy') : m.up ? L(`Raises ${STAT_NAME[m.up]}`, `Podnosi: ${STAT_NAME[m.up]}`) : L(`Lowers their ${STAT_NAME[m.down]}`, `Obniża przeciwnikowi: ${STAT_NAME[m.down]}`);
      return `<button type="button" class="mv" data-a="move" data-move="${id}" style="--c:${ELEMENTS[m.el]}" ${busy || cd || B.need ? 'disabled' : ''}><b>${m.name}</b><small>${cd ? L(`Ready in ${cd}`, `Gotowe za ${cd}`) : what + (m.status ? ` · ${STATUS[m.status].name}` : '')}</small></button>`; }).join('');
    const bench = me.pets.map((x, i) => i === me.on ? '' : `<button type="button" class="sw" data-a="swap" data-i="${i}" ${busy || x.hp <= 0 || (u.status.rooted && !B.need) ? 'disabled' : ''}>${thumb('pet:' + x.sp)}<span><b>${esc(x.name)}</b><small>${x.hp > 0 ? `${x.hp} / ${x.max}` : L('Fainted', 'Pokonany')}</small></span></button>`).join('');
    const logBox = logOpen ? `<div class="blogbox" id="pf-blog" aria-live="off"><h3>${L('Battle log', 'Dziennik bitwy')} <button type="button" class="blx" data-a="blog" aria-label="${L(`Hide the battle log`, `Ukryj dziennik bitwy`)}">×</button></h3><div class="bll">${blogs.map(l => l.turn ? `${L(`<p class="blt">Turn ${l.turn}</p>`, `<p class="blt">Tura ${l.turn}</p>`)}` : `<p class="${l.c}">${l.h}</p>`).join('') || '<p class="bln">' + L('Everything that happens in this fight is written down here.', 'Tu zapisuje się wszystko, co dzieje się w tej walce.') + '</p>'}</div></div>` : '';
    // The elements guide, as a picture: the ring of five with an arrow from each element to the one it beats, the two
    // pets in the ring marked on it, and the numbers for their match-up.
    const foe = act(1), hit = (a, t) => effect(a, t.el) * (t.el2 ? effect(a, t.el2) : 1);
    const ring = Object.keys(STRONG), at = (i, r = 74) => [130 + Math.cos((i * 72 - 90) * Math.PI / 180) * r, 108 + Math.sin((i * 72 - 90) * Math.PI / 180) * r];
    const arrows = ring.map((e, i) => { const [x1, y1] = at(i), [x2, y2] = at(i + 1), d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, hot = (u.el === e && foe.el === STRONG[e]) || (foe.el === e && u.el === STRONG[e]);
      return `<line x1="${(x1 + ux * 29).toFixed(1)}" y1="${(y1 + uy * 29).toFixed(1)}" x2="${(x2 - ux * 36).toFixed(1)}" y2="${(y2 - uy * 36).toFixed(1)}" stroke="${ELEMENTS[e]}" stroke-width="${hot ? 7 : 4}" stroke-linecap="round" marker-end="url(#pf-ah${i})" opacity="${hot ? 1 : .75}"/>`; }).join('');
    const nodes = ring.map((e, i) => { const [x, y] = at(i), [lx, ly] = at(i, 113), who = [u.el === e && L('You', 'Ty'), foe.el === e && L('Them', 'Oni')].filter(Boolean).join(' + ');
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="25" fill="${ELEMENTS[e]}" stroke="${who ? '#ffd84a' : '#2b2230'}" stroke-width="${who ? 5 : 2.5}"/><text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="eln">${elName(e)}</text>${who ? `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" class="elw">${who}</text>` : ''}`; }).join('');
    const duel = (a, t, by) => { const k = hit(a, t); return `<div class="elduel">${elTag(a)}<span class="elarrow">➜</span>${elTag(t.el)}${t.el2 ? elTag(t.el2) : ''}<b class="${k > 1 ? 'good' : k < 1 ? 'bad' : ''}">×${k}</b>${L(`<small>${by} ${k > 1 ? 'hit hard' : k < 1 ? 'hit weakly' : 'hit normally'}</small>`, `<small>${by} ${k > 1 ? 'trafiają mocno' : k < 1 ? 'trafiają słabo' : 'trafiają zwyczajnie'}</small>`)}</div>`; };
    const elBox = elOpen ? `<div class="blogbox elbox"><h3>${L('How elements work', 'Jak działają żywioły')} <button type="button" class="blx" data-a="elhelp" aria-label="${L(`Hide the elements guide`, `Ukryj przewodnik po żywiołach`)}">×</button></h3><div class="bll">
      <svg class="elsvg" viewBox="0 0 260 226" role="img" aria-label="${ring.map(e => L(`${e} beats ${STRONG[e]}`, `${elName(e)} pokonuje: ${elName(STRONG[e])}`)).join(', ')}"><defs>${ring.map((e, i) => `<marker id="pf-ah${i}" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ELEMENTS[e]}"/></marker>`).join('')}</defs>
        ${arrows}${nodes}<text x="130" y="104" text-anchor="middle" class="elc">${L('arrow', 'strzałka')}</text><text x="130" y="119" text-anchor="middle" class="elc">${L('= beats', '= pokonuje')}</text></svg>
      <div class="elkey"><span><b class="good">×1.5${L(`</b> along an arrow</span>`, `</b> zgodnie ze strzałką</span>`)}<span><b class="bad">×0.75${L(`</b> against it</span>`, `</b> pod prąd</span>`)}<span><b>+20%${L(`</b> own element</span>`, `</b> własny żywioł</span>`)}</div>
      ${duel(u.el, foe, L('Your moves', 'Twoje ruchy'))}${duel(foe.el, u, L('Their moves', 'Ruchy przeciwnika'))}</div></div>` : '';
    el.innerHTML = `${plate(1)}${plate(0)}${elBox || logBox}
      <div class="bbar"><p class="blog">${line || (B.live && B.waiting ? L(`Waiting for ${esc(B.foe)} to choose…`, `${esc(B.foe)} jeszcze wybiera…`) : B.need ? L('Who comes in next?', 'Kto wchodzi następny?') : L(`What should ${esc(u.name)} do?`, `Co ma zrobić ${esc(u.name)}?`))}${clock}</p>
        <div class="mvs">${moves}</div>
        <div class="bench">${bench}${!B.live && F.inv.juice ? `<button type="button" class="btn sm m" data-a="juice" ${busy || B.need || B.juiced || u.hp >= u.max ? 'disabled' : ''}>${L(`Berry Juice (${F.inv.juice})`, `Sok jagodowy (${F.inv.juice})`)}</button>` : ''}<button type="button" class="btn sm w" data-a="elhelp" aria-pressed="${elOpen}">${elOpen ? L('Hide elements guide', 'Ukryj przewodnik po żywiołach') : L('How elements work', 'Jak działają żywioły')}</button><button type="button" class="btn sm w" data-a="blog" aria-pressed="${logOpen && !elOpen}">${logOpen && !elOpen ? L('Hide battle log', 'Ukryj dziennik bitwy') : L('Battle log', 'Dziennik bitwy')}</button><button type="button" class="btn sm ghost-ink" data-a="giveup" ${busy ? 'disabled' : ''}>${L(`Give up`, `Poddaj się`)}</button></div></div>`;
    const bl = el.querySelector('.bll'); if (bl) bl.scrollTop = bl.scrollHeight;
    hurt = -1; el.offsetWidth; for (const b of el.querySelectorAll('.bhp [data-to]')) b.style.width = b.dataset.to + '%'; // bars slide from where they were
  }
  // A word or number that floats up from a pet in the ring.
  function floatUp(s, text, cls = '', dy = 0) {
    const at = scene?.ringSpot?.(s), box = $('pf-fl'); if (!at || !box) return;
    const n = document.createElement('span'); n.className = 'bfn ' + cls; n.textContent = text; n.style.left = at.x / uiz() + 'px'; n.style.top = (at.y + dy) / uiz() + 'px'; // inside the (zoomed) HUD
    n.addEventListener('animationend', () => n.remove()); box.appendChild(n); setTimeout(() => n.remove(), 2200);
  }
  const note = (s, c = '') => { if (line) blogs.push({ h: line, c: 'bl' + (s === undefined ? 'n' : s) + (c ? ' ' + c : '') }); };
  // Plays what the server says happened, one beat at a time, then shows the real state.
  const beat = ms => new Promise(r => setTimeout(r, ms));
  async function play(ev, final, after) {
    playing = true;
    if (ev.some(e => e.k === 'move' || e.k === 'juice' || e.k === 'dazed') && shown) blogs.push({ turn: shown.turn });
    for (const e of ev) {
      if (destroyed) return;
      const u = e.s !== undefined ? act(e.s) : null; let ms = 800;
      if (e.k === 'switch') { side(e.s).on = e.i; const n = act(e.s); n.up = { atk: 0, def: 0, spd: 0 }; scene?.ringPet(e.s, n); line = e.s ? (B.live ? L(`${esc(B.foe)} sends in ${esc(n.name)}.`, `${esc(B.foe)} wystawia: ${esc(n.name)}.`) : L(`${esc(n.name)} steps in for the other side.`, `Po stronie przeciwnika wchodzi ${esc(n.name)}.`)) : L(`Go, ${esc(n.name)}!`, `Naprzód, ${esc(n.name)}!`); sfx.pop(); }
      else if (e.k === 'move') { const m = MOVES[e.move]; lastEl = m.el; line = L(`${who(e.s)} uses <b style="color:${ELEMENTS[m.el]}">${m.name}</b>.`, `${who(e.s)} używa ruchu <b style="color:${ELEMENTS[m.el]}">${m.name}</b>.`); floatUp(e.s, m.name, 'call el' + m.el, -34); ms = (scene?.ringMove(e.s, e.move, m.el) ?? 500) + 40; sfx.click(); }
      else if (e.k === 'hit') { u.hp = e.hp; line = L(`${who(e.s)} takes <b>${e.dmg}</b>.${e.eff > 1 ? ' It hit hard!' : e.eff < 1 ? ' It barely tickled.' : ''}`, `${who(e.s)} traci <b>${e.dmg}</b>.${e.eff > 1 ? ' Mocne trafienie!' : e.eff < 1 ? ' Ledwo połaskotało.' : ''}`); scene?.ringHit(e.s, 'hit', lastEl, e.eff); hurt = e.s; if (e.eff >= 1) flash(e.eff > 1); floatUp(e.s, '−' + e.dmg, 'dmg' + (e.eff > 1 ? ' big' : e.eff < 1 ? ' weak' : '')); if (e.eff !== 1) floatUp(e.s, e.eff > 1 ? L('Hit hard!', 'Mocne trafienie!') : L('Barely tickled', 'Ledwo połaskotało'), e.eff > 1 ? 'say hard' : 'say', 30); sfx.place(); ms = 850; }
      else if (e.k === 'burn') { u.hp = e.hp; line = L(`${who(e.s)} is stung by its burn and takes <b>${e.dmg}</b>.`, `${who(e.s)} cierpi od przypalenia i traci <b>${e.dmg}</b>.`); scene?.ringHit(e.s, 'burn'); hurt = e.s; floatUp(e.s, '−' + e.dmg, 'dmg burn'); sfx.place(); }
      else if (e.k === 'juice') { u.hp = e.hp; F.inv.juice = Math.max(0, (F.inv.juice || 0) - 1); line = L(`${who(e.s)} drinks a Berry Juice and gets <b>${e.n}</b> health back.`, `${who(e.s)} pije Sok jagodowy i odzyskuje <b>${e.n}</b> zdrowia.`); scene?.ringFx(e.s, 'hop'); scene?.ringHit(e.s, 'heal'); floatUp(e.s, '+' + e.n, 'heal'); sfx.join(); }
      else if (e.k === 'heal') { u.hp = e.hp; line = L(`${who(e.s)} gets <b>${e.n}</b> health back.`, `${who(e.s)} odzyskuje <b>${e.n}</b> zdrowia.`); scene?.ringHit(e.s, 'heal'); floatUp(e.s, '+' + e.n, 'heal'); sfx.join(); }
      else if (e.k === 'stat') { if (e.d) u.up[e.stat] += e.d; line = e.d ? L(`${who(e.s)}'s ${STAT_NAME[e.stat]} goes ${e.d > 0 ? 'up' : 'down'}.`, `${who(e.s)}: ${STAT_NAME[e.stat]} ${e.d > 0 ? 'rośnie' : 'spada'}.`) : L('Nothing changes.', 'Nic się nie zmienia.'); scene?.ringHit(e.s, 'stat', e.d); if (e.d) floatUp(e.s, `${STAT_NAME[e.stat]} ${e.d > 0 ? '▲' : '▼'}`, e.d > 0 ? 'say up' : 'say down'); }
      else if (e.k === 'status') { u.status[e.st] = 1; line = L(`${who(e.s)} is ${STATUS[e.st].name.toLowerCase()}. ${STATUS[e.st].blurb}`, `${who(e.s)} dostaje efekt: ${STATUS[e.st].name.toLowerCase()}. ${STATUS[e.st].blurb}`); scene?.ringHit(e.s, 'status', e.st); floatUp(e.s, STATUS[e.st].name + '!', 'say down', 30); ms = 1100; }
      else if (e.k === 'clear') { delete u.status[e.st]; line = L(`${who(e.s)} is no longer ${STATUS[e.st].name.toLowerCase()}.`, `${who(e.s)} nie ma już efektu: ${STATUS[e.st].name.toLowerCase()}.`); ms = 600; }
      else if (e.k === 'dazed') { line = L(`${who(e.s)} is dazed and loses its turn.`, `${who(e.s)} jest w oszołomieniu i traci turę.`); scene?.ringHit(e.s, 'dazed'); floatUp(e.s, L('Dazed!', 'Oszołomienie!'), 'say down'); }
      else if (e.k === 'faint') { line = L(`${who(e.s)} fainted.`, `${who(e.s)} pada.`); scene?.ringFx(e.s, 'faint'); sfx.lose(); ms = 1100; }
      else if (e.k === 'end') { line = e.quit ? '' : e.win ? (B.live ? L(`${esc(B.foe)} wins this time.`, `Tym razem wygrywa ${esc(B.foe)}.`) : L('The other side wins this time.', 'Tym razem wygrywa przeciwnik.')) : L('You win!', 'Wygrana!'); if (!e.quit) { (e.win ? sfx.lose : sfx.win)(); scene?.ringFx(e.win, 'win'); if (!e.win) myBurst(); } ms = e.quit ? 0 : 2200; }
      note(e.k === 'end' ? undefined : e.s, e.k === 'faint' || e.k === 'end' ? 'key' : ''); paintBattle(); await beat(ms);
    }
    if (destroyed) return;
    playing = false; line = '';
    if (after) after(); else { shown = structuredClone(final); B = final; for (const s of [0, 1]) scene?.ringPet(s, act(s)); paintBattle(); }
  }
  function openTeam(mode, foe) {
    if (mode !== 'defend' && mode !== 'live' && !countOf(F, mode === 'arena' ? 'flag' : 'yard')) return;
    const keep = (mode === 'defend' ? F.def : lastTeam).filter(id => F.pets.some(p => p.id === id) && freeFor(mode)(id));
    panel = { kind: 'team', mode, foe: foe?.id, foeName: foe?.name, invite: foe?.invite, pets: keep }; card = null; sync();
  }
  function openSend() {
    if (!countOf(F, 'gate')) return ctx.toast(L('Build an Expedition Gate first.', 'Najpierw zbuduj Bramę wypraw.'), true);
    if (F.trips.length >= F.partyMax) return;
    const zone = panel?.zone || lastTrip.zone, ok = ZONES[zone] && F.house >= ZONES[zone].house;
    panel = { kind: 'send', step: 'where', zone: ok ? zone : 'woods', trip: lastTrip.trip, pets: lastTrip.pets.filter(freeFor('send')) };
    card = null; sync();
  }
  function paintGate() {
    const el = $('pf-gate');
    el.hidden = mode === 'farm';
    if (mode === 'load') el.innerHTML = '<div class="panel"><h2>' + L('Opening the gate…', 'Otwieram bramę…') + '</h2></div>';
    else if (mode === 'account') el.innerHTML = `<div class="panel">
      <h2>${L(`Your farm needs an account`, `Farma wymaga konta`)}</h2>
      <p>${L(`Pet Farm keeps going between visits, so it is saved to an account. It takes a username and a password, nothing else.`, `Farma zwierzaków działa także między wizytami, więc zapisuje się na koncie. Wystarczy nazwa użytkownika i hasło, nic więcej.`)}</p>
      <div class="row"><button type="button" class="btn big m" data-a="account" data-mode="register">${L(`Create account`, `Załóż konto`)}</button><button type="button" class="btn big w" data-a="account" data-mode="login">${L(`Log in`, `Zaloguj się`)}</button></div>
      <button type="button" class="btn ghost-ink" data-a="home">${L(`Back to the hub`, `Wróć do Zatoki`)}</button></div>`;
    else if (mode === 'starter') el.innerHTML = `<div class="panel starter">
      <h2>${L(`Pick your first pet`, `Wybierz pierwszego zwierzaka`)}</h2>
      <p>${L(`You can find the other two later.`, `Pozostałe dwa znajdziesz później.`)}</p>
      <div class="starters">${STARTERS.map(sp => `<button type="button" class="pickpet" data-a="pick" data-sp="${sp}" aria-pressed="${pick === sp}">
        ${thumb('pet:' + sp)}<b>${SPECIES[sp].name}</b><span class="el" style="--c:${ELEMENTS[SPECIES[sp].el]}">${elName(SPECIES[sp].el)}</span><small>${SPECIES[sp].blurb}</small></button>`).join('')}</div>
      <button type="button" class="btn big" data-a="start" ${pick ? '' : 'disabled'}>${L(`${pick ? `Start with ${SPECIES[pick].name}` : 'Tap a pet to choose'}`, `${pick ? `Zacznij z: ${SPECIES[pick].name}` : 'Dotknij zwierzaka, żeby wybrać'}`)}</button></div>`;
    el.classList.toggle('low', mode === 'starter');
  }
  function paintBuild() {
    const el = $('pf-build');
    el.hidden = !(mode === 'farm' && edit);
    if (el.hidden) return;
    const g = scene?.ghost();
    const cards = Object.entries(ITEMS).filter(([, it]) => !it.fixed && (tab === 'f' ? it.craft || it.pals || it.wheel : it.kind === tab && !it.craft && !it.pals && !it.wheel)).map(([type, it]) => {
      const have = countOf(F, type), most = maxOf(F, type), full = most && have >= most, gift = F.stash[type] || 0, small = it.house && F.house < it.house, poor = !gift && !canAfford(F.inv, it.cost), wsLv = Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)), locked = !gift && it.craft && wsLv < it.craft, shy = !gift && it.pals && F.palpts < it.pals, luck = !gift && it.wheel && !have;
      return `<button type="button" class="item${full || poor || locked || shy || luck || small ? ' off' : ''}" data-a="item" data-type="${type}" aria-pressed="${g?.type === type && !g.id}">
        ${thumb(type)}<b>${it.name}</b><span class="cost">${gift ? `<span class="mat">${L(`Gift: ${gift} to place`, `Prezent: ${gift} do postawienia`)}</span>` : luck ? `<span class="mat">${L('Lucky Wheel prize', 'Nagroda z Koła szczęścia')}</span>` : shy ? `<span class="mat">${L(`Friendship ${F.palpts} of ${it.pals}`, `Przyjaźń ${F.palpts} z ${it.pals}`)}</span>` : locked ? `<span class="mat">${L(`${it.craft > 1 ? `Workshop level ${it.craft}` : 'Needs a Workshop'}`, `${it.craft > 1 ? `Warsztat poziom ${it.craft}` : 'Wymaga Warsztatu'}`)}</span>` : small ? `<span class="mat">${L(`Farmhouse level ${it.house}`, `Dom poziom ${it.house}`)}</span>` : full ? `<span class="mat">${L(`Have ${have} of ${most}`, `Masz ${have} z ${most}`)}</span>` : costHtml(it.cost, F.inv)}</span></button>`;
    }).join('');
    const landLow = F.next?.house > F.house; // that size needs a bigger farmhouse first
    const land = tab === 'b' && F.next ? `<button type="button" class="item land${canAfford(F.inv, F.next.cost) && !landLow ? '' : ' off'}" data-a="expand"${landLow ? ' data-low="1"' : ''}>
        <span class="nothumb grow">${F.next.size}</span><b>${L(`More land`, `Więcej ziemi`)}</b><span class="cost">${landLow ? `<span class="mat">${L(`Farmhouse level ${F.next.house}`, `Dom poziom ${F.next.house}`)}</span>` : costHtml(F.next.cost, F.inv)}</span></button>` : '';
    const keep = el.querySelector('.items')?.scrollLeft || 0;
    el.innerHTML = `<div class="bhead"><div class="pills">
        <button type="button" data-a="tab" data-tab="b" aria-pressed="${tab === 'b'}">${L(`Buildings`, `Budynki`)}</button>
        <button type="button" data-a="tab" data-tab="d" aria-pressed="${tab === 'd'}">${L(`Decorations`, `Ozdoby`)}</button>
        <button type="button" data-a="tab" data-tab="f" aria-pressed="${tab === 'f'}">${L(`Fancy`, `Wyszukane`)}</button></div>
      <span class="hint">${L(`Tap something on the farm to move it.`, `Dotknij czegoś na farmie, żeby to przesunąć.`)}</span>
      <button type="button" class="btn m" data-a="done">${L(`Done`, `Gotowe`)}</button></div>
      <div class="items">${cards}${land}</div>`;
    el.querySelector('.items').scrollLeft = keep;
  }
  function paintGhost(g) {
    const el = $('pf-ghost');
    el.hidden = !g;
    if (!g) { paintBuild(); return; }
    const it = ITEMS[g.type];
    el.innerHTML = `<b>${it.name}</b><span class="hint">${L(`${g.ok ? 'Drag it, or tap a tile.' : 'It does not fit there.'}`, `${g.ok ? 'Przeciągnij albo dotknij kratki.' : 'Tu się nie zmieści.'}`)}</span>
      <button type="button" class="btn sm w" data-a="rot" aria-label="${L('Turn', 'Obróć')}">${I.turn}${L('Turn', 'Obróć')}</button>
      ${g.id && !it.fixed ? `<button type="button" class="btn sm p" data-a="away">${L(`Sell (${costText(it.cost)} back)`, `Sprzedaj (zwrot: ${costText(it.cost)})`)}</button>` : ''}
      <button type="button" class="btn sm ghost" data-a="cancel">${L(`Cancel`, `Anuluj`)}</button>
      <button type="button" class="btn sm m" data-a="ok" ${g.ok ? '' : 'disabled'}>${L(`${g.id ? 'Move here' : 'Place'}`, `${g.id ? 'Przenieś tutaj' : 'Postaw'}`)}</button>`;
    el.classList.toggle('bad', !g.ok);
  }
  function paintCard() {
    const el = $('pf-card');
    scene?.select?.(card && mode === 'farm' && !edit && !B ? card : null);
    if (!card || mode !== 'farm' || edit || B) { el.hidden = true; return; }
    el.hidden = false;
    if (where === 'visit') {
      const p = V?.pets.find(x => x.id === card.pet), s = p && SPECIES[p.sp]; if (!s) { card = null; el.hidden = true; return; }
      el.innerHTML = `${face(p, s.name)}<div class="info"><b>${esc(p.name)}</b><p>${elTags(p)} ${s.name} · ${FORMS[formOf(p.lv)]} · ${L('Level', 'Poziom')} ${p.lv}</p><p class="hint">${s.blurb}</p>
        ${p.open ? (V.dated ? `<p class="hint">${L('You already had a playdate here today.', 'Dziś była już tutaj wspólna zabawa.')}</p>` : '<button type="button" class="btn sm m" data-a="playdate" data-id="' + p.id + '">♥ ' + L('Playdate', 'Wspólna zabawa') + '</button>') : ''}</div>
        <button type="button" class="round x" data-a="close" aria-label="${L(`Close`, `Zamknij`)}">×</button>`;
      return;
    }
    if (card.pet) {
      const p = F.pets.find(x => x.id === card.pet); if (!p) { card = null; el.hidden = true; return; }
      const s = SPECIES[p.sp];
      el.innerHTML = `${face(p, s.name)}<div class="info">
        <form class="namer"><input class="field" id="pf-name" maxlength="14" value="${esc(p.name)}" aria-label="${L(`Pet name`, `Imię zwierzaka`)}" autocomplete="off"><button class="btn sm w">${L(`Rename`, `Zmień imię`)}</button>${favBtn(p, ' big')}</form>
        <p>${elTags(p)} ${s.name} · ${FORMS[formOf(p.lv)]} · ${L('Level', 'Poziom')} ${p.lv}</p>
        ${p.lv < MAX_LV ? `<div class="xp" title="${L(`Experience`, `Doświadczenie`)}"><i style="width:${Math.round(p.xp / xpFor(p.lv) * 100)}%"></i><span>${L(`${p.xp} of ${xpFor(p.lv)} to level ${p.lv + 1}`, `${p.xp} z ${xpFor(p.lv)} do poziomu ${p.lv + 1}`)}</span></div>` : ''}
        <p class="hint">${s.blurb}</p>
        ${Object.entries(F.work || {}).filter(([, id]) => id === p.id).map(([k]) => `<p class="hint">${L(`Helper at the ${ITEMS[k].name}: ${WORK[k].what(workPct(p, k)).toLowerCase()}.`, `Pomocnik (${ITEMS[k].name}): ${WORK[k].what(workPct(p, k)).toLowerCase()}.`)}</p>`).join('')}
        <div class="mvlist"><span class="hint">${ROLE_NAME[KIT[p.sp].role]}</span>${movesAt(p.sp, p.lv, p.xmove, elOf(p)).map(id => `<span class="el" style="--c:${ELEMENTS[MOVES[id].el]}">${MOVES[id].name}</span>`).join('')}</div>
        ${Object.entries(RECIPES).filter(([k, r]) => F.inv[k] && (r.xp ? p.lv < MAX_LV : r.rest && p.rest > 0)).map(([k, r]) => `<button type="button" class="btn sm m" data-a="feed" data-what="${k}" data-id="${p.id}">${L(`Give a ${r.name} (${F.inv[k]} left)`, `Podaj: ${r.name} (masz ${F.inv[k]})`)}</button>`).join('')}
        ${p.lodge ? `<p class="hint">${L('Stored in the Pet Lodge. Move it out to the island to send it anywhere.', 'Jest w Schronisku. Przenieś go na wyspę, żeby gdzieś go wysłać.')}</p>` : ''}
        ${cardBack ? `<button type="button" class="btn sm m" data-a="cardback">◀ ${cardBack.kind === 'lodge' ? L('Back to the Lodge', 'Wróć do Schroniska') : cardBack.kind === 'pets' ? L('Back to My pets', 'Wróć do listy zwierzaków') : L('Back', 'Wróć')}</button>` : ''}
        ${F.lodgeRoom ? `<button type="button" class="btn sm w" data-a="lodge" data-id="${p.id}" data-on="${p.lodge ? '' : '1'}">${p.lodge ? L('Move to the island', 'Przenieś na wyspę') : L('Store in the Lodge', 'Do Schroniska')}</button>` : ''}
        <button type="button" class="btn sm w" data-a="petpage" data-id="${p.id}">${L(`Traits and family`, `Cechy i rodzina`)}</button></div>
        <button type="button" class="round x" data-a="close" aria-label="${L(`Close`, `Zamknij`)}">×</button>`;
    } else {
      const item = F.items.find(x => x.id === card.item), it = item && ITEMS[item.type]; if (!it) { card = null; el.hidden = true; return; }
      let more = '', name = it.name, up = '';
      if (UPGRADES[item.type]) { // buildings and decorations that can be improved
        const lv = lvOf(item), cost = upCost(item);
        name += L(` · Level ${lv}`, ` · Poziom ${lv}`);
        up = !cost ? '' : F.house < lv + 1 ? `<p class="hint">${L(`Level ${lv + 1} needs a level ${lv + 1} farmhouse.`, `Poziom ${lv + 1} wymaga domu na poziomie ${lv + 1}.`)}</p>`
          : `<p class="hint">${L(`Level ${lv + 1}: ${whatUp(item).toLowerCase()}.`, `Poziom ${lv + 1}: ${whatUp(item).toLowerCase()}.`)}</p><div class="cost">${costHtml(cost, F.inv)}</div><button type="button" class="btn sm m" data-a="upgrade" data-id="${item.id}">${L(`Improve to level ${lv + 1}`, `Ulepsz do poziomu ${lv + 1}`)}</button>`;
      }
      if (item.type === 'house') {
        name += L(` · Level ${F.house}`, ` · Poziom ${F.house}`);
        const opens = list([...Object.values(ZONES).filter(z => z.house === F.house + 1).map(z => z.name), ...(HOUSE_OPENS[F.house + 1] || []).map(t => t())]);
        more = F.houseNext ? `<p class="hint">${L(`Level ${F.house + 1} opens ${opens}.`, `Poziom ${F.house + 1} otwiera: ${opens}.`)}</p><div class="cost">${costHtml(F.houseNext, F.inv)}</div>
          <button type="button" class="btn sm m" data-a="houseup">${L(`Improve farmhouse`, `Ulepsz dom`)}</button>` : '<p class="hint">' + L('It is as grand as it gets.', 'Okazalszy już nie będzie.') + '</p>';
      } else if (item.type === 'gate') {
        more = F.trips.map(t => t.left > 0 ? `<p class="hint">${L(`A party is in ${ZONES[t.zone].name}, back in ${wait(t.left)}.`, `Drużyna jest tutaj: ${ZONES[t.zone].name}, wróci za ${wait(t.left)}.`)}</p>` : `<button type="button" class="btn sm m" data-a="collect" data-id="${t.id}">${L(`Welcome them back from ${ZONES[t.zone].name}`, `Przywitaj drużynę (${ZONES[t.zone].name})`)}</button>`).join('')
          + (F.trips.length < F.partyMax ? `<button type="button" class="btn sm m" data-a="explore">${F.trips.length ? L('Send another party', 'Wyślij kolejną drużynę') : L('Send pets exploring', 'Wyślij zwierzaki na wyprawę')}</button>` : '') + `<p class="hint">${L(`Parties out: ${F.trips.length} of ${F.partyMax}.`, `Drużyny na wyprawie: ${F.trips.length} z ${F.partyMax}.`)}</p>`;
      } else if (item.type === 'yard') more = `<p class="hint">${L(`${F.train.ids.length ? `Training: ${list(F.train.ids.map(id => esc(F.pets.find(p => p.id === id)?.name || '')).filter(Boolean))}.` : `Nobody is training. Pets left here earn ${TRAIN_XP} experience an hour.`}`, `${F.train.ids.length ? `Trenują: ${list(F.train.ids.map(id => esc(F.pets.find(p => p.id === id)?.name || '')).filter(Boolean))}.` : `Nikt nie trenuje. Zwierzaki zostawione tutaj zdobywają ${TRAIN_XP} doświadczenia na godzinę.`}`)}</p><button type="button" class="btn sm m" data-a="practice">${L(`Practice battle`, `Bitwa treningowa`)}</button><button type="button" class="btn sm m" data-a="trainopen">${L(`Choose who trains`, `Wybierz, kto trenuje`)}</button>`;
      else if (item.type === 'flag') more = `${L(`<p class="hint">You have ${F.pts} ladder points.</p>`, `<p class="hint">Masz punktów rankingowych: ${F.pts}.</p>`)}<button type="button" class="btn sm m" data-a="arena">${L('Find a match', 'Znajdź mecz')}</button>`;
      else if (item.type === 'mailbox') more = `<button type="button" class="btn sm m" data-a="mail">${L(`Open mail (${F.mail.length})`, `Otwórz pocztę (${F.mail.length})`)}</button>`;
      else if (item.type === 'nest') more = F.nests.map(n => `<p class="hint">${nestTxt(n)}</p>${n.stage === 'ready' ? `<button type="button" class="btn sm m" data-a="hatch" data-slot="${n.slot}">${L(`Hatch the egg`, `Wykluj jajko`)}</button>` : ''}`).join('')
        + (F.nests.length < F.nestMax ? `<button type="button" class="btn sm m" data-a="nest">${L(`${F.nests.length ? 'Choose two more pets' : 'Choose two pets'}`, `${F.nests.length ? 'Wybierz kolejne dwa zwierzaki' : 'Wybierz dwa zwierzaki'}`)}</button>` : '')
        + `<p class="hint">${L(`Eggs: ${F.nests.length} of ${F.nestMax}.${lvOf(item) >= 3 ? ' Eggs here hatch a quarter sooner.' : ''}`, `Jajka: ${F.nests.length} z ${F.nestMax}.${lvOf(item) >= 3 ? ' Jajka wykluwają się tu o jedną czwartą szybciej.' : ''}`)}</p>`;
      else if (item.type === 'garden') more = F.garden.ripe ? `<button type="button" class="btn sm m" data-a="berries">${L(`Pick berries (${F.garden.ripe * BERRIES})`, `Zbierz jagody (${F.garden.ripe * BERRIES})`)}</button>` : `<p class="hint">${L(`Each plot grows ${BERRIES} berries an hour. The next ones are ripe in about ${wait(Math.max(1, gardenAt - Date.now()))}.`, `Każda grządka daje ${BERRIES} jagody na godzinę. Następne dojrzeją za około ${wait(Math.max(1, gardenAt - Date.now()))}.`)}</p>`;
      else if (item.type === 'kitchen') more = `${L(`<p class="hint">You have ${F.inv.berries || 0} berries.</p>`, `<p class="hint">Masz jagód: ${F.inv.berries || 0}.</p>`)}<button type="button" class="btn sm m" data-a="cookopen">${L(`Cook treats`, `Gotuj smakołyki`)}</button>`;
      else if (item.type === 'barn') more = `<p class="hint">${L(`Your farm can hold ${F.cap} of each material.`, `Twoja farma pomieści ${F.cap} sztuk każdego materiału.`)}</p>`;
      else if (item.type === 'workshop') more = '<p class="hint">' + L('Its decorations are under Edit farm, Fancy.', 'Jego ozdoby znajdziesz w Urządź farmę, Wyszukane.') + '</p><button type="button" class="btn sm m" data-a="swapopen">' + L('Swap materials', 'Wymień materiały') + '</button>';
      else if (item.type === 'hut') more = `<p class="hint">${F.lodgeRoom ? L(`The island has beds for ${F.room} pets and the Pet Lodge for ${F.lodgeRoom} more.`, `Na wyspie są łóżka dla ${F.room} zwierzaków, a w Schronisku dla kolejnych ${F.lodgeRoom}.`) : L(`Your farm has room for ${F.room} pets.`, `Na farmie jest miejsce dla ${F.room} zwierzaków.`)}${!F.lodgeRoom && countOf(F, 'hut') >= 3 && !upCost(item) ? ' ' + L(`That is as many as the island holds. A Pet Lodge${F.house < 4 ? ' (farmhouse level 4)' : ''} stores up to 300 more.`, `Więcej wyspa nie pomieści. Schronisko${F.house < 4 ? ' (dom na poziomie 4)' : ''} przechowa do 300 kolejnych.`) : ''}</p>`;
      else if (item.type === 'lodge') more = `<p class="hint">${L(`Stored inside: ${F.pets.filter(p => p.lodge).length} of ${F.lodgeRoom}, in ${(F.shelves || []).length} collections.`, `W środku: ${F.pets.filter(p => p.lodge).length} z ${F.lodgeRoom}, kolekcje: ${(F.shelves || []).length}.`)}</p><button type="button" class="btn sm m" data-a="lodgeopen">${L('Open the Lodge', 'Otwórz Schronisko')}</button>`;
      if (UPGRADES[item.type]?.does) more += `<p class="hint">${UPGRADES[item.type].does[lvOf(item) - 1]}</p>`; // an improvable decoration says what pets do on it
      if (WORK[item.type]) more += helpRow(item.type);
      more += boostRow(item.type);
      el.innerHTML = `${thumb(item.type, it.name)}<div class="info"><b>${name}</b><p>${it.desc}</p>${more}
        ${up}<button type="button" class="btn sm w" data-a="grab" data-id="${item.id}">${L(`Move it`, `Przesuń`)}</button>
        ${it.fixed ? '' : `<button type="button" class="btn sm p" data-a="sellitem" data-id="${item.id}">${it.wheel ? L('Put it away', 'Schowaj') : L(`Sell (${costText(it.cost)} back)`, `Sprzedaj (zwrot: ${costText(it.cost)})`)}</button>`}</div>
        <button type="button" class="round x" data-a="close" aria-label="${L(`Close`, `Zamknij`)}">×</button>`;
    }
  }

  // ---------- from the 3D scene ----------
  function onPick(p) {
    if (p.starter) { pick = p.starter; sfx.pop(); sync(); return; }
    if (mode !== 'farm') return;
    if (p.zone) { // a place to explore on the map: go home and get a party ready for it
      sfx.click(); const z = ZONES[p.zone];
      if (!countOf(F, 'gate')) return ctx.toast(L('Build an Expedition Gate on your farm first.', 'Najpierw zbuduj na farmie Bramę wypraw.'), true);
      if (F.house < z.house) return ctx.toast(L(`${z.name} opens at farmhouse level ${z.house}.`, `${z.name} otwiera się, gdy dom ma poziom ${z.house}.`), true);
      if (F.trips.some(t => t.left <= 0)) return ctx.toast(L('A party is back. Welcome them home on your farm first.', 'Drużyna wróciła. Najpierw przywitaj ją na farmie.'), true);
      if (F.trips.length >= F.partyMax) return ctx.toast(F.partyMax > 1 ? L('All your parties are out. Improve the Expedition Gate to send more.', 'Wszystkie drużyny są na wyprawie. Ulepsz Bramę wypraw, żeby wysyłać więcej.') : L(`Your party is in ${ZONES[F.trip.zone].name}, back in ${wait(F.trip.left)}. A better Expedition Gate can send more parties.`, `Twoja drużyna jest tutaj: ${ZONES[F.trip.zone].name}, wróci za ${wait(F.trip.left)}. Lepsza Brama wypraw wyśle więcej drużyn.`), true);
      goHome(); panel = { zone: p.zone }; openSend(); return;
    }
    if ('island' in p) { sfx.click(); if (p.island) ctx.send({ t: 'visit', id: p.island }); else goHome(); return; }
    if (where === 'visit') { if (p.pet) { sfx.pop(); card = { pet: p.pet }; } else card = null; paintCard(); return; }
    if (edit) { if (p.item) { sfx.click(); scene.ghostItem(p.item); } return; }
    if (p.pet) { sfx.pop(); card = { pet: p.pet }; } else if (p.item) { sfx.click(); card = { item: p.item }; } else card = null;
    paintCard();
  }

  // ---------- actions ----------
  function confirmGhost() {
    const g = scene?.ghost(); if (!g?.ok) return;
    lastType = g.id ? null : g.type; lastSpot = [g.x, g.y, g.r];
    ctx.send(g.id ? { t: 'move', id: g.id, x: g.x, y: g.y, r: g.r } : { t: 'place', type: g.type, x: g.x, y: g.y, r: g.r });
    scene.ghostCancel();
  }
  function goHome() { if (where === 'visit') ctx.send({ t: 'leave' }); where = 'home'; V = null; card = null; panel = null; sync(); }
  function setEdit(on) { if (B || where !== 'home') return; edit = on; card = null; panel = null; if (!on) scene?.ghostCancel(); sync(); }
  // The trade offer in plain words, shown under the two sides and kept up to date while amounts change.
  const tradeEmpty = () => !['give', 'want'].some(k => panel[k].pets.length || Object.keys(panel[k].mats).length);
  function tradeSum() {
    const say = (side, pool) => [...side.pets.map(id => esc(pool.find(x => x.id === id)?.name || L('a pet', 'zwierzak'))), ...Object.entries(side.mats).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`)].join(', ') || L('nothing', 'nic');
    return tradeEmpty() ? L('Nothing is in the offer yet.', 'W ofercie nie ma jeszcze niczego.') : L(`<b>You give:</b> ${say(panel.give, F.pets)}<br><b>You get:</b> ${say(panel.want, V?.pets || [])}`, `<b>Dajesz:</b> ${say(panel.give, F.pets)}<br><b>Dostajesz:</b> ${say(panel.want, V?.pets || [])}`);
  }
  function tradeTouch(i) { // after an amount changed: mark the row, redo the summary, and leave the rest alone
    i.closest('.tm')?.classList.toggle('on', !!panel[i.dataset.tm].mats[i.dataset.mat]);
    const s = root.querySelector('.tsum'), o = root.querySelector('[data-a=offer]'); if (s) s.innerHTML = tradeSum(); if (o) o.disabled = tradeEmpty();
  }
  root.addEventListener('input', e => { // amounts in a trade offer: remembered without repainting, so typing is not interrupted
    const i = e.target.closest('[data-tm]'); if (!i || panel?.kind !== 'trade') return;
    const n = Math.max(0, Math.min(+i.max || 9999, Math.floor(+i.value || 0))), m = panel[i.dataset.tm].mats;
    if (n) m[i.dataset.mat] = n; else delete m[i.dataset.mat];
    tradeTouch(i);
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { b.innerHTML = sfx.toggle() ? I.mute : I.sound; return; }
    sfx.click();
    if (navOpen && b.closest('.pfnav')) navOpen = false; // the phone menu folds away once something in it is picked
    if (a === 'home') ctx.home();
    else if (a === 'account') ctx.account(b.dataset.mode);
    else if (a === 'pick') { pick = b.dataset.sp; sync(); }
    else if (a === 'start') { if (pick) ctx.send({ t: 'starter', sp: pick }); }
    else if (a === 'pfsum') { sumOpen = !sumOpen; paintMain(); }
    else if (a === 'pfmenu') { navOpen = !navOpen; paintMain(); }
    else if (a === 'matsmore') { matsOpen = !matsOpen; paintTop(); }
    else if (a === 'edit') setEdit(true);
    else if (a === 'done') setEdit(false);
    else if (a === 'map') { where = 'map'; V = null; world = null; card = null; panel = null; sync(); ctx.send({ t: 'world' }); }
    else if (a === 'gohome') goHome();
    else if (a === 'trade') { panel = { kind: 'trade', give: { pets: [], mats: {} }, want: { pets: [], mats: {} } }; card = null; sync(); }
    else if (a === 'trademore') { panel.more = true; sync(); }
    else if (a === 'tmstep') {
      const i = b.parentNode.querySelector('input'), m = panel[i.dataset.tm].mats, k = i.dataset.mat, by = ['wood', 'stone', 'fiber'].includes(k) ? 5 : 1;
      const n = Math.max(0, Math.min(+i.max || 9999, (m[k] || 0) + by * +b.dataset.d));
      if (n) m[k] = n; else delete m[k]; i.value = n || ''; tradeTouch(i);
    }
    else if (a === 'tradepet') {
      if (b.classList.contains('off')) return ctx.toast(L('That pet cannot be traded right now.', 'Tego zwierzaka nie da się teraz wymienić.'), true);
      const list = panel[b.dataset.side].pets, i = list.indexOf(b.dataset.id);
      if (i >= 0) list.splice(i, 1); else if (list.length < 3) list.push(b.dataset.id); else return ctx.toast(L('Three pets a side at most.', 'Najwyżej trzy zwierzaki z każdej strony.'), true);
      sync();
    }
    else if (a === 'offer') ctx.send({ t: 'offer', to: V.id, give: { pets: panel.give.pets, mats: panel.give.mats }, want: { pets: panel.want.pets, mats: panel.want.mats } });
    else if (a === 'tradeyes') ctx.send({ t: 'tradeans', id: b.dataset.id, ok: true });
    else if (a === 'tradeno') ctx.send({ t: 'tradeans', id: b.dataset.id, ok: false });
    else if (a === 'tradecancel') ctx.send({ t: 'tradecancel', id: b.dataset.id });
    else if (a === 'tradecounter') { // say no, walk over and start a new offer the other way round
      const t = F.trades.find(x => x.id === b.dataset.id); if (!t) return;
      counter = { give: { pets: t.want.pets.filter(Boolean).map(x => x.id), mats: { ...t.want.mats } }, want: { pets: t.give.pets.map(x => x.id), mats: { ...t.give.mats } } };
      ctx.send({ t: 'tradeans', id: t.id, ok: false }); setTimeout(() => ctx.send({ t: 'visit', id: t.fid }), 150);
    }
    else if (a === 'friends') ctx.friends?.();
    else if (a === 'help') ctx.send({ t: 'help', id: V.id });
    else if (a === 'giftopen') { panel = { kind: 'gift' }; card = null; sync(); }
    else if (a === 'gift') { if (b.classList.contains('off')) return ctx.toast(L('You do not have enough of that to give.', 'Masz tego za mało, żeby dać.'), true); ctx.send(b.dataset.item ? { t: 'gift', id: V.id, item: b.dataset.item } : { t: 'gift', id: V.id, mat: b.dataset.mat }); }
    else if (a === 'duel') openTeam('arena', V);
    else if (a === 'livego') openTeam('live', V);
    else if (a === 'duelno') { ctx.send({ t: 'duelno', id: panel.id }); panel = null; sync(); }
    else if (a === 'duelpick') openTeam('live', { name: panel.from, invite: panel.id });
    else if (a === 'berries') ctx.send({ t: 'pick' });
    else if (a === 'wxinfo') { if (edit || B) return; panel = { kind: 'wx' }; card = null; sfx.click(); sync(); }
    else if (a === 'matinfo') { if (edit || B) return; panel = { kind: 'mat', mat: b.dataset.mat }; card = null; sfx.click(); sync(); }
    else if (a === 'cookopen') { panel = { kind: 'cook' }; card = null; sync(); }
    else if (a === 'swapopen') { const most = Object.keys(WORTH).filter(m => STORED.includes(m)).sort((x, y) => (F.inv[y] || 0) - (F.inv[x] || 0))[0]; panel = { kind: 'swap', n: 1, give: F.inv[most] ? most : null }; card = null; sync(); }
    else if (a === 'swgive' || a === 'swget') { const m = b.dataset.mat, mine = a === 'swgive' ? 'give' : 'get', other = mine === 'give' ? 'get' : 'give'; if (panel[other] === m) panel[other] = panel[mine] && panel[mine] !== m ? panel[mine] : mine === 'get' ? Object.keys(WORTH).filter(x => x !== m && STORED.includes(x)).sort((x, y) => (F.inv[y] || 0) - (F.inv[x] || 0))[0] : null; panel[mine] = m; sfx.click(); sync(); }
    else if (a === 'swflip') { [panel.give, panel.get] = [panel.get, panel.give]; sfx.click(); sync(); }
    else if (a === 'swn') { panel.n = Math.max(1, +b.dataset.n || 1); sfx.click(); sync(); }
    else if (a === 'cook') { if (b.dataset.lv) return ctx.toast(L(`Improve the Kitchen to level ${b.dataset.lv} for that recipe.`, `Ten przepis wymaga Kuchni na poziomie ${b.dataset.lv}.`), true); if (b.classList.contains('off')) return ctx.toast(L('Not enough for that yet. Garden Plots grow more every hour, and better plots grow Sunberries.', 'Na to jeszcze nie wystarczy. Grządki co godzinę dają więcej, a lepsze grządki dają słoneczne jagody.'), true); ctx.send({ t: 'cook', what: b.dataset.what }); }
    else if (a === 'swdo') { if (panel?.give && panel.get) ctx.send({ t: 'swap', give: panel.give, get: panel.get, n: panel.n || 1 }); }
    else if (a === 'feed') ctx.send({ t: 'feed', what: b.dataset.what, pet: b.dataset.id });
    else if (a === 'mail') { panel = { kind: 'mail' }; card = null; sync(); }
    else if (a === 'album') { panel = { kind: 'album' }; card = null; sync(); }
    else if (a === 'pets') { panel = { kind: 'pets', sort: petSort() }; card = null; sync(); }
    else if (a === 'petsort') { panel.sort = b.dataset.v; try { localStorage.setItem('pf_psort', b.dataset.v); } catch { /* no storage */ } sfx.click(); paintPanel(); }
    else if (a === 'petel') { panel.el = b.dataset.v; sfx.click(); paintPanel(); }
    else if (a === 'petfind') { const p = F.pets.find(x => x.id === b.dataset.id); if (!p) return; const st = petStatus(p);
      if (p.lodge) { panel = { kind: 'lodge', tab: shelfName(p.shelf) ? p.shelf : 'all', sel: [], sort: ldSort(), page: 0 }; card = null; sfx.click(); sync(); return; }
      panel = null; card = { pet: p.id }; sfx.click(); sync(); if (st.away) ctx.toast(L(`${esc(p.name)} is away exploring, so it is not on the farm right now.`, `${esc(p.name)} jest na wyprawie, więc teraz nie ma go na farmie.`));
      }
    else if (a === 'nest') { if (F.nests.length >= F.nestMax) return; panel = { kind: 'nest', pick: [] }; card = null; sync(); }
    else if (a === 'playdate') {
      const pet = V?.pets.find(x => x.id === b.dataset.id); if (!pet) return;
      if (!F.items.some(i => i.type === 'nest')) return ctx.toast(L('Build a Nest on your own farm first.', 'Najpierw zbuduj Gniazdo na swojej farmie.'), true);
      if (F.nests.length >= F.nestMax) return ctx.toast(L('Your Nest is busy right now.', 'Twoje Gniazdo jest teraz zajęte.'), true);
      if (pet.lv < BREED_LV) return ctx.toast(L('That pet is still too young.', 'Ten zwierzak jest jeszcze za młody.'), true);
      panel = { kind: 'nest', pick: [], friend: { id: V.id, name: V.name, pet } }; card = null; sync();
    }
    else if (a === 'nestpick') {
      if (b.classList.contains('off')) return ctx.toast(b.querySelector('small').textContent.split(' · ').pop() + '.', true);
      const id = b.dataset.id, max = panel.friend ? 1 : 2, i = panel.pick.indexOf(id);
      if (i >= 0) panel.pick.splice(i, 1); else { if (panel.pick.length >= max) panel.pick.shift(); panel.pick.push(id); }
      sync();
    }
    else if (a === 'pair') ctx.send(panel.friend ? { t: 'pair', a: panel.pick[0], friend: panel.friend.id, b: panel.friend.pet.id } : { t: 'pair', a: panel.pick[0], b: panel.pick[1] });
    else if (a === 'hatch') ctx.send({ t: 'hatch', slot: b.dataset.slot });
    else if (a === 'petpage') { panel = { kind: 'pet', id: b.dataset.id }; card = null; sync(); }
    else if (a === 'petopen') ctx.send({ t: 'petopen', id: b.dataset.id });
    else if (a === 'lodge') { sfx.click(); ctx.send({ t: 'lodge', ids: [b.dataset.id], on: !!b.dataset.on }); }
    else if (a === 'lodgeopen') { panel = { kind: 'lodge', tab: 'all', sel: [], sort: ldSort(), page: 0 }; cardBack = null; card = null; sfx.click(); sync(); }
    else if (a === 'cardback') { if (!cardBack) return; panel = cardBack; cardBack = null; card = null; sfx.click(); sync(); }
    else if (a === 'ldtab') { panel.tab = b.dataset.v; panel.sel = []; panel.page = 0; sfx.click(); paintPanel(); }
    else if (a === 'ldsort') { panel.sort = b.dataset.v; panel.page = 0; try { localStorage.setItem('pf_lsort', b.dataset.v); } catch { /* no storage */ } sfx.click(); paintPanel(); }
    else if (a === 'ldpage') { panel.page = Math.max(0, (panel.page || 0) + +b.dataset.v); panel.sel = []; sfx.click(); paintPanel(); }
    else if (a === 'pcard') { cardBack = panel; panel = null; card = { pet: b.dataset.id }; sfx.click(); sync(); }
    else if (a === 'ldpick') { const i = panel.sel.indexOf(b.dataset.id); if (i >= 0) panel.sel.splice(i, 1); else panel.sel.push(b.dataset.id); sfx.click(); paintPanel(); }
    else if (a === 'ldall') { const ids = [...$('pf-panel').querySelectorAll('.ldcell')].map(x => x.dataset.id); panel.sel = panel.sel.length === ids.length ? [] : ids; sfx.click(); paintPanel(); }
    else if (a === 'ldin') { sfx.click(); ctx.send({ t: 'lodge', ids: panel.sel, on: true, shelf: b.dataset.v || null }); panel.sel = []; }
    else if (a === 'ldout') { sfx.click(); ctx.send({ t: 'lodge', ids: panel.sel, on: false }); panel.sel = []; }
    else if (a === 'ldput') { sfx.click(); ctx.send({ t: 'shelf', op: 'put', id: b.dataset.v, ids: panel.sel }); panel.sel = []; }
    else if (a === 'ldnew') { sfx.click(); ctx.send({ t: 'shelf', op: 'new', name: L(`Collection ${(F.shelves || []).length + 1}`, `Kolekcja ${(F.shelves || []).length + 1}`) }); }
    else if (a === 'ldmove') { sfx.click(); ctx.send({ t: 'shelf', op: b.dataset.v, id: panel.tab }); }
    else if (a === 'lddel') { sfx.click(); ctx.send({ t: 'shelf', op: 'del', id: panel.tab }); }
    else if (a === 'fav') { const p = F?.pets.find(x => x.id === b.dataset.id); if (!p) return; p.fav = !p.fav; sfx.click(); ctx.send({ t: 'fav', id: p.id, on: p.fav }); if (panel) paintPanel(); if (card?.pet) paintCard(); }
    else if (a === 'freeask') { if (b.dataset.why) return ctx.toast(esc(b.dataset.why), true); panel.free = true; paintPanel(); }
    else if (a === 'freeno') { panel.free = false; paintPanel(); }
    else if (a === 'freeyes') ctx.send({ t: 'free', id: b.dataset.id });
    else if (a === 'leafform') { panel.form = +b.dataset.form; sfx.click(); paintPanel(); }
    else if (a === 'leaf') { panel = { kind: 'album', sp: b.dataset.sp }; sync(); }
    else if (a === 'claim') ctx.send({ t: 'claim', id: b.dataset.id });
    else if (a === 'boost') ctx.send({ t: 'boost', type: b.dataset.type });
    else if (a === 'mailread') ctx.send({ t: 'mailread' });
    else if (a === 'practice') openTeam('practice');
    else if (a === 'ranks') { ranks = null; panel = { kind: 'ranks' }; card = null; sync(); ctx.send({ t: 'ranks' }); }
    else if (a === 'arena') { foes = null; panel = { kind: 'foes' }; card = null; sync(); ctx.send({ t: 'foes' }); }
    else if (a === 'foe') { const f = foes?.find(x => x.id === b.dataset.id); if (f) openTeam('arena', f); }
    else if (a === 'defteam') openTeam('defend');
    else if (a === 'team') {
      if (b.classList.contains('off')) return ctx.toast(L(`That pet is ${b.dataset.why}.`, `Ten zwierzak jest teraz zajęty: ${b.dataset.why}.`), true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(L(`A team is ${PARTY} pets at most.`, `Drużyna to najwyżej ${PARTY} zwierzaki.`), true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'fight' && panel.mode === 'live') { lastTeam = [...panel.pets]; ctx.send(panel.invite ? { t: 'duelyes', id: panel.invite, pets: lastTeam } : { t: 'duel', to: panel.foe, pets: lastTeam }); }
    else if (a === 'wildfight') { panel = null; ctx.send({ t: 'fight', mode: 'wild' }); }
    else if (a === 'fight') { lastTeam = [...panel.pets]; ctx.send({ t: 'fight', mode: panel.mode, foe: panel.foe, pets: lastTeam }); }
    else if (a === 'defend') ctx.send({ t: 'defend', pets: [...panel.pets] });
    else if (a === 'move') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', move: b.dataset.move }); } }
    else if (a === 'swap') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', switch: +b.dataset.i }); } }
    else if (a === 'juice') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', juice: true }); } }
    else if (a === 'elhelp') { elOpen = !elOpen; paintBattle(); }
    else if (a === 'blog') { logOpen = elOpen ? true : !logOpen; elOpen = false; try { localStorage.setItem('pf_blog', logOpen ? '1' : '0'); } catch {} paintBattle(); }
    else if (a === 'giveup') { if (!playing) ctx.send({ t: 'bquit' }); }
    else if (a === 'explore') openSend();
    else if (a === 'collect') ctx.send({ t: 'collect', id: b.dataset.id });
    else if (a === 'shut') { const inv = panel?.kind === 'invite' ? panel.id : panel?.invite; if (inv) ctx.send({ t: 'duelno', id: inv }); panel = null; sync(); }
    else if (a === 'zone') { if (b.classList.contains('off')) return ctx.toast(L(`${ZONES[b.dataset.zone].name} opens at farmhouse level ${ZONES[b.dataset.zone].house}. Tap your farmhouse to improve it.`, `${ZONES[b.dataset.zone].name} otwiera się, gdy dom ma poziom ${ZONES[b.dataset.zone].house}. Dotknij domu, żeby go ulepszyć.`), true); panel.zone = b.dataset.zone; panel.step = 'who'; sfx.click(); paintPanel(); $('pf-panel').querySelector('.tripp')?.scrollTo?.(0, 0); }
    else if (a === 'where') { panel.step = 'where'; sfx.click(); paintPanel(); }
    else if (a === 'trip') { panel.trip = b.dataset.trip; paintPanel(); }
    else if (a === 'party') {
      if (b.classList.contains('off')) return ctx.toast(L(`That pet is ${b.dataset.why}.`, `Ten zwierzak jest teraz zajęty: ${b.dataset.why}.`), true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(L(`A party is ${PARTY} pets at most.`, `Drużyna to najwyżej ${PARTY} zwierzaki.`), true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'send') { lastTrip = { zone: panel.zone, trip: panel.trip, pets: [...panel.pets] }; ctx.send({ t: 'send', ...lastTrip }); }
    else if (a === 'houseup') { if (!canAfford(F.inv, F.houseNext)) ctx.toast(L('Not enough materials for that yet.', 'Na to jeszcze nie wystarczy materiałów.'), true); else ctx.send({ t: 'houseup' }); }
    else if (a === 'tab') { tab = b.dataset.tab; paintBuild(); }
    else if (a === 'expand') { if (b.dataset.low) ctx.toast(L(`Growing the land again needs a level ${F.next.house} farmhouse.`, `Dalsze powiększanie ziemi wymaga domu na poziomie ${F.next.house}.`), true); else if (b.classList.contains('off')) ctx.toast(L('Not enough materials to grow the land yet.', 'Na powiększenie ziemi jeszcze nie wystarczy materiałów.'), true); else ctx.send({ t: 'expand' }); }
    else if (a === 'item') {
      scene?.ghostCancel(); panel = { kind: 'buy', type: b.dataset.type }; sfx.click(); paintPanel();
    }
    else if (a === 'buy') { const type = b.dataset.type; panel = null; paintPanel(); scene?.ghostNew(type); }
    else if (a === 'rot') scene?.ghostRotate();
    else if (a === 'cancel') scene?.ghostCancel();
    else if (a === 'ok') confirmGhost();
    else if (a === 'upgrade') { const it = F.items.find(x => x.id === +b.dataset.id); if (it && !canAfford(F.inv, upCost(it))) return ctx.toast(L('Not enough materials for that yet.', 'Na to jeszcze nie wystarczy materiałów.'), true); ctx.send({ t: 'upgrade', id: +b.dataset.id }); }
    else if (a === 'workopen') { panel = { kind: 'work', type: b.dataset.type }; card = null; sync(); }
    else if (a === 'workpick') { if (b.classList.contains('off')) return ctx.toast(L(`That pet is ${b.dataset.why}.`, `Ten zwierzak jest teraz zajęty: ${b.dataset.why}.`), true); ctx.send({ t: 'work', type: panel.type, id: b.dataset.id }); }
    else if (a === 'workoff') ctx.send({ t: 'work', type: b.dataset.type });
    else if (a === 'trainopen') { panel = { kind: 'train', pets: F.train.ids.filter(freeFor('train')) }; card = null; sync(); }
    else if (a === 'trainpick') {
      if (b.classList.contains('off')) return ctx.toast(b.dataset.why ? L(`That pet is ${b.dataset.why}.`, `Ten zwierzak jest teraz zajęty: ${b.dataset.why}.`) : L('That pet is fully grown already.', 'Ten zwierzak jest już w pełni dorosły.'), true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= F.train.slots) return ctx.toast(F.train.slots < UP_MAX ? L(`The yard has ${F.train.slots} training ${F.train.slots > 1 ? 'spots' : 'spot'}. Improve it for more.`, `Miejsca treningowe na placu: ${F.train.slots}. Ulepsz plac, żeby mieć więcej.`) : L(`The yard has ${F.train.slots} training spots.`, `Miejsca treningowe na placu: ${F.train.slots}.`), true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'trainsave') ctx.send({ t: 'train', pets: [...panel.pets] });
    else if (a === 'compare') { panel = { kind: 'compare' }; card = null; sync(); }
    else if (a === 'sellitem') { card = null; ctx.send({ t: 'remove', id: +b.dataset.id }); }
    else if (a === 'away') { const g = scene?.ghost(); if (g?.id) { ctx.send({ t: 'remove', id: g.id }); scene.ghostCancel(); } }
    else if (a === 'close') { card = null; cardBack = null; paintCard(); }
    else if (a === 'grab') { const id = +b.dataset.id; setEdit(true); scene?.ghostItem(id); }
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    const sh = e.target.closest?.('.ldname'); if (sh) { const v = sh.querySelector('#pf-shelf')?.value.trim(); if (v) ctx.send({ t: 'shelf', op: 'name', id: sh.dataset.shelf, name: v }); return; }
    const inp = e.target.querySelector('#pf-name'); if (!inp || !card?.pet) return;
    const name = inp.value.trim(); if (name) { ctx.send({ t: 'petname', id: card.pet, name }); inp.blur(); }
  });
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    const arrow = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key]; // the arrow keys slide the view over the farm
    if (arrow && mode === 'farm' && !panel) { e.preventDefault(); scene?.pan(...arrow); return; }
    if (!scene?.ghost()) return;
    if (e.key === 'r' || e.key === 'R') scene.ghostRotate();
    else if (e.key === 'Enter') confirmGhost();
    else if (e.key === 'Escape') scene.ghostCancel();
  };
  addEventListener('keydown', onKey);
  // the expedition countdown ticks down by itself
  const timer = setInterval(() => {
    if (mode !== 'farm' || !F) return;
    const was = F.trips.filter(t => t.left > 0).length; if (!was) return;
    for (const t of F.trips) if (t.due) t.left = Math.max(0, t.due - Date.now());
    if (F.trips.filter(t => t.left > 0).length < was) { sfx.turn(); ctx.toast(L('Your pets are back from their expedition!', 'Twoje zwierzaki wróciły z wyprawy!')); sync(); } else paintMain();
  }, 5000);
  const liveTimer = setInterval(() => { const c = $('pf-clock'); if (c) c.textContent = Math.max(0, Math.ceil((liveAt - Date.now()) / 1000)); }, 500);
  const skyTimer = setInterval(() => { // the sky follows the clock; say so when the weather turns
    if (destroyed || !scene || mode !== 'farm' || !F) return; const { hour, w } = skyNow(), key = w.kind + dayPart(hour); scene.setSky(hour, w.kind);
    if (key !== skyKey) { if (skyKey && !skyKey.startsWith(w.kind) && !B) ctx.toast(L(`${w.name} now. ${w.bonus}`, `Teraz: ${w.name}. ${w.bonus}`)); skyKey = key; paintTop(); if (panel?.kind === 'wx') paintPanel(); }
  }, 20000);
  const gardenTimer = setInterval(() => { if (mode === 'farm' && F && gardenAt && gardenAt - Date.now() <= 0) { gardenAt = 0; ctx.send({ t: 'open' }); } }, 5000);
  const nestTimer = setInterval(() => {
    if (mode !== 'farm' || !F || !F.nests.some(n => n.stage !== 'ready')) return;
    if (F.nests.some(n => n.stage !== 'ready' && n.due - Date.now() <= 0)) ctx.send({ t: 'open' }); else if (!F.trips.some(t => t.left > 0)) { for (const n of F.nests) if (n.due) n.left = Math.max(0, n.due - Date.now()); paintMain(); }
  }, 5000);

  // ---------- from the server ----------
  function msg(m) {
    clearTimeout(quiet);
    if (m.err) { sfx.bad(); ctx.toast(esc(srvText(m.err)), true); }
    if (m.need) { F = null; B = null; mode = m.need; edit = false; sync(); return; }
    if (m.foes) foes = m.foes;
    if (m.ranks) { ranks = m.ranks; if (panel?.kind === 'ranks') sync(); }
    if (m.world) world = m.world;
    if (m.visit) { V = { ...m.visit, trip: null }; if (where !== 'visit') { where = 'visit'; card = null; panel = null; } if (counter) { panel = { kind: 'trade', ...counter }; counter = null; } }
    if (m.note) ctx.toast(esc(srvText(m.note)));
    if (m.rank) setTimeout(() => !destroyed && ctx.toast(L(`A new kind of pet for your album! +${m.rank} rank experience.`, `Nowy gatunek w albumie! +${m.rank} doświadczenia rangi.`)), 1800);
    if (m.invite && B) ctx.send({ t: 'duelno', id: m.invite.id });
    if (m.invite && !F && !B) { heldInvite = m.invite; return; } // arrived before the farm loaded: show it once it has
    if (m.invite && F && !B) { sfx.turn(); panel = { kind: 'invite', ...m.invite }; card = null; edit = false; scene?.ghostCancel(); if (mode === 'farm') sync(); }
    if (m.battle) liveAt = Date.now() + (m.battle.left || 0);
    if (m.farm) { F = m.farm; for (const t of [...F.trips, F.trip, ...F.nests, F.nest]) if (t && t.left > 0) t.due = Date.now() + t.left; tripAt = Date.now() + (F.trip?.left || 0); nestAt = Date.now() + (F.nest?.left || 0); gardenAt = F.garden.left ? Date.now() + F.garden.left : 0; }
    if (m.battle !== undefined && F && !(m.did === 'fought')) { // a fight starting, a turn played, or one found still running
      const starting = !B && m.battle;
      if (!m.battle) { B = null; shown = null; playing = false; if (m.farm) { mode = 'farm'; sync(); } return; }
      if (starting) { B = m.battle; shown = structuredClone(B); playing = false; line = ''; blogs = []; $('pf-fl').innerHTML = ''; panel = null; card = null; edit = false; mode = 'farm'; sfx.turn(); sync(); return; }
      if (m.ev?.length) play(m.ev, m.battle); else { playing = false; B = m.battle; shown = structuredClone(B); sync(); }
      return;
    }
    if (m.did === 'fought') { // the last turn: play it out, then show the prize
      const ids = lastTeam, quit = m.ev.some(e => e.quit);
      play(m.ev, m.battle, () => { B = null; shown = null; panel = { kind: 'prize', prize: m.prize, ids, quit }; sync(); });
      return;
    }
    if (!m.farm) return;
    const first = mode !== 'farm';
    mode = 'farm';
    if (m.did === 'starter') { sfx.join(); ctx.toast(L(`${esc(F.pets[0].name)} moved in. Welcome to your farm!`, `${esc(F.pets[0].name)} już tu mieszka. Witaj na swojej farmie!`)); }
    else if (m.did === 'place' || m.did === 'move') { sfx.set(); if (m.did === 'place' && ITEMS[lastType]?.craft) scene?.work('workshop'); }
    else if (m.did === 'remove') { sfx.pop(); ctx.toast(m.got ? L(`Sold. You got ${esc(m.got)} back.`, 'Sprzedane. Koszt wrócił do zapasów.') : L('Put away.', 'Schowane.')); }
    else if (m.did === 'expand') { sfx.join(); ctx.toast(L(`The farm grew to ${F.size} by ${F.size} tiles.`, `Farma ma teraz ${F.size} na ${F.size} kratek.`)); }
    else if (m.did === 'send') { sfx.turn(); panel = null; ctx.toast(L(`Off they go to ${ZONES[lastTrip.zone].name}!`, `Ruszają w drogę: ${ZONES[lastTrip.zone].name}!`)); }
    else if (m.did === 'collect') { sfx.win(); card = null; panel = { kind: 'back', back: m.back }; }
    else if (m.did === 'help') { sfx.set(); ctx.toast(L(`You tidied up for ${esc(V.name)} and earned 3 coins.`, `Sprzątanie u gracza ${esc(V.name)} gotowe. Dostajesz 3 monety.`)); }
    else if (m.did === 'gift') { sfx.join(); panel = null; ctx.toast(L(`Your gift is in ${esc(V.name)}'s Mailbox.`, `Twój prezent jest już w Skrzynce pocztowej gracza ${esc(V.name)}.`)); }
    else if (m.did === 'claim' && m.born) { sfx.join(); const b = F.pets.find(x => x.id === m.born); ctx.toast(L(`${b ? b.name : 'A new pet'} has moved in!`, `${b ? b.name : 'Nowy zwierzak'}: nowy mieszkaniec farmy!`) + (b && inLodge(b.id) ? ' ' + inLodge(b.id) : '')); }
    else if (m.did === 'claim' && m.boost) { sfx.join(); ctx.toast(L(`${boostName(m.boost)}: tap the ${ITEMS[m.boost].name} to start it.`, `${boostName(m.boost)}: dotknij budynku (${ITEMS[m.boost].name}), żeby je włączyć.`)); }
    else if (m.did === 'boost') { sfx.join(); ctx.toast(boostWhat(m.type)); }
    else if (m.did === 'claim' && m.item) { sfx.join(); ctx.toast(L(`${ITEMS[m.item].name} is yours. Find it under Edit farm and place it for free.`, `${ITEMS[m.item].name}: to teraz twoje. Znajdziesz to w Urządź farmę i postawisz za darmo.`)); }
    else if (m.did === 'claim') { sfx.join(); ctx.toast(L('You got ', 'Dostajesz: ') + Object.entries(m.got).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') + '.'); }
    else if (m.did === 'duel') { sfx.join(); panel = null; ctx.toast(L(`Invitation sent. The battle starts as soon as ${esc(V?.name || 'they')} says yes.`, `Zaproszenie wysłane. Bitwa zacznie się, gdy tylko ${esc(V?.name || 'druga strona')} się zgodzi.`)); }
    else if (m.did === 'pick') { sfx.join(); card = null; ctx.toast(L(`You picked ${m.got} berries${m.wet ? ` (${m.wet} extra thanks to the rain)` : ''}${m.sun ? ` and ${m.sun} ${m.sun > 1 ? 'sunberries' : 'sunberry'}` : ''}.`, `Zebrane jagody: ${m.got}${m.wet ? ` (${m.wet} dodatkowo dzięki deszczowi)` : ''}${m.sun ? ` i słoneczne jagody: ${m.sun}` : ''}.`)); }
    else if (m.did === 'cook') { sfx.set(); scene?.work('kitchen'); ctx.toast(m.extra ? L(`${esc(helperOf('kitchen')?.name || 'Your helper')} baked a second one for free! Two ${RECIPES[m.what].name}s are ready.`, `${esc(helperOf('kitchen')?.name || 'Twój pomocnik')} piecze drugą porcję za darmo! Gotowe: ${RECIPES[m.what].name} × 2.`) : L(`One ${RECIPES[m.what].name} is ready.`, `Gotowe: ${RECIPES[m.what].name}.`)); }
    else if (m.did === 'swap') { sfx.join(); scene?.work('workshop'); ctx.toast(L(`Swapped ${m.pay} ${MATS[m.give].toLowerCase()} for ${m.got} ${MATS[m.get].toLowerCase()}.`, `Wymiana gotowa: ${MATS[m.give].toLowerCase()} (${m.pay}) za ${MATS[m.get].toLowerCase()} (${m.got}).`)); }
    else if (m.did === 'feed') { sfx.win(); const p = F.pets.find(x => x.id === m.pet); scene?.cheer(m.pet); ctx.toast(m.what === 'tonic' ? L(`${esc(p.name)} feels fresh and rested.`, `${esc(p.name)} ma znów pełno sił.`) : L(`${esc(p.name)} loved it.${m.grew ? (m.grew.form ? ` It grew up into its ${FORMS[m.grew.form].toLowerCase()} form!` : ` It reached level ${m.grew.lv}!`) : ''}`, `${esc(p.name)}: pycha!${m.grew ? (m.grew.form ? ` Nowa forma: ${FORMS[m.grew.form].toLowerCase()}!` : ` Poziom ${m.grew.lv}!`) : ''}`)); }
    else if (m.did === 'upgrade') { sfx.win(); scene?.pop(m.id); const it = F.items.find(x => x.id === m.id); ctx.toast(L(`${ITEMS[it.type].name} is now level ${lvOf(it)}.`, `${ITEMS[it.type].name}: teraz poziom ${lvOf(it)}.`)); }
    else if (m.did === 'train') { sfx.set(); panel = null; ctx.toast(F.train.ids.length ? L('Training plan saved.', 'Plan treningu zapisany.') : L('Nobody is training now.', 'Teraz nikt nie trenuje.')); }
    else if (m.did === 'defend') { panel = null; ctx.toast(L('Defence team saved.', 'Drużyna obrony zapisana.')); }
    else if (m.did === 'houseup') { sfx.win(); ctx.toast(L(`The farmhouse is now level ${F.house}.`, `Dom ma teraz poziom ${F.house}.`)); }
    else if (m.did === 'petname') ctx.toast(L('Renamed.', 'Imię zmienione.'));
    else if (m.did === 'work') { sfx.set(); panel = null; const h = m.pet && F.pets.find(x => x.id === m.pet); if (h) scene?.cheer(h.id); ctx.toast(h ? L(`${esc(h.name)} ${WORK[m.type].job} now. ${WORK[m.type].what(workPct(h, m.type))}.`, `${esc(h.name)} od teraz ${WORK[m.type].job}. ${WORK[m.type].what(workPct(h, m.type))}.`) : L(`Nobody helps at the ${ITEMS[m.type].name} now.`, `Teraz nikt tu nie pomaga: ${ITEMS[m.type].name}.`)); }
    else if (m.did === 'lodge') { const p = m.ids.length === 1 && F.pets.find(x => x.id === m.ids[0]), n = m.ids.length;
      ctx.toast(m.on ? (p ? L(`${esc(p.name)} curls up in the Pet Lodge.`, `${esc(p.name)} zwija się w kłębek w Schronisku.`) : L(`${n} pets moved into the Pet Lodge.`, `Zwierzaki przeniesione do Schroniska: ${n}.`))
        : (p ? L(`${esc(p.name)} is back on the island.`, `${esc(p.name)} wraca na wyspę.`) : L(`${n} pets are back on the island.`, `Zwierzaki z powrotem na wyspie: ${n}.`))); }
    else if (m.did === 'shelf' && m.op === 'new' && panel?.kind === 'lodge') { panel.tab = m.id; panel.sel = []; panel.page = 0; }
    else if (m.did === 'shelf' && m.op === 'del' && panel?.kind === 'lodge') { panel.tab = 'all'; ctx.toast(L('Collection deleted. Its pets stay in the Lodge.', 'Kolekcja usunięta. Jej zwierzaki zostają w Schronisku.')); }
    else if (m.did === 'free') { sfx.turn(); card = null; panel = { kind: 'bye', gone: m.gone, got: m.got }; }
    else if (m.did === 'offer') { sfx.join(); panel = null; ctx.toast(L(`Your offer is on its way to ${esc(V?.name || 'them')}.`, `Twoja oferta jest w drodze${V?.name ? ` do gracza ${esc(V.name)}` : ''}.`)); }
    else if (m.did === 'tradeyes') { sfx.win(); ctx.toast(L('Trade done! Your new things are on the farm.', 'Wymiana gotowa! Nowe rzeczy są już na farmie.')); }
    else if (m.did === 'tradeno' && !counter) ctx.toast(L('Offer declined. Everything went back.', 'Oferta odrzucona. Wszystko wróciło na miejsce.'));
    else if (m.did === 'tradecancel') ctx.toast(L('You took the offer back.', 'Oferta wycofana.'));
    else if (m.did === 'pair') { sfx.join(); panel = null; if (where === 'visit') goHome(); ctx.toast(L(`They are cuddling in the Nest. An egg appears in ${CUDDLE_H} hours.`, `Przytulają się w Gnieździe. Jajko pojawi się za ${CUDDLE_H} godz.`)); }
    else if (m.did === 'hatch') { sfx.win(); card = null; panel = { kind: 'born', id: m.born }; }
    if (first) { pick = null; edit = false; }
    if (heldInvite && !B) { panel = { kind: 'invite', ...heldInvite }; heldInvite = null; card = null; }
    sync();
    if (m.did === 'collect') for (const id of m.back.pets.concat(m.back.found || [])) scene?.cheer(id);
    // keep building: after placing one fence, hold the next one ready beside it
    if (m.did === 'place' && edit && lastType && scene) {
      const it = ITEMS[lastType];
      if (canAfford(F.inv, it.cost) && !(maxOf(F, lastType) && countOf(F, lastType) >= maxOf(F, lastType))) scene.ghostNew(lastType, lastSpot, lastSpot[2]);
    }
    lastType = null;
  }

  return {
    msg,
    // the account changed (signed in, out, or registered): ask again
    me() { const u = ctx.me()?.user || null; if (u !== user) { user = u; mode = 'load'; F = null; edit = false; sync(); ctx.send({ t: 'open' }); } else { const k = lookKey(); if (k !== look) { look = k; mapShown = null; sync(); } } }, // same player in a new look: redraw the avatar
    reopen() { ctx.send({ t: 'open' }); },
    // walk straight to a friend's farm (from the site's friends list)
    visit(id) { if (B) return ctx.toast(L('Finish the battle first.', 'Najpierw dokończ bitwę.'), true); edit = false; scene?.ghostCancel(); ctx.send({ t: 'visit', id }); },
    destroy() { if (where === 'visit') ctx.send({ t: 'leave' }); destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearInterval(nestTimer); clearInterval(gardenTimer); clearInterval(skyTimer); clearInterval(liveTimer); clearTimeout(quiet); clearTimeout(thumbT); scene?.dispose(); },
  };
}
