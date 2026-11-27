// Ludo game view: HUD over the 3D board. Renders what the server says; sends rolls and pawn picks.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { HOME, LAST, ringIndex, safeIndex } from './board.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
const dieSvg = (v, s = 34) => `<svg class="die" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#fff8ec" stroke="#3b2219" stroke-width="2.4"/>${(PIPS[v] || []).map(([x, y]) => { const r = v === 1 ? 3 : 2.1; return `<rect x="${x * 6 - r}" y="${y * 6 - r}" width="${r * 2}" height="${r * 2}" fill="${v === 1 ? '#e5543b' : '#3b2219'}"/>`; }).join('')}</svg>`;
const pawnSvg = (col, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M12 2.5l4 3-1.5 4.5h-5L8 5.5zM9.5 10h5l3 8H6.5zM4.5 18h15v3.5h-15z" fill="${esc(col)}" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./ludo.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="ludo">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="lu-round"></span></div>
      <div class="tr"><span class="tcode" id="lu-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="lu-banner" aria-live="polite"></div>
      <div class="shout" id="lu-big" aria-live="assertive"></div>
      <ol class="list" id="lu-list" aria-label="${L(`Players`, `Gracze`)}"></ol>
      <div class="rollbar" id="lu-roll"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ludo'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, busy = false;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, rolled = 0, picked = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue, onPick: doPick });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));
  const yo = (i, you, they) => (i === S.me ? you : `${nameOf(i)} ${they}`); // Polish: "you" and "they" verb forms
  const mine = () => S && S.ph === 'play' && S.turn === S.me && me() && !me().bot;
  const myRoll = () => mine() && S.stage === 'roll';
  const myPick = () => mine() && S.stage === 'pick';

  function sync() {
    if (!scene || !S) return;
    scene.setSeats(S.seats, S.pawns, S.hard);
    scene.setMe(S.me);
    scene.setTurn(S.turn, S.stage);
    scene.setRoll(S.roll);
    scene.setMove(S.move);
    scene.setLegal(myPick() ? S.legal : []);
  }

  function onFrame(info) {
    live = info;
    if (busy !== info.busy) { busy = info.busy; renderList(); renderRoll(); renderBanner(); }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const want = t.show && i !== S.me; // your own avatar has the 3D arrow instead
      if (!want) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      placer.add(el, t.x, t.y);
      el.classList.toggle('now', i === S.turn && S.ph === 'play');
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.col).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map(p => `<div class="lu-tag${tagCls(p)}" hidden><i class="lu-dot" style="background:${esc(p.col)}"></i>${tagFace(p)}${tagBg(p)}</div>`).join('');
    tagEls = [...tagsEl.children]; placer.reset();
  }

  // A cue from the 3D scene: sounds and the big pop-up words.
  function onCue(c) {
    if (!S) return;
    const who = youOr(c.s), y = c.s === S.me;
    if (c.k === 'die') { sfx.draw(); if (c.die === 6) setTimeout(() => !destroyed && sfx.set(), 700); }
    else if (c.k === 'hop') sfx.pop();
    else if (c.k === 'out') { sfx.plop(); }
    else if (c.k === 'cap') {
      const hit = (c.caps || []).includes(S.me);
      if (hit) { sfx.bad(); sfx.lose(); } else sfx.set();
      big(hit ? L('Ouch!', 'Auć!') : L('Captured!', 'Zbicie!'), L(`${who} sen${y ? 'd' : 'ds'} ${[...new Set(c.caps || [])].map(i => (i === S.me ? 'your' : nameOf(i) + '’s')).join(' and ')} pawn back to the yard`, `${yo(c.s, 'Zbijasz', 'zbija')} pionek (${[...new Set(c.caps || [])].map(i => (i === S.me ? 'twój' : nameOf(i))).join(', ')}) i odsyła${y ? 'sz' : ''} go do bazy`), 1600);
    } else if (c.k === 'home') { sfx.win(); big(L('Home!', 'Domek!'), L(`${who} get${y ? '' : 's'} a pawn home`, yo(c.s, 'Twój pionek jest w domku', 'ma pionek w domku')), 1500); }
  }

  // ----- what each choice of pawn would do -----
  function describe(m) {
    const seat = S.seats[S.me];
    if (m.to === HOME) return L('Take a pawn home', 'Wprowadź pionek do domku');
    const i = ringIndex(seat.corner, m.to);
    if (i >= 0 && (!safeIndex(i) || S.hard)) {
      const hit = S.seats.map((o, os) => (os !== S.me && o.toks.filter(p => ringIndex(o.corner, p) === i).length === 1 ? os : -1)).filter(x => x >= 0);
      if (hit.length) return L(`${m.from < 0 ? 'Come out and capture' : 'Capture'} ${hit.map(nameOf).join(' and ')}`, `${m.from < 0 ? 'Wyjdź z bazy i zbij' : 'Zbij'}: ${hit.map(nameOf).join(', ')}`);
    }
    if (m.from < 0) return L('Bring a pawn out', 'Wyprowadź pionek');
    const left = HOME - m.to, tail = L(`${left} to go`, `jeszcze ${left}`);
    if (m.to > LAST) return `${L('Into the home lane', 'Na ścieżkę do domku')} · ${tail}`;
    if (i >= 0 && safeIndex(i) && !S.hard) return `${L('To a safe spot', 'Na bezpieczne pole')} · ${tail}`;
    return `${L('Move', 'Ruch o')} ${m.to - m.from} · ${tail}`;
  }

  // ----- rendering -----
  function renderList() {
    if (!S) return;
    setHtml($('lu-list'), S.seats.map((p, i) => {
      const now = i === S.turn && S.ph === 'play', home = p.toks.filter(t => t === HOME).length, yard = p.toks.filter(t => t < 0).length;
      const dots = p.toks.map(t => `<u class="${t === HOME ? 'h' : t < 0 ? 'y' : 'b'}" style="--c:${esc(p.col)}"></u>`).sort().join('');
      return `<li class="${pbRowCls(p.fl)} ${now ? 'now' : ''}${i === S.me ? ' me' : ''}" title="${L(`${home} home, ${yard} in the yard`, `w domku: ${home}, w bazie: ${yard}`)}">${avatarHtml(p.color, p.av, 30, frameCls(p.fl))}<i class="sw" style="background:${esc(p.col)}"></i><b>${nameHtml(p.name, p.fl)}</b><span class="dots">${dots}</span>${rowBg(p.fl)}</li>`;
    }).join(''));
    pbRows($('lu-list'));
  }

  function renderRoll() {
    const el = $('lu-roll');
    if (!S || S.ph !== 'play') { setHtml(el, ''); el.hidden = true; return; }
    el.hidden = false;
    const r = S.roll, col = S.seats[S.turn]?.col;
    if (myRoll() && !busy) {
      setHtml(el, `<button type="button" class="btn big r rollbtn" data-a="roll">${dieSvg(5, 36)}${S.tries ? L(`Try again (${3 - S.tries} left)`, `Spróbuj jeszcze raz (zostało: ${3 - S.tries})`) : L('Roll the die', 'Rzuć kostką')}</button>`);
    } else if (myPick() && !busy) {
      setHtml(el, `<div class="picks"><span class="rolled">${dieSvg(r.die, 30)}<span>${L(`Tap a pawn to move`, `Dotknij pionka, żeby nim ruszyć`)}</span></span><div class="choices">${S.legal.map(m =>
        `<button type="button" class="btn pick" data-a="pick" data-k="${m.k}">${pawnSvg(col)}${describe(m)}</button>`).join('')}</div></div>`);
    } else if (r && r.s === S.turn && (S.stage !== 'roll' || busy)) {
      const note = S.stage === 'die' && !busy ? (r.three ? L(' · three sixes, turn over', ' · trzy szóstki, koniec kolejki') : r.none ? L(' · no move', ' · brak ruchu') : '') : '';
      setHtml(el, `<span class="rolled">${busy && S.stage === 'die' ? dieSvg(0, 30) : dieSvg(r.die, 30)}<span>${busy && S.stage === 'die' ? L(`${youOr(r.s)} roll${r.s === S.me ? '' : 's'}…`, yo(r.s, 'Rzucasz…', 'rzuca…')) : L(`${youOr(r.s)} rolled a <b>${r.die}</b>`, yo(r.s, `Wyrzucasz <b>${r.die}</b>`, `wyrzuca <b>${r.die}</b>`)) + note}</span></span>`);
    } else {
      const p = S.seats[S.turn];
      setHtml(el, `<span class="rolled">${avatarHtml(p.color, p.av, 30)}<span>${S.turn === S.me ? L('A bot is playing for you', 'Bot gra za ciebie') : L(`${nameOf(S.turn)} is rolling…`, `${nameOf(S.turn)} rzuca…`)}</span></span>`);
    }
  }

  function renderBanner() {
    const el = $('lu-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), clock = S.left >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${youOr(S.win)} win${S.win === S.me ? '' : 's'}!`, S.win === S.me ? 'Wygrywasz!' : `Wygrywa ${nameOf(S.win)}!`) : '';
    else if (myRoll() && !busy) msg = `${L('Your turn', 'Twoja kolej')}${clock || '!'}`;
    else if (myPick() && !busy) msg = `${L('Pick a pawn', 'Wybierz pionek')}${clock}`;
    else msg = S.turn === S.me ? L('Your turn', 'Twoja kolej') : L(`${nameOf(S.turn)}'s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', (myRoll() || myPick()) && !busy);
  }

  function render() {
    if (!S) return;
    $('lu-round').textContent = L(`${S.hard ? 'Hard · ' : ''}Round ${S.round} · ${S.pawns} pawns each`, `${S.hard ? 'Trudny · ' : ''}Runda ${S.round} · po ${cnt(S.pawns, 'pawn', 'pawns', 'pionek', 'pionki', 'pionków')}`);
    $('lu-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderRoll(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('lu-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const y = e.s === S.me;
    if (e.t === 'again' && y) { ctx.toast(L('Bonus roll! Go again.', 'Dodatkowy rzut! Rzucaj jeszcze raz.')); sfx.turn(); }
    else if (e.t === 'retry' && y) ctx.toast(L(`No six. ${e.left} ${e.left === 1 ? 'try' : 'tries'} left.`, `Bez szóstki. Zostało prób: ${e.left}.`));
    else if (e.t === 'none' && y) ctx.toast(L(`No pawn can move ${e.die}.`, `Żaden pionek nie może ruszyć o ${e.die}.`));
    else if (e.t === 'three') { sfx.bad(); ctx.toast(L(`Three sixes in a row: ${y ? 'your' : nameOf(e.s) + '’s'} turn is over.`, `Trzy szóstki z rzędu: ${y ? 'twoja kolej się kończy' : 'koniec kolejki gracza ' + nameOf(e.s)}.`)); }
    else if (e.t === 'sit') { sfx.join?.(); ctx.toast(y ? L('You took over a bot. Its pawns are yours now!', 'Przejmujesz miejsce bota. Jego pionki są teraz twoje!') : L(`${nameOf(e.s)} took over a bot`, `${nameOf(e.s)} przejmuje miejsce bota`)); }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } else sfx.lose();
      big(L(`${youOr(e.w)} win${e.w === S.me ? '' : 's'}!`, e.w === S.me ? 'Wygrywasz!' : `Wygrywa ${nameOf(e.w)}!`), L('every pawn is home', 'wszystkie pionki w domku'), 2000);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prev = S ? S.turn + S.stage : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.left);
    if (!fresh && (myRoll() || myPick()) && prev !== s.turn + s.stage) { if (myRoll()) sfx.turn(); lastTick = -1; }
    if (s.stage !== 'roll') rolled = 0;
    if (s.stage !== 'pick') { picked = 0; scene?.setHover(-1); }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? L('All your pawns are home!', 'Wszystkie twoje pionki są w domku!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${myPlace ? (myPlace === 1 ? L('First one home. ', 'Pierwsze miejsce. ') : L(`You came ${ORD(myPlace)}. `, `Twoje miejsce: ${myPlace}. `)) : ''}${L('That took', 'Gra trwała')} ${cnt(S.res.rounds, 'round', 'rounds', 'rundę', 'rundy', 'rund')}.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st, home = p.toks.filter(t => t === HOME).length;
        return `<li class="${pbRowCls(p.fl)} ${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${st.caps} capture${st.caps === 1 ? '' : 's'} · sent back ${st.lost} time${st.lost === 1 ? '' : 's'}`, `${cnt(st.caps, 'capture', 'captures', 'zbicie', 'zbicia', 'zbić')} · powroty do bazy: ${st.lost}`)} · ${cnt(st.sixes, 'six', 'sixes', 'szóstka', 'szóstki', 'szóstek')}</span></div>
          <strong>${home}/${p.toks.length}<small>${L('home', 'w domku')}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
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
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 20 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q); // full phone resolution is 4x the pixels for no visible gain
    const cols = ['#ff6b6b', '#ffc93c', '#5fd08a', '#4db5ff', '#fff4e2', '#c58bff'];
    const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0] }));
    let t = 0;
    const step = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0;
    };
    step();
  }

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if ((myRoll() || myPick()) && S.left >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  function doRoll() {
    if (!myRoll() || busy || Date.now() - rolled < 1500) return;
    rolled = Date.now(); sfx.click(); ctx.act({ t: 'roll' });
  }
  function doPick(k) {
    if (!myPick() || busy || Date.now() - picked < 1500 || !S.legal.some(m => m.k === k)) return;
    picked = Date.now(); sfx.click(); scene?.setHover(-1); ctx.act({ t: 'pick', k });
  }
  const onKey = e => {
    if (e.target.closest?.('input, textarea, button')) return;
    if ((e.key === ' ' || e.key === 'Enter') && myRoll()) { e.preventDefault(); doRoll(); }
    else if (myPick() && e.key >= '1' && e.key <= '4' && S.legal[e.key - 1]) doPick(S.legal[e.key - 1].k);
  };
  addEventListener('keydown', onKey);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'roll') doRoll();
    else if (a === 'pick') doPick(+b.dataset.k);
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
    const p = e.target.closest('[data-a=pick]'); if (p) scene?.setHover(+p.dataset.k);
  });
  root.addEventListener('pointerout', e => { if (e.target.closest('[data-a=pick]') && !e.relatedTarget?.closest?.('[data-a=pick]')) scene?.setHover(-1); });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
