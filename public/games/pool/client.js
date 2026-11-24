// Sky Pool game view: HUD over the 3D table. Renders what the server says; sends the cue ball's place and each shot.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';
import { N, kindOf, leftOf, sideOf, colOf } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};
// a little ball for the score panels: plain, striped or the black
const ballHtml = (b, gone = false) => `<i class="pl-b ${kindOf(b)}${gone ? ' gone' : ''}" style="--c:${colOf(b)}">${gone ? '' : b}</i>`;
const KIND = { s: () => L('Plain', 'Pełne'), t: () => L('Striped', 'Połówki') };
const FOUL = {
  scratch: () => L('The white ball went in', 'Biała bila wpadła do łuzy'),
  miss: () => L('No ball was hit', 'Żadna bila nie została trafiona'),
  wrong: () => L('The wrong ball was hit first', 'Pierwsza trafiona bila była nie ta'),
};
const WHY = {
  eight: () => L('The black is down', 'Czarna bila wbita'),
  early: () => L('The black went in too early', 'Czarna bila wpadła za wcześnie'),
  foul8: () => L('A foul on the black', 'Faul przy czarnej bili'),
  long: () => L('Fewer balls left on the table', 'Mniej bil zostało na stole'),
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./pool.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pl">
    <canvas class="g3d" aria-label="${L(`The pool table. Drag on the table to aim, then pull the cue back and let go. Or use the arrow keys and space.`, `Stół bilardowy. Przeciągnij po stole, żeby wycelować, potem odciągnij kij i puść. Możesz też użyć strzałek i spacji.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pl-rack"></span></div>
      <div class="tr"><span class="tcode" id="pl-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pl-banner" aria-live="polite"></div>
      <div class="shout" id="pl-big" aria-live="assertive"></div>
      <div class="pl-teams" id="pl-teams"></div>
      <div class="pl-bar" id="pl-bar">
        <div class="pl-ctl" id="pl-ctl" hidden>
          <button type="button" class="round" data-a="nl" aria-label="${L(`Aim a little to the left`, `Celuj odrobinę w lewo`)}">${I.left}</button>
          <div class="pl-pull" id="pl-pull" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${L(`Power. Pull back and let go to shoot.`, `Siła. Odciągnij i puść, żeby uderzyć.`)}"><i></i><b></b><span></span></div>
          <button type="button" class="round" data-a="nr" aria-label="${L(`Aim a little to the right`, `Celuj odrobinę w prawo`)}">${I.right}</button>
        </div>
        <p id="pl-hint"></p>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pl'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), pullEl = $('pl-pull');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, turnAt = 0, sentAt = 0, rolling = false;
  let dispOn = null, seenShot = -1, power = 0, pulling = false, kb = false, lastSound = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue, canAim, canPlace, onPlace, onAim: () => { kb = false; } });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const mySide = () => (S.me >= 0 ? sideOf(S.me) : -1);
  const sideName = sd => S.seats.filter((_, i) => sideOf(i) === sd).map(p => esc(p.name)).join(L(' and ', ' i '));
  const turnOpen = () => S.turn >= 0 && !S.rolling && performance.now() >= turnAt;
  function canAim() {
    const my = me();
    return !!my && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && !my.bot && turnOpen() && !rolling && performance.now() - sentAt > 700;
  }
  const canPlace = () => canAim() && !!S.hand;
  function onPlace(x, z) { if (canPlace()) { sfx.place(); ctx.act({ t: 'place', x, z }); } }
  function shootNow(p) {
    if (!canAim() || !scene || p < .04) return;
    const [ix, iz] = scene.aimInts();
    sentAt = performance.now(); ctx.act({ t: 'shot', ix, iz, pw: Math.round(p * 1000) });
    setPower(0); kb = false; renderBar();
  }
  function setPower(p) {
    power = Math.max(0, Math.min(1, p)); scene?.setPull(power);
    pullEl.style.setProperty('--p', power.toFixed(3)); pullEl.setAttribute('aria-valuenow', Math.round(power * 100));
    pullEl.querySelector('span').textContent = power >= .04 ? `${Math.round(power * 100)}%` : L('Pull back to shoot', 'Odciągnij, żeby uderzyć');
  }

  function sync() {
    if (!scene || !S) return;
    const tall = innerWidth < innerHeight, small = innerWidth <= 700;
    scene.setPads(tall ? (small ? 168 : 190) : 62, small ? 104 : 128); // the room the HUD takes above and below the table
    scene.setSeats(S.seats);
    scene.setState(S);
  }

  function onFrame(info) {
    live = info;
    if (!S) return;
    if (info.rolling !== rolling) { rolling = info.rolling; render(); }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // sounds in time with the balls on screen
  function onCue(c) {
    if (!S) return;
    const now = performance.now();
    if (c.k === 'strike') { sfx.thunk(); lastSound = now; }
    else if (c.k === 'hit') { if (now - lastSound < 45) return; lastSound = now; if (c.kind === 'b') (c.v > 3 ? sfx.place : sfx.tick)(); else if (c.v > 1.5) sfx.land(); }
    else if (c.k === 'pot') { sfx.plop(); if (dispOn) { dispOn[c.b] = false; $('pl-teams')._h = ''; renderTeams(); } }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => (i === S.me ? '<i hidden data-e="1"></i>' : `<div class="pl-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div>`)).join('');
    tagEls = [...tagsEl.children];
  }
  function renderTags() { tagEls.forEach((el, i) => el.classList?.toggle('turn', S.stage === 'play' && S.turn === i)); }

  // ----- rendering -----
  function renderTeams() {
    const on = rolling && dispOn ? dispOn : S.on;
    setHtml($('pl-teams'), [0, 1].map(sd => {
      const g = S.group[sd], who = S.seats.map((p, i) => [p, i]).filter(([, i]) => sideOf(i) === sd);
      let tray, label;
      if (!g) { tray = `<span class="pl-open">${L('Open table', 'Stół otwarty')}</span>`; label = ''; }
      else {
        const mine = []; for (let b = 1; b < N; b++) if (kindOf(b) === g) mine.push(b);
        const left = leftOf(on, g);
        tray = mine.map(b => ballHtml(b, !on[b])).join('') + `<em class="${left ? '' : 'go'}">${ballHtml(8, !on[8])}</em>`;
        label = left ? KIND[g]() : L('On the black', 'Czarna bila');
      }
      return `<div class="pl-team${S.stage === 'play' && S.side === sd && S.turn >= 0 ? ' on' : ''}${mySide() === sd ? ' pl-mine' : ''}">
        <div class="pl-who">${who.map(([p, i]) => `<span class="${S.turn === i ? 'up' : ''}">${avatarHtml(p.color, p.av, 34)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b></span>`).join('')}
          ${S.to > 1 ? `<strong>${S.wins[sd]}</strong>` : ''}</div>
        <div class="pl-tray">${label ? `<small>${label}</small>` : ''}${tray}</div></div>`;
    }).join(''));
  }

  function renderBar() {
    const ctl = $('pl-ctl'), my = me(), can = canAim();
    if (ctl.hidden === can) { ctl.hidden = !can; if (!can) { pulling = false; setPower(0); } else setPower(power); }
    let html = '';
    if (S.ph !== 'play') html = '';
    else if (S.stage === 'rack') html = L('Racking the balls for the next rack…', 'Ustawiamy bile do następnej partii…');
    else if (!my) html = L('You are watching this match.', 'Oglądasz ten mecz.');
    else if (rolling || S.rolling) html = L('The balls are rolling…', 'Bile się toczą…');
    else if (S.turn === S.me) {
      if (my.bot) html = L('A bot is playing for you. Welcome back!', 'Bot gra za ciebie. Witaj z powrotem!');
      else if (!can) html = L('You are up next.', 'Zaraz twoja kolej.');
      else if (kb) html = L('Left and right to aim, up and down for power, space to shoot.', 'Lewo i prawo celują, góra i dół ustawiają siłę, spacja uderza.');
      else if (S.hand === 'k') html = L('<b>Your break.</b> Move the white ball behind the line if you like, drag on the table to aim, then pull the cue back.', '<b>Rozbijasz.</b> Możesz przesunąć białą bilę za linią. Przeciągnij po stole, żeby wycelować, i odciągnij kij.');
      else if (S.hand) html = L('<b>Ball in hand.</b> Drag the white ball anywhere, drag on the table to aim, then pull the cue back.', '<b>Bila w ręce.</b> Przesuń białą bilę w dowolne miejsce, przeciągnij po stole, żeby wycelować, i odciągnij kij.');
      else html = L('<b>Your shot.</b> Drag on the table to aim, then pull the cue back and let go.', '<b>Twoje uderzenie.</b> Przeciągnij po stole, żeby wycelować, potem odciągnij kij i puść.');
    } else if (S.turn >= 0) html = sideOf(S.turn) === mySide() ? L(`Your partner <b>${nameOf(S.turn)}</b> is at the table.`, `Przy stole twój partner: <b>${nameOf(S.turn)}</b>.`) : L(`<b>${nameOf(S.turn)}</b> is at the table.`, `Przy stole: <b>${nameOf(S.turn)}</b>.`);
    setHtml($('pl-hint'), html ? `<span>${html}</span>` : '');
  }

  function renderBanner() {
    const el = $('pl-banner'); let msg = '';
    const left = Math.max(0, endsAt - performance.now()), timed = S.tLeft >= 0 && turnOpen();
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'rack') msg = L(`Rack ${S.rack + 1} is next`, `Zaraz partia ${S.rack + 1}`);
    else if (S.turn >= 0) msg = L(`${S.turn === S.me ? 'Your shot' : `${S.seats[S.turn]?.name}'s shot`}`, `${S.turn === S.me ? 'Twoje uderzenie' : `Uderza: ${S.seats[S.turn]?.name}`}`) + (timed ? L(` · ${Math.ceil(left / 1000)}s`, ` · ${Math.ceil(left / 1000)} s`) : '');
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.ph === 'play' && S.turn === S.me && timed && left < 8000);
  }

  function render() {
    if (!S) return;
    setHtml($('pl-rack'), S.to > 1 ? L(`<i>Rack </i>${S.rack} · ${S.wins[0]}:${S.wins[1]}`, `<i>Partia </i>${S.rack} · ${S.wins[0]}:${S.wins[1]}`) : L('One rack', 'Jedna partia'));
    $('pl-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderTeams(); renderBar(); renderBanner();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pl-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'start') { hideResults(); sfx.draw(); big(L(`Rack ${e.rack}`, `Partia ${e.rack}`), e.s === S.me ? L('You break', 'Rozbijasz') : L(`${nameOf(e.s)} breaks`, `Rozbija: ${nameOf(e.s)}`), 1900); }
    else if (e.t === 'res') {
      const mine = sideOf(e.s) === mySide();
      if (e.foul) {
        sfx.bad(); scene?.mood(e.s, false);
        const next = S.turn >= 0 ? (S.turn === S.me ? L('You have the ball in hand', 'Masz bilę w ręce') : L(`Ball in hand for ${nameOf(S.turn)}`, `Bila w ręce: ${nameOf(S.turn)}`)) : '';
        big(L('Foul!', 'Faul!'), `${FOUL[e.foul]?.() || ''}${next ? '. ' + next : ''}`, 2400);
      } else if (e.took) {
        const mk = S.group[mySide() >= 0 ? mySide() : e.side];
        if (mySide() >= 0) big(L(`You play ${mk === 's' ? 'plain' : 'striped'}`, `Grasz bilami: ${mk === 's' ? 'pełne' : 'połówki'}`), mine && e.s !== S.me ? L(`${nameOf(e.s)} potted first`, `Pierwszą bilę wbija ${nameOf(e.s)}`) : '', 2000);
        else ctx.toast(L(`${sideName(e.side)}: ${KIND[S.group[e.side]]().toLowerCase()}`, `${sideName(e.side)}: ${KIND[S.group[e.side]]().toLowerCase()}`));
        sfx.set();
      } else if (e.respot) ctx.toast(L('The black went in on the break, so it is back on its spot.', 'Czarna bila wpadła przy rozbiciu, więc wraca na swoje miejsce.'));
      else if (e.pots.length && e.keep && e.s === S.me) sfx.set();
    } else if (e.t === 'rack') {
      const won = e.w === mySide(), last = S.ph === 'end';
      if (won) { sfx.win(); confetti(); } else if (mySide() >= 0) sfx.lose(); else sfx.set();
      for (let i = 0; i < S.seats.length; i++) { scene?.mood(i, sideOf(i) === e.w); if (sideOf(i) === e.w && i !== S.me) scene?.cheer(i); } // the viewer's own shower is confetti() above
      if (!last) big(mySide() < 0 ? L(`${sideName(e.w)} take${S.seats.length > 2 ? '' : 's'} the rack`, `Partię wygrywa: ${sideName(e.w)}`) : won ? L('The rack is yours!', S.seats.length > 2 ? 'Partia dla was!' : 'Partia dla ciebie!') : L('Rack lost', 'Partia przegrana'), WHY[e.why]?.() || '', 2600);
    } else if (e.t === 'late') { if (e.s === S.me) ctx.toast(L('Out of time, so the game took the shot for you.', 'Koniec czasu, więc gra uderzyła za ciebie.')); }
    else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1700); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; seenShot = -1; dispOn = null;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    if (s.shot && s.shot.n !== seenShot) { seenShot = s.shot.n; dispOn = s.shot.from ? s.shot.from.on.slice() : null; }
    endsAt = performance.now() + Math.max(0, s.tLeft); turnAt = performance.now() + (s.tin || 0);
    sync(); render();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win, four = S.seats.length > 2;
    const order = S.seats.map((_, i) => i).sort((a, b) => (sideOf(a) === w ? 0 : 1) - (sideOf(b) === w ? 0 : 1) || a - b);
    const head = mySide() === w ? L(four ? 'Your team wins!' : 'You win!', four ? 'Wasza drużyna wygrywa!' : 'Wygrywasz!') : L(`${sideName(w)} win${four ? '' : 's'}!`, `Wygrywa: ${sideName(w)}!`);
    const sub = `${WHY[R.why]?.() || ''}. ${S.to > 1 ? L(`Racks: ${R.wins[w]}:${R.wins[1 - w]}.`, `Partie: ${R.wins[w]}:${R.wins[1 - w]}.`) : ''}`;
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${order.map((i, k) => {
        const p = S.seats[i], won = sideOf(i) === w;
        return `<li class="${won ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${won ? 1 : 2}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(p.st.pots, 'ball', 'balls')} potted · ${cnt(p.st.fouls, 'foul', 'fouls')}`, `wbite bile: ${p.st.pots} · faule: ${p.st.fouls}`)}</span></div>
          ${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Rematch', 'Rewanż'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Rematch', 'Rewanż'));
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
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q); // full phone resolution is 4x the pixels for no visible gain
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

  // the clock: the banner, the last-seconds ticks, and the moment the table is yours
  let wasReady = false;
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    const n = Math.ceil((endsAt - performance.now()) / 1000);
    if (n !== lastTick && n <= 5 && n > 0 && S.turn === S.me && S.tLeft >= 0 && turnOpen()) { lastTick = n; sfx.tick(); }
    const r = canAim();
    if (r !== wasReady) { if (r) sfx.turn(); wasReady = r; renderBar(); }
  }, 100);

  // the power strip: pull the knob back (to the left) and let go
  let pullX = 0, pullW = 1;
  pullEl.addEventListener('pointerdown', e => {
    if (!canAim()) return;
    pulling = true; kb = false; pullX = e.clientX; pullW = Math.max(120, pullEl.getBoundingClientRect().width * .82);
    pullEl.setPointerCapture?.(e.pointerId); e.preventDefault(); renderBar();
  });
  pullEl.addEventListener('pointermove', e => { if (pulling) setPower((pullX - e.clientX) / pullW); });
  pullEl.addEventListener('pointerup', () => { if (!pulling) return; pulling = false; const p = power; if (p >= .04) shootNow(p); else setPower(0); });
  pullEl.addEventListener('pointercancel', () => { pulling = false; setPower(0); });

  // nudge buttons: one small step a press, and they repeat while held
  let hold = 0;
  const stopHold = () => { clearInterval(hold); hold = 0; };
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-a="nl"], [data-a="nr"]'); if (!b || !canAim()) return;
    const d = b.dataset.a === 'nl' ? -.003 : .003; scene?.nudge(d);
    stopHold(); let n = 0; hold = setInterval(() => { if (!canAim()) return stopHold(); scene?.nudge(d * (++n > 12 ? 3 : 1)); }, 60);
  });
  addEventListener('pointerup', stopHold); addEventListener('pointercancel', stopHold);

  function key(e) {
    if (e.target?.closest?.('input, textarea, [contenteditable]') || !canAim()) return;
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) return;
    e.preventDefault();
    const fine = e.shiftKey ? .15 : 1;
    if (!kb) { kb = true; if (power < .04) setPower(.45); renderBar(); if (k === ' ' || k === 'Enter') return; }
    if (k === 'ArrowLeft') scene?.nudge(-.02 * fine); else if (k === 'ArrowRight') scene?.nudge(.02 * fine);
    else if (k === 'ArrowUp') setPower(Math.min(1, power + .05 * fine)); else if (k === 'ArrowDown') setPower(Math.max(.05, power - .05 * fine));
    else shootNow(power);
  }
  addEventListener('keydown', key);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
      destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); stopHold(); clearTimeout(resultsTimer); clearTimeout(bigTimer);
      removeEventListener('keydown', key); removeEventListener('pointerup', stopHold); removeEventListener('pointercancel', stopHold); scene?.dispose();
    },
  };
}
