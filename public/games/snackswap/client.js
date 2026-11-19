// Snack Swap game view: HUD over the 3D table. Renders what the server says; sends plays, votes and chaos cards.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';
import { ITEMS, CHAOS } from './deck.js';
import { itemHtml } from './art.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.500 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  swap: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  double: svg('<path d="M5 7l5 10M10 7L5 17M14 9h5l-5 8h5"/>'),
  steal: svg('<path d="M5 12l4 4 10-10"/><path d="M15 17h5M17.5 14.500v5"/>'),
  star: '<svg class="star" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.500l2.900 6 6.600.9-4.800 4.600 1.200 6.500-5.900-3.200-5.900 3.200 1.200-6.500L2.500 9.400l6.600-.9z" fill="#ffb547" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  if (document.querySelector('link[data-ss]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.ss = '1'; l.href = new URL('./snackswap.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="ss">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="ss-round"></span><span class="chip clock" id="ss-clock"></span></div>
      <div class="tr"><span class="tcode" id="ss-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="prompt" id="ss-prompt" aria-live="polite"></div>
      <ol class="board" id="ss-board" aria-label="Scores"></ol>
      <div class="tray" id="ss-tray"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ss'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let sel = -1, swapping = false, tagEls = [], tagKey = '', live = null, endsAt = 0, lastTick = -1, resultsTimer = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) sync();
  }).catch(err => {
    console.warn('3D unavailable', err);
    root.classList.add('flat');
  });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const av = (i, size) => avatarHtml(S.seats[i].color, S.seats[i].av, size);
  const secs = () => Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
  const winners = () => (S.slots && S.stage !== 'vote' ? S.slots.filter(x => x.won).map(x => x.by) : []);

  // ----- 3D sync -----
  function sync() {
    if (!scene || !S) return;
    scene.setSeats(S.seats, S.me);
    scene.setState({
      stage: S.stage, played: S.seats.map(p => p.played), winners: winners(),
      waiting: S.seats.map(p => (S.stage === 'play' && !p.played) || (S.stage === 'vote' && !p.voted)),
    });
  }
  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (el.hidden === t.show) el.hidden = !t.show;
      if (t.show) el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function renderTags() {
    const key = S.seats.map(p => p.name + p.color + p.av.join('')).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="tag${i === S.me ? ' mine' : ''}" hidden><b>${esc(p.name)}</b><i></i></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const win = winners();
    S.seats.forEach((p, i) => {
      const el = tagEls[i], st = el.lastElementChild;
      const done = S.stage === 'play' ? p.played : S.stage === 'vote' ? p.voted : null;
      const txt = done === null ? String(p.pts) : done ? '✓' : '…';
      if (st.textContent !== txt) st.textContent = txt;
      el.classList.toggle('done', done === true); el.classList.toggle('wait', done === false); el.classList.toggle('won', win.includes(i));
    });
  }

  // ----- rendering -----
  function renderBoard() {
    const ord = S.seats.map((_, i) => i).sort((a, b) => S.seats[b].pts - S.seats[a].pts || a - b);
    setHtml($('ss-board'), ord.map((i, n) => {
      const p = S.seats[i];
      return `<li class="${i === S.me ? 'me' : ''}"><i class="pos">${n + 1}</i>${av(i, 30)}<b>${esc(p.name)}</b><span>${p.pts}</span></li>`;
    }).join(''));
  }

  function renderPrompt() {
    const p = S.prompt; if (!p) return;
    if (setHtml($('ss-prompt'), `<small>Round ${S.round} of ${S.rounds}${p.by ? ` · prompt by ${esc(p.by)}` : ''}</small><p>${esc(p.text)}</p>`)) {
      const el = $('ss-prompt'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
  }

  function chaosBar() {
    const c = S.myChaos; if (!S.chaosOn || !c) return '';
    if (c.used) {
      const armed = (c.used === 'double' && c.dd) || (c.used === 'steal' && c.steal);
      return `<div class="chaos used"><span>${I[c.used]}<b>${CHAOS[c.used].name}</b> ${armed ? 'is armed for this round' : 'played. That was your chaos card for this game.'}</span></div>`;
    }
    const my = me(), btn = k => {
      const ok = CHAOS[k].when === S.stage && (k !== 'swap' || !my.played);
      const why = ok ? CHAOS[k].text : k === 'steal' ? 'Play this while voting.' : S.stage === 'play' ? 'Play this before your card.' : 'Play this while picking a card.';
      return `<button type="button" class="cbtn ${k}" data-a="chaos" data-k="${k}" ${ok ? '' : 'disabled'} title="${esc(why)}">${I[k]}${CHAOS[k].name}</button>`;
    };
    return `<div class="chaos"><span class="lbl">One chaos card per game</span>${btn('swap')}${btn('double')}${btn('steal')}</div>`;
  }

  function slotCard(x, k) {
    const mine = k === S.mySlot, shown = S.stage !== 'vote';
    if (!shown) {
      const on = S.myVote === k;
      return `<div class="slot${mine ? ' mine' : ''}${on ? ' on' : ''}">${itemHtml(x.c, { tag: 'button', attrs: `data-a="vote" data-k="${k}" ${mine || S.me < 0 ? 'disabled' : ''} aria-pressed="${on}"` })}
        <span class="cap">${mine ? 'Yours' : on ? 'Your vote' : '&nbsp;'}</span></div>`;
    }
    const notes = [x.dd ? `<em class="dd">Double Down ×2</em>` : '', x.stolen ? `<em class="st">stole ${plural(x.stolen, 'vote')}</em>` : '', x.lost ? `<em class="lost">robbed of ${x.lost}</em>` : ''].join('');
    return `<div class="slot shown${x.won ? ' won' : ''}${x.by === S.me ? ' mine' : ''}" style="animation-delay:${k * 70}ms">
      ${x.won ? `<span class="crown">${I.star}Funniest</span>` : ''}${itemHtml(x.c)}
      <span class="by">${av(x.by, 26)}<b>${x.by === S.me ? 'You' : nameOf(x.by)}</b></span>
      <span class="votes">${x.voters.map(v => `<i title="${nameOf(v)}">${av(v, 22)}</i>`).join('') || '<small>no votes</small>'}</span>
      <strong class="${x.pts ? 'up' : ''}">+${x.pts}</strong>${notes}</div>`;
  }

  function renderTray() {
    const el = $('ss-tray'), my = me();
    let html = '';
    if (S.ph === 'end') { setHtml(el, ''); el.hidden = true; return; }
    el.hidden = false;
    if (S.stage === 'play') {
      const left = S.seats.filter(p => !p.played).length;
      if (!my) html = `<div class="head"><h2>Everyone is picking a card…</h2><span>You are watching this game.</span></div>`;
      else if (swapping && !my.played) {
        html = `<div class="head"><h2>${I.swap} Swap hands with…</h2><button type="button" class="btn w sm" data-a="noswap">Cancel</button></div>
          <div class="targets">${S.seats.map((p, i) => i === S.me ? '' : `<button type="button" class="tgt" data-a="swapwith" data-i="${i}">${av(i, 44)}<b>${esc(p.name)}</b><small>${plural(p.cards, 'card')}</small></button>`).join('')}</div>`;
      } else if (!my.played) {
        if (sel >= S.hand.length) sel = -1;
        html = `<div class="head"><h2>Play your funniest card</h2>
          <button type="button" class="btn m" data-a="play" ${sel < 0 ? 'disabled' : ''}>${sel < 0 ? 'Tap a card' : `Play ${esc(ITEMS[S.hand[sel]])}`}</button></div>
          <div class="hand">${S.hand.map((c, i) => itemHtml(c, { tag: 'button', cls: i === sel ? 'sel' : '', attrs: `data-a="sel" data-i="${i}" aria-pressed="${i === sel}"` })).join('')}</div>${chaosBar()}`;
      } else {
        html = `<div class="head"><h2>Your card is in!</h2><span>${left ? `Waiting for ${plural(left, 'more player')}…` : 'Everyone is in.'}</span></div>
          <div class="hand waiting">${itemHtml(S.myPlay, { cls: 'played' })}<div class="rest">${S.hand.map(c => itemHtml(c, { cls: 'dim' })).join('')}</div></div>${chaosBar()}`;
      }
    } else if (S.stage === 'vote' && S.slots) {
      const left = S.seats.filter(p => !p.voted).length;
      html = `<div class="head"><h2>${my ? (S.myVote === null ? 'Vote for the funniest' : 'Vote locked in. You can still change it.') : 'The table is voting…'}</h2>
        <span>${left ? `${plural(left, 'vote')} to go` : 'All votes are in.'}</span></div>
        <div class="slots">${S.slots.map(slotCard).join('')}</div>${chaosBar()}`;
    } else if (S.stage === 'reveal' && S.slots) {
      const mine = S.slots.find(x => x.by === S.me), last = S.round >= S.rounds;
      const line = !mine ? '' : mine.won ? 'Yours was the funniest!' : mine.pts ? `You picked up ${plural(mine.pts, 'point')}.` : 'Tough crowd. No points this round.';
      const heat = !S.slots.some(x => x.won) && S.slots.some(x => x.n);
      html = `<div class="head"><h2>${heat ? 'A dead heat! Points all round.' : line || 'The votes are in'}</h2>
        ${my ? `<button type="button" class="btn m" data-a="next">${last ? 'See the final scores' : 'Next round'} · <span id="ss-next">${secs()}</span>s</button>` : ''}</div>
        <div class="slots">${S.slots.map(slotCard).join('')}</div>`;
    }
    setHtml(el, html);
  }

  function renderClock() {
    const el = $('ss-clock'), n = secs();
    const txt = S.ph === 'end' ? '' : S.stage === 'reveal' ? '' : `${n}s`;
    if (el.textContent !== txt) el.textContent = txt;
    el.hidden = !txt; el.classList.toggle('low', n <= 5 && S.stage !== 'reveal');
    const nx = root.querySelector('#ss-next'); if (nx && nx.textContent !== String(n)) nx.textContent = n;
  }

  function render() {
    if (!S) return;
    $('ss-round').textContent = S.stage === 'play' ? 'Pick a card' : S.stage === 'vote' ? 'Vote' : S.stage === 'reveal' ? 'Results' : 'Game over';
    $('ss-code').textContent = Rm?.code || '';
    root.dataset.stage = S.stage;
    renderPrompt(); renderBoard(); renderTags(); renderTray(); renderClock();
  }

  // ----- events -> sound & effects -----
  function playEv(e) {
    if (e.t === 'round') { sel = -1; swapping = false; hideResults(); sfx.draw(); }
    else if (e.t === 'played') { sfx.place(); }
    else if (e.t === 'swap') {
      sfx.set(); scene?.hop(e.a);
      if (e.a === S.me) sel = -1;
      ctx.toast(`${I.swap} ${youOr(e.a)} swapped hands with ${e.b === S.me ? 'you' : nameOf(e.b)}!`, e.b === S.me);
      if (e.b === S.me) sel = -1;
    } else if (e.t === 'vote') sfx.turn();
    else if (e.t === 'reveal') {
      const mine = S.slots?.find(x => x.by === S.me);
      if (mine?.won) { sfx.win(); confetti(); } else sfx.set();
      for (const x of S.slots || []) {
        if (x.won) scene?.hop(x.by);
        if (x.lost && x.by === S.me) ctx.toast(`${I.steal} Someone stole ${plural(x.lost, 'vote')} from you!`, true);
      }
    } else if (e.t === 'end') {
      if (e.w.includes(S.me)) { sfx.win(); confetti(); } else sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); sel = -1; swapping = false; lastTick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + s.left;
    if (s.stage !== 'play' || me()?.played) swapping = false;
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, w = R.winners;
    const title = w.includes(S.me) ? (w.length > 1 ? 'You share the win!' : 'You are the funniest!') : w.length > 1 ? `${w.map(nameOf).join(' and ')} tie!` : `${nameOf(w[0])} wins!`;
    el.innerHTML = `<div class="sheet">
      <h2>${title}</h2>
      <p>${S.rounds} rounds of questionable choices. Every vote was a point.</p>
      <ol class="score">${R.order.map((i, n) => {
        const p = S.seats[i];
        return `<li class="${w.includes(i) ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${R.places[i]}</i>${av(i, 44)}
          <div class="who"><b>${esc(p.name)}${i === S.me ? ' (you)' : ''}</b><span>${plural(R.wins[i], 'round')} won · ${plural(R.votes[i], 'vote')}</span></div>
          <strong>${R.pts[i]}<small>points</small></strong></li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Play again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  // Votes arrive with room updates: repaint just the buttons so the sheet doesn't replay its entrance.
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Play again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  // ----- reactions float up from the sender's seat -----
  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 20 : innerHeight * .4;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
    scene?.hop(i);
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

  // ----- countdown ticker -----
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderClock();
    const n = secs();
    if (S.stage !== 'reveal' && n !== lastTick && n <= 5 && n > 0) {
      lastTick = n;
      const my = me(); if (my && ((S.stage === 'play' && !my.played) || (S.stage === 'vote' && !my.voted))) sfx.tick();
    }
  }, 200);

  // ----- input -----
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'sel') { sel = sel === +b.dataset.i ? -1 : +b.dataset.i; sfx.pop(); renderTray(); }
    else if (a === 'play') { if (sel >= 0) { sfx.click(); ctx.act({ t: 'play', i: sel }); sel = -1; } }
    else if (a === 'vote') { sfx.pop(); ctx.act({ t: 'vote', slot: +b.dataset.k }); }
    else if (a === 'chaos') {
      sfx.click();
      if (b.dataset.k === 'swap') { swapping = true; renderTray(); }
      else { ctx.act({ t: 'chaos', k: b.dataset.k }); sfx.set(); }
    } else if (a === 'noswap') { sfx.click(); swapping = false; renderTray(); }
    else if (a === 'swapwith') { swapping = false; ctx.act({ t: 'chaos', k: 'swap', m: +b.dataset.i }); }
    else if (a === 'next') { sfx.click(); ctx.act({ t: 'next' }); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, button.ssc, .cbtn, .tgt');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); scene?.dispose(); },
  };
}
