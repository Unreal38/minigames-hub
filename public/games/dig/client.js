// Treasure Dig game view: HUD over the 3D field. Renders what the server says and sends the tile you dig.
// Nothing under the grass reaches this page until someone digs it.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { PTS, TRAP } from './rules.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
// little pictures for the HUD
const GEMC = { 1: '#4db5ff', 2: '#ff5c8a' };
export const gemSvg = (k = 1) => k === 3
  ? '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="11" rx="2" fill="#b9794a" stroke="#3b2219" stroke-width="2"/><path d="M3 9q0-5 9-5t9 5z" fill="#c98a52" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><rect x="10" y="9" width="4" height="5" fill="#ffc93c" stroke="#3b2219" stroke-width="1.6"/></svg>'
  : `<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l4-5h10l4 5-9 12z" fill="${GEMC[k]}" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><path d="M7 9l2-3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`;
export const bombSvg = '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="14" r="7.5" fill="#2b2430" stroke="#3b2219" stroke-width="2"/><path d="M15.5 8.5l2.5-3" stroke="#8a5a3c" stroke-width="2.4" stroke-linecap="round"/><circle cx="19" cy="4.4" r="2" fill="#ffd84a"/><circle cx="8.5" cy="11.5" r="1.6" fill="#fff" opacity=".5"/></svg>';
const sparkSvg = '<svg class="td-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#ffd84a" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>';

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./dig.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="td">
    <canvas class="g3d" aria-label="${L(`The treasure field`, `Pole ze skarbami`)}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="td-info"></span></div>
      <div class="tr"><span class="tcode" id="td-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="td-banner" aria-live="polite"></div>
      <div class="shout" id="td-big" aria-live="assertive"></div>
      <div class="td-bottom" id="td-bottom">
        <div class="td-dock" id="td-dock"></div>
        <ol class="td-list" id="td-list" aria-label="${L(`Players and their points`, `Gracze i ich punkty`)}"></ol>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.td'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  canvas.tileScreen = i => scene?.tileScreen(i) || null; // where a tile is on screen (used by browser tests)
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0, digN = 0, revealTimer = 0;
  let cursor = -1, touchPick = -1, revealed = true;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'turn' && S.turn === S.me && me() && !me().bot);
  const gemsOf = st => st.gems + st.big + st.chest;

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 100) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x));
      placer.add(el, t.x, t.y);
    }
  }
  function layout() {
    if (!scene) return;
    const top = innerWidth < 700 ? 104 : 64, z = uiz();
    scene.setHud(Math.max($('td-bottom').offsetHeight + 24, innerWidth < 700 ? 150 : 110) * z, top * z);
  }

  // ----- name tags: name and points -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="td-tag${i === S.me ? ' mine' : ''}"><div class="plate${tagCls(p)}">${tagFace(p, i === S.me ? L('You', 'Ty') : undefined)}<span class="cnt"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.ph === 'play' && S.stage !== 'start');
      const cnt = el.querySelector('.plate .cnt'), v = String(shownPts(i)); if (cnt._h !== v) { cnt._h = v; cnt.textContent = v; }
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  // points as the screen shows them: the latest dig only counts once its tile has been dug open
  const shownFinds = i => gemsOf(S.seats[i].st) - (!revealed && S.dig?.s === i && S.dig.kind >= 1 && S.dig.kind <= 3 ? 1 : 0);
  const shownPts = i => S.seats[i].pts - (!revealed && S.dig?.s === i ? S.dig.pts : 0);

  function renderList() {
    const order = S.seats.map((_, i) => i);
    setHtml($('td-list'), order.map(i => {
      const p = S.seats[i], st = p.st, now = i === S.turn && S.ph === 'play' && S.stage !== 'start';
      return `<li class="${pbRowCls(p.fl)} ${now ? 'now' : ''}${i === S.me ? ' td-me' : ''}">${avatarHtml(p.color, p.av, 28, frameCls(p.fl))}<b>${i === S.me ? L('You', 'Ty') : nameHtml(p.name, p.fl)}</b><strong>${shownPts(i)}</strong><span class="td-found" aria-label="${L(`${shownFinds(i)} finds`, `znaleziska: ${shownFinds(i)}`)}">${gemSvg(1)}${shownFinds(i)}</span>${rowBg(p.fl)}</li>`;
    }).join(''));
    pbRows($('td-list'));
  }

  function renderDock() {
    const el = $('td-dock');
    if (!S || S.ph !== 'play') { setHtml(el, ''); return; }
    const lf = S.left;
    const stock = `<span class="td-stock" aria-label="${L(`Still buried`, `Wciąż zakopane`)}">${gemSvg(1)}${lf.gem}${gemSvg(2)}${lf.big}${lf.chest ? gemSvg(3) + lf.chest : ''}<em>${bombSvg}${lf.trap}</em></span>`;
    if (myTurn() && Date.now() - sent > 1200) {
      const touch = touchPick >= 0;
      setHtml(el, `<div class="td-you"><b>${L(`${S.chain ? 'Found one! Dig again' : 'Your turn'}`, `${S.chain ? 'Jest skarb! Kop dalej' : 'Twoja kolej'}`)}</b>
        <span>${L(`${touch ? 'Tap the tile again, or' : innerWidth < 700 ? 'Tap a grass tile, then tap it again to dig.' : 'Click a grass tile to dig it.'}`, `${touch ? 'Dotknij pola jeszcze raz albo' : innerWidth < 700 ? 'Dotknij pola z trawą, a potem dotknij go jeszcze raz, żeby kopać.' : 'Kliknij pole z trawą, żeby je rozkopać.'}`)}</span>
        ${touch ? '<button type="button" class="btn" data-a="dig">' + L('Dig here', 'Kop tutaj') + '</button>' : ''}</div>
        <p class="td-hint">${stock}<span>${L(`A number counts the <b>traps</b> touching that tile. ${sparkSvg} on a tile you dug means a gem is buried within 2 tiles.`, `Liczba mówi, ile <b>pułapek</b> styka się z tym polem. ${sparkSvg} na odkopanym przez kogoś polu oznacza klejnot w odległości do 2 pól.`)}</span></p>`);
    } else setHtml(el, `<p class="td-hint">${stock}</p>`);
    layout();
  }

  function renderBanner() {
    const el = $('td-banner'); if (!S) return;
    let msg = '';
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs} s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${S.win === S.me ? 'You win' : nameOf(S.win) + ' wins'}!`, `${S.win === S.me ? 'Wygrana' : 'Wygrywa ' + nameOf(S.win)}!`) : '';
    else if (S.stage === 'start') msg = L(`The field is ready · ${S.turn === S.me ? 'you dig' : nameOf(S.turn) + ' digs'} first`, `Pole gotowe · zaczyna ${S.turn === S.me ? 'twoja łopata' : nameOf(S.turn)}`);
    else if (S.stage === 'dig') msg = L(`${S.dig.s === S.me ? 'You dig' : nameOf(S.dig.s) + ' digs'}…`, `${S.dig.s === S.me ? 'Kopiesz' : nameOf(S.dig.s) + ' kopie'}…`);
    else if (myTurn()) msg = (S.chain ? L('Dig again', 'Kop dalej') : L('Your turn · pick a tile', 'Twoja kolej · wybierz pole')) + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)} is ${S.chain ? 'digging again' : 'choosing a tile'}`, `${nameOf(S.turn)} ${S.chain ? 'kopie dalej' : 'wybiera pole'}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function render() {
    if (!S) return;
    const lf2 = S.left, gems = lf2.gem + lf2.big + lf2.chest;
    $('td-info').textContent = S.ph === 'end' ? L('All the treasure is dug up', 'Wszystkie skarby wykopane') : L(`${gems} treasure${gems === 1 ? '' : 's'} left`, `Zostało skarbów: ${gems}`);
    $('td-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderDock(); renderBanner();
  }

  function big(text, sub = '', ms = 1500, cls = '') {
    const el = $('td-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function floatAt(i, text, bad) {
    const p = scene?.tileScreen(i); if (!p) return;
    const f = document.createElement('div');
    f.className = 'td-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${p.x}px`; f.style.top = `${p.y}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // the moment the shovel is done: say what came out
  function reveal(d, late) {
    revealed = true; render();
    if (late) return;
    const who = d.s === S.me ? 'You' : nameOf(d.s), mine = d.s === S.me;
    if (d.kind >= 1 && d.kind <= 3) {
      floatAt(d.i, `+${d.pts}`, false);
      const what = d.kind === 3 ? L('Golden chest!', 'Złota skrzynia!') : d.kind === 2 ? L('Big gem!', 'Wielki klejnot!') : L('A gem!', 'Klejnot!');
      big(what, L(`${who} ${mine ? 'find' : 'finds'} ${d.pts} point${d.pts === 1 ? '' : 's'}${d.chain > 1 ? ` · ${d.chain} in a row` : ''} · dig again`, `${mine ? 'Zdobywasz' : who + ' zdobywa'} ${cnt(d.pts, 'point', 'points', 'punkt', 'punkty', 'punktów')}${d.chain > 1 ? ` · ${d.chain} z rzędu` : ''} · kopanie trwa`), d.kind === 3 ? 2200 : 1400, 'k' + d.kind);
      if (d.kind === 3) { sfx.win(); if (mine) confetti(); } else sfx.set();
    } else if (d.kind === 4) {
      setTimeout(() => { if (destroyed) return; sfx.lose(); floatAt(d.i, d.pts ? `${d.pts}` : '0', true); big(L('Trap!', 'Pułapka!'), L(`${who} ${mine ? 'lose' : 'loses'} ${-d.pts || 0} point${d.pts === -1 ? '' : 's'}`, `${mine ? 'Tracisz' : who + ' traci'} ${cnt(-d.pts || 0, 'point', 'points', 'punkt', 'punkty', 'punktów')}`), 1600, 'k4'); }, 750);
      sfx.warn();
    } else { sfx.plop(); if (d.late && d.s === S.me) ctx.toast(L('Out of time: the game dug a tile for you', 'Koniec czasu: gra rozkopała pole za ciebie')); }
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? L('You took over a bot. Good luck!', 'Przejmujesz miejsce bota. Powodzenia!') : L(`${nameOf(e.s)} took over a bot`, `${nameOf(e.s)} przejmuje miejsce bota`)); }
    else if (e.t === 'end') { clearTimeout(resultsTimer); resultsTimer = setTimeout(() => { showResults(); if (S?.win === S?.me) { sfx.win(); confetti(); } }, 2600); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, wasMine = myTurn();
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; cursor = -1; touchPick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0; digN = s.dig?.n || 0; revealed = true;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (s.dig && s.dig.n !== digN) { // a new dig: tell what came out once the shovel is done
      digN = s.dig.n; const d = s.dig, wait = d.walk + s.ms.dig - d.ago;
      revealed = wait <= 0; clearTimeout(revealTimer);
      if (wait > 0) { revealTimer = setTimeout(() => !destroyed && reveal(d, false), wait); for (const k of [.2, .6]) { const at = d.walk + s.ms.dig * k - d.ago; if (at > 0) setTimeout(() => !destroyed && sfx.plop(), at); } }
      else reveal(d, wait < -800);
      touchPick = -1;
    }
    if (!wasMine && myTurn()) { sfx.turn(); lastTick = -1; sent = 0; if (cursor < 0 || s.tiles[cursor] >= 0) cursor = -1; }
    if (!myTurn()) { scene?.setHover(-1); touchPick = -1; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    const finds = st => [st.chest ? `${gemSvg(3)}${st.chest}` : '', `${gemSvg(2)}${st.big}`, `${gemSvg(1)}${st.gems}`, st.traps ? `${bombSvg}${st.traps}` : ''].filter(Boolean).join('');
    el.innerHTML = `<div class="sheet">
      <h2>${L(`${w === S.me ? 'Richest digger on the island!' : `${nameOf(w)} wins!`}`, `${w === S.me ? 'Najwięcej skarbów na wyspie jest u ciebie!' : `Wygrywa ${nameOf(w)}!`}`)}</h2>
      <p>${L(`${myPlace ? (myPlace === 1 ? 'You dug up the most treasure. ' : `You came ${ORD(myPlace)}. `) : ''}Every gem has been found.`, `${myPlace ? (myPlace === 1 ? 'Masz najwięcej wykopanych skarbów. ' : `Twoje miejsce: ${myPlace}. `) : ''}Wszystkie klejnoty znalezione.`)}</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i];
        return `<li class="${pbRowCls(p.fl)} ${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span class="td-finds">${finds(p.st)}</span></div>
          ${L(`<strong>${p.pts}<small>points</small></strong>`, `<strong>${p.pts}<small>${word(p.pts, 'point', 'points', 'punkt', 'punkty', 'punktów')}</small></strong>`)}${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Dig again', 'Kop jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Dig again', 'Kop jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.y - 30 : innerHeight * .62;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.setTransform(q, 0, 0, q, 0, 0); // full phone resolution is 4x the pixels for no visible gain
    const cols = ['#4db5ff', '#ff5c8a', '#ffc93c', '#7ed3b2', '#fff4e2', '#e5543b'];
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
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  const canDig = i => myTurn() && i >= 0 && S.tiles[i] < 0 && Date.now() - sent > 1200;
  function dig(i) {
    if (!canDig(i)) return;
    sent = Date.now(); sfx.click(); ctx.act({ t: 'dig', i }); touchPick = -1; scene?.setHover(-1); renderDock();
  }
  function aim(i) { cursor = i; scene?.setHover(canDig(i) ? i : -1); }
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene || !myTurn()) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (i !== cursor) { aim(i); if (canDig(i)) sfx.hover(); }
    canvas.style.cursor = canDig(i) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { if (touchPick < 0) scene?.setHover(-1); });
  canvas.addEventListener('click', e => {
    if (!scene || !myTurn()) return;
    const i = scene.pick(e.clientX, e.clientY);
    if (!canDig(i)) return;
    // a mouse digs at once; a finger picks the tile first, so a slip does not dig the wrong one
    if (e.pointerType === 'mouse' || (!e.pointerType && matchMedia('(hover: hover)').matches) || touchPick === i) dig(i);
    else { touchPick = i; aim(i); sfx.click(); renderDock(); }
  });
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), w = S.w, h = S.h;
    let c = cursor >= 0 ? cursor : (h >> 1) * w + (w >> 1);
    if (k === 'arrowup') c = Math.max(c % w, c - w); else if (k === 'arrowdown') c = c + w < w * h ? c + w : c;
    else if (k === 'arrowleft') c = c % w ? c - 1 : c; else if (k === 'arrowright') c = c % w < w - 1 ? c + 1 : c;
    else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button')) { dig(cursor); e.preventDefault(); return; }
    else return;
    e.preventDefault(); aim(c); touchPick = -1;
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'dig') dig(touchPick);
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
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(revealTimer); scene?.dispose();
    },
  };
}
