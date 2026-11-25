// Site notices on every screen: the maintenance countdown strip, the hosts' announcement strip and the "What's new"
// note after an update, plus the hosts' Site notices window that sets them (server/notice.js keeps them and checks
// that only ADMINS accounts change anything).
import { L, PL } from './i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LSget = k => { try { return localStorage.getItem(k); } catch { return null; } };
const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
// The host writes Polish and/or English; each player reads their language, or the other one if that is all there is.
const pick = x => (x ? (PL ? x.pl || x.en : x.en || x.pl) || '' : '');
export const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

let deps = null, cur = { maint: null, ann: null, news: null }, end = 0, tick = 0, sheet = null, newsT = 0, small = false;
const $bar = () => document.getElementById('sitebar');

/** app.js hands over what this needs: send, modal, toast, sfx, me() and inGame(). */
export function initNotice(d) { deps = d; }

/** A {t:'notice'} from the server. */
export function onNotice(m) {
  const had = !!cur.maint;
  cur = { maint: m.maint || null, ann: m.ann || null, news: m.news || null, next: m.next || null, canRestart: !!m.canRestart, pulled: !!m.pulled };
  end = cur.maint ? Date.now() + cur.maint.left : 0;
  if (cur.maint && !had) { small = false; deps?.sfx?.join?.(); }
  clearInterval(tick); tick = cur.maint ? setInterval(paintTime, 1000) : 0;
  paintBar(); paintSheet(); tryNews();
}
export const holding = () => !!cur.maint;

// ---------- the strips at the top of every screen ----------
function maintText() {
  const left = end - Date.now(), why = pick(cur.maint);
  if (left <= 0) return `<b>${L('Updating now.', 'Trwa aktualizacja.')}</b> ${L('The site will be back in a moment.', 'Strona zaraz wróci.')}`;
  return `<b>${L('Update in', 'Aktualizacja za')} <time>${clock(left)}</time></b> <span>${L('Finish your game: new games are on hold.', 'Dokończ grę: nowe gry są wstrzymane.')}</span>${why ? ` <i>${esc(why)}</i>` : ''}`;
}
function paintBar() {
  const el = $bar(); if (!el) return;
  const annOn = cur.ann && LSget('ct_ann_x') !== cur.ann.id;
  el.hidden = !cur.maint && !annOn;
  el.innerHTML = (cur.maint ? `<div class="sb maint${small ? ' small' : ''}" role="status"><span class="sbico" aria-hidden="true">🔧</span>
      <button type="button" class="sbtxt" data-sb="fold" title="${small ? L('Show more', 'Pokaż więcej') : L('Make smaller', 'Zmniejsz')}">${small ? `<time>${clock(end - Date.now())}</time>` : maintText()}</button></div>` : '')
    + (annOn ? `<div class="sb ann" role="status"><span class="sbico" aria-hidden="true">📣</span><span class="sbtxt">${esc(pick(cur.ann))}</span>
      <button type="button" class="sbx" data-sb="x" aria-label="${L('Hide this message', 'Ukryj tę wiadomość')}">×</button></div>` : '');
  place();
}
// The strips float just under the page's top bar while it is in view (so they never cover the logo or account
// buttons), and at the very top once it has scrolled away or on screens without one (inside games).
function place() {
  const el = $bar(); if (!el || el.hidden) { document.body.classList.remove('has-sitebar'); return; }
  const top = document.querySelector('#app .top'), r = top?.getBoundingClientRect();
  el.style.top = `${Math.round(Math.max(8, r && r.height ? r.bottom + 6 : 8))}px`;
  document.body.classList.add('has-sitebar');
}
let placeQ = 0;
const placeSoon = () => { if (!placeQ) placeQ = requestAnimationFrame(() => { placeQ = 0; place(); }); };
addEventListener('scroll', placeSoon, { passive: true }); addEventListener('resize', placeSoon);
new MutationObserver(placeSoon).observe(document.getElementById('app') || document.body, { childList: true });
function paintTime() {
  const left = end - Date.now(), t = $bar()?.querySelector('.maint time');
  if (t && left > 0) t.textContent = clock(left); else paintBar();
  const st = sheet?.el.querySelector('[data-left]'); if (st) st.textContent = left > 0 ? clock(left) : upText();
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('#sitebar [data-sb]'); if (!b) return;
  if (b.dataset.sb === 'x' && cur.ann) LSset('ct_ann_x', cur.ann.id);
  if (b.dataset.sb === 'fold') small = !small;
  paintBar();
});

// ---------- "What's new", once per note ----------
function tryNews() {
  clearTimeout(newsT);
  const n = cur.news; if (!n || !deps || LSget('ct_news') === n.id) return;
  if (!LSget('ct_name')) { LSset('ct_news', n.id); return; } // a first visit: everything is new anyway
  if (deps.inGame() || document.querySelector('.modal')) { newsT = setTimeout(tryNews, 4000); return; } // not in the middle of a game or another window
  LSset('ct_news', n.id);
  const text = esc(pick(n)).replace(/\n/g, '<br>');
  const w = deps.modal(`<h2>${L('What’s new', 'Co nowego')} ✨</h2><div class="newsnote">${text}</div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" data-x>${L('Nice!', 'Super!')}</button></div>`);
  w.el.querySelector('.sheet').classList.add('newssheet');
  w.el.querySelector('[data-x]').addEventListener('click', () => { deps.sfx?.click?.(); w.close(); });
}

// ---------- the hosts' Site notices window ----------
const MINS = [2, 5, 10, 15, 30];
let mins = 5, autoOn = true, pollT = 0;
const pairHtml = (id, area, ph) => `<div class="ntpair">
  <label><span>🇵🇱 ${L('Polish', 'Po polsku')}</span>${area ? `<textarea class="field" id="${id}-pl" maxlength="1200" rows="4" placeholder="${esc(ph[1])}"></textarea>` : `<input class="field" id="${id}-pl" maxlength="200" placeholder="${esc(ph[1])}">`}</label>
  <label><span>🇬🇧 ${L('English', 'Po angielsku')}</span>${area ? `<textarea class="field" id="${id}-en" maxlength="1200" rows="4" placeholder="${esc(ph[0])}"></textarea>` : `<input class="field" id="${id}-en" maxlength="200" placeholder="${esc(ph[0])}">`}</label>
</div>`;
const upText = () => cur.maint?.auto ? L('time’s up: restarting…', 'czas minął: restart…') : L('time’s up: restart the server now', 'czas minął: zrestartuj teraz serwer');
// Is there new code to restart into? (Hosts only: the server compares the commit on disk with the one running.)
const pulledHtml = () => `<p class="ntnow ntpull ${cur.pulled ? 'ok' : ''}">${cur.pulled ? `✅ ${L('New code is pulled and waiting.', 'Nowy kod jest pobrany i czeka.')}` : `⏳ ${L('No new code pulled yet: run git pull before zero. (Restarting without it is harmless.)', 'Nowy kod nie jest jeszcze pobrany: zrób git pull przed zerem. (Restart bez niego niczego nie psuje.)')}`}</p>`;
const shown = x => `<blockquote>${esc(pick(x)).replace(/\n/g, '<br>')}</blockquote>`;
function statusHtml() {
  const mt = cur.maint, left = end - Date.now();
  return {
    maint: mt ? `<p class="ntnow"><b>${L('Countdown running:', 'Odliczanie trwa:')} <time data-left>${left > 0 ? clock(left) : upText()}</time></b><br>${L('New games are on hold. Games already running carry on.', 'Nowe gry są wstrzymane. Trwające gry toczą się dalej.')}<br>${mt.auto ? `🔁 ${L('The server restarts by itself at zero.', 'Serwer zrestartuje się sam przy zerze.')}` : L('Restart the server by hand at zero.', 'Przy zerze zrestartuj serwer ręcznie.')}</p>
      ${mt.err ? `<p class="ntnow ntbad">⚠️ ${L(`The new code has an error (${esc(mt.err)}), so the server did not restart. The site still runs the old code. Fix it, then restart by hand.`, `Nowy kod ma błąd (${esc(mt.err)}), więc serwer się nie zrestartował. Strona działa dalej na starym kodzie. Popraw go i zrestartuj ręcznie.`)}</p>` : ''}
      ${pulledHtml()}
      <button type="button" class="btn w sm" data-nt="cancel">${L('Cancel the countdown', 'Odwołaj odliczanie')}</button>` : '',
    ann: cur.ann ? `<p class="ntnow"><b>${L('On screen now:', 'Teraz na ekranie:')}</b></p>${shown(cur.ann)}<button type="button" class="btn w sm" data-nt="anndown">${L('Take it down', 'Zdejmij')}</button>` : '',
    news: (cur.next ? `<p class="ntnow"><b>${L('Waiting for the next restart:', 'Czeka na najbliższy restart:')}</b></p>${shown(cur.next)}` : '')
      + (cur.news ? `<p class="ntnow"><b>${L('Showing now (for 3 days):', 'Wyświetlana teraz (przez 3 dni):')}</b></p>${shown(cur.news)}` : '')
      + (cur.next || cur.news ? `<button type="button" class="btn w sm" data-nt="newsclear">${L('Remove the note', 'Usuń notkę')}</button>` : ''),
  };
}
function paintSheet() {
  if (!sheet) return;
  const s = statusHtml();
  for (const k of ['maint', 'ann', 'news']) { const el = sheet.el.querySelector(`[data-st="${k}"]`); el.innerHTML = s[k]; el.hidden = !s[k]; }
  sheet.el.querySelector('[data-form="maint"]').hidden = !!cur.maint;
  const pl = sheet.el.querySelector('[data-pull]'); if (pl) pl.innerHTML = pulledHtml();
}
/** The Site notices tab of the Admin panel (admin.js), drawn into `box`. Returns the function that stops it. */
export function mountNotices(box) {
  if (!deps?.me()?.admin) return () => {};
  deps.send({ t: 'notice' }); // fresh state, with the note waiting for the restart
  box.innerHTML = `<p class="rknote">${L('Only hosts see this tab. Write in one language or both: players read theirs, or the other one if that is all there is.', 'Tę kartę widzą tylko gospodarze. Pisz w jednym języku albo w obu: gracze czytają swój, a jeśli go nie ma, ten drugi.')}</p>
    <section class="ntsec"><h3>🔧 ${L('Maintenance countdown', 'Odliczanie do aktualizacji')}</h3>
      <div data-st="maint" hidden></div>
      <div data-form="maint">
        <p class="nthint">${L('Everyone online gets a countdown at the top of the screen. New games can’t start until the update; games already running carry on.', 'Wszyscy na stronie widzą odliczanie u góry ekranu. Do aktualizacji nie da się zacząć nowej gry; trwające gry toczą się dalej.')}</p>
        <div class="pills" role="group" aria-label="${L('Minutes', 'Minuty')}">${MINS.map(n => `<button type="button" data-min="${n}" aria-pressed="${n === mins}">${n} min</button>`).join('')}</div>
        <p class="nthint">${L('Reason (optional)', 'Powód (opcjonalnie)')}</p>
        ${pairHtml('ntm', false, ['New games and fixes', 'Nowe gry i poprawki'])}
        ${cur.canRestart ? `<label class="ntauto"><input type="checkbox" id="ntm-auto" ${autoOn ? 'checked' : ''}> <span><b>${L('Restart the server by itself at zero', 'Zrestartuj serwer sam przy zerze')}</b><br>${L('Just git pull before then. The code is checked first: if it has an error, the server stays up and tells you here.', 'Wystarczy przedtem zrobić git pull. Kod jest najpierw sprawdzany: jeśli ma błąd, serwer działa dalej i powie ci o tym tutaj.')}</span></label>
        <div data-pull></div>` : ''}
        <button type="button" class="btn" data-nt="maint">${L('Start the countdown', 'Zacznij odliczanie')}</button>
      </div>
      <p class="nthint small">${L('Restarting by hand: git pull, then sudo systemctl restart cozy-table. The server saves everything before it stops; pages say “Back in a moment”, reconnect and reload the new files by themselves. If nobody restarts, the hold lifts by itself 15 minutes after zero.', 'Restart ręczny: git pull, potem sudo systemctl restart cozy-table. Serwer zapisuje wszystko przed zatrzymaniem; strony piszą „Zaraz wracamy…”, same się łączą i wczytują nowe pliki. Jeśli nikt nie zrestartuje, blokada zniknie sama 15 minut po zerze.')}</p>
    </section>
    <section class="ntsec"><h3>📣 ${L('Announcement', 'Ogłoszenie')}</h3>
      <div data-st="ann" hidden></div>
      <p class="nthint">${L('A strip at the top of every screen until you take it down. Players can hide it for themselves.', 'Pasek u góry każdego ekranu, dopóki go nie zdejmiesz. Gracze mogą go u siebie ukryć.')}</p>
      ${pairHtml('nta', false, ['Tournament tonight at 20:00!', 'Turniej dziś o 20:00!'])}
      <button type="button" class="btn" data-nt="ann">${L('Post it', 'Opublikuj')}</button>
    </section>
    <section class="ntsec"><h3>✨ ${L('What’s new', 'Co nowego')}</h3>
      <div data-st="news" hidden></div>
      <p class="nthint">${L('A short note everyone sees once, in a pop-up. Write it during the countdown and it appears after the restart.', 'Krótka notka, którą każdy zobaczy raz, w okienku. Napisz ją w trakcie odliczania, a pojawi się po restarcie.')}</p>
      ${pairHtml('ntn', true, ['Kart Island Race has a new track!', 'W grze Wyspiarskie gokarty jest nowa trasa!'])}
      <div class="row ntrow"><button type="button" class="btn" data-nt="newsnext">${L('Show after the restart', 'Pokaż po restarcie')}</button><button type="button" class="btn w" data-nt="newsnow">${L('Show now', 'Pokaż teraz')}</button></div>
    </section>`;
  const w = sheet = { el: box };
  const stop = () => { if (sheet === w) sheet = null; clearInterval(pollT); box.removeEventListener('click', onClick); };
  clearInterval(pollT); pollT = setInterval(() => deps.send({ t: 'notice' }), 15_000); // notices a git pull while the window is open
  const val = id => ({ pl: w.el.querySelector(`#${id}-pl`).value.trim(), en: w.el.querySelector(`#${id}-en`).value.trim() });
  const clear = id => { w.el.querySelector(`#${id}-pl`).value = ''; w.el.querySelector(`#${id}-en`).value = ''; };
  const need = (v, id) => { if (v.pl || v.en) return true; deps.toast(L('Write the text first, in Polish or English.', 'Najpierw wpisz tekst, po polsku albo po angielsku.'), true); w.el.querySelector(`#${id}-${PL ? 'pl' : 'en'}`).focus(); return false; };
  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.min) { mins = +b.dataset.min; for (const x of w.el.querySelectorAll('[data-min]')) x.setAttribute('aria-pressed', x === b); return; }
    const op = b.dataset.nt; if (!op) return;
    deps.sfx?.click?.();
    if (op === 'maint') { const a = w.el.querySelector('#ntm-auto'); if (a) autoOn = a.checked; deps.send({ t: 'notice', op: 'maint', min: mins, auto: !!a?.checked, ...val('ntm') }); clear('ntm'); }
    else if (op === 'cancel') deps.send({ t: 'notice', op: 'cancel' });
    else if (op === 'ann') { const v = val('nta'); if (!need(v, 'nta')) return; deps.send({ t: 'notice', op: 'ann', ...v }); clear('nta'); LSset('ct_ann_x', ''); }
    else if (op === 'anndown') deps.send({ t: 'notice', op: 'ann' });
    else if (op === 'newsnext' || op === 'newsnow') { const v = val('ntn'); if (!need(v, 'ntn')) return; deps.send({ t: 'notice', op: 'news', when: op === 'newsnow' ? 'now' : 'restart', ...v }); clear('ntn'); }
    else if (op === 'newsclear') deps.send({ t: 'notice', op: 'news', when: 'clear' });
  };
  box.addEventListener('click', onClick);
  paintSheet();
  return stop;
}
