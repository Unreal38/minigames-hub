// Dominoes game view: HUD over the 3D table. Renders what the server says and sends the tiles you play.
// Your own tiles are the only ones this page receives until a round is over and the hands are counted.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { TILES, sides, ends } from './rules.js';
import { tileSvg, tileHtml, halfHtml, tileName, setTileLook } from './tiles.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  tile: '<svg class="dm-ci" viewBox="0 0 14 24" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="21" rx="3"/><path d="M4 12h6"/></svg>',
};
const tiles = n => cnt(n, 'tile', 'tiles', 'kostka', 'kostki', 'kostek');
const pts = n => L(`${n} pts`, `${n} pkt`);

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./domino.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="dm">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="dm-info"></span></div>
      <div class="tr"><span class="tcode" id="dm-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="dm-banner" aria-live="polite"></div>
      <div class="dm-pile" id="dm-pile" hidden></div>
      <button type="button" class="dm-end" id="dm-endl" data-a="end" data-side="l" hidden></button>
      <button type="button" class="dm-end" id="dm-endr" data-a="end" data-side="r" hidden></button>
      <div class="shout" id="dm-big" aria-live="assertive"></div>
      <div class="dm-count" id="dm-count" hidden></div>
      <div class="dm-dock" id="dm-dock"><div class="dm-ctl" id="dm-ctl"></div><div class="dm-hand" id="dm-hand"></div></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.dm'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, endsAt = 0, stageEnds = 0, lastTick = -1, sent = 0, pick = -1, dealUntil = 0, dealTimer = 0, countAt = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const myTurn = () => !!(S && S.ph === 'play' && S.stage === 'play' && S.turn === S.me && me() && !me().bot);
  const dealing = () => performance.now() < dealUntil;
  const busy = () => Date.now() - sent < 1200;
  const fits = t => (S.must >= 0 && t !== S.must ? '' : sides(S.chain, t));
  const can = t => myTurn() && !busy() && !dealing() && !!fits(t);
  const endsHtml = () => { const e = ends(S.chain); return e ? `<span class="dm-ends">${L('Open ends', 'Wolne końce')} ${halfHtml(e[0])}${halfHtml(e[1])}</span>` : ''; };

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, t.x)); // keep the tag on the screen when its player is half off it
      placer.add(el, t.x, t.y);
    }
    for (const k of ['l', 'r']) { const b = $('dm-end' + k), p = info.ends[k]; b.style.left = `${(Math.max(34, Math.min(innerWidth - 34, p.x)) / uiz()).toFixed(1)}px`; b.style.top = `${(p.y / uiz()).toFixed(1)}px`; } // inside the (zoomed) HUD
    const p = $('dm-pile'); p.style.left = `${(info.pile.x / uiz()).toFixed(1)}px`; p.style.top = `${(info.pile.y / uiz()).toFixed(1)}px`;
  }
  // keep the 3D table clear of your tiles at the bottom
  function layout() { if (scene) scene.setHud(Math.max($('dm-dock').offsetHeight + 26, innerWidth < 700 ? 230 : 220) * uiz()); }

  // ----- name tags over the avatars: name, tiles left, points, and their last move -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map((p, i) => `<div class="dm-tag"${i === S.me ? ' hidden' : ''}><div class="bub"></div><div class="plate${tagCls(p)}">${tagFace(p)}<span class="cnt"></span><span class="pts"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    const last = S.ph === 'play' && S.stage === 'play' ? S.last : null;
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      el.classList.toggle('now', i === S.turn && S.stage === 'play');
      setHtml(el.querySelector('.plate .cnt'), `${I.tile}${p.n}`);
      setHtml(el.querySelector('.plate .pts'), !S.to ? '' : innerWidth < 700 ? String(S.score[i]) : pts(S.score[i]));
      const b = !last || last.s !== i ? '' : last.t === 'play' ? `<span class="top">${tileHtml(last.tile, 'xs lie')}</span>` : last.t === 'draw' ? `<span class="took">${L('draws', 'dobiera')}</span>` : `<span class="took">${L('passes', 'pas')}</span>`;
      setHtml(el.firstElementChild, b);
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }
  function floatAt(i, text, bad = true) {
    const t = live?.tags?.[i]; if (!t || i === S.me) return;
    const f = document.createElement('div');
    f.className = 'dm-pts' + (bad ? ' bad' : ''); f.textContent = text;
    f.style.left = `${t.cx}px`; f.style.top = `${t.cy}px`;
    root.append(f); setTimeout(() => f.remove(), 1500);
  }

  // ----- your tiles and the buttons -----
  function renderDock() {
    const p = me(), hand = $('dm-hand'), ctl = $('dm-ctl');
    if (!S || S.ph !== 'play' || !p || S.stage === 'round') { setHtml(hand, ''); setHtml(ctl, ''); showEnds(false); layout(); return; }
    const turn = myTurn(), mine = p.hand || [], n = mine.length;
    if (!turn || busy() || !mine.includes(pick)) pick = -1;
    hand.className = 'dm-hand' + (n > 16 ? ' tiny' : n > 8 ? ' mid' : '') + (turn && !busy() ? ' turn' : '');
    setHtml(hand, mine.map(t => `<button type="button" class="dm-t${can(t) ? ' ok' : ''}${pick === t ? ' sel' : ''}" data-a="tile" data-t="${t}" aria-label="${tileName(t)}"${can(t) ? '' : ' aria-disabled="true"'}>${tileSvg(t)}</button>`).join(''));
    const open = endsHtml();
    if (dealing() || S.stage === 'deal') setHtml(ctl, `<span class="dm-wait"><span>${L(`Dealing the tiles…`, `Rozdawanie kostek…`)}</span></span>`);
    else if (turn && !busy()) {
      const any = mine.some(t => fits(t));
      let hint, btn = '';
      if (pick >= 0) hint = L('It fits both ends: tap a yellow button on the table.', 'Pasuje do obu końców: dotknij żółtego przycisku na stole.');
      else if (S.must >= 0) hint = TILES[S.must][0] === TILES[S.must][1] ? L('You hold the highest double, so you start with it. Tap it.', 'Masz najwyższy dublet, więc zaczynasz od niego. Dotknij go.') : L('Nobody holds a double, so your heaviest tile starts. Tap it.', 'Nikt nie ma dubletu, więc zaczyna twoja najcięższa kostka. Dotknij jej.');
      else if (!S.chain.length) hint = L('You won the last round, so you start. Tap any tile.', 'Poprzednia runda jest twoja, więc zaczynasz. Dotknij dowolnej kostki.');
      else if (any) hint = L('Tap a lifted tile to add it to the line.', 'Dotknij podniesionej kostki, żeby dołożyć ją do linii.');
      else if (S.pile) { hint = L('Nothing you hold fits. Draw from the pile until something does.', 'Żadna twoja kostka nie pasuje. Dobieraj ze stosu, aż coś będzie pasować.'); btn = `<button type="button" class="btn big m dm-pulse" data-a="draw">${L('Draw a tile', 'Dobierz kostkę')}</button>`; }
      else hint = L('Nothing fits and the pile is empty, so you pass.', 'Nic nie pasuje, a stos jest pusty, więc pasujesz.');
      setHtml(ctl, `${btn ? `<div class="dm-go">${btn}</div>` : ''}<p class="dm-hint">${hint} ${pick < 0 ? open : ''}</p>`);
    } else if (S.stage === 'play' && S.turn >= 0) {
      const t = S.seats[S.turn];
      setHtml(ctl, `<span class="dm-wait">${avatarHtml(t.color, t.av, 30)}<span>${S.turn === S.me ? (p.bot ? L('A bot is playing for you', 'Bot gra za ciebie') : L('Sent…', 'Wysłano…')) : L(`${nameOf(S.turn)} is thinking…`, `${nameOf(S.turn)} myśli…`)}</span>${open}</span>`);
    } else setHtml(ctl, '');
    showEnds(pick >= 0);
    layout();
  }
  // the two "put it here" buttons at the ends of the line, each showing the number it would cover
  function showEnds(on) {
    const e = S && ends(S.chain);
    for (const [k, i] of [['l', 0], ['r', 1]]) {
      const b = $('dm-end' + k); b.hidden = !on || !e; if (b.hidden) continue;
      setHtml(b, halfHtml(e[i])); b.setAttribute('aria-label', L(`Put it on the ${e[i]} end`, `Dołóż do końca z ${e[i]}`));
    }
  }

  function renderBanner() {
    const el = $('dm-banner'); let msg = '';
    if (!S) return;
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)), t = S.tLeft >= 0 ? ` · ${secs}s` : '';
    const wide = innerWidth >= 700;
    if (S.ph === 'end') msg = S.win >= 0 ? (S.win === S.me ? L('You win the match!', 'Wygrywasz mecz!') : L(`${nameOf(S.win)} wins the match!`, `Mecz wygrywa ${nameOf(S.win)}!`)) : L('The match is level', 'Mecz kończy się remisem');
    else if (S.stage === 'round') msg = L(`Round ${S.round} is over`, `Koniec rundy ${S.round}`);
    else if (S.stage === 'deal') msg = S.turn === S.me ? L('You start', 'Zaczynasz') : L(`${nameOf(S.turn)} starts`, `Zaczyna ${nameOf(S.turn)}`);
    else if (myTurn()) msg = (S.passing ? L('Nothing fits · you pass', 'Nic nie pasuje · pasujesz') : wide ? L('Your turn · add a tile to the line', 'Twoja kolej · dołóż kostkę do linii') : L('Your turn', 'Twoja kolej')) + t;
    else if (S.turn >= 0) msg = L(`${nameOf(S.turn)}’s turn`, `Kolej: ${nameOf(S.turn)}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', myTurn());
  }

  function renderPile() {
    const el = $('dm-pile'), show = S.ph === 'play' && S.stage !== 'round';
    el.hidden = !show; if (!show) return;
    setHtml(el, S.pile ? L(`Pile: ${S.pile}`, `Stos: ${S.pile}`) : L('Pile empty', 'Stos pusty'));
    el.classList.toggle('none', !S.pile);
  }

  // ----- the count at the end of a round: everyone's leftover tiles and what the winner scores -----
  function renderCount() {
    const el = $('dm-count'), rd = S.rd, show = !!rd && performance.now() >= countAt && (S.stage === 'round' || (S.ph === 'end' && root.querySelector('.results').hidden));
    el.hidden = !show; if (!show) { el._h = ''; return; }
    const w = rd.w, who = w === S.me;
    const head = w < 0 ? L('Blocked, and level', 'Blokada i remis') : rd.blocked ? L('Blocked!', 'Blokada!') : 'Domino!';
    const sub = w < 0 ? L('Nobody can move and the lightest hands are level, so nobody scores.', 'Nikt nie może dołożyć kostki, a najlżejsze ręce są równe, więc nikt nie zdobywa punktów.')
      : rd.blocked ? L(`Nobody can move. ${who ? 'You have' : nameOf(w) + ' has'} the lightest hand and ${who ? 'score' : 'scores'} the difference.`, `Nikt nie może dołożyć kostki. ${who ? 'Masz najlżejszą rękę i zdobywasz' : nameOf(w) + ' ma najlżejszą rękę i zdobywa'} różnicę oczek.`)
        : L(`${who ? 'You are' : nameOf(w) + ' is'} out of tiles and ${who ? 'score' : 'scores'} every pip the others still hold.`, who ? 'Nie masz już kostek i zdobywasz wszystkie oczka, które zostały pozostałym.' : `${nameOf(w)} nie ma już kostek i zdobywa wszystkie oczka, które zostały pozostałym.`);
    const secs = Math.max(0, Math.ceil((stageEnds - performance.now()) / 1000));
    const html = `<h3>${head}</h3><p>${sub}</p>
      <ol>${S.seats.map((p, i) => `<li class="${i === w ? 'won' : ''}">${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}
        <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span class="left">${rd.hands[i].length ? rd.hands[i].map(t => tileHtml(t, 'xs')).join('') : L('no tiles left', 'bez kostek')}</span></div>
        <strong><span>${i === w ? '+' + rd.pts : rd.pips[i] ? L(`${rd.pips[i]} pips`, `oczka: ${rd.pips[i]}`) : ''}</span>${S.to ? `<small>${L('total', 'razem')} ${S.score[i]} / ${S.to}</small>` : ''}</strong></li>`).join('')}</ol>
      ${S.stage === 'round' ? `<p class="next">${L(`Next round in ${secs}s`, `Następna runda za ${secs} s`)}</p>` : ''}`;
    setHtml(el, html);
  }

  function render() {
    if (!S) return;
    const mine = S.me >= 0 ? S.score[S.me] : 0;
    $('dm-info').textContent = (S.to ? L(`Round ${S.round} · to ${S.to}`, `Runda ${S.round} · do ${S.to}`) : L('Single round', 'Jedna runda')) + (S.to && S.me >= 0 ? L(` · you ${mine}`, ` · ty ${mine}`) : '');
    $('dm-code').textContent = Rm?.code || '';
    buildTags(); renderDock(); renderBanner(); renderPile(); renderCount();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('dm-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'play') { setTimeout(() => !destroyed && sfx.thunk(), 420); if (e.left === 1) ctx.toast(e.s === S.me ? L('One tile left!', 'Została ci jedna kostka!') : L(`${nameOf(e.s)} has one tile left`, `${nameOf(e.s)}: została jedna kostka`)); }
    else if (e.t === 'draw') { sfx.draw(); floatAt(e.s, '+1'); if (e.s === S.me) sfx.plop(); }
    else if (e.t === 'pass') { sfx.bad?.(); if (e.s === S.me) big(L('Pass', 'Pas'), L('Nothing fits and the pile is empty', 'Nic nie pasuje, a stos jest pusty'), 1300); else floatAt(e.s, L('pass', 'pas')); }
    else if (e.t === 'start') dealFx();
    else if (e.t === 'round') {
      const mineWin = e.w === S.me && S.me >= 0;
      countAt = performance.now() + 1900; renderCount(); // the shout first, then the count
      if (mineWin) { sfx.win(); confetti(); } else if (e.w < 0) sfx.bad?.(); else sfx.set();
      big(e.blocked ? L('Blocked!', 'Blokada!') : 'Domino!', e.w < 0 ? L('Nobody scores', 'Nikt nie zdobywa punktów') : `${mineWin ? L('You score', 'Zdobywasz') : nameOf(e.w)} +${e.pts}`, 1800);
    } else if (e.t === 'end') {
      if (S.win === S.me && S.me >= 0) setTimeout(() => { if (!destroyed) { sfx.win(); confetti(); } }, 1900); else if (S.me >= 0 && S.win >= 0) setTimeout(() => !destroyed && sfx.lose(), 1900);
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 4600);
    }
  }
  // tiles click out one by one before you can touch them
  function dealFx() {
    if (!S || S.stage !== 'deal' || S.stageLeft < 500) return;
    dealUntil = performance.now() + S.stageLeft; let k = 0;
    const flick = () => { if (destroyed || k++ > 6 || !dealing()) return; sfx.pop(); setTimeout(flick, 210); }; flick();
    clearTimeout(dealTimer); dealTimer = setTimeout(() => { if (!destroyed && S) render(); }, S.stageLeft + 30);
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, wasTurn = S ? S.turn : -2, was = S ? S.turn + '/' + S.stage + '/' + S.mv : '';
    S = s; setTileLook(s.me >= 0 ? s.seats[s.me]?.fl?.dm : 0); // your hand wears your own tile look
    endsAt = performance.now() + Math.max(0, s.tLeft); stageEnds = performance.now() + (s.stageLeft || 0);
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastTick = -1; sent = 0; pick = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults(); else dealFx();
    }
    if (!fresh && was !== s.turn + '/' + s.stage + '/' + s.mv) { sent = 0; if (myTurn() && wasTurn !== s.turn) { sfx.turn(); lastTick = -1; pick = -1; } }
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), n = S.seats.length, R = S.res;
    const myPlace = S.me >= 0 ? R.places[S.me] : 0;
    const head = R.tie ? L('A level match', 'Remis') : S.win === S.me ? L('You win the match!', 'Wygrywasz mecz!') : L(`${nameOf(S.win)} wins the match!`, `Mecz wygrywa ${nameOf(S.win)}!`);
    const sub = (myPlace ? L(`You finish ${ord(myPlace)} of ${n}.`, `Twoje miejsce: ${myPlace} z ${n}.`) + ' ' : '') + (S.to ? L(`${cnt(R.rounds, 'round')} played, first to ${S.to}.`, `Rozegrane rundy: ${R.rounds}, gra do ${S.to} pkt.`) : L('A single round.', 'Jedna runda.'));
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], st = p.st;
        return `<li class="${pbRowCls(p.fl)} ${R.places[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 90}ms"><i class="pos">${R.places[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(st.rounds, 'round')} won · ${tiles(st.played)} played`, `wygrane rundy: ${st.rounds} · dołożone kostki: ${st.played}`)}</span></div>
          <strong><span>${S.score[i]}</span><small>${L('points', 'pkt')}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length; renderCount();
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
    if (S?.ph === 'end' && S.rd) renderCount();
    if (!S || S.ph !== 'play') return;
    renderBanner(); if (S.rd) renderCount();
    if (sent && Date.now() - sent >= 1200) { sent = 0; renderDock(); }
    if (myTurn() && S.tLeft >= 0) {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastTick && n <= 5 && n > 0) { lastTick = n; sfx.tick(); }
    }
  }, 200);

  // ----- input -----
  function go(a) {
    if (!myTurn() || dealing() || busy()) return;
    sent = Date.now(); pick = -1; sfx.click(); ctx.act(a); renderDock();
  }
  function tapTile(t, b) {
    if (!can(t)) { if (myTurn()) { sfx.bad?.(); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); } return; }
    const fit = fits(t);
    if (fit.length === 1 || !S.chain.length) return go({ t: 'play', tile: t, side: fit[0] });
    pick = pick === t ? -1 : t; sfx.click(); renderDock(); // it fits both ends: choose one on the table
  }
  const onKey = e => {
    if (!myTurn() || e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'd' && !me().hand.some(t => fits(t)) && S.pile) go({ t: 'draw' });
    else if (k === 'escape' && pick >= 0) { pick = -1; renderDock(); }
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) renderDock(); };
  addEventListener('resize', onResize);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'tile') tapTile(+b.dataset.t, b);
    else if (a === 'end') { if (pick >= 0 && fits(pick).includes(b.dataset.side)) go({ t: 'play', tile: pick, side: b.dataset.side }); }
    else if (a === 'draw') go({ t: 'draw' });
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
    else if (a === 'sit') { sfx.click(); ctx.sit?.(b.getAttribute('aria-pressed') !== 'true'); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .dm-t.ok, .dm-end');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() {
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(dealTimer); scene?.dispose();
    },
  };
}
