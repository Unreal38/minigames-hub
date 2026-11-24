// Blackjack game view: HUD over the 3D table. Renders what the server says and sends your bets and moves.
// The table look (tags, dock, results) is shared with the poker table, so the root carries both classes.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { cardHtml } from '../poker/cards.js';
import { nameHtml, frameCls } from '../../cosmetics.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  chip: '<svg class="chipi" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#7ed3b2" stroke="#3b2219" stroke-width="2.4"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff4e2" stroke-width="2.2" stroke-dasharray="3 2.4"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const BUST = L('Bust', 'Fura'), PUSH = L('Push', 'Remis'), DEALER = L('Dealer', 'Krupier');
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
// "17", or "7 / 17" while an ace can still be either
const tot = h => (h.soft && h.v < 21 && !h.done ? `${h.v - 10} / ${h.v}` : String(h.v));

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  for (const f of ['../poker/poker.css', './bj.css']) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL(f, import.meta.url).href; document.head.append(l); }
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pk bj">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags"></div>
    <div class="tag dtag" id="bj-dealer" hidden><div class="plate"><div class="tx"><b>${DEALER}</b></div></div></div>
    <div class="potlbl dlbl" id="bj-dtot" hidden></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bj-round"></span><span class="chip lim" id="bj-lim"></span></div>
      <div class="tr"><span class="tcode" id="bj-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="bj-banner" aria-live="polite"></div>
      <div class="shout" id="bj-big" aria-live="assertive"></div>
      <div class="dock" id="bj-dock">
        <div class="mine" id="bj-mine"></div>
        <div class="acts" id="bj-acts"></div>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bj'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let tagEls = [], tagKey = '', layout = null, betAmt = 0, betKey = '', endsAt = 0, lastTick = -1, turnKey = '';
  let resultsTimer = 0, bigTimer = 0, flat = false;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.sync(S); dockSize(); }
  }).catch(err => {
    console.warn('3D unavailable', err);
    flat = true; root.classList.add('flat'); if (S) render();
  });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));

  // ----- name tags follow the avatars -----
  const at = (el, p, how) => { el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) ${how}`; };
  function onFrame(info) {
    layout = info;
    if (!S) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w ||= el.offsetWidth || 120) / 2; // keep tags on screen
      at(el, { x: Math.max(half + 4, Math.min(innerWidth - half - 4, t.x)), y: t.y }, 'translate(-50%, -100%)');
    }
    if (info.dealer) at($('bj-dealer'), info.dealer, 'translate(-50%, -100%)');
    if (info.dcards) at($('bj-dtot'), info.dcards, 'translate(-50%, -100%)');
  }
  function flatLayout() { // no 3D: put everyone round an ellipse on screen, the dealer at the top
    const n = S.seats.length, N = n + 1, kd = Math.ceil(N / 2), w = innerWidth, h = innerHeight - 250;
    const spot = k => { const a = Math.PI / 2 + k * Math.PI * 2 / N; return { x: w / 2 + Math.cos(a) * w * .36, y: 110 + h / 2 + Math.sin(a) * h * .36 }; };
    return { tags: S.seats.map((_, i) => { const r = S.me >= 0 ? (i - S.me + n) % n : i; return { ...spot(r < kd ? r : r + 1), mine: S.me >= 0 && r === 0 }; }), dealer: spot(kd), dcards: { x: w / 2, y: 130 + h / 2 } };
  }

  function buildTags() {
    const key = S.seats.map(p => p.name + p.color + p.av.join('')).join('|') + S.me;
    if (key === tagKey) return; tagKey = key;
    tagsEl.innerHTML = S.seats.map((p, i) => `<div class="tag${i === S.me ? ' mine' : ''}" data-i="${i}"><div class="bub"></div><div class="plate"><span class="tav">${avatarHtml(p.color, p.av, 30)}</span><div class="tx"><b></b><span class="stk"></span></div></div><div class="shown"></div></div>`).join('');
    tagEls = [...tagsEl.children];
  }
  // What a seat's speech bubble says: its bet, its totals, then what the round paid.
  function bubble(p, i) {
    if (p.out) return ['', ''];
    if (S.stage === 'bet') return p.bet ? [`✓ ${L('Bet placed', 'Zakład postawiony')}`, ''] : [L('Betting…', 'Stawia…'), 'meh'];
    if (!p.hands.length) return ['', ''];
    if (S.stage === 'pay' || S.ph === 'end') return [p.hands.map(h => (h.res === 'bj' ? 'Blackjack! ' : h.bust ? `${BUST} ` : `${h.v} · `) + (h.pay ? signed(h.pay) : PUSH)).join('  |  '), p.net > 0 ? 'hot' : p.net < 0 ? 'meh' : ''];
    const txt = p.hands.map(h => (h.bj ? 'Blackjack!' : h.bust ? `${BUST}! ${h.v}` : tot(h) + (h.dbl ? ' ×2' : ''))).join('  |  ');
    return [txt, p.hands.some(h => h.bj) ? 'hot' : p.hands.every(h => h.bust) ? 'meh' : ''];
  }
  function paintTags() {
    for (const el of tagEls) el._w = 0;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('active', S.turn === i && S.ph === 'play');
      el.classList.toggle('out', !!p.out);
      el.classList.toggle('won', S.stage === 'pay' && p.net > 0);
      el.classList.toggle('hide', i === S.me);
      setHtml(el.querySelector('.tx b'), `${nameHtml(p.name, p.fl)}${p.bot && p.human ? ' <small>' + L('(away)', '(poza grą)') + '</small>' : ''}`);
      setHtml(el.querySelector('.stk'), p.out ? L('Out', 'Odpada') : `${I.chip}${p.stack}`);
      const bub = el.querySelector('.bub'), [say, cls] = bubble(p, i);
      setHtml(bub, esc(say)); bub.className = 'bub' + (say ? ' on' : '') + (cls ? ' ' + cls : '');
      setHtml(el.querySelector('.shown'), flat && i !== S.me ? p.hands.map(h => `<div class="mini">${h.cards.map(c => cardHtml(c, { cls: 'sm' })).join('')}</div>`).join('') : '');
    });
    // the dealer: a name plate over the avatar and the total next to the cards
    const d = S.dealer, dt = $('bj-dtot'), dg = $('bj-dealer'), bust = d.v > 21;
    dg.hidden = false; dg.classList.toggle('active', S.stage === 'dealer');
    dt.hidden = !d.cards.length;
    const dsay = d.bj ? 'Blackjack!' : bust ? `${BUST}! ${d.v}` : d.shown ? String(d.v) : `${d.v} + ?`;
    setHtml(dt, `${flat ? `<span class="mini">${d.cards.map(c => cardHtml(c, { cls: 'sm' })).join('')}</span>` : ''}${DEALER}: <b>${dsay}</b>`);
    dt.classList.toggle('hot', !!d.bj); dt.classList.toggle('meh', bust);
  }

  // ----- the dock: your cards and buttons -----
  function renderMine() {
    const my = me(), el = $('bj-mine');
    if (!my) { setHtml(el, ''); return; } // watchers get the hub's "take a seat" bar instead
    const paid = S.stage === 'pay' || S.ph === 'end';
    const hands = my.hands.map((h, k) => {
      const live = S.turn === S.me && S.hi === k && S.ph === 'play';
      const label = h.bj ? 'Blackjack!' : h.bust ? `${BUST}! ${h.v}` : tot(h);
      const res = !paid || !h.res ? '' : `<i class="res ${h.pay > 0 ? 'up' : h.pay < 0 ? 'down' : ''}">${h.pay ? signed(h.pay) : PUSH}</i>`;
      return `<div class="hand${live ? ' live' : ''}${h.bust || h.res === 'lose' ? ' lost' : ''}${h.cards.length > 4 ? ' many' : ''}">
        <div class="hole">${h.cards.map((c, j) => cardHtml(c, { cls: 'big', k: j })).join('')}</div>
        <div class="hinfo"><span class="hn${h.bj ? ' gold' : ''}">${label}</span><span class="hbet">${I.chip}${h.bet}${h.dbl ? ' ×2' : ''}</span>${res}</div></div>`;
    }).join('');
    setHtml(el, `${hands ? `<div class="hands${my.hands.length > 1 ? ' two' : ''}">${hands}</div>` : ''}
      <div class="meinfo"><span class="stack">${I.chip}<b>${my.stack}</b></span>${my.out ? `<span class="hn">${L('You\'re out of chips. Watch the rest!', 'Nie masz już żetonów. Obejrzyj resztę!')}</span>` : ''}</div>`);
  }

  const fitBet = (v, o) => { v = Math.round(v / o.step) * o.step; return Math.max(o.min, Math.min(o.max, v)) || o.max; };
  function renderActs() {
    const el = $('bj-acts'), my = me(), o = S.opt, b = S.betOpt;
    if (!my || S.ph !== 'play') { setHtml(el, ''); return; }
    if (b) { // pick a bet
      const key = S.gid + ':' + S.round;
      if (key !== betKey) { betKey = key; betAmt = b.last >= b.min && b.last <= b.max ? b.last : fitBet(50, b); }
      betAmt = Math.max(b.min, Math.min(b.max, betAmt));
      const presets = [...new Set([b.min, 50, 100, 250, b.max].filter(v => v >= b.min && v <= b.max))];
      setHtml(el, `<div class="row2"><div class="pills">${presets.map(v => `<button type="button" data-a="preset" data-v="${v}" aria-pressed="${betAmt === v}">${v === b.max && v !== 500 ? L('All in', 'Wszystko') + ' ' + v : v}</button>`).join('')}</div>
        <div class="slide"><button type="button" class="round sm" data-a="less" aria-label="${L(`Less`, `Mniej`)}">−</button>
        <input type="range" min="${b.min}" max="${b.max}" step="${b.step}" value="${betAmt}" aria-label="${L(`Your bet`, `Twój zakład`)}" data-a="slider">
        <button type="button" class="round sm" data-a="more" aria-label="${L(`More`, `Więcej`)}">+</button></div></div>
        <div class="row1"><button type="button" class="btn big" data-a="bet">${L('Bet', 'Postaw')} <span id="bj-betn">${betAmt}</span></button></div>`);
      const sl = el.querySelector('input[type=range]'); if (sl && +sl.value !== betAmt) sl.value = betAmt;
      return;
    }
    if (o) { // your turn
      setHtml(el, `<div class="row1">
        <button type="button" class="btn big m" data-a="hit">${L('Hit', 'Dobierz')}</button>
        <button type="button" class="btn big w" data-a="stand">${L('Stand', 'Stój')}</button>
        ${o.dbl ? `<button type="button" class="btn big" data-a="dbl">${L('Double', 'Podwój')}</button>` : ''}
        ${o.split ? `<button type="button" class="btn big p" data-a="split">${L('Split', 'Rozdziel')}</button>` : ''}</div>`);
      return;
    }
    let msg = '';
    if (my.out) msg = '';
    else if (S.stage === 'bet') msg = L(`Your bet is in: ${my.bet}. Waiting for the others…`, `Twój zakład: ${my.bet}. Czekamy na pozostałych…`);
    else if (S.stage === 'play' && S.turn >= 0) msg = L(`Waiting for ${nameOf(S.turn)}…`, `Czekamy na ruch: ${nameOf(S.turn)}…`);
    else if (S.stage === 'dealer') msg = L('The dealer plays…', 'Gra krupier…');
    setHtml(el, msg ? `<p class="wait">${msg}</p>` : '');
  }

  function dockSize() {
    const d = $('bj-dock'); if (!d || !scene) return;
    const sizer = d.querySelector('.row2'); // the bet slider shouldn't make the table jump
    scene.setHud(Math.max(150, Math.min(innerHeight * .46, d.offsetHeight - (sizer ? sizer.offsetHeight + 10 : 0) + 24)));
  }

  function renderTop() {
    const r = Math.max(1, S.round);
    $('bj-round').textContent = r >= S.rounds ? L('Last round', 'Ostatnia runda') : L(`Round ${r} of ${S.rounds}`, `Runda ${r} z ${S.rounds}`);
    $('bj-lim').textContent = L(`Bets ${S.min} to ${S.max}`, `Zakłady od ${S.min} do ${S.max}`);
    $('bj-code').textContent = Rm?.code || '';
  }

  function renderBanner() {
    const el = $('bj-banner'), my = me(); let msg = '', hot = false;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), clock = S.left ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${youOr(S.win)} win${S.win === S.me ? '' : 's'} the game!`, S.win === S.me ? 'Wygrywasz grę!' : `Grę wygrywa ${nameOf(S.win)}!`) : L('Game over', 'Koniec gry');
    else if (S.stage === 'wait') msg = S.round ? L('Next round…', 'Następna runda…') : L('Shuffling the cards…', 'Tasowanie kart…');
    else if (S.stage === 'bet') { hot = !!S.betOpt; msg = (hot ? L('Place your bet', 'Postaw zakład') : L('Bets are going in', 'Trwa obstawianie')) + clock; }
    else if (S.stage === 'deal') msg = L('Dealing…', 'Rozdawanie…');
    else if (S.stage === 'play' && S.turn >= 0) {
      hot = S.turn === S.me;
      const two = S.seats[S.turn].hands.length > 1 ? L(` · hand ${S.hi + 1} of 2`, ` · ręka ${S.hi + 1} z 2`) : '';
      msg = (hot ? L('Your turn', 'Twoja kolej') : L(`${nameOf(S.turn)} is playing`, `Gra: ${nameOf(S.turn)}`)) + two + clock;
    } else if (S.stage === 'dealer') msg = L('The dealer plays', 'Gra krupier');
    else if (S.stage === 'pay') {
      const d = S.dealer, dl = d.bj ? L('Dealer has a blackjack', 'Krupier ma blackjacka') : d.v > 21 ? L(`Dealer busts with ${d.v}`, `Krupier ma furę: ${d.v}`) : L(`Dealer has ${d.v}`, `Krupier ma ${d.v}`);
      const mine = !my || !my.hands.length ? '' : my.net > 0 ? L(`You win ${my.net}`, `Wygrywasz ${my.net}`) : my.net < 0 ? L(`You lose ${-my.net}`, `Tracisz ${-my.net}`) : L('Push: your bet comes back', 'Remis: zakład wraca do ciebie');
      msg = dl + (mine ? ` · ${mine}` : '');
    }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', hot && S.ph === 'play');
    // the active tag's timer ring
    const t = tagEls[S.turn];
    if (t && S.left && S.timer) t.style.setProperty('--p', Math.max(0, Math.min(1, (endsAt - performance.now()) / (S.timer * 1000))).toFixed(3));
    else if (t) t.style.setProperty('--p', 1);
  }

  function render() {
    if (!S) return;
    buildTags(); renderTop(); paintTags(); renderMine(); renderActs(); renderBanner();
    if (flat) onFrame(flatLayout());
    requestAnimationFrame(dockSize);
  }

  function big(text, sub = '', ms = 1600) {
    const el = $('bj-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ----- events -> sound & effects -----
  function playEv(e) {
    if (e.t === 'round') { sfx.turn(); hideResults(); if (e.r === S.rounds && S.rounds > 1) big(L('Last round!', 'Ostatnia runda!'), L('Most chips after this one wins', 'Wygrywa ten, kto po niej ma najwięcej żetonów'), 1900); }
    else if (e.t === 'shuffle') ctx.toast(L('The dealer shuffles a fresh shoe of cards.', 'Krupier tasuje nowe talie.'));
    else if (e.t === 'bet') { sfx.place(); scene?.nod(e.s); }
    else if (e.t === 'deal') { sfx.draw(); setTimeout(() => sfx.draw(), 300); setTimeout(() => sfx.place(), 620); }
    else if (e.t === 'bj') { sfx.set(); scene?.hop(e.s); if (e.s === S.me) { big('Blackjack!', L('Pays 3 to 2', 'Płaci 3 do 2'), 1700); confetti(); } }
    else if (e.t === 'act') {
      if (e.a === 'stand') sfx.tick();
      else if (e.a === 'dbl') { sfx.place(); sfx.draw(); scene?.nod(e.s); if (e.s !== S.me) ctx.toast(L(`${nameOf(e.s)} doubles the bet`, `${nameOf(e.s)} podwaja zakład`)); }
      else if (e.a === 'split') { sfx.place(); sfx.draw(); scene?.nod(e.s); }
      else sfx.draw();
    } else if (e.t === 'bust') { sfx.lose(); if (e.s === S.me) big(`${BUST}!`, L('Over 21', 'Ponad 21'), 1300); }
    else if (e.t === 'dealer') sfx.set();
    else if (e.t === 'dcard') sfx.draw();
    else if (e.t === 'dbj') { sfx.lose(); big(L('Dealer blackjack!', 'Blackjack krupiera!'), L('Only another blackjack saves a bet', 'Zakład ratuje tylko drugi blackjack'), 1900); }
    else if (e.t === 'pay') {
      const net = S.me >= 0 ? e.net[S.me] : 0, played = S.me >= 0 && S.seats[S.me].hands.length;
      setTimeout(() => {
        if (e.dbust) big(L('Dealer busts!', 'Krupier ma furę!'), L('Every hand still in wins', 'Wygrywa każda ręka w grze'), 1700);
        if (!played) { sfx.set(); return; }
        if (net > 0) { sfx.win(); if (net >= 100) confetti(); } else if (net < 0) sfx.lose(); else sfx.set();
      }, e.dbj ? 0 : 350);
    } else if (e.t === 'out') { sfx.lose(); big(L(`${youOr(e.s)} ${e.s === S.me ? 'are' : 'is'} out!`, e.s === S.me ? 'Odpadasz!' : `${nameOf(e.s)} odpada!`), L(`${ORD(S.seats.filter(p => !p.out).length + 1)} place`, `${S.seats.filter(p => !p.out).length + 1}. miejsce`), 2000); }
    else if (e.t === 'sit') { sfx.join(); ctx.toast(L(`${nameOf(e.s)} took a seat`, `${nameOf(e.s)} siada do stołu`)); scene?.hop(e.s); }
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); } else sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1800);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    endsAt = performance.now() + (s.left || 0);
    // a nudge when it becomes your turn to bet or to play
    const tk = s.betOpt ? `b${s.round}` : s.opt ? `p${s.round}:${s.hi}` : '';
    if (tk && tk !== turnKey) { sfx.turn(); if (document.hidden === false && navigator.vibrate) try { navigator.vibrate(30); } catch {} }
    turnKey = tk;
    render(); scene?.sync(S);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win, start = S.res.start;
    const mine = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${w === S.me ? L('You win the table!', 'Wygrywasz stół!') : L(`${nameOf(w)} wins the table!`, `Stół wygrywa ${nameOf(w)}!`)}</h2>
      <p>${mine ? L(`You finished ${ORD(mine)} of ${S.seats.length} after ${S.res.rounds} rounds.`, `Twoje miejsce: ${mine} z ${S.seats.length}. Rozegrane rundy: ${S.res.rounds}.`) : L(`${S.res.rounds} rounds played.`, `Rozegrane rundy: ${S.res.rounds}.`)} ${L('Chips are pretend and reset every game.', 'Żetony są na niby i w każdej grze zaczynasz od nowa.')}</p>
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = S.res.stacks[i], net = st - start;
        return `<li class="${k === 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${p.out ? L('out of chips', 'bez żetonów') : cnt(st, 'chip', 'chips', 'żeton', 'żetony', 'żetonów')}</span></div>
          <strong class="${net > 0 ? 'up' : net < 0 ? 'down' : ''}">${signed(net)}</strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
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

  // ----- reactions float up from the sender's name tag -----
  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = layout?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? (t.mine ? innerHeight - 260 : t.y - 60) : innerHeight * .6;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 40}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
    if (i >= 0) scene?.hop(i);
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
      for (const p of ps) { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else cv.width = cv.height = 0;
    };
    step();
  }

  // ----- countdown -----
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if ((S.opt || S.betOpt) && S.left) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.warn(); }
    }
  }, 200);

  // ----- input -----
  const paintBet = () => {
    const n = $('bj-betn'); if (n) n.textContent = betAmt;
    root.querySelectorAll('[data-a=preset]').forEach(p => p.setAttribute('aria-pressed', +p.dataset.v === betAmt));
    const sl = root.querySelector('[data-a=slider]'); if (sl && +sl.value !== betAmt) sl.value = betAmt;
    const el = $('bj-acts'); el._h = el.innerHTML;
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, o = S?.betOpt;
    if (a === 'bet') { if (o) { sfx.click(); ctx.act({ t: 'bet', amt: betAmt }); } }
    else if (['hit', 'stand', 'dbl', 'split'].includes(a)) { if (S?.opt) { sfx.click(); ctx.act({ t: a }); } }
    else if (a === 'preset' && o) { sfx.pop(); betAmt = +b.dataset.v; paintBet(); }
    else if ((a === 'less' || a === 'more') && o) { sfx.pop(); betAmt = betAmt % o.step ? (a === 'less' ? o.min : o.max) : Math.max(o.min, Math.min(o.max, betAmt + (a === 'less' ? -o.step : o.step))); paintBet(); }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('input', e => {
    if (e.target.dataset.a !== 'slider' || !S?.betOpt) return;
    const o = S.betOpt, v = +e.target.value;
    betAmt = v >= o.max ? o.max : fitBet(v, o); paintBet();
  });
  const onKey = e => {
    if (!S || e.target.closest?.('input:not([type=range]), textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (S.betOpt && k === 'enter') root.querySelector('[data-a=bet]')?.click();
    if (!S.opt) return;
    const a = { h: 'hit', s: 'stand', d: 'dbl', p: 'split' }[k];
    if (a) root.querySelector(`[data-a=${a}]`)?.click();
  };
  addEventListener('keydown', onKey);
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pills button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });
  const onResize = () => { for (const el of tagEls) el._w = 0; if (flat && S) onFrame(flatLayout()); dockSize(); };
  addEventListener('resize', onResize);

  return {
    update,
    room(r) { Rm = r; if (S) { renderTop(); renderMine(); } paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); removeEventListener('keydown', onKey); removeEventListener('resize', onResize); scene?.dispose(); },
  };
}
