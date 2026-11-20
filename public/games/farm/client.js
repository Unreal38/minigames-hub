// Pet Farm view: the HUD over the 3D farm. Shows what the server says and sends what the player wants to do.
// Unlike the table games this one has no room: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode) }
import { sfx } from '../../sfx.js';
import { ITEMS, MATS, SPECIES, STARTERS, ELEMENTS, FORMS, RARITY, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, formOf, xpFor, tripLoot, canAfford, countOf } from './data.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  turn: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
};
// Small material badges: a coloured block with the amount beside it.
const MAT_COL = { wood: '#b07a4f', stone: '#a9a6b0', fiber: '#86cc5a', shells: '#ffb6c9', coal: '#4a4550', crystal: '#8fe3f5', coins: '#ffc94d' };
const BASIC = ['wood', 'stone', 'fiber', 'coins'];
const mat = (k, n, cls = '') => `<span class="mat ${cls}" title="${MATS[k]}"><i style="background:${MAT_COL[k]}"></i>${n}<small>${MATS[k].toLowerCase()}</small></span>`;
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
      <div class="dock"><div class="ghostbar" id="pf-ghost" hidden></div><div class="build" id="pf-build" hidden></div></div>
    </div>
    <div class="gate" id="pf-panel" hidden></div>
    <div class="gate" id="pf-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.pf'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  let F = null, scene = null, destroyed = false, mode = 'load', edit = false, tab = 'b', pick = null, card = null, panel = null, tripAt = 0, lastType = null, lastSpot = null;
  let user = ctx.me()?.user || null, lastTrip = { zone: 'woods', trip: 'stroll', pets: [] };

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onPick, onGhost: paintGhost });
    thumbs ||= scene.thumbs([...Object.keys(ITEMS), ...Object.keys(SPECIES).map(s => 'pet:' + s)]);
    sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const thumb = (k, alt = '') => thumbs?.[k] ? `<img src="${thumbs[k]}" alt="${esc(alt)}" width="56" height="56">` : '<span class="nothumb"></span>';

  // ---------- painting ----------
  function sync() {
    if (F?.trip) F.trip.left = Math.max(0, tripAt - Date.now());
    paintGate(); paintTop(); paintMain(); paintBuild(); paintCard(); paintPanel();
    if (!scene) return;
    if (mode === 'starter') { scene.setFarm(null); scene.setStarters(pick || ''); }
    else { scene.setStarters(null); scene.setFarm(mode === 'farm' ? F : null); scene.setEdit(edit); }
  }
  function paintTop() {
    $('pf-title').textContent = F ? `${F.owner}'s farm` : 'Pet Farm';
    $('pf-mats').innerHTML = F && mode === 'farm' ? Object.keys(MATS).filter(k => BASIC.includes(k) || F.inv[k]).map(k => mat(k, F.inv[k] || 0)).join('') : '';
  }
  function paintMain() {
    const el = $('pf-main');
    if (mode !== 'farm' || edit) { el.innerHTML = ''; return; }
    const t = F.trip, z = t && ZONES[t.zone];
    const trip = !countOf(F, 'gate') ? '<span class="chip">Build an Expedition Gate to send pets exploring</span>'
      : !t ? '<button type="button" class="btn m" data-a="explore">Send pets exploring</button>'
      : t.left > 0 ? `<span class="chip" id="pf-trip">Back from ${z.name} in ${wait(t.left)}</span>`
      : '<button type="button" class="btn big m" data-a="collect">Welcome them back</button>';
    el.innerHTML = `<button type="button" class="btn big" data-a="edit">Edit farm</button>${trip}<span class="chip">Pets ${F.pets.length} of ${F.room}</span>`;
  }
  // ---------- expeditions ----------
  const petRow = (p, extra = '') => `${thumb('pet:' + p.sp)}<b>${esc(p.name)}</b><small>Level ${p.lv}${extra}</small>`;
  function paintPanel() {
    const box = $('pf-panel');
    if (!panel || mode !== 'farm' || edit) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (panel.kind === 'send') {
      const z = ZONES[panel.zone], party = F.pets.filter(p => panel.pets.includes(p.id));
      const zones = Object.entries(ZONES).map(([k, zn]) => {
        const locked = F.house < zn.house;
        return `<button type="button" class="zone${locked ? ' off' : ''}" data-a="zone" data-zone="${k}" aria-pressed="${panel.zone === k}">
          <b>${zn.name}</b>${elTag(zn.el)}<small>${locked ? `Opens at farmhouse level ${zn.house}` : list(Object.keys(zn.gives).filter(m => m !== 'coins').map(m => MATS[m].toLowerCase()))}</small></button>`;
      }).join('');
      const trips = Object.entries(TRIPS).map(([k, tr]) => `<button type="button" data-a="trip" data-trip="${k}" aria-pressed="${panel.trip === k}">${tr.name}<small>${span(tr.min)}</small></button>`).join('');
      const pets = F.pets.map(p => `<button type="button" class="pickpet" data-a="party" data-id="${p.id}" aria-pressed="${panel.pets.includes(p.id)}">
        ${petRow(p, SPECIES[p.sp].el === z.el ? ' · +25% here' : '')}</button>`).join('');
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
        ${b.full ? '<p class="hint">A wild pet wanted to come along, but every bed is taken. Build a Pet Hut to make room.</p>' : ''}
        <button type="button" class="btn big m" data-a="shut">Lovely</button></div>`;
    }
  }
  function openSend() {
    if (!countOf(F, 'gate')) return ctx.toast('Build an Expedition Gate first.', true);
    if (F.trip) return;
    const zone = panel?.zone || lastTrip.zone, ok = ZONES[zone] && F.house >= ZONES[zone].house;
    panel = { kind: 'send', zone: ok ? zone : 'woods', trip: lastTrip.trip, pets: lastTrip.pets.filter(id => F.pets.some(p => p.id === id)) };
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
    const cards = Object.entries(ITEMS).filter(([, it]) => it.kind === tab && !it.fixed).map(([type, it]) => {
      const have = countOf(F, type), full = it.max && have >= it.max, poor = !canAfford(F.inv, it.cost);
      return `<button type="button" class="item${full || poor ? ' off' : ''}" data-a="item" data-type="${type}" aria-pressed="${g?.type === type && !g.id}">
        ${thumb(type)}<b>${it.name}</b><span class="cost">${full ? `<span class="mat">Have ${have} of ${it.max}</span>` : costHtml(it.cost, F.inv)}</span></button>`;
    }).join('');
    const land = tab === 'b' && F.next ? `<button type="button" class="item land${canAfford(F.inv, F.next.cost) ? '' : ' off'}" data-a="expand">
        <span class="nothumb grow">${F.next.size}</span><b>More land</b><span class="cost">${costHtml(F.next.cost, F.inv)}</span></button>` : '';
    const keep = el.querySelector('.items')?.scrollLeft || 0;
    el.innerHTML = `<div class="bhead"><div class="pills">
        <button type="button" data-a="tab" data-tab="b" aria-pressed="${tab === 'b'}">Buildings</button>
        <button type="button" data-a="tab" data-tab="d" aria-pressed="${tab === 'd'}">Decorations</button></div>
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
      ${g.id && !it.fixed ? '<button type="button" class="btn sm p" data-a="away">Put away</button>' : ''}
      <button type="button" class="btn sm ghost" data-a="cancel">Cancel</button>
      <button type="button" class="btn sm m" data-a="ok" ${g.ok ? '' : 'disabled'}>${g.id ? 'Move here' : 'Place'}</button>`;
    el.classList.toggle('bad', !g.ok);
  }
  function paintCard() {
    const el = $('pf-card');
    if (!card || mode !== 'farm' || edit) { el.hidden = true; return; }
    el.hidden = false;
    if (card.pet) {
      const p = F.pets.find(x => x.id === card.pet); if (!p) { card = null; el.hidden = true; return; }
      const s = SPECIES[p.sp];
      el.innerHTML = `${thumb('pet:' + p.sp, s.name)}<div class="info">
        <form class="namer"><input class="field" id="pf-name" maxlength="14" value="${esc(p.name)}" aria-label="Pet name" autocomplete="off"><button class="btn sm w">Rename</button></form>
        <p>${elTag(s.el)} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}</p>
        ${p.lv < MAX_LV ? `<div class="xp" title="Experience"><i style="width:${Math.round(p.xp / xpFor(p.lv) * 100)}%"></i><span>${p.xp} of ${xpFor(p.lv)} to level ${p.lv + 1}</span></div>` : ''}
        <p class="hint">${s.blurb}</p></div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
    } else {
      const item = F.items.find(x => x.id === card.item), it = item && ITEMS[item.type]; if (!it) { card = null; el.hidden = true; return; }
      let more = '', name = it.name;
      if (item.type === 'house') {
        name += ` · Level ${F.house}`;
        const opens = list(Object.values(ZONES).filter(z => z.house === F.house + 1).map(z => z.name));
        more = F.houseNext ? `<p class="hint">Level ${F.house + 1} opens ${opens}.</p><div class="cost">${costHtml(F.houseNext, F.inv)}</div>
          <button type="button" class="btn sm m" data-a="houseup">Improve farmhouse</button>` : '<p class="hint">It is as grand as it gets.</p>';
      } else if (item.type === 'gate') {
        const t = F.trip;
        more = !t ? '<button type="button" class="btn sm m" data-a="explore">Send pets exploring</button>'
          : t.left > 0 ? `<p class="hint">The party is in ${ZONES[t.zone].name}, back in ${wait(t.left)}.</p>` : '<button type="button" class="btn sm m" data-a="collect">Welcome them back</button>';
      } else if (item.type === 'hut') more = `<p class="hint">Your farm has room for ${F.room} pets.</p>`;
      el.innerHTML = `${thumb(item.type, it.name)}<div class="info"><b>${name}</b><p>${it.desc}</p>${it.soon ? `<p class="hint">${it.soon}</p>` : ''}${more}
        <button type="button" class="btn sm w" data-a="grab" data-id="${item.id}">Move it</button></div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
    }
  }

  // ---------- from the 3D scene ----------
  function onPick(p) {
    if (p.starter) { pick = p.starter; sfx.pop(); sync(); return; }
    if (mode !== 'farm') return;
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
  function setEdit(on) { edit = on; card = null; panel = null; if (!on) scene?.ghostCancel(); sync(); }
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
    else if (a === 'explore') openSend();
    else if (a === 'collect') ctx.send({ t: 'collect' });
    else if (a === 'shut') { panel = null; sync(); }
    else if (a === 'zone') { if (b.classList.contains('off')) return ctx.toast(`${ZONES[b.dataset.zone].name} opens at farmhouse level ${ZONES[b.dataset.zone].house}. Tap your farmhouse to improve it.`, true); panel.zone = b.dataset.zone; paintPanel(); }
    else if (a === 'trip') { panel.trip = b.dataset.trip; paintPanel(); }
    else if (a === 'party') {
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(`A party is ${PARTY} pets at most.`, true); else panel.pets.push(id);
      const keep = $('pf-panel').querySelector('.party')?.scrollLeft || 0; paintPanel(); const row = $('pf-panel').querySelector('.party'); if (row) row.scrollLeft = keep;
    }
    else if (a === 'send') { lastTrip = { zone: panel.zone, trip: panel.trip, pets: [...panel.pets] }; ctx.send({ t: 'send', ...lastTrip }); }
    else if (a === 'houseup') { if (!canAfford(F.inv, F.houseNext)) ctx.toast('Not enough materials for that yet.', true); else ctx.send({ t: 'houseup' }); }
    else if (a === 'tab') { tab = b.dataset.tab; paintBuild(); }
    else if (a === 'expand') { if (b.classList.contains('off')) ctx.toast('Not enough materials to grow the land yet.', true); else ctx.send({ t: 'expand' }); }
    else if (a === 'item') {
      const type = b.dataset.type, it = ITEMS[type];
      if (it.max && countOf(F, type) >= it.max) return ctx.toast(`You can only have ${it.max} of those.`, true);
      if (!canAfford(F.inv, it.cost)) return ctx.toast('Not enough materials for that yet.', true);
      scene?.ghostNew(type);
    }
    else if (a === 'rot') scene?.ghostRotate();
    else if (a === 'cancel') scene?.ghostCancel();
    else if (a === 'ok') confirmGhost();
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
    if (mode !== 'farm' || !F?.trip || !F.trip.left) return;
    const left = tripAt - Date.now(), chip = $('pf-trip');
    if (left <= 0) { sfx.turn(); ctx.toast('Your pets are back from their expedition!'); sync(); }
    else if (chip) chip.textContent = `Back from ${ZONES[F.trip.zone].name} in ${wait(left)}`;
  }, 5000);

  // ---------- from the server ----------
  function msg(m) {
    if (m.err) { sfx.bad(); ctx.toast(esc(m.err), true); }
    if (m.need) { F = null; mode = m.need; edit = false; sync(); return; }
    if (!m.farm) return;
    const first = mode !== 'farm';
    F = m.farm; mode = 'farm'; tripAt = Date.now() + (F.trip?.left || 0);
    if (m.did === 'starter') { sfx.join(); ctx.toast(`${esc(F.pets[0].name)} moved in. Welcome to your farm!`); }
    else if (m.did === 'place' || m.did === 'move') sfx.set();
    else if (m.did === 'remove') sfx.pop();
    else if (m.did === 'expand') { sfx.join(); ctx.toast(`The farm grew to ${F.size} by ${F.size} tiles.`); }
    else if (m.did === 'send') { sfx.turn(); panel = null; ctx.toast(`Off they go to ${ZONES[F.trip.zone].name}!`); }
    else if (m.did === 'collect') { sfx.win(); card = null; panel = { kind: 'back', back: m.back }; }
    else if (m.did === 'houseup') { sfx.win(); ctx.toast(`The farmhouse is now level ${F.house}.`); }
    else if (m.did === 'petname') ctx.toast('Renamed.');
    if (first) { pick = null; edit = false; }
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
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); scene?.dispose(); },
  };
}
