// The Plaza's page: the 3D island (scene3d.js) with name tags, speech bubbles and buttons laid over it.
//   mount(app, ctx) -> { msg(m), chat(line), chatGone(), tables(rooms), reopen(), destroy() }
// ctx comes from app.js: send(a) (a plaza action), toast, me(), home(), account(mode), player(pt), wheel(), join(code),
// askTables(), gameName(id), chatLog(), chatFoot() (the hub chat's own markup: the plaza shares that conversation),
// wardrobe() (opens the Wardrobe at the emotes), games() (ids of the table games), host(id) (opens a table).
import { L } from '../../i18n.js';
import { sfx } from '../../sfx.js';
import { EMOJI, FOODS, reactHtml } from '../../react.js';
import { stickersOf, nameHtml, emotesOf, cosItem, COS, cosHas, frameCls } from '../../cosmetics.js';
import { avatarHtml } from '../../avatar.js';
import { srvText } from '../../lang/server.js';
import { uiz } from '../../uiz.js';
import { createScene } from './scene3d.js';
import { CAP, Q, SPOTS, SPOT_REACH, EMOTES, ORNAMENTS, TREE_REACH, THINGS, THROW_WAIT, POKE } from './layout.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const ORN_NAME = { red: () => L('Red bauble', 'Czerwona bombka'), gold: () => L('Gold bauble', 'Złota bombka'), blue: () => L('Blue bauble', 'Niebieska bombka'), pink: () => L('Pink bauble', 'Różowa bombka'), silver: () => L('Silver bauble', 'Srebrna bombka'),
  star: () => L('Star', 'Gwiazdka'), bell: () => L('Bell', 'Dzwonek'), cane: () => L('Candy cane', 'Laska cukrowa'), ginger: () => L('Gingerbread', 'Piernik'), snow: () => L('Snowflake', 'Śnieżynka') };
// Small drawn pictures of the ornaments (drawn, not emoji, so they look the same on every system).
const INK = '#3b2219';
function ornSvg(o) {
  const c = o.c, w = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
  const pic = {
    star: `<path d="M20 5l4.4 9.6 10.4 1.1-7.8 7 2.2 10.3L20 27.8 10.8 33l2.2-10.3-7.8-7 10.4-1.1z" fill="${c}" ${w}/>`,
    bell: `<path d="M20 7c-6 0-8 5-8 11 0 4-3 7-3 9h22c0-2-3-5-3-9 0-6-2-11-8-11z" fill="${c}" ${w}/><circle cx="20" cy="31" r="3" fill="#c0392b" ${w}/>`,
    cane: `<path d="M15 34V15a7 7 0 0 1 14 0v2" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M15 34V15a7 7 0 0 1 14 0v2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M15 34V15a7 7 0 0 1 14 0v2" fill="none" stroke="#e5543b" stroke-width="5" stroke-dasharray="4 5" />`,
    ginger: `<g fill="${c}" ${w}><circle cx="20" cy="11" r="6"/><path d="M14 17h12l7 3-2 4-5-1v5l3 7h-5l-4-6-4 6h-5l3-7v-5l-5 1-2-4z"/></g><circle cx="20" cy="21" r="1.3" fill="#fff6e0"/><circle cx="20" cy="25.5" r="1.3" fill="#fff6e0"/>`,
    snow: `<g fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"><path d="M20 6v28M8 13l24 14M8 27l24-14"/></g><g fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"><path d="M20 6v28M8 13l24 14M8 27l24-14"/></g>`,
  }[o.id] || `<rect x="16" y="5" width="8" height="6" rx="1.5" fill="#f2b92e" ${w}/><circle cx="20" cy="23" r="12" fill="${c}" ${w}/><path d="M13 19a8 8 0 0 1 6-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${pic}</svg>`;
}

let cssLoaded = false;
function loadCss() { if (cssLoaded) return; cssLoaded = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./plaza.css', import.meta.url).href; document.head.append(l); }

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="plz">
    <canvas class="g3d plz-cv" aria-label="${L('The plaza', 'Plac')}"></canvas>
    <div class="plz-tags" id="plz-tags" aria-hidden="true"></div>
    <div class="plz-load" id="plz-load">${L('Walking to the plaza…', 'Idziemy na plac…')}</div>
    <div class="hud plz-hud">
      <div class="tl plz-tl">
        <button type="button" class="plz-chip" data-a="home" aria-label="${L('Main page', 'Strona główna')}"><span aria-hidden="true">←</span><b class="plz-wide">${L('Main page', 'Strona główna')}</b></button>
        <button type="button" class="plz-chip" data-a="rooms" id="plz-room" aria-haspopup="true"></button>
        <button type="button" class="plz-chip" data-a="tables" id="plz-tbl" aria-haspopup="true" aria-label="${L('Open tables', 'Otwarte stoły')}"><span aria-hidden="true">🪧</span><b class="plz-wide">${L('Open tables', 'Otwarte stoły')}</b><i id="plz-tbln" hidden></i></button>
        <button type="button" class="plz-chip plz-evchip" data-a="ev" id="plz-ev" hidden></button>
      </div>
      <div class="tr plz-tr">
        <button type="button" class="round plz-chatbtn" data-a="chat" aria-label="${L('Chat', 'Czat')}" title="${L('Chat', 'Czat')}">💬<i class="plz-dot" id="plz-unread" hidden></i></button>
        <button type="button" class="round plz-view" data-a="view" id="plz-view" hidden aria-label="${L('Reset the view', 'Przywróć widok')}" title="${L('Reset the view', 'Przywróć widok')}">⟲</button>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}" title="${L('Sound on or off', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? '🔇' : '🔊'}</button>
      </div>
      <div class="plz-pop" id="plz-pop" hidden></div>
      <section class="plz-chat" id="plz-chat" aria-label="${L('Chat', 'Czat')}">
        <div class="hccard"><div class="plz-chathead"><b>${L('Chat', 'Czat')}</b><button type="button" class="round" data-a="chat" aria-label="${L('Close', 'Zamknij')}">×</button></div>
        <div class="hclog" id="hc-log" role="log" aria-live="polite"></div><div class="hcfoot" id="hc-foot"></div></div>
      </section>
      <div class="plz-acts" id="plz-acts"></div>
      <div class="plz-bar" id="plz-bar">
        <div class="plz-emos" id="plz-emos"></div>
        <button type="button" class="plz-fab plz-emobtn" data-a="emos" aria-expanded="false" aria-label="${L('Emotes', 'Emotki')}">🙌</button>
        <button type="button" class="plz-fab plz-throw" data-a="aim" id="plz-aim" aria-pressed="false"></button>
        <button type="button" class="plz-fab" data-a="reacts" aria-expanded="false" aria-label="${L('Reactions', 'Reakcje')}">😊</button>
      </div>
      <div class="plz-joy" id="plz-joy" aria-hidden="true"><i></i></div>
      <div class="plz-hint plz-aimh" id="plz-aimh" hidden></div>
      <div class="plz-hint" id="plz-hint">${L('WASD or arrows to walk, or click the ground. Drag to look around.', 'Chodzisz klawiszami WASD lub strzałkami albo klikając ziemię. Przeciągnij, żeby się rozejrzeć.')}</div>
    </div>
  </div>`;
  const root = app.querySelector('.plz'), $ = id => root.querySelector('#' + id), tagBox = $('plz-tags'); let canvas = root.querySelector('.plz-cv');
  const coarse = matchMedia('(pointer: coarse)').matches;
  root.classList.toggle('touch', coarse);
  let S = null, scene = null, destroyed = false, tags = new Map(), signs = new Map(), tablesList = [], chatOpen = !coarse && !matchMedia('(max-width: 760px)').matches, unread = 0, gift = false, giftN = 5, myOrn = 0;
  const hidden = new Set(LS.get('ct_plz_hide') || []);
  const send = a => ctx.send(a);
  const who = s => S?.who.get(s);
  const isHid = p => !!p?.pt && hidden.has(p.pt);

  // ---- your emote bar: the six you picked in the Wardrobe, and a way to the rest
  let emoKey = '';
  function paintEmos() {
    const list = emotesOf(ctx.me()), key = list.join() + (ctx.me()?.user ? 'a' : 'g'); if (key === emoKey) return; emoKey = key;
    $('plz-emos').innerHTML = list.map(i => EMOTES[i] ? `<button type="button" class="plz-emo" data-a="emo" data-e="${i}"><span aria-hidden="true">${EMOTES[i].e}</span><b>${esc(cosItem('em', i).n)}</b></button>` : '').join('')
      + `<button type="button" class="plz-emo plz-more" data-a="moremo" aria-label="${L('More emotes: open the Wardrobe', 'Więcej emotek: otwórz Garderobę')}"><span aria-hidden="true">＋</span><b>${L('More', 'Więcej')}</b></button>`;
  }
  paintEmos();

  // ---- throwing: the button turns your taps into throws until you press it again
  let aiming = false, threwAt = 0;
  function paintAim() { const w = S?.theme === 'winter', b = $('plz-aim'); b.textContent = w ? '❄️' : '🎾'; b.setAttribute('aria-pressed', aiming); b.setAttribute('aria-label', w ? L('Throw snowballs', 'Rzucaj śnieżkami') : L('Throw a ball', 'Rzucaj piłką'));
    root.classList.toggle('aiming', aiming); const h = $('plz-aimh'); h.hidden = !aiming; if (aiming) { $('plz-hint').hidden = true; h.style.top = ((root.querySelector('.plz-tl').getBoundingClientRect().bottom - root.getBoundingClientRect().top) / uiz() + 10) + 'px'; h.textContent = coarse ? L('Tap where to throw', 'Dotknij tam, gdzie chcesz rzucić') : L('Click where to throw. Press the button again to stop.', 'Kliknij tam, gdzie chcesz rzucić. Naciśnij przycisk jeszcze raz, żeby przestać.'); } }
  function throwAt(x, y) { if (!scene) return; const now = performance.now(); if (now - threwAt < THROW_WAIT) return; const p = scene.aim(x, y); if (!p) return; threwAt = now; send({ k: 'sb', x: p[0], z: p[1] });
    const b = $('plz-aim'); b.classList.add('wait'); setTimeout(() => b.classList.remove('wait'), THROW_WAIT); }
  paintAim();

  // ---- timed events: fireworks on New Year's Eve, on Saturday evenings, and when a host starts a show
  const EV_NAME = { newyear: () => L("New Year's Eve", 'Sylwester'), party: () => L('Saturday party', 'Sobotnia impreza'), show: () => L('Fireworks show', 'Pokaz fajerwerków') };
  let ev = null;
  const clockOf = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
  function setEv(e) { const now = Date.now(); ev = e ? { id: e.id, end: now + e.left, mid: e.mid > 0 ? now + e.mid : 0 } : null; paintEv(); }
  function paintEv() {
    const el = $('plz-ev'), now = Date.now(); if (ev && now >= ev.end) ev = null;
    if (ev?.mid && now >= ev.mid) { ev.mid = 0; scene?.volley(45); sfx.win?.(); ctx.toast(L('🎆 Happy New Year!', '🎆 Szczęśliwego Nowego Roku!'), false, 8000); }
    scene?.fireworks(!ev ? 0 : ev.mid ? .22 : 1);
    el.hidden = !ev; if (!ev) return;
    el.innerHTML = `<span aria-hidden="true">🎆</span><b class="plz-wide">${ev.mid ? L('Midnight in', 'Do północy') : EV_NAME[ev.id]()}</b><em>${clockOf((ev.mid || ev.end) - now)}</em>`;
    el.setAttribute('aria-label', EV_NAME[ev.id]());
  }
  const evT = setInterval(paintEv, 1000);

  // ---- chat (the hub's own conversation)
  function paintChat() { $('hc-log').innerHTML = ctx.chatLog(); $('hc-foot').innerHTML = ctx.chatFoot(); const el = $('hc-log'); el.scrollTop = el.scrollHeight; }
  function setChat(open) { chatOpen = open; root.classList.toggle('chat-open', open); if (open) { unread = 0; $('plz-unread').hidden = true; const el = $('hc-log'); el.scrollTop = el.scrollHeight; } }
  paintChat(); setChat(chatOpen);

  // ---- name tags, speech bubbles and reactions over heads
  function tagOf(s) {
    let t = tags.get(s); if (t) return t;
    const el = document.createElement('div'); el.className = 'plz-tag'; el.innerHTML = '<div class="plz-bub" hidden></div><div class="plz-name"></div>';
    tagBox.append(el); t = { el, bub: el.firstChild, name: el.lastChild, until: 0, shown: null }; tags.set(s, t); return t;
  }
  function paintTag(p) { const t = tagOf(p.s); t.name.innerHTML = avatarHtml(p.c, p.av, 26, frameCls(p.fl)) + (p.s === S.me ? `<i>${L('You', 'Ty')}</i>` : `<span>${nameHtml(p.n, p.fl)}</span>`); t.el.classList.toggle('plz-me', p.s === S.me); }
  function dropTag(s) { tags.get(s)?.el.remove(); tags.delete(s); }
  function bubble(s, text) { const t = tags.get(s); if (!t) return; t.bub.textContent = text.length > 90 ? text.slice(0, 88) + '…' : text; t.bub.hidden = false; t.until = performance.now() + 3800 + Math.min(4000, text.length * 55); }
  function floaty(s, k) { const t = tags.get(s); if (!t) return; const f = document.createElement('div'); f.className = 'plz-float'; f.innerHTML = reactHtml(k); t.el.append(f); setTimeout(() => f.remove(), 1700); }
  function paintSign(g) {
    let el = signs.get(g.code)?.el;
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'plz-sign'; el.dataset.a = 'join'; el.dataset.code = g.code; tagBox.append(el); }
    el.innerHTML = `<span aria-hidden="true">🪧</span><b>${esc(g.n)}</b> ${L('is hosting', 'zaprasza do gry')} <b>${esc(ctx.gameName(g.game))}</b><small>${L(`${g.free} ${g.free === 1 ? 'seat' : 'seats'} free · tap to join`, `wolne miejsca: ${g.free} · dotknij, by dołączyć`)}</small>`;
    if (!signs.has(g.code)) scene?.setGhost(g.code, g); // the host's avatar stays standing where they were, waving people over
    signs.set(g.code, { el, g });
  }
  function dropSign(code) { signs.get(code)?.el.remove(); signs.delete(code); scene?.dropGhost(code); }
  // something floating up from a spot on the island (a poked decoration)
  function floatAt(x, y, z, text) { const [sx, sy, on] = scene.project(x, y, z); if (!on) return; const el = document.createElement('div'); el.className = 'plz-tag'; el.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0)`; el.innerHTML = `<div class="plz-float">${text}</div>`; tagBox.append(el); setTimeout(() => el.remove(), 1700); }
  function frame(folk, me, W, H) {
    const now = performance.now();
    for (const m of folk.values()) {
      const t = tags.get(m.s); if (!t) continue;
      const show = m.on && !isHid(m.p);
      if (show !== t.shown) { t.shown = show; t.el.style.display = show ? '' : 'none'; }
      if (show) t.el.style.transform = `translate3d(${m.sx.toFixed(1)}px,${m.sy.toFixed(1)}px,0)`;
      if (t.until && now > t.until) { t.until = 0; t.bub.hidden = true; }
    }
    for (const { el, g } of signs.values()) { const [x, y, on] = scene.project(g.x / Q, 2.75, g.z / Q); el.style.display = on ? '' : 'none'; if (on) el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; }
  }

  // ---- things to do where you stand
  const WHEEL = THINGS.find(t => t[0] === 'miniwheel');
  function nearSeat() { const m = scene?.me(); if (!m) return -1; let best = -1, bd = 1; SPOTS.forEach((q, i) => { const d = Math.hypot(q.x - m.x, q.z - m.z) / (q.reach || SPOT_REACH); if (d < bd && !scene.spotTaken(i)) { bd = d; best = i; } }); return best; }
  let actsKey = '';
  function paintActs() {
    const m = scene?.me(); if (!m || !S) return;
    const out = [], d = Math.hypot(m.x, m.z), winter = S.theme === 'winter', acct = !!ctx.me()?.user;
    if (winter && d < TREE_REACH) { if (gift && acct) out.push(['gift', '🎁', giftN > 5 ? L("Open today's double present", 'Otwórz dzisiejszy podwójny prezent') : L("Open today's present", 'Otwórz dzisiejszy prezent')]); out.push(['orn', '🎄', myOrn ? L('Change your ornament', 'Zmień swoją ozdobę') : L('Hang an ornament', 'Zawieś ozdobę')]); }
    if (WHEEL && Math.hypot(m.x - WHEEL[1], m.z - WHEEL[2]) < 3.4) out.push(['wheel', '🎡', L('Spin the Lucky Wheel', 'Zakręć Kołem szczęścia')]);
    if (m.sp < 0 && nearSeat() >= 0) out.push(SPOTS[nearSeat()].k === 'ride' ? ['seat', '🎠', L('Ride the carousel', 'Przejedź się na karuzeli')] : SPOTS[nearSeat()].k === 'swing' ? ['seat', '🤸', L('Swing', 'Pohuśtaj się')] : ['seat', '🪑', L('Sit here', 'Usiądź tutaj')]);
    $('plz-view').hidden = !scene.turned();
    const key = out.map(o => o[0] + o[2]).join('|'); if (key === actsKey) return; actsKey = key;
    $('plz-acts').innerHTML = out.map(([a, e, t]) => `<button type="button" class="plz-act" data-a="${a}"><span aria-hidden="true">${e}</span>${t}</button>`).join('');
  }
  const actsT = setInterval(paintActs, 300);

  // ---- pop-ups
  let popKind = '';
  function closePop() { const p = $('plz-pop'); p.hidden = true; p.innerHTML = ''; p.className = 'plz-pop'; popKind = ''; root.classList.remove('emos-open', 'pop-open'); for (const b of root.querySelectorAll('[aria-expanded]')) b.setAttribute('aria-expanded', 'false'); }
  function openPop(kind, html, cls = '', at = null) {
    const p = $('plz-pop'); p.className = 'plz-pop ' + cls; p.innerHTML = html; p.hidden = false; popKind = kind; root.classList.add('pop-open');
    p.style.left = p.style.top = p.style.right = p.style.bottom = '';
    if (cls === 'top') p.style.top = ((root.querySelector('.plz-tl').getBoundingClientRect().bottom - root.getBoundingClientRect().top) / uiz() + 8) + 'px'; // under the chips, however many rows they take
    if (at) { const r = root.getBoundingClientRect(), z = uiz(), w = p.offsetWidth, h = p.offsetHeight; p.style.left = Math.max(8, Math.min(r.width / z - w - 8, at[0] / z - w / 2)) + 'px'; p.style.top = Math.max(66, Math.min(r.height / z - h - 8, at[1] / z - h - 14)) + 'px'; }
  }
  const roomLabel = () => { const n = S ? S.who.size : 0; $('plz-room').innerHTML = `<i class="plz-live"></i>${S?.theme === 'winter' ? '<span class="plz-wide" aria-hidden="true">🎄</span>' : ''}<b>${L('Plaza', 'Plac')} ${S?.room || ''}</b><em>${n}/${S?.cap || CAP}</em><span class="plz-wide" aria-hidden="true">▾</span>`; };
  function roomsHtml(list) {
    return `<h3>${L('Plaza rooms', 'Pokoje placu')}</h3><p class="plz-note">${L(`Each room holds ${CAP} people.`, `W każdym pokoju mieści się ${CAP} osób.`)}</p>${S?.mod ? `<button type="button" class="btn sm w plz-showbtn" data-a="show">🎆 ${L('Start 5 minutes of fireworks', 'Włącz fajerwerki na 5 minut')}</button>` : ''}` + list.map(r => `<div class="plz-row"><b>${L('Plaza', 'Plac')} ${r.no}</b><span>${r.n}/${CAP}${r.fr ? ` · ${L(`${r.fr} ${r.fr === 1 ? 'friend' : 'friends'}`, `znajomi: ${r.fr}`)}` : ''}</span>${r.no === S.room ? `<i>${L('You are here', 'Tu jesteś')}</i>` : r.n >= CAP ? `<i>${L('Full', 'Pełny')}</i>` : `<button type="button" class="btn sm m" data-a="goroom" data-no="${r.no}">${L('Go', 'Idź')}</button>`}</div>`).join('');
  }
  function tablesHtml() {
    const open = tablesList.filter(t => t.state === 'lobby' && t.n < (t.size || t.max));
    $('plz-tbln').hidden = !open.length; $('plz-tbln').textContent = open.length;
    return `<h3>${L('Open tables', 'Otwarte stoły')}</h3><button type="button" class="btn sm m plz-showbtn" data-a="hostpick">🪧 ${L('Host a table here', 'Załóż stół tutaj')}</button>` + (open.length ? open.slice(0, 12).map(t => `<div class="plz-row"><b>${esc(ctx.gameName(t.game))}</b><span>${esc(t.host)} · ${t.n}/${t.size || t.max}</span><button type="button" class="btn sm m" data-a="join" data-code="${esc(t.code)}">${L('Join', 'Dołącz')}</button></div>`).join('')
      : `<p class="plz-note">${L('No table is waiting for players right now. Host one and your avatar stays here with a signpost for the others.', 'Nikt teraz nie czeka na graczy. Załóż stół, a twój awatar zostanie tutaj z drogowskazem dla pozostałych.')}</p>`);
  }
  function reactsHtml() {
    const mine = stickersOf(ctx.me());
    return `<div class="plz-reacts">${EMOJI.map((e, i) => `<button type="button" data-a="re" data-k="${FOODS.length + i}">${reactHtml(FOODS.length + i)}</button>`).join('')}${FOODS.map((f, i) => `<button type="button" data-a="re" data-k="${i}">${reactHtml(i)}</button>`).join('')}${mine.map(s => `<button type="button" data-a="re" data-k="${s.k}">${reactHtml(s.k)}</button>`).join('')}</div>`;
  }
  function ornHtml() {
    if (!ctx.me()?.user) return `<h3>${L('The Christmas tree', 'Choinka')}</h3><p class="plz-note">${L('Everyone with an account can hang one ornament. Make a free account to add yours.', 'Każdy, kto ma konto, może zawiesić jedną ozdobę. Załóż darmowe konto, żeby dodać swoją.')}</p><div class="plz-btns"><button type="button" class="btn sm m" data-a="acct" data-mode="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn sm w" data-a="acct" data-mode="login">${L('Log in', 'Zaloguj się')}</button></div>`;
    return `<h3>${myOrn ? L('Change your ornament', 'Zmień swoją ozdobę') : L('Hang an ornament', 'Zawieś ozdobę')}</h3><p class="plz-note">${L('One each. Everyone sees it on the tree, in every room.', 'Każdy ma jedną. Widzą ją wszyscy, w każdym pokoju.')}</p>
      <div class="plz-orns">${ORNAMENTS.map((o, i) => o ? `<button type="button" data-a="hang" data-i="${i}" aria-pressed="${i === myOrn}" aria-label="${ORN_NAME[o.id]()}" title="${ORN_NAME[o.id]()}">${ornSvg(o)}</button>` : '').join('')}</div>${myOrn ? `<button type="button" class="plz-link" data-a="hang" data-i="0">${L('Take mine down', 'Zdejmij moją')}</button>` : ''}`;
  }
  function playerHtml(p) {
    const hid = isHid(p);
    return `<h3>${nameHtml(p.n, p.fl)}</h3><div class="plz-menu">${p.pt ? `<button type="button" data-a="prof" data-pt="${esc(p.pt)}">${L('Profile', 'Profil')}</button>` : ''}
      ${p.pt ? `<button type="button" data-a="hide" data-pt="${esc(p.pt)}">${hid ? L('Show this player', 'Pokaż tego gracza') : L('Hide this player', 'Ukryj tego gracza')}</button>` : ''}
      ${S.mod ? `<button type="button" class="warn" data-a="mod" data-k="mute" data-s="${p.s}">${L('Mute for 10 minutes', 'Wycisz na 10 minut')}</button><button type="button" class="warn" data-a="mod" data-k="kick" data-s="${p.s}">${L('Remove from the plaza', 'Usuń z placu')}</button>` : ''}</div>`;
  }

  // ---- what you do
  function doEmote(e) { const def = EMOTES[e]; if (!def) return; let sp; if (def.id === 'sit') { const n = nearSeat(); if (n >= 0) sp = n; } send({ k: 'em', e, ...(sp !== undefined ? { sp } : {}) }); }
  function applyHidden() { if (!scene) return; for (const m of scene.folk().values()) scene.hide(m.s, isHid(m.p)); }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || destroyed) return;
    const a = b.dataset.a; sfx.click();
    if (a === 'home') ctx.home();
    else if (a === 'mute') { sfx.muted = !sfx.muted; b.textContent = sfx.muted ? '🔇' : '🔊'; }
    else if (a === 'chat') setChat(!chatOpen);
    else if (a === 'rooms') { if (popKind === 'rooms') return closePop(); send({ k: 'rooms' }); openPop('rooms', roomsHtml(S?.rooms || []), 'top'); b.setAttribute('aria-expanded', 'true'); }
    else if (a === 'tables') { if (popKind === 'tables') return closePop(); ctx.askTables(); openPop('tables', tablesHtml(), 'top'); b.setAttribute('aria-expanded', 'true'); }
    else if (a === 'hostpick') openPop('host', `<h3>${L('Host a table', 'Załóż stół')}</h3><p class="plz-note">${L('Pick a game. Your avatar stays where you stand with a signpost, so people in the plaza can join.', 'Wybierz grę. Twój awatar zostanie tam, gdzie stoisz, z drogowskazem, żeby osoby z placu mogły dołączyć.')}</p><div class="plz-games">${ctx.games().map(id => `<button type="button" data-a="host" data-game="${esc(id)}">${esc(ctx.gameName(id))}</button>`).join('')}</div>`, 'mid');
    else if (a === 'host') { closePop(); ctx.host(b.dataset.game); }
    else if (a === 'goroom') { closePop(); send({ k: 'join', room: +b.dataset.no }); }
    else if (a === 'join') { closePop(); ctx.join(b.dataset.code); }
    else if (a === 'emos') { const on = !root.classList.contains('emos-open'); closePop(); root.classList.toggle('emos-open', on); b.setAttribute('aria-expanded', on); }
    else if (a === 'emo') { root.classList.remove('emos-open'); doEmote(+b.dataset.e); }
    else if (a === 'moremo') { root.classList.remove('emos-open'); ctx.wardrobe(); }
    else if (a === 'view') { scene?.resetView(); b.hidden = true; }
    else if (a === 'aim') { closePop(); aiming = !aiming; paintAim(); }
    else if (a === 'ev') { if (ev) ctx.toast(ev.mid ? L("🎆 New Year's Eve at the plaza: the big fireworks start at midnight.", '🎆 Sylwester na placu: o północy zaczyna się wielki pokaz fajerwerków.') : ev.id === 'party' ? L('🎆 Saturday party: fireworks over the plaza every Saturday from 20:00 to 21:00.', '🎆 Sobotnia impreza: fajerwerki nad placem w każdą sobotę od 20:00 do 21:00.') : L('🎆 Fireworks over the plaza!', '🎆 Fajerwerki nad placem!'), false, 5000); }
    else if (a === 'show') { closePop(); send({ k: 'show' }); }
    else if (a === 'seat') doEmote(EMOTES.findIndex(x => x?.id === 'sit'));
    else if (a === 'reacts') { if (popKind === 'reacts') return closePop(); closePop(); openPop('reacts', reactsHtml(), 'corner'); b.setAttribute('aria-expanded', 'true'); }
    else if (a === 're') { send({ k: 're', i: +b.dataset.k }); closePop(); }
    else if (a === 'orn') openPop('orn', ornHtml(), 'mid');
    else if (a === 'hang') { send({ k: 'orn', i: +b.dataset.i }); closePop(); }
    else if (a === 'gift') send({ k: 'gift' });
    else if (a === 'wheel') ctx.wheel();
    else if (a === 'acct') { closePop(); ctx.account(b.dataset.mode); }
    else if (a === 'prof') { closePop(); ctx.player(b.dataset.pt); }
    else if (a === 'hide') { const pt = b.dataset.pt; if (hidden.has(pt)) hidden.delete(pt); else hidden.add(pt); LS.set('ct_plz_hide', [...hidden].slice(-200)); applyHidden(); closePop(); }
    else if (a === 'mod') { send({ k: b.dataset.k, s: +b.dataset.s }); closePop(); }
  });

  // ---- walking: keys, the joystick, and taps on the ground
  const keys = new Set(), KEY = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  let joy = null;
  const typing = () => { const el = document.activeElement; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };
  function pushMove() { if (!scene) return; if (joy) return scene.setMove(joy[0], joy[1]); let x = 0, z = 0; for (const k of keys) { x += KEY[k][0]; z += KEY[k][1]; } const l = Math.hypot(x, z); scene.setMove(l ? x / l : 0, l ? z / l : 0); }
  const onKey = e => { if ((e.code === 'KeyQ' || e.code === 'KeyE') && e.type === 'keydown' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing() && !document.querySelector('.modal')) { scene?.turn(e.code === 'KeyQ' ? -.16 : .16); return; }
    if (!KEY[e.code] || e.ctrlKey || e.metaKey || e.altKey) return; if (e.type === 'keydown') { if (typing() || document.querySelector('.modal')) return; e.preventDefault(); keys.add(e.code); $('plz-hint').hidden = true; } else keys.delete(e.code); pushMove(); };
  const onBlur = () => { keys.clear(); joy = null; pushMove(); };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('blur', onBlur);
  const joyEl = $('plz-joy'), knob = joyEl.firstChild; let joyId = null;
  const joyMove = e => { const r = joyEl.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, z = (e.clientY - r.top - R) / R; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } knob.style.transform = `translate(${(x * R * .62).toFixed(1)}px,${(z * R * .62).toFixed(1)}px)`; joy = l < .18 ? [0, 0] : [x, z]; pushMove(); };
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; joyEl.setPointerCapture(joyId); joyEl.classList.add('on'); joyMove(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy = null; knob.style.transform = ''; joyEl.classList.remove('on'); pushMove(); };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  // taps and pinches on the island itself
  const pts = new Map(); let down = null, pinch = 0, drag = null;
  function bindCanvas() {
  canvas.draggable = false; for (const ev of ['dragstart', 'selectstart']) canvas.addEventListener(ev, e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); document.activeElement?.blur?.(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, [e.clientX, e.clientY]); drag = null; if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() }; else { down = null; const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    if (popKind || root.classList.contains('emos-open')) { closePop(); down = null; } });
  canvas.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const was = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    // one finger (or the left button) dragged across the island turns the view round you
    if (pts.size === 1 && scene && (drag || (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10))) { if (!drag) { drag = true; down = null; $('plz-hint').hidden = true; } scene.turn(-(e.clientX - was[0]) * .0075, (e.clientY - was[1]) * .004); }
    if (pts.size === 2 && scene) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) scene.setZoom(scene.zoom() * d / pinch); pinch = d; } });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) drag = null; };
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerup', e => { up(e); if (!down || !scene || performance.now() - down.t > 500 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; } down = null; tap(e.clientX, e.clientY); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); scene?.setZoom(scene.zoom() * (e.deltaY > 0 ? .9 : 1.1)); }, { passive: false });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!coarse) throwAt(e.clientX, e.clientY); }); // a right click throws at once
  canvas.addEventListener('webglcontextlost', lost);
  }
  function tap(x, y) {
    if (aiming) return throwAt(x, y);
    const hit = scene.pick(x, y); if (!hit) return;
    $('plz-hint').hidden = true;
    const r = root.getBoundingClientRect();
    if (hit.kind === 'player') { const p = who(hit.s); if (p) { sfx.click(); openPop('player', playerHtml(p), 'at', [x - r.left, y - r.top - 30]); } }
    else if (hit.kind === 'pet') { send({ k: 'pat', s: hit.s, i: hit.i }); }
    else if (hit.kind === 'orn') { const o = S.tree?.find(q => q.i === hit.i); if (o) ctx.toast(L(`${esc(ORN_NAME[ORNAMENTS[o.k].id]())}, hung by ${esc(o.n)}`, `${esc(ORN_NAME[ORNAMENTS[o.k].id]())}, zawiesza: ${esc(o.n)}`)); }
    else if (hit.kind === 'tree') { const m = scene.me(); if (m && Math.hypot(m.x, m.z) < TREE_REACH) openPop('orn', ornHtml(), 'mid'); else if (m) { const d = Math.hypot(m.x, m.z) || 1; scene.walkTo(m.x / d * 4.6, m.z / d * 4.6, () => openPop('orn', ornHtml(), 'mid')); } }
    else if (hit.kind === 'thing') { if (scene.nearThing(hit.i)) useThing(hit.i); else { const p = scene.standBy(hit.i); if (p) scene.walkTo(p[0], p[1], () => useThing(hit.i)); } }
    else if (hit.kind === 'ground') scene.walkTo(hit.x, hit.z);
  }

  // A decoration you walked up to: seats seat you, the little wheel opens the Lucky Wheel, the rest react for everyone.
  function useThing(i) { const t = scene?.thingAt(i); if (!t) return;
    if ((t.kind === 'bench' || t.kind === 'haybale' || t.kind === 'carousel' || t.kind === 'swing') && scene.me()?.sp < 0 && nearSeat() >= 0) return doEmote(EMOTES.findIndex(x => x?.id === 'sit'));
    if (t.kind === 'miniwheel') return ctx.wheel();
    send({ k: 'poke', i }); }

  // ---- the server's messages
  function start(m) {
    S = { room: m.room, cap: m.cap, me: m.me, theme: m.theme, who: new Map(m.who.map(p => [p.s, p])), rooms: m.rooms || [], tree: m.tree || [], mod: !!m.mod };
    gift = !!m.gift; myOrn = 0;
    for (const s of [...tags.keys()]) dropTag(s); for (const c of [...signs.keys()]) dropSign(c);
    if (scene && (scene.theme !== m.theme || scene.lost())) { const old = canvas; canvas = old.cloneNode(false); scene.destroy(); scene = null; old.replaceWith(canvas); pts.clear(); bindCanvas(); } // a scene gives its GPU context back when it goes, so the new one gets a new canvas
    if (!scene) scene = createScene(canvas, { theme: m.theme, send, frame, ready: () => { $('plz-load').hidden = true; } });
    giftN = m.giftN | 0; setEv(m.ev); paintAim();
    if (m.visit) { const got = COS.em.items.findIndex(it => it.earn?.pv === m.visit); // today's first visit: say how many days that makes, and what it unlocked
      if (got > 0) { sfx.win?.(); ctx.toast(L(`🎉 Day ${m.visit} at the plaza: you unlocked the ${esc(cosItem('em', got).n)} emote! Put it on your bar in the Wardrobe.`, `🎉 ${m.visit}. dzień na placu: odblokowano emotkę ${esc(cosItem('em', got).n)}! Ustaw ją na pasku w Garderobie.`), false, 7000); }
      else { const nx = COS.em.items.map((it, i) => [it.earn?.pv | 0, i]).filter(([d, i]) => d > m.visit && !cosHas(ctx.me(), 'em', i)).sort((a, b) => a[0] - b[0])[0];
        if (nx) ctx.toast(L(`Day ${m.visit} at the plaza. Come on ${nx[0]} different days to unlock the ${esc(cosItem('em', nx[1]).n)} emote.`, `${m.visit}. dzień na placu. Przyjdź w ${nx[0]} różnych dniach, żeby odblokować emotkę ${esc(cosItem('em', nx[1]).n)}.`), false, 5000); } }
    scene.setPeople(m.who, m.me); scene.setTree(m.tree || []);
    const mine = who(m.me); myOrn = (m.tree || []).find(o => o.pt && o.pt === mine?.pt)?.k || 0;
    for (const p of m.who) paintTag(p); for (const g of m.signs || []) paintSign(g);
    applyHidden(); roomLabel(); paintActs(); pushMove();
    root.classList.toggle('winter', m.theme === 'winter');
  }
  function msg(m) {
    if (destroyed || m.t !== 'plaza') return;
    if (m.k === 'in') return start(m);
    if (m.k === 'out') { ctx.toast(L(`A host removed you from the plaza. You can come back in ${m.mins} minutes.`, `Gospodarz usunął cię z placu. Możesz wrócić za ${m.mins} min.`), true, 5000); return ctx.home(); }
    if (m.k === 'err') { sfx.bad(); return ctx.toast(esc(srvText(m.msg)), true); }
    if (!S || !scene) return;
    switch (m.k) {
      case 'p': for (const [s, x, z, r] of m.m) scene.moved(s, x, z, r); break;
      case 'add': S.who.set(m.p.s, m.p); scene.add(m.p); scene.hide(m.p.s, isHid(m.p)); paintTag(m.p); roomLabel(); break;
      case 'del': S.who.delete(m.s); scene.remove(m.s); dropTag(m.s); roomLabel(); break;
      case 'look': { const old = who(m.p.s); if (!old) break; S.who.set(m.p.s, { ...old, ...m.p }); scene.look(m.p); paintTag(S.who.get(m.p.s)); break; }
      case 'em': scene.emote(m.s, m.e, m.sp); if (m.s === S.me) { paintActs(); } if (EMOTES[m.e]?.id === 'cheer' || EMOTES[m.e]?.id === 'jump') sfx.pop?.(); break;
      case 're': if (!isHid(who(m.s))) floaty(m.s, m.i); break;
      case 'pat': scene.pat(m.s, m.i); break;
      case 'poke': { const t = scene.thingAt(m.i); if (t && !isHid(who(m.s))) { scene.poke(m.i); floatAt(t.x, Math.min(t.h, 3.4) + .4, t.z, POKE[t.kind] || '✨'); if (m.s === S.me) sfx.pop?.(); } break; }
      case 'pal': sfx.pop?.(); ctx.toast(L(`💛 +1 friendship with ${esc(m.n)} on the Pet Farm`, `💛 +1 do przyjaźni z ${esc(m.n)} na Farmie zwierzaków`)); break;
      case 'sb': if (!isHid(who(m.s))) { scene.throwBall(m.s, m.x, m.z, m.h); if (m.s === S.me || m.h === S.me) sfx.pop?.(); } break;
      case 'ev': setEv(m.ev); break;
      case 'fix': scene.fix(m.x, m.z); break;
      case 'rooms': S.rooms = m.rooms; if (popKind === 'rooms') $('plz-pop').innerHTML = roomsHtml(m.rooms); break;
      case 'orn': { S.tree = S.tree.filter(o => o.i !== m.i); if (m.o) S.tree.push(m.o); scene.setOrn(m.i, m.o); const mine = who(S.me); if (mine?.pt) myOrn = S.tree.find(o => o.pt === mine.pt)?.k || 0; paintActs(); break; }
      case 'gift': gift = !!m.left; paintActs(); if (m.coins) { sfx.win?.(); ctx.toast(L(`🎁 Your present today: ${m.coins} coins. Come back tomorrow for another!`, `🎁 Twój dzisiejszy prezent: ${m.coins} monet. Jutro czeka następny!`), false, 4500); } break;
      case 'sign': if (m.gone) dropSign(m.gone); else { const fresh = !signs.has(m.g.code); paintSign(m.g); if (fresh) { sfx.join?.(); ctx.toast(L(`${esc(m.g.n)} is hosting ${esc(ctx.gameName(m.g.game))}. Tap the signpost to join.`, `${esc(m.g.n)} zaprasza do gry ${esc(ctx.gameName(m.g.game))}. Dotknij drogowskazu, by dołączyć.`)); } } break;
      case 'muted': ctx.toast(L(`A host muted you for ${m.mins} minutes.`, `Gospodarz wyciszył cię na ${m.mins} min.`), true, 5000); break;
      case 'done': ctx.toast(m.what === 'mute' ? L(`${esc(m.n)} is muted for 10 minutes.`, `${esc(m.n)}: wyciszenie na 10 minut.`) : L(`${esc(m.n)} was removed for 10 minutes.`, `${esc(m.n)}: usunięcie z placu na 10 minut.`)); break;
    }
  }
  // A new chat line: if its writer stands in this room, it also pops up over their head.
  function chat(line) {
    if (!S || !line) return;
    if (!chatOpen && !line.own) { unread++; $('plz-unread').hidden = false; }
    if (!line.pt || hidden.has(line.pt)) return;
    for (const p of S.who.values()) if (p.pt === line.pt) { bubble(p.s, srvTextSafe(line)); break; }
  }
  const srvTextSafe = line => Array.isArray(line.grid) ? srvText(line.text) : line.text;
  // The graphics card dropped the picture (a sleeping phone, a driver hiccup): ask for the room again and draw it afresh.
  function lost(e) { e.preventDefault(); const cv = e.target; setTimeout(() => { if (!destroyed && S && cv === canvas) send({ k: 'join', room: S.room }); }, 500); }
  bindCanvas();

  send({ k: 'join' });
  return {
    msg, chat,
    me() { $('hc-foot').innerHTML = ctx.chatFoot(); paintActs(); paintEmos(); },
    tables(rooms) { tablesList = rooms || []; const html = tablesHtml(); if (popKind === 'tables') $('plz-pop').innerHTML = html; },
    reopen() { send({ k: 'join', ...(S ? { room: S.room } : {}) }); },
    stats: () => scene?.stats(), scene: () => scene,
    destroy() { destroyed = true; clearInterval(actsT); clearInterval(evT); send({ k: 'leave' }); removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', onBlur); scene?.destroy(); scene = null; document.body.classList.remove('in-game'); },
  };
}
