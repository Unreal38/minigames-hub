// Pip Party game view: HUD over the 3D table. Shows everyone's score sheet, your five dice (tap to keep), the roll
// button and the boxes you can write your roll into. The server owns the dice; this only sends roll, hold and pick.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { BOXES, UPPER, LOWER, LABEL, SHORT, HINT, ROLLS, UPPER_NEED, UPPER_BONUS, MULT, worth, open, colTotal, upperSum, lowerSum, bonusOf } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  sheet: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const PIP = [[], [[12, 12]], [[7.2, 7.2], [16.8, 16.8]], [[7, 7], [12, 12], [17, 17]], [[7.2, 7.2], [16.8, 7.2], [7.2, 16.8], [16.8, 16.8]],
  [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]], [[7.4, 6.4], [16.6, 6.4], [7.4, 12], [16.6, 12], [7.4, 17.6], [16.6, 17.6]]];
export const dieSvg = (v, cls = '') => `<svg class="pp-die${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="5.5"/>${
  v ? PIP[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 3.5 : 2.35}"${v === 1 ? ' class="one"' : ''}/>`).join('') : '<path d="M9.4 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2M12 16.9v.2"/>'}</svg>`;
const WIDE = 1100; // from this width the score sheet sits beside the table and you pick boxes on it

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./pips.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pp">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pp-info"></span></div>
      <div class="tr"><span class="tcode" id="pp-code"></span>
        <button type="button" class="round pp-sheetbtn" data-a="sheet" aria-label="${L(`Score sheet`, `Arkusz punktów`)}">${I.sheet}</button>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pp-banner" aria-live="polite"></div>
      <div class="shout" id="pp-big" aria-live="assertive"></div>
      <aside class="pp-side" id="pp-side"><div class="pp-sheet" id="pp-sheet"></div></aside>
      <div class="pp-dock" id="pp-dock"><div class="pp-roll" id="pp-roll"></div><div class="pp-ctl" id="pp-ctl"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pp'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0;
  let rollUntil = 0, rollTimer = 0, armed = '', sheetOpen = false, tab = -1, tabKey = '';

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onPick: k => hold(k) });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));
  const wide = () => innerWidth >= WIDE;
  const rolling = () => performance.now() < rollUntil;
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'turn' && S.turn === S.me && me() && !me().bot && !S.auto);
  const canAct = () => myTurn() && !rolling() && Date.now() - sent > 350;
  const triple = () => S.ncols > 1;
  const shown = () => S && S.stage === 'turn' && S.rolls > 0 && !rolling(); // the dice on the felt can be read

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      placer.add(el, t.x, t.y);
    }
  }
  function layout() {
    if (!scene) return;
    scene.setHud(Math.max($('pp-dock').offsetHeight + 30, innerWidth < 700 ? 300 : 250) * uiz());
    scene.setInset(wide() ? ($('pp-side').offsetWidth + 24) * uiz() : 0);
  }

  // ----- name tags: name and score so far -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="pp-tag"${i === S.me ? ' hidden' : ''}><div class="plate${tagCls(p)}">${tagFace(p)}<span class="cnt"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'turn');
      const cnt = el.querySelector('.plate .cnt'), v = String(p.tot); if (cnt._h !== v) { cnt._h = v; cnt.textContent = v; }
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = false) {
    const t = i === S.me || !live?.tags?.[i] ? { x: innerWidth / 2, y: (live?.tray?.y || innerHeight * .45) } : live.tags[i];
    const f = document.createElement('div');
    f.className = 'pp-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.x}px`; f.style.top = `${t.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1700);
  }

  // ----- the score sheet: one column per player; the roller's empty boxes show what this roll would score -----
  // Classic: one column per player. Triple: one player at a time (tabs along the top), with their three columns.
  function sheetHtml() {
    const roller = shown() ? S.turn : -1, mine = roller === S.me && myTurn(), tri = triple();
    if (tri) { const k = S.gid + '/' + S.round + '/' + S.turn; if (k !== tabKey) { tabKey = k; tab = S.turn >= 0 ? S.turn : Math.max(0, S.me); } if (!S.seats[tab]) tab = 0; }
    // the columns on show: [seat, column index]
    const colsOn = tri ? [0, 1, 2].map(ci => [tab, ci]) : S.seats.map((_, i) => [i, 0]);
    const head = tri ? colsOn.map(([, ci]) => `<th class="mul">×${MULT[ci]}</th>`).join('')
      : S.seats.map((p, i) => `<th class="${i === S.turn && S.stage === 'turn' ? 'now' : ''}${i === S.me ? ' mine' : ''}" title="${esc(p.name)}">${avatarHtml(p.color, p.av, 26)}<span>${i === S.me ? L('You', 'Ty') : nameHtml(p.name, p.fl)}</span></th>`).join('');
    const cell = ([i, ci], b) => {
      const p = S.seats[i], v = p.cols[ci][b], m = MULT[ci];
      if (v != null) return `<td class="done${S.last && S.last.s === i && S.last.box === b && S.last.col === ci && S.stage === 'pick' ? ' fresh' : ''}${v === 0 ? ' zero' : ''}">${v * m + (b === 'gen' && !tri ? p.extra : 0)}</td>`;
      if (i !== roller) return '<td></td>';
      const w = worth(b, S.dice, p.cols, ci, p.waste), id = b + '/' + ci;
      if (!mine) return `<td class="pv${w ? '' : ' zero'}">${w}</td>`;
      return `<td class="pv pick"><button type="button" data-a="pick" data-box="${b}" data-col="${ci}" class="${w ? '' : 'zero'}${armed === id ? ' armed' : ''}" aria-label="${LABEL[b]}${tri ? `, ${L('column', 'kolumna')} ×${m}` : ''}: ${w} ${L('points', 'pkt')}">${armed === id ? '0?' : w}</button></td>`;
    };
    const row = b => `<tr><th scope="row" title="${esc(HINT[b])}">${b.length === 1 ? dieSvg(+b) : ''}<span>${LABEL[b]}</span></th>${colsOn.map(c => cell(c, b)).join('')}</tr>`;
    const sumRow = (lbl, f, cls) => `<tr class="${cls}"><th scope="row">${lbl}</th>${colsOn.map(([i, ci]) => `<td>${f(S.seats[i], S.seats[i].cols[ci], ci)}</td>`).join('')}</tr>`;
    const tabs = tri ? `<div class="pp-tabs" role="tablist">${S.seats.map((p, i) => `<button type="button" role="tab" data-a="tab" data-i="${i}" aria-selected="${i === tab}" class="${i === S.turn && S.stage === 'turn' ? 'now' : ''}" title="${esc(p.name)}">${avatarHtml(p.color, p.av, 26)}<span>${i === S.me ? L('You', 'Ty') : nameHtml(p.name, p.fl)}</span><b>${p.tot}</b></button>`).join('')}</div>` : '';
    const who = S.seats[tab];
    return `${tabs}<table class="${tri ? 'tri' : ''}"><thead><tr><th></th>${head}</tr></thead><tbody>
      ${UPPER.map(row).join('')}
      ${sumRow(`${L('Bonus', 'Premia')} <small>${UPPER_NEED}+ = ${UPPER_BONUS}</small>`, (p, c, ci) => (bonusOf(c) ? `<b class="yes">+${UPPER_BONUS * MULT[ci]}</b>` : `<small>${upperSum(c)}/${UPPER_NEED}</small>`), 'sub')}
      ${LOWER.map(row).join('')}
      ${tri ? sumRow(L('Column', 'Kolumna'), (p, c, ci) => `<b>${colTotal(c) * MULT[ci]}</b>`, 'sub col') : ''}
      ${tri ? (who.extra ? `<tr class="sub"><th scope="row">${L('Party bonus', 'Premia Party')}</th><td colspan="3"><b class="yes">+${who.extra}</b></td></tr>` : '')
        : ''}
      ${tri ? `<tr class="tot"><th scope="row">${L('Total', 'Suma')}</th><td colspan="3"><b>${who.tot}</b></td></tr>` : sumRow(L('Total', 'Suma'), p => `<b>${p.tot}</b>`, 'tot')}
    </tbody></table>`;
  }
  function renderSheet() {
    setHtml($('pp-sheet'), sheetHtml());
    root.classList.toggle('sheet-open', sheetOpen && !wide());
  }

  // ----- the dice row and the controls -----
  function renderDock() {
    const rollEl = $('pp-roll'), ctl = $('pp-ctl');
    if (!S || S.ph !== 'play' || S.stage === 'wait') { setHtml(rollEl, ''); setHtml(ctl, ''); layout(); return; }
    const turn = myTurn(), roll = rolling(), r = S.rolls, p = S.seats[S.turn];
    const can = turn && r > 0 && r < ROLLS && !roll;
    // the five dice, big enough to read on a phone; yours to tap on your turn
    const dice = r ? S.dice.map((v, k) => {
      const h = S.held[k], moving = roll && S.moved.includes(k);
      const inner = dieSvg(moving ? 0 : v, (moving ? 'spin' : '') + (h ? ' kept' : ''));
      return can ? `<button type="button" class="pp-dbtn${h ? ' held' : ''}" data-a="hold" data-k="${k}" aria-pressed="${h}" aria-label="${L('Die', 'Kość')} ${k + 1}: ${v}${h ? L(', kept', ', zatrzymana') : ''}">${inner}<em>${h ? L('kept', 'zostaje') : ''}</em></button>`
        : `<span class="pp-dbtn${h ? ' held' : ''}">${inner}<em>${h ? L('kept', 'zostaje') : ''}</em></span>`;
    }).join('') : dieSvg(0).repeat(5);
    const left = ROLLS - r;
    const who = S.turn === S.me ? '' : `<span class="who">${avatarHtml(p.color, p.av, 26)}${nameOf(S.turn)}</span>`;
    setHtml(rollEl, `${who}<span class="pp-hand${r ? '' : ' none'}">${dice}</span><span class="pp-left" aria-label="${L(`${left} rolls left`, `zostało rzutów: ${left}`)}">${[0, 1, 2].map(k => `<i class="${k < r ? 'used' : ''}"></i>`).join('')}</span>`);
    if (turn) {
      const allHeld = r > 0 && S.held.every(Boolean), rollOk = r < ROLLS && !allHeld && !roll && S.stage === 'turn';
      const btn = `<button type="button" class="btn big pp-go" data-a="roll"${rollOk ? '' : ' disabled'}>${r ? L(`Roll again <small>${left} left</small>`, `Rzuć jeszcze raz <small>zostało: ${left}</small>`) : L('Roll the dice', 'Rzuć kośćmi')}</button>`;
      let grid = '';
      if (!wide() && r && !roll && S.stage === 'turn') {
        const cols = me().cols;
        // the triple sheet has 39 boxes: too many for a grid, so the sheet itself opens for picking
        grid = triple() ? `<button type="button" class="btn pp-write" data-a="sheet">${L('Write it on your sheet', 'Wpisz na swój arkusz')}</button>`
          : `<div class="pp-grid">${open(cols[0]).map(b => { const v = worth(b, S.dice, cols, 0, me().waste), id = b + '/0';
            return `<button type="button" data-a="pick" data-box="${b}" data-col="0" class="${v ? '' : 'zero'}${armed === id ? ' armed' : ''}"><span>${SHORT[b]}</span><b>${armed === id ? '0?' : v}</b></button>`; }).join('')}</div>`;
      }
      const hint = !r ? L('Roll all five dice to start your turn.', 'Rzuć wszystkimi pięcioma kośćmi, żeby zacząć turę.') : roll ? L('Rolling…', 'Rzut…')
        : S.stage !== 'turn' ? '' : r < ROLLS ? (wide() ? L('Tap dice to keep them, then roll again, or pick a box on your sheet.', 'Dotknij kości, żeby je zatrzymać, i rzuć jeszcze raz albo wybierz pole na arkuszu.') : L('Tap dice to keep them, then roll again, or pick a box.', 'Dotknij kości, żeby je zatrzymać, i rzuć jeszcze raz albo wybierz pole.'))
          : (wide() ? L('No rolls left: pick a box on your sheet.', 'Koniec rzutów: wybierz pole na arkuszu.') : L('No rolls left: pick a box.', 'Koniec rzutów: wybierz pole.'));
      setHtml(ctl, `${grid}<div class="pp-act">${btn}<p class="pp-hint">${hint}</p></div>`);
    } else if (S.stage === 'turn') {
      setHtml(ctl, `<span class="pp-wait">${S.turn === S.me ? (S.auto ? L('Out of time: a bot finishes your turn', 'Koniec czasu: bot kończy twoją turę') : L('A bot is playing for you', 'Bot gra za ciebie')) : L(`${nameOf(S.turn)} is ${r ? 'thinking' : 'about to roll'}…`, `${nameOf(S.turn)} ${r ? 'myśli' : 'zaraz rzuca'}…`)}</span>`);
    } else setHtml(ctl, '');
    layout();
  }

  function renderBanner() {
    const el = $('pp-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${S.win === S.me ? 'You win' : nameOf(S.win) + ' wins'}!`, S.win === S.me ? 'Wygrywasz!' : `Wygrywa ${nameOf(S.win)}!`) : '';
    else if (S.stage === 'wait') msg = L('Grab your dice…', 'Bierzcie kości…');
    else if (S.stage === 'pick' && S.last) msg = L(`${youOr(S.last.s)} wrote ${S.last.pts} in ${LABEL[S.last.box]}`, `${S.last.s === S.me ? 'Wpisujesz' : nameOf(S.last.s) + ' wpisuje'} ${S.last.pts} w polu ${LABEL[S.last.box]}`) + (triple() ? ` ×${MULT[S.last.col]}` : '');
    else if (myTurn()) msg = (S.rolls ? L(`Your turn · roll ${S.rolls} of ${ROLLS}`, `Twoja kolej · rzut ${S.rolls} z ${ROLLS}`) : L('Your turn · roll the dice', 'Twoja kolej · rzuć kośćmi')) + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn${S.rolls ? ` · roll ${S.rolls} of ${ROLLS}` : ''}`, `Kolej: ${nameOf(S.turn)}${S.rolls ? ` · rzut ${S.rolls} z ${ROLLS}` : ''}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    $('pp-info').textContent = S.ph === 'end' ? L('Game over', 'Koniec gry') : innerWidth < 700 ? `${L('Round', 'Runda')} ${S.round}/${S.rounds}` : `${L('Round', 'Runda')} ${S.round} ${L('of', 'z')} ${S.rounds}`;
    $('pp-code').textContent = Rm?.code || '';
    buildTags(); renderSheet(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1600) {
    const el = $('pp-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? L('You took over a bot. Good luck!', 'Przejmujesz miejsce bota. Powodzenia!') : L(`${nameOf(e.s)} took over a bot`, `${nameOf(e.s)} przejmuje miejsce bota`)); }
    else if (e.t === 'turn') { if (e.s === S.me && !S.seats[S.me].bot) { sfx.turn(); lastTick = -1; } if (e.s === S.first && e.round > 1 && e.round === S.rounds) ctx.toast(L('Last round!', 'Ostatnia runda!')); }
    else if (e.t === 'roll') { sfx.draw(); setTimeout(() => !destroyed && sfx.draw(), 160); setTimeout(() => !destroyed && sfx.place(), S.ms.roll * .8); }
    else if (e.t === 'gen') setTimeout(() => { if (destroyed) return; big(L('Pip Party!', 'Generał!'), L(`${youOr(e.s)} rolled five of a kind`, `${e.s === S.me ? 'Wyrzucasz' : nameOf(e.s) + ' wyrzuca'} pięć jednakowych`), 1800); sfx.win(); }, S.ms.roll);
    else if (e.t === 'pick') {
      floatAt(e.s, `${e.pts ? '+' + e.pts : '0'} ${SHORT[e.box]}${triple() ? ` ×${MULT[e.col]}` : ''}`, !e.pts);
      e.pts ? sfx.pop() : sfx.plop();
      if (e.bonus) setTimeout(() => { if (destroyed) return; big(`+${e.bonus}`, L(`${youOr(e.s)} ${e.s === S.me ? 'get' : 'gets'} the party bonus`, `${e.s === S.me ? 'Dostajesz' : nameOf(e.s) + ' dostaje'} premię Party`), 1800); sfx.win(); }, 300);
      else if (e.madeBonus) setTimeout(() => { if (destroyed) return; big(`+${UPPER_BONUS * MULT[e.col || 0]}`, L(`${e.s === S.me ? 'Your' : nameOf(e.s) + '’s'} top half reached ${UPPER_NEED}`, `${e.s === S.me ? 'Twoja górna połowa' : 'Górna połowa gracza ' + nameOf(e.s)} ma już ${UPPER_NEED}`), 1800); sfx.set(); if (e.s === S.me) confetti(); }, 300);
    }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2000);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prevRoll = S?.rollN, prevStage = S ? S.turn + '/' + S.stage : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sheetOpen = false; tabKey = '';
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (s.rolls && s.rollN !== prevRoll) {
      const left = s.ms.roll - s.rollAgo;
      if (left > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) { rollUntil = performance.now() + left; clearTimeout(rollTimer); rollTimer = setTimeout(() => { if (!destroyed && S) render(); }, left + 20); }
      armed = '';
    }
    if (prevStage !== s.turn + '/' + s.stage) { armed = ''; sent = 0; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win, tot = S.res.totals;
    const place = i => 1 + tot.filter(t => t > tot[i]).length;
    const myPlace = S.me >= 0 ? place(S.me) : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${myPlace === 1 ? L('You win the party!', 'Wygrywasz imprezę!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${myPlace ? (myPlace === 1 ? L(`Top score with ${tot[S.me]} points.`, `Najlepszy wynik: ${tot[S.me]} pkt.`) : L(`You came ${ORD(myPlace)} with ${tot[S.me]} points.`, `Twoje miejsce: ${myPlace}, wynik: ${tot[S.me]} pkt.`)) : ''}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], c0 = p.cols[0], up = upperSum(c0), b = bonusOf(c0);
        const sub = triple() ? p.cols.map((c, ci) => `×${MULT[ci]}: ${colTotal(c) * MULT[ci]}`).join(' · ') : `${L('Top', 'Góra')} ${up}${b ? ` +${b}` : ''} · ${L('bottom', 'dół')} ${lowerSum(c0)}`;
        return `<li class="${pbRowCls(p.fl)} ${place(i) === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${place(i)}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${sub}${p.extra ? ` · party +${p.extra}` : ''}</span></div>
          <strong><span>${tot[i]}</span><small>${L('points', 'pkt')}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q); // full phone resolution is 4x the pixels for no visible gain
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#e5543b'];
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
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function hold(k) {
    if (!canAct() || !S.rolls || S.rolls >= ROLLS || S.stage !== 'turn') return;
    const on = !S.held[k];
    S.held = S.held.map((h, j) => (j === k ? on : h)); // show it at once; the server's state follows
    armed = ''; sfx.click(); ctx.act({ t: 'hold', k, on }); render(); scene?.setState(S);
  }
  function roll() {
    if (!canAct() || S.rolls >= ROLLS || S.stage !== 'turn' || (S.rolls && S.held.every(Boolean))) return;
    sent = Date.now(); armed = ''; sfx.click(); ctx.act({ t: 'roll' });
  }
  function pick(box, col = 0) {
    if (!canAct() || !S.rolls || S.stage !== 'turn') return;
    const p = me(), sh = p.cols[col]; if (!sh || sh[box] != null) return;
    // a zero needs a second tap, so a slip of the finger does not throw a box away
    const id = box + '/' + col;
    if (!worth(box, S.dice, p.cols, col, p.waste) && armed !== id) { armed = id; sfx.warn(); render(); return; }
    armed = ''; sent = Date.now(); sfx.place(); ctx.act({ t: 'pick', box, col }); sheetOpen = false; render();
  }
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || !myTurn()) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') hold(+k - 1);
    else if (k === 'r' || (k === ' ' && !e.target.closest?.('button'))) roll();
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { render(); layout(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'hold') hold(+b.dataset.k);
    else if (a === 'roll') roll();
    else if (a === 'pick') pick(b.dataset.box, +b.dataset.col || 0);
    else if (a === 'tab') { sfx.click(); tab = +b.dataset.i; renderSheet(); layout(); }
    else if (a === 'sheet') { sfx.click(); sheetOpen = !sheetOpen; renderSheet(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  // tapping outside the open sheet on a phone closes it
  root.addEventListener('pointerdown', e => { if (sheetOpen && !wide() && !e.target.closest('.pp-side, [data-a="sheet"]')) { sheetOpen = false; renderSheet(); } });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, button.pp-dbtn, .pp-grid button, .pp-sheet button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(rollTimer); scene?.dispose();
    },
  };
}
