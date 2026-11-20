// Pet Farm view: the HUD over the 3D farm. Shows what the server says and sends what the player wants to do.
// Unlike the table games this one has no room: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode) }
import { sfx } from '../../sfx.js';
import { MOVES, STATUS, STAT_NAME, KIT, LEARN, ROLE_NAME, movesAt, XMOVE_LV, TURN_S } from './battle.js';
import { COATS, PATTERNS, PART, TALENTS, STAR_NAME, BREED_LV, CUDDLE_H, speciesOdds, hatchHours, coatHex } from './breed.js';
import { MAT_INFO, ITEMS, MATS, SPECIES, STARTERS, ELEMENTS, FORMS, RARITY, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, GIFTS, RECIPES, SELL, SELL_LOT, BERRIES, UPGRADES, UP_MAX, lvOf, upCost, whatUp, TRAIN_XP, formOf, xpFor, tripLoot, canAfford, countOf, costText } from './data.js';
import { matIcon } from './icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  turn: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
};
// Small material badges: a coloured block with the amount beside it.
const BASIC = ['wood', 'stone', 'fiber', 'coins'];
const mat = (k, n, cls = '') => `<span class="mat ${cls}" title="${MATS[k]}">${matIcon(k)}${n}<small>${MATS[k].toLowerCase()}</small></span>`;
const costHtml = (cost, inv) => Object.keys(cost || {}).length ? Object.entries(cost).map(([k, n]) => mat(k, n, inv && (inv[k] || 0) < n ? 'short' : '')).join('') : '<span class="mat">Free</span>';
const wait = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${m / 60 | 0}h ${m % 60}m` : `${m}m`; };
const span = min => min >= 60 ? `${min / 60} ${min === 60 ? 'hour' : 'hours'}` : `${min} minutes`;
const elTag = e => `<span class="el" style="--c:${ELEMENTS[e]}">${e}</span>`;
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1);

let cssLoaded = false, thumbs = null;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./farm.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pf">
    <canvas class="g3d" aria-label="Your farm"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="pf-title">Pet Farm</span><div class="mats" id="pf-mats"></div></div>
      <div class="tr">
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="home" aria-label="Back to the hub">${I.door}</button></div>
      <div class="bl" id="pf-main"></div>
      <div class="pcard" id="pf-card" hidden></div>
      <div class="bt" id="pf-bt" hidden></div>
      <div class="bfl" id="pf-fl"></div>
      <div class="dock"><div class="ghostbar" id="pf-ghost" hidden></div><div class="build" id="pf-build" hidden></div></div>
    </div>
    <div class="gate" id="pf-panel" hidden></div>
    <div class="gate" id="pf-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.pf'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  let F = null, scene = null, destroyed = false, mode = 'load', edit = false, tab = 'b', pick = null, card = null, panel = null, tripAt = 0, nestAt = 0, lastType = null, lastSpot = null;
  // Every request gets an answer. If none comes, say so instead of leaving a button that seems dead.
  let quiet = 0;
  const say = ctx.send;
  ctx = { ...ctx, send(a) { say(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) ctx.toast('The farm did not answer. Check your connection. If the game was just updated, the server needs a restart.', true); }, 4000); } };
  let where = 'home', world = null, V = null; // home, map (the neighbourhood), or visit (someone else's farm, in V)
  let B = null, shown = null, playing = false, foes = null, line = '', blogs = [], lastEl = null, ranks = null;
  let logOpen = (() => { try { const v = localStorage.getItem('pf_blog'); return v ? v === '1' : innerWidth > 900; } catch { return innerWidth > 900; } })();
  let mapShown = null, counter = null; // counter: an offer to pre-fill once we have walked to the other farm
  let user = ctx.me()?.user || null, lastTrip = { zone: 'woods', trip: 'stroll', pets: [] }, lastTeam = [], liveAt = 0, gardenAt = 0, heldInvite = null;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onPick, onGhost: paintGhost });
    thumbs ||= scene.thumbs([...Object.keys(ITEMS), ...Object.keys(SPECIES).map(s => 'pet:' + s)]);
    sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const thumb = (k, alt = '') => thumbs?.[k] ? `<img src="${thumbs[k]}" alt="${esc(alt)}" width="56" height="56">` : '<span class="nothumb"></span>';

  // A pet's own picture: its real form, coat and markings.
  const face = (p, alt = '') => { const u = p && scene?.portrait?.(p.sp, formOf(p.lv || 1), p.look || null); return u ? `<img src="${u}" alt="${esc(alt || p.name || '')}" width="56" height="56">` : thumb('pet:' + p?.sp, alt); };
  const stars = n => `<span class="stars" aria-label="${n} of 5 stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const swatch = (c, name) => `<span class="sw" title="${name}"><i style="background:${c}"></i>${name}</span>`;
  const nestTxt = n => n.stage === 'cuddle' ? `An egg will appear in ${wait(n.left)}.` : n.stage === 'egg' ? `The egg hatches in ${wait(n.left)}.` : 'The egg is ready to hatch!';
  const cannotPair = p => p.lv < BREED_LV ? `Needs level ${BREED_LV}` : p.rest > 0 ? `Resting for ${wait(p.rest)}` : outNow().includes(p.id) ? 'Away exploring' : F.nests.some(n => n.stage === 'cuddle' && (n.a === p.id || n.b === p.id)) ? 'Already in the Nest' : '';
  const outNow = () => F.trips.filter(t => t.left > 0).flatMap(t => t.pets), outAll = () => F.trips.flatMap(t => t.pets); // away right now; away or waiting to be welcomed
  // ---------- painting ----------
  function sync() {
    if (F) for (const t of [...F.trips, F.trip, ...F.nests, F.nest]) if (t && t.due) t.left = Math.max(0, t.due - Date.now());
    paintGate(); paintTop(); paintMain(); paintBuild(); paintCard(); paintPanel(); paintBattle();
    if (!scene) return;
    if (mode === 'starter') { scene.setFarm(null); scene.setStarters(pick || ''); }
    else { const meAv = { color: ctx.me()?.color, av: ctx.me()?.av }; if (where === 'visit' && V) scene.setOwner({ color: V.color, av: V.av }, meAv); else scene.setOwner(meAv); scene.setStarters(null); scene.setFarm(mode !== 'farm' ? null : where === 'visit' && V ? V : F); scene.setEdit(edit); }
    const map = mode === 'farm' && where === 'map' && !B && world ? world : null;
    if (map !== mapShown) { mapShown = map; scene.setWorld(map, map && { ...F, name: F.owner, color: ctx.me()?.color, av: ctx.me()?.av }, map ? Object.entries(ZONES).map(([key, z]) => ({ key, name: z.name, el: z.el, theme: z.theme, out: F.trips.some(t => t.zone === key), fly: F.trips.filter(t => t.zone === key).map(t => ({ left: t.left, total: TRIPS[t.trip].min * 60000 }))[0], note: F.trips.some(t => t.zone === key) ? (F.trips.some(t => t.zone === key && t.left > 0) ? 'your party is here' : 'your party is back') : F.house < z.house ? `farmhouse level ${z.house}` : 'tap to explore' })) : []); }
    scene.setBattle(!!B && mode === 'farm'); if (B) for (const s of [0, 1]) scene.ringPet(s, shown.sides[s].pets[shown.sides[s].on]);
  }
  function paintTop() {
    $('pf-title').textContent = B ? (B.mode === 'live' ? `Live battle with ${B.foe}` : B.mode === 'arena' ? `Match against ${B.foe}` : B.mode === 'wild' ? `Meeting ${B.foe}` : 'Practice battle') : where === 'map' && F ? 'The neighbourhood' : where === 'visit' && V ? `${V.name}'s farm` : F ? `${F.owner}'s farm` : 'Pet Farm';
    $('pf-mats').innerHTML = F && mode === 'farm' && !B ? Object.keys(MATS).filter(k => BASIC.includes(k) || F.inv[k]).map(k => `<button type="button" class="matbtn" data-a="matinfo" data-mat="${k}" title="${MATS[k]}. From: ${MAT_INFO[k][0]} For: ${MAT_INFO[k][1]}">${mat(k, F.inv[k] || 0)}</button>`).join('') : '';
  }
  function paintMain() {
    const el = $('pf-main');
    if (mode !== 'farm' || edit || B) { el.innerHTML = ''; return; }
    if (where === 'map') {
      el.innerHTML = `<button type="button" class="btn big" data-a="gohome">Back to my farm</button><button type="button" class="btn w" data-a="friends">Friends</button><button type="button" class="btn w" data-a="ranks">Ranking</button><span class="chip">${!world ? 'Looking around…' : world.length ? 'Tap an island to visit' : 'No other farms yet. They appear here when friends start one.'}</span>`;
      return;
    }
    if (where === 'visit' && V) {
      el.innerHTML = `<button type="button" class="btn big" data-a="map">Back to the map</button>
        <button type="button" class="btn m" data-a="help" ${V.helps > 0 ? '' : 'disabled'}>Help out (${V.helps} left)</button>
        <button type="button" class="btn m" data-a="giftopen" ${V.gift ? '' : 'disabled'}>${V.gift ? 'Leave a gift' : 'Gift left today'}</button>
        <button type="button" class="btn w" data-a="trade">Trade</button>
        ${countOf(F, 'flag') && V.team ? '<button type="button" class="btn w" data-a="duel">Challenge</button>' : ''}
        <button type="button" class="btn w" data-a="livego">Live battle</button>
        <button type="button" class="btn w" data-a="compare">Compare albums</button>
        ${V.pal ? `<span class="chip">Friendship ${V.pal}</span>` : ''}`;
      return;
    }
    const trip = !countOf(F, 'gate') ? '<span class="chip">Build an Expedition Gate to send pets exploring</span>'
      : F.trips.map(t => t.left > 0 ? `<span class="chip">Back from ${ZONES[t.zone].name} in ${wait(t.left)}</span>` : `<button type="button" class="btn big m" data-a="collect" data-id="${t.id}">Welcome them back${F.trips.length > 1 ? ` from ${ZONES[t.zone].name}` : ''}</button>`).join('')
        + (F.wild ? `<button type="button" class="btn m" data-a="wildfight">Battle the wild ${SPECIES[F.wild.sp].name}</button>` : '')
        + (F.trips.length < F.partyMax ? `<button type="button" class="btn m" data-a="explore">${F.trips.length ? 'Send another party' : 'Send pets exploring'}</button>` : '');
    el.innerHTML = `<button type="button" class="btn big" data-a="edit">Edit farm</button>${trip}
      ${F.garden.ripe ? `<button type="button" class="btn m" data-a="berries">Pick berries (${F.garden.ripe * BERRIES})</button>` : ''}
      <button type="button" class="btn w" data-a="map">World map</button>
      <button type="button" class="btn w" data-a="friends">Friends</button>
      <button type="button" class="btn w" data-a="ranks">Ranking</button>
      <button type="button" class="btn w" data-a="album">Pet Album</button>
      ${F.mail.length + F.trades.length ? `<button type="button" class="btn w" data-a="mail">Mail ${F.mail.length + F.trades.filter(t => t.dir === 'in').length || ''}</button>` : ''}
      ${F.nests.map(n => n.stage === 'ready' ? `<button type="button" class="btn m" data-a="hatch" data-slot="${n.slot}">Hatch the egg</button>` : `<span class="chip">${n.stage === 'cuddle' ? 'Egg in' : 'Hatches in'} ${wait(n.left)}</span>`).join('')}`;
  }
  // ---------- expeditions ----------
  const petRow = (p, extra = '') => `${face(p)}<b>${esc(p.name)}</b><small>Level ${p.lv}${extra}</small>`;
  function paintPanel() {
    const box = $('pf-panel');
    if (!panel || mode !== 'farm' || (edit && panel.kind !== 'buy')) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (panel.kind === 'buy') { // a closer look at something from the build menu before paying for it
      const type = panel.type, it = ITEMS[type], have = countOf(F, type), up = UPGRADES[type];
      const gift = F.stash[type] || 0;
      const why = gift ? '' : it.pals && F.palpts < it.pals ? `Unlocks at ${it.pals} friendship points (you have ${F.palpts}). You earn them by helping out and leaving gifts.`
        : it.craft && Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)) < it.craft ? (it.craft > 1 ? `Needs a level ${it.craft} Workshop. Tap your Workshop to improve it.` : 'Needs a Workshop on your farm. It is under Buildings.')
        : it.max && have >= it.max ? `You already have ${it.max === 1 ? 'one, and one is the most a farm can hold' : `${have}, the most a farm can hold`}.`
        : !canAfford(F.inv, it.cost) ? 'You do not have enough materials yet.' : '';
      const size = it.w === it.h ? (it.w < 1 ? 'Half a tile' : it.w === 1 ? 'One tile' : `${it.w} by ${it.h} tiles`) : `${it.w} by ${it.h} tiles`;
      box.innerHTML = `<div class="panel tripp buy"><div class="buytop">${thumb(type, it.name)}<div><h2>${it.name}</h2><p>${it.desc}</p></div></div>
        <p class="hint">${size}${it.walk ? ' · pets can walk over it' : ''}${it.max ? ` · you have ${have} of ${it.max}` : have ? ` · you have ${have}` : ''}${up ? ` · can be improved to level ${UP_MAX}` : ''}</p>
        <p><b>Price</b></p><div class="cost">${gift ? `<span class="mat">Free: a gift from a friend (${gift} to place)</span>` : costHtml(it.cost, F.inv)}</div>
        <p class="hint">${why || 'After buying, drag it to where you want it. Selling it later gives everything back.'}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button>
          <button type="button" class="btn big m" data-a="buy" data-type="${type}" ${why ? 'disabled' : ''}>${gift ? 'Place it' : 'Buy and place'}</button></div></div>`;
      return;
    }
    if (panel.kind === 'team') { // who fights (or defends), in order: the first one leads
      const away = outAll(), what = panel.mode === 'defend' ? 'Defence team' : panel.mode === 'live' ? `Live battle with ${esc(panel.foeName)}` : panel.mode === 'arena' ? `Match against ${esc(panel.foeName)}` : 'Practice battle';
      const pets = F.pets.map(p => { const i = panel.pets.indexOf(p.id), out = away.includes(p.id) && panel.mode !== 'defend';
        return `<button type="button" class="pickpet${out ? ' off' : ''}" data-a="team" data-id="${p.id}" aria-pressed="${i >= 0}">${i >= 0 ? `<span class="num">${i + 1}</span>` : ''}
          ${petRow(p, out ? ' · exploring' : ' · ' + SPECIES[p.sp].el)}</button>`; }).join('');
      const note = panel.mode === 'live' ? `You both play at the same time, with ${TURN_S} seconds to choose each turn. Everyone fights at level 20. ${panel.invite ? '' : `${esc(panel.foeName)} has to be online to say yes.`}`
        : panel.mode === 'defend' ? 'These pets defend your farm when another player challenges you. They fight at level 20 and are played by the game.'
        : panel.mode === 'arena' ? `Everyone fights at level 20 with all four moves. ${F.fights.arena > 0 ? `Rewarded matches left today: ${F.fights.arena}.` : 'No rewarded matches left today, so this one is just for fun.'}`
        : `Your pets fight at their own level against partners of the same level. ${F.fights.practice > 0 ? `Practice fights that give experience today: ${F.fights.practice}.` : 'No more experience from practice today, but you can still fight for fun.'}`;
      box.innerHTML = `<div class="panel tripp"><h2>${what}</h2><p>Pick up to ${PARTY}. The first one you tap leads.</p>
        <div class="party">${pets}</div><p class="hint">${note}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button>
          <button type="button" class="btn big m" data-a="${panel.mode === 'defend' ? 'defend' : 'fight'}" ${panel.pets.length ? '' : 'disabled'}>${panel.mode === 'defend' ? 'Save team' : panel.mode === 'live' ? (panel.invite ? 'Join the battle' : 'Send the invitation') : 'Start'}</button></div></div>`;
      return;
    }
    if (panel.kind === 'train') {
      const gone = outAll(), pets = F.pets.map(p => { const on = panel.pets.includes(p.id), full = p.lv >= MAX_LV, out = gone.includes(p.id);
        return `<button type="button" class="pickpet${full || out ? ' off' : ''}" data-a="trainpick" data-id="${p.id}" data-why="${out ? 'out' : ''}" aria-pressed="${on}">${petRow(p, out ? ' · exploring' : full ? ' · fully grown' : ' · level ' + p.lv)}</button>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Who trains at the yard?</h2><p>Pick up to ${F.train.slots}. Each one earns ${TRAIN_XP} experience an hour, even while you are away. A pet that is out exploring cannot train, and sending a pet exploring ends its training.</p>
        <div class="party">${pets}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button><button type="button" class="btn big m" data-a="trainsave">Save</button></div></div>`;
      return;
    }
    if (panel.kind === 'compare') { // my album next to the neighbour's: who could help whom
      const has = (al, sp) => al?.[sp]?.some(Boolean), all = Object.keys(SPECIES);
      const theirs = all.filter(sp => has(V.album, sp) && !has(F.album, sp)), mine = all.filter(sp => has(F.album, sp) && !has(V.album, sp));
      const names = l => l.length ? l.map(sp => `<span class="chip">${thumb('pet:' + sp)}${SPECIES[sp].name}</span>`).join('') : '<span class="hint">Nothing right now.</span>';
      const rows = all.map(sp => `<div class="cmp"><span>${has(F.album, sp) || has(V.album, sp) ? thumb('pet:' + sp) + SPECIES[sp].name : '<span class="nothumb">?</span>Not found yet'}</span><b class="${has(F.album, sp) ? 'got' : ''}">${has(F.album, sp) ? '✓' : '–'}</b><b class="${has(V.album, sp) ? 'got' : ''}">${has(V.album, sp) ? '✓' : '–'}</b></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Your album and ${esc(V.name)}'s</h2>
        <p><b>${esc(V.name)} has found, and you have not:</b></p><div class="cmplist">${names(theirs)}</div>
        <p><b>You have found, and ${esc(V.name)} has not:</b></p><div class="cmplist">${names(mine)}</div>
        <p class="hint">A trade or a playdate can fill the gaps.</p>
        <div class="cmp head"><span>Pet</span><b>You</b><b>${esc(V.name)}</b></div><div class="cmprows">${rows}</div>
        <div class="row end"><button type="button" class="btn big m" data-a="shut">Close</button></div></div>`;
      return;
    }
    if (panel.kind === 'mat') { // what a material is, where it comes from and what it is for
      const k = panel.mat, cap = k !== 'coins' && F.cap && ['wood', 'stone', 'fiber', 'shells', 'coal', 'berries'].includes(k);
      box.innerHTML = `<div class="panel tripp"><h2 class="icoh">${matIcon(k, 40)}${MATS[k]}</h2><div class="mats">${mat(k, F.inv[k] || 0)}</div>
        <p><b>Where it comes from</b><br>${MAT_INFO[k][0]}</p><p><b>What it is for</b><br>${MAT_INFO[k][1]}</p>
        ${cap ? `<p class="hint">Your farm can hold ${F.cap} of these. A Storage Barn holds more.</p>` : ''}
        <div class="row end"><button type="button" class="btn big m" data-a="shut">Got it</button></div></div>`;
      return;
    }
    if (panel.kind === 'cook') {
      const kLv = Math.max(0, ...F.items.filter(i => i.type === 'kitchen').map(lvOf));
      const rows = Object.entries(RECIPES).map(([k, r]) => `<button type="button" class="zone${canAfford(F.inv, r.cost) && kLv >= (r.lv || 1) ? '' : ' off'}" data-a="cook" data-what="${k}" data-lv="${kLv >= (r.lv || 1) ? '' : r.lv}">${matIcon(k, 34)}<b>${r.name}</b><small>${kLv >= (r.lv || 1) ? r.desc : `Needs a level ${r.lv} Kitchen.`}</small><span class="cost">${costHtml(r.cost, F.inv)}</span><small>You have ${F.inv[k] || 0}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Kitchen</h2><p>You have ${F.inv.berries || 0} berries${F.inv.sunberry ? ` and ${F.inv.sunberry} sunberries` : ''}. To feed a treat, tap a pet on your farm.</p>
        <div class="zones">${rows}</div><div class="row end"><button type="button" class="btn big m" data-a="shut">Done</button></div></div>`;
      return;
    }
    if (panel.kind === 'sell') {
      const rows = Object.entries(SELL).map(([k, n]) => `<button type="button" class="zone${(F.inv[k] || 0) < SELL_LOT ? ' off' : ''}" data-a="sell" data-mat="${k}">${matIcon(k, 30)}<b>${SELL_LOT} ${MATS[k].toLowerCase()} for ${n} coins</b><small>You have ${F.inv[k] || 0}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Sell spare materials</h2><p>The Workshop pays coins for materials you do not need. You have ${F.inv.coins || 0} coins.</p>
        <div class="zones">${rows}</div><div class="row end"><button type="button" class="btn big m" data-a="shut">Done</button></div></div>`;
      return;
    }
    if (panel.kind === 'gift') {
      const rows = Object.entries(GIFTS).filter(([k]) => BASIC.includes(k) || F.inv[k]).map(([k, n]) => `<button type="button" class="zone${(F.inv[k] || 0) < n ? ' off' : ''}" data-a="gift" data-mat="${k}">${matIcon(k, 30)}<b>${n} ${MATS[k].toLowerCase()}</b><small>You have ${F.inv[k] || 0}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>A gift for ${esc(V.name)}</h2><p>It comes out of your own stock and lands in their Mailbox. One gift a day for each neighbour.</p>
        <div class="zones">${rows}</div>
        <p><b>Or a decoration.</b> You pay for it, and they can place it for free.</p>
        <div class="zones">${Object.entries(ITEMS).filter(([, it]) => it.kind === 'd' && !it.pals && !(it.craft && Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)) < it.craft) && canAfford(F.inv, it.cost)).map(([k, it]) => `<button type="button" class="zone" data-a="gift" data-item="${k}">${thumb(k)}<b>${it.name}</b><span class="cost">${costHtml(it.cost, F.inv)}</span></button>`).join('') || '<span class="hint">You cannot afford any decoration right now.</span>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button></div></div>`;
      return;
    }
    if (panel.kind === 'trade') { // build an offer for the farm being visited
      const T = panel, away = outNow();
      const petBtn = (x, sideKey, off) => `<button type="button" class="pickpet${off ? ' off' : ''}" data-a="tradepet" data-side="${sideKey}" data-id="${x.id}" aria-pressed="${T[sideKey].pets.includes(x.id)}">${petRow(x, off ? ' · ' + off : T[sideKey].pets.includes(x.id) ? ' · in the offer' : '')}</button>`;
      const FOOD = ['sunberry', 'cookie', 'cake', 'juice', 'pie', 'tonic'];
      const mats = (sideKey, inv) => Object.keys(MATS).filter(k => T[sideKey].mats[k] || (inv ? inv[k] > 0 : T.more || !FOOD.includes(k))).map(k => { const n = T[sideKey].mats[k] || 0, max = inv ? inv[k] || 0 : 9999;
        return `<div class="tm${n ? ' on' : ''}">${matIcon(k, 30)}<span class="tmn"><b>${MATS[k]}</b>${inv ? `<small>You have ${inv[k] || 0}</small>` : ''}</span>
          <span class="step"><button type="button" data-a="tmstep" data-d="-1" aria-label="Less ${MATS[k]}">−</button><input class="field" type="number" inputmode="numeric" min="0" max="${max}" data-tm="${sideKey}" data-mat="${k}" value="${n || ''}" placeholder="0" aria-label="${MATS[k]}, how many"><button type="button" data-a="tmstep" data-d="1" aria-label="More ${MATS[k]}">+</button></span></div>`; }).join('');
      const mine = F.pets.map(x => petBtn(x, 'give', x.held ? 'promised' : away.includes(x.id) ? 'exploring' : F.def.includes(x.id) && F.pets.length > 3 ? '' : '')).join('');
      const theirs = V.pets.map(x => petBtn(x, 'want', x.can ? '' : 'staying')).join('');
      box.innerHTML = `<div class="panel tripp trade"><h2>Trade with ${esc(V.name)}</h2>
        <p>Choose what you give and what you want back. Your side is set aside until ${esc(V.name)} answers from their Mailbox, or for a week.</p>
        <section class="tside give"><h3>You give</h3><p class="hint">Tap a pet to add it, up to three. Use the plus and minus buttons for materials.</p><div class="party">${mine}</div><div class="tmrow">${mats('give', F.inv) || '<span class="hint">You have no materials to offer.</span>'}</div></section>
        <section class="tside want"><h3>You ask for</h3><div class="party">${theirs || '<span class="hint">Their pets are all away.</span>'}</div><div class="tmrow">${mats('want', null)}</div>
          ${T.more ? '' : '<button type="button" class="btn sm w" data-a="trademore">Show food and treats too</button>'}</section>
        <div class="tsum" role="status">${tradeSum()}</div>
        <div class="row end stick"><button type="button" class="btn w" data-a="shut">Not now</button><button type="button" class="btn big m" data-a="offer" ${tradeEmpty() ? 'disabled' : ''}>Send the offer</button></div></div>`;
      return;
    }
    if (panel.kind === 'mail') {
      const box2 = !!countOf(F, 'mailbox');
      const rows = F.mail.map(m => { const got = m.item ? `<span class="mat">${thumb(m.item)}${ITEMS[m.item]?.name || 'A decoration'}</span>` : m.got && Object.entries(m.got).map(([k, n]) => mat(k, n)).join('');
        const text = m.k === 'gift' ? `<b>A gift from ${esc(m.from)}</b>${m.text ? `<small>${esc(m.text)}</small>` : ''}` : m.k === 'note' ? `<b>${esc(m.text)}</b>` : m.k === 'date' ? `<b>${esc(m.from)} came for a playdate with ${esc(m.pet)}</b><small>A thank-you is inside.</small>` : m.k === 'help' ? `<b>${esc(m.from)} helped out</b><small>${m.n} ${m.n === 1 ? 'time' : 'times'} today. Thank them with a visit.</small>`
          : `<b>${esc(m.from)} challenged your farm</b><small>${m.held ? 'Your team held. You earned 5 coins.' : 'Your team lost this one. Nothing was taken.'}</small>`;
        return `<div class="letter"><div>${text}${got ? `<div class="mats">${got}</div>` : ''}</div>${m.got || m.item ? `<button type="button" class="btn sm m" data-a="claim" data-id="${m.id}" ${box2 ? '' : 'disabled'}>Open</button>` : ''}</div>`; }).join('');
      const side = x => [...x.pets.map(q => q ? `<span class="kin">${face(q)}<small>${esc(q.name)}<br>level ${q.lv}</small></span>` : '<span class="kin"><span class="nothumb">?</span><small>a pet that moved on</small></span>'), ...Object.entries(x.mats).map(([k, n]) => mat(k, n))].join('') || '<span class="hint">nothing</span>';
      const deals = F.trades.map(t => `<div class="letter deal"><div><b>${t.dir === 'in' ? `${esc(t.who)} offers a trade` : `Your offer to ${esc(t.who)}`}</b><small>${t.dir === 'in' ? 'Answer' : 'Waits'} for ${t.left > 36 * 3600000 ? Math.round(t.left / 86400000) + ' days' : wait(t.left)} more.</small>
          <div class="swap"><div><small>${t.dir === 'in' ? 'You get' : 'You give'}</small><div class="mats">${side(t.give)}</div></div><div><small>${t.dir === 'in' ? 'You give' : 'You get'}</small><div class="mats">${side(t.want)}</div></div></div></div>
          <div class="dealbtns">${t.dir === 'in' ? `<button type="button" class="btn sm m" data-a="tradeyes" data-id="${t.id}">Accept</button><button type="button" class="btn sm w" data-a="tradecounter" data-id="${t.id}">Counter</button><button type="button" class="btn sm ghost-ink" data-a="tradeno" data-id="${t.id}">Decline</button>` : `<button type="button" class="btn sm w" data-a="tradecancel" data-id="${t.id}">Take it back</button>`}</div></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Mailbox</h2>${box2 ? '' : '<p>Build a Mailbox on your farm to open gifts.</p>'}
        ${deals}${rows || (deals ? '' : '<p class="hint">Nothing new. Gifts, trade offers and news from neighbours land here.</p>')}
        <div class="row end">${box2 && F.mail.some(m => !m.got && !m.item) ? '<button type="button" class="btn w" data-a="mailread">Clear the news</button>' : ''}<button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
      return;
    }
    if (panel.kind === 'nest') { // choose the two parents and see what the egg might hold
      const fr = panel.friend, pool = F.pets, pk = panel.pick;
      const A = pool.find(x => x.id === pk[0]), Bp = fr ? fr.pet : pool.find(x => x.id === pk[1]);
      const rows = pool.map(x => { const why = cannotPair(x), on = pk.includes(x.id);
        return `<button type="button" class="pickpet${why ? ' off' : ''}" data-a="nestpick" data-id="${x.id}" aria-pressed="${on}">${petRow(x, why ? ' · ' + why : '')}</button>`; }).join('');
      let pre = '';
      if (A && Bp) {
        const odds = speciesOdds(A.sp, Bp.sp), genes = [...new Set([...A.col, ...Bp.col])], parts = [A, Bp].filter(x => x.sp !== (x === A ? Bp : A).sp).map(x => PART[x.sp]);
        const marks = [...new Set([...(A.pat || []), ...(Bp.pat || [])])];
        pre = `<div class="pre"><b>What might hatch</b>
          <div class="odds">${odds.map(o => o.hybrid && !F.album[o.sp] ? `<span class="odd"><span class="nothumb">?</span><small>Something new · ${Math.round(o.p * 100)}%</small></span>` : `<span class="odd">${thumb('pet:' + o.sp, SPECIES[o.sp].name)}<small>${SPECIES[o.sp].name} · ${Math.round(o.p * 100)}%</small></span>`).join('')}</div>
          <p>Coat: ${genes.map(g => swatch(g ? COATS[g].c : coatHex({ sp: odds[0].sp, col: [0] }), COATS[g].name)).join('')}<span class="hint"> or a colour one of them is hiding.</span></p>
          ${marks.length ? `<p>Markings it may get: ${list(marks.map(k => PATTERNS[k].toLowerCase()))}.</p>` : ''}
          ${parts.length ? `<p>It may borrow ${list(parts)}.</p>` : ''}
          <p class="hint">The egg appears after ${CUDDLE_H} hours and hatches ${[...new Set([Math.min(...odds.map(o => hatchHours(o.sp))), Math.max(...odds.map(o => hatchHours(o.sp)))])].join(' to ')} hours later. Both rest for a while afterwards.</p></div>`;
      }
      box.innerHTML = `<div class="panel tripp"><h2>${fr ? `Playdate with ${esc(fr.pet.name)}` : 'The Nest'}</h2>
        <p>${fr ? `Pick one of your pets to meet ${esc(fr.name)}'s ${esc(fr.pet.name)}. The egg comes home to your Nest.` : 'Pick two pets. Any two can have an egg together, and the baby takes after both.'}</p>
        ${fr ? `<div class="party"><span class="pickpet" aria-pressed="true">${petRow(fr.pet, ' · ' + esc(fr.name) + "'s")}</span></div>` : ''}
        <div class="party">${rows}</div>${pre}
        <div class="row end stick"><button type="button" class="btn w" data-a="shut">Not now</button><button type="button" class="btn big m" data-a="pair" ${A && Bp ? '' : 'disabled'}>Off to the Nest</button></div></div>`;
      return;
    }
    if (panel.kind === 'born') { // the egg just hatched
      const p = F.pets.find(x => x.id === panel.id); if (!p) { panel = null; box.hidden = true; return; }
      const s = SPECIES[p.sp], [ma, pa] = p.par || [], got = [];
      if (p.look?.coat || p.look?.coat2) got.push(p.blend ? 'a blended coat' : p.two != null ? 'a two-tone coat' : `a ${COATS[p.col[0]].name.toLowerCase()} coat`);
      if (p.pat?.length) got.push(list(p.pat.map(k => PATTERNS[k].toLowerCase())));
      if (p.feat) got.push(PART[p.feat] + ' from the ' + SPECIES[p.feat].name + ' side');
      if (p.xmove) got.push(`the move ${MOVES[p.xmove].name}`);
      box.innerHTML = `<div class="panel tripp born"><h2>${p.sparkle ? 'A sparkling ' : 'A baby '}${s.name} hatched!</h2>
        <div class="bornpic">${face(p, s.name)}</div>
        <p>${elTag(s.el)}${s.el2 ? elTag(s.el2) : ''} ${s.blurb}</p>
        ${got.length ? `<p>It has ${list(got)}.</p>` : '<p>It looks just like its family.</p>'}
        ${ma ? `<div class="tree"><span class="kin">${face(ma)}<small>${esc(ma.name)}</small></span><span class="plus">+</span><span class="kin">${face(pa)}<small>${esc(pa.name)}</small></span></div>` : ''}
        <div class="row end"><button type="button" class="btn w" data-a="petpage" data-id="${p.id}">Traits and family</button><button type="button" class="btn m" data-a="shut">Lovely</button></div></div>`;
      return;
    }
    if (panel.kind === 'pet') { // everything about one pet, and its family tree
      const p = F.pets.find(x => x.id === panel.id); if (!p) { panel = null; box.hidden = true; return; }
      const s = SPECIES[p.sp], kin = k => k ? `<span class="kin">${face(k)}<small>${esc(k.name)}${k.own && k.own !== F.owner ? `<br>${esc(k.own)}'s` : ''}</small></span>` : '';
      const tree = p.par ? `<p><b>Family</b></p><div class="tree">${p.par.map(k => `<span class="branch">${kin(k)}${k.par?.length ? `<span class="gp">${k.par.map(kin).join('')}</span>` : ''}</span>`).join('')}</div>` : `<p class="hint">${p.from ? `Found in ${ZONES[p.from]?.name || 'the wild'}.` : 'Your first friend on the farm.'}</p>`;
      box.innerHTML = `<div class="panel tripp"><h2>${esc(p.name)}</h2>
        <div class="leafpage">${face(p, s.name)}<div><p>${elTag(s.el)}${s.el2 ? elTag(s.el2) : ''} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}${p.sparkle ? ' · ✨ Sparkling' : ''}</p>
          <p class="hint">${p.first && p.first !== ctx.me()?.user ? `First raised by ${esc(p.first)}. ` : ''}${p.rest > 0 ? `Resting for ${wait(p.rest)} before the next egg. ` : ''}${p.open ? 'Friends who visit can pick it for a playdate.' : ''}</p></div></div>
        <div class="starsrow">${STAR_NAME.map((n, i) => `<span>${n} ${stars(p.stars?.[i] || 3)}</span>`).join('')}</div>
        <p><b>${TALENTS[p.talent || 0].name}.</b> ${TALENTS[p.talent || 0].blurb}</p>
        <p>Coat: ${swatch(coatHex(p), p.blend ? 'Blend' : COATS[p.col[0]].name)}${p.col.length > 1 ? ` hiding ${swatch(p.col[1] ? COATS[p.col[1]].c : coatHex({ sp: p.sp, col: [0] }), COATS[p.col[1]].name)}` : '<span class="hint"> Its hidden colour shows after two eggs.</span>'}</p>
        ${p.pat?.length ? `<p>Markings: ${list(p.pat.map(k => PATTERNS[k].toLowerCase()))}.</p>` : ''}
        ${p.feat ? `<p>Has ${PART[p.feat]} from its ${SPECIES[p.feat].name} family.</p>` : ''}
        ${p.xmove ? `<p>Knows ${MOVES[p.xmove].name} from its other parent${p.lv < XMOVE_LV ? ` (wakes up at level ${XMOVE_LV})` : ''}.</p>` : ''}
        ${tree}
        <div class="row end"><button type="button" class="btn w" data-a="petopen" data-id="${p.id}">${p.open ? 'Stop playdates' : 'Allow playdates'}</button><button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
      return;
    }
    if (panel.kind === 'album') {
      const zoneOf = sp => Object.values(ZONES).find(z => sp in z.wild)?.name;
      const total = Object.keys(SPECIES).length, own = sp => F.album[sp]?.some(Boolean), have = Object.keys(SPECIES).filter(own).length;
      if (panel.sp && F.album[panel.sp]) { // one page of the album: owned, or only seen so far
        const sp = panel.sp, d = SPECIES[sp], a = F.album[sp], seen = !own(sp), k = KIT[sp], mine = F.pets.filter(x => x.sp === sp);
        box.innerHTML = `<div class="panel tripp"><h2>${d.name}</h2>
          <div class="leafpage${seen ? ' seen' : ''}">${thumb('pet:' + sp, d.name)}<div><p>${elTag(d.el)}${d.el2 ? elTag(d.el2) : ''} ${RARITY[d.rare] || ''} · ${ROLE_NAME[k.role] || ''}</p><p class="hint">${d.blurb}</p></div></div>
          ${seen ? `<p><b>Seen, not raised yet.</b> You met one at a neighbour's farm or in a battle. ${zoneOf(sp) ? 'Send a party to its home to find your own.' : d.hint || ''}</p>` : ''}
          <p><b>Lives in</b> ${zoneOf(sp) || 'no wild place: it only hatches from eggs'}. <b>On your farm:</b> ${mine.length ? mine.map(x => `${esc(x.name)} (level ${x.lv})`).join(', ') : 'none right now'}.</p>
          <div class="formrow">${FORMS.map((f, i) => `<span class="chip ${a[i] ? 'got' : 'not'}">${f}${a[i] ? ' ✓' : ''}</span>`).join('')}</div>
          <p><b>Moves</b></p><div class="mvlist">${k.moves.map((m, i) => `<span class="chip">${MOVES[m].name}<small> level ${LEARN[i]}</small></span>`).join('')}</div>
          <div class="row end"><button type="button" class="btn w" data-a="album">All pets</button><button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
        return;
      }
      const cells = Object.entries(SPECIES).map(([sp, d]) => { const a = F.album[sp];
        return own(sp) ? `<button type="button" class="leaf" data-a="leaf" data-sp="${sp}">${thumb('pet:' + sp, d.name)}<b>${d.name}</b>${elTag(d.el)}<span class="forms" title="Baby, young, adult">${a.map((x, i) => `<i class="${x ? 'on' : ''}" title="${FORMS[i]}"></i>`).join('')}</span></button>`
          : a ? `<button type="button" class="leaf seen" data-a="leaf" data-sp="${sp}">${thumb('pet:' + sp, d.name)}<b>${d.name}</b><small>Seen, not raised yet</small></button>`
          : `<div class="leaf no"><span class="nothumb">?</span><b>Not found yet</b><small>${zoneOf(sp) || d.hint || ''}</small></div>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Pet Album</h2><p>${have} of ${total} species found${Object.keys(F.album).length > have ? ` and ${Object.keys(F.album).length - have} more seen` : ''}. Tap a pet to read its page. The three dots are the baby, young and adult forms you have raised. Your farm has room for ${F.room} pets and ${F.pets.length} live there now. Coats found: ${F.coats.length} of ${COATS.length}. Markings found: ${F.marks.length} of ${Object.keys(PATTERNS).length}.</p>
        <div class="album">${cells}</div>
        <div class="row end"><button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
      return;
    }
    if (panel.kind === 'ranks') {
      const rows = (ranks || []).map((r, i) => `<div class="rk${r.me ? ' you' : ''}"><span class="rkn${i < 3 ? ' top' + (i + 1) : ''}">${i + 1}</span><div><b>${esc(r.name)}${r.me ? ' (you)' : ''}</b><small>Best pet level ${r.top} · ${r.pets} ${r.pets === 1 ? 'pet' : 'pets'}</small></div>
        <span class="faces">${r.team.map(t => thumb('pet:' + t.sp, SPECIES[t.sp]?.name)).join('')}</span><span class="rkp"><b>${r.pts}</b><small>points</small></span></div>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Ranking</h2><p>Every player's ladder points, highest first. ${countOf(F, 'flag') ? 'Win Arena matches to climb: 10 points for a win, 2 for a loss.' : 'Build an Arena Flag to fight for ladder points.'}</p>
        <div class="rks">${ranks ? rows : '<p class="hint">Counting points…</p>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Close</button>${countOf(F, 'flag') ? '<button type="button" class="btn m" data-a="arena">Find a match</button>' : ''}</div></div>`;
      return;
    }
    if (panel.kind === 'foes') {
      const rows = (foes || []).map(f => `<button type="button" class="foe" data-a="foe" data-id="${esc(f.id)}"><b>${esc(f.name)}</b><small>${f.npc ? 'Neighbour' : 'Player'} · ${f.pts} points</small>
        <span class="faces">${f.team.map(t => thumb('pet:' + t.sp, SPECIES[t.sp]?.name)).join('')}</span></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Arena</h2><p>You have ${F.pts} ladder points. Rewarded matches left today: ${F.fights.arena}.</p>
        <div class="foes">${foes ? rows : '<p class="hint">Looking for opponents…</p>'}</div>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button><button type="button" class="btn w" data-a="defteam">Choose defence team</button></div></div>`;
      return;
    }
    if (panel.kind === 'invite') {
      box.innerHTML = `<div class="panel tripp"><h2>${esc(panel.from)} invites you to a live battle</h2>
        <p>You both pick moves at the same time, with ${TURN_S} seconds for each turn. Everyone fights at level 20, and both of you earn coins and experience.</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="duelno">Not now</button>
          <button type="button" class="btn big m" data-a="duelpick">Pick my team</button></div></div>`;
      return;
    }
    if (panel.kind === 'prize') {
      const z = panel.prize, who = F.pets.filter(p => panel.ids.includes(p.id));
      const rows = z.counted ? who.map(p => { const g = z.grew.find(x => x.id === p.id);
        return `<div class="backpet">${thumb('pet:' + p.sp)}<div><b>${esc(p.name)}</b><small>+${z.xp} experience${g ? ` · <em>${g.form ? `grew up into its ${FORMS[g.form].toLowerCase()} form` : `reached level ${g.lv}`}</em>` : ''}</small></div></div>`; }).join('') : '';
      box.innerHTML = `<div class="panel tripp back"><h2>${z.won ? 'You won!' : panel.quit ? 'You left the ring' : 'You lost this one'}</h2>
        ${z.counted ? `<div class="mats">${z.coins ? mat('coins', '+' + z.coins) : ''}${z.rank ? `<span class="mat">+${z.rank} rank experience</span>` : ''}${z.pts ? `<span class="mat">+${z.pts} ladder points</span>` : ''}</div>${rows}${z.joined && F.pets.find(p => p.id === z.joined) ? `<div class="backpet found">${thumb('pet:' + F.pets.find(p => p.id === z.joined).sp)}<div><b>The wild ${SPECIES[F.pets.find(p => p.id === z.joined).sp].name} came home with you!</b><small>It has moved in on your farm.</small></div></div>` : ''}${z.noroom ? '<p class="hint">It wanted to come along, but every bed is taken. Build a Pet Hut to make room.</p>' : ''}` : `<p class="hint">${panel.quit ? 'Giving up earns nothing.' : 'No rewards left for today, so that one was just for fun.'}</p>`}
        <button type="button" class="btn big m" data-a="shut">Back to the farm</button></div>`;
      return;
    }
    if (panel.kind === 'send') {
      const z = ZONES[panel.zone], party = F.pets.filter(p => panel.pets.includes(p.id));
      const zones = Object.entries(ZONES).map(([k, zn]) => {
        const locked = F.house < zn.house;
        return `<button type="button" class="zone${locked ? ' off' : ''}" data-a="zone" data-zone="${k}" aria-pressed="${panel.zone === k}">
          <b>${zn.name}</b>${elTag(zn.el)}<small>${locked ? `Opens at farmhouse level ${zn.house}` : list(Object.keys(zn.gives).filter(m => m !== 'coins').map(m => MATS[m].toLowerCase()))}</small></button>`;
      }).join('');
      const trips = Object.entries(TRIPS).map(([k, tr]) => `<button type="button" data-a="trip" data-trip="${k}" aria-pressed="${panel.trip === k}">${tr.name}<small>${span(tr.min)}</small></button>`).join('');
      const gone = outAll(), pets = F.pets.map(p => `<button type="button" class="pickpet${gone.includes(p.id) ? ' off' : ''}" data-a="party" data-id="${p.id}" aria-pressed="${panel.pets.includes(p.id)}">
        ${petRow(p, gone.includes(p.id) ? ' · with another party' : SPECIES[p.sp].el === z.el ? ' · +25% here' : '')}</button>`).join('');
      const est = party.length ? Object.entries(tripLoot(panel.zone, panel.trip, party)).map(([k, n]) => [k, Math.round(n)]).filter(([, n]) => n > 0).map(([k, n]) => mat(k, '~' + n)).join('') : '';
      const full = F.pets.length >= F.room;
      box.innerHTML = `<div class="panel tripp"><h2>Send pets exploring</h2>
        <div class="zones">${zones}</div>
        <div class="pills trips">${trips}</div>
        <p>Who goes? Pick up to ${PARTY}.</p>
        <div class="party">${pets}</div>
        <div class="est">${party.length ? `<span class="hint">Should bring back</span><div class="mats">${est}</div>` : '<span class="hint">Tap a pet to add it to the party.</span>'}</div>
        <p class="hint">${full ? 'Every bed is taken, so no wild pet can move in. Build a Pet Hut to make room.' : `Chance a wild pet follows them home: ${Math.round((F.first ? 1 : TRIPS[panel.trip].find) * 100)}%.`}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button>
          <button type="button" class="btn big m" data-a="send" ${party.length ? '' : 'disabled'}>Send ${party.length ? list(party.map(p => esc(p.name))) : 'them'}</button></div></div>`;
    } else {
      const b = panel.back, z = ZONES[b.zone], found = b.found && F.pets.find(p => p.id === b.found);
      const who = F.pets.filter(p => b.pets.includes(p.id));
      const rows = who.map(p => { const g = b.grew.find(x => x.id === p.id);
        return `<div class="backpet">${thumb('pet:' + p.sp)}<div><b>${esc(p.name)}</b><small>+${b.xp} experience${g ? ` · <em>${g.form ? `grew up into its ${FORMS[g.form].toLowerCase()} form` : `reached level ${g.lv}`}</em>` : ''}</small></div></div>`; }).join('');
      box.innerHTML = `<div class="panel tripp back"><h2>Back from ${z.name}</h2>
        <div class="mats">${Object.entries(b.loot).map(([k, n]) => mat(k, '+' + n)).join('') || '<span class="hint">They came back empty-handed this time.</span>'}</div>
        ${rows}
        ${found ? `<div class="backpet found">${thumb('pet:' + found.sp)}<div><b>A wild ${SPECIES[found.sp].name} followed them home!</b><small>${elTag(SPECIES[found.sp].el)} ${RARITY[SPECIES[found.sp].rare]} · ${SPECIES[found.sp].blurb}</small></div></div>` : ''}
        ${b.wild && F.wild ? `<div class="backpet found">${thumb('pet:' + b.wild.sp)}<div><b>A wild ${SPECIES[b.wild.sp].name} stood in their way!</b><small>Level ${b.wild.lv}. Win a short battle and it may come home with you. Losing costs nothing. It waits for half an hour.</small></div><button type="button" class="btn sm m" data-a="wildfight">Battle it</button></div>` : ''}
        ${b.spilt ? `<p class="hint">Your storage is full (${F.cap} of each), so some of it was left behind. ${countOf(F, 'barn') ? 'Spend or sell some to make room.' : 'A Storage Barn makes room for more.'}</p>` : ''}
        ${b.full ? '<p class="hint">A wild pet wanted to come along, but every bed is taken. Build a Pet Hut to make room.</p>' : ''}
        <button type="button" class="btn big m" data-a="shut">Lovely</button></div>`;
    }
  }
  // ---------- battles ----------
  const side = s => shown.sides[s], act = s => side(s).pets[side(s).on];
  const who = s => !s ? esc(act(0).name) : B.mode === 'arena' || B.live ? `${esc(B.foe)}'s ${esc(act(1).name)}` : `The other side's ${esc(act(1).name)}`;
  function plate(s) {
    const u = act(s), pct = Math.round(u.hp / u.max * 100);
    const tags = [...Object.keys(u.status).map(k => `<span class="st bad" title="${STATUS[k].blurb}">${STATUS[k].name}</span>`),
      ...Object.entries(u.up).filter(([, n]) => n).map(([k, n]) => `<span class="st ${n > 0 ? 'good' : 'bad'}">${STAT_NAME[k]} ${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`)].join('');
    return `<div class="bplate ${s ? 'p1' : 'p0'}"><div class="bwho"><b>${esc(u.name)}</b>${elTag(u.el)}<small>Level ${u.lv}</small></div>
      <div class="bhp${pct < 25 ? ' low' : pct < 55 ? ' mid' : ''}"><i style="width:${pct}%"></i><span>${u.hp} / ${u.max}</span></div>
      <div class="btags">${tags}<span class="dots">${side(s).pets.map(x => `<i class="${x.hp > 0 ? '' : 'out'}"></i>`).join('')}</span></div></div>`;
  }
  function paintBattle() {
    const el = $('pf-bt');
    el.hidden = !B || mode !== 'farm';
    if (el.hidden) { el.innerHTML = ''; return; }
    for (const s of [0, 1]) scene?.ringState(s, act(s).hp > 0 ? Object.keys(act(s).status) : []);
    const me = side(0), u = act(0), busy = playing || B.over !== null || (B.live && B.waiting);
    const clock = B.live && B.over === null && !playing ? `<span class="bclock" id="pf-clock">${Math.max(0, Math.ceil((liveAt - Date.now()) / 1000))}</span>` : '';
    const moves = u.moves.map(id => { const m = MOVES[id], cd = u.cd[id] || 0;
      const what = m.pow ? `Power ${m.pow}` : m.heal ? 'Heals' : m.up ? `Raises ${STAT_NAME[m.up]}` : `Lowers their ${STAT_NAME[m.down]}`;
      return `<button type="button" class="mv" data-a="move" data-move="${id}" style="--c:${ELEMENTS[m.el]}" ${busy || cd || B.need ? 'disabled' : ''}><b>${m.name}</b><small>${cd ? `Ready in ${cd}` : what + (m.status ? ` · ${STATUS[m.status].name}` : '')}</small></button>`; }).join('');
    const bench = me.pets.map((x, i) => i === me.on ? '' : `<button type="button" class="sw" data-a="swap" data-i="${i}" ${busy || x.hp <= 0 || (u.status.rooted && !B.need) ? 'disabled' : ''}>${thumb('pet:' + x.sp)}<span><b>${esc(x.name)}</b><small>${x.hp > 0 ? `${x.hp} / ${x.max}` : 'Fainted'}</small></span></button>`).join('');
    const logBox = logOpen ? `<div class="blogbox" id="pf-blog" aria-live="off"><h3>Battle log <button type="button" class="blx" data-a="blog" aria-label="Hide the battle log">×</button></h3><div class="bll">${blogs.map(l => l.turn ? `<p class="blt">Turn ${l.turn}</p>` : `<p class="${l.c}">${l.h}</p>`).join('') || '<p class="bln">Everything that happens in this fight is written down here.</p>'}</div></div>` : '';
    el.innerHTML = `${plate(1)}${plate(0)}${logBox}
      <div class="bbar"><p class="blog">${line || (B.live && B.waiting ? `Waiting for ${esc(B.foe)} to choose…` : B.need ? 'Who comes in next?' : `What should ${esc(u.name)} do?`)}${clock}</p>
        <div class="mvs">${moves}</div>
        <div class="bench">${bench}${!B.live && F.inv.juice ? `<button type="button" class="btn sm m" data-a="juice" ${busy || B.need || B.juiced || u.hp >= u.max ? 'disabled' : ''}>Berry Juice (${F.inv.juice})</button>` : ''}<button type="button" class="btn sm w" data-a="blog" aria-pressed="${logOpen}">${logOpen ? 'Hide battle log' : 'Battle log'}</button><button type="button" class="btn sm ghost-ink" data-a="giveup" ${busy ? 'disabled' : ''}>Give up</button></div></div>`;
    const bl = el.querySelector('.bll'); if (bl) bl.scrollTop = bl.scrollHeight;
  }
  // A word or number that floats up from a pet in the ring.
  function floatUp(s, text, cls = '', dy = 0) {
    const at = scene?.ringSpot?.(s), box = $('pf-fl'); if (!at || !box) return;
    const n = document.createElement('span'); n.className = 'bfn ' + cls; n.textContent = text; n.style.left = at.x + 'px'; n.style.top = at.y + dy + 'px';
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
      if (e.k === 'switch') { side(e.s).on = e.i; const n = act(e.s); n.up = { atk: 0, def: 0, spd: 0 }; scene?.ringPet(e.s, n); line = e.s ? (B.live ? `${esc(B.foe)} sends in ${esc(n.name)}.` : `${esc(n.name)} steps in for the other side.`) : `Go, ${esc(n.name)}!`; sfx.pop(); }
      else if (e.k === 'move') { const m = MOVES[e.move]; lastEl = m.el; line = `${who(e.s)} uses <b style="color:${ELEMENTS[m.el]}">${m.name}</b>.`; floatUp(e.s, m.name, 'call el' + m.el, -34); ms = (scene?.ringMove(e.s, e.move) ?? 500) + 40; sfx.click(); }
      else if (e.k === 'hit') { u.hp = e.hp; line = `${who(e.s)} takes <b>${e.dmg}</b>.${e.eff > 1 ? ' It hit hard!' : e.eff < 1 ? ' It barely tickled.' : ''}`; scene?.ringHit(e.s, 'hit', lastEl, e.eff); floatUp(e.s, '−' + e.dmg, 'dmg' + (e.eff > 1 ? ' big' : e.eff < 1 ? ' weak' : '')); if (e.eff !== 1) floatUp(e.s, e.eff > 1 ? 'Hit hard!' : 'Barely tickled', e.eff > 1 ? 'say hard' : 'say', 30); sfx.place(); ms = 850; }
      else if (e.k === 'burn') { u.hp = e.hp; line = `${who(e.s)} is stung by its burn and takes <b>${e.dmg}</b>.`; scene?.ringHit(e.s, 'burn'); floatUp(e.s, '−' + e.dmg, 'dmg burn'); sfx.place(); }
      else if (e.k === 'juice') { u.hp = e.hp; F.inv.juice = Math.max(0, (F.inv.juice || 0) - 1); line = `${who(e.s)} drinks a Berry Juice and gets <b>${e.n}</b> health back.`; scene?.ringFx(e.s, 'hop'); scene?.ringHit(e.s, 'heal'); floatUp(e.s, '+' + e.n, 'heal'); sfx.join(); }
      else if (e.k === 'heal') { u.hp = e.hp; line = `${who(e.s)} gets <b>${e.n}</b> health back.`; scene?.ringHit(e.s, 'heal'); floatUp(e.s, '+' + e.n, 'heal'); sfx.join(); }
      else if (e.k === 'stat') { if (e.d) u.up[e.stat] += e.d; line = e.d ? `${who(e.s)}'s ${STAT_NAME[e.stat]} goes ${e.d > 0 ? 'up' : 'down'}.` : 'Nothing changes.'; scene?.ringHit(e.s, 'stat', e.d); if (e.d) floatUp(e.s, `${STAT_NAME[e.stat]} ${e.d > 0 ? '▲' : '▼'}`, e.d > 0 ? 'say up' : 'say down'); }
      else if (e.k === 'status') { u.status[e.st] = 1; line = `${who(e.s)} is ${STATUS[e.st].name.toLowerCase()}. ${STATUS[e.st].blurb}`; scene?.ringHit(e.s, 'status', e.st); floatUp(e.s, STATUS[e.st].name + '!', 'say down', 30); ms = 1100; }
      else if (e.k === 'clear') { delete u.status[e.st]; line = `${who(e.s)} is no longer ${STATUS[e.st].name.toLowerCase()}.`; ms = 600; }
      else if (e.k === 'dazed') { line = `${who(e.s)} is dazed and loses its turn.`; scene?.ringHit(e.s, 'dazed'); floatUp(e.s, 'Dazed!', 'say down'); }
      else if (e.k === 'faint') { line = `${who(e.s)} fainted.`; scene?.ringFx(e.s, 'faint'); sfx.lose(); ms = 1100; }
      else if (e.k === 'end') { line = e.quit ? '' : e.win ? (B.live ? `${esc(B.foe)} wins this time.` : 'The other side wins this time.') : 'You win!'; if (!e.quit) (e.win ? sfx.lose : sfx.win)(); ms = e.quit ? 0 : 1300; }
      note(e.k === 'end' ? undefined : e.s, e.k === 'faint' || e.k === 'end' ? 'key' : ''); paintBattle(); await beat(ms);
    }
    if (destroyed) return;
    playing = false; line = '';
    if (after) after(); else { shown = structuredClone(final); B = final; for (const s of [0, 1]) scene?.ringPet(s, act(s)); paintBattle(); }
  }
  function openTeam(mode, foe) {
    if (mode !== 'defend' && mode !== 'live' && !countOf(F, mode === 'arena' ? 'flag' : 'yard')) return;
    const keep = (mode === 'defend' ? F.def : lastTeam).filter(id => F.pets.some(p => p.id === id) && (mode === 'defend' || !outAll().includes(id)));
    panel = { kind: 'team', mode, foe: foe?.id, foeName: foe?.name, invite: foe?.invite, pets: keep }; card = null; sync();
  }
  function openSend() {
    if (!countOf(F, 'gate')) return ctx.toast('Build an Expedition Gate first.', true);
    if (F.trips.length >= F.partyMax) return;
    const zone = panel?.zone || lastTrip.zone, ok = ZONES[zone] && F.house >= ZONES[zone].house;
    panel = { kind: 'send', zone: ok ? zone : 'woods', trip: lastTrip.trip, pets: lastTrip.pets.filter(id => F.pets.some(p => p.id === id) && !outAll().includes(id)) };
    card = null; sync();
  }
  function paintGate() {
    const el = $('pf-gate');
    el.hidden = mode === 'farm';
    if (mode === 'load') el.innerHTML = '<div class="panel"><h2>Opening the gate…</h2></div>';
    else if (mode === 'account') el.innerHTML = `<div class="panel">
      <h2>Your farm needs an account</h2>
      <p>Pet Farm keeps going between visits, so it is saved to an account. It takes a username and a password, nothing else.</p>
      <div class="row"><button type="button" class="btn big m" data-a="account" data-mode="register">Create account</button><button type="button" class="btn big w" data-a="account" data-mode="login">Log in</button></div>
      <button type="button" class="btn ghost-ink" data-a="home">Back to the hub</button></div>`;
    else if (mode === 'starter') el.innerHTML = `<div class="panel starter">
      <h2>Pick your first pet</h2>
      <p>You can find the other two later.</p>
      <div class="starters">${STARTERS.map(sp => `<button type="button" class="pickpet" data-a="pick" data-sp="${sp}" aria-pressed="${pick === sp}">
        ${thumb('pet:' + sp)}<b>${SPECIES[sp].name}</b><span class="el" style="--c:${ELEMENTS[SPECIES[sp].el]}">${SPECIES[sp].el}</span><small>${SPECIES[sp].blurb}</small></button>`).join('')}</div>
      <button type="button" class="btn big" data-a="start" ${pick ? '' : 'disabled'}>${pick ? `Start with ${SPECIES[pick].name}` : 'Tap a pet to choose'}</button></div>`;
    el.classList.toggle('low', mode === 'starter');
  }
  function paintBuild() {
    const el = $('pf-build');
    el.hidden = !(mode === 'farm' && edit);
    if (el.hidden) return;
    const g = scene?.ghost();
    const cards = Object.entries(ITEMS).filter(([, it]) => !it.fixed && (tab === 'f' ? it.craft || it.pals : it.kind === tab && !it.craft && !it.pals)).map(([type, it]) => {
      const have = countOf(F, type), full = it.max && have >= it.max, gift = F.stash[type] || 0, poor = !gift && !canAfford(F.inv, it.cost), wsLv = Math.max(0, ...F.items.filter(i => i.type === 'workshop').map(lvOf)), locked = !gift && it.craft && wsLv < it.craft, shy = !gift && it.pals && F.palpts < it.pals;
      return `<button type="button" class="item${full || poor || locked || shy ? ' off' : ''}" data-a="item" data-type="${type}" aria-pressed="${g?.type === type && !g.id}">
        ${thumb(type)}<b>${it.name}</b><span class="cost">${gift ? `<span class="mat">Gift: ${gift} to place</span>` : shy ? `<span class="mat">Friendship ${F.palpts} of ${it.pals}</span>` : locked ? `<span class="mat">${it.craft > 1 ? `Workshop level ${it.craft}` : 'Needs a Workshop'}</span>` : full ? `<span class="mat">Have ${have} of ${it.max}</span>` : costHtml(it.cost, F.inv)}</span></button>`;
    }).join('');
    const land = tab === 'b' && F.next ? `<button type="button" class="item land${canAfford(F.inv, F.next.cost) ? '' : ' off'}" data-a="expand">
        <span class="nothumb grow">${F.next.size}</span><b>More land</b><span class="cost">${costHtml(F.next.cost, F.inv)}</span></button>` : '';
    const keep = el.querySelector('.items')?.scrollLeft || 0;
    el.innerHTML = `<div class="bhead"><div class="pills">
        <button type="button" data-a="tab" data-tab="b" aria-pressed="${tab === 'b'}">Buildings</button>
        <button type="button" data-a="tab" data-tab="d" aria-pressed="${tab === 'd'}">Decorations</button>
        <button type="button" data-a="tab" data-tab="f" aria-pressed="${tab === 'f'}">Fancy</button></div>
      <span class="hint">Tap something on the farm to move it.</span>
      <button type="button" class="btn m" data-a="done">Done</button></div>
      <div class="items">${cards}${land}</div>`;
    el.querySelector('.items').scrollLeft = keep;
  }
  function paintGhost(g) {
    const el = $('pf-ghost');
    el.hidden = !g;
    if (!g) { paintBuild(); return; }
    const it = ITEMS[g.type];
    el.innerHTML = `<b>${it.name}</b><span class="hint">${g.ok ? 'Drag it, or tap a tile.' : 'It does not fit there.'}</span>
      <button type="button" class="btn sm w" data-a="rot" aria-label="Turn">${I.turn}Turn</button>
      ${g.id && !it.fixed ? `<button type="button" class="btn sm p" data-a="away">Sell (${costText(it.cost)} back)</button>` : ''}
      <button type="button" class="btn sm ghost" data-a="cancel">Cancel</button>
      <button type="button" class="btn sm m" data-a="ok" ${g.ok ? '' : 'disabled'}>${g.id ? 'Move here' : 'Place'}</button>`;
    el.classList.toggle('bad', !g.ok);
  }
  function paintCard() {
    const el = $('pf-card');
    if (!card || mode !== 'farm' || edit || B) { el.hidden = true; return; }
    el.hidden = false;
    if (where === 'visit') {
      const p = V?.pets.find(x => x.id === card.pet), s = p && SPECIES[p.sp]; if (!s) { card = null; el.hidden = true; return; }
      el.innerHTML = `${face(p, s.name)}<div class="info"><b>${esc(p.name)}</b><p>${elTag(s.el)}${s.el2 ? elTag(s.el2) : ''} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}</p><p class="hint">${s.blurb}</p>
        ${p.open ? (V.dated ? '<p class="hint">You already had a playdate here today.</p>' : '<button type="button" class="btn sm m" data-a="playdate" data-id="' + p.id + '">♥ Playdate</button>') : ''}</div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
      return;
    }
    if (card.pet) {
      const p = F.pets.find(x => x.id === card.pet); if (!p) { card = null; el.hidden = true; return; }
      const s = SPECIES[p.sp];
      el.innerHTML = `${face(p, s.name)}<div class="info">
        <form class="namer"><input class="field" id="pf-name" maxlength="14" value="${esc(p.name)}" aria-label="Pet name" autocomplete="off"><button class="btn sm w">Rename</button></form>
        <p>${elTag(s.el)}${s.el2 ? elTag(s.el2) : ''} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}</p>
        ${p.lv < MAX_LV ? `<div class="xp" title="Experience"><i style="width:${Math.round(p.xp / xpFor(p.lv) * 100)}%"></i><span>${p.xp} of ${xpFor(p.lv)} to level ${p.lv + 1}</span></div>` : ''}
        <p class="hint">${s.blurb}</p>
        <div class="mvlist"><span class="hint">${ROLE_NAME[KIT[p.sp].role]}</span>${movesAt(p.sp, p.lv, p.xmove).map(id => `<span class="el" style="--c:${ELEMENTS[MOVES[id].el]}">${MOVES[id].name}</span>`).join('')}</div>
        ${Object.entries(RECIPES).filter(([k, r]) => F.inv[k] && (r.xp ? p.lv < MAX_LV : r.rest && p.rest > 0)).map(([k, r]) => `<button type="button" class="btn sm m" data-a="feed" data-what="${k}" data-id="${p.id}">Give a ${r.name} (${F.inv[k]} left)</button>`).join('')}
        <button type="button" class="btn sm w" data-a="petpage" data-id="${p.id}">Traits and family</button></div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
    } else {
      const item = F.items.find(x => x.id === card.item), it = item && ITEMS[item.type]; if (!it) { card = null; el.hidden = true; return; }
      let more = '', name = it.name, up = '';
      if (UPGRADES[item.type]) { // buildings that can be improved
        const lv = lvOf(item), cost = upCost(item);
        name += ` · Level ${lv}`;
        up = lv >= UP_MAX ? '' : F.house < lv + 1 ? `<p class="hint">Level ${lv + 1} needs a level ${lv + 1} farmhouse.</p>`
          : `<p class="hint">Level ${lv + 1}: ${whatUp(item).toLowerCase()}.</p><div class="cost">${costHtml(cost, F.inv)}</div><button type="button" class="btn sm m" data-a="upgrade" data-id="${item.id}">Improve to level ${lv + 1}</button>`;
      }
      if (item.type === 'house') {
        name += ` · Level ${F.house}`;
        const opens = list(Object.values(ZONES).filter(z => z.house === F.house + 1).map(z => z.name));
        more = F.houseNext ? `<p class="hint">Level ${F.house + 1} opens ${opens}.</p><div class="cost">${costHtml(F.houseNext, F.inv)}</div>
          <button type="button" class="btn sm m" data-a="houseup">Improve farmhouse</button>` : '<p class="hint">It is as grand as it gets.</p>';
      } else if (item.type === 'gate') {
        more = F.trips.map(t => t.left > 0 ? `<p class="hint">A party is in ${ZONES[t.zone].name}, back in ${wait(t.left)}.</p>` : `<button type="button" class="btn sm m" data-a="collect" data-id="${t.id}">Welcome them back from ${ZONES[t.zone].name}</button>`).join('')
          + (F.trips.length < F.partyMax ? `<button type="button" class="btn sm m" data-a="explore">${F.trips.length ? 'Send another party' : 'Send pets exploring'}</button>` : '') + `<p class="hint">Parties out: ${F.trips.length} of ${F.partyMax}.</p>`;
      } else if (item.type === 'yard') more = `<p class="hint">${F.train.ids.length ? `Training: ${list(F.train.ids.map(id => esc(F.pets.find(p => p.id === id)?.name || '')).filter(Boolean))}.` : `Nobody is training. Pets left here earn ${TRAIN_XP} experience an hour.`}</p><button type="button" class="btn sm m" data-a="practice">Practice battle</button><button type="button" class="btn sm m" data-a="trainopen">Choose who trains</button>`;
      else if (item.type === 'flag') more = `<p class="hint">You have ${F.pts} ladder points.</p><button type="button" class="btn sm m" data-a="arena">Find a match</button>`;
      else if (item.type === 'mailbox') more = `<button type="button" class="btn sm m" data-a="mail">Open mail (${F.mail.length})</button>`;
      else if (item.type === 'nest') more = F.nests.map(n => `<p class="hint">${nestTxt(n)}</p>${n.stage === 'ready' ? `<button type="button" class="btn sm m" data-a="hatch" data-slot="${n.slot}">Hatch the egg</button>` : ''}`).join('')
        + (F.nests.length < F.nestMax ? `<button type="button" class="btn sm m" data-a="nest">${F.nests.length ? 'Choose two more pets' : 'Choose two pets'}</button>` : '');
      else if (item.type === 'garden') more = F.garden.ripe ? `<button type="button" class="btn sm m" data-a="berries">Pick berries (${F.garden.ripe * BERRIES})</button>` : `<p class="hint">Each plot grows ${BERRIES} berries an hour. The next ones are ripe in about ${wait(Math.max(1, gardenAt - Date.now()))}.</p>`;
      else if (item.type === 'kitchen') more = `<p class="hint">You have ${F.inv.berries || 0} berries.</p><button type="button" class="btn sm m" data-a="cookopen">Cook treats</button>`;
      else if (item.type === 'barn') more = `<p class="hint">Your farm can hold ${F.cap} of each material.</p>`;
      else if (item.type === 'workshop') more = '<p class="hint">Its decorations are under Edit farm, Fancy.</p><button type="button" class="btn sm m" data-a="sellopen">Sell spare materials</button>';
      else if (item.type === 'hut') more = `<p class="hint">Your farm has room for ${F.room} pets.</p>`;
      el.innerHTML = `${thumb(item.type, it.name)}<div class="info"><b>${name}</b><p>${it.desc}</p>${more}
        ${up}<button type="button" class="btn sm w" data-a="grab" data-id="${item.id}">Move it</button>
        ${it.fixed ? '' : `<button type="button" class="btn sm p" data-a="sellitem" data-id="${item.id}">Sell (${costText(it.cost)} back)</button>`}</div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
    }
  }

  // ---------- from the 3D scene ----------
  function onPick(p) {
    if (p.starter) { pick = p.starter; sfx.pop(); sync(); return; }
    if (mode !== 'farm') return;
    if (p.zone) { // a place to explore on the map: go home and get a party ready for it
      sfx.click(); const z = ZONES[p.zone];
      if (!countOf(F, 'gate')) return ctx.toast('Build an Expedition Gate on your farm first.', true);
      if (F.house < z.house) return ctx.toast(`${z.name} opens at farmhouse level ${z.house}.`, true);
      if (F.trips.some(t => t.left <= 0)) return ctx.toast('A party is back. Welcome them home on your farm first.', true);
      if (F.trips.length >= F.partyMax) return ctx.toast(F.partyMax > 1 ? 'All your parties are out. Improve the Expedition Gate to send more.' : `Your party is in ${ZONES[F.trip.zone].name}, back in ${wait(F.trip.left)}. A better Expedition Gate can send more parties.`, true);
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
  function goHome() { where = 'home'; V = null; card = null; panel = null; sync(); }
  function setEdit(on) { if (B || where !== 'home') return; edit = on; card = null; panel = null; if (!on) scene?.ghostCancel(); sync(); }
  // The trade offer in plain words, shown under the two sides and kept up to date while amounts change.
  const tradeEmpty = () => !['give', 'want'].some(k => panel[k].pets.length || Object.keys(panel[k].mats).length);
  function tradeSum() {
    const say = (side, pool) => [...side.pets.map(id => esc(pool.find(x => x.id === id)?.name || 'a pet')), ...Object.entries(side.mats).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`)].join(', ') || 'nothing';
    return tradeEmpty() ? 'Nothing is in the offer yet.' : `<b>You give:</b> ${say(panel.give, F.pets)}<br><b>You get:</b> ${say(panel.want, V?.pets || [])}`;
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
    if (a === 'home') ctx.home();
    else if (a === 'account') ctx.account(b.dataset.mode);
    else if (a === 'pick') { pick = b.dataset.sp; sync(); }
    else if (a === 'start') { if (pick) ctx.send({ t: 'starter', sp: pick }); }
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
      if (b.classList.contains('off')) return ctx.toast('That pet cannot be traded right now.', true);
      const list = panel[b.dataset.side].pets, i = list.indexOf(b.dataset.id);
      if (i >= 0) list.splice(i, 1); else if (list.length < 3) list.push(b.dataset.id); else return ctx.toast('Three pets a side at most.', true);
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
    else if (a === 'gift') { if (b.classList.contains('off')) return ctx.toast('You do not have enough of that to give.', true); ctx.send(b.dataset.item ? { t: 'gift', id: V.id, item: b.dataset.item } : { t: 'gift', id: V.id, mat: b.dataset.mat }); }
    else if (a === 'duel') openTeam('arena', V);
    else if (a === 'livego') openTeam('live', V);
    else if (a === 'duelno') { ctx.send({ t: 'duelno', id: panel.id }); panel = null; sync(); }
    else if (a === 'duelpick') openTeam('live', { name: panel.from, invite: panel.id });
    else if (a === 'berries') ctx.send({ t: 'pick' });
    else if (a === 'matinfo') { if (edit || B) return; panel = { kind: 'mat', mat: b.dataset.mat }; card = null; sfx.click(); sync(); }
    else if (a === 'cookopen') { panel = { kind: 'cook' }; card = null; sync(); }
    else if (a === 'sellopen') { panel = { kind: 'sell' }; card = null; sync(); }
    else if (a === 'cook') { if (b.dataset.lv) return ctx.toast(`Improve the Kitchen to level ${b.dataset.lv} for that recipe.`, true); if (b.classList.contains('off')) return ctx.toast('Not enough for that yet. Garden Plots grow more every hour, and better plots grow Sunberries.', true); ctx.send({ t: 'cook', what: b.dataset.what }); }
    else if (a === 'sell') { if (b.classList.contains('off')) return ctx.toast(`You need at least ${SELL_LOT} to sell.`, true); ctx.send({ t: 'sell', mat: b.dataset.mat, lots: 1 }); }
    else if (a === 'feed') ctx.send({ t: 'feed', what: b.dataset.what, pet: b.dataset.id });
    else if (a === 'mail') { panel = { kind: 'mail' }; card = null; sync(); }
    else if (a === 'album') { panel = { kind: 'album' }; card = null; sync(); }
    else if (a === 'nest') { if (F.nests.length >= F.nestMax) return; panel = { kind: 'nest', pick: [] }; card = null; sync(); }
    else if (a === 'playdate') {
      const pet = V?.pets.find(x => x.id === b.dataset.id); if (!pet) return;
      if (!F.items.some(i => i.type === 'nest')) return ctx.toast('Build a Nest on your own farm first.', true);
      if (F.nests.length >= F.nestMax) return ctx.toast('Your Nest is busy right now.', true);
      if (pet.lv < BREED_LV) return ctx.toast('That pet is still too young.', true);
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
    else if (a === 'leaf') { panel = { kind: 'album', sp: b.dataset.sp }; sync(); }
    else if (a === 'claim') ctx.send({ t: 'claim', id: b.dataset.id });
    else if (a === 'mailread') ctx.send({ t: 'mailread' });
    else if (a === 'practice') openTeam('practice');
    else if (a === 'ranks') { ranks = null; panel = { kind: 'ranks' }; card = null; sync(); ctx.send({ t: 'ranks' }); }
    else if (a === 'arena') { foes = null; panel = { kind: 'foes' }; card = null; sync(); ctx.send({ t: 'foes' }); }
    else if (a === 'foe') { const f = foes?.find(x => x.id === b.dataset.id); if (f) openTeam('arena', f); }
    else if (a === 'defteam') openTeam('defend');
    else if (a === 'team') {
      if (b.classList.contains('off')) return ctx.toast('That pet is away exploring.', true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(`A team is ${PARTY} pets at most.`, true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'fight' && panel.mode === 'live') { lastTeam = [...panel.pets]; ctx.send(panel.invite ? { t: 'duelyes', id: panel.invite, pets: lastTeam } : { t: 'duel', to: panel.foe, pets: lastTeam }); }
    else if (a === 'wildfight') { panel = null; ctx.send({ t: 'fight', mode: 'wild' }); }
    else if (a === 'fight') { lastTeam = [...panel.pets]; ctx.send({ t: 'fight', mode: panel.mode, foe: panel.foe, pets: lastTeam }); }
    else if (a === 'defend') ctx.send({ t: 'defend', pets: [...panel.pets] });
    else if (a === 'move') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', move: b.dataset.move }); } }
    else if (a === 'swap') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', switch: +b.dataset.i }); } }
    else if (a === 'juice') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', juice: true }); } }
    else if (a === 'blog') { logOpen = !logOpen; try { localStorage.setItem('pf_blog', logOpen ? '1' : '0'); } catch {} paintBattle(); }
    else if (a === 'giveup') { if (!playing) ctx.send({ t: 'bquit' }); }
    else if (a === 'explore') openSend();
    else if (a === 'collect') ctx.send({ t: 'collect', id: b.dataset.id });
    else if (a === 'shut') { const inv = panel?.kind === 'invite' ? panel.id : panel?.invite; if (inv) ctx.send({ t: 'duelno', id: inv }); panel = null; sync(); }
    else if (a === 'zone') { if (b.classList.contains('off')) return ctx.toast(`${ZONES[b.dataset.zone].name} opens at farmhouse level ${ZONES[b.dataset.zone].house}. Tap your farmhouse to improve it.`, true); panel.zone = b.dataset.zone; paintPanel(); }
    else if (a === 'trip') { panel.trip = b.dataset.trip; paintPanel(); }
    else if (a === 'party') {
      if (b.classList.contains('off')) return ctx.toast('That pet is out with another party.', true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(`A party is ${PARTY} pets at most.`, true); else panel.pets.push(id);
      const keep = $('pf-panel').querySelector('.party')?.scrollLeft || 0; paintPanel(); const row = $('pf-panel').querySelector('.party'); if (row) row.scrollLeft = keep;
    }
    else if (a === 'send') { lastTrip = { zone: panel.zone, trip: panel.trip, pets: [...panel.pets] }; ctx.send({ t: 'send', ...lastTrip }); }
    else if (a === 'houseup') { if (!canAfford(F.inv, F.houseNext)) ctx.toast('Not enough materials for that yet.', true); else ctx.send({ t: 'houseup' }); }
    else if (a === 'tab') { tab = b.dataset.tab; paintBuild(); }
    else if (a === 'expand') { if (b.classList.contains('off')) ctx.toast('Not enough materials to grow the land yet.', true); else ctx.send({ t: 'expand' }); }
    else if (a === 'item') {
      scene?.ghostCancel(); panel = { kind: 'buy', type: b.dataset.type }; sfx.click(); paintPanel();
    }
    else if (a === 'buy') { const type = b.dataset.type; panel = null; paintPanel(); scene?.ghostNew(type); }
    else if (a === 'rot') scene?.ghostRotate();
    else if (a === 'cancel') scene?.ghostCancel();
    else if (a === 'ok') confirmGhost();
    else if (a === 'upgrade') { const it = F.items.find(x => x.id === +b.dataset.id); if (it && !canAfford(F.inv, upCost(it))) return ctx.toast('Not enough materials for that yet.', true); ctx.send({ t: 'upgrade', id: +b.dataset.id }); }
    else if (a === 'trainopen') { panel = { kind: 'train', pets: F.train.ids.filter(id => !outAll().includes(id)) }; card = null; sync(); }
    else if (a === 'trainpick') {
      if (b.classList.contains('off')) return ctx.toast(b.dataset.why === 'out' ? 'That pet is out exploring. Welcome it home first.' : 'That pet is fully grown already.', true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= F.train.slots) return ctx.toast(F.train.slots < UP_MAX ? `The yard has ${F.train.slots} training ${F.train.slots > 1 ? 'spots' : 'spot'}. Improve it for more.` : `The yard has ${F.train.slots} training spots.`, true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'trainsave') ctx.send({ t: 'train', pets: [...panel.pets] });
    else if (a === 'compare') { panel = { kind: 'compare' }; card = null; sync(); }
    else if (a === 'sellitem') { card = null; ctx.send({ t: 'remove', id: +b.dataset.id }); }
    else if (a === 'away') { const g = scene?.ghost(); if (g?.id) { ctx.send({ t: 'remove', id: g.id }); scene.ghostCancel(); } }
    else if (a === 'close') { card = null; paintCard(); }
    else if (a === 'grab') { const id = +b.dataset.id; setEdit(true); scene?.ghostItem(id); }
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    const inp = e.target.querySelector('#pf-name'); if (!inp || !card?.pet) return;
    const name = inp.value.trim(); if (name) { ctx.send({ t: 'petname', id: card.pet, name }); inp.blur(); }
  });
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || !scene?.ghost()) return;
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
    if (F.trips.filter(t => t.left > 0).length < was) { sfx.turn(); ctx.toast('Your pets are back from their expedition!'); sync(); } else paintMain();
  }, 5000);
  const liveTimer = setInterval(() => { const c = $('pf-clock'); if (c) c.textContent = Math.max(0, Math.ceil((liveAt - Date.now()) / 1000)); }, 500);
  const gardenTimer = setInterval(() => { if (mode === 'farm' && F && gardenAt && gardenAt - Date.now() <= 0) { gardenAt = 0; ctx.send({ t: 'open' }); } }, 5000);
  const nestTimer = setInterval(() => {
    if (mode !== 'farm' || !F || !F.nests.some(n => n.stage !== 'ready')) return;
    if (F.nests.some(n => n.stage !== 'ready' && n.due - Date.now() <= 0)) ctx.send({ t: 'open' }); else if (!F.trips.some(t => t.left > 0)) { for (const n of F.nests) if (n.due) n.left = Math.max(0, n.due - Date.now()); paintMain(); }
  }, 5000);

  // ---------- from the server ----------
  function msg(m) {
    clearTimeout(quiet);
    if (m.err) { sfx.bad(); ctx.toast(esc(m.err), true); }
    if (m.need) { F = null; B = null; mode = m.need; edit = false; sync(); return; }
    if (m.foes) foes = m.foes;
    if (m.ranks) { ranks = m.ranks; if (panel?.kind === 'ranks') sync(); }
    if (m.world) world = m.world;
    if (m.visit) { V = { ...m.visit, trip: null }; if (where !== 'visit') { where = 'visit'; card = null; panel = null; } if (counter) { panel = { kind: 'trade', ...counter }; counter = null; } }
    if (m.note) ctx.toast(esc(m.note));
    if (m.rank) setTimeout(() => !destroyed && ctx.toast(`A new kind of pet for your album! +${m.rank} rank experience.`), 1800);
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
    if (m.did === 'starter') { sfx.join(); ctx.toast(`${esc(F.pets[0].name)} moved in. Welcome to your farm!`); }
    else if (m.did === 'place' || m.did === 'move') { sfx.set(); if (m.did === 'place' && ITEMS[lastType]?.craft) scene?.work('workshop'); }
    else if (m.did === 'remove') { sfx.pop(); ctx.toast(m.got ? `Sold. You got ${esc(m.got)} back.` : 'Put away.'); }
    else if (m.did === 'expand') { sfx.join(); ctx.toast(`The farm grew to ${F.size} by ${F.size} tiles.`); }
    else if (m.did === 'send') { sfx.turn(); panel = null; ctx.toast(`Off they go to ${ZONES[lastTrip.zone].name}!`); }
    else if (m.did === 'collect') { sfx.win(); card = null; panel = { kind: 'back', back: m.back }; }
    else if (m.did === 'help') { sfx.set(); ctx.toast(`You tidied up for ${esc(V.name)} and earned 3 coins.`); }
    else if (m.did === 'gift') { sfx.join(); panel = null; ctx.toast(`Your gift is in ${esc(V.name)}'s Mailbox.`); }
    else if (m.did === 'claim' && m.item) { sfx.join(); ctx.toast(`${ITEMS[m.item].name} is yours. Find it under Edit farm and place it for free.`); }
    else if (m.did === 'claim') { sfx.join(); ctx.toast('You got ' + Object.entries(m.got).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') + '.'); }
    else if (m.did === 'duel') { sfx.join(); panel = null; ctx.toast(`Invitation sent. The battle starts as soon as ${esc(V?.name || 'they')} says yes.`); }
    else if (m.did === 'pick') { sfx.join(); card = null; ctx.toast(`You picked ${m.got} berries${m.sun ? ` and ${m.sun} ${m.sun > 1 ? 'sunberries' : 'sunberry'}` : ''}.`); }
    else if (m.did === 'cook') { sfx.set(); scene?.work('kitchen'); ctx.toast(`One ${RECIPES[m.what].name} is ready.`); }
    else if (m.did === 'sell') { sfx.join(); scene?.work('workshop'); ctx.toast(`Sold for ${m.coins} coins.`); }
    else if (m.did === 'feed') { sfx.win(); const p = F.pets.find(x => x.id === m.pet); scene?.cheer(m.pet); ctx.toast(m.what === 'tonic' ? `${esc(p.name)} feels fresh and rested.` : `${esc(p.name)} loved it.${m.grew ? (m.grew.form ? ` It grew up into its ${FORMS[m.grew.form].toLowerCase()} form!` : ` It reached level ${m.grew.lv}!`) : ''}`); }
    else if (m.did === 'upgrade') { sfx.win(); scene?.pop(m.id); const it = F.items.find(x => x.id === m.id); ctx.toast(`${ITEMS[it.type].name} is now level ${lvOf(it)}.`); }
    else if (m.did === 'train') { sfx.set(); panel = null; ctx.toast(F.train.ids.length ? 'Training plan saved.' : 'Nobody is training now.'); }
    else if (m.did === 'defend') { panel = null; ctx.toast('Defence team saved.'); }
    else if (m.did === 'houseup') { sfx.win(); ctx.toast(`The farmhouse is now level ${F.house}.`); }
    else if (m.did === 'petname') ctx.toast('Renamed.');
    else if (m.did === 'offer') { sfx.join(); panel = null; ctx.toast(`Your offer is on its way to ${esc(V?.name || 'them')}.`); }
    else if (m.did === 'tradeyes') { sfx.win(); ctx.toast('Trade done! Your new things are on the farm.'); }
    else if (m.did === 'tradeno' && !counter) ctx.toast('Offer declined. Everything went back.');
    else if (m.did === 'tradecancel') ctx.toast('You took the offer back.');
    else if (m.did === 'pair') { sfx.join(); panel = null; if (where === 'visit') goHome(); ctx.toast(`They are cuddling in the Nest. An egg appears in ${CUDDLE_H} hours.`); }
    else if (m.did === 'hatch') { sfx.win(); card = null; panel = { kind: 'born', id: m.born }; }
    if (first) { pick = null; edit = false; }
    if (heldInvite && !B) { panel = { kind: 'invite', ...heldInvite }; heldInvite = null; card = null; }
    sync();
    if (m.did === 'collect') for (const id of m.back.pets.concat(m.back.found || [])) scene?.cheer(id);
    // keep building: after placing one fence, hold the next one ready beside it
    if (m.did === 'place' && edit && lastType && scene) {
      const it = ITEMS[lastType];
      if (canAfford(F.inv, it.cost) && !(it.max && countOf(F, lastType) >= it.max)) scene.ghostNew(lastType, lastSpot, lastSpot[2]);
    }
    lastType = null;
  }

  return {
    msg,
    // the account changed (signed in, out, or registered): ask again
    me() { const u = ctx.me()?.user || null; if (u !== user) { user = u; mode = 'load'; F = null; edit = false; sync(); ctx.send({ t: 'open' }); } },
    reopen() { ctx.send({ t: 'open' }); },
    // walk straight to a friend's farm (from the site's friends list)
    visit(id) { if (B) return ctx.toast('Finish the battle first.', true); edit = false; scene?.ghostCancel(); ctx.send({ t: 'visit', id }); },
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearInterval(nestTimer); clearInterval(gardenTimer); clearInterval(liveTimer); clearTimeout(quiet); scene?.dispose(); },
  };
}
