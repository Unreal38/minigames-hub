// Cozy Table hub: username, open tables, waiting rooms. Games mount on top of this.
import { potLogo, tableArt, marbleArt } from './art.js';
import { backSvg } from './games/hotpot/icons.js';
import { cardHtml } from './games/hotpot/cards.js';
import { sfx } from './sfx.js';
import { EMOJI, FOODS, floatAt } from './react.js';
import { progress } from './ranks.js';
import { avatarHtml, cleanAv, randomAv, SKINS, HAIR_COLS, HAIRS, EXTRAS, EYES, MOUTHS, OUTFITS, DETAILS } from './avatar.js';

export const SITE = 'Cozy Table';
const COLORS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const GAMES = {
  hotpot: {
    name: 'Hot Pot', load: () => import('./games/hotpot/client.js'), start: 'Start the pot',
    host: { bots: 'chill', timer: 30 }, solo: { bots: 'chill', timer: 0 },
    openSeat: 'A bot sits here if nobody joins', seats: r => r.max,
    settings: pill => `<div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Hold 8 cards. Each turn draw one (from the pot or a friend's discard), then discard one. Make three sets of three, either three of the same ingredient or three different ingredients of one colour, and call “Let's Eat!”.`,
    rules: `<ol>
      <li>Everyone holds <b>8 cards</b>. Each card is an ingredient in one of six colours.</li>
      <li>On your turn, <b>draw one</b>: a surprise ingredient from the pot, or the top card a friend just discarded.</li>
      <li>Then <b>discard one</b> card so you're back to 8.</li>
      <li>A <b>set</b> is three identical ingredients (30 pts) or three <b>different</b> ingredients of the same colour (15 pts).</li>
      <li>Hold <b>three sets</b> after drawing and press <b>Let's Eat!</b> to win (+90 pts).</li>
      <li>No winner after 30 rounds? Everyone scores the sets in their hand.</li>
    </ol>`,
  },
  marbles: {
    name: 'Marble Rush', load: () => import('./games/marbles/client.js'), start: 'Open the betting',
    host: { mode: 'classic', chaos: 'on', field: 6 }, solo: { mode: 'classic', chaos: 'on', field: 6 },
    openSeat: 'A house marble rolls here if nobody joins', seats: r => Math.max(r.opts.field || 6, r.players.length),
    settings: pill => `<div class="opt"><b>Race</b><div class="pills">${pill('mode', 'classic', 'Classic')}${pill('mode', 'knockout', 'Knockout')}</div></div>
      <div class="opt"><b>Chaos events</b><div class="pills">${pill('chaos', 'on', 'On')}${pill('chaos', 'off', 'Off')}</div></div>
      <div class="opt"><b>Marbles on the track</b><div class="pills">${pill('field', 4, '4')}${pill('field', 6, '6')}${pill('field', 8, '8')}</div></div>`,
    howto: `Everyone gets a marble with their face on it. Bet pretend coins on the winner, then watch them tumble down a random track. Knockout drops the slowest marble after every heat until one is left.`,
    rules: `<ol>
      <li>Every player gets a <b>marble</b> wearing their avatar. Empty spots are filled by house marbles.</li>
      <li>Before the gate opens, <b>bet coins</b> on any marble. A right pick pays your stake times the number of marbles.</li>
      <li>The track is <b>random every race</b>: pins, spinners, trapdoors, boost pads and squeezes. Nobody steers.</li>
      <li>You get <b>one banana per heat</b>. Throw it at a marble to slip it up.</li>
      <li><b>Chaos events</b> hit everyone: gravity flips, turbo, marblequakes and switcheroos.</li>
      <li><b>Knockout</b>: the last marble home each heat is out. Handy for deciding who pays.</li>
      <li>Coins are pretend and stay with the table. If you go broke, the house spots you a few.</li>
    </ol>`,
  },
};

const $app = document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const st = {
  name: LS.get('ct_name', ''), color: LS.get('ct_color', COLORS[Math.random() * COLORS.length | 0]),
  av: (() => { try { const a = JSON.parse(LS.get('ct_av', 'null')); return a ? cleanAv(a) : randomAv(); } catch { return randomAv(); } })(),
  token: LS.get('ct_token', ''), id: null, me: null, rooms: [], room: null, view: 'hub', game: null, gameLoading: null, lastState: null,
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
  } else if (m.t === 'me') {
    st.me = m.me;
    let adopted = false;
    if (adoptLook && m.me.user) { // just logged in: wear the look saved with the account
      adoptLook = false; adopted = true;
      st.name = m.me.name || st.name; st.color = m.me.color || st.color; if (m.me.av) st.av = cleanAv(m.me.av);
      LS.set('ct_name', st.name); LS.set('ct_color', st.color); LS.set('ct_av', JSON.stringify(st.av));
    }
    if (m.gain) {
      toast(`${m.gain.win ? 'Win! ' : ''}+${m.gain.xp} XP`);
      if (m.gain.levelUp) { sfx.join(); toast(`${m.me.icon} Level ${m.me.level}: ${esc(m.me.rank)}`); }
    }
    if (st.view === 'hub') { if (adopted) renderHub(); else paintMe(); } else if (st.view === 'lobby') renderLobby();
  } else if (m.t === 'stats') {
    st.stats = { online: m.online | 0, visitors: m.visitors | 0 }; paintStats();
  } else if (m.t === 'auth') {
    onAuth?.(m);
  } else if (m.t === 'rooms') {
    st.rooms = m.rooms || [];
    if (st.view === 'hub') renderTables();
  } else if (m.t === 'room') {
    const prev = st.room; st.room = m.room;
    if (!m.room || m.room.code !== prev?.code) chatReset();
    $chat.hidden = !m.room; scoresPaint();
    if (!m.room) { unmountGame(); st.lastState = null; watchPaint(); go('hub'); return; }
    if (prev && prev.code === m.room.code) {
      const before = new Set(prev.players.map(p => p.id));
      const joined = m.room.players.filter(p => !before.has(p.id));
      if (joined.length) { sfx.join(); joined.forEach(p => toast(`${esc(p.name)} pulled up a chair`)); }
    }
    if (st.game) st.game.room(m.room); else go('lobby');
    watchPaint();
  } else if (m.t === 'state') {
    st.lastState = m.s;
    if (!m.s) { unmountGame(); watchPaint(); if (st.room) go('lobby'); return; }
    mountGame().then(g => { g?.update(st.lastState); watchPaint(); });
  } else if (m.t === 'react') {
    if (st.game) st.game.react(m); else floatAt(document.querySelector(`.seat[data-pid="${CSS.escape(String(m.id))}"]`), m.k);
    sfx.pop();
  } else if (m.t === 'chatlog') {
    chat.log = Array.isArray(m.log) ? m.log : []; chatPaint();
  } else if (m.t === 'chat') {
    chat.log.push(m); if (chat.log.length > 60) chat.log.shift();
    chatPaint();
    if (m.id !== st.id) {
      sfx.pop();
      if (!chat.open) { chat.unread++; chatBadge(); chatPeek(m); }
      st.game?.say?.(m);
    }
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
      again: () => send({ t: 'start' }), vote: on => send({ t: 'again', on }), sit: on => send({ t: 'sit', on }), toLobby: () => send({ t: 'lobby' }), leave: () => send({ t: 'leave' }),
      toast, rules: () => openRules(st.room?.game),
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

let adoptLook = false, onAuth = null;
const lvChip = (lv, icon, rank) => `<span class="lv" title="${esc(rank)}, level ${lv}">${icon} ${lv}</span>`;
const meChip = () => st.me ? lvChip(st.me.level, st.me.icon, st.me.rank) : '';

// "Your progress" card on the hub: rank, XP bar, lifetime numbers and the account buttons.
function meCard() {
  const m = st.me; if (!m) return '';
  const pct = Math.round(100 * m.into / m.need), rate = m.games ? Math.round(100 * m.wins / m.games) : 0;
  const per = Object.entries(m.byGame || {}).filter(([id]) => GAMES[id]).map(([id, g]) =>
    `<li><b>${GAMES[id].name}</b><span>${g.wins} ${g.wins === 1 ? 'win' : 'wins'} in ${g.games} · best ${g.best} pts</span></li>`).join('');
  return `<div class="mecard">
    <div class="rankrow">
      <span class="rankicon">${m.icon}</span>
      <div class="rankname"><b>${esc(m.rank)}</b><span>Level ${m.level}${m.nextRank ? ` · ${esc(m.nextRank)} at level ${m.nextRankLv}` : ''}</span></div>
      <div class="acct">${m.user
        ? `<span>Signed in as <b>${esc(m.user)}</b></span><button type="button" class="btn sm ghost" data-act="logout">Log out</button>`
        : `<span>Playing as a guest. Progress stays on this browser.</span><button type="button" class="btn sm m" data-act="account" data-mode="register">Create account</button><button type="button" class="btn sm w" data-act="account" data-mode="login">Log in</button>`}</div>
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.need}" aria-valuenow="${m.into}" aria-label="XP to next level"><i style="width:${pct}%"></i></div>
    <div class="xpnote"><span>${m.into} / ${m.need} XP to level ${m.level + 1}</span><span>${m.xp} XP in total</span></div>
    <div class="stats">
      <div><b>${m.wins}</b><span>Wins</span></div><div><b>${m.games}</b><span>Games</span></div>
      <div><b>${rate}%</b><span>Win rate</span></div><div><b>${m.pts}</b><span>Points</span></div>
    </div>
    ${per ? `<ul class="pergame">${per}</ul>` : `<p class="xpnote">Finish a game to earn XP. Wins are worth the most.</p>`}
  </div>`;
}
function paintMe() {
  const card = document.getElementById('me-card'); if (card) card.innerHTML = meCard();
  const chip = document.querySelector('.me .lvslot'); if (chip) chip.innerHTML = meChip();
}

const topbar = () => `<header class="top">
  <a class="brand" href="/" data-act="home">${potLogo(42)}<span>${SITE}</span></a>
  <nav class="navl" aria-label="Sections"><a href="#games" data-act="scroll" data-to="games">Games</a><a href="#tables" data-act="scroll" data-to="tables">Open tables</a><a href="#" data-act="rules">How to play</a></nav>
  <button type="button" class="me" data-act="profile">${avatarHtml(st.color, st.av, 38)}${esc(st.name || 'Pick a name')}<span class="lvslot">${meChip()}</span><small>· change</small></button>
</header>`;

function renderHub() {
  $app.innerHTML = `${topbar()}
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Pull up a chair.<br>The pot's already bubbling.</h1>
        <p>Tiny games for you and your friends. No downloads and no sign-up needed: pick a name, share a four-letter code and play. Empty seats get friendly bots.</p>
        <div class="row">
          <button type="button" class="btn big" data-act="host">Host a table</button>
          <button type="button" class="btn big w" data-act="solo">Play with bots</button>
        </div>
        <form class="codeform" data-form="join">
          <label for="code">Got a code?</label>
          <input id="code" class="field code-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" required>
          <button class="btn m">Join</button>
        </form>
        <p class="livestats" id="live-stats" aria-live="polite">${statsHtml()}</p>
      </div>
      <div class="art">${tableArt()}</div>
    </section>
    <section id="progress" style="margin-bottom:44px">
      <h2>Your progress</h2>
      <div id="me-card">${meCard()}</div>
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
        <article class="gcard">
          <div class="pic marblepic">${marbleArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Marble Rush</h3><span class="tag">1–8 players</span></div>
            <p>Your avatar on a marble, a random 3D track and pretend coins riding on who rolls home first.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="marbles">Host a table</button><button type="button" class="btn w" data-act="solo" data-game="marbles">Play with bots</button></div>
          </div>
        </article>
        <article class="soon">${backSvg('width="84" height="84"')}<h3>Got an idea?</h3><p>New minigames drop into the hub as one folder each.</p></article>
      </div>
    </section>
    <section id="tables" style="margin-top:44px">
      <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:14px"><h2 style="margin:0">Open tables</h2><span style="font-size:14px;color:var(--muted)">Updates live</span></div>
      <div class="tables" id="tables-list"></div>
    </section>
  </main>
  <footer>Made for friends. Marble Rush coins are pretend. Hot Pot is a fan-made game inspired by Palia's Hotpot minigame.</footer>`;
  renderTables();
  if (!st.name) openProfile(true);
}

// "3 playing now · 128 visitors so far" under the hero buttons.
function statsHtml() {
  const s = st.stats; if (!s) return '';
  const n = x => x.toLocaleString();
  return `<span class="on"><i></i><b>${n(s.online)}</b> ${s.online === 1 ? 'person' : 'people'} here now</span><span><b>${n(s.visitors)}</b> ${s.visitors === 1 ? 'visitor' : 'visitors'} so far</span>`;
}
function paintStats() { const el = document.getElementById('live-stats'); if (el) el.innerHTML = statsHtml(); }

function renderTables() {
  const el = document.getElementById('tables-list'); if (!el) return;
  if (!st.rooms.length) { el.innerHTML = `<div class="empty">No open tables right now. Host one and send your friends the code!</div>`; return; }
  el.innerHTML = st.rooms.map(r => `<div class="trow">
    ${avatarHtml(r.hostColor, r.hostAv, 46)}
    <div class="who"><b>${esc(r.host)}'s table</b><span>${esc(r.gameName)} · ${r.state === 'lobby' ? 'Waiting for players' : r.state === 'play' ? 'Playing' : 'Just finished'}${r.state !== 'lobby' && r.n < r.max ? ' · watch and take a bot’s seat next round' : ''}${r.w ? ` · ${r.w} watching` : ''}</span></div>
    <div class="dots" aria-label="${r.n} of ${r.max} seats taken">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="tcode">${esc(r.code)}</span>
    <button type="button" class="btn ${r.n < r.max && r.state === 'lobby' ? 'm' : 'w'}" data-act="join" data-code="${esc(r.code)}">${r.n < r.max && r.state === 'lobby' ? 'Join' : 'Watch'}</button>
  </div>`).join('');
}

function renderLobby() {
  const r = st.room; if (!r) return go('hub');
  const host = r.host === st.id, gm = GAMES[r.game] || GAMES.hotpot, max = gm.seats(r);
  const seated = r.players.filter(p => !p.watch);
  const seats = Array.from({ length: max }, (_, i) => seated[i] || null);
  const watchers = [...seated.slice(max), ...r.players.filter(p => p.watch)];
  const meWatch = r.players.find(p => p.id === st.id)?.watch, saving = (r.sit || []).includes(st.id);
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
      <div class="seats">${seats.map((p, i) => p ? `<div class="seat full ${p.online ? '' : 'offline'}" data-pid="${esc(p.id)}">
          ${avatarHtml(p.color, p.av, 64)}
          <div><b>${esc(p.name)} ${p.lv ? lvChip(p.lv, p.icon, p.rank) : ''}</b><span>${p.id === r.host ? 'Host' : 'Ready'}${p.id === st.id ? ' · you' : ''}${p.online ? '' : ' · reconnecting'}</span></div></div>`
        : `<div class="seat open">${backSvg('width="56" height="56"')}<div><b>Seat ${i + 1} is open</b><span>${gm.openSeat}</span></div></div>`).join('')}</div>
      ${watchers.length ? `<p style="margin:0;color:var(--muted)">Watching: ${watchers.map(p => esc(p.name)).join(', ')}</p>` : ''}
      ${meWatch ? `<div class="row"><button type="button" class="btn m" data-act="sit" aria-pressed="${saving}">${saving ? '✓ Next free seat is yours' : 'Take a seat'}</button></div>` : ''}
      <div class="row" style="margin-top:6px">
        ${host ? `<button type="button" class="btn big r" data-act="start">${gm.start}</button>` : `<span class="chip">Waiting for the host to start…</span>`}
        <button type="button" class="btn big ghost" data-act="leave">Leave</button>
      </div>
    </div>
    <aside>
      <h2 style="font-size:26px;margin:0">Table scoreboard</h2>
      ${boardHtml(r)}
      <h2 style="font-size:26px;margin:0">Table settings</h2>
      ${gm.settings(pill)}
      <label class="toggle">Show in open tables<input type="checkbox" data-act="priv" ${r.priv ? '' : 'checked'} ${host ? '' : 'disabled'}></label>
      ${host ? '' : `<p style="margin:0;font-size:14px;color:var(--muted)">Only the host can change settings.</p>`}
      <div class="howto"><b>How to win</b><br>${gm.howto} <a href="#" data-act="rules">Full rules</a></div>
    </aside>
  </main>`;
}

// ---------- watching ----------
// While a game is on, a watcher gets a small bar: tap to replace a bot when the next round starts.
const $watch = document.createElement('div');
$watch.id = 'watchbar'; $watch.hidden = true; $watch.setAttribute('aria-live', 'polite');
document.body.append($watch);
function watchPaint() {
  const r = st.room, me = r?.players.find(p => p.id === st.id);
  const on = !!(st.game && me?.watch && st.lastState?.ph === 'play');
  $watch.hidden = !on; if (!on) return;
  const saving = (r.sit || []).includes(st.id), full = r.players.filter(p => !p.watch).length >= r.max;
  $watch.innerHTML = `<span>${saving ? (full ? 'Every seat is taken. You get the next free one.' : 'You take a bot’s seat next round.') : 'You’re watching.'}</span>
    <button type="button" class="btn ${saving ? 'w' : 'm'}" data-w="sit" aria-pressed="${saving}">${saving ? 'Just watch' : full ? 'Get the next free seat' : 'Play next round'}</button>`;
}
$watch.addEventListener('click', e => {
  const b = e.target.closest('[data-w="sit"]'); if (!b) return;
  sfx.click(); send({ t: 'sit', on: b.getAttribute('aria-pressed') !== 'true' });
});

// ---------- chat ----------
const $chat = document.getElementById('chat');
const chat = { log: [], open: false, unread: 0, peekT: 0 };
const CHAT_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/></svg>';
const SCORE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/></svg>';
const boardHtml = r => r.board?.length ? `<ol class="board">${r.board.map((e, i) => `<li>
    <span class="pos">${i + 1}</span>${avatarHtml(e.color, e.av, 36)}
    <b>${esc(e.name)}</b>
    <span class="num"><b>${e.wins}</b> ${e.wins === 1 ? 'win' : 'wins'}</span><span class="num"><b>${e.pts}</b> pts</span>${e.coins !== undefined ? `<span class="num"><b>${e.coins}</b> coins</span>` : ''}
  </li>`).join('')}</ol>
  <p class="boardnote">${r.played} ${r.played === 1 ? 'game' : 'games'} played at this table. Scores stay with the table, even through a server restart.</p>`
  : `<p class="boardnote">No games finished yet. Wins and points add up here for as long as the table stays open.</p>`;
function scoresPaint() { if (st.room) $chat.querySelector('.scorebody').innerHTML = boardHtml(st.room); else $chat.querySelector('.scorepanel').hidden = true; }
$chat.innerHTML = `
  <div class="chatpanel" hidden role="dialog" aria-label="Table chat">
    <div class="chathead"><b>Table chat</b><button type="button" class="round" data-c="toggle" aria-label="Close chat">×</button></div>
    <div class="chatlog" aria-live="polite"></div>
    <div class="chatemoji">${EMOJI.map((e, i) => `<button type="button" data-c="emo" data-k="${FOODS.length + i}" aria-label="React ${e}">${e}</button>`).join('')}</div>
    <form class="chatform"><input class="field" maxlength="160" placeholder="Say something nice…" autocomplete="off" aria-label="Message"><button class="btn m">Send</button></form>
  </div>
  <div class="chatpanel scorepanel" hidden role="dialog" aria-label="Table scoreboard">
    <div class="chathead"><b>Table scoreboard</b><button type="button" class="round" data-c="scores" aria-label="Close scoreboard">×</button></div>
    <div class="scorebody"></div>
  </div>
  <div class="chatpeek" hidden></div>
  <div class="chatbtns">
    <button type="button" class="btn w scorebtn" data-c="scores" aria-label="Table scoreboard">${SCORE_ICON}<span class="lbl">Scores</span></button>
    <button type="button" class="btn chatbtn" data-c="toggle" aria-label="Open chat">${CHAT_ICON}<span class="lbl">Chat</span><span class="badge" hidden></span></button>
  </div>`;
const $scores = $chat.querySelector('.scorepanel');
const $log = $chat.querySelector('.chatlog'), $panel = $chat.querySelector('.chatpanel'), $peek = $chat.querySelector('.chatpeek');
const chatLine = m => `<div class="cl${m.id === st.id ? ' own' : ''}">${avatarHtml(m.color, m.av, 30)}<p><b>${esc(m.name)}</b> ${esc(m.text)}</p></div>`;
function chatPaint() {
  $log.innerHTML = chat.log.length ? chat.log.map(chatLine).join('') : '<p class="chatempty">No messages yet. Say hi!</p>';
  $log.scrollTop = $log.scrollHeight;
}
function chatBadge() { const b = $chat.querySelector('.badge'); b.hidden = !chat.unread; b.textContent = chat.unread > 9 ? '9+' : chat.unread; }
function chatPeek(m) {
  $peek.innerHTML = chatLine(m); $peek.hidden = false;
  clearTimeout(chat.peekT); chat.peekT = setTimeout(() => { $peek.hidden = true; }, 4500);
}
function chatReset() { chat.log = []; chat.unread = 0; chat.open = false; $scores.hidden = true; $panel.hidden = true; $peek.hidden = true; chatBadge(); chatPaint(); }
$chat.addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  if (b.dataset.c === 'scores') {
    sfx.click(); $scores.hidden = !$scores.hidden;
    if (!$scores.hidden && chat.open) { chat.open = false; $panel.hidden = true; }
  } else if (b.dataset.c === 'toggle') {
    $scores.hidden = true;
    chat.open = !chat.open; $panel.hidden = !chat.open; $peek.hidden = true; sfx.click();
    if (chat.open) { chat.unread = 0; chatBadge(); $log.scrollTop = $log.scrollHeight; if (matchMedia('(pointer: fine)').matches) $chat.querySelector('input').focus(); }
  } else if (b.dataset.c === 'emo') { sfx.click(); send({ t: 'react', k: +b.dataset.k }); }
});
$chat.querySelector('form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = e.target.querySelector('input'), text = inp.value.trim(); if (!text) return;
  send({ t: 'chat', text }); inp.value = '';
});
$chat.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (chat.open) $chat.querySelector('.chatbtn').click(); else $scores.hidden = true; });

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
      <div class="cgrid">
        <div class="crow"><b>Outfit colour</b><div class="swatches">${sw('color', COLORS, 'hex')}</div></div>
        <div class="crow"><b>Outfit</b><div class="pills">${pills(6, OUTFITS)}</div></div>
        <div class="crow"><b>Skin</b><div class="swatches">${sw(0, SKINS)}</div></div>
        <div class="crow"><b>Hair colour</b><div class="swatches">${sw(2, HAIR_COLS)}</div></div>
        <div class="crow wide"><b>Hair</b><div class="pills">${pills(1, HAIRS)}</div></div>
        <div class="crow"><b>Eyes</b><div class="pills">${pills(4, EYES)}</div></div>
        <div class="crow"><b>Mouth</b><div class="pills">${pills(5, MOUTHS)}</div></div>
        <div class="crow wide"><b>Extra</b><div class="pills">${pills(3, EXTRAS)}</div></div>
        <div class="crow wide"><b>Face detail</b><div class="pills">${pills(7, DETAILS)}</div></div>
      </div>
      <button class="btn big">${first ? "Let's go" : 'Save'}</button>
      ${first ? '<button type="button" class="btn ghost-ink" data-login>I already have an account</button>' : ''}
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
    if (e.target.closest('[data-login]')) { close(); openAccount('login'); return; }
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

function openAccount(mode = 'register') {
  const reg = mode === 'register';
  const { el, close } = modal(`
    <h2>${reg ? 'Create an account' : 'Log in'}</h2>
    <p>${reg ? 'Just a username and a password, no email. Your rank, XP and wins so far move into the account, and you can log in from any device.'
      : 'Pick up your rank, XP and wins on this device.'}</p>
    <form class="authform">
      <label for="au">Username</label>
      <input class="field" id="au" maxlength="16" required autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="ap">Password</label>
      <input class="field" id="ap" type="password" minlength="6" maxlength="72" required autocomplete="${reg ? 'new-password' : 'current-password'}">
      <p class="autherr" role="alert" hidden></p>
      ${reg ? '<p style="font-size:14px">There is no password reset, so pick one you will remember.</p>' : ''}
      <button class="btn big">${reg ? 'Create account' : 'Log in'}</button>
      <button type="button" class="btn ghost-ink" data-swap>${reg ? 'I already have an account' : 'I need an account'}</button>
    </form>`);
  const err = el.querySelector('.autherr'), btn = el.querySelector('.btn.big');
  setTimeout(() => el.querySelector('#au').focus(), 50);
  el.querySelector('[data-swap]').addEventListener('click', () => { close(); onAuth = null; openAccount(reg ? 'login' : 'register'); });
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (ws?.readyState !== 1) { err.textContent = 'Not connected. Try again in a moment.'; err.hidden = false; return; }
    btn.disabled = true; err.hidden = true;
    onAuth = m => {
      btn.disabled = false;
      if (m.err) { sfx.bad(); err.textContent = m.err; err.hidden = false; return; }
      onAuth = null; close(); sfx.join();
      toast(reg ? 'Account created. Your progress is saved!' : 'Welcome back!');
      if (st.view === 'lobby') renderLobby();
    };
    if (!reg) adoptLook = true;
    send({ t: mode, user: el.querySelector('#au').value.trim(), pass: el.querySelector('#ap').value });
  });
}

export function openRules(game) {
  const ids = GAMES[game] ? [game] : Object.keys(GAMES);
  const { el, close } = modal(`
    ${ids.map(id => `<h2>How to play ${GAMES[id].name}</h2><div class="rules">${GAMES[id].rules}</div>`).join('')}
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
  else if (act === 'rules') openRules(st.view === 'lobby' ? st.room?.game : undefined);
  else if (act === 'profile') openProfile();
  else if (act === 'account') openAccount(b.dataset.mode);
  else if (act === 'logout') { send({ t: 'logout' }); toast('Logged out. This browser is a guest again.'); }
  else if (act === 'host' || act === 'solo') {
    if (!st.name) return openProfile(true);
    const game = GAMES[b.dataset.game] ? b.dataset.game : 'hotpot';
    send(act === 'host' ? { t: 'create', game, opts: GAMES[game].host } : { t: 'create', game, priv: true, solo: true, opts: GAMES[game].solo });
  }
  else if (act === 'join') send({ t: 'join', code: b.dataset.code });
  else if (act === 'leave') send({ t: 'leave' });
  else if (act === 'start') send({ t: 'start' });
  else if (act === 'sit') send({ t: 'sit', on: b.getAttribute('aria-pressed') !== 'true' });
  else if (act === 'opt') send({ t: 'opts', opts: { [b.dataset.opt]: ['timer', 'field'].includes(b.dataset.opt) ? +b.dataset.val : b.dataset.val } });
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
