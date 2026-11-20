// Results-screen buttons shared by every game: players who aren't hosting vote "Play again",
// and the host sees how many want another round right above their start button.
// Watchers (people who joined mid-game) get "Take a seat next round" instead.
import { avatarHtml } from './avatar.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// label: the game's wording for another round, e.g. "Play again" or "Race again".
export function againHtml(ctx, room, label = 'Play again') {
  const players = room?.players || [], hostId = room?.host, votes = new Set(room?.again || []);
  const others = players.filter(p => p.id !== hostId && !p.watch), yes = others.filter(p => votes.has(p.id)), n = others.length;
  const hostName = esc(players.find(p => p.id === hostId)?.name || 'the host');
  const faces = yes.map(p => `<span class="face" title="${esc(p.name)}">${avatarHtml(p.color, p.av, 30)}</span>`).join('');
  const tally = n ? `<div class="tally${yes.length === n ? ' all' : ''}" aria-live="polite">
    <span class="faces">${faces}</span><span><b>${yes.length}/${n}</b> want${yes.length === 1 && n === 1 ? 's' : ''} to play again</span></div>` : '';
  const leave = '<button type="button" class="btn big ghost" data-a="leave">Leave</button>';
  const meP = players.find(p => p.id === ctx.myId());
  if (meP?.watch && !ctx.isHost()) { // watching: offer a seat in the next round instead of a vote
    const sitting = (room.sit || []).includes(meP.id), full = players.filter(p => !p.watch).length >= room.max;
    return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big${sitting ? ' m' : ''}" data-a="sit" aria-pressed="${sitting}">${sitting ? '✓ Saving you a seat' : 'Take a seat next round'}</button>${leave}</div>
    <p class="wait">${sitting ? (full ? 'Every seat is taken right now. You get the next one that frees up.' : `You take a bot’s seat when ${hostName} starts the next round. Tap again to keep watching.`)
      : 'You are watching. Take a seat and you replace a bot when the next round starts.'}</p></div>`;
  }
  if (ctx.isHost()) return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big" data-a="again">${label}</button><button type="button" class="btn big w" data-a="lobby">Waiting room</button>${leave}</div></div>`;
  const mine = votes.has(ctx.myId());
  return `<div class="again">${tally}<div class="row">
    <button type="button" class="btn big${mine ? ' m' : ''}" data-a="playagain" aria-pressed="${mine}">${mine ? '✓ I’m in' : label}</button>${leave}</div>
    <p class="wait">${mine ? `Waiting for ${hostName} to start the next round. Tap again to take your vote back.` : `${hostName} starts the next round. Vote so they know you’re in.`}</p></div>`;
}
