// Mahjong Race game view: you clear your own board right here in the browser (the rules in rules.js) and tell the
// server about every pair; it draws the HUD over the 3D board: the clock, everyone's progress, results.
import { myBurst } from '../../winfx.js';
import { sfx } from '../../sfx.js';
import { L, cnt } from '../../i18n.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml, paidHtml, paintPaid } from '../../again.js';
import { reactHtml } from '../../react.js';
import { nameHtml, frameCls } from '../../cosmetics.js';
import { layout, layoutName, isFree, canPair, findMove, tilesLeft } from './rules.js';
import { I, clock, loadCss } from './solo.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const crown = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 18l-1-10 6 4 4-8 4 8 6-4-1 10z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>';
const HINT_WAIT = 8000; // a hint, then a wait before the next one
const tiles = n => cnt(n, 'tile', 'tiles', 'płytka', 'płytki', 'płytek');

export function mount(app, ctx) {
  loadCss('race');
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="mj race">
    <canvas class="g3d" aria-label="${L('Your board of tiles. Tap two free tiles with the same picture.', 'Twoja plansza z płytkami. Wskaż dwie wolne płytki z tym samym obrazkiem.')}"></canvas>
    <div class="hud">
      <div class="tl"><span class="chip" id="mj-time"></span><span class="chip" id="mj-left"></span></div>
      <div class="tr"><span class="tcode" id="mj-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="${L('Toggle sound', 'Włącz lub wyłącz dźwięk')}">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="${L('How to play', 'Jak grać')}">?</button>
        <button type="button" class="round" data-a="leave" aria-label="${L('Leave table', 'Odejdź od stołu')}">${I.door}</button></div>
      <div class="mj-racers" id="mj-racers"></div>
      <div class="banner" id="mj-banner" aria-live="polite"></div>
      <div class="shout" id="mj-big" aria-live="assertive"></div>
      <div class="mj-bottom" id="mj-bottom"><div class="mj-dock"><button type="button" class="btn w mj-tool" data-a="hint">${I.hint}<span>${L('Hint', 'Podpowiedź')}</span></button></div></div>
    </div>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.mj'), $ = id => root.querySelector('#' + id), canvas = root.querySelector('.g3d');
  let S = null, info = null, Rm = ctx.room(), scene = null, lay = null, destroyed = false, gid = null, lastEv = 0;
  let recvAt = 0, resultsTimer = 0, bigTimer = 0, lastCount = 99, clockTimer = 0, racersKey = '';
  // ----- your own board, played here -----
  let st = null, playing = false, picked = -1, cursor = -1, holdUntil = 0, hintAt = 0, pairsSeen = [];
  canvas.tileScreen = i => scene?.tileScreen(i) || null; canvas.board = () => scene?.board() || null; canvas.fps = () => scene?.fps(); canvas.stats = () => scene?.stats();

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas);
    if (S) { showBoard('fresh'); place(); }
  }).catch(err => { console.warn('3D unavailable', err); root.classList.add('flat'); });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; };
  const now = () => S ? S.t + (performance.now() - recvAt) : 0;
  const nameOf = i => esc(info?.[i]?.name ?? '');
  const held = () => performance.now() < holdUntil;
  function place() {
    if (!scene) return;
    const r = $('mj-racers').getBoundingClientRect(), wide = innerWidth > 700;
    scene.setHud(($('mj-bottom').offsetHeight || 56) + 20, wide ? 70 : Math.round(r.bottom) + 8);
  }
  function showBoard(mode) {
    if (!scene || !S) return;
    scene.setLayout(lay);
    scene.setPlayers(info.map(p => ({ color: p.color, av: p.av })), S.show);
    scene.setBoard(st ? st.b : S.mine.b, mode);
  }

  // ----- HUD -----
  function renderRacers() {
    const key = info.map(p => p.name + p.color).join('|') + S.show;
    const el = $('mj-racers');
    if (key !== racersKey) {
      racersKey = key;
      el.innerHTML = info.map((p, i) => `<div class="mj-racer${i === S.show ? ' me' : ''}" data-i="${i}">${avatarHtml(p.color, p.av, 30, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}</b><span class="bar"><i style="background:${esc(p.color)}"></i></span><em></em></div>`).join('');
    }
    info.forEach((p, i) => {
      const row = el.children[i], x = S.x[i]; if (!row) return;
      const left = i === S.me && st ? tilesLeft(st.b) : x[0];
      row.querySelector('i').style.width = `${Math.round(100 * (1 - left / lay.n))}%`;
      setHtml(row.querySelector('em'), x[3] ? '✓' : x[2] ? L('stuck', 'blokada') : String(left));
      row.classList.toggle('done', !!x[3]); row.classList.toggle('out', !!x[2]);
      row.classList.toggle('away', !!(p.bot && p.human));
    });
  }
  function renderClock() {
    if (!S) return;
    const t = now(), over = S.ph === 'end';
    setHtml($('mj-time'), S.stage === 'count' ? L('Get ready', 'Przygotuj się') : `<b>${clock(over ? S.res?.ms || 0 : t)}</b>`);
    if (S.stage === 'count') {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx.warn(); big(String(n), '', 800); }
    }
    renderBanner();
    const hb = root.querySelector('[data-a="hint"]');
    if (hb) { const wait = Math.ceil((hintAt + HINT_WAIT - performance.now()) / 1000), off = !canPlay() || wait > 0; if (hb.disabled !== off) hb.disabled = off; setHtml(hb.querySelector('span'), wait > 0 && canPlay() ? `${L('Hint', 'Podpowiedź')} ${wait}` : L('Hint', 'Podpowiedź')); }
  }
  function renderBanner() {
    const el = $('mj-banner'); let msg = '', hot = false;
    const mine = S.me >= 0 ? S.x[S.me] : null;
    if (S.ph !== 'play') msg = '';
    else if (S.stage === 'count') msg = L('First to clear the board wins', 'Wygrywa ten, kto pierwszy wyczyści planszę');
    else if (S.me < 0) msg = L(`Watching ${info[S.show]?.name ?? ''}`, `Oglądasz: ${info[S.show]?.name ?? ''}`);
    else if (info[S.me]?.bot) msg = L('A bot is playing for you', 'Bot gra za ciebie');
    else if (mine[2]) msg = L('Your last tiles lie on each other: you are stuck', 'Twoje ostatnie płytki leżą jedna na drugiej: blokada');
    else if (held()) { msg = L(`No pair left. Shuffling… ${Math.ceil((holdUntil - performance.now()) / 1000)}`, `Nie ma już pary. Mieszanie… ${Math.ceil((holdUntil - performance.now()) / 1000)}`); hot = true; }
    else if (st && tilesLeft(st.b) && !findMove(lay, st.b)) { msg = L('No pair left. Shuffling…', 'Nie ma już pary. Mieszanie…'); hot = true; }
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', hot);
  }
  function render() {
    if (!S || !info) return;
    $('mj-code').textContent = Rm?.code || '';
    const left = S.me >= 0 && st ? tilesLeft(st.b) : S.x[S.show][0];
    setHtml($('mj-left'), `${esc(layoutName(S.lay))} · <b>${left}</b> ${L('left', 'zostało')}`);
    renderRacers(); renderClock();
    root.classList.toggle('watching', !playing);
    place();
  }
  function big(text, sub = '', ms = 1400, cls = '') {
    const el = $('mj-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.className = 'shout ' + cls; void el.offsetWidth; el.classList.add('show'); el.style.setProperty('--ms', ms + 'ms');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function playEv(e) {
    const mine = e.s === S.me;
    if (e.t === 'go') { big(L('Go!', 'Start!'), '', 900); sfx.turn(); }
    else if (e.t === 'mix') { if (mine && playing) { sfx.warn(); big(L('No pair left!', 'Nie ma już pary!'), L('shuffling your tiles', 'mieszamy twoje płytki'), 1500, 'k4'); } }
    else if (e.t === 'stuck') { scene?.oops(e.s); if (mine) { sfx.lose(); big(L('Stuck!', 'Blokada!'), '', 1800, 'k4'); } else ctx.toast(L(`${nameOf(e.s)} is stuck!`, `${nameOf(e.s)}: blokada!`)); }
    else if (e.t === 'end') {
      scene?.cheer(e.w, true);
      if (e.w === S.me) { sfx.win(); myBurst(); big(L('You win!', 'Wygrana!'), S.res?.cleared ? L('board cleared', 'plansza wyczyszczona') : '', 2400, 'k3'); }
      else if (S.me >= 0) sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 1900);
    }
  }

  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function adopt(m, mode) { st = { sync: m.sync, n: m.n, b: m.b.slice() }; holdUntil = m.hold > 0 ? performance.now() + m.hold : 0; setPicked(-1); scene?.hint(null); if (scene) { scene.setLayout(lay); scene.setBoard(st.b, mode); } }
  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, was = S;
    S = s; recvAt = performance.now(); info = s.seats; lay = layout(s.lay);
    const news = fresh ? [] : (s.ev || []).filter(e => e.n > lastEv);
    const mixed = news.some(e => e.t === 'mix' && e.s === s.show);
    playing = s.me >= 0 && s.ph === 'play' && !info[s.me]?.bot && !s.mine.stuck;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); lastCount = 99; st = null; racersKey = ''; hintAt = 0; pairsSeen = s.x.map(x => x[1]);
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      if (playing) st = { sync: s.mine.sync, n: s.mine.n, b: s.mine.b.slice() };
      holdUntil = s.mine.hold > 0 ? performance.now() + s.mine.hold : 0;
      showBoard('fresh');
      if (s.ph === 'end') showResults(); else sfx.draw();
    } else if (playing) {
      const m = s.mine;
      if (!st || m.sync !== st.sync) adopt(m, mixed ? 'mix' : undefined);
      else if (m.n === st.n && !same(st.b, m.b)) adopt(m);
    } else {
      // watching (or a bot has your seat): the server's board is the one to show
      if (st || was?.show !== s.show) { st = null; setPicked(-1); showBoard(); }
      else if (scene) { scene.setLayout(lay); scene.setBoard(s.mine.b, mixed ? 'mix' : undefined); }
    }
    s.x.forEach((x, i) => { if (x[1] > (pairsSeen[i] || 0) && i !== s.me) scene?.hop(i); pairsSeen[i] = x[1]; });
    render();
    for (const e of news) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res || !info) return;
    const el = root.querySelector('.results'), R = S.res, w = S.win;
    el.innerHTML = `<div class="sheet">
      <h2>${crown}${w === S.me ? L('You win!', 'Wygrana!') : L(`${nameOf(w)} wins!`, `Wygrywa ${nameOf(w)}!`)}</h2>
      <p>${R.cleared ? L(`Board cleared in ${clock(R.time[w])}`, `Plansza wyczyszczona w ${clock(R.time[w])}`) : L(`Nobody cleared the board. Fewest tiles left wins.`, `Nikt nie wyczyścił planszy. Wygrywa najmniej płytek na planszy.`)}</p>
      <ol class="mj-podium">${R.order.map((i, n) => { const p = info[i];
        return `<li class="${i === S.me ? 'mj-me' : ''}${n === 0 ? ' won' : ''}" style="animation-delay:${n * 90}ms"><em>${n + 1}</em>${avatarHtml(p.color, p.av, 34, frameCls(p.fl))}<b>${nameHtml(p.name, p.fl)}${i === S.me ? L(' (you)', ' (ty)') : ''}</b>
          <strong>${R.time[i] ? clock(R.time[i]) : L(`${tiles(R.left[i])} left`, `zostało: ${R.left[i]}`)}</strong><small>${L(`${cnt(R.pairs[i], 'pair')}`, `pary: ${R.pairs[i]}`)}${R.mixes[i] ? ' · ' + L(`${cnt(R.mixes[i], 'shuffle')}`, `mieszanie: ${R.mixes[i]}`) : ''}</small>${paidHtml(Rm, i)}</li>`; }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, L('Play again', 'Zagraj jeszcze raz'))}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
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
    const i = info.findIndex(p => p.id === m.id), t = $('mj-racers').children[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const r = t ? t.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : innerWidth / 2 + (Math.random() * 120 - 60), y = r ? r.bottom + 60 : innerHeight * .3;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  // ----- input -----
  const canPlay = () => playing && st && scene && S.stage === 'go' && !held();
  function setPicked(i) { picked = i; scene?.setPicked(i); }
  function tap(i) {
    if (!canPlay() || i < 0) { setPicked(-1); return; }
    if (!isFree(lay, st.b, i)) { sfx.bad(); scene.bad(i); return; }
    scene.hint(null);
    if (picked === i) { setPicked(-1); sfx.hover(); return; }
    if (picked >= 0 && canPair(lay, st.b, picked, i)) {
      const a = picked; setPicked(-1);
      st.b[a] = st.b[i] = -1; st.n++;
      sfx.pop(); scene.take(a, i); scene.hop(S.me);
      ctx.act({ t: 'p', y0: st.sync, n: st.n, a, b: i });
      render(); return;
    }
    setPicked(i); sfx.click();
  }
  function hint() {
    if (!canPlay() || performance.now() < hintAt + HINT_WAIT) return;
    const m = findMove(lay, st.b); if (!m) return;
    hintAt = performance.now(); sfx.click(); scene.hint(m); renderClock();
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (!scene || !root.querySelector('.results').hidden) return;
    tap(scene.pick(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene) return;
    const i = scene.pick(e.clientX, e.clientY), ok = canPlay() && i >= 0 && isFree(lay, st.b, i);
    if (i !== cursor) { cursor = i; scene.setHover(ok ? i : -1); }
    canvas.style.cursor = ok ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { cursor = -1; scene?.setHover(-1); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const onKey = e => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey || !root.querySelector('.results').hidden) return;
    const k = e.key.toLowerCase();
    if (k === 'h') { e.preventDefault(); hint(); } else if (k === 'escape') setPicked(-1);
  };
  addEventListener('keydown', onKey);
  const onResize = () => { if (S) render(); };
  addEventListener('resize', onResize);
  clockTimer = setInterval(renderClock, 250);
  canvas.tap = tap;

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'hint') hint();
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
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
      destroyed = true; document.body.classList.remove('in-game');
      removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      clearTimeout(resultsTimer); clearTimeout(bigTimer); clearInterval(clockTimer); scene?.dispose();
    },
  };
}
