// Tournaments on the page (server/tour.js runs them): the hub band with the Sign up button, the tournament page with
// the bracket, the "Your match is ready" call that finds a player anywhere on the site (plus the strip at the top,
// the tab title and a browser notification while the tab is in the background), the waiting room and results lines
// of a match table, and the hosts' Tournaments tab in the Admin panel.
import { L, PL, LOCALE, cnt, ord } from './i18n.js';
import { morph } from './morph.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LSget = k => { try { return localStorage.getItem(k); } catch { return null; } };
const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const pick = x => (x ? (PL ? x.pl || x.en : x.en || x.pl) || '' : '');
let d = null; // from app.js: send, modal, toast, sfx, me(), room(), avatarHtml, gameName(id), join(code), openPlayer(pt), srvText, setStrip(html), settingsHtml(game, opts, pill), onList()
let al = null; // the Discord alerts window: { win, subs, lang, ping, all, sel: Set, busy, hook, label }
let list = [], at = 0, sheet = null, sheetId = '', histSheet = null, hist = null, one = null, callWin = null, seenCalls = new Set(), adm = null;

/** app.js hands over what this needs. */
export function initTour(deps) { d = deps; }
export const tours = () => list;

// ---------- words ----------
const myPt = () => d?.me()?.pt || '';
const nameOf = (T, pt) => T.names?.[pt] || T.ents.find(e => e.pt === pt)?.name || '?';
const mineIn = T => T.ents.find(e => e.pt === myPt());
const when = t => new Date(t).toLocaleString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const hm = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
// 2 d 4 h · 3 h 12 min · 4:05
export function left(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), dd = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return dd ? `${dd} ${L('d', 'd.')} ${h} ${L('h', 'godz.')}` : h ? `${h} ${L('h', 'godz.')} ${m} min` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
const cd = (end, cls = '') => `<time class="tcd ${cls}" data-end="${end}">${left(end - Date.now())}</time>`;
const fmtText = T => T.fmt === 'ko' ? (T.bo === 3 ? L('Knockout · best of 3', 'Pucharowy · do 2 wygranych') : L('Knockout · one game', 'Pucharowy · jedna gra'))
  : L(`Heats of ${T.per} · top ${T.adv} go on`, `Grupy po ${T.per} · dalej ${T.adv} najlepszych`);
const STATE = () => ({ signup: L('Sign-ups open', 'Zapisy otwarte'), checkin: L('Check-in', 'Potwierdzanie obecności'), live: L('Live', 'Trwa'), done: L('Finished', 'Zakończony'), off: L('Cancelled', 'Odwołany') });
function roundName(T, r, m) {
  const R = T.rounds.length;
  if (T.fmt === 'heat') return m?.final ? L('Final table', 'Stół finałowy') : L(`Round ${r + 1}`, `Runda ${r + 1}`);
  if (m?.third) return L('3rd place', 'Mecz o 3. miejsce');
  return r === R - 1 ? L('Final', 'Finał') : r === R - 2 ? L('Semi-finals', 'Półfinały') : r === R - 3 ? L('Quarter-finals', 'Ćwierćfinały') : L(`Round ${r + 1}`, `Runda ${r + 1}`);
}
const curRound = T => { for (let r = 0; r < T.rounds.length; r++) if (T.rounds[r].some(m => m.st !== 'done' && !m.bye)) return r; return T.rounds.length - 1; };
const prizeText = T => [T.prize.c[0] ? `🏆 ${L('Trophy', 'Puchar')} + ${cnt(T.prize.c[0], 'coin', 'coins', 'moneta', 'monety', 'monet')}` : `🏆 ${L('Trophy', 'Puchar')}`].join('');
const rulesText = T => pick(T.rules) || (T.fmt === 'ko'
  ? L(`Up to ${T.max} players, one against one. Lose and you are out. The site opens your table and calls you when your match is ready: come within ${Math.round(T.call / 60000)} minutes or it counts as a walkover. A drawn game is played again.`,
    `Do ${T.max} graczy, jeden na jednego. Przegrywasz i odpadasz. Strona sama otworzy twój stół i zawoła cię, gdy mecz będzie gotowy: przyjdź w ciągu ${Math.round(T.call / 60000)} minut, inaczej przegrywasz walkowerem. Remis oznacza powtórkę.`)
  : L(`Up to ${T.max} players at tables of ${T.per}. The top ${T.adv} of each table go on, until one final table is left. The site opens your table and calls you: come within ${Math.round(T.call / 60000)} minutes, or the table plays without you.`,
    `Do ${T.max} graczy przy stołach po ${T.per}. Z każdego stołu dalej idzie ${T.adv} najlepszych, aż zostanie jeden stół finałowy. Strona sama otworzy twój stół i cię zawoła: przyjdź w ciągu ${Math.round(T.call / 60000)} minut, inaczej stół zagra bez ciebie.`));
// The match calling this player right now (and they are not at its table), in any tournament.
function myCall() {
  const me = myPt(); if (!me) return null;
  for (const T of list) {
    if (T.st !== 'live') continue;
    for (const row of T.rounds) for (const m of row) if (m.st === 'call' && m.code && m.p.includes(me) && !(m.cut || []).includes(me)) return { T, m };
  }
  return null;
}
const atTable = code => d.room()?.code === code;

// ---------- the list from the server ----------
/** A {t:'tour'} message. */
export function onTour(m) {
  if (m.list) { list = m.list; at = Date.now(); paintAll(); return; }
  if (m.op === 'err') { if (al && m.of === 'sub_add') { al.busy = false; paintAlerts(); } d.sfx.bad(); return d.toast(esc(d.srvText(m.err)), true); }
  if (m.op === 'prize') {
    const T = list.find(x => x.id === m.id), nm = T ? esc(pick(T.name)) : L('the tournament', 'turniej');
    d.sfx.win?.();
    return d.toast(m.place === 1 ? `🏆 ${L(`You won ${nm}!`, `Wygrywasz: ${nm}!`)}${m.coins ? ` +${cnt(m.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}` : ''}`
      : `🏆 ${nm}: ${m.place ? `${ord(m.place)} ${L('place', 'miejsce')}` : L('thanks for playing', 'dzięki za grę')}${m.coins ? ` · +${cnt(m.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}` : ''}`);
  }
  if (m.op === 'call') return paintAll(true);
  if (m.op === 'ok') {
    if (m.subs) {
      if (al) { al.subs = m.subs; if (m.of === 'sub_add') { al.busy = false; if (m.added) { al.hook = ''; al.label = ''; d.sfx.join(); d.toast(L('Connected! Look for the test message in your channel.', 'Połączono! Na kanale czeka wiadomość próbna.')); } } paintAlerts(); }
      if (adm) { adm.subs = m.subs.all; paintAdmin(); }
      if (m.of === 'sub_del') d.toast(L('Channel removed.', 'Kanał usunięty.'));
      return;
    }
    if (m.hist) { hist = m.hist; return paintHist(); }
    if (m.one) { one = m.one; return paintSheet(); }
    if (m.cfg) { if (adm) { adm.cfg = m.cfg; if (m.games) { adm.games = m.games; adm.defs = m.defs || {}; } paintAdmin(); } }
    if (m.of === 'join' && m.joined) { d.sfx.join(); d.toast(L('You are signed up! The site calls you when your match is ready.', 'Zapis przyjęty! Strona zawoła cię, gdy twój mecz będzie gotowy.')); }
    if (m.of === 'in') { d.sfx.pop(); d.toast(L('You are checked in. Stay close!', 'Obecność potwierdzona. Bądź w pobliżu!')); }
    if (m.of === 'create') { d.sfx.join(); d.toast(L('Sign-ups are open.', 'Zapisy otwarte.')); if (adm) { adm.form = null; paintAdmin(); } }
    if (m.of === 'hooktest') d.toast(L('Sent a test message to Discord.', 'Wysłano wiadomość próbną na Discorda.'));
    if (m.of === 'cfg') d.toast(L('Saved.', 'Zapisano.'));
  }
}
/** The player's account changed (the list can come in before it): repaint what depends on who this is. */
export const tourRefresh = () => { if (d && list.length) paintAll(); };
function paintAll(fresh = false) {
  paintBand(); paintStrip(); paintSheet(); paintCall(fresh); if (adm) paintAdmin(); d.onList?.();
}

// ---------- the hub band ----------
// The one to show: a live one you play in, then live, check-in, sign-ups (soonest first), then the latest finished.
export function featured() {
  const me = myPt(), rank = T => T.st === 'live' ? (T.seed.includes(me) ? 0 : 1) : T.st === 'checkin' ? 2 : T.st === 'signup' ? 3 : 4;
  return list.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) < 4 ? a.start - b.start : (b.endAt || 0) - (a.endAt || 0)))[0] || null;
}
const face = (e, cls = '') => `<span class="tb-face ${cls}">${d.avatarHtml(e.color, e.av, 26)}<b>${esc(e.name)}</b></span>`;
export function tourBanHtml() {
  const T = featured(); if (!T) return '';
  const me = mineIn(T), acct = !!d.me()?.user, st = STATE()[T.st], call = myCall();
  let btn, box, kick = `🏆 ${L('Tournament', 'Turniej')} · ${st}`, row;
  if (T.st === 'signup' || T.st === 'checkin') {
    const closes = T.start - (T.st === 'signup' ? T.checkin : 0);
    btn = me ? (T.st === 'checkin' && !me.in ? `<button type="button" class="btn big" data-tour="in" data-id="${T.id}">${L('I’m here', 'Jestem')}</button>`
      : `<button type="button" class="btn big w tb-on" data-tour="open" data-id="${T.id}">✓ ${T.st === 'checkin' ? L('You’re checked in', 'Obecność potwierdzona') : L('You’re signed up', 'Zapis przyjęty')}</button>`)
      : T.ents.length >= T.max ? `<button type="button" class="btn big w" disabled>${L('Full', 'Brak miejsc')}</button>`
      : `<button type="button" class="btn big" data-tour="join" data-id="${T.id}">${acct ? L('Sign up', 'Zapisz się') : L('Sign up (account)', 'Zapisz się (konto)')}</button>`;
    box = `<small>${T.st === 'signup' ? L('Sign-ups close in', 'Zapisy kończą się za') : L('Starts in', 'Start za')}</small>${cd(closes)}<small>${T.st === 'signup' ? L(`${T.ents.length} of ${T.max} places taken`, `Zajęte miejsca: ${T.ents.length} z ${T.max}`) : L(`${T.ents.filter(e => e.in).length} of ${T.ents.length} here`, `Obecni: ${T.ents.filter(e => e.in).length} z ${T.ents.length}`)}</small><span class="tb-bar"><i style="width:${Math.round(100 * (T.st === 'signup' ? T.ents.length / T.max : T.ents.filter(e => e.in).length / Math.max(1, T.ents.length)))}%"></i></span>`;
    const shown = T.ents.slice(0, 15);
    row = `<span class="pb-mh">${L('Signed up', 'Zapisani')} · ${T.ents.length}/${T.max}</span><div class="tb-who">${shown.map(e => face(e, `${e.pt === myPt() ? 'me' : ''}${T.st === 'checkin' && e.in ? ' in' : ''}`)).join('')}${T.ents.length > shown.length ? `<span class="tb-face more"><b>+${T.ents.length - shown.length}</b></span>` : ''}${T.max > T.ents.length && T.st === 'signup' ? `<span class="tb-face free"><i>+</i><b>${L(`${T.max - T.ents.length} places left`, `wolne miejsca: ${T.max - T.ents.length}`)}</b></span>` : ''}</div>`;
  } else if (T.st === 'live') {
    const r = curRound(T), playing = T.rounds.flat().filter(m => m.st === 'play' || m.st === 'call');
    kick = `🔴 ${L('Live', 'Na żywo')} · ${roundName(T, r, T.rounds[r]?.[0])}`;
    btn = call ? `<button type="button" class="btn big" data-tour="go" data-code="${call.m.code}">${L('Go to my table', 'Idź do mojego stołu')}</button>`
      : `<button type="button" class="btn big" data-tour="open" data-id="${T.id}">${L('See the bracket', 'Zobacz drabinkę')}</button>`;
    box = call ? `<small>${L('Your match is ready', 'Twój mecz czeka')}</small>${cd(Date.now() + call.m.left - (Date.now() - at))}<small>${L('to get to your table', 'na dojście do stołu')}</small>`
      : `<small>${L('Matches on now', 'Mecze teraz')}</small><time class="tcd">${playing.length}</time><small>${L(`${T.seed.length} players`, `Graczy: ${T.seed.length}`)}</small>`;
    row = playing.length ? `<span class="pb-mh">${L('Watch now', 'Oglądaj teraz')}</span><div class="tb-who">${playing.slice(0, 8).map(m => `<button type="button" class="tb-face live" data-tour="go" data-code="${m.code}">▶ <b>${m.p.map(pt => esc(nameOf(T, pt))).join(' – ')}</b></button>`).join('')}</div>` : '';
  } else {
    const champ = T.top[0];
    kick = `🏆 ${st}`;
    btn = `<button type="button" class="btn big w" data-tour="open" data-id="${T.id}">${T.st === 'done' ? L('See the results', 'Zobacz wyniki') : L('Details', 'Szczegóły')}</button>`;
    box = T.st === 'done' && champ ? `<small>${L('Champion', 'Zwycięzca')}</small><b class="tb-champ">🏆 ${esc(nameOf(T, champ))}</b>${T.top[1] ? `<small>2. ${esc(nameOf(T, T.top[1]))}${T.top[2] ? ` · 3. ${esc(nameOf(T, T.top[2]))}` : ''}</small>` : ''}`
      : `<small>${T.why === 'few' ? L('Not enough players came.', 'Przyszło za mało graczy.') : L('A host cancelled it.', 'Gospodarz go odwołał.')}</small>`;
    row = '';
  }
  return `<section class="partyban tourban st-${T.st}" id="tourban" aria-label="${L('Tournament', 'Turniej')}"><div class="pb-in">
  <button type="button" class="pb-art" data-tour="open" data-id="${T.id}" aria-label="${esc(pick(T.name))}"><img src="/gamepics/${esc(T.game)}-s.jpg" alt="" loading="lazy" decoding="async"></button>
  <div class="pb-body"><span class="pb-kick">${kick}</span>
    <div class="pb-title"><h2>${esc(pick(T.name))}</h2><button type="button" class="ghelp" data-tour="open" data-id="${T.id}" aria-label="${L('Tournament rules', 'Zasady turnieju')}" title="${L('Tournament rules', 'Zasady turnieju')}">?</button></div>
    <div class="tb-chips"><span>${esc(d.gameName(T.game))}</span><span>${fmtText(T)}</span><span>📅 ${esc(when(T.start))}</span><span class="prize">${prizeText(T)}</span></div>
    <p>${esc(rulesText(T))}</p></div>
  <div class="pb-side">${btn}<div class="pb-open tb-left">${box}</div></div>
  ${row ? `<div class="pb-minis">${row}</div>` : ''}
</div></section>`;
}
function paintBand() {
  const el = document.getElementById('tourban-slot'); if (el) morph(el, tourBanHtml());
}

// ---------- the strip at the top, the tab title, the call ----------
function paintStrip() {
  const c = myCall(), me = myPt();
  let html = '';
  if (c && !atTable(c.m.code)) html = `<div class="sb ann tsb hot" role="status"><span class="sbico" aria-hidden="true">🏆</span><span class="sbtxt"><b>${L('Your match is ready', 'Twój mecz czeka')}</b> ${cd(Date.now() + c.m.left - (Date.now() - at))}</span><button type="button" class="btn sm" data-tour="go" data-code="${c.m.code}">${L('Go', 'Idź')}</button></div>`;
  else {
    const T = list.find(x => x.st === 'checkin' && x.ents.some(e => e.pt === me && !e.in));
    const S = !T && list.find(x => x.st === 'signup' && LSget('ct_tour_x') !== x.id);
    if (T) html = `<div class="sb ann tsb" role="status"><span class="sbico" aria-hidden="true">⏰</span><span class="sbtxt"><b>${esc(pick(T.name))}</b>: ${L('say you are here', 'potwierdź obecność')} ${cd(T.start)}</span><button type="button" class="btn sm" data-tour="in" data-id="${T.id}">${L('I’m here', 'Jestem')}</button></div>`;
    else if (S) html = `<div class="sb ann tsb" role="status"><span class="sbico" aria-hidden="true">🏆</span><button type="button" class="sbtxt" data-tour="open" data-id="${S.id}"><b>${esc(pick(S.name))}</b>: ${L(`sign-ups are open until ${esc(when(S.start - S.checkin))}`, `zapisy trwają do ${esc(when(S.start - S.checkin))}`)} <i>${L(`${S.ents.length} of ${S.max} places`, `${S.ents.length} z ${S.max} miejsc`)}</i></button><button type="button" class="sbx" data-tour="stripx" data-id="${S.id}" aria-label="${L('Hide this message', 'Ukryj tę wiadomość')}">×</button></div>`;
  }
  d.setStrip(html);
  blink(!!(c && !atTable(c.m.code)));
}
let blinkT = 0, baseTitle = '';
function blink(on) {
  if (on && document.hidden && !blinkT) {
    baseTitle = document.title;
    blinkT = setInterval(() => { document.title = document.title === baseTitle ? `🏆 ${L('Your match!', 'Twój mecz!')}` : baseTitle; }, 1000);
  } else if ((!on || !document.hidden) && blinkT) { clearInterval(blinkT); blinkT = 0; document.title = baseTitle; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) blink(false); else paintStrip(); });
function paintCall(fresh) {
  const c = myCall();
  if (!c || atTable(c.m.code)) { callWin?.close(); callWin = null; return; }
  const key = c.m.id + c.m.code + c.m.g; // a new call (or the next game of a best of 3 at a new table)
  if (seenCalls.has(key) && !fresh) { paintCallBody(c); return; }
  if (seenCalls.has(key) && callWin) return paintCallBody(c);
  seenCalls.add(key);
  d.sfx.join();
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(L('Your match is ready', 'Twój mecz czeka'), { body: `${pick(c.T.name)} · ${c.m.p.filter(pt => pt !== myPt()).map(pt => nameOf(c.T, pt)).join(', ')}`, tag: 'tour-' + c.m.id, icon: '/icon-192.png' }); } catch {}
  }
  callWin?.close();
  callWin = d.modal(`<div class="tcall"></div>`);
  callWin.el.querySelector('.sheet').classList.add('tcallsheet');
  callWin.onClose = () => { callWin = null; };
  paintCallBody(c);
}
function paintCallBody(c) {
  const box = callWin?.el.querySelector('.tcall'); if (!box) return;
  const T = c.T, m = c.m, me = myPt(), r = T.rounds.findIndex(row => row.includes(m));
  const others = m.p.filter(pt => pt !== me), ent = pt => T.ents.find(e => e.pt === pt) || { name: nameOf(T, pt) };
  const html = `<p class="tc-kick">🏆 ${esc(pick(T.name))} · ${esc(roundName(T, r, m))}</p>
    ${others.length > 1 // a heat table: everyone at it, smaller, no "vs"
      ? `<div class="tc-vs many" style="--n:${others.length + 1 <= 4 ? others.length + 1 : Math.ceil((others.length + 1) / 2)}">${[me, ...others].slice(0, 8).map(pt => `<span class="tc-p${pt === me ? ' tc-self' : ''}">${d.avatarHtml(ent(pt).color, ent(pt).av, 44)}<b>${esc(ent(pt).name)}</b></span>`).join('')}</div>`
      : `<div class="tc-vs">${[me, ...others].map((pt, i) => `${i === 1 ? '<span class="tc-x">vs</span>' : ''}<span class="tc-p">${d.avatarHtml(ent(pt).color, ent(pt).av, 56)}<b>${esc(ent(pt).name)}</b></span>`).join('')}</div>`}
    <h2>${L('Your match is ready', 'Twój mecz czeka')}</h2>
    <div class="tc-left">${cd(Date.now() + m.left - (Date.now() - at), 'big')}</div>
    <p class="tc-note">${L('Come to your table before the time runs out, or it counts as a walkover.', 'Przyjdź do stołu, zanim skończy się czas, inaczej przegrywasz walkowerem.')}</p>
    <div class="row"><button type="button" class="btn big" data-tour="go" data-code="${m.code}">${L('Go to my table', 'Idź do mojego stołu')}</button>
    ${m.ext.includes(me) ? '' : `<button type="button" class="btn w" data-tour="more" data-id="${T.id}" data-mid="${m.id}">${L('Need 5 more min', 'Potrzebuję 5 minut')}</button>`}</div>`;
  if (box.dataset.h !== html) { morph(box, html); box.dataset.h = html; }
}
// every countdown on the page ticks down by itself
setInterval(() => { for (const el of document.querySelectorAll('time.tcd[data-end]')) el.textContent = left(+el.dataset.end - Date.now()); }, 1000);

// ---------- the tournament page ----------
export function openTour(id) {
  sheet?.close(); sheetId = id; one = null;
  if (!list.some(T => T.id === id)) d.send({ t: 'tour', op: 'one', id });
  sheet = d.modal(`<div class="tsheet"><p class="rknote">${L('Loading…', 'Wczytywanie…')}</p></div>`);
  sheet.el.querySelector('.sheet').classList.add('listsheet', 'tourpage');
  sheet.onClose = () => { sheet = null; sheetId = ''; };
  paintSheet();
}
const pill = (T, pt, extra = '') => { const e = T.ents.find(x => x.pt === pt); return `<button type="button" class="tm-p ${extra}" data-tour="prof" data-pt="${pt}">${e ? d.avatarHtml(e.color, e.av, 22) : ''}<span>${esc(nameOf(T, pt))}</span>`; };
function matchHtml(T, m, r) {
  const me = myPt(), admin = d.me()?.admin, live = T.st === 'live', mine = m.p.includes(me);
  if (m.bye && !m.p.filter(Boolean).length) return '';
  if (T.fmt === 'ko') {
    if (m.bye) { const pt = m.p.find(Boolean); return `<div class="tm bye"><div class="tm-row w">${pill(T, pt)}</button><span class="tm-by">${L('bye', 'wolny los')}</span></div></div>`; }
    const row = (pt, i) => {
      if (!pt) return `<div class="tm-row tbd">${m.bye ? L('bye', 'wolny los') : L('to be decided', 'jeszcze nie wiadomo')}</div>`;
      const won = m.st === 'done' && m.w === pt, lost = m.st === 'done' && m.w && m.w !== pt;
      return `<div class="tm-row${won ? ' w' : ''}${lost ? ' l' : ''}">${pill(T, pt)}</button><span class="tm-sc">${m.st === 'done' && m.wo && won ? 'W/O' : m.g > 1 || (T.bo === 3 && m.g) ? m.sc[i] : won ? '✓' : ''}</span></div>`;
    };
    const tag = m.bye && m.p.filter(Boolean).length < 2 ? '' : m.st === 'play' ? `<span class="tm-live">● ${L('playing', 'gra trwa')}</span>` : m.st === 'call' ? `<span class="tm-live call">${L('called', 'wezwani')} ${cd(Date.now() + m.left - (Date.now() - at))}</span>` : m.by ? `<span class="tm-by">${L('set by a host', 'wynik od gospodarza')}</span>` : '';
    const acts = [
      (m.st === 'play' || m.st === 'call') && m.code && !atTable(m.code) ? `<button type="button" class="btn sm${mine ? '' : ' w'}" data-tour="go" data-code="${m.code}">${mine ? L('Go to my table', 'Idź do stołu') : L('Watch', 'Oglądaj')}</button>` : '',
      admin && live && m.st !== 'done' && m.p.every(Boolean) ? m.p.map(pt => `<button type="button" class="btn sm w" data-tour="result" data-id="${T.id}" data-mid="${m.id}" data-pt="${pt}">${L('Win', 'Wygrywa')}: ${esc(nameOf(T, pt))}</button>`).join('') : '',
      admin && live && !m.bye && (m.st !== 'wait') ? `<button type="button" class="btn sm w" data-tour="redo" data-id="${T.id}" data-mid="${m.id}">${L('Replay', 'Powtórz')}</button>` : '',
    ].join('');
    return `<div class="tm${m.st === 'play' || m.st === 'call' ? ' live' : ''}${mine ? ' mine' : ''}${m.third ? ' third' : ''}">${m.p.map(row).join('')}${tag || acts ? `<div class="tm-foot">${tag}${acts}</div>` : ''}</div>`;
  }
  const order = m.st === 'done' ? m.res : m.p;
  return `<div class="tm heat${m.st === 'play' || m.st === 'call' ? ' live' : ''}${mine ? ' mine' : ''}"><div class="tm-h">${m.final ? L('Final table', 'Stół finałowy') : L(`Table ${m.id.slice(1)}`, `Stół ${m.id.slice(1)}`)}</div>
    ${order.map((pt, i) => `<div class="tm-row${m.st === 'done' && i < (m.final ? 3 : T.adv) ? ' w' : m.st === 'done' ? ' l' : ''}">${m.st === 'done' ? `<span class="tm-pl">${i + 1}.</span>` : ''}${pill(T, pt)}</button>${(m.cut || []).includes(pt) ? `<span class="tm-sc">${L('away', 'nieobecny')}</span>` : ''}</div>`).join('')}
    <div class="tm-foot">${m.st === 'play' ? `<span class="tm-live">● ${L('playing', 'gra trwa')}</span>` : m.st === 'call' ? `<span class="tm-live call">${L('called', 'wezwani')} ${cd(Date.now() + m.left - (Date.now() - at))}</span>` : ''}
    ${(m.st === 'play' || m.st === 'call') && m.code && !atTable(m.code) ? `<button type="button" class="btn sm${mine ? '' : ' w'}" data-tour="go" data-code="${m.code}">${mine ? L('Go to my table', 'Idź do stołu') : L('Watch', 'Oglądaj')}</button>` : ''}
    ${admin && live && m.st !== 'wait' ? `<button type="button" class="btn sm w" data-tour="redo" data-id="${T.id}" data-mid="${m.id}">${L('Replay', 'Powtórz')}</button>` : ''}</div></div>`;
}
const LOG = (x, T) => ({
  start: L(`${x.by} started it early.`, `${x.by}: wcześniejszy start.`), later: L(`${x.by} moved the start by ${x.min} min.`, `${x.by}: start przesunięty o ${x.min} min.`),
  kick: L(`${x.a} was taken out${x.by === 'ban' ? '' : ` by ${x.by}`}.`, `${x.a}: wypisany(-a) z turnieju${x.by === 'ban' ? '' : ` (${x.by})`}.`), cancel: L(`${x.by} cancelled it.`, `${x.by}: turniej odwołany.`),
  result: L(`${x.by} gave the win to ${x.a}.`, `${x.by}: wygrana dla gracza ${x.a}.`), redo: L(`${x.by} had a match played again.`, `${x.by}: mecz do powtórki.`),
  wo: L(`${x.a} went through: the other side did not come.`, `${x.a} przechodzi dalej: rywal nie przyszedł.`), none: L(`Nobody came to a match: ${x.a} went through as the higher seed.`, `Nikt nie przyszedł na mecz: dalej idzie ${x.a} jako wyżej rozstawiony.`),
  draws: L(`Three draws in a row: ${x.a} went through as the higher seed.`, `Trzy remisy z rzędu: dalej idzie ${x.a} jako wyżej rozstawiony.`), short: L(`A table started without ${x.n} who did not come.`, `Stół zaczął bez nieobecnych (${x.n}).`),
  restart: L('The site restarted: running matches were called again.', 'Strona się zrestartowała: trwające mecze zostały wezwane ponownie.'),
}[x.k] || '');
function paintSheet() {
  if (!sheet) return;
  const T = list.find(x => x.id === sheetId) || (one?.id === sheetId ? one : null), box = sheet.el.querySelector('.tsheet');
  if (!T) return;
  const me = mineIn(T), admin = d.me()?.admin, acct = !!d.me()?.user, call = myCall();
  const acts = [];
  if (T.st === 'signup' || T.st === 'checkin') {
    if (!me) acts.push(T.ents.length >= T.max ? `<span class="chip">${L('Full', 'Brak miejsc')}</span>` : `<button type="button" class="btn big" data-tour="join" data-id="${T.id}">${acct ? L('Sign up', 'Zapisz się') : L('Sign up (account)', 'Zapisz się (konto)')}</button>`);
    else {
      if (T.st === 'checkin' && !me.in) acts.push(`<button type="button" class="btn big" data-tour="in" data-id="${T.id}">${L('I’m here', 'Jestem')}</button>`);
      else acts.push(`<span class="chip good">✓ ${T.st === 'checkin' ? L('Checked in', 'Obecność potwierdzona') : L('Signed up', 'Zapis przyjęty')}</span>`);
      acts.push(`<button type="button" class="btn w" data-tour="leave" data-id="${T.id}">${L('Leave the tournament', 'Wypisz się')}</button>`);
      if ('Notification' in window && Notification.permission === 'default') acts.push(`<button type="button" class="btn w" data-tour="notif">🔔 ${L('Tell me when my match is ready', 'Powiadom mnie o moim meczu')}</button>`);
    }
  }
  if (call?.T === T) acts.unshift(`<button type="button" class="btn big" data-tour="go" data-code="${call.m.code}">${L('Go to my table', 'Idź do mojego stołu')}</button>`);
  const top = T.st === 'done' ? `<div class="tp-podium">${T.top.map((pt, i) => `<div class="tp-pl p${i + 1}">${pill(T, pt)}</button><b>${i + 1}</b>${T.paid?.[pt] ? `<small>+${cnt(T.paid[pt], 'coin', 'coins', 'moneta', 'monety', 'monet')}</small>` : ''}</div>`).join('')}</div>` : '';
  const ents = T.st === 'signup' || T.st === 'checkin' ? T.ents : T.seed.map(pt => T.ents.find(e => e.pt === pt) || { pt, name: nameOf(T, pt) });
  const bracket = T.rounds.length ? `<h3>${T.fmt === 'ko' ? L('Bracket', 'Drabinka') : L('Tables', 'Stoły')}</h3><div class="tbracket ${T.fmt}">${T.rounds.map((row, r) => `<div class="tround"><h4>${esc(roundName(T, r, row[0]))}</h4><div class="tr-ms">${row.filter(m => !m.third).map(m => matchHtml(T, m, r)).join('')}${row.filter(m => m.third && !m.bye).map(m => `<h4>${L('3rd place', 'Mecz o 3. miejsce')}</h4>${matchHtml(T, m, r)}`).join('')}</div></div>`).join('')}</div>` : '';
  const log = T.log.filter(x => LOG(x, T)).slice(-8).reverse();
  const here = T.ents.filter(e => e.in).length, R = curRound(T);
  const status = T.st === 'signup' ? `<small>${L('Sign-ups close in', 'Zapisy kończą się za')}</small>${cd(T.start - T.checkin)}<small>${L(`${T.ents.length} of ${T.max} places taken`, `Zajęte miejsca: ${T.ents.length} z ${T.max}`)}</small><span class="tb-bar"><i style="width:${Math.round(100 * T.ents.length / T.max)}%"></i></span>`
    : T.st === 'checkin' ? `<small>${L('Starts in', 'Start za')}</small>${cd(T.start)}<small>${L(`${here} of ${T.ents.length} here`, `Obecni: ${here} z ${T.ents.length}`)}</small><span class="tb-bar"><i style="width:${Math.round(100 * here / Math.max(1, T.ents.length))}%"></i></span>`
    : T.st === 'live' ? `<small>${L('Now playing', 'Teraz gramy')}</small><b class="tb-champ">${esc(roundName(T, R, T.rounds[R]?.[0]))}</b><small>${L(`${T.seed.length} players`, `Graczy: ${T.seed.length}`)}</small>` : '';
  const side = status || acts.length ? `<div class="tp-side">${status ? `<div class="pb-open tb-left">${status}</div>` : ''}${acts.join('')}</div>` : '';
  const html = `<header class="tp-head"><img src="/gamepics/${esc(T.game)}-s.jpg" alt=""><div><p class="tp-kick">🏆 ${esc(d.gameName(T.game))} · ${STATE()[T.st]}</p><h2>${esc(pick(T.name))}</h2>
    <div class="tb-chips"><span>${fmtText(T)}</span><span>📅 ${esc(when(T.start))}</span><span class="prize">${prizeText(T)}</span>${T.minLv ? `<span>${L(`Level ${T.minLv}+`, `Poziom ${T.minLv}+`)}</span>` : ''}</div></div></header>
    ${top}
    <div class="tp-grid${side ? '' : ' solo'}">${side}<div class="tp-info"><p class="tp-rules">${esc(rulesText(T))}</p>
      <div class="tp-prizes" aria-label="${L('Prizes', 'Nagrody')}">${['🥇', '🥈', '🥉'].map((md, i) => T.prize.c[i] ? `<span><i aria-hidden="true">${md}</i><b>${T.prize.c[i]}</b></span>` : '').join('')}${T.prize.all ? `<span><i aria-hidden="true">🎟️</i><b>${T.prize.all}</b><small>${L('everyone who plays', 'każdy, kto zagra')}</small></span>` : ''}</div>
      <p class="tp-prize">${L('Coins from the house: nobody pays to play.', 'Monety funduje strona: nikt nie płaci za udział.')}</p>
      <h4>${L('What stays after the cup', 'Co zostaje po turnieju')}</h4>
      <ul class="tp-rew">
        <li><i aria-hidden="true">👑</i><span>${L('The winner wears a crown by their name until the next cup.', 'Zwycięzca nosi koronę przy imieniu aż do następnego turnieju.')}</span></li>
        <li><i aria-hidden="true">🏆</i><span>${L('Cups, 2nd and 3rd places go on the trophy shelf of the profile card.', 'Puchary oraz 2. i 3. miejsca trafiają na półkę z trofeami na wizytówce.')}</span></li>
        <li><i aria-hidden="true">📈</i><span>${L('Tournament ranking points: 10 for 1st, 6 for 2nd, 4 for 3rd, +1 for everyone who plays (Rankings › Tournaments).', 'Punkty do rankingu turniejów: 10 za 1. miejsce, 6 za 2., 4 za 3., +1 dla każdego, kto zagra (Rankingi › Turnieje).')}</span></li>
        <li><i aria-hidden="true">🎖️</i><span>${L('Titles: Finalist (reach a final), Cup Winner (1 win), Tournament Legend (5 wins).', 'Tytuły: Finalista (finał), Zdobywca pucharu (1 wygrana), Legenda turniejów (5 wygranych).')}</span></li>
        <li><i aria-hidden="true">✨</i><span>${L('Champion’s laurel frame for 3 wins, Trophy hall card background for 10.', 'Ramka Laur mistrza za 3 wygrane, tło wizytówki Sala trofeów za 10.')}</span></li>
        <li><i aria-hidden="true">⭐</i><span>${L('Every match is a real game: XP, wins and the game’s own ranking count as usual.', 'Każdy mecz to prawdziwa gra: XP, wygrane i ranking tej gry liczą się jak zwykle.')}</span></li>
      </ul></div></div>
    ${bracket}
    <h3>${T.st === 'signup' || T.st === 'checkin' ? L(`Signed up · ${T.ents.length}/${T.max}`, `Zapisani · ${T.ents.length}/${T.max}`) : L(`Players · ${ents.length}`, `Gracze · ${ents.length}`)}</h3>
    <div class="tp-ents">${ents.map((e, i) => `<span class="tp-ent${e.pt === myPt() ? ' me' : ''}">${T.seed.length ? `<i>${i + 1}</i>` : ''}${pill(T, e.pt)}</button>${T.st === 'checkin' ? (e.in ? '<small class="good">✓</small>' : '<small>…</small>') : ''}${admin && (T.st === 'signup' || T.st === 'checkin' || T.st === 'live') ? `<button type="button" class="tp-x" data-tour="kick" data-id="${T.id}" data-pt="${e.pt}" title="${L('Take out of the tournament', 'Wypisz z turnieju')}">×</button>` : ''}</span>`).join('') || `<p class="tp-empty">${L('Nobody yet. Be the first!', 'Jeszcze nikt się nie zapisał. Twoje miejsce czeka!')}</p>`}</div>
    ${log.length ? `<h3>${L('Changes', 'Zmiany')}</h3><ul class="tp-log">${log.map(x => `<li><time>${hm(x.at)}</time> ${esc(LOG(x, T))}</li>`).join('')}</ul>` : ''}
    <div class="row tp-foot"><button type="button" class="btn w" data-tour="alerts">🔔 ${L('Discord alerts', 'Powiadomienia na Discordzie')}</button><button type="button" class="btn w" data-tour="hist">${L('Past tournaments', 'Poprzednie turnieje')}</button><button type="button" class="btn" data-tour="close">${L('Done', 'Gotowe')}</button></div>`;
  if (box.dataset.h !== html) { morph(box, html); box.dataset.h = html; }
}
// ---------- past tournaments ----------
export function openHist() {
  histSheet?.close(); hist = null;
  d.send({ t: 'tour', op: 'hist' });
  histSheet = d.modal(`<h2>🏆 ${L('Tournaments', 'Turnieje')}</h2><div class="row th-top"><button type="button" class="btn sm w" data-tour="alerts">🔔 ${L('Discord alerts for your community', 'Powiadomienia na Discordzie dla twojej społeczności')}</button></div><div class="thist"><p class="rknote">${L('Loading…', 'Wczytywanie…')}</p></div>`);
  histSheet.el.querySelector('.sheet').classList.add('listsheet');
  histSheet.onClose = () => { histSheet = null; };
  paintHist();
}
function paintHist() {
  const box = histSheet?.el.querySelector('.thist'); if (!box) return;
  const now = list.filter(T => T.st === 'signup' || T.st === 'checkin' || T.st === 'live');
  box.innerHTML = `${now.length ? `<h3>${L('Now', 'Teraz')}</h3>${now.map(T => `<button type="button" class="th-row" data-tour="open" data-id="${T.id}"><img src="/gamepics/${esc(T.game)}-s.jpg" alt=""><span><b>${esc(pick(T.name))}</b><small>${esc(d.gameName(T.game))} · ${STATE()[T.st]} · ${esc(when(T.start))}</small></span></button>`).join('')}` : ''}
    <h3>${L('Past', 'Poprzednie')}</h3>${!hist ? `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>` : hist.length ? hist.map(T => `<button type="button" class="th-row" data-tour="open" data-id="${T.id}"><img src="/gamepics/${esc(T.game)}-s.jpg" alt=""><span><b>${esc(pick(T.name))}</b><small>${esc(d.gameName(T.game))} · ${esc(when(T.start))} · ${T.st === 'off' ? L('cancelled', 'odwołany') : `🏆 ${esc(T.top[0]?.name || '?')}`}</small></span></button>`).join('') : `<p class="rknote">${L('No tournaments yet.', 'Jeszcze nie było turniejów.')}</p>`}`;
}

// ---------- Discord alerts: any community adds its own channel ----------
/** The window where anyone with an account connects a Discord channel (a webhook) to the tournament news. */
export function openAlerts() {
  al?.win.close();
  al = { win: null, subs: null, lang: PL ? 'pl' : 'en', ping: true, all: true, sel: new Set(), busy: false, hook: '', label: '' };
  al.win = d.modal(`<div class="talerts"><p class="rknote">${L('Loading…', 'Wczytywanie…')}</p></div>`);
  al.win.el.querySelector('.sheet').classList.add('listsheet', 'alsheet');
  al.win.onClose = () => { al = null; };
  al.win.el.addEventListener('click', onAlClick);
  al.win.el.addEventListener('input', e => { if (!al) return; if (e.target.id === 'al-hook') al.hook = e.target.value; if (e.target.id === 'al-label') al.label = e.target.value; });
  al.win.el.addEventListener('submit', e => { e.preventDefault(); addAlert(); });
  d.send({ t: 'tour', op: 'sub_list' });
  paintAlerts();
}
const gamesLine = g => (g?.length ? g.map(id => d.gameName(id)).join(', ') : L('every game', 'wszystkie gry'));
function paintAlerts() {
  const box = al?.win.el.querySelector('.talerts'); if (!box) return;
  const acct = !!d.me()?.user, S = al.subs, mine = S?.mine || [], full = S && mine.length >= S.max;
  const seg = (k, v, t) => `<button type="button" data-al="${k}" data-v="${v}" aria-pressed="${String(al[k]) === String(v)}">${t}</button>`;
  const games = (S?.games || []).slice().sort((a, b) => d.gameName(a).localeCompare(d.gameName(b), LOCALE));
  const form = !acct ? `<div class="al-acct"><p>${L('Make a free account to connect a channel: it keeps your channels yours, so only you (and the hosts) can remove them.', 'Załóż darmowe konto, żeby połączyć kanał: dzięki temu kanał jest twój i tylko ty (oraz gospodarze) możesz go usunąć.')}</p><button type="button" class="btn" data-al="acct">${L('Make an account', 'Załóż konto')}</button></div>`
    : full ? `<p class="nthint">${L(`You have ${S.max} channels, the most one account can add. Remove one to add another.`, `Masz ${S.max} kanały, czyli najwięcej na jedno konto. Usuń któryś, żeby dodać nowy.`)}</p>`
    : `<form class="al-form" autocomplete="off">
      <ol class="al-steps">
        <li>${L('In Discord, open the channel’s settings (⚙️ next to its name) › <b>Integrations</b> › <b>Webhooks</b>.', 'Na Discordzie otwórz ustawienia kanału (⚙️ obok nazwy) › <b>Integracje</b> › <b>Webhooki</b>.')}</li>
        <li>${L('<b>New Webhook</b> › <b>Copy Webhook URL</b>. You need the Manage Webhooks permission on that server.', '<b>Nowy webhook</b> › <b>Kopiuj URL webhooka</b>. Potrzebne jest uprawnienie Zarządzanie webhookami na tym serwerze.')}</li>
        <li>${L('Paste the link here and pick what the channel should get.', 'Wklej link tutaj i wybierz, co ma trafiać na kanał.')}</li>
      </ol>
      <label class="al-lab">${L('Webhook link', 'Link webhooka')}<input class="field" id="al-hook" value="${esc(al.hook)}" placeholder="https://discord.com/api/webhooks/…" spellcheck="false" inputmode="url"></label>
      <label class="al-lab">${L('Name for your list (optional)', 'Nazwa na twojej liście (opcjonalnie)')}<input class="field" id="al-label" maxlength="40" value="${esc(al.label)}" placeholder="${L('e.g. Friday chess club', 'np. Piątkowy klub szachowy')}"></label>
      <div class="ta-opt"><b>${L('Which tournaments', 'Które turnieje')}</b><div class="pills">${seg('all', true, L('Every game', 'Wszystkie gry'))}${seg('all', false, L('Chosen games', 'Wybrane gry'))}</div></div>
      ${al.all ? '' : `<div class="al-games">${games.map(id => `<button type="button" class="al-g" data-al="g" data-v="${id}" aria-pressed="${al.sel.has(id)}"><img src="/gamepics/${esc(id)}-s.jpg" alt="" loading="lazy"><span>${esc(d.gameName(id))}</span></button>`).join('')}</div>`}
      <div class="al-two"><div class="ta-opt"><b>${L('Language of the posts', 'Język postów')}</b><div class="pills">${seg('lang', 'pl', 'Polski')}${seg('lang', 'en', 'English')}</div></div>
      <div class="ta-opt"><b>${L('Ping @here', 'Oznaczaj @here')}</b><div class="pills">${seg('ping', true, L('On', 'Wł.'))}${seg('ping', false, L('Off', 'Wył.'))}</div></div></div>
      <p class="nthint">${L('@here goes out only when sign-ups open, check-in starts and a cup starts. We send a test message first: the channel is added only if Discord takes it.', '@here idzie tylko przy otwarciu zapisów, potwierdzaniu obecności i starcie turnieju. Najpierw wysyłamy wiadomość próbną: kanał zostanie dodany tylko wtedy, gdy Discord ją przyjmie.')}</p>
      <div class="row"><button type="submit" class="btn p"${al.busy ? ' disabled' : ''}>${al.busy ? L('Checking with Discord…', 'Sprawdzam z Discordem…') : L('Connect the channel', 'Połącz kanał')}</button></div></form>`;
  const row = x => `<div class="al-row"><span class="al-ico" aria-hidden="true">#</span><div><b>${esc(x.label || L('Discord channel', 'Kanał na Discordzie'))}</b><small>${esc(gamesLine(x.games))} · ${x.lang === 'pl' ? 'PL' : 'EN'}${x.ping ? ' · @here' : ''} · ${L(`${x.sent} posts`, `postów: ${x.sent}`)}${x.byName ? ` · 👤 ${esc(x.byName)}` : ''}</small><code>${esc(x.hook)}</code></div><button type="button" class="btn sm w" data-al="del" data-v="${x.sid}">${L('Remove', 'Usuń')}</button></div>`;
  const html = `<h2>🔔 ${L('Discord alerts', 'Powiadomienia na Discordzie')}</h2>
    <p class="al-lead">${L('Run a Discord community? Get Zatoka Gier tournaments posted on your own channel: when sign-ups open, check-in starts, a cup starts and someone wins, with a link straight to it.', 'Masz społeczność na Discordzie? Turnieje Zatoki Gier mogą trafiać na twój kanał: gdy ruszą zapisy, zacznie się potwierdzanie obecności, wystartuje turniej i ktoś wygra, z linkiem prosto do niego.')}</p>
    <div class="al-demo" aria-hidden="true"><img src="/icon-192.png" alt=""><div><b>Zatoka Gier <i>APP</i></b><p>@here 🏆 ${L('Sign-ups are open: Evening Chess Cup', 'Zapisy otwarte: Wieczorny Puchar Szachowy')}</p><span>${L('Chess · knockout · Starts Friday 20:00', 'Szachy · pucharowy · Start: piątek 20:00')}</span></div></div>
    ${form}
    ${acct ? `<h3>${L('Your channels', 'Twoje kanały')}${S ? ` · ${mine.length}/${S.max}` : ''}</h3>${!S ? `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>` : mine.length ? mine.map(row).join('') : `<p class="rknote">${L('No channels yet.', 'Brak kanałów.')}</p>`}` : ''}
    <p class="nthint">${L('The site keeps the webhook link, your settings and which account added it until the channel is removed. Deleting the webhook in Discord removes it here by itself.', 'Strona przechowuje link webhooka, ustawienia i konto, które go dodało, dopóki kanał nie zostanie usunięty. Usunięcie webhooka na Discordzie usuwa go też tutaj.')}</p>
    <div class="row"><button type="button" class="btn" data-al="close">${L('Done', 'Gotowe')}</button></div>`;
  if (box.dataset.h !== html) { const keep = document.activeElement?.id; morph(box, html); box.dataset.h = html; if (keep) document.getElementById(keep)?.focus?.(); }
}
function addAlert() {
  if (!al || al.busy) return;
  const hook = (al.win.el.querySelector('#al-hook')?.value || '').trim();
  if (!hook) { d.toast(L('Paste the webhook link first.', 'Najpierw wklej link webhooka.'), true); return al.win.el.querySelector('#al-hook')?.focus(); }
  if (!al.all && !al.sel.size) return d.toast(L('Pick at least one game, or choose Every game.', 'Wybierz choć jedną grę albo Wszystkie gry.'), true);
  al.busy = true; paintAlerts();
  d.send({ t: 'tour', op: 'sub_add', hook, label: al.label, lang: al.lang, ping: al.ping, games: al.all ? [] : [...al.sel] });
}
function onAlClick(e) {
  const b = e.target.closest('[data-al]'); if (!b || !al || b.disabled) return;
  e.preventDefault(); d.sfx.click();
  const a = b.dataset.al, v = b.dataset.v;
  if (a === 'close') return al.win.close();
  if (a === 'acct') { al.win.close(); return d.needAccount?.(); }
  if (a === 'all' || a === 'ping') { al[a] = v === 'true'; return paintAlerts(); }
  if (a === 'lang') { al.lang = v; return paintAlerts(); }
  if (a === 'g') { al.sel.has(v) ? al.sel.delete(v) : al.sel.add(v); return paintAlerts(); }
  if (a === 'del') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.classList.add('sure'); b.textContent = L('Sure? Tap again', 'Na pewno? Dotknij jeszcze raz'); setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.classList.remove('sure'); b.textContent = L('Remove', 'Usuń'); } }, 3500); return; }
    return d.send({ t: 'tour', op: 'sub_del', sid: v });
  }
}

// ---------- a match table: the waiting room and results lines ----------
/** The waiting room of a match table: who it waits for, and the clock. */
export function tourLobbyHtml(room) {
  const x = room.tour; if (!x) return '';
  const here = new Set(room.players.filter(p => !p.watch && p.online).map(p => p.name)), meIn = x.p.some(p => p.pt === myPt());
  return `<div class="tlobby"><p class="tl-kick">🏆 ${esc(pick(x.name))} · ${esc(x.fmt === 'heat' ? (x.final ? L('Final table', 'Stół finałowy') : L(`Round ${x.r + 1}`, `Runda ${x.r + 1}`)) : x.third ? L('3rd place', 'Mecz o 3. miejsce') : x.r === x.rounds - 1 ? L('Final', 'Finał') : x.r === x.rounds - 2 ? L('Semi-final', 'Półfinał') : L(`Round ${x.r + 1}`, `Runda ${x.r + 1}`))}${x.bo === 3 ? ` · ${L('best of 3', 'do 2 wygranych')} · ${x.sc.join(' : ')}` : ''}</p>
    <p class="tl-who">${x.p.map(p => `<span class="${here.has(p.name) ? 'in' : ''}">${here.has(p.name) ? '✓' : '…'} ${esc(p.name)}</span>`).join('')}</p>
    <p class="tl-note">${x.done ? L('This match is over.', 'Ten mecz się skończył.') : x.next ? L('The next game starts in a moment.', 'Następna gra zaraz się zacznie.') : x.st === 'call' ? `${meIn ? L('The match starts by itself as soon as everyone is here.', 'Mecz zacznie się sam, gdy wszyscy będą przy stole.') : L('You are watching this match.', 'Oglądasz ten mecz.')} ${L('Time left to come', 'Czas na przyjście')}: ${cd(Date.now() + x.left)}` : ''}</p></div>`;
}
/** The results screen of a match table: what happens next (instead of "Play again"). */
export function tourAgainHtml(room) {
  const x = room?.tour; if (!x) return '';
  const msg = !x.done && x.st !== 'done' ? L('Next game of this match in a moment. Stay at the table.', 'Za chwilę następna gra tego meczu. Zostań przy stole.')
    : x.w === myPt() ? L('You go through! The site calls you for your next match.', 'Przechodzisz dalej! Strona zawoła cię na następny mecz.')
    : L('Match over. See how the tournament goes on the hub.', 'Mecz skończony. Na stronie głównej zobaczysz, jak idzie turniej.');
  return `<div class="again"><p class="wait">🏆 ${esc(msg)}</p><div class="row"><button type="button" class="btn big ghost" data-a="leave">${x.done ? L('Back to the hub', 'Wróć na stronę główną') : L('Leave', 'Wyjdź')}</button></div></div>`;
}

// ---------- clicks anywhere ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tour]'); if (!b || b.disabled || !d) return;
  const a = b.dataset.tour, id = b.dataset.id;
  if (a !== 'stripx') d.sfx.click();
  if (a === 'open') { histSheet?.close(); return openTour(id); }
  if (a === 'hist') { sheet?.close(); return openHist(); }
  if (a === 'close') return sheet?.close();
  if (a === 'alerts') return openAlerts();
  if (a === 'join') { if (!d.me()?.user) { d.toast(L('Make a free account to play in tournaments (Account menu › Make an account).', 'Załóż darmowe konto, żeby grać w turniejach (menu konta › Załóż konto).'), true); return d.needAccount?.(); } return d.send({ t: 'tour', op: 'join', id }); }
  if (a === 'leave' || a === 'in') return d.send({ t: 'tour', op: a, id });
  if (a === 'more') return d.send({ t: 'tour', op: 'more', id, mid: b.dataset.mid });
  if (a === 'go') { callWin?.close(); sheet?.close(); return d.join(b.dataset.code); }
  if (a === 'prof') return d.openPlayer(b.dataset.pt);
  if (a === 'notif') { Notification.requestPermission?.().then(() => paintSheet()); return; }
  if (a === 'stripx') { LSset('ct_tour_x', id); return paintStrip(); }
  if (a === 'result' || a === 'redo' || a === 'kick') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.classList.add('sure'); b.dataset.was = b.innerHTML; b.textContent = L('Sure? Tap again', 'Na pewno? Dotknij jeszcze raz'); setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.classList.remove('sure'); b.innerHTML = b.dataset.was; } }, 3500); return; }
    return d.send({ t: 'tour', op: a, id, mid: b.dataset.mid, pt: b.dataset.pt });
  }
});

// ---------- the hosts' Tournaments tab (Admin panel) ----------
const localInput = t => { const x = new Date(t - new Date(t).getTimezoneOffset() * 60_000); return x.toISOString().slice(0, 16); };
const nextHour = () => { const x = new Date(Date.now() + 90 * 60_000); x.setMinutes(0, 0, 0); return x.getTime(); };
const newForm = () => ({ game: 'chess', fmt: 'ko', bo: 1, per: 4, adv: 2, max: 16, minLv: 0, start: nextHour(), en: '', pl: '', ren: '', rpl: '', c: [150, 80, 40], all: 10, opts: null });
/** Mounts the tab into box; returns a function that stops it. */
export function mountTourAdmin(box) {
  adm = { box, cfg: null, games: null, defs: {}, form: null, hookEdit: false, subs: null };
  d.send({ t: 'tour', op: 'getcfg' }); d.send({ t: 'tour', op: 'sub_list' });
  box.addEventListener('click', onAdmClick); box.addEventListener('input', onAdmInput); box.addEventListener('change', onAdmInput);
  paintAdmin();
  return () => { box.removeEventListener('click', onAdmClick); box.removeEventListener('input', onAdmInput); box.removeEventListener('change', onAdmInput); adm = null; };
}
function formOpts(f) { return f.opts || { ...(adm.defs[f.game] || {}) }; }
function paintAdmin() {
  if (!adm) return;
  const { box, cfg, games, form: f } = adm;
  const active = list.filter(T => T.st !== 'done' && T.st !== 'off'), ended = list.filter(T => T.st === 'done' || T.st === 'off');
  const row = T => `<div class="ta-row"><img src="/gamepics/${esc(T.game)}-s.jpg" alt=""><div><b>${esc(pick(T.name))}</b><small>${esc(d.gameName(T.game))} · ${STATE()[T.st]} · ${esc(when(T.start))} · ${L(`${T.ents.length} signed up`, `zapisani: ${T.ents.length}`)}</small></div>
    <div class="ta-acts"><button type="button" class="btn sm w" data-tour="open" data-id="${T.id}">${L('Open', 'Otwórz')}</button>
    ${T.st === 'signup' || T.st === 'checkin' ? `<button type="button" class="btn sm w" data-ta="later" data-id="${T.id}">+15 min</button><button type="button" class="btn sm" data-ta="start" data-id="${T.id}">${L('Start now', 'Zacznij teraz')}</button>` : ''}
    ${T.st !== 'done' && T.st !== 'off' ? `<button type="button" class="btn sm w" data-ta="cancel" data-id="${T.id}">${L('Cancel', 'Odwołaj')}</button>` : `<button type="button" class="btn sm w" data-ta="del" data-id="${T.id}">${L('Remove', 'Usuń')}</button>`}</div></div>`;
  let formHtml = '';
  if (f && games) {
    const fm = games[f.game] || [], opts = formOpts(f);
    const seg = (k, v, t, dis = false) => `<button type="button" data-tf="${k}" data-v="${v}" aria-pressed="${String(f[k]) === String(v)}"${dis ? ' disabled' : ''}>${t}</button>`;
    const settings = d.settingsHtml(f.game, opts);
    formHtml = `<form class="ta-form" autocomplete="off">
      <div class="ta-two"><label>${L('Name (Polish)', 'Nazwa (po polsku)')}<input class="field" id="ta-pl" maxlength="60" value="${esc(f.pl)}" placeholder="Puchar Szachowy"></label>
      <label>${L('Name (English)', 'Nazwa (po angielsku)')}<input class="field" id="ta-en" maxlength="60" value="${esc(f.en)}" placeholder="Chess Cup"></label></div>
      <div class="ta-two"><label>${L('Game', 'Gra')}<select class="field" id="ta-game">${Object.keys(games).sort((a, b) => d.gameName(a).localeCompare(d.gameName(b), LOCALE)).map(id => `<option value="${id}"${id === f.game ? ' selected' : ''}>${esc(d.gameName(id))}</option>`).join('')}</select></label>
      <label>${L('Start', 'Start')}<input class="field" type="datetime-local" id="ta-start" value="${localInput(f.start)}"></label></div>
      <div class="ta-opt"><b>${L('Format', 'Format')}</b><div class="pills">${seg('fmt', 'ko', L('Knockout (1 v 1)', 'Pucharowy (1 na 1)'), !fm.includes('ko'))}${seg('fmt', 'heat', L('Heats (tables of 3+)', 'Grupy (stoły po 3+)'), !fm.includes('heat'))}</div></div>
      ${f.fmt === 'ko' ? `<div class="ta-opt"><b>${L('Each match', 'Każdy mecz')}</b><div class="pills">${seg('bo', 1, L('One game', 'Jedna gra'))}${seg('bo', 3, L('Best of 3', 'Do 2 wygranych'))}</div></div>`
        : `<div class="ta-opt"><b>${L('Players per table', 'Graczy przy stole')}</b><div class="pills">${[3, 4, 5, 6, 8].filter(n => n <= (adm.defs[f.game]?.__max || 8)).map(n => seg('per', n, n)).join('')}</div></div>
           <div class="ta-opt"><b>${L('Go on from each table', 'Dalej z każdego stołu')}</b><div class="pills">${[1, 2, 3].filter(n => n < f.per).map(n => seg('adv', n, n)).join('')}</div></div>`}
      <div class="ta-opt"><b>${L('Most players', 'Najwięcej graczy')}</b><div class="pills">${[4, 8, 16, 32, 64].map(n => seg('max', n, n)).join('')}</div></div>
      <div class="ta-three"><label>${L('1st place coins', 'Monety za 1. miejsce')}<input class="field" type="number" min="0" max="1000" id="ta-c0" value="${f.c[0]}"></label><label>${L('2nd', '2. miejsce')}<input class="field" type="number" min="0" max="1000" id="ta-c1" value="${f.c[1]}"></label><label>${L('3rd', '3. miejsce')}<input class="field" type="number" min="0" max="1000" id="ta-c2" value="${f.c[2]}"></label><label>${L('Everyone who plays', 'Każdy, kto zagra')}<input class="field" type="number" min="0" max="100" id="ta-all" value="${f.all}"></label></div>
      <div class="ta-two"><label>${L('Lowest level to sign up (stops brand-new accounts)', 'Najniższy poziom do zapisu (blokuje świeże konta)')}<input class="field" type="number" min="0" max="100" id="ta-lv" value="${f.minLv}"></label></div>
      ${settings ? `<div class="ta-set"><b>${L('Table settings (the same at every match)', 'Ustawienia stołu (takie same w każdym meczu)')}</b>${settings}</div>` : ''}
      <div class="ta-two"><label>${L('Extra rules, Polish (optional)', 'Dodatkowe zasady po polsku (opcjonalnie)')}<input class="field" id="ta-rpl" maxlength="300" value="${esc(f.rpl)}"></label><label>${L('Extra rules, English (optional)', 'Dodatkowe zasady po angielsku (opcjonalnie)')}<input class="field" id="ta-ren" maxlength="300" value="${esc(f.ren)}"></label></div>
      <p class="nthint">${L('Check-in opens 15 minutes before the start; sign-ups close then. Players who don’t check in are left out.', 'Potwierdzanie obecności zaczyna się 15 minut przed startem i wtedy kończą się zapisy. Kto nie potwierdzi obecności, nie gra.')}</p>
      <div class="row"><button type="button" class="btn w" data-ta="cancelform">${L('Back', 'Wróć')}</button><button type="submit" class="btn p" data-ta="create">${L('Open sign-ups', 'Otwórz zapisy')}</button></div></form>`;
  }
  const hook = cfg ? `<section class="ta-hook"><h3>${L('Hosts’ Discord channel (optional)', 'Kanał gospodarzy na Discordzie (opcjonalnie)')}</h3>
    <p class="nthint">${L('Paste a channel webhook (Discord: channel settings › Integrations › Webhooks › New webhook › Copy webhook URL). The site posts there when sign-ups open, check-in starts, the tournament starts and someone wins.', 'Wklej webhook kanału (Discord: ustawienia kanału › Integracje › Webhooki › Nowy webhook › Kopiuj URL webhooka). Strona napisze tam, gdy ruszą zapisy, zacznie się potwierdzanie obecności, wystartuje turniej i ktoś wygra.')}</p>
    ${cfg.on && !adm.hookEdit ? `<div class="ta-on"><p><b>✓ ${L('Connected', 'Połączono')}</b> <code>${esc(cfg.hook)}</code></p><div class="ta-acts"><button type="button" class="btn sm w" data-ta="hookedit">${L('Change', 'Zmień')}</button><button type="button" class="btn sm w" data-ta="hooktest">${L('Send a test', 'Wyślij próbę')}</button><button type="button" class="btn sm w" data-ta="hookoff">${L('Disconnect', 'Odłącz')}</button></div></div>`
      : `<div class="ta-hookin"><input class="field" id="ta-hook" placeholder="https://discord.com/api/webhooks/…" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" data-ta="hooksave">${L('Save', 'Zapisz')}</button></div>`}
    <div class="ta-opt"><b>${L('Language of the posts', 'Język postów')}</b><div class="pills ta-hl"><button type="button" data-ta="hlang" data-v="pl" aria-pressed="${cfg.lang === 'pl'}">Polski</button><button type="button" data-ta="hlang" data-v="en" aria-pressed="${cfg.lang === 'en'}">English</button></div></div>
    <div class="ta-opt"><b>${L('Ping the channel (@here) when sign-ups open, check-in starts and the cup starts', 'Oznaczaj kanał (@here), gdy ruszają zapisy, obecność i turniej')}</b><div class="pills ta-hl"><button type="button" data-ta="hping" aria-pressed="${cfg.ping}">${cfg.ping ? L('On', 'Wł.') : L('Off', 'Wył.')}</button></div></div></section>` : '';
  const subsHtml = adm.subs ? `<section class="ta-hook"><h3>${L(`Community channels · ${adm.subs.length}`, `Kanały społeczności · ${adm.subs.length}`)}</h3>
    <p class="nthint">${L('Channels players added under Discord alerts on a tournament page. They get the same news, filtered by their games. Remove any that look wrong.', 'Kanały dodane przez graczy w oknie Powiadomienia na Discordzie. Dostają te same wiadomości, tylko dla wybranych gier. Usuń te, które wyglądają podejrzanie.')}</p>
    ${adm.subs.length ? adm.subs.map(x => `<div class="al-row"><span class="al-ico" aria-hidden="true">#</span><div><b>${esc(x.label || L('Discord channel', 'Kanał na Discordzie'))}</b><small>${esc(gamesLine(x.games))} · ${x.lang === 'pl' ? 'PL' : 'EN'}${x.ping ? ' · @here' : ''} · ${L(`${x.sent} posts`, `postów: ${x.sent}`)} · 👤 <button type="button" class="linkish" data-tour="prof" data-pt="${esc(x.byPt)}">${esc(x.byName)}</button></small><code>${esc(x.hook)}</code></div><button type="button" class="btn sm w" data-ta="subdel" data-id="${x.sid}">${L('Remove', 'Usuń')}</button></div>`).join('') : `<p class="rknote">${L('None yet.', 'Jeszcze żadnego.')}</p>`}</section>` : '';
  const html = f ? formHtml || `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>`
    : `<p class="rknote">${L('Pick a game, open sign-ups, and the site runs the rest: check-in, the bracket, calling each match to its own table, walkovers and house prizes.', 'Wybierz grę i otwórz zapisy, a resztą zajmie się strona: obecnością, drabinką, wzywaniem każdego meczu do osobnego stołu, walkowerami i nagrodami.')}</p>
      <div class="row"><button type="button" class="btn p" data-ta="new">🏆 ${L('New tournament', 'Nowy turniej')}</button></div>
      ${active.length ? `<h3>${L('Now', 'Teraz')}</h3>${active.map(row).join('')}` : ''}
      ${ended.length ? `<h3>${L('Ended lately', 'Ostatnio zakończone')}</h3>${ended.map(row).join('')}` : ''}
      ${hook}${subsHtml}`;
  if (box.dataset.h !== html) { const keep = document.activeElement?.id; morph(box, html); box.dataset.h = html; if (keep) document.getElementById(keep)?.focus?.(); }
}
function readForm() {
  const f = adm?.form, v = id => adm.box.querySelector('#' + id)?.value; if (!f) return;
  f.pl = v('ta-pl') ?? f.pl; f.en = v('ta-en') ?? f.en; f.rpl = v('ta-rpl') ?? f.rpl; f.ren = v('ta-ren') ?? f.ren;
  const s = v('ta-start'); if (s) { const t = new Date(s).getTime(); if (Number.isFinite(t)) f.start = t; }
  f.c = [0, 1, 2].map(i => +(v('ta-c' + i) ?? f.c[i]) || 0); f.all = +(v('ta-all') ?? f.all) || 0; f.minLv = +(v('ta-lv') ?? f.minLv) || 0;
}
function onAdmInput(e) {
  if (!adm?.form) return;
  if (e.target.id === 'ta-game') {
    readForm(); const f = adm.form; f.game = e.target.value; f.opts = null;
    const fm = adm.games[f.game] || []; if (!fm.includes(f.fmt)) f.fmt = fm[0];
    if (/^(chess|warcaby)$/.test(f.game)) f.bo = 3;
    paintAdmin();
  } else if (e.type === 'change') readForm();
}
function onAdmClick(e) {
  const b = e.target.closest('[data-ta], [data-tf], [data-topt]'); if (!b || !adm) return;
  e.preventDefault(); d.sfx.click();
  if (b.dataset.tf) { readForm(); adm.form[b.dataset.tf] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; if (adm.form.adv >= adm.form.per) adm.form.adv = adm.form.per - 1; return paintAdmin(); }
  if (b.dataset.topt) { readForm(); const f = adm.form, o = formOpts(f), v = b.dataset.tval; o[b.dataset.topt] = isNaN(+v) || v === '' ? v : +v; f.opts = o; return paintAdmin(); }
  const a = b.dataset.ta, id = b.dataset.id;
  if (a === 'new') { adm.form = newForm(); if (adm.games && !adm.games[adm.form.game]) adm.form.game = Object.keys(adm.games)[0]; adm.form.bo = 3; return paintAdmin(); }
  if (a === 'cancelform') { adm.form = null; return paintAdmin(); }
  if (a === 'create') {
    readForm(); const f = adm.form;
    if (!f.pl.trim() && !f.en.trim()) { d.toast(L('Give the tournament a name.', 'Nadaj turniejowi nazwę.'), true); return adm.box.querySelector('#ta-pl')?.focus(); }
    return d.send({ t: 'tour', op: 'create', game: f.game, fmt: f.fmt, bo: f.bo, per: f.per, adv: f.adv, max: f.max, minLv: f.minLv, start: f.start, name: { en: f.en, pl: f.pl }, rules: { en: f.ren, pl: f.rpl }, prize: { c: f.c, all: f.all }, opts: formOpts(f) });
  }
  if (a === 'later') return d.send({ t: 'tour', op: 'later', id, min: 15 });
  if (a === 'start' || a === 'cancel' || a === 'del' || a === 'subdel') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.classList.add('sure'); b.dataset.was = b.innerHTML; b.textContent = L('Sure? Tap again', 'Na pewno? Dotknij jeszcze raz'); setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.classList.remove('sure'); b.innerHTML = b.dataset.was; } }, 3500); return; }
    return a === 'subdel' ? d.send({ t: 'tour', op: 'sub_del', sid: id }) : d.send({ t: 'tour', op: a, id });
  }
  if (a === 'hookedit') { adm.hookEdit = true; return paintAdmin(); }
  if (a === 'hooksave') { adm.hookEdit = false; return d.send({ t: 'tour', op: 'cfg', hook: adm.box.querySelector('#ta-hook')?.value || '' }); }
  if (a === 'hookoff') return d.send({ t: 'tour', op: 'cfg', hook: '' });
  if (a === 'hooktest') return d.send({ t: 'tour', op: 'hooktest' });
  if (a === 'hlang') return d.send({ t: 'tour', op: 'cfg', lang: b.dataset.v });
  if (a === 'hping') return d.send({ t: 'tour', op: 'cfg', ping: !adm.cfg?.ping });
}
