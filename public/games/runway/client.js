// Sky Runway game view: the theme card, the fitting room, the stars for each walk, the round's podium and the final
// table with "Keep this look". Renders what the server sends; your look is kept here and sent as you change it.
import { myBurst, seatBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, ord } from '../../i18n.js';
import { avatarHtml, OPT, AV_KEYS, AV_COLOR_KEYS, needsOwning, packOf, priceOf, seasonOf, cleanAv } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, COS, EMOTE_ICO } from '../../cosmetics.js';
import { themeName, twistName, FREE_KEYS, POSES, poseName, TOP_COLS, WRITE_MAX, cleanTheme, EMOTE_POSE } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
// the fitting room's tabs: label (EN, PL) and the avatar slot
const TABS = [['top', 'Top', 'Góra'], ['tc', 'Top colour', 'Kolor góry'], ['bottom', 'Bottom', 'Dół'], ['botC', 'Bottom colour', 'Kolor dołu'], ['shoes', 'Shoes', 'Buty'], ['shoeC', 'Shoe colour', 'Kolor butów'],
  ['hat', 'Hat', 'Czapka'], ['glasses', 'Glasses', 'Okulary'], ['neck', 'Neck', 'Szyja'], ['back', 'Back', 'Plecy'], ['hand', 'In hand', 'W dłoni'],
  ['hair', 'Hair', 'Fryzura'], ['hairC', 'Hair colour', 'Kolor włosów'], ['facial', 'Beard', 'Zarost'], ['marks', 'Face marks', 'Znaki na twarzy']];
const IX = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));
const SEASON_ICO = { winter: '❄', summer: '☀', spring: '✿', halloween: '🎃', autumn: '🍂' };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./runway.css', import.meta.url).href; document.head.append(l);
}
let IP = null; // itempic.js, loaded with the 3D scene
const stars = (n, of = 5) => `<span class="rw-st" aria-label="${n} / ${of}">${'★'.repeat(Math.round(n))}<i>${'★'.repeat(of - Math.round(n))}</i></span>`;

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="rw">
    <canvas class="g3d" aria-label="${L('The runway on a sky island', 'Wybieg na podniebnej wyspie')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="rw-info"></span></div>
      <div class="tr"><span class="tcode" id="rw-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="shout" id="rw-big" aria-live="assertive"></div>
      <section class="rw-card rw-pick" id="rw-pick" hidden>
        <div class="rw-whead"><b id="rw-ptitle"></b><span class="rw-wsec"></span></div>
        <div class="rw-plist" id="rw-plist" role="group"></div>
        <form class="rw-pwrite" id="rw-pwrite" autocomplete="off"><input type="text" maxlength="${WRITE_MAX}" autocomplete="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="send" placeholder="${L('Or write your own theme…', 'Albo wpisz własny temat…')}" aria-label="${L('Your own theme', 'Własny temat')}"><button type="submit" class="btn sm m">${L('Add', 'Dodaj')}</button></form>
        <p class="rw-hint" id="rw-phint"></p>
      </section>
      <section class="rw-card rw-theme" id="rw-theme" hidden></section>
      <section class="rw-card rw-dress" id="rw-dress" hidden>
        <div class="rw-dhead"><div class="rw-dtx"><b id="rw-dtitle"></b><span id="rw-dsub"></span></div><div class="rw-clock"><div class="rw-bar"><i></i></div><span class="rw-sec"></span></div></div>
        <div class="rw-body"><div class="rw-tabs" id="rw-tabs" role="tablist" aria-orientation="vertical"></div>
        <div class="rw-grid" id="rw-grid"></div></div>
        <div class="rw-poses" id="rw-poses"></div>
        <div class="rw-dfoot"><div class="rw-ready" id="rw-ready"></div>
          <div class="rw-dbtns"><button type="button" class="btn sm w" data-a="rand">${L('Surprise me', 'Zaskocz mnie')}</button><button type="button" class="btn sm w" data-a="mine">${L('My clothes', 'Moje ubrania')}</button>
          <button type="button" class="btn big m rw-go" data-a="ready"></button></div></div>
      </section>
      <section class="rw-card rw-walk" id="rw-walk" hidden></section>
      <section class="rw-card rw-reveal" id="rw-reveal" hidden></section>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.rw'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let lastPanel = '', resultsTimer = 0, bigTimer = 0, sendTimer = 0, deadline = 0, stageKey = '', tab = 'top', look = null, myTc = '', lookKey = '', gridKey = '', picJob = 0, sentKey = '', myPose = 0;

  Promise.all([import('./scene3d.js'), import('../../itempic.js')]).then(([m, ip]) => {
    if (destroyed) return;
    IP = ip; scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); gridKey = ''; renderDress(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const wide = () => innerWidth >= 760 && innerWidth / innerHeight > 1.15;
  const dressing = () => S.ph === 'play' && (S.stage === 'theme' || S.stage === 'dress');
  const secLeft = () => Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  const owned = () => ctx.owned?.() || [];
  const loaned = (k, i) => needsOwning(k, i) && !owned().includes(k + ':' + i);

  // ----- name tags over the walker and the judges -----
  let tagEls = new Map();
  function onFrame(info) {
    const seen = new Set();
    for (const t of info.tags) {
      const key = t.kind + t.i; seen.add(key);
      let el = tagEls.get(key);
      if (!el) { el = document.createElement('div'); el.className = 'rw-tag'; tagsEl.append(el); tagEls.set(key, el); }
      const p = S.seats[t.i], name = t.kind === 'walk' && t.i === -2 ? '???' : p ? (t.i === S.me ? L('You', 'Ty') : nameHtml(p.name, p.fl)) : '';
      const vote = t.kind === 'judge' && S.stage === 'walk' && t.i === S.me && S.myVote ? `<em>${'★'.repeat(S.myVote)}</em>` : '';
      setHtml(el, t.kind === 'pod' ? `<div class="plate gold"><b>${name}</b></div>` : `<div class="plate${t.kind === 'walk' ? ' now' : ''}">${p ? `<i class="dot" style="background:${esc(p.color)}"></i>` : ''}<b>${name}</b>${vote}</div>`);
      el.hidden = !t.on || (t.kind === 'me');
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${Math.max(t.y, (innerWidth < 700 ? 140 : 100) * uiz()).toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [k, el] of tagEls) if (!seen.has(k)) { el.remove(); tagEls.delete(k); }
  }
  function layout() {
    root.classList.toggle('wide', wide());
    if (!scene) return;
    const dress = $('rw-dress'), panel = [dress, $('rw-walk'), $('rw-reveal'), $('rw-theme'), $('rw-pick')].find(x => !x.hidden);
    const force = (panel?.id || '') !== lastPanel; lastPanel = panel?.id || '';
    if (wide() && panel === dress) { scene.setInset((dress.offsetWidth + 28) * uiz(), force); scene.setHud(0, force); }
    else { scene.setInset(0, force); scene.setHud(panel ? (panel.offsetHeight + 24) * uiz() : 0, force); }
  }

  // ----- the clock in the fitting room -----
  function paintClock() {
    if (!S) return;
    const el = root.querySelector('.rw-sec'); if (!el) return;
    const s = secLeft(), txt = s >= 60 ? `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}` : `${s} s`;
    if (el.textContent !== txt) el.textContent = txt;
    const hurry = S.stage === 'dress' && s <= 10; el.classList.toggle('hurry', hurry);
    if (hurry && el._s !== s && s > 0 && s <= 5 && S.me >= 0) sfx.tick();
    el._s = s;
    for (const ws of root.querySelectorAll('.rw-wsec')) { const t = `${secLeft()} s`; if (ws.textContent !== t) ws.textContent = t; }
  }
  const clockTimer = setInterval(paintClock, 200);
  function barAnim(el, key) {
    if (!el || el._k === key) return; el._k = key;
    const done = Math.max(0, S.all - S.left); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = `rwbar ${S.all}ms linear ${-done}ms both`;
  }

  // ----- the theme vote: 3 random themes and the written ones -----
  function renderPick() {
    const el = $('rw-pick'), on = S.ph === 'play' && S.stage === 'pick';
    el.hidden = !on; if (!on) return;
    const can = S.me >= 0 && !me().bot;
    setHtml($('rw-ptitle'), `${L('Round', 'Runda')} ${S.round + 1}/${S.rounds} · ${L('pick the theme', 'wybierz temat')}`);
    setHtml($('rw-plist'), S.picks.map((p, k) => `<button type="button" class="rw-pk${k === S.myPick ? ' on' : ''}${p.th[0] === '*' ? ' own' : ''}" data-pk="${k}"${!can || p.mine ? ' disabled' : ''} aria-pressed="${k === S.myPick}">
      <b>${p.th[0] === '*' ? '✎ ' : ''}${esc(themeName(p.th))}</b>${p.mine ? `<small>${L('yours', 'twój')}</small>` : ''}<span class="rw-pn">${p.n ? '●'.repeat(Math.min(8, p.n)) : ''}</span></button>`).join(''));
    const form = $('rw-pwrite'); form.hidden = !can || S.wrote || S.picks.length >= 11;
    setHtml($('rw-phint'), !can ? L('Watching the vote', 'Oglądasz głosowanie')
      : S.myPick < 0 ? L('Tap the theme you want. Most votes wins, a tie is drawn.', 'Dotknij tematu, który chcesz. Wygrywa najwięcej głosów, remis rozstrzyga losowanie.')
      : L(`Voted: ${S.nPicked} of ${S.seats.filter(x => x.human && !x.bot).length} · tap another to change`, `Zagłosowało: ${S.nPicked} z ${S.seats.filter(x => x.human && !x.bot).length} · możesz zmienić`));
    paintClock();
  }

  // ----- the theme card -----
  function renderTheme() {
    const el = $('rw-theme'); el.hidden = !(S.ph === 'play' && S.stage === 'theme');
    if (el.hidden) return;
    setHtml(el, `<small>${L('Round', 'Runda')} ${S.round + 1}/${S.rounds} · ${S.theme[0] === '*' ? L('a written theme won', 'wygrał wpisany temat') : L('the theme is', 'temat to')}</small><h2>${esc(themeName(S.theme))}</h2>${S.twist ? `<span class="rw-twist">${esc(twistName(S.twist))}</span>` : ''}
      <p>${L(`Dress up in ${S.opts.time} seconds. Everything in the shop is on loan for the show.`, `Masz ${S.opts.time} sekund na przebranie. Wszystko ze sklepu możesz pożyczyć na pokaz.`)}</p>`);
  }

  // ----- the fitting room -----
  function tilePic(k, i) {
    if (!IP || !S || S.me < 0) return '';
    const a = look.slice();
    if (k !== 'hand') a[IX.hand] = 0; if (k !== 'back') a[IX.back] = 0; // a held item or a back piece would cover the clothes in a small picture
    return IP.itemPic(k, i, myTc || me().color, a);
  }
  function renderDress() {
    const el = $('rw-dress'), on = dressing() && S.me >= 0;
    el.hidden = !on || S.stage === 'theme'; // the theme card first, then the rack
    if (!on) return;
    root.classList.toggle('rw-ready-on', !!S.ready[S.me]);
    setHtml($('rw-dtitle'), esc(themeName(S.theme)));
    setHtml($('rw-dsub'), S.twist ? esc(twistName(S.twist)) : S.stage === 'theme' ? L('Get ready…', 'Przygotuj się…') : L('Tap a piece to put it on', 'Dotknij rzeczy, żeby ją założyć'));
    barAnim(el.querySelector('.rw-bar i'), S.gid + S.round + S.stage);
    setHtml($('rw-tabs'), TABS.map(([k, en, pl]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${L(en, pl)}</button>`).join(''));
    setHtml($('rw-poses'), `<b>${L('Pose', 'Poza')}</b>${POSES.map((_, p) => `<button type="button" data-pose="${p}" aria-pressed="${p === myPose}">${esc(poseName(p))}</button>`).join('')}${(S.myEm || []).map(e => { const p = EMOTE_POSE + e, n = COS.em.items[e]?.n || ''; // your own Plaza emotes, as small icon buttons
      return `<button type="button" class="emo" data-pose="${p}" aria-pressed="${p === myPose}" title="${esc(n)}" aria-label="${esc(n)}">${EMOTE_ICO[e] || '✨'}</button>`; }).join('')}`);
    const here = S.seats.map((x, i) => i).filter(i => S.seats[i].human && !S.seats[i].bot), rdy = here.filter(i => S.ready[i]).length;
    setHtml($('rw-ready'), `<span>${L(`Ready: ${rdy} of ${here.length}`, `Gotowi: ${rdy} z ${here.length}`)}</span>${S.seats.map((p, i) => `<i class="dot${S.ready[i] ? ' ok' : ''}" style="background:${esc(p.color)}" title="${esc(p.name)}"></i>`).join('')}`);
    const go = el.querySelector('.rw-go'), r = !!S.ready[S.me];
    go.setAttribute('aria-pressed', r); go.disabled = S.stage !== 'dress';
    setHtml(go, r ? `${I.ok} ${L('Ready', 'Gotowe')}` : L('Ready', 'Gotowe'));
    paintGrid();
  }
  function paintGrid() {
    const grid = $('rw-grid');
    if (tab === 'tc') { // the top colour: the Wardrobe's colours (your seat colour first, when it is not one of them)
      const cols = topCols(), key = 'tc/' + cols.join();
      if (key !== gridKey) { gridKey = key; ++picJob; grid.classList.add('sw'); grid.innerHTML = cols.map((c, i) => `<button type="button" class="rw-sw" data-i="${i}" style="--c:${esc(c)}" aria-label="${esc(c)}"></button>`).join(''); }
      for (const b of grid.children) b.setAttribute('aria-pressed', cols[+b.dataset.i] === myTc);
      return;
    }
    const n = OPT[tab].length, key = tab + '/' + S.gid + '/' + (IP ? 1 : 0) + '/' + myTc + '/' + (AV_COLOR_KEYS.includes(tab) ? '' : look.map((v, i) => (AV_KEYS[i] === tab ? '' : v)).join('.'));
    const cur = look[IX[tab]];
    if (key !== gridKey) {
      gridKey = key; const job = ++picJob, swatch = AV_COLOR_KEYS.includes(tab);
      grid.classList.toggle('sw', swatch);
      grid.innerHTML = Array.from({ length: n }, (_, i) => {
        const pk = packOf(tab, i), lo = loaned(tab, i), se = seasonOf(tab, i), nm = OPT[tab][i];
        return swatch ? `<button type="button" class="rw-sw" data-i="${i}" style="--c:${esc(nm)}" aria-label="${esc(nm)}"></button>`
          : `<button type="button" class="rw-tile" data-i="${i}"><img alt=""><span class="nm">${esc(nm)}</span>${pk ? `<span class="tag heart" title="${L('Supporter pack', 'Pakiet wspierających')}">♥</span>` : lo ? `<span class="tag loan">${L('loan', 'pożycz.')}</span>` : ''}${se ? `<span class="tag season">${SEASON_ICO[se] || ''}</span>` : ''}</button>`;
      }).join('');
      if (!swatch && IP) { let i = 0; const step = () => { if (job !== picJob || destroyed) return; const t0 = performance.now(); while (i < n && performance.now() - t0 < 18) { const im = grid.children[i]?.querySelector('img'); if (im) im.src = tilePic(tab, i); i++; } if (i < n) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    }
    for (const b of grid.children) b.setAttribute('aria-pressed', +b.dataset.i === cur);
  }
  const topCols = () => (me() && !TOP_COLS.includes(me().color) ? [me().color, ...TOP_COLS] : TOP_COLS);
  function setPart(k, i) {
    if (k === 'tc') { const c = topCols()[i]; if (!c || c === myTc) return; myTc = c; sfx.place(); sendSoon(); renderDress(); return; }
    if (!look || look[IX[k]] === i) return;
    look[IX[k]] = i; sfx.place(); sendSoon(); renderDress();
  }
  function flush() {
    clearTimeout(sendTimer); sendTimer = 0;
    if (!S || S.me < 0 || !dressing()) return;
    const k = S.gid + '/' + look.join('.') + myTc; if (k === sentKey) return;
    sentKey = k; ctx.act({ t: 'look', av: look.slice(), tc: myTc });
  }
  const sendSoon = () => { if (!sendTimer) sendTimer = setTimeout(flush, 180); };

  // ----- the runway: who walks, the stars -----
  function renderWalk() {
    const el = $('rw-walk'), on = S.ph === 'play' && S.stage === 'walk';
    el.hidden = !on; if (!on) return;
    const mine = S.walker === S.me, judge = S.me >= 0 && !mine && !me().bot;
    const who = mine ? L('Your walk! Strike a pose.', 'Twój wybieg! Pozuj.') : S.walker === -2 ? L('A mystery look is on the runway', 'Na wybiegu tajemniczy strój') : L(`${nameOf(S.walker)} is on the runway`, `${nameOf(S.walker)} na wybiegu`);
    const dots = S.order.map((s, k) => `<i class="qd${k < S.walk ? ' done' : k === S.walk ? ' now' : ''}"${S.opts.names === 'secret' && k >= S.walk && s !== S.me ? '' : ` style="--c:${esc(S.seats[s].color)}"`}></i>`).join('');
    setHtml(el, `<div class="rw-whead"><b>${who}</b><span class="rw-wsec"></span></div><div class="rw-queue">${dots}</div>
      ${judge ? `<div class="rw-stars" role="group" aria-label="${L('Your stars', 'Twoje gwiazdki')}">${[1, 2, 3, 4, 5].map(v => `<button type="button" data-v="${v}" class="${v <= S.myVote ? 'on' : ''}" aria-label="${v}">${I.star}</button>`).join('')}</div>`
        : `<p class="rw-hint">${mine ? L(`The judges are voting: ${S.nVotes} of ${S.judges}`, `Sędziowie głosują: ${S.nVotes} z ${S.judges}`) : L('Watching the show', 'Oglądasz pokaz')}</p>`}
      ${judge ? `<p class="rw-hint">${S.myVote ? L(`You gave ${S.myVote} ★ · tap again to change`, `Dajesz ${S.myVote} ★ · możesz zmienić`) : L('Tap the stars: 1 to 5', 'Dotknij gwiazdek: od 1 do 5')}</p>` : ''}`);
    paintClock();
  }

  // ----- the round's podium -----
  function renderReveal() {
    const el = $('rw-reveal'), on = S.ph === 'play' && S.stage === 'reveal' && S.last;
    el.hidden = !on; if (!on) return;
    let order = S.seats.map((_, i) => i).filter(i => S.last[i]).sort((a, b) => S.last[b].pts - S.last[a].pts || S.last[b].fives - S.last[a].fives);
    if (!wide() && order.length > 4) order = order.filter((i, k) => k < 3 || i === S.me);
    setHtml(el, `<h3>${esc(themeName(S.theme))}</h3><ol class="rw-rank">${order.map((i, k) => { const l = S.last[i]; return `<li class="${k === 0 ? 'top' : ''}${i === S.me ? ' mine' : ''}"><i class="dot" style="background:${esc(S.seats[i].color)}"></i><b>${i === S.me ? L('You', 'Ty') : nameHtml(S.seats[i].name, S.seats[i].fl)}</b>${stars(l.avg)}<span class="avg">${l.n ? l.avg.toFixed(1) : '–'}</span><em>+${l.pts}</em><span class="tot">${S.tot[i]}</span></li>`; }).join('')}</ol>
      <p class="rw-hint">${S.round + 1 < S.rounds ? L('Next theme in a moment…', 'Za chwilę następny temat…') : L('That was the last round.', 'To była ostatnia runda.')}</p>`);
  }

  function render() {
    if (!S) return;
    $('rw-info').innerHTML = S.ph === 'end' ? L('Show is over', 'Koniec pokazu') : `${L('Round', 'Runda')} ${S.round + 1}/${S.rounds}${S.theme ? ' · ' + esc(themeName(S.theme)) : ''}`;
    $('rw-code').textContent = Rm?.code || '';
    renderPick(); renderTheme(); renderDress(); renderWalk(); renderReveal();
    layout();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('rw-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function playEv(e) {
    if (e.t === 'pick') { sfx.draw(); }
    else if (e.t === 'theme') { sfx.set(); if (e.tie && e.n > 0) big(L('A tie!', 'Remis!'), L('Drawn at random', 'Rozstrzyga losowanie'), 1300); }
    else if (e.t === 'dress') { sfx.set(); big(L('Dress up!', 'Przebieraj się!'), esc(themeName(S.theme)), 1400); }
    else if (e.t === 'lock') { flush(); sfx.thunk(); }
    else if (e.t === 'walk') { if (e.s === S.me) { sfx.win(); big(L('Your walk!', 'Twój wybieg!'), '', 1200); } else sfx.pop(); }
    else if (e.t === 'reveal') {
      const p = S.me >= 0 ? e.pts[S.me] : -1, best = Math.max(...e.pts);
      if (p >= 0) { p > 0 && p === best ? sfx.combo(Math.min(8, p / 12)) : sfx.pop(); big('+' + p, L(`Round ${S.round + 1}`, `Runda ${S.round + 1}`), 1500); }
    } else if (e.t === 'end') {
      if (e.w === S.me && S.me >= 0) { sfx.win(); confetti(); } else if (S.me >= 0) { sfx.lose(); if (e.w >= 0 && !seatBurst(e.w)) confetti(false); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2600);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, key = s.gid + '/' + s.round + '/' + s.stage + '/' + s.walk;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    // a new round or a new game: start from the look the server has for you
    const lk = s.gid + '/' + s.round + '/' + s.me;
    if (s.me >= 0 && (lk !== lookKey || !look)) { lookKey = lk; look = cleanAv(s.looks[s.me]); myTc = s.tc?.[s.me] || s.seats[s.me].color; myPose = s.pose[s.me] | 0; sentKey = s.gid + '/' + look.join('.') + myTc; gridKey = ''; }
    if (key !== stageKey || Math.abs(deadline - (performance.now() + s.left)) > 700) deadline = performance.now() + s.left;
    stageKey = key;
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results, with Keep this look -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res;
    const solo = R.place.filter(x => x === 1).length === 1, mineP = S.me >= 0 ? R.place[S.me] : 0;
    const head = mineP === 1 && solo ? L('You are the star of the show!', 'Jesteś gwiazdą pokazu!') : solo ? L(`${nameOf(S.win)} is the star of the show!`, `Gwiazda pokazu: ${nameOf(S.win)}!`) : L('Shared first place!', 'Wspólne pierwsze miejsce!');
    const sub = L(`Themes: ${R.hist.map(h => themeName(h.theme)).join(', ')}.`, `Tematy: ${R.hist.map(h => themeName(h.theme)).join(', ')}.`) + (mineP > 1 ? ' ' + L(`You came ${ord(mineP)}.`, `Twoje miejsce: ${mineP}.`) : '');
    let keep = '';
    if (S.me >= 0 && S.looks[S.me]) {
      const a = cleanAv(S.looks[S.me]), mine = me().av ? cleanAv(me().av) : a, tcOn = S.tc?.[S.me] || me().color;
      // only a look you dressed up (not the plain starting outfit) that differs from your own clothes
      const plain = FREE_KEYS.every(k => k === 'hair' || k === 'hairC' || !a[IX[k]]) && tcOn === me().color;
      const changed = plain ? [] : FREE_KEYS.filter(k => a[IX[k]] !== mine[IX[k]]).concat(tcOn !== me().color ? ['tc'] : []);
      const borrowed = changed.filter(k => loaned(k, a[IX[k]]));
      if (changed.length) keep = `<div class="rw-keep"><div class="rw-keeppic">${avatarHtml(tcOn, a, 64)}</div><div class="rw-keeptx"><b>${L('Keep this look?', 'Zachować ten strój?')}</b>
        <span>${borrowed.length ? L(`Your own pieces are put on now. ${borrowed.length} borrowed ${borrowed.length === 1 ? 'piece goes' : 'pieces go'} to the Wardrobe to buy.`, `Twoje rzeczy założysz od razu. Pożyczone (${borrowed.length}) trafią do Garderoby do kupienia.`) : L('Everything in it is yours already.', 'Wszystko w nim już masz.')}</span>
        <ul>${borrowed.map(k => { const i = a[IX[k]]; return `<li>${esc(OPT[k][i])} ${packOf(k, i) ? `<span class="heart">♥ ${L('Supporter pack', 'Pakiet wspierających')}</span>` : `<span class="coin">${priceOf(k, i)}</span>`}</li>`; }).join('')}</ul>
        <button type="button" class="btn sm" data-a="keep">${L('Keep this look', 'Zachowaj ten strój')}</button></div></div>`;
    }
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2><p>${sub}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], best = R.hist.reduce((b, h) => (h.pts[i] > (b?.pts[i] ?? -1) ? h : b), null);
        const note = best && best.pts[i] > 0 ? L(`Best look: ${themeName(best.theme)} +${best.pts[i]}`, `Najlepszy strój: ${themeName(best.theme)} +${best.pts[i]}`) : L('No stars this time', 'Tym razem bez gwiazdek');
        return `<li class="${R.place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 80}ms"><i class="pos">${R.place[i]}</i>${avatarHtml(S.tc?.[i] || p.color, S.looks[i] || p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${note}</span></div>
          <strong><span>${R.tot[i]}</span><small>${L('pts', 'pkt')}</small></strong>${paidHtml(Rm, i)}</li>`;
      }).join('')}</ol>${keep}
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
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    f.style.left = `${innerWidth / 2 + (Math.random() * 160 - 80) - 32}px`; f.style.top = `${innerHeight * .4 - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }
  function confetti(own = true) {
    if (own && myBurst()) return; // the player's own win effect from the Wardrobe, when they have one on
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * q; cv.height = innerHeight * q; g.scale(q, q);
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

  const onResize = () => { if (S) layout(); };
  addEventListener('resize', onResize);
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !S) return;
    if (b.dataset.tab) { tab = b.dataset.tab; sfx.click(); renderDress(); $('rw-grid').scrollTop = 0; return; }
    if (b.dataset.i != null && dressing()) { setPart(tab, +b.dataset.i); return; }
    if (b.dataset.pose != null && dressing()) { myPose = +b.dataset.pose; sfx.click(); ctx.act({ t: 'pose', p: myPose }); renderDress(); return; }
    if (b.dataset.pk != null) { sfx.click(); ctx.act({ t: 'pick', k: +b.dataset.pk }); return; }
    if (b.dataset.v != null) { sfx.click(); ctx.act({ t: 'vote', v: +b.dataset.v }); return; }
    const a = b.dataset.a; if (!a) return;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'ready') { sfx.click(); flush(); ctx.act({ t: 'ready', on: b.getAttribute('aria-pressed') !== 'true', av: look.slice() }); }
    else if (a === 'rand') {
      // a random look from everything in the shop (body, height, skin and face stay yours)
      for (const k of FREE_KEYS) { const n = OPT[k].length, keepOff = { facial: .6, marks: .7, glasses: .5, neck: .4, back: .5, hand: .4 }[k] || 0; look[IX[k]] = Math.random() < keepOff ? 0 : Math.random() * n | 0; }
      myTc = TOP_COLS[Math.random() * TOP_COLS.length | 0];
      sfx.place(); sendSoon(); renderDress();
    }
    else if (a === 'mine') { const own = cleanAv(me().av); for (const k of FREE_KEYS) look[IX[k]] = own[IX[k]]; myTc = me().color; sfx.click(); sendSoon(); renderDress(); }
    else if (a === 'keep') { sfx.click(); ctx.keepLook?.(cleanAv(S.looks[S.me]), S.tc?.[S.me]); }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  // your own theme: sent once, then the box goes away (one each per round)
  $('rw-pwrite').addEventListener('submit', e => {
    e.preventDefault();
    const inp = e.target.querySelector('input'), txt = cleanTheme(inp.value);
    if (!txt || !S || S.stage !== 'pick') { inp.focus(); return; }
    sfx.place(); ctx.act({ t: 'write', text: txt }); inp.value = ''; inp.blur();
  });
  $('rw-pwrite').addEventListener('keydown', e => e.stopPropagation()); // typing here never reaches the table's own keys
  root.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .round'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover(); });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('resize', onResize);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(sendTimer); clearInterval(clockTimer); scene?.dispose();
    },
  };
}
