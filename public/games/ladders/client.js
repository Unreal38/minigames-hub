// Snakes & Ladders game view: HUD over the 3D board. Renders what the server says; sends rolls.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
const dieSvg = (v, s = 34) => `<svg class="die" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#fff8ec" stroke="#3b2219" stroke-width="2.4"/>${(PIPS[v] || []).map(([x, y]) => `<circle cx="${x * 6}" cy="${y * 6}" r="${v === 1 ? 3 : 2.1}" fill="${v === 1 ? '#e5543b' : '#3b2219'}"/>`).join('')}</svg>`;
const SP = {
  boost: ['Zoom!', y => `hop${y ? '' : 's'} 3 more tiles`],
  again: ['Roll again!', y => `get${y ? '' : 's'} a bonus roll`],
  swap: ['Switcheroo!', () => ''],
  nap: ['Nap time', y => `snooze${y ? '' : 's'} through the next turn`],
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./ladders.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="sl">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="sl-round"></span></div>
      <div class="tr"><span class="tcode" id="sl-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="sl-banner" aria-live="polite"></div>
      <div class="shout" id="sl-big" aria-live="assertive"></div>
      <ol class="list" id="sl-list" aria-label="Players"></ol>
      <div class="rollbar" id="sl-roll"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.sl'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null, busy = false;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, rolled = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame, onCue });
    if (S) sync();
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const myTurn = () => S && S.ph === 'play' && S.stage === 'roll' && S.turn === S.me && me() && !me().bot;

  function sync() {
    if (!scene || !S) return;
    scene.setBoard(S.board);
    scene.setSeats(S.seats);
    scene.setMove(S.move);
    scene.setTurn(S.turn, S.stage);
    scene.setMe(S.me);
  }

  function onFrame(info) {
    live = info;
    if (busy !== info.busy) { busy = info.busy; renderList(); renderRoll(); renderBanner(); }
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const want = t.show && i === S.turn && i !== S.me && S.ph === 'play'; // your own token has the 3D arrow instead
      if (!want) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.classList.toggle('now', i === S.turn);
    }
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => `<div class="sl-tag${i === S.me ? ' sl-you' : ''}" hidden><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div>`).join('');
    tagEls = [...tagsEl.children];
  }

  // A move cue from the 3D scene: sounds and the big pop-up words.
  function onCue(c) {
    if (!S) return;
    const who = youOr(c.s);
    if (c.k === 'die') { sfx.draw(); }
    else if (c.k === 'hop') sfx.pop();
    else if (c.k === 'ladder') { sfx.set(); big('Ladder!', `${who} climb${c.s === S.me ? '' : 's'} up to ${c.b}`, 1500); }
    else if (c.k === 'snake' && c.up) { sfx.set(); big('Snake ride!', `${who} ride${c.s === S.me ? '' : 's'} up to ${c.b}`, 1500); }
    else if (c.k === 'snake') { sfx.bad(); sfx.lose(); big('Snake!', `${who} slide${c.s === S.me ? '' : 's'} down to ${c.b}`, 1600); }
    else if (c.k === 'broken') { sfx.bad(); big('Broken ladder!', `${who} only get${c.s === S.me ? '' : 's'} halfway, to ${c.b}`, 1600); }
    else if (c.k === 'crack') { sfx.plop(); big('Crack!', 'That ladder just broke', 1300); }
    else if (c.k === 'stuck') { sfx.lose(); big('Stuck!', `${who} skip${c.s === S.me ? '' : 's'} the next turn`, 1300); }
    else if (c.k === 'special') { sfx.turn(); const t = SP[c.sp][1](c.s === S.me); big(SP[c.sp][0], t && `${who} ${t}`, 1300); }
    else if (c.k === 'swap') { sfx.plop(); big('Switcheroo!', `${who} and ${youOr(c.other)} trade places`, 1500); }
  }

  // ----- rendering -----
  function moving(i) { return busy && S.move && (S.move.s === i || S.move.segs.some(g => g.t === 'swap' && g.with === i)); }

  function renderList() {
    if (!S) return;
    const el = $('sl-list'), N = S.board.size;
    const ord = S.seats.map((_, i) => i);
    setHtml(el, ord.map(i => {
      const p = S.seats[i], now = i === S.turn && S.ph === 'play';
      const where = moving(i) ? '…' : p.pos >= N ? '🏁' : p.pos ? `tile ${p.pos}` : 'start';
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' me' : ''}">${avatarHtml(p.color, p.av, 30)}<b>${nameHtml(p.name, p.fl)}</b>${p.nap ? '<em title="napping">Zz</em>' : ''}<span>${where}</span></li>`;
    }).join(''));
  }

  function renderRoll() {
    const el = $('sl-roll');
    if (!S || S.ph !== 'play') { setHtml(el, ''); el.hidden = true; return; }
    el.hidden = false;
    if (myTurn()) {
      setHtml(el, `<button type="button" class="btn big r rollbtn" data-a="roll">${dieSvg(5, 36)}Roll the die</button>`);
    } else if (S.stage === 'move' || busy) {
      setHtml(el, `<span class="rolled">${dieSvg(S.move?.die || 1, 30)}<span>${youOr(S.move?.s)} rolled a <b>${S.move?.die}</b></span></span>`);
    } else {
      const p = S.seats[S.turn];
      setHtml(el, `<span class="rolled">${avatarHtml(p.color, p.av, 30)}<span>${S.turn === S.me ? 'A bot is rolling for you' : `${nameOf(S.turn)} is rolling…`}</span></span>`);
    }
  }

  function renderBanner() {
    const el = $('sl-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.ph === 'end') msg = S.win >= 0 ? `${youOr(S.win)} win${S.win === S.me ? '' : 's'}!` : '';
    else if (S.stage === 'move' || busy) msg = S.move ? `${youOr(S.move.s)} rolled a ${S.move.die}${S.move.die === 6 && S.seats[S.move.s].pos < S.board.size ? ' · roll again!' : ''}` : '';
    else if (myTurn()) msg = S.left >= 0 ? `Your turn · ${secs}s` : 'Your turn!';
    else msg = `${nameOf(S.turn)}'s turn`;
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    $('sl-round').textContent = `${S.hard ? 'Hard · ' : ''}Round ${S.round} · first to ${S.board.size}`;
    $('sl-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderRoll(); renderBanner();
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('sl-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'again' && e.s === S.me && S.seats[S.me].pos < S.board.size) { ctx.toast('Bonus roll! Go again.'); sfx.turn(); }
    else if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? 'You took over a bot. Your token, your rolls!' : `${esc(nameOf(e.s))} took over a bot`); }
    else if (e.t === 'nap') ctx.toast(`Zz… ${e.s === S.me ? 'you nap' : nameOf(e.s) + ' naps'} through a turn`);
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } else sfx.lose();
      big(`${youOr(e.w)} win${e.w === S.me ? '' : 's'}!`, `first to tile ${S.board.size}`, 2000);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prevTurn = S ? S.turn + S.stage : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.left);
    if (!fresh && myTurn() && prevTurn !== s.turn + s.stage) { sfx.turn(); lastTick = -1; }
    if (s.stage !== 'roll') rolled = 0;
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win, N = S.board.size;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? 'You reached the top!' : `${nameOf(w)} wins!`}</h2>
      <p>${myPlace ? (myPlace === 1 ? 'First to the star. ' : `You came ${ORD(myPlace)}. `) : ''}That took ${S.res.rounds} round${S.res.rounds === 1 ? '' : 's'}.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? ' (you)' : ''}</b><span>${st.ladders} ladder${st.ladders === 1 ? '' : 's'} · ${st.snakes} snake${st.snakes === 1 ? '' : 's'} · ${st.sixes} six${st.sixes === 1 ? '' : 'es'}</span></div>
          <strong>${p.pos >= N ? '🏁' : p.pos}<small>${p.pos >= N ? 'home' : 'tile'}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Play again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Play again');
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

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#e5543b'];
    const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
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

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (myTurn() && S.left >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  function doRoll() {
    if (!myTurn() || Date.now() - rolled < 1500) return;
    rolled = Date.now(); sfx.click(); ctx.act({ t: 'roll' });
  }
  const onKey = e => { if ((e.key === ' ' || e.key === 'Enter') && myTurn() && !e.target.closest?.('input, textarea, button')) { e.preventDefault(); doRoll(); } };
  addEventListener('keydown', onKey);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'roll') doRoll();
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
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
