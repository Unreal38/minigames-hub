// Pet Farm view: the HUD over the 3D farm. Shows what the server says and sends what the player wants to do.
// Unlike the table games this one has no room: app.js mounts it straight from the hub.
//   mount(app, ctx) -> { msg(m), me(), reopen(), destroy() }
//   ctx: { send(action), toast, me(), home(), account(mode) }
import { sfx } from '../../sfx.js';
import { MOVES, STATUS, STAT_NAME, KIT, ROLE_NAME, movesAt } from './battle.js';
import { ITEMS, MATS, SPECIES, STARTERS, ELEMENTS, FORMS, RARITY, ZONES, TRIPS, PARTY, MAX_LV, HOUSE_MAX, GIFTS, formOf, xpFor, tripLoot, canAfford, countOf } from './data.js';

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
      <div class="bt" id="pf-bt" hidden></div>
      <div class="dock"><div class="ghostbar" id="pf-ghost" hidden></div><div class="build" id="pf-build" hidden></div></div>
    </div>
    <div class="gate" id="pf-panel" hidden></div>
    <div class="gate" id="pf-gate" hidden></div>
  </div>`;
  const root = app.querySelector('.pf'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  let F = null, scene = null, destroyed = false, mode = 'load', edit = false, tab = 'b', pick = null, card = null, panel = null, tripAt = 0, lastType = null, lastSpot = null;
  // Every request gets an answer. If none comes, say so instead of leaving a button that seems dead.
  let quiet = 0;
  const say = ctx.send;
  ctx = { ...ctx, send(a) { say(a); clearTimeout(quiet); quiet = setTimeout(() => { if (!destroyed) ctx.toast('The farm did not answer. Check your connection. If the game was just updated, the server needs a restart.', true); }, 4000); } };
  let where = 'home', world = null, V = null; // home, map (the neighbourhood), or visit (someone else's farm, in V)
  let B = null, shown = null, playing = false, foes = null, line = '';
  let mapShown = null;
  let user = ctx.me()?.user || null, lastTrip = { zone: 'woods', trip: 'stroll', pets: [] }, lastTeam = [];

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
    paintGate(); paintTop(); paintMain(); paintBuild(); paintCard(); paintPanel(); paintBattle();
    if (!scene) return;
    if (mode === 'starter') { scene.setFarm(null); scene.setStarters(pick || ''); }
    else { scene.setStarters(null); scene.setFarm(mode !== 'farm' ? null : where === 'visit' && V ? V : F); scene.setEdit(edit); }
    const map = mode === 'farm' && where === 'map' && !B && world ? world : null;
    if (map !== mapShown) { mapShown = map; scene.setWorld(map, map && { ...F, name: F.owner, color: ctx.me()?.color, av: ctx.me()?.av }); }
    scene.setBattle(!!B && mode === 'farm'); if (B) for (const s of [0, 1]) scene.ringPet(s, shown.sides[s].pets[shown.sides[s].on]);
  }
  function paintTop() {
    $('pf-title').textContent = B ? (B.mode === 'arena' ? `Match against ${B.foe}` : 'Practice battle') : where === 'map' && F ? 'The neighbourhood' : where === 'visit' && V ? `${V.name}'s farm` : F ? `${F.owner}'s farm` : 'Pet Farm';
    $('pf-mats').innerHTML = F && mode === 'farm' && !B ? Object.keys(MATS).filter(k => BASIC.includes(k) || F.inv[k]).map(k => mat(k, F.inv[k] || 0)).join('') : '';
  }
  function paintMain() {
    const el = $('pf-main');
    if (mode !== 'farm' || edit || B) { el.innerHTML = ''; return; }
    if (where === 'map') {
      el.innerHTML = `<button type="button" class="btn big" data-a="gohome">Back to my farm</button><span class="chip">${!world ? 'Looking around…' : world.length ? 'Tap an island to visit' : 'No other farms yet. They appear here when friends start one.'}</span>`;
      return;
    }
    if (where === 'visit' && V) {
      el.innerHTML = `<button type="button" class="btn big" data-a="map">Back to the map</button>
        <button type="button" class="btn m" data-a="help" ${V.helps > 0 ? '' : 'disabled'}>Help out (${V.helps} left)</button>
        <button type="button" class="btn m" data-a="giftopen" ${V.gift ? '' : 'disabled'}>${V.gift ? 'Leave a gift' : 'Gift left today'}</button>
        ${countOf(F, 'flag') && V.team ? '<button type="button" class="btn w" data-a="duel">Challenge</button>' : ''}
        ${V.pal ? `<span class="chip">Friendship ${V.pal}</span>` : ''}`;
      return;
    }
    const t = F.trip, z = t && ZONES[t.zone];
    const trip = !countOf(F, 'gate') ? '<span class="chip">Build an Expedition Gate to send pets exploring</span>'
      : !t ? '<button type="button" class="btn m" data-a="explore">Send pets exploring</button>'
      : t.left > 0 ? `<span class="chip" id="pf-trip">Back from ${z.name} in ${wait(t.left)}</span>`
      : '<button type="button" class="btn big m" data-a="collect">Welcome them back</button>';
    el.innerHTML = `<button type="button" class="btn big" data-a="edit">Edit farm</button>${trip}
      <button type="button" class="btn w" data-a="map">World map</button>
      <button type="button" class="btn w" data-a="album">Pets ${F.pets.length} of ${F.room}</button>
      ${F.mail.length ? `<button type="button" class="btn w" data-a="mail">Mail ${F.mail.length}</button>` : ''}`;
  }
  // ---------- expeditions ----------
  const petRow = (p, extra = '') => `${thumb('pet:' + p.sp)}<b>${esc(p.name)}</b><small>Level ${p.lv}${extra}</small>`;
  function paintPanel() {
    const box = $('pf-panel');
    if (!panel || mode !== 'farm' || edit) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (panel.kind === 'team') { // who fights (or defends), in order: the first one leads
      const away = F.trip?.pets || [], what = panel.mode === 'defend' ? 'Defence team' : panel.mode === 'arena' ? `Match against ${esc(panel.foeName)}` : 'Practice battle';
      const pets = F.pets.map(p => { const i = panel.pets.indexOf(p.id), out = away.includes(p.id) && panel.mode !== 'defend';
        return `<button type="button" class="pickpet${out ? ' off' : ''}" data-a="team" data-id="${p.id}" aria-pressed="${i >= 0}">${i >= 0 ? `<span class="num">${i + 1}</span>` : ''}
          ${petRow(p, out ? ' · exploring' : ' · ' + SPECIES[p.sp].el)}</button>`; }).join('');
      const note = panel.mode === 'defend' ? 'These pets defend your farm when another player challenges you. They fight at level 20 and are played by the game.'
        : panel.mode === 'arena' ? `Everyone fights at level 20 with all four moves. ${F.fights.arena > 0 ? `Rewarded matches left today: ${F.fights.arena}.` : 'No rewarded matches left today, so this one is just for fun.'}`
        : `Your pets fight at their own level against partners of the same level. ${F.fights.practice > 0 ? `Practice fights that give experience today: ${F.fights.practice}.` : 'No more experience from practice today, but you can still fight for fun.'}`;
      box.innerHTML = `<div class="panel tripp"><h2>${what}</h2><p>Pick up to ${PARTY}. The first one you tap leads.</p>
        <div class="party">${pets}</div><p class="hint">${note}</p>
        <div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button>
          <button type="button" class="btn big m" data-a="${panel.mode === 'defend' ? 'defend' : 'fight'}" ${panel.pets.length ? '' : 'disabled'}>${panel.mode === 'defend' ? 'Save team' : 'Start'}</button></div></div>`;
      return;
    }
    if (panel.kind === 'gift') {
      const rows = Object.entries(GIFTS).filter(([k]) => BASIC.includes(k) || F.inv[k]).map(([k, n]) => `<button type="button" class="zone${(F.inv[k] || 0) < n ? ' off' : ''}" data-a="gift" data-mat="${k}"><b>${n} ${MATS[k].toLowerCase()}</b><small>You have ${F.inv[k] || 0}</small></button>`).join('');
      box.innerHTML = `<div class="panel tripp"><h2>A gift for ${esc(V.name)}</h2><p>It comes out of your own stock and lands in their Mailbox. One gift a day for each neighbour.</p>
        <div class="zones">${rows}</div><div class="row end"><button type="button" class="btn ghost-ink" data-a="shut">Not now</button></div></div>`;
      return;
    }
    if (panel.kind === 'mail') {
      const box2 = !!countOf(F, 'mailbox');
      const rows = F.mail.map(m => { const got = m.got && Object.entries(m.got).map(([k, n]) => mat(k, n)).join('');
        const text = m.k === 'gift' ? `<b>A gift from ${esc(m.from)}</b>` : m.k === 'help' ? `<b>${esc(m.from)} helped out</b><small>${m.n} ${m.n === 1 ? 'time' : 'times'} today. Thank them with a visit.</small>`
          : `<b>${esc(m.from)} challenged your farm</b><small>${m.held ? 'Your team held. You earned 5 coins.' : 'Your team lost this one. Nothing was taken.'}</small>`;
        return `<div class="letter"><div>${text}${got ? `<div class="mats">${got}</div>` : ''}</div>${m.got ? `<button type="button" class="btn sm m" data-a="claim" data-id="${m.id}" ${box2 ? '' : 'disabled'}>Open</button>` : ''}</div>`; }).join('');
      box.innerHTML = `<div class="panel tripp"><h2>Mailbox</h2>${box2 ? '' : '<p>Build a Mailbox on your farm to open gifts.</p>'}
        ${rows || '<p class="hint">Nothing new. Gifts and news from neighbours land here.</p>'}
        <div class="row end">${box2 && F.mail.some(m => !m.got) ? '<button type="button" class="btn w" data-a="mailread">Clear the news</button>' : ''}<button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
      return;
    }
    if (panel.kind === 'album') {
      const zoneOf = sp => Object.values(ZONES).find(z => sp in z.wild)?.name;
      const cells = Object.entries(SPECIES).map(([sp, d]) => { const a = F.album[sp];
        return a ? `<div class="leaf">${thumb('pet:' + sp, d.name)}<b>${d.name}</b>${elTag(d.el)}<span class="forms" title="Baby, young, adult">${a.map((x, i) => `<i class="${x ? 'on' : ''}" title="${FORMS[i]}"></i>`).join('')}</span></div>`
          : `<div class="leaf no"><span class="nothumb">?</span><b>Not found yet</b><small>${zoneOf(sp) || ''}</small></div>`; }).join('');
      const have = Object.keys(F.album).length, total = Object.keys(SPECIES).length + 5;
      box.innerHTML = `<div class="panel tripp"><h2>Pet Album</h2><p>${have} of ${total} species found. The three dots are the baby, young and adult forms you have raised.</p>
        <div class="album">${cells}${'<div class="leaf no"><span class="nothumb">?</span><b>Not found yet</b><small>From breeding</small></div>'.repeat(5)}</div>
        <div class="row end"><button type="button" class="btn m" data-a="shut">Close</button></div></div>`;
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
    if (panel.kind === 'prize') {
      const z = panel.prize, who = F.pets.filter(p => panel.ids.includes(p.id));
      const rows = z.counted ? who.map(p => { const g = z.grew.find(x => x.id === p.id);
        return `<div class="backpet">${thumb('pet:' + p.sp)}<div><b>${esc(p.name)}</b><small>+${z.xp} experience${g ? ` · <em>${g.form ? `grew up into its ${FORMS[g.form].toLowerCase()} form` : `reached level ${g.lv}`}</em>` : ''}</small></div></div>`; }).join('') : '';
      box.innerHTML = `<div class="panel tripp back"><h2>${z.won ? 'You won!' : panel.quit ? 'You left the ring' : 'You lost this one'}</h2>
        ${z.counted ? `<div class="mats">${z.coins ? mat('coins', '+' + z.coins) : ''}${z.pts ? `<span class="mat">+${z.pts} ladder points</span>` : ''}</div>${rows}` : `<p class="hint">${panel.quit ? 'Giving up earns nothing.' : 'No rewards left for today, so that one was just for fun.'}</p>`}
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
  // ---------- battles ----------
  const side = s => shown.sides[s], act = s => side(s).pets[side(s).on];
  const who = s => !s ? esc(act(0).name) : B.mode === 'arena' ? `${esc(B.foe)}'s ${esc(act(1).name)}` : `The other side's ${esc(act(1).name)}`;
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
    const me = side(0), u = act(0), busy = playing || B.over !== null;
    const moves = u.moves.map(id => { const m = MOVES[id], cd = u.cd[id] || 0;
      const what = m.pow ? `Power ${m.pow}` : m.heal ? 'Heals' : m.up ? `Raises ${STAT_NAME[m.up]}` : `Lowers their ${STAT_NAME[m.down]}`;
      return `<button type="button" class="mv" data-a="move" data-move="${id}" style="--c:${ELEMENTS[m.el]}" ${busy || cd || B.need ? 'disabled' : ''}><b>${m.name}</b><small>${cd ? `Ready in ${cd}` : what + (m.status ? ` · ${STATUS[m.status].name}` : '')}</small></button>`; }).join('');
    const bench = me.pets.map((x, i) => i === me.on ? '' : `<button type="button" class="sw" data-a="swap" data-i="${i}" ${busy || x.hp <= 0 || (u.status.rooted && !B.need) ? 'disabled' : ''}>${thumb('pet:' + x.sp)}<span><b>${esc(x.name)}</b><small>${x.hp > 0 ? `${x.hp} / ${x.max}` : 'Fainted'}</small></span></button>`).join('');
    el.innerHTML = `${plate(1)}${plate(0)}
      <div class="bbar"><p class="blog">${line || (B.need ? 'Who comes in next?' : `What should ${esc(u.name)} do?`)}</p>
        <div class="mvs">${moves}</div>
        <div class="bench">${bench}<button type="button" class="btn sm ghost-ink" data-a="giveup" ${busy ? 'disabled' : ''}>Give up</button></div></div>`;
  }
  // Plays what the server says happened, one beat at a time, then shows the real state.
  const beat = ms => new Promise(r => setTimeout(r, ms));
  async function play(ev, final, after) {
    playing = true;
    for (const e of ev) {
      if (destroyed) return;
      const u = e.s !== undefined ? act(e.s) : null; let ms = 800;
      if (e.k === 'switch') { side(e.s).on = e.i; const n = act(e.s); n.up = { atk: 0, def: 0, spd: 0 }; scene?.ringPet(e.s, n); line = e.s ? `${esc(n.name)} steps in for the other side.` : `Go, ${esc(n.name)}!`; sfx.pop(); }
      else if (e.k === 'move') { line = `${who(e.s)} uses ${MOVES[e.move].name}.`; scene?.ringFx(e.s, MOVES[e.move].pow ? 'lunge' : 'hop'); sfx.click(); ms = 650; }
      else if (e.k === 'hit') { u.hp = e.hp; line = `${who(e.s)} takes ${e.dmg}.${e.eff > 1 ? ' It hit hard!' : e.eff < 1 ? ' It barely tickled.' : ''}`; scene?.ringFx(e.s, 'hit'); sfx.place(); }
      else if (e.k === 'burn') { u.hp = e.hp; line = `${who(e.s)} is stung by its burn and takes ${e.dmg}.`; scene?.ringFx(e.s, 'hit'); sfx.place(); }
      else if (e.k === 'heal') { u.hp = e.hp; line = `${who(e.s)} gets ${e.n} health back.`; sfx.join(); }
      else if (e.k === 'stat') { if (e.d) u.up[e.stat] += e.d; line = e.d ? `${who(e.s)}'s ${STAT_NAME[e.stat]} goes ${e.d > 0 ? 'up' : 'down'}.` : 'Nothing changes.'; scene?.ringFx(e.s, e.d > 0 ? 'hop' : 'hit'); }
      else if (e.k === 'status') { u.status[e.st] = 1; line = `${who(e.s)} is ${STATUS[e.st].name.toLowerCase()}. ${STATUS[e.st].blurb}`; ms = 1100; }
      else if (e.k === 'clear') { delete u.status[e.st]; line = `${who(e.s)} is no longer ${STATUS[e.st].name.toLowerCase()}.`; ms = 600; }
      else if (e.k === 'dazed') { line = `${who(e.s)} is dazed and loses its turn.`; scene?.ringFx(e.s, 'hit'); }
      else if (e.k === 'faint') { line = `${who(e.s)} fainted.`; scene?.ringFx(e.s, 'faint'); sfx.lose(); ms = 1100; }
      else if (e.k === 'end') { line = e.quit ? '' : e.win ? 'The other side wins this time.' : 'You win!'; if (!e.quit) (e.win ? sfx.lose : sfx.win)(); ms = e.quit ? 0 : 1300; }
      paintBattle(); await beat(ms);
    }
    if (destroyed) return;
    playing = false; line = '';
    if (after) after(); else { shown = structuredClone(final); B = final; for (const s of [0, 1]) scene?.ringPet(s, act(s)); paintBattle(); }
  }
  function openTeam(mode, foe) {
    if (mode !== 'defend' && !countOf(F, mode === 'arena' ? 'flag' : 'yard')) return;
    const keep = (mode === 'defend' ? F.def : lastTeam).filter(id => F.pets.some(p => p.id === id) && (mode === 'defend' || !F.trip?.pets.includes(id)));
    panel = { kind: 'team', mode, foe: foe?.id, foeName: foe?.name, pets: keep }; card = null; sync();
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
    if (!card || mode !== 'farm' || edit || B) { el.hidden = true; return; }
    el.hidden = false;
    if (where === 'visit') {
      const p = V?.pets.find(x => x.id === card.pet), s = p && SPECIES[p.sp]; if (!s) { card = null; el.hidden = true; return; }
      el.innerHTML = `${thumb('pet:' + p.sp, s.name)}<div class="info"><b>${esc(p.name)}</b><p>${elTag(s.el)} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}</p><p class="hint">${s.blurb}</p></div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
      return;
    }
    if (card.pet) {
      const p = F.pets.find(x => x.id === card.pet); if (!p) { card = null; el.hidden = true; return; }
      const s = SPECIES[p.sp];
      el.innerHTML = `${thumb('pet:' + p.sp, s.name)}<div class="info">
        <form class="namer"><input class="field" id="pf-name" maxlength="14" value="${esc(p.name)}" aria-label="Pet name" autocomplete="off"><button class="btn sm w">Rename</button></form>
        <p>${elTag(s.el)} ${s.name} · ${FORMS[formOf(p.lv)]} · Level ${p.lv}</p>
        ${p.lv < MAX_LV ? `<div class="xp" title="Experience"><i style="width:${Math.round(p.xp / xpFor(p.lv) * 100)}%"></i><span>${p.xp} of ${xpFor(p.lv)} to level ${p.lv + 1}</span></div>` : ''}
        <p class="hint">${s.blurb}</p>
        <div class="mvlist"><span class="hint">${ROLE_NAME[KIT[p.sp].role]}</span>${movesAt(p.sp, p.lv).map(id => `<span class="el" style="--c:${ELEMENTS[MOVES[id].el]}">${MOVES[id].name}</span>`).join('')}</div></div>
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
      } else if (item.type === 'yard') more = '<button type="button" class="btn sm m" data-a="practice">Practice battle</button>';
      else if (item.type === 'flag') more = `<p class="hint">You have ${F.pts} ladder points.</p><button type="button" class="btn sm m" data-a="arena">Find a match</button>`;
      else if (item.type === 'mailbox') more = `<button type="button" class="btn sm m" data-a="mail">Open mail (${F.mail.length})</button>`;
      else if (item.type === 'hut') more = `<p class="hint">Your farm has room for ${F.room} pets.</p>`;
      el.innerHTML = `${thumb(item.type, it.name)}<div class="info"><b>${name}</b><p>${it.desc}</p>${it.soon ? `<p class="hint">${it.soon}</p>` : ''}${more}
        <button type="button" class="btn sm w" data-a="grab" data-id="${item.id}">Move it</button></div>
        <button type="button" class="round x" data-a="close" aria-label="Close">×</button>`;
    }
  }

  // ---------- from the 3D scene ----------
  function onPick(p) {
    if (p.starter) { pick = p.starter; sfx.pop(); sync(); return; }
    if (mode !== 'farm') return;
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
    else if (a === 'help') ctx.send({ t: 'help', id: V.id });
    else if (a === 'giftopen') { panel = { kind: 'gift' }; card = null; sync(); }
    else if (a === 'gift') { if (b.classList.contains('off')) return ctx.toast('You do not have enough of that to give.', true); ctx.send({ t: 'gift', id: V.id, mat: b.dataset.mat }); }
    else if (a === 'duel') openTeam('arena', V);
    else if (a === 'mail') { panel = { kind: 'mail' }; card = null; sync(); }
    else if (a === 'album') { panel = { kind: 'album' }; card = null; sync(); }
    else if (a === 'claim') ctx.send({ t: 'claim', id: b.dataset.id });
    else if (a === 'mailread') ctx.send({ t: 'mailread' });
    else if (a === 'practice') openTeam('practice');
    else if (a === 'arena') { foes = null; panel = { kind: 'foes' }; card = null; sync(); ctx.send({ t: 'foes' }); }
    else if (a === 'foe') { const f = foes?.find(x => x.id === b.dataset.id); if (f) openTeam('arena', f); }
    else if (a === 'defteam') openTeam('defend');
    else if (a === 'team') {
      if (b.classList.contains('off')) return ctx.toast('That pet is away exploring.', true);
      const id = b.dataset.id, i = panel.pets.indexOf(id);
      if (i >= 0) panel.pets.splice(i, 1); else if (panel.pets.length >= PARTY) return ctx.toast(`A team is ${PARTY} pets at most.`, true); else panel.pets.push(id);
      paintPanel();
    }
    else if (a === 'fight') { lastTeam = [...panel.pets]; ctx.send({ t: 'fight', mode: panel.mode, foe: panel.foe, pets: lastTeam }); }
    else if (a === 'defend') ctx.send({ t: 'defend', pets: [...panel.pets] });
    else if (a === 'move') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', move: b.dataset.move }); } }
    else if (a === 'swap') { if (!playing) { playing = true; paintBattle(); ctx.send({ t: 'bact', switch: +b.dataset.i }); } }
    else if (a === 'giveup') { if (!playing) ctx.send({ t: 'bquit' }); }
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
    clearTimeout(quiet);
    if (m.err) { sfx.bad(); ctx.toast(esc(m.err), true); }
    if (m.need) { F = null; B = null; mode = m.need; edit = false; sync(); return; }
    if (m.foes) foes = m.foes;
    if (m.world) world = m.world;
    if (m.visit) { V = { ...m.visit, trip: null }; if (where !== 'visit') { where = 'visit'; card = null; panel = null; } }
    if (m.farm) { F = m.farm; tripAt = Date.now() + (F.trip?.left || 0); }
    if (m.battle !== undefined && F && !(m.did === 'fought')) { // a fight starting, a turn played, or one found still running
      const starting = !B && m.battle;
      if (!m.battle) { B = null; shown = null; playing = false; if (m.farm) { mode = 'farm'; sync(); } return; }
      if (starting) { B = m.battle; shown = structuredClone(B); playing = false; line = ''; panel = null; card = null; edit = false; mode = 'farm'; sfx.turn(); sync(); return; }
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
    else if (m.did === 'place' || m.did === 'move') sfx.set();
    else if (m.did === 'remove') sfx.pop();
    else if (m.did === 'expand') { sfx.join(); ctx.toast(`The farm grew to ${F.size} by ${F.size} tiles.`); }
    else if (m.did === 'send') { sfx.turn(); panel = null; ctx.toast(`Off they go to ${ZONES[F.trip.zone].name}!`); }
    else if (m.did === 'collect') { sfx.win(); card = null; panel = { kind: 'back', back: m.back }; }
    else if (m.did === 'help') { sfx.set(); ctx.toast(`You tidied up for ${esc(V.name)} and earned 3 coins.`); }
    else if (m.did === 'gift') { sfx.join(); panel = null; ctx.toast(`Your gift is in ${esc(V.name)}'s Mailbox.`); }
    else if (m.did === 'claim') { sfx.join(); ctx.toast('You got ' + Object.entries(m.got).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') + '.'); }
    else if (m.did === 'defend') { panel = null; ctx.toast('Defence team saved.'); }
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
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearTimeout(quiet); scene?.dispose(); },
  };
}
