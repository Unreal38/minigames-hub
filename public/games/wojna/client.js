// Wojna game view: HUD over the 3D table. Renders what the server says and sends one thing: "turn my card over".
// Nobody is ever sent the order of a pile, so there is nothing secret on this page.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  cards: '<svg class="wj-ci" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2.5" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2.5" transform="rotate(8 16 12)"/></svg>',
};
const cards = k => cnt(k, 'card', 'cards', 'kartę', 'karty', 'kart');
let auto = false; // "turn my cards for me", kept from one game to the next

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./wojna.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="wj">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="wj-info"></span></div>
      <div class="tr"><span class="tcode" id="wj-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="wj-banner" aria-live="polite"></div>
      <div class="shout" id="wj-big" aria-live="assertive"></div>
      <div class="wj-dock" id="wj-dock">
        <div class="wj-bar" id="wj-bar" aria-hidden="true"></div>
        <div class="wj-go">
          <button type="button" class="btn big m wj-flip" id="wj-flip" data-a="flip" disabled></button>
          <button type="button" class="btn wj-auto" id="wj-auto" data-a="auto" aria-pressed="${auto}"><i></i><span>${L('Auto', 'Auto')}</span></button>
        </div>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.wj'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], cntEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, autoTimer = 0, endsAt = 0, lastTick = -1, sent = -1;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  // may I turn a card over right now? (sent = the move I already answered, so one tap never counts twice)
  const myFlip = () => !!(S && S.ph === 'play' && S.stage === 'flip' && me()?.need && !me().bot && sent !== S.mvKey);

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i], c = cntEls[i]; if (!t) continue;
      if (el && !t.mine) {
        const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x)); // keep the tag on the screen when its player is half off it
        el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, 150 * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
      }
      if (c) c.style.transform = `translate(${t.cx.toFixed(1)}px, ${t.cy.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
  // keep the 3D table clear of the buttons at the bottom
  function layout() { if (scene) scene.setHud(($('wj-dock').offsetHeight + 34) * uiz()); }

  // ----- name tags over the avatars, and a card count on every pile -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="wj-tag"${i === S.me ? ' hidden' : ''}><div class="plate"><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div></div>`).join('')
        + S.seats.map(p => `<div class="wj-cnt" style="--c:${esc(p.color)}"></div>`).join('');
      tagEls = [...tagsEl.querySelectorAll('.wj-tag')]; cntEls = [...tagsEl.querySelectorAll('.wj-cnt')];
    }
    const lead = Math.max(...S.seats.map(p => p.n));
    S.seats.forEach((p, i) => {
      const el = tagEls[i], c = cntEls[i]; if (!el || !c) return;
      el.classList.toggle('now', S.stage === 'flip' && p.need); el.classList.toggle('gone', !!p.out);
      c.classList.toggle('lead', p.n === lead && S.rnd > 0); c.classList.toggle('gone', !!p.out); c.classList.toggle('mine', i === S.me);
      if (c._n !== p.n) { if (c._n != null && p.n > c._n) { c.classList.remove('up'); void c.offsetWidth; c.classList.add('up'); } c._n = p.n; c.textContent = p.n; }
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text) {
    const t = live?.tags?.[i]; if (!t) return;
    const f = document.createElement('div');
    f.className = 'wj-pts'; f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy - 26}px`;
    root.append(f); setTimeout(() => f.remove(), 1300);
  }

  // ----- the button, and the bar that shows who holds how much of the deck -----
  function renderDock() {
    const btn = $('wj-flip'), bar = $('wj-bar');
    const order = S.seats.map((_, i) => i); if (S.me > 0) order.push(...order.splice(0, S.me)); // your slice comes first
    setHtml(bar, order.map(i => `<i style="flex:${S.seats[i].n};background:${esc(S.seats[i].color)}"${S.seats[i].n ? '' : ' hidden'}><b>${S.seats[i].n}</b></i>`).join('') + `<u style="flex:${S.seats.reduce((a, p) => a + p.tbl.length, 0)}"></u>`);
    const can = myFlip(), p = me();
    let label = L('Flip!', 'Odkryj!');
    if (S.ph !== 'play') label = L('Game over', 'Koniec gry');
    else if (!p) label = L('Watching', 'Oglądasz');
    else if (p.out) label = L('Out of cards', 'Brak kart');
    else if (S.war && (S.stage === 'war' || S.stage === 'flip') && S.inn.includes(S.me)) label = L('War!', 'Wojna!');
    btn.disabled = !can; btn.classList.toggle('hot', can); btn.classList.toggle('war', S.war > 0 && S.inn.includes(S.me) && S.stage !== 'show');
    if (btn._l !== label) { btn._l = label; btn.textContent = label; }
    $('wj-auto').hidden = !p || !!p.out || S.ph !== 'play';
    layout();
  }

  function renderBanner() {
    const el = $('wj-banner'); let msg = '';
    if (!S) return;
    const wide = innerWidth >= 700, secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.ph === 'end') msg = S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    else if (S.stage === 'deal') msg = L('Dealing the cards…', 'Rozdawanie kart…');
    else if (S.stage === 'war') msg = L(`War: ${S.inn.map(nameOf).join(' vs ')}`, `Wojna: ${S.inn.map(nameOf).join(' kontra ')}`);
    else if (S.stage === 'show' && S.bw >= 0) {
      const k = S.seats.reduce((a, p) => a + p.tbl.length, 0);
      msg = (S.bw === S.me ? L(`You take ${cards(k)}`, `Zabierasz ${cards(k)}`) : L(`${nameOf(S.bw)} takes ${cards(k)}`, `${nameOf(S.bw)} zabiera ${cards(k)}`)) + (S.coin ? L(' on a coin toss', ' po rzucie monetą') : '');
    } else if (myFlip()) msg = (S.war ? (wide ? L('War! One card face down, one face up', 'Wojna! Jedna karta zakryta, jedna odkryta') : L('War! Two cards', 'Wojna! Dwie karty')) : L('Turn over your card', 'Odkryj swoją kartę')) + (auto ? '' : ` · ${secs}s`);
    else if (S.stage === 'flip') { const w = S.seats.map((p, i) => (p.need && i !== S.me ? nameOf(i) : '')).filter(Boolean); msg = w.length ? L(`Waiting for ${w.join(', ')}`, `Czekamy: ${w.join(', ')}`) : ''; }
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myFlip()); el.classList.toggle('war', S.ph === 'play' && S.war > 0 && S.stage !== 'show');
  }

  function render() {
    if (!S) return;
    const no = Math.min(S.rnd + 1, Math.max(S.rnd, S.rounds));
    $('wj-info').textContent = S.ph === 'end' ? L(`${cnt(S.res?.rounds ?? S.rnd, 'battle', 'battles', 'bitwa', 'bitwy', 'bitew')} played`, `Rozegrano: ${cnt(S.res?.rounds ?? S.rnd, 'battle', 'battles', 'bitwa', 'bitwy', 'bitew')}`)
      : S.extra && S.rnd >= S.rounds ? L('Tie-break battle', 'Dogrywka') : L(`Battle ${no} of ${S.rounds}`, `Bitwa ${no} z ${S.rounds}`);
    $('wj-info').classList.toggle('last', S.ph === 'play' && S.rnd + 1 >= S.rounds);
    $('wj-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1500, cls = '') {
    const el = $('wj-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'flip') { e.s === S.me ? sfx.place() : sfx.draw(); }
    else if (e.t === 'war') {
      setTimeout(() => { if (destroyed) return; sfx.boom(); big(L('War!', 'Wojna!'), e.seats.map(nameOf).join(L(' vs ', ' kontra ')), 1000, 'war'); }, 300);
    } else if (e.t === 'win') {
      setTimeout(() => {
        if (destroyed) return;
        if (e.s === S.me) { if (e.war) sfx.win(); else sfx.combo(2); } else if (e.war) sfx.set(); else sfx.pop();
        floatAt(e.s, '+' + e.k);
        if (e.war) big(e.s === S.me ? L('You win the war!', 'Wygrywasz wojnę!') : L(`${nameOf(e.s)} wins the war!`, `${nameOf(e.s)} wygrywa wojnę!`), e.coin ? L('Nobody had a card left, so a coin was tossed', 'Nikt nie miał już kart, więc zdecydował rzut monetą') : L(`${cards(e.k)} in one go`, `${cards(e.k)} za jednym razem`).replace(/^./, c => c.toUpperCase()), 1300);
      }, 380);
    } else if (e.t === 'out') {
      if (e.s === S.me) { sfx.lose(); big(L('Out of cards!', 'Koniec kart!'), L('You can watch the rest of the game', 'Możesz oglądać resztę gry'), 1800); }
      else ctx.toast(L(`${nameOf(e.s)} is out of cards`, `${nameOf(e.s)} nie ma już kart`));
    } else if (e.t === 'extra') { sfx.warn?.(); big(L('A tie!', 'Remis!'), L('Extra battles until one pile is bigger', 'Dogrywka, aż jeden stos będzie większy'), 1700); }
    else if (e.t === 'end') {
      const mine = S.res?.place[S.me] === 1;
      setTimeout(() => {
        if (destroyed) return;
        if (mine) { sfx.win(); confetti(); } else if (S.me >= 0) sfx.lose();
        big(mine ? L('You win!', 'Wygrywasz!') : L(`${nameOf(e.w)} wins!`, `Wygrywa ${nameOf(e.w)}!`), S.res?.capped ? L('The biggest pile after the last battle', 'Największy stos po ostatniej bitwie') : L('Every card in one pile', 'Wszystkie karty w jednym stosie'), 2000);
      }, 500);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2700);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, could = myFlip();
    s.mvKey = s.rnd + '/' + s.war + '/' + s.stage; // one flip per step of a battle
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (s.stage === 'deal' && s.dealLeft > 500) { let k = 0; const flick = () => { if (destroyed || k++ > 5 || S.stage !== 'deal') return; sfx.draw(); setTimeout(flick, 230); }; flick(); }
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (myFlip() && !could) {
      lastTick = -1;
      if (auto) { clearTimeout(autoTimer); autoTimer = setTimeout(go, 260); } else if (s.war) sfx.turn();
    }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, mine = S.me >= 0 ? R.place[S.me] : 0;
    const head = mine === 1 ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    const sub = R.capped ? L(`All the battles are played, so the biggest pile wins.`, `Wszystkie bitwy rozegrane, więc wygrywa największy stos.`)
      : L(`${S.win === S.me ? 'You' : nameOf(S.win)} took every card after ${cnt(R.rounds, 'battle', 'battles', 'bitwa', 'bitwy', 'bitew')}.`, `Wszystkie karty w jednym stosie po ${R.rounds} ${R.rounds === 1 ? 'bitwie' : 'bitwach'}.`);
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${R.place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${R.place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(st.won, 'battle', 'battles')} and ${cnt(st.wars, 'war', 'wars')} won · best haul ${st.best}`, `wygrane bitwy: ${st.won} · wojny: ${st.wars} · najwięcej naraz: ${st.best}`)}</span></div>
          <strong><span>${R.left[i]}</span><small>${word(R.left[i], 'card', 'cards', 'karta', 'karty', 'kart')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Deal again', 'Rozdaj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 50 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
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
    if (myFlip() && !auto && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 2 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go() {
    if (destroyed || !myFlip()) return;
    sent = S.mvKey; ctx.act({ t: 'flip' }); renderDock(); renderBanner();
  }
  const onKey = e => {
    if (e.target.closest?.('input, textarea, button') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { if (myFlip()) { go(); e.preventDefault(); } }
    else if (e.key.toLowerCase() === 'a' && me() && S.ph === 'play') setAuto(!auto);
  };
  function setAuto(on) {
    auto = on; sfx.click(); $('wj-auto').setAttribute('aria-pressed', auto);
    if (auto) go(); else clearTimeout(autoTimer);
    renderBanner();
  }
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) render(); };
  addEventListener('resize', onResize);
  canvas.addEventListener('pointerdown', () => go()); // tapping the table turns your card too

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'flip') go();
    else if (a === 'auto') setAuto(!auto);
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
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(autoTimer); scene?.dispose();
    },
  };
}
