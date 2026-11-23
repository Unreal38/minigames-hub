// The privacy page (both languages, the host's contact and server place filled in, CSP on) and deleting an account
// with the host's command: the account, its friend links, chat lines and sign-ins go, and its screen becomes a guest.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 18800 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-priv-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const start = async env => { srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, GEO: 'off', ...env }, stdio: 'inherit' }); await wait(700); };
const fail = m => { console.error('FAIL', m); srv.kill(); process.exit(1); };
const until = async (f, what, ms = 8000) => { const t0 = Date.now(); while (!f()) { await wait(50); if (Date.now() - t0 > ms) fail('timeout: ' + what); } };
const get = async (p, headers = {}) => { const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { headers }); return { r, text: await r.text() }; };

await start({ PRIVACY_CONTACT: 'host@example.com', SERVER_PLACE: 'Frankfurt, Germany' });

// 1. The page, in the language the server guesses, with the contact and place filled in and the CSP on.
const en = await get('/privacy', { 'accept-language': 'en-GB' });
if (en.r.status !== 200 || !/text\/html/.test(en.r.headers.get('content-type'))) fail('privacy page ' + en.r.status);
if (!/script-src 'self'/.test(en.r.headers.get('content-security-policy') || '')) fail('privacy page has no CSP');
if (!en.text.includes('<html lang="en"')) fail('English visitor should get lang=en');
if ((en.text.match(/<a href="mailto:host@example.com">host@example.com<\/a>/g) || []).length !== 2) fail('contact not filled in both languages');
if ((en.text.match(/Frankfurt, Germany/g) || []).length !== 2 || /Oracle Cloud server<!--/.test(en.text)) fail('server place not filled in');
if (/<!--contact|<!--place/.test(en.text)) fail('placeholders left in the page');
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(en.text)) fail('inline script would be blocked by the CSP');
const bot = await get('/prywatnosc', { 'user-agent': 'Googlebot/2.1', 'accept-language': 'en' });
if (!bot.text.includes('<html lang="pl"')) fail('bots should get Polish');
if ((await get('/privacy.js')).r.status !== 200) fail('privacy.js');
if (!(await get('/sitemap.xml')).text.includes('<loc>https://zatokagier.com/privacy</loc>')) fail('privacy page missing from the sitemap');
if (!fs.readFileSync('public/app.js', 'utf8').includes('href="/privacy"')) fail('no link to the privacy page in the hub');
console.log('privacy page ok');
srv.kill(); await wait(300);

// 2. Without the settings the page keeps its own contact (a Ko-fi message) and default place.
await start({ PRIVACY_CONTACT: '', SERVER_PLACE: '' });
const bare = await get('/privacy', { 'accept-language': 'pl' });
if (!bare.text.includes('wiadomość na Ko-fi: <a href="https://ko-fi.com/zatokagier"') || !bare.text.includes('wynajętym serwerze w Oracle Cloud')) fail('fallback texts');
if (/<!--contact|<!--place/.test(bare.text)) fail('placeholders left in the fallback page');
if (/mailto:/.test(bare.text)) fail('no contact should mean no mail link');
console.log('fallbacks ok');

// 3. Deleting an account.
function player(name) {
  const p = { name, token: '', me: null, auth: null, got: [], gone: [], errs: [], friended: null };
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
      if (m.t === 'err') p.errs.push(m.msg);
      if (m.t === 'friended') p.friended = m;
      if (m.t === 'hubchat') { if (m.msg) p.got.push(m.msg); if (m.gone) p.gone.push(m.gone); }
    };
  });
  p.ask = async m => { p.auth = null; p.send(m); await until(() => p.auth, 'auth reply to ' + m.t); return p.auth; };
  return p;
}
const ana = await player('Ana').connect(), bo = await player('Bo').connect();
if ((await ana.ask({ t: 'register', user: 'ana', pass: 'apple123' })).ok !== 'register') fail('register ana');
if ((await bo.ask({ t: 'register', user: 'bob', pass: 'apple123' })).ok !== 'register') fail('register bo ' + JSON.stringify(bo.auth));
ana.send({ t: 'friend', op: 'add', user: 'bob' }); await until(() => ana.friended, 'friend request');
bo.send({ t: 'friend', op: 'accept', user: 'ana' }); await until(() => bo.friended?.now, 'friend accepted');
ana.send({ t: 'hubchat', text: 'hello from ana' }); await until(() => bo.got.length, 'chat line');
const lineId = bo.got[0].id;
await wait(2000); // let the server save, so the command can find the account

const out = execFileSync('node', ['server/delete.js', 'ANA'], { env: { ...process.env, DATA_DIR }, encoding: 'utf8' });
if (!/Account ana will be deleted/.test(out)) fail('delete command said: ' + out);
await until(() => ana.errs.some(e => /deleted/.test(e)), 'deleted screen told');
await until(() => !ana.me.user, 'deleted screen is a guest');
await until(() => bo.gone.includes(lineId), 'chat line removed from open screens');
try { execFileSync('node', ['server/delete.js', 'nobody'], { env: { ...process.env, DATA_DIR }, stdio: 'pipe' }); fail('unknown user should fail'); } catch (e) { if (e.status !== 1) fail('unknown user exit code'); }
await wait(500);
const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cozy-table.json'), 'utf8'));
const profs = Object.values(saved.profiles);
if (profs.some(p => p.user === 'ana')) fail('ana still saved');
const boP = profs.find(p => p.user === 'bob');
if (!boP || boP.friends?.length || boP.reqs?.length || boP.sent?.length) fail('bo still has links to ana');
const chat = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'hub-chat.json'), 'utf8'));
if (chat.log.some(m => m.user === 'ana')) fail('ana chat line still saved');
if (fs.readdirSync(DATA_DIR).some(f => f.startsWith('delete-'))) fail('delete file left behind');
// the name is free again and the old password is gone
const again = await player('Cy').connect();
if ((await again.ask({ t: 'login', user: 'ana', pass: 'apple123' })).ok) fail('deleted account could still log in');
if ((await again.ask({ t: 'register', user: 'ana', pass: 'pear12345' })).ok !== 'register') fail('name should be free again');
console.log('delete account ok');

srv.kill();
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('privacy tests passed');
process.exit(0);
