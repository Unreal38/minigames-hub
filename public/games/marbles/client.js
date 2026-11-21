// Marble Rush game view: HUD over the 3D track. Renders what the server says; sends bets and bananas.
import { sfx } from '../../sfx.js';
import { avatarHtml } from '../../avatar.js';
import { againHtml } from '../../again.js';
import { reactHtml } from '../../react.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  sound: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  door: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  coin: '<svg class="coin" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffb547" stroke="#3b2219" stroke-width="2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#3b2219" stroke-width="2" opacity=".55"/></svg>',
  banana: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 6c1 9 7 14 16 13-2 3-13 4-17-5C2 11 2 8 4 6z" fill="#ffd84a" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/><path d="M4 6l1-3" stroke="#3b2219" stroke-width="2.4" stroke-linecap="round"/></svg>',
};
const CHAOS = {
  flip: ['Gravity flip!', 'Everything rolls backwards'],
  turbo: ['Turbo!', 'Everyone gets a shove'],
  quake: ['Marblequake!', 'Hold on to something'],
  swap: ['Switcheroo!', ''],
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./marbles.css', import.meta.url).href;
  document.head.append(l);
}

export function mount(app, ctx) {
  loadCss();
  document.body.classList.add('in-game');
  app.innerHTML = `<div class="mr">
    <canvas class="g3d" aria-hidden="true"></canvas>
    <div class="tint" aria-hidden="true"></div>
    <div class="tags" aria-hidden="true"></div>
    <div class="hud">
      <div class="tl"><span class="chip" id="mr-mode"></span><span class="chip coins" id="mr-coins"></span></div>
      <div class="tr"><span class="tcode" id="mr-code"></span>
        <button type="button" class="round" data-a="mute" aria-label="Toggle sound">${sfx.muted ? I.mute : I.sound}</button>
        <button type="button" class="round" data-a="rules" aria-label="How to play">?</button>
        <button type="button" class="round" data-a="leave" aria-label="Leave table">${I.door}</button></div>
      <div class="banner" id="mr-banner" aria-live="polite"></div>
      <div class="shout" id="mr-big" aria-live="assertive"></div>
      <ol class="board" id="mr-board" aria-label="Race order"></ol>
      <div class="betbox" id="mr-bet" hidden></div>
      <div class="racebar" id="mr-race" hidden></div>
    </div>
    <canvas class="confetti" aria-hidden="true"></canvas>
    <div class="results" hidden></div>
  </div>`;
  const root = app.querySelector('.mr'), $ = id => root.querySelector('#' + id);
  const canvas = root.querySelector('.g3d'), tagsEl = root.querySelector('.tags');
  let S = null, Rm = ctx.room(), scene = null, destroyed = false, gid = null, lastEv = 0;
  let stake = 25, follow = 'lead', picking = false, order = [], live = null, tagEls = [], tagKey = '';
  let resultsTimer = 0, bigTimer = 0, lastCount = -1, endsAt = 0, boardAt = 0;

  import('./scene3d.js').then(m => {
    if (destroyed) return;
    scene = m.createScene(canvas, { onFrame });
    if (S) sync();
  }).catch(err => {
    console.warn('3D unavailable', err);
    root.classList.add('flat');
  });

  const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
  const me = () => (S && S.me >= 0 ? S.seats[S.me] : null);
  const myPick = () => me()?.bet?.m ?? -1;
  const mName = i => esc(S.marbles[i]?.name);
  const ball = (i, size = 28) => `<i class="ball" style="--c:${S.marbles[i].color};--z:${size}px"></i>`;
  const racing = i => !S.marbles[i].out;
  const backers = i => S.seats.map((p, k) => (p.bet?.m === i ? k : -1)).filter(k => k >= 0);
  const backerHtml = (i, size) => backers(i).map(k => `<i title="${esc(S.seats[k].name)} bet ${S.seats[k].bet.amt}">${avatarHtml(S.seats[k].color, S.seats[k].av, size)}</i>`).join('');
  const undecided = () => S.seats.map((_, i) => i).filter(i => S.seats[i].human && !S.seats[i].bot && !S.seats[i].bet);
  const yours = i => (i === myPick() ? 'Your pick, ' : '');

  // ----- 3D sync -----
  function sync() {
    if (!scene || !S) return;
    scene.setTrack(S.seed, S.short);
    scene.setMarbles(S.marbles);
    scene.setMe(myPick());
    scene.setStage(S.stage);
    scene.pushFrames(S.frames || [], S.simT, S.stage === 'race');
    scene.setChaos(S.stage === 'race' ? S.chaos?.k : null);
    const f = follow === 'bet' ? myPick() : Number.isInteger(follow) ? follow : -1;
    scene.setFollow(f >= 0 && racing(f) ? f : -1);
    root.querySelector('.tint').className = 'tint' + (S.stage === 'race' && S.chaos ? ' ' + S.chaos.k : '');
  }

  // Called by the scene every frame with screen positions and live distances.
  function onFrame(info) {
    live = info;
    if (!S) return;
    for (let i = 0; i < tagEls.length; i++) {
      const t = info.tags[i], el = tagEls[i]; if (!t || !el) continue;
      if (!t.show || el.dataset.e) { if (!el.hidden) el.hidden = true; continue; }
      if (el.hidden) el.hidden = false;
      const sc = Math.max(.62, Math.min(1.1, 11 / t.d));
      el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
      el.style.zIndex = String(1000 - Math.round(t.d * 4));
    }
    const now = performance.now();
    if (S.stage === 'race' && now - boardAt > 200) { boardAt = now; renderBoard(); }
  }

  // A marble's tag shows who has coins on it. Your own pick gets the bobbing arrow instead.
  function buildTags() {
    const key = S.seats.map(p => p.color + p.av.join('') + (p.bet?.m ?? '')).join('|') + S.me + '/' + S.marbles.length;
    if (key === tagKey) return; tagKey = key;
    const pick = myPick();
    tagsEl.innerHTML = S.marbles.map((_, i) => {
      const h = i === pick ? '' : backerHtml(i, 24);
      return h ? `<div class="mtag" hidden>${h}</div>` : '<i hidden data-e="1"></i>';
    }).join('');
    tagEls = [...tagsEl.children];
  }

  // ----- rendering -----
  function liveOrder() {
    const idx = S.marbles.map((_, i) => i).filter(racing);
    const s = live?.s || [];
    idx.sort((a, b) => {
      const A = S.marbles[a], B = S.marbles[b];
      if (S.stage !== 'bet' && S.stage !== 'count' && (A.place || B.place)) return (A.place || 99) - (B.place || 99);
      return (s[b] ?? 0) - (s[a] ?? 0);
    });
    const outs = S.marbles.map((_, i) => i).filter(i => !racing(i)).sort((a, b) => S.marbles[b].out - S.marbles[a].out);
    return [...idx, ...outs];
  }

  function renderBoard() {
    const el = $('mr-board');
    if (S.stage === 'bet') { el.hidden = true; return; }
    el.hidden = false;
    const ord = liveOrder(), key = ord.join(',') + '|' + S.marbles.map(p => `${p.place}${p.out}`).join('') + '|' + S.seats.map(p => p.bet?.m ?? '').join() + '|' + (live?.target ?? '') + picking + (live?.st || []).join('');
    if (key === renderBoard.key) return; renderBoard.key = key;
    const pick = myPick(), canHit = i => picking && racing(i) && !S.marbles[i].place && live?.st?.[i] === 0;
    el.innerHTML = ord.map((i, n) => {
      const p = S.marbles[i], out = !racing(i);
      const status = out ? 'out' : p.place && S.stage !== 'count' ? '🏁' : live?.st?.[i] === 1 ? 'oops!' : '';
      return `<li class="${out ? 'out' : ''}${i === pick ? ' me' : ''}${live?.target === i && S.stage === 'race' ? ' cam' : ''}${canHit(i) ? ' hit' : ''}">
        <button type="button" data-a="row" data-i="${i}" aria-label="${canHit(i) ? 'Throw banana at' : 'Watch'} ${p.name}">
        <i class="pos">${out ? '✕' : n + 1}</i>${ball(i, 26)}<b>${p.name}</b>
        <span class="backers">${backerHtml(i, 20)}</span><span>${status}</span></button></li>`;
    }).join('');
    order = ord;
  }

  function renderBet() {
    const el = $('mr-bet'), my = me();
    el.hidden = S.stage !== 'bet';
    if (el.hidden) return;
    const coins = my ? my.coins : 0;
    setHtml(el, `<div class="bethead"><h2>Pick a colour</h2><span>The winning colour pays <b>${S.mult}×</b>${my ? ` · you have ${I.coin}<b>${coins}</b>` : ''}</span></div>
      <div class="picks">${S.marbles.map((p, i) => `<button type="button" class="pick${my?.bet?.m === i ? ' on' : ''}" data-a="bet" data-i="${i}" ${my ? '' : 'disabled'} aria-pressed="${my?.bet?.m === i}">
        ${ball(i, 46)}<b>${p.name}</b>
        <span class="backers">${backerHtml(i, 20)}</span></button>`).join('')}</div>
      ${my ? `<div class="stakes"><span>Stake</span><div class="pills">${[10, 25, 50, 100].map(v => `<button type="button" data-a="stake" data-v="${v}" aria-pressed="${stake === v}" ${v > coins && v > 10 ? 'disabled' : ''}>${v}</button>`).join('')}</div>
        ${my.bet ? `<span class="mybet">${I.coin}<b>${my.bet.amt}</b> on ${mName(my.bet.m)} <button type="button" class="link" data-a="nobet">remove</button></span>` : '<span class="mybet">Tap a marble to bet on its colour. The race starts once everyone has bet.</span>'}
        ${ctx.isHost() ? `<button type="button" class="btn m" data-a="ready" ${undecided().length ? 'disabled' : ''}>${undecided().length ? 'Waiting for bets' : 'Start the race'}</button>` : ''}</div>` : '<div class="stakes"><span class="mybet">You are watching this race.</span></div>'}`);
  }

  function renderRace() {
    const el = $('mr-race'), my = me();
    el.hidden = !(S.stage === 'race' || S.stage === 'count' || S.stage === 'gap');
    if (el.hidden) return;
    const canSab = my && S.stage === 'race' && !my.sab;
    if (!canSab) picking = false;
    const cam = (k, label, ok = true) => ok ? `<button type="button" data-a="cam" data-k="${k}" aria-pressed="${follow === k}">${label}</button>` : '';
    setHtml(el, `<div class="cams"><span>Camera</span><div class="pills">${cam('lead', 'Leader')}${cam('bet', 'My pick', !!my?.bet && racing(my.bet.m))}</div></div>
      ${my ? `<button type="button" class="btn ${picking ? 'w' : 'p'} sab" data-a="sab" ${canSab ? '' : 'disabled'}>${I.banana}${my.sab ? 'Banana thrown' : picking ? 'Cancel' : 'Throw banana'}</button>` : ''}
      ${picking ? '<p class="hint">Pick a colour on the left to slip it up. One banana per heat!</p>' : ''}`);
  }

  function render() {
    if (!S) return;
    $('mr-mode').textContent = S.mode === 'knockout' ? `Knockout · heat ${S.heat} of ${S.heats}` : 'Classic race';
    const my = me();
    setHtml($('mr-coins'), my ? `${I.coin}${my.coins}` : 'Watching');
    $('mr-code').textContent = Rm?.code || '';
    buildTags(); renderBet(); renderRace(); renderBanner(); renderBoard();
    root.classList.toggle('picking', picking);
  }

  function renderBanner() {
    const el = $('mr-banner'); let msg = '';
    const secs = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
    if (S.stage === 'bet') {
      const w = undecided();
      msg = !secs && w.length ? (w.includes(S.me) ? 'Pick a colour to start the race' : `Waiting for ${w.slice(0, 3).map(i => S.seats[i].name).join(', ')}${w.length > 3 ? '…' : ''} to bet`) : `Place your bets · ${secs}s`;
    }
    else if (S.stage === 'count') msg = S.mode === 'knockout' ? `Heat ${S.heat}: last marble home is out` : 'Marbles at the gate…';
    else if (S.stage === 'race') {
      const done = S.marbles.filter(p => p.place && !p.out).length;
      msg = S.chaos ? CHAOS[S.chaos.k][0] : done ? `${done} home, ${S.marbles.filter(p => !p.out).length - done} to go` : S.mode === 'knockout' ? `Heat ${S.heat} of ${S.heats}` : 'They\'re rolling!';
    } else if (S.stage === 'gap') { const o = S.marbles.findIndex(p => p.out === S.heat); msg = o >= 0 ? `${mName(o)} is out! Next heat in ${secs}s` : ''; }
    else msg = S.win >= 0 ? `${mName(S.win)} wins!` : '';
    if (el.textContent !== msg) el.textContent = msg;
    el.classList.toggle('hot', S.stage === 'race' && !!S.chaos);
  }

  function big(text, sub = '', ms = 1400) {
    const el = $('mr-big');
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bigTimer); bigTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ----- events -> sound & effects -----
  function playEv(e) {
    if (e.t === 'count') { lastCount = -1; hideResults(); }
    else if (e.t === 'go') { big('GO!', '', 900); sfx.win(); }
    else if (e.t === 'chaos') {
      const sub = e.k === 'swap' ? `${mName(e.a)} and ${mName(e.b)} trade places` : CHAOS[e.k][1];
      big(CHAOS[e.k][0], sub, 1900); sfx.set(); sfx.plop();
      if (e.k === 'swap') { scene?.burst(e.a, '#e8a0e0', 18); scene?.burst(e.b, '#e8a0e0', 18); }
    } else if (e.t === 'sab') {
      sfx.bad(); sfx.plop(); scene?.burst(e.m, '#ffd84a', 16);
      const mine = e.m === myPick();
      if (mine || e.by === S.me) ctx.toast(`${I.banana}${e.by === S.me ? 'You' : esc(S.seats[e.by]?.name)} slipped ${mine ? 'your pick' : mName(e.m)} a banana!`, mine && e.by !== S.me);
    } else if (e.t === 'fall') { sfx.plop(); if (e.m === myPick()) ctx.toast(`Trapdoor! ${mName(e.m)} goes back a bit.`, true); }
    else if (e.t === 'fin') {
      if (e.place === 1) { sfx.turn(); big(`${mName(e.m)} crosses first!`, e.m === myPick() ? 'That is your pick!' : '', 1600); } else sfx.place();
      scene?.burst(e.m, S.marbles[e.m].color, 12);
    } else if (e.t === 'out') { sfx.lose(); big(`${mName(e.m)} is out!`, e.m === myPick() ? 'There goes your pick' : 'Slowest marble of the heat', 2200); }
    else if (e.t === 'end') {
      const mine = S.res?.pay?.[S.me];
      if (mine?.won) { sfx.win(); confetti(); } else sfx.lose();
      clearTimeout(resultsTimer); resultsTimer = setTimeout(showResults, 2400);
    }
  }

  function update(s) {
    if (destroyed) return;
    const fresh = s.gid !== gid, prevStage = S?.stage;
    S = s;
    if (fresh) {
      gid = s.gid; hideResults(); clearTimeout(resultsTimer); follow = 'lead'; picking = false; lastCount = -1;
      lastEv = s.ev?.length ? s.ev[s.ev.length - 1].n : 0;
      const coins = me()?.coins ?? 0; stake = coins >= 25 ? 25 : 10;
      if (s.ph === 'end') showResults(); else if (s.stage === 'bet') sfx.draw();
    }
    endsAt = performance.now() + s.left;
    if (prevStage !== s.stage) renderBoard.key = '';
    render(); sync();
    if (!fresh) for (const e of s.ev || []) if (e.n > lastEv) { lastEv = e.n; playEv(e); }
  }

  // ----- results -----
  function showResults() {
    if (!S || S.ph !== 'end' || !S.res) return;
    const el = root.querySelector('.results'), w = S.win, my = S.me >= 0 ? S.res.pay[S.me] : null;
    const line = my ? (my.net > 0 ? `You're up ${I.coin}<b>${my.net}</b> this race.` : my.net < 0 ? `You dropped ${I.coin}<b>${-my.net}</b> this race.` : 'You broke even this race.') : '';
    const seats = S.seats.map((_, i) => i).sort((a, b) => S.res.pay[b].net - S.res.pay[a].net);
    el.innerHTML = `<div class="sheet">
      <h2>${ball(w, 34)}${mName(w)} wins!</h2>
      <ol class="finish" aria-label="Finishing order">${S.res.order.map((i, n) => `<li class="${i === myPick() ? 'me' : ''}" title="${ORD(n + 1)}: ${mName(i)}"><small>${n + 1}</small>${ball(i, 26)}</li>`).join('')}</ol>
      <p>${line} Coins stay with this table for the next race.</p>
      <ol class="score">${seats.map((i, n) => {
        const p = S.seats[i], pay = S.res.pay[i], b = pay.bet;
        return `<li class="${pay.won ? 'won' : ''}" style="animation-delay:${n * 90}ms">${avatarHtml(p.color, p.av, 44)}
          <div class="who"><b>${esc(p.name)}${i === S.me ? ' (you)' : ''}</b><span>${b ? `bet ${b.amt} on ${ball(b.m, 14)}${mName(b.m)}, which came ${ORD(S.res.order.indexOf(b.m) + 1)}` : 'no bet'}</span></div>
          <strong class="${pay.net > 0 ? 'up' : pay.net < 0 ? 'down' : ''}">${pay.net > 0 ? '+' : ''}${pay.net}<small>${I.coin}${pay.coins}</small></strong></li>`;
      }).join('')}</ol>
      <div class="againbox">${againHtml(ctx, Rm, 'Race again')}</div></div>`;
    el.hidden = false; votes = (Rm?.again || []).length;
  }
  // Votes arrive with room updates: repaint just the buttons so the sheet doesn't replay its entrance.
  let votes = 0;
  function paintAgain() {
    const box = root.querySelector('.results:not([hidden]) .againbox'); if (!box) return;
    const n = (Rm?.again || []).length;
    if (n > votes) sfx.pop();
    votes = n; box.innerHTML = againHtml(ctx, Rm, 'Race again');
  }
  function hideResults() { root.querySelector('.results').hidden = true; }

  // ----- reactions float up from the marble the sender bet on -----
  function react(m) {
    if (!S) return;
    const i = S.seats.find(p => p.id === m.id)?.bet?.m ?? -1, t = live?.tags?.[i];
    const f = document.createElement('div');
    f.className = 'floaty'; f.innerHTML = reactHtml(m.k);
    const x = t?.show ? t.x : innerWidth / 2 + (Math.random() * 120 - 60), y = t?.show ? t.y - 30 : innerHeight * .7;
    f.style.left = `${x - 32}px`; f.style.top = `${y - 64}px`;
    root.append(f); setTimeout(() => f.remove(), 1600);
  }

  function confetti() {
    const cv = root.querySelector('.confetti'), g = cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.scale(devicePixelRatio, devicePixelRatio);
    const cols = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#fff4e2', '#e5543b'];
    const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 8, c: cols[Math.random() * cols.length | 0], round: Math.random() < .4 }));
    let t = 0;
    const step = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (++t < 200 && !destroyed) requestAnimationFrame(step); else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    step();
  }

  // ----- countdown ticker -----
  const timer = setInterval(() => {
    if (!S || S.ph !== 'play') return;
    renderBanner();
    if (S.stage === 'count') {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastCount && n >= 1 && n <= 3) { lastCount = n; big(String(n), '', 800); sfx.turn(); }
    } else if (S.stage === 'bet') {
      const n = Math.ceil((endsAt - performance.now()) / 1000);
      if (n !== lastCount && n <= 5 && n > 0) { lastCount = n; sfx.tick(); }
    }
  }, 100);

  // ----- input -----
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'bet') { sfx.pop(); ctx.act({ t: 'bet', m: +b.dataset.i, amt: stake }); }
    else if (a === 'stake') {
      stake = +b.dataset.v; sfx.click();
      const cur = me()?.bet; if (cur) ctx.act({ t: 'bet', m: cur.m, amt: stake }); else renderBet();
    } else if (a === 'nobet') { sfx.click(); ctx.act({ t: 'nobet' }); }
    else if (a === 'ready') { sfx.click(); ctx.act({ t: 'ready' }); }
    else if (a === 'cam') { sfx.click(); follow = b.dataset.k; renderRace(); sync(); }
    else if (a === 'sab') { sfx.click(); picking = !picking; renderBoard.key = ''; render(); }
    else if (a === 'row') {
      const i = +b.dataset.i;
      if (picking) {
        if (b.parentElement.classList.contains('hit')) { picking = false; ctx.act({ t: 'sab', m: i }); renderBoard.key = ''; render(); }
        else sfx.bad();
      } else if (racing(i)) { sfx.click(); follow = i; renderRace(); sync(); }
    }
    else if (a === 'mute') { const m = sfx.toggle(); b.innerHTML = m ? I.mute : I.sound; }
    else if (a === 'rules') { sfx.click(); ctx.rules(); }
    else if (a === 'leave') { sfx.click(); ctx.leave(); }
    else if (a === 'again') { sfx.click(); ctx.again(); }
    else if (a === 'playagain') { sfx.click(); ctx.vote(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'sit') { sfx.click(); ctx.sit(b.getAttribute('aria-pressed') !== 'true'); }
    else if (a === 'lobby') { sfx.click(); ctx.toLobby(); }
  });
  root.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn, .round, .pick, .pills button');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
  });

  return {
    update,
    room(r) { Rm = r; if (S) render(); paintAgain(); },
    react,
    destroy() { destroyed = true; document.body.classList.remove('in-game'); clearInterval(timer); clearTimeout(resultsTimer); clearTimeout(bigTimer); scene?.dispose(); },
  };
}
