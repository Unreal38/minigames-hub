// Smoke test: two simulated players host/join a table and play a full game against bots.
import { spawn } from 'node:child_process';
const PORT = 18080 + (Math.random() * 1000 | 0);
const srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1' }, stdio: 'inherit' });
await new Promise(r => setTimeout(r, 600));
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };

function player(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const p = { ws, name, msgs: [], room: null, s: null, send: m => ws.send(JSON.stringify(m)) };
  ws.onopen = () => p.send({ t: 'hello', name, color: '#ff8fab' });
  ws.onmessage = e => {
    const m = JSON.parse(e.data); p.msgs.push(m);
    if (m.t === 'room') p.room = m.room;
    if (m.t === 'state') {
      p.s = m.s; const s = m.s;
      if (s && s.ph === 'play' && s.turn === s.me) {
        if (s.step === 'draw') p.send({ t: 'act', a: { t: 'deck' } });
        else p.send({ t: 'act', a: { t: 'disc', c: s.hand[Math.random() * s.hand.length | 0] } });
      }
    }
  };
  return p;
}
const a = player('Ana'), b = player('Bo');
await new Promise(r => setTimeout(r, 400));
a.send({ t: 'create', game: 'hotpot', opts: { bots: 'sharp', timer: 0 } });
await new Promise(r => setTimeout(r, 300));
if (!a.room) fail('no room');
b.send({ t: 'join', code: a.room.code });
await new Promise(r => setTimeout(r, 300));
if (b.room?.players.length !== 2) fail('join failed');
a.send({ t: 'start' });
const t0 = Date.now();
while (!(a.s && a.s.ph === 'end')) { await new Promise(r => setTimeout(r, 200)); if (Date.now() - t0 > 240000) fail('game did not end'); }
const s = a.s;
console.log('rounds', s.round, 'winner', s.win, s.win >= 0 ? s.seats[s.win].name : '-', 'pts', s.res.map(r => r.pts).join(','));
if (b.s.hand.length && a.s.hand.some(c => b.s.hand.includes(c))) fail('hands overlap');
// hidden info: during play Bo's view must not include others' hands
const playStates = b.msgs.filter(m => m.t === 'state' && m.s?.ph === 'play');
if (playStates.some(m => m.s.hands)) fail('leaked hands');
console.log('OK', playStates.length, 'state updates');
srv.kill(); process.exit(0);
