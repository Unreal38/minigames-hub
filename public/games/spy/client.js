// Spyglass Isle game view: draws the shared picture card (rules.js makes the same card from the seed in every
// browser) on one canvas with the Pet Farm pets as pictures, lets you zoom, drag and tap, and tells the server
// where you tapped. The server decides who was first. HUD: the pet to find, the clock, everyone's cards, results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { petPic } from '../../petpic.js';
import { isNight } from '../../weather.js';
import { seasonLookNow } from '../../season3d.js';
import { SPECIES } from '../farm/data.js';
import { SIZE, FIND_MS, REVEAL_MS, COUNT_MS, DIZZY_MS, makePool, makeCard, hits, key, lvOf, rng } from './rules.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SV = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: SV('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  plus: SV('<path d="M12 5v14M5 12h14"/>', 20), minus: SV('<path d="M5 12h14"/>', 20), fit: SV('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 20),
  crown: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 18l-1-10 6 4 4-8 4 8 6-4-1 10z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
  card: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3" fill="#ffe9a8" stroke="#3b2219" stroke-width="2"/><circle cx="12" cy="11" r="3.4" fill="none" stroke="#3b2219" stroke-width="2"/><path d="M14.4 13.4l2.6 2.6" stroke="#3b2219" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const EL_NAME = { Leaf: L('Leaf', 'Liść'), Ember: L('Ember', 'Żar'), Tide: L('Tide', 'Fala'), Spark: L('Spark', 'Iskra'), Stone: L('Stone', 'Kamień') };
const secs = ms => (Math.max(0, ms) / 1000).toFixed(1).replace('.', L('.', ',')) + ' s';
// The colours of each card's ground: [top, bottom, speckles...]
const GROUND = {
  meadow: ['#a6dc84', '#77b95e', '#f7f3d0', '#f3a6c0', '#5c9f4a', '#ffd86b'],
  beach: ['#f8e6b0', '#ebcd89', '#f9d6c9', '#d9b87a', '#fff4d9', '#8fd3ef'],
  snow: ['#f5f9ff', '#d4e3f3', '#ffffff', '#b9d0ea', '#e4eefa', '#9fc3e6'],
  pond: ['#95d6cc', '#5fafab', '#3f9a52', '#b6e6dd', '#78c596', '#f3a6c0'],
};
const WINTER = { meadow: ['#eef5fc', '#cddff0', '#ffffff', '#b9d0ea', '#7fb36a', '#ffd86b'], pond: ['#d8ecf6', '#a9cde3', '#ffffff', '#eaf5fb', '#8fbcd8', '#c4e0ef'] };
const pics = new Map(); // look key -> Image (kept between matches)
const lookName = l => SPECIES[l.sp]?.name || l.sp;
const lookSub = l => (l.f ? L('Adult', 'Dorosły') : L('Baby', 'Maluch')) + (l.el ? ' · ' + L(`${EL_NAME[l.el]} colours`, `kolory: ${EL_NAME[l.el]}`) : '');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./spy.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="sy">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="sy-top">
      <div class="sy-tl"><div class="sy-zoom"><button type="button" class="round" data-a="zin" aria-label="${L('Zoom in', 'Przybliż')}">${I.plus}</button><button type="button" class="round" data-a="zout" aria-label="${L('Zoom out', 'Oddal')}">${I.minus}</button><button type="button" class="round" data-a="zfit" aria-label="${L('Whole card', 'Cała karta')}">${I.fit}</button></div></div>
      <div class="sy-want" id="sy-want"><span class="sy-pic"><img id="sy-wimg" alt=""></span><span class="sy-wt"><span class="sy-wh"><small>${L('Find', 'Znajdź')}</small><span class="sy-no" id="sy-no"></span></span><b id="sy-wname">…</b><span id="sy-wsub"></span><span class="sy-bar"><i id="sy-bar"></i></span></span></div>
      <div class="sy-tr tr"><span class="tcode" id="sy-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
    </div>
    <div class="sy-main">
      <ol class="sy-seats l" id="sy-sl"></ol>
      <div class="sy-stage" id="sy-stage"><div class="sy-board" id="sy-board">
        <canvas class="sy-cv" aria-label="${L('The picture card. Tap the pet shown at the top. Scroll or pinch to zoom, drag to look around.', 'Karta z obrazkiem. Dotknij zwierzaka pokazanego u góry. Przewiń albo rozsuń palce, żeby przybliżyć, przeciągnij, żeby się rozejrzeć.')}"></canvas>
        <div class="sy-dizzy" id="sy-dizzy" hidden><b>💫 ${L('Dizzy!', 'Zakręciło się!')}</b><span>${L('Wrong pet', 'To nie ten')}</span></div>
      </div></div>
      <ol class="sy-seats r" id="sy-sr"></ol>
    </div>
    <div class="banner" id="sy-banner" aria-live="polite"></div>
    <div class="shout" id="sy-big" aria-live="assertive"></div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.sy'), $ = id => root.querySelector('#' + id);
  const cv = root.querySelector('.sy-cv'), g = cv.getContext('2d'), board = $('sy-board'), stage = $('sy-stage'), main = root.querySelector('.sy-main'), lists = [$('sy-sl'), $('sy-sr')];
  let scene = null;
  let S = null, info = null, Rm = ctx.room(), destroyed = false, gid = null, lastEv = 0, got = 0;
  let M = null, look = [], ready = false, card = null, deco = null, side = 300, dpr = 1, need = true, raf = 0;
  let view = { s: 1, x: 0, y: 0 }, anim = null, dzUntil = 0, pending = 0, resultsTimer = 0, bigTimer = 0, lastCount = 99, seatKey = '', lis = [];
  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const nameOf = i => esc(info?.[i]?.name);
  const stageT = () => S ? S.t + (performance.now() - got) : 0;
  const playing = () => S && S.me >= 0 && S.ph === 'play' && !info[S.me]?.bot;
  const winter = () => seasonLookNow() === 'winter'; // the card's ground follows the site's season

  // ----- the pictures: every look of this match, drawn once from the 3D pets -----
  async function loadPics(forGid) {
    ready = false; let done = 0;
    const need0 = M.pool.filter(l => !pics.has(key(l)));
    const one = async l => {
      const u = await petPic({ sp: l.sp, lv: lvOf(l), look: l.el ? { el: l.el } : null }, 160);
      const im = new Image(); if (u) { im.src = u; try { await im.decode(); } catch { /* drawn as a dot */ } }
      pics.set(key(l), u ? im : null); done++;
      if (gid === forGid && S?.stage === 'load') banner(L(`Getting the pets ready… ${done}/${need0.length}`, `Przygotowujemy zwierzaki… ${done}/${need0.length}`));
    };
    for (let i = 0; i < need0.length; i += 6) { await Promise.all(need0.slice(i, i + 6).map(one)); if (destroyed || gid !== forGid) return; }
    look = M.pool.map(l => pics.get(key(l)) || null); ready = true; need = true;
    if (playing()) ctx.act({ t: 'rdy' });
    renderWant(); renderBanner();
  }

  // ----- drawing -----
  // The card is the biggest square that fits between the two halves of the players' list, right in the middle
  // (phones and tall windows: above them).
  const rowLayout = () => !matchMedia('(max-aspect-ratio: 5/4)').matches;
  function fit() {
    const m = main.getBoundingClientRect(), [a, b] = lists.map(l => l.getBoundingClientRect()), row = rowLayout(), gap = 12, edge = 8;
    const s = Math.max(120, Math.floor(row ? Math.min(m.width - 2 * (Math.max(a.width, b.width) + gap), m.height) : Math.min(m.width, m.height - Math.max(a.height, b.height) - gap)) - edge);
    if (s !== side || board.style.width !== s + 'px') { side = s; board.style.width = board.style.height = s + 'px'; }
    root.classList.toggle('clocknight', isNight(new Date().getHours() + new Date().getMinutes() / 60));
    dpr = Math.min(3, devicePixelRatio || 1); // full sharpness on every device
    const px = Math.round(side * dpr); if (cv.width !== px) { cv.width = cv.height = px; }
    clamp(); if (S) draw(); else need = true; // straight away: a resized canvas is blank until it is drawn again
    tell3d();
  }
  // the 3D frame sits right behind the card
  // (and where the players' lists are, so the avatars stand clear of them)
  function tell3d() {
    if (!scene) return;
    const r = board.getBoundingClientRect(), c = root.querySelector('.g3d').getBoundingClientRect(), [a, b] = lists.map(l => l.getBoundingClientRect());
    scene.setBoard({ x: r.left - c.left, y: r.top - c.top, size: r.width, row: rowLayout(), l: a.width ? a.left - c.left : r.left - c.left, r: b.width ? b.right - c.left : r.right - c.left });
  }
  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(root.querySelector('.g3d')); tell3d(); if (info) scene.setSeats(info);
  }).catch(err => console.warn('3D unavailable', err));
  const scale = () => side / SIZE * view.s;
  function clamp() { view.s = Math.max(1, Math.min(4, view.s)); const k = scale(); view.x = Math.min(0, Math.max(side - SIZE * k, view.x)); view.y = Math.min(0, Math.max(side - SIZE * k, view.y)); }
  function makeDeco(theme, seed) {
    const r = rng(seed), out = [];
    for (let i = 0; i < 110; i++) out.push([r() * SIZE, r() * SIZE, r(), r()]);
    return { theme, out };
  }
  function ground(theme) {
    const w = winter() && WINTER[theme], C = w || GROUND[theme], gr = g.createLinearGradient(0, 0, 0, SIZE);
    gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]); g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE);
    if (theme === 'beach') { g.fillStyle = C[5]; g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= SIZE; x += 50) g.lineTo(x, 46 + Math.sin(x / 70) * 12); g.lineTo(SIZE, 0); g.fill(); }
    for (const [x, y, a, b] of deco.out) {
      g.fillStyle = C[2 + Math.floor(a * 4)];
      g.beginPath();
      if (theme === 'meadow') { if (a < .5) g.arc(x, y, 4 + b * 3, 0, 7); else g.ellipse(x, y, 12 + b * 10, 6 + b * 4, 0, 0, 7); }
      else if (theme === 'beach') g.ellipse(x, y, 7 + b * 9, 4 + b * 4, a * 3, 0, 7);
      else if (theme === 'snow') g.arc(x, y, 5 + b * 14, 0, 7);
      else g.ellipse(x, y, 16 + b * 14, 9 + b * 7, a * 3, 0, 7);
      g.fill();
    }
    if (isNight(new Date().getHours() + new Date().getMinutes() / 60)) { g.fillStyle = 'rgba(30, 36, 110, .2)'; g.fillRect(0, 0, SIZE, SIZE); } // the real clock's night; pets stay bright
  }
  function drawPet(it) {
    const im = look[it.k];
    g.save(); g.translate(it.x, it.y);
    g.fillStyle = 'rgba(30, 20, 40, .16)'; g.beginPath(); g.ellipse(0, it.s * .36, it.s * .3, it.s * .08, 0, 0, 7); g.fill();
    g.rotate(it.rot); if (it.f) g.scale(-1, 1);
    if (im) g.drawImage(im, -it.s / 2, -it.s / 2, it.s, it.s);
    else { g.fillStyle = '#fff6'; g.beginPath(); g.arc(0, 0, it.s * .3, 0, 7); g.fill(); }
    g.restore();
  }
  function draw() {
    need = false;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const k = scale() * dpr; g.setTransform(k, 0, 0, k, view.x * dpr, view.y * dpr);
    const showing = card && ready && (S.stage === 'find' || S.stage === 'reveal' || S.stage === 'end');
    if (!deco) deco = makeDeco('meadow', S?.seed || 1);
    ground(deco.theme);
    if (!showing) return;
    for (const it of card.items) drawPet(it);
    if (S.stage === 'reveal' || S.stage === 'end') {
      g.fillStyle = 'rgba(16, 12, 40, .42)'; g.fillRect(0, 0, SIZE, SIZE);
      drawPet(card.t);
      g.strokeStyle = '#ffd84a'; g.lineWidth = 7 / view.s; g.beginPath(); g.arc(card.t.x, card.t.y, card.t.s * .58, 0, 7); g.stroke();
      g.strokeStyle = '#3b2219'; g.lineWidth = 2.5 / view.s; g.beginPath(); g.arc(card.t.x, card.t.y, card.t.s * .58 + 5 / view.s, 0, 7); g.stroke();
    }
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!S) return;
    if (anim) {
      const k = Math.min(1, (performance.now() - anim.at) / 650), e = 1 - (1 - k) ** 3;
      view.s = anim.a.s + (anim.b.s - anim.a.s) * e; view.x = anim.a.x + (anim.b.x - anim.a.x) * e; view.y = anim.a.y + (anim.b.y - anim.a.y) * e;
      clamp(); need = true; if (k >= 1) anim = null;
    }
    if (need) draw();
    renderClock();
  }
  function zoomTo(s, cx, cy, smooth = false) { // (cx, cy): the card point to keep in the middle
    const b = { s: Math.max(1, Math.min(4, s)) }, k = side / SIZE * b.s;
    b.x = side / 2 - cx * k; b.y = side / 2 - cy * k;
    if (smooth) anim = { at: performance.now(), a: { ...view }, b }; else { view = b; clamp(); need = true; }
  }
  function zoomAt(f, px, py) { // px, py: a point on the board in CSS px stays put
    const k0 = scale(), qx = (px - view.x) / k0, qy = (py - view.y) / k0;
    view.s = Math.max(1, Math.min(4, view.s * f)); const k = scale();
    view.x = px - qx * k; view.y = py - qy * k; clamp(); need = true; anim = null;
  }

  // ----- HUD -----
  function renderWant() {
    const l = card?.look || (S && M && S.n >= 0 ? M.pool[M.targets[S.n]] : null), show = l && ready && (S.stage === 'find' || S.stage === 'reveal');
    $('sy-want').classList.toggle('empty', !show);
    if (!show) { setHtml($('sy-wname'), S?.stage === 'end' ? L('Done!', 'Koniec!') : '…'); setHtml($('sy-wsub'), ''); $('sy-wimg').removeAttribute('src'); return; }
    const im = pics.get(key(l)); if (im?.src && $('sy-wimg').src !== im.src) $('sy-wimg').src = im.src;
    setHtml($('sy-wname'), esc(lookName(l))); setHtml($('sy-wsub'), esc(lookSub(l)));
  }
  function renderClock() {
    const t = stageT(), bar = $('sy-bar');
    const left = S.stage === 'find' ? Math.max(0, 1 - t / FIND_MS) : S.stage === 'reveal' ? 0 : 1;
    const w = (left * 100).toFixed(1) + '%'; if (bar.style.width !== w) bar.style.width = w;
    const cls = left < .2 ? 'hot' : left < .5 ? 'warm' : ''; if (bar.className !== cls) bar.className = cls;
    if (S.stage === 'count') {
      const n = Math.ceil((COUNT_MS - t) / 1000);
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    }
    const dz = dzUntil - performance.now(), el = $('sy-dizzy');
    if ((dz > 0) === el.hidden) { el.hidden = dz <= 0; root.classList.toggle('dizzy', dz > 0); }
  }
  function renderSeats() {
    const k = info.map(p => p.name + p.color + (p.av || []).join()).join('|');
    if (k !== seatKey) {
      seatKey = k;
      const li = (p, i) => `<li data-s="${i}" class="${i === S.me ? 'me' : ''}">${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<span class="sy-nm"><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}<small></small></span><strong></strong></li>`;
      const half = Math.ceil(info.length / 2); // the first half on the left of the card, the rest on the right
      lists[0].innerHTML = info.slice(0, half).map(li).join(''); lists[1].innerHTML = info.slice(half).map((p, i) => li(p, i + half)).join('');
      lis = [...lists[0].children, ...lists[1].children];
    }
    const top = Math.max(1, ...S.x.map(x => x[0]));
    lis.forEach((li, i) => {
      const x = S.x[i], p = info[i]; if (!x) return;
      setHtml(li.querySelector('strong'), `${x[0] === top && S.ph === 'end' ? I.crown : I.card}<span>${x[0]}</span>`);
      const sub = S.stage === 'load' && p.human && !p.bot && !x[3] ? L('getting ready…', 'przygotowuje się…') : p.bot && p.human ? L('away', 'poza grą') : !p.human ? L('bot', 'bot') : x[0] ? secs(x[1]) : '';
      setHtml(li.querySelector('small'), sub);
      li.classList.toggle('dz', x[2] > 0); li.classList.toggle('lead', x[0] === top && x[0] > 0);
    });
  }
  function banner(msg) { const el = $('sy-banner'); if (el.textContent !== msg) el.textContent = msg; }
  function renderBanner() {
    if (!S) return;
    if (S.ph !== 'play') return banner('');
    if (S.stage === 'load') return banner(ready ? L('Waiting for everyone’s pets…', 'Czekamy na zwierzaki pozostałych…') : L('Getting the pets ready…', 'Przygotowujemy zwierzaki…'));
    if (S.stage === 'count') return banner(L('Find the pet from the top bar!', 'Znajdź zwierzaka z górnego paska!'));
    if (S.me < 0) return banner(L('You are watching', 'Oglądasz grę'));
    if (info[S.me]?.bot) return banner(L('A bot is looking for you', 'Bot szuka za ciebie'));
    banner('');
  }
  function render() {
    $('sy-code').textContent = Rm?.code || '';
    $('sy-no').textContent = S.n >= 0 ? L(`Card ${Math.min(S.n + 1, S.cards)}/${S.cards}`, `Karta ${Math.min(S.n + 1, S.cards)}/${S.cards}`) : L(`${S.cards} cards`, `Karty: ${S.cards}`);
    renderSeats(); renderWant(); renderBanner();
    root.classList.toggle('watching', !playing());
  }
  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('sy-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.classList.add('show'); el.style.setProperty('--ms', ms + 'ms');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function popSeat(s) {
    const li = lis[s]; if (!li) return;
    li.classList.remove('pop'); void li.offsetWidth; li.classList.add('pop');
    // a little card flies from the pet to the finder's row
    const b = board.getBoundingClientRect(), r = li.getBoundingClientRect(), k = scale();
    const f = document.createElement('div'); f.className = 'sy-fly'; f.innerHTML = I.card;
    const x0 = b.left + view.x + card.t.x * k, y0 = b.top + view.y + card.t.y * k;
    f.style.left = x0 + 'px'; f.style.top = y0 + 'px';
    f.style.setProperty('--dx', (r.left + r.width / 2 - x0) + 'px'); f.style.setProperty('--dy', (r.top + r.height / 2 - y0) + 'px');
    root.append(f); setTimeout(() => f.remove(), 900);
  }

  function newCard() {
    card = makeCard(S.seed, S.n, S.cards, M); deco = makeDeco(card.theme, S.seed + S.n * 101);
    view = { s: 1, x: 0, y: 0 }; anim = null; pending = 0; dzUntil = 0; need = true; renderWant();
  }

  function playEv(e) {
    if (e.t === 'count') { sfx.draw(); }
    else if (e.t === 'card') { sfx.turn(); if (e.c > 0) big(L(`Card ${e.c + 1}`, `Karta ${e.c + 1}`), '', 700, 'k1'); }
    else if (e.t === 'dz') { if (e.s === S.me && dzUntil < performance.now() + 200) { dzUntil = performance.now() + DIZZY_MS; sfx.bad(); } }
    else if (e.t === 'f') {
      if (card) zoomTo(Math.max(view.s, 2.2), card.t.x, card.t.y, true);
      if (e.s < 0) { sfx.plop(); big(L('Nobody found it', 'Nikt nie znalazł'), '', 1600, 'k4'); }
      else {
        if (card) popSeat(e.s);
        scene?.cheer(e.s);
        if (e.s === S.me) { sfx.set(); sfx.combo(1); big(L('Found it!', 'Znalezione!'), secs(e.ms), 1600, 'k3'); }
        else { sfx.pop(); big(L(`${nameOf(e.s)} found it!`, `Znajduje: ${nameOf(e.s)}!`), secs(e.ms), 1600, 'k2'); }
      }
    } else if (e.t === 'end') {
      if (e.w === S.me) sfx.win();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; info = s.seats; got = performance.now();
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; card = null; seatKey = ''; dzUntil = 0; pending = 0;
      M = makePool(s.seed, s.cards); deco = makeDeco('meadow', s.seed); look = [];
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      loadPics(gid);
      if (s.ph === 'end') showResults();
    } else if (ready && playing() && S.stage === 'load' && !S.x[S.me][3]) ctx.act({ t: 'rdy' }); // in case the first one got lost
    if (S.n >= 0 && (!card || card.n !== S.n)) newCard();
    if (S.me >= 0 && S.x[S.me][2] > 0) dzUntil = Math.max(dzUntil, performance.now() + S.x[S.me][2] - 40);
    if (S.stage !== 'find') pending = 0;
    render(); need = true; scene?.setSeats(info);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win, solo = info.length === 1;
    const head = solo ? L(`${R.c[0]} of ${R.cards} cards!`, `Karty: ${R.c[0]} z ${R.cards}!`) : w === S.me ? L('You win!', 'Wygrana!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`);
    el.innerHTML = `<div class="sheet">
      <h2>${I.crown}${head}</h2>
      <p>${L('Most cards wins. Equal cards: the quicker total finding time.', 'Wygrywa najwięcej kart. Przy remisie: krótszy łączny czas szukania.')}</p>
      <ol class="sy-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${pbRowCls(p.fl)} ${i === S.me ? 'sy-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${cnt(R.c[i], 'card', 'cards', 'karta', 'karty', 'kart')}</strong><small>${R.c[i] ? `<span class="lab">${L('found in', 'znalezione w')} </span>${secs(R.ms[i])}` : L('no cards', 'bez kart')}</small>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
    if (w === S.me && R.c[w] > 0) confetti();
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

  function react(m) {
    if (!S || !info) return;
    const i = info.findIndex(p => p.id === m.id), li = lis[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = li ? li.getBoundingClientRect() : null;
    const x = r ? r.left + 40 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top : innerHeight * .3;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const c = root.querySelector('.confetti'), x = c.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); c.width = innerWidth * q; c.height = innerHeight * q; x.setTransform(q, 0, 0, q, 0, 0);
    const cols = ['#ff9b54', '#ffe46b', '#9be07a', '#8fd0ff', '#b49bff', '#ffb3d1'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .5 }));
    let t = 0;
    const step = () => {
      x.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
        if (p.round) { x.beginPath(); x.arc(0, 0, p.s / 2, 0, 6.28); x.fill(); } else x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        x.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else c.width = c.height = 0;
    };
    step();
  }

  // ----- input: tap a pet, drag to look around, wheel or pinch to zoom -----
  const pts = new Map(); let moved = 0, pinch0 = 0, s0 = 1, downAt = 0;
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function tap(px, py) {
    if (!S || S.stage !== 'find' || !playing() || !card || !ready) return;
    const now = performance.now(); if (now < dzUntil || now < pending) return;
    const k = scale(), x = (px - view.x) / k, y = (py - view.y) / k;
    if (x < 0 || y < 0 || x > SIZE || y > SIZE) return;
    ctx.act({ t: 'tap', c: S.n, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    if (hits(card, x, y)) { pending = now + 800; sfx.click(); } // the server says whether you were first
    else { dzUntil = now + DIZZY_MS; sfx.bad(); root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); }
  }
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return; e.preventDefault();
    cv.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, local(e)); moved = 0; downAt = performance.now();
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; s0 = view.s; moved = 99; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const [ox, oy] = pts.get(e.pointerId), p = local(e); pts.set(e.pointerId, p);
    if (pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(s0 * d / pinch0 / view.s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
    moved += Math.abs(p[0] - ox) + Math.abs(p[1] - oy);
    if (moved > 8) { view.x += p[0] - ox; view.y += p[1] - oy; anim = null; clamp(); need = true; }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    const n = pts.size, p = local(e); pts.delete(e.pointerId);
    if (n === 1 && moved <= 8 && e.type === 'pointerup') tap(p[0], p[1]);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, p[0], p[1]); }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomAt(1.3, side / 2, side / 2); else if (e.key === '-') zoomAt(1 / 1.3, side / 2, side / 2); else if (e.key === '0') zoomTo(1, SIZE / 2, SIZE / 2); else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => fit()); ro.observe(main); lists.forEach(l => ro.observe(l));

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'zin') zoomAt(1.4, side / 2, side / 2);
    else if (a === 'zout') zoomAt(1 / 1.4, side / 2, side / 2);
    else if (a === 'zfit') { anim = null; view = { s: 1, x: 0, y: 0 }; need = true; }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    b.blur?.();
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });
  fit(); frame();

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); ro.disconnect(); cancelAnimationFrame(raf);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
void REVEAL_MS;
