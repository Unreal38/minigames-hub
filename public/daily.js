// Mystery Pet: the page side of the daily guess-the-pet puzzle. The server (server/daily.js) knows the answer and
// marks every guess; this file draws the clue board, the pet picker, the picture hints and today's solvers.
// It loads on demand, because the pet pictures need three.js and the Pet Farm models.
import * as THREE from 'three';
import { petModel } from './games/farm/pets3d.js';
import { disposeModel } from './games/farm/models.js';
import { SPECIES } from './games/farm/data.js';
import { avatarHtml } from './avatar.js';
import { nameHtml, frameCls } from './cosmetics.js';
import { L, PL, cnt, word } from './i18n.js';
import { srvText } from './lang/server.js';
import { emw } from './fit.js';

// The server sends clue headings and values in English: the page says them in its own language.
const CLUE = PL ? (await import('./lang/farm-pl.js')).CLUE_PL : null;
const clueText = v => !CLUE ? v : String(v).split(' + ').map(x => CLUE[x] || x).join(' + ').replace(/^(\d+) of (\d+)$/, '$1 z $2');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- pet pictures ----------
// One small renderer takes a photo of each pet model. Pictures are kept for the whole visit.
const pics = new Map(); let R = null, S = null, C = null;
function photo(sp, form = 2, size = 160) {
  const key = sp + form; if (pics.has(key)) return pics.get(key);
  let url = '';
  try {
    if (!R) {
      R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1);
      S = new THREE.Scene(); C = new THREE.PerspectiveCamera(30, 1, .1, 50);
      S.add(new THREE.HemisphereLight('#ffffff', '#ffe9c9', 1.9)); const l = new THREE.DirectionalLight('#ffffff', 1.6); l.position.set(3, 6, 4); S.add(l);
    }
    const g = petModel(sp, form); R.setSize(size, size, false); S.add(g);
    const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), rad = box.getSize(new THREE.Vector3()).length() / 2;
    const d = rad / Math.sin(15 * Math.PI / 180) * .78;
    C.position.set(ctr.x + d * .5, ctr.y + d * .42, ctr.z + d * .75); C.lookAt(ctr);
    R.render(S, C); url = R.domElement.toDataURL('image/png'); S.remove(g); disposeModel(g);
  } catch (e) { console.warn('no pet picture', e); }
  pics.set(key, url); return url;
}

const MARK = { ok: '✓', near: '≈', no: '✕' }, WORD = { ok: L('right', 'dobrze'), near: L('close', 'blisko'), no: L('wrong', 'źle') }, SQ = { g: '🟩', y: '🟨', r: '🟥' };
const HINT_NAME = [L('Its outline', 'Jego zarys'), L('Its baby form', 'Jego forma malucha'), L('A blurry photo', 'Rozmazane zdjęcie')];
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };

const MIN_Q = 2, SHOW = 8; // letters before any name shows, and how many names at most
const fold = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase().trim();

// host: the element to draw into. api: { send(msg), toast(html, bad), account(mode), close() }
export function mount(host, api) {
  let V = null, got = 0, filter = '', busy = false, alive = true, fresh = '';
  const order = Object.keys(SPECIES).filter(sp => !SPECIES[sp].wheel).sort((a, b) => SPECIES[a].name.localeCompare(SPECIES[b].name));
  host.classList.add('mp');
  host.innerHTML = '<p class="mpload">' + L('Looking for today’s pet…', 'Szukam dzisiejszego zwierzaka…') + '</p>';

  const img = (sp, form = 2, cls = '') => `<img class="mppic ${cls}" data-pic="${sp}:${form}" src="${pics.get(sp + form) || ''}" alt="" width="56" height="56">`;
  // Pictures are made a few at a time so the page never freezes; each one is dropped into place when ready.
  async function develop() {
    for (let n = 0; alive;) {
      const el = [...host.querySelectorAll('img[data-pic]')].find(i => !i.getAttribute('src') && !i.dataset.tried); if (!el) return;
      const [sp, form] = el.dataset.pic.split(':'), url = photo(sp, +form);
      for (const i of host.querySelectorAll(`img[data-pic="${el.dataset.pic}"]`)) { i.dataset.tried = 1; if (url) i.src = url; }
      if (++n % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }

  const cell = (c, label) => `<div class="mpc ${c.s}" aria-label="${esc(clueText(label))}: ${esc(clueText(c.v))}, ${WORD[c.s]}${c.dir ? L(`, the mystery pet is ${c.dir === 'up' ? 'rarer' : 'more common'}`, `, tajemniczy zwierzak jest ${c.dir === 'up' ? 'rzadszy' : 'pospolitszy'}`) : ''}">
    <small>${esc(clueText(label))}</small><b style="--w:${emw(clueText(c.v))}">${esc(clueText(c.v))}${c.dir ? ` <i class="mparrow">${c.dir === 'up' ? '▲' : '▼'}</i>` : ''}</b><i class="mpmark" aria-hidden="true">${MARK[c.s]}</i></div>`;
  const guessRow = (g, i, n) => `<li class="mpg${g.sp === fresh ? ' new' : ''}"><div class="mpwho">${img(g.sp)}<b style="--w:${emw(SPECIES[g.sp]?.name || g.sp)}">${esc(SPECIES[g.sp]?.name || g.sp)}</b>${L(`<small>Guess ${n - i}</small>`, `<small>Próba ${n - i}</small>`)}</div>
    <div class="mpcells">${g.clues.map((c, j) => cell(c, V.cols[j][1])).join('')}</div></li>`;

  function hintsHtml() {
    const wrong = V.guesses.length - (V.done ? 1 : 0);
    return `<div class="mphints">${V.hintsAt.map((at, i) => {
      const open = V.hint > i && V.secret;
      return `<div class="mphint${open ? ' open' : ''}"><div class="mpframe">${open ? img(V.secret, i === 1 ? 0 : 2, V.done ? '' : ['sil', '', 'blur'][i]) : '<span>?</span>'}</div>
        <b>${HINT_NAME[i]}</b><small>${L(`${open ? 'Unlocked' : `${at - wrong} more wrong ${at - wrong === 1 ? 'guess' : 'guesses'}`}`, `${open ? 'Odblokowane' : `jeszcze ${cnt(at - wrong, 'guess', 'guesses', 'błędna próba', 'błędne próby', 'błędnych prób')}`}`)}</small></div>`; }).join('')}</div>`;
  }
  // No list of every pet to click through: the player types at least MIN_Q letters and sees up to SHOW names that fit.
  function pickerHtml() {
    const tried = new Set(V.guesses.map(g => g.sp)), f = fold(filter);
    if (f.length < MIN_Q) return '<p class="mpnone">' + L(`Type at least ${MIN_Q} letters of a pet’s name.`, `Wpisz co najmniej ${MIN_Q} litery nazwy zwierzaka.`) + '</p>';
    const starts = order.filter(sp => fold(SPECIES[sp].name).startsWith(f));
    const inside = f.length >= 3 ? order.filter(sp => !starts.includes(sp) && fold(SPECIES[sp].name).includes(f)) : [];
    const list = [...starts, ...inside].slice(0, SHOW);
    return list.length ? list.map(sp => `<button type="button" class="mppet" data-guess="${sp}" ${tried.has(sp) || busy ? 'disabled' : ''}>${img(sp)}<b style="--w:${emw(SPECIES[sp].name)}">${esc(SPECIES[sp].name)}</b></button>`).join('')
      : '<p class="mpnone">' + L('No pet has a name like that.', 'Żaden zwierzak tak się nie nazywa.') + '</p>';
  }
  function boardHtml() {
    const B = V.board, row = r => `<li class="${r.me ? 'me' : ''}"><span class="mppos">${r.pos}</span>${avatarHtml(r.color, r.av, 34, frameCls(r.fl))}<b>${nameHtml(r.name, r.fl)}${r.me ? ` <small>${L('you', 'ty')}</small>` : r.friend ? ` <small>${L('friend', 'znajomy')}</small>` : ''}</b>
      ${r.streak > 1 ? `<span class="mpfire" title="${L(`${r.streak} days in a row`, `${r.streak} dni z rzędu`)}">🔥 ${r.streak}</span>` : ''}<span class="mpn">${L(`<b>${r.n}</b> ${r.n === 1 ? 'guess' : 'guesses'}</span></li>`, `<b>${r.n}</b> ${word(r.n, 'guess', 'guesses', 'próba', 'próby', 'prób')}</span></li>`)}`;
    return `<section class="mpboard"><h3>${L(`Solved today <small>${B.total} ${B.total === 1 ? 'player' : 'players'}</small>`, `Rozwiązane dziś <small>${cnt(B.total, 'player', 'players', 'gracz', 'graczy', 'graczy')}</small>`)}</h3>
      ${B.rows.length ? `<ol>${B.rows.map(row).join('')}${B.mine ? row(B.mine) : ''}</ol>` : '<p class="mpnone">' + L('Nobody yet. Be the first!', 'Jeszcze nikt. Pierwsze miejsce czeka!') + '</p>'}</section>`;
  }
  const shareText = () => L(`Mystery Pet #${V.no}: solved in ${V.guesses.length} ${V.guesses.length === 1 ? 'guess' : 'guesses'}${V.streak > 1 ? ` · ${V.streak} days in a row` : ''}`, `Zagadkowy zwierzak #${V.no}: ${cnt(V.guesses.length, 'guess', 'guesses', 'próba', 'próby', 'prób')}${V.streak > 1 ? ` · ${V.streak} dni z rzędu` : ''}`) + `\n${V.grid.map(r => [...r].map(c => SQ[c]).join('')).join('\n')}`;

  function paint() {
    if (!V) return;
    const head = `<header class="mphead"><div><h2>${L('Mystery Pet', 'Zagadkowy zwierzak')} <small>#${V.no}</small></h2>
      <p>${L(`One Pet Farm pet is hiding today, the same one for everybody. Guess any pet and the clues show how close you are.`, `Dziś ukrywa się jeden zwierzak z Farmy zwierzaków, ten sam dla wszystkich. Wskaż dowolnego zwierzaka, a wskazówki pokażą, jak blisko jesteś.`)}</p></div>
      <div class="mpstats">${V.guest ? '' : `<span class="mpstat"><b>🔥 ${V.streak}</b>${L(`<small>${V.streak === 1 ? 'day' : 'days'} in a row</small>`, `<small>${word(V.streak, 'day', 'days', 'dzień', 'dni', 'dni')} z rzędu</small>`)}</span><span class="mpstat"><b>${V.total}</b><small>${L(`solved so far`, `rozwiązanych do tej pory`)}</small></span>`}
        <span class="mpstat"><b id="mp-next">${clock(V.next - (Date.now() - got))}</b><small>${L(`until the next pet`, `do następnego zwierzaka`)}</small></span></div></header>`;
    if (V.guest) {
      host.innerHTML = `${head}<div class="mpguest"><p>${L(`<b>Mystery Pet needs an account</b>, so your streak and coins have somewhere to live. It is free and takes a username and a password.`, `<b>Zagadkowy zwierzak wymaga konta</b>, żeby twoja seria i monety miały gdzie mieszkać. Konto jest darmowe: wystarczy nazwa użytkownika i hasło.`)}</p>
        <div class="row"><button type="button" class="btn m" data-acct="register">${L(`Create account`, `Załóż konto`)}</button><button type="button" class="btn w" data-acct="login">${L(`Log in`, `Zaloguj się`)}</button></div></div>${boardHtml()}`;
      return develop();
    }
    const n = V.guesses.length, d = SPECIES[V.secret] || {};
    const top = V.done
      ? `<section class="mpwin"><div class="mpframe big">${img(V.secret, 2)}</div><div><h3>${L(`It was ${esc(d.name)}!`, `To ${esc(d.name)}!`)}</h3><p>${esc(d.blurb || '')}</p>
          <p class="mpgot">${L(`Solved in <b>${n}</b> ${n === 1 ? 'guess' : 'guesses'} · <b>+${V.won}</b> coins · 🔥 <b>${V.streak}</b> ${V.streak === 1 ? 'day' : 'days'} in a row${V.best >= 7 ? '' : ` · ${7 - Math.min(7, V.streak)} more for the “Pet Detective” title`}`, `Rozwiązane: <b>${n}</b> ${word(n, 'guess', 'guesses', 'próba', 'próby', 'prób')} · <b>+${V.won}</b> ${word(V.won, 'coin', 'coins', 'moneta', 'monety', 'monet')} · 🔥 <b>${V.streak}</b> ${word(V.streak, 'day', 'days', 'dzień', 'dni', 'dni')} z rzędu${V.best >= 7 ? '' : ` · jeszcze ${7 - Math.min(7, V.streak)} do tytułu „Detektyw od zwierzaków”`}`)}</p>
          <div class="row"><button type="button" class="btn m" data-share ${V.shared ? 'disabled' : ''}>${L(`${V.shared ? 'Posted in the chat' : 'Post result in the chat'}`, `${V.shared ? 'Wysłane na czat' : 'Wyślij wynik na czat'}`)}</button><button type="button" class="btn w" data-copy>${L(`Copy result`, `Skopiuj wynik`)}</button></div>
          <pre class="mpgrid" aria-label="${L(`Your result, without spoilers`, `Twój wynik, bez spoilerów`)}">${V.grid.map(r => [...r].map(c => `<i class="${c}"></i>`).join('')).join('\n')}</pre></div></section>`
      : `<section class="mpplay">${hintsHtml()}
          <div class="mpfind"><label for="mp-q">${L(`Your guess${n ? ` number ${n + 1}` : ''} <small>Solving it now pays ${V.pay} coins.</small>`, `Twoja próba${n ? ` numer ${n + 1}` : ''} <small>Rozwiązanie teraz daje ${cnt(V.pay, 'coin', 'coins', 'monetę', 'monety', 'monet')}.</small>`)}</label>
            <input id="mp-q" class="field" type="search" placeholder="${L(`Type a pet’s name`, `Wpisz nazwę zwierzaka`)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" value="${esc(filter)}"></div>
          <div class="mppick" id="mp-pick">${pickerHtml()}</div></section>`;
    const rows = n ? `<section class="mprows"><div class="mplegend"><span class="mpc ok">${L(`✓ right</span>`, `✓ dobrze</span>`)}<span class="mpc near">${L(`≈ close</span>`, `≈ blisko</span>`)}<span class="mpc no">${L(`✕ wrong</span>`, `✕ źle</span>`)}<span>${L(`▲ the mystery pet is rarer · ▼ more common`, `▲ tajemniczy zwierzak jest rzadszy · ▼ pospolitszy`)}</span></div>
        <ol class="mplist">${[...V.guesses].reverse().map((g, i) => guessRow(g, i, n)).join('')}</ol></section>`
      : `<p class="mpnone mpfirst">${L(`No guesses yet. Any pet is a good start: the clues tell you its element, where it lives, how rare it is, how it fights, its colour and how many moves it shares with today’s pet.`, `Nie ma jeszcze prób. Każdy zwierzak jest dobry na początek: wskazówki mówią o jego żywiole, miejscu, w którym mieszka, rzadkości, stylu walki, kolorze i o tym, ile ruchów dzieli z dzisiejszym zwierzakiem.`)}</p>`;
    const keep = document.activeElement?.id === 'mp-q';
    host.innerHTML = head + top + rows + boardHtml();
    if (keep) { const q = host.querySelector('#mp-q'); q?.focus(); q?.setSelectionRange(filter.length, filter.length); }
    develop();
  }

  host.addEventListener('input', e => {
    if (e.target.id !== 'mp-q') return;
    filter = e.target.value; const box = host.querySelector('#mp-pick'); if (box) { box.innerHTML = pickerHtml(); develop(); }
  });
  host.addEventListener('keydown', e => { // Enter guesses when the name narrows it down to one pet
    if (e.target.id !== 'mp-q' || e.key !== 'Enter') return;
    const open = [...host.querySelectorAll('#mp-pick [data-guess]:not(:disabled)')]; if (open.length === 1) open[0].click();
  });
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.guess && !busy) { busy = true; filter = ''; fresh = b.dataset.guess; api.send({ t: 'daily', guess: b.dataset.guess }); host.querySelectorAll('[data-guess]').forEach(x => x.disabled = true); }
    else if (b.dataset.acct) { api.close(); api.account(b.dataset.acct); }
    else if (b.hasAttribute('data-share')) { b.disabled = true; api.send({ t: 'daily', share: true }); }
    else if (b.hasAttribute('data-copy')) navigator.clipboard?.writeText(shareText()).then(() => api.toast(L('Result copied. Paste it anywhere.', 'Wynik skopiowany. Wklej go, gdzie chcesz.')), () => api.toast(L('Could not copy on this browser.', 'W tej przeglądarce nie udało się skopiować.'), true));
  });
  const tick = setInterval(() => {
    if (!V) return;
    const left = V.next - (Date.now() - got), el = host.querySelector('#mp-next');
    if (left <= 0) { V.next = Infinity; api.send({ t: 'daily' }); } else if (el && Number.isFinite(left)) el.textContent = clock(left);
  }, 1000);

  api.send({ t: 'daily' });
  return {
    msg(m) {
      const newDay = V && m.day !== V.day;
      V = m; got = Date.now(); busy = false;
      if (m.err) api.toast(esc(srvText(m.err)), true);
      if (m.solved) api.toast(L(`🎉 Solved! +${m.solved.coins} coins${m.solved.xp ? ` · +${m.solved.xp} XP` : ''}${m.solved.newTitle ? ' · new title unlocked: Pet Detective' : ''}`, `🎉 Rozwiązane! +${cnt(m.solved.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}${m.solved.xp ? ` · +${m.solved.xp} XP` : ''}${m.solved.newTitle ? ' · nowy tytuł: Detektyw od zwierzaków' : ''}`));
      if (m.sharedNow) api.toast(L('Posted in the hub chat.', 'Wysłane na czat Zatoki.'));
      if (newDay) { filter = ''; api.toast(L('A new Mystery Pet is here!', 'Jest nowy Zagadkowy zwierzak!')); }
      paint(); fresh = '';
      if (m.solved) host.closest('.sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    destroy() { alive = false; clearInterval(tick); },
  };
}
