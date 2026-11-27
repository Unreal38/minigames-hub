// Państwa-miasta game view: the letter, your answer sheet and the checking list over the 3D table.
// Renders what the server says. What you type is kept here and sent as you go, so nothing is lost when time runs out.
import { myBurst, seatBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, ord } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, titleHtml, frameCls, pbRowCls, pbRows, rowBg } from '../../cosmetics.js';
import { tagPlacer, tagFace, tagCls, tagBg } from '../../nametag.js';
import { catName, clean, starts, MAXLEN } from './rules.js';
import { uiz } from '../../uiz.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  no: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="#3b2219" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h9.2c1 0 1.9.7 2.1 1.7l1.2 6.4c.3 1.5-.8 2.9-2.3 2.9H14l.7 3.6c.3 1.5-.8 2.9-2.3 2.9-.5 0-.9-.3-1.1-.7L8 14z"/><path d="M3.5 3H8v11H3.5z"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
// why an answer scores nothing
const WHY = { empty: () => L('nothing', 'brak'), letter: () => L('wrong letter', 'zła litera'), nopet: () => L('not a pet', 'nie ma takiego zwierzaka'), out: () => L('rejected', 'odrzucone'), closed: () => '' };

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./pm.css', import.meta.url).href; document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="pm">
    <canvas class="g3d" aria-label="${L('The table with the letter block', 'Stół z kostką z literą')}"></canvas>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="pm-info"></span><div class="pm-board" id="pm-board" role="list" aria-label="${L('Points', 'Punkty')}" hidden></div></div>
      <div class="tr"><span class="tcode" id="pm-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L(`Toggle sound`, `Włącz lub wyłącz dźwięk`)}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L(`How to play`, `Jak grać`)}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L(`Leave table`, `Odejdź od stołu`)}">${I.door}</button></div>
      <div class="banner" id="pm-banner" aria-live="polite"></div>
      <div class="shout" id="pm-big" aria-live="assertive"></div>
      <div class="pm-dock" id="pm-dock">
        <div class="pm-side" id="pm-side">
          <div class="pm-head" id="pm-head"></div>
          <div class="pm-body" id="pm-body"></div>
          <div class="pm-foot" id="pm-foot"></div>
        </div>
      </div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.pm'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags'), placer = tagPlacer(tagsEl);
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0, live = null;
  let tagEls = [], tagKey = '', resultsTimer = 0, bigTimer = 0, sendTimer = 0;
  let mine = [], formKey = '', bodyMode = '', sentKey = '', deadline = 0, stageKey = '', inset = 0, stopSent = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) { scene.setState(S); layout(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const nameOf = i => esc(S.seats[i]?.name);
  const playing = () => !!(S && S.ph === 'play' && me());
  const wide = () => innerWidth >= 640 && innerWidth / innerHeight > 1.15;
  const writing = () => S.ph === 'play' && (S.stage === 'write' || S.stage === 'stop');
  const checking = () => S.stage === 'check' || S.stage === 'score' || S.ph === 'end';
  const secLeft = () => Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  // points each seat is getting this round: live while the answers are being checked, final once scored
  const roundPts = () => S.stage === 'check' && S.marks ? S.marks.map(row => row.reduce((n, m) => n + m.pts, 0)) : S.stage === 'score' && S.last ? S.last : null;
  const allGood = () => S.cats.every((_, c) => !S.open[c] || starts(mine[c] || '', S.letter));

  function onFrame(info) {
    live = info;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (t.mine) { el.style.display = 'none'; continue; }
      el.style.display = '';
      if (!el._w || el._w > innerWidth * .6) el._w = el.offsetWidth;
      const half = (el._w || 120) / 2 + 4, x = Math.max(half, Math.min(innerWidth - inset - half, t.x));
      placer.add(el, t.x, t.y);
    }
  }
  function layout() {
    root.classList.toggle('wide', wide());
    root.classList.toggle('checking', !!S && checking());
    if (!scene) return;
    const side = $('pm-side');
    inset = wide() ? (side.offsetWidth + 28) * uiz() : 0;
    if (wide()) { scene.setInset(inset); scene.setHud((innerHeight < 520 ? 20 : 84) * uiz()); }
    else { scene.setInset(0); scene.setHud((side.offsetHeight + 26) * uiz()); }
  }

  // ----- name tags over the avatars: name, points so far, and what they are up to -----
  function buildTags() {
    const key = S.seats.map(p => p.name + p.color).join('|') + S.me;
    if (key !== tagKey) {
      tagKey = key;
      tagsEl.innerHTML = S.seats.map(p => `<div class="pm-tag"><div class="bub"></div><div class="plate${tagCls(p)}">${tagFace(p)}<span class="cnt"></span>${tagBg(p)}</div></div>`).join('');
      tagEls = [...tagsEl.children]; placer.reset();
    }
    const pend = roundPts();
    S.seats.forEach((p, i) => {
      const el = tagEls[i]; if (!el) return;
      let bub = '', hot = false;
      if (S.ph === 'end') { hot = S.res?.place[i] === 1; }
      else if (p.bot) bub = `<span class="away">${L('away', 'nieobecny')}</span>`;
      else if (S.stage === 'stop' && S.stopBy === i) { bub = `<span class="win">Stop!</span>`; hot = true; }
      else if (writing()) bub = S.fill[i] >= S.nOpen ? `<span>${I.ok}</span>` : `<span>${S.fill[i]}/${S.nOpen}</span>`;
      else if (S.stage === 'check') bub = S.ready[i] ? `<span>${I.ok} ${L('ready', 'gotowe')}</span>` : '';
      else if (S.stage === 'score' && S.last) bub = `<span class="win">+${S.last[i]}</span>`;
      el.classList.toggle('now', hot);
      setHtml(el.querySelector('.plate .cnt'), String(S.tot[i]) + (pend && S.ph === 'play' && S.stage === 'check' && pend[i] > 0 ? `<em>+${pend[i]}</em>` : ''));
      setHtml(el.firstElementChild, bub);
    });
    for (const el of tagEls) el._w = el.offsetWidth;
  }

  // ----- the small score table in the top left: everyone's total, and this round's points while the answers are checked -----
  function renderBoard() {
    const el = $('pm-board'), pend = S.ph === 'play' && S.stage === 'check' ? roundPts() : null;
    const sum = i => S.tot[i] + (pend?.[i] || 0);
    let order = S.seats.map((_, i) => i).sort((a, b) => sum(b) - sum(a) || a - b);
    // on a phone the table would cover the island: the top three and you
    if (!wide() && order.length > 4) order = order.filter((i, k) => k < 3 || i === S.me);
    el.hidden = !S.seats.length;
    setHtml(el, order.map(i => {
      const p = S.seats[i];
      return `<div class="${pbRowCls(p.fl)} pm-sc${i === S.me ? ' mine' : ''}" role="listitem"><i class="dot" style="background:${esc(p.color)}"></i><b class="who">${i === S.me ? L('You', 'Ty') : nameHtml(p.name, p.fl)}</b>${pend && pend[i] > 0 ? `<em>+${pend[i]}</em>` : ''}<span class="tot">${sum(i)}</span>${rowBg(p.fl)}</div>`;
    }).join(''));
    pbRows(el);
  }

  // ----- the head of the panel: the letter, what is going on and the clock -----
  function renderHead() {
    const el = $('pm-head'), st = S.stage;
    const title = S.ph === 'end' ? L('Game over', 'Koniec gry')
      : st === 'draw' ? L('Drawing a letter…', 'Losujemy literę…')
        : st === 'write' ? L('Write a word for each one', 'Wpisz hasło w każdym polu')
          : st === 'stop' ? (S.stopBy === S.me ? L('You called Stop!', 'Wołasz „Stop!”') : L(`${nameOf(S.stopBy)} called Stop!`, `${nameOf(S.stopBy)}: „Stop!”`))
            : st === 'grace' ? L('Pencils down!', 'Długopisy w górę!')
              : st === 'check' ? L('Check the answers', 'Sprawdźcie odpowiedzi')
                : L('Points for this round', 'Punkty za tę rundę');
    const clock = S.ph === 'play' && st !== 'draw' && st !== 'grace';
    setHtml(el, `<span class="pm-letter${st === 'draw' ? ' roll' : ''}" aria-label="${L('Letter', 'Litera')} ${esc(S.letter || '?')}">${esc(S.letter || '?')}</span>
      <div class="pm-headtx"><b>${title}</b>
        <div class="pm-clock"${clock ? '' : ' hidden'}><div class="pm-bar"><i></i></div><span class="pm-sec"></span></div></div>`);
    const key = S.gid + '/' + S.round + '/' + st;
    if (key !== el._bar && clock) {
      const bar = el.querySelector('.pm-bar i'), done = Math.max(0, S.all - S.left);
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `pmbar ${S.all}ms linear ${-done}ms both`;
    }
    el._bar = key;
    paintClock();
  }
  function paintClock() {
    if (!S) return;
    const el = root.querySelector('.pm-sec'); if (!el) return;
    const s = secLeft(), txt = s >= 60 ? `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}` : `${s} s`;
    if (el.textContent !== txt) el.textContent = txt;
    const hurry = writing() && s <= 10;
    el.classList.toggle('hurry', hurry);
    if (hurry && el._s !== s && s > 0 && s <= 5 && S.me >= 0) sfx.tick();
    el._s = s;
  }
  const clockTimer = setInterval(paintClock, 200);

  // ----- your sheet: one box per category -----
  function renderForm() {
    const body = $('pm-body'), key = S.gid + '/' + S.round + '/' + S.me;
    if (bodyMode !== 'form' || key !== formKey) {
      bodyMode = 'form'; formKey = key; body._h = null;
      body.innerHTML = S.me < 0
        ? `<div class="pm-watch"></div>`
        : `<div class="pm-form${S.cats.length > 7 ? ' many' : ''}">${S.cats.map((cat, c) => `<label class="pm-box${S.open[c] ? '' : ' closed'}" data-c="${c}"><span>${esc(catName(cat))}</span>
            ${S.open[c] ? `<input type="text" data-c="${c}" maxlength="${MAXLEN}" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="${c === S.cats.length - 1 ? 'done' : 'next'}" value="${esc(mine[c] || '')}"><i class="pm-mark" aria-hidden="true"></i>`
            : `<em>${L('No pet starts with this letter', 'Żaden zwierzak nie zaczyna się na tę literę')}</em>`}</label>`).join('')}</div>`;
    }
    if (S.me < 0) {
      setHtml(body.firstElementChild, `<p>${S.stage === 'draw' ? L('The letter is being drawn…', 'Trwa losowanie litery…') : L('Everyone is writing. The answers show up when the round is over.', 'Wszyscy piszą. Odpowiedzi pokażą się po zakończeniu rundy.')}</p>
        <ul>${S.seats.map((p, i) => `<li><i class="dot" style="background:${esc(p.color)}"></i><b>${nameHtml(p.name, p.fl)}</b><span>${S.fill[i]}/${S.nOpen}</span></li>`).join('')}</ul>`);
      return;
    }
    const on = writing() && !me().bot;
    for (const inp of body.querySelectorAll('input')) {
      const c = +inp.dataset.c;
      if (inp.disabled === on) inp.disabled = !on;
      const ph = S.letter ? S.letter + '…' : '';
      if (inp.placeholder !== ph) inp.placeholder = ph;
      paintBox(inp.parentElement, c);
    }
  }
  function paintBox(box, c) {
    const v = mine[c] || '', bad = !!v && !!S.letter && !starts(v, S.letter);
    box.classList.toggle('good', !!v && !bad); box.classList.toggle('bad', bad);
    const m = box.querySelector('.pm-mark'); if (m) setHtml(m, v && !bad ? I.ok : bad ? '!' : '');
  }

  // ----- everyone's answers, category by category, with the thumbs -----
  function renderCheck() {
    const body = $('pm-body');
    if (bodyMode !== 'check') { bodyMode = 'check'; formKey = ''; body._h = null; body.scrollTop = 0; }
    if (!S.ans || !S.marks) { setHtml(body, ''); return; }
    const voting = S.stage === 'check' && S.me >= 0 && !me().bot;
    const html = S.cats.map((cat, c) => {
      if (!S.open[c]) return `<section class="pm-cat closed"><h4>${esc(catName(cat))}</h4><p>${L(`No pet starts with ${S.letter}.`, `Żaden zwierzak nie zaczyna się na ${S.letter}.`)}</p></section>`;
      const mk = S.me >= 0 ? S.marks[S.me][c] : null, myWord = mk && !['empty', 'letter', 'closed'].includes(mk.st) ? mk.k : '';
      const rows = S.seats.map((p, i) => {
        const m = S.marks[i][c], word = S.ans[i][c], good = m.pts > 0, votable = cat !== 'pet' && ['solo', 'uniq', 'dup', 'out'].includes(m.st);
        const mineNo = votable && (S.votes?.[c]?.[m.k] || []).includes(S.me);
        const can = voting && votable && m.k !== myWord;
        const note = good ? (m.st === 'dup' ? L('same word', 'to samo hasło') : m.st === 'solo' ? L('only answer', 'jedyne hasło') : '') : WHY[m.st]?.() || '';
        const thumb = can ? `<button type="button" class="pm-no" data-a="vote" data-c="${c}" data-s="${i}" aria-pressed="${mineNo}" aria-label="${L('Reject', 'Odrzuć')}: ${esc(word)}">${I.no}${m.no ? `<b>${m.no}/${m.need}</b>` : ''}</button>`
          : S.stage === 'check' && votable && m.no ? `<span class="pm-no off">${I.no}<b>${m.no}/${m.need}</b></span>` : '';
        return `<div class="pm-row st-${m.st}${i === S.me ? ' mine' : ''}"><i class="dot" style="background:${esc(p.color)}"></i><b class="who">${nameHtml(p.name, p.fl)}</b>
          <span class="word${word.split(' ').some(w => w.length > 12) ? ' lw' : ''}"><span>${word ? esc(word) : '—'}</span>${note ? `<small>${note}</small>` : ''}</span>${thumb}<span class="pts">${good ? '+' + m.pts : '0'}</span></div>`;
      }).join('');
      return `<section class="pm-cat"><h4>${esc(catName(cat))}</h4>${rows}</section>`;
    }).join('');
    setHtml(body, `<div class="pm-check">${html}</div>`);
  }

  function renderFoot() {
    const el = $('pm-foot');
    if (!S || S.ph !== 'play') { setHtml(el, ''); return; }
    const st = S.stage, p = me();
    if (st === 'check') {
      const here = S.seats.filter(x => !x.bot).length, rdy = S.seats.filter((x, i) => !x.bot && S.ready[i]).length;
      const hint = L(`Thumb down what is wrong. Ready: ${rdy} of ${here}`, `Odrzuć kciukiem błędne hasła. Gotowi: ${rdy} z ${here}`);
      setHtml(el, p && !p.bot ? `<button type="button" class="btn big m pm-go" data-a="ready" aria-pressed="${!!S.ready[S.me]}">${S.ready[S.me] ? I.ok + ' ' : ''}${L('Ready', 'Gotowe')}</button><p class="pm-hint">${hint}</p>` : `<p class="pm-hint">${hint}</p>`);
    } else if (st === 'score') {
      const mineP = S.me >= 0 && S.last ? S.last[S.me] : null, more = S.round + 1 < S.rounds;
      setHtml(el, `<p class="pm-hint big">${mineP != null ? L(`You scored ${mineP} this round. `, `Twoje punkty w tej rundzie: ${mineP}. `) : ''}${more ? L('Next letter in a moment…', 'Za chwilę następna litera…') : L('That was the last round.', 'To była ostatnia runda.')}</p>`);
    } else if (!p) setHtml(el, '');
    else {
      const ready = st === 'write' && allGood();
      const hint = st === 'draw' ? L('Get ready…', 'Przygotuj się…')
        : st === 'stop' ? L('Last seconds: finish your words!', 'Ostatnie sekundy: kończ hasła!')
          : st === 'grace' ? L('Time is up.', 'Koniec czasu.')
            : ready ? L('Every box is filled. Call it!', 'Wszystkie pola pełne. Wołaj!')
              : L('Fill every box to call Stop.', 'Wypełnij wszystkie pola, żeby zawołać „Stop!”.');
      setHtml(el, `<button type="button" class="btn big r pm-go${ready ? ' ready' : ''}" data-a="stop" aria-disabled="${!ready}">Stop!</button><p class="pm-hint">${hint}</p>`);
    }
  }

  function renderBanner() {
    const el = $('pm-banner'); let msg = '';
    if (S.ph === 'end') msg = !wide() ? '' /* the results sheet says it, and on a phone the strip would sit under the buttons */ : S.res.place.filter(x => x === 1).length !== 1 ? L('Shared first place!', 'Wspólne pierwsze miejsce!') : S.win === S.me ? L('You win!', 'Wygrywasz!') : L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`);
    else if (S.stage === 'stop') msg = S.stopBy === S.me ? 'Stop!' : `Stop! ${nameOf(S.stopBy)}`;
    else if (S.letter && wide()) msg = L(`Letter ${S.letter}`, `Litera ${S.letter}`);
    if (el.innerHTML !== msg) el.innerHTML = msg;
    el.classList.toggle('hot', S.stage === 'stop');
  }

  function render() {
    if (!S) return;
    $('pm-info').innerHTML = S.ph === 'end' ? L('Game over', 'Koniec gry') : `${L('Round', 'Runda')} ${S.round + 1}/${S.rounds}`;
    $('pm-code').textContent = Rm?.code || '';
    renderBoard();
    root.classList.toggle('checking', checking());
    buildTags(); renderHead();
    if (checking()) renderCheck(); else renderForm();
    renderFoot(); renderBanner(); layout();
  }

  function big(text, sub = '', ms = 1500) {
    const el = $('pm-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.style.setProperty('--ms', ms + 'ms'); el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    if (e.t === 'draw') sfx.draw();
    else if (e.t === 'go') {
      sfx.set(); big(esc(S.letter), L('Write!', 'Piszemy!'), 1300);
      if (S.me >= 0 && !matchMedia('(pointer: coarse)').matches) root.querySelector('.pm-form input:not([disabled])')?.focus({ preventScroll: true }); // on a phone the keyboard would jump up over the letter
    } else if (e.t === 'stop') { e.s === S.me ? sfx.win() : sfx.warn(); big('Stop!', e.s === S.me ? L('The others get 5 more seconds', 'Pozostali mają jeszcze 5 sekund') : L(`${nameOf(e.s)} is done · 5 more seconds`, `${nameOf(e.s)} kończy · jeszcze 5 sekund`), 1700); }
    else if (e.t === 'lock') { flush(); sfx.thunk(); document.activeElement?.blur?.(); }
    else if (e.t === 'score') {
      const p = S.me >= 0 ? e.pts[S.me] : -1, best = Math.max(...e.pts);
      if (p >= 0) { p > 0 && p === best ? sfx.combo(Math.min(8, p / 10)) : sfx.pop(); big('+' + p, L(`Round ${S.round + 1}`, `Runda ${S.round + 1}`), 1500); }
    } else if (e.t === 'end') {
      if (e.w === S.me && S.me >= 0) { sfx.win(); confetti(); } else if (S.me >= 0) { sfx.lose(); if (e.w >= 0 && !seatBurst(e.w)) confetti(false); }
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2200);
    }
  }

  // ----- sending what you typed -----
  function flush() {
    clearTimeout(sendTimer); sendTimer = 0;
    if (!S || S.me < 0 || S.ph !== 'play') return;
    const key = S.gid + '/' + S.round + '/' + mine.join('\u0001');
    if (key === sentKey) return;
    sentKey = key; ctx.act({ t: 'ans', a: mine.slice() });
  }
  const sendSoon = () => { if (!sendTimer) sendTimer = setTimeout(flush, 250); };

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, key = s.gid + '/' + s.round + '/' + s.stage, newRound = !S || fresh || S.round !== s.round || S.me !== s.me;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (s.ph === 'end') showResults();
    }
    // a new round (or coming back to the table): start from what the server has for you
    if (newRound) { mine = s.cats.map((_, c) => s.mine?.[c] || ''); sentKey = s.gid + '/' + s.round + '/' + mine.join('\u0001'); formKey = ''; stopSent = 0; }
    if (key !== stageKey || Math.abs(deadline - (performance.now() + s.left)) > 700) deadline = performance.now() + s.left;
    stageKey = key;
    render(); scene?.setState(s);
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), R = S.res;
    const solo = R.place.filter(x => x === 1).length === 1, mineP = S.me >= 0 ? R.place[S.me] : 0;
    const head = mineP === 1 && solo ? L('You win the game!', 'Wygrywasz grę!') : solo ? L(`${nameOf(S.win)} wins!`, `Wygrywa ${nameOf(S.win)}!`) : L('Shared first place!', 'Wspólne pierwsze miejsce!');
    const sub = (R.hist.length ? L(`Letters: ${R.hist.map(h => h.l).join(', ')}.`, `Litery: ${R.hist.map(h => h.l).join(', ')}.`) : L('The game ended early.', 'Gra skończyła się przed czasem.')) + (mineP > 1 ? ' ' + L(`You came ${ord(mineP)}.`, `Twoje miejsce: ${mineP}.`) : '');
    el.innerHTML = `<div class="sheet">
      <h2>${head}</h2>
      <p>${sub}</p>
      <ol class="score">${R.order.map((i, k) => {
        const p = S.seats[i], best = R.hist.reduce((b, h) => (h.pts[i] > (b?.pts[i] ?? -1) ? h : b), null);
        const note = best && best.pts[i] > 0 ? L(`Best letter: ${best.l} +${best.pts[i]}`, `Najlepsza litera: ${best.l} +${best.pts[i]}`) : L('No points this time', 'Tym razem bez punktów');
        return `<li class="${pbRowCls(p.fl)} ${R.place[i] === 1 ? 'won' : ''}" style="animation-delay:${k * 80}ms"><i class="pos">${R.place[i]}</i>${avatarHtml(p.color, p.av, 44, frameCls(p.fl))}
          <div class="who"><b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b><span>${note}</span></div>
          <strong><span>${R.tot[i]}</span><small>${L('pts', 'pkt')}</small></strong>${paidHtml(Rm, i)}${rowBg(p.fl)}</li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm)}</div></div>`;
    pbRows(el); el.hidden = false; votes = (Rm?.again || []).length;
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
  const nope = el => { sfx.bad(); el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };
  root.addEventListener('input', e => {
    const inp = e.target.closest('.pm-form input'); if (!inp || !S || !writing()) return;
    const c = +inp.dataset.c, was = mine[c] || '';
    mine[c] = clean(inp.value);
    paintBox(inp.parentElement, c);
    if (!was && mine[c] && starts(mine[c], S.letter)) sfx.place();
    sendSoon(); renderFoot();
  });
  // Enter (or Next on a phone keyboard) jumps to the next empty box; on the last one it calls Stop when everything is filled
  root.addEventListener('keydown', e => {
    const inp = e.target.closest?.('.pm-form input'); if (!inp || e.key !== 'Enter') return;
    e.preventDefault();
    const all = [...root.querySelectorAll('.pm-form input:not([disabled])')], i = all.indexOf(inp);
    const next = [...all.slice(i + 1), ...all.slice(0, i)].find(x => !starts(x.value, S.letter));
    if (next) next.focus(); else if (allGood()) stop(root.querySelector('.pm-go'));
  });
  function stop(el) {
    if (!playing() || S.stage !== 'write') return;
    if (!allGood()) { if (el) nope(el); root.querySelector('.pm-box:not(.good):not(.closed) input')?.focus(); return; }
    if (Date.now() - stopSent < 1500) return;
    stopSent = Date.now(); clearTimeout(sendTimer); sendTimer = 0;
    sentKey = S.gid + '/' + S.round + '/' + mine.join('\u0001');
    sfx.click(); ctx.act({ t: 'stop', a: mine.slice() });
  }
  const onResize = () => { if (S) layout(); };
  addEventListener('resize', onResize);
  // a phone keyboard covers the bottom of the screen: lift the panel above it
  const vv = window.visualViewport;
  const onKb = () => { const kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0, up = kb > 90; root.style.setProperty('--kb', (up ? kb / uiz() : 0) + 'px'); root.classList.toggle('kb', up); if (S) layout(); };
  vv?.addEventListener('resize', onKb); vv?.addEventListener('scroll', onKb);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'stop') stop(b);
    else if (a === 'vote') { sfx.click(); ctx.act({ t: 'vote', c: +b.dataset.c, s: +b.dataset.s, on: b.getAttribute('aria-pressed') !== 'true' }); }
    else if (a === 'ready') { sfx.click(); ctx.act({ t: 'ready', on: b.getAttribute('aria-pressed') !== 'true' }); }
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
      destroyed = true; document.body.classList.remove('in-game'); removeEventListener('resize', onResize); vv?.removeEventListener('resize', onKb); vv?.removeEventListener('scroll', onKb);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); clearTimeout(sendTimer); clearInterval(clockTimer); scene?.dispose();
    },
  };
}
