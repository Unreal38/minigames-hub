// Moderation on the page: the Report window on profile cards, what a warned, muted or banned player sees, and the
// hosts' Admin panel (one window with tabs: Reports, Players, Who's here, Site notices, Previews). server/mod.js keeps
// the reports and sanctions and checks that only ADMINS accounts see or change anything.
import { L, LOCALE } from './i18n.js';
import { mountNotices } from './notice.js';
import { PEEKS, peekPick, setPeek, WX_PEEKS, wxPeekPick, setWxPeek } from './seasonpeek.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LSget = k => { try { return localStorage.getItem(k); } catch { return null; } };
const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let d = null; // from app.js: send, modal, toast, sfx, me(), avatarHtml, gameName(id), whoMount(box), onPeek(), srvText

/** app.js hands over what this needs. */
export function initAdmin(deps) { d = deps; }

export const REASONS = {
  chat: L('Rude or hurtful chat', 'Niemiłe lub obraźliwe wiadomości'),
  spam: L('Spam or flooding the chat', 'Spam lub zalewanie czatu'),
  cheat: L('Cheating or using bugs', 'Oszukiwanie lub wykorzystywanie błędów'),
  grief: L('Ruining games on purpose', 'Celowe psucie gry'),
  name: L('Bad name or look', 'Nieodpowiednie imię lub wygląd'),
  other: L('Something else', 'Coś innego'),
};
const when = t => new Date(t).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const hm = t => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
// How long a ban still runs: 2 d 3 h, 5 h 12 min, 4 min 09 s.
const leftText = u => { const s = Math.max(0, Math.ceil((u - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? `${d} ${L('d', 'd.')} ${h} ${L('h', 'godz.')}` : h ? `${h} ${L('h', 'godz.')} ${m} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };
const untilText = u => u ? L(`until ${when(u)}`, `do ${when(u)}`) : L('for good', 'na stałe');
const durText = m => !m ? L('For good', 'Na stałe') : m < 60 ? `${m} min` : m < 1440 ? L(`${m / 60} h`, `${m / 60} godz.`)
  : m === 1440 ? L('1 day', '1 dzień') : L(`${m / 1440} days`, `${m / 1440} dni`);

// ---------- reporting a player (from their profile card) ----------
let onReport = null;
export function openReport(p, from = 'hub') {
  const { el, close } = d.modal(`<h2>${L('Report', 'Zgłoś')} ${esc(p.name)}</h2>
    <p class="rknote">${L('Only the hosts read reports. Your report also takes along what was happening: the recent chat and the table you were at. The player is not told who reported them.', 'Zgłoszenia czytają tylko gospodarze. Do zgłoszenia dołączamy też, co się działo: ostatnie wiadomości z czatu i stół, przy którym byliście. Gracz nie dowie się, kto go zgłosił.')}</p>
    <form class="authform repform">
      <fieldset class="repwhy"><legend>${L('What happened?', 'Co się stało?')}</legend>
        ${Object.entries(REASONS).map(([k, t]) => `<label><input type="radio" name="why" value="${k}"> <span>${esc(t)}</span></label>`).join('')}
      </fieldset>
      <label for="rpn">${L('A few words for the hosts (optional)', 'Kilka słów dla gospodarzy (opcjonalnie)')}</label>
      <textarea class="field" id="rpn" maxlength="400" rows="3" placeholder="${L('What did they do, and when?', 'Co zrobił(a) i kiedy?')}"></textarea>
      <p class="autherr" role="alert" hidden></p>
      <div class="row"><button type="button" class="btn w" data-x>${L('Cancel', 'Anuluj')}</button><button class="btn p">${L('Send report', 'Wyślij zgłoszenie')}</button></div>
    </form>`);
  el.querySelector('.sheet').classList.add('repsheet');
  const f = el.querySelector('form'), err = f.querySelector('.autherr'), btn = f.querySelector('.btn.p');
  const done = () => { onReport = null; close(); };
  f.querySelector('[data-x]').addEventListener('click', () => { d.sfx.click(); done(); });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const why = f.querySelector('input[name=why]:checked')?.value, note = f.querySelector('#rpn').value.trim();
    const bad = t => { err.textContent = t; err.hidden = false; d.sfx.bad(); };
    if (!why) return bad(L('Pick what happened first.', 'Najpierw wybierz, co się stało.'));
    if (why === 'other' && !note) return bad(L('Write a few words about what happened.', 'Napisz kilka słów o tym, co się stało.'));
    btn.disabled = true; err.hidden = true;
    onReport = m => { btn.disabled = false; if (m.err) return bad(d.srvText(m.err)); done(); d.sfx.pop(); d.toast(L('Thanks. The hosts will have a look.', 'Dzięki. Gospodarze się temu przyjrzą.')); };
    d.send({ t: 'mod', op: 'report', pt: p.pt, why, note, from });
  });
}

// ---------- what the player is under: a ban screen, a warning, a note about a mute ----------
let banT = 0, banEl = null, warnShown = '', muteShown = -1, thanksShown = '';
export function onModMe(m) {
  if (m.ban) {
    const html = `<div class="banbox"><div class="banico" aria-hidden="true">⛔</div><h2>${L('You can’t play right now', 'Nie możesz teraz grać')}</h2>
      <p>${m.ban.until ? L(`A host has banned this account until <b>${when(m.ban.until)}</b>.`, `Gospodarz zablokował to konto do <b>${when(m.ban.until)}</b>.`) : L('A host has banned this account for good.', 'Gospodarz zablokował to konto na stałe.')}</p>
      ${m.ban.until ? `<p class="banleft">${L('Time left', 'Pozostało')}: <b data-banleft>${leftText(m.ban.until)}</b></p>` : ''}
      ${m.ban.why ? `<p class="banwhy">${L('Reason', 'Powód')}: ${esc(m.ban.why)}</p>` : ''}
</div>`;
    if (!banEl) { banEl = document.createElement('div'); banEl.className = 'banwall'; banEl.setAttribute('role', 'alertdialog'); document.body.append(banEl); }
    if (banEl.dataset.h !== html) { banEl.innerHTML = html; banEl.dataset.h = html; }
    document.body.classList.add('banned'); // nothing of the site shows behind it, and no pop-up opens over it
    clearInterval(banT);
    if (m.ban.until) banT = setInterval(() => { // counts down, and lets the player back in by itself at the end
      const el = banEl?.querySelector('[data-banleft]'); if (!el) return clearInterval(banT);
      if (m.ban.until <= Date.now()) { clearInterval(banT); return location.reload(); }
      el.textContent = leftText(m.ban.until);
    }, 1000);
    for (const x of document.querySelectorAll('.modal')) x.remove();
    return;
  }
  clearInterval(banT); banEl?.remove(); banEl = null; document.body.classList.remove('banned');
  if (m.warn && warnShown !== m.warn.id) {
    warnShown = m.warn.id;
    const w = d.modal(`<h2>⚠️ ${L('A warning from the hosts', 'Ostrzeżenie od gospodarzy')}</h2>
      <p class="banwhy">${esc(m.warn.why)}</p>
      <p>${L('Please keep the site friendly. Next time it can be a mute or a ban.', 'Prosimy, żeby było tu miło. Następnym razem może to być wyciszenie albo blokada.')}</p>
      <div class="row"><button type="button" class="btn" data-ok>${L('I understand', 'Rozumiem')}</button></div>`, false);
    w.el.querySelector('[data-ok]').addEventListener('click', () => { d.sfx.click(); w.close(); d.send({ t: 'mod', op: 'seen', id: m.warn.id }); });
  }
  if (m.thanks && thanksShown !== m.thanks.id) {
    thanksShown = m.thanks.id;
    const t = d.modal(`<h2>💛 ${L('Thank you!', 'Dziękujemy!')}</h2>
      <p>${L(`You reported <b>${esc(m.thanks.name)}</b>, a host looked into it and they are now banned. Thanks for helping keep ${'Zatoka Gier'} a friendly place!`, `Zgłosiłeś(-aś) gracza <b>${esc(m.thanks.name)}</b>, gospodarz to sprawdził i ten gracz jest teraz zablokowany. Dzięki, że pomagasz dbać o to, żeby w Zatoce Gier było miło!`)}</p>
      ${m.thanks.coins ? `<p class="thxcoins">+${m.thanks.coins} <i class="cn" aria-hidden="true"></i> ${L('a small thank-you', 'małe podziękowanie')}</p>` : ''}
      <div class="row"><button type="button" class="btn" data-ok>${L('You’re welcome', 'Nie ma za co')}</button></div>`, false);
    if (m.thanks.coins) d.sfx.join?.();
    t.el.querySelector('[data-ok]').addEventListener('click', () => { d.sfx.click(); t.close(); d.send({ t: 'mod', op: 'thanked', id: m.thanks.id }); });
  }
  const mu = m.mute ? m.mute.until || 0 : -1;
  if (m.mute && muteShown !== mu && LSget('ct_mute_seen') !== String(mu)) {
    LSset('ct_mute_seen', String(mu));
    d.toast(`🔇 ${m.mute.until ? L(`A host muted you until ${when(m.mute.until)}.`, `Gospodarz wyciszył cię do ${when(m.mute.until)}.`) : L('A host muted you for good.', 'Gospodarz wyciszył cię na stałe.')}${m.mute.why ? ` ${L('Reason', 'Powód')}: ${esc(m.mute.why)}` : ''} ${L('You can still play.', 'Nadal możesz grać.')}`, true, 9000);
  }
  muteShown = mu;
  st.mute = m.mute;
}
const st = { mute: null };
/** The line under the hub chat box while muted (or '' when the player may talk). */
export const muteNote = () => st.mute ? `🔇 ${st.mute.until ? L(`Muted until ${when(st.mute.until)}`, `Wyciszenie do ${when(st.mute.until)}`) : L('Muted for good', 'Wyciszenie na stałe')}` : '';

// ---------- the hosts' Admin panel ----------
export const TABS = [['reports', '🚩', L('Reports', 'Zgłoszenia')], ['players', '🧑‍⚖️', L('Players', 'Gracze')], ['who', '👀', L('Who’s here', 'Kto jest')], ['notices', '📣', L('Site notices', 'Komunikaty')], ['looks', '🌦️', L('Previews', 'Podgląd')]];
let panel = null, tab = 'reports', stopTab = null, data = null, showClosed = false, found = null, findQ = '', openCases = 0;
export const openCount = () => openCases;
export function openAdmin(start) {
  if (!d.me()?.admin) return;
  panel?.close();
  tab = TABS.some(([k]) => k === start) ? start : TABS.some(([k]) => k === LSget('ct_admin_tab')) ? LSget('ct_admin_tab') : 'reports';
  const w = panel = d.modal(`<h2>🛡️ ${L('Admin', 'Panel gospodarza')}</h2>
    <div class="admtabs" role="tablist">${TABS.map(([k, ico, t]) => `<button type="button" role="tab" data-tab="${k}"><span aria-hidden="true">${ico}</span> ${t}${k === 'reports' ? '<i class="frbadge admbadge" hidden></i>' : ''}</button>`).join('')}</div>
    <div class="admbody" role="tabpanel"></div>`);
  w.el.querySelector('.sheet').classList.add('listsheet', 'ntsheet', 'admsheet');
  w.onClose = () => { stopTab?.(); stopTab = null; if (panel === w) panel = null; };
  w.el.addEventListener('click', onPanelClick);
  w.el.addEventListener('submit', e => { if (e.target.matches('.admfind')) { e.preventDefault(); findQ = e.target.querySelector('input').value.trim(); if (findQ.length >= 2) d.send({ t: 'mod', op: 'find', q: findQ }); else { found = null; paint(); } } });
  showTab(tab);
}
function showTab(k) {
  tab = k; LSset('ct_admin_tab', k);
  stopTab?.(); stopTab = null;
  const body = panel.el.querySelector('.admbody');
  for (const b of panel.el.querySelectorAll('.admtabs [data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === k);
  paintBadge();
  if (k === 'reports' || k === 'players') { d.send({ t: 'mod', op: 'list' }); const t = setInterval(() => d.send({ t: 'mod', op: 'list' }), 20_000); stopTab = () => clearInterval(t); paint(); }
  else if (k === 'who') { body.innerHTML = `<p class="rknote">${L('Everyone on the site right now. It updates by itself. Tap someone for their profile card.', 'Wszyscy, którzy są teraz na stronie. Lista odświeża się sama. Dotknij kogoś, żeby zobaczyć jego wizytówkę.')}</p><div class="rkall" id="who-list"></div>`; stopTab = d.whoMount(body); }
  else if (k === 'notices') stopTab = mountNotices(body);
  else paintLooks(body);
}
function paintBadge() {
  const b = panel?.el.querySelector('.admbadge'); if (b) { b.hidden = !openCases; b.textContent = openCases || ''; }
}
// Day and time of a line in the context
const ctxLines = (lines, empty) => lines?.length ? `<ol class="ctxlog">${lines.map(x => `<li class="${x.me ? 'them' : ''}"><time>${x.at ? hm(x.at) : ''}</time> <b>${esc(x.name)}</b> ${esc(x.text)}</li>`).join('')}</ol>` : `<p class="nthint">${empty}</p>`;
function whereText(a) {
  if (!a) return '?';
  if (a.k === 'off') return L('not on the site', 'poza stroną');
  if (a.k === 'table') return `${esc(d.gameName(a.game))} · ${esc(a.code)}${a.priv ? L(' (private)', ' (prywatny)') : ''}${a.watch ? L(', watching', ', ogląda') : a.play ? L(', playing', ', gra') : L(', waiting room', ', poczekalnia')}`;
  return { farm: L('Pet Farm', 'Farma zwierzaków'), hay: 'Hay Hunch', pop: 'Pet Pop', mj: 'Pet Mahjong', plaza: L('the Plaza', 'Plac'), hub: L('the hub', 'strona główna') }[a.k] || esc(a.k);
}
const FROM = { hub: L('the hub', 'strona główna'), chat: L('the hub chat', 'czat'), table: L('a table', 'stół'), plaza: L('the Plaza', 'Plac'), who: L('Who’s here', 'Kto jest') };
const standingChips = x => `${x.ban ? `<span class="chip mban">⛔ ${L('banned', 'blokada')} (${TIER_NAME[x.ban.tier] || TIER_NAME.acct}) ${untilText(x.ban.until)}</span>` : ''}${x.mute ? `<span class="chip mmute">🔇 ${L('muted', 'wyciszenie')} ${untilText(x.mute.until)}</span>` : ''}${x.warns ? `<span class="chip">⚠️ ${L(`${x.warns} warning${x.warns === 1 ? '' : 's'}`, `ostrzeżenia: ${x.warns}`)}</span>` : ''}${x.admin ? `<span class="chip">🛡️ ${L('host', 'gospodarz')}</span>` : ''}`;
const whoHead = (x, extra = '') => `<div class="mwho"${x.pt ? ` data-prof="${esc(x.pt)}"` : ''}>${d.avatarHtml(x.color, x.av, 40)}<div><b>${esc(x.name)}</b> <small>${x.user ? '@' + esc(x.user) : L('guest', 'gość')}</small><div class="mchips">${extra}${standingChips(x)}</div></div></div>`;
function repHtml(r) {
  return `<div class="mrep"><p class="mline"><b class="chip mwhy">${esc(REASONS[r.why] || r.why)}</b> <span>${when(r.at)} · ${L('from', 'od')} ${r.by.pt ? `<a href="#" data-prof="${esc(r.by.pt)}">${esc(r.by.name)}</a>` : esc(r.by.name)}${r.by.user ? ` <small>@${esc(r.by.user)}</small>` : ''} · ${L('on', 'miejsce:')} ${FROM[r.from] || esc(r.from)}</span></p>
    ${r.note ? `<blockquote>${esc(r.note).replace(/\n/g, '<br>')}</blockquote>` : ''}
    <details><summary>${L('What was happening', 'Co się działo')}</summary>
      <p class="nthint">${L('Reporter was at', 'Zgłaszający był:')} ${whereText(r.where)} · ${L('reported player was at', 'zgłoszony był:')} ${whereText(r.twhere)}</p>
      ${r.table ? `<h4>${L('Table chat', 'Czat przy stole')} · ${esc(d.gameName(r.table.game))} ${esc(r.table.code)}</h4>${ctxLines(r.table.lines, L('Nobody wrote at that table.', 'Nikt nic nie napisał przy tym stole.'))}` : ''}
      <h4>${L('Hub chat around their newest line', 'Czat wokół ich ostatniej wiadomości')}</h4>${ctxLines(r.around, L('They have not written in the hub chat lately.', 'Ostatnio nic nie pisali na czacie.'))}
      ${r.hub?.length > 1 ? `<h4>${L('Their last hub chat lines', 'Ich ostatnie wiadomości na czacie')}</h4>${ctxLines(r.hub, '')}` : ''}
    </details>
    ${r.done ? `<p class="nthint">✔ ${doneText(r.done)}</p>` : ''}</div>`;
}
const K_NAME = { warn: L('warned', 'ostrzeżenie'), mute: L('muted', 'wyciszenie'), ban: L('banned', 'blokada'), unmute: L('mute lifted', 'koniec wyciszenia'), unban: L('ban lifted', 'koniec blokady'), dismiss: L('dismissed', 'odrzucone') };
const doneText = (x, at = true) => `${K_NAME[x.k] || x.k}${x.tier ? ` (${TIER_NAME[x.tier]})` : ''}${x.k === 'mute' || x.k === 'ban' ? ' ' + untilText(x.until) : ''} · ${esc(x.by)}${at ? ` · ${when(x.at)}` : ''}${x.why ? ` · “${esc(x.why)}”` : ''}`;
// Before deciding: earlier warnings, mutes and bans of this player, and how many reports about them were closed.
function historyHtml(k) {
  const w = k.warnList || [], acts = k.past || [], bans = acts.filter(x => x.k === 'ban'), mutes = acts.filter(x => x.k === 'mute');
  if (!w.length && !acts.length && !k.pastReports) return `<p class="mhist none">✨ ${L('No warnings, mutes or bans before.', 'Wcześniej bez ostrzeżeń, wyciszeń i blokad.')}</p>`;
  const tally = [w.length ? `⚠️ ${L(`${w.length} warning${w.length === 1 ? '' : 's'}`, `ostrzeżenia: ${w.length}`)}` : '', mutes.length ? `🔇 ${L(`${mutes.length} mute${mutes.length === 1 ? '' : 's'}`, `wyciszenia: ${mutes.length}`)}` : '',
    bans.length ? `⛔ ${L(`${bans.length} ban${bans.length === 1 ? '' : 's'}`, `blokady: ${bans.length}`)}` : '', k.pastReports ? `🚩 ${L(`${k.pastReports} closed report${k.pastReports === 1 ? '' : 's'}`, `zamknięte zgłoszenia: ${k.pastReports}`)}` : ''].filter(Boolean).join(' · ');
  const rows = [...w.map(x => ({ ...x, k: 'warn' })), ...acts].sort((a, b) => b.at - a.at).slice(0, 10);
  return `<div class="mhist${bans.length ? ' hot' : ''}"><b>${L('Before this', 'Wcześniej')}: ${tally}</b>
    <ol class="ctxlog">${rows.map(x => `<li><time>${when(x.at)}</time> <b>${K_NAME[x.k] || x.k}</b>${x.k === 'mute' || x.k === 'ban' ? (x.mins ? ` ${L('for', 'na')} ${durText(x.mins)}` : ` ${L('for good', 'na stałe')}`) : ''}${x.tier ? ` (${TIER_NAME[x.tier]})` : ''}${x.why ? `: ${esc(x.why)}` : ''} <small>· ${esc(x.by)}</small></li>`).join('')}</ol></div>`;
}
function paintReports(body) {
  if (!data) { body.innerHTML = `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>`; return; }
  const open = data.open;
  body.innerHTML = `<p class="rknote">${open.length ? L(`${open.length} player${open.length === 1 ? '' : 's'} with open reports. Acting on one closes all their open reports.`, `Gracze z otwartymi zgłoszeniami: ${open.length}. Decyzja zamyka wszystkie ich otwarte zgłoszenia.`) : L('No open reports. All quiet!', 'Brak otwartych zgłoszeń. Spokój!')}</p>
    ${open.map(k => `<article class="mcase">${whoHead(k, k.reports.length > 1 ? `<span class="chip mwhy">🚩 ${L(`${k.reports.length} reports`, `zgłoszenia: ${k.reports.length}`)}</span>` : '')}
      ${historyHtml(k)}
      ${k.reports.map(repHtml).join('')}
      <div class="row mact">${k.gone ? `<span class="nthint">${L('This player is gone (account deleted).', 'Tego gracza już nie ma (konto usunięte).')}</span>` : `
        <button type="button" class="btn sm" data-mod="${esc(k.pt)}" data-k="warn">⚠️ ${L('Warn', 'Ostrzeż')}</button>
        <button type="button" class="btn sm" data-mod="${esc(k.pt)}" data-k="mute">🔇 ${L('Mute', 'Wycisz')}</button>
        <button type="button" class="btn sm p" data-mod="${esc(k.pt)}" data-k="ban">⛔ ${L('Ban', 'Zablokuj')}</button>`}
        <button type="button" class="btn sm w" data-dismiss="${esc(k.pt)}">${L('Dismiss', 'Odrzuć')}</button></div></article>`).join('')}
    <button type="button" class="btn w sm" data-closed>${showClosed ? L('Hide closed reports', 'Ukryj zamknięte zgłoszenia') : L(`Show closed reports (${data.closed.length})`, `Pokaż zamknięte zgłoszenia (${data.closed.length})`)}</button>
    ${showClosed ? (data.closed.length ? data.closed.map(r => `<article class="mcase done">${whoHead({ ...r.who, pt: r.pt })}${repHtml(r)}</article>`).join('') : `<p class="nthint">${L('Nothing closed yet.', 'Nic jeszcze nie zamknięto.')}</p>`) : ''}
    <p class="nthint small">${L('Closed reports are deleted after 90 days; reports nobody looked at after 180 days.', 'Zamknięte zgłoszenia znikają po 90 dniach, nieprzejrzane po 180 dniach.')}</p>`;
}
function paintPlayers(body) {
  const a = data?.active;
  body.innerHTML = `<form class="admfind"><input class="field" type="search" maxlength="20" placeholder="${L('Name or username', 'Imię lub nazwa użytkownika')}" value="${esc(findQ)}" aria-label="${L('Find a player', 'Znajdź gracza')}"><button class="btn sm">${L('Find', 'Szukaj')}</button></form>
    ${found ? (found.length ? `<div class="mlist">${found.map(x => `<div class="mrow">${whoHead(x)}<button type="button" class="btn sm w" data-mod="${esc(x.pt)}">${L('Moderate', 'Moderuj')}</button></div>`).join('')}</div>` : `<p class="nthint">${L('Nobody with that name.', 'Nikt o takim imieniu.')}</p>`) : ''}
    <h3>${L('Muted or banned now', 'Teraz wyciszeni lub zablokowani')}</h3>
    ${!a ? `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>` : a.rows.length ? `<div class="mlist">${a.rows.map(x => `<div class="mrow">${whoHead(x)}<button type="button" class="btn sm w" data-mod="${esc(x.pt)}">${L('Change', 'Zmień')}</button></div>`).join('')}</div>` : `<p class="nthint">${L('Nobody. Everyone can talk and play.', 'Nikt. Wszyscy mogą pisać i grać.')}</p>`}
    <h3>${L('What the hosts did lately', 'Ostatnie decyzje gospodarzy')}</h3>
    ${a?.log.length ? `<ol class="ctxlog mlog">${a.log.map(x => `<li><time>${when(x.at)}</time> <b${x.pt ? ` data-prof="${esc(x.pt)}"` : ''}>${esc(x.name)}</b>${x.user ? ` <small>@${esc(x.user)}</small>` : ''}: ${doneText(x, false)}${x.reports ? ` · 🚩 ${x.reports}` : ''}</li>`).join('')}</ol>` : `<p class="nthint">${L('Nothing yet.', 'Jeszcze nic.')}</p>`}
    <p class="nthint small">${L('A ban keeps the player off every screen of the site, also on the browsers they used while logged in. Hosts can’t be muted or banned.', 'Blokada odcina gracza od całej strony, także w przeglądarkach, w których był zalogowany. Gospodarzy nie da się wyciszyć ani zablokować.')}</p>`;
}
function paintLooks(body) {
  const SEA = { auto: L('auto (today’s)', 'automatyczna (dzisiejsza)'), winter: L('winter', 'zima'), spring: L('spring', 'wiosna'), summer: L('summer', 'lato'), autumn: L('autumn', 'jesień'), halloween: 'Halloween' };
  const WX = { auto: L('auto (Pet Farm’s)', 'automatyczna (jak na Farmie)'), sunny: L('sunny', 'słonecznie'), cloudy: L('cloudy', 'pochmurno'), rain: L('rain', 'deszcz'), wind: L('windy', 'wietrznie'), rainbow: L('rainbow', 'tęcza') };
  body.innerHTML = `<p class="rknote">${L('Only you see these, on this computer. Players keep the real season and weather.', 'Widzisz to tylko ty, na tym komputerze. Gracze mają prawdziwą porę roku i pogodę.')}</p>
    <section class="ntsec"><h3>❄️ ${L('Island season', 'Pora roku wysp')}</h3><p class="nthint">${L('Games opened from now on use it.', 'Obowiązuje w grach otwartych od teraz.')}</p>
      <div class="pills" role="group">${['auto', ...PEEKS].map(k => `<button type="button" data-sea="${k}" aria-pressed="${peekPick() === k}">${esc(SEA[k] || k)}</button>`).join('')}</div></section>
    <section class="ntsec"><h3>🌦️ ${L('Weather look', 'Wygląd pogody')}</h3><p class="nthint">${L('The hub sky and the games. Pet Farm keeps the real weather.', 'Niebo na stronie głównej i w grach. Farma zwierzaków ma prawdziwą pogodę.')}</p>
      <div class="pills" role="group">${['auto', ...WX_PEEKS].map(k => `<button type="button" data-wx="${k}" aria-pressed="${wxPeekPick() === k}">${esc(WX[k] || k)}</button>`).join('')}</div></section>`;
}
function paint() {
  if (!panel) return;
  const body = panel.el.querySelector('.admbody');
  if (tab === 'reports') paintReports(body); else if (tab === 'players') paintPlayers(body);
}
function onPanelClick(e) {
  const b = e.target.closest('button, a[data-prof]'); if (!b) return;
  if (b.matches('a[data-prof]')) e.preventDefault();
  if (b.dataset.tab) { d.sfx.click(); return showTab(b.dataset.tab); }
  if (b.dataset.mod) { d.sfx.click(); return openModerate(b.dataset.mod, b.dataset.k); }
  if (b.dataset.dismiss) { d.sfx.click(); return d.send({ t: 'mod', op: 'act', pt: b.dataset.dismiss, k: 'dismiss' }); }
  if (b.dataset.closed !== undefined) { showClosed = !showClosed; return paint(); }
  if (b.dataset.sea) { setPeek(b.dataset.sea); d.onPeek('season'); return paintLooks(panel.el.querySelector('.admbody')); }
  if (b.dataset.wx) { setWxPeek(b.dataset.wx); d.onPeek('weather'); return paintLooks(panel.el.querySelector('.admbody')); }
}

// ---------- the Moderate window: warn, mute or ban one player ----------
let modWin = null, modPt = '', modK = 'warn', modMins = null, modTier = 'acct', mins = { mute: [], ban: [] };
export function openModerate(pt, k = 'warn', why = '') {
  if (!d.me()?.admin) return;
  modWin?.close(); modPt = pt; modK = ['warn', 'mute', 'ban'].includes(k) ? k : 'warn'; modMins = null; modTier = 'acct';
  const w = modWin = d.modal(`<h2>${L('Moderate', 'Moderuj')}</h2><div class="modbody"><p class="rknote">${L('Loading…', 'Wczytywanie…')}</p></div>`);
  w.el.querySelector('.sheet').classList.add('listsheet', 'ntsheet', 'modsheet');
  w.prefill = why || (data?.open.find(x => x.pt === pt)?.reports[0] ? REASONS[data.open.find(x => x.pt === pt).reports[0].why] : '');
  w.onClose = () => { if (modWin === w) modWin = null; };
  w.el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mk) { modK = b.dataset.mk; modMins = null; keepWhy(); return paintModerate(); }
    if (b.dataset.mm !== undefined) { modMins = +b.dataset.mm; keepWhy(); return paintModerate(); }
    if (b.dataset.mt) { modTier = b.dataset.mt; keepWhy(); return paintModerate(); }
    const op = b.dataset.op; if (!op) return;
    d.sfx.click();
    const reason = w.el.querySelector('#mdwhy')?.value.trim() || '';
    if (op === 'apply') {
      if (!reason) { d.toast(L('Write the reason: the player is shown it.', 'Wpisz powód: gracz go zobaczy.'), true); return w.el.querySelector('#mdwhy')?.focus(); }
      if (modK !== 'warn' && modMins === null) return d.toast(L('Pick how long first.', 'Najpierw wybierz, na jak długo.'), true);
      return d.send({ t: 'mod', op: 'act', pt, k: modK, mins: modMins, why: reason, tier: modTier });
    }
    d.send({ t: 'mod', op: 'act', pt, k: op }); // unmute, unban, dismiss
  });
  d.send({ t: 'mod', op: 'peek', pt });
}
const TIER_OPTS = [['acct', L('Account', 'Konto')], ['dev', L('Account + device', 'Konto + urządzenie')], ['ip', L('Account + device + address', 'Konto + urządzenie + adres IP')]];
export const TIER_NAME = { acct: L('account', 'konto'), dev: L('device', 'urządzenie'), ip: L('IP address', 'adres IP') };
const TIER_HINT = {
  acct: L('The account, and every browser it was logged in on (also after logging out).', 'Konto i każda przeglądarka, w której było zalogowane (także po wylogowaniu).'),
  dev: L('Also the devices they played on, whatever account or guest they use there. A private window or cleared site data gets round it.', 'Także urządzenia, na których grali, bez względu na konto czy gościa. Okno prywatne albo wyczyszczone dane strony to omijają.'),
  ip: L('Also the internet addresses they came from in the last two weeks. Careful: it blocks everyone on that connection (a home, a school, a phone network).', 'Także adresy internetowe, z których przychodzili w ostatnich dwóch tygodniach. Uwaga: blokuje wszystkich na tym łączu (dom, szkołę, sieć komórkową).'),
};
const keepWhy = () => { const i = modWin?.el.querySelector('#mdwhy'); if (i) modWin.prefill = i.value; };
function paintModerate() {
  const w = modWin, x = w?.p; if (!w) return;
  const box = w.el.querySelector('.modbody');
  if (!x) { box.innerHTML = `<p class="rknote">${L('That player is not around any more.', 'Tego gracza już tu nie ma.')}</p>`; return; }
  const list = modK === 'mute' ? mins.mute : modK === 'ban' ? mins.ban : [];
  box.innerHTML = `${whoHead(x)}
    ${x.admin ? `<p class="nthint">${L('This is a host: hosts can’t be warned, muted or banned.', 'To gospodarz: gospodarzy nie da się ostrzec, wyciszyć ani zablokować.')}</p>` : `
    <div class="pills mkinds" role="group">${[['warn', '⚠️', L('Warning', 'Ostrzeżenie')], ['mute', '🔇', L('Mute', 'Wyciszenie')], ['ban', '⛔', L('Ban', 'Blokada')]].map(([k, i, t]) => `<button type="button" data-mk="${k}" aria-pressed="${modK === k}">${i} ${t}</button>`).join('')}</div>
    <p class="nthint">${modK === 'warn' ? L('The player gets a pop-up with your reason the next time they are on the site.', 'Gracz zobaczy okienko z twoim powodem, gdy następnym razem będzie na stronie.')
      : modK === 'mute' ? L('They can still play, but can’t write in any chat.', 'Może dalej grać, ale nie może pisać na żadnym czacie.')
      : L('They can’t use the site at all: they see a ban screen with your reason.', 'Nie może w ogóle korzystać ze strony: widzi ekran blokady z twoim powodem.')}</p>
    ${list.length ? `<div class="pills" role="group" aria-label="${L('How long', 'Na jak długo')}">${list.map(m => `<button type="button" data-mm="${m}" aria-pressed="${modMins === m}">${durText(m)}</button>`).join('')}</div>` : ''}
    ${modK === 'ban' ? `<p class="nthint"><b>${L('What to block', 'Co zablokować')}</b> ${L('(only hosts see this; the player just sees a ban)', '(widzą to tylko gospodarze; gracz widzi po prostu blokadę)')}</p>
    <div class="pills mtiers" role="group">${TIER_OPTS.map(([k, t]) => `<button type="button" data-mt="${k}" aria-pressed="${modTier === k}">${t}</button>`).join('')}</div>
    <p class="nthint">${TIER_HINT[modTier]}</p>` : ''}
    <label class="nthint" for="mdwhy">${L('Reason (the player sees it)', 'Powód (gracz go zobaczy)')}</label>
    <input class="field" id="mdwhy" maxlength="200" value="${esc(w.prefill || '')}">
    <div class="row"><button type="button" class="btn ${modK === 'ban' ? 'p' : ''}" data-op="apply">${modK === 'warn' ? L('Send the warning', 'Wyślij ostrzeżenie') : modK === 'mute' ? L('Mute', 'Wycisz') : L('Ban', 'Zablokuj')}</button>
      ${x.mute ? `<button type="button" class="btn w" data-op="unmute">${L('Lift the mute', 'Zdejmij wyciszenie')}</button>` : ''}
      ${x.ban ? `<button type="button" class="btn w" data-op="unban">${L('Lift the ban', 'Zdejmij blokadę')}</button>` : ''}</div>`}
    ${x.open ? `<button type="button" class="btn w sm" data-op="dismiss">${L(`Dismiss ${x.open} open report${x.open === 1 ? '' : 's'}`, `Odrzuć otwarte zgłoszenia (${x.open})`)}</button>` : ''}
    ${historyHtml({ warnList: x.warnList, past: x.past, pastReports: x.total - x.open })}
    <p class="nthint small">${L(`Reports about this player so far: ${x.total}.`, `Zgłoszenia na tego gracza do tej pory: ${x.total}.`)}</p>`;
}

/** A {t:'mod'} message from the server. */
export function onMod(m) {
  if (m.op === 'report') return onReport?.(m);
  if (m.op === 'thanks') return d.toast(L(`A host looked at your report about ${esc(m.name)} and acted on it. Thank you!`, `Gospodarz przejrzał twoje zgłoszenie (${esc(m.name)}) i podjął działanie. Dziękujemy!`));
  if (m.op === 'count') {
    const more = (m.n | 0) > openCases; openCases = m.n | 0; paintBadge(); d.onCount?.(openCases);
    if (more && d.me()?.admin) { d.sfx.pop(); d.toast(`🚩 ${L('A new player report is waiting in the Admin panel.', 'Nowe zgłoszenie gracza czeka w Panelu gospodarza.')}`); }
    if (panel && (tab === 'reports' || tab === 'players')) d.send({ t: 'mod', op: 'list' });
    return;
  }
  if (m.op === 'list') { data = m; mins = m.mins || mins; return paint(); }
  if (m.op === 'find') { if (m.q === findQ) { found = m.rows; paint(); } return; }
  if (m.op === 'peek') { mins = m.mins || mins; if (modWin && (!m.p || m.p.pt === modPt)) { modWin.p = m.p; paintModerate(); } return; }
  if (m.op === 'done') {
    d.sfx.pop();
    d.toast(`${esc(m.name)}: ${K_NAME[m.k] || m.k}${m.k === 'mute' || m.k === 'ban' ? ' ' + untilText(m.until) : ''}.`);
    modWin?.close();
    if (panel) d.send({ t: 'mod', op: 'list' });
  }
}
