// Hot Pot game view: HUD + 3D table. Renders whatever the server says; sends intents.
import { CATS, kindOf, catOf, cardName, canWin, bestSets, setVal } from './rules.js';
import { iconSvg, backSvg } from './icons.js';
import { cardHtml } from './cards.js';
import { sfx } from '../../sfx.js';
import { REACT_COUNT, reactHtml, reactLabel, floatAt } from '../../react.js';
import { tableArt, potLogo } from '../../art.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { nameHtml, titleHtml } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./hotpot.css', import.meta.url).href;
  document.head.append(l);
}

// graphics quality, remembered on this device
const GFX = { auto: ['Auto', 'Graphics: auto'], low: ['Low', 'Graphics: low. Easier on your laptop and battery.'], high: ['High', 'Graphics: high. Sharpest, and the hardest on your laptop.'] };
let gfx = (() => { try { const v = localStorage.getItem('ct_gfx'); return GFX[v] ? v : 'auto'; } catch { return 'auto'; } })();

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="hp">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="flatbg" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="hp-round"></span><span class="chip" id="hp-deckc"></span></div>
      <div class="tr"><span class="tcode" id="hp-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round gfx" data-a="gfx" aria-label="Graphics quality" title="Graphics quality">${GFX[gfx][0]}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="opp" data-r="1"></div><div class="opp" data-r="2"></div><div class="opp" data-r="3"></div>
      <div class="turn" id="hp-turn">
        <svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" class="rb"/><circle cx="22" cy="22" r="18" class="rf" id="hp-ring"/><text x="22" y="27" text-anchor="middle" id="hp-ringt"></text></svg>
        <span id="hp-msg"></span></div>
      <div class="deck" hidden><button type="button" class="deckbtn btn" data-a="deck" aria-label="Draw from the pot">${potLogo(30, '#3b2219', '#e5543b', '#fff4e2', '#3b2219')}<span>Draw</span></button></div>
      <div class="mine" id="hp-mine"></div>
      <div class="hand" id="hp-hand"></div>
      <div class="sets" id="hp-sets"></div>
      <div class="emotes"><span>React</span><div>${Array.from({ length: REACT_COUNT }, (_, k) => `<button type="button" class="${k < 6 ? 'food' : 'emoji'}" data-a="react" data-k="${k}" aria-label="React with ${reactLabel(k)}">${reactHtml(k)}</button>`).join('')}</div></div>
      <button type="button" class="btn big r eat" data-a="eat" hidden>Let's Eat!</button>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.hp'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), hand = $('hp-hand');
  let S = null, R = ctx.room(), lastEv = 0, gid = null, scene = null, tEnd = 0, lastSec = -1, destroyed = false;
  let prevHand = [], prevSets = 0, resultsTimer = 0, lastReact = 0;

  // ----- 3D (optional: the game works without it) -----
  import('./scene3d.js').then(m => {
    if (destroyed) return;
    m.setCardBack(R?.players?.find(p => p.id === ctx.myId())?.fl?.cb);
    scene = m.createScene(canvas, {
      quality: gfx,
      onTile: r => canTake(abs(r)) && take(abs(r)),
      onDeck: () => myDraw() && drawDeck(),
      onLayout: (pts, info) => { layout = pts; potPt = info.pot; placeBadges(); },
    });
    root.classList.add('has3d');
    if (S) syncScene();
  }).catch(err => {
    console.warn('3D unavailable, using flat table', err);
    root.classList.add('flat');
    root.querySelector('.flatbg').innerHTML = tableArt(700, 470, []);
  });

  let layout = null, potPt = null;
  // In 3D, name tags follow the avatars: under the side seats, beside the far seat.
  function placeBadges() {
    if (potPt) Object.assign(root.querySelector('.deck').style, { left: potPt.x + 'px', top: potPt.y + 'px' });
    const on = layout && innerWidth >= 760;
    for (let r = 1; r < 4; r++) {
      const el = root.querySelector(`.opp[data-r="${r}"]`);
      if (!on) { el.style.left = el.style.top = el.style.right = ''; continue; }
      const p = layout[r], w = el.offsetWidth, h = el.offsetHeight;
      let x = r === 2 ? p.x + 70 : p.x - w / 2, y = r === 2 ? p.y - h / 2 : p.y;
      x = Math.max(10, Math.min(innerWidth - w - 10, x)); y = Math.max(60, Math.min(innerHeight * .62, y));
      Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto' });
    }
  }
  const onResize = () => requestAnimationFrame(placeBadges);
  addEventListener('resize', onResize);
  const base = () => (S && S.me >= 0 ? S.me : 0);
  const rel = i => (i - base() + 4) % 4;
  const abs = r => (base() + r) % 4;
  const myTurn = () => S && S.ph === 'play' && S.me >= 0 && S.turn === S.me;
  const myDraw = () => myTurn() && S.step === 'draw';
  const myDisc = () => myTurn() && S.step === 'disc';
  const canTake = i => myDraw() && i !== S.me && S.seats[i]?.top >= 0;
  const take = i => { sfx.click(); ctx.act({ t: 'take', from: i }); };
  const drawDeck = () => { sfx.click(); ctx.act({ t: 'deck' }); };
  const nameOf = i => esc(S.seats[i]?.name);

  // ----- rendering -----
  function render() {
    if (!S) return;
    $('hp-round').textContent = `Round ${Math.min(S.round, S.maxR)} / ${S.maxR}`;
    $('hp-deckc').textContent = `In the pot: ${S.dc}`;
    $('hp-code').textContent = R?.code || '';
    for (let r = 1; r < 4; r++) {
      const i = abs(r), p = S.seats[i], el = root.querySelector(`.opp[data-r="${r}"]`);
      const active = S.ph === 'play' && S.turn === i;
      el.className = `opp${active ? ' active' : ''}`;
      el.dataset.r = r;
      const status = active ? (S.step === 'draw' ? 'choosing…' : 'discarding…') : p.bot ? (p.human ? 'away (bot)' : 'bot') : 'waiting';
      el.innerHTML = `${avatarHtml(p.color, p.av, 46)}
        <div class="who"><b>${nameHtml(S.seats[i]?.name, S.seats[i]?.fl)}</b>${titleHtml(S.seats[i]?.fl)}<span>${status}${active ? '<i class="dotty"><i></i><i></i><i></i></i>' : ''}</span>
        <span class="mini" aria-label="${p.n} cards">${Array.from({ length: Math.min(p.n, 9) }, () => '<i></i>').join('')}</span></div>
        <div class="pile">${p.top >= 0 ? cardHtml(p.top, { tag: 'button', cls: canTake(i) ? 'takeable' : '', attrs: `data-a="take" data-i="${i}" ${canTake(i) ? '' : 'tabindex="-1"'}` }) : '<span class="slot">empty</span>'}
        ${canTake(i) ? '<em>take</em>' : ''}</div>`;
    }
    // turn banner
    let msg;
    if (S.ph === 'end') msg = S.win >= 0 ? `${S.win === S.me ? 'You' : nameOf(S.win)} called Let's Eat!` : 'Out of rounds!';
    else if (S.me < 0) msg = `Watching · ${nameOf(S.turn)}'s turn`;
    else if (myDraw()) msg = 'Your turn: draw from the pot';
    else if (myDisc()) msg = canWin(S.hand) ? 'Three sets! Eat, or keep going' : 'Tap a card to discard';
    else msg = `${nameOf(S.turn)}'s turn`;
    $('hp-msg').innerHTML = msg;
    $('hp-turn').classList.toggle('myturn', myTurn());
    $('hp-turn').classList.toggle('notimer', !tEnd || S.ph !== 'play');
    root.querySelector('.deckbtn').disabled = !myDraw();
    root.querySelector('.deck').hidden = !myDraw();
    const eat = root.querySelector('.eat');
    eat.hidden = !(myDisc() && canWin(S.hand));
    // my discard pile
    const me = S.me >= 0 ? S.seats[S.me] : null;
    $('hp-mine').innerHTML = me ? `<span>Your discard</span>${me.top >= 0 ? cardHtml(me.top) : '<span class="slot">empty</span>'}` : '';
    renderHand();
    placeBadges();
  }

  function renderHand() {
    const h = S.hand || [];
    const rects = {};
    hand.querySelectorAll('.card').forEach(el => { rects[el.dataset.c] = el.getBoundingClientRect(); });
    const b = bestSets(h), inSet = new Set(b.sets.flat());
    const rest = h.filter(c => !inSet.has(c)).sort((x, y) => kindOf(x) - kindOf(y) || x - y);
    const groups = [...b.sets.map(t => ({ t, v: setVal(t) })), ...(rest.length ? [{ t: rest, v: 0 }] : [])];
    const clickable = myDisc();
    const added = h.filter(c => !prevHand.includes(c));
    hand.classList.toggle('pick', clickable);
    hand.innerHTML = groups.map(g => `<div class="grp${g.v ? ' set' : ''}${g.v === 30 ? ' gold' : ''}">
      ${g.v ? `<span class="gtag">${g.v === 30 ? 'Same' : 'Colour'} set · ${g.v}</span>` : ''}
      <div class="cards">${g.t.map(c => cardHtml(c, {
        tag: 'button', cls: (added.includes(c) && prevHand.length ? 'new' : '') + (S.ph === 'play' && myDisc() && c === lastDrawn() ? ' drawn' : ''),
        attrs: `data-a="disc" ${clickable ? '' : 'tabindex="-1"'}`,
      })).join('')}</div></div>`).join('');
    // ghost for cards that left my hand
    for (const c of prevHand) if (!h.includes(c) && rects[c]) ghost(c, rects[c]);
    // deal-in stagger
    if (!prevHand.length && h.length) hand.querySelectorAll('.card').forEach((el, i) => { el.classList.add('deal'); el.style.animationDelay = `${i * 60}ms`; });
    if (b.sets.length > prevSets && prevHand.length) {
      sfx.set();
      hand.querySelectorAll('.grp.set').forEach(g => g.classList.add('spark'));
    }
    prevSets = b.sets.length; prevHand = h.slice();
    $('hp-sets').textContent = S.me >= 0 ? `Your sets: ${b.sets.length} · ${b.score} pts` : '';
  }
  const lastDrawn = () => { const e = [...(S.ev || [])].reverse().find(e => e.t === 'draw' && e.s === S.me); return e ? e.c : -1; };

  function ghost(c, rc) {
    const g = document.createElement('div');
    g.innerHTML = cardHtml(c); const el = g.firstElementChild;
    el.classList.add('ghost');
    Object.assign(el.style, { left: rc.left + 'px', top: rc.top + 'px', '--cw': rc.width + 'px' });
    const mine = $('hp-mine').getBoundingClientRect();
    el.style.setProperty('--dx', `${mine.left + mine.width / 2 - rc.left - rc.width / 2}px`);
    el.style.setProperty('--dy', `${mine.top - rc.top}px`);
    root.append(el);
    setTimeout(() => el.remove(), 650);
  }

  function syncScene() {
    if (!scene || !S) return;
    scene.setSeats([0, 1, 2, 3].map(r => { const p = S.seats[abs(r)]; return { color: p.color, av: p.av, n: p.n, me: r === 0 && S.me >= 0 }; }), S.ph === 'play' ? rel(S.turn) : -1);
    scene.setTiles([0, 1, 2, 3].map(r => { const p = S.seats[abs(r)]; return { c: p.top, n: p.dn }; }));
    scene.setInteract({ tiles: new Set([1, 2, 3].filter(r => canTake(abs(r)))), deck: myDraw() });
  }

  // ----- events -> animation & sound -----
  function playEv(e) {
    if (e.t === 'turn') {
      if (e.s === S.me) { sfx.turn(); pulse($('hp-turn')); } else sfx.tick();
      scene?.hop(rel(e.s));
    } else if (e.t === 'draw') {
      sfx.draw();
      scene?.fly(e.src < 0 ? 'deck' : rel(e.src), rel(e.s), e.c, e.src >= 0);
      if (e.src >= 0 && e.s !== S.me) ctx.toast(`${iconSvg(kindOf(e.c))}${nameOf(e.s)} took ${esc(cardName(e.c))}${e.src === S.me ? ' from you' : ''}`);
    } else if (e.t === 'disc') {
      setTimeout(sfx.place, 380);
      scene?.fly(rel(e.s), 'tile' + rel(e.s), e.c, true);
    } else if (e.t === 'timeout') {
      if (e.s === S.me) { sfx.bad(); ctx.toast("Time's up! We played that turn for you.", true); }
      scene?.potMood('bang');
    } else if (e.t === 'shuffle') {
      ctx.toast('Discards stirred back into the pot'); sfx.draw(); scene?.potMood('dizzy');
    } else if (e.t === 'eat') {
      if (e.s === S.me) sfx.win(); else sfx.lose();
      scene?.celebrate(rel(e.s), S.hands?.[e.s] || []);
      confetti();
    } else if (e.t === 'end') {
      if (e.w < 0) { sfx.lose(); ctx.toast('30 rounds done, time to count sets!'); }
      clearTimeout(resultsTimer);
      resultsTimer = setTimeout(showResults, e.w >= 0 ? 2600 : 1200);
    }
  }
  const pulse = el => { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); };

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; prevHand = []; prevSets = 0; hideResults(); clearTimeout(resultsTimer);
      const evs = s.ev || [];
      lastEv = evs.length ? evs[evs.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.round === 1 && lastEv <= 2) { scene?.deal(); sfx.draw(); }
    }
    tEnd = s.tl ? performance.now() + s.tl : 0;
    render();
    syncScene();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end') return;
    const el = root.querySelector('.results');
    const order = S.seats.map((p, i) => ({ p, i, r: S.res[i] })).sort((a, b) => b.r.pts - a.r.pts);
    el.innerHTML = `<div class="sheet">
      <h2>${S.win >= 0 ? (S.win === S.me ? 'You win, chef!' : `${nameOf(S.win)} wins!`) : 'The pot ran dry!'}</h2>
      <p>${S.win >= 0 ? `Three sets and a “Let's Eat!” for +90.` : 'Nobody completed three sets in 30 rounds.'} Everyone scores their sets.</p>
      <ol class="score">${order.map(({ p, i, r }, n) => `<li class="${i === S.win ? 'won' : ''}" style="animation-delay:${n * 120}ms">
        ${avatarHtml(p.color, p.av, 48)}
        <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? ' (you)' : ''}</b>
        <div class="msets">${r.sets.length ? r.sets.map(t => `<span>${t.map(c => cardHtml(c, { w: 34 })).join('')}</span>`).join('') : '<em>no sets</em>'}</div></div>
        <strong>${r.pts}<small>${r.bonus ? ` incl. +${r.bonus}` : ''}</small></strong></li>`).join('')}</ol>
      <div class="againbox">${againHtml(ctx, R, 'Play again')}</div></div>`;
    el.hidden = false; votes = (R?.again || []).length;
  }
  // Votes arrive with room updates: repaint just the buttons so the sheet doesn't replay its entrance.
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    const n = (R?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, R, 'Play again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  // ----- reactions & speech bubbles -----
  const anchorOf = id => {
    const i = S ? S.seats.findIndex(p => p.id === id) : -1, r = i >= 0 ? rel(i) : 0;
    return r === 0 ? root.querySelector('.emotes') : root.querySelector(`.opp[data-r="${r}"]`);
  };
  function react(m) {
    if (!S) return;
    floatAt(anchorOf(m.id), m.k);
    const i = S.seats.findIndex(p => p.id === m.id);
    if (i >= 0) scene?.emote(rel(i), m.k); // the pot and the avatar react too
  }
  function say(m) {
    if (!S || S.seats.findIndex(p => p.id === m.id) < 0) return;
    const rc = anchorOf(m.id).getBoundingClientRect(), b = document.createElement('div');
    b.className = 'saybubble'; b.textContent = m.text.length > 70 ? m.text.slice(0, 68) + '…' : m.text;
    b.style.left = `${Math.max(8, Math.min(innerWidth - 268, rc.left))}px`; b.style.top = `${rc.bottom + 8}px`;
    root.append(b); setTimeout(() => b.remove(), 4200);
  }

  // ----- confetti -----
  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
    const cols = CATS.map(c => c.col).concat(['#fff4e2', '#ffb547']);
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

  // ----- timer loop -----
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!S || !tEnd || S.ph !== 'play') return;
    const left = Math.max(0, tEnd - performance.now()), frac = S.tLim ? left / (S.tLim * 1000) : 0;
    $('hp-ring').style.strokeDashoffset = String(113 * (1 - frac));
    const sec = Math.ceil(left / 1000);
    if (sec !== lastSec) {
      lastSec = sec; $('hp-ringt').textContent = sec;
      const urgent = sec <= 5 && myTurn();
      $('hp-turn').classList.toggle('urgent', urgent);
      if (urgent && sec > 0) sfx.warn();
    }
  };
  loop();

  // ----- input -----
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'disc') {
      if (!myDisc()) { sfx.bad(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
      sfx.pop(); b.classList.add('going'); ctx.act({ t: 'disc', c: +b.dataset.c });
    } else if (a === 'take') { if (canTake(+b.dataset.i)) take(+b.dataset.i); }
    else if (a === 'deck') { if (myDraw()) drawDeck(); }
    else if (a === 'eat') { if (myDisc() && canWin(S.hand)) { sfx.click(); ctx.act({ t: 'eat' }); } }
    else if (a === 'react') { const now = Date.now(); if (now - lastReact > 800) { lastReact = now; ctx.react(+b.dataset.k); } }
    else if (a === 'gfx') {
      gfx = { auto: 'low', low: 'high', high: 'auto' }[gfx]; try { localStorage.setItem('ct_gfx', gfx); } catch {}
      b.textContent = GFX[gfx][0]; scene?.setQuality(gfx); ctx.toast(GFX[gfx][1]);
    }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.hand.pick .card, .card.takeable, .btn, .round, .emotes button');
    if (b && !b.contains(e.relatedTarget)) sfx.hover();
  });
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === ' ' && myDraw()) { e.preventDefault(); drawDeck(); }
    else if (e.key === 'Enter' && myDisc() && canWin(S.hand)) ctx.act({ t: 'eat' });
  };
  addEventListener('keydown', onKey);

  return {
    update,
    room(r) { R = r; if (S) render(); paintAgain(); },
    react, say,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); cancelAnimationFrame(raf); clearTimeout(resultsTimer); removeEventListener('keydown', onKey); removeEventListener('resize', onResize); scene?.dispose(); },
  };
}
