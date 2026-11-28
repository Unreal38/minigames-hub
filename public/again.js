// Results-screen buttons shared by every game: players who aren't hosting vote "Play again",
// and the host sees how many want another round right above their start button.
// Watchers (people who joined mid-game) get "Take a seat next round" instead.
import { avatarHtml } from './avatar.js';
import { L, word } from './i18n.js';
import { tourAgainHtml } from './tour.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// label: the game's wording for another round, e.g. "Play again" or "Race again".
export function againHtml(ctx, room, label = L('Play again', 'Zagraj jeszcze raz')) {
  if (room?.tour) return tourAgainHtml(room); // a tournament match: the site decides what comes next
  const players = room?.players || [], hostId = room?.host, votes = new Set(room?.again || []);
  const others = players.filter(p => p.id !== hostId && !p.watch), yes = others.filter(p => votes.has(p.id)), n = others.length;
  const hostName = esc(players.find(p => p.id === hostId)?.name || L('the host', 'gospodarz'));
  const faces = yes.map(p => `<span class="face" title="${esc(p.name)}">${avatarHtml(p.color, p.av, 30)}</span>`).join('');
  const tally = n ? `<div class="tally${yes.length === n ? ' all' : ''}" aria-live="polite">
    <span class="faces">${faces}</span><span><b>${yes.length}/${n}</b> ${L(`want${yes.length === 1 && n === 1 ? 's' : ''} to play again`, 'za kolejną grą')}</span></div>` : '';
  const leave = `<button type="button" class="btn big ghost" data-a="leave">${L('Leave', 'Wyjdź')}</button>`;
  const meP = players.find(p => p.id === ctx.myId());
  if (meP?.watch && !ctx.isHost()) { // watching: offer a seat in the next round instead of a vote
    const sitting = (room.sit || []).includes(meP.id), full = players.filter(p => !p.watch).length >= room.max;
    return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big${sitting ? ' m' : ''}" data-a="sit" aria-pressed="${sitting}">${sitting ? L('✓ Saving you a seat', '✓ Trzymamy dla ciebie miejsce') : L('Play next game', 'Zagraj w następnej grze')}</button>${leave}</div>
    <p class="wait">${sitting ? (full ? L('Every seat is taken right now. You get the next one that frees up.', 'Wszystkie miejsca są teraz zajęte. Dostaniesz pierwsze, które się zwolni.') : L(`You take a bot’s seat when ${hostName} starts the next game. Tap again to keep watching.`, `Zajmiesz miejsce bota, gdy ${hostName} zacznie następną grę. Dotknij ponownie, żeby dalej tylko oglądać.`))
      : L('You are watching. Tap to take a bot’s seat when the next game starts.', 'Oglądasz grę. Dotknij, żeby zająć miejsce bota, gdy zacznie się następna gra.')}</p></div>`;
  }
  if (ctx.isHost()) return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big" data-a="again">${label}</button><button type="button" class="btn big w" data-a="lobby">${L('Waiting room', 'Poczekalnia')}</button>${leave}</div></div>`;
  const mine = votes.has(ctx.myId());
  return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big${mine ? ' m' : ''}" data-a="playagain" aria-pressed="${mine}">${mine ? L('✓ I’m in', '✓ Gram dalej') : label}</button>${leave}</div>
    <p class="wait">${mine ? L(`Waiting for ${hostName} to start the next round. Tap again to take your vote back.`, `Czekamy, aż ${hostName} zacznie następną rundę. Dotknij ponownie, żeby cofnąć głos.`) : L(`${hostName} starts the next round. Vote so they know you’re in.`, `Następną rundę zaczyna ${hostName}. Zagłosuj, żeby było wiadomo, że grasz dalej.`)}</p></div>`;
}

// Coins column on every results screen: what each seat actually got paid for this game (room.paid, filled in by the
// server when it scores the game). People see "+10" and so on; bots have no account, so their row says so.
// Rows are drawn before the room update may have arrived, so each badge keeps its seat and paintPaid fills it in later.
export function paidHtml(room, i) {
  const all = room?.paid, v = all?.[i], tag = `data-paid="${i}"`;
  if (v === 'b') return `<span class="paid bot" ${tag} title="${L('Bots have no account, so they never earn coins', 'Boty nie mają konta, więc nigdy nie zdobywają monet')}">Bot<small>${L('no coins', 'bez monet')}</small></span>`;
  if (typeof v === 'number') {
    const t = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    return `<span class="paid${v > 0 ? '' : v < 0 ? ' down' : ' none'}" ${tag} title="${L('Coins earned this game', 'Monety zdobyte w tej grze')}"><b><i class="cn" aria-hidden="true"></i>${t}</b><small>${word(Math.abs(v), 'coin', 'coins', 'moneta', 'monety', 'monet')}</small></span>`;
  }
  if (all) return `<span class="paid none" ${tag} title="${L('Left before the end', 'Wyjście przed końcem gry')}">–<small>${L('left', 'poza grą')}</small></span>`;
  return `<span class="paid wait" ${tag}><b><i class="cn" aria-hidden="true"></i>…</b><small>${L('coins', 'monet')}</small></span>`;
}
export function paintPaid(root, room) {
  for (const el of root.querySelectorAll('[data-paid]')) {
    const html = paidHtml(room, +el.dataset.paid);
    if (el.outerHTML !== html) el.outerHTML = html;
  }
}
