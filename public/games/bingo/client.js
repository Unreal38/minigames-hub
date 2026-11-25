// Sky Bingo game view: your card, the caller strip and the Bingo button over the 3D table.
// Renders what the server says; a daub shows at once and the server confirms it.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { BALLS, MID, LETTERS, PTS, colOf, letterOf, goalName, has, toGo, goalCells } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z" fill="currentColor" stroke="#3b2219" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="6" r="2.2"/><circle cx="12" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="5" cy="13" r="2.2"/><circle cx="12" cy="13" r="2.2"/><circle cx="19" cy="13" r="2.2"/><circle cx="5" cy="20" r="2.2"/><circle cx="12" cy="20" r="2.2"/><circle cx="19" cy="20" r="2.2"/></svg>',
};
const ballHtml = (n, cls = '') => `<span class="bg-ball c${colOf(n)} ${cls}"><i>${letterOf(n)}</i><b>${n}</b></span>`;

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./bingo.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="bg">
    <canvas class="g3d" aria-label="${L('The bingo table', 'Stół do bingo')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="bg-info"></span></div>
      <div class="tr"><span class="tcode" id="bg-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="bg-banner" aria-live="polite"></div>
      <div class="shout" id="bg-big" aria-live="assertive"></div>
      <div class="bg-dock" id="bg-dock">
        <div class="bg-all" id="bg-all" hidden></div>
        <div class="bg-side" id="bg-side">
          <div class="bg-call" id="bg-call"></div>
          <div class="bg-card" id="bg-card"></div>
          <div class="bg-act" id="bg-act"></div>
        </div>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.bg'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, cardKey = '', callKey = '';
  let local = 0;          // squares you have tapped that the server has not confirmed yet
  let inset = 0, allOpen = innerWidth >= 640 && innerWidth / innerHeight > 1.15 && innerHeight >= 760, shoutSent = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const playing = () => !!(S && S.ph === 'play' && me() && !me().bot);
  const wide = () => innerWidth >= 640 && innerWidth / innerHeight > 1.15;
  const myMask = () => (S && S.me >= 0 ? S.masks[S.me] | local : 0);
  const isCalled = n => S.called.includes(n);
  const open = () => S.ph === 'play' && (S.stage === 'play' || S.stage === 'last');

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (t.mine) { el.style.display = 'none'; continue; }
      el.style.display = '';
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - inset - half, t.x));
      el.style.transform = `translate(${x.toFixed(1)}px, ${Math.max(t.y, (innerWidth < 700 ? 150 : 110) * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function layout() {
    root.classList.toggle('wide', wide());
    root.classList.toggle('allopen', allOpen);
    if (!scene) return;
    const side = $('bg-side');
    inset = wide() ? (side.offsetWidth + 28) * uiz() : 0;
    if (wide()) { scene.setInset(inset); scene.setHud((innerHeight < 520 ? 20 : 84) * uiz()); }
    else { scene.setInset(0); scene.setHud((side.offsetHeight + 26) * uiz()); }
  }

  // ----- name tags over the avatars: name, points, and a bubble when they are one square away -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="bg-tag"><div class="bub"></div><div class="plate"><i class="dot" style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<span class="cnt"></span></div></div>`).join('');
      tagEls = [...tagsEl.children];
    }
    const lastWin = S.wins[S.wins.length - 1];
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      const won = (S.stage === 'cheer' || S.ph === 'end') && lastWin?.s === i;
      el.classList.toggle('now', won);
      setHtml(el.querySelector('.plate .cnt'), String(S.pts[i]));
      setHtml(el.firstElementChild, won ? `<span class="win">Bingo!</span>` : S.ph === 'play' && S.go[i] <= 1 ? `<span>${L('1 to go!', 'Brakuje 1!')}</span>` : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }

  // ----- the caller strip: the newest ball, the four before it, and the time to the next one -----
  function renderCall() {
    const el = $('bg-call'), k = S.called.length, cur = S.called[k - 1];
    const prev = S.called.slice(-5, -1).reverse();
    const html = `<div class="bg-now">${cur ? ballHtml(cur, 'big') : `<span class="bg-ball big none"><b>?</b></span>`}</div>
      <div class="bg-info">
        <div class="bg-prev">${prev.map(n => ballHtml(n)).join('') || `<small>${L('The first ball is coming…', 'Zaraz pierwsza kula…')}</small>`}</div>
        <div class="bg-bar"><i></i></div>
        <button type="button" class="bg-allbtn" data-a="all" aria-pressed="${allOpen}">${I.grid}<span>${L(`Called: ${k} of ${BALLS}`, `Wylosowane: ${k} z ${BALLS}`)}</span></button>
      </div>`;
    const key = k + '/' + allOpen;
    if (key !== callKey) { el.innerHTML = html; }
    // restart the bar when a new ball is out or the machine stops and starts
    const barKey = S.gid + '/' + k + '/' + S.stage;
    if (barKey !== el._bar || key !== callKey) {
      el._bar = barKey; callKey = key;
      const bar = el.querySelector('.bg-bar i');
      if (S.ph === 'play' && (S.stage === 'play' || S.stage === 'count')) {
        const total = S.stage === 'count' ? S.ms.count : S.gap, done = Math.max(0, total - S.nextIn);
        bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `bgbar ${total}ms linear ${-done}ms both`;
      } else bar.style.animation = 'none';
    }
  }

  // ----- your card -----
  function renderCard() {
    const el = $('bg-card');
    if (!S.card) { if (cardKey !== 'none') { cardKey = 'none'; el.innerHTML = ''; el.hidden = true; } return; }
    const key = S.gid + '/' + S.me;
    if (key !== cardKey) {
      cardKey = key; el.hidden = false;
      el.innerHTML = `<div class="bg-head">${[...LETTERS].map((l, c) => `<span class="c${c}">${l}</span>`).join('')}</div>
        <div class="bg-grid" style="--me:${esc(me().color)}">${S.card.map((n, c) => c === MID
          ? `<span class="bg-cell free on" aria-label="${L('Free square', 'Darmowe pole')}"><em></em>${I.star}</span>`
          : `<button type="button" class="bg-cell" data-a="daub" data-c="${c}"><em></em><b>${n}</b></button>`).join('')}</div>`;
    }
    const mask = myMask(), goal = S.goal, lit = S.ph === 'play' && has(goal, mask) ? goalCells(goal, mask) : S.ph === 'end' ? goalCells('line', mask) | goalCells('two', mask) : 0;
    const cells = el.querySelector('.bg-grid').children;
    for (let c = 0; c < 25; c++) {
      const on = !!(mask & 1 << c);
      if (cells[c].classList.contains('on') !== on) cells[c].classList.toggle('on', on);
      cells[c].classList.toggle('lit', !!(lit & 1 << c));
    }
  }

  function renderAct() {
    const el = $('bg-act');
    if (!S || S.ph !== 'play' || S.me < 0) { setHtml(el, ''); return; }
    const p = me(), mask = myMask(), goal = S.goal, left = toGo(goal, mask), ready = left === 0 && open();
    const hint = p.bot ? L('A bot is playing for you', 'Bot gra za ciebie')
      : S.stage === 'count' ? L('Get ready…', 'Przygotuj się…')
        : S.stage === 'cheer' ? L(`Next prize: ${goalName(goal)}`, `Następna nagroda: ${goalName(goal)}`)
          : ready ? L('You have it. Shout!', 'Masz to! Wołaj!')
            : `${goalName(goal)} · ${L(`${left} to go`, `brakuje: ${left}`)}`;
    setHtml(el, `<button type="button" class="btn big bg-go${ready ? ' ready' : ''}" data-a="bingo" aria-disabled="${!ready}">Bingo!</button><p class="bg-hint">${hint}</p>`);
  }

  // ----- every number called so far -----
  function renderAll() {
    const el = $('bg-all');
    el.hidden = !allOpen || !S || S.ph !== 'play';
    if (el.hidden) return;
    const set = new Set(S.called), cur = S.called[S.called.length - 1];
    setHtml(el, `<div class="bg-allhead"><b>${L('Called numbers', 'Wylosowane liczby')}</b><button type="button" class="bg-x" data-a="all" aria-label="${L('Close', 'Zamknij')}">×</button></div>
      <div class="bg-rows">${[0, 1, 2, 3, 4].map(c => `<div class="bg-row c${c}"><i>${LETTERS[c]}</i>${Array.from({ length: 15 }, (_, k) => { const n = c * 15 + k + 1; return `<span class="${set.has(n) ? 'on' : ''}${n === cur ? ' cur' : ''}">${n}</span>`; }).join('')}</div>`).join('')}</div>`);
  }

  function renderBanner() {
    const el = $('bg-banner'); let msg = '';
    if (!S) return;
    const w = S.wins[S.wins.length - 1];
    if (S.ph === 'end') msg = S.res.place.filter(x => x === 1).length !== 1 ? '' : S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    else if (S.stage === 'count') msg = L('The machine is warming up…', 'Maszyna się rozgrzewa…');
    else if (S.stage === 'cheer' && w && innerWidth < 700) msg = `Bingo! ${w.s === S.me ? L('You take it', 'Nagroda dla ciebie') : nameOf(w.s)}`;
    else if (S.stage === 'cheer' && w) msg = w.s === S.me ? L(`Bingo! You take ${goalName(w.g).toLowerCase()}`, `Bingo! Zdobywasz: ${goalName(w.g).toLowerCase()}`) : L(`Bingo! ${nameOf(w.s)} takes ${goalName(w.g).toLowerCase()}`, `Bingo! ${nameOf(w.s)} zdobywa: ${goalName(w.g).toLowerCase()}`);
    else if (S.stage === 'last') msg = L('Every ball is out · last chance to shout', 'Wszystkie kule wylosowane · ostatnia szansa');
    else msg = L(`Playing for: ${goalName(S.goal)}`, `Gramy o: ${goalName(S.goal)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', S.stage === 'cheer');
  }

  function render() {
    if (!S) return;
    const done = S.ph === 'end';
    $('bg-info').innerHTML = done ? L('Game over', 'Koniec gry')
      : `${S.goals.map((g, i) => `<i class="bg-pip${i < S.gi ? ' done' : i === S.gi ? ' now' : ''}"></i>`).join('')}<span>${innerWidth < 700 ? '' : goalName(S.goal) + ' · '}${PTS[S.goal]} ${L('pts', 'pkt')}</span>`;
    $('bg-code').textContent = Rm?.code || '';
    buildTags(); renderCall(); renderCard(); renderAct(); renderAll(); renderBanner(); layout();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('bg-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'call') { sfx.draw(); setTimeout(() => !destroyed && sfx.pop(), 420); const b = root.querySelector('.bg-now .bg-ball'); if (b) { b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); } }
    else if (e.t === 'win') {
      const mine = e.s === S.me;
      if (mine) { sfx.win(); confetti(); } else S.me >= 0 ? sfx.lose() : sfx.set();
      if (S.ph !== 'end') big('Bingo!', `${mine ? L('You take', 'Zdobywasz:') : nameOf(e.s) + L(' takes', ' zdobywa:')} ${goalName(e.g).toLowerCase()} · +${e.pts}`, 2600);
    } else if (e.t === 'goal') { sfx.turn(); big(goalName(e.g), L(`Next prize · ${PTS[e.g]} points`, `Następna nagroda · ${PTS[e.g]} pkt`), 1700); }
    else if (e.t === 'end') {
      const w = S.wins[S.wins.length - 1];
      big(w ? 'Bingo!' : L('Game over', 'Koniec gry'), w ? `${w.s === S.me ? L('You take', 'Zdobywasz:') : nameOf(w.s) + L(' takes', ' zdobywa:')} ${goalName(w.g).toLowerCase()}` : L('Nobody shouted in time', 'Nikt nie zawołał na czas'), 2400);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2800);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prevGi = S?.gi;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); local = 0; shoutSent = 0; cardKey = ''; callKey = '';
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
      else if (!s.called.length) big(goalName(s.goal), L(`First prize · ${PTS[s.goal]} points`, `Pierwsza nagroda · ${PTS[s.goal]} pkt`), 1800);
    }
    if (s.me >= 0) local &= ~s.masks[s.me]; else local = 0; // confirmed by the server
    if (prevGi !== s.gi) shoutSent = 0;
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res;
    const solo = R.place.filter(x => x === 1).length === 1, mine = S.me >= 0 ? R.place[S.me] : 0;
    const head = mine === 1 && solo ? L('You win the game!', 'Wygrywasz grę!') : solo ? L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`) : L('Shared first place!', 'Wspólne pierwsze miejsce!');
    const sub = L(`${cnt(R.balls, 'ball', 'balls')} called.`, `Wylosowane kule: ${R.balls}.`) + (mine > 1 ? ' ' + L(`You came ${mine}${['th', 'st', 'nd', 'rd'][mine] || 'th'}.`, `Twoje miejsce: ${mine}.`) : '');
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], got = R.wins.filter(w => w.s === i).map(w => goalName(w.g));
        const note = got.length ? got.join(', ') : L(`${R.left[i]} to go for a full card`, `do całej karty brakuje: ${R.left[i]}`);
        return `<li class="${R.place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 80}ms"><i class="pos">${R.place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${note}</span></div>
          <strong><span>${R.pts[i]}</span><small>${L('pts', 'pkt')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm)}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm);
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t && !t.mine ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t && !t.mine ? t.y - 50 : innerHeight * .5;
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

  // ----- input -----
  const nope = el => { sfx.bad(); el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };
  function daub(el) {
    if (!playing()) return;
    const c = +el.dataset.c, n = S.card[c];
    if (myMask() & 1 << c) return;
    if (!isCalled(n)) return nope(el);
    local |= 1 << c; sfx.place(); ctx.act({ t: 'daub', c });
    renderCard(); renderAct();
    if (open() && has(S.goal, myMask())) sfx.set();
  }
  function shout(el) {
    if (!playing()) return;
    if (!open() || !has(S.goal, myMask())) return nope(el);
    if (Date.now() - shoutSent < 1500) return;
    shoutSent = Date.now(); sfx.click(); ctx.act({ t: 'bingo' });
  }
  const onKey = e => {
    if (e.target.closest?.('input, textarea, button') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Enter') { const b = root.querySelector('.bg-go'); if (b) { e.preventDefault(); shout(b); } }
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) layout(); };
  addEventListener('resize', onResize);
  // a daub must land on the press, not on the release: there are only a few seconds per ball
  root.addEventListener('pointerdown', e => { const b = e.target.closest('[data-a="daub"]'); if (b) { e.preventDefault(); daub(b); } });

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'daub') { if (!e.detail) daub(b); } // keyboard only: pointers are handled on the press
    else if (a === 'bingo') shout(b);
    else if (a === 'all') { sfx.click(); allOpen = !allOpen; callKey = ''; renderCall(); renderAll(); }
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
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
