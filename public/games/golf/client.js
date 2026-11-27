// Mini Golf Party game view: HUD over the 3D hole. Renders what the server says; sends putts.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, PL, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  coin: '<svg class="coin" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffb547" stroke="#3b2219" stroke-width="2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#3b2219" stroke-width="2" opacity=".55"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3v18" stroke="#3b2219" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4l12 4.5L7 13z" fill="#e5543b" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// what golfers call a score, from strokes and par
function scoreName(n, par) {
  if (n === 1) return 'Hole in one!';
  const d = n - par;
  if (PL) return d <= -3 ? 'Albatros!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Podwójny bogey' : `${d} ponad par`;
  return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `${d} over par`;
}
const HOLE_PL = { 'First Putt': 'Pierwsze uderzenie', Dogleg: 'Zakręt', Windmill: 'Wiatrak', 'Up the Steps': 'Po schodach', 'The Bridge': 'Most', Zigzag: 'Zygzak', Pinball: 'Flipper', 'The Hill': 'Górka', 'Grand Finale': 'Wielki finał' };
// made-up holes are named "Adjective Noun" by the server; Polish adjectives follow the noun's gender (m, f, n, plural)
const HOLE_NOUN = { Mill: ['Młyn', 0], Crossing: ['Przeprawa', 1], Pond: ['Staw', 0], Arcade: ['Arkady', 3], Dunes: ['Wydmy', 3], Maze: ['Labirynt', 0], Roundabout: ['Rondo', 2], Lane: ['Alejka', 1], Steps: ['Schody', 3], Summit: ['Szczyt', 0] };
const HOLE_ADJ = { Windy: 'Wietrzn', Soggy: 'Mokr', Misty: 'Mglist', Bumpy: 'Wyboist', Sandy: 'Piaszczyst', Twisty: 'Kręt', Loopy: 'Zakręcon', Breezy: 'Przewiewn', Steep: 'Strom', Lofty: 'Wysok', Little: 'Mał', Old: 'Star', Lucky: 'Szczęśliw', Sunny: 'Słoneczn' };
const holePl = n => { if (HOLE_PL[n]) return HOLE_PL[n]; if (n === 'Easy Street') return 'Łatwa uliczka'; const [a, b] = String(n).split(' '), st = HOLE_ADJ[a], no = HOLE_NOUN[b]; if (!st || !no) return n;
  const k = st.endsWith('k'); return `${st}${[k ? 'i' : 'y', 'a', k ? 'ie' : 'e', k ? 'ie' : 'e'][no[1]]} ${no[0].toLowerCase()}`; };
const holeName = n => L(n, holePl(n));
const vsPar = d => (d === 0 ? 'E' : d > 0 ? '+' + d : '−' + -d);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`; };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./golf.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="mg">
    <canvas class="g3d" aria-label="${L(`The mini golf hole. Drag back and let go to putt, or use the arrow keys and space.`, `Dołek minigolfa. Przeciągnij do tyłu i puść, żeby uderzyć, albo użyj strzałek i spacji.`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="mg-hole"></span></div>
      <div class="tr"><span class="tcode" id="mg-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="mg-banner" aria-live="polite"></div>
      <div class="shout" id="mg-big" aria-live="assertive"></div>
      <ol class="list" id="mg-list" aria-label="${L(`Scores`, `Wyniki`)}"></ol>
      <div class="puttbar" id="mg-putt" hidden></div>
      <div class="holecard" id="mg-done" hidden></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.mg'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, readyAt = 0, power = 0, aiming = false, keys = false, rolling = false, sentAt = 0, turnAt = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue, canAim, onShot, onAim });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const parSoFar = n => S.pars.slice(0, n).reduce((a, b) => a + b, 0);
  // it is your turn and the ball before yours has stopped
  const turnOpen = () => S.turn >= 0 && performance.now() >= turnAt;
  function canAim() {
    const my = me();
    return !!my && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && turnOpen() && !my.bot && !my.sunk && !my.out && performance.now() >= readyAt && performance.now() - sentAt > 400 && !rolling;
  }
  function onShot(ang, pow) { if (!canAim()) return; sentAt = performance.now(); ctx.act({ t: 'shot', ang, pow }); }
  function onAim(p, on, kb = false) { power = p; aiming = on; keys = kb; renderPutt(); }

  function sync() {
    if (!scene || !S) return;
    scene.setHole(S.hdef);
    scene.setSeats(S.seats);
    scene.setState(S);
  }

  function onFrame(info) {
    live = info;
    if (!S) return;
    const r = !!info.busy[S.me];
    if (r !== rolling) { rolling = r; renderPutt(); }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // sounds and pop-ups in time with the balls on screen
  function onCue(c) {
    if (!S) return;
    const mine = c.s === S.me;
    if (c.k === 'putt') { if (mine) sfx.place(); else sfx.tick(); }
    else if (c.k === 'hit') { if (c.kind === 'c') { sfx.pop(); if (mine) big(L('Too fast!', 'Za szybko!'), L('It skipped right over the hole', 'Piłka przeskoczyła nad dołkiem'), 1500); } else if (mine) (c.kind === 'p' ? sfx.pop : sfx.tick)(); }
    else if (c.k === 'water') { sfx.plop(); if (mine) { big(L('Splash!', 'Plum!'), L('One stroke, and back you go', 'Jedno uderzenie kary i wracasz na miejsce'), 1500); sfx.bad(); } }
    else if (c.k === 'sunk') {
      const p = S.seats[c.s]; if (!p) return;
      if (mine) { sfx.win(); if (p.strokes <= S.par) confetti(); big(scoreName(p.strokes, S.par), L(`In the hole in ${p.strokes}`, `W dołku za ${p.strokes}`), 2000); }
      else { sfx.set(); ctx.toast(L(`${I.flag}${nameOf(c.s)} is in the hole in ${p.strokes}${p.strokes === 1 ? '. A hole in one!' : ''}`, `${I.flag}${nameOf(c.s)}: w dołku za ${p.strokes}${p.strokes === 1 ? '. Hole in one!' : ''}`)); }
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => (i === S.me ? '<i hidden data-e="1"></i>' : `<div class="mg-tag" hidden><i style="background:${p.color}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div>`)).join('');
    tagEls = [...tagsEl.children];
  }

  function renderTags() { tagEls.forEach((el, i) => el.classList?.toggle('turn', S.stage === 'play' && S.turn === i && turnOpen())); }

  // ----- rendering -----
  function renderList() {
    const done = S.seats[0]?.card.length || 0, par = parSoFar(done);
    const ord = S.seats.map((_, i) => i).sort((a, b) => S.seats[a].total - S.seats[b].total || S.seats[b].wins - S.seats[a].wins || a - b);
    setHtml($('mg-list'), ord.map(i => {
      const p = S.seats[i], playing = S.stage === 'play';
      const now = playing ? (p.sunk ? `<em class="in">${I.check}${p.strokes}</em>` : p.out ? `<em class="out">${S.cap}</em>` : `<em>${p.strokes}</em>`) : '';
      return `<li class="${pbRowCls(p.fl)} ${i === S.me ? 'mg-me' : ''}${playing && S.turn === i ? ' turn' : ''}${playing && (p.sunk || p.out) ? ' fin' : ''}">${avatarHtml(p.color, p.av, 30, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b>${now}<span>${done ? vsPar(p.total - par) : '–'}</span>${rowBg(p.fl)}</li>`;
    }).join(''));
    pbRows($('mg-list'));
  }

  function renderPutt() {
    const el = $('mg-putt'), my = me();
    el.hidden = !(S && S.ph === 'play' && S.stage === 'play');
    if (el.hidden) return;
    let html;
    if (!my) html = `<p>${L('You are watching. Take a seat for the next hole from the bar above.', 'Oglądasz. Na następny dołek możesz usiąść z paska u góry.')}</p>`;
    else if (my.sunk) html = `<p class="good">${I.flag}${L(`In the hole in <b>${my.strokes}</b>. ${scoreName(my.strokes, S.par).replace('!', '')}. Waiting for the others.`, `W dołku za <b>${my.strokes}</b>. ${scoreName(my.strokes, S.par).replace('!', '')}. Czekamy na pozostałych.`)}</p>`;
    else if (my.out) html = `<p>${L(`Picked up after ${S.max} strokes. That counts as ${S.cap}.`, `Piłka podniesiona po ${S.max} uderzeniach. Liczy się to jako ${S.cap}.`)}</p>`;
    else if (my.bot) html = `<p>${L('A bot is putting for you. Welcome back!', 'Bot uderza za ciebie. Witaj z powrotem!')}</p>`;
    else if (aiming) html = `<div class="power" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(power * 100)}"><i style="width:${Math.round(power * 100)}%"></i></div><p>${L(`${keys ? 'Left and right to aim, up and down for power, space to putt' : power < .04 ? 'Pull further back, or let go to cancel' : 'Let go to putt'}`, `${keys ? 'Lewo i prawo celują, góra i dół ustawiają siłę, spacja uderza' : power < .04 ? 'Pociągnij dalej albo puść, żeby anulować' : 'Puść, żeby uderzyć'}`)} · ${Math.round(power * 100)}%</p>`;
    else if (S.turn !== S.me) html = S.turn >= 0 ? L(`<p><b>${nameOf(S.turn)}</b> ${turnOpen() ? 'is putting' : 'is up next'}. You have taken <b>${my.strokes}</b> of ${S.max} strokes.</p>`, `<p>${turnOpen() ? 'Uderza' : 'Następny uderza'} <b>${nameOf(S.turn)}</b>. Twoje uderzenia: <b>${my.strokes}</b> z ${S.max}.</p>`) : `<p>${L('Rolling…', 'Piłka się toczy…')}</p>`;
    else if (rolling || !canAim()) html = `<p>${L(`${turnOpen() ? 'Rolling…' : 'You are up next.'} <span class="strokes">Stroke ${my.strokes} of ${S.max}</span>`, `${turnOpen() ? 'Piłka się toczy…' : 'Zaraz twoja kolej.'} <span class="strokes">Uderzenie ${my.strokes} z ${S.max}</span>`)}</p>`;
    else html = `<p>${L(`<b>Your putt.</b> Drag back anywhere and let go. <span class="strokes">Stroke ${my.strokes + 1} of ${S.max}</span>`, `<b>Twoje uderzenie.</b> Przeciągnij do tyłu w dowolnym miejscu i puść. <span class="strokes">Uderzenie ${my.strokes + 1} z ${S.max}</span>`)}</p>`;
    setHtml(el, html);
  }

  function renderDone() {
    const el = $('mg-done'), R = S.holeRes;
    el.hidden = !(S.stage === 'done' && R && S.ph === 'play');
    if (el.hidden) return;
    const ord = S.seats.map((_, i) => i).sort((a, b) => (a === R.win ? -1 : b === R.win ? 1 : R.scores[a] - R.scores[b]));
    setHtml(el, `<h2>${L(`${R.win >= 0 ? `${youOr(R.win)} take${R.win === S.me ? '' : 's'} hole ${S.hole}` : `Nobody holed out on hole ${S.hole}`}`, `${R.win >= 0 ? (R.win === S.me ? `Dołek ${S.hole} jest twój` : `Dołek ${S.hole} wygrywa ${nameOf(R.win)}`) : `Nikt nie trafił do dołka ${S.hole}`}`)}</h2>
      <ol>${ord.map(i => { const p = S.seats[i], sc = R.scores[i];
        return `<li class="${i === R.win ? 'won' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${nameHtml(p.name, p.fl)}</b><span>${L(`${sc >= S.cap ? 'picked up' : scoreName(sc, R.par).replace('!', '')}`, `${sc >= S.cap ? 'podniesiona' : scoreName(sc, R.par).replace('!', '')}`)}</span><strong>${sc}</strong></li>`; }).join('')}</ol>
      <p class="next">${L(`${S.hole < S.holes ? 'Next hole coming up…' : 'That was the last hole!'}`, `${S.hole < S.holes ? 'Zaraz następny dołek…' : 'To był ostatni dołek!'}`)}</p>`);
  }

  function renderBanner() {
    const el = $('mg-banner'); let msg = '';
    const left = Math.max(0, endsAt - performance.now());
    if (S.ph !== 'play') msg = S.win >= 0 ? L(`${nameOf(S.win)} wins the round!`, `Rundę wygrywa ${nameOf(S.win)}!`) : '';
    else if (S.stage === 'bet') msg = L(`Hole ${S.hole}: ${S.name} · Par ${S.par}`, `Dołek ${S.hole}: ${holeName(S.name)} · Par ${S.par}`);
    else if (S.stage === 'play') msg = S.turn >= 0 && turnOpen() ? L(`${S.turn === S.me ? 'Your putt' : `${S.seats[S.turn]?.name}'s putt`} · ${Math.ceil(left / 1000)}s`, `${S.turn === S.me ? 'Twoje uderzenie' : `Uderza ${S.seats[S.turn]?.name}`} · ${Math.ceil(left / 1000)} s`) : holeName(S.name);
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.ph === 'play' && S.stage === 'play' && S.turn === S.me && turnOpen() && left < 6000);
  }

  function render() {
    if (!S) return;
    setHtml($('mg-hole'), `${L(`<i>Hole </i>${S.hole}/${S.holes} · Par ${S.par}`, `<i>Dołek </i>${S.hole}/${S.holes} · Par ${S.par}`)}`);
    const my = me();
    $('mg-code').textContent = Rm?.code || '';
    buildTags(); renderTags(); renderList(); renderPutt(); renderDone(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('mg-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'hole') { hideResults(); sfx.draw(); big(L(`Hole ${S.hole}`, `Dołek ${S.hole}`), `${esc(holeName(S.name))} · Par ${S.par}`, 2000); }
    else if (e.t === 'go') { big(L('Tee off!', 'Zaczynamy!'), `${esc(holeName(S.name))} · Par ${S.par}`, 1300); sfx.turn(); }
    else if (e.t === 'holeEnd') { const R = S.holeRes; if (R?.win === S.me) sfx.set(); else sfx.pop(); }
    else if (e.t === 'late') { if (e.s === S.me) ctx.toast(L('Out of time, so the game putted for you.', 'Koniec czasu, więc gra uderzyła za ciebie.')); }
    else if (e.t === 'sit') ctx.toast(L(`${nameOf(e.s)} joins the round.`, `${nameOf(e.s)} dołącza do rundy.`));
    else if (e.t === 'end') {
      if (S.win === S.me) { sfx.win(); confetti(); } else sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + s.left; turnAt = performance.now() + (s.tin || 0);
    const my = me();
    if (my) { readyAt = performance.now() + my.wait; }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results: final standings with the full scorecard -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win;
    el.innerHTML = `<div class="sheet">
      <h2>${I.flag}${L(`${w === S.me ? 'You win' : `${nameOf(w)} wins`} the round!`, `${w === S.me ? 'Wygrywasz rundę!' : `Rundę wygrywa ${nameOf(w)}!`}`)}</h2>
      <p>${L(`${S.holes} holes, par ${R.par}. Fewest strokes wins. `, `Dołki: ${S.holes}, par ${R.par}. Wygrywa najmniej uderzeń.`)}</p>
      <div class="cardwrap"><table class="mg-card"><thead><tr><th>${L('Hole', 'Dołek')}</th>${S.pars.map((_, h) => `<th>${h + 1}</th>`).join('')}<th>${L('Total', 'Razem')}</th><th>${L('Coins', 'Monety')}</th></tr>
        <tr class="par"><th>Par</th>${S.pars.map(p => `<td>${p}</td>`).join('')}<td>${R.par}</td><td></td></tr></thead>
        <tbody>${R.order.map((i, n) => { const p = S.seats[i];
          return `<tr class="${i === S.me ? 'mg-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><th class="${pbRowCls(p.fl)}"><span class="who">${avatarHtml(p.color, p.av, 30, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b></span>${rowBg(p.fl)}</th>
            ${p.card.map((sc, h) => `<td class="${sc < S.pars[h] ? 'under' : sc > S.pars[h] ? 'over' : ''}">${sc}</td>`).join('')}<td><strong>${R.totals[i]}</strong><small>${vsPar(R.totals[i] - R.par)}</small></td><td class="mg-paid">${paidHtml(Rm, i)}</td></tr>`; }).join('')}</tbody></table></div>
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

  // reactions float up from the sender's golfer
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

  // clock: the banner, the last-seconds ticks, and the moment your ball is ready again
  let wasReady = false, wasOpen = false;
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    const n = Math.ceil((endsAt - performance.now()) / 1000);
    if (n !== lastTick && n <= 5 && n > 0 && ((S.stage === 'play' && S.turn === S.me && turnOpen()))) { lastTick = n; sfx.tick(); }
    const r = canAim(), o = S.stage === 'play' && turnOpen();
    if (r !== wasReady || o !== wasOpen) { if (r && !wasReady) sfx.turn(); wasReady = r; wasOpen = o; renderPutt(); renderTags(); renderList(); }
  }, 100);

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
    const b = e.target.closest('.btn, .round, .pick, .pills button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
