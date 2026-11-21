// Mini Golf Party game view: HUD over the 3D hole. Renders what the server says; sends putts and bets.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  coin: '<svg class="coin" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffb547" stroke="#3b2219" stroke-width="2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#3b2219" stroke-width="2" opacity=".55"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3v18" stroke="#3b2219" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4l12 4.5L7 13z" fill="#e5543b" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const STAKES = [10, 25, 50];
// what golfers call a score, from strokes and par
function scoreName(n, par) {
  if (n === 1) return 'Hole in one!';
  const d = n - par;
  return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `${d} over par`;
}
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
    <canvas class="g3d" aria-label="The mini golf hole. Drag back and let go to putt, or use the arrow keys and space."></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="mg-hole"></span><span class="chip coins" id="mg-coins"></span></div>
      <div class="tr"><span class="tcode" id="mg-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="mg-banner" aria-live="polite"></div>
      <div class="shout" id="mg-big" aria-live="assertive"></div>
      <ol class="list" id="mg-list" aria-label="Scores"></ol>
      <div class="betbox" id="mg-bet" hidden></div>
      <div class="puttbar" id="mg-putt" hidden></div>
      <div class="holecard" id="mg-done" hidden></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.mg'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let stake = 10, tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, readyAt = 0, power = 0, aiming = false, keys = false, rolling = false, sentAt = 0;

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
  // your ball is still and waiting for you
  function canAim() {
    const my = me();
    return !!my && S.ph === 'play' && S.stage === 'play' && !my.bot && !my.sunk && !my.out && performance.now() >= readyAt && performance.now() - sentAt > 400 && !rolling;
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
    else if (c.k === 'hit') { if (mine) (c.kind === 'p' ? sfx.pop : sfx.tick)(); }
    else if (c.k === 'water') { sfx.plop(); if (mine) { big('Splash!', 'One stroke, and back you go', 1500); sfx.bad(); } }
    else if (c.k === 'sunk') {
      const p = S.seats[c.s]; if (!p) return;
      if (mine) { sfx.win(); if (p.strokes <= S.par) confetti(); big(scoreName(p.strokes, S.par), `In the hole in ${p.strokes}`, 2000); }
      else { sfx.set(); ctx.toast(`${I.flag}${nameOf(c.s)} is in the hole in ${p.strokes}${p.strokes === 1 ? '. A hole in one!' : ''}`); }
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => (i === S.me ? '<i hidden data-e="1"></i>' : `<div class="mg-tag" hidden><i style="background:${p.color}"></i><b>${esc(p.name)}</b></div>`)).join('');
    tagEls = [...tagsEl.children];
  }

  // ----- rendering -----
  function renderList() {
    const done = S.seats[0]?.card.length || 0, par = parSoFar(done);
    const ord = S.seats.map((_, i) => i).sort((a, b) => S.seats[a].total - S.seats[b].total || S.seats[b].wins - S.seats[a].wins || a - b);
    setHtml($('mg-list'), ord.map(i => {
      const p = S.seats[i], playing = S.stage === 'play';
      const now = playing ? (p.sunk ? `<em class="in">${I.check}${p.strokes}</em>` : p.out ? `<em class="out">${S.cap}</em>` : `<em>${p.strokes}</em>`) : '';
      return `<li class="${i === S.me ? 'me' : ''}${playing && (p.sunk || p.out) ? ' fin' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${esc(p.name)}${p.bot && p.human ? ' (away)' : ''}</b>${now}<span>${done ? vsPar(p.total - par) : '–'}</span></li>`;
    }).join(''));
  }

  function renderBet() {
    const el = $('mg-bet'), my = me();
    el.hidden = !(S.stage === 'bet' && S.bets && S.ph === 'play');
    if (el.hidden) return;
    if (!my) { setHtml(el, `<div class="bethead"><h2>Hole ${S.hole}: ${esc(S.name)}</h2><span>Par ${S.par}. You are watching this round.</span></div>`); return; }
    const coins = my.coins || 0, bet = my.bet && my.bet !== 'skip' ? my.bet : null, poor = coins < STAKES[0];
    setHtml(el, `<div class="bethead"><h2>Who takes hole ${S.hole}?</h2><span>Fewest strokes wins it. A right call pays <b>${S.mult}×</b> · you have ${I.coin}<b>${coins}</b></span></div>
      <div class="picks">${S.seats.map((p, i) => `<button type="button" class="pick${bet?.on === i ? ' on' : ''}" data-a="bet" data-i="${i}" ${poor ? 'disabled' : ''} aria-pressed="${bet?.on === i}">
        ${avatarHtml(p.color, p.av, 44)}<b>${i === S.me ? 'Me' : esc(p.name)}</b><span>${p.card.length ? vsPar(p.total - parSoFar(p.card.length)) : p.bot && !p.human ? 'bot' : 'new'}</span></button>`).join('')}</div>
      <div class="stakes"><span>Stake</span><div class="pills">${STAKES.map(v => `<button type="button" data-a="stake" data-v="${v}" aria-pressed="${stake === v}" ${v > coins ? 'disabled' : ''}>${v}</button>`).join('')}</div>
        <span class="mybet">${poor ? 'You need 10 coins to bet. Finish the round to earn some.' : bet ? `${I.coin}<b>${bet.amt}</b> on ${bet.on === S.me ? 'yourself' : nameOf(bet.on)}` : my.bet === 'skip' ? 'No bet this hole.' : 'Tap a player to bet on them. Betting is optional.'}</span>
        <button type="button" class="btn ${my.bet === 'skip' || poor ? 'w' : 'm'}" data-a="skip" ${my.bet === 'skip' ? 'disabled' : ''}>${bet ? 'Remove bet' : my.bet === 'skip' ? 'Waiting for the others' : 'No bet, just play'}</button></div>`);
  }

  function renderPutt() {
    const el = $('mg-putt'), my = me();
    el.hidden = !(S && S.ph === 'play' && S.stage === 'play');
    if (el.hidden) return;
    let html;
    if (!my) html = '<p>You are watching. Take a seat for the next hole from the bar above.</p>';
    else if (my.sunk) html = `<p class="good">${I.flag}In the hole in <b>${my.strokes}</b>. ${scoreName(my.strokes, S.par).replace('!', '')}. Waiting for the others.</p>`;
    else if (my.out) html = `<p>Picked up after ${S.max} strokes. That counts as ${S.cap}.</p>`;
    else if (my.bot) html = '<p>A bot is putting for you. Welcome back!</p>';
    else if (aiming) html = `<div class="power" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(power * 100)}"><i style="width:${Math.round(power * 100)}%"></i></div><p>${keys ? 'Left and right to aim, up and down for power, space to putt' : power < .04 ? 'Pull further back, or let go to cancel' : 'Let go to putt'} · ${Math.round(power * 100)}%</p>`;
    else if (rolling || !canAim()) html = `<p>Rolling… <span class="strokes">Stroke ${my.strokes} of ${S.max}</span></p>`;
    else html = `<p><b>Your putt.</b> Drag back anywhere and let go. <span class="strokes">Stroke ${my.strokes + 1} of ${S.max}</span></p>`;
    setHtml(el, html);
  }

  function renderDone() {
    const el = $('mg-done'), R = S.holeRes;
    el.hidden = !(S.stage === 'done' && R && S.ph === 'play');
    if (el.hidden) return;
    const ord = S.seats.map((_, i) => i).sort((a, b) => (a === R.win ? -1 : b === R.win ? 1 : R.scores[a] - R.scores[b]));
    const my = S.me >= 0 ? R.pay[S.me] : null;
    setHtml(el, `<h2>${R.win >= 0 ? `${youOr(R.win)} take${R.win === S.me ? '' : 's'} hole ${S.hole}` : `Nobody holed out on hole ${S.hole}`}</h2>
      <ol>${ord.map(i => { const p = S.seats[i], sc = R.scores[i], pay = R.pay[i];
        return `<li class="${i === R.win ? 'won' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${esc(p.name)}</b><span>${sc >= S.cap ? 'picked up' : scoreName(sc, R.par).replace('!', '')}</span><strong>${sc}</strong>${pay ? `<small class="${pay.net > 0 ? 'up' : pay.net < 0 ? 'down' : ''}">${pay.net > 0 ? '+' : ''}${pay.net}${I.coin}</small>` : ''}</li>`; }).join('')}</ol>
      ${my ? `<p>${my.net > 0 ? `Your bet came in: +${my.net} coins.` : my.net < 0 ? `Your bet on ${my.on === S.me ? 'yourself' : nameOf(my.on)} lost ${-my.net} coins.` : 'Nobody won the hole, so your stake came back.'}</p>` : ''}
      <p class="next">${S.hole < S.holes ? 'Next hole coming up…' : 'That was the last hole!'}</p>`);
  }

  function renderBanner() {
    const el = $('mg-banner'); let msg = '';
    const left = Math.max(0, endsAt - performance.now());
    if (S.ph !== 'play') msg = S.win >= 0 ? `${nameOf(S.win)} wins the round!` : '';
    else if (S.stage === 'bet') msg = S.bets ? `Place your bets · ${Math.ceil(left / 1000)}s` : `Hole ${S.hole}: ${S.name} · Par ${S.par}`;
    else if (S.stage === 'play') { const inn = S.seats.filter(p => p.sunk || p.out).length; msg = `${S.name} · ${mmss(left)}${inn ? ` · ${inn}/${S.seats.length} done` : ''}`; }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.ph === 'play' && S.stage === 'play' && left < 10_000);
  }

  function render() {
    if (!S) return;
    setHtml($('mg-hole'), `<i>Hole </i>${S.hole}/${S.holes} · Par ${S.par}`);
    const my = me();
    setHtml($('mg-coins'), my ? `${I.coin}${my.coins ?? 0}` : 'Watching');
    $('mg-coins').hidden = !S.bets;
    $('mg-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderBet(); renderPutt(); renderDone(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('mg-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'hole') { hideResults(); sfx.draw(); if (!S.bets) big(`Hole ${S.hole}`, `${esc(S.name)} · Par ${S.par}`, 2000); }
    else if (e.t === 'go') { big('Tee off!', `${esc(S.name)} · Par ${S.par}`, 1300); sfx.turn(); }
    else if (e.t === 'holeEnd') { const R = S.holeRes, my = R?.pay?.[S.me]; if (my?.net > 0) { sfx.win(); confetti(); } else if (R?.win === S.me) sfx.set(); else sfx.pop(); }
    else if (e.t === 'sit') ctx.toast(`${nameOf(e.s)} joins the round.`);
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
    endsAt = performance.now() + s.left;
    const my = me();
    if (my) { readyAt = performance.now() + my.wait; if (stake > (my.coins || 0)) stake = 10; }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results: final standings with the full scorecard -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win, my = me();
    const line = my && S.bets ? (my.net > 0 ? `Your bets made ${I.coin}<b>${my.net}</b>.` : my.net < 0 ? `Your bets cost ${I.coin}<b>${-my.net}</b>.` : '') : '';
    el.innerHTML = `<div class="sheet">
      <h2>${I.flag}${w === S.me ? 'You win' : `${nameOf(w)} wins`} the round!</h2>
      <p>${S.holes} holes, par ${R.par}. Fewest strokes wins. ${line}</p>
      <div class="cardwrap"><table class="mg-card"><thead><tr><th>Hole</th>${S.pars.map((_, h) => `<th>${h + 1}</th>`).join('')}<th>Total</th></tr>
        <tr class="par"><th>Par</th>${S.pars.map(p => `<td>${p}</td>`).join('')}<td>${R.par}</td></tr></thead>
        <tbody>${R.order.map((i, n) => { const p = S.seats[i];
          return `<tr class="${i === S.me ? 'me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><th><span class="who">${avatarHtml(p.color, p.av, 30)}<b>${esc(p.name)}${i === S.me ? ' (you)' : ''}</b></span></th>
            ${p.card.map((sc, h) => `<td class="${sc < S.pars[h] ? 'under' : sc > S.pars[h] ? 'over' : ''}">${sc}</td>`).join('')}<td><strong>${R.totals[i]}</strong><small>${vsPar(R.totals[i] - R.par)}</small></td></tr>`; }).join('')}</tbody></table></div>
      <div class="againbox">${againHtml(ctx, Rm, 'Play again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Play again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  // reactions float up from the sender's golfer
  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 20 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
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
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    step();
  }

  // clock: the banner, the last-seconds ticks, and the moment your ball is ready again
  let wasReady = false;
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    const n = Math.ceil((endsAt - performance.now()) / 1000);
    if (n !== lastTick && n <= 5 && n > 0 && (S.stage === 'play' || (S.stage === 'bet' && S.bets))) { lastTick = n; sfx.tick(); }
    const r = canAim(); if (r !== wasReady) { wasReady = r; renderPutt(); }
  }, 100);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'bet') { sfx.pop(); ctx.act({ t: 'bet', on: +b.dataset.i, amt: stake }); }
    else if (a === 'stake') {
      stake = +b.dataset.v; sfx.click();
      const cur = me()?.bet; if (cur && cur !== 'skip') ctx.act({ t: 'bet', on: cur.on, amt: stake }); else { $('mg-bet')._h = ''; renderBet(); }
    } else if (a === 'skip') { sfx.click(); ctx.act({ t: 'skip' }); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
