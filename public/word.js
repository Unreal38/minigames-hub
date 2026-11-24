// Word in a Bottle: the page side of the daily word puzzle. The server (server/word.js) keeps the word and marks
// every try; this file draws the board, the on-screen keyboard (with Polish letters), the stats and the result.
// Marks are told apart by shape as well as colour: a filled blue square (right spot), an orange circle (in the
// word, other spot) and a dashed grey tile (not in the word).
import { L, cnt, word as form } from './i18n.js';
import { srvText } from './lang/server.js';
import { myBurst } from './winfx.js';
import { sfx } from './sfx.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAME = L('Word in a Bottle', 'Słowo w butelce');
const LANG_NAME = { pl: 'Polski', en: 'English' };
const KEYS = {
  pl: ['ą ć ę ł ń ó ś ź ż', 'w e r t y u i o p', 'a s d f g h j k l', 'ENTER z c b n m DEL'],
  en: ['q w e r t y u i o p', 'a s d f g h j k l', 'ENTER z x c v b n m DEL'],
};
const ABC = Object.fromEntries(Object.entries(KEYS).map(([k, rows]) => [k, new Set(rows.join(' ').split(' ').filter(x => x.length === 1))]));
const MARK_WORD = { h: L('right spot', 'dobre miejsce'), n: L('in the word, other spot', 'jest w słowie, inne miejsce'), m: L('not in the word', 'nie ma w słowie') };
const SQ = { h: '🟦', n: '🟠', m: '⚪' }, RANK = { m: 1, n: 2, h: 3 };
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };

// host: the element to draw into. api: { send(msg), toast(html, bad), account(mode), close(), lang: 'pl' | 'en' }
export function mount(host, api) {
  let V = null, got = 0, lang = api.lang === 'en' ? 'en' : 'pl', cur = [], busy = false, note = '', flip = -1, burstT = 0;
  host.classList.add('wb');
  host.innerHTML = `<p class="wbload">${L('Uncorking today’s bottle…', 'Odkorkowuję dzisiejszą butelkę…')}</p>`;
  const S = () => V?.L?.[lang];

  const tile = (ch, m, i, anim) => `<span class="wbt${m ? ' ' + m : ch ? ' on' : ''}${anim ? ' flip' : ''}" style="--i:${i}"${m ? ` aria-label="${esc(ch.toUpperCase())}: ${MARK_WORD[m]}"` : ''}>${esc(ch)}</span>`;
  function boardHtml() {
    const s = S(), rows = [];
    for (let r = 0; r < (s.done ? s.rows.length : V.tries); r++) { // a finished board keeps only the rows that were used
      const done = s.rows[r], active = !s.done && r === s.rows.length;
      const cells = Array.from({ length: V.len }, (_, i) => done ? tile([...done.w][i], done.m[i], i, r === flip) : tile(active ? cur[i] || '' : '', '', i));
      rows.push(`<div class="wbrow${active ? ' act' : ''}" role="group" aria-label="${L(`Try ${r + 1}`, `Próba ${r + 1}`)}">${cells.join('')}</div>`);
    }
    return rows.join('');
  }
  function keysHtml() {
    const best = {};
    for (const row of S().rows) [...row.w].forEach((ch, i) => { if ((RANK[row.m[i]] || 0) > (RANK[best[ch]] || 0)) best[ch] = row.m[i]; });
    return KEYS[lang].map(r => `<div class="wbkr">${r.split(' ').map(k => k === 'ENTER' ? `<button type="button" class="wbkey wide go" data-key="ENTER">${L('Enter', 'Enter')}</button>`
      : k === 'DEL' ? `<button type="button" class="wbkey wide" data-key="DEL" aria-label="${L('Delete a letter', 'Usuń literę')}">⌫</button>`
      : `<button type="button" class="wbkey ${best[k] || ''}" data-key="${k}"${best[k] ? ` aria-label="${k.toUpperCase()}: ${MARK_WORD[best[k]]}"` : ''}>${k}</button>`).join('')}</div>`).join('');
  }
  const legend = () => `<div class="wblegend" aria-hidden="true"><span><i class="wbt h">A</i>${L('right spot', 'dobre miejsce')}</span><span><i class="wbt n">B</i>${L('other spot', 'inne miejsce')}</span><span><i class="wbt m">C</i>${L('not in the word', 'nie ma w słowie')}</span></div>`;
  const shareText = () => { const s = S(); return `${NAME} #${V.no} (${lang.toUpperCase()}) ${s.won ? s.rows.length : 'X'}/${V.tries}${s.won && s.streak > 1 ? ` · 🔥 ${s.streak}` : ''}\n${s.rows.map(r => [...r.m].map(c => SQ[c]).join('')).join('\n')}\nzatokagier.com`; };

  function resultHtml() {
    const s = S(), n = s.rows.length, other = lang === 'pl' ? 'en' : 'pl', top = Math.max(1, ...s.dist), pct = s.played ? Math.round(100 * s.wins / s.played) : 0;
    const stat = (v, label) => `<span class="wbstat"><b>${v}</b><small>${label}</small></span>`;
    return `<section class="wbres${flip >= 0 ? ' late' : ''}">
      <h3>${s.won ? L('Solved!', 'Rozwiązane!') : L('Not this time', 'Nie tym razem')}</h3>
      <p class="wbans">${L('Today’s word:', 'Dzisiejsze słowo:')} <b>${esc(s.answer)}</b></p>
      <p class="wbgot">${s.won ? L(`In <b>${n}</b> of ${V.tries} tries · <b>+${s.got}</b> ${s.got === 1 ? 'coin' : 'coins'}${s.streak > 1 ? ` · 🔥 <b>${s.streak}</b> days in a row` : ''}`, `Prób: <b>${n}</b> z ${V.tries} · <b>+${s.got}</b> ${form(s.got, 'coin', 'coins', 'moneta', 'monety', 'monet')}${s.streak > 1 ? ` · 🔥 <b>${s.streak}</b> dni z rzędu` : ''}`)
        : L(`<b>+${s.got}</b> ${s.got === 1 ? 'coin' : 'coins'} for trying · a new bottle washes up at midnight.`, `<b>+${s.got}</b> ${form(s.got, 'coin', 'coins', 'moneta', 'monety', 'monet')} za próbę · o północy morze wyrzuci nową butelkę.`)}</p>
      <div class="wbstats4">${stat(s.played, L('played', 'rozegrane'))}${stat(pct + '%', L('solved', 'rozwiązane'))}${stat('🔥 ' + s.streak, L('in a row', 'z rzędu'))}${stat(s.best, L('best streak', 'najdłuższa seria'))}</div>
      <div class="wbdist" aria-label="${L('How many tries your solved words took', 'Ile prób zajęły rozwiązane słowa')}">${s.dist.map((c, i) => `<div class="wbbar${s.won && i === n - 1 ? ' now' : ''}"><span>${i + 1}</span><i style="--p:${Math.round(100 * c / top)}%"><b>${c}</b></i></div>`).join('')}</div>
      <div class="row wbbtns"><button type="button" class="btn m" data-share ${s.shared ? 'disabled' : ''}>${s.shared ? L('Posted in the chat', 'Wysłane na czat') : L('Post result in the chat', 'Wyślij wynik na czat')}</button><button type="button" class="btn w" data-copy>${L('Copy result', 'Skopiuj wynik')}</button></div>
      ${V.L[other].done ? '' : `<button type="button" class="btn sm w wbother" data-lang="${other}">${other === 'en' ? L('Now the English word', 'Teraz słowo po angielsku') : L('Now the Polish word', 'Teraz słowo po polsku')}</button>`}
    </section>`;
  }

  function paint() {
    if (!V) return;
    const s = S();
    const head = `<header class="wbhead"><div><h2>${NAME} <small>#${V.no}</small></h2>
      <p>${L(`Every day the sea brings a bottle with one five-letter word, the same for everybody. You have ${V.tries} tries.`, `Codziennie morze przynosi butelkę z jednym słowem na pięć liter, tym samym dla wszystkich. Masz ${V.tries} prób.`)}</p></div>
      <div class="wbpills">${V.guest ? '' : `<span class="wbstat"><b>🔥 ${s.streak}</b><small>${L(`${s.streak === 1 ? 'day' : 'days'} in a row`, `${form(s.streak, 'day', 'days', 'dzień', 'dni', 'dni')} z rzędu`)}</small></span>`}
        <span class="wbstat"><b id="wb-next">${clock(V.next - (Date.now() - got))}</b><small>${L('until the next word', 'do następnego słowa')}</small></span></div></header>`;
    if (V.guest) {
      host.innerHTML = `${head}<div class="wbguest"><p>${L(`<b>${NAME} needs an account</b>, so your streak and coins have somewhere to live. It is free and takes a username and a password.`, `<b>${NAME} wymaga konta</b>, żeby twoja seria i monety miały gdzie mieszkać. Konto jest darmowe: wystarczy nazwa użytkownika i hasło.`)}</p>
        <div class="row"><button type="button" class="btn m" data-acct="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn w" data-acct="login">${L('Log in', 'Zaloguj się')}</button></div></div>${legend()}`;
      return;
    }
    host.classList.toggle('playing', !s.done);
    const tabs = `<div class="wbtabs" role="tablist">${Object.keys(KEYS).map(k => { const x = V.L[k]; return `<button type="button" role="tab" aria-selected="${k === lang}" data-lang="${k}">${LANG_NAME[k]}${x.done ? `<i>${x.won ? '✓' : '✕'}</i>` : x.rows.length ? `<i>${x.rows.length}/${V.tries}</i>` : ''}</button>`; }).join('')}</div>`;
    const pay = s.done ? '' : `<p class="wbpay">${L(`Solving it on this try pays ${cnt(s.pay, 'coin')}.`, `Rozwiązanie w tej próbie daje ${cnt(s.pay, 'coin', 'coins', 'monetę', 'monety', 'monet')}.`)}</p>`;
    host.innerHTML = `${head}${tabs}<div class="wbplay"><div class="wbboard" lang="${lang}">${boardHtml()}</div>
      <p class="wbnote" role="status">${esc(note)}</p>
      ${s.done ? resultHtml() : `<div class="wbkb" lang="${lang}">${keysHtml()}</div>${pay}`}${legend()}</div>`;
  }
  // Typing only touches the open row, so the tiles above never replay their flip.
  function paintCur() {
    const row = host.querySelector('.wbrow.act'); if (!row) return;
    [...row.children].forEach((el, i) => { el.textContent = cur[i] || ''; el.classList.toggle('on', !!cur[i]); });
  }
  function say(text, shake) {
    note = text; const el = host.querySelector('.wbnote'); if (el) el.textContent = text;
    const row = host.querySelector('.wbrow.act');
    if (shake && row) { row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); sfx.bad(); }
  }
  function press(k) {
    const s = S(); if (!s || s.done || busy) return;
    if (k === 'ENTER') {
      if (cur.length < V.len) return say(L('The word needs five letters.', 'Słowo musi mieć pięć liter.'), true);
      busy = true; api.send({ t: 'word', lang, guess: cur.join('') });
    } else if (k === 'DEL') { if (cur.length) { cur.pop(); paintCur(); if (note) say(''); } }
    else if (ABC[lang].has(k) && cur.length < V.len) { cur.push(k); sfx.tick(); paintCur(); if (note) say(''); }
  }
  const setLang = l => { if (l === lang || !KEYS[l]) return; lang = l; cur = []; note = ''; flip = -1; sfx.click(); paint(); };

  const onKey = e => {
    if (!V || V.guest || e.metaKey || (e.ctrlKey && !e.altKey)) return; // AltGr (Ctrl+Alt) types the Polish letters
    const t = e.target, isKey = t?.classList?.contains('wbkey');
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName)) return;
    if (e.key === 'Enter') { if (t?.tagName === 'BUTTON' && !isKey) return; e.preventDefault(); press('ENTER'); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('DEL'); }
    else if ([...e.key].length === 1) { const k = e.key.toLocaleLowerCase('pl'); if (ABC[lang].has(k)) { e.preventDefault(); press(k); } }
  };
  document.addEventListener('keydown', onKey);
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.key) { press(b.dataset.key); b.blur(); }
    else if (b.dataset.lang) setLang(b.dataset.lang);
    else if (b.dataset.acct) { api.close(); api.account(b.dataset.acct); }
    else if (b.hasAttribute('data-share')) { b.disabled = true; api.send({ t: 'word', lang, share: true }); }
    else if (b.hasAttribute('data-copy')) navigator.clipboard?.writeText(shareText()).then(() => api.toast(L('Result copied. Paste it anywhere.', 'Wynik skopiowany. Wklej go, gdzie chcesz.')), () => api.toast(L('Could not copy on this browser.', 'W tej przeglądarce nie udało się skopiować.'), true));
  });
  const tick = setInterval(() => {
    if (!V) return;
    const left = V.next - (Date.now() - got), el = host.querySelector('#wb-next');
    if (left <= 0) { V.next = Infinity; api.send({ t: 'word' }); } else if (el && Number.isFinite(left)) el.textContent = clock(left);
  }, 1000);

  api.send({ t: 'word' });
  return {
    msg(m) {
      const newDay = V && m.day !== V.day;
      V = m; got = Date.now(); busy = false; flip = -1;
      if (m.guest) return paint();
      if (m.lang && KEYS[m.lang]) lang = m.lang;
      if (newDay) { cur = []; note = ''; api.toast(L('A new bottle has washed up!', 'Morze wyrzuciło nową butelkę!')); }
      if (m.err) api.toast(esc(srvText(m.err)), true);
      if (m.sharedNow) api.toast(L('Posted in the hub chat.', 'Wysłane na czat Zatoki.'));
      if (m.bad) { paint(); paintCur(); return say(m.bad === 'twice' ? L('You already tried that word.', 'To słowo już było.') : m.bad === 'short' ? L('The word needs five letters.', 'Słowo musi mieć pięć liter.') : L('That word is not in the dictionary.', 'Tego słowa nie ma w słowniku.'), true); }
      if (m.fresh) { cur = []; note = ''; flip = S().rows.length - 1; sfx.set(); }
      if (m.over) {
        clearTimeout(burstT);
        burstT = setTimeout(() => {
          if (m.over.won) { sfx.win(); myBurst(); api.toast(L(`🎉 Solved! +${cnt(m.over.coins, 'coin')}`, `🎉 Rozwiązane! +${cnt(m.over.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}`)); } else { sfx.lose(); if (m.over.coins) api.toast(L(`+${cnt(m.over.coins, 'coin')} for trying`, `+${cnt(m.over.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')} za próbę`)); }
        }, 1500);
      }
      paint();
    },
    destroy() { clearInterval(tick); clearTimeout(burstT); document.removeEventListener('keydown', onKey); },
  };
}
