// Ko-fi supporters: the webhook is only believed with the right token, a username in the Ko-fi message gives that
// account the Supporter pack, a payment without one can be claimed once by email, pack items cannot be bought or
// worn without the pack, and the host's supporter command works.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AV_KEYS, OPT, packIds, wearable } from '../public/avatar.js';
import { cosPackIds, COS } from '../public/cosmetics.js';
const PORT = 19080 + (Math.random() * 900 | 0), KEY = 'test-kofi-token';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); };

const prof = (pid, user) => ({ pid, user, name: user, color: '#ff8fab', av: null, xp: 0, games: 1, wins: 0, pts: 0, byGame: {}, coins: 500 });
const T = { ana: 'a'.repeat(24), bo: 'b'.repeat(24), cy: 'c'.repeat(24) };
fs.writeFileSync(path.join(DATA_DIR, 'cozy-table.json'), JSON.stringify({ v: 1, profiles: { p1: prof('p1', 'Ana'), p2: prof('p2', 'bo_2'), p3: prof('p3', 'Cy') },
  sessions: { [T.ana]: { id: 'a1', pid: 'p1', seen: Date.now() }, [T.bo]: { id: 'b1', pid: 'p2', seen: Date.now() }, [T.cy]: { id: 'c1', pid: 'p3', seen: Date.now() } }, rooms: [] }));
const boot = async env => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off', ...env }, stdio: 'inherit' }); await wait(700); };
const stop = async () => { const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done; };

function player(token) {
  const p = { msgs: [], me: null };
  p.connect = () => new Promise(res => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name: 'X', color: '#ff8fab', av: null });
    ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') res(); if (m.t === 'me') p.me = m.me; };
  });
  p.last = t => p.msgs.filter(m => m.t === t).at(-1);
  return p;
}
const hook = (d, token = KEY) => fetch(`http://127.0.0.1:${PORT}/kofi`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ data: JSON.stringify({ verification_token: token, type: 'Donation', ...d }) }) }).then(r => r.status);
const CLOTHES = packIds('kofi'), COSM = cosPackIds('kofi'), IDS = [...CLOTHES, ...COSM], has = p => IDS.every(id => p.me.owned.includes(id));
ok(CLOTHES.length === 7 && COSM.length === 10, 'the Supporter pack should be seven clothes and ten account cosmetics');

// without KOFI_TOKEN the address does not exist
await boot({});
ok(await hook({ kofi_transaction_id: 't0', message: 'Ana', email: 'a@x.pl' }) === 405, 'the webhook should be off without KOFI_TOKEN');
await stop();

await boot({ KOFI_TOKEN: KEY });
const ana = player(T.ana), bo = player(T.bo), cy = player(T.cy);
await ana.connect(); await bo.connect(); await cy.connect(); await wait(300);

// pack items are not for sale and come off anyone who does not own them
const [hk, hi] = IDS.find(id => id.startsWith('hat:')).split(':');
ana.send({ t: 'buy', k: hk, i: +hi }); await wait(200);
ok(ana.last('err')?.msg === 'That is not in the shop.' && !ana.me.owned.includes('hat:' + hi), 'a pack item was sold for coins');
const look = AV_KEYS.map(k => k === 'hat' ? +hi : 0);
ok(wearable(look, [])[AV_KEYS.indexOf('hat')] === 0 && wearable(look, IDS)[AV_KEYS.indexOf('hat')] === +hi, 'wearable() should lock pack items');
ok(OPT.hat[+hi] === 'Coffee mug hat', 'unexpected pack hat');
const fr = +COSM.find(id => id.startsWith('fr:')).slice(3);
ana.send({ t: 'buy', k: 'fr', i: fr }); await wait(200);
ok(ana.last('err')?.msg === 'That is not in the shop.' && !ana.me.owned.includes('fr:' + fr), 'a pack cosmetic was sold for coins');
ana.send({ t: 'wear', k: 'fr', i: fr }); await wait(200);
ok((ana.me.cos?.fr | 0) !== fr, 'a pack frame was worn without the pack');

// a wrong token is refused and changes nothing
ok(await hook({ kofi_transaction_id: 't1', message: 'Ana', email: 'a@x.pl' }, 'nope') === 403, 'a wrong token was accepted');
ok(await hook({ kofi_transaction_id: 't1', message: 'Ana', email: 'a@x.pl' }, '') === 403, 'an empty token was accepted');
await wait(200); ok(!has(ana), 'a forged call gave the pack');

// the username in the message (any case, inside a sentence) gives the pack, live
ok(await hook({ kofi_transaction_id: 't2', message: 'Great site! my nick is ANA :)', email: 'ana@x.pl' }) === 200, 'the webhook refused a real call');
await wait(500);
ok(has(ana) && ana.last('pack'), 'Ana did not get the pack from her username');
ana.send({ t: 'wear', k: 'fr', i: fr }); await wait(300);
ok(ana.me.cos?.fr === fr, 'the pack frame could not be worn with the pack');
ok(await hook({ kofi_transaction_id: 't3', message: 'bo_2', email: 'bo@x.pl' }) === 200, 'second call refused'); await wait(400);
ok(has(bo), 'a username with an underscore was not found');

// no username: the payment waits and is claimed once by email
ok(await hook({ kofi_transaction_id: 't4', message: 'thanks for the games', email: 'Cy.Mail@Example.com' }) === 200, 'third call refused');
ok(await hook({ kofi_transaction_id: 't4', message: 'Cy', email: 'Cy.Mail@Example.com' }) === 200, 'a repeat call should still be answered'); await wait(300);
ok(!has(cy), 'a repeated transaction id was handled twice');
cy.send({ t: 'kofi', email: 'wrong@example.com' }); await wait(200);
ok(cy.last('kofi')?.err && !has(cy), 'a wrong email claimed a payment');
cy.send({ t: 'kofi', email: ' cy.mail@example.com ' }); await wait(400);
ok(cy.last('kofi')?.ok && has(cy), 'the right email did not claim the payment');
ok(!fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8').toLowerCase().includes('example.com'), 'an email was saved');
await stop();

// the claim is used up, and the host command gives the pack by hand
const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
ok(saved.kofi.pend.length === 0 && saved.kofi.seen.length === 3, 'the Ko-fi list was not saved as expected');
ok(!JSON.stringify(saved).includes('example.com') && !JSON.stringify(saved).includes('x.pl'), 'an email was saved');
// bo_2 gets the pack as it first shipped (clothes only), to check that the server tops it up
saved.profiles.p4 = prof('p4', 'Dee'); saved.profiles.p2.owned = saved.profiles.p2.owned.filter(id => CLOTHES.includes(id)); fs.writeFileSync(path.join(DATA_DIR, 'cozy-table.json'), JSON.stringify(saved));
await boot({ KOFI_TOKEN: KEY });
execFileSync('node', ['server/supporter.js', 'dee'], { env: { ...process.env, DATA_DIR }, stdio: 'ignore' });
await wait(3600); await stop();
const after = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
ok(IDS.every(id => after.profiles.p4.owned?.includes(id)), 'the supporter command did not give the pack');
ok(IDS.every(id => after.profiles.p1.owned.includes(id)), 'the pack was lost over a restart');
ok(IDS.every(id => after.profiles.p2.owned.includes(id)), 'an early supporter did not get the account cosmetics');
console.log('kofi: all good');
process.exit(0);
