// Watch test: someone who joins mid-game watches, asks for a seat, and plays the next round in a seat a bot would have had.
import { spawn } from 'node:child_process';
const PORT = 20080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: '/tmp/cozy-watch-' + PORT }, stdio: 'inherit' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 20000) => { const t0 = Date.now(); while (!f()) { await wait(30); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
await wait(600);

function player(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const p = { ws, name, id: null, room: null, s: null, errs: [], send: m => ws.send(JSON.stringify(m)) };
  ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'welcome') p.id = m.id;
    if (m.t === 'room') p.room = m.room;
    if (m.t === 'err') p.errs.push(m.msg);
    if (m.t === 'state') {
      p.s = m.s; const s = m.s;
      if (s && s.ph === 'play' && s.turn === s.me) {
        // a short pause keeps an all-human game under the server's per-socket message budget
        setTimeout(() => p.send({ t: 'act', a: s.step === 'draw' ? { t: 'deck' } : { t: 'disc', c: s.hand.at(-1) } }), 25);
      }
    }
  };
  return p;
}
const me = (p, r = p.room) => r?.players.find(x => x.id === p.id);
const [a, b, c, d, e, f] = ['Ana', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay'].map(player);
await until(() => [a, b, c, d, e, f].every(p => p.id), 'hello');

// Four friends fill a Hot Pot table and start (all humans, so the game runs fast).
a.send({ t: 'create', game: 'hotpot', opts: { timer: 0 } });
await until(() => a.room, 'create');
for (const p of [b, c, d]) p.send({ t: 'join', code: a.room.code });
await until(() => a.room.players.length === 4, 'joins');
if (a.room.players.some(p => p.watch)) fail('lobby joiners should be seated');
// Pause Dee so the game can't finish before the watchers arrive.
d.ws.onmessage = (orig => ev => { const m = JSON.parse(ev.data); if (m.t === 'state') { d.s = m.s; return; } orig(ev); })(d.ws.onmessage);
a.send({ t: 'start' });
await until(() => a.s?.ph === 'play', 'start');

// Eli and Fay join while the game is on: they watch.
e.send({ t: 'join', code: a.room.code }); f.send({ t: 'join', code: a.room.code });
await until(() => me(e)?.watch && me(f)?.watch, 'joiners mid-game should be watchers');
if (e.s?.me !== -1) fail('watcher should see the game as a spectator');
e.send({ t: 'sit' });
await until(() => a.room.sit?.includes(e.id), 'sit request');
f.send({ t: 'again' }); // a watcher can't vote "play again"
// Dee leaves mid-game: a bot takes the seat, which Eli should get next round.
d.send({ t: 'leave' });
await until(() => a.s?.seats.some(s => s.name === 'Dee (bot)'), 'Dee botted');
await until(() => a.s?.ph === 'end', 'game 1 end', 240000);
if (a.room.again.includes(f.id)) fail('watcher vote counted');
const playedBefore = a.room.played;

a.send({ t: 'start' });
await until(() => a.s?.ph === 'play' && e.s?.ph === 'play' && f.s?.ph === 'play', 'game 2 start');
if (e.s.me < 0) fail('Eli did not get a seat');
if (e.s.seats.filter(s => s.bot).length) fail('Eli should have replaced the bot');
if (me(e)?.watch) fail('Eli still marked as watching');
if (f.s.me !== -1 || !me(f)?.watch) fail('Fay never asked for a seat, she should keep watching');
console.log('OK watcher took the bot seat:', e.s.seats.map(s => s.name).join(', '));

// Fay asks for a seat at a full table: she stays queued.
f.send({ t: 'sit' });
await until(() => a.room.sit?.includes(f.id), 'Fay queued');
await until(() => a.s?.ph === 'end', 'game 2 end', 240000);
await until(() => a.room.played === playedBefore + 1, 'scored');
const eliRow = a.room.board.find(r => r.name === 'Eli');
if (!eliRow || eliRow.games !== 1) fail('Eli missing from the table scoreboard');
e.send({ t: 'again' });
await until(() => a.room.again.includes(e.id), 'Eli can vote play again now');
console.log('OK scoreboard and play-again work for the new player');

// Back to the waiting room; Bo leaves, so Fay (queued) gets the free seat right away.
a.send({ t: 'lobby' });
await until(() => a.s === null, 'lobby');
if (!me(f)?.watch) fail('Fay should still be watching (table full)');
b.send({ t: 'leave' });
await until(() => !me(f)?.watch && !a.room.sit.includes(f.id), 'Fay seated when Bo left');
console.log('OK queued watcher seated in the waiting room');
srv.kill(); process.exit(0);
