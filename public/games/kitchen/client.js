// Cozy Kitchen Rush game view: HUD and controls over the 3D kitchen. Your own avatar moves on your screen
// straight away and tells the server where it is; grabbing, chopping and serving go through the server.
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { kitchen, RECIPES, CHOPPABLE, SPEED, T, move, target } from './rules.js';
import { part, dish, tool, sticker } from './icons.js';
import { nameHtml, titleHtml, frameCls } from '../../cosmetics.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  hand: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V11M13 10.5V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14.5a1.6 1.6 0 0 1 2.5-2l1 1.2"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffc93c" stroke="#3b2219" stroke-width="2.2"/><path d="M12 7.5v9" stroke="#3b2219" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const KEYS = { up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'] };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./kitchen.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="kr">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="bars" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="kr-info"></span></div>
      <div class="tr"><span class="tcode" id="kr-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="clock" id="kr-clock" aria-live="off"></div>
      <ol class="orders" id="kr-orders" aria-label="${L(`Orders`, `Zamówienia`)}"></ol>
      <ol class="list" id="kr-list" aria-label="${L(`Cooks`, `Kucharze`)}"></ol>
      <div class="shout" id="kr-big" aria-live="assertive"></div>
      <div class="keys" id="kr-keys">${L(`<b>WASD</b> or arrows to walk · <b>Space</b> grab / put down · <b>E</b> chop`, `<b>WASD</b> lub strzałki: chodzenie · <b>Spacja</b>: weź / odłóż · <b>E</b>: siekaj`)}</div>
      <div class="stick" id="kr-stick" aria-hidden="true"><i></i></div>
      <div class="btns" id="kr-btns">
        <button type="button" class="btn big r kr-chop" data-a="chop" aria-label="${L(`Chop`, `Siekaj`)}">${tool('knife', 26)}<span>${L(`Chop`, `Siekaj`)}</span></button>
        <button type="button" class="btn big kr-use" data-a="use" aria-label="${L(`Grab or put down`, `Weź lub odłóż`)}">${I.hand}<span id="kr-uselbl">${L(`Grab`, `Weź`)}</span></button>
      </div>
    </div>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.kr'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), barsEl = root.querySelector('.bars');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, recvAt = 0, K = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, lastFix = -1, lastSent = 0, sentKey = '', countN = -1;
  let local = null, tgt = null, joy = { on: false, id: null, x: 0, y: 0, ox: 0, oy: 0 }, touch = matchMedia('(pointer: coarse)').matches;
  const held = new Set();
  root.classList.toggle('touch', touch);

  function loadScene(mapId) {
    if (scene || destroyed) return;
    import('./scene3d.js').then(m => {
      if (destroyed || scene) return;
      scene = m.createScene(canvas, { mapId, step, onFrame });
      if (S) sync();
    }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });
  }

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? L('You', 'Ty') : nameOf(i));
  const canMove = () => S && S.ph === 'play' && me() && !me().bot;

  function sync() {
    if (!scene || !S) return;
    scene.setSeats(S.seats, S.me);
    scene.setState(S);
  }

  // ----- moving your own cook -----
  function inputDir() {
    let x = 0, y = 0;
    for (const k of held) { if (KEYS.up.includes(k)) y += 1; if (KEYS.down.includes(k)) y -= 1; if (KEYS.left.includes(k)) x -= 1; if (KEYS.right.includes(k)) x += 1; }
    if (joy.on) { x += joy.x; y += joy.y; }
    const l = Math.hypot(x, y);
    return l > 1 ? [x / l, y / l] : [x, y];
  }
  function step(dt) {
    if (!canMove() || !K) { local = null; tgt = null; scene?.setTarget(null); return null; }
    const sp = S.pl[S.me];
    if (!local || sp.fix !== lastFix) { local = { x: sp.x, z: sp.z, f: sp.f }; lastFix = sp.fix; }
    const [ix, iy] = inputDir(), c = scene.controls();
    if (ix || iy) {
      const wx = ix * c.right[0] + iy * c.fwd[0], wz = ix * c.right[1] + iy * c.fwd[1], l = Math.hypot(wx, wz);
      [local.x, local.z] = move(K, local.x, local.z, wx * SPEED * dt, wz * SPEED * dt);
      if (l > .2) local.f = Math.atan2(wx, wz);
    }
    tgt = target(K, local.x, local.z, local.f);
    scene.setTarget(tgt?.key || null);
    const now = performance.now(), key = local.x.toFixed(2) + local.z.toFixed(2) + local.f.toFixed(2);
    if (key !== sentKey && now - lastSent > 100) { sentKey = key; lastSent = now; ctx.act({ t: 'mv', x: +local.x.toFixed(3), z: +local.z.toFixed(3), f: +local.f.toFixed(3) }); }
    return local;
  }
  const where = () => ({ x: +local.x.toFixed(3), z: +local.z.toFixed(3), f: +local.f.toFixed(3) });
  function doUse() {
    if (!canMove() || S.stage !== 'cook' || !local || !tgt) return;
    sfx.pop(); ctx.act({ t: 'use', c: tgt.c, r: tgt.r, ...where() });
  }
  function doChop() {
    if (!canMove() || S.stage !== 'cook' || !local || !tgt) return;
    sfx.click(); ctx.act({ t: 'chop', c: tgt.c, r: tgt.r, ...where() });
  }
  // what the big button would do right now
  function useLabel() {
    if (!S || !tgt || !K) return L('Grab', 'Weź');
    const k = K.t[tgt.r][tgt.c], h = S.pl[S.me]?.hold, it = S.cells[tgt.key]?.item;
    if (k === 'W') return h?.k === 'plate' ? L('Serve', 'Podaj') : L('Grab', 'Weź');
    if (k === 'X') return L('Bin it', 'Wyrzuć');
    if (k === 'S') return h?.k === 'plate' ? L('Ladle', 'Nalej') : h ? L('Into pot', 'Do garnka') : L('Grab', 'Weź');
    if (h && it && (h.k === 'plate' || it.k === 'plate')) return L('Plate it', 'Na talerz');
    return h ? L('Put down', 'Odłóż') : L('Grab', 'Weź');
  }
  const canChop = () => {
    if (!S || !tgt || !K || K.t[tgt.r][tgt.c] !== 'C' || S.pl[S.me]?.hold) return false;
    const it = S.cells[tgt.key]?.item; return !!it && CHOPPABLE.has(it.k) && !it.ch;
  };

  // ----- each frame -----
  let barEls = [], lblEls = [];
  function onFrame(info) {
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    while (barEls.length < info.bars.length) { const d = document.createElement('div'); d.className = 'kr-bar'; d.innerHTML = '<i></i>'; barsEl.append(d); barEls.push(d); }
    barEls.forEach((el, i) => {
      const b = info.bars[i];
      if (!b) { if (!el.hidden) el.hidden = true; return; }
      el.hidden = false;
      if (el._k !== b.kind) { el._k = b.kind; el.className = 'kr-bar ' + b.kind; }
      el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.firstChild.style.width = `${Math.round(b.p * 100)}%`;
    });
    while (lblEls.length < info.labels.length) { const d = document.createElement('div'); d.className = 'kr-lbl'; barsEl.prepend(d); lblEls.push(d); }
    lblEls.forEach((el, i) => {
      const b = info.labels[i];
      if (!b) { if (!el.hidden) el.hidden = true; return; }
      el.hidden = false;
      const key = b.crate ? 'c' + b.it.k : JSON.stringify([b.it.k, b.it.ch, b.it.k === 'patty' ? (b.it.ck >= T.pattyBurn ? 2 : b.it.ck >= 1 ? 1 : 0) : 0, b.it.has, b.it.soup]);
      if (el._k !== key) { el._k = key; const s = b.crate ? { icons: [part(b.it.k, 26)], cls: 'crate' } : sticker(b.it, T); el.className = 'kr-lbl ' + s.cls; el.innerHTML = s.icons.join(''); }
      el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) translate(-50%, -100%)`;
    });
    const lbl = useLabel(), el = $('kr-uselbl'); if (el.textContent !== lbl) el.textContent = lbl;
    const cb = root.querySelector('.kr-chop'), on = canChop(); if (cb.classList.contains('on') !== on) cb.classList.toggle('on', on);
  }

  // ----- HUD -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="kr-tag${i === S.me ? ' kr-you' : ''}" hidden><i style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b>${titleHtml(p.fl)}</div>`).join('');
      tagEls = [...tagsEl.children];
    }
  }
  function renderList() {
    const ord = S.seats.map((_, i) => i).sort((a, b) => S.seats[b].pts - S.seats[a].pts || a - b);
    setHtml($('kr-list'), ord.map(i => {
      const p = S.seats[i];
      return `<li class="${i === S.me ? 'me' : ''}">${avatarHtml(p.color, p.av, 28)}<b>${nameHtml(p.name, p.fl)}${p.bot && p.human ? L(' (away)', ' (poza grą)') : ''}</b><span>${p.pts}</span></li>`;
    }).join(''));
  }
  function ticket(o) {
    const r = RECIPES[o.r], parts = r.soup ? [r.soup, r.soup, r.soup] : r.has;
    const steps = parts.map(k => `<span class="pt">${part(k)}${CHOPPABLE.has(k) ? tool('knife') : ''}${k === 'patty' ? tool('pan') : ''}</span>`).join('');
    return `<li data-id="${o.id}"><div class="dish">${dish(o.r)}</div><div class="tk"><b>${r.name}</b><div class="parts">${steps}${r.soup ? tool('pot', 16) : ''}</div></div><div class="pat"><i></i></div></li>`;
  }
  function renderOrders() {
    const el = $('kr-orders'), ids = S.orders.map(o => o.id).join();
    if (el._ids !== ids) {
      el._ids = ids;
      const have = new Map([...el.children].map(li => [li.dataset.id, li]));
      const frag = S.orders.map(o => have.get(String(o.id)) || Object.assign(document.createElement('template'), { innerHTML: ticket(o) }).content.firstChild);
      el.replaceChildren(...frag);
    }
    paintOrders();
  }
  function paintOrders() {
    if (!S) return;
    const el = $('kr-orders'), ago = performance.now() - recvAt;
    S.orders.forEach((o, i) => {
      const li = el.children[i]; if (!li) return;
      const k = Math.max(0, (o.left - (S.stage === 'cook' ? ago : 0)) / o.life);
      li.querySelector('.pat i').style.width = `${(k * 100).toFixed(1)}%`;
      li.classList.toggle('late', k < .3); li.classList.toggle('warn', k >= .3 && k < .55);
    });
  }
  function paintClock() {
    if (!S) return;
    const ago = performance.now() - recvAt, left = Math.max(0, S.left - (S.ph === 'play' ? ago : 0));
    const g = S.goals, max = g[2] * 1.08, stars = g.filter(v => S.tips >= v).length;
    setHtml($('kr-clock'), `<span class="time${left < 20000 && S.ph === 'play' ? ' low' : ''}">${mmss(S.stage === 'count' ? S.time * 1000 : left)}</span>
      <span class="tips"><b>${S.tips}</b><small>${L('tips', 'napiwki')}</small></span>
      <span class="meter"><i style="width:${Math.min(100, S.tips / max * 100).toFixed(1)}%"></i>${g.map((v, i) => `<em class="${i < stars ? 'got' : ''}" style="left:${(v / max * 100).toFixed(1)}%">${I.star}</em>`).join('')}</span>`);
  }
  function render() {
    if (!S) return;
    $('kr-info').textContent = K ? K.name : '';
    $('kr-code').textContent = Rm?.code || '';
    buildTags(); renderList(); renderOrders(); paintClock();
    const playing = canMove();
    $('kr-btns').hidden = !playing; $('kr-stick').hidden = !playing; $('kr-keys').hidden = !playing || touch;
  }

  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('kr-big');
    el.className = 'shout ' + cls;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    scene?.cue(e);
    if (e.t === 'go') { sfx.win(); big(L('Cook!', 'Gotuj!'), L('Orders are coming in', 'Nadchodzą zamówienia'), 1300); }
    else if (e.t === 'order') { sfx.draw(); }
    else if (e.t === 'serve') { sfx.set(); big(`+${e.tip}`, L(`${youOr(e.s)} served ${RECIPES[e.r].name.toLowerCase()}`, `${e.s === S.me ? 'Podajesz' : nameOf(e.s) + ' podaje'}: ${RECIPES[e.r].name.toLowerCase()}`), 1300, 'good'); }
    else if (e.t === 'miss') { sfx.lose(); big(L('Missed!', 'Przepadło!'), L(`A ${RECIPES[e.r].name.toLowerCase()} order ran out · −10 tips`, `Zamówienie przepadło: ${RECIPES[e.r].name.toLowerCase()} · −10 napiwków`), 1600, 'bad'); }
    else if (e.t === 'burn') { sfx.bad(); big(L('Burnt!', 'Spalone!'), L('Take it to the bin', 'Zanieś to do kosza'), 1300, 'bad'); }
    else if (e.t === 'ready') sfx.join();
    else if (e.t === 'chopped') { if (e.s === S.me) sfx.place(); }
    else if (e.t === 'bin') { if (e.s === S.me) sfx.plop(); }
    else if (e.t === 'wrong') { if (e.s === S.me) { sfx.bad(); big(L('Nobody ordered that', 'Nikt tego nie zamawiał'), L('Check the tickets', 'Sprawdź zamówienia'), 1200, 'bad'); } }
    else if (e.t === 'sit') { sfx.join(); ctx.toast(e.s === S.me ? L('You took over a cook. Get going!', 'Przejmujesz kucharza. Do dzieła!') : L(`${nameOf(e.s)} joined the kitchen`, `${nameOf(e.s)} dołącza do kuchni`)); }
    else if (e.t === 'end') { if (e.stars >= 2) sfx.win(); else sfx.lose(); clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2600); big(e.stars ? `${'★'.repeat(e.stars)}` : L('Time!', 'Koniec czasu!'), L('Kitchen closed', 'Kuchnia zamknięta'), 2400); }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid;
    S = s; recvAt = performance.now();
    if (!K || K.id !== s.map) K = kitchen(s.map);
    loadScene(s.map);
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); local = null; lastFix = -1; countN = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    if (s.stage === 'count') { const n = Math.ceil(s.count / 1000); if (n !== countN && n > 0) { countN = n; sfx.tick(); big(String(n), n === 3 ? L('Get ready to cook', 'Przygotuj się do gotowania') : '', 900); } }
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, n = S.seats.length;
    const myPlace = S.me >= 0 ? R.order.indexOf(S.me) + 1 : 0;
    const head = R.stars === 3 ? L('Three-star kitchen!', 'Kuchnia na trzy gwiazdki!') : R.stars === 2 ? L('Lovely shift!', 'Świetna zmiana!') : R.stars === 1 ? L('Doors open, customers fed', 'Lokal otwarty, goście najedzeni') : L('Rough shift…', 'Ciężka zmiana…');
    el.innerHTML = `<div class="sheet">
      <div class="kr-stars">${[0, 1, 2].map(i => `<span class="${i < R.stars ? 'got' : ''}" style="animation-delay:${i * 220}ms">${I.star}</span>`).join('')}</div>
      <h2>${head}</h2>
      <p>${L(`The kitchen earned <b>${R.tips} tips</b> from ${R.served} dish${R.served === 1 ? '' : 'es'}${R.missed ? `, and ${R.missed} order${R.missed === 1 ? '' : 's'} ran out` : ''}.`, `Kuchnia zarobiła <b>${cnt(R.tips, 'tip', 'tips', 'napiwek', 'napiwki', 'napiwków')}</b> za ${cnt(R.served, 'dish', 'dishes', 'danie', 'dania', 'dań')}${R.missed ? `, a ${cnt(R.missed, 'order', 'orders', 'zamówienie przepadło', 'zamówienia przepadły', 'zamówień przepadło')}` : ''}.`)} ${myPlace && S.seats[S.me].pts > 0 ? (myPlace === 1 ? L('You were the star cook!', 'Jesteś gwiazdą kuchni!') : L(`You came ${ORD(myPlace)} for tips earned.`, `Twoje miejsce pod względem napiwków: ${myPlace}.`)) : ''}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${k === 0 && p.pts > 0 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${k + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${st.dishes} dish${st.dishes === 1 ? '' : 'es'} helped · ${st.chopped} chopped · ${st.served} served`, `udział w daniach: ${st.dishes} · posiekane: ${st.chopped} · podane: ${st.served}`)}</span></div>
          <strong>${p.pts}<small>${L('tips', 'napiwki')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>
      <p class="fine">${L(`Each dish's tip is shared by everyone who had a hand in it. Coins go by those shares.`, `Napiwek za każde danie dzielą między siebie wszyscy, którzy przy nim pomagali. Monety zależą od tych udziałów.`)}</p>
      <div class="againbox">${againHtml(ctx, Rm, L('Cook again', 'Gotuj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    paintPaid(root.querySelector('.results'), Rm);
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, L('Cook again', 'Gotuj jeszcze raz'));
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  function react(m) {
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), el = tagEls[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = el && !el.hidden ? el.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.top - 40 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  const timer = setInterval(() => {
    if (!S) return;
    paintClock(); paintOrders();
    if (S.ph === 'play' && S.stage === 'cook') {
      const left = S.left - (performance.now() - recvAt), n = Math.ceil(left / 1000);
      if (n <= 10 && n > 0 && n !== countN) { countN = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  const typing = e => e.target.closest?.('input, textarea, select, [contenteditable]');
  const onKey = e => {
    if (typing(e)) return;
    const k = e.key.toLowerCase();
    if (Object.values(KEYS).some(a => a.includes(k))) { held.add(k); e.preventDefault(); if (touch) { touch = false; root.classList.remove('touch'); render(); } return; }
    if (e.repeat) return;
    if (k === ' ' || k === 'j' || k === 'enter') { if (canMove()) { e.preventDefault(); doUse(); } }
    else if (k === 'e' || k === 'k' || k === 'shift') { if (canMove()) { e.preventDefault(); doChop(); } }
  };
  const onKeyUp = e => held.delete(e.key.toLowerCase());
  const onBlur = () => held.clear();
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);

  // a floating joystick: touch anywhere on the left part of the screen and drag
  const stick = $('kr-stick'), knob = stick.querySelector('i'), R = 52;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || !canMove() || joy.on) return;
    if (!touch) { touch = true; root.classList.add('touch'); render(); }
    joy = { on: true, id: e.pointerId, x: 0, y: 0, ox: e.clientX, oy: e.clientY };
    stick.style.left = `${e.clientX / uiz()}px`; stick.style.top = `${e.clientY / uiz()}px`; // inside the (zoomed) HUD stick.classList.add('live');
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!joy.on || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    joy.x = Math.abs(dx) < 6 && Math.abs(dy) < 6 ? 0 : dx / R; joy.y = Math.abs(dx) < 6 && Math.abs(dy) < 6 ? 0 : -dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endJoy = e => { if (e.pointerId !== joy.id) return; joy = { on: false, id: null, x: 0, y: 0 }; knob.style.transform = ''; stick.classList.remove('live'); };
  canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);

  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-a="use"], [data-a="chop"]'); if (!b) return;
    e.preventDefault(); if (b.dataset.a === 'use') doUse(); else doChop();
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'use' || a === 'chop') { if (e.detail === 0) (a === 'use' ? doUse : doChop)(); } // keyboard press on the button; taps went through pointerdown
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.round, .results .btn');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose();
    },
  };
}
