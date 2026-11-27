// Start curtain test (Kuba 2026-11-27: "the game should not start until the curtain is opened"). A page that draws the
// curtain (hello.curt) gets a held match: no bot turns, no clocks running and no moves played until every seated
// player's page said 'ready', the room said the curtain opens and it had time to. Pages without it play at once.
import { spawn } from 'node:child_process';

const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const PORT = 27080 + (Math.random() * 900 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: `/tmp/ct-test-${PORT}`, HOLD_MIN_MS: '900', HOLD_MAX_MS: '3000' }, stdio: 'inherit' });
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(600);
function client(name, curt) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`), c = { ws, room: null, state: null, rooms: [], states: 0 };
  c.send = m => ws.send(JSON.stringify(m));
  ws.onopen = () => c.send({ t: 'hello', name, color: '#ff8fab', ...(curt ? { curt: 1 } : {}) });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'room') { c.room = m.room; if (m.room) c.rooms.push(m.room); } if (m.t === 'state') { c.state = m.s; c.states++; } };
  return c;
}
const until = async (f, ms, what) => { const end = Date.now() + ms; while (!f()) { if (Date.now() > end) fail(what); await wait(20); } };

// 1. A held Tic-Tac-Toe match against a bot: nothing happens until ready, then the curtain opens, then it begins.
{
  const a = client('Ana', true); await wait(300);
  a.send({ t: 'create', game: 'ttt', opts: { mode: 'classic', timer: 10, bots: 'chill' } }); await until(() => a.room?.game === 'ttt', 2000, 'no table');
  a.send({ t: 'start' }); await until(() => a.state?.ph === 'play', 2000, 'match not created');
  const h = a.room.hold; if (!h || h.open) fail('a match started for a curtain page is not held: ' + JSON.stringify(h));
  const t0 = Date.now(), left0 = a.state.tLeft;
  // a move sent behind the curtain waits; the bot does not move (it would after 0.9 s + 0.8 s)
  const mine = a.state.turn === a.state.me;
  if (mine) a.send({ t: 'act', a: { t: 'place', c: 4 } });
  await wait(2200);
  if (a.state.board.some(x => x >= 0)) fail('something was played while the match was held');
  if (a.room.hold?.open) fail('the curtain opened before this page was ready');
  a.send({ t: 'ready', h: 999 }); await wait(200); if (a.room.hold?.open) fail('a ready for another hold counted');
  a.send({ t: 'ready', h: h.id });
  await until(() => a.room.hold?.open, 1000, 'curtain did not open once everyone was ready');
  const openAt = Date.now();
  await until(() => !a.room.hold, 2000, 'match never began');
  if (Date.now() - openAt < 500) fail('the match began before the curtain had time to open');
  // the turn clock was moved on: the time left is what it was at the start, not what it was minus the wait
  if (left0 > 0 && a.state.tLeft >= 0 && a.state.tLeft < left0 - 400 && !mine) fail(`the turn clock ran while held (${left0} -> ${a.state.tLeft})`);
  if (mine) await until(() => a.state.board[4] === a.state.me, 1500, 'the move sent while held was not played when the match began');
  else await until(() => a.state.board.some(x => x >= 0), 4000, 'the bot never moved after the match began');
  console.log(`OK held match: opened after ${openAt - t0} ms, ${mine ? 'my held move played' : 'bot moved after the open'}`);
  a.ws.close();
}
// 2. A page that never says ready (asleep phone) does not hold the table for ever.
{
  const a = client('Bo', true); await wait(300);
  a.send({ t: 'create', game: 'ttt', opts: { mode: 'classic', timer: 10 } }); await until(() => a.room?.game === 'ttt', 2000, 'no table');
  a.send({ t: 'start' }); await until(() => a.room?.hold, 2000, 'not held');
  await until(() => !a.room.hold, 5000, 'a page that never got ready held the table past the limit');
  console.log('OK a silent page is let go after the limit');
  a.ws.close();
}
// 3. Pages without the curtain (tests, an old page before it reloads) play at once.
{
  const a = client('Cy', false); await wait(300);
  a.send({ t: 'create', game: 'ttt', opts: { mode: 'classic', timer: 10 } }); await until(() => a.room?.game === 'ttt', 2000, 'no table');
  a.send({ t: 'start' }); await until(() => a.state?.ph === 'play', 2000, 'match not created');
  if (a.room.hold) fail('a page without the curtain was held');
  console.log('OK no hold without the curtain');
  a.ws.close();
}
// 4. Two players: the curtain opens only when both are ready, for both at once.
{
  const a = client('Di', true), b = client('Ed', true); await wait(300);
  a.send({ t: 'create', game: 'ttt', opts: { mode: 'classic', timer: 10 } }); await until(() => a.room?.code, 2000, 'no table');
  b.send({ t: 'join', code: a.room.code }); await until(() => b.room?.code === a.room.code && a.room.players.length === 2, 2000, 'no join');
  a.send({ t: 'start' }); await until(() => a.room?.hold && b.room?.hold, 2000, 'not held for both');
  a.send({ t: 'ready', h: a.room.hold.id }); await wait(1400);
  if (a.room.hold?.open || b.room.hold?.open) fail('opened before the second player was ready');
  b.send({ t: 'ready', h: b.room.hold.id });
  await until(() => a.room.hold?.open && b.room.hold?.open, 1000, 'did not open for both');
  await until(() => !a.room.hold && !b.room.hold, 2000, 'did not begin for both');
  console.log('OK waits for every seated player');
}
// 5. A real-time game: the start lights count down from the moment the curtain is open, not from the start press.
{
  const a = client('Flo', true); await wait(300);
  a.send({ t: 'create', game: 'kart', opts: { laps: 1 } }); await until(() => a.room?.game === 'kart', 2000, 'no table');
  a.send({ t: 'start' }); await until(() => a.room?.hold && a.state?.game === 'kart', 3000, 'kart not held');
  await wait(1500); a.send({ t: 'ready', h: a.room.hold.id });
  await until(() => !a.room.hold, 4000, 'kart never began');
  await wait(60);
  if (!(a.state.t < -3000)) fail('the kart start lights ran behind the curtain: t = ' + a.state.t);
  console.log('OK kart lights start after the curtain: t =', a.state.t);
}
srv.kill(); process.exit(0);
