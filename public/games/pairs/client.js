// Pet Pairs game view: HUD over the 3D table. Renders what the server says and sends the cards you flip.
// A face-down pet is never on this page, except the one card you peek at with the Spyglass.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { petImg, petPics } from '../../petpic.js';
import { twIcon, petName, warmAll } from './cards.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  pair: '<svg class="pr-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="10" height="14" rx="2.5" transform="rotate(-10 8 12)"/><rect x="11" y="5" width="10" height="14" rx="2.5" transform="rotate(10 16 12)"/></svg>',
};
const BOARD_NAME = { small: () => L('Small 4×5', 'Mała 4×5'), mid: () => L('Medium 6×6', 'Średnia 6×6'), big: () => L('Big 6×8', 'Duża 6×8') };
const pts = n => L(`${n} pt${n === 1 ? '' : 's'}`, `${n} pkt`);
const pairsWord = n => L(`${n} pair${n === 1 ? '' : 's'}`, `${n} ${n === 1 ? 'para' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'pary' : 'par'}`);

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./pairs.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pr">
    <canvas class="g3d" aria-label="${L('The table of cards', 'Stół z kartami')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pr-info"></span></div>
      <div class="tr"><span class="tcode" id="pr-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pr-banner" aria-live="polite"></div>
      <div class="shout" id="pr-big" aria-live="assertive"></div>
      <div class="pr-dock" id="pr-dock"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pr'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, hoverI = -1;
  const bubbles = new Map(); // seat -> { html, until }

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); scene.setBack(me()?.fl?.cb); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });
  warmAll(() => !destroyed);

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && (S.stage === 'pick' || S.stage === 'spy') && S.turn === S.me && me() && !me().bot);
  const busy = () => Date.now() - sent < 900;
  const canPick = i => myTurn() && !busy() && i >= 0 && S.got[i] < 0 && !S.up.includes(i);

  // Portrait phones: the other players sit in one strip under the banner instead of tags floating over the cards.
  const compact = () => innerWidth < 700 && innerHeight > innerWidth;
  function onFrame(info) {
    live = info;
    if (tagsEl.classList.contains('strip')) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150 * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() {
    const strip = compact();
    if (tagsEl.classList.contains('strip') !== strip) { tagsEl.classList.toggle('strip', strip); for (const el of tagEls) { el.style.transform = ''; el._w = el.offsetWidth; } }
    if (S) tagsEl.classList.toggle('pick', strip || !myTurn());
    const top = strip ? tagsEl.getBoundingClientRect().bottom + 6 : (innerWidth < 700 ? 118 : 74) * uiz();
    if (scene) scene.setHud(($('pr-dock').offsetHeight + 34) * uiz(), top);
  }

  // ----- name tags: name, points, and what just happened to them -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="pr-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    tagsEl.classList.toggle('pick', compact() || !myTurn()); // tags open profile cards when parked in the strip or while you are not picking cards
    const now = performance.now();
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play' && S.stage !== 'deal');
      el.classList.toggle('lead', S.ph === 'play' && p.score > 0 && p.score === Math.max(...S.seats.map(x => x.score)));
      setHtml(el.querySelector('.plate .cnt'), `${I.pair}${p.score}`);
      const b = bubbles.get(i);
      setHtml(el.firstElementChild, b && b.until > now ? b.html : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function bubble(i, html, ms = 1800) { bubbles.set(i, { html, until: performance.now() + ms }); setTimeout(() => !destroyed && S && buildTags(), ms + 30); if (S) buildTags(); }
  function floatAt(x, y, text, cls = '') {
    const f = document.createElement('div');
    f.className = 'pr-pts ' + cls; f.textContent = text;
    f.style.left = `${x}px`; f.style.top = `${y}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- the strip at the bottom: whose turn, what to do, the pairs left, your points -----
  function renderDock() {
    const el = $('pr-dock');
    if (!S || S.ph !== 'play') { setHtml(el, ''); layout(); return; }
    const p = me(), mine = p ? `<span class="pr-mine">${I.pair}<b>${pts(p.score)}</b></span>` : '';
    const left = `<span class="pr-left">${L(`${S.left} left`, `zostało: ${S.left}`)}</span>`;
    let say;
    if (S.stage === 'deal') say = `<span class="pr-wait"><span>${L('Laying out the cards…', 'Rozkładanie kart…')}</span></span>`;
    else if (myTurn() && S.stage === 'spy') say = `<span class="pr-hint hot">${twIcon('spy', 22)}${L('Spyglass: tap a face-down card to peek at it. Only you will see it.', 'Luneta: dotknij zakrytej karty, żeby ją podejrzeć. Zobaczysz ją tylko ty.')}</span>`;
    else if (myTurn()) say = `<span class="pr-hint hot">${S.up.length ? L('Now find its twin', 'Teraz znajdź parę') : S.streak ? L(`A pair! Flip again`, `Para! Odkrywaj dalej`) : L('Your turn: tap a card to flip it', 'Twoja kolej: dotknij karty, żeby ją odkryć')}${S.cap && S.streak ? ` <small>${S.streak}/${S.cap}</small>` : ''}</span>`;
    else if (S.turn >= 0) {
      const w = S.seats[S.turn];
      say = `<span class="pr-wait">${avatarHtml(w.color, w.av, 30)}<span>${S.turn === S.me ? (p?.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : S.stage === 'spy' || S.stage === 'peek' ? L(`${nameOf(S.turn)} is peeking…`, `${nameOf(S.turn)} podgląda…`) : L(`${nameOf(S.turn)} is flipping…`, `${nameOf(S.turn)} odkrywa…`)}</span></span>`;
    } else say = '';
    setHtml(el, `${say}<div class="pr-row">${mine}${left}</div>`);
    layout();
  }

  function renderBanner() {
    const el = $('pr-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), tl = S.tLeft >= 0 ? ` · ${secs}s` : '';
    if (S.ph === 'end') msg = '';
    else if (S.stage === 'deal') msg = S.turn === S.me ? L('Shuffling · you start', 'Tasowanie · zaczynasz') : L(`Shuffling · ${nameOf(S.turn)} starts`, `Tasowanie · zaczyna ${nameOf(S.turn)}`);
    else if (myTurn()) msg = (S.stage === 'spy' ? L('Peek at a card', 'Podejrzyj kartę') : L('Your turn', 'Twoja kolej')) + tl;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
    el.classList.toggle('late', myTurn() && S.tLeft >= 0 && secs <= 3);
  }

  function render() {
    if (!S) return;
    setHtml($('pr-info'), `${BOARD_NAME[S.board]()}<span class="pr-n"> · ${L(`${S.seats.length} players`, `graczy: ${S.seats.length}`)}</span>`);
    $('pr-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner();
    canvas.style.cursor = canPick(hoverI) ? 'pointer' : '';
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pr-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  const TW_NAME = { gold: () => L('Golden pair!', 'Złota para!'), spy: () => L('Spyglass!', 'Luneta!'), mix: () => L('Whirlwind!', 'Wichura!') };
  function playEv(e) {
    if (e.t === 'flip') { e.s === S.me ? sfx.place() : sfx.draw(); }
    else if (e.t === 'pair') {
      sfx.combo?.(e.streak); scene?.pairFx(e.i, e.j, e.tw);
      const at = scene?.cardPx(e.j); if (at) floatAt(at.x / uiz(), at.y / uiz(), '+' + e.pts, e.tw === 'gold' ? 'gold' : '');
      if (e.streak >= 2) { scene?.cue(e.s, 'streak'); bubble(e.s, `<span class="hot">${L(`${e.streak} in a row!`, `${e.streak} z rzędu!`)}</span>`); }
      if (e.tw) { sfx.set(); big(TW_NAME[e.tw](), e.tw === 'gold' ? L(`${e.s === S.me ? 'You get' : nameOf(e.s) + ' gets'} 3 points`, `${e.s === S.me ? 'Dostajesz' : nameOf(e.s) + ' dostaje'} 3 punkty`) : e.tw === 'spy' ? (e.s === S.me ? L('Peek at any face-down card', 'Podejrzyj dowolną zakrytą kartę') : L(`${nameOf(e.s)} gets a secret peek`, `${nameOf(e.s)} podejrzy jedną kartę`)) : L('Two pairs of cards swap places. Watch!', 'Dwie pary kart zamieniają się miejscami. Patrz!'), 1700); }
      else if (e.s === S.me) big(L('Pair!', 'Para!'), petName(e.sp), 1000);
    } else if (e.t === 'miss') { scene?.missFx(e.i, e.j); scene?.cue(e.s, 'miss'); if (e.s === S.me) sfx.bad?.(); }
    else if (e.t === 'back') sfx.plop?.();
    else if (e.t === 'late') { scene?.cue(e.s, 'late'); if (e.s === S.me) big(L('Out of time!', 'Koniec czasu!'), L('Random cards are flipped for you', 'Losowe karty odkrywają się same'), 1400); else bubble(e.s, `<span>${L('Too slow!', 'Za wolno!')}</span>`); }
    else if (e.t === 'cap') { if (e.s === S.me) big(L('That’s 3 pairs!', 'To już 3 pary!'), L('The turn passes on', 'Kolej przechodzi dalej'), 1300); else bubble(e.s, `<span class="hot">${L('3 pairs!', '3 pary!')}</span>`); }
    else if (e.t === 'spy') { sfx.whoosh?.(); if (e.s !== S.me) bubble(e.s, `<span>${twIcon('spy', 18)}${L('peeking', 'podgląda')}</span>`, 1800); }
    else if (e.t === 'mix') { sfx.whoosh?.(); scene?.mix(e.sw); }
    else if (e.t === 'end') {
      const won = S.res?.place[S.me] === 1;
      if (won) { sfx.win(); confetti(); } else sfx.lose?.();
      const firsts = S.res ? S.seats.map((_, i) => i).filter(i => S.res.place[i] === 1) : [];
      big(won ? (firsts.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : L(`${nameOf(S.win)} wins!`, `${nameOf(S.win)} wygrywa!`), L('Every pair is found', 'Wszystkie pary znalezione'), 2200);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; bubbles.clear();
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'deal') { let k = 0; const flick = () => { if (destroyed || k++ > 8) return; sfx.draw(); setTimeout(flick, 200); }; flick(); }
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (!fresh && myTurn() && was !== s.turn + '/' + s.stage + '/' + s.mv) { if (!s.up.length && s.stage === 'pick' && !s.streak) sfx.turn(); lastTick = -1; sent = 0; }
    render(); scene?.setState(s); scene?.setBack(me()?.fl?.cb);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length, place = S.res.place;
    const firsts = S.seats.map((_, i) => i).filter(i => place[i] === 1);
    const head = firsts.includes(S.me) ? (firsts.length > 1 ? L('A shared win!', 'Wspólna wygrana!') : L('You win!', 'Wygrywasz!')) : firsts.length > 1 ? L('A shared win', 'Wspólna wygrana') : L(`${nameOf(S.win)} wins!`, `${nameOf(S.win)} wygrywa!`);
    const mine = S.me >= 0 ? place[S.me] : 0;
    const sub = mine > 1 ? L(`You came ${mine} of ${n}.`, `Twoje miejsce: ${mine} z ${n}.`) : firsts.length > 1 ? L('Equal points share first place.', 'Równe punkty dzielą pierwsze miejsce.') : '';
    const won = i => { const seen = new Set(); return S.face.map((f, k) => (S.got[k] === i && f && !seen.has(f[0]) ? (seen.add(f[0]), f) : null)).filter(Boolean); };
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      ${sub ? `<p>${sub}</p>` : ''}
      <ol class="score">${S.res.order.map((i, k) => {
        const p = S.seats[i], st = p.st, list = won(i);
        return `<li class="${pbRowCls(p.fl)} ${place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${pairsWord(st.pairs)}${st.best > 1 ? L(` · best streak ${st.best}`, ` · najlepsza seria ${st.best}`) : ''}</span>
          ${list.length ? `<span class="pr-got">${list.slice(0, 10).map(f => `<span class="pr-pet${f[1] === 'gold' ? ' g' : ''}">${petImg({ sp: f[0], lv: 14 }, 30, 'pr-pi')}</span>`).join('')}${list.length > 10 ? `<small>+${list.length - 10}</small>` : ''}</span>` : ''}</div>
          <strong><span>${pts(p.score)}</span></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Shuffle again', 'Potasuj jeszcze raz'))}</div></div>`;
    petPics(el);
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Shuffle again', 'Potasuj jeszcze raz'));
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

  function confetti(own = true) {
    if (own && myBurst()) return;
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
    const cols = ['#3f9a52', '#e0592f', '#2f86cc', '#d9a400', '#fff4e2', '#ff8fab'];
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

  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (sent && !busy()) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 3 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input: point at a card and tap it -----
  function tap(i) {
    if (!canPick(i)) return false;
    sent = Date.now(); sfx.click(); ctx.act({ t: S.stage === 'spy' ? 'peek' : 'flip', i }); scene?.setHover(-1); renderDock();
    return true;
  }
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene) return;
    const i = myTurn() ? scene.pick(e.clientX, e.clientY) : -1, ok = canPick(i);
    if (i !== hoverI) { hoverI = i; scene.setHover(ok ? i : -1); if (ok) sfx.hover(); }
    canvas.style.cursor = ok ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { hoverI = -1; scene?.setHover(-1); });
  canvas.addEventListener('click', e => { if (!scene || !myTurn()) return; const i = scene.pick(e.clientX, e.clientY); if (!tap(i) && i >= 0 && S.got[i] < 0) sfx.bad?.(); });
  const onResize = () => { if (S) { renderDock(); layout(); } };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
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
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
