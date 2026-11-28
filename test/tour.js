// Tournaments (server/tour.js): only hosts create and run them; accounts sign up and check in; a knockout seeds the
// players, gives the top seed a bye, calls each match to its own table, plays it for real (Tic-Tac-Toe here), hands
// walkovers to whoever came, and pays the house prizes; outsiders only watch a match table; heats move the top of each
// table on to one final table; a restart calls a running match again; the Discord posts go out (captured in tests).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 21980 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-tour-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const ENV = { BOT_PAY: 'full', ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, ADMINS: 'boss', GEO: 'off', TOUR_TEST: '1', TOUR_CHECKIN_MS: '1500', TOUR_CALL_MS: '60000', TOUR_NEXT_MS: '300', HOLD_MIN_MS: '0' };
const start = async () => { srv = spawn('node', ['server/server.js'], { env: ENV, stdio: 'inherit' }); await wait(900); };
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const until = async (f, what, ms = 10_000) => { const t0 = Date.now(); while (!f()) { await wait(40); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };

function player(name, token) {
  const p = { name, token, me: null, auth: null, list: null, ok: [], errs: [], room: null, state: null, posts: null, prize: null, calls: [] };
  p.connect = () => new Promise((res, rej) => {
    const ws = p.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token: p.token, name, color: '#ff8fab' });
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') p.token = m.token;
      if (m.t === 'me') { p.me = m.me; res(p); }
      if (m.t === 'auth') p.auth = m;
      if (m.t === 'room') p.room = m.room;
      if (m.t === 'state') p.state = m.s;
      if (m.t === 'tour' && m.list) p.list = m.list;
      if (m.t === 'tour' && m.op === 'ok') p.ok.push(m);
      if (m.t === 'tour' && m.op === 'err') p.errs.push(m.err);
      if (m.t === 'tour' && m.op === 'test') p.test = m.v;
      if (m.t === 'tour' && m.op === 'prize') p.prize = m;
      if (m.t === 'tour' && m.op === 'call') p.calls.push(m);
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, m.t); return p.auth; };
  // one tournament request: resolves with the answer (ok or err)
  p.tour = async m => { const n = p.ok.length, e = p.errs.length; p.send({ t: 'tour', ...m }); await until(() => p.ok.length > n || p.errs.length > e, 'tour ' + m.op); return p.ok.length > n ? p.ok.at(-1) : { err: p.errs.at(-1) }; };
  p.hook = async (k, m = {}) => { p.test = undefined; p.send({ t: 'tour', test: k, ...m }); await until(() => p.test !== undefined, 'test ' + k); return p.test; };
  p.T = id => p.list?.find(T => T.id === id);
  return p;
}

await start();
const boss = await player('Kuba').connect(), guest = await player('Guest').connect();
const [ana, bo, cy, dee, eli] = await Promise.all(['Ana', 'Bo', 'Cy', 'Dee', 'Eli'].map(n => player(n).connect()));
for (const [p, u] of [[boss, 'boss'], [ana, 'ana'], [bo, 'bob'], [cy, 'cyd'], [dee, 'dee'], [eli, 'eli']]) if ((await p.ask({ t: 'register', user: u, pass: 'apple123' })).ok !== 'register') fail('register ' + u);
await until(() => boss.me.admin, 'boss is a host');
await until(() => Array.isArray(guest.list), 'everyone gets the list on hello');
if (guest.list.length) fail('no tournaments at first');

// Only hosts create; the Discord link must be a real channel webhook.
if (!(await ana.tour({ op: 'create', game: 'ttt', fmt: 'ko', name: { en: 'X' }, start: Date.now() + 3600_000 })).err) fail('a player created a tournament');
if (!(await boss.tour({ op: 'cfg', hook: 'https://evil.example/api/webhooks/1/2' })).err) fail('a non-Discord hook was taken');
const cfg = await boss.tour({ op: 'cfg', hook: 'https://discord.com/api/webhooks/123456789012/abcdefghijklmnopqrstuvwxyz_0123', lang: 'pl' });
if (!cfg.cfg?.on || cfg.cfg.hook.includes('abcdefghijklmnop')) fail('hook saved, and never shown back whole ' + JSON.stringify(cfg));
if (!(await boss.tour({ op: 'create', game: 'copy', fmt: 'heat', name: { en: 'X' }, start: Date.now() + 3600_000 })).err) fail('a voting game was allowed');
if (!(await boss.tour({ op: 'create', game: 'chess', fmt: 'heat', name: { en: 'X' }, start: Date.now() + 3600_000 })).err) fail('heats of a two-seat game');
if (!(await boss.tour({ op: 'create', game: 'ttt', fmt: 'ko', name: { en: 'X' }, start: Date.now() - 5000 })).err) fail('a start in the past');
const made = await boss.tour({ op: 'create', game: 'ttt', fmt: 'ko', bo: 1, name: { en: 'Tic Cup', pl: 'Puchar Kółek' }, start: Date.now() + 3600_000, opts: { mode: 'classic', to: 1, timer: 0 }, prize: { c: [150, 80, 40], all: 10 }, minLv: 0 });
const id = made.id; if (!id) fail('create ' + JSON.stringify(made));
await until(() => guest.T(id)?.st === 'signup', 'everyone sees the new tournament');
if (guest.T(id).name.pl !== 'Puchar Kółek' || guest.T(id).prize.c[0] !== 150) fail('view ' + JSON.stringify(guest.T(id)));

// Sign-ups: accounts only, once each, leaving is fine before the start.
if (!(await guest.tour({ op: 'join', id })).err) fail('a guest signed up');
for (const p of [ana, bo, cy, dee]) if ((await p.tour({ op: 'join', id })).err) fail('join ' + p.name);
await ana.tour({ op: 'join', id }); // twice: nothing changes
await until(() => guest.T(id)?.ents.length === 4, 'four signed up');
await dee.tour({ op: 'leave', id }); await dee.tour({ op: 'join', id });
if (!(await ana.tour({ op: 'in', id })).err) fail('checked in before check-in opened');
// a host can take someone out before the start
await eli.tour({ op: 'join', id });
await until(() => guest.T(id)?.ents.length === 5, 'eli in');
await boss.tour({ op: 'kick', id, pt: eli.me.pt });
await until(() => guest.T(id)?.ents.length === 4, 'eli taken out');

// Check-in, then the start: Dee never checks in and is left out. Seeds by sign-up order (nobody has Tic-Tac-Toe wins):
// Ana 1, Bo 2, Cy 3. A bracket of 4: Ana has a bye, Bo plays Cy, and with a bye in the semis there is no 3rd place match.
await boss.hook('start', { id, in: 1600 });
await until(() => guest.T(id)?.st === 'checkin', 'check-in opens');
for (const p of [ana, bo, cy]) if ((await p.tour({ op: 'in', id })).err) fail('check in ' + p.name);
await until(() => guest.T(id)?.st === 'live', 'it starts', 6000);
let T = guest.T(id);
if (T.seed.join() !== [ana, bo, cy].map(p => p.me.pt).join()) fail('seeds ' + JSON.stringify(T.seed));
if (T.rounds.length !== 2 || T.rounds[0].length !== 2 || T.rounds[1].length !== 2 || !T.rounds[1][1].third) fail('bracket shape ' + JSON.stringify(T.rounds.map(r => r.length)));
const bye = T.rounds[0].find(m => m.bye), semi = T.rounds[0].find(m => !m.bye);
if (bye?.w !== ana.me.pt || bye.st !== 'done') fail('the top seed gets the bye');
await until(() => guest.T(id).rounds[0].find(m => !m.bye).st === 'call', 'Bo v Cy is called');
const code = guest.T(id).rounds[0].find(m => !m.bye).code;
if (!/^[A-Z0-9]{4}$/.test(code)) fail('a table code');
await until(() => bo.calls.length && cy.calls.length, 'both players are called');

// An outsider at the match table only watches; the match starts once both players sit there.
guest.send({ t: 'join', code }); await until(() => guest.room?.code === code, 'guest at the table');
if (!guest.room.players.find(x => x.name === 'Guest')?.watch) fail('an outsider got a seat');
if (!guest.room.tour || guest.room.tour.mid !== semi.id) fail('the table knows its match');
bo.send({ t: 'join', code }); cy.send({ t: 'join', code });
await until(() => bo.state && cy.state && bo.state.ph === 'play', 'the match starts by itself');
if (bo.state.seats.length !== 2 || bo.state.seats.some(s => !s.human)) fail('two people, no bots ' + JSON.stringify(bo.state.seats));
// Bo plays the top row, Cy the middle row: Bo wins (whoever starts)
const plan = new Map([[bo, [0, 1, 2]], [cy, [3, 4, 6]]]);
const mySeat = p => p.state.me;
for (let guard = 0; guard < 400 && bo.state.ph === 'play'; guard++) {
  for (const p of [bo, cy]) {
    const s = p.state; if (s.ph !== 'play' || s.stage !== 'play' || s.turn !== mySeat(p)) continue;
    const c = plan.get(p).find(x => s.board[x] == null || s.board[x] === -1);
    if (c !== undefined) p.send({ t: 'act', a: { t: 'place', c } });
  }
  await wait(60);
}
await until(() => guest.T(id).rounds[0].find(m => !m.bye).st === 'done', 'the semi is decided');
if (guest.T(id).rounds[0].find(m => !m.bye).w !== bo.me.pt) fail('Bo won the semi ' + JSON.stringify(guest.T(id).rounds[0]));
// the final is called: Ana comes, Bo doesn't, and the clock runs out: a walkover for Ana
await until(() => guest.T(id).rounds[1][0].st === 'call', 'the final is called');
const fin = guest.T(id).rounds[1][0];
if (fin.p.join() !== [ana.me.pt, bo.me.pt].join()) fail('final players ' + fin.p);
if ((await bo.tour({ op: 'more', id, mid: fin.id })).err) fail('Bo asks for more time');
if (!(await bo.tour({ op: 'more', id, mid: fin.id })).err) fail('more time twice');
const coins0 = ana.me.coins;
ana.send({ t: 'join', code: fin.code }); await until(() => ana.room?.code === fin.code, 'ana at the final table');
await boss.hook('due', { id, mid: fin.id, in: 0 });
await until(() => guest.T(id).st === 'done', 'the tournament ends', 6000);
T = guest.T(id);
if (T.top.join() !== [ana.me.pt, bo.me.pt].join()) fail('podium ' + T.top);
if (!T.rounds[1][0].wo) fail('the final was a walkover');
if (!T.rounds[1][1].bye) fail('no 3rd place match after a bye in the semis');
await until(() => ana.prize && bo.prize && cy.prize, 'prizes are told');
if (ana.prize.coins !== 150 || bo.prize.coins !== 90 || cy.prize.coins !== 10) fail('prizes: 150 for 1st, 80 + 10 for 2nd who played, 10 for Cy ' + [ana.prize.coins, bo.prize.coins, cy.prize.coins]);
await until(() => ana.me.coins === coins0 + 150 && ana.me.tw === 1, 'ana is paid and has a tournament win');
if (dee.prize) fail('Dee never played');

// Discord: the open, check-in, start and result posts, in Polish, with @here on the first three.
const posts = await boss.hook('posts');
if (posts.map(x => x.kind).join() !== 'open,checkin,live,done') fail('posts ' + posts.map(x => x.kind));
if (!posts[0].content.startsWith('@here 🏆 Zapisy otwarte: Puchar Kółek') || posts[3].content.includes('@here') || !posts[3].content.includes('Ana')) fail('post text ' + JSON.stringify(posts.map(x => x.content)));

// Heats: five players at tables of 3, top 2 go on. Round 1 has tables of 3 and 2; nobody comes, so seeds decide;
// then a final table of 3, where two come: it starts with the two (the third is placed last) and their order counts.
const h = (await boss.tour({ op: 'create', game: 'darts', fmt: 'heat', per: 3, adv: 2, name: { en: 'Dart Heats' }, start: Date.now() + 3600_000, prize: { c: [50, 20, 10], all: 0 } })).id;
for (const p of [ana, bo, cy, dee, eli]) if ((await p.tour({ op: 'join', id: h })).err) fail('heat join ' + p.name);
await until(() => guest.T(h)?.ents.length === 5, 'five in the heats');
await boss.tour({ op: 'start', id: h }); // start now: everyone signed up plays
await until(() => guest.T(h)?.st === 'live', 'heats start');
let H = guest.T(h);
if (H.rounds[0].map(m => m.p.length).join() !== '3,2') fail('tables of 3 and 2 ' + H.rounds[0].map(m => m.p.length));
await until(() => guest.T(h).rounds[0].every(m => m.st === 'call'), 'heats called');
for (const m of guest.T(h).rounds[0]) await boss.hook('due', { id: h, mid: m.id, in: 0 });
await until(() => guest.T(h).rounds.length === 2 && guest.T(h).rounds[1][0].st === 'call', 'the final table is called');
H = guest.T(h);
const fp = H.rounds[1][0].p; if (fp.length !== 3 || !H.rounds[1][0].final) fail('final of three ' + JSON.stringify(H.rounds[1]));
const people = [ana, bo, cy, dee, eli], byPt = pt => people.find(p => p.me.pt === pt);
const [f1, f2, f3] = fp.map(byPt);
f2.send({ t: 'join', code: H.rounds[1][0].code }); f3.send({ t: 'join', code: H.rounds[1][0].code });
await until(() => f2.room?.code === H.rounds[1][0].code && f3.room?.code === H.rounds[1][0].code, 'two at the final');
await boss.hook('due', { id: h, mid: H.rounds[1][0].id, in: 0 });
await until(() => guest.T(h).rounds[1][0].st === 'play', 'the final starts with the two who came');
if (f2.state?.seats?.length !== 2) fail('two seats at the short final ' + f2.state?.seats?.length);
await boss.hook('over', { id: h, mid: H.rounds[1][0].id, order: [f3.me.pt, f2.me.pt] });
await until(() => guest.T(h).st === 'done', 'heats end');
if (guest.T(h).top.join() !== [f3, f2, f1].map(p => p.me.pt).join()) fail('heat podium ' + guest.T(h).top);

// A host can set a knockout result, and can't replay a match once the next one has started; cancel ends it.
const k = (await boss.tour({ op: 'create', game: 'chess', fmt: 'ko', bo: 3, name: { en: 'Chess Cup' }, start: Date.now() + 3600_000 })).id;
for (const p of [ana, bo, cy, dee]) await p.tour({ op: 'join', id: k });
await until(() => guest.T(k)?.ents.length === 4, 'four in the chess cup');
await boss.tour({ op: 'start', id: k });
await until(() => guest.T(k)?.st === 'live' && guest.T(k).rounds[0].every(m => m.st === 'call'), 'chess semis called');
let K = guest.T(k);
if (K.rounds[1].length !== 2 || !K.rounds[1][1].third) fail('a 3rd place match with four players');
const s0 = K.rounds[0][0];
if (!(await ana.tour({ op: 'result', id: k, mid: s0.id, pt: s0.p[0] })).err) fail('a player set a result');
await boss.tour({ op: 'result', id: k, mid: s0.id, pt: s0.p[1] });
await until(() => guest.T(k).rounds[0][0].st === 'done' && guest.T(k).rounds[0][0].w === s0.p[1] && guest.T(k).rounds[0][0].by, 'host result');
if ((await boss.tour({ op: 'redo', id: k, mid: s0.id })).err) fail('replay before the next match started');
await until(() => guest.T(k).rounds[0][0].st === 'call', 'the replayed semi is called again');

// A restart: the called match comes back with a new table, and the data is kept.
srv.kill('SIGTERM'); await wait(700); await start();
const back = await player('Kuba', boss.token).connect();
await until(() => back.T(k)?.rounds[0][0].st === 'call' && back.T(k).rounds[0][0].code, 'the match is called again after a restart', 8000);
if (back.T(id)?.st !== 'done') fail('the finished cup was kept');
if (!(await back.tour({ op: 'cancel', id: k })).ok) fail('cancel');
await until(() => back.T(k)?.st === 'off', 'cancelled');
srv.kill();
console.log('OK tour: hosts only, sign-ups and check-in, seeds and byes, real match at its own table, watchers, walkovers, prizes and the title count, Discord posts, heats, host results and replays, restart');
process.exit(0);
