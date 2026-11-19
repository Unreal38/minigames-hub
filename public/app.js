// Cozy Table hub: username, open tables, waiting rooms. Games mount on top of this.
import { potLogo, tableArt } from './art.js';
import { backSvg } from './games/hotpot/icons.js';
import { cardHtml } from './games/hotpot/cards.js';
import { sfx } from './sfx.js';
import { avatarHtml, cleanAv, randomAv, SKINS, HAIR_COLS, HAIRS, EXTRAS } from './avatar.js';

export const SITE = 'Cozy Table';
const COLORS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const GAMES = { hotpot: { name: 'Hot Pot', load: () => import('./games/hotpot/client.js') } };

const $app = document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const st = {
  name: LS.get('ct_name', ''), color: LS.get('ct_color', COLORS[Math.random() * COLORS.length | 0]),
  av: (() => { try { const a = JSON.parse(LS.get('ct_av', 'null')); return a ? cleanAv(a) : randomAv(); } catch { return randomAv(); } })(),
  token: LS.get('ct_token', ''), id: null, rooms: [], room: null, view: 'hub', game: null, gameLoading: null, lastState: null,
};
const validCode = s => /^[A-Z0-9]{4}$/.test(s);
let pendingJoin = (location.hash.slice(1) || '').toUpperCase();
if (!validCode(pendingJoin)) pendingJoin = '';

// ---------- toasts ----------
export function toast(html, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = html;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 2900);
}

// ---------- network ----------
let ws = null, retry = 0;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    retry = 0; document.getElementById('conn').hidden = true;
    ws.send(JSON.stringify({ t: 'hello', token: st.token, name: st.name || 'Guest', color: st.color, av: st.av }));
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = () => {
    document.getElementById('conn').hidden = false;
    setTimeout(connect, Math.min(5000, 400 * 2 ** retry++));
  };
}
export function send(m) { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); }

function onMsg(m) {
  if (m.t === 'welcome') {
    st.token = m.token; st.id = m.id; LS.set('ct_token', m.token);
    if (pendingJoin && st.name) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
  } else if (m.t === 'rooms') {
    st.rooms = m.rooms || [];
    if (st.view === 'hub') renderTables();
  } else if (m.t === 'room') {
    const prev = st.room; st.room = m.room;
    if (!m.room) { unmountGame(); st.lastState = null; go('hub'); return; }
    if (prev && prev.code === m.room.code) {
      const before = new Set(prev.players.map(p => p.id));
      const joined = m.room.players.filter(p => !before.has(p.id));
      if (joined.length) { sfx.join(); joined.forEach(p => toast(`${esc(p.name)} pulled up a chair`)); }
    }
    if (st.game) st.game.room(m.room); else go('lobby');
  } else if (m.t === 'state') {
    st.lastState = m.s;
    if (!m.s) { unmountGame(); if (st.room) go('lobby'); return; }
    mountGame().then(g => g?.update(st.lastState));
  } else if (m.t === 'react') {
    st.game?.react(m);
  } else if (m.t === 'err') {
    sfx.bad(); toast(esc(m.msg), true);
  }
}

// ---------- game mounting ----------
function mountGame() {
  if (st.game) return Promise.resolve(st.game);
  if (st.gameLoading) return st.gameLoading;
  const g = GAMES[st.room?.game];
  if (!g) return Promise.resolve(null);
  st.view = 'game';
  st.gameLoading = g.load().then(mod => {
    st.game = mod.mount($app, {
      act: a => send({ t: 'act', a }), react: k => send({ t: 'react', k }),
      myId: () => st.id, room: () => st.room, isHost: () => st.room?.host === st.id,
      again: () => send({ t: 'start' }), toLobby: () => send({ t: 'lobby' }), leave: () => send({ t: 'leave' }),
      toast, rules: openRules,
    });
    st.game.room(st.room);
    st.gameLoading = null;
    return st.game;
  }).catch(err => { console.error(err); st.gameLoading = null; toast('Could not load the game. Refresh?', true); return null; });
  return st.gameLoading;
}
function unmountGame() { st.game?.destroy(); st.game = null; }

// ---------- views ----------
function go(view) {
  st.view = view;
  document.title = view === 'lobby' && st.room ? `${st.room.code} · ${SITE}` : SITE;
  if (view === 'hub') renderHub();
  else if (view === 'lobby') renderLobby();
}

const topbar = () => `<header class="top">
  <a class="brand" href="/" data-act="home">${potLogo(42)}<span>${SITE}</span></a>
  <nav class="navl" aria-label="Sections"><a href="#games" data-act="scroll" data-to="games">Games</a><a href="#tables" data-act="scroll" data-to="tables">Open tables</a><a href="#" data-act="rules">How to play</a></nav>
  <button type="button" class="me" data-act="profile">${avatarHtml(st.color, st.av, 38)}${esc(st.name || 'Pick a name')}<small>· change</small></button>
</header>`;

function renderHub() {
  $app.innerHTML = `${topbar()}
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Pull up a chair.<br>The pot's already bubbling.</h1>
        <p>Tiny games for you and your friends. No accounts, no downloads: pick a name, share a four-letter code and play. Empty seats get friendly bots.</p>
        <div class="row">
          <button type="button" class="btn big" data-act="host">Host a table</button>
          <button type="button" class="btn big w" data-act="solo">Play with bots</button>
        </div>
        <form class="codeform" data-form="join">
          <label for="code">Got a code?</label>
          <input id="code" class="field code-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" required>
          <button class="btn m">Join</button>
        </form>
      </div>
      <div class="art">${tableArt()}</div>
    </section>
    <section id="games">
      <h2>Games on the menu</h2>
      <div class="games">
        <article class="gcard">
          <div class="pic">${cardHtml(0, { w: 70 })}${cardHtml(40, { w: 78 })}${cardHtml(64, { w: 70 })}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Hot Pot</h3><span class="tag">1–4 players</span></div>
            <p>Draw, swap and collect three sets of three ingredients, then call “Let's Eat!” before anyone else.</p>
            <div class="row"><button type="button" class="btn" data-act="host">Host a table</button><button type="button" class="btn w" data-act="solo">Play with bots</button></div>
          </div>
        </article>
        <article class="soon">${backSvg('width="84" height="84"')}<h3>Next game is simmering</h3><p>Coming soon to the table.</p></article>
        <article class="soon">${backSvg('width="84" height="84"')}<h3>Got an idea?</h3><p>New minigames drop into the hub as one folder each.</p></article>
      </div>
    </section>
    <section id="tables" style="margin-top:44px">
      <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:14px"><h2 style="margin:0">Open tables</h2><span style="font-size:14px;color:var(--muted)">Updates live</span></div>
      <div class="tables" id="tables-list"></div>
    </section>
  </main>
  <footer>Made for friends. Hot Pot is a fan-made game inspired by Palia's Hotpot minigame.</footer>`;
  renderTables();
  if (!st.name) openProfile(true);
}

function renderTables() {
  const el = document.getElementById('tables-list'); if (!el) return;
  if (!st.rooms.length) { el.innerHTML = `<div class="empty">No open tables right now. Host one and send your friends the code!</div>`; return; }
  el.innerHTML = st.rooms.map(r => `<div class="trow">
    ${avatarHtml(r.hostColor, r.hostAv, 46)}
    <div class="who"><b>${esc(r.host)}'s table</b><span>${esc(r.gameName)} · ${r.state === 'lobby' ? 'Waiting for players' : r.state === 'play' ? 'Playing' : 'Just finished'}</span></div>
    <div class="dots" aria-label="${r.n} of ${r.max} seats taken">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="tcode">${esc(r.code)}</span>
    <button type="button" class="btn ${r.n < r.max && r.state === 'lobby' ? 'm' : 'w'}" data-act="join" data-code="${esc(r.code)}">${r.n < r.max && r.state === 'lobby' ? 'Join' : 'Watch'}</button>
  </div>`).join('');
}

function renderLobby() {
  const r = st.room; if (!r) return go('hub');
  const host = r.host === st.id, max = r.max;
  const seats = Array.from({ length: max }, (_, i) => r.players[i] || null);
  const watchers = r.players.slice(max);
  const pill = (opt, val, label) => `<button type="button" aria-pressed="${String(r.opts[opt]) === String(val)}" data-act="opt" data-opt="${opt}" data-val="${val}" ${host ? '' : 'disabled'}>${label}</button>`;
  $app.innerHTML = `${topbar()}
  <main class="wrap lobby">
    <div class="main">
      <div class="crumb">${potLogo(34)} ${esc(r.gameName)} · waiting room</div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:15px;color:var(--muted);margin-bottom:6px">Table code</div>
          <div class="codetiles" aria-label="Table code ${esc(r.code)}">${[...r.code].map(ch => `<span>${esc(ch)}</span>`).join('')}</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
          <button type="button" class="btn" data-act="copy">Copy invite link</button>
          <span style="font-size:14px;color:var(--muted)">Friends can also type the code on the home page.</span>
        </div>
      </div>
      <div class="seats">${seats.map((p, i) => p ? `<div class="seat full ${p.online ? '' : 'offline'}">
          ${avatarHtml(p.color, p.av, 64)}
          <div><b>${esc(p.name)}</b><span>${p.id === r.host ? 'Host' : 'Ready'}${p.id === st.id ? ' · you' : ''}${p.online ? '' : ' · reconnecting'}</span></div></div>`
        : `<div class="seat open">${backSvg('width="56" height="56"')}<div><b>Seat ${i + 1} is open</b><span>A bot sits here if nobody joins</span></div></div>`).join('')}</div>
      ${watchers.length ? `<p style="margin:0;color:var(--muted)">Watching: ${watchers.map(p => esc(p.name)).join(', ')}</p>` : ''}
      <div class="row" style="margin-top:6px">
        ${host ? `<button type="button" class="btn big r" data-act="start">Start the pot</button>` : `<span class="chip">Waiting for the host to start…</span>`}
        <button type="button" class="btn big ghost" data-act="leave">Leave</button>
      </div>
    </div>
    <aside>
      <h2 style="font-size:26px;margin:0">Table settings</h2>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>
      <label class="toggle">Show in open tables<input type="checkbox" data-act="priv" ${r.priv ? '' : 'checked'} ${host ? '' : 'disabled'}></label>
      ${host ? '' : `<p style="margin:0;font-size:14px;color:var(--muted)">Only the host can change settings.</p>`}
      <div class="howto"><b>How to win</b><br>Hold 8 cards. Each turn draw one (from the pot or a friend's discard), then discard one. Make three sets of three, either three of the same ingredient or three different ingredients of one colour, and call “Let's Eat!”. <a href="#" data-act="rules">Full rules</a></div>
    </aside>
  </main>`;
}

// ---------- modals ----------
function modal(html, dismissable = true) {
  const m = document.createElement('div');
  m.className = 'modal'; m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape' && dismissable) close(); };
  if (dismissable) m.addEventListener('click', e => { if (e.target === m) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(m);
  return { el: m, close };
}

function openProfile(first = false) {
  let color = st.color, av = st.av.slice();
  const sw = (k, list, sel) => list.map((c, i) => `<button type="button" style="--c:${c}" aria-label="Option ${i + 1}" aria-pressed="false" data-k="${k}" data-v="${sel === 'hex' ? c : i}"></button>`).join('');
  const pills = (k, list) => list.map((n, i) => `<button type="button" aria-pressed="false" data-k="${k}" data-v="${i}">${n}</button>`).join('');
  const { el, close } = modal(`
    <h2>${first ? 'Who is joining the table?' : 'Your avatar'}</h2>
    <p>${first ? 'No account needed. Pick a name and a look; friends see both at the table.' : 'Change your name and how you look at the table.'}</p>
    <form data-form="profile" class="creator">
      <div class="preview"><span id="pv"></span>
        <div class="namecol"><label for="nm">Name</label>
          <input class="field" id="nm" maxlength="16" required placeholder="e.g. Noodle Queen" value="${esc(st.name)}" autocomplete="nickname">
          <button type="button" class="btn w sm" data-rand>Surprise me</button></div></div>
      <div class="crow"><b>Outfit</b><div class="swatches">${sw('color', COLORS, 'hex')}</div></div>
      <div class="crow"><b>Skin</b><div class="swatches">${sw(0, SKINS)}</div></div>
      <div class="crow"><b>Hair</b><div class="pills">${pills(1, HAIRS)}</div></div>
      <div class="crow"><b>Hair colour</b><div class="swatches">${sw(2, HAIR_COLS)}</div></div>
      <div class="crow"><b>Extra</b><div class="pills">${pills(3, EXTRAS)}</div></div>
      <button class="btn big">${first ? "Let's go" : 'Save'}</button>
    </form>`, !first);
  const nm = el.querySelector('#nm'), pv = el.querySelector('#pv');
  const paint = () => {
    pv.innerHTML = avatarHtml(color, av, 112);
    el.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k;
      b.setAttribute('aria-pressed', k === 'color' ? b.dataset.v === color : av[+k] === +b.dataset.v);
    });
  };
  paint();
  if (first) setTimeout(() => nm.focus(), 50);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) { if (b.dataset.k === 'color') color = b.dataset.v; else av[+b.dataset.k] = +b.dataset.v; sfx.pop(); paint(); return; }
    if (e.target.closest('[data-rand]')) { av = randomAv(); color = COLORS[Math.random() * COLORS.length | 0]; sfx.set(); paint(); pv.firstElementChild?.classList.add('spin'); }
  });
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const n = nm.value.replace(/[<>]/g, '').trim().slice(0, 16); if (!n) return;
    st.name = n; st.color = color; st.av = cleanAv(av);
    LS.set('ct_name', n); LS.set('ct_color', color); LS.set('ct_av', JSON.stringify(st.av));
    send({ t: 'profile', name: n, color, av: st.av });
    sfx.click(); close();
    if (pendingJoin) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
    go(st.view === 'game' ? 'game' : st.view);
  });
}

export function openRules() {
  const { el, close } = modal(`
    <h2>How to play Hot Pot</h2>
    <div class="rules"><ol>
      <li>Everyone holds <b>8 cards</b>. Each card is an ingredient in one of six colours.</li>
      <li>On your turn, <b>draw one</b>: a surprise ingredient from the pot, or the top card a friend just discarded.</li>
      <li>Then <b>discard one</b> card so you're back to 8.</li>
      <li>A <b>set</b> is three identical ingredients (30 pts) or three <b>different</b> ingredients of the same colour (15 pts).</li>
      <li>Hold <b>three sets</b> after drawing and press <b>Let's Eat!</b> to win (+90 pts).</li>
      <li>No winner after 30 rounds? Everyone scores the sets in their hand.</li>
    </ol></div>
    <button type="button" class="btn big" data-close>Got it</button>`);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); close(); });
}

// ---------- events ----------
$app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (['home', 'scroll', 'rules'].includes(act)) e.preventDefault();
  if (b.tagName === 'BUTTON') sfx.click();
  if (act === 'home') { if (st.room) send({ t: 'leave' }); else go('hub'); }
  else if (act === 'scroll') document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: 'smooth' });
  else if (act === 'rules') openRules();
  else if (act === 'profile') openProfile();
  else if (act === 'host') { if (!st.name) return openProfile(true); send({ t: 'create', game: 'hotpot', opts: { bots: 'chill', timer: 30 } }); }
  else if (act === 'solo') { if (!st.name) return openProfile(true); send({ t: 'create', game: 'hotpot', priv: true, solo: true, opts: { bots: 'chill', timer: 0 } }); }
  else if (act === 'join') send({ t: 'join', code: b.dataset.code });
  else if (act === 'leave') send({ t: 'leave' });
  else if (act === 'start') send({ t: 'start' });
  else if (act === 'opt') send({ t: 'opts', opts: { [b.dataset.opt]: b.dataset.opt === 'timer' ? +b.dataset.val : b.dataset.val } });
  else if (act === 'copy') {
    const link = `${location.origin}/#${st.room.code}`;
    (navigator.clipboard?.writeText(link) ?? Promise.reject()).then(() => toast('Invite link copied!'), () => toast(`Share this: ${esc(link)}`));
  }
});
$app.addEventListener('change', e => { if (e.target.dataset.act === 'priv') send({ t: 'opts', priv: !e.target.checked }); });
$app.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'join') return;
  e.preventDefault();
  const code = e.target.querySelector('input').value.toUpperCase().trim();
  if (!validCode(code)) { sfx.bad(); toast('Codes are 4 letters or numbers', true); return; }
  if (!st.name) { pendingJoin = code; return openProfile(true); }
  sfx.click(); send({ t: 'join', code });
});
$app.addEventListener('pointerover', e => {
  const b = e.target.closest('.btn, .round, .pills button'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
});
addEventListener('hashchange', () => {
  const c = location.hash.slice(1).toUpperCase();
  if (validCode(c) && st.name) { send({ t: 'join', code: c }); history.replaceState(null, '', location.pathname); }
});

go('hub');
connect();
