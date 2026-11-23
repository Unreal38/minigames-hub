// Account cosmetics: buying and wearing name colours, frames, titles and sticker packs, and what other players see.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COS, cosPrice, flairOf, STICKER_BASE } from '../public/cosmetics.js';
const PORT = 23080 + (Math.random() * 900 | 0);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cozy-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let srv;
const fail = m => { console.error('FAIL', m); srv?.kill(); process.exit(1); };
const TA = 'a'.repeat(24), TB = 'b'.repeat(24);
// Ana has coins and five Hot Pot wins (so the Pot Wizard title is earned); Bo has nothing.
fs.writeFileSync(path.join(DATA_DIR, 'cozy-table.json'), JSON.stringify({ v: 1, profiles: {
  pa: { pid: 'pa', user: 'ana', name: 'Ana', color: '#ff8fab', av: null, xp: 300, games: 10, wins: 5, pts: 50, byGame: { hotpot: { games: 10, wins: 5, best: 9 } }, coins: 2920, owned: ['ip:1'] }, // bought a Tent while isle decor was sold: refunded on load
  pb: { pid: 'pb', user: 'bo', name: 'Bo', color: '#5b9bd5', av: null, xp: 0, games: 1, wins: 0, pts: 0, byGame: { hotpot: { games: 1, wins: 0, best: 0 } }, coins: 5, owned: [] } },
  sessions: { [TA]: { id: 'aaa', pid: 'pa', seen: Date.now() }, [TB]: { id: 'bbb', pid: 'pb', seen: Date.now() } }, rooms: [] }));
srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR, SHOP_DATE: '2026-07-10', FARM_TEST: '1' }, stdio: 'inherit' });
await wait(700);
function player(token, name) {
  const p = { msgs: [], me: null, room: null, rk: null };
  p.connect = () => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    p.send = m => ws.send(JSON.stringify(m));
    ws.onopen = () => p.send({ t: 'hello', token, name, color: '#ff8fab' });
    ws.onmessage = e => { const m = JSON.parse(e.data); p.msgs.push(m); if (m.t === 'welcome') res(); if (m.t === 'me') p.me = m.me; if (m.t === 'room') p.room = m.room; if (m.t === 'rankings') p.rk = m; };
  });
  p.err = re => p.msgs.some(m => m.t === 'err' && re.test(m.msg));
  return p;
}
const NM = COS.nm.items.findIndex(x => x.n === 'Rainbow'), FROST = COS.nm.items.findIndex(x => x.n === 'Frost'), FR = COS.fr.items.findIndex(x => x.n === 'Gold');
const WIZ = COS.ti.items.findIndex(x => x.n === 'Pot Wizard'), SHARK = COS.ti.items.findIndex(x => x.n === 'Card Shark'), PARTY = COS.sp.items.findIndex(x => x.n === 'Party');
const a = player(TA, 'Ana'), b = player(TB, 'Bo'); await a.connect(); await b.connect(); await wait(200);
a.send({ t: 'create', game: 'hotpot', opts: {} }); await wait(200);
b.send({ t: 'join', code: a.room.code }); await wait(200);
const seen = () => b.room.players.find(p => p.name === 'Ana').fl;

// wearing needs owning; buying puts it on and everyone at the table sees it
a.send({ t: 'wear', k: 'nm', i: NM }); await wait(200);
if (!a.err(/not unlocked/) || seen().nm) fail('wore a name colour without buying it');
a.send({ t: 'buy', k: 'nm', i: NM }); await wait(300);
if (a.me.coins !== 3000 - cosPrice('nm', NM) || a.me.cos.nm !== NM || seen().nm !== NM) fail('buying a name colour did not put it on for others');
a.send({ t: 'buy', k: 'fr', i: FR }); await wait(300);
if (seen().fr !== FR) fail('frame not shown to others');
a.send({ t: 'buy', k: 'nm', i: FROST }); await wait(200);
if (!a.err(/Winter drop/)) fail('a winter name colour was sold in July');
a.send({ t: 'buy', k: 'ti', i: WIZ }); await wait(200);
if (!a.err(/not in the shop/)) fail('an earned title could be bought');
b.send({ t: 'buy', k: 'nm', i: NM }); await wait(200);
if (!b.err(/more coins/)) fail('bought without coins');
// titles: earned by wins
a.send({ t: 'wear', k: 'ti', i: WIZ }); await wait(200);
if (seen().ti !== WIZ) fail('an earned title could not be worn');
a.msgs.length = 0; a.send({ t: 'wear', k: 'ti', i: SHARK }); await wait(200);
if (!a.err(/not unlocked/) || seen().ti !== WIZ) fail('wore a title that was not earned');
b.send({ t: 'wear', k: 'ti', i: WIZ }); await wait(200);
if (!b.err(/not unlocked/)) fail('Bo wore a title without the wins');
// taking it off again
a.send({ t: 'wear', k: 'fr', i: 0 }); await wait(200);
if ('fr' in seen()) fail('frame did not come off');
// chat lines and rankings carry the look
a.send({ t: 'chat', text: 'hi' }); await wait(200);
if (b.msgs.find(m => m.t === 'chat')?.fl?.nm !== NM) fail('chat line has no name colour');
b.send({ t: 'rankings', game: 'hotpot' }); await wait(200);
if (b.rk?.rows.find(r => r.name === 'Ana')?.fl?.ti !== WIZ) fail('rankings row has no title');
// stickers: the free twelve work for anyone, pack stickers only after buying the pack
b.msgs.length = 0;
a.send({ t: 'react', k: STICKER_BASE }); await wait(900);
if (b.msgs.some(m => m.t === 'react')) fail('a pack sticker was sent without the pack');
a.send({ t: 'buy', k: 'sp', i: PARTY }); await wait(300);
a.send({ t: 'react', k: STICKER_BASE }); await wait(300);
if (!b.msgs.some(m => m.t === 'react' && m.k === STICKER_BASE)) fail('a bought sticker was not sent');
a.send({ t: 'react', k: 3 }); await wait(900);
// table themes ride along the same way: card backs, dice, golf balls and kart paint
for (const k of ['cb', 'dc', 'gb', 'kp']) {
  a.send({ t: 'wear', k, i: 2 }); await wait(150);
  if (seen()[k]) fail('wore a table theme without buying it: ' + k);
  a.send({ t: 'buy', k, i: 2 }); await wait(200);
  if (seen()[k] !== 2 || !a.me.owned.includes(k + ':2')) fail('table theme not bought and shown: ' + k);
}
// a Pet Farm pet can come along to the waiting room; only your own pets, and others never see its id
a.send({ t: 'farm', a: { t: 'starter', sp: 'mossbun' } }); await wait(200);
a.send({ t: 'pets' }); await wait(200);
const pets = a.msgs.find(m => m.t === 'pets')?.pets || [];
if (pets.length !== 1 || pets[0].sp !== 'mossbun') fail('no pets to pick a companion from');
a.msgs.length = 0; a.send({ t: 'wear', k: 'pet', i: 'nope' }); await wait(200);
if (!a.err(/not on your farm/) || b.room.players.find(p => p.name === 'Ana').pet) fail('brought a pet that is not theirs');
a.send({ t: 'wear', k: 'pet', i: pets[0].id }); await wait(200);
const pal = b.room.players.find(p => p.name === 'Ana').pet;
if (pal?.sp !== 'mossbun' || pal.id || a.me.cos.pet !== pets[0].id) fail('companion not shown at the table');
// up to three pets can be shown off on the isle; the first is the waiting-room companion
a.send({ t: 'farm', a: { t: 'open', test: { pet: 'puddlepup' } } }); await wait(150);
a.msgs.length = 0; a.send({ t: 'pets' }); await wait(200);
const two = a.msgs.find(m => m.t === 'pets').pets;
a.send({ t: 'wear', k: 'pets', i: [two[1].id, two[0].id] }); await wait(200);
if (a.me.cos.pets?.join() !== [two[1].id, two[0].id].join() || b.room.players.find(p => p.name === 'Ana').pet?.sp !== 'puddlepup') fail('isle pets not saved in order');
a.send({ t: 'wear', k: 'pets', i: [two[0].id, 'nope'] }); await wait(200);
if (a.me.cos.pets[0] !== two[1].id) fail('an unknown pet got onto the isle');
// anyone can open a player's profile card by the public tag on their rows; it shows no ids or usernames
const tag = b.room.players.find(p => p.name === 'Ana').pt;
b.msgs.length = 0; b.send({ t: 'player', pt: tag }); await wait(200);
const card = b.msgs.find(m => m.t === 'player')?.p;
if (!card || card.name !== 'Ana' || card.pets.length !== 2 || card.pets[0].sp !== 'puddlepup' || card.fl.nm !== NM || card.me) fail('profile card missing or wrong');
if (/"(pid|user|id|owned|coins)"/.test(JSON.stringify(card)) || !/^[0-9a-f]{12}$/.test(tag)) fail('profile card leaks private fields');
// the card's add-friend button: by tag, no username typed; the card then shows the request and, once accepted, the friendship
if (card.rel !== 'none') fail('profile card has no friend state');
b.send({ t: 'friend', op: 'add', pt: tag }); await wait(200);
b.msgs.length = 0; b.send({ t: 'player', pt: tag }); await wait(200);
if (b.msgs.find(m => m.t === 'player')?.p.rel !== 'sent') fail('friend request from the card was not sent');
const btag = a.room.players.find(p => p.name === 'Bo').pt;
a.msgs.length = 0; a.send({ t: 'player', pt: btag }); await wait(200);
if (a.msgs.find(m => m.t === 'player')?.p.rel !== 'req') fail('the other side does not see the request on the card');
a.send({ t: 'friend', op: 'accept', pt: btag }); await wait(200);
a.msgs.length = 0; a.send({ t: 'player', pt: btag }); await wait(200);
if (a.msgs.find(m => m.t === 'player')?.p.rel !== 'friend') fail('accepting from the card did not make them friends');
b.msgs.length = 0; b.send({ t: 'player', pt: 'ffffffffffff' }); await wait(150);
if (!b.err(/not around/)) fail('unknown profile tag was answered');
a.send({ t: 'wear', k: 'pets', i: [two[0].id] }); await wait(200);
b.send({ t: 'pets' }); await wait(150);
if (b.msgs.find(m => m.t === 'pets')?.pets.length) fail('Bo has pets without a farm');
// the profile isle: ground, rock base and sky are worn one at a time
const IG = n => COS.ig.items.findIndex(x => x.n === n);
a.msgs.length = 0; a.send({ t: 'wear', k: 'ig', i: IG('Sweet Shop Isle') }); await wait(200);
if (!a.err(/not unlocked/)) fail('wore an isle ground without buying it');
const coins0 = a.me.coins; a.send({ t: 'buy', k: 'ig', i: IG('Sweet Shop Isle') }); a.send({ t: 'buy', k: 'ib', i: 3 }); a.send({ t: 'buy', k: 'ik', i: 2 }); await wait(300);
if (seen().ig !== IG('Sweet Shop Isle') || seen().ib !== 3 || seen().ik !== 2 || a.me.coins !== coins0 - cosPrice('ig', IG('Sweet Shop Isle')) - cosPrice('ib', 3) - cosPrice('ik', 2)) fail('isle variants were not bought and put on');
a.msgs.length = 0; a.send({ t: 'buy', k: 'ig', i: IG('Golden isle') }); a.send({ t: 'wear', k: 'ig', i: IG('Champion’s isle') }); await wait(250);
if (!a.err(/not in the shop/) || !a.err(/not unlocked/) || seen().ig !== IG('Sweet Shop Isle')) fail('an earned isle got through');
// isle decor is not sold: it is up to three of the decorations standing on your own Pet Farm
['bush', 'tree', 'cherry', 'rock'].forEach((type, n) => a.send({ t: 'farm', a: { t: 'place', type, x: n, y: 0, r: 0 } })); await wait(300);
a.send({ t: 'pets' }); await wait(150);
const decor = a.msgs.findLast(m => m.t === 'pets').decor.map(x => x.t);
if (decor.join() !== 'bush,tree,cherry' && decor.length < 3) fail('the farm decorations were not offered for the isle: ' + decor);
a.send({ t: 'wear', k: 'ip', i: ['bush', 'tree'] }); await wait(200);
if (seen().ip?.join() !== 'bush,tree') fail('farm decorations did not go on the isle');
a.msgs.length = 0; a.send({ t: 'wear', k: 'ip', i: ['windmill'] }); a.send({ t: 'wear', k: 'ip', i: ['bush', 'tree', 'cherry', 'house'] }); a.send({ t: 'wear', k: 'ip', i: 'x' }); a.send({ t: 'buy', k: 'ip', i: 1 }); await wait(250);
if (seen().ip?.join() !== 'bush,tree' || a.msgs.filter(m => m.t === 'err').length < 4) fail('decor that is not on the farm got through');
b.msgs.length = 0; b.send({ t: 'wear', k: 'ip', i: ['bush'] }); await wait(150);
if (!b.msgs.some(m => m.t === 'err')) fail('Bo put out decor without a farm');
a.send({ t: 'farm', a: { t: 'open' } }); await wait(200);
const bushId = a.msgs.findLast(m => m.t === 'farm' && m.farm)?.farm.items.find(i => i.type === 'bush')?.id;
a.send({ t: 'farm', a: { t: 'remove', id: bushId } }); await wait(150); a.send({ t: 'wear', k: 'fr', i: 0 }); await wait(200);
if (seen().ip?.join() !== 'tree') fail('a decoration put away on the farm still stands on the isle: ' + seen().ip);
if (a.me.owned.includes('ip:1')) fail('old bought isle decor was not refunded');
b.msgs.length = 0; b.send({ t: 'player', pt: tag }); await wait(200);
if (b.msgs.find(m => m.t === 'player')?.p.fl.ig !== IG('Sweet Shop Isle')) fail('the profile card does not carry the isle look');
if (flairOf({ cos: { ig: 9, ip: ['bush', 'bush', 3, 'a b', 'tree', 'rock', 'pond'] }, xp: 0, byGame: {} }).ip?.join() !== 'bush,tree,rock' || flairOf({ cos: { ig: 9 }, xp: 19000, byGame: {} }).ig !== 9) fail('isle flair is not filtered to what is unlocked');
// the game pieces floating round the isle are a free pick of up to six
if ('fp' in seen()) fail('floating pieces were sent before any were picked');
a.send({ t: 'wear', k: 'fp', i: ['star', 'pot'] }); await wait(200);
if (seen().fp?.join() !== 'star,pot') fail('picked floating pieces are not shown');
a.msgs.length = 0; a.send({ t: 'wear', k: 'fp', i: ['star', 'star'] }); a.send({ t: 'wear', k: 'fp', i: ['nope'] }); a.send({ t: 'wear', k: 'fp', i: ['marble', 'die', 'pawn', 'card', 'chip', 'golf', 'coin'] }); await wait(200);
if (seen().fp?.join() !== 'star,pot' || a.msgs.filter(m => m.t === 'err').length < 3) fail('a bad list of floating pieces got through');
a.send({ t: 'wear', k: 'fp', i: [] }); await wait(200);
if (seen().fp?.length !== 0) fail('floating pieces could not all be taken away');
// a tampered profile shows nothing it has not unlocked
if (Object.keys(flairOf({ cos: { nm: 3, ti: SHARK, fr: 99 }, owned: [], byGame: {} })).length) fail('flairOf let unowned cosmetics through');
// everything survives a restart
const done = new Promise(r => srv.once('exit', r)); srv.kill('SIGTERM'); await done;
srv = spawn('node', ['server/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR }, stdio: 'inherit' }); await wait(700);
const c = player(TA, 'Ana'); await c.connect(); await wait(300);
if (c.me.cos.pet !== pets[0].id || c.me.cos.kp !== 2 || c.me.cos.nm !== NM || c.me.cos.ti !== WIZ || !c.me.owned.includes('sp:' + PARTY)) fail('restart lost the cosmetics');
// card backgrounds: patterns and scenes are bought, the podium ones come with a place in the overall ranking, the pet ones with album species
const PB = n => COS.pb.items.findIndex(x => x.n === n), cardFl = async () => { c.msgs.length = 0; c.send({ t: 'player', pt: c.me.pt }); await wait(200); return c.msgs.find(m => m.t === 'player').p.fl; };
if (c.me.bestPos !== 1 || c.me.petSp !== 2) fail(`best ranking place or album count not on the account: ${c.me.bestPos} ${c.me.petSp}`);
c.send({ t: 'wear', k: 'pb', i: PB('Paw prints') }); await wait(200);
if (!c.err(/not unlocked/) || (await cardFl()).pb) fail('wore a card background without buying it');
const had = c.me.coins; c.send({ t: 'buy', k: 'pb', i: PB('Paw prints') }); await wait(300);
if (c.me.coins !== had - cosPrice('pb', PB('Paw prints')) || (await cardFl()).pb !== PB('Paw prints')) fail('a bought card background is not on the card');
c.send({ t: 'buy', k: 'pb', i: PB('Golden champion') }); await wait(200);
if (!c.err(/not in the shop/)) fail('an earned card background could be bought');
c.send({ t: 'wear', k: 'pb', i: PB('Golden champion') }); await wait(200);
if ((await cardFl()).pb !== PB('Golden champion')) fail('1st place in the overall ranking did not unlock its card background');
c.msgs.length = 0; c.send({ t: 'wear', k: 'pb', i: PB('Egg nest') }); await wait(200);
if (!c.err(/not unlocked/) || (await cardFl()).pb !== PB('Golden champion')) fail('wore the Egg nest background with two species');
const d = player(TB, 'Bo'); await d.connect(); await wait(200);
d.send({ t: 'wear', k: 'pb', i: PB('Podium') }); await wait(200); d.send({ t: 'wear', k: 'pb', i: PB('Golden champion') }); await wait(200);
if (d.me.bestPos !== 2 || d.me.cos.pb !== PB('Podium') || !d.err(/not unlocked/)) fail('2nd place should unlock the Podium background only');
if (COS.pb.items.some((it, i) => i && !it.p && !it.earn && !it.pk) || !['p', 's', 'a', 'e'].every(t => COS.pb.items.some(it => it.t === t))) fail('card background catalogue is missing a kind or a price');
srv.kill();
console.log('OK cosmetics: buy, wear, earned titles, seasons, stickers, table themes, isle pets, isle variants, profile cards, card backgrounds, flair at the table, in chat and in rankings');
process.exit(0);
