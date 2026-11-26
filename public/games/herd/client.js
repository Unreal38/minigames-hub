// Pet Herds game view: HUD over the 3D table. Your tray is a panel at the bottom; the groups lie on the table.
// Tap tiles to pick them (from the tray or the table), then tap a group to add them, the cloth for a new group, or
// the tray to take them back. Dragging works too. Each move is sent at once, so everyone watches the table change.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { petPics } from '../../petpic.js';
import { uiz } from '../../uiz.js';
import { move, turnCheck, fits, tilesOn, byNum, byPet, trayValue, check } from './rules.js';
import { tileHtml, warmPets } from './tiles.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  tile: '<svg class="hd-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="3"/></svg>',
};
const tilesWord = n => cnt(n, 'tile', 'tiles', 'płytka', 'płytki', 'płytek');
const ptsTxt = n => L(`${n > 0 ? '+' : ''}${n} pt${Math.abs(n) === 1 ? '' : 's'}`, `${n > 0 ? '+' : ''}${n} pkt`);
const SORT_KEY = 'hd-sort';
const getSort = () => { try { return localStorage.getItem(SORT_KEY) === 'pet' ? 'pet' : 'num'; } catch { return 'num'; } };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./herd.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="hd">
    <canvas class="g3d" aria-label="${L('The table of tiles', 'Stół z płytkami')}"></canvas>
    <div class="glabs" aria-hidden="true"></div>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="hd-info"></span></div>
      <div class="tr"><span class="tcode" id="hd-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="banner" id="hd-banner" aria-live="polite"><span></span><i class="bar"></i></div>
      <div class="shout" id="hd-big" aria-live="assertive"></div>
      <div class="hd-dock" id="hd-dock">
        <div class="hd-say" id="hd-say" aria-live="polite"></div>
        <div class="hd-panel" id="hd-panel" hidden>
          <div class="hd-head"><span class="hd-meter" id="hd-meter"></span>
            <span class="hd-sorts" role="group" aria-label="${L('Sort your tray', 'Sortuj tackę')}"><button type="button" data-a="sort" data-v="num"></button><button type="button" data-a="sort" data-v="pet"></button></span></div>
          <div class="hd-tray" id="hd-tray" data-drop="rack"></div>
          <div class="hd-acts" id="hd-acts"></div>
        </div>
      </div>
    </div>
    <div class="hd-ghost" aria-hidden="true"></div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="hd-round" hidden></div>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.hd'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), labsEl = root.querySelector('.glabs'), ghost = root.querySelector('.hd-ghost');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sortBy = getSort();
  let sel = new Set(), seenRack = null, newTiles = new Map(), localMv = 0, roundShown = 0;
  const bubbles = new Map();
  const labEls = new Map(); // group id -> label element

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); paintMarks(); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });
  warmPets();

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'turn' && S.turn === S.me && me() && !me().bot && S.snapRack);
  const mineSet = () => new Set(S.snapRack || []);
  const locked = () => !me()?.opened;
  const onTable = () => new Set(tilesOn(S.table));
  const groupOf = t => S.table.find(g => g.t.includes(t))?.id;
  // tiles you may pick up: your tray's, and before your first play only the ones you put down this turn
  const canTake = t => myTurn() && (S.rack.includes(t) || (onTable().has(t) && (!locked() || mineSet().has(t))));
  const check0 = () => (myTurn() ? turnCheck({ table: S.snapTable, rack: S.snapRack }, { table: S.table, rack: S.rack }, me().opened, S.open) : null);

  // Portrait phones: the other players sit in a strip under the banner instead of tags over the table.
  const compact = () => innerWidth < 700 && innerHeight > innerWidth;
  function onFrame(info) {
    live = info;
    if (!tagsEl.classList.contains('strip')) for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150 * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
    const z = uiz();
    for (const [id, el] of labEls) {
      const g = info.groups.get(id);
      if (!g) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = '';
      el.style.transform = `translate(${(g.x / z).toFixed(1)}px, ${(g.y / z).toFixed(1)}px) translate(-50%, -35%)`;
    }
  }
  function layout() {
    const strip = compact();
    if (tagsEl.classList.contains('strip') !== strip) { tagsEl.classList.toggle('strip', strip); for (const el of tagEls) { el.style.transform = ''; el._w = el.offsetWidth; } }
    const top = strip ? tagsEl.getBoundingClientRect().bottom + 6 : (innerWidth < 700 ? 118 : 74) * uiz();
    if (scene) scene.setHud(($('hd-dock').offsetHeight + 18) * uiz(), top);
  }

  // ----- name tags -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="hd-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const now = performance.now();
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play' && S.stage === 'turn');
      el.classList.toggle('low', S.ph === 'play' && p.n > 0 && p.n <= 3);
      setHtml(el.querySelector('.plate .cnt'), `${I.tile}${p.n}${S.rounds > 1 ? `<small>${p.total}</small>` : ''}`);
      const b = bubbles.get(i);
      setHtml(el.firstElementChild, b && b.until > now ? b.html : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function bubble(i, html, ms = 1900) { bubbles.set(i, { html, until: performance.now() + ms }); setTimeout(() => !destroyed && S && buildTags(), ms + 30); if (S) buildTags(); }

  // ----- labels under the groups: what the set is worth, or that it is not a set yet -----
  function renderLabels() {
    const turn = myTurn(), wide = innerWidth >= 700, fit = fitSet();
    const want = new Map();
    for (const g of S.table) {
      const c = check(g.t), isFit = turn && sel.size && fit.has(g.id) && !g.t.some(t => sel.has(t));
      let html = '', cls = 'glab';
      if (!c) { html = L('Not a set yet', 'To jeszcze nie układ'); cls += ' bad'; }
      else if (isFit) { html = L('+ Add here', '+ Dołóż tutaj'); cls += ' fit'; }
      else if (wide || (turn && locked())) html = `${c.kind === 'herd' ? L('Herd', 'Stadko') : L('Line', 'Rząd')} · ${c.value}`;
      if (html) want.set(g.id, { html, cls, fit: isFit });
    }
    for (const [id, el] of labEls) if (!want.has(id)) { el.remove(); labEls.delete(id); }
    for (const [id, w] of want) {
      let el = labEls.get(id);
      if (!el) { el = document.createElement('div'); el.dataset.g = id; labsEl.append(el); labEls.set(id, el); el.style.visibility = 'hidden'; }
      if (el.className !== w.cls) el.className = w.cls;
      setHtml(el, w.html);
    }
  }

  // ----- your tray and buttons -----
  const sorted = ids => ids.slice().sort(sortBy === 'pet' ? byPet : byNum);
  function renderPanel() {
    const panel = $('hd-panel'), p = me();
    const show = !!(S && S.ph === 'play' && p);
    panel.hidden = !show;
    if (!show) { setHtml($('hd-say'), sayHtml()); return; }
    const turn = myTurn(), now = performance.now();
    for (const [t, until] of newTiles) if (until < now) newTiles.delete(t);
    const rack = sorted(S.rack);
    $('hd-tray').classList.toggle('many', rack.length > 21);
    setHtml($('hd-tray'), rack.length ? rack.map(t => tileHtml(t, `${sel.has(t) ? 'sel' : ''}${newTiles.has(t) ? ' new' : ''}${turn ? '' : ' idle'}`, L)).join('')
      : `<span class="hd-empty">${turn ? L('Tray empty! Press Done to win the round.', 'Tacka pusta! Naciśnij Gotowe, żeby wygrać rundę.') : L('Your tray is empty', 'Twoja tacka jest pusta')}</span>`);
    petPics($('hd-tray'));
    panel.classList.toggle('mine', turn);
    const sm = innerWidth < 560;
    root.querySelectorAll('.hd-sorts button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.v === sortBy); const t = b.dataset.v === 'num' ? (sm ? '1–13' : L('Sort 1–13', 'Sortuj 1–13')) : sm ? L('Pets', 'Zwierzaki') : L('Sort by pet', 'Sortuj wg zwierzaka'); if (b.textContent !== t) b.textContent = t; });
    // the meter: the first play's points, or what your tray is worth
    const c = check0();
    let meter;
    if (!p.opened && S.open) {
      const v = c ? c.val : 0, pct = Math.min(100, v / S.open * 100);
      meter = `<span class="hd-open${v >= S.open ? ' ok' : ''}"><span>${sm ? L('First play', 'Wyjście') : L('First play', 'Pierwsze wyjście')}</span><span class="hd-bar"><i style="width:${pct}%"></i></span><b>${v} / ${S.open}</b></span>`;
    } else meter = `<span>${L(`In your tray: ${tilesWord(S.rack.length)}`, `Na tacce: ${tilesWord(S.rack.length)}`)}</span>`;
    setHtml($('hd-meter'), meter);
    // buttons
    let acts = '';
    if (turn) {
      const moved = c.placed || S.table.some((g, i) => S.snapTable[i]?.id !== g.id || S.snapTable[i]?.t.join() !== g.t.join()) || S.table.length !== S.snapTable.length;
      const backOk = sel.size && [...sel].every(t => mineSet().has(t) && onTable().has(t));
      const sm = innerWidth < 560; // phones: short labels, so all the buttons fit on one line
      acts = `<button type="button" class="hd-b alt" data-a="undo"${moved ? '' : ' disabled'} aria-label="${L('Undo turn', 'Cofnij turę')}">${sm ? L('Undo', 'Cofnij') : L('Undo turn', 'Cofnij turę')}</button>`
        + (sel.size ? `<button type="button" class="hd-b alt" data-a="new" aria-label="${L('New group', 'Nowa grupa')}">${sm ? L('New', 'Nowa') : L('New group', 'Nowa grupa')}</button>` : '')
        + (backOk ? `<button type="button" class="hd-b alt" data-a="back">${sm ? L('To tray', 'Na tackę') : L('Back to tray', 'Na tackę')}</button>` : '')
        + `<span class="grow"></span>`
        + `<button type="button" class="hd-b alt" data-a="draw" title="${moved ? L('Puts the table back and takes a tile', 'Odkłada stół jak był i dobiera płytkę') : ''}">${S.pool ? (sm ? L('Draw', 'Dobierz') : L('Draw a tile', 'Dobierz płytkę')) : L('Pass', 'Pas')}</button>`
        + `<button type="button" class="hd-b go" data-a="done"${c.ok ? '' : ' disabled'}>${L('Done', 'Gotowe')}</button>`;
    }
    setHtml($('hd-acts'), acts);
    $('hd-acts').hidden = !turn;
    setHtml($('hd-say'), sayHtml(c));
  }
  function sayHtml(c = check0()) {
    if (!S || S.ph !== 'play') return '';
    if (S.stage === 'deal') return `<span class="hd-wait"><span>${L('Dealing the tiles…', 'Rozdawanie płytek…')}</span></span>`;
    if (S.stage === 'round') return '';
    if (myTurn()) {
      let t, hot = false;
      if (sel.size) t = L(`${tilesWord(sel.size)} picked: tap a group to add ${sel.size === 1 ? 'it' : 'them'}, or the cloth for a new group`, `Wybrane: ${tilesWord(sel.size)}. Dotknij grupy, żeby dołożyć, albo sukna, żeby zacząć nową`);
      else if (c.why === 'none') t = locked() && S.open ? L(`Lay new herds and lines from your tray worth ${S.open} or more, or draw a tile`, `Wyłóż z tacki nowe stadka i rzędy warte co najmniej ${S.open} albo dobierz płytkę`) : L('Pick tiles from your tray and put them on the table, or draw a tile', 'Wybierz płytki z tacki i połóż je na stole albo dobierz płytkę');
      else if (c.why === 'bad') t = L(c.bad === 1 ? 'One group is not a set yet' : `${c.bad} groups are not sets yet`, c.bad === 1 ? 'Jedna grupa nie jest jeszcze układem' : `Grupy, które nie są jeszcze układem: ${c.bad}`);
      else if (c.why === 'mixed') t = L('Before your first play is in, use only tiles from your own tray', 'Dopóki nie wyjdziesz pierwszy raz, używaj tylko płytek z własnej tacki');
      else if (c.why === 'low') t = L(`Your first play must be worth ${S.open}. So far: ${c.val}`, `Pierwsze wyjście musi być warte ${S.open}. Na razie: ${c.val}`);
      else { t = S.rack.length ? L('Every group is a set. Press Done!', 'Wszystkie grupy są układami. Naciśnij Gotowe!') : L('That’s your last tile. Press Done!', 'To twoja ostatnia płytka. Naciśnij Gotowe!'); hot = true; }
      return `<span class="hd-hint${hot ? ' hot' : c.why === 'bad' || c.why === 'low' || c.why === 'mixed' ? ' warn' : ''}">${t}</span>`;
    }
    if (S.turn >= 0) {
      const w = S.seats[S.turn];
      const txt = S.turn === S.me ? (me()?.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is playing…`, `${nameOf(S.turn)} gra…`);
      return `<span class="hd-wait">${avatarHtml(w.color, w.av, 30)}<span>${txt}</span></span>`;
    }
    return '';
  }

  function renderBanner() {
    const el = $('hd-banner'), span = el.firstElementChild, bar = el.lastElementChild;
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    let msg = '';
    if (S.ph === 'end') msg = '';
    else if (S.stage === 'deal') msg = S.turn === S.me ? L('Dealing · you start', 'Rozdanie · zaczynasz') : L(`Dealing · ${nameOf(S.turn)} starts`, `Rozdanie · zaczyna ${nameOf(S.turn)}`);
    else if (S.stage === 'round') msg = S.rounds > 1 ? L(`Round ${S.round} of ${S.rounds} is over`, `Koniec rundy ${S.round} z ${S.rounds}`) : L('Round over', 'Koniec rundy');
    else if (myTurn()) msg = L('Your turn', 'Twoja kolej') + (S.tLeft >= 0 ? ` · ${secs}s` : '');
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    setHtml(span, msg);
    el.hidden = !msg;
    el.classList.toggle('hot', myTurn());
    el.classList.toggle('late', myTurn() && S.tLeft >= 0 && secs <= 5);
    const timed = myTurn() && S.tLeft >= 0 && S.timer;
    bar.style.width = timed ? `${Math.max(0, Math.min(100, (endsAt - performance.now()) / (S.timer * 10)))}%` : '0';
  }

  function render() {
    if (!S) return;
    setHtml($('hd-info'), `${S.rounds > 1 ? L(`Round ${S.round} of ${S.rounds}`, `Runda ${S.round} z ${S.rounds}`) : L('Pet Herds', 'Stadka')}<span class="hd-n"> · ${L(`${S.pool} in the pile`, `w stosie: ${S.pool}`)}</span>`);
    $('hd-code').textContent = Rm?.code || '';
    buildTags(); renderPanel(); renderLabels(); renderBanner(); paintMarks();
    layout();
  }

  // ----- what's picked and where it would fit -----
  function fitSet() {
    if (!myTurn() || !sel.size) return new Set();
    return new Set(fits(S.table, [...sel], mineSet(), locked()));
  }
  function paintMarks(drop = null) {
    if (!scene || !S) return;
    const show = S.hints !== 'off';
    scene.setMarks({ sel: new Set([...sel].filter(t => onTable().has(t))), fit: show ? fitSet() : new Set(), drop });
  }
  function clearSel() { if (sel.size) { sel.clear(); render(); } }
  function toggle(t) {
    if (!canTake(t)) { if (myTurn()) { sfx.bad?.(); flashSay(L('Before your first play is in, you can only move your own tiles', 'Dopóki nie wyjdziesz pierwszy raz, możesz ruszać tylko własne płytki')); } return; }
    if (sel.has(t)) sel.delete(t); else sel.add(t);
    sfx.click(); render();
  }
  let sayTimer = 0;
  function flashSay(text) {
    const el = $('hd-say'); el._h = ''; el.innerHTML = `<span class="hd-hint warn">${text}</span>`;
    clearTimeout(sayTimer); sayTimer = setTimeout(() => !destroyed && renderPanel(), 2200);
  }

  // Move tiles: done here at once (the same rules as the server), then sent.
  function doMove(ids, to) {
    if (!myTurn() || !ids.length) return false;
    const W = move({ table: S.table, rack: S.rack, nid: S.nid }, ids, to, mineSet(), locked());
    if (!W) { sfx.bad?.(); return false; }
    const mine = mineSet();
    S = { ...S, table: W.table, rack: W.rack, nid: W.nid, fresh: tilesOn(W.table).filter(t => mine.has(t)), mv: S.mv + (++localMv) / 1000 };
    S.seats = S.seats.map((p, i) => (i === S.me ? { ...p, n: W.rack.length } : p));
    sel.clear();
    ctx.act({ t: 'mv', ids, to });
    to === 'rack' ? sfx.plop?.() : sfx.place();
    scene?.setState(S); render();
    const c = check0(); if (c?.ok && c.placed) sfx.pop?.();
    return true;
  }
  function tapGroup(g) {
    if (!myTurn() || !sel.size) return false;
    const grp = S.table.find(x => x.id === g); if (!grp) return false;
    if ([...sel].every(t => grp.t.includes(t))) return false;
    return doMove([...sel], g);
  }

  // ----- the big shout -----
  function big(text, sub = '', ms = 1500) {
    const el = $('hd-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'deal') { sfx.draw(); }
    else if (e.t === 'play') {
      scene?.playFx(e.groups, e.s);
      sfx.set?.();
      const extra = e.first ? L('First play!', 'Pierwsze wyjście!') : e.rebuilt ? L('Rebuilt the table!', 'Przebudowa stołu!') : '';
      if (e.s === S.me) { if (extra) big(extra, L(`You played ${tilesWord(e.tiles.length)}`, `Zagrywasz: ${tilesWord(e.tiles.length)}`), 1300); }
      else bubble(e.s, `<span class="${extra ? 'hot' : ''}">${extra ? extra + ' ' : ''}+${e.tiles.length}</span>`);
    } else if (e.t === 'draw' || e.t === 'late') {
      if (e.drew) sfx.draw(); else sfx.plop?.();
      if (e.s === S.me) { if (e.t === 'late') big(L('Out of time!', 'Koniec czasu!'), e.drew ? L('The table goes back and you draw a tile', 'Stół wraca, a ty dobierasz płytkę') : L('The table goes back', 'Stół wraca jak był'), 1500); }
      else bubble(e.s, `<span>${e.t === 'late' ? L('Too slow!', 'Za wolno!') + ' ' : ''}${e.drew ? L('drew a tile', 'dobiera') : L('passed', 'pas')}</span>`);
      scene?.cue(e.s, 'nod');
    } else if (e.t === 'round') {
      scene?.roundFx(e.wins);
      const mine = e.wins.includes(S.me);
      if (mine) { sfx.win(); if (S.ph !== 'end') confetti(); } else sfx.lose?.();
      if (S.ph !== 'end') {
        big(e.out >= 0 ? (e.out === S.me ? L('You went out!', 'Wychodzisz!') : L(`${nameOf(e.out)} went out!`, `${nameOf(e.out)} wychodzi!`)) : L('The pile is empty', 'Stos jest pusty'),
          e.out >= 0 ? L('The others pay what is left in their trays', 'Reszta płaci za to, co ma na tacce') : L('The smallest tray wins the round', 'Rundę wygrywa najmniejsza tacka'), 2000);
        setTimeout(() => !destroyed && showRound(), 1600);
      }
    } else if (e.t === 'end') {
      const won = S.res?.place[S.me] === 1;
      if (won) { sfx.win(); confetti(); } else sfx.lose?.();
      const firsts = S.res ? S.seats.map((_, i) => i).filter(i => S.res.place[i] === 1) : [];
      const last = S.rd;
      big(won ? (firsts.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : L(`${nameOf(S.win)} wins!`, `${nameOf(S.win)} wygrywa!`),
        last?.out >= 0 ? (last.out === S.me ? L('You went out first', 'Wychodzisz pierwszy') : L(`${nameOf(last.out)} went out first`, `${nameOf(last.out)} wychodzi pierwszy`)) : L('The pile ran out', 'Skończył się stos'), 2200);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage : '';
    S = s; localMv = 0;
    if (fresh) {
      gid = s.gid; hideResults(); hideRound(); clearTimeout(resultsTimer); lastTick = -1; bubbles.clear(); sel.clear(); seenRack = null; newTiles.clear();
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'round') showRound();
    }
    // a tile you just drew glows in your tray for a moment (not the deal: that's all of them)
    if (seenRack && !fresh && s.round === seenRack.round && s.stage !== 'deal') for (const t of s.rack) if (!seenRack.has(t)) newTiles.set(t, performance.now() + 2600);
    seenRack = new Set(s.snapRack || s.rack); seenRack.round = s.round;
    if (s.stage !== 'turn' || s.turn !== s.me) sel.clear();
    for (const t of [...sel]) if (!s.rack.includes(t) && !onTable().has(t)) sel.delete(t);
    endsAt = performance.now() + Math.max(0, s.tLeft);
    const now = s.turn + '/' + s.stage;
    if (!fresh && myTurn() && was !== now) { sfx.turn(); lastTick = -1; }
    if (s.stage === 'deal') hideRound();
    render(); scene?.setState(s); paintMarks();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- between rounds: who went out, what everyone pays -----
  function trayRow(ids) { return `<span class="hd-mini">${ids.slice().sort(byNum).map(t => tileHtml(t, 'mini', L, 'span')).join('')}</span>`; }
  function showRound() {
    if (!S?.rd || S.ph !== 'play' || S.stage !== 'round' || roundShown === S.rd.round + S.gid) return;
    roundShown = S.rd.round + S.gid;
    const el = root.querySelector('.hd-round'), R = S.rd;
    const ord = S.seats.map((_, i) => i).sort((a, b) => S.seats[b].total - S.seats[a].total);
    el.innerHTML = `<div class="sheet"><h2>${L(`Round ${R.round} of ${S.rounds}`, `Runda ${R.round} z ${S.rounds}`)}</h2>
      <p>${R.out >= 0 ? (R.out === S.me ? L('You emptied your tray!', 'Opróżniasz tackę!') : L(`${nameOf(R.out)} emptied their tray`, `${nameOf(R.out)} opróżnia tackę`)) : L('The pile ran out: the smallest tray wins', 'Skończył się stos: wygrywa najmniejsza tacka')}</p>
      <ol class="score">${ord.map(i => { const p = S.seats[i]; return `<li class="${R.wins.includes(i) ? 'won' : ''}">${avatarHtml(p.color, p.av, 38, frameCls(p.fl))}<div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>${R.racks[i].length ? trayRow(R.racks[i]) : `<span>${L('Tray empty', 'Pusta tacka')}</span>`}</div><strong><span class="${R.pts[i] >= 0 ? 'up' : 'down'}">${ptsTxt(R.pts[i])}</span><small>${L(`total ${p.total}`, `razem ${p.total}`)}</small></strong></li>`; }).join('')}</ol>
      <p class="hd-next">${L('Next round starts in a moment…', 'Następna runda za chwilę…')}</p></div>`;
    petPics(el); el.hidden = false;
  }
  function hideRound() { root.querySelector('.hd-round').hidden = true; }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    hideRound();
    const el = root.querySelector('.results'), n = S.seats.length, place = S.res.place;
    const firsts = S.seats.map((_, i) => i).filter(i => place[i] === 1);
    const head = firsts.includes(S.me) ? (firsts.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : firsts.length > 1 ? L('A shared win', 'Wspólna wygrana') : L(`${nameOf(S.win)} wins!`, `${nameOf(S.win)} wygrywa!`);
    const mine = S.me >= 0 ? place[S.me] : 0;
    const sub = mine > 1 ? L(`You came ${mine} of ${n}.`, `Twoje miejsce: ${mine} z ${n}.`) : firsts.length > 1 ? L('Equal points share first place.', 'Równe punkty dzielą pierwsze miejsce.') : '';
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      ${sub ? `<p>${sub}</p>` : ''}
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = p.st, left = S.rd?.racks[i] || [];
        return `<li class="${place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${tilesWord(st.played)} played · ${st.drawn} drawn`, `zagrane: ${tilesWord(st.played)} · dobrane: ${st.drawn}`)}${st.rebuilt ? L(` · ${st.rebuilt} rebuilt`, ` · przebudowy: ${st.rebuilt}`) : ''}</span>
          ${left.length ? trayRow(left) : ''}</div>
          <strong><span>${ptsTxt(S.res.total[i])}</span></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'))}</div></div>`;
    petPics(el);
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const k = (Rm?.again || []).length;
    if (k > votes) sfx.pop();
    votes = k; box.innerHTML = againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .55;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return;
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
    const cols = ['#2f8a43', '#d24a1f', '#1f74bb', '#a87800', '#fff4e2', '#b07ad6'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
    let t = 0;
    const step = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0;
    };
    step();
  }

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (newTiles.size && [...newTiles.values()].some(u => u < performance.now())) renderPanel();
    if (myTurn() && S.tLeft >= 0) {
      const k = Math.ceil((endsAt - performance.now()) / 1000);
      if (k !== lastTick && k <= 5 && k > 0) { lastTick = k; sfx.tick(); }
    }
  }, 200);

  // ----- input: tap to pick and place, or drag -----
  let press = null; // { id, from: 'tray'|'table', x, y, drag: false, ids }
  const DRAG_PX = 9;
  function pressAt(e, id, from) {
    if (!myTurn() || e.button > 0) return;
    press = { id, from, x: e.clientX, y: e.clientY, drag: false, pid: e.pointerId };
  }
  function startDrag() {
    const ids = sel.has(press.id) ? [...sel] : [press.id];
    if (!ids.every(canTake)) { press = null; return; }
    press.drag = true; press.ids = ids;
    if (!sel.has(press.id)) { sel = new Set(ids); render(); }
    ghost.innerHTML = ids.slice(0, 6).map(t => tileHtml(t, 'ghost', L, 'span')).join('') + (ids.length > 6 ? `<em>+${ids.length - 6}</em>` : '');
    petPics(ghost);
    ghost.classList.add('on'); sfx.click();
  }
  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el?.closest('.hd-panel')) return { to: 'rack' };
    const lab = el?.closest('.glab'); if (lab) return { to: +lab.dataset.g };
    if (el !== canvas || !scene) return null;
    const p = scene.pick(x, y);
    if (p?.g !== undefined && p.g !== null) return { to: p.g };
    return { to: 'new' };
  }
  function moveGhost(x, y) {
    const z = uiz(); ghost.style.transform = `translate(${(x / z).toFixed(1)}px, ${(y / z).toFixed(1)}px) translate(-50%, -80%)`;
    const d = dropTarget(x, y);
    paintMarks(d && typeof d.to === 'number' ? d.to : null);
    root.querySelector('.hd-panel')?.classList.toggle('drop', d?.to === 'rack' && press.ids.some(t => onTable().has(t)));
  }
  addEventListener('pointermove', onMove);
  function onMove(e) {
    if (!press || e.pointerId !== press.pid) return;
    if (!press.drag && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_PX) startDrag();
    if (press?.drag) { e.preventDefault(); moveGhost(e.clientX, e.clientY); }
  }
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onCancel);
  function onCancel() { if (press?.drag) endDrag(); press = null; }
  function endDrag() { ghost.classList.remove('on'); ghost.innerHTML = ''; root.querySelector('.hd-panel')?.classList.remove('drop'); paintMarks(); }
  function onUp(e) {
    if (!press || e.pointerId !== press.pid) return;
    const p = press; press = null;
    if (!p.drag) return; // a tap: the click handlers deal with it
    endDrag();
    const d = dropTarget(e.clientX, e.clientY);
    suppressClick = performance.now() + 350;
    if (!d) return;
    if (d.to === 'rack') { const ids = p.ids.filter(t => onTable().has(t)); if (ids.length) doMove(ids, 'rack'); else clearSel(); return; }
    if (d.to === 'new' || typeof d.to === 'number') {
      if (typeof d.to === 'number' && p.ids.every(t => S.table.find(g => g.id === d.to)?.t.includes(t))) { clearSel(); return; }
      doMove(p.ids, d.to);
    }
  }
  let suppressClick = 0;

  $('hd-tray').addEventListener('pointerdown', e => { const b = e.target.closest('.hd-t'); if (b) pressAt(e, +b.dataset.t, 'tray'); });
  canvas.addEventListener('pointerdown', e => {
    if (!scene || !myTurn()) return;
    const p = scene.pick(e.clientX, e.clientY);
    if (p?.t !== undefined && canTake(p.t)) pressAt(e, p.t, 'table');
  });
  canvas.addEventListener('click', e => {
    if (!scene || !myTurn() || performance.now() < suppressClick) return;
    const p = scene.pick(e.clientX, e.clientY);
    if (!p) { clearSel(); return; }
    if (p.t !== undefined) {
      // a tile: with tiles picked elsewhere and a fit here, they join its group; otherwise the tile is picked or dropped
      if (sel.size && !sel.has(p.t) && ![...sel].every(t => groupOf(t) === p.g) && fitSet().has(p.g)) { tapGroup(p.g); return; }
      toggle(p.t); return;
    }
    if (p.g !== undefined) { if (!tapGroup(p.g)) clearSel(); return; }
    if (p.cloth) { if (sel.size) doMove([...sel], 'new'); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene || press) return;
    const p = myTurn() ? scene.pick(e.clientX, e.clientY) : null;
    canvas.style.cursor = p && ((p.t !== undefined && canTake(p.t)) || (sel.size && (p.g !== undefined || p.cloth))) ? 'pointer' : '';
  });
  labsEl.addEventListener('click', e => { const l = e.target.closest('.glab.fit'); if (l) tapGroup(+l.dataset.g); });
  $('hd-tray').addEventListener('click', e => {
    if (performance.now() < suppressClick) return;
    const b = e.target.closest('.hd-t');
    if (b) { toggle(+b.dataset.t); return; }
    // the tray itself: picked tiles from the table come back
    const back = [...sel].filter(t => onTable().has(t) && mineSet().has(t));
    if (back.length) doMove(back, 'rack');
  });
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea')) return;
    if (e.key === 'Enter') { const c = check0(); if (c?.ok) { e.preventDefault(); act('done'); } }
    else if (e.key === 'Escape') clearSel();
    else if (e.key === 'd' || e.key === 'D') act('draw');
    else if (e.key === 'n' || e.key === 'N') { if (sel.size) doMove([...sel], 'new'); }
    else if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) act('undo');
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) { render(); } };
  addEventListener('resize', onResize);

  function act(a) {
    if (!myTurn()) return;
    if (a === 'done') { const c = check0(); if (!c?.ok) { sfx.bad?.(); return; } sfx.click(); sel.clear(); ctx.act({ t: 'done' }); }
    else if (a === 'draw') { sfx.click(); sel.clear(); ctx.act({ t: 'draw' }); }
    else if (a === 'undo') {
      sfx.whoosh?.(); sel.clear();
      S = { ...S, table: S.snapTable.map(g => ({ id: g.id, t: g.t.slice() })), rack: S.snapRack.slice(), fresh: [], mv: S.mv + (++localMv) / 1000 };
      S.seats = S.seats.map((p, i) => (i === S.me ? { ...p, n: S.snapRack.length } : p));
      ctx.act({ t: 'undo' }); scene?.setState(S); render();
    }
    else if (a === 'new') { if (sel.size) doMove([...sel], 'new'); }
    else if (a === 'back') { const ids = [...sel].filter(t => onTable().has(t)); if (ids.length) doMove(ids, 'rack'); }
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sort') { sfx.click(); sortBy = b.dataset.v; try { localStorage.setItem(SORT_KEY, sortBy); } catch { /* private mode */ } renderPanel(); }
    else act(a);
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .hd-b');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(sayTimer); scene?.dispose();
    },
  };
}
