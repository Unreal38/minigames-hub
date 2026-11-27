// Liar's Dice game view: HUD over the 3D table. Renders what the server says and sends your bids and calls.
// Your own dice are the only ones this page ever receives before the cups lift.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, word } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { FACES, NAME, faceWord, matches, legal, lowest, chance } from './rules.js';
import { nameHtml, titleHtml, frameCls, cardBg, cardBgCls, pbSync, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const PIP = [[], [[12, 12]], [[7.2, 7.2], [16.8, 16.8]], [[7, 7], [12, 12], [17, 17]], [[7.2, 7.2], [16.8, 7.2], [7.2, 16.8], [16.8, 16.8]],
  [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]], [[7.4, 6.4], [16.6, 6.4], [7.4, 12], [16.6, 12], [7.4, 17.6], [16.6, 17.6]]];
// A die face as a small picture. v = 0 draws a die you cannot see.
export const dieSvg = (v, cls = '') => `<svg class="ld-die${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" role="img" aria-label="${v ? faceWord(1, v) : L('hidden die', 'zakryta kość')}"><rect x="1.5" y="1.5" width="21" height="21" rx="5.5"/>${
  v ? PIP[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 3.5 : 2.35}"${v === 1 ? ' class="one"' : ''}/>`).join('') : '<path d="M9.4 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2M12 16.9v.2"/>'}</svg>`;

const HEART = '<svg class="ld-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C5 15.6 2.5 12.2 2.5 8.7 2.5 5.9 4.7 4 7.2 4c1.9 0 3.6 1 4.8 2.8C13.2 5 14.9 4 16.8 4c2.5 0 4.7 1.9 4.7 4.7 0 3.5-2.5 6.9-9.5 11.8z"/></svg>';
const hearts = (n, max) => `<span class="ld-hearts" role="img" aria-label="${L(`${n} of ${max} lives`, `życia: ${n} z ${max}`)}">${HEART.repeat(Math.max(0, n))}${HEART.replace('ld-heart', 'ld-heart gone').repeat(Math.max(0, max - n))}</span>`;
let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./dice.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="ld">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="ld-info"></span></div>
      <div class="tr"><span class="tcode" id="ld-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="ld-banner" aria-live="polite"></div>
      <div class="ld-bid" id="ld-bid" hidden></div>
      <div class="shout" id="ld-big" aria-live="assertive"></div>
      <aside class="ld-side"><ol class="ld-list" id="ld-list" aria-label="${L(`Players and their dice`, `Gracze i ich kości`)}"></ol></aside>
      <div class="ld-dock" id="ld-dock"><div class="ld-mine" id="ld-mine"></div><div class="ld-ctl" id="ld-ctl"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.ld'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, lastTick = -1, sent = 0;
  let sel = { q: 1, f: 2 }, selKey = '', rollUntil = 0, rollTimer = 0;
  let showKey = '', showTimers = [], counted = 0, hits = [], verdict = false;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const youOr = i => (i === S.me ? 'You' : nameOf(i));
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'bid' && S.turn === S.me && me() && !me().bot);
  const bidHtml = (q, f) => `${q} × ${dieSvg(f)}`;
  const rolling = () => performance.now() < rollUntil;

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x)); // keep the tag on the screen when its player is half off it
      placer.add(el, t.x, t.y);
    }
    const b = $('ld-bid'); b.style.left = `${(info.bid.x / uiz()).toFixed(1)}px`; b.style.top = `${(info.bid.y / uiz()).toFixed(1)}px`; // inside the (zoomed) HUD
  }
  // keep the 3D table clear of the controls at the bottom and the player list on the left
  function layout() {
    if (!scene) return;
    // the dock is tallest on your own turn: always leave that much room, so the camera does not move between turns
    scene.setHud(Math.max($('ld-dock').offsetHeight + 30, innerWidth < 700 ? 318 : 300) * uiz());
  }

  // ----- name tags over the avatars: name, dice left, and what they last said -----
  function said(i) {
    if (S.stage === 'show' && S.show?.caller === i) return `<span class="call">${L(`${S.show.kind === 'spot' ? 'Spot on!' : 'Liar!'}`, `${S.show.kind === 'spot' ? 'W punkt!' : 'Kłamca!'}`)}</span>`;
    for (let k = S.hist.length - 1; k >= 0; k--) if (S.hist[k].s === i) return `<span${k === S.hist.length - 1 ? ' class="top"' : ''}>${bidHtml(S.hist[k].q, S.hist[k].f)}</span>`;
    return '';
  }
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="ld-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate${tagCls(p)}">${tagFace(p)}<span class="cnt"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'bid'); el.classList.toggle('out', !p.n);
      const cnt = el.querySelector('.plate .cnt'), v = !p.n ? L('out', 'koniec') : S.livesMax ? `${HEART}${p.lives}` : `${dieSvg(0)}${p.n}`; if (cnt._h !== v) { cnt._h = v; cnt.innerHTML = v; }
      setHtml(el.firstElementChild, S.ph === 'play' && S.stage !== 'roll' ? said(i) : '');
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = true) {
    const t = live?.tags?.[i]; if (!t) return;
    const f = document.createElement('div');
    f.className = 'ld-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- the player list: everyone's dice, face down until the cups lift -----
  function renderList() {
    const open = S.stage === 'show' || S.ph === 'end', sh = S.stage === 'show' ? S.show : null;
    const hitAt = new Map(hits.map((h, k) => [h.s + '/' + h.k, k]));
    setHtml($('ld-list'), S.seats.map((p, i) => {
      const now = i === S.turn && S.stage === 'bid';
      let dice = '';
      if (!p.n) dice = `${L(`<em>out of ${S.livesMax ? 'lives' : 'dice'}</em>`, `<em>${S.livesMax ? 'bez żyć' : 'bez kości'}</em>`)}`;
      else if (p.dice && (i !== S.me || !rolling())) dice = p.dice.map((v, k) => {
        const h = hitAt.get(i + '/' + k);
        return dieSvg(v, sh ? (h === undefined ? 'dim' : h < counted ? 'hit' : '') : '');
      }).join('');
      else dice = dieSvg(0).repeat(p.n);
      const lose = sh && verdict && sh.lose.includes(i);
      return `<li class="${now ? 'now' : ''}${i === S.me ? ' ld-me' : ''}${p.n ? '' : ' out'}${lose ? ' lose' : ''}${cardBgCls(p.fl, 1)}">${cardBg(p.fl)}${avatarHtml(p.color, p.av, 30, frameCls(p.fl))}<div><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}${S.livesMax && p.n ? hearts(p.lives - (lose ? 1 : 0), S.livesMax) : ''}</b><span class="ld-row${open ? ' open' : ''}">${dice}${lose ? `${L(`<u>−1${S.livesMax ? ' life' : ''}</u>`, `<u>−1${S.livesMax ? ' życie' : ''}</u>`)}` : ''}</span></div></li>`;
    }).join(''));
    pbSync($('ld-list'));
  }

  // ----- your dice and the controls -----
  const minQ = f => (!S.bid ? 1 : f > S.bid.f ? S.bid.q : S.bid.q + 1);
  function resetSel() {
    const key = S.gid + '/' + S.round + '/' + S.hist.length;
    if (key === selKey) return; selKey = key;
    const low = lowest(S.bid, S.total, S.wild) || { q: S.total, f: 6 };
    // start on the cheapest raise, on a face you hold if that costs no more
    let f = low.f; const mine = me()?.dice || [];
    for (const x of FACES(S.wild)) if (minQ(x) === minQ(f) && mine.filter(v => matches(v, x, S.wild)).length > mine.filter(v => matches(v, f, S.wild)).length) f = x;
    sel = { q: Math.min(S.total, minQ(f)), f };
  }
  function renderDock() {
    const p = me(), mine = $('ld-mine'), ctl = $('ld-ctl');
    if (!S || S.ph !== 'play' || !p) { setHtml(mine, ''); setHtml(ctl, ''); return; }
    const turn = myTurn(), busy = Date.now() - sent < 1200, myLives = S.livesMax ? hearts(p.lives, S.livesMax) : '';
    if (!p.n) setHtml(mine, `<span class="lbl">${L(`You are out of ${S.livesMax ? 'lives' : 'dice'}. Stay and watch how it ends.`, `${S.livesMax ? 'Nie masz już żyć' : 'Nie masz już kości'}. Zostań i zobacz, jak to się skończy.`)}</span>`);
    else if (rolling()) setHtml(mine, `${myLives}${L(`<span class="lbl">Shaking…</span>`, `<span class="lbl">Mieszanie…</span>`)}<span class="ld-hand shaking">${dieSvg(0).repeat(p.n)}</span>`);
    else setHtml(mine, `${myLives}${L(`<span class="lbl">Your dice</span>`, `<span class="lbl">Twoje kości</span>`)}<span class="ld-hand">${p.dice.map(v => dieSvg(v, turn && matches(v, sel.f, S.wild) ? 'pick' : '')).join('')}</span>`);
    if (turn && !busy) {
      resetSel();
      const ok = legal(S.bid, sel.q, sel.f, S.total, S.wild), have = p.dice.filter(v => matches(v, sel.f, S.wild)).length;
      const about = have + (S.total - p.n) * chance(sel.f, S.wild);
      setHtml(ctl, `<div class="ld-pick">
          <div class="ld-qty" role="group" aria-label="${L(`How many`, `Ile`)}"><button type="button" class="round" data-a="q-" aria-label="${L(`One fewer`, `O jedną mniej`)}"${sel.q <= minQ(sel.f) ? ' disabled' : ''}>−</button><b>${sel.q}</b><button type="button" class="round" data-a="q+" aria-label="${L(`One more`, `O jedną więcej`)}"${sel.q >= S.total ? ' disabled' : ''}>+</button></div>
          <div class="ld-faces" role="group" aria-label="${L(`Which face`, `Jaka ścianka`)}">${FACES(S.wild).map(f => `<button type="button" data-a="f" data-f="${f}" aria-pressed="${f === sel.f}"${minQ(f) > S.total ? ' disabled' : ''}>${dieSvg(f)}</button>`).join('')}</div>
        </div>
        <div class="ld-go">
          <button type="button" class="btn big" data-a="bid"${ok ? '' : ' disabled'}${L(`>Bid ${bidHtml(sel.q, sel.f)}<`, `>Licytuj ${bidHtml(sel.q, sel.f)}<`)}/button>
          <button type="button" class="btn big r" data-a="liar"${S.bid ? '' : ' disabled'}>${L(`Liar!`, `Kłamca!`)}</button>
          ${S.spot ? `<button type="button" class="btn big m" data-a="spot"${S.bid ? '' : ' disabled'}>${L(`Spot on!`, `W punkt!`)}</button>` : ''}
        </div>
        <p class="ld-hint">${L(`You hold <b>${have}</b>${S.wild && have ? ' (ones count)' : ''}. With ${S.total} dice on the table, about <b>${Math.round(about)}</b> ${faceWord(Math.round(about), sel.f)} would be normal.`, `Masz <b>${have}</b>${S.wild && have ? ' (jedynki się liczą)' : ''}. Przy ${S.total} kościach na stole normalne byłoby około <b>${Math.round(about)}</b> (${faceWord(Math.round(about), sel.f)}).`)}</p>`);
    } else if (S.stage === 'bid' && S.turn >= 0) {
      const t = S.seats[S.turn];
      setHtml(ctl, `<span class="ld-wait">${avatarHtml(t.color, t.av, 30)}<span>${L(`${S.turn === S.me ? (p.bot ? 'A bot is playing for you' : 'Sent…') : `${nameOf(S.turn)} is thinking…`}`, `${S.turn === S.me ? (p.bot ? 'Bot gra za ciebie' : 'Wysłane…') : `${nameOf(S.turn)} myśli…`}`)}</span></span>`);
    } else setHtml(ctl, '');
    layout();
  }

  function renderBanner() {
    const el = $('ld-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs} s` : '';
    if (S.ph === 'end') msg = S.win >= 0 ? L(`${S.win === S.me ? 'You win' : nameOf(S.win) + ' wins'}!`, `${S.win === S.me ? 'Wygrana' : 'Wygrywa ' + nameOf(S.win)}!`) : '';
    else if (S.stage === 'roll') msg = L(`Round ${S.round} · everyone shakes their cup`, `Runda ${S.round} · wszyscy potrząsają kubkami`);
    else if (S.stage === 'show') msg = L(`${youOr(S.show.caller)} called ${S.show.kind === 'spot' ? 'spot on' : 'liar'} on ${youOr(S.show.bidder) === 'You' ? 'your' : nameOf(S.show.bidder) + '’s'} bid`, `${S.show.caller === S.me ? 'Sprawdzasz' : nameOf(S.show.caller) + ' sprawdza'} (${S.show.kind === 'spot' ? 'w punkt' : 'kłamca'}): ${S.show.bidder === S.me ? 'twoja odzywka' : 'odzywka gracza ' + nameOf(S.show.bidder)}`);
    else if (myTurn()) msg = (S.bid ? L('Your turn · raise the bid or call it', 'Twoja kolej · przebij albo sprawdź') : L('Your turn · make the first bid', 'Twoja kolej · złóż pierwszą odzywkę')) + t;
    else if (S.turn >= 0) msg = S.bid ? L(`${nameOf(S.turn)} has to raise or call`, `${nameOf(S.turn)} musi przebić albo sprawdzić`) : L(`${nameOf(S.turn)} opens the bidding`, `${nameOf(S.turn)} otwiera licytację`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function renderBid() {
    const el = $('ld-bid'), b = S.bid, sh = S.stage === 'show' ? S.show : null;
    el.hidden = !b || S.ph !== 'play' || S.stage === 'roll';
    if (el.hidden) return;
    // who said it is on the bubble over their head and in the banner: this stays small so it hides no cups
    setHtml(el, sh ? `<b>${bidHtml(sh.q, sh.f)}</b><em class="${verdict ? (sh.count >= sh.q ? 'yes' : 'no') : ''}">${L(`${counted} counted</em>`, `policzone: ${counted}</em>`)}` : `<b>${bidHtml(b.q, b.f)}</b>`);
    el.classList.toggle('counting', !!sh);
  }

  function render() {
    if (!S) return;
    $('ld-info').textContent = S.ph === 'end' ? L(`${S.res?.rounds || S.round} rounds played`, `Rozegrane rundy: ${S.res?.rounds || S.round}`) : L(`Round ${S.round} · ${S.total} dice${S.wild && innerWidth >= 700 ? ' · ones are wild' : ''}`, `Runda ${S.round} · kości: ${S.total}${S.wild && innerWidth >= 700 ? ' · jedynki to dżokery' : ''}`);
    $('ld-code').textContent = Rm?.code || '';
    root.classList.toggle('showing', S.stage === 'show');
    buildTags(); renderList(); renderDock(); renderBanner(); renderBid();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('ld-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ----- the reveal: count the matching dice one by one, then say who was wrong -----
  function startShow() {
    const sh = S.show, key = S.gid + '/' + S.round;
    if (key === showKey) return; showKey = key;
    for (const t of showTimers) clearTimeout(t); showTimers = [];
    hits = []; counted = 0; verdict = false;
    const n = S.seats.length;
    for (let k = 0; k < n; k++) { const i = (sh.bidder + k) % n; (S.seats[i].dice || []).forEach((v, d) => { if (matches(v, sh.f, S.wild)) hits.push({ s: i, k: d }); }); }
    const at = (ms, fn) => { const wait = ms - sh.ago; if (wait <= 0) fn(wait < -500); else showTimers.push(setTimeout(() => { if (!destroyed && S?.stage === 'show') fn(false); }, wait)); };
    at(0, late => { if (late) return; sh.kind === 'spot' ? sfx.set() : sfx.warn(); big(sh.kind === 'spot' ? L('Spot on!', 'W punkt!') : L('Liar!', 'Kłamca!'), L(`${youOr(sh.caller)} ${sh.caller === S.me ? 'call' : 'calls'} it on ${bidHtml(sh.q, sh.f)}`, `${sh.caller === S.me ? 'Sprawdzasz' : nameOf(sh.caller) + ' sprawdza'} odzywkę ${bidHtml(sh.q, sh.f)}`), S.ms.lift); });
    hits.forEach((_, k) => at(S.ms.lift + (k + 1) * S.ms.each, late => { counted = Math.max(counted, k + 1); if (late) return; sfx.pop(); renderList(); renderBid(); }));
    at(S.ms.lift + hits.length * S.ms.each + 550, late => {
      verdict = true; counted = hits.length; renderList(); renderBid();
      if (late) return;
      const c = sh.count, w = faceWord(c, sh.f), lost = sh.lose.includes(S.me);
      const loser = i => L((i === S.me ? 'You lose' : `${nameOf(i)} loses`) + (S.livesMax ? ' a life' : ' a die'), (i === S.me ? 'Tracisz' : `${nameOf(i)} traci`) + (S.livesMax ? ' życie' : ' kość'));
      if (sh.kind === 'spot') big(sh.right ? L('Spot on!', 'W punkt!') : L('Not quite!', 'Nie całkiem!'), sh.right ? L(`Exactly ${c}. Everyone else loses a ${S.livesMax ? 'life' : 'die'}`, `Dokładnie ${c}. Wszyscy pozostali tracą ${S.livesMax ? 'życie' : 'kość'}`) : L(`There ${c === 1 ? 'is' : 'are'} ${c}, not ${sh.q}. ${loser(sh.caller)}`, `Jest ${c}, a nie ${sh.q}. ${loser(sh.caller)}`), 3200);
      else if (sh.right) big(c ? L(`Only ${c}!`, `Tylko ${c}!`) : L('None at all!', 'Ani jednej!'), L(`${sh.bidder === S.me ? 'Your bluff is caught' : nameOf(sh.bidder) + ' was bluffing'}. ${loser(sh.bidder)}`, `${sh.bidder === S.me ? 'Twój blef wyszedł na jaw' : nameOf(sh.bidder) + ' blefuje'}. ${loser(sh.bidder)}`), 3200);
      else big(`${c} ${w}!`, L(`The bid was good. ${loser(sh.caller)}`, `Odzywka była dobra. ${loser(sh.caller)}`), 3200);
      for (const i of sh.lose) floatAt(i, S.livesMax ? '−1 ♥' : '−1');
      if (S.me < 0) sfx.place(); else if (lost) sfx.lose(); else if (sh.kind === 'liar' && (sh.right ? sh.caller : sh.bidder) === S.me || sh.kind === 'spot' && sh.right && sh.caller === S.me) { sfx.win(); confetti(); } else sfx.plop();
    });
  }

  function playEv(e) {
    if (e.t === 'sit') { sfx.join?.(); ctx.toast(e.s === S.me ? L('You took over a bot. Good luck!', 'Przejmujesz miejsce bota. Powodzenia!') : L(`${nameOf(e.s)} took over a bot`, `${nameOf(e.s)} przejmuje miejsce bota`)); }
    else if (e.t === 'round') { sfx.draw(); setTimeout(() => !destroyed && sfx.draw(), 380); setTimeout(() => !destroyed && sfx.draw(), 760); }
    else if (e.t === 'bid') { e.s === S.me ? sfx.place() : sfx.pop(); }
    else if (e.t === 'out') ctx.toast(L(e.s === S.me ? `You are out of ${S.livesMax ? 'lives' : 'dice'}` : `${nameOf(e.s)} is out of ${S.livesMax ? 'lives' : 'dice'}`, e.s === S.me ? (S.livesMax ? 'Nie masz już żyć' : 'Nie masz już kości') : `${nameOf(e.s)} odpada`));
    else if (e.t === 'end') {
      if (e.w === S.me) { sfx.win(); confetti(); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2200);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S ? S.turn + '/' + S.stage + '/' + S.hist.length + '/' + S.round : '';
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; showKey = ''; selKey = '';
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else sfx.draw();
    }
    endsAt = performance.now() + Math.max(0, s.tLeft);
    if (s.stage === 'roll') {
      const left = s.ms.roll - s.rollAgo - 200;
      if (left > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) { rollUntil = performance.now() + left; clearTimeout(rollTimer); rollTimer = setTimeout(() => { if (!destroyed && S) { sfx.place(); render(); } }, left + 20); }
    }
    if (s.stage !== 'show') { if (showTimers.length) { for (const t of showTimers) clearTimeout(t); showTimers = []; } hits = []; counted = 0; verdict = false; }
    else startShow();
    if (!fresh && myTurn() && was !== s.turn + '/' + s.stage + '/' + s.hist.length + '/' + s.round) { sfx.turn(); lastTick = -1; sent = 0; }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win;
    const myPlace = S.me >= 0 ? S.res.order.indexOf(S.me) + 1 : 0;
    el.innerHTML = `<div class="sheet">
      <h2>${L(`${w === S.me ? 'Nobody caught you!' : `${nameOf(w)} wins!`}`, `${w === S.me ? 'Nikt cię nie przyłapał!' : `Wygrywa ${nameOf(w)}!`}`)}</h2>
      <p>${L(`${myPlace ? (myPlace === 1 ? (S.livesMax ? 'Last one with a heart left. ' : 'Last one with dice under the cup. ') : `You came ${ORD(myPlace)}. `) : ''}It took ${S.res.rounds} round${S.res.rounds === 1 ? '' : 's'}.`, `${myPlace ? (myPlace === 1 ? (S.livesMax ? 'Ostatnie serce jest twoje. ' : 'Ostatnie kości pod kubkiem są twoje. ') : `Twoje miejsce: ${myPlace}. `) : ''}Rozegrane rundy: ${S.res.rounds}.`)}</p>
      <ol class="score">${S.res.order.map((i, n) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${pbRowCls(p.fl)} ${n === 0 ? 'won' : ''}" style="animation-delay:${n * 90}ms"><i class="pos">${n + 1}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${st.bids} bid${st.bids === 1 ? '' : 's'} · ${st.right} of ${st.calls} call${st.calls === 1 ? '' : 's'} right`, `odzywki: ${st.bids} · trafne sprawdzenia: ${st.right} z ${st.calls}`)}</span></div>
          <strong><span>${!p.n ? '' : S.livesMax ? HEART + p.lives : dieSvg(0) + p.n}</span><small>${L(`${!p.n ? 'out' : S.livesMax ? (p.lives === 1 ? 'life left' : 'lives left') : 'dice left'}`, `${!p.n ? 'koniec' : S.livesMax ? 'zostało żyć' : 'zostało kości'}`)}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
    if (!S) return;
    const i = S.seats.findIndex(p => p.id === m.id), t = i !== S.me ? live?.tags?.[i] : null;
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
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
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function pick(q, f) {
    f = FACES(S.wild).includes(f) ? f : sel.f;
    sel = { q: Math.max(minQ(f), Math.min(S.total, q)), f };
    sfx.click(); renderDock();
  }
  function go(a) {
    if (!myTurn() || Date.now() - sent < 1200) return;
    if (a.t === 'bid' && !legal(S.bid, a.q, a.f, S.total, S.wild)) return;
    if (a.t !== 'bid' && !S.bid) return;
    sent = Date.now(); sfx.click(); ctx.act(a); renderDock();
  }
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const fs = FACES(S.wild), k = e.key.toLowerCase();
    if (k === 'arrowup') pick(sel.q + 1, sel.f); else if (k === 'arrowdown') pick(sel.q - 1, sel.f);
    else if (k === 'arrowright') pick(sel.q, fs[Math.min(fs.length - 1, fs.indexOf(sel.f) + 1)]); else if (k === 'arrowleft') pick(sel.q, fs[Math.max(0, fs.indexOf(sel.f) - 1)]);
    else if (k >= '1' && k <= '6') pick(sel.q, +k);
    else if (k === 'enter' && !e.target.closest?.('button')) go({ t: 'bid', q: sel.q, f: sel.f });
    else if (k === 'l') go({ t: 'liar' }); else if (k === 's' && S.spot) go({ t: 'spot' });
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => layout();
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'q+') pick(sel.q + 1, sel.f);
    else if (a === 'q-') pick(sel.q - 1, sel.f);
    else if (a === 'f') pick(sel.q, +b.dataset.f);
    else if (a === 'bid') go({ t: 'bid', q: sel.q, f: sel.f });
    else if (a === 'liar' || a === 'spot') go({ t: a });
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .ld-faces button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(rollTimer); for (const t of showTimers) clearTimeout(t); scene?.dispose();
    },
  };
}
