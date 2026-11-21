// Tysiąc game view: HUD over the 3D table. Renders what the server says and sends your bids and cards.
// The only hand this page ever receives is your own.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';
import { cardHtml, suitSvg } from '../poker/cards.js';
import { MELD, SUIT_NAMES, STEP, SAFE_BID, suitOf, canMeld, maxBid, melds } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  barrel: '<svg class="ty-barrel" viewBox="0 0 24 24" width="16" height="16" aria-label="On the barrel" role="img"><path d="M7 3h10c2 3 3 6 3 9s-1 6-3 9H7c-2-3-3-6-3-9s1-6 3-9z" fill="#c98a5a" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M4.6 8.5h14.8M4.6 15.5h14.8" stroke="currentColor" stroke-width="2.2"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const signed = v => (v > 0 ? '+' + v : v < 0 ? '−' + -v : '0');
const suit = (s, size = 18) => `<span class="ty-suit" title="${SUIT_NAMES[s]}">${suitSvg(s, size)}</span>`;

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  for (const href of [new URL('../poker/poker.css', import.meta.url).href, new URL('./tys.css', import.meta.url).href]) { // the playing cards are the poker ones
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
  }
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="ty">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="ty-info"></span></div>
      <div class="tr"><span class="tcode" id="ty-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="ty-banner" aria-live="polite"></div>
      <div class="shout" id="ty-big" aria-live="assertive"></div>
      <aside class="ty-side"><div class="ty-deal" id="ty-deal"></div><ol class="ty-list" id="ty-list" aria-label="Scores"></ol><div class="ty-last" id="ty-last"></div></aside>
      <div class="ty-sum" id="ty-sum" hidden></div>
      <div class="ty-dock" id="ty-dock"><div class="ty-ctl" id="ty-ctl"></div><div class="ty-hand" id="ty-hand"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ty'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0;
  let bidV = 0, bidKey = '', give = [null, null], giveV = 0, giveKey = '', pend = -1;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const myTurn = () => !!(S && S.ph === 'play' && S.turn === S.me && me() && !me().bot);
  const busy = () => Date.now() - sent < 1200;
  const nextSeat = i => S.active[(S.active.indexOf(i) + 1) % S.active.length];

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, innerWidth < 1100 ? 200 : 150).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  // the dock is tallest while you sort out the musik: always leave about that much room, so the camera does not jump around
  function layout() { if (scene) scene.setHud(Math.max($('ty-dock').offsetHeight + 24, innerWidth < 700 ? 250 : 290)); }

  // ----- name tags over the avatars: name, score, and what they last said -----
  function said(i) {
    const p = S.seats[i];
    if (S.ph !== 'play') return '';
    if (p.sit) return '<span>deals, sits out</span>';
    if (S.stage === 'deal') return '';
    if (S.stage === 'bid' || S.stage === 'take') return p.said === 'pass' ? '<span>Pass</span>' : p.said ? `<span class="${S.bid.s === i ? 'top' : ''}">${p.said}</span>` : '';
    const m = p.mel.map(s => suit(s, 14)).join('');
    return `<span class="${i === S.decl ? 'top' : ''}">${i === S.decl ? `${p.pts} / ${S.contract}` : `${p.pts} pts`}${m}</span>`;
  }
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="ty-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${esc(p.name)}</b><span></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn); el.classList.toggle('out', p.sit && S.ph === 'play');
      setHtml(el.querySelector('.plate span'), String(p.score));
      setHtml(el.firstElementChild, said(i));
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = false) {
    const t = live?.tags?.[i]; if (!t) return;
    const f = document.createElement('div');
    f.className = 'ty-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- the scores beside the table -----
  function renderSide() {
    const playing = S.ph === 'play' && S.decl >= 0 && !['deal', 'bid'].includes(S.stage);
    setHtml($('ty-deal'), S.ph !== 'play' ? '' : playing
      ? `<span><small>Contract</small><b>${S.contract}</b></span><span><small>Trumps</small><b>${S.trump >= 0 ? suit(S.trump, 22) : '<i>none yet</i>'}</b></span>`
      : `<span><small>Bid</small><b>${S.bid?.v ?? 100}</b></span><span><small>Musik</small><b>${cardHtml(-1, { cls: 'xs' }).repeat(3)}</b></span>`);
    setHtml($('ty-list'), S.seats.map((p, i) => {
      let sub = '';
      if (S.ph === 'end') sub = `${p.st.made} of ${p.st.played} contracts made`;
      else if (p.sit) sub = 'deals this hand';
      else if (playing) sub = `${i === S.decl ? `<u>plays ${S.contract}</u> · ` : ''}${p.pts} pts${p.mel.map(s => suit(s, 13)).join('')}`;
      else sub = p.said === 'pass' ? 'passed' : p.said ? `bid ${p.said}` : i === S.dealer ? 'dealer' : '';
      return `<li class="${i === S.turn ? 'now' : ''}${i === S.me ? ' ty-me' : ''}${p.sit && S.ph === 'play' ? ' out' : ''}">${avatarHtml(p.color, p.av, 30)}<div><b>${esc(p.name)}${i === S.me ? ' (you)' : ''}</b><span>${sub}</span></div><strong>${p.score >= S.barrel && S.ph === 'play' ? I.barrel : ''}${p.score}</strong></li>`;
    }).join(''));
    const lt = S.lastTrick, show = lt && S.ph === 'play' && S.stage === 'play';
    setHtml($('ty-last'), show ? `<small>Last trick · ${youOr(lt.w)}</small><span>${lt.cards.map(x => cardHtml(x.c, { cls: 'xs' })).join('')}</span>` : '');
  }

  // ----- your cards and the controls -----
  const keepOf = () => (me()?.cards || []).filter(c => !give.includes(c));
  const giveMax = () => Math.max(S.contract, maxBid(keepOf()));
  function renderHand() {
    const p = me(), el = $('ty-hand');
    if (!S || !p || S.ph !== 'play' || p.sit) { setHtml(el, p?.sit && S.ph === 'play' ? '<span class="ty-note">You deal this hand and sit it out. You are back in the next one.</span>' : ''); return; }
    const cards = p.cards || [], turn = myTurn() && !busy(), stage = S.stage;
    const legal = turn && stage === 'play' ? new Set(S.legal || []) : null, giving = turn && stage === 'give';
    const w = innerWidth < 700 ? 56 : 74, avail = Math.min(innerWidth - 24, 820), n = cards.length;
    const gap = n > 1 ? Math.min(6, (avail - w * n) / (n - 1)) : 0;
    el.style.setProperty('--gap', gap.toFixed(1) + 'px');
    const order = S.active.indexOf(S.me) >= 0 ? [nextSeat(S.me), nextSeat(nextSeat(S.me))] : [];
    setHtml(el, cards.map(c => {
      const slot = giving ? give.indexOf(c) : -1, can = giving || (legal ? legal.has(c) : false);
      const cls = `${slot >= 0 || pend === c ? ' sel' : ''}${legal && !legal.has(c) ? ' no' : ''}${S.got?.includes(c) ? ' new' : ''}${legal && legal.has(c) && !S.trick.length && canMeld(cards, c) ? ' kq' : ''}`;
      return `<button type="button" class="ty-c${cls}" data-a="card" data-c="${c}"${can ? '' : ' tabindex="-1" aria-disabled="true"'}>${cardHtml(c, { cls: 'big' })}${slot >= 0 ? `<i${slot ? ' class="b"' : ''}>for ${nameOf(order[slot])}</i>` : ''}</button>`;
    }).join(''));
  }
  function renderCtl() {
    const p = me(), ctl = $('ty-ctl');
    if (!S || S.ph !== 'play' || !p) { setHtml(ctl, ''); return layout(); }
    const turn = myTurn() && !busy(), st = S.stage;
    if (turn && st === 'bid') {
      const key = S.gid + '/' + S.hand + '/' + S.bid.v;
      if (key !== bidKey) { bidKey = key; bidV = S.bid.v + STEP; }
      const lo = S.bid.v + STEP, hi = S.maxBid, can = lo <= hi;
      bidV = Math.max(lo, Math.min(hi, bidV));
      const mm = melds(p.cards || []);
      setHtml(ctl, `<div class="ty-row">
          <div class="ty-qty" role="group" aria-label="Your bid"><button type="button" class="round" data-a="v-" aria-label="Ten less"${!can || bidV <= lo ? ' disabled' : ''}>−</button><b>${can ? bidV : '–'}</b><button type="button" class="round" data-a="v+" aria-label="Ten more"${!can || bidV >= hi ? ' disabled' : ''}>+</button></div>
          <button type="button" class="btn big" data-a="bid"${can ? '' : ' disabled'}>Bid ${can ? bidV : ''}</button>
          <button type="button" class="btn big w" data-a="pass">Pass</button>
        </div>
        <p class="ty-hint">${youOr(S.bid.s)} ${S.bid.s === S.me ? 'hold' : 'holds'} the bid at <b>${S.bid.v}</b>. ${mm.length ? `With your ${mm.map(s => suit(s, 14)).join(' ')} marriage${mm.length > 1 ? 's' : ''} you may go up to <b>${hi}</b>.` : `Without a king and queen of one suit you cannot go over <b>${SAFE_BID}</b>.`}</p>`);
    } else if (turn && st === 'give') {
      const key = S.gid + '/' + S.hand;
      if (key !== giveKey) { giveKey = key; give = [null, null]; giveV = S.contract; }
      const a = nextSeat(S.me), b = nextSeat(a), ready = give[0] !== null && give[1] !== null, hi = giveMax();
      giveV = Math.max(S.contract, Math.min(hi, giveV));
      setHtml(ctl, `<p class="ty-hint big">${ready ? 'Raise your contract if you dare, then start.' : `Tap a card to give to <b>${nameOf(give[0] === null ? a : b)}</b>. Each opponent gets one.`}</p>
        <div class="ty-row">
          <div class="ty-qty" role="group" aria-label="Your contract"><small>Contract</small><button type="button" class="round" data-a="g-" aria-label="Ten less"${giveV <= S.contract ? ' disabled' : ''}>−</button><b>${giveV}</b><button type="button" class="round" data-a="g+" aria-label="Ten more"${giveV >= hi ? ' disabled' : ''}>+</button></div>
          <button type="button" class="btn big" data-a="give"${ready ? '' : ' disabled'}>Play for ${giveV}</button>
        </div>`);
    } else if (turn && st === 'play' && pend >= 0) {
      const s = suitOf(pend);
      setHtml(ctl, `<div class="ty-row">
          <button type="button" class="btn big" data-a="meld">Announce ${suit(s, 20)} +${MELD[s]}</button>
          <button type="button" class="btn big w" data-a="quiet">Just play it</button>
        </div>
        <p class="ty-hint">You hold the king and queen of ${SUIT_NAMES[s]}. Announcing scores <b>${MELD[s]}</b> and makes ${SUIT_NAMES[s]} trumps.</p>`);
    } else if (turn && st === 'play') {
      setHtml(ctl, `<span class="ty-wait hot">${S.trick.length ? 'Your turn: tap a card' : 'You lead: tap a card'}</span>`);
    } else if (S.turn >= 0 && !p.sit) {
      const t = S.seats[S.turn], what = st === 'bid' ? 'is bidding' : st === 'give' ? 'is sorting the musik' : 'is thinking';
      setHtml(ctl, `<span class="ty-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p.bot ? 'A bot is playing for you' : 'Sent…') : `${nameOf(S.turn)} ${what}…`}</span></span>`);
    } else setHtml(ctl, '');
    layout();
  }

  function renderBanner() {
    const el = $('ty-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 && myTurn() ? ` · ${secs}s` : '';
    const st = S.stage, d = S.decl;
    if (S.ph === 'end') msg = S.win >= 0 ? `${S.win === S.me ? 'You win' : nameOf(S.win) + ' wins'}!` : '';
    else if (st === 'deal') msg = `Hand ${S.hand} · ${youOr(S.dealer)} ${S.dealer === S.me ? 'deal' : 'deals'}`;
    else if (st === 'bid') msg = myTurn() ? `Your turn · bid or pass${t}` : `${nameOf(S.turn)} is bidding`;
    else if (st === 'take') msg = `${youOr(d)} ${d === S.me ? 'take' : 'takes'} the musik for ${S.contract}`;
    else if (st === 'give') msg = myTurn() ? `Give one card to each opponent${t}` : `${nameOf(d)} is sorting the musik`;
    else if (st === 'trick') msg = S.lastTrick ? `${youOr(S.lastTrick.w)} ${S.lastTrick.w === S.me ? 'take' : 'takes'} the trick · +${S.lastTrick.pts}` : '';
    else if (st === 'score') msg = S.sum ? (S.sum.made ? `${youOr(d)} made ${S.sum.contract}!` : `${youOr(d)} fell short of ${S.sum.contract}`) : '';
    else if (myTurn()) msg = (S.trick.length ? 'Your turn' : 'Your lead') + t;
    else if (S.turn >= 0) msg = `${nameOf(S.turn)} ${S.trick.length ? 'to play' : 'leads'}`;
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  // ----- the hand's scores, shown between hands -----
  function renderSum() {
    const el = $('ty-sum'), m = S.stage === 'score' ? S.sum : null;
    el.hidden = !m; if (!m) { el._h = ''; return; }
    const short = m.contract - m.pts[m.decl];
    setHtml(el, `<h3>${m.made ? `${youOr(m.decl)} made ${m.contract}!` : `${youOr(m.decl)} fell ${short} short of ${m.contract}`}</h3>
      <ol>${m.active.map(i => {
        const p = S.seats[i], dl = m.delta[i], barrel = i !== m.decl && !dl && m.score[i] >= S.barrel;
        return `<li class="${i === m.decl ? 'decl' : ''}">${avatarHtml(p.color, p.av, 30)}<div><b>${esc(p.name)}</b><span>took ${m.pts[i]}${i === m.decl ? ` of ${m.contract}` : barrel ? ' · on the barrel' : ''}</span></div><em class="${dl > 0 ? 'up' : dl < 0 ? 'down' : ''}">${signed(dl)}</em><strong>${m.score[i]}</strong></li>`;
      }).join('')}</ol>`);
  }

  function render() {
    if (!S) return;
    $('ty-info').textContent = S.ph === 'end' ? `${S.res?.hands || S.hand} hands played` : `Hand ${S.hand} · ${innerWidth < 700 ? '' : 'first '}to ${S.target}`;
    $('ty-code').textContent = Rm?.code || '';
    root.classList.toggle('summing', S.stage === 'score');
    if (!(myTurn() && S.stage === 'play') || !(S.legal || []).includes(pend)) pend = -1;
    buildTags(); renderSide(); renderHand(); renderCtl(); renderBanner(); renderSum();
  }

  function big(text, sub = '', ms = 1700) {
    const el = $('ty-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? 'You took over a bot. Good luck!' : `${nameOf(e.s)} took over a bot`); }
    else if (e.t === 'deal') { sfx.draw(); setTimeout(() => !destroyed && sfx.draw(), 380); setTimeout(() => !destroyed && sfx.draw(), 760); }
    else if (e.t === 'bid') { e.s === S.me ? sfx.place() : sfx.pop(); }
    else if (e.t === 'pass') sfx.plop();
    else if (e.t === 'won') { sfx.set(); big(String(e.v), `${youOr(e.s)} ${e.s === S.me ? 'play' : 'plays'} this hand`, 1900); }
    else if (e.t === 'give') { sfx.draw(); if (S.bid && e.v > S.bid.v) ctx.toast(`${youOr(e.s)} raised the contract to ${e.v}`); }
    else if (e.t === 'meld') { sfx.set(); scene?.meld(e.s, e.su); big(`Marriage! +${e.v}`, `${youOr(e.s)}: king and queen of ${SUIT_NAMES[e.su]} ${suit(e.su, 20)} are trumps now`, 2400); }
    else if (e.t === 'play') { e.s === S.me ? 0 : sfx.place(); }
    else if (e.t === 'trick') { if (e.pts) floatAt(e.w, '+' + e.pts); e.w === S.me ? sfx.pop() : sfx.plop(); }
    else if (e.t === 'score') {
      scene?.cheer(e.s, e.made);
      if (e.s === S.me) { if (e.made) { sfx.win(); confetti(); } else sfx.lose(); } else e.made ? sfx.set() : sfx.pop();
    }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.hand + '/' + S.trick.length + '/' + S.bid?.v : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; bidKey = ''; giveKey = ''; pend = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    const is = s.turn + '/' + s.stage + '/' + s.hand + '/' + s.trick.length + '/' + s.bid?.v;
    if (was !== is) { sent = 0; lastTick = -1; if (!fresh && myTurn()) sfx.turn(); }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? 'You win!' : `${nameOf(w)} wins!`}</h2>
      <p>${myPlace > 1 ? `You came ${ORD(myPlace)}. ` : myPlace === 1 && S.seats[w].score >= S.target ? `First to ${S.target}. ` : ''}It took ${S.res.hands} hand${S.res.hands === 1 ? '' : 's'}.</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${esc(p.name)}${i === S.me ? ' (you)' : ''}</b><span>${st.made} of ${st.played} contract${st.played === 1 ? '' : 's'} made · ${st.melds} marriage${st.melds === 1 ? '' : 's'}</span></div>
          <strong><span>${p.score}</span><small>points</small></strong></li>`;
      }).join('')}</ol>
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

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
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
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    step();
  }

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderHand(); renderCtl(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go(a) {
    if (!myTurn() || busy()) return;
    sent = Date.now(); pend = -1; ctx.act(a); renderHand(); renderCtl();
  }
  function tapCard(c) {
    if (!myTurn() || busy()) return;
    if (S.stage === 'give') {
      const k = give.indexOf(c);
      if (k >= 0) give[k] = null; else { const free = give.indexOf(null); if (free < 0) give[1] = c; else give[free] = c; }
      sfx.click(); renderHand(); renderCtl();
    } else if (S.stage === 'play') {
      if (!(S.legal || []).includes(c)) { sfx.bad(); return; }
      if (!S.trick.length && canMeld(me().cards, c) && pend !== c) { pend = c; sfx.click(); renderHand(); renderCtl(); return; }
      sfx.place(); go({ t: 'play', c, meld: false });
    }
  }
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (S.stage === 'bid') {
      if (k === 'arrowup' || k === 'arrowright') { bidV += STEP; sfx.click(); renderCtl(); }
      else if (k === 'arrowdown' || k === 'arrowleft') { bidV -= STEP; sfx.click(); renderCtl(); }
      else if (k === 'enter' && !e.target.closest?.('button')) { if (S.bid.v + STEP <= S.maxBid) go({ t: 'bid', v: bidV }); }
      else if (k === 'p') go({ t: 'pass' });
      else return;
      e.preventDefault();
    }
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderHand(); layout(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'card') tapCard(+b.dataset.c);
    else if (a === 'v+' || a === 'v-') { bidV += a === 'v+' ? STEP : -STEP; sfx.click(); renderCtl(); }
    else if (a === 'g+' || a === 'g-') { giveV += a === 'g+' ? STEP : -STEP; sfx.click(); renderCtl(); }
    else if (a === 'bid') { sfx.click(); go({ t: 'bid', v: bidV }); }
    else if (a === 'pass') { sfx.click(); go({ t: 'pass' }); }
    else if (a === 'give') { if (give[0] !== null && give[1] !== null) { sfx.click(); go({ t: 'give', c: [...give], v: giveV }); } }
    else if (a === 'meld' || a === 'quiet') { if (pend >= 0) { sfx.place(); go({ t: 'play', c: pend, meld: a === 'meld' }); } }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .ty-c:not([aria-disabled])');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
