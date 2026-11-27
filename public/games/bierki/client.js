// Bierki game view: HUD over the 3D table. The browser walks its own drag through the shared check so the meter
// moves at once, and sends the same path to the server, which decides.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, pbRowCls, pbRows, frameCls, rowBg } from '../../cosmetics.js';
import { MM, FULL, SET_BONUS, colOf, kindName, startPull, advance, isClear } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  view: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4.5h4.5"/></svg>',
  hook: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v11a4.5 4.5 0 0 1-9 0v-2"/><path d="M2.5 14.5 5 12l2.5 2.5"/></svg>',
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./bierki.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="bk">
    <canvas class="g3d" aria-label="${L(`The table with the pile of sticks. Drag a stick out of the pile without moving the others. Drag the table to turn the view.`, `Stół ze stosem bierek. Wyciągnij bierkę ze stosu tak, żeby nie poruszyć pozostałych. Przeciągnij stół, żeby obrócić widok.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bk-pile"></span></div>
      <div class="tr"><span class="tcode" id="bk-code"></span>
        <button type="button" class="round" data-a="view" aria-label="${L(`Reset the view`, `Przywróć widok`)}">${I.view}</button>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="bk-banner" aria-live="polite"></div>
      <div class="shout" id="bk-big" aria-live="assertive"></div>
      <div class="bk-seats" id="bk-seats"></div>
      <div class="bk-bar">
        <div class="bk-row">
          <div class="bk-meter" id="bk-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${L(`Steady hands meter`, `Wskaźnik pewnej ręki`)}"><span>${L('Steady hands', 'Pewna ręka')}</span><b id="bk-pct">0%</b><i><u></u></i></div>
          <button type="button" class="btn bk-lift" id="bk-lift" data-a="lift" aria-pressed="false" hidden>${I.hook}<span>${L('Lift', 'Podnieś')}</span></button>
        </div>
        <p id="bk-hint"></p>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bk'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let pile = null, pilePv = -1, tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, turnAt = 0;
  let held = null, queue = [], flushAt = 0, liftOn = false, peek = null, waiting = 0, lastRub = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, canPull, pick, move, drop, hover, canLift });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const turnOpen = () => S.turn >= 0 && performance.now() >= turnAt;
  function canPull() {
    const my = me();
    return !!my && !!pile && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && !my.bot && turnOpen() && !waiting;
  }
  const canLift = () => !!S?.lift && S.turn === S.me;

  // ----- my own pull -----
  function pick(id) {
    if (!canPull()) return null;
    const stick = pile[id]; if (!stick || stick.g) return null;
    const st = startPull(pile, stick, S.carry?.[id] || 0);
    held = { id, st, at: performance.now(), clear: false }; queue = []; peek = null;
    ctx.act({ t: 'pick', id });
    sfx.tick(); paintGlow(); renderBar();
    return st;
  }
  function flush() { if (queue.length) { ctx.act({ t: 'drag', p: queue }); queue = []; } flushAt = performance.now() + 110; }
  function move(x, y, z, ms) {
    if (!held || held.st.meter >= FULL) return false;
    if (y > 0 && !canLift()) y = 0;
    const before = held.st.meter;
    advance(pile, held.st, { x: x / MM, y: y / MM, z: z / MM }, ms);
    queue.push([x, y, z, ms]);
    const m = held.st.meter, now = performance.now();
    if (m > before + .5 && now - lastRub > 90) { lastRub = now; sfx.land(); }
    if (m >= FULL) { flush(); waiting = now; paintMeter(); return false; } // the server will say so too
    if (queue.length >= 12 || now >= flushAt) flush();
    const clear = isClear(pile, held.st);
    if (clear !== held.clear) { held.clear = clear; if (clear) sfx.pop(); renderBar(); }
    paintMeter();
    return true;
  }
  function drop() {
    if (!held) return;
    flush(); ctx.act({ t: 'drop' });
    if (held.st.meter < FULL && isClear(pile, held.st)) { waiting = performance.now(); return; } // it stays in the air until the server takes it
    held = null; scene?.release(); paintGlow(); paintMeter(); renderBar();
  }
  function endHeld() { held = null; waiting = 0; scene?.release(); paintGlow(); paintMeter(); }
  function hover(id) {
    peek = null;
    if (id >= 0 && S?.hints && pile?.[id] && !pile[id].g) { const st = startPull(pile, pile[id]); peek = { sel: id, top: st.onTop, touch: st.touch }; }
    paintGlow(); renderBar();
  }
  function paintGlow() {
    if (!scene) return;
    if (held) scene.setGlow({ sel: held.id, top: S.hints ? held.st.onTop : [], touch: S.hints ? held.st.touch : [] });
    else if (S?.pull) scene.setGlow({ sel: S.pull.id, top: [], touch: [] });
    else scene.setGlow(peek);
  }
  function paintMeter() {
    const el = $('bk-meter'); let m = 0;
    if (held) m = held.st.meter; else if (S?.pull) m = S.pull.m;
    m = Math.max(0, Math.min(100, m));
    el.style.setProperty('--m', (m / 100).toFixed(3)); el.setAttribute('aria-valuenow', Math.round(m));
    el.classList.toggle('hot', m >= 60); el.classList.toggle('full', m >= 100);
    const t = `${Math.round(m)}%`; if ($('bk-pct').textContent !== t) $('bk-pct').textContent = t;
  }

  function sync() {
    if (!scene || !S || !pile) return;
    const small = innerWidth <= 700;
    scene.setPads(small ? (S.seats.length > 3 ? 168 : 136) : 64, small ? 150 : 132); // the room the HUD takes above and below the table
    scene.setSeats(S.seats);
    scene.setState({ ...S, pile });
    scene.setLift(liftOn && canLift());
    paintGlow();
  }

  function onFrame(info) {
    live = info;
    if (!S) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => (i === S.me ? '<i hidden data-e="1"></i>' : `<div class="bk-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div>`)).join('');
    tagEls = [...tagsEl.children];
  }
  function renderTags() { tagEls.forEach((el, i) => el.classList?.toggle('turn', S.stage === 'play' && S.turn === i)); }

  // ----- rendering -----
  function renderSeats() {
    setHtml($('bk-seats'), S.seats.map((p, i) => {
      const st = p.st, bars = pile ? st.got.map(id => `<u style="background:${colOf(pile[id] || { k: 'plain' })}"></u>`).join('') : '';
      return `<div class="${pbRowCls(p.fl)} bk-seat${S.turn === i ? ' on' : ''}${i === S.me ? ' bk-mine' : ''}">
        ${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}
        <div class="bk-who"><b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><i>${S.piles > 1 ? '' : bars}</i></div>
        ${st.hook ? `<em title="${L('Has the Hook', 'Ma Hak')}">${I.hook}</em>` : ''}<strong>${st.pts}</strong>${rowBg(p.fl)}</div>`;
    }).join(''));
    pbRows($('bk-seats'));
  }

  function renderBar() {
    const my = me(), lift = $('bk-lift'), showLift = !!my && canLift() && S.ph === 'play';
    if (lift.hidden === showLift) lift.hidden = !showLift;
    if (!showLift && liftOn) { liftOn = false; }
    lift.setAttribute('aria-pressed', liftOn ? 'true' : 'false');
    scene?.setLift(liftOn && showLift);
    let html = '';
    if (S.ph !== 'play') html = '';
    else if (S.stage === 'next') html = L('A new pile is on its way…', 'Zaraz nowy stos…');
    else if (!my) html = L('You are watching this game.', 'Oglądasz tę grę.');
    else if (S.turn === S.me) {
      if (my.bot) html = L('A bot is playing for you. Welcome back!', 'Bot gra za ciebie. Witaj z powrotem!');
      else if (held) {
        const s = pile[held.id], top = held.st.onTop.length, side = held.st.touch.length - top;
        if (held.clear) html = L('<b>It is free!</b> Let go to take it.', '<b>Wolna!</b> Puść, żeby ją zabrać.');
        else if (!S.hints) html = L(`<b>${kindName(s)}</b> · ${cnt(s.pts, 'point', 'points')}. Pull it out slowly.`, `<b>${kindName(s)}</b> · ${cnt(s.pts, 'punkt', 'punkty', 'punktów')}. Wyciągaj powoli.`);
        else html = `<b>${kindName(s)}</b> · ${L(cnt(s.pts, 'point', 'points'), cnt(s.pts, 'punkt', 'punkty', 'punktów'))}. ` + (top ? L(`${cnt(top, 'stick lies', 'sticks lie')} on top of it: risky!`, `Leży na niej: ${cnt(top, 'bierka', 'bierki', 'bierek')}. Ryzykowne!`) : side ? L(`It touches ${cnt(side, 'stick', 'sticks')}. Pull slowly.`, `Dotyka: ${cnt(side, 'bierka', 'bierki', 'bierek')}. Wyciągaj powoli.`) : L('Nothing touches it.', 'Nic jej nie dotyka.'));
      }
      else if (!turnOpen() || waiting) html = L('You are up next.', 'Zaraz twoja kolej.');
      else if (liftOn && showLift) html = L('<b>Lifting.</b> Drag a stick upwards to raise it out of the pile. One lift a turn.', '<b>Podnoszenie.</b> Przeciągnij bierkę w górę, żeby unieść ją ze stosu. Jedno podniesienie na kolejkę.');
      else html = L('<b>Your turn.</b> Drag a stick out of the pile, slowly. Drag the table to turn the view.', '<b>Twoja kolej.</b> Wyciągnij bierkę ze stosu, powoli. Przeciągnij stół, żeby obrócić widok.');
    } else if (S.turn >= 0) html = S.pull && pile?.[S.pull.id] ? L(`<b>${nameOf(S.turn)}</b> is pulling: ${kindName(pile[S.pull.id])}.`, `<b>${nameOf(S.turn)}</b> wyciąga: ${kindName(pile[S.pull.id])}.`) : L(`<b>${nameOf(S.turn)}</b> is choosing a stick.`, `<b>${nameOf(S.turn)}</b> wybiera bierkę.`);
    setHtml($('bk-hint'), html ? `<span>${html}</span>` : '');
  }

  function renderBanner() {
    const el = $('bk-banner'); let msg = '';
    const left = Math.max(0, endsAt - performance.now()), timed = S.tLeft >= 0 && turnOpen();
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'next') msg = L(`Pile ${S.pileN + 1} is next`, `Zaraz stos ${S.pileN + 1}`);
    else if (S.turn >= 0) msg = L(`${S.turn === S.me ? 'Your turn' : `${S.seats[S.turn]?.name}'s turn`}`, `${S.turn === S.me ? 'Twoja kolej' : `Kolej: ${S.seats[S.turn]?.name}`}`) + (timed ? L(` · ${Math.ceil(left / 1000)}s`, ` · ${Math.ceil(left / 1000)} s`) : '');
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.ph === 'play' && S.turn === S.me && timed && left < 8000);
  }

  function render() {
    if (!S) return;
    setHtml($('bk-pile'), (S.piles > 1 ? L(`<i>Pile </i>${S.pileN}/${S.piles} · `, `<i>Stos </i>${S.pileN}/${S.piles} · `) : '') + L(`${cnt(S.left, 'stick', 'sticks')}<i> left</i>`, `<i>Zostało: </i>${cnt(S.left, 'bierka', 'bierki', 'bierek')}`));
    $('bk-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderSeats(); renderBar(); renderBanner(); paintMeter();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('bk-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatUp(id, text, color) {
    const at = scene?.screenOf(id), f = document.createElement('div');
    f.className = 'bk-pop'; f.textContent = text; f.style.setProperty('--c', color);
    f.style.left = `${at ? at.x : innerWidth / 2}px`; f.style.top = `${at ? at.y : innerHeight / 2}px`;
    root.append(f); setTimeout(() => f.remove(), 1300);
  }

  function playEv(e) {
    if (e.t === 'start') { hideResults(); sfx.draw(); big(S.piles > 1 ? L(`Pile ${e.pile}`, `Stos ${e.pile}`) : L('Bierki!', 'Bierki!'), e.s === S.me ? L('You start', 'Zaczynasz') : L(`${nameOf(e.s)} starts`, `Zaczyna: ${nameOf(e.s)}`), 1900); }
    else if (e.t === 'take') {
      const s = pile?.[e.id]; if (e.s === S.me) endHeld();
      if (s) { floatUp(e.id, `+${e.pts}`, colOf(s)); scene?.sparkle(e.id, colOf(s)); }
      if (e.s === S.me) sfx.set(); else sfx.plop();
      if (s?.k === 'hook') { if (e.s === S.me) big(L('The Hook!', 'Hak!'), L('Once a turn you may lift a stick straight up', 'Raz na kolejkę możesz podnieść bierkę prosto do góry'), 2400); else ctx.toast(L(`${S.seats[e.s]?.name} has the Hook.`, `Hak zdobywa: ${S.seats[e.s]?.name}.`)); }
      else if (s?.k === 'crown') { scene?.mood(e.s, true); big(L('The Crown!', 'Król!'), e.s === S.me ? L('20 points for you', '20 punktów dla ciebie') : L(`20 points for ${nameOf(e.s)}`, `20 punktów zdobywa ${nameOf(e.s)}`), 2000); }
      if (e.set) { scene?.mood(e.s, true); scene?.cheer(e.s); big(L('All four pets!', 'Komplet zwierzaków!'), L(`${e.s === S.me ? 'You get' : `${nameOf(e.s)} gets`} ${SET_BONUS} bonus points`, `${e.s === S.me ? 'Dostajesz' : `${nameOf(e.s)} dostaje`} ${SET_BONUS} punktów premii`), 2400); }
    } else if (e.t === 'fail') {
      if (e.s === S.me) endHeld();
      sfx.bad(); scene?.mood(e.s, false); scene?.thud(e.id);
      const why = e.why === 'drop' ? L('A stick that lay on it dropped', 'Bierka, która na niej leżała, opadła') : L('Another stick moved', 'Inna bierka się poruszyła');
      big(L('It moved!', 'Ruszyło się!'), `${why}. ${e.s === S.me ? L('Your stick is out of play', 'Twoja bierka wypada z gry') : L(`${nameOf(e.s)} loses the stick`, `${nameOf(e.s)} traci bierkę`)}`, 2100);
    } else if (e.t === 'late') { if (e.s === S.me) { endHeld(); ctx.toast(L('Out of time, so your turn passed.', 'Koniec czasu, więc kolejka przeszła dalej.')); } }
    else if (e.t === 'pile') { sfx.draw(); big(L('Pile cleared!', 'Stos zebrany!'), L('The next pile is coming', 'Zaraz następny stos'), 2400); }
    else if (e.t === 'end') {
      const top = Math.max(...S.res.pts);
      S.res.pts.forEach((p, i) => { scene?.mood(i, p === top); if (p === top && i !== S.me) scene?.cheer(i); }); // the viewer's own shower is confetti() below
      if (S.me >= 0 && S.res.pts[S.me] === top) { sfx.win(); confetti(); } else if (S.me >= 0) sfx.lose(); else sfx.set();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1700);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    if (s.pile) { pile = s.pile; pilePv = s.pv; }
    else if (!pile || s.pv !== pilePv) ctx.act({ t: 'sync' }); // a short update arrived for a pile this browser has not seen
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; held = null; waiting = 0; queue = [];
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft); turnAt = performance.now() + (s.tin || 0);
    // the server does not know about my pull (it refused the pick, or the turn moved on): let the stick go back
    if (held && (s.turn !== s.me || ((!s.pull || s.pull.id !== held.id) && performance.now() - held.at > 900))) endHeld();
    if (waiting && performance.now() - waiting > 2500) endHeld();
    if (s.turn !== s.me && waiting) waiting = 0;
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
    sync(); render();
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), pts = S.res.pts, top = Math.max(...pts);
    const order = S.seats.map((_, i) => i).sort((a, b) => pts[b] - pts[a] || a - b);
    const winners = order.filter(i => pts[i] === top);
    const head = winners.includes(S.me) ? (winners.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : L(`${winners.map(nameOf).join(' and ')} win${winners.length > 1 ? '' : 's'}!`, `Wygrywa: ${winners.map(nameOf).join(' i ')}!`);
    let pos = 0;
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${L(`${cnt(top, 'point', 'points')} took the table.`, `Zwycięski wynik: ${cnt(top, 'punkt', 'punkty', 'punktów')}.`)}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], won = pts[i] === top; if (k === 0 || pts[i] !== pts[order[k - 1]]) pos = k + 1;
        return `<li class="${pbRowCls(p.fl)} ${won ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${pos}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(p.st.pulls, 'stick', 'sticks')} taken · ${cnt(p.st.fails, 'slip', 'slips')}`, `zebrane bierki: ${p.st.pulls} · potknięcia: ${p.st.fails}`)}</span></div>
          <strong class="bk-pts">${pts[i]}</strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
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

  // reactions float up from the sender's avatar
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
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#7ed957'];
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

  // the clock: the banner, the last-seconds ticks, the moment the table is yours, and drags waiting to be sent
  let wasReady = false;
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (held && queue.length && performance.now() >= flushAt) flush();
    const n = Math.ceil((endsAt - performance.now()) / 1000);
    if (n !== lastTick && n <= 5 && n > 0 && S.turn === S.me && S.tLeft >= 0 && turnOpen()) { lastTick = n; sfx.tick(); }
    const r = canPull();
    if (r !== wasReady) { if (r && !held) sfx.turn(); wasReady = r; renderBar(); }
  }, 60);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'view') { sfx.click(); scene?.resetView(); }
    else if (a === 'lift') { sfx.click(); liftOn = !liftOn; renderBar(); }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer);
      scene?.dispose();
    },
  };
}
