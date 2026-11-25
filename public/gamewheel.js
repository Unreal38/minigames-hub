// Koło gier / Game wheel: a hub pop-up that spins a flat wheel of games to pick what to play next.
// It only picks. It never pays anything (no coins, no XP, no prizes), so it can be spun as often as anyone likes.
// The flat card-art look (brown 3px outline, one coloured slice per game) is on purpose: the daily Lucky Wheel is a
// 3D blocky wheel with prizes and this one must never be mistaken for it.
// What is on the wheel, the two filters and the saved wheels live on the profile (p.gw, message {t:'gwheel'}), like
// saved outfits, so they follow an account to other devices. The server checks it in store.setGameWheel.
import { L } from './i18n.js';
import { sfx } from './sfx.js';

export const GW_SAVED = 8, GW_NAME = 20; // the same limits as setGameWheel in server/store.js
const PAL = ['#ffc63d', '#ff7f6b', '#8be0c4', '#7fb2ff', '#c69cff', '#ffa94d', '#f582b8', '#a6dd6a'];
const SHORT = 15; // the "under 15 min" filter: the longest usual game length allowed
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The little wheel on the hub button.
export const GW_ICON = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21" r="16" fill="#fff" stroke="#3b2219" stroke-width="3"/>${[0, 1, 2, 3, 4, 5].map(i => {
  const a1 = i * Math.PI / 3 - Math.PI / 2, a2 = a1 + Math.PI / 3, p = a => `${(20 + 13.5 * Math.cos(a)).toFixed(2)} ${(21 + 13.5 * Math.sin(a)).toFixed(2)}`;
  return `<path d="M20 21L${p(a1)}A13.5 13.5 0 0 1 ${p(a2)}Z" fill="${PAL[i]}"/>`;
}).join('')}<circle cx="20" cy="21" r="4" fill="#fff" stroke="#3b2219" stroke-width="2"/><path d="M14.5 2.5h11L20 11z" fill="#ff7f6b" stroke="#3b2219" stroke-width="2" stroke-linejoin="round"/></svg>`;

// '1–6 players', 'Co-op · 1–4', '2–8 players' -> [min, max] people
const seatRange = s => { const n = (String(s).match(/\d+/g) || [1]).map(Number); return [Math.min(...n), Math.max(...n)]; };

// games: [{ id, name, cat, seats, mins, pic, art }] in hub order
export function openGameWheel({ games, saved, save, modal, host }) {
  const byId = Object.fromEntries(games.map(g => [g.id, { ...g, range: seatRange(g.seats) }]));
  const known = id => !!byId[id];
  const party = games.filter(g => g.cat.split(' ').includes('party')).map(g => g.id);
  const s = {
    cur: Array.isArray(saved?.cur) ? saved.cur.filter(known) : party,
    n: Number.isInteger(saved?.n) ? saved.n : 0, // 0 = the "fits N people" filter is off
    q: !!saved?.q, // the "under 15 min" filter
    w: Array.isArray(saved?.w) ? saved.w.map(w => ({ n: String(w.n || ''), g: (w.g || []).filter(known) })) : [],
  };
  let lastN = s.n || 4, rot = 0, spinning = false, naming = false, won = null, saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => save({ cur: s.cur, n: s.n, q: s.q, w: s.w }), 500); };
  // why a ticked game is left off the wheel right now ('' = it is on)
  const why = g => {
    if (s.n && (s.n < g.range[0] || s.n > g.range[1])) return g.range[0] === g.range[1] ? `${g.range[0]}` : `${g.range[0]}–${g.range[1]}`;
    if (s.q && g.mins && g.mins[1] > SHORT) return `${g.mins[0]}–${g.mins[1]} min`;
    return '';
  };
  const onWheel = () => s.cur.filter(id => byId[id] && !why(byId[id]));
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  const m = modal(`<div class="gw">
    <div class="gwhead"><h2>${L('Game wheel', 'Koło gier')}</h2><span class="gwbadge">${L('Free · spin as often as you like', 'Za darmo · kręć, ile chcesz')}</span></div>
    <div class="gwbody">
      <div class="gwleft"><div class="gwwheel"></div><button type="button" class="btn gwspin" data-gw="spin">${L('Spin!', 'Zakręć!')}</button><div class="gwwin" hidden></div></div>
      <div class="gwside"></div>
    </div></div>`);
  m.el.querySelector('.sheet').classList.add('gwsheet');
  const $ = q => m.el.querySelector(q);
  m.onClose = () => { clearTimeout(saveT); if (saveT) save({ cur: s.cur, n: s.n, q: s.q, w: s.w }); };

  function wheelSvg(ids) {
    const n = ids.length, R = 100, step = 360 / Math.max(n, 1);
    const pt = (a, r) => `${(r * Math.cos(a * Math.PI / 180)).toFixed(2)} ${(r * Math.sin(a * Math.PI / 180)).toFixed(2)}`;
    let body = '';
    if (n < 2) body = `<circle r="${R}" fill="var(--gw-empty)"/><text text-anchor="middle" dominant-baseline="middle" y="-34" font-size="11" font-weight="800" fill="var(--gw-empty-tx)">${esc(L('Tick at least 2 games', 'Zaznacz co najmniej 2 gry'))}</text>`;
    else ids.forEach((id, i) => {
      const a1 = i * step - 90 - step / 2, a2 = a1 + step;
      body += `<path d="M0 0L${pt(a1, R)}A${R} ${R} 0 0 1 ${pt(a2, R)}Z" fill="${i && i === n - 1 && i % PAL.length === 0 ? PAL[2] : PAL[i % PAL.length]}" stroke="#3b2219" stroke-width="1.6"/>`; // the last slice never matches the first
      const mid = i * step - 90, fs = n > 30 ? 5.6 : n > 20 ? 6.6 : n > 14 ? 7.6 : n > 9 ? 9 : 10.5, name = byId[id].name;
      const fit = name.length * fs * .58 > 64 ? ' textLength="64" lengthAdjust="spacingAndGlyphs"' : '';
      const a = ((mid % 360) + 360) % 360, flip = a > 90 && a < 270; // left half: turned round so no name is upside down
      body += flip ? `<text transform="rotate(${mid + 180}) translate(-91 0)" text-anchor="start"${fit} font-size="${fs}">${esc(name)}</text>`
        : `<text transform="rotate(${mid}) translate(91 0)" text-anchor="end"${fit} font-size="${fs}">${esc(name)}</text>`;
    });
    const pegs = n >= 2 && n <= 24 ? ids.map((_, i) => { const [x, y] = pt(i * step - 90 - step / 2, 104.5).split(' '); return `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="#3b2219" stroke-width="1.2"/>`; }).join('') : '';
    return `<svg viewBox="-118 -124 236 242" role="img" aria-label="${esc(L('Game wheel', 'Koło gier'))}">
      <circle r="111" fill="#5b3a8c" stroke="#3b2219" stroke-width="3.2"/>
      <g class="gwrot" transform="rotate(${rot})" font-family="Rubik, sans-serif" font-weight="800" fill="#1d1430" dominant-baseline="middle">${body}${pegs}</g>
      <circle r="${R}" fill="none" stroke="#3b2219" stroke-width="3"/>
      <circle r="16" fill="#fff" stroke="#3b2219" stroke-width="3"/>${[[-5, -5], [5, 5], [0, 0], [5, -5], [-5, 5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#3b2219"/>`).join('')}
      <path d="M-11 -123h22l-11 23z" fill="#ff7f6b" stroke="#3b2219" stroke-width="3" stroke-linejoin="round"/></svg>`;
  }
  const paintWheel = () => {
    const ids = onWheel();
    $('.gwwheel').innerHTML = wheelSvg(ids);
    const b = $('.gwspin'); b.disabled = spinning || ids.length < 2;
  };

  function paintSide() {
    const ids = onWheel(), cats = [['party', L('Party', 'Imprezowe')], ['cards', L('Cards', 'Karciane')], ['board', L('Board', 'Planszowe')], ['action', L('Action', 'Zręcznościowe')]];
    const active = s.w.findIndex(w => sameSet(w.g, s.cur));
    $('.gwside').innerHTML = `
      <h4>${L('Your wheels', 'Twoje koła')}</h4>
      <div class="gwsaved">${s.w.map((w, i) => `<span class="gwchip${i === active ? ' on' : ''}"><button type="button" data-gw="load" data-i="${i}">${esc(w.n)} <i>${w.g.length}</i></button>${i === active ? `<button type="button" class="gwdel" data-gw="del" data-i="${i}" aria-label="${esc(L('Delete this wheel', 'Usuń to koło'))}" title="${esc(L('Delete this wheel', 'Usuń to koło'))}">✕</button>` : ''}</span>`).join('')}
        ${naming ? `<form class="gwname" data-gw="name"><input class="field" maxlength="${GW_NAME}" placeholder="${esc(L('Name, e.g. Friday night', 'Nazwa, np. Piątek'))}" aria-label="${esc(L('Wheel name', 'Nazwa koła'))}" required><button class="btn sm">${L('Save', 'Zapisz')}</button></form>`
          : s.w.length < GW_SAVED && active < 0 && s.cur.length ? `<button type="button" class="gwchip add" data-gw="new">+ ${L('Save this wheel', 'Zapisz to koło')}</button>` : ''}
        ${!s.w.length && !naming ? `<span class="gwhint">${L('Save the games you like together as a wheel for next time.', 'Zapisz ulubiony zestaw gier jako koło na następny raz.')}</span>` : ''}</div>
      <h4>${L('Fill quickly', 'Szybko wypełnij')}</h4>
      <div class="gwpills">${cats.map(([c, n]) => `<button type="button" data-gw="cat" data-cat="${c}">${n}</button>`).join('')}<button type="button" data-gw="cat" data-cat="all">${L('All', 'Wszystkie')}</button><button type="button" data-gw="cat" data-cat="none">${L('Clear', 'Wyczyść')}</button></div>
      <div class="gwfilt">
        <span class="gwtog${s.n ? ' on' : ''}"><button type="button" data-gw="ntog" aria-pressed="${!!s.n}">👥 ${L('Fits', 'Pasuje dla')}</button><button type="button" data-gw="n-" aria-label="${esc(L('Fewer people', 'Mniej osób'))}">−</button><b>${s.n || lastN}</b><button type="button" data-gw="n+" aria-label="${esc(L('More people', 'Więcej osób'))}">+</button></span>
        <button type="button" class="gwtog${s.q ? ' on' : ''}" data-gw="q" aria-pressed="${s.q}">⏱ ${L(`Up to ${SHORT} min`, `Do ${SHORT} min`)}</button>
      </div>
      <h4>${L('On the wheel', 'Na kole')} · ${ids.length} / ${games.length}</h4>
      <div class="gwlist">${games.map(g => { const on = s.cur.includes(g.id), off = on && why(byId[g.id]);
        return `<label class="${on ? (off ? 'out' : 'on') : ''}"><input type="checkbox" data-gw="tick" data-id="${g.id}"${on ? ' checked' : ''}><span>${esc(g.name)}</span>${off ? `<em>${esc(off)}</em>` : ''}</label>`; }).join('')}</div>
      <p class="gwnote">${L('Saved with your profile. The wheel never pays coins, it only picks a game.', 'Zapisuje się w profilu. Koło nie daje monet, tylko wybiera grę.')}</p>`;
    if (naming) setTimeout(() => $('.gwname input')?.focus(), 0);
  }
  const paint = () => { paintWheel(); paintSide(); };

  // One spin: the winner is picked first (fairly, every slice the same size), then the wheel is turned to land on it,
  // somewhere inside its slice, after a few full turns. One SVG transform per frame, ticking as each peg passes.
  function spin() {
    const ids = onWheel(); if (spinning || ids.length < 2) return;
    const r = new Uint32Array(2); crypto.getRandomValues(r);
    const i = r[0] % ids.length, step = 360 / ids.length, off = ((r[1] / 2 ** 32) - .5) * step * .7;
    const quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = rot, base = -i * step + off, turns = quick ? 1 : 5;
    let to = base + 360 * Math.ceil((from - base) / 360); to += 360 * turns; // always forward (clockwise)
    if (to - from < 360 * turns) to += 360;
    const dur = quick ? 900 : 4200, t0 = performance.now(), g = $('.gwrot');
    spinning = true; won = null; $('.gwwin').hidden = true; $('.gwspin').disabled = true; sfx.whoosh();
    let lastPeg = Math.floor((from + step / 2) / step);
    const frame = now => {
      if (!m.el.isConnected) return;
      const t = Math.min(1, (now - t0) / dur), e = 1 - (1 - t) ** 4;
      rot = from + (to - from) * e; g.setAttribute('transform', `rotate(${rot.toFixed(2)})`);
      const peg = Math.floor((rot + step / 2) / step); if (peg !== lastPeg) { lastPeg = peg; if (ids.length <= 40) sfx.tick(); }
      if (t < 1) return requestAnimationFrame(frame);
      rot = to % 360; g.setAttribute('transform', `rotate(${rot.toFixed(2)})`); spinning = false;
      showWin(ids[i]);
    };
    requestAnimationFrame(frame);
  }
  function showWin(id) {
    won = id; const g = byId[id]; sfx.set();
    const box = $('.gwwin'); box.hidden = false;
    box.innerHTML = `<div class="gcard gwcard"><div class="pic ${g.pic}">${g.art()}</div><div class="body">
      <small>${L('The wheel picked', 'Koło wybrało')}</small><h3>${esc(g.name)}</h3>
      <div class="gwmeta">${esc(g.seatsText)}${g.mins ? ` · ${g.mins[0] === g.mins[1] ? `~${g.mins[0]}` : `${g.mins[0]}–${g.mins[1]}`} min` : ''}</div>
      <button type="button" class="btn gwgo" data-gw="host">${L('Host a table', 'Załóż stół')}</button>
      <div class="gwrow"><button type="button" class="btn sm w" data-gw="again">${L('Spin again', 'Kręć jeszcze raz')}</button><button type="button" class="btn sm w" data-gw="drop">${L('Remove & spin', 'Usuń i kręć')}</button></div></div></div>`;
    $('.gwrow [data-gw="drop"]').disabled = onWheel().length < 3;
    paintWheel(); $('.gwspin').disabled = true; box.querySelector('.gwgo').focus({ preventScroll: true });
  }
  const changed = () => { won = null; $('.gwwin').hidden = true; persist(); paint(); };

  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-gw]'); if (!b || b.matches('form, input')) return;
    const a = b.dataset.gw;
    if (a === 'spin' || a === 'again') return spin();
    if (spinning) return;
    sfx.click();
    if (a === 'host') { const id = won; m.close(); return host(id); }
    if (a === 'drop') { s.cur = s.cur.filter(x => x !== won); won = null; persist(); paint(); return spin(); }
    if (a === 'cat') s.cur = b.dataset.cat === 'none' ? [] : games.filter(g => b.dataset.cat === 'all' || g.cat.split(' ').includes(b.dataset.cat)).map(g => g.id);
    else if (a === 'load') s.cur = s.w[+b.dataset.i].g.slice();
    else if (a === 'del') s.w.splice(+b.dataset.i, 1);
    else if (a === 'new') { naming = true; return paintSide(); }
    else if (a === 'ntog') s.n = s.n ? 0 : lastN;
    else if (a === 'n-' || a === 'n+') { lastN = Math.max(1, Math.min(10, (s.n || lastN) + (a === 'n+' ? 1 : -1))); s.n = lastN; }
    else if (a === 'q') s.q = !s.q;
    else return;
    changed();
  });
  m.el.addEventListener('change', e => {
    const c = e.target.closest('[data-gw="tick"]'); if (!c || spinning) return;
    const id = c.dataset.id; s.cur = c.checked ? games.map(g => g.id).filter(x => x === id || s.cur.includes(x)) : s.cur.filter(x => x !== id);
    changed();
  });
  m.el.addEventListener('submit', e => {
    const f = e.target.closest('[data-gw="name"]'); if (!f) return; e.preventDefault();
    const n = f.querySelector('input').value.trim().slice(0, GW_NAME); if (!n) return;
    s.w.push({ n, g: s.cur.slice() }); naming = false; sfx.click(); changed();
  });
  m.el.addEventListener('keydown', e => { if (e.key === 'Escape' && naming) { naming = false; e.stopPropagation(); paintSide(); } }, true);
  paint();
  return m;
}
