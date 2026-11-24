// Kalambury (Sketch & Guess) game view: the drawing board laid over the 3D easel, the paint box for whoever draws,
// and the guess box for everyone else. Renders what the server says; your own strokes show at once.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { petImg, petPics } from '../../petpic.js';
import { uiz } from '../../uiz.js';
import { BW, BH, COLORS, WHITE, SIZES, OP, themeName, isLetter } from './rules.js';
import { createInk } from './ink.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  door: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  pen: svg('<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M13.5 6.5l4 4"/>'),
  eraser: svg('<path d="M8 19l-4.5-4.5a1.5 1.5 0 0 1 0-2L12 4l8 8-7 7z"/><path d="M8 19h12M8.5 8.5l7 7"/>'),
  fill: svg('<path d="M5 12.5l7-7.5 7 7-6.5 6.5a2 2 0 0 1-3 0z"/><path d="M5 12.5h14M12 5V2.5"/><path d="M20.5 16.5c1 1.5 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.5-1.7 1.500-3.2z" fill="currentColor"/>'),
  undo: svg('<path d="M8 5L3.500 9.500 8 14"/><path d="M4 9.500h10a6 6 0 0 1 0 12H9"/>'),
  bin: svg('<path d="M4 7h16M9 7V4h6v3M6.500 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
  skip: svg('<path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/>'),
  send: svg('<path d="M4 12l16-8-6 16-3-6.500z"/>'),
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 2M9.500 2.500h5"/></svg>',
};

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./kal.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="kl">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="kl-board" id="kl-board">
      <canvas id="kl-ink" aria-label="${L('The drawing', 'Rysunek')}"></canvas>
      <div class="kl-bar"><i></i></div>
      <div class="kl-over" id="kl-over"></div>
    </div>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="kl-info"></span></div>
      <div class="tr"><span class="tcode" id="kl-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="kl-word" id="kl-word" aria-live="polite"></div>
      <div class="kl-tools" id="kl-tools" hidden></div>
      <div class="kl-panel" id="kl-panel">
        <div class="kl-feed" id="kl-feed" aria-live="polite"></div>
        <form class="kl-form" id="kl-form" autocomplete="off">
          <input class="field" id="kl-in" maxlength="60" enterkeyhint="send" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${L('Your guess', 'Twoja odpowiedź')}">
          <button class="btn m" aria-label="${L('Send', 'Wyślij')}">${I.send}</button>
        </form>
      </div>
      <div class="shout" id="kl-big" aria-live="assertive"></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.kl'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), inkEl = $('kl-ink'), boardEl = $('kl-board'), input = $('kl-in');
  const board = createInk(inkEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, tid = -1, seatsNow = null, lay = null;
  let have = 0, mine = 0, askedAt = 0, outbox = [], pid = null, lastPt = null;   // the drawing stream
  let tool = 'pen', color = 0, size = 1;
  let feed = [], lastN = 0, feedKey = '', leftAt = 0, lastSec = -1, tagKey = '', resultsTimer = 0, bigTimer = 0, kb = false;
  const bubT = [];

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onLayout: o => { lay = o; place(); } });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); place(); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; };
  const nameOf = i => esc(S.seats[i]?.name);
  const wide = () => innerWidth >= 760 && innerWidth / root.clientHeight > 1.15;
  const iDraw = () => !!S && S.me >= 0 && S.me === S.drawer;
  const canDraw = () => iDraw() && S.ph === 'play' && S.st === 'draw';
  const iKnow = () => !!S && S.st === 'draw' && S.me >= 0 && (S.me === S.drawer || S.got[S.me]);
  const leftMs = () => Math.max(0, leftAt - performance.now());

  // ----- layout: tell the scene what the page's panels cover, then lay the board over the easel's paper -----
  function layout() {
    const w = wide(), z = uiz();
    root.classList.toggle('wide', w); root.classList.toggle('kb', kb); root.classList.toggle('mydraw', canDraw());
    const panel = $('kl-panel'), tools = $('kl-tools');
    root.style.setProperty('--pb', panel.offsetHeight + 'px');
    const fit = w ? { top: 70 * z, bottom: 14 + 54 * z, left: 136 * z, right: (panel.offsetWidth + 26) * z, paperOnly: false }
      : { top: (kb ? 62 : 114) * z, bottom: (panel.offsetHeight + (tools.hidden ? 0 : tools.offsetHeight + 6) + (kb ? 14 : 56)) * z, left: 4, right: 4, paperOnly: kb };
    if (scene) scene.setFit(fit); else place();
  }
  function place() {
    if (destroyed) return;
    const z = uiz();
    if (!lay) { // no 3D: the board sits in the middle of the free space by itself
      const w = wide(), pw = $('kl-panel').offsetWidth * z, ph = $('kl-panel').offsetHeight * z;
      const aw = innerWidth - (w ? pw + 150 : 12), ah = root.clientHeight - (w ? 120 : 130 + ph), bw = Math.max(120, Math.min(aw, ah * BW / BH));
      lay = { paper: { x: (w ? 110 : 6) + (aw - bw) / 2, y: w ? 90 : 118, w: bw, h: bw * BH / BW }, slot: 0, seats: [], flat: true };
    }
    const p = lay.paper;
    Object.assign(boardEl.style, { left: Math.round(p.x) - 1 + 'px', top: Math.round(p.y) - 1 + 'px', width: Math.round(p.w) + 2 + 'px', height: Math.round(p.h) + 2 + 'px' });
    boardEl.style.setProperty('--bw', p.w + 'px');
    const word = $('kl-word'), tools = $('kl-tools');
    if (wide()) {
      word.style.left = (p.x + p.w / 2) / z + 'px'; word.style.maxWidth = Math.max(260, p.w) / z + 'px';
      // the whole paint box has to fit beside the board: two buttons a row when there is the height, three when not
      const h = p.h / z, c2 = (h - 18) / 14 - 4, n = c2 >= 28 ? 2 : 3, cell = Math.max(22, Math.min(36, n === 2 ? c2 : (h - 18) / 10 - 4));
      tools.style.setProperty('--cell', cell.toFixed(1) + 'px'); tools.style.setProperty('--n', n);
      Object.assign(tools.style, { left: (p.x - 14) / z + 'px', top: p.y / z + 'px', maxHeight: h + 'px' });
    } else { word.style.left = ''; word.style.maxWidth = ''; Object.assign(tools.style, { left: '', top: '', maxHeight: '' }); }
    tagsEl.style.setProperty('--slot', Math.max(40, lay.slot) / z + 'px');
    const kids = tagsEl.children;
    for (let i = 0; i < lay.seats.length; i++) {
      const s = lay.seats[i], plate = kids[i * 2], bub = kids[i * 2 + 1]; if (!plate) break;
      plate.style.transform = `translate(${s.x.toFixed(1)}px, ${s.feet.toFixed(1)}px) translate(-50%, 0)`;
      const half = (bub.offsetWidth || 80) / 2 + 4, x = Math.max(half, Math.min(innerWidth - half, s.x));
      bub.style.transform = `translate(${x.toFixed(1)}px, ${s.head.toFixed(1)}px) translate(-50%, -100%)`;
    }
    tagsEl.hidden = !!lay.flat || kb;
  }

  // ----- name plates under the avatars and speech bubbles over their heads -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|');
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map(p => `<div class="kl-plate"><div class="in"><b>${nameHtml(p.name, p.fl)}</b><span class="cnt"></span></div></div><div class="kl-bub"><div class="in"></div></div>`).join('');
      place();
    }
    S.seats.forEach((p, i) => {
      const el = tagsEl.children[i * 2]; if (!el) return;
      const live = S.ph === 'play' && S.st === 'draw';
      el.className = `kl-plate${live && i === S.drawer ? ' now' : ''}${live && S.got[i] ? ' got' : ''}${!p.human || p.away ? ' off' : ''}${i === S.me ? ' mine' : ''}`;
      setHtml(el.querySelector('.cnt'), String(S.sc[i] ?? 0));
    });
  }
  function bubble(i, html, cls = '', ms = 3200) {
    const el = tagsEl.children[i * 2 + 1]?.firstElementChild; if (!el) return;
    el.innerHTML = `<span class="${cls}">${html}</span>`; place();
    clearTimeout(bubT[i]); bubT[i] = setTimeout(() => { el.innerHTML = ''; }, ms);
  }

  // ----- the word strip over the board: blanks for guessers, the word for the drawer, and the clock -----
  const hintHtml = h => h.split(' ').map(w => `<span class="kl-w">${[...w].map(ch => `<i class="${ch === '_' ? '' : 'on'}">${ch === '_' ? '' : esc(ch)}</i>`).join('')}</span>`).join('');
  function renderWord() {
    const el = $('kl-word'); let html = '', cls = '';
    const clock = `<span class="kl-clock" id="kl-clock">${I.clock}<b></b></span>`;
    if (S.ph === 'end') html = `<span class="kl-say">${L('Game over', 'Koniec gry')}</span>`;
    else if (S.st === 'pick') html = `${clock}<span class="kl-say">${iDraw() ? L('Pick a word', 'Wybierz słowo') : L(`${nameOf(S.drawer)} is picking a word…`, `${nameOf(S.drawer)} wybiera słowo…`)}</span>`;
    else if (S.st === 'show') { html = `<span class="kl-say">${L('The word:', 'Hasło:')} <b>${esc(S.last?.w)}</b></span>`; cls = 'done'; }
    else if (S.word) {
      html = `${clock}<span class="kl-say">${iDraw() ? L('Draw:', 'Narysuj:') : L('You got it:', 'Zgadnięte:')} <b>${esc(S.word)}</b></span>${iDraw() && S.pet ? petImg({ sp: S.pet, lv: 12 }, 44, 'kl-ref') : ''}`;
      cls = iDraw() ? 'mine' : 'done';
    } else {
      const h = S.hint || '', n = [...h].length, room = (wide() ? Math.max(260, lay?.paper.w || 400) / uiz() : innerWidth - 88) - 150;
      html = `${clock}<span class="kl-hint" style="--fs:${Math.max(9, Math.min(24, room / (n * 1.3))).toFixed(1)}px" aria-label="${L(`${n} letters`, `Liter: ${n}`)}">${hintHtml(h)}</span><small class="kl-len">${h.split(' ').map(w => [...w].filter(ch => ch === '_' || isLetter(ch)).length).join(' + ')}</small>`;
    }
    if (setHtml(el, html)) { petPics(el); lastSec = -1; }
    el.className = `kl-word ${cls}`;
    // the time bar along the top of the board restarts with every phase
    const bar = boardEl.querySelector('.kl-bar i'), key = S.gid + '/' + S.tid + '/' + S.st;
    if (key !== bar._k) {
      bar._k = key;
      if (S.ph === 'play' && S.st !== 'show') { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `klbar ${S.total}ms linear ${-(S.total - S.left)}ms both`; }
      else bar.style.animation = 'none';
    }
    tickClock();
  }
  function tickClock() {
    const el = root.querySelector('#kl-clock b'); if (!el || !S) return;
    const sec = Math.ceil(leftMs() / 1000);
    if (sec === lastSec) return; lastSec = sec;
    el.textContent = sec; el.parentElement.classList.toggle('low', sec <= 10 && S.st === 'draw');
    if (S.st === 'draw' && sec <= 5 && sec > 0) sfx.tick();
  }
  const clockTimer = setInterval(tickClock, 200);

  // ----- what lies over the board between drawings: the three words to pick from, who is picking, the answer -----
  function renderOver() {
    const el = $('kl-over'); let html = '';
    if (S.ph === 'play' && S.st === 'pick') {
      const d = S.seats[S.drawer];
      html = S.picks ? `<div class="kl-pick"><h3>${L('Your turn to draw! Pick a word:', 'Rysujesz! Wybierz słowo:')}</h3><div class="kl-picks">${S.picks.map((w, i) =>
        `<button type="button" class="btn big kl-opt" data-a="pick" data-i="${i}">${w.sp ? petImg({ sp: w.sp, lv: 12 }, 76, 'kl-petpic') : ''}<b>${esc(w.w)}</b><small>${themeName(w.theme)}</small></button>`).join('')}</div></div>`
        : `<div class="kl-wait">${d ? avatarHtml(d.color, d.av, 84, frameCls(d.fl)) : ''}<h3>${L(`${nameOf(S.drawer)} is picking a word…`, `${nameOf(S.drawer)} wybiera słowo…`)}</h3><p>${S.me >= 0 ? L('Get ready to guess!', 'Przygotuj się do zgadywania!') : L('You are watching this game.', 'Oglądasz tę grę.')}</p></div>`;
    } else if (S.ph === 'play' && S.st === 'show' && S.last) {
      const R = S.last, why = { all: L('Everyone got it!', 'Wszyscy zgadli!'), time: L('Time is up!', 'Koniec czasu!'), skip: L('The drawer gave up.', 'Rysujący się poddał.'), left: L('The drawer left.', 'Rysujący wyszedł.') }[R.why] || '';
      const rows = R.gains.map((p, i) => [p, i]).filter(([p, i]) => p > 0 || i === R.drawer).sort((a, b) => b[0] - a[0]);
      html = `<div class="kl-show"><div class="kl-ans">${R.sp ? petImg({ sp: R.sp, lv: 12 }, 64, 'kl-petpic') : ''}<div><small>${why} ${L('The word was', 'Hasło to')}</small><b>${esc(R.w)}</b></div></div>
        <div class="kl-gains">${rows.map(([p, i]) => `<span class="${i === R.drawer ? 'dr' : ''}${i === S.me ? ' mine' : ''}"><i style="background:${esc(S.seats[i]?.color)}"></i>${nameOf(i)} <b>+${p}</b></span>`).join('') || `<span>${L('Nobody guessed it', 'Nikt nie zgadł')}</span>`}</div></div>`;
    }
    if (setHtml(el, html)) petPics(el);
    el.className = `kl-over ${S.ph === 'play' && S.st === 'pick' ? 'full' : html ? 'low' : ''}`;
  }

  // ----- the paint box (only while you draw) -----
  function renderTools() {
    const el = $('kl-tools'), on = canDraw();
    if (el.hidden === on) { el.hidden = !on; }
    if (!on) return;
    const tb = (a, v, icon, label, pressed) => `<button type="button" class="kl-tb" data-a="${a}"${v !== '' ? ` data-v="${v}"` : ''} aria-label="${label}" title="${label}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${icon}</button>`;
    setHtml(el, `<div class="kl-cols">${COLORS.map((c, i) => `<button type="button" class="kl-col" data-a="col" data-v="${i}" aria-label="${L('Colour', 'Kolor')} ${i + 1}" aria-pressed="${tool !== 'eraser' && color === i}" style="--c:${c}"></button>`).join('')}</div>
      <div class="kl-row">${tb('tool', 'pen', I.pen, L('Pen', 'Pisak'), tool === 'pen')}${tb('tool', 'eraser', I.eraser, L('Eraser', 'Gumka'), tool === 'eraser')}${tb('tool', 'fill', I.fill, L('Fill', 'Wypełnij'), tool === 'fill')}
        ${SIZES.map((s, i) => `<button type="button" class="kl-tb kl-sz" data-a="size" data-v="${i}" aria-label="${L('Line width', 'Grubość')} ${i + 1}" aria-pressed="${size === i}"><i style="--d:${6 + i * 5}px"></i></button>`).join('')}
        ${tb('undo', '', I.undo, L('Undo', 'Cofnij'))}${tb('clear', '', I.bin, L('Clear the board', 'Wyczyść tablicę'))}${tb('skip', '', I.skip, L('Give up this word', 'Poddaj to słowo'))}</div>`);
  }

  // ----- guesses and chat -----
  function line(e) {
    const p = S.seats[e.s], who = p ? `<b style="color:${esc(p.color)}">${esc(p.name)}</b>` : '';
    if (e.k === 'say') return `<p class="${e.in ? 'in' : ''}${e.s === S.me ? ' own' : ''}">${who} ${esc(e.text)}</p>`;
    if (e.k === 'ok') return `<p class="ok">✓ ${e.s === S.me ? L('You guessed the word!', 'Zgadujesz hasło!') : L(`${esc(p?.name)} guessed the word!`, `${esc(p?.name)} zgaduje hasło!`)} <b>+${e.pts}</b></p>`;
    if (e.k === 'near') return `<p class="near">„${esc(e.text)}” ${L('is so close!', 'jest bardzo blisko!')}</p>`;
    if (e.k === 'turn') return `<p class="sys">✏️ ${e.s === S.me ? L('Your turn to draw', 'Teraz rysujesz ty') : L(`${esc(p?.name)} is drawing`, `Rysuje: ${esc(p?.name)}`)}</p>`;
    if (e.k === 'word') return `<p class="sys">${L('The word was', 'Hasło to')} <b>${esc(e.w)}</b></p>`;
    if (e.k === 'join') return `<p class="sys">${L(`${esc(p?.name)} joins the game`, `${esc(p?.name)} dołącza do gry`)}</p>`;
    return '';
  }
  function renderFeed() {
    const el = $('kl-feed'), key = lastN + '/' + feed.length + '/' + S.me;
    if (key !== feedKey) {
      feedKey = key;
      const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      el.innerHTML = feed.map(line).join('') || `<p class="sys">${L('Guesses and chat show up here.', 'Tu pojawią się odpowiedzi i rozmowa.')}</p>`;
      if (stick) el.scrollTop = el.scrollHeight;
    }
    const live = S.ph === 'play' && S.st === 'draw';
    const ph = S.me < 0 ? L('You are watching', 'Oglądasz grę') : live && iDraw() ? L('Secret chat', 'Tajny czat')
      : live && S.got[S.me] ? L('Secret chat', 'Tajny czat') : live ? L('Type your guess…', 'Wpisz odpowiedź…') : L('Say something…', 'Napisz coś…');
    if (input.placeholder !== ph) input.placeholder = ph;
    input.disabled = S.me < 0 || S.ph !== 'play';
  }
  function playFeed(e) {
    if (e.k === 'say') { bubble(e.s, esc(e.text.length > 44 ? e.text.slice(0, 42) + '…' : e.text), e.in ? 'in' : ''); if (e.s !== S.me) sfx.pop(); }
    else if (e.k === 'ok') {
      bubble(e.s, '✓ +' + e.pts, 'ok', 2600); scene?.cheer(e.s);
      if (e.s === S.me) { sfx.set(); big(L('You got it!', 'Zgadnięte!'), `+${e.pts}`, 1500); } else sfx.plop();
    } else if (e.k === 'near') sfx.warn();
    else if (e.k === 'turn') { if (e.s === S.me) sfx.turn(); }
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('kl-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function render() {
    if (!S) return;
    $('kl-info').innerHTML = S.ph === 'end' ? L('Game over', 'Koniec gry') : `${L('Round', 'Runda')} ${S.round}/${S.opts.rounds}<span class="kl-turn"> · ${S.turn}/${S.turns}</span>`;
    $('kl-code').textContent = Rm?.code || '';
    inkEl.classList.toggle('draw', canDraw()); inkEl.dataset.tool = tool;
    buildTags(); renderWord(); renderOver(); renderTools(); renderFeed(); layout();
  }

  // ----- the drawing stream -----
  function askSync() { const now = performance.now(); if (now - askedAt < 1000) return; askedAt = now; ctx.act({ t: 'sync' }); }
  function takeOps(d) {
    if (!d) return;
    const live = S.ph === 'play' && (S.st === 'draw' || S.st === 'show');
    if (iDraw() && !d.full) { // your own strokes are already on your board; after a reload ask for them back
      if (!mine && d.n > 0 && live) askSync(); else have = d.n;
      return;
    }
    if (d.full) { board.reset(); have = d.from; mine = 1; }
    if (d.from > have || have - d.from > d.ops.length) { if (live) askSync(); return; }
    for (let i = have - d.from; i < d.ops.length; i++) board.apply(d.ops[i]);
    have = d.from + d.ops.length;
  }
  function push(op) {
    board.apply(op); mine++;
    const last = outbox[outbox.length - 1];
    if (op[0] === OP.MOVE && last && last[0] === OP.MOVE && last.length < 161) last.push(op[1], op[2]); else outbox.push(op.slice());
  }
  const flushTimer = setInterval(() => { if (outbox.length && canDraw()) ctx.act({ t: 'd', o: outbox.splice(0, 30) }); else if (!canDraw()) outbox.length = 0; }, 60);
  const at = e => { const r = inkEl.getBoundingClientRect(); return [Math.max(0, Math.min(BW, Math.round((e.clientX - r.left) / r.width * BW))), Math.max(0, Math.min(BH, Math.round((e.clientY - r.top) / r.height * BH)))]; };
  inkEl.addEventListener('pointerdown', e => {
    if (!canDraw() || e.button > 0 || pid !== null) return;
    e.preventDefault();
    const [x, y] = at(e);
    if (tool === 'fill') { push([OP.FILL, color, x, y]); sfx.plop(); return; }
    pid = e.pointerId; try { inkEl.setPointerCapture(pid); } catch {}
    push([OP.START, tool === 'eraser' ? WHITE : color, tool === 'eraser' ? Math.max(size, 2) : size, x, y]); lastPt = [x, y];
  });
  inkEl.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    if (!canDraw()) { pid = null; return; }
    e.preventDefault();
    for (const ev of e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e]) {
      const [x, y] = at(ev);
      if ((x - lastPt[0]) ** 2 + (y - lastPt[1]) ** 2 < 6) continue;
      push([OP.MOVE, x, y]); lastPt = [x, y];
    }
  });
  const penUp = e => { if (e.pointerId === pid) pid = null; };
  inkEl.addEventListener('pointerup', penUp); inkEl.addEventListener('pointercancel', penUp);
  inkEl.addEventListener('touchstart', e => { if (canDraw()) e.preventDefault(); }, { passive: false }); // no scrolling or zooming the page while drawing

  // ----- state from the server -----
  function update(s) {
    if (destroyed || !s) return;
    if (s.seats) seatsNow = s.seats; else s.seats = seatsNow;
    if (!s.seats) { askSync(); return; } // this screen just opened in the middle of a game: ask for the seats and the picture
    const fresh = s.gid !== gid, newTurn = fresh || s.tid !== tid, prev = S;
    S = s; leftAt = performance.now() + s.left;
    if (fresh) { gid = s.gid; hideResults(); clearTimeout(resultsTimer); feed = []; lastN = 0; feedKey = ''; }
    if (newTurn) { tid = s.tid; board.reset(); have = 0; mine = 0; outbox.length = 0; pid = null; tool = 'pen'; color = 0; size = 1; }
    takeOps(s.d);
    const news = (s.feed || []).filter(e => e.n > lastN);
    if (news.length) { feed.push(...news); if (feed.length > 80) feed.splice(0, feed.length - 80); lastN = news[news.length - 1].n; }
    render(); scene?.setState(s);
    if (!fresh || news.length <= 3) for (const e of news) playFeed(e);
    if (prev && !fresh) {
      if (prev.st !== 'show' && s.st === 'show' && s.last) { s.last.n ? sfx.set() : sfx.lose(); }
      if (prev.st !== 'draw' && s.st === 'draw') { sfx.draw(); if (iDraw()) big(esc(s.word), L('Draw it!', 'Rysuj!'), 1500); }
      if (prev.ph === 'play' && s.ph === 'end') {
        const won = s.win === s.me;
        big(L('Game over', 'Koniec gry'), s.win >= 0 ? (won ? L('You win!', 'Wygrywasz!') : L(`${nameOf(s.win)} wins!`, `Wygrywa ${nameOf(s.win)}!`)) : '', 2200);
        if (won) { sfx.win(); confetti(); } else sfx.set();
        clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
      }
    } else if (s.ph === 'end') showResults();
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res, mineP = S.me >= 0 ? R.place[S.me] : 0;
    const head = S.win < 0 ? L('Game over!', 'Koniec gry!') : S.win === S.me ? L('You win the game!', 'Wygrywasz grę!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      ${mineP > 1 ? `<p>${L(`You came ${mineP}${['th', 'st', 'nd', 'rd'][mineP] || 'th'}.`, `Twoje miejsce: ${mineP}.`)}</p>` : ''}
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i];
        return `<li class="${R.place[i] === 1 && R.pts[i] > 0 ? 'won' : ''}" style="animation-delay:${k * 80}ms"><i class="pos">${R.place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${L(`${cnt(R.hits[i], 'word', 'words')} guessed`, `Odgadnięte hasła: ${R.hits[i]}`)}</span></div>
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
    const i = S.seats.findIndex(p => p.id === m.id), t = lay?.seats?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(Math.max(0, Math.min(11, m.k | 0)));
    const x = t ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t ? t.head : innerHeight * .5;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
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
  $('kl-form').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || !S || S.me < 0) return;
    ctx.act({ t: 'g', text }); input.value = '';
  });
  const onKey = e => {
    if (canDraw() && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); push([OP.UNDO]); return; }
    if (e.metaKey || e.altKey || e.ctrlKey || e.target.closest?.('input, textarea, button')) return;
    // typing anywhere lands in the guess box
    if (e.key.length === 1 && !input.disabled && !canDraw() && root.querySelector('.results').hidden) input.focus();
  };
  addEventListener('keydown', onKey);
  // A phone's keyboard covers the bottom of the page: keep the whole game inside what is still visible.
  const vv = window.visualViewport;
  const onView = () => {
    if (vv) {
      const cut = innerHeight - vv.height > 120;
      root.style.height = cut ? vv.height + 'px' : ''; root.style.top = cut ? vv.offsetTop + 'px' : '';
      kb = cut && innerWidth < 760;
    }
    if (S) layout(); else place();
  };
  vv?.addEventListener('resize', onView); vv?.addEventListener('scroll', onView);
  addEventListener('resize', onView);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'pick') { sfx.click(); ctx.act({ t: 'pick', i: +b.dataset.i }); }
    else if (a === 'col') { sfx.tick(); color = +v; if (tool === 'eraser') tool = 'pen'; renderTools(); inkEl.dataset.tool = tool; }
    else if (a === 'tool') { sfx.tick(); tool = v; renderTools(); inkEl.dataset.tool = tool; }
    else if (a === 'size') { sfx.tick(); size = +v; renderTools(); }
    else if (a === 'undo') { if (canDraw()) { sfx.tick(); push([OP.UNDO]); } }
    else if (a === 'clear') { if (canDraw()) { sfx.whoosh(); push([OP.CLEAR]); } }
    else if (a === 'skip') { if (canDraw()) { sfx.click(); ctx.act({ t: 'skip' }); } }
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
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('keydown', onKey); removeEventListener('resize', onView);
      vv?.removeEventListener('resize', onView); vv?.removeEventListener('scroll', onView);
      clearInterval(clockTimer); clearInterval(flushTimer); clearTimeout(resultsTimer); clearTimeout(bigTimer); bubT.forEach(clearTimeout); scene?.dispose();
    },
  };
}
