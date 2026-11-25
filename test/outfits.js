// Saved outfits in the Wardrobe: kept on the profile (guests too), checked by the server, and never a way to wear
// something not bought (the profile message still takes unbought items off).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AV_KEYS, OPT, OUTFITS } from '../public/avatar.js';
const PORT = 19080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const boot = async () => { srv = spawn('node', ['server/server.js'], { env: { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };
function player(token) {
  const p = { msgs: [], me: null };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name: 'Ana', color: '#ff8fab', av: AV_KEYS.map(() => 0) });
    ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') res(); if (m.t === 'me') p.me = m.me; if (m.t === 'room') p.room = m.room; };
  });
  return p;
}
const HAT = AV_KEYS.indexOf('hat'), halo = OPT.hat.indexOf('Halo');
const look = h => { const a = AV_KEYS.map(() => 0); a[HAT] = h; return a; };
const TOKEN = 'f'.repeat(24);

await boot();
const a = player(TOKEN); await a.connect(); await wait(300);
if (!Array.isArray(a.me?.fits) || a.me.fits.length) fail('a new profile should have no outfits');
a.send({ t: 'fits', l: [{ n: 'Party <b>', c: '#AABBCC', av: look(1) }, { n: 'Angel', c: '#ff8fab', av: look(halo) }] }); await wait(300);
const f = a.me.fits;
if (f.length !== 2 || f[0].n !== 'Party b' || f[0].c !== '#aabbcc' || f[0].av.length !== AV_KEYS.length) fail('outfits not saved cleanly: ' + JSON.stringify(f));
if (f[1].av[HAT] !== halo) fail('an outfit may hold an item not bought (it is only tried on)');
// putting the halo outfit on still wears no halo for others
a.send({ t: 'create', game: 'hotpot', opts: {} }); await wait(300);
a.send({ t: 'profile', name: 'Ana', color: '#ff8fab', av: f[1].av }); await wait(300);
if (a.room.players[0].av[HAT] !== 0) fail('an unbought halo from an outfit was worn');
// bad lists are refused and change nothing
a.msgs.length = 0;
a.send({ t: 'fits', l: Array.from({ length: OUTFITS + 1 }, () => ({ n: 'x', c: '#000000', av: look(0) })) }); await wait(200);
a.send({ t: 'fits', l: [{ n: 'x', c: 'red', av: look(0) }] }); await wait(200);
a.send({ t: 'fits', l: 'nope' }); await wait(200);
if (a.msgs.filter(m => m.t === 'err').length !== 3 || a.me.fits.length !== 2) fail('bad outfit lists were not refused');
// they survive a restart
await stop(); await boot();
const b = player(TOKEN); await b.connect(); await wait(300);
if (b.me?.fits?.length !== 2 || b.me.fits[1].n !== 'Angel') fail('outfits were lost on restart');
b.send({ t: 'fits', l: [] }); await wait(300);
if (b.me.fits.length) fail('could not delete outfits');
await stop();
console.log('outfits ok');
process.exit(0);
