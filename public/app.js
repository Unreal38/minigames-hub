// Zatoka Gier hub: username, open tables, waiting rooms. Games mount on top of this.
import { uiz } from './uiz.js'; // first, so its resize handler runs before the games' own
import { siteLogo, tableArt } from './art.js';
import { hotpotArt, marbleArt, laddersArt, pokerArt, ludoArt, stackArt, golfArt, diceArt, pawArt, kartArt, kitchenArt, digArt, beanArt, bricksArt, lagoonArt, mahjArt, tysArt, panArt, pipsArt, dartsArt, piotrArt, tttArt, chessArt, bjArt, dominoArt, paradeArt, makaoArt, coveArt, poolArt, bingoArt, kalArt, wojnaArt, bierkiArt, bopArt, HAY_ICON, POP_ICON, MJ_ICON, FARM_ICON, MYSTERY_ICON, WHEEL_ICON, WORD_ICON, pmArt } from './gameart.js';
import { backSvg } from './games/hotpot/icons.js';
import { sfx } from './sfx.js';
import { EMOJI, FOODS, floatAt } from './react.js';
import { COS, WORN, decorOf, DECOR_SLOTS, PIECES, PIECE_SLOTS, piecesOf, cosItem, cosPrice, cosOnSale, cosSeason, cosHas, earnProgress, flairOf, stickersOf, STICKERS, nameHtml, titleHtml, frameCls, cardBg, cardBgCls, cosPackIds } from './cosmetics.js';
import { playWinFx, setSeatFx, setMyFx, winPic } from './winfx.js';
import { petImg, petPics } from './petpic.js';
import { skinPic, skinPicNow } from './skinpic.js';
import { progress, rankOf, nextRankOf, RANKS, STAR_EVERY } from './ranks.js';
import { srvText } from './lang/server.js';
import { rankIcon } from './rankicons.js';
import { CONS, SETS, conOf, conArt, conTile, conGlyph, isDone, doneIds, inProgress } from './constellations.js';
import { DAILY as HAY_DAILY } from './games/hay/rules.js';
import { DAILY as POP_DAILY } from './games/pop/rules.js';
import { DAILY as MJ_DAILY } from './games/mahj/rules.js';
import { randomName } from './names.js';
import { fitw } from './fit.js';
import { morph } from './morph.js';
import { gfx, gfxPick, setGfx, onGfxTip, SOFT } from './frames.js';
import { initNotice, onNotice, openNotices } from './notice.js';
import { L, PL, LANG, LOCALE, cnt, word, num, ord, setLang, onLangSwitch, picked } from './i18n.js';
import { avatarHtml, cleanAv, randomAv, OPT, AV_KEYS, AV_COLOR_KEYS, AV_TABS, priceOf, packOf, packIds, needsOwning, wearable, lockedIn, SEASON, SEASONS, seasonOn, seasonOf, onSale } from './avatar.js';

export const SITE = 'Zatoka Gier';
const HOME_TITLE = document.title || SITE; // the full title from index.html (the server swaps in English), kept for the hub tab and search engines
// The 3D head snapshots and the creator's 3D preview need three.js, so they load on the side: the hub still works
// (with flat stand-in heads) if that fails.
let P3 = null, IP = null; // IP: item pictures for the wardrobe (itempic.js)
const COLORS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const GAMES = {
  hotpot: {
    name: 'Hot Pot', load: () => import('./games/hotpot/client.js'), start: 'Start the pot',
    mins: [5, 10], // every game needs this: how long one game usually takes at its default settings, in minutes (the ⏱ tag on its hub card; test/i18n.js checks it)
    host: { bots: 'chill', timer: 30 }, solo: { bots: 'chill', timer: 0 },
    openSeat: 'A bot sits here if nobody joins',
    settings: pill => `<div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Hold 8 cards. Each turn draw one (from the pot or a friend's discard), then discard one. Make three sets of three, either three of the same ingredient or three different ingredients of one colour, and call “Let's Eat!”.`,
    rules: `<ol>
      <li>Everyone holds <b>8 cards</b>. Each card is an ingredient in one of six colours.</li>
      <li>On your turn, <b>draw one</b>: a surprise ingredient from the pot, or the top card a friend just discarded.</li>
      <li>Then <b>discard one</b> card so you're back to 8.</li>
      <li>A <b>set</b> is three identical ingredients (30 pts) or three <b>different</b> ingredients of the same colour (15 pts).</li>
      <li>Hold <b>three sets</b> after drawing and press <b>Let's Eat!</b> to win (+90 pts).</li>
      <li>No winner after 30 rounds? Everyone scores the sets in their hand.</li>
    </ol>`,
  },
  marbles: {
    name: 'Marble Rush', load: () => import('./games/marbles/client.js'), start: 'Open the betting',
    mins: [2, 5],
    host: { mode: 'classic', chaos: 'on', field: 6 }, solo: { mode: 'classic', chaos: 'on', field: 6 },
    openSeat: 'A bot bets from this seat if nobody joins',
    settings: pill => `<div class="opt"><b>Race</b><div class="pills">${pill('mode', 'classic', 'Classic')}${pill('mode', 'knockout', 'Knockout')}</div></div>
      <div class="opt"><b>Chaos events</b><div class="pills">${pill('chaos', 'on', 'On')}${pill('chaos', 'off', 'Off')}</div></div>
      <div class="opt"><b>Marbles on the track</b><div class="pills">${pill('field', 4, '4')}${pill('field', 6, '6')}${pill('field', 8, '8')}</div></div>`,
    howto: `Nobody owns a marble. Bet your coins on a colour, then watch the marbles tumble down a random track. Knockout drops the slowest marble after every heat until one is left.`,
    rules: `<ol>
      <li>The marbles are plain <b>colours</b> and belong to nobody. Several players can back the same one.</li>
      <li>Before the gate opens, <b>bet coins</b> on a colour. The race waits until everyone has bet. The winning colour pays your stake times the number of marbles.</li>
      <li>The track is <b>random every race</b>: pins, spinners, trapdoors, boost pads and squeezes. Nobody steers.</li>
      <li>You get <b>one banana per heat</b>. Throw it at any colour to slip it up.</li>
      <li><b>Chaos events</b> hit everyone: gravity flips, turbo, marblequakes and switcheroos.</li>
      <li><b>Knockout</b>: the last marble home each heat is out. Handy for deciding who pays.</li>
      <li>Bets use your real coins, the same ones that buy avatar items in the shop, so bet what you can spare. If you have under 10, the house spots you a 10-coin bet.</li>
    </ol>`,
  },
  ladders: {
    name: 'Snakes & Ladders', load: () => import('./games/ladders/client.js'), start: 'Start the game',
    mins: [10, 15],
    host: { size: 'classic', party: 'on', bounce: 'on', seats: 4, timer: 20, hard: 'off' }, solo: { size: 'classic', party: 'on', bounce: 'on', seats: 4, timer: 0, hard: 'off' },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `<div class="opt"><b>Board</b><div class="pills">${pill('size', 'classic', 'Classic 100')}${pill('size', 'short', 'Quick 60')}</div></div>
      <div class="opt"><b>Party tiles</b><div class="pills">${pill('party', 'on', 'On')}${pill('party', 'off', 'Off')}</div></div>
      <div class="opt"><b>Hard mode</b><div class="pills">${pill('hard', 'off', 'Off')}${pill('hard', 'on', 'On')}</div></div>
      <div class="opt"><b>Exact roll to finish</b><div class="pills">${pill('bounce', 'on', 'Yes')}${pill('bounce', 'off', 'No')}</div></div>
      <div class="opt"><b>Roll timer</b><div class="pills">${pill('timer', 10, '10s')}${pill('timer', 20, '20s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone's avatar sits on a token at the start. Take turns rolling the die: ladders whisk you up, snakes slide you down. First to the star on the last tile wins.`,
    rules: `<ol>
      <li>Every player gets a <b>token</b> wearing their avatar. Empty seats are played by bots.</li>
      <li>On your turn, <b>roll the die</b> and hop that many tiles. The board is new every game.</li>
      <li>Land on the foot of a <b>ladder</b> to climb it. Land on a <b>snake's head</b> and you slide down to its tail.</li>
      <li>Roll a <b>6</b> and you roll again (up to twice in a row).</li>
      <li><b>Party tiles</b>: green zooms you 3 tiles on, orange gives a bonus roll, pink swaps you with the player just ahead, blue makes you nap through your next turn.</li>
      <li>With <b>exact roll</b> on, you need the right number to land on the last tile. Too much and you bounce back.</li>
      <li>First to the last tile wins. Everyone else is ranked by how far they got.</li>
      <li><b>Hard mode</b>: some ladders are <b>broken</b> (warning sign at the foot): you only climb halfway and you're stuck for a turn. Any ladder can <b>crack</b> after someone climbs it. <b>Golden snakes</b> face down the board: land on the head to climb up to the tail, but it costs a turn. On a swap tile you <b>must</b> swap, so the leader trades with the player just behind.</li>
    </ol>`,
  },
  poker: {
    name: "Texas Hold'em", load: () => import('./games/poker/client.js'), start: 'Deal the cards',
    mins: [15, 25],
    host: { variant: 'holdem', bots: 'chill', field: 6, hands: 10, timer: 30 }, solo: { variant: 'holdem', bots: 'chill', field: 6, hands: 10, timer: 0 },
    openSeat: 'A bot sits here if nobody joins', seatWord: 'Seats at the table', seatMin: r => (r.opts.variant === 'mango' ? 4 : 2),
    settings: (pill, r) => `<div class="opt"><b>Game</b><div class="pills">${pill('variant', 'holdem', "Texas Hold'em")}${pill('variant', 'mango', 'Mango Poker')}</div></div>
      <div class="opt"><b>Game length</b><div class="pills">${pill('hands', 10, '10 hands')}${pill('hands', 20, '20 hands')}${pill('hands', 0, 'Last one standing')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Classic no-limit Texas Hold'em with pretend chips. Make the best five-card hand from your two cards and the five on the table, or bet so big everyone else folds. Most chips after the last hand wins.`,
    rules: `<ol>
      <li>Everyone starts with <b>1000 pretend chips</b>. Empty seats get bots.</li>
      <li>Each hand you get <b>two secret cards</b>. Two players post the <b>blinds</b> (small forced bets) to get things going.</li>
      <li>Betting goes round the table: <b>fold</b> (give up), <b>check</b> (pass when nobody has bet), <b>call</b> (match the bet) or <b>raise</b>.</li>
      <li>Five shared cards come out: the <b>flop</b> (three), the <b>turn</b> and the <b>river</b>, with a round of betting after each.</li>
      <li>At the <b>showdown</b> the best five-card hand from your two plus the five shared cards wins the pot.</li>
      <li>Best to worst: royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.</li>
      <li>Blinds go up every 4 hands. Lose all your chips and you're out. After the last hand (or when one player has everything) the biggest stack wins.</li>
      <li>Your best hand is shown under your cards. Shortcuts: <b>F</b> fold, <b>C</b> check or call, <b>R</b> raise.</li>
    </ol>
    <h3>Mango Poker</h3>
    <ol>
      <li>Pick <b>Mango Poker</b> under Game in the table settings. It needs at least 4 seats (bots fill any empty ones).</li>
      <li>Everyone gets <b>three secret cards</b> and throws one away, face down, before the first round of betting.</li>
      <li>The <b>flop is three cards picked at random from the thrown-away pile</b>. Nobody knows whose they were, so the card you threw might come back to help you, or someone else.</li>
      <li>The turn and the river come from the deck as usual, and the rest is normal Hold'em.</li>
    </ol>`,
  },
  bj: {
    name: 'Blackjack', load: () => import('./games/bj/client.js'), start: 'Deal the cards',
    mins: [10, 15],
    host: { seats: 4, rounds: 10, bots: 'chill', timer: 20 }, solo: { seats: 4, rounds: 10, bots: 'chill', timer: 0 },
    openSeat: 'A bot sits here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Game length</b><div class="pills">${pill('rounds', 10, '10 rounds')}${pill('rounds', 15, '15 rounds')}${pill('rounds', 20, '20 rounds')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone plays their own hand against the dealer, for pretend chips. Bet, then take cards to get as close to 21 as you can without going over. Beat the dealer's hand to win your bet. Most chips after the last round wins the table.`,
    rules: `<ol>
      <li>Everyone starts with <b>1000 pretend chips</b> and plays a set number of rounds against the same dealer. Empty seats get bots.</li>
      <li><b>Bet first.</b> Everyone picks a bet from <b>10 to 500</b> at the same time. Bets stay secret until all of them are in.</li>
      <li>You get <b>two cards face up</b>. The dealer gets one face up and one face down. Number cards count their number, <b>jack, queen and king count 10</b>, and an <b>ace counts 11 or 1</b>, whichever is better for you.</li>
      <li>On your turn: <b>Hit</b> takes another card, <b>Stand</b> keeps what you have. Go over <b>21</b> and you are <b>bust</b>: the bet is lost straight away.</li>
      <li><b>Double</b> (only on your first two cards) doubles your bet, gives you exactly one more card and ends your turn.</li>
      <li><b>Split</b> (two cards of the same rank) turns them into two hands, each with its own bet, and you play them one after the other. You can split once a round. Split aces get one card each.</li>
      <li>When everyone is done the dealer turns the hidden card over and <b>draws up to 16, and stands on 17 or more</b>.</li>
      <li>Closer to 21 than the dealer, or the dealer busts: you <b>win your bet</b>. The same total is a <b>push</b> and the bet comes back. Lower loses it.</li>
      <li>An ace with a ten-card in your first two cards is a <b>blackjack</b>: it pays <b>3 to 2</b> (bet 100, win 150) and only a dealer blackjack ties it. If the dealer has a blackjack the round ends at once.</li>
      <li>Run out of chips and you are out. After the last round the <b>biggest stack wins</b>, and coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
      <li>If the timer runs out, your last bet is placed for you, and in your turn you stand. Shortcuts: <b>H</b> hit, <b>S</b> stand, <b>D</b> double, <b>P</b> split, <b>Enter</b> places the bet.</li>
    </ol>`,
  },
  ludo: {
    name: 'Ludo', load: () => import('./games/ludo/client.js'), start: 'Start the game',
    mins: [20, 30],
    host: { seats: 4, pawns: 4, head: 'on', timer: 20, hard: 'off' }, solo: { seats: 4, pawns: 4, head: 'on', timer: 0, hard: 'off' },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Pawns each</b><div class="pills">${pill('pawns', 4, 'Classic 4')}${pill('pawns', 2, 'Quick 2')}</div></div>
      <div class="opt"><b>Head start</b><div class="pills">${pill('head', 'on', 'One pawn out')}${pill('head', 'off', 'Off')}</div></div>
      <div class="opt"><b>Hard mode</b><div class="pills">${pill('hard', 'off', 'Off')}${pill('hard', 'on', 'On')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 10, '10s')}${pill('timer', 20, '20s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone's avatar sits in their own corner with a set of pawns. Roll the die, walk your pawns once round the board and up your home lane. Land on a rival to send them back to their yard. First to get every pawn home wins.`,
    rules: `<ol>
      <li>Every player has a <b>corner</b> in their own colour with their avatar and their pawns. Empty corners are played by bots.</li>
      <li>On your turn, <b>roll the die</b>. A pawn needs a <b>6</b> to leave the yard. With nothing on the board you get up to three tries.</li>
      <li>If more than one pawn can move, <b>tap the one you want</b> (or use the buttons). If only one can move, it goes by itself.</li>
      <li>Land on a single rival pawn to <b>capture</b> it: it goes back to its yard.</li>
      <li>Pawns are <b>safe</b> on the star cells and on the coloured start cells. Two of your pawns on the same cell are a <b>block</b> that cannot be captured.</li>
      <li>A <b>6</b>, a capture, or getting a pawn home earns a <b>bonus roll</b>. Three sixes in a row and the turn is over.</li>
      <li>After a full lap a pawn turns up its <b>home lane</b>. It needs the exact number to step into the middle.</li>
      <li><b>Hard mode</b>: only <b>one pawn per cell</b>, and <b>nowhere is safe</b>. You cannot move onto your own pawn, so there are no blocks. Any rival you land on is captured, even on a star or a start cell. If no pawn has a free cell to go to, the roll is lost.</li>
      <li>First to bring <b>every pawn home</b> wins. Everyone else is ranked by how far their pawns got.</li>
    </ol>`,
  },
  stack: {
    name: 'Tower Stack', load: () => import('./games/stack/client.js'), start: 'Start building',
    mins: [5, 10],
    host: { seats: 4, towers: 3, blocks: 'classic', bots: 'chill', timer: 10 }, solo: { seats: 4, towers: 3, blocks: 'classic', bots: 'chill', timer: 0 },
    openSeat: 'A bot stacks here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Towers</b><div class="pills">${pill('towers', 1, '1')}${pill('towers', 3, '3')}${pill('towers', 5, '5')}</div></div>
      <div class="opt"><b>Blocks</b><div class="pills">${pill('blocks', 'classic', 'All the same')}${pill('blocks', 'mixed', 'Mixed shapes')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Drop timer</b><div class="pills">${pill('timer', 10, '10s')}${pill('timer', 20, '20s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone builds one wobbly tower together. On your turn a block swings over the top: tap to drop it. Stack it straight for points, but whoever knocks the tower over loses a big chunk. Most points after the last tower wins.`,
    rules: `<ol>
      <li>Everyone stands round the same tower. Empty spots are played by bots.</li>
      <li>On your turn a block in your colour <b>swings</b> over the top of the tower. <b>Tap</b> (or press space) to drop it.</li>
      <li>A block that lands on the tower scores <b>10</b>. Drop it right in the middle for a <b>Perfect</b>: it snaps straight and scores <b>15</b>.</li>
      <li>Hang it too far over the edge and it <b>slips off</b> (−5). Miss the tower completely and it's −5 too.</li>
      <li>The tower stays up while the weight of everything above each block rests over the block below. Lean it too far and it <b>crashes</b>: whoever dropped the last block loses <b>30</b>.</li>
      <li>The taller it gets, the <b>faster</b> the swing and the <b>wobblier</b> the tower: lower blocks hold less and less overhang.</li>
      <li>After a crash a new tower starts. Reach 40 blocks and everyone gets +20. After the last tower, the most points wins.</li>
      <li><b>Mixed shapes</b> deals planks, cubes and wide slabs as well as plain blocks.</li>
    </ol>`,
  },
  darts: {
    name: 'Sky Darts', load: () => import('./games/darts/client.js'), start: 'Game on',
    mins: [5, 10],
    host: { seats: 4, start: 301, out: 'double', legs: 1, bots: 'chill', timer: 15 }, solo: { seats: 4, start: 301, out: 'double', legs: 1, bots: 'chill', timer: 0 },
    openSeat: 'A bot throws here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Start from</b><div class="pills">${pill('start', 301, '301')}${pill('start', 501, '501')}</div></div>
      <div class="opt"><b>Finish</b><div class="pills">${pill('out', 'double', 'On a double')}${pill('out', 'any', 'Any dart')}</div></div>
      <div class="opt"><b>Legs</b><div class="pills">${pill('legs', 1, 'One leg')}${pill('legs', 3, 'Best of 3')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Time per dart</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone starts on 301 and takes turns throwing three darts. What you hit comes off your score. Point at the board, hold to steady your hand and let go to throw. First to reach exactly zero wins.`,
    rules: `<ol>
      <li>Everyone starts on <b>301</b> (or 501) and takes turns throwing <b>three darts</b>. Whatever you hit is taken off your score. Empty spots are played by bots.</li>
      <li>The thin <b>outer ring</b> scores <b>double</b> the number, the thin <b>inner ring</b> scores <b>treble</b>. The green ring round the middle is <b>25</b> and the red <b>bull</b> is <b>50</b>.</li>
      <li><b>Aiming:</b> your hand is never quite still, so the yellow dot wanders round where you point. <b>Hold</b> the mouse button (or your finger, or space) to steady it: the ring shrinks and turns green. <b>Let go</b> to throw. The dart lands exactly where the dot is. Hold too long and your arm gets tired and shaky again.</li>
      <li>On a phone, <b>drag</b> anywhere to move your aim, keep your finger still to steady, and <b>lift</b> to throw. On a keyboard, use the arrow keys and hold space.</li>
      <li>The first to reach <b>exactly zero</b> wins the leg. With <b>On a double</b>, your last dart must land in a double (the bull counts): with 20 left you need <b>double 10</b>, and a plain 20 is a bust. The board glows on the spot to go for. Pick <b>Any dart</b> in the table settings for an easier game.</li>
      <li>Score more than you have left (or leave yourself on 1 when you need a double) and you go <b>bust</b>: the turn is over and your score goes back to what it was before the turn.</li>
      <li>When you can finish this turn, the game shows you a way out, like <b>T20 D20</b> (treble 20, then double 20).</li>
      <li>If nobody is out after the last round (15 rounds for 301, 20 for 501), whoever has the <b>least left</b> takes the leg.</li>
      <li>You have <b>15 seconds</b> a dart. Run out and the dart is thrown in a hurry, somewhere near the middle.</li>
      <li><b>Best of 3</b> is won by the first to two legs. Everyone else is placed by legs won, then by the least left.</li>
    </ol>`,
  },
  golf: {
    name: 'Mini Golf Party', load: () => import('./games/golf/client.js'), start: 'Tee off',
    mins: [10, 15],
    host: { holes: 6, seats: 4, bets: 'on', bots: 'chill', course: 'random' }, solo: { holes: 6, seats: 4, bets: 'on', bots: 'chill', course: 'random' },
    openSeat: 'A bot putts here if nobody joins',
    settings: pill => `<div class="opt"><b>Holes</b><div class="pills">${pill('holes', 3, 'Quick 3')}${pill('holes', 6, '6')}${pill('holes', 9, '9')}</div></div>
      <div class="opt"><b>Course</b><div class="pills">${pill('course', 'random', 'Random')}${pill('course', 'classic', 'Classic')}</div></div>
      <div class="opt"><b>Coin bets on each hole</b><div class="pills">${pill('bets', 'on', 'On')}${pill('bets', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone plays the same hole and takes turns, one putt each, with their own ball. Drag back and let go to putt. Fewest strokes over the round wins, and before each hole you can bet coins on who will take it.`,
    rules: `<ol>
      <li>Everyone plays the same hole and <b>takes turns</b>, one putt each, until every ball is in. You each have your own ball, and balls pass through each other. Whoever took the last hole tees off first.</li>
      <li>You have <b>25 seconds</b> for a putt. If the time runs out, the game makes a clumsy putt for you.</li>
      <li><b>Drag back</b> anywhere on the screen and <b>let go</b> to putt: the further you pull, the harder the hit. The dots show the first half of the ball's roll, up to its first bounce. Where it stops is for you to judge. On a keyboard, use the arrow keys to aim and set the power, then space.</li>
      <li>Watch for <b>windmills</b>, <b>bumper posts</b>, <b>ramps</b> and <b>sand</b> (it slows the ball a lot). A ball in the <b>water</b> costs a stroke and goes back where you hit it from.</li>
      <li>You get <b>7 strokes</b> a hole. Not in by then and you score 8.</li>
      <li>Hit it <b>too hard</b> and the ball skips right over the hole, so slow down near the cup.</li>
      <li><b>Random</b> courses are built fresh every round, so no two are the same. <b>Classic</b> plays the nine hand-made holes.</li>
      <li>The hole goes to the <b>fewest strokes</b>. A tie goes to whoever holed out first.</li>
      <li>With bets on, before each hole you can <b>bet coins</b> on who will take it, yourself included. A right call pays your stake times the number of players. It is optional, and it uses your real coins, the ones that buy avatar items.</li>
      <li>After the last hole the <b>fewest strokes in total</b> wins the round. Empty seats are played by bots.</li>
    </ol>`,
  },
  dice: {
    name: "Liar's Dice", load: () => import('./games/dice/client.js'), start: 'Shake the cups',
    mins: [10, 15],
    host: { seats: 4, mode: 'dice', lives: 3, dice: 5, wild: 'on', spot: 'on', bots: 'chill', timer: 30 }, solo: { seats: 4, mode: 'dice', lives: 3, dice: 5, wild: 'on', spot: 'on', bots: 'chill', timer: 0 },
    openSeat: 'A bot bluffs from this seat if nobody joins',
    settings: pill => `
      <div class="opt"><b>A lost call costs</b><div class="pills">${pill('mode', 'dice', 'A die')}${pill('mode', 'lives', 'A life')}</div></div>
      <div class="opt"><b>Lives (life mode)</b><div class="pills">${pill('lives', 2, '2')}${pill('lives', 3, '3')}${pill('lives', 5, '5')}</div></div>
      <div class="opt"><b>Dice each</b><div class="pills">${pill('dice', 5, 'Classic 5')}${pill('dice', 3, 'Quick 3')}</div></div>
      <div class="opt"><b>Ones are wild</b><div class="pills">${pill('wild', 'on', 'On')}${pill('wild', 'off', 'Off')}</div></div>
      <div class="opt"><b>Spot on calls</b><div class="pills">${pill('spot', 'on', 'On')}${pill('spot', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Everyone rolls in secret under a cup. Take turns bidding how many dice of one face there are on the whole table, always going higher. Think the last bid is a bluff? Call “Liar!”. Whoever is wrong loses a die, and the last player with dice wins.`,
    rules: `<ol>
      <li>Everyone starts with <b>five dice</b> under a cup. Each round you all roll, and you can only see <b>your own</b>. Empty seats are played by bots.</li>
      <li>Take turns <b>bidding</b> on all the dice at the table together, for example “four fives”: at least four dice show a five.</li>
      <li>Every bid has to go <b>higher</b>: more dice of any face, or the same number of a higher face.</li>
      <li>Instead of bidding you can call <b>Liar!</b> on the bid before you. All cups lift and the dice are counted.</li>
      <li>If there are <b>fewer</b> than the bid, the bidder loses a die. If the bid was good, the one who called loses a die.</li>
      <li><b>Ones are wild</b>: a 1 counts as whatever face was bid, so you cannot bid on ones.</li>
      <li><b>Spot on!</b> is the risky call: you say the bid is <b>exactly</b> right. If it is, everyone else loses a die. If not, you lose one.</li>
      <li>Whoever lost a die opens the next round. Run out of dice and you are out. The <b>last player with dice</b> wins.</li>
      <li><b>Life mode</b> (a table option): nobody loses dice. Everyone keeps their full cup all game and a lost call costs a <b>heart</b> instead. Out of hearts and you are out, so the table stays full of dice to the end.</li>
      <li>Shortcuts: arrow keys change the bid, <b>Enter</b> bids, <b>L</b> calls liar, <b>S</b> calls spot on.</li>
    </ol>`,
  },
  paw: {
    name: 'Pawperty', load: () => import('./games/paw/client.js'), start: 'Open the shops',
    mins: [15, 25],
    host: { seats: 4, rounds: 20, naps: 'on', bots: 'chill', timer: 30 }, solo: { seats: 4, rounds: 20, naps: 'on', bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Game length</b><div class="pills">${pill('rounds', 10, 'Quick 10 rounds')}${pill('rounds', 20, '20 rounds')}${pill('rounds', 30, 'Long 30')}</div></div>
      <div class="opt"><b>Napping pets</b><div class="pills">${pill('naps', 'on', 'On')}${pill('naps', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Walk your avatar round a board of pet shops, adopt the pets you land on and collect rent in treats when friends visit. Upgrade your shops, dodge Bath Time and draw silly Zoomies cards. Nobody gets knocked out: after the last round the richest player wins.`,
    rules: `<ol>
      <li>Everyone starts with <b>600 treats</b> on the Welcome Mat. Roll two dice and walk that many tiles. Passing the Welcome Mat pays <b>150</b>. After the dice land, the tile you are heading for lights up. Empty seats are played by bots.</li>
      <li>Land on a pet waiting in a box and you can <b>adopt</b> it: the shop is yours. Anyone else who lands there pays you <b>rent</b>.</li>
      <li><b>Napping pets charge no rent.</b> Each round every pet has a one in five chance of dozing off, so visitors tiptoe past for free.</li>
      <li>On your turn you can <b>upgrade</b> any shop you own: a <b>Pet Bed</b>, then a <b>Toy Box</b>. Each one raises the rent and your pet grows up.</li>
      <li>The board has ten places along each side and eight streets of three shops, one per colour, and each pet matches the colour of its street. Own a <b>whole street</b> and its rent doubles, and you can build the <b>Pet Palace</b> for the biggest rent of all.</li>
      <li>Land on your own shop and your pet is happy to see you: <b>+10</b>.</li>
      <li><b>Zoomies!</b> tiles deal a silly card. <b>Vet Visit</b> costs 40, which goes in the <b>Lost &amp; Found</b> jar. Land on the jar's corner to take everything in it.</li>
      <li><b>Muddy Puddle</b>, or three doubles in a row, sends you to <b>Bath Time</b>. Roll doubles to hop out, or pay 30. After three tries you pay and go. While you sit in the tub all your pets nap, so you collect no rent.</li>
      <li>Doubles roll again. <b>Nobody is knocked out</b>: if you cannot pay, <b>you pick what to sell</b> back to the bank at half price (an upgrade, or a whole shop with its upgrades). The game waits for you; if the timer runs out, it sells for you, upgrades first. Once nothing is left to sell, anything still missing is let off.</li>
      <li>After the last round, treats in hand plus everything you spent on shops and upgrades are added up. <b>The richest player wins.</b></li>
      <li>Tap any tile to read about it. Shortcuts: <b>Space</b> rolls, adopts or ends your turn, <b>N</b> says no thanks.</li>
    </ol>`,
  },
  kart: {
    name: 'Kart Island Race', load: () => import('./games/kart/client.js'), start: 'Start your engines',
    mins: [3, 5],
    host: { seats: 6, laps: 3, track: 'random', items: 'on', bots: 'chill' }, solo: { seats: 6, laps: 3, track: 'random', items: 'on', bots: 'chill' },
    openSeat: 'A bot drives here if nobody joins', seatWord: 'Karts on the grid',
    settings: pill => `<div class="opt"><b>Track</b><div class="pills">${pill('track', 'random', 'Random')}${pill('track', 'meadow', 'Meadow Loop')}${pill('track', 'bakery', 'Sugar Bridges')}${pill('track', 'peaks', 'Twisty Peaks')}${pill('track', 'cliff', 'Cliffside Hairpins')}${pill('track', 'cove', 'Pirate Cove')}${pill('track', 'frost', 'Frost Fjord')}</div></div>
      <div class="opt"><b>Laps</b><div class="pills">${pill('laps', 2, 'Quick 2')}${pill('laps', 3, '3')}${pill('laps', 5, '5')}</div></div>
      <div class="opt"><b>Power-ups</b><div class="pills">${pill('items', 'on', 'On')}${pill('items', 'chaos', 'Chaos')}${pill('items', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone's avatar drives a little kart round roads that hop between floating islands. Grab gift boxes for silly power-ups, drift round the corners for a boost, and don't drive off the edge. First over the line after the last lap wins.`,
    rules: `<ol>
      <li>Everyone drives their own kart with their avatar at the wheel. Empty spots on the grid are bots.</li>
      <li>Your kart <b>speeds up by itself</b>. Steer with <b>← →</b> or <b>A D</b>, brake or reverse with <b>↓</b>. On a phone, use the arrow pads in the bottom corners.</li>
      <li><b>Drift</b>: hold <b>Space</b> (or the Drift pad) while turning at speed. Keep it up until the sparks glow, then let go for a speed boost. Blue sparks give a short one, orange a longer one and pink the longest. Driving on the grass slows you right down.</li>
      <li><b>Watch the road</b>: plank walks have no rails, ramps need speed to clear the gap, ice makes you slide and Pet Farm pets wander across the road. Bump into a pet, a geyser or the hammer and you spin.</li>
      <li>Orange <b>boost pads</b> on the road shoot you forward. The grass at the side slows you down, and past the grass is the <b>edge of the island</b>: drive off and a cloud carries you back, a few seconds later. Bridges have rails.</li>
      <li>Drive through a <b>gift box</b> to get a power-up, then press <b>E</b> (or tap it) to use it:
        <b>Banana peel</b> drops behind you, <b>Wobbly jelly</b> bounces after the kart just ahead, <b>Chili boost</b> is a burst of speed, <b>Bubble shield</b> blocks the next hit, and the <b>Sleepy cloud</b> slows everyone ahead of you. The further back you are, the better the power-ups.</li>
      <li>Once the first kart finishes, everyone else has <b>25 seconds</b> to cross the line. After that the rest are placed by how far round they got.</li>
      <li><b>Chaos</b> power-ups rain banana peels from the sky and hand out more jellies and clouds.</li>
      <li>Coins go by your finishing place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  kitchen: {
    name: 'Cozy Kitchen Rush', load: () => import('./games/kitchen/client.js'), start: 'Open the kitchen',
    mins: [3, 5],
    host: { seats: 3, time: 180, map: 'diner', bots: 'chill' }, solo: { seats: 3, time: 180, map: 'diner', bots: 'chill' },
    openSeat: 'A bot cooks here if nobody joins', seatWord: 'Cooks',
    settings: pill => `
      <div class="opt"><b>Kitchen</b><div class="pills">${pill('map', 'diner', 'Sunny Diner')}${pill('map', 'split', 'Pass-Through')}</div></div>
      <div class="opt"><b>Shift</b><div class="pills">${pill('time', 120, '2 min')}${pill('time', 180, '3 min')}${pill('time', 240, '4 min')}</div></div>
      <div class="opt"><b>Bot cooks</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone cooks together in one little kitchen. Grab ingredients from the crates, chop them, cook soups and patties, plate them up and serve the orders before their tickets run out. The whole kitchen earns tips and stars, and whoever had a hand in the most tips is the star cook.`,
    rules: `<ol>
      <li>Everyone works in the <b>same kitchen</b> against the clock. Empty spots are bot cooks.</li>
      <li>Walk with <b>WASD</b> or the arrow keys (on a phone, drag anywhere on the left of the screen). <b>Space</b> grabs or puts down whatever is on the counter in front of you, which lights up. <b>E</b> chops.</li>
      <li>Take a <b>tomato</b>, <b>lettuce</b>, <b>mushroom</b>, <b>bun</b> or <b>patty</b> from its crate. Vegetables go on a <b>chopping board</b> and need chopping before they can be used.</li>
      <li>Soup: three chopped tomatoes or three chopped mushrooms in a <b>pot</b>. It cooks by itself, then ladle it out with a plate. Leave it too long and it <b>burns</b>.</li>
      <li>Patties fry in a <b>pan</b>. Take them off when they are brown, before they burn. Burnt food goes in the <b>bin</b>.</li>
      <li>Take a <b>plate</b> from the rack and put the right things on it: a <b>salad</b> is lettuce and tomato, a <b>burger</b> is a bun and a patty, a <b>deluxe burger</b> has lettuce and tomato too.</li>
      <li>Hand the plate in at the <b>serving window</b>. Quick service earns a bigger tip. An order that runs out costs the kitchen 10 tips.</li>
      <li>The kitchen earns up to <b>three stars</b> for its tips. In <b>Pass-Through</b> the stoves are on the other side of a counter: pass things across, or walk round by the door.</li>
      <li>Every dish's tip is shared by everyone who touched it. Coins go by how much of the tips you earned, so help out everywhere.</li>
    </ol>`,
  },
  tys: {
    name: 'Tysiąc', load: () => import('./games/tys/client.js'), start: 'Deal the cards',
    mins: [40, 60],
    host: { seats: 3, target: 1000, bots: 'chill', timer: 30, fold: 'free' }, solo: { seats: 3, target: 1000, bots: 'chill', timer: 0, fold: 'free' },
    openSeat: 'A bot plays this seat if nobody joins', seatLabels: { 4: '4 (dealer sits out)' },
    settings: pill => `
      <div class="opt"><b>Play to</b><div class="pills">${pill('target', 1000, 'Classic 1000')}${pill('target', 500, 'Quick 500')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Folding</b><div class="pills">${pill('fold', 'free', 'First one free')}${pill('fold', 'on', 'Always 60')}${pill('fold', 'off', 'No folding')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The Polish classic for three. Bid how many points you will take, pick up the three hidden cards (the musik), then win tricks. Leading a king or queen while you hold both of a suit announces a marriage: bonus points, and that suit becomes trumps. Make your bid to score it, miss it and you lose it. First to 1000 wins.`,
    rules: `<ol>
      <li>24 cards: 9 to ace in four suits. <b>Ace 11, ten 10, king 4, queen 3, jack 2, nine 0</b>, and the ten beats the king. Everyone gets <b>7 cards</b> and 3 go face down in the middle: the <b>musik</b>. Empty seats are played by bots. With four at the table, the dealer sits the hand out.</li>
      <li><b>Bidding.</b> The player after the dealer starts at <b>100</b> and has to play for that if nobody bids more. Bids go up in tens. Once you pass you are out for the hand. You may not bid over <b>120</b> unless you hold a marriage (king and queen of one suit).</li>
      <li>The winner turns the <b>musik</b> over for everyone, takes it, then <b>gives one card to each opponent</b> and may raise the contract. With hopeless cards they can <b>fold</b> instead (if the table allows it): nothing is played, they score nothing and each opponent gets <b>60</b>. With <b>First one free</b>, each player's first fold of the game gives the others nothing.</li>
      <li><b>Tricks.</b> The winner of the bidding leads. You must <b>follow suit</b>; with none of it you must play a <b>trump</b>; and you must <b>beat</b> the winning card whenever you can. The trick's winner leads the next one.</li>
      <li><b>Marriages.</b> When it is your lead and you hold the king and queen of a suit, leading one of them <b>always announces the marriage</b>: <b>hearts 100, diamonds 80, clubs 60, spades 40</b>. That suit is trumps from then on, until the next marriage.</li>
      <li><b>Scoring.</b> The player with the contract scores exactly the contract if they took at least that many points (cards plus marriages), and <b>loses it</b> if they did not. The other two score what they took, rounded to tens.</li>
      <li><b>The barrel.</b> From <b>800</b> points you only score by playing a contract yourself, so the last 200 have to be won, not collected.</li>
      <li>First to <b>1000</b> wins. If the turn timer runs out, the game passes for you in the bidding and plays a sensible card otherwise.</li>
    </ol>`,
  },
  dig: {
    name: 'Treasure Dig', load: () => import('./games/dig/client.js'), start: 'Start digging',
    mins: [10, 15],
    host: { seats: 4, size: 'big', bots: 'chill', timer: 25 }, solo: { seats: 4, size: 'big', bots: 'chill', timer: 0 },
    openSeat: 'A bot digs here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Field</b><div class="pills">${pill('size', 'big', 'Big 10×10')}${pill('size', 'small', 'Quick 8×8')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 25, '25s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `A grass field hides gems, a golden chest and traps. Take turns digging one tile. Empty tiles show how many traps are touching them, like Minesweeper, and sparkle when a gem is buried next door. Find a gem and you dig again; hit a trap and you lose points. Most points when the last gem is found wins.`,
    rules: `<ol>
      <li>The field is covered in grass. Under it are <b>gems</b> (1 point), <b>big gems</b> (3), one <b>golden chest</b> (5) and some <b>traps</b>. The middle starts dug open. Empty seats are played by bots.</li>
      <li>On your turn, <b>dig one grass tile</b>. On a computer, click it. On a phone, tap it once to pick it and again to dig.</li>
      <li>An empty tile shows a <b>number</b>: how many traps touch it, sideways or corner to corner. No number means no traps around it, and its empty neighbours open by themselves.</li>
      <li>A <b>sparkle</b> on an empty tile means a gem is still buried right next to it.</li>
      <li>Dig up a gem or the chest and you <b>dig again</b>. An empty tile ends your turn.</li>
      <li>A <b>trap</b> takes <b>4 points</b> (never below zero) and ends your turn.</li>
      <li>When the <b>last gem</b> is found, the game ends and the field is shown. <b>Most points wins</b>. A tie goes to whoever found more, then whoever hit fewer traps.</li>
      <li>If the turn timer runs out, the game digs a careful guess for you. Keyboard: arrow keys move, <b>Enter</b> or <b>Space</b> digs.</li>
    </ol>`,
  },
  bricks: {
    name: 'Sky Bricks', load: () => import('./games/bricks/client.js'), start: 'Start stacking',
    mins: [3, 6],
    host: { seats: 4, speed: 'normal', bots: 'chill' }, solo: { seats: 4, speed: 'normal', bots: 'chill' },
    openSeat: 'A bot stacks here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Speed</b><div class="pills">${pill('speed', 'chill', 'Chill')}${pill('speed', 'normal', 'Normal')}${pill('speed', 'fast', 'Fast')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone stacks falling bricks in their own well at the same time. Fill a row and it vanishes. Clear two or more rows at once and stone lines rise under somebody else. Fill your well to the top and you are out. The last one stacking wins.`,
    rules: `<ol>
      <li>Everyone has their <b>own well</b> and plays at the <b>same time</b>, with the same bricks in the same order. Empty seats are played by bots.</li>
      <li>Move a brick with <b>← →</b>, turn it with <b>↑</b> (or <b>Z</b> and <b>X</b>), make it fall faster with <b>↓</b> and drop it at once with <b>Space</b>. On a phone, use the pads in the bottom corners.</li>
      <li>Fill a <b>whole row</b> and it vanishes. The faint outline shows where the brick will land.</li>
      <li><b>Set aside</b> (<b>C</b>): swap the falling brick with the one you saved earlier. Once per brick.</li>
      <li>Clear <b>two rows at once</b> and one <b>stone line</b> rises under another player. Three rows send two, four rows send four. Clearing rows with several bricks in a row sends extra.</li>
      <li>Stone lines wait in the <b>red bar</b> beside your well and come up when your next brick lands without clearing anything. Clear rows first and you <b>knock them back</b> instead.</li>
      <li>The bricks fall <b>faster every 20 seconds</b>. Late in the game the <b>stone tide</b> starts: lines rise for everyone, quicker and quicker.</li>
      <li>When a new brick has no room to appear, you are <b>out</b>. The <b>last player stacking wins</b>.</li>
      <li>Coins go by your place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  lagoon: {
    name: 'Bubble Lagoon', load: () => import('./games/lagoon/client.js'), start: 'Start popping',
    mins: [3, 6],
    host: { seats: 4, speed: 'normal', bots: 'chill' }, solo: { seats: 4, speed: 'normal', bots: 'chill' },
    openSeat: 'A bot shoots here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Reef</b><div class="pills">${pill('speed', 'calm', 'Calm')}${pill('speed', 'normal', 'Normal')}${pill('speed', 'fast', 'Fast')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone has their own lagoon and plays at the same time. Pets are stuck in bubbles under a coral reef. Shoot bubbles from your shell launcher: three or more of the same pet pop. Bubbles left hanging on nothing fall and come up as eggs in a rival's lagoon. The reef keeps pushing new rows down. A bubble over the line and you are out. The last one afloat wins.`,
    rules: `<ol>
      <li>Everyone has their <b>own lagoon</b> and plays at the <b>same time</b>, with the same start and the same bubbles in the same order. Empty seats are played by bots.</li>
      <li><b>Aim</b> with the mouse and <b>click</b> to shoot, or use <b>← →</b> and <b>Space</b>. On a phone, drag your finger to aim and let go to shoot. Shots <b>bounce off the side walls</b>.</li>
      <li>Three or more bubbles with the <b>same pet</b> touching each other <b>pop</b>, and the pets swim free.</li>
      <li>The small bubble marked <b>Next</b> is the one you get after this one. <b>Right click</b>, <b>Shift</b> or a tap on it <b>swaps</b> the two.</li>
      <li>Bubbles left <b>hanging on nothing</b> fall into the water. Every fallen bubble sends one <b>egg</b> to a rival. Popping five or more at once adds an egg, popping on three shots in a row adds an egg, and clearing your whole lagoon adds four.</li>
      <li>Your eggs go to the player who is <b>doing best</b>: the one with the fewest bubbles left.</li>
      <li>Eggs sent to you wait beside your raft and float up when your next shot pops nothing. They never match. An egg <b>cracks</b> when bubbles pop right next to it, and eggs you cut loose fall and are sent on. Popping bubbles first <b>knocks waiting eggs back</b>.</li>
      <li>The <b>reef pushes a new row</b> down every few seconds, faster and faster. Don't dawdle: after 7 seconds the launcher fires by itself.</li>
      <li>When a bubble ends up <b>below the dashed line</b>, you are <b>out</b>. The <b>last player afloat wins</b>.</li>
      <li>Coins go by your place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  mahj: {
    name: 'Mahjong Race', load: () => import('./games/mahj/client.js'), start: 'Start the race',
    mins: [5, 10],
    host: { seats: 4, size: 'normal', bots: 'chill' }, solo: { seats: 4, size: 'normal', bots: 'chill' },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Board</b><div class="pills">${pill('size', 'short', 'Small')}${pill('size', 'normal', 'Medium')}${pill('size', 'long', 'Big')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone gets the same board of stacked tiles and clears it on their own screen at the same time. A tile is free when nothing lies on it and its left or right side is open. Tap two free tiles with the same picture and the pair is gone. The first to clear the whole board wins.`,
    rules: `<ol>
      <li>Everyone gets the <b>same board</b>, dealt the same way, and plays on their <b>own screen at the same time</b>. Empty seats are played by bots.</li>
      <li>A tile is <b>free</b> when <b>nothing lies on top of it</b> and its <b>left or right side is open</b>. Tiles that are not free are a little darker.</li>
      <li>Tap <b>two free tiles with the same picture</b> and the pair leaves the board. There are leaves, berries and stars counted 1 to 9, and nine Pet Farm pets, four tiles of each.</li>
      <li>The <b>first player to clear the whole board wins</b> and the race ends. Everyone else is placed by how few tiles they have left.</li>
      <li>When you have <b>no pair left</b>, your tiles are <b>shuffled</b> for you and you wait 4 seconds. Think before you take a pair: sometimes one choice keeps more tiles free.</li>
      <li><b>Hint</b> (or the <b>H</b> key) shows a pair, then rests for 8 seconds.</li>
      <li>The bars on the side show how far everyone is.</li>
      <li>Coins go by your place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  bean: {
    name: 'Beanstalk Bounce', load: () => import('./games/bean/client.js'), start: 'Start climbing',
    mins: [3, 5],
    host: { seats: 4, pace: 'normal', bots: 'chill' }, solo: { seats: 4, pace: 'normal', bots: 'chill' },
    openSeat: 'A bot climbs here if nobody joins', seatWord: 'Climbers', seatLabels: { 1: 'Just us' },
    settings: pill => `
      <div class="opt"><b>Storm</b><div class="pills">${pill('pace', 'chill', 'Chill')}${pill('pace', 'normal', 'Normal')}${pill('pace', 'wild', 'Wild')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone's avatar climbs the same giant beanstalk at the same time, hopping from ledge to ledge while a storm rises from below. Run to build up speed, because the faster you run, the higher you jump. Chain big jumps for streak points, and stay ahead of the storm.`,
    rules: `<ol>
      <li>Everyone climbs the same beanstalk at once. You can see the others but you don't bump into them. Empty spots are bots.</li>
      <li>Run with <b>← →</b> or <b>A D</b> and jump with <b>Space</b> (hold it to keep hopping). On a phone, use the pads in the bottom corners.</li>
      <li><b>The faster you run, the higher you jump</b>: a standing hop clears one floor, a full sprint clears about five. You pass up through ledges and land on them coming down.</li>
      <li>The two side stalks <b>bounce you back</b> without slowing you down, so you can keep your speed by bouncing from side to side.</li>
      <li>Red <b>mushrooms</b> throw you about six floors up. Pale <b>dry leaves</b> drop a moment after you land on them. Ledges riding on little <b>clouds</b> slide from side to side.</li>
      <li>A <b>big jump</b> lands two or more floors higher than where you stood. Big jumps in a row make a <b>streak</b>, as long as each one comes within 3 seconds of the last. When the streak ends it pays <b>floors × jumps × 2</b> points. A small hop or a fall ends it.</li>
      <li>A <b>storm</b> rises from below, slowly at first and then faster and faster. If it catches you, you are out and watch the others.</li>
      <li>Your score is <b>10 points for every floor</b> of the highest floor you reached, plus your streak points. The game ends when the storm has caught everyone. Highest score wins.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  bop: {
    name: 'Burrow Bop', load: () => import('./games/bop/client.js'), start: 'Start bopping',
    mins: [1, 3],
    host: { seats: 4, pace: 'normal', bots: 'chill' }, solo: { seats: 4, pace: 'normal', bots: 'chill' },
    openSeat: 'A bot bops here if nobody joins', seatLabels: { 1: 'Just us' },
    settings: pill => `
      <div class="opt"><b>Speed</b><div class="pills">${pill('pace', 'calm', 'Calm')}${pill('pace', 'normal', 'Normal')}${pill('pace', 'fast', 'Fast')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone has their own garden with nine burrows and plays at the same time. Pets pop out of the burrows: tap one to bop it with your pillow mallet before it ducks back down. You have three hearts. A pet that gets away costs a heart, and so does bopping a sleeping pet in a nightcap. The pets come quicker and quicker. The last player with a heart wins.`,
    rules: `<ol>
      <li>Everyone has their <b>own garden</b> with nine burrows and plays at the <b>same time</b>. Everybody gets the same pets, in the same burrows, at the same moments. Empty seats are played by bots.</li>
      <li><b>Click or tap a pet</b> to bop it with your pillow mallet. On a keyboard the burrows are <b>Q W E</b>, <b>A S D</b> and <b>Z X C</b> (or the number pad).</li>
      <li>You have <b>3 hearts</b>. A pet that <b>ducks back down before you bop it</b> costs one heart.</li>
      <li>A pet in a <b>nightcap is asleep</b>. Let it sleep: bopping it costs a heart.</li>
      <li>A pet with a <b>crown</b> is worth 50 points instead of 10 and hides quickly. A pet carrying a <b>heart</b> gives a lost heart back. Missing either of them costs nothing.</li>
      <li>Every bop in a row adds <b>2 more points</b> to the next one, up to 20 extra. Losing a heart starts the run again.</li>
      <li>Tapping an <b>empty burrow costs nothing</b>.</li>
      <li>The pets come <b>quicker and quicker</b>. When your hearts run out you are <b>out</b>. The <b>last player with a heart wins</b>. If two players lose their last heart to the same pet, the higher score is placed higher.</li>
      <li>After <b>3 minutes</b> no more pets come, and whoever still has a heart is placed by <b>score</b>.</li>
      <li>Coins go by your place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  bingo: {
    name: 'Sky Bingo', load: () => import('./games/bingo/client.js'), start: 'Start the machine',
    mins: [5, 7],
    host: { seats: 4, game: 'classic', speed: 'normal', daub: 'hand', bots: 'chill' }, solo: { seats: 4, game: 'classic', speed: 'normal', daub: 'hand', bots: 'chill' },
    openSeat: 'A bot daubs here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Prizes</b><div class="pills">${pill('game', 'quick', 'Quick · one line')}${pill('game', 'classic', 'Classic · all three')}</div></div>
      <div class="opt"><b>Ball speed</b><div class="pills">${pill('speed', 'chill', 'Chill')}${pill('speed', 'normal', 'Normal')}${pill('speed', 'fast', 'Fast')}</div></div>
      <div class="opt"><b>Daubing</b><div class="pills">${pill('daub', 'hand', 'By hand')}${pill('daub', 'auto', 'Automatic')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `A machine draws a ball with a number every few seconds. Find the number on your card and tap it. When you have a full line, press Bingo before anybody else does. Then the game goes on for two lines and for the full card.`,
    rules: `<ol>
      <li>Everyone has their <b>own card</b> with 24 numbers and a free star in the middle. The <b>B</b> column holds numbers 1 to 15, <b>I</b> 16 to 30, <b>N</b> 31 to 45, <b>G</b> 46 to 60 and <b>O</b> 61 to 75. Empty seats are played by bots.</li>
      <li>The machine draws <b>one ball every few seconds</b>, 75 balls in all. The bar next to the ball shows how long until the next one.</li>
      <li><b>Tap the number</b> on your card when it is called. You can also daub it later: <b>Called</b> opens the list of every number drawn so far. Nobody daubs for you (unless the table uses automatic daubing).</li>
      <li>A <b>line</b> is five squares in a row, a column or a diagonal. The star in the middle counts for you.</li>
      <li>When your daubed squares make the prize, press <b>Bingo!</b> (or Space). The <b>first to shout</b> takes it, so two players who finish on the same ball race each other.</li>
      <li>A classic game has <b>three prizes</b> on the same cards: <b>one line</b> (10 points), then <b>two lines</b> (20), then the <b>full card</b> (40). A quick game ends with the first line.</li>
      <li><b>Most points wins.</b> Players level on points are placed by how close their card is to full.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last. A player who never daubs a number gets none.</li>
    </ol>`,
  },
  kal: {
    name: 'Sketch & Guess', load: () => import('./games/kal/client.js'), start: 'Start drawing', min: 2,
    mins: [10, 20],
    host: { rounds: 3, time: 80, lang: PL ? 'pl' : 'en', theme: 'all', hints: 'on' }, solo: { rounds: 3, time: 80, lang: PL ? 'pl' : 'en', theme: 'all', hints: 'on' },
    openSeat: 'Waiting for a friend (no bots in this game)',
    settings: pill => `<div class="opt"><b>Rounds</b><div class="pills">${pill('rounds', 2, '2')}${pill('rounds', 3, '3')}${pill('rounds', 5, '5')}</div></div>
      <div class="opt"><b>Time to draw</b><div class="pills">${pill('time', 60, '60s')}${pill('time', 80, '80s')}${pill('time', 120, '120s')}</div></div>
      <div class="opt"><b>Words in</b><div class="pills">${pill('lang', 'pl', 'Polski')}${pill('lang', 'en', 'English')}</div></div>
      <div class="opt"><b>Words about</b><div class="pills">${pill('theme', 'all', 'Everything')}${pill('theme', 'animals', 'Animals')}${pill('theme', 'food', 'Food')}${pill('theme', 'things', 'Things')}${pill('theme', 'nature', 'Nature and places')}${pill('theme', 'people', 'People and tales')}${pill('theme', 'fun', 'Rides and play')}${pill('theme', 'pets', 'Pet Farm pets')}</div></div>
      <div class="opt"><b>Letter hints</b><div class="pills">${pill('hints', 'on', 'On')}${pill('hints', 'off', 'Off')}</div></div>`,
    howto: `One player draws a secret word and everyone else types what they think it is. The faster you guess, the more points you get, and the drawer scores for every player who gets it. Everyone draws in turn. This game needs at least two people: there are no bots.`,
    rules: `<ol>
      <li>The game needs <b>2 to 8 people</b>. There are no bots, so the host can start once two players sit at the table.</li>
      <li>Each turn one player is the <b>drawer</b>. They get <b>three words</b> and 15 seconds to pick one. If they don't, one is picked for them.</li>
      <li>The drawer draws the word on the board with the pen, the eraser and the fill bucket. <b>No letters or numbers</b>, please: that spoils the fun.</li>
      <li>Everyone else <b>types guesses</b> in the box. Capital letters, Polish accents, spaces and dashes don't matter. A wrong guess is shown to everybody, a right one is kept secret.</li>
      <li>If your guess is one letter off, only you are told that it is <b>so close</b>.</li>
      <li>The blanks over the board show <b>how long the word is</b>. As time runs out a few letters appear (the table can turn this off).</li>
      <li>A right guess scores <b>100 points</b> at the start of the turn, sliding down to <b>40</b> at the end. The drawer scores the <b>average</b> of what the guessers got, so a drawing that everyone guesses quickly pays the most.</li>
      <li>The turn ends when everyone has guessed or the time is up. The drawer can also <b>give up</b> a word. After a guess you can still chat, but only with the players who already know the word.</li>
      <li>In a round everybody draws once. After the last round <b>the most points wins</b>. A friend who joins late can sit down at the next turn.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last. A player who never draws a line and never types a guess gets none.</li>
    </ol>`,
  },
  pm: {
    name: 'Countries & Cities', load: () => import('./games/pm/client.js'), start: 'Draw the first letter', min: 2,
    mins: [8, 12],
    host: { rounds: 5, time: 90, cats: 'classic', letters: 'easy', pet: 'off' }, solo: { rounds: 5, time: 90, cats: 'classic', letters: 'easy', pet: 'off' },
    openSeat: 'Waiting for a friend (no bots in this game)',
    settings: pill => `<div class="opt"><b>Rounds</b><div class="pills">${pill('rounds', 3, '3')}${pill('rounds', 5, '5')}${pill('rounds', 8, '8')}</div></div>
      <div class="opt"><b>Time to write</b><div class="pills">${pill('time', 60, '60 s')}${pill('time', 90, '90 s')}${pill('time', 120, '120 s')}</div></div>
      <div class="opt"><b>Categories</b><div class="pills">${pill('cats', 'short', '4')}${pill('cats', 'classic', '6')}${pill('cats', 'long', '8')}</div></div>
      <div class="opt"><b>Letters</b><div class="pills">${pill('letters', 'easy', 'Easy')}${pill('letters', 'pl', 'With Ł, Ś, Ż')}</div></div>
      <div class="opt"><b>Extra category: Pet Farm pet</b><div class="pills">${pill('pet', 'off', 'Off')}${pill('pet', 'on', 'On')}</div></div>`,
    howto: `A letter is drawn and everyone writes a country, a city, an animal and more, all starting with that letter. Fill every box first and press Stop, or beat the clock. Then the table checks the answers: a word nobody else wrote scores the most.`,
    rules: `<ol>
      <li>A game for <b>2 to 8 people</b>. There are no bots. Every round a <b>letter is drawn</b>, and no letter comes up twice in one game.</li>
      <li>Write <b>one word in every category</b> that starts with the letter: country, city, animal, plant, name and thing (the table can play with 4 or 8 categories too). Nobody sees your words until the round is over.</li>
      <li>When you have a word in every box, you can press <b>Stop!</b> The others then get <b>5 more seconds</b>. If nobody stops, the round ends when the time runs out.</li>
      <li>Then <b>everyone checks the answers</b> together. Tap the thumb next to a word that is wrong. A word is thrown out when <b>more than half of the other players</b> reject it. Players who wrote the same word are judged together. Press <b>Ready</b> when you are done.</li>
      <li>The game checks the <b>first letter</b> by itself, and it must be exactly the drawn one: Polish letters such as Ż, Ś or Ł are letters of their own, so “Żaba” does not count for Z. With the <b>Pet Farm pet</b> category on, the game also checks that the word is a real pet, and closes that box in rounds where no pet starts with the letter.</li>
      <li>Points for each category: <b>15</b> when yours is the only good answer, <b>10</b> for a word nobody else wrote, <b>5</b> when somebody else wrote it too, <b>0</b> for an empty or rejected one. Capitals and accents don't make a word different: “Krakow” and “Kraków” are the same answer.</li>
      <li><b>Most points after the last round wins.</b> Players level on points share the place.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last. A player who never writes a word gets none.</li>
    </ol>`,
  },
  ttt: {
    name: 'Tic-Tac-Toe', load: () => import('./games/ttt/client.js'), start: 'Start the match',
    mins: [3, 5],
    host: { mode: 'classic', to: 3, bots: 'chill', timer: 20 }, solo: { mode: 'classic', to: 3, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `<div class="opt"><b>Board</b><div class="pills">${pill('mode', 'classic', 'Classic 3×3')}${pill('mode', 'fade', 'Vanishing 3×3')}${pill('mode', 'big', 'Big 5×5')}</div></div>
      <div class="opt"><b>Match</b><div class="pills">${pill('to', 1, 'One round')}${pill('to', 2, 'First to 2')}${pill('to', 3, 'First to 3')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 10, '10s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Take turns putting your mark on the board. Line up three in a row, a column or a diagonal to win the round. The first to win three rounds takes the match.`,
    rules: `<ol>
      <li><b>Two players</b>, one board. One plays <b>crosses</b>, the other <b>noughts</b>, each in their own colour. An empty seat is played by a bot.</li>
      <li>Take turns putting <b>one mark</b> on an empty square: tap it, or move with the arrow keys and press Enter.</li>
      <li>The first to get <b>three in a line</b> (a row, a column or a diagonal) wins the round. A full board with no line is a <b>draw</b> and nobody scores.</li>
      <li>A match is won by the <b>first to three rounds</b> (or two, or a single round: pick it in the table settings). Whoever started a round goes second in the next one.</li>
      <li><b>Vanishing 3×3</b>: you only ever keep <b>three marks</b>. When you place a fourth, your oldest one vanishes. The mark that is about to go is shown faded while it is your turn. The board never fills up, so you have to set a trap.</li>
      <li><b>Big 5×5</b>: a bigger board where you need <b>four in a line</b>.</li>
      <li>You have <b>20 seconds</b> a turn (table settings). Run out and a mark is placed for you.</li>
      <li>Draws cannot drag a match out for ever: after 9 rounds (7 when playing to two, 5 for a single round) whoever has won more rounds takes the match. Level on rounds is a drawn match.</li>
      <li>Coins go by your final place: <b>10 for the winner</b>, 1 for second place.</li>
    </ol>`,
  },
  chess: {
    name: 'Chess', load: () => import('./games/chess/client.js'), start: 'Start the game',
    mins: [10, 25],
    host: { clock: '10+5', bots: 'easy' }, solo: { clock: 'off', bots: 'easy' },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `<div class="opt"><b>Clock</b><div class="pills">${pill('clock', 'off', 'No clock')}${pill('clock', '3+2', '3 min + 2s')}${pill('clock', '5+3', '5 min + 3s')}${pill('clock', '10+5', '10 min + 5s')}${pill('clock', '15+10', '15 min + 10s')}</div></div>
      <div class="opt"><b>Bot</b><div class="pills">${pill('bots', 'easy', 'Beginner')}${pill('bots', 'club', 'Club')}${pill('bots', 'sharp', 'Strong')}</div></div>`,
    howto: `Classic chess for two. Tap one of your pieces to see where it can go, then tap a square to move it there. Trap the other king so it cannot escape to win: that is checkmate.`,
    rules: `<ol>
      <li><b>Two players</b>, White and Black. White moves first. Who gets White is drawn at random, and a rematch swaps the colours. An empty seat is played by a bot (Beginner, Club or Strong: pick it in the table settings).</li>
      <li><b>Tap a piece</b> to see its moves: dots are free squares, red rings are pieces it can take. Tap one of them to move. The arrow keys and Enter work too.</li>
      <li><b>How the pieces move.</b> Rook: straight lines. Bishop: diagonals. Queen: both. Knight: an L shape, and it jumps over pieces. King: one square any way. Pawn: one square forward (two from its starting square), and it takes one square diagonally forward.</li>
      <li><b>Check</b> means your king is attacked: you have to get out of it. You may never make a move that leaves your own king attacked. The king in check glows red.</li>
      <li><b>Checkmate</b> (the king is in check and nothing saves it) wins the game.</li>
      <li><b>Castling</b>: once a game, if your king and a rook have not moved yet, the squares between them are empty and the king is not in check and does not cross or land on an attacked square, move the king <b>two squares towards the rook</b> and the rook hops over it.</li>
      <li><b>En passant</b>: when a pawn jumps two squares and lands beside your pawn, you may take it on your very next move as if it had moved only one.</li>
      <li><b>Promotion</b>: a pawn that reaches the far side turns into a queen, rook, bishop or knight of your choice.</li>
      <li>The game is a <b>draw</b> when the player to move has no legal move and is not in check (stalemate), when the same position comes up three times, after 50 moves by each side with no capture and no pawn move, when neither side has enough pieces left to mate, or when both players agree (Offer a draw).</li>
      <li><b>Clock</b> (table settings): each player has their own time, and a few seconds are added after every move. Run out of time and you lose, unless your opponent has only a king, or a king and a single knight or bishop: then it is a draw. With no clock you can think as long as you like.</li>
      <li>You can <b>resign</b> at any time: tap Resign twice.</li>
      <li>Coins go by your final place: <b>10 for the winner</b>, 1 for second place. A draw shares first place.</li>
    </ol>`,
  },
  cove: {
    name: 'Cove Clash', load: () => import('./games/cove/client.js'), start: 'Start the game',
    mins: [10, 15],
    host: { board: 'classic', bots: 'chill', timer: 20 }, solo: { board: 'classic', bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `<div class="opt"><b>Bay</b><div class="pills">${pill('board', 'classic', 'Classic 10×10')}${pill('board', 'quick', 'Quick 7×7')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 10, '10s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Hide your boats in your bay, then take turns lobbing coconuts at squares of the other bay. A hit gives you another shot. The first to sink the whole rival fleet wins.`,
    rules: `<ol>
      <li><b>Two players</b>, each with their own bay. An empty seat is played by a bot.</li>
      <li>First you <b>arrange your boats</b>: drag a boat to move it, tap it to turn it, or press <b>Shuffle</b> for a new random layout. Boats <b>can’t touch</b>, not even at the corners. Press <b>Ready</b> when you are happy. You have 60 seconds.</li>
      <li>The classic fleet is <b>ten boats</b>: one of 4 squares, two of 3, three of 2 and four of 1. The quick bay is 7×7 with six boats: one of 3, two of 2 and three of 1.</li>
      <li>Then you take turns. <b>Tap a square</b> in the other bay to lob a coconut at it (or move with the arrow keys and press Enter).</li>
      <li>A splash means a <b>miss</b>, and the turn passes. A red cross means a <b>hit</b>, and you <b>shoot again</b>.</li>
      <li>When every square of a boat is hit it is <b>sunk</b>: the boat shows itself and the water around it is marked for you, because no other boat can be there. The crew is fine: they float in a swim ring.</li>
      <li>You have <b>20 seconds</b> a shot (table settings). Run out and a random shot is taken for you.</li>
      <li>The first to <b>sink the whole rival fleet</b> wins.</li>
      <li>Coins go by your final place: <b>10 for the winner</b>, 1 for second place.</li>
    </ol>`,
  },
  domino: {
    name: 'Dominoes', load: () => import('./games/domino/client.js'), start: 'Deal the tiles',
    mins: [15, 25],
    host: { seats: 4, to: 100, bots: 'chill', timer: 20 }, solo: { seats: 4, to: 100, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays these tiles if nobody joins',
    settings: pill => `
      <div class="opt"><b>Match</b><div class="pills">${pill('to', 0, 'One round')}${pill('to', 50, 'To 50')}${pill('to', 100, 'To 100')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Take turns adding a tile to the line: one of its numbers has to match an open end. If nothing fits, draw from the pile. Be the first to put down your last tile to win the round and score the pips the others are left holding.`,
    rules: `<ol>
      <li>A set of <b>28 tiles</b> with numbers from blank to six. With two players everyone gets <b>7 tiles</b>, with three or four <b>5 tiles</b>. The rest are the <b>pile</b>. Empty seats are played by bots.</li>
      <li>In the first round, whoever holds the <b>highest double</b> starts with it. After that, the <b>winner of the last round</b> starts with any tile.</li>
      <li>On your turn, add <b>one tile</b> to either end of the line. One of its numbers has to <b>match the open end</b> it touches. Doubles are laid crosswise. Tiles you can play are lifted: tap one.</li>
      <li>When a tile fits <b>both ends</b>, tap it and then tap one of the two yellow buttons on the table to choose the end.</li>
      <li>If nothing you hold fits, <b>draw from the pile</b> until something does. When the pile is empty, you <b>pass</b>.</li>
      <li>The first to put down their last tile calls <b>domino</b>, wins the round, and scores <b>every pip</b> left in the other players' hands.</li>
      <li>If nobody can move, the line is <b>blocked</b>: the lightest hand wins the round and scores the others' pips minus its own. If the lightest hands are level, nobody scores.</li>
      <li>The match goes to <b>100 points</b> (or 50, or a single round: pick it in the table settings). In a single round, the places after the winner go to the lighter hands.</li>
      <li>You have <b>20 seconds</b> a turn (table settings). Run out and a tile is played for you.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  pan: {
    name: 'Pan', load: () => import('./games/pan/client.js'), start: 'Deal the cards',
    mins: [5, 10],
    host: { seats: 4, bots: 'chill', timer: 30 }, solo: { seats: 4, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays this hand if nobody joins',
    settings: pill => `
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The Polish card game with the 24 cards from nine to ace. Put down a card at least as high as the one on top, or pick up three from the pile. Get rid of all your cards to be safe: the last one still holding cards is the Pan.`,
    rules: `<ol>
      <li>The <b>24 cards</b> from nine to ace are dealt out evenly. Whoever holds the <b>nine of hearts</b> starts by putting it down. Empty seats are played by bots.</li>
      <li>On your turn, put down <b>one card that is the same or higher</b> than the card on top of the pile.</li>
      <li><b>Spades go backwards</b>: when you put down a spade, the next turn goes to the player <b>before</b> you instead of the one after. The direction does not change: after their turn, play carries on round the table as usual.</li>
      <li>If you hold <b>all four</b> cards of a rank that fits, you can put them down together. The three other nines can go together straight onto the nine of hearts.</li>
      <li>Instead of playing you can <b>pick up the top three cards</b> of the pile. You have to when nothing you hold fits. The nine of hearts always stays at the bottom.</li>
      <li>The pile only ever climbs, so a low card can only go after someone picks the pile back down. Picking up on purpose is part of the game.</li>
      <li>Run out of cards and you are <b>safe</b>. The first one out wins, and the <b>last player still holding cards is the Pan</b>.</li>
      <li>Five players sit at a table for six: a bot takes the spare hand, so the cards still share out evenly.</li>
      <li>Shortcuts: <b>Enter</b> plays your lowest card that fits, <b>T</b> takes three.</li>
    </ol>`,
  },
  wojna: {
    name: 'Wojna', load: () => import('./games/wojna/client.js'), start: 'Deal the cards',
    mins: [2, 4],
    host: { seats: 2, deck: 'full', rounds: 60, timer: 5 }, solo: { seats: 2, deck: 'full', rounds: 60, timer: 5 },
    openSeat: 'A bot turns these cards if nobody joins',
    settings: pill => `
      <div class="opt"><b>Deck</b><div class="pills">${pill('deck', 'full', '52 cards')}${pill('deck', 'small', '24 cards')}</div></div>
      <div class="opt"><b>Battles</b><div class="pills">${pill('rounds', 30, '30')}${pill('rounds', 60, '60')}${pill('rounds', 120, '120')}</div></div>
      <div class="opt"><b>Flip timer</b><div class="pills">${pill('timer', 3, '3s')}${pill('timer', 5, '5s')}${pill('timer', 10, '10s')}</div></div>`,
    howto: `War, the Polish children's classic. Everyone turns over the top card of their pile and the highest card takes them all. Equal cards mean war: one more card face down, one face up, winner takes the lot. Hold the most cards after the last battle to win.`,
    rules: `<ol>
      <li>The deck is dealt out evenly, face down. Nobody looks at their cards. Empty seats are played by bots.</li>
      <li>In every <b>battle</b> all players turn over the <b>top card</b> of their pile. The <b>highest card takes them all</b>. Two is the lowest, ace the highest, suits do not matter.</li>
      <li>When the highest cards are <b>equal</b>, those players go to <b>war</b>: each puts <b>one card face down and one face up</b>. The higher new card takes everything on the table. Equal again means another war.</li>
      <li>A player who is down to their last card in a war plays it face up. With no cards left, the card they already have on the table fights on.</li>
      <li>Won cards go <b>under your pile</b> in a mixed-up order, so no game ever goes in circles.</li>
      <li>Run out of cards and you are <b>out</b>. Take every card and you win on the spot.</li>
      <li>Otherwise the game ends after the set number of battles and the <b>biggest pile wins</b>. Equal biggest piles play extra battles until one is bigger.</li>
      <li>Tap <b>Flip</b>, the table, <b>Space</b> or <b>Enter</b> to turn your card. Wait too long and it is turned for you. <b>Auto</b> (key <b>A</b>) turns every card for you.</li>
      <li>With three players and 52 cards the two of clubs is left out, so everyone starts with 17.</li>
    </ol>`,
  },
  piotr: {
    name: 'Piotruś', load: () => import('./games/piotr/client.js'), start: 'Deal the cards',
    mins: [5, 8],
    host: { seats: 4, deck: 'small', timer: 20 }, solo: { seats: 4, deck: 'small', timer: 0 },
    openSeat: 'A bot holds these cards if nobody joins',
    settings: pill => `
      <div class="opt"><b>Deck</b><div class="pills">${pill('deck', 'small', '12 pairs')}${pill('deck', 'big', '16 pairs')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The Polish children's classic, known elsewhere as Old Maid. The deck is pairs of pets plus one card with no pair: the Piotruś. Lay down your pairs, then take turns drawing a face-down card from the player on your right. Whoever is left holding the Piotruś loses.`,
    rules: `<ol>
      <li>The deck is <b>12 pairs of pets</b> (16 in the big deck) and <b>one Piotruś</b>, the tuxedo cat with no pair. All the cards are dealt out, so some players may get one card more. Empty seats are played by bots.</li>
      <li>Everyone first <b>lays down every pair</b> they were dealt. That happens by itself.</li>
      <li>Then, going clockwise, each player <b>draws one card</b>, face down, from the player <b>on their right</b> (the one who played before them). You only see the backs.</li>
      <li>If the card you draw <b>makes a pair</b> with one you hold, the pair goes to the table. If not, you keep it.</li>
      <li>Everyone can see <b>which card you reach for</b> before you take it, so watch the other player's face. On a phone, tap a card to reach for it and tap it again to take it.</li>
      <li>You can <b>shuffle your own cards</b> at any time, so nobody can follow where the Piotruś went. A card you draw also lands at a random spot in your hand.</li>
      <li>Run out of cards and you are <b>safe</b>. The first one out wins. The player <b>left holding the Piotruś loses</b>.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
      <li>If the turn timer runs out, the card you were reaching for is taken, or a random one. Shortcuts: <b>← →</b> reach for a card, <b>Enter</b> takes it, <b>S</b> shuffles your cards.</li>
    </ol>`,
  },
  makao: {
    name: 'Makao', load: () => import('./games/makao/client.js'), start: 'Deal the cards',
    mins: [5, 10],
    host: { seats: 4, bots: 'chill', end: 'first', queens: 'off', kings: 'on', timer: 20 }, solo: { seats: 4, bots: 'chill', end: 'first', queens: 'off', kings: 'on', timer: 0 },
    openSeat: 'A bot plays this hand if nobody joins',
    settings: pill => `
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>The game ends</b><div class="pills">${pill('end', 'first', 'First one out wins')}${pill('end', 'last', 'Play to the last one')}</div></div>
      <div class="opt"><b>Queen on everything</b><div class="pills">${pill('queens', 'off', 'Off')}${pill('queens', 'on', 'On')}</div></div>
      <div class="opt"><b>Fighting kings</b><div class="pills">${pill('kings', 'on', 'On')}${pill('kings', 'off', 'Off')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The classic Polish card game with a normal 52-card deck. Put down a card of the same suit or the same rank as the one on top. Twos and threes make the next player draw, a four makes them wait, a Jack demands a rank and an Ace changes the suit. Say “Makao!” with one card left. First one out of cards wins.`,
    rules: `<ol>
      <li>A normal deck of <b>52 cards</b>. Everyone gets <b>5 cards</b> and one plain card is turned up. Empty seats are played by bots.</li>
      <li>On your turn put down a card of the same <b>suit</b> or the same <b>rank</b> as the card on top. You may put down <b>several cards of one rank</b> at once: tap them in order, the first one has to fit and the last one ends up on top.</li>
      <li>If you can't or don't want to, <b>draw a card</b>. If it fits, you may play it straight away or keep it. Either way your turn is over.</li>
      <li><b>2 and 3</b>: the next player draws 2 or 3 cards and misses the turn. They can <b>defend</b> with another 2 or 3 of the same rank or the same suit (or a fighting king of that suit), and then the cards add up for the player after them.</li>
      <li><b>King of hearts</b>: the next player draws 5. <b>King of spades</b>: the player <b>before you</b> draws 5, and play then carries on from them. A king can be answered with the other fighting king, or with a 2 or 3 of its suit. The kings of diamonds and clubs are plain cards.</li>
      <li><b>4</b>: the next player misses a turn. Another 4 passes it on, and the waits add up: two fours mean two missed turns.</li>
      <li><b>Jack</b>: you demand a rank from <b>5 to 10</b>. Everyone in turn, you last, has to play that rank or draw a card. A Jack on a Jack changes the demand.</li>
      <li><b>Ace</b>: you pick the suit that comes next. An Ace on an Ace changes it again.</li>
      <li><b>Queen</b>: a plain card, unless the table plays <b>Queen on everything</b>: then a Queen goes on any card and any card goes on a Queen (but it does not stop a 2, 3, 4, a king or a demand).</li>
      <li>When your play leaves you with <b>one card</b>, press <b>“Makao!”</b> before you play. Before your <b>last card</b>, press <b>“Po makale!”</b>. If you forget, anyone can press <b>Catch</b> before the next player moves and you draw <b>5 cards</b>. You can still save yourself by pressing it first.</li>
      <li>The <b>first one out of cards wins</b> and the others are placed by how few cards they hold. With <b>The game ends: Play to the last one</b> play goes on instead, places go in the order of getting out, and the last one holding cards loses.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
      <li>If the turn timer runs out, a bot plays the turn for you. Shortcuts: <b>Enter</b> plays a card that fits, <b>D</b> draws (or takes the cards, or waits), <b>K</b> keeps a drawn card, <b>1–4</b> pick a suit, <b>5–9 and 0</b> pick the demand, <b>M</b> says “Makao!” and <b>C</b> catches.</li>
    </ol>`,
  },
  parade: {
    name: 'Pet Parade', load: () => import('./games/parade/client.js'), start: 'Deal the cards',
    mins: [10, 15],
    host: { seats: 4, bots: 'chill', stack: 'off', timer: 20 }, solo: { seats: 4, bots: 'chill', stack: 'off', timer: 0 },
    openSeat: 'A bot plays this hand if nobody joins',
    settings: pill => `
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Pass on Gifts and Rockslides</b><div class="pills">${pill('stack', 'off', 'Off')}${pill('stack', 'on', 'On')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 15, '15s')}${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `A colour-matching card game with Pet Farm pets. Put down a card of the same colour or the same number or sign as the one on top, or a grey wild card. Can't? Draw one. Down to your last card, say “Last one!”. First one out of cards wins.`,
    rules: `<ol>
      <li>The deck has <b>104 cards</b> in the four element colours, <b>Leaf, Ember, Tide and Spark</b>: the numbers <b>1 to 9</b> twice in each colour, each with its own pet, and two of each action card. There are also <b>8 grey Stone wild cards</b>. Everyone gets <b>7 cards</b> and one number card is turned up. Empty seats are played by bots.</li>
      <li>On your turn put down <b>one card</b> that matches the top card's <b>colour</b>, or its <b>number</b> or sign. A grey wild card goes on anything.</li>
      <li>If you can't or don't want to, <b>draw a card</b>. If it fits, you may play it straight away or keep it. Either way your turn is over.</li>
      <li><b>Nap</b> (moon): the next player misses a turn. <b>Turnabout</b> (arrows): play turns the other way round the table; with two players it works like a Nap. <b>Gift +2</b>: the next player takes 2 cards and misses a turn.</li>
      <li><b>Pebble</b> (wild): you pick the colour that comes next. <b>Rockslide</b> (wild, +4): you pick the colour, and the next player takes 4 cards and misses a turn.</li>
      <li>With <b>Pass on Gifts and Rockslides</b> switched on, a player hit by a Gift may pass it on with another Gift or a Rockslide, and a Rockslide may be passed on with another Rockslide. The cards add up until someone takes them all.</li>
      <li>Down to <b>two cards</b>? Press <b>“Last one!”</b> before you play. If you forget, anyone can press <b>Catch</b> before the next player moves, and you take <b>2 cards</b>. You can still save yourself by pressing “Last one!” first.</li>
      <li>The first one <b>out of cards wins</b>. Everyone else is placed by the <b>points left in their hand</b>: numbers count their value, action cards 10 and wild cards 20. The fewer, the better.</li>
      <li>Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
      <li>If the turn timer runs out, a bot plays your turn. Shortcuts: <b>Enter</b> plays a card that fits, <b>D</b> draws, <b>K</b> keeps a drawn card, <b>1–4</b> pick a colour, <b>L</b> says “Last one!” and <b>C</b> catches.</li>
    </ol>`,
  },
  pips: {
    name: 'Pip Party', load: () => import('./games/pips/client.js'), start: 'Roll the dice',
    mins: [10, 15],
    host: { seats: 3, sheet: 'single', bots: 'chill', timer: 45 }, solo: { seats: 3, sheet: 'single', bots: 'chill', timer: 0 },
    openSeat: 'A bot fills this sheet if nobody joins',
    settings: pill => `
      <div class="opt"><b>Score sheet and rounds</b><div class="pills">${pill('sheet', 'single', 'Classic · 13')}${pill('sheet', 'triple', 'Triple · 39')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 60, '60s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Five dice and a score sheet with 13 boxes. Each turn you get up to three rolls, keeping any dice you like in between, then you write the roll into one empty box. Fill all 13 boxes; the highest total wins.`,
    rules: `<ol>
      <li>The game lasts <b>13 rounds</b>. On your turn, roll all <b>five dice</b>. You may roll <b>twice more</b>, and before each roll you choose which dice to <b>keep</b>. Empty seats are played by bots.</li>
      <li>Then write the roll into <b>one empty box</b> on your sheet. Every box is used once. If the roll does not fit the box you choose, it scores <b>0</b>, and sometimes that is the best you can do.</li>
      <li><b>Top half</b>, Ones to Sixes: add up only the dice showing that number. 4, 3, 4, 4, 1 is 12 in Fours or 3 in Threes.</li>
      <li>Reach <b>63 or more</b> in the top half (three of each number gets you there) for a <b>35 point bonus</b>.</li>
      <li><b>Three alike</b> and <b>Four alike</b>: all five dice added up, when at least three (or four) show the same number.</li>
      <li><b>Full house</b>, three of one number and two of another: <b>25</b>. <b>Small run</b>, four numbers in a row: <b>30</b>. <b>Big run</b>, five in a row: <b>40</b>.</li>
      <li><b>Pip Party</b>, all five dice the same: <b>50</b>. <b>Chance</b>: all five dice added up, whatever they show.</li>
      <li><b>More Pip Parties</b>: once your Pip Party box holds its 50, every further five of a kind pays a <b>100 point bonus</b> on top of whatever empty box you write it in, so your Pip Party box grows to 150, 250 and so on. If the top-half box for that number is already filled too, the roll is a <b>joker</b>: in the bottom half it also scores as a full house (25), small run (30), big run (40) or the dice added up.</li>
      <li><b>Triple sheet</b> (a table setting): everyone has <b>three columns</b> of the 13 boxes and the game lasts 39 rounds. You choose the column as well as the box. The second column counts <b>double</b> and the third <b>triple</b>, bonus included. A five of a kind pays the bonus of 100 times its column once all three Pip Party boxes scored 50 (and you never wrote a five of a kind elsewhere while one was empty), and it is a joker once all three top boxes for that number are filled too.</li>
      <li>After 13 rounds the <b>highest total</b> wins. Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
      <li>If the turn timer runs out, a bot finishes your turn. A box that would score 0 asks for a second tap. Shortcuts: <b>1</b> to <b>5</b> keep a die, <b>R</b> or <b>Space</b> rolls.</li>
    </ol>`,
  },
  bierki: {
    name: 'Bierki', load: () => import('./games/bierki/client.js'), start: 'Drop the sticks',
    mins: [3, 6],
    host: { seats: 2, piles: 1, hints: 'on', bots: 'chill', timer: 30 }, solo: { seats: 2, piles: 1, hints: 'on', bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Piles</b><div class="pills">${pill('piles', 1, 'One pile')}${pill('piles', 3, 'Three piles')}</div></div>
      <div class="opt"><b>Hints</b><div class="pills">${pill('hints', 'on', 'Touching sticks glow')}${pill('hints', 'off', 'No hints')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Pull timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Classic pick-up sticks. Drag one stick out of the pile, slowly, without moving any other. Every stick you get out is yours and you go again. When another stick moves, the next player is up.`,
    rules: `<ol>
      <li>The sticks are dropped in a <b>pile</b>: 31 of them, or 41 with five or six players. Empty seats are played by bots.</li>
      <li>On your turn, <b>drag a stick out of the pile</b>. Let go once it is clear of every other stick and it is yours. Then you <b>go again</b>.</li>
      <li>The <b>Steady hands</b> meter fills whenever your stick rubs another one: a little for sliding over a stick it rests on, a lot for dragging a stick that <b>lies on top</b> of it or for <b>pushing into</b> a stick beside it. A <b>fast pull fills it much faster</b>, so take your time.</li>
      <li>At <b>100%</b> another stick has moved: your turn ends and the stick you were holding is <b>out of play</b>. The same happens if a stick that lay on yours drops when yours is gone.</li>
      <li>You may let go inside the pile. The stick goes back, but what it already rubbed <b>stays on the meter</b> for the rest of your turn.</li>
      <li><b>Points</b>: plain wood 1, Leaf 2, Tide 3, Ember 4, Spark 5, a <b>pet stick</b> 8, the <b>Hook</b> 10 and the <b>Crown</b> 20. All four pet sticks in one hand pay <b>10 more</b>.</li>
      <li>Whoever holds the <b>Hook</b> may, once a turn, <b>lift</b> a stick straight up instead of sliding it: press Lift (or hold Shift) and drag upwards. Lifting does not rub the sticks underneath.</li>
      <li>With hints on (table settings), the sticks touching the one you point at <b>glow</b>: red for a stick lying on top of it, orange for the rest.</li>
      <li>Drag the table or the sky to <b>turn the view</b>, scroll or pinch to zoom.</li>
      <li>You have <b>30 seconds</b> for each stick (table settings). When the time runs out, the turn passes.</li>
      <li>When the table is empty, the <b>most points</b> wins. With three piles the points add up. Coins go by your final place: <b>10 for 1st</b>, down to 1 for last.</li>
    </ol>`,
  },
  pool: {
    name: 'Sky Pool', load: () => import('./games/pool/client.js'), start: 'Rack them up',
    mins: [8, 12],
    host: { seats: 2, to: 1, bots: 'chill', timer: 30 }, solo: { seats: 2, to: 1, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins',
    settings: pill => `
      <div class="opt"><b>Match</b><div class="pills">${pill('to', 1, 'One rack')}${pill('to', 2, 'Best of 3')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Shot timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `Classic 8-ball. One side pots the seven plain balls, the other the seven striped ones, and then the black. Drag on the table to aim, pull the cue back and let go. Pot a ball and you shoot again.`,
    rules: `<ol>
      <li><b>Two players</b>, or <b>two teams of two</b> whose partners take turns at the table. Empty seats are played by bots.</li>
      <li><b>Aim</b> by dragging on the table (a tap aims straight at that spot; the arrow buttons, the arrow keys or the mouse wheel make small corrections). Then <b>pull the cue back</b> on the strip at the bottom and let go: the further you pull, the harder the shot. The line shows where the white ball meets the first ball and which way that ball will go.</li>
      <li>The match starts with a <b>break</b>: the white ball may be placed anywhere behind the line. The table stays <b>open</b> after it, whatever went in.</li>
      <li>The first ball potted after the break decides the sides: whoever potted it plays that kind, <b>plain</b> or <b>striped</b>, and the other side gets the rest.</li>
      <li>Pot one of <b>your own</b> balls and you <b>shoot again</b>. Otherwise the other side comes to the table. Balls of theirs that you knock in stay in.</li>
      <li>A <b>foul</b> is: the white ball goes in, the white ball touches nothing, or it touches a wrong ball first (theirs, or the black while you still have balls left). After a foul the other side has the <b>ball in hand</b>: they may put the white ball anywhere.</li>
      <li>When all seven of your balls are down, pot the <b>black</b> to win the rack. There is no need to name a pocket.</li>
      <li>Pot the black <b>too early</b>, or with a foul, and you <b>lose the rack</b>. On the break the black just goes back on its spot.</li>
      <li>A match is <b>one rack</b> or <b>best of three</b> (table settings). The break changes sides every rack.</li>
      <li>You have <b>30 seconds</b> a shot (table settings). Run out and the game plays a clumsy shot for you.</li>
      <li>Coins go by your final place: <b>10 for the winners</b>. A match with a bot in it does not count for the rankings.</li>
    </ol>`,
  },
};

// Polish: the long texts (names, pitches, rules, setting labels) live in lang/hub-pl.js and are laid over the English.
const PLX = PL ? await import('./lang/hub-pl.js').catch(e => { console.error(e); return null; }) : null;
if (PLX) for (const [id, x] of Object.entries(PLX.GAMES_PL)) if (GAMES[id]) Object.assign(GAMES[id], x);
const optText = (s, game) => PLX?.OPT_PL[`${game}:${s}`] ?? PLX?.OPT_PL[s] ?? s; // a table setting's heading or pill label (a game's own form first)
const FARM_NAME = L('Pet Farm', 'Farma zwierzaków'), MP_NAME = L('Mystery Pet', 'Zagadkowy zwierzak');

const $app = document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const st = {
  name: LS.get('ct_name', ''), color: LS.get('ct_color', COLORS[Math.random() * COLORS.length | 0]),
  av: (() => { try { const a = JSON.parse(LS.get('ct_av', 'null')); return a ? cleanAv(a) : randomAv(); } catch { return randomAv(); } })(),
  rk: {}, rkTab: LS.get('ct_rk', 'overall'),
  hc: { log: null, max: 200, for: undefined }, // the hub's global chat
  tPage: 0, htab: 'games', gFilt: LS.get('ct_gf', 'all'), gSort: LS.get('ct_gs', 'hub'), // the open tables page, the phone's hub tab, the games filter
  token: LS.get('ct_token', ''), id: null, me: null, rooms: [], room: null, view: 'hub', game: null, gameLoading: null, lastState: null, farm: null,
};
// Solo games with no table: they open straight from the hub (like Pet Farm) and keep their progress on the account.
const SOLO = {
  hay: {
    name: 'Hay Hunch',
    mins: [2, 5],
    rules: `<ol>
      <li>Your field has <b>25 hay bales</b>. Under each one is a carrot bundle worth <b>×1, ×2 or ×3</b>, or a <b>napping pet</b>.</li>
      <li>The sign at the end of every row and column shows how many <b>carrots</b> it holds in total, and how many <b>pets</b> nap in it.</li>
      <li>Flip a bale to look underneath. Your <b>harvest</b> is multiplied by the carrots you find, so a ×2 and a ×3 make ×6.</li>
      <li>Find <b>every ×2 and ×3</b> to clear the field. You go up a level (there are 7), and the fields get more pets and bigger bundles.</li>
      <li>Wake a napping pet and the harvest scatters, and you go <b>down a level</b>.</li>
      <li>Not sure? <b>Take the harvest</b> home instead. It counts for the rankings and you stay on your level.</li>
      <li>Use <b>Mark</b> (or right-click) to note where you think pets nap, or what a bale might hold.</li>
      <li>Clearing a field pays <b>level + 2 coins</b>, up to 40 coins a day. After that you can keep playing for your best field.</li>
      <li>Keys: arrows to move, <b>Enter</b> to flip, <b>P</b> or <b>1</b>/<b>2</b>/<b>3</b> to mark, <b>B</b> to take the harvest.</li>
    </ol>`,
  },
  pop: {
    name: 'Pet Pop',
    mins: [2, 4],
    rules: `<ol>
      <li>The shelf is full of pets. <b>Swap two neighbours</b> so that <b>three or more of the same pet</b> stand in a line: they pop, and new pets drop in from the top.</li>
      <li>Swipe or drag a pet onto its neighbour, or click one and then the other. A swap that lines nothing up does not count.</li>
      <li>Each level has <b>goals</b> (pop enough of a pet, break the hay bales) and a set number of <b>moves</b>. Reach every goal before the moves run out.</li>
      <li><b>Four in a line</b> leaves a <b>Zoomer</b> (arrows): when it pops, it dashes along its whole row or column.</li>
      <li>An <b>L or a T</b> leaves a <b>Pouncer</b> (ring): when it pops, it clears the 3 × 3 patch around it.</li>
      <li><b>Five in a line</b> leaves a <b>Treat Bowl</b>: swap it with any pet and every pet of that kind comes running. Swapping two of these specials with each other does something bigger.</li>
      <li><b>Hay bales</b> cannot be moved. A match right next to one breaks it, and so does anything that pops through it. A bale in a wooden frame takes two hits.</li>
      <li>Finish with moves to spare for <b>up to 3 stars</b>. A cleared level pays <b>3 coins + 1 per star</b>, up to 40 coins a day. After that you can keep climbing levels for the rankings.</li>
      <li>Out of moves? The level stays the same and you get a fresh shelf. Keys: arrows to move, <b>Enter</b> to pick up a pet, then an arrow to swap it.</li>
    </ol>`,
  },
  mj: {
    name: 'Pet Mahjong',
    mins: [5, 10],
    rules: `<ol>
      <li>The board is a pile of tiles. Tap <b>two free tiles with the same picture</b> and the pair leaves the board. Clear every tile to finish the level.</li>
      <li>A tile is <b>free</b> when <b>nothing lies on top of it</b> and its <b>left or right side is open</b>. Tiles that are not free are a little darker.</li>
      <li>There are <b>leaves, berries and stars</b> counted 1 to 9, and nine <b>Pet Farm pets</b>. The number in the corner helps tell 6 from 7.</li>
      <li><b>Hint</b> (or the <b>H</b> key) shows a pair and costs 15 points.</li>
      <li>No pair left? <b>Shuffle</b> mixes the tiles that are still on the board. You can also shuffle earlier, but any shuffle costs a star.</li>
      <li>Every pair is worth <b>20 points</b>, and pairs made quickly one after another are worth more. Finishing fast adds a bonus.</li>
      <li>Up to <b>3 stars</b>: one for clearing the board, one for beating the time on the clock, one for not shuffling. The clock only runs while you play.</li>
      <li>A cleared level pays <b>3 coins + 1 per star</b>, up to 40 coins a day. After that you can keep climbing levels for the rankings.</li>
      <li>The boards grow from 24 tiles to 144. <b>New deal</b> starts the level again with fresh tiles.</li>
    </ol>`,
  },
};
if (PLX) for (const [id, x] of Object.entries(PLX.SOLO_PL)) if (SOLO[id]) Object.assign(SOLO[id], x);
const validCode = s => /^[A-Z0-9]{4}$/.test(s);
let pendingJoin = (location.hash.slice(1) || '').toUpperCase();
if (!validCode(pendingJoin)) pendingJoin = '';

// ---------- toasts ----------
export function toast(html, bad = false, ms = 2900) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = html;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- network ----------
// One live connection per browser token. Tabs share the token through localStorage, so a second tab
// takes the seat over and the first one is told it was replaced. A replaced tab stays quiet until the
// player clicks "Play here" (reconnecting on its own would kick the other tab, which would kick back...).
// A server restart (an update): the server says goodbye ({t:'bye'}, close code 1012), the bar says "back in a moment"
// and the page keeps knocking every second or two. Once it is back with other files (a new build), the page reloads
// itself, coming back to the same place (a table rejoins by itself; Pet Farm, Hay Hunch and Pet Pop reopen).
let ws = null, retry = 0, replaced = false, retryT = 0, stableT = 0, restarting = 0;
const $conn = document.getElementById('conn');
function connBar(mode) {
  if (!mode) { $conn.hidden = true; return; }
  $conn.hidden = false; $conn.classList.toggle('replaced', mode === 'replaced'); $conn.classList.toggle('restart', mode === 'restart');
  if (mode === 'restart') { $conn.innerHTML = `<b>${L('Back in a moment…', 'Zaraz wracamy…')}</b> ${L('The site is updating.', 'Strona się aktualizuje.')}`; return; }
  if (mode === 'replaced') {
    $conn.innerHTML = L(`${SITE} is open in another tab. <button type="button">Play here</button>`, `${SITE} jest otwarta w innej karcie. <button type="button">Graj tutaj</button>`);
    $conn.querySelector('button').onclick = () => { replaced = false; retry = 0; connBar('reconnecting'); connect(); };
  } else $conn.textContent = L('Reconnecting…', 'Łączenie ponownie…');
}
function connect() {
  clearTimeout(retryT); retryT = 0;
  if (replaced || (ws && ws.readyState <= 1)) return;
  const s = ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  s.onopen = () => {
    s.send(JSON.stringify({ t: 'hello', token: st.token, name: st.name || 'Guest', color: st.color, av: st.av }));
  };
  s.onmessage = e => {
    if (s !== ws) return;
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'replaced') { replaced = true; return; }
    if (m.t === 'bye') { restarting = Date.now(); connBar('restart'); return; }
    if (m.t === 'welcome') {
      if (m.build && st.build && m.build !== st.build) return reloadForUpdate();
      st.build = m.build || st.build; restarting = 0; connBar(null); clearTimeout(stableT); stableT = setTimeout(() => { retry = 0; }, 10_000); }
    onMsg(m);
  };
  s.onclose = e => {
    if (s !== ws) return;
    clearTimeout(stableT);
    console.warn(`[cozy] connection closed: code ${e.code}${e.reason ? ' ' + e.reason : ''}${replaced ? ' (replaced by another tab)' : ''}`);
    if (replaced || e.code === 4000) { replaced = true; connBar('replaced'); return; }
    if (e.code === 1012 && !restarting) restarting = Date.now();
    const upd = restarting && Date.now() - restarting < 3 * 60_000; // an update usually takes seconds: knock often for a few minutes
    connBar(upd ? 'restart' : 'reconnecting');
    // back off with jitter so a flaky network or a restarting server isn't hammered
    const wait = upd ? 1000 + Math.random() * 1000 : Math.min(10_000, 500 * 2 ** Math.min(retry++, 5)) * (0.7 + Math.random() * 0.6);
    retryT = setTimeout(connect, wait);
  };
}
// coming back to the tab or the network: try right away instead of waiting out the backoff
const reconnectNow = () => { if (!replaced && retryT) { retry = 0; connect(); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnectNow(); });
addEventListener('online', reconnectNow);
export function send(m) { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); }
function reloadForUpdate() {
  try { if (['farm', 'hay', 'pop', 'mj'].includes(st.view)) sessionStorage.setItem('ct_resume', st.view); } catch {}
  $conn.hidden = false; $conn.classList.add('restart'); $conn.innerHTML = `<b>${L('Updated!', 'Zaktualizowane!')}</b> ${L('Loading the new version…', 'Wczytywanie nowej wersji…')}`;
  ws?.close(); ws = null; replaced = true; // no more reconnects from this copy of the page
  location.reload();
}
function resumeAfterUpdate() {
  let v = null; try { v = sessionStorage.getItem('ct_resume'); sessionStorage.removeItem('ct_resume'); } catch {}
  if (!v || !st.name || st.room || st.view !== 'hub') return;
  if (v === 'farm') openFarm(); else if (v === 'hay') openHay(); else if (v === 'pop') openPop(); else if (v === 'mj') openMj();
}

function onMsg(m) {
  if (m.t === 'welcome') {
    st.token = m.token; st.id = m.id; LS.set('ct_token', m.token);
    if (pendingJoin && st.name) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
    st.farm?.reopen(); st.hay?.reopen(); st.pop?.reopen(); st.mj?.reopen(); // back after a dropped connection
    tellWhere(); setTimeout(resumeAfterUpdate, 300); // after a reload for an update (a table, if any, is back by then)
    if (st.view === 'hub') { send({ t: 'rankings', game: st.rkTab }); send({ t: 'hubchat' }); send({ t: 'daily' }); send({ t: 'word' }); send({ t: 'wheel' }); }
  } else if (m.t === 'pets') {
    st.pets = m.pets || []; st.decor = m.decor || []; st.farmBrief = m.farm ? { ...m.farm, at: Date.now() } : null; st.onMe?.(); if (st.view === 'hub') { mountSkyHero(); paintToday(); }
  } else if (m.t === 'player') {
    openPlayer(m.p);
  } else if (m.t === 'me') {
    st.skyWas = st.me?.user === m.me.user ? st.me.sky : null; st.me = m.me; st.meAt = Date.now(); setMyFx(flairOf(m.me).wn | 0);
    // Logged in: the look saved with the account is the only truth. Wear it (and keep it in this browser) before
    // anything else, the language reload below included, so an old guest look here can never be sent back over it.
    let adopted = false;
    if (m.me.user) {
      adopted = adoptLook; adoptLook = false;
      st.name = m.me.name || st.name; st.color = m.me.color || st.color; if (m.me.av) st.av = cleanAv(m.me.av);
      LS.set('ct_name', st.name); LS.set('ct_color', st.color); LS.set('ct_av', JSON.stringify(st.av));
    }
    // The language follows the account: the last pick made while logged in wins on every device.
    if (m.me.user && m.me.lang && m.me.lang !== LANG) return setLang(m.me.lang);
    if (m.me.user && !m.me.lang && picked()) send({ t: 'lang', v: LANG });
    // Wearing something this profile has not bought (say, after logging out): take it off here too.
    if (!m.me.user && !st.creatorOpen && lockedIn(st.av, m.me.owned).length) {
      st.av = wearable(st.av, m.me.owned); LS.set('ct_av', JSON.stringify(st.av)); send({ t: 'profile', name: st.name, color: st.color, av: st.av });
    }
    st.onMe?.(); emojiPaint();
    if (!!m.me.admin !== !!st.noticeAdmin) { st.noticeAdmin = !!m.me.admin; send({ t: 'notice' }); } // a host just logged in (or out): with or without the hosts' extras
    if (m.gain) {
      const cg = m.gain.coins | 0;
      const pl = m.gain.place;
      toast(`${m.gain.win ? L('Win! ', 'Wygrana! ') : pl > 1 && m.gain.of > 1 ? `${ord(pl)} ${L('place', 'miejsce')} · ` : ''}+${m.gain.xp} XP${cg ? ` · ${cg > 0 ? '+' : '−'}${cnt(Math.abs(cg), 'coin', 'coins', 'moneta', 'monety', 'monet')}` : ''}${m.gain.ranked === false ? L(' · played with bots, not ranked', ' · gra z botami, bez rankingu') : ''}`);
      if (m.gain.levelUp) { sfx.join(); toast(`<span class="tic">${rankIcon(rankOf(m.me.level).icon)}</span> ${L('Level', 'Poziom')} ${m.me.level}: ${esc(rankOf(m.me.level).name)}`); }
      if (st.skyWas && m.me.sky?.stars > st.skyWas.stars) { sfx.win?.(); toast(`★ ${L('A new star! Light it in Profile › Your sky.', 'Nowa gwiazda! Zapal ją w: Profil › Twoje niebo.')}`); }
    }
    if (st.view === 'hub') { if (adopted) renderHub(); else { paintMe(); mountSkyHero(); } } else if (st.view === 'lobby') renderLobby(); else if (st.view === 'farm') st.farm?.me(); else if (st.view === 'hay') st.hay?.me(); else if (st.view === 'pop') st.pop?.me(); else if (st.view === 'mj') st.mj?.me();
    if (m.me.user !== st.dailyFor) { st.dailyFor = m.me.user; if (st.view === 'hub' || st.daily) send({ t: 'daily' }); send({ t: 'word' }); send({ t: 'wheel' }); }
    if (m.me.user !== st.hc.for) { st.hc.for = m.me.user; paintHubFoot(); if (st.view === 'hub') send({ t: 'hubchat' }); }
    if (m.me.user !== st.friendsFor) { st.friendsFor = m.me.user; st.friends = null; if (m.me.user) send({ t: 'friends' }); paintFriends(); }
  } else if (m.t === 'friends') {
    st.friends = { friends: m.friends || [], reqs: m.reqs || [], sent: m.sent || [] };
    if (m.news) { sfx.join(); toast(m.news.now ? L(`${esc(m.news.from)} and you are now friends!`, `${esc(m.news.from)} i ty jesteście teraz znajomymi!`) : L(`${esc(m.news.from)} wants to be friends. Open Friends to answer.`, `${esc(m.news.from)} zaprasza cię do znajomych. Otwórz Znajomych, żeby odpowiedzieć.`)); }
    paintFriends();
  } else if (m.t === 'friended') {
    if (playerSheet?.pt) send({ t: 'player', pt: playerSheet.pt }); // the open profile card shows the new state
    { const now = L(`You and ${esc(m.user)} are now friends!`, `Ty i ${esc(m.user)} jesteście teraz znajomymi!`);
    toast(m.op === 'add' ? (m.now ? now : L(`Asked ${esc(m.user)} to be friends.`, `Zaproszenie do znajomych wysłane: ${esc(m.user)}.`)) : m.op === 'accept' ? now : m.op === 'remove' ? L(`${esc(m.user)} was removed from your friends.`, `${esc(m.user)} nie jest już na liście twoich znajomych.`) : L('Request declined.', 'Zaproszenie odrzucone.')); }
  } else if (m.t === 'farm') {
    if (st.farm) st.farm.msg(m);
    else if (m.invite) { farmInvite = m; toast(L(`${esc(m.invite.from)} invites you to a live battle. Open Pet Farm within a minute to answer.`, `${esc(m.invite.from)} zaprasza cię do walki na żywo. Otwórz Farmę zwierzaków w ciągu minuty, żeby odpowiedzieć.`)); }
  } else if (m.t === 'hay') {
    st.hay?.msg(m);
  } else if (m.t === 'pop') {
    st.pop?.msg(m);
  } else if (m.t === 'mj') {
    st.mj?.msg(m);
  } else if (m.t === 'word') {
    st.wordInfo = m; st.word?.msg(m); paintToday();
  } else if (m.t === 'daily') {
    st.dailyInfo = m; st.daily?.msg(m); paintToday();
  } else if (m.t === 'wheel') {
    if (!m.won) { st.wheelInfo = { ...m, at: Date.now() }; paintToday(); } // a fresh win reaches the tile when the wheel has stopped (spun below)
    st.wheel?.msg(m);
  } else if (m.t === 'rankings') {
    st.rk[m.game] = m; if (m.game === st.rkTab) paintRankings();
  } else if (m.t === 'hubchat') {
    onHubChat(m);
  } else if (m.t === 'stats') {
    st.stats = { online: m.online | 0, visitors: m.visitors | 0 }; paintStats(); if (whoSheet) send({ t: 'who' });
  } else if (m.t === 'notice') {
    onNotice(m);
  } else if (m.t === 'who') {
    st.who = m.list || []; paintWho();
  } else if (m.t === 'auth') {
    onAuth?.(m);
  } else if (m.t === 'rooms') {
    st.rooms = m.rooms || [];
    if (st.view === 'hub') renderTables();
  } else if (m.t === 'room') {
    const prev = st.room; st.room = m.room;
    if (m.room) { closeFarm(); closeHay(); closePop(); closeMj(); }
    if (!m.room || m.room.code !== prev?.code) chatReset();
    $chat.hidden = !m.room; scoresPaint();
    if (!m.room) { unmountGame(); st.lastState = null; watchPaint(); if (st.view !== 'farm' && st.view !== 'hay' && st.view !== 'pop' && st.view !== 'mj') go('hub'); return; }
    if (prev && prev.code === m.room.code) {
      const before = new Set(prev.players.map(p => p.id));
      const joined = m.room.players.filter(p => !before.has(p.id));
      if (joined.length) { sfx.join(); joined.forEach(p => toast(L(`${esc(p.name)} pulled up a chair`, `${esc(p.name)} dosiada się do stołu`))); }
    }
    if (st.game) st.game.room(m.room); else go('lobby');
    watchPaint();
  } else if (m.t === 'state') {
    // Each seat gets its player's cosmetics (fl), so a game can show their card back, dice, ball or kart paint.
    if (m.s?.seats && st.room) { const by = new Map(st.room.players.map(p => [p.id, p.fl])), nm = new Map(st.room.players.map(p => [p.name + '|' + p.color, p.fl])); // by seat id, or by name and colour where a game's seats carry no id
      for (const seat of m.s.seats) if (seat) seat.fl = (seat.id ? by.get(seat.id) : seat.bot && !seat.human ? null : nm.get(seat.name + '|' + seat.color)) || {};
      setSeatFx(m.s.seats.map(seat => seat?.fl?.wn | 0)); } // in-game showers use each player's win effect
    st.lastState = m.s;
    if (!m.s) { unmountGame(); watchPaint(); if (st.room) go('lobby'); return; }
    mountGame().then(g => { g?.update(st.lastState); watchPaint(); });
  } else if (m.t === 'react') {
    if (st.game) st.game.react(m); else floatAt(document.querySelector(`.seat[data-pid="${CSS.escape(String(m.id))}"]`), m.k);
    sfx.pop();
  } else if (m.t === 'rkstale') { // someone left the rankings (an account was deleted): fetch them again
    st.rk = {}; if (st.view === 'hub') { send({ t: 'rankings', game: st.rkTab }); send({ t: 'daily' }); send({ t: 'word' }); send({ t: 'wheel' }); }
  } else if (m.t === 'chatlog') {
    chat.log = Array.isArray(m.log) ? m.log : []; chatPaint();
  } else if (m.t === 'chat') {
    chat.log.push(m); if (chat.log.length > 60) chat.log.shift();
    chatPaint();
    if (m.id !== st.id) {
      sfx.pop();
      if (!chat.open) { chat.unread++; chatBadge(); chatPeek(m); }
      st.game?.say?.(m);
    }
  } else if (m.t === 'bought') {
    sfx.join(); const [k, i] = m.id.split(':'); { const what = esc(COS[k] ? `${cosItem(k, +i).n} (${COS[k].label.toLowerCase()})` : itemName(k, +i)); toast(L(`Bought ${what}! It's yours to keep.`, `Kupione: ${what}! Zostaje z tobą na zawsze.`)); }
  } else if (m.t === 'kofi') {
    onKofi?.(m);
  } else if (m.t === 'pack') {
    sfx.join(); st.onPack?.(); st.onPack = null; toast(L('Thank you for your support! The Supporter pack is in your Wardrobe. ☕', 'Dziękujemy za wsparcie! Pakiet wspierających czeka w twojej Garderobie. ☕'));
  } else if (m.t === 'winfx') {
    playWinFx(m.k, { banner: m.id === st.id ? '' : L(`${m.name} wins!`, `Wygrywa ${m.name}!`) });
  } else if (m.t === 'err') {
    sfx.bad(); toast(esc(srvText(m.msg)), true);
  }
}

// ---------- game mounting ----------
// Each game adds its stylesheet to the page the first time it opens, and the page never reloads, so the sheet stays.
// Game CSS is not all scoped to the game (Hot Pot's .mini rule squashed the hub's games grid), so only the open
// game's sheets are switched on: going back to the hub or lobby, or into another game, turns the rest off.
const gameSheets = new Map(); // game key -> the <link>s it added
const sheetsNow = () => [...document.head.querySelectorAll('link[rel="stylesheet"]')];
function mountWithCss(key, mount) {
  const before = new Set(sheetsNow());
  const r = mount();
  const added = sheetsNow().filter(l => !before.has(l));
  if (added.length) gameSheets.set(key, [...(gameSheets.get(key) || []), ...added]);
  // On a slow connection the game paints before its stylesheet arrives, and panels measured then are page wide
  // (the 3D table framed off to the side). When the sheet lands, games measure again as if the window was resized.
  for (const l of added) l.addEventListener('load', () => dispatchEvent(new Event('resize')), { once: true });
  gameCss(key);
  return r;
}
function gameCss(key) { for (const [k, links] of gameSheets) for (const l of links) l.disabled = k !== key; }

function mountGame() {
  if (st.game) return Promise.resolve(st.game);
  if (st.gameLoading) return st.gameLoading;
  const g = GAMES[st.room?.game];
  if (!g) return Promise.resolve(null);
  st.view = 'game';
  st.gameLoading = g.load().then(mod => {
    const game = st.room?.game;
    st.game = mountWithCss(game, () => mod.mount($app, {
      act: a => send({ t: 'act', a }), react: k => send({ t: 'react', k }),
      myId: () => st.id, room: () => st.room, isHost: () => st.room?.host === st.id,
      again: () => send({ t: 'start' }), vote: on => send({ t: 'again', on }), sit: on => send({ t: 'sit', on }), toLobby: () => send({ t: 'lobby' }), leave: () => send({ t: 'leave' }),
      toast, rules: () => openRules(st.room?.game),
    }));
    st.game.room(st.room); placeGameSwitch();
    st.gameLoading = null;
    return st.game;
  }).catch(err => { console.error(err); st.gameLoading = null; toast(L('Could not load the game. Refresh?', 'Nie udało się wczytać gry. Odświeżyć stronę?'), true); return null; });
  return st.gameLoading;
}
// Only switch the sheets off when something was really open: these also run on every table update (closeFarm/closeHay)
// and must not turn off the sheets of the game being played.
function unmountGame() { if (!st.game) return; st.game.destroy(); st.game = null; gameCss(null); }

// Pet Farm is a persistent game with no table: it opens straight from the hub.
let farmInvite = null, farmLoading = null, farmVisit = null; // farmVisit: a friend's farm to walk to once the farm has loaded
function openFarm() {
  if (st.farm || farmLoading) return;
  st.view = 'farm'; document.title = `${FARM_NAME} · ${SITE}`; tellWhere();
  $app.innerHTML = '<main class="wrap"><p style="padding:40px 0;font-family:var(--fd);font-size:22px">' + L('Walking to the farm…', 'Idziemy na farmę…') + '</p></main>';
  import('./games/farm/scene3d.js').catch(() => {}); // fetched alongside the farm's own code, not after it
  farmLoading = import('./games/farm/client.js').then(mod => {
    farmLoading = null;
    if (st.view !== 'farm') return;
    st.farm = mountWithCss('farm', () => mod.mount($app, { send: a => send({ t: 'farm', a }), toast, me: () => st.me, home: () => { closeFarm(); go('hub'); }, account: mode => openAccount(mode), friends: () => openFriends() }));
    st.farm.reopen(); placeGameSwitch();
    if (farmVisit) { st.farm.visit(farmVisit); farmVisit = null; }
    if (farmInvite) { st.farm.msg(farmInvite); farmInvite = null; }
  }).catch(err => { console.error(err); farmLoading = null; toast(L('Could not load Pet Farm. Refresh?', 'Nie udało się wczytać Farmy zwierzaków. Odświeżyć stronę?'), true); go('hub'); });
}
function closeFarm() { if (!st.farm) return; st.farm.destroy(); st.farm = null; gameCss(null); }

// Hay Hunch: the solo puzzle, also with no table.
let hayLoading = null;
function openHay() {
  if (st.hay || hayLoading) return;
  if (st.room) return toast(L('Leave this table first.', 'Najpierw wyjdź od tego stołu.'), true);
  st.view = 'hay'; document.title = `${SOLO.hay.name} · ${SITE}`; tellWhere();
  $app.innerHTML = '<main class="wrap"><p style="padding:40px 0;font-family:var(--fd);font-size:22px">' + L('Walking out to the hay field…', 'Idziemy na pole z sianem…') + '</p></main>';
  hayLoading = import('./games/hay/client.js').then(mod => {
    hayLoading = null;
    if (st.view !== 'hay') return;
    st.hay = mountWithCss('hay', () => mod.mount($app, { send: a => send({ t: 'hay', a }), toast, me: () => ({ ...(st.me || {}), color: st.color, av: st.av }), home: () => { closeHay(); go('hub'); }, account: mode => openAccount(mode), rules: () => openRules('hay') }));
    st.hay.reopen(); placeGameSwitch();
  }).catch(err => { console.error(err); hayLoading = null; toast(L('Could not load Hay Hunch. Refresh?', 'Nie udało się wczytać gry Szukanie w sianie. Odświeżyć stronę?'), true); go('hub'); });
}
function closeHay() { if (!st.hay) return; st.hay.destroy(); st.hay = null; gameCss(null); }
// Pet Pop: the solo swap-and-match puzzle, opened the same way.
let popLoading = null;
function openPop() {
  if (st.pop || popLoading) return;
  if (st.room) return toast(L('Leave this table first.', 'Najpierw wyjdź od tego stołu.'), true);
  st.view = 'pop'; document.title = `${SOLO.pop.name} · ${SITE}`; tellWhere();
  $app.innerHTML = '<main class="wrap"><p style="padding:40px 0;font-family:var(--fd);font-size:22px">' + L('Filling the pet shelf…', 'Układamy zwierzaki na półce…') + '</p></main>';
  popLoading = import('./games/pop/client.js').then(mod => {
    popLoading = null;
    if (st.view !== 'pop') return;
    st.pop = mountWithCss('pop', () => mod.mount($app, { send: a => send({ t: 'pop', a }), toast, me: () => ({ ...(st.me || {}), color: st.color, av: st.av }), home: () => { closePop(); go('hub'); }, account: mode => openAccount(mode), rules: () => openRules('pop') }));
    st.pop.reopen(); placeGameSwitch();
  }).catch(err => { console.error(err); popLoading = null; toast(L('Could not load Pet Pop. Refresh?', 'Nie udało się wczytać gry Zwierzakowe trójki. Odświeżyć stronę?'), true); go('hub'); });
}
function closePop() { if (!st.pop) return; st.pop.destroy(); st.pop = null; gameCss(null); }
// Pet Mahjong: the solo tile matching game, opened the same way.
let mjLoading = null;
function openMj() {
  if (st.mj || mjLoading) return;
  if (st.room) return toast(L('Leave this table first.', 'Najpierw wyjdź od tego stołu.'), true);
  st.view = 'mj'; document.title = `${SOLO.mj.name} · ${SITE}`; tellWhere();
  $app.innerHTML = '<main class="wrap"><p style="padding:40px 0;font-family:var(--fd);font-size:22px">' + L('Stacking the tiles…', 'Układamy płytki…') + '</p></main>';
  mjLoading = import('./games/mahj/solo.js').then(mod => {
    mjLoading = null;
    if (st.view !== 'mj') return;
    st.mj = mountWithCss('mj', () => mod.mount($app, { send: a => send({ t: 'mj', a }), toast, me: () => ({ ...(st.me || {}), color: st.color, av: st.av }), home: () => { closeMj(); go('hub'); }, account: mode => openAccount(mode), rules: () => openRules('mj') }));
    st.mj.reopen(); placeGameSwitch();
  }).catch(err => { console.error(err); mjLoading = null; toast(L('Could not load Pet Mahjong. Refresh?', 'Nie udało się wczytać gry Zwierzakowy mahjong. Odświeżyć stronę?'), true); go('hub'); });
}
function closeMj() { if (!st.mj) return; st.mj.destroy(); st.mj = null; gameCss(null); }
// Mystery Pet, the daily guess-the-pet puzzle, opens in a pop-up over the hub. The hub card shows today's state.
const leftText = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h >= 24 ? `${Math.floor(h / 24)}${L('d', ' d')} ${h % 24}${L('h', ' godz.')}` : h ? `${h}${L('h', ' godz.')} ${m % 60}${L('m', ' min')}` : `${m}${L('m', ' min')}`; };
const todayTile = (cls, pic, name, sub, act, btn, quiet, mins) => `<div class="ttile ${cls}">
  <div class="tpic" aria-hidden="true">${pic}</div>
  <div class="tbody"><b ${fitw(name)}>${name}</b><span>${sub}</span>${timeTag(mins, 'ttime')}</div>
  <button type="button" class="btn sm ${quiet ? 'w' : ''}" data-act="${act}">${btn}</button>
</div>`;
// One blocky emblem per Today tile, on a tinted square like Mystery Pet's: a hay bale with a carrot, and a little barn.
// The hub's Today column: the daily puzzle and the two solo games, each with the one thing worth knowing right now.
const MP_MINS = [1, 3]; // Mystery Pet: a few guesses
const WORD_NAME = L('Word in a Bottle', 'Słowo w butelce'), WORD_MINS = [2, 5], WORD_LANG = PL ? 'pl' : 'en'; // the hub tile shows the puzzle in the site's language
function todayHtml() {
  const d = st.dailyInfo, me = st.me, fire = d ? ` · 🔥 ${d.streak}` : '';
  const needAcct = L('Needs an account', 'Wymaga konta');
  const mp = !d ? L('A new pet hides here every day', 'Codziennie kryje się tu nowy zwierzak') : d.guest ? needAcct : d.done ? `<i class="ok">✓ ${L(`solved in ${d.guesses.length}`, `odgadnięte w ${d.guesses.length}`)}</i>${fire}`
    : d.guesses.length ? `${L(`${cnt(d.guesses.length, 'guess', 'guesses')} so far`, `${cnt(d.guesses.length, '', '', 'próba', 'próby', 'prób')} do tej pory`)}${fire}` : `${L('New pet today', 'Dziś nowy zwierzak')}${d.streak ? fire : ''}`;
  // Coin caps start again at midnight in Warsaw; me.next is how long that was away when the server last wrote.
  const toMid = me?.next ? me.next - (Date.now() - (st.meAt || Date.now())) : 0, fresh = me?.next && toMid <= 0;
  const back = toMid > 0 ? ` · ${L(`new coins in ${leftText(toMid)}`, `nowe monety za ${leftText(toMid)}`)}` : '';
  const paid = fresh ? 0 : me?.hay?.paid || 0;
  const hay = !me?.user ? needAcct : paid >= HAY_DAILY ? L(`All ${HAY_DAILY} coins earned today${back}`, `Dziś zdobyte wszystkie ${HAY_DAILY} monet${back}`) : L(`${HAY_DAILY - paid} coins left today · level ${me.hay?.lv || 1}`, `Dziś do zdobycia jeszcze ${cnt(HAY_DAILY - paid, '', '', 'moneta', 'monety', 'monet')} · poziom ${me.hay?.lv || 1}`);
  const popPaid = fresh ? 0 : me?.pop?.paid || 0, popLv = me?.pop?.lv || 1;
  const popText = !me?.user ? needAcct : popPaid >= POP_DAILY ? L(`All ${POP_DAILY} coins earned today${back}`, `Dziś zdobyte wszystkie ${POP_DAILY} monet${back}`) : L(`${POP_DAILY - popPaid} coins left today · level ${popLv}`, `Dziś do zdobycia jeszcze ${cnt(POP_DAILY - popPaid, '', '', 'moneta', 'monety', 'monet')} · poziom ${popLv}`);
  const mjPaid = fresh ? 0 : me?.mj?.paid || 0, mjLv = me?.mj?.lv || 1;
  const mjText = !me?.user ? needAcct : mjPaid >= MJ_DAILY ? L(`All ${MJ_DAILY} coins earned today${back}`, `Dziś zdobyte wszystkie ${MJ_DAILY} monet${back}`) : L(`${MJ_DAILY - mjPaid} coins left today · level ${mjLv}`, `Dziś do zdobycia jeszcze ${cnt(MJ_DAILY - mjPaid, '', '', 'moneta', 'monety', 'monet')} · poziom ${mjLv}`);
  const f = st.farmBrief, gone = f ? Date.now() - f.at : 0, eggLeft = f?.egg ? f.egg.left - gone : 0, tripLeft = f?.trip ? f.trip.left - gone : 0;
  const ownFarm = L('Your own pet farm', 'Twoja własna farma zwierzaków');
  const farm = !me?.user ? needAcct : !f ? ownFarm
    : f.egg && (f.egg.stage === 'ready' || (f.egg.stage === 'egg' && eggLeft <= 0)) ? `<i class="ok">${L('An egg is ready to hatch!', 'Jajko jest gotowe do wyklucia!')}</i>`
    : f.trip && tripLeft <= 0 ? `<i class="ok">${L('Your expedition is back!', 'Twoja wyprawa wróciła!')}</i>`
    : f.egg?.stage === 'egg' ? L(`Egg hatches in ${leftText(eggLeft)}`, `Jajko wykluje się za ${leftText(eggLeft)}`)
    : f.trip ? L(`Expedition back in ${leftText(tripLeft)}`, `Wyprawa wraca za ${leftText(tripLeft)}`)
    : f.pets ? L(`${cnt(f.pets, 'pet')} on your farm`, `${cnt(f.pets, '', '', 'zwierzak', 'zwierzaki', 'zwierzaków')} na twojej farmie`) : ownFarm;
  const w = st.wheelInfo, wLeft = w ? w.next - (Date.now() - (w.at || Date.now())) : 0, wheelText = !w ? L('One free spin a day', 'Jeden darmowy obrót dziennie') : w.guest ? needAcct : w.spun && wLeft > 0 ? L(`Next spin in ${leftText(w.next - (Date.now() - (w.at || Date.now())))}`, `Następny obrót za ${leftText(w.next - (Date.now() - (w.at || Date.now())))}`) : `<i class="ok">${L('Your free spin is ready!', 'Twój darmowy obrót czeka!')}</i>`;
  const mpPic = MYSTERY_ICON;
  const wi = st.wordInfo, ws = wi?.L?.[WORD_LANG], wfire = ws?.streak ? ` · 🔥 ${ws.streak}` : '';
  const wordText = !wi ? L('A new word washes up every day', 'Codziennie morze przynosi nowe słowo') : wi.guest ? needAcct
    : ws.done ? (ws.won ? `<i class="ok">✓ ${L(`solved in ${ws.rows.length} of ${wi.tries}`, `rozwiązane: ${ws.rows.length} z ${wi.tries}`)}</i>${wfire}` : L('Not this time. New word tomorrow', 'Nie tym razem. Jutro nowe słowo'))
    : ws.rows.length ? `${L(`${ws.rows.length} of ${wi.tries} tries used`, `wykorzystane próby: ${ws.rows.length} z ${wi.tries}`)}${wfire}` : `${L('New word today', 'Dziś nowe słowo')}${wfire}`;
  return todayTile('t-mp' + (d?.done ? ' done' : ''), mpPic, `${MP_NAME}${d ? ` <small>#${d.no}</small>` : ''}`, mp, 'daily', d?.done ? L('Result', 'Wynik') : d?.guesses?.length ? L('Go on', 'Graj dalej') : L('Guess', 'Zgaduj'), d?.done, MP_MINS)
    + todayTile('t-word' + (ws?.done ? ' done' : ''), WORD_ICON, `${WORD_NAME}${wi ? ` <small>#${wi.no}</small>` : ''}`, wordText, 'word', ws?.done ? L('Result', 'Wynik') : ws?.rows?.length ? L('Go on', 'Graj dalej') : L('Guess', 'Zgaduj'), ws?.done, WORD_MINS)
    + todayTile('t-wheel' + (w && !w.guest && !(w.spun && wLeft > 0) ? ' ready' : ''), WHEEL_ICON, L('Lucky Wheel', 'Koło szczęścia'), wheelText, 'wheel', w?.spun && wLeft > 0 ? L('Look', 'Zobacz') : L('Spin', 'Zakręć'), w?.spun && wLeft > 0)
    + todayTile('t-hay', HAY_ICON, SOLO.hay.name, hay, 'hay', L('Play', 'Graj'), false, SOLO.hay.mins)
    + todayTile('t-pop', POP_ICON, SOLO.pop.name, popText, 'pop', L('Play', 'Graj'), false, SOLO.pop.mins)
    + todayTile('t-mj', MJ_ICON, SOLO.mj.name, mjText, 'mj', L('Play', 'Graj'), false, SOLO.mj.mins)
    + todayTile('t-farm', FARM_ICON, FARM_NAME, farm, 'farm', L('Visit', 'Odwiedź'));
}
function paintToday() { const el = document.getElementById('today-list'); if (el) el.innerHTML = todayHtml(); }
setInterval(() => { if (st.view === 'hub' && (st.farmBrief || st.wheelInfo?.spun || st.me?.next)) paintToday(); }, 60_000); // keeps the countdowns honest
function openDaily() {
  if (st.daily) return;
  const sheet = modal(`<div class="mpbox"><p class="mpload">${L('Looking for today’s pet…', 'Szukamy dzisiejszego zwierzaka…')}</p></div>`);
  sheet.el.querySelector('.sheet').classList.add('wide', 'mpsheet');
  sheet.el.querySelector('.sheet').insertAdjacentHTML('afterbegin', `<button type="button" class="mpclose" aria-label="${L('Close', 'Zamknij')}">×</button>`);
  sheet.el.querySelector('.mpclose').addEventListener('click', () => { sfx.click(); sheet.close(); });
  let open = true;
  sheet.onClose = () => { open = false; st.daily?.destroy(); st.daily = null; };
  st.daily = { msg() {}, destroy() {} }; // holds the place while the pictures' code loads
  import('./daily.js').then(mod => {
    if (!open) return;
    st.daily = mod.mount(sheet.el.querySelector('.mpbox'), { send, toast, account: mode => openAccount(mode), close: () => sheet.close() });
  }).catch(err => { console.error(err); sheet.close(); toast(L('Could not load Mystery Pet. Refresh?', 'Nie udało się wczytać Zagadkowego zwierzaka. Odświeżyć stronę?'), true); });
}

// Word in a Bottle, the daily word puzzle, opens in a pop-up over the hub like Mystery Pet.
function openWord() {
  if (st.word) return;
  const sheet = modal(`<div class="wbbox"><p class="wbload">${L('Uncorking today’s bottle…', 'Odkorkowuję dzisiejszą butelkę…')}</p></div>`);
  sheet.el.querySelector('.sheet').classList.add('wbsheet');
  sheet.el.querySelector('.sheet').insertAdjacentHTML('afterbegin', `<button type="button" class="mpclose" aria-label="${L('Close', 'Zamknij')}">×</button>`);
  sheet.el.querySelector('.mpclose').addEventListener('click', () => { sfx.click(); sheet.close(); });
  let open = true;
  sheet.onClose = () => { open = false; st.word?.destroy(); st.word = null; };
  st.word = { msg() {}, destroy() {} }; // holds the place while the code loads
  import('./word.js').then(mod => {
    if (!open) return;
    st.word = mod.mount(sheet.el.querySelector('.wbbox'), { send, toast, account: mode => openAccount(mode), close: () => sheet.close(), lang: WORD_LANG });
  }).catch(err => { console.error(err); sheet.close(); toast(L('Could not load Word in a Bottle. Refresh?', 'Nie udało się wczytać Słowa w butelce. Odświeżyć stronę?'), true); });
}

// The Lucky Wheel, one free spin a day, opens in a pop-up over the hub like Mystery Pet.
function openWheel() {
  if (st.wheel) return;
  const sheet = modal(`<div class="lwbox"><p class="mpload">${L('Rolling the wheel out…', 'Wytaczamy koło…')}</p></div>`);
  sheet.el.querySelector('.sheet').classList.add('wide', 'mpsheet', 'lwsheet');
  sheet.el.querySelector('.sheet').insertAdjacentHTML('afterbegin', `<button type="button" class="mpclose" aria-label="${L('Close', 'Zamknij')}">×</button>`);
  sheet.el.querySelector('.mpclose').addEventListener('click', () => { sfx.click(); sheet.close(); });
  let open = true;
  sheet.onClose = () => { open = false; st.wheel?.destroy(); st.wheel = null; send({ t: 'wheel' }); };
  st.wheel = { msg() {}, destroy() {} }; // holds the place while the 3D code loads
  import('./wheel.js').then(mod => {
    if (!open) return;
    st.wheel = mod.mount(sheet.el.querySelector('.lwbox'), { send, toast, account: mode => { sheet.close(); openAccount(mode); }, close: () => sheet.close(), farm: () => { sheet.close(); openFarm(); }, spun: () => send({ t: 'wheel' }) });
  }).catch(err => { console.error(err); sheet.close(); toast(L('Could not load the Lucky Wheel. Refresh?', 'Nie udało się wczytać Koła szczęścia. Odświeżyć stronę?'), true); });
}

// ---------- views ----------
function go(view) {
  st.view = view; gameCss(null); tellWhere();
  document.title = view === 'lobby' && st.room ? `${st.room.code} · ${SITE}` : HOME_TITLE;
  if (view === 'hub') renderHub();
  else if (view === 'lobby') renderLobby();
}

let adoptLook = false, onAuth = null;
// The level chip beside a name. The rank is worked out from the level here, so chips saved long ago (old chat lines)
// and chips from the server always show today's ladder.
// `cn` is the finished constellation the player shows off: its tiny picture takes the place of the star count.
const lvChip = (lv, cn) => { const r = rankOf(lv), c = r.stars ? conOf(cn) : null;
  return `<span class="lv" title="${esc(r.name)}, ${L('level', 'poziom')} ${lv}${c ? `, ${L('constellation', 'gwiazdozbiór')}: ${esc(c.n)}` : ''}">${rankIcon(r.icon)} ${lv}${c ? `<i class="lvst lvcn">${conGlyph(c)}</i>` : r.stars ? `<i class="lvst">★${r.stars}</i>` : ''}</span>`; };
const meChip = () => st.me ? lvChip(st.me.level, st.me.sky?.shown) : '';

// The full progress card (rank, XP bar, lifetime numbers, every game). It opens from the account menu's Profile.
function meCard() {
  const m = st.me; if (!m) return '';
  const pct = Math.round(100 * m.into / m.need), rate = m.games ? Math.round(100 * m.wins / m.games) : 0;
  // every game played, most played first: table games get a win-rate bar, solo games their own line
  const per = Object.entries(m.byGame || {}).filter(([id]) => GAMES[id] || SOLO[id]).sort((a, b) => (b[1].games || 0) - (a[1].games || 0)).map(([id, g]) => {
    const solo = id === 'pop' || id === 'mj' ? L(`highest level cleared ${g.top || 0} · best ${num(g.best)} pts`, `najwyższy ukończony poziom: ${g.top || 0} · rekord ${num(g.best)} pkt`)
      : SOLO[id] ? L(`${cnt(g.wins, 'field')} cleared · best ×${num(g.best)}`, `${cnt(g.wins, '', '', 'oczyszczone pole', 'oczyszczone pola', 'oczyszczonych pól')} · rekord ×${num(g.best)}`) : '';
    if (solo) return `<li class="solo"><b>${esc(SOLO[id].name)}</b><span>${solo}</span></li>`;
    const r = g.games ? Math.round(100 * (g.wins || 0) / g.games) : 0;
    return `<li><b>${esc(GAMES[id].name)}</b><span class="pgbar" role="img" aria-label="${L(`win rate ${r}%`, `skuteczność ${r}%`)}"><i style="width:${r}%"></i></span><em>${r}%</em>
      <span>${L(`${cnt(g.wins || 0, 'win')} in ${num(g.games)} · best ${num(g.best)} pts`, `${cnt(g.wins || 0, '', '', 'wygrana', 'wygrane', 'wygranych')} na ${num(g.games)} · rekord ${num(g.best)} pkt`)}</span></li>`; }).join('');
  const cur = rankOf(Math.min(m.level, RANKS.at(-1).lv)), nxt = RANKS.find(r => r.lv > m.level);
  return `<div class="mecard me2">
    <div class="mecol">
      <section class="mepan merank">
        <div class="rankrow">
          <span class="rankicon">${rankIcon(rankOf(m.level).icon)}</span>
          <div class="rankname"><b>${esc(rankOf(m.level).name)}</b><span>${L('Level', 'Poziom')} ${m.level}${m.nextRank ? ` · ${m.level >= RANKS.at(-1).lv ? L('next star', 'następna gwiazda') : esc(nextRankOf(m.level).name)} ${L('at level', 'od poziomu')} ${m.nextRankLv}` : ''}</span></div>
        </div>
        <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.need}" aria-valuenow="${m.into}" aria-label="${L('XP to next level', 'XP do następnego poziomu')}"><i style="width:${pct}%"></i></div>
        <div class="xpnote"><span>${num(m.into)} / ${num(m.need)} XP ${L('to level', 'do poziomu')} ${m.level + 1}</span><span>${L(`${num(m.xp)} XP in total`, `Łącznie ${num(m.xp)} XP`)}</span></div>
        <div class="acct"><span>${m.user ? L(`Signed in as <b>${esc(m.user)}</b>`, `Zalogowano jako <b>${esc(m.user)}</b>`) : L('Playing as a guest. Progress stays on this browser.', 'Grasz jako gość. Postępy zostają w tej przeglądarce.')}</span></div>
      </section>
      <section class="mepan">
        <h3>${L('Rank road', 'Droga rang')}<small>${nxt ? L(`next: ${esc(nxt.name)}, level ${nxt.lv}`, `następna: ${esc(nxt.name)}, poziom ${nxt.lv}`) : L(`one ★ every ${STAR_EVERY} levels, with no end`, `★ co ${STAR_EVERY} poziomów, bez końca`)}</small></h3>
        <ol class="ladder">${RANKS.map(r => `<li class="${m.level >= r.lv ? 'got' : ''}${cur.lv === r.lv ? ' now' : ''}" title="${esc(r.name)}, ${L('level', 'poziom')} ${r.lv}">${rankIcon(r.icon)}<b>${esc(r.name)}</b><span>${L('lv', 'poz.')} ${r.lv}</span></li>`).join('')}</ol>
      </section>
      ${skyNow(m)}
    </div>
    <div class="mecol">
      <div class="stats">
        <div><b>${num(m.wins)}</b><span>${L('Wins', 'Wygrane')}</span></div><div><b>${num(m.games)}</b><span>${L('Games', 'Gry')}</span></div>
        <div><b>${rate}%</b><span>${L('Win rate', 'Skuteczność')}</span></div><div><b>${num(m.pts)}</b><span>${L('Points', 'Punkty')}</span></div>
        <div><b>${num(m.coins)}</b><span>${L('Coins', 'Monety')}</span></div><div><b>${num(m.xp)}</b><span>XP</span></div>
      </div>
      <section class="mepan megames">
        <h3>${L('Your games', 'Twoje gry')}</h3>
        ${per ? `<ul class="pergame">${per}</ul>` : `<p class="xpnote">${L('Finish a game to earn XP. Wins are worth the most.', 'Dokończ grę, żeby zdobyć XP. Najwięcej dają wygrane.')}</p>`}
      </section>
    </div>
  </div>`;
}
// Constellations (constellations.js): the block on the progress card, and the "Your sky" collection.
function skyNow(m) {
  const sky = m.sky || { lit: {}, stars: 0, free: 0 }, top = RANKS.at(-1), c = inProgress(sky), done = doneIds(sky).length;
  if (m.level < top.lv) return `<div class="cnnow soon"><div class="txt"><b>🔒 ${L('Constellations', 'Gwiazdozbiory')}</b><span>${L(`They unlock at ${esc(top.name)} (level ${top.lv}): one star every ${STAR_EVERY} levels, and you light a point of a constellation with each.`, `Odblokujesz je od rangi ${esc(top.name)} (poziom ${top.lv}): co ${STAR_EVERY} poziomów dostajesz gwiazdę i zapalasz nią punkt gwiazdozbioru.`)}</span></div><button type="button" class="btn w" data-x="sky">${L('Preview', 'Podgląd')} ›</button></div>`;
  const k = c ? sky.lit[c.id] || 0 : 0, free = sky.free | 0;
  return `<div class="cnnow${free ? ' has' : ''}">${c ? conTile(c, k, { size: 104 }) : conTile(conOf(sky.shown) || CONS[0], undefined, { size: 104 })}
    <div class="txt"><span>${L(`Constellations: ${done} of ${CONS.length} finished`, `Gwiazdozbiory: ukończone ${done} z ${CONS.length}`)}</span>
      <b>${!c ? L('Every constellation is lit!', 'Wszystkie gwiazdozbiory świecą!') : free ? L(`${cnt(free, 'star')} to light!`, `${cnt(free, '', '', 'gwiazda', 'gwiazdy', 'gwiazd')} do zapalenia!`) : `${esc(c.n)}: ${k} / ${c.p.length} ★`}</b>
      ${c ? `<div class="cndots" role="img" aria-label="${L(`${esc(c.n)}: ${k} of ${c.p.length} stars lit`, `${esc(c.n)}: zapalone gwiazdy: ${k} z ${c.p.length}`)}">${c.p.map((_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <span>${free ? L('Pick a constellation and light a point.', 'Wybierz gwiazdozbiór i zapal w nim punkt.') : L(`${sky.stars ? 'Next' : 'First'} star at level ${m.nextRankLv}`, `${sky.stars ? 'Następna' : 'Pierwsza'} gwiazda od poziomu ${m.nextRankLv}`)}</span></div>
    <button type="button" class="btn${free ? '' : ' w'}" data-x="sky">${free ? `★ ${L('Light a star', 'Zapal gwiazdę')}` : L('Your sky', 'Twoje niebo')} ›</button></div>`;
}
const locked0 = m => m.level < RANKS.at(-1).lv;
function openSky() {
  if (!st.me) return;
  const sheet = modal(''), box = sheet.el.querySelector('.sheet'); box.classList.add('wide', 'cnsheet');
  let pop = '', had = doneIds(st.me.sky || {});
  const paint = () => {
    const m = st.me, sky = m.sky || { lit: {}, stars: 0, free: 0 }, free = locked0(m) ? 0 : sky.free | 0, top = RANKS.at(-1), locked = m.level < top.lv, keep = box.scrollTop;
    const card = c => { const n = c.p.length, k = sky.lit[c.id] || 0, fin = k === n;
      return `<div class="cncard${fin ? ' done' : ''}">${conTile(c, k, { size: 150, pop: pop === c.id })}<div class="nm">${esc(c.n)}<span>${locked ? '' : `${k} / `}${n} ★</span></div>
        ${fin ? (c.id === sky.shown ? `<div class="state on">✓ ${L('Shown by your rank', 'Widać przy randze')}</div>` : `<button type="button" class="btn w" data-shown="${c.id}">${L('Show by my rank', 'Pokaż przy randze')}</button>`)
          : free ? `<button type="button" class="btn" data-light="${c.id}">★ ${L('Light a star', 'Zapal gwiazdę')}</button>` : ''}</div>`; };
    box.innerHTML = `<h2>${L('Your sky', 'Twoje niebo')}</h2>
      <p class="lead">${L(`After ${esc(top.name)} you get one star every ${STAR_EVERY} levels. Light a point of any constellation with it: the choice is yours, and a lit star stays for good. Finished constellations show on your profile card, and one of them sits by your rank.`, `Po randze ${esc(top.name)} co ${STAR_EVERY} poziomów dostajesz gwiazdę. Zapalasz nią punkt w dowolnym gwiazdozbiorze: wybór należy do ciebie, a zapalona gwiazda zostaje na zawsze. Ukończone gwiazdozbiory widać na twojej karcie profilu, a jeden z nich stoi przy twojej randze.`)}</p>
      ${locked ? `<div class="cnlock"><b>🔒 ${L(`Unlocks at ${esc(top.name)} (level ${top.lv})`, `Odblokujesz od rangi ${esc(top.name)} (poziom ${top.lv})`)}</b><span>${L(`You are level ${m.level}. For now this is a preview of what you will collect.`, `Masz poziom ${m.level}. Na razie to podgląd tego, co będziesz zbierać.`)}</span></div>`
        : `<div class="cnsum"><span class="chip${free ? ' hot' : ''}">★ ${L(`Stars to light: ${free}`, `Gwiazdy do zapalenia: ${free}`)}</span><span class="chip">${L(`Constellations: ${doneIds(sky).length} of ${CONS.length}`, `Gwiazdozbiory: ${doneIds(sky).length} z ${CONS.length}`)}</span><span class="chip">${L(`${sky.stars ? 'Next' : 'First'} star at level ${m.nextRankLv}`, `${sky.stars ? 'Następna' : 'Pierwsza'} gwiazda od poziomu ${m.nextRankLv}`)}</span></div>`}
      ${SETS.map((s, i) => { const cs = CONS.filter(c => c.set === i); return `<section class="cnset${locked ? ' locked' : ''}"><h3>${esc(s)}${locked ? '' : `<small>${cs.filter(c => isDone(sky, c.id)).length} / ${cs.length}</small>`}</h3><div class="cngrid">${cs.map(card).join('')}</div></section>`; }).join('')}
      <div class="row"><button type="button" class="btn big" data-x="close">${L('Done', 'Gotowe')}</button></div>`;
    box.scrollTop = keep; pop = '';
    const now = doneIds(sky), fin = now.find(id => !had.includes(id)); had = now;
    if (fin) { sfx.win?.(); toast(`★ ${L('Constellation finished', 'Gwiazdozbiór ukończony')}: ${esc(conOf(fin).n)}!`); }
  };
  paint();
  const prev = st.onMe; st.onMe = () => { prev?.(); if (sheet.el.isConnected) paint(); };
  sheet.onClose = () => { st.onMe = prev; };
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x === 'close') return sheet.close();
    if (b.dataset.light) { b.disabled = true; sfx.pop(); pop = b.dataset.light; send({ t: 'sky', light: pop }); } else if (b.dataset.shown) { sfx.pop(); send({ t: 'sky', shown: b.dataset.shown }); }
  });
}
function openStats() {
  if (!st.me) return;
  const sheet = modal(`<h2>${L('Your progress', 'Twoje postępy')}</h2>${meCard()}<div class="row" style="margin-top:16px">${st.me.pt ? `<button type="button" class="btn w" data-x="card">${L('How others see me', 'Jak widzą mnie inni')}</button>` : ''}<button type="button" class="btn" data-x="close">${L('Done', 'Gotowe')}</button></div>`);
  sheet.el.querySelector('.sheet').classList.add('wide', 'statsheet');
  sheet.el.addEventListener('click', e => {
    const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
    sfx.click(); sheet.close(); if (x === 'card') send({ t: 'player', pt: st.me.pt }); else if (x === 'sky') openSky();
  });
}
// Tells the server which screen this browser is on (hub, Pet Farm or Hay Hunch), for the host's "Who's here" list.
// Tables need nothing: the server knows who sits where.
function tellWhere() { send({ t: 'where', v: st.view === 'farm' || st.view === 'hay' || st.view === 'pop' || st.view === 'mj' ? st.view : 'hub' }); }
// "Who's here": everyone on the site right now, for hosts only (the server sends it only to ADMINS accounts).
let whoSheet = null, whoTimer = null;
const agoText = ms => { const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return m < 1 ? L('just arrived', 'przed chwilą') : `${L('here for', 'na stronie od')} ${h ? `${h}${L('h', ' godz.')} ${m % 60}${L('m', ' min')}` : `${m}${L('m', ' min')}`}`; };
function whereText(a) {
  if (a.k === 'farm') return FARM_NAME;
  if (a.k === 'hay') return SOLO.hay.name;
  if (a.k === 'pop') return SOLO.pop.name;
  if (a.k === 'mj') return SOLO.mj.name;
  if (a.k !== 'table') return L('Hub', 'Strona główna');
  const g = GAMES[a.game]?.name || a.game;
  return `${esc(g)} <small>${a.watch ? L('watching', 'ogląda') : a.play ? L('playing', 'gra') : L('waiting room', 'poczekalnia')}${a.code ? ` · ${esc(a.code)}` : ` · ${L('private', 'prywatny')}`}</small>`;
}
function whoHtml() {
  const list = st.who; if (!list) return `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>`;
  if (!list.length) return `<div class="empty">${L('Nobody is here right now.', 'Nikogo teraz nie ma.')}</div>`;
  const now = Date.now(), tables = list.filter(r => r.at.k === 'table').length, guests = list.filter(r => !r.user).length;
  return `<p class="rknote">${L(`${cnt(list.length, 'person', 'people')} · ${num(tables)} at tables · ${cnt(guests, 'guest')}`, `Osoby: ${num(list.length)} · przy stołach: ${num(tables)} · goście: ${num(guests)}`)}</p>
    <ol class="rk wholist">${list.map((r, i) => `<li class="${r.pt && r.pt === st.me?.pt ? 'you' : ''}"${prof(r)}>
    <span class="pos">${i + 1}</span>${avatarHtml(r.color, r.av, 36, frameCls(r.fl))}
    <span class="who"><b>${nameHtml(r.name, r.fl)}</b><span>${r.lv ? lvChip(r.lv, r.cn) : ''}${r.user ? `<i>@${esc(r.user)}</i>` : `<i>${L('guest', 'gość')}</i>`}${r.n > 1 ? `<i>${L(`${r.n} screens`, `ekrany: ${r.n}`)}</i>` : ''}</span></span>
    <b class="main">${whereText(r.at)}</b><span class="sub">${agoText(now - r.since)}</span>
  </li>`).join('')}</ol>`;
}
function paintWho() { const el = whoSheet?.el.querySelector('#who-list'); if (el) el.innerHTML = whoHtml(); }
function openWho() {
  if (!st.me?.admin) return;
  closeAcct(); whoSheet?.close();
  const sheet = whoSheet = modal(`<h2>${L('Who’s here', 'Kto jest na stronie')}</h2><p class="rknote">${L('Only hosts see this list. It updates by itself.', 'Tę listę widzą tylko gospodarze. Odświeża się sama.')}</p><div class="rkall" id="who-list">${whoHtml()}</div><div class="row" style="margin-top:14px"><button type="button" class="btn" data-x="close">${L('Done', 'Gotowe')}</button></div>`);
  sheet.el.querySelector('.sheet').classList.add('listsheet');
  send({ t: 'who' });
  whoTimer = setInterval(() => send({ t: 'who' }), 10_000); // also refreshed whenever the live count changes
  sheet.onClose = () => { whoSheet = null; clearInterval(whoTimer); };
  sheet.el.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) { sfx.click(); return sheet.close(); }
    if (e.target.closest('[data-prof]')) sheet.close(); // the page-wide handler opens the profile card
  });
}
// The account menu: one place for everything that used to be separate buttons in the top bar and on the progress card.
// It drops down from the avatar button; on phones it slides up as a sheet (the tab bar's "You").
// Kuba's optional tip jar. A plain link that opens in a new tab: no pop-ups, no reminders, no perks.
const KOFI = 'https://ko-fi.com/zatokagier';
const kofiLink = () => `<button type="button" class="kofi" data-act="support">${L('Support the site', 'Wesprzyj stronę')} ☕</button>`;
const hasPack = () => { const have = new Set(st.me?.owned || []); return packIds('kofi').every(id => have.has(id)); };
// The Support window: what the Supporter pack is and how it arrives. Ko-fi tells the server about a payment, and the
// username written in the Ko-fi message says whose account the pack goes to; the email form is the way back in for
// anyone who forgot to write it.
let onKofi = null;
function openSupport() {
  const user = st.me?.user, got = hasPack(), ids = packIds('kofi').map(id => id.split(':'));
  const KIT = ['cb', 'dc', 'gb', 'kp', 'cu', 'cs', 'dm'], cosIds = cosPackIds('kofi').map(id => { const [k, i] = id.split(':'); return [k, +i]; });
  // a small picture of one account cosmetic or game piece skin, with the kind as its caption
  const cosFig = ([k, i]) => { const it = cosItem(k, i);
    const pic = k === 'nm' ? `<span class="supbox"><b>${nameHtml(st.name || L('Name', 'Imię'), { nm: i })}</b></span>` : k === 'fr' ? `<span class="supbox">${avatarHtml(st.color, st.av, 34, frameCls({ fr: i }))}</span>`
      : k === 'pb' ? `<span class="supbox haspb">${cardBg({ pb: i })}</span>` : k === 'ti' ? `<span class="supbox"><span class="ttl">${esc(it.n)}</span></span>`
      : k === 'wn' ? `<span class="supbox emo">☕🥐</span>` : k === 'sp' ? `<span class="supbox emo sm">${it.e.join('')}</span>` : `<img alt="" data-kit="${k}:${i}">`;
    return `<figure>${pic}<figcaption>${esc(COS[k].label)}${k === 'ti' || k === 'nm' ? '' : `<br>${esc(it.n)}`}</figcaption></figure>`; };
  const { el, close } = modal(`
    <h2>${L('Support the site', 'Wesprzyj stronę')} ☕</h2>
    <p>${L(`${SITE} is free and stays free. If you like it, you can chip in for the server on Ko-fi. As a thank-you you get the whole Supporter pack below, yours to keep.`, `${SITE} jest i będzie za darmo. Jeśli ci się tu podoba, możesz dorzucić się do serwera na Ko-fi. W podziękowaniu dostajesz cały Pakiet wspierających poniżej, na zawsze.`)}</p>
    <h3 class="suph">${L('For your avatar', 'Dla awatara')}</h3>
    <div class="suppics"><figure><img alt="" data-sp="all"><figcaption>${L('The whole outfit', 'Cały strój')}</figcaption></figure>${ids.map(([k, i]) => `<figure><img alt="" data-sp="${k}:${i}"><figcaption>${esc(OPT[k][+i])}</figcaption></figure>`).join('')}</div>
    <h3 class="suph">${L('For your name and card', 'Dla imienia i wizytówki')}</h3>
    <div class="suppics wide">${cosIds.filter(([k]) => !KIT.includes(k)).map(cosFig).join('')}</div>
    <h3 class="suph">${L('For your game pieces', 'Do gier')}</h3>
    <div class="suppics wide">${cosIds.filter(([k]) => KIT.includes(k)).map(cosFig).join('')}</div>
    ${got ? `<p class="supok">${L('Thank you! The Supporter pack is yours. It is in your Wardrobe.', 'Dziękujemy! Pakiet wspierających jest twój. Znajdziesz go w Garderobie.')}</p>
      <div class="suprow"><button type="button" class="btn" data-ward>${L('Open the Wardrobe', 'Otwórz Garderobę')}</button><a class="btn w" href="${KOFI}" target="_blank" rel="noopener noreferrer">${L('Open Ko-fi', 'Otwórz Ko-fi')}</a></div>`
    : user ? `<ol class="supsteps">
        <li>${L('On Ko-fi, write your username in the message box:', 'Na Ko-fi wpisz swoją nazwę użytkownika w polu wiadomości:')} <button type="button" class="supname" data-copy title="${L('Copy', 'Kopiuj')}"><b>${esc(user)}</b> <span aria-hidden="true">⧉</span></button></li>
        <li>${L('The pack shows up in your Wardrobe by itself, usually within a minute.', 'Pakiet sam pojawi się w twojej Garderobie, zwykle w ciągu minuty.')}</li>
      </ol>
      <div class="suprow"><a class="btn big" href="${KOFI}" target="_blank" rel="noopener noreferrer">${L('Open Ko-fi', 'Otwórz Ko-fi')} ☕</a></div>
      <form class="authform supclaim">
        <h3>${L('Paid, but nothing arrived?', 'Zapłacone, a nic nie przyszło?')}</h3>
        <label for="kfm">${L('The email you used on Ko-fi', 'E-mail użyty na Ko-fi')}</label>
        <input class="field" id="kfm" type="email" maxlength="320" required autocomplete="email">
        <p style="font-size:14px">${L('It is only used to find your payment. It is not saved.', 'Służy tylko do znalezienia twojej wpłaty. Nie jest zapisywany.')}</p>
        <p class="autherr" role="alert" hidden></p>
        <button class="btn w">${L('Find my payment', 'Znajdź moją wpłatę')}</button>
      </form>`
    : `<p class="supok">${L('The pack is saved on an account, so make a free one first. Then come back here.', 'Pakiet zapisuje się na koncie, więc najpierw załóż darmowe konto. Potem wróć tutaj.')}</p>
      <div class="suprow"><button type="button" class="btn" data-reg>${L('Create account', 'Załóż konto')}</button><a class="btn w" href="${KOFI}" target="_blank" rel="noopener noreferrer">${L('Open Ko-fi', 'Otwórz Ko-fi')}</a></div>`}
    <button type="button" class="btn ghost-ink" data-close>${L('Close', 'Zamknij')}</button>`);
  const done = () => { onKofi = null; close(); };
  // the pictures show the whole Supporter outfit on your face and hair, not the clothes you have on now
  const suit = cleanAv(st.av); for (const [k, i] of ids) suit[AV_KEYS.indexOf(k)] = +i;
  suit[AV_KEYS.indexOf('botC')] = 3; suit[AV_KEYS.indexOf('shoeC')] = 0; // coffee-brown trousers and cream slippers to go with it
  ipReady.then(() => { if (IP) for (const im of el.querySelectorAll('[data-sp]')) {
    const [k, i] = im.dataset.sp === 'all' ? ['body', suit[AV_KEYS.indexOf('body')]] : im.dataset.sp.split(':');
    const u = IP.itemPic(k, +i, st.color, suit); if (u) im.src = u; } });
  for (const im of el.querySelectorAll('img[data-kit]')) { const [k, i] = im.dataset.kit.split(':'); skinPic(k, +i, st.color, st.av).then(u => { if (u && im.isConnected) im.src = u; }); }
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); done(); });
  el.querySelector('[data-ward]')?.addEventListener('click', () => { done(); openWardrobe({ sec: 'av4' }); });
  el.querySelector('[data-reg]')?.addEventListener('click', () => { done(); openAccount('register'); });
  el.querySelector('[data-copy]')?.addEventListener('click', () => { navigator.clipboard?.writeText(user).then(() => toast(L('Username copied.', 'Skopiowano nazwę użytkownika.'))).catch(() => {}); });
  const f = el.querySelector('.supclaim');
  f?.addEventListener('submit', e => {
    e.preventDefault(); const btn = f.querySelector('button'), err = f.querySelector('.autherr'); btn.disabled = true; err.hidden = true;
    onKofi = m => { btn.disabled = false; if (m.err) { err.textContent = srvText(m.err); err.hidden = false; sfx.bad(); } else done(); };
    send({ t: 'kofi', email: f.querySelector('#kfm').value });
  });
  onKofi = null; st.onPack = done;
}
function acctHtml() {
  const m = st.me, reqs = st.friends?.reqs.length || 0;
  const item = (act, ico, label, note = '', attr = '') => `<button type="button" role="menuitem" data-act="${act}"${attr}><span class="aico" aria-hidden="true">${ico}</span>${label}${note}</button>`;
  const pct = m ? Math.round(100 * m.into / m.need) : 0, rate = m?.games ? Math.round(100 * m.wins / m.games) : 0;
  return `<div class="awho${cardBgCls(flairOf(m))}">${cardBg(flairOf(m))}${avatarHtml(st.color, st.av, 48, frameCls(flairOf(m)))}<div><b>${st.name ? nameHtml(st.name, flairOf(m)) : L('Pick a name', 'Wybierz imię')}</b><span>${m ? `${L('Level', 'Poziom')} ${m.level} · ${esc(rankOf(m.level).name)}` : ''}</span></div></div>
    ${m ? `<div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.need}" aria-valuenow="${m.into}" aria-label="${L('XP to next level', 'XP do następnego poziomu')}"><i style="width:${pct}%"></i></div>
    <p class="axp">${m.into} / ${m.need} XP ${L('to level', 'do poziomu')} ${m.level + 1}</p>
    <div class="amini"><div><b>${m.wins}</b><span>${L('wins', 'wygrane')}</span></div><div><b>${m.games}</b><span>${L('games', 'gry')}</span></div><div><b>${rate}%</b><span>${L('win rate', 'skuteczność')}</span></div></div>` : ''}
    <div class="aitems" role="menu">
      ${item('mystats', '📊', L('Profile', 'Profil'), `<small>${st.me?.sky?.free && !locked0(st.me) ? `★ ${L(`stars to light: ${st.me.sky.free}`, `gwiazdy do zapalenia: ${st.me.sky.free}`)}` : L('all your stats', 'wszystkie statystyki')}</small>`)}
      ${item('profile', '👕', L('Wardrobe', 'Garderoba'), `<small>${L('avatar, style, shop', 'awatar, styl, sklep')}</small>`)}
      ${item('friends', '🤝', L('Friends', 'Znajomi'), `<span class="frbadge" ${reqs ? '' : 'hidden'}>${reqs || ''}</span>`)}
      ${m?.admin ? item('notices', '📣', L('Site notices', 'Komunikaty strony'), `<small>${L('update countdown, announcements', 'odliczanie, ogłoszenia')}</small>`) : ''}
      ${m?.admin ? item('who', '👀', L('Who’s here', 'Kto jest na stronie'), `<small>${st.stats ? L(`${cnt(st.stats.online, 'person', 'people')} now`, `teraz: ${num(st.stats.online)}`) : L('host only', 'tylko dla gospodarza')}</small>`) : ''}
      ${item('gfx', '🎮', L('Graphics', 'Grafika'), `<small>${gfxLabel()}</small>`)}
      ${item('lang', '🌐', L('Język: polski', 'Language: English'), '', ` data-lang="${PL ? 'en' : 'pl'}" lang="${PL ? 'en' : 'pl'}"`)}
      ${item('support', '☕', L('Support the site', 'Wesprzyj stronę'), `<small>${hasPack() ? L('thank you!', 'dziękujemy!') : L('get the Supporter pack', 'odbierz Pakiet wspierających')}</small>`)}
      <hr>
      ${m?.user ? item('security', '🔑', L('Change password', 'Zmień hasło')) + item('logout', '🚪', L('Log out', 'Wyloguj się'), `<small>${esc(m.user)}</small>`)
        : item('account', '✨', L('Create account', 'Załóż konto'), `<small>${L('saves progress', 'zapisuje postępy')}</small>`, ' data-mode="register"') + item('account', '🔑', L('Log in', 'Zaloguj się'), '', ' data-mode="login"')}
    </div>`;
}
// The site-wide graphics level (frames.js): Auto picks by device, Low is lightest, High is the full look.
const GFX_NEXT = { auto: 'low', low: 'high', high: 'auto' };
function gfxLabel() {
  const p = gfxPick();
  if (p === 'low') return L('low: lightest', 'niska: najlżejsza');
  if (p === 'high') return L('high: full look', 'wysoka: pełny wygląd');
  if (SOFT) return L('auto (light: no graphics card in use)', 'automatyczna (lekka: brak karty graficznej)');
  return L(`auto (${{ high: 'high', mid: 'medium', low: 'low' }[gfx()]})`, `automatyczna (${{ high: 'wysoka', mid: 'średnia', low: 'niska' }[gfx()]})`);
}
function closeAcct() {
  document.querySelector('.acctwrap')?.remove();
  document.querySelector('.me.acctbtn')?.setAttribute('aria-expanded', 'false');
  if (st.view === 'hub') document.querySelectorAll('.hubtabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === st.htab));
}
function openAcct() {
  if (document.querySelector('.acctwrap')) return closeAcct();
  const btn = document.querySelector('.me.acctbtn'); if (!btn) return;
  const wrap = document.createElement('div'); wrap.className = 'acctwrap';
  wrap.innerHTML = `<div class="acctmenu" id="acct-menu">${acctHtml()}</div>`;
  const r = btn.getBoundingClientRect();
  wrap.style.setProperty('--at', Math.round(r.bottom + 10) + 'px'); wrap.style.setProperty('--ar', Math.round(Math.max(8, innerWidth - r.right)) + 'px');
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-act], a[href]')) setTimeout(closeAcct); }); // a tap outside, or on any item, closes it
  $app.append(wrap); btn.setAttribute('aria-expanded', 'true');
  wrap.querySelector('button')?.focus({ preventScroll: true });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.acctwrap')) { closeAcct(); document.querySelector('.me.acctbtn')?.focus(); } });
function paintMe() {
  const chip = document.querySelector('.me .lvslot'); if (chip) chip.innerHTML = meChip();
  const cs = document.querySelector('.coinslot'); if (cs && st.me) cs.textContent = st.me.coins;
  const menu = document.getElementById('acct-menu'); if (menu) menu.innerHTML = acctHtml();
  paintToday();
}

// Day or night: the sky look comes in both. Saved per browser; first visit follows the system setting.
let heroMod = null; // the hub's 3D hero module, loaded on first visit to the hub
const isNight = () => document.body.classList.contains('night');
function setNight(on, save) {
  document.body.classList.toggle('night', on);
  if (save) LS.set('ct_theme', on ? 'night' : 'day');
  [...document.querySelectorAll('.themebtn'), gameSwitch].forEach(b => { b.textContent = on ? '☀️' : '🌙'; b.title = b.ariaLabel = on ? L('Switch to day', 'Przełącz na dzień') : L('Switch to night', 'Przełącz na noc'); });
  heroMod?.then(m => m.setHeroNight?.(on)).catch(() => {});
  if (document.body.classList.contains('in-game')) import('./scenery3d.js').then(m => m.setScenesNight(on)).catch(() => {}); // repaint the game's sky live
}
// Inside the games (which draw their own screens, without the top bar) the switch joins the game's round
// buttons at the top right, just before the sound button.
const gameSwitch = document.createElement('button');
gameSwitch.type = 'button'; gameSwitch.className = 'round gamesw';
gameSwitch.addEventListener('click', e => { e.stopPropagation(); switchTheme(gameSwitch); sfx.click(); });
// The game's top-left chips must stay clear of the round buttons: --tlw on the HUD is the room left of that row.
function fitTopChips() {
  const tr = $app.querySelector('.hud .tr'), tl = tr?.parentElement.querySelector(':scope > .tl'); if (!tl) return;
  // (the HUD may be zoomed on computers, uiz.js: the rect is on screen, the CSS lengths are in the HUD's own pixels)
  const room = tr.getBoundingClientRect().left / uiz() - parseFloat(getComputedStyle(tl).left || 0) - 8;
  if (room > 0) tl.parentElement.style.setProperty('--tlw', Math.floor(room) + 'px');
}
const trWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(fitTopChips) : null;
addEventListener('resize', fitTopChips);
function placeGameSwitch() {
  const tr = $app.querySelector('.tr'); if (!tr || tr.contains(gameSwitch)) return;
  trWatch?.observe(tr);
  tr.insertBefore(gameSwitch, tr.querySelector('[data-a="mute"]'));
}
// The switch animates: night (or day) spreads out in a circle from the button where the browser can do
// view transitions, and colours fade across everywhere else. Reduced motion gets an instant switch.
function switchTheme(btn) {
  const on = !isNight();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setNight(on, true);
  const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  if (document.startViewTransition) {
    const vt = document.startViewTransition(() => setNight(on, true));
    vt.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`] },
      { duration: 750, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    return;
  }
  document.body.classList.add('theming');
  setNight(on, true);
  clearTimeout(switchTheme.t); switchTheme.t = setTimeout(() => document.body.classList.remove('theming'), 700);
}
{ const t = LS.get('ct_theme', ''); setNight(t ? t === 'night' : matchMedia('(prefers-color-scheme: dark)').matches, false); }

const topbar = () => `<header class="top">
  <a class="brand" href="/" data-act="home">${siteLogo(42)}<span>Zatoka <b>Gier</b></span></a>
  ${st.view === 'lobby' ? `<nav class="navl" aria-label="${L('Help', 'Pomoc')}"><a href="#" data-act="rules">${L('How to play', 'Jak grać')}</a></nav>` : ''}
  <button type="button" class="me coinbtn" data-act="shop" title="${L('Coins: spend them in the wardrobe', 'Monety: wydasz je w garderobie')}">${coinIco}<span class="coinslot">${st.me ? st.me.coins : '…'}</span><small>· ${L('shop', 'sklep')}</small></button>
  <button type="button" class="me acctbtn" data-act="acct" aria-haspopup="menu" aria-expanded="false" aria-label="${L('Your account', 'Twoje konto')}">${avatarHtml(st.color, st.av, 38, frameCls(flairOf(st.me)))}<span class="aname">${st.name ? nameHtml(st.name, flairOf(st.me)) : L('Pick a name', 'Wybierz imię')}</span><span class="lvslot">${meChip()}</span><span class="acaret" aria-hidden="true">▾</span><span class="frbadge" ${st.friends?.reqs.length ? '' : 'hidden'}>${st.friends?.reqs.length || ''}</span></button>
  <button type="button" class="langbtn" data-act="lang" data-lang="${PL ? 'en' : 'pl'}" lang="${PL ? 'en' : 'pl'}" aria-label="${L('Zmień język na polski', 'Switch language to English')}" title="${L('Polski', 'English')}"><b>${PL ? 'PL' : 'EN'}</b><span aria-hidden="true">${PL ? 'EN' : 'PL'}</span></button>
  <button type="button" class="themebtn" data-act="theme" aria-label="${isNight() ? L('Switch to day', 'Przełącz na dzień') : L('Switch to night', 'Przełącz na noc')}" title="${isNight() ? L('Switch to day', 'Przełącz na dzień') : L('Switch to night', 'Przełącz na noc')}">${isNight() ? '☀️' : '🌙'}</button>
</header>`;

// The hub's live 3D hero (your avatar on a floating island). The SVG table stays as the fallback until three.js loads.
// The button on your isle: it opens the Wardrobe on the isle page; a guest gets a nudge to make their own.
const isleTag = () => `<button type="button" class="isletag${st.me?.user ? '' : ' guest'}" data-act="isle">${st.me?.user ? L('Dress your isle', 'Urządź wyspę') : L('Make yours', 'Zrób swoją')} ›</button>`;
function mountSkyHero() {
  const art = document.querySelector('.hero .art'), box = art?.querySelector('.icv'); if (!box) return;
  art.classList.add('sky3d');
  const tag = art.querySelector('.isletag'); if (tag) tag.outerHTML = isleTag();
  const frame = art.closest('.hero'); // the hero is a banner painted in your isle's sky
  (heroMod ||= import('./hero3d.js')).then(m => { m.setHeroNight(isNight()); if (box.isConnected) m.mountHero(box, st.color, st.av, myShow(), { ...flairOf(st.me), ip: myDecor() }, { frame, zoom: 1.15 }); }).catch(() => {});
  if (st.me?.user && !st.pets && !petsAsked) { petsAsked = true; send({ t: 'pets' }); }
}
// The Pet Farm pets you show off on your isle (the first also sits beside you in waiting rooms).
let petsAsked = false;
const PET_SLOTS = 3;
const showIds = () => { const c = st.me?.cos || {}; return (c.pets || (c.pet ? [c.pet] : [])).slice(0, PET_SLOTS); };
// The Pet Farm decorations you put on your isle, less any the farm no longer has.
const myDecor = () => decorOf(st.me).filter(t => (st.decor || []).some(x => x.t === t));
const myShow = () => showIds().map(id => (st.pets || []).find(x => x.id === id)).filter(Boolean);
const prof = x => x?.pt ? ` data-prof="${esc(x.pt)}"` : ''; // makes a row open that player's profile card
// The games you host a table for, in hub order: id, picture class, picture, category, seats, one-line pitch.
// Category is cards, board or action, plus ' party' for games that shine with a big group (it also shows under Party).
// Solo games (Hay Hunch, Pet Farm, Mystery Pet) are not here: they live in the Today column.
const HUB_CATS = [['all', L('All', 'Wszystkie')], ['cards', L('Cards', 'Karciane')], ['board', L('Board', 'Planszowe')], ['action', L('Action', 'Zręcznościowe')], ['party', L('Party', 'Imprezowe')]];
const HUB_GAMES = [
  ['hotpot', '', hotpotArt, 'cards', '1–4 players', 'Draw, swap and collect three sets of three ingredients, then call “Let\'s Eat!” before anyone else.'],
  ['marbles', 'marblepic', marbleArt, 'action party', '1–8 players', 'Pick a colour, bet your coins and watch the marbles tumble down a random 3D track.'],
  ['ladders', 'ladderpic', laddersArt, 'board', '1–6 players', 'The classic race to the top on a fresh 3D board every game, with your avatars as tokens and a few party tiles.'],
  ['poker', 'pokerpic', pokerArt, 'cards', '1–6 players', 'Cozy no-limit poker for pretend chips. Also Mango Poker, where the flop comes from the cards you all throw away.'],
  ['bj', 'bjpic', bjArt, 'cards', '1–6 players', 'Everyone against the dealer. Bet pretend chips, get closer to 21 than the dealer and finish with the biggest stack.'],
  ['ludo', 'ludopic', ludoArt, 'board', '1–4 players', 'Race your pawns round a chunky 3D board and bump your friends back to their yard.'],
  ['stack', 'stackpic', stackArt, 'action party', '1–6 players', 'Take turns dropping swinging blocks on one shared, wobbly tower. Don\'t be the one who knocks it down.'],
  ['golf', 'golfpic', golfArt, 'action', '1–6 players', 'Take turns putting the same blocky 3D hole, and bet coins on who takes each hole.'],
  ['dice', 'dicepic', diceArt, 'cards party', '1–6 players', 'Roll in secret under your cup, bid on everyone\'s dice and bluff. Call “Liar!” when you smell one.'],
  ['tys', 'tyspic', tysArt, 'cards', '1–4 players', 'The Polish card classic. Bid for the musik, announce marriages to set trumps, and be first to 1000.'],
  ['paw', 'pawpic', pawArt, 'board', '1–6 players', 'Adopt pet shops round a cozy 3D board and collect rent in treats.'],
  ['kart', 'kartpic', kartArt, 'action', '1–8 players', 'Race little low-poly karts round roads that hop between floating islands.'],
  ['kitchen', 'kitchenpic', kitchenArt, 'action party', 'Co-op · 1–4', 'Chop, cook and serve orders together in a little sky-island kitchen before the tickets run out.'],
  ['dig', 'digpic', digArt, 'board', '1–6 players', 'Take turns digging up a grass field for gems and a golden chest. Like Minesweeper with friends.'],
  ['bricks', 'brickspic', bricksArt, 'action', '1–6 players', 'Stack falling bricks in your own well and send stone lines to your friends. Last one stacking wins.'],
  ['lagoon', 'lagoonpic', lagoonArt, 'action', '1–4 players', 'Shoot pet bubbles in your own lagoon, pop three of a kind and send eggs to your friends. Last one afloat wins.'],
  ['mahj', 'mahjpic', mahjArt, 'board', '1–4 players', 'Everyone gets the same board of tiles. Match free pairs faster than your friends and clear it first.'],
  ['bean', 'beanpic', beanArt, 'action', '1–6 players', 'Race your friends up a giant beanstalk, hopping from ledge to ledge, ahead of the storm.'],
  ['pan', 'panpic', panArt, 'cards', '1–6 players', 'The Polish card game: nine of hearts starts, play the same or higher, or pick up three.'],
  ['piotr', 'piotrpic', piotrArt, 'cards', '1–6 players', 'The Polish Old Maid with pet cards. Pair them up, draw from your neighbour and don\'t get stuck with the Piotruś.'],
  ['wojna', 'wojnapic', wojnaArt, 'cards', '1–4 players', 'War, the Polish classic: flip your top card, the highest takes them all, and equal cards mean war.'],
  ['pips', 'pipspic', pipsArt, 'board', '1–4 players', 'Five dice, three rolls a turn and a score sheet to fill. Chase runs, full houses and five of a kind.'],
  ['darts', 'dartspic', dartsArt, 'action', '1–6 players', 'Classic 301 darts on a sky island. Steady your hand, hit the trebles and finish on a double.'],
  ['parade', 'paradepic', paradeArt, 'cards', '1–6 players', 'Match the colour or the number with Pet Farm pet cards. Nap, Turnabout, Gift +2 and wild Rockslides. Don\'t forget “Last one!”'],
  ['makao', 'makaopic', makaoArt, 'cards', '1–6 players', 'The Polish classic with a normal deck: twos and threes to draw, fours to wait, Jacks demand, Aces change the suit, kings fight. Don\'t forget “Makao!”'],
  ['ttt', 'tttpic', tttArt, 'board', '1–2 players', 'Crosses and noughts on a chunky 3D board. Classic, vanishing marks, or four in a row on a big board.'],
  ['domino', 'dominopic', dominoArt, 'board', '1–4 players', 'Classic draw dominoes with chunky tiles. Match the ends, empty your hand first and score what the others are left holding.'],
  ['cove', 'covepic', coveArt, 'board', '1–2 players', 'Hide your boats in your bay and lob coconuts at your friend\'s. Sink the whole fleet first to win.'],
  ['pool', 'poolpic', poolArt, 'action', '1–4 players', '8-ball pool on a sky island table. Plain against striped, one against one or in teams of two.'],
  ['bingo', 'bingopic', bingoArt, 'board party', '1–8 players', 'A ball machine calls the numbers. Daub your card faster than your friends and shout Bingo for a line, two lines and the full card.'],
  ['bop', 'boppic', bopArt, 'action party', '1–6 players', 'Bop the pets popping out of your burrows before they duck. Three hearts each, and the last one with a heart wins.'],
  ['bierki', 'bierkipic', bierkiArt, 'action party', '1–6 players', 'Classic Polish pick-up sticks in 3D. Draw one stick out of the pile without moving the others, and go for the Crown.'],
  ['pm', 'pmpic', pmArt, 'board party', '2–8 players', 'The classic pen-and-paper word race. A letter is drawn: write a country, a city, an animal and more before somebody calls Stop.'],
  ['chess', 'chesspic', chessArt, 'board', '1–2 players', 'Classic chess with blocky pieces on a sky island. Play a friend or a bot, with or without a clock.'],
  ['kal', 'kalpic', kalArt, 'action party', '2–8 players', 'One player draws a secret word, everyone else races to guess it. Polish and English words, with Pet Farm pets too. For people only: no bots.'],
].filter(g => GAMES[g[0]]);
// The ⏱ tag: 'about 5 min' when both ends match, else '5–10 min'. Clock drawn in SVG so it looks the same everywhere.
const CLOCK = '<svg class="tclock" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const minsText = ([a, b]) => a === b ? `~${a} min` : `${a}–${b} min`;
const timeTag = (m, cls = 'tag ttime') => m ? `<span class="${cls}" title="${L('Usual length of one game', 'Zwykle tyle trwa jedna gra')}">${CLOCK}${minsText(m)}</span>` : '';
// The sort menu beside the search box: hub order, by playtime (middle of mins) or by the most seats. Saved like the filter.
const G_SORTS = [['hub', L('Default order', 'Domyślnie')], ['short', L('Shortest first', 'Najkrótsze')], ['long', L('Longest first', 'Najdłuższe')], ['many', L('Most players', 'Najwięcej graczy')], ['few', L('Fewest players', 'Najmniej graczy')]];
const seatsMax = s => Math.max(...(String(s).match(/\d+/g) || [0]).map(Number));
const gameCard = ([id, pic, art, cat, seats, pitch], i) => `<article class="gcard gmini" data-i="${i}" data-mins="${GAMES[id].mins ? (GAMES[id].mins[0] + GAMES[id].mins[1]) / 2 : 999}" data-seats="${seatsMax(seats)}" data-cat="${cat}" data-name="${esc(GAMES[id].name.toLowerCase())}" title="${esc(GAMES[id].pitch || pitch)}">
  <div class="pic ${pic}">${art()}<span class="gopen" data-g="${id}" hidden></span>${timeTag(GAMES[id].mins, 'gtime')}</div>
  <div class="body"><h3>${esc(GAMES[id].name)}</h3><div class="gmeta"><span class="tag">${PLX ? PLX.SEATS_PL(seats) : seats}</span>
    <button type="button" class="ghelp" data-act="rules" data-game="${id}" aria-label="${L('How to play', 'Jak grać:')} ${esc(GAMES[id].name)}" title="${L('How to play', 'Jak grać')}">?</button></div>
    <button type="button" class="btn sm" data-act="host" data-game="${id}">${L('Host a table', 'Załóż stół')}</button></div>
</article>`;
// The category pills and the search box only hide cards; nothing is re-rendered, so the pictures keep animating.
function filterGames() {
  if (!HUB_CATS.some(([id]) => id === st.gFilt)) st.gFilt = 'all';
  const q = (document.getElementById('gfind')?.value || '').trim().toLowerCase(); let shown = 0;
  document.querySelectorAll('.gmini').forEach(c => { const on = (st.gFilt === 'all' || c.dataset.cat.split(' ').includes(st.gFilt)) && (!q || c.dataset.name.includes(q)); c.hidden = !on; shown += on; });
  document.querySelectorAll('[data-act="gfilt"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === st.gFilt));
  const none = document.getElementById('gnone'); if (none) none.hidden = shown > 0;
}
// Moves the cards into the chosen order (no re-render, so the pictures keep animating). Ties keep hub order.
function sortGames() {
  if (!G_SORTS.some(([id]) => id === st.gSort)) st.gSort = 'hub';
  const box = document.querySelector('.games.mini'); if (!box) return;
  const by = { hub: () => 0, short: (a, b) => a.dataset.mins - b.dataset.mins, long: (a, b) => b.dataset.mins - a.dataset.mins,
    many: (a, b) => b.dataset.seats - a.dataset.seats, few: (a, b) => a.dataset.seats - b.dataset.seats }[st.gSort];
  [...box.children].sort((a, b) => by(a, b) || a.dataset.i - b.dataset.i).forEach(c => box.append(c));
}
$app.addEventListener('input', e => { if (e.target.id === 'gfind') filterGames(); });
$app.addEventListener('change', e => { if (e.target.id === 'gsort') { st.gSort = e.target.value; LS.set('ct_gs', st.gSort); sortGames(); } });
// Below this width the hub is one column with a tab bar at the bottom (Games, Tables, Chat, Rankings, You).
const narrowMq = matchMedia('(max-width: 1099px)'), narrow = () => narrowMq.matches;
narrowMq.addEventListener('change', () => { if (st.view === 'hub') { renderTables(); paintRankings(); } });
function setHubTab(tab) {
  if (tab === 'you') { openAcct(); document.querySelectorAll('.hubtabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === 'you')); return; }
  closeAcct();
  st.htab = ['games', 'tables', 'chat', 'rank'].includes(tab) ? tab : 'games';
  const g = document.querySelector('.hubgrid'); if (g) g.dataset.tab = st.htab;
  document.querySelectorAll('.hubtabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === st.htab));
  scrollTo(0, 0); if (st.htab === 'chat') hubScrollEnd();
}
function renderHub() {
  const cnt = c => c === 'all' ? HUB_GAMES.length : HUB_GAMES.filter(g => g[3].split(' ').includes(c)).length;
  const tab = (id, ico, label, extra = '') => `<button type="button" data-act="htab" data-tab="${id}" aria-selected="${id === st.htab}"><span aria-hidden="true">${ico}</span>${label}${extra}</button>`;
  $app.innerHTML = `${topbar()}
  <main class="wrap hubgrid" data-tab="${st.htab}">
    <section class="hero">
      <div>
        <h1>${L('Hop on an isle. Pick a game.', 'Wskakuj na wyspę. Wybierz grę.')}</h1>
        <p>${L("Card, board, action and party games for you and your friends, plus solo puzzles and your own Pet Farm. Pick a game below to host a table and share its four-letter code, or join one with a friend's code.", 'Gry karciane, planszowe, zręcznościowe i imprezowe dla ciebie i znajomych, a do tego łamigłówki dla jednej osoby i własna Farma zwierzaków. Wybierz grę poniżej, żeby założyć stół i podać znajomym jego czteroznakowy kod, albo dołącz do stołu z kodem od znajomego.')}</p>
        <div class="row herorow">
          <form class="codeform" data-form="join">
            <label for="code">${L('Got a code?', 'Masz kod?')}</label>
            <input id="code" class="field code-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" required>
            <button class="btn m">${L('Join', 'Dołącz')}</button>
          </form>
        </div>
        <p class="livestats" id="live-stats" aria-live="polite">${statsHtml()}</p>
      </div>
      <div class="art"><div class="icv">${tableArt()}</div>${isleTag()}</div>
    </section>
    <div class="hubmid">
    <section id="games">
      <div class="ghead">
        <h2>${L('Games', 'Gry')}</h2>
        <div class="gfilt" role="group" aria-label="${L('Kind of game', 'Rodzaj gry')}">${HUB_CATS.map(([id, n]) => `<button type="button" data-act="gfilt" data-cat="${id}" aria-pressed="${id === st.gFilt}">${n} <i>${cnt(id)}</i></button>`).join('')}</div>
        <input id="gfind" class="field gfind" type="search" placeholder="${L('Find a game', 'Szukaj gry')}" aria-label="${L('Find a game', 'Szukaj gry')}" autocomplete="off" spellcheck="false">
        <select id="gsort" class="field gsort" aria-label="${L('Sort games', 'Sortuj gry')}">${G_SORTS.map(([id, n]) => `<option value="${id}"${id === st.gSort ? ' selected' : ''}>${n}</option>`).join('')}</select>
      </div>
      <div class="games mini">${HUB_GAMES.map(gameCard).join('')}</div>
      <div class="empty" id="gnone" hidden>${L('No game with that name. Try another word, or pick “All”.', 'Nie ma gry o takiej nazwie. Spróbuj innego słowa albo wybierz „Wszystkie”.')}</div>
    </section>
    </div>
    <aside class="hubside left" aria-label="${L('Open tables and chat', 'Otwarte stoły i czat')}">
      <section id="tables">
        <div class="sidehead"><h2>${L('Open tables', 'Otwarte stoły')}</h2><span class="tcount" id="tables-count"></span></div>
        <div class="tables" id="tables-list"></div>
        <div class="tpager" id="tables-pager"></div>
        <button type="button" class="btn sm w tall" id="tables-all-btn" data-act="tables" hidden></button>
      </section>
      <section id="hubchat">
        <div class="sidehead"><h2>${L('Chat', 'Czat')}</h2></div>
        <div class="hccard">
          <div class="hclog" id="hc-log" role="log" aria-live="polite">${hubLogHtml()}</div>
          <div class="hcfoot" id="hc-foot">${hubFootHtml()}</div>
        </div>
      </section>
    </aside>
    <aside class="hubside right" aria-label="${L('Today and rankings', 'Dziś i rankingi')}">
      <section id="today">
        <div class="sidehead"><h2>${L('Today', 'Dziś')}</h2></div>
        <div class="today" id="today-list">${todayHtml()}</div>
      </section>
      <section id="rankings">
        <div class="sidehead"><h2>${L('Rankings', 'Rankingi')}</h2></div>
        <div class="rkcard">
          <select id="rk-sel" class="field rksel" aria-label="${L('Rankings for', 'Ranking gry')}">${RK_TABS.map(([id, n]) => `<option value="${id}"${id === st.rkTab ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
          <div id="rk-body">${rankingsHtml(narrow())}</div>
        </div>
      </section>
    </aside>
  </main>
  <footer>${L("Made for friends. Coins are only for fun: they buy avatar items, nothing else. Poker chips are pretend. Hot Pot is a fan-made game inspired by Palia's Hotpot minigame.", 'Zrobione dla znajomych. Monety są tylko dla zabawy: kupisz za nie rzeczy dla awatara i nic więcej. Żetony w pokerze są na niby. Gorący kociołek to fanowska gra inspirowana minigrą Hotpot z Palii.')}<br>${L('Enjoying it?', 'Podoba ci się?')} ${kofiLink()} · <a class="plink" href="/privacy">${L('Privacy', 'Prywatność')}</a></footer>
  <nav class="hubtabs" aria-label="${L('Hub sections', 'Sekcje strony')}">${tab('games', '🎮', L('Games', 'Gry'))}${tab('tables', '🪑', L('Tables', 'Stoły'), '<i class="tcount" id="tabs-count"></i>')}${tab('chat', '💬', L('Chat', 'Czat'))}${tab('rank', '🏆', L('Rankings', 'Rankingi'))}${tab('you', '👤', L('You', 'Ty'))}</nav>`;
  renderTables(); sortGames(); filterGames();
  document.body.classList.add('sky');
  mountSkyHero();
  send({ t: 'rankings', game: st.rkTab });
  send({ t: 'hubchat' }); hubScrollEnd();
  send({ t: 'daily' }); send({ t: 'word' }); send({ t: 'wheel' });
  if (st.me?.user) send({ t: 'pets' }); // also brings the farm's news for the Today column
  if (!st.name && !st.creatorOpen) openProfile(true); // (the hub is drawn again when the 3D pictures load: one welcome window is enough)
}
$app.addEventListener('change', e => {
  if (e.target.id !== 'rk-sel') return;
  st.rkTab = e.target.value; LS.set('ct_rk', st.rkTab); paintRankings(); send({ t: 'rankings', game: st.rkTab });
});

// ---------- global rankings ----------
// One leaderboard per minigame across every player on the site (bots never count), plus an overall one by XP.
const RK_TABS = [['overall', L('Overall', 'Ogólny')], ...Object.entries(GAMES).map(([id, g]) => [id, g.name]), ['hay', SOLO.hay.name], ['pop', SOLO.pop.name], ['mj', SOLO.mj.name], ['farm', FARM_NAME]];
const RK_NOTE = {
  overall: L('Ranked by XP from every game. Wins earn the most.', 'Ranking według XP ze wszystkich gier. Najwięcej dają wygrane.'),
  marbles: L('Ranked by bets won, then by coins won overall.', 'Ranking według wygranych zakładów, potem według łącznie wygranych monet.'),
  farm: L('The Pet Farm ladder: points from Arena battles against other farms.', 'Drabinka Farmy zwierzaków: punkty z walk na Arenie przeciwko innym farmom.'),
  hay: L('Ranked by the best harvest from one field, then by fields cleared.', 'Ranking według najlepszych zbiorów z jednego pola, potem według oczyszczonych pól.'),
  pop: L('Ranked by the highest level cleared, then by the best score on one shelf.', 'Ranking według najwyższego ukończonego poziomu, potem według najlepszego wyniku na jednej półce.'),
  mj: L('Ranked by the highest level cleared, then by the best score on one board.', 'Ranking według najwyższego ukończonego poziomu, potem według najlepszego wyniku na jednej planszy.'),
  default: L('Ranked by wins, then win rate.', 'Ranking według wygranych, potem według skuteczności.'),
};
const cWins = n => cnt(n, 'win', 'wins', 'wygrana', 'wygrane', 'wygranych'), cGames = n => cnt(n, 'game', 'games', 'gra', 'gry', 'gier');
function rkStat(game, r) {
  if (game === 'overall') return [`${num(r.xp)} XP`, `${cWins(r.wins)} · ${cGames(r.games)}`];
  if (game === 'farm') return [cnt(r.pts, 'pt', 'pts', 'pkt'), `${cnt(r.pets, 'pet', 'pets', 'zwierzak', 'zwierzaki', 'zwierzaków')} · ${L('best Lv', 'najwyższy poz.')} ${r.top}`];
  if (game === 'hay') return [`×${num(r.best)}`, L(`${cnt(r.wins, 'field')} cleared · top level ${r.top || 1}`, `${cnt(r.wins, '', '', 'oczyszczone pole', 'oczyszczone pola', 'oczyszczonych pól')} · najwyższy poziom ${r.top || 1}`)];
  if (game === 'pop') return [L(`Level ${r.top || 0}`, `Poziom ${r.top || 0}`), L(`best score ${num(r.best)} · ${cnt(r.games, 'shelf', 'shelves')} played`, `rekord ${num(r.best)} · rozegrane półki: ${num(r.games)}`)];
  if (game === 'mj') return [L(`Level ${r.top || 0}`, `Poziom ${r.top || 0}`), L(`best score ${num(r.best)} · ${cnt(r.games, 'board')} played`, `rekord ${num(r.best)} · rozegrane plansze: ${num(r.games)}`)];
  if (game === 'marbles') return [L(cnt(r.wins, 'bet') + ' won', cnt(r.wins, '', '', 'wygrany zakład', 'wygrane zakłady', 'wygranych zakładów')), `${cnt(r.games, 'race', 'races', 'wyścig', 'wyścigi', 'wyścigów')} · ${r.net >= 0 ? '+' : '−'}${cnt(Math.abs(r.net), 'coin', 'coins', 'moneta', 'monety', 'monet')}`];
  return [cWins(r.wins), `${cGames(r.games)} · ${r.rate}%${r.best ? ` · ${L('best', 'rekord')} ${r.best} ${L('pts', 'pkt')}` : ''}`];
}
function rkRow(game, r) {
  const [main, sub] = rkStat(game, r), medal = ['🥇', '🥈', '🥉'][r.pos - 1];
  return `<li class="${r.me ? 'you' : ''}"${prof(r)}>
    <span class="pos">${medal || r.pos}</span>${avatarHtml(r.color, r.av, 36, frameCls(r.fl))}
    <span class="who"><b>${nameHtml(r.name, r.fl)}${r.me ? ` <em>(${L('you', 'ty')})</em>` : ''}</b><span>${r.lv ? lvChip(r.lv, r.cn) : ''}${titleHtml(r.fl)}${r.guest ? `<i>${L('guest', 'gość')}</i>` : ''}</span></span>
    <b class="main">${main}</b><span class="sub">${sub}</span>
  </li>`;
}
const RK_SHORT = 5; // rows on the hub; "See all" opens the whole board
function rankingsHtml(all = false) {
  if (!RK_TABS.some(([id]) => id === st.rkTab)) st.rkTab = 'overall';
  const g = st.rkTab, d = st.rk[g];
  if (!d) return `<p class="rknote">${L('Loading…', 'Wczytywanie…')}</p>`;
  const rows = all ? d.rows : d.rows.slice(0, RK_SHORT), mine = d.mine || (!all && d.rows.slice(RK_SHORT).find(r => r.me));
  const note = `<p class="rknote">${RK_NOTE[g] || RK_NOTE.default}${all && d.total > d.rows.length ? L(` Top ${d.rows.length} of ${num(d.total)} players.`, ` Najlepsze ${d.rows.length} z ${num(d.total)} graczy.`) : ''}</p>`;
  if (!d.rows.length) return note + `<div class="empty">${g === 'farm' ? L('No farms with pets yet. Visit your farm to be the first!', 'Nie ma jeszcze farm ze zwierzakami. Zajrzyj na swoją farmę i zajmij pierwsze miejsce!') : L('Nobody has finished a game here yet. Play one to take first place!', 'Nikt jeszcze nie skończył tu gry. Zagraj i zajmij pierwsze miejsce!')}</div>`;
  return note + `<ol class="rk">${rows.map(r => rkRow(g, r)).join('')}${mine ? `<li class="gap" aria-hidden="true">…</li>${rkRow(g, mine)}` : ''}</ol>`
    + (d.rows.some(r => r.me) || d.mine ? '' : `<p class="rknote">${g === 'farm' ? L('Raise a pet on your farm to join this ladder.', 'Wychowaj zwierzaka na swojej farmie, żeby dołączyć do tej drabinki.') : L('Finish a game to get on this board.', 'Dokończ grę, żeby trafić do tego rankingu.')}</p>`)
    + (!all && d.rows.length > RK_SHORT ? `<button type="button" class="btn sm w tall" data-act="rkall">${L('See all', 'Zobacz wszystkich:')} ${Math.min(d.total || d.rows.length, d.rows.length)}</button>` : '');
}
let rkSheet = null;
function openRankings() {
  rkSheet?.close();
  const name = RK_TABS.find(([id]) => id === st.rkTab)?.[1] || RK_TABS[0][1];
  const sheet = rkSheet = modal(`<h2>${L('Rankings', 'Rankingi')} · ${esc(name)}</h2><div class="rkall" id="rk-all">${rankingsHtml(true)}</div><div class="row" style="margin-top:14px"><button type="button" class="btn" data-x="close">${L('Done', 'Gotowe')}</button></div>`);
  sheet.el.querySelector('.sheet').classList.add('listsheet');
  sheet.onClose = () => { rkSheet = null; };
  sheet.el.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) { sfx.click(); return sheet.close(); }
    const row = e.target.closest('[data-prof]'); if (row) { sfx.click(); sheet.close(); send({ t: 'player', pt: row.dataset.prof }); }
  });
}
function paintRankings() {
  const el = document.getElementById('rk-body'); if (el) el.innerHTML = rankingsHtml(narrow());
  const all = document.getElementById('rk-all'); if (all) all.innerHTML = rankingsHtml(true);
  const sel = document.getElementById('rk-sel'); if (sel) sel.value = st.rkTab;
}

// ---------- hub chat ----------
// One site-wide room on the hub. Everyone can read it, accounts can write. The server cleans and rate limits every
// line; here every piece of text still goes through esc(), so nothing a player types can become markup.
// Name flair (colours, titles from the cosmetics shop) arrives as `fl` on each line; flairName paints it.
export const flairName = (name, fl) => nameHtml(name, fl);
const hcTime = at => {
  const d = new Date(at), today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  return today ? t : `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} ${t}`;
};
const hcSame = (a, b) => a && b && a.user === b.user && b.at - a.at < 3 * 60_000;
// A shared Mystery Pet result: one row of squares per guess. Only the letters g, y and r ever become markup.
const gridHtml = g => `<pre class="mpgrid" aria-label="${L('Their clues, without spoilers', 'Wskazówki tej osoby, bez spoilerów')}">${g.slice(0, 10).map(r => [...String(r)].filter(c => 'gyrhnm'.includes(c)).map(c => `<i class="${c}"></i>`).join('')).join('\n')}</pre>${g.length > 10 ? `<small class="mpmore">${L(`and ${g.length - 10} more`, `i jeszcze ${g.length - 10}`)}</small>` : ''}`;
function hubLine(m, prev) {
  const cont = hcSame(prev, m);
  return `<div class="hcl${m.own ? ' own' : ''}${cont ? ' cont' : ''}" data-id="${esc(m.id)}"${prof(m)}>
    ${cont ? '<span class="hcav"></span>' : `<span class="hcav">${avatarHtml(m.color, m.av, 34, frameCls(m.fl))}</span>`}
    <div class="hcbody">
      ${cont ? '' : `<div class="hcmeta"><b class="hcname">${flairName(m.name, m.fl)}</b>${m.lv ? lvChip(m.lv, m.cn) : ''}${titleHtml(m.fl)}<time datetime="${new Date(m.at).toISOString()}">${esc(hcTime(m.at))}</time></div>`}
      <p${!m.grid && emoOnly(m.text) ? ' class="hcbig"' : ''}>${esc(Array.isArray(m.grid) ? srvText(m.text) : m.text)}</p>${Array.isArray(m.grid) ? gridHtml(m.grid) : ''}
    </div>
    ${m.del ? `<button type="button" class="hcdel" data-act="hubdel" data-id="${esc(m.id)}" aria-label="${L('Remove this message', 'Usuń tę wiadomość')}" title="${L('Remove', 'Usuń')}">×</button>` : ''}
  </div>`;
}
function hubLogHtml() {
  const log = st.hc.log;
  if (!log) return `<p class="hcempty">${L('Loading…', 'Wczytywanie…')}</p>`;
  if (!log.length) return `<p class="hcempty">${L('Nobody has said anything yet. Say hi to everyone!', 'Nikt jeszcze nic nie napisał. Przywitaj się ze wszystkimi!')}</p>`;
  return log.map((m, i) => hubLine(m, log[i - 1])).join('');
}
function hubFootHtml() {
  if (!st.me) return '';
  if (!st.me.user) return `<div class="hcguest"><span>${L('Make a free account to join the chat.', 'Załóż darmowe konto, żeby pisać na czacie.')}</span>
    <button type="button" class="btn sm m" data-act="account" data-mode="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn sm w" data-act="account" data-mode="login">${L('Log in', 'Zaloguj się')}</button></div>`;
  return `<div class="hcemo" id="hc-emo" hidden></div><form class="hcform" data-form="hubchat"><button type="button" class="hcemobtn" data-act="hcemo" aria-expanded="false" aria-controls="hc-emo" aria-label="${L('Emotes', 'Emotki')}" title="${L('Emotes', 'Emotki')}">😊</button><input class="field" id="hc-in" maxlength="${st.hc.max}" placeholder="${L('Say something to everyone…', 'Napisz coś do wszystkich…')}" autocomplete="off" enterkeyhint="send" aria-label="${L('Message to everyone', 'Wiadomość do wszystkich')}"><button class="btn m">${L('Send', 'Wyślij')}</button></form>`;
}
// The emote picker: the same six free emoji and bought sticker packs as the reaction row in table chat (react.js,
// cosmetics.js). Picking one types it into the message at the cursor; it is plain text, so nothing new reaches the server.
function hubEmoHtml() {
  const mine = stickersOf(st.me), all = mine.length === STICKERS.length;
  const btn = (e, lbl) => `<button type="button" data-act="hcemo-put" data-e="${esc(e)}" aria-label="${lbl} ${e}">${e}</button>`;
  return `<div class="hcemorow">${EMOJI.map(e => btn(e, L('Emote', 'Emotka'))).join('')}${mine.map(s => btn(s.e, L('Sticker', 'Naklejka'))).join('')}</div>`
    + (all ? '' : `<button type="button" class="hcemomore" data-act="hcemo-shop">${mine.length ? L('More sticker packs in the Wardrobe', 'Więcej naklejek w Garderobie') : L('Get sticker packs in the Wardrobe', 'Paczki naklejek kupisz w Garderobie')} ›</button>`);
}
function hubEmoToggle(open) {
  const box = document.getElementById('hc-emo'), b = document.querySelector('.hcemobtn'); if (!box || !b) return;
  open ??= box.hidden; if (open) box.innerHTML = hubEmoHtml();
  const end = hubAtEnd(); // the log gets shorter while the picker is open: stay at the newest line
  box.hidden = !open; b.setAttribute('aria-expanded', open); b.classList.toggle('on', open); if (end) hubScrollEnd();
}
function hubEmoPut(e) {
  const inp = document.getElementById('hc-in'); if (!inp) return;
  const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a, v = inp.value.slice(0, a) + e + inp.value.slice(z);
  if (v.length > inp.maxLength) { sfx.bad(); return; }
  inp.value = v; const c = a + e.length;
  if (matchMedia('(pointer: fine)').matches) inp.focus(); // on phones focusing would pop the keyboard over the picker
  inp.setSelectionRange(c, c);
}
document.addEventListener('pointerdown', e => { const box = document.getElementById('hc-emo'); if (box && !box.hidden && !e.target.closest('#hc-foot')) hubEmoToggle(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('hc-emo')?.hidden === false) { hubEmoToggle(false); document.querySelector('.hcemobtn')?.focus(); } });
// A line that is only emoji (up to six) is shown bigger, like a sticker.
const EMO_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\u20e3|\s)+$/u;
const emoOnly = t => typeof t === 'string' && EMO_ONLY.test(t) && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)
  && [...new Intl.Segmenter().segment(t.replace(/\s/g, ''))].length <= 6;
const $hcLog = () => document.getElementById('hc-log');
const hubAtEnd = () => { const el = $hcLog(); return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60; };
function hubScrollEnd() { const el = $hcLog(); if (el) el.scrollTop = el.scrollHeight; }
function paintHubLog() { const el = $hcLog(); if (el) { el.innerHTML = hubLogHtml(); hubScrollEnd(); } }
function paintHubFoot() { const el = document.getElementById('hc-foot'); if (el && !el.contains(document.activeElement)) el.innerHTML = hubFootHtml(); }
function onHubChat(m) {
  const hc = st.hc;
  if (m.err) { sfx.bad(); toast(esc(srvText(m.err)), true); const inp = document.getElementById('hc-in'); if (inp && !inp.value && hc.pending) inp.value = hc.pending; return; }
  if (Array.isArray(m.log)) { hc.log = m.log; hc.max = m.max || 200; paintHubLog(); paintHubFoot(); return; }
  if (m.gone) { if (hc.log) hc.log = hc.log.filter(x => x.id !== m.gone); paintHubLog(); return; }
  if (!m.msg || !hc.log) return;
  const end = hubAtEnd() || m.msg.own, prev = hc.log.at(-1);
  hc.log.push(m.msg); if (hc.log.length > 120) hc.log.shift();
  if (m.msg.own) hc.pending = '';
  const el = $hcLog(); if (!el) return;
  if (hc.log.length === 1) el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', hubLine(m.msg, prev));
  while (el.children.length > 120) el.firstElementChild.remove();
  if (end) hubScrollEnd();
}
$app.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'hubchat') return;
  e.preventDefault();
  const inp = e.target.querySelector('input'), text = inp.value.trim(); if (!text) return;
  st.hc.pending = text; send({ t: 'hubchat', text }); inp.value = ''; hubEmoToggle(false);
});

// "3 playing now · 128 visitors so far" under the hero buttons.
function statsHtml() {
  const s = st.stats; if (!s) return '';
  const on = `<i></i><b>${num(s.online)}</b> ${L(`${s.online === 1 ? 'person' : 'people'} here now`, `${word(s.online, '', '', 'osoba', 'osoby', 'osób')} teraz na stronie`)}`;
  return `${st.me?.admin ? `<button type="button" class="on whobtn" data-act="who" title="${L('See who’s here', 'Zobacz, kto jest na stronie')}">${on}</button>` : `<span class="on">${on}</span>`}<span><b>${num(s.visitors)}</b> ${L(`${s.visitors === 1 ? 'visitor' : 'visitors'} so far`, `${word(s.visitors, '', '', 'odwiedzający', 'odwiedzających', 'odwiedzających')} do tej pory`)}</span>`;
}
// Hosts (accounts in the server's ADMINS setting) can tap the live count to see who is on the site.
function paintStats() { const el = document.getElementById('live-stats'); if (el) el.innerHTML = statsHtml(); }

// Open tables: tables with a free seat in their waiting room come first. The hub's left column shows the first
// few; "Show all" opens the whole list in its own panel, a page at a time. On phones the Tables tab is that list.
const TABLES_PER_PAGE = 5, TABLES_SHORT = 3;
const cTables = n => cnt(n, 'table', 'tables', 'stół', 'stoły', 'stołów');
const tableOpen = r => r.state === 'lobby' && r.n < r.max;
// The dots: one per seat at the table, as many as its waiting room shows (it grows when more people join, up to max).
const tableSeats = r => Math.max(r.size || r.max, r.n);
const tableRow = r => `<div class="trow">
    ${avatarHtml(r.hostColor, r.hostAv, 46)}
    <div class="who"><b>${L(`${esc(r.host)}'s table`, `Stół gracza ${esc(r.host)}`)}</b><span>${esc(GAMES[r.game]?.name || r.gameName)} · ${r.state === 'lobby' ? L('Waiting for players', 'Czeka na graczy') : r.state === 'play' ? L('Playing', 'Gra trwa') : L('Just finished', 'Właśnie skończona')}${r.state !== 'lobby' && r.n < tableSeats(r) ? L(' · watch and take over a bot', ' · oglądaj i przejmij bota') : ''}${r.w ? ` · ${L(`${r.w} watching`, `ogląda: ${r.w}`)}` : ''}</span></div>
    <div class="dots" aria-label="${L(`${r.n} of ${tableSeats(r)} seats taken`, `Zajęte miejsca: ${r.n} z ${tableSeats(r)}`)}">${Array.from({ length: tableSeats(r) }, (_, i) => `<i class="${i < r.n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="tcode">${esc(r.code)}</span>
    <button type="button" class="btn ${tableOpen(r) ? 'm' : 'w'}" data-act="join" data-code="${esc(r.code)}">${tableOpen(r) ? L('Join', 'Dołącz') : L('Watch', 'Oglądaj')}</button>
  </div>`;
function tablePage(el, pager, rooms) {
  const pages = Math.max(1, Math.ceil(rooms.length / TABLES_PER_PAGE));
  st.tPage = Math.max(0, Math.min(st.tPage, pages - 1));
  morph(el, rooms.slice(st.tPage * TABLES_PER_PAGE, (st.tPage + 1) * TABLES_PER_PAGE).map(tableRow).join('')); // patched, so live updates never blink the rows
  if (pager) pager.innerHTML = pages < 2 ? '' : `<button type="button" class="btn sm w" data-act="tpage" data-d="-1" aria-label="${L('Previous page', 'Poprzednia strona')}" ${st.tPage ? '' : 'disabled'}>‹</button>
    <span>${L('Page', 'Strona')} <b>${st.tPage + 1}</b> ${L('of', 'z')} ${pages} · ${cTables(rooms.length)}</span>
    <button type="button" class="btn sm w" data-act="tpage" data-d="1" aria-label="${L('Next page', 'Następna strona')}" ${st.tPage < pages - 1 ? '' : 'disabled'}>›</button>`;
}
let tablesSheet = null;
function renderTables() {
  const rooms = [...st.rooms].sort((a, b) => tableOpen(b) - tableOpen(a));
  for (const id of ['tables-count', 'tabs-count']) { const cnt = document.getElementById(id); if (cnt) cnt.textContent = rooms.length || ''; }
  document.querySelectorAll('.gopen').forEach(b => { const n = rooms.filter(r => r.game === b.dataset.g && tableOpen(r)).length; b.hidden = !n; b.textContent = n ? L(`${n} open`, `otwarte: ${n}`) : ''; });
  const all = document.getElementById('tables-all');
  if (all) { if (rooms.length) tablePage(all, document.getElementById('tables-all-pager'), rooms); else tablesSheet?.close(); }
  const el = document.getElementById('tables-list'); if (!el) return;
  const pager = document.getElementById('tables-pager'), more = document.getElementById('tables-all-btn');
  if (!rooms.length) { el.innerHTML = `<div class="empty tnone"><span>${L('No open tables yet. Pick a game to host one.', 'Nie ma jeszcze otwartych stołów. Wybierz grę i załóż własny.')}</span></div>`; pager.innerHTML = ''; more.hidden = true; return; }
  if (narrow()) { tablePage(el, pager, rooms); more.hidden = true; return; }
  morph(el, rooms.slice(0, TABLES_SHORT).map(tableRow).join('')); pager.innerHTML = '';
  more.hidden = rooms.length <= TABLES_SHORT; more.textContent = L(`Show all ${rooms.length} tables`, `Pokaż wszystkie stoły (${rooms.length})`);
}
function openTables() {
  tablesSheet?.close(); st.tPage = 0;
  const sheet = tablesSheet = modal(`<h2>${L('Open tables', 'Otwarte stoły')}</h2><p class="sidenote"><span class="livedot"></span>${L('Updates live. Join a seat or watch a game.', 'Lista odświeża się na żywo. Dosiądź się albo oglądaj grę.')}</p>
    <div class="tables tlist" id="tables-all"></div><div class="tpager" id="tables-all-pager"></div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" data-x="close">${L('Done', 'Gotowe')}</button></div>`);
  sheet.el.querySelector('.sheet').classList.add('listsheet');
  sheet.onClose = () => { tablesSheet = null; st.tPage = 0; };
  sheet.el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    sfx.click();
    if (b.dataset.x) sheet.close();
    else if (b.dataset.act === 'tpage') { st.tPage += +b.dataset.d; renderTables(); }
    else if (b.dataset.act === 'join') { sheet.close(); send({ t: 'join', code: b.dataset.code }); }
  });
  renderTables();
}

// The seat count in the table settings, drawn the same way for every game from what the server says (server/seats.js):
// pills for the counts the host can pick, or one line when the rules fix it or the game has no bots.
function seatOptHtml(r, gm, host, seatedN) {
  const ch = r.choices || [], k = r.seatKey || 'seats', head = `<b>${optText(gm.seatWord || 'Players', r.game)}</b>`;
  const note = t => `<div class="opt">${head}<p style="margin:0;font-size:15px;color:var(--muted)">${t}</p></div>`;
  if (!r.bots) return note(L(`2 to ${r.max} people. No bots, so everyone at the table plays.`, `Od 2 do ${r.max} osób. Bez botów, grają wszyscy przy stole.`));
  if (ch.length < 2) return note(L(`Always ${ch[0] || r.size}. A bot plays if nobody joins.`, `Zawsze ${ch[0] || r.size}. Jeśli nikt nie dołączy, gra bot.`));
  const lo = gm.seatMin ? gm.seatMin(r) : 0;
  return `<div class="opt">${head}<div class="pills">${ch.map(n => { const off = !host || n < seatedN || n < lo, lab = gm.seatLabels?.[n] || String(n);
    return `<button type="button" aria-pressed="${r.size === n}" data-act="opt" data-opt="${k}" data-val="${n}" ${off ? 'disabled' : ''}${n < seatedN ? ` title="${L('More people than that are sitting down', 'Przy stole siedzi więcej osób')}"` : ''}>${optText(lab, r.game)}</button>`; }).join('')}</div></div>`;
}
// Under the seats: how many of them bots will play, and (for the host) one tap to play with just the people here.
function botSeatsHtml(r, gm, host, seatedN) {
  const bots = r.size - seatedN, ch = r.choices || [];
  if (!r.bots || bots <= 0 || !seatedN) return '';
  const fit = ch.length > 1 && ch.includes(seatedN) && seatedN >= (gm.seatMin ? gm.seatMin(r) : 0);
  const msg = L(`${bots === 1 ? 'A bot plays the empty seat' : `Bots play the ${bots} empty seats`} if nobody joins. Games with a bot don't count for rankings.`,
    `${bots === 1 ? 'Jeśli nikt nie dołączy, na wolnym miejscu zagra bot' : `Jeśli nikt nie dołączy, na ${bots} wolnych miejscach zagrają boty`}. Gry z botem nie liczą się do rankingów.`);
  return `<div class="row botseats" style="gap:10px;align-items:center"><span style="color:var(--muted)">${msg}</span>${host && fit ? `<button type="button" class="btn m" data-act="opt" data-opt="${r.seatKey || 'seats'}" data-val="${seatedN}">${L(`Play with ${seatedN}, no bots`, `Gramy w ${seatedN}, bez botów`)}</button>` : ''}</div>`;
}

function renderLobby() {
  document.body.classList.add('sky');
  const r = st.room; if (!r) return go('hub');
  const host = r.host === st.id, gm = GAMES[r.game] || GAMES.hotpot, max = r.size || r.max;
  const seated = r.players.filter(p => !p.watch);
  const seats = Array.from({ length: max }, (_, i) => seated[i] || null);
  const watchers = [...seated.slice(max), ...r.players.filter(p => p.watch)];
  const meWatch = r.players.find(p => p.id === st.id)?.watch, saving = (r.sit || []).includes(st.id);
  const pill = (opt, val, label) => `<button type="button" aria-pressed="${String(r.opts[opt]) === String(val)}" data-act="opt" data-opt="${opt}" data-val="${val}" ${host ? '' : 'disabled'}>${optText(String(label), r.game).replace(/^(\d+) hands$/, '$1 rozdań')}</button>`;
  const html = `${topbar()}
  <main class="wrap lobby">
    <div class="main">
      <div class="crumb">${siteLogo(34)} ${esc(gm.name || r.gameName)} · ${L('waiting room', 'poczekalnia')}</div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:15px;color:var(--muted);margin-bottom:6px">${L('Table code', 'Kod stołu')}</div>
          <div class="codetiles" aria-label="${L('Table code', 'Kod stołu')} ${esc(r.code)}">${[...r.code].map(ch => `<span>${esc(ch)}</span>`).join('')}</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
          <button type="button" class="btn" data-act="copy">${L('Copy invite link', 'Skopiuj link z zaproszeniem')}</button>
          <span style="font-size:14px;color:var(--muted)">${L('Friends can also type the code on the home page.', 'Znajomi mogą też wpisać kod na stronie głównej.')}</span>
        </div>
      </div>
      <div class="seats">${seats.map((p, i) => p ? `<div class="seat full ${p.online ? '' : 'offline'}${cardBgCls(p.fl)}" data-pid="${esc(p.id)}"${prof(p)}>
          ${cardBg(p.fl)}${avatarHtml(p.color, p.av, 64, frameCls(p.fl))}${petImg(p.pet, 52)}
          <div><b>${nameHtml(p.name, p.fl)} ${p.lv ? lvChip(p.lv, p.cn) : ''}</b>${titleHtml(p.fl)}<span>${p.id === r.host ? L('Host', 'Gospodarz') : L('Ready', 'W gotowości')}${p.id === st.id ? L(' · you', ' · ty') : ''}${p.online ? '' : L(' · reconnecting', ' · łączy się ponownie')}</span></div></div>`
        : `<div class="seat open">${backSvg('width="56" height="56"')}<div><b>${L(`Seat ${i + 1} is open`, `Miejsce ${i + 1} wolne`)}</b><span>${gm.openSeat}</span></div></div>`).join('')}</div>
      ${botSeatsHtml(r, gm, host, Math.min(seated.length, max))}
      ${watchers.length ? `<p style="margin:0;color:var(--muted)">${L('Watching', 'Oglądają')}: ${watchers.map(p => nameHtml(p.name, p.fl)).join(', ')}</p>` : ''}
      ${meWatch ? `<div class="row"><button type="button" class="btn m" data-act="sit" aria-pressed="${saving}">${saving ? L('✓ Next free seat is yours', '✓ Następne wolne miejsce jest twoje') : L('Take a seat', 'Zajmij miejsce')}</button></div>` : ''}
      <div class="row" style="margin-top:6px">
        ${host && seated.length < (gm.min || 1) ? `<span class="chip">${L(`You need ${gm.min} players to start. Send the invite link to a friend.`, `Do startu potrzeba ${gm.min} graczy. Wyślij znajomemu link z zaproszeniem.`)}</span>`
          : host ? `<button type="button" class="btn big r" data-act="start">${gm.start}</button>` : `<span class="chip">${L('Waiting for the host to start…', 'Czekamy, aż gospodarz zacznie…')}</span>`}
        <button type="button" class="btn big ghost" data-act="leave">${L('Leave', 'Wyjdź')}</button>
      </div>
    </div>
    <aside>
      <h2 style="font-size:26px;margin:0">${L('Table scoreboard', 'Wyniki stołu')}</h2>
      ${boardHtml(r)}
      <h2 style="font-size:26px;margin:0">${L('Table settings', 'Ustawienia stołu')}</h2>
      ${seatOptHtml(r, gm, host, Math.min(seated.length, max))}
      ${gm.settings(pill, r).replace(/<b>([^<]+)<\/b>/g, (m, s) => `<b>${optText(s)}</b>`)}
      <label class="toggle">${L('Show in open tables', 'Pokaż wśród otwartych stołów')}<input type="checkbox" data-act="priv" ${r.priv ? '' : 'checked'} ${host ? '' : 'disabled'}></label>
      ${host ? '' : `<p style="margin:0;font-size:14px;color:var(--muted)">${L('Only the host can change settings.', 'Ustawienia może zmieniać tylko gospodarz.')}</p>`}
      <div class="howto"><b>${L('How to win', 'Jak wygrać')}</b><br>${gm.howto} <a href="#" data-act="rules">${L('Full rules', 'Pełne zasady')}</a></div>
    </aside>
  </main>`;
  // Already showing this waiting room: patch only what changed. A full rebuild on every look save, coin update or
  // seat change made the table code, seats and avatars blink for everyone at the table (and repainted them all).
  if ($app.querySelector(':scope > main.lobby') && $app.dataset.lobby === r.code) { if (!morph($app, html)) return; }
  else { $app.innerHTML = html; $app.dataset.lobby = r.code; }
  petPics();
}

// ---------- watching ----------
// While a game is on, a watcher gets a small bar: tap to take over a bot's seat.
const $watch = document.createElement('div');
$watch.id = 'watchbar'; $watch.hidden = true; $watch.setAttribute('aria-live', 'polite');
document.body.append($watch);
function watchPaint() {
  const r = st.room, me = r?.players.find(p => p.id === st.id);
  const on = !!(st.game && me?.watch && st.lastState?.ph === 'play');
  $watch.hidden = !on; if (!on) return;
  // When a watcher gets in depends on the game: Hot Pot and Marble Rush at the next game,
  // Snakes & Ladders and Ludo when the current round of turns ends, poker at the next hand.
  const saving = (r.sit || []).includes(st.id), when = r.joinAt || 'game';
  const bots = (st.lastState.seats || []).filter(s => !s.human).length;
  const full = when === 'game' ? r.players.filter(p => !p.watch).length >= r.max : when === 'turn' ? (st.lastState.n || 0) >= r.max : !bots;
  const SOON = { game: L('when the next game starts', 'gdy zacznie się następna gra'), round: L('when this round of turns ends', 'gdy skończy się ta kolejka'), hand: L('from the next hand', 'od następnego rozdania'), hole: L('from the next hole', 'od następnego dołka'), leg: L('from the next leg', 'od następnego lega'), now: L('right away', 'od razu') };
  const soon = SOON[when] || SOON.game;
  const msg = !saving ? L('You’re watching.', 'Oglądasz grę.')
    : full ? (when === 'game' ? L('Every seat is taken. You get the next free one.', 'Wszystkie miejsca są zajęte. Dostaniesz następne wolne.') : L('Every seat has a player. You get one next game.', 'Na każdym miejscu siedzi gracz. Dostaniesz miejsce w następnej grze.'))
    : when === 'turn' ? L('You join in at the next turn.', 'Dołączysz od następnej tury.') : L(`You take over a bot ${soon}.`, `Przejmiesz bota ${soon}.`);
  const btn = saving ? L('Just watch', 'Tylko oglądaj') : full && when === 'game' ? L('Get the next free seat', 'Zajmij następne wolne miejsce')
    : when === 'turn' ? L('Join the game', 'Dołącz do gry') : when === 'round' || when === 'now' ? L('Take over a bot', 'Przejmij bota') : when === 'hand' ? L('Play from next hand', 'Graj od następnego rozdania') : when === 'hole' ? L('Play from next hole', 'Graj od następnego dołka') : when === 'leg' ? L('Play from next leg', 'Graj od następnego lega') : L('Play next game', 'Zagraj w następnej grze');
  // Only touch the DOM when the words change: real-time games (Kart) send state 20 times a second,
  // and rebuilding the button every time made it flicker and swallowed clicks.
  const html = `<span>${msg}</span>
    <button type="button" class="btn ${saving ? 'w' : 'm'}" data-w="sit" aria-pressed="${saving}">${btn}</button>`;
  if ($watch._h !== html) { $watch._h = html; $watch.innerHTML = html; }
}
$watch.addEventListener('click', e => {
  const b = e.target.closest('[data-w="sit"]'); if (!b) return;
  sfx.click(); send({ t: 'sit', on: b.getAttribute('aria-pressed') !== 'true' });
});

// ---------- chat ----------
const $chat = document.getElementById('chat');
const chat = { log: [], open: false, unread: 0, peekT: 0 };
const CHAT_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/></svg>';
const SCORE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/></svg>';
const boardHtml = r => r.board?.length ? `<ol class="board">${r.board.map((e, i) => `<li${prof(e)}>
    <span class="pos">${i + 1}</span>${avatarHtml(e.color, e.av, 36, frameCls(e.fl))}
    <b>${nameHtml(e.name, e.fl)}</b>
    <span class="num"><b>${e.wins}</b> ${word(e.wins, 'win', 'wins', 'wygrana', 'wygrane', 'wygranych')}</span><span class="num"><b>${e.pts}</b> ${L('pts', 'pkt')}</span>${e.coins !== undefined ? `<span class="num"><b>${e.coins}</b> ${word(e.coins, 'coin', 'coins', 'moneta', 'monety', 'monet')}</span>` : ''}
  </li>`).join('')}</ol>
  <p class="boardnote">${L(`${r.played} ${r.played === 1 ? 'game' : 'games'} played at this table. Scores stay with the table, even through a server restart.`, `Gry rozegrane przy tym stole: ${r.played}. Wyniki zostają przy stole, nawet po restarcie serwera.`)}</p>`
  : `<p class="boardnote">${L('No games finished yet. Wins and points add up here for as long as the table stays open.', 'Nie skończono tu jeszcze żadnej gry. Wygrane i punkty sumują się tutaj, dopóki stół jest otwarty.')}</p>`;
function scoresPaint() { if (st.room) $chat.querySelector('.scorebody').innerHTML = boardHtml(st.room); else $chat.querySelector('.scorepanel').hidden = true; }
$chat.innerHTML = `
  <div class="chatpanel" hidden role="dialog" aria-label="${L('Table chat', 'Czat stołu')}">
    <div class="chathead"><b>${L('Table chat', 'Czat stołu')}</b><button type="button" class="round" data-c="toggle" aria-label="${L('Close chat', 'Zamknij czat')}">×</button></div>
    <div class="chatlog" aria-live="polite"></div>
    <div class="chatemoji"></div>
    <form class="chatform"><input class="field" maxlength="160" placeholder="${L('Say something nice…', 'Napisz coś miłego…')}" autocomplete="off" aria-label="${L('Message', 'Wiadomość')}"><button class="btn m">${L('Send', 'Wyślij')}</button></form>
  </div>
  <div class="chatpanel scorepanel" hidden role="dialog" aria-label="${L('Table scoreboard', 'Wyniki stołu')}">
    <div class="chathead"><b>${L('Table scoreboard', 'Wyniki stołu')}</b><button type="button" class="round" data-c="scores" aria-label="${L('Close scoreboard', 'Zamknij wyniki')}">×</button></div>
    <div class="scorebody"></div>
  </div>
  <div class="chatpeek" hidden></div>
  <div class="chatbtns">
    <button type="button" class="btn w scorebtn" data-c="scores" aria-label="${L('Table scoreboard', 'Wyniki stołu')}">${SCORE_ICON}<span class="lbl">${L('Scores', 'Wyniki')}</span></button>
    <button type="button" class="btn chatbtn" data-c="toggle" aria-label="${L('Open chat', 'Otwórz czat')}">${CHAT_ICON}<span class="lbl">${L('Chat', 'Czat')}</span><span class="badge" hidden></span></button>
  </div>`;
const $scores = $chat.querySelector('.scorepanel');
emojiPaint();
const $log = $chat.querySelector('.chatlog'), $panel = $chat.querySelector('.chatpanel'), $peek = $chat.querySelector('.chatpeek');
const chatLine = m => `<div class="cl${m.id === st.id ? ' own' : ''}"${prof(m)}>${avatarHtml(m.color, m.av, 30, frameCls(m.fl))}<p><b>${nameHtml(m.name, m.fl)}</b> ${esc(m.text)}</p></div>`;
// The reaction row: the six free emoji, then the stickers from packs this player has bought.
function emojiPaint() {
  const mine = stickersOf(st.me);
  const row = $chat.querySelector('.chatemoji'); row.classList.toggle('more', mine.length > 0);
  row.innerHTML = EMOJI.map((e, i) => `<button type="button" data-c="emo" data-k="${FOODS.length + i}" aria-label="${L('React', 'Reakcja')} ${e}">${e}</button>`).join('')
    + mine.map(s => `<button type="button" data-c="emo" data-k="${s.k}" aria-label="${L('Sticker', 'Naklejka')} ${s.e}">${s.e}</button>`).join('');
}
function chatPaint() {
  $log.innerHTML = chat.log.length ? chat.log.map(chatLine).join('') : `<p class="chatempty">${L('No messages yet. Say hi!', 'Nie ma jeszcze wiadomości. Przywitaj się!')}</p>`;
  $log.scrollTop = $log.scrollHeight;
}
function chatBadge() { const b = $chat.querySelector('.badge'); b.hidden = !chat.unread; b.textContent = chat.unread > 9 ? '9+' : chat.unread; }
function chatPeek(m) {
  $peek.innerHTML = chatLine(m); $peek.hidden = false;
  clearTimeout(chat.peekT); chat.peekT = setTimeout(() => { $peek.hidden = true; }, 4500);
}
function chatReset() { chat.log = []; chat.unread = 0; chat.open = false; $scores.hidden = true; $panel.hidden = true; $peek.hidden = true; chatBadge(); chatPaint(); }
$chat.addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  if (b.dataset.c === 'scores') {
    sfx.click(); $scores.hidden = !$scores.hidden;
    if (!$scores.hidden && chat.open) { chat.open = false; $panel.hidden = true; }
  } else if (b.dataset.c === 'toggle') {
    $scores.hidden = true;
    chat.open = !chat.open; $panel.hidden = !chat.open; $peek.hidden = true; sfx.click();
    if (chat.open) { chat.unread = 0; chatBadge(); $log.scrollTop = $log.scrollHeight; if (matchMedia('(pointer: fine)').matches) $chat.querySelector('input').focus(); }
  } else if (b.dataset.c === 'emo') { sfx.click(); send({ t: 'react', k: +b.dataset.k }); }
});
$chat.querySelector('form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = e.target.querySelector('input'), text = inp.value.trim(); if (!text) return;
  send({ t: 'chat', text }); inp.value = '';
});
$chat.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (chat.open) $chat.querySelector('.chatbtn').click(); else $scores.hidden = true; });

// ---------- friends ----------
// One list for the whole site. Friends are added by username, and anything a game does with friends reads this list.
let friendsSheet = null;
function friendsHtml() {
  const f = st.friends, who = x => `${avatarHtml(x.color, x.av, 40, frameCls(x.fl))}<span class="frname"${prof(x)}><b>${nameHtml(x.name, x.fl)}</b><small>${esc(x.user)}${x.lv ? ` · ${L('level', 'poziom')} ${x.lv}` : ''}</small></span>`;
  const h2 = `<h2>${L('Friends', 'Znajomi')}</h2>`, frUser = L("A friend's username", 'Nazwa użytkownika znajomego');
  if (!st.me?.user) return `${h2}<p>${L('Friends are kept with your account, so you find each other again on any device. Create one first: it only takes a username and a password.', 'Znajomi są zapisani na twoim koncie, więc odnajdziecie się na każdym urządzeniu. Najpierw załóż konto: wystarczy nazwa użytkownika i hasło.')}</p>
    <div class="row"><button type="button" class="btn m" data-fr="account" data-mode="register">${L('Create account', 'Załóż konto')}</button><button type="button" class="btn w" data-fr="account" data-mode="login">${L('Log in', 'Zaloguj się')}</button></div>`;
  if (!f) return `${h2}<p>${L('Loading…', 'Wczytywanie…')}</p>`;
  return `${h2}
    <form class="fradd"><input class="field" id="fruser" maxlength="16" placeholder="${frUser}" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="${frUser}"><button class="btn m">${L('Add', 'Dodaj')}</button></form>
    <p style="font-size:14px">${L(`Your username is <b>${esc(st.me.user)}</b>. Share it so friends can add you.`, `Twoja nazwa użytkownika to <b>${esc(st.me.user)}</b>. Podaj ją znajomym, żeby mogli cię dodać.`)}</p>
    ${f.reqs.length ? `<h3>${L('Wants to be your friend', 'Zaproszenia do znajomych')}</h3><ul class="frlist">${f.reqs.map(x => `<li>${who(x)}<span class="fract"><button type="button" class="btn sm m" data-fr="accept" data-user="${esc(x.user)}">${L('Accept', 'Przyjmij')}</button><button type="button" class="btn sm ghost-ink" data-fr="decline" data-user="${esc(x.user)}">${L('No thanks', 'Nie, dziękuję')}</button></span></li>`).join('')}</ul>` : ''}
    ${f.friends.length ? `<ul class="frlist">${f.friends.map(x => `<li>${who(x)}<span class="frdot ${x.online ? 'on' : ''}">${x.online ? L('Here now', 'Na stronie') : L('Away', 'Poza stroną')}</span>
      <span class="fract">${x.farm ? `<button type="button" class="btn sm" data-fr="visit" data-farm="${esc(x.farm)}">${L('Visit farm', 'Odwiedź farmę')}</button>` : ''}<button type="button" class="btn sm ghost-ink" data-fr="remove" data-user="${esc(x.user)}" aria-label="${L('Remove', 'Usuń:')} ${esc(x.name)}">${L('Remove', 'Usuń')}</button></span></li>`).join('')}</ul>`
      : `<p>${L('No friends yet. Add someone by their username.', 'Nie masz jeszcze znajomych. Dodaj kogoś po nazwie użytkownika.')}</p>`}
    ${f.sent.length ? `<p style="font-size:14px">${L('Waiting for an answer from', 'Czekamy na odpowiedź od:')} ${f.sent.map(x => `<b>${esc(x.user)}</b>`).join(', ')}.</p>` : ''}`;
}
function paintFriends() {
  for (const b of document.querySelectorAll('.frbadge')) { const n = st.friends?.reqs.length || 0; b.hidden = !n; b.textContent = n || ''; }
  if (!friendsSheet) return;
  const box = friendsSheet.el.querySelector('.frbody'), typed = box.querySelector('#fruser')?.value || '';
  box.innerHTML = friendsHtml();
  const inp = box.querySelector('#fruser'); if (inp) inp.value = typed;
}
function openFriends() {
  if (friendsSheet) return;
  friendsSheet = modal(`<div class="frbody"></div><button type="button" class="btn ghost-ink" data-fr="close">${L('Close', 'Zamknij')}</button>`);
  friendsSheet.onClose = () => { friendsSheet = null; };
  const el = friendsSheet.el;
  paintFriends(); if (st.me?.user) send({ t: 'friends' });
  el.addEventListener('submit', e => { e.preventDefault(); const u = el.querySelector('#fruser').value.trim(); if (!u) return; el.querySelector('#fruser').value = ''; send({ t: 'friend', op: 'add', user: u }); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-fr]'); if (!b) return;
    const a = b.dataset.fr; sfx.click();
    if (a === 'close') friendsSheet.close();
    else if (a === 'account') { friendsSheet.close(); openAccount(b.dataset.mode); }
    else if (a === 'visit') { friendsSheet.close(); if (st.farm) st.farm.visit(b.dataset.farm); else if (st.room) toast(L('Leave this table first, then visit.', 'Najpierw wyjdź od tego stołu, potem odwiedź farmę.'), true); else { farmVisit = b.dataset.farm; openFarm(); } }
    else if (a === 'remove') { if (b.dataset.sure) send({ t: 'friend', op: 'remove', user: b.dataset.user }); else { b.dataset.sure = 1; b.textContent = L('Really remove?', 'Na pewno usunąć?'); } }
    else send({ t: 'friend', op: a, user: b.dataset.user });
  });
}

// ---------- modals ----------
function modal(html, dismissable = true) {
  const m = document.createElement('div');
  m.className = 'modal'; m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const api = { el: m, onClose: null };
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); api.onClose?.(); api.onClose = null; };
  const onKey = e => { if (e.key === 'Escape' && dismissable) close(); };
  if (dismissable) m.addEventListener('click', e => { if (e.target === m) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(m);
  api.close = close; return api;
}

// ---------- the Wardrobe ----------
// One place for everything a player wears or shows: the avatar (free items and the coin shop together), the account
// style (name colour, frame, title), the table kit, win effects, stickers and isle pets. Every item is a picture tile.
// Things you own go on, and are saved, the moment you tap them. Things you have not bought are only tried on: they
// show on the preview and in the bar at the bottom, where they can be bought one by one or all at once.
const coinIco = '<i class="cn" aria-hidden="true"></i>';
const ROW_LABEL = Object.fromEntries(AV_TABS.flatMap(([, rows]) => rows));
const itemName = (k, i) => AV_COLOR_KEYS.includes(k) ? ROW_LABEL[k] : OPT[k][i];
const SEASON_ICO = { winter: '❄️', spring: '🌷', summer: '🌴', halloween: '🎃' };
const WIN_ICO = ['🚫', '🎊', '💖', '🐟', '🎆', '🪙', '❄️', '☕', '🌸', '🫧', '🦇', '🐾'];
const WD_ACC = [['name', L('Name & card', 'Imię i wizytówka'), ['nm', 'fr', 'pb', 'ti']], ['kit', L('Table kit', 'Zestaw do gier'), ['cb', 'dc', 'gb', 'kp', 'cu', 'cs', 'dm']], ['fx', L('Effects & stickers', 'Efekty i naklejki'), ['wn', 'sp']], ['isle', L('Isle', 'Wyspa'), ['ig', 'ib', 'ip', 'ik', 'fp']], ['pets', L('Isle pets', 'Zwierzaki na wyspie'), []]];
const ISLE_KINDS = ['ig', 'ib', 'ip', 'ik'];
const COS_HINT = { nm: L('The colour of your name in waiting rooms, chat and the rankings.', 'Kolor twojego imienia w poczekalniach, na czacie i w rankingach.'), fr: L('A frame round your picture.', 'Ramka wokół twojego obrazka.'),
  pb: L('The picture behind your name on your card: in waiting rooms, on your profile and here on the left. Ones with a goal are earned in the rankings or in Pet Farm.', 'Obrazek za twoim imieniem na wizytówce: w poczekalniach, na profilu i tutaj po lewej. Te z celem zdobywa się w rankingach albo na Farmie zwierzaków.'),
  ti: L('A title under your name. Titles with a goal are earned by playing.', 'Tytuł pod twoim imieniem. Tytuły z celem zdobywa się, grając.'),
  wn: L('Plays on everyone’s screen when you win, and replaces the confetti for your good moments during a match. Tap one to see it.', 'Pojawia się u wszystkich na ekranie, gdy wygrywasz, i zastępuje konfetti przy twoich dobrych momentach w trakcie gry. Dotknij, żeby zobaczyć.'),
  sp: L('Extra reactions for the chat row at any table, and extra emotes for the main chat. Every pack you own is always on.', 'Dodatkowe reakcje w pasku czatu przy każdym stole i dodatkowe emotki na czacie głównym. Każda paczka, którą masz, jest zawsze włączona.') };

function openWardrobe({ first = false, sec: startSec = 'av0', sub: startSub = '', filt: startFilt = 'all' } = {}) {
  let color = st.color, av = st.av.slice(), sec = startSec, sub = startSub, filt = startFilt, undo = null, saveT = 0;
  const pick = {}; // account cosmetics being tried on: kind -> index
  const KI = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));
  const me = () => st.me || {}, owned = () => me().owned || [], coins = () => me().coins || 0;
  const today = () => me().today ? new Date(me().today + 'T12:00') : new Date();
  const dropOn = () => Object.keys(SEASONS).find(sn => seasonOn(sn, today()) && (Object.values(SEASON).includes(sn) || WORNALL.some(k => COS[k].items.some(it => it.s === sn))));
  const WORNALL = Object.keys(COS);
  const sheet = modal(`
    <form class="creator wd${first ? ' first quick' : ''}" data-form="profile">
      <header class="wdhead"><h2>${first ? L('Who is joining the table?', 'Kto dosiada się do stołu?') : L('Wardrobe', 'Garderoba')}</h2>
        ${first ? `<button type="button" class="langbtn" data-lang="${PL ? 'en' : 'pl'}" lang="${PL ? 'en' : 'pl'}" title="${L('Polski', 'English')}"><b>${PL ? 'PL' : 'EN'}</b><span>${PL ? 'EN' : 'PL'}</span></button>` : `<span class="chip wdcoins" title="${L('Coins: every finished game pays by where you finished, 10 for 1st down to 1 for last', 'Monety: każda skończona gra płaci według zajętego miejsca, 10 za 1. miejsce, aż do 1 za ostatnie')}">${coinIco}<b></b></span><button type="button" class="round wdx" data-done aria-label="${L('Close the wardrobe', 'Zamknij garderobę')}">✕</button>`}</header>
      ${first ? `<p class="wdintro">${L('No account and no setup needed. Here is a random name and look: you can change them any time.', 'Bez konta i bez ustawiania. Masz losowe imię i wygląd: zmienisz je, kiedy zechcesz.')}</p>` : ''}
      <div class="wdside">
        <div class="pv3d" id="pv"></div><div class="pv3d pvisle" id="pvi" hidden></div>
        <div class="wdme">
          <div class="wdplate" aria-label="${L('How others see you', 'Jak widzą cię inni')}"></div>
          <div class="namecol"><label for="nm">${L('Name', 'Imię')}</label><input class="field" id="nm" maxlength="16" required placeholder="${L('e.g. Noodle Queen', 'np. Królowa Klusek')}" value="${esc(st.name || (first ? randomName(PL) : ''))}" autocomplete="nickname">${first ? `<button type="button" class="round wdreroll" data-rename title="${L('Another random name', 'Inne losowe imię')}" aria-label="${L('Another random name', 'Inne losowe imię')}">🎲</button>` : ''}</div>
          <div class="pvbar"><span class="pvseg"><button type="button" data-cam="0" aria-pressed="true">${L('Body', 'Ciało')}</button><button type="button" data-cam="1" aria-pressed="false">${L('Face', 'Twarz')}</button></span>
            <button type="button" class="btn w sm" data-rand>${L('Surprise me', 'Zaskocz mnie')}</button><button type="button" class="btn w sm" data-undo hidden>${L('Undo', 'Cofnij')}</button></div>
        </div>
      </div>
      <nav class="wdrail" aria-label="${L('Wardrobe sections', 'Działy garderoby')}"></nav>
      <div class="wdbody"><div class="wdsub"></div><p class="wdhint"></p><div class="wdgrid"></div></div>
      <div class="cart" aria-live="polite"></div>
      ${first ? `<div class="wdfoot"><button class="btn big">${L('Play', 'Graj')}</button><button type="button" class="btn ghost-ink" data-custom>${L('Change my look', 'Zmień wygląd')}</button><button type="button" class="btn ghost-ink" data-login>${L('I already have an account', 'Mam już konto')}</button></div>` : ''}
    </form>`, !first);
  const { el, close } = sheet; el.querySelector('.sheet').classList.add('wdsheet');
  const q = s => el.querySelector(s), nm = q('#nm'), pv = q('#pv'), pvi = q('#pvi'), rail = q('.wdrail'), subEl = q('.wdsub'), hint = q('.wdhint'), grid = q('.wdgrid'), cart = q('.cart'), plate = q('.wdplate');
  let view = P3?.creatorPreview(pv) || null, open = true;
  st.creatorOpen = true;
  if (!P3) p3Ready.then(() => { if (!open || !P3) return; pv.innerHTML = ''; view = P3.creatorPreview(pv); show(); paintPlate(); });
  if (!IP) ipReady.then(() => { if (!open) return; if (IP) fillPics(); else grid.classList.add('nopic'); });
  const show = () => { if (view) view.set(color, av); else pv.innerHTML = avatarHtml(color, av, 150); };
  const val = k => k === 'color' ? color : av[KI[k]];
  const isLocked = (k, i) => needsOwning(k, i) && !owned().includes(k + ':' + i);
  const worn = k => pick[k] ?? (me().cos?.[k] | 0), has = (k, i) => cosHas(me(), k, i);
  const flNow = () => Object.fromEntries(WORN.map(k => [k, worn(k)]));
  // The isle sections show the isle itself in place of the avatar, wearing what is on plus anything being tried.
  const showIsle = () => {
    const on = !first && (sec === 'isle' || sec === 'pets'); pvi.hidden = !on; pv.hidden = on; el.querySelector('form').classList.toggle('isleview', on);
    if (on) (heroMod ||= import('./hero3d.js')).then(m => { m.setHeroNight(isNight()); if (open && !pvi.hidden) m.mountIsle(pvi, color, wearable(av, owned()), myShow(), { ...flNow(), ip: myDecor(), fp: me().cos?.fp }); }).catch(() => {});
  };

  // Saving: only what is owned is ever saved, so a tried-on item never reaches other players.
  const commit = () => {
    clearTimeout(saveT); saveT = 0; if (first || !st.name) return;
    const w = wearable(av, owned()); if (w.join() === st.av.join() && color === st.color) return;
    st.av = w; st.color = color; LS.set('ct_color', color); LS.set('ct_av', JSON.stringify(w));
    send({ t: 'profile', name: st.name, color, av: w });
  };
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(commit, 350); };
  const saveName = () => {
    const n = nm.value.replace(/[<>]/g, '').trim().slice(0, 16); if (first || !n || n === st.name) return;
    st.name = n; LS.set('ct_name', n); send({ t: 'profile', name: n, color: st.color, av: st.av });
  };

  // ----- sections -----
  const sections = () => {
    const d = dropOn();
    return [...(d && !first ? [{ id: 'drop', name: `${SEASON_ICO[d]} ${SEASONS[d].name}`, drop: d }] : []),
      ...AV_TABS.map(([name, rows], i) => ({ id: 'av' + i, name, rows, grp: L('Avatar', 'Awatar') })),
      ...(first ? [] : WD_ACC.map(([id, name, kinds]) => ({ id, name, kinds, grp: L('Account', 'Konto') })))];
  };
  const cur = () => sections().find(s => s.id === sec) || sections().find(s => s.id === 'av0');
  const paintRail = () => { let g = '';
    rail.innerHTML = sections().map(s => `${s.grp && s.grp !== g && !first ? `<span class="wdgrp">${g = s.grp}</span>` : ''}<button type="button" data-sec="${s.id}" aria-pressed="${s.id === cur().id}"${s.drop ? ' class="dropb"' : ''}>${s.name}</button>`).join('');
    rail.querySelector('[aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  // ----- tiles -----
  const yours = L('✓ yours', '✓ masz'), cCoins = n => cnt(n, 'coin', 'coins', 'moneta', 'monety', 'monet');
  const avTile = (k, i) => {
    const hex = k === 'color', sw = hex || AV_COLOR_KEYS.includes(k), v = hex ? COLORS[i] : i, p = hex ? 0 : priceOf(k, i), lk = !hex && isLocked(k, i);
    const sn = hex ? null : seasonOf(k, i), off = lk && !onSale(k, i, today()), on = val(k) === v;
    const label = sw ? `${hex ? L('Top colour', 'Kolor góry') : ROW_LABEL[k]} ${i + 1}` : OPT[k][i];
    const pk = !hex && packOf(k, i), note = off ? `${L('back in', 'wraca:')} ${SEASONS[sn].back}` : lk && pk ? `☕ ${L('supporters', 'wspierający')}` : lk ? `${coinIco}${p}${sn ? ` ${SEASON_ICO[sn]}` : ''}` : p || pk ? yours : '';
    return `<button type="button" class="wdtile${sw ? ' sw' : ''}${lk ? ' lk' : ''}${on && lk ? ' try' : ''}"${off ? ' disabled' : ''} aria-pressed="${on}" data-k="${k}" data-v="${v}" aria-label="${esc(label)}${lk ? `, ${pk ? L('Supporter pack', 'Pakiet wspierających') : cCoins(p)}` : ''}">${
      sw ? `<i class="wdsw" style="--c:${hex ? v : OPT[k][i]}"></i>` : `<img alt="" data-ip="${k}:${i}"><b ${fitw(label)}>${esc(label)}</b>`}<small>${note}</small></button>`;
  };
  const avList = k => {
    const n = k === 'color' ? COLORS.length : OPT[k].length, ids = [...Array(n).keys()];
    const lk = i => k !== 'color' && isLocked(k, i), off = i => lk(i) && !onSale(k, i, today());
    return ids.filter(i => filt === 'mine' ? !lk(i) : filt === 'shop' ? lk(i) : true).sort((a, b) => off(a) - off(b));
  };
  const cosPic = (k, i, it) => k === 'nm' ? `<span class="wdtxt" ${fitw(st.name || L('Name', 'Imię'), '700 100px Rubik, sans-serif')}>${nameHtml(st.name || L('Name', 'Imię'), { nm: i })}</span>`
    : k === 'fr' ? avatarHtml(color, av, 60, frameCls({ fr: i }))
    : k === 'pb' ? `<span class="wdbg${i ? '' : ' none'}">${cardBg({ pb: i })}${it.t === 'a' || it.a ? `<em>${L('moves', 'rusza się')}</em>` : ''}</span>`
    : k === 'ti' ? `<span class="wdtxt">${i ? `<span class="ttl" ${fitw(it.n)}>${esc(it.n)}</span>` : `<span class="ttl none">${L('no title', 'bez tytułu')}</span>`}</span>`
    : k === 'wn' ? (winPic(i) ? `<span class="wdemo"><img alt="" src="${winPic(i)}"></span>` : `<span class="wdemo">${WIN_ICO[i] || '✨'}</span>`)
    : k === 'sp' ? `<span class="wdemo sm">${(it.e.length ? it.e : EMOJI).slice(0, 6).join('')}</span>`
    : ISLE_KINDS.includes(k) ? `<img alt="" class="islepic${k === 'ik' ? ' isk' + i : ''}" data-isle="${k}:${i}">`
    : `<img alt="" data-kit="${k}:${i}"${skinPicNow(k, i, color, av) ? ` src="${skinPicNow(k, i, color, av)}"` : ''}>`;
  const cosState = (k, i) => { const it = cosItem(k, i), own = has(k, i), pr = !own && earnProgress(it, me()); return { it, own, pr, off: !own && !pr && !cosOnSale(k, i, today()) }; };
  const cosTile = (k, i) => {
    const { it, own, pr, off } = cosState(k, i), multi = COS[k].multi, on = multi ? own || pick[k] === i : worn(k) === i;
    const note = pr ? `${pr[0]}/${pr[1]} · ${esc(pr[2])}` : off ? `${L('back in', 'wraca:')} ${cosSeason(k, i).back}` : !own && it.pk ? `☕ ${L('supporters', 'wspierający')}` : !own ? `${coinIco}${it.p}${it.s ? ` ${SEASON_ICO[it.s] || ''}` : ''}` : it.p || it.earn || it.pk ? yours : '';
    return `<button type="button" class="wdtile cos${own ? '' : ' lk'}${pick[k] === i ? ' try' : ''}${pr ? ' goal' : ''}"${pr || off ? ' disabled' : ''} aria-pressed="${on}" data-c="${k}" data-v="${i}">${cosPic(k, i, it)}${k === 'ti' || k === 'nm' ? '' : `<b ${fitw(it.n)}>${esc(it.n)}</b>`}${k === 'nm' ? `<b ${fitw(it.n)}>${esc(it.n)}</b>` : ''}<small>${note}</small></button>`;
  };
  const cosList = k => COS[k].items.map((_, i) => i).filter(i => { const s = cosState(k, i); return filt === 'mine' ? s.own : filt === 'shop' ? !s.own && !s.pr : true; })
    .sort((a, b) => { const x = cosState(k, a), y = cosState(k, b); return (x.off || !!x.pr) - (y.off || !!y.pr); });
  const petsHtml = () => { const pets = st.pets || [], ids = showIds();
    return !me().user ? `<p class="wdnone">${L('Log in and start a Pet Farm to show off your pets.', 'Zaloguj się i załóż Farmę zwierzaków, żeby pochwalić się swoimi zwierzakami.')}</p>` : !pets.length ? `<p class="wdnone">${L('Hatch a pet in Pet Farm and it can come along.', 'Wykluj zwierzaka na Farmie zwierzaków, a będzie mógł ci towarzyszyć.')}</p>`
      : pets.map(x => { const n = ids.indexOf(x.id); return `<button type="button" class="wdtile pet" aria-pressed="${n >= 0}" data-pal="${esc(x.id)}">${n >= 0 ? `<i class="palno">${n + 1}</i>` : ''}${petImg(x, 60, 'palpic')}<b ${fitw(x.name)}>${esc(x.name)}</b><small>${L('lv', 'poz.')} ${x.lv | 0}</small></button>`; }).join('');
  };
  const decorHtml = () => { const list = st.decor || [], out = myDecor();
    return !me().user ? `<p class="wdnone">${L('Log in and start a Pet Farm: the decorations you build there can stand on your isle.', 'Zaloguj się i załóż Farmę zwierzaków: ozdoby, które tam zbudujesz, mogą stanąć na twojej wyspie.')}</p>` : !list.length ? `<p class="wdnone">${L('Build a decoration on your Pet Farm (a tree, a pond, a windmill…) and you can put one like it on your isle.', 'Zbuduj ozdobę na Farmie zwierzaków (drzewo, staw, wiatrak…), a będzie można postawić taką samą na wyspie.')}</p>`
      : list.map(x => { const n = out.indexOf(x.t); return `<button type="button" class="wdtile pet" aria-pressed="${n >= 0}" data-dec="${esc(x.t)}">${n >= 0 ? `<i class="palno">${n + 1}</i>` : ''}<img alt="" class="islepic" data-isle="ip:${esc(x.t)}"><b ${fitw(x.n)}>${esc(x.n)}</b></button>`; }).join('');
  };
  const piecesHtml = () => { const out = piecesOf(me());
    return Object.entries(PIECES).map(([id, n]) => { const at = out.indexOf(id); return `<button type="button" class="wdtile pet" aria-pressed="${at >= 0}" data-fp="${id}">${at >= 0 ? `<i class="palno">${at + 1}</i>` : ''}<img alt="" class="islepic" data-isle="fp:${id}"><b ${fitw(n)}>${esc(n)}</b></button>`; }).join('');
  };
  const dropHtml = sn => [...Object.entries(SEASON).filter(([, s]) => s === sn).map(([id]) => { const [k, i] = id.split(':'); return [k, +i, 0]; }),
    ...Object.keys(COS).flatMap(k => COS[k].items.map((it, i) => it.s === sn ? [k, i, 1] : null).filter(Boolean))]
    .filter(([k, i, c]) => { const own = c ? has(k, i) : !isLocked(k, i); return filt === 'mine' ? own : filt === 'shop' ? !own : true; })
    .map(([k, i, c]) => c ? cosTile(k, i) : avTile(k, i)).join('');

  const fillPics = () => {
    for (const im of grid.querySelectorAll('img[data-kit]:not([src])')) { const [k, i] = im.dataset.kit.split(':'); skinPic(k, +i, color, av).then(u => { if (u && im.isConnected) im.src = u; }); }
    petPics(grid);
    const isles = [...grid.querySelectorAll('img[data-isle]:not([src])')];
    if (isles.length) (islePics ||= import('./islepic.js')).then(m => { let j = 0; // one a frame: each is a whole little scene
      const next = () => { if (!open) return; while (j < isles.length && !isles[j].isConnected) j++; if (j >= isles.length) return; const im = isles[j++], [k, i] = im.dataset.isle.split(':'), u = m.islePic(k, k === 'ip' || k === 'fp' ? i : +i); if (u) im.src = u; requestAnimationFrame(next); };
      next(); }).catch(() => {});
    if (!IP) return;
    const imgs = [...grid.querySelectorAll('img[data-ip]:not([src])')], look = av.slice(), col = color; let n = 0;
    const step = () => { // a few per frame, so a long list never freezes the page
      if (!open) return; const t0 = performance.now();
      while (n < imgs.length && performance.now() - t0 < 12) { const im = imgs[n++]; if (!im.isConnected) continue; const [k, i] = im.dataset.ip.split(':'), u = IP.itemPic(k, +i, col, look); if (u) im.src = u; }
      if (n < imgs.length) requestAnimationFrame(step);
    };
    step();
  };
  const paintGrid = keep => {
    const s = cur(), top = keep ? grid.scrollTop : 0; sec = s.id;
    const subs = s.rows ? s.rows.map(([k, l]) => [k, l]) : s.kinds?.length ? s.kinds.map(k => [k, COS[k]?.label || (k === 'fp' ? L('Floating pieces', 'Latające elementy') : L('Decor', 'Ozdoby'))]) : [];
    if (!subs.some(([k]) => k === sub)) sub = subs[0]?.[0] || '';
    const noFilt = first || s.id === 'pets' || sub === 'ip' || sub === 'fp';
    subEl.innerHTML = `<div class="wdchips">${subs.length > 1 ? subs.map(([k, l]) => `<button type="button" data-sub="${k}" aria-pressed="${k === sub}">${l}</button>`).join('') : ''}</div>${
      noFilt ? '' : `<span class="pvseg wdfilt" role="group" aria-label="${L('Show', 'Pokaż')}">${[['all', L('All', 'Wszystko')], ['mine', L('Mine', 'Moje')], ['shop', L('Shop', 'Sklep')]].map(([f, l]) => `<button type="button" data-f="${f}" aria-pressed="${f === filt}">${l}</button>`).join('')}</span>`}`;
    hint.textContent = s.drop ? L(`Limited: on sale until ${SEASONS[s.drop].ends}. What you buy is yours to keep.`, `Edycja limitowana: w sprzedaży do ${SEASONS[s.drop].ends}. To, co kupisz, zostaje z tobą na zawsze.`) : s.id === 'pets' ? L(`Up to ${PET_SLOTS} of your Pet Farm pets stand on your isle. The first one also sits beside you in waiting rooms.`, `Na twojej wyspie mogą stać najwyżej ${PET_SLOTS} zwierzaki z Farmy zwierzaków. Pierwszy siedzi też obok ciebie w poczekalniach.`)
      : sub === 'fp' ? L(`Pick up to ${PIECE_SLOTS} game pieces to float round your isle. They are free.`, `Wybierz do ${PIECE_SLOTS} elementów z gier, które będą latać wokół twojej wyspy. Są darmowe.`)
      : sub === 'ip' ? L(`Up to ${DECOR_SLOTS} decorations from your Pet Farm can stand on your isle. They stay on the farm too.`, `Na twojej wyspie może stanąć do ${DECOR_SLOTS} ozdób z Farmy zwierzaków. Zostają też na farmie.`)
      : s.kinds ? COS[sub].where || COS_HINT[sub] || '' : '';
    const html = s.drop ? dropHtml(s.drop) : s.id === 'pets' ? petsHtml() : sub === 'ip' ? decorHtml() : sub === 'fp' ? piecesHtml() : s.rows ? avList(sub).map(i => avTile(sub, i)).join('') : cosList(sub).map(i => cosTile(sub, i)).join('');
    grid.className = 'wdgrid' + (ipFailed ? ' nopic' : '') + (s.rows && (sub === 'color' || AV_COLOR_KEYS.includes(sub)) ? ' sws' : '');
    grid.innerHTML = html || `<p class="wdnone">${filt === 'mine' ? L('Nothing of yours here yet. Look under Shop.', 'Nie masz tu jeszcze nic swojego. Zajrzyj do Sklepu.') : filt === 'shop' ? L('Nothing left to buy here.', 'Nie ma tu już nic do kupienia.') : L('Nothing here.', 'Nic tu nie ma.')}</p>`;
    grid.scrollTop = top; fillPics();
  };
  const paintPlate = () => {
    const fl = flNow(), pal = (st.pets || []).find(x => x.id === showIds()[0]);
    plate.className = 'wdplate' + cardBgCls(fl);
    plate.innerHTML = `${cardBg(fl)}${avatarHtml(color, wearable(av, owned()), 54, frameCls(fl))}<div><b>${nameHtml(nm.value.trim() || L('Your name', 'Twoje imię'), fl)} ${first ? '' : meChip()}</b>${titleHtml(fl)}${fl.wn ? `<small>${L('Win effect', 'Efekt wygranej')}: ${esc(cosItem('wn', fl.wn).n)}</small>` : ''}</div>${pal ? petImg(pal, 44) : ''}`;
    petPics(plate);
    const c = q('.wdcoins b'); if (c) c.textContent = coins();
    showIsle();
  };
  const wants = () => [...lockedIn(av, owned()).map(id => { const [k, i] = id.split(':'); return { id, name: itemName(k, +i), p: priceOf(k, +i), pk: !!packOf(k, +i), dot: AV_COLOR_KEYS.includes(k) ? OPT[k][+i] : '' }; }),
    ...Object.entries(pick).map(([k, i]) => ({ id: k + ':' + i, name: cosItem(k, i).n, kind: COS[k].label.toLowerCase(), p: cosItem(k, i).p || 0, pk: !!cosItem(k, i).pk }))];
  const paintCart = () => {
    const w = first ? [] : wants(), nb = w.filter(x => !x.pk).length, total = w.reduce((s, x) => s + x.p, 0), short = total - coins(); // nb: how many of them coins can buy
    cart.innerHTML = w.length ? `<div class="cartlist"><b>${L('Trying on', 'Przymierzasz')}</b>${w.map(x => `<span class="cartitem">${x.dot ? `<i class="dot" style="--c:${x.dot}"></i>` : ''}${esc(x.name)}${x.kind ? ` <small>${esc(x.kind)}</small>` : ''}${
      x.pk ? ' <small>☕</small>' : w.length > 1 ? `<button type="button" class="btn sm w" data-buy="${x.id}" ${x.p > coins() ? 'disabled' : ''}>${coinIco}${x.p}</button>` : ''}</span>`).join('')}</div>
      <div class="cartact"><small>${L('Only you see these until you buy them. You have', 'Dopóki ich nie kupisz, widzisz je tylko ty. Masz')} ${coinIco}${coins()}.</small><button type="button" class="btn sm w" data-off>${L('Take off', 'Zdejmij')}</button>
      ${nb < w.length ? `<button type="button" class="btn${nb ? ' w' : ''}" data-act="support">☕ ${L('Supporter pack', 'Pakiet wspierających')}</button>` : ''}
      ${nb ? `<button type="button" class="btn" data-buyall ${short > 0 ? 'disabled' : ''}>${short > 0 ? L(`Need ${short} more coins`, `Brakuje ${cCoins(short)}`) : `${nb > 2 ? L(`Buy all ${nb}`, `Kup wszystkie ${nb}`) : nb === 2 ? L('Buy both', 'Kup oba') : L('Buy', 'Kup')} ${coinIco}${total}`}</button>` : ''}</div>` : '';
  };
  const paint = keep => { paintRail(); paintGrid(keep); paintPlate(); paintCart(); };
  const camBtns = face => el.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.cam === '1') === face));
  const setCam = face => { view?.face(face); camBtns(face); };

  let sig = '';
  const sigOf = () => owned().length + JSON.stringify(me().cos || {}) + (st.pets?.length | 0) + (st.decor?.length | 0) + (me().user || '');
  st.onMe = () => {
    if (!open) return;
    for (const k of Object.keys(pick)) if (has(k, pick[k])) delete pick[k];
    if (!first && wearable(av, owned()).join() !== st.av.join()) commit(); // something tried on was just bought: it is worn for real now
    const s = sigOf(); if (s !== sig) { sig = s; paint(true); } else { paintPlate(); paintCart(); }
  };
  if (me().user && !first) send({ t: 'pets' });
  sheet.onClose = () => { open = false; st.creatorOpen = false; st.onMe = null; if (!first) { saveName(); commit(); } view?.dispose(); if (!first && (st.view === 'hub' || st.view === 'lobby')) go(st.view); };
  sig = sigOf(); paint(); show(); setCam(sec === 'av1');
  // (no focus on the name: the welcome window is one tap on Play, and a phone keyboard popping up would hide it)

  nm.addEventListener('input', paintPlate);
  nm.addEventListener('change', saveName);
  el.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-done]')) return close();
    const lg = t.closest('[data-lang]'); if (lg) return setLang(lg.dataset.lang);
    if (t.closest('[data-login]')) { close(); return openAccount('login'); }
    const sb = t.closest('[data-sec]'); if (sb) { sec = sb.dataset.sec; sub = ''; sfx.click(); paintRail(); paintGrid(); showIsle(); return setCam(sec === 'av1'); }
    const su = t.closest('[data-sub]'); if (su) { sub = su.dataset.sub; sfx.click(); return paintGrid(); }
    const fb = t.closest('[data-f]'); if (fb) { filt = fb.dataset.f; sfx.click(); return paintGrid(); }
    const cb = t.closest('[data-cam]'); if (cb) return setCam(cb.dataset.cam === '1');
    const buy = id => { const [k, i] = id.split(':'); send({ t: 'buy', k, i: +i }); };
    const by = t.closest('[data-buy]'); if (by) { by.disabled = true; return buy(by.dataset.buy); }
    const all = t.closest('[data-buyall]'); if (all) { all.disabled = true; return wants().filter(x => !x.pk).forEach(x => buy(x.id)); }
    if (t.closest('[data-off]')) { av = wearable(av, owned()).map((v, i) => v || !av[i] ? v : st.av[i]); for (const k of Object.keys(pick)) delete pick[k]; sfx.pop(); show(); return paint(true); }
    if (t.closest('[data-custom]')) { q('form').classList.remove('quick'); t.closest('[data-custom]').hidden = true; sfx.click(); return; }
    if (t.closest('[data-rename]')) { nm.value = randomName(PL); sfx.pop(); paintPlate(); return; }
    if (t.closest('[data-rand]')) { undo = [color, av.slice()]; av = randomAv(); color = COLORS[Math.random() * COLORS.length | 0]; q('[data-undo]').hidden = false; sfx.set(); show(); paint(); return saveSoon(); }
    if (t.closest('[data-undo]')) { if (undo) [color, av] = undo; undo = null; q('[data-undo]').hidden = true; sfx.pop(); show(); paint(); return saveSoon(); }
    const pl = t.closest('[data-pal]');
    if (pl) { // tap to add a pet to the next free slot, tap again to take it off
      const id = pl.dataset.pal, ids = showIds(), at = ids.indexOf(id);
      if (at >= 0) ids.splice(at, 1); else if (ids.length >= PET_SLOTS) return toast(L(`Your isle has room for ${PET_SLOTS} pets. Tap one to take it off first.`, `Na twojej wyspie zmieszczą się ${PET_SLOTS} zwierzaki. Najpierw dotknij jednego, żeby go zdjąć.`)); else ids.push(id);
      sfx.pop(); const c = st.me.cos ||= {}; c.pets = ids; c.pet = ids[0]; send({ t: 'wear', k: 'pets', i: ids }); paintGrid(true); return paintPlate();
    }
    const fp = t.closest('[data-fp]');
    if (fp) { // a floating game piece: tap to add it, tap again to take it away
      const id = fp.dataset.fp, l = piecesOf(me()).slice(), at = l.indexOf(id);
      if (at >= 0) l.splice(at, 1); else if (l.length >= PIECE_SLOTS) return toast(L(`${PIECE_SLOTS} pieces is the most. Tap one to take it away first.`, `Najwięcej może być ${PIECE_SLOTS}. Najpierw dotknij jednego elementu, żeby go zabrać.`)); else l.push(id);
      sfx.pop(); (st.me.cos ||= {}).fp = l; send({ t: 'wear', k: 'fp', i: l }); paintGrid(true); return paintPlate();
    }
    const dc = t.closest('[data-dec]');
    if (dc) { // a Pet Farm decoration: tap to stand it on the isle, tap again to take it back
      const ty = dc.dataset.dec, l = myDecor(), at = l.indexOf(ty);
      if (at >= 0) l.splice(at, 1); else if (l.length >= DECOR_SLOTS) return toast(L(`Your isle has room for ${DECOR_SLOTS} decorations. Tap one to take it off first.`, `Na twojej wyspie zmieści się ${DECOR_SLOTS} ozdób. Najpierw dotknij jednej, żeby ją zdjąć.`)); else l.push(ty);
      sfx.pop(); (st.me.cos ||= {}).ip = l; send({ t: 'wear', k: 'ip', i: l }); paintGrid(true); return paintPlate();
    }
    const a = t.closest('[data-k]');
    if (a) { // an avatar item: owned ones go on and save, the rest are tried on (tap a tried-on item again to take it off)
      const k = a.dataset.k, hex = k === 'color', v = hex ? a.dataset.v : +a.dataset.v;
      if (hex) color = v; else av[KI[k]] = val(k) === v && isLocked(k, v) ? st.av[KI[k]] : v;
      for (const x of grid.querySelectorAll(`[data-k="${k}"]`)) { const on = String(val(k)) === x.dataset.v; x.setAttribute('aria-pressed', on); x.classList.toggle('try', on && x.classList.contains('lk')); }
      undo = null; q('[data-undo]').hidden = true;
      sfx.pop(); show(); paintPlate(); paintCart(); return saveSoon();
    }
    const c = t.closest('[data-c]'); if (!c) return;
    const k = c.dataset.c, i = +c.dataset.v; sfx.pop();
    if (k === 'wn' && i) playWinFx(i, { ms: 2600 });
    if (has(k, i)) { delete pick[k]; if (!COS[k].multi) { (st.me.cos ||= {})[k] = i; send({ t: 'wear', k, i }); } }
    else if (pick[k] === i) delete pick[k]; else pick[k] = i;
    paintGrid(true); paintPlate(); paintCart();
  });
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); if (!first) return saveName();
    const n = nm.value.replace(/[<>]/g, '').trim().slice(0, 16) || randomName(PL);
    st.name = n; st.color = color; st.av = wearable(av, owned());
    LS.set('ct_name', n); LS.set('ct_color', color); LS.set('ct_av', JSON.stringify(st.av));
    send({ t: 'profile', name: n, color, av: st.av });
    sfx.click(); close();
    if (pendingJoin) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
    go(st.view === 'game' ? 'game' : st.view);
  });
}
const openProfile = (first = false) => openWardrobe({ first });
const openStyle = () => openWardrobe({ sec: 'name' });

// Another player's profile card: their isle with the pets they show off, their rank and best games, and their table kit.
let playerSheet = null;
// A player's finished constellations: up to four hang in their isle's sky (the one by their rank first), and all of
// them sit in a strip of night sky with the one being lit.
const skyDone = p => { const ids = doneIds(p.sky || {}); return [...ids.filter(id => id === p.cn), ...ids.filter(id => id !== p.cn)].map(conOf); };
const skyHang = p => { const d = skyDone(p).slice(0, 4); return d.length ? `<div class="cnsky n${d.length}">${d.map(c => `<figure>${conArt(c, c.p.length, { size: 92, r: 7.5, guide: false })}<figcaption>${esc(c.n)}</figcaption></figure>`).join('')}</div>` : ''; };
function skyStrip(p) {
  const sky = p.sky || {}, d = skyDone(p), part = CONS.filter(c => sky.lit?.[c.id] && !isDone(sky, c.id));
  if (!d.length && !part.length) return '';
  const left = CONS.length - d.length - part.length;
  return `<h3>${L('Constellations', 'Gwiazdozbiory')}<span class="cnt">${d.length} ${L('of', 'z')} ${CONS.length}</span></h3><div class="cnstrip">
    ${d.map(c => `<figure>${conTile(c)}<figcaption>${esc(c.n)}</figcaption></figure>`).join('')}
    ${part.map(c => `<figure class="todo">${conTile(c, sky.lit[c.id])}<figcaption>${esc(c.n)}<small>${sky.lit[c.id]} / ${c.p.length}</small></figcaption></figure>`).join('')}
    ${left ? `<div class="more" title="${L('Not lit yet', 'Jeszcze niezapalone')}">+${left}</div>` : ''}</div>`;
}
function openPlayer(p) {
  if (!p) return; playerSheet?.close();
  const rate = p.games ? Math.round(100 * p.wins / p.games) : 0, kit = ['cb', 'dc', 'gb', 'kp', 'cu', 'cs', 'dm'];
  const sheet = playerSheet = modal(`
    <div class="profcard">
      <div class="pisle">${skyHang(p)}<div class="art sky3d"></div>${p.pets.length ? `<div class="ppets">${p.pets.map(x => `<span>${petImg(x, 34, 'palpic')}<b>${esc(x.name)}</b> <small>${L('lv', 'poz.')} ${x.lv | 0}</small></span>`).join('')}</div>` : ''}</div>
      <div class="pinfo">
        <div class="phead${cardBgCls(p.fl)}">${cardBg(p.fl)}${avatarHtml(p.color, p.av, 72, frameCls(p.fl))}<div><h2>${nameHtml(p.name, p.fl)} ${p.lv ? lvChip(p.lv, p.cn) : ''}</h2>
          ${titleHtml(p.fl)}<small>${p.me ? L('This is you', 'To ty') : p.online ? `<i class="dot on"></i>${L('Online now', 'Teraz online')}` : L('Not online', 'Offline')}${p.guest ? L(' · guest', ' · gość') : ''} · ${esc(p.lv ? rankOf(p.lv).name : p.rank || '')}${conOf(p.cn) ? ` · ${L('constellation', 'gwiazdozbiór')}: ${esc(conOf(p.cn).n)}` : ''}</small></div></div>
        <div class="pstats"><span><b>${num(p.games)}</b>${L('games', 'gry')}</span><span><b>${num(p.wins)}</b>${L('wins', 'wygrane')}</span><span><b>${rate}%</b>${L('win rate', 'skuteczność')}</span><span><b>${num(p.xp)}</b>XP</span></div>
        ${skyStrip(p)}
        ${p.top.length ? `<h3>${L('Best games', 'Najlepsze gry')}</h3><ul class="ptop">${p.top.map(g => `<li><b>${esc(GAMES[g.g]?.name || SOLO[g.g]?.name || g.g)}</b><span>${cWins(g.wins)} · ${cGames(g.games)}</span></li>`).join('')}</ul>` : `<p>${L('No finished games yet.', 'Nie ma jeszcze skończonych gier.')}</p>`}
        <h3>${L('Table kit', 'Zestaw do gier')}</h3>
        <div class="stylekit pkit">${kit.map(k => { const i = p.fl[k] | 0, u = skinPicNow(k, i, p.color, p.av); return `<figure><img width="54" height="54" alt="" data-kit="${k}:${i}"${u ? ` src="${u}"` : ''}><figcaption><small>${COS[k].label}</small>${esc(cosItem(k, i)?.n || L('Classic', 'Klasyczny'))}</figcaption></figure>`; }).join('')}</div>
      </div>
    </div>
    <div class="row"><button type="button" class="btn big" data-done>${L('Close', 'Zamknij')}</button>${p.me ? `<button type="button" class="btn big w" data-style>✨ ${L('Change your style', 'Zmień swój styl')}</button>` : ''}${
      p.rel === 'none' ? `<button type="button" class="btn big m" data-fr="add">${L('Add friend', 'Dodaj do znajomych')}</button>`
      : p.rel === 'req' ? `<button type="button" class="btn big m" data-fr="accept">${L('Accept friend request', 'Przyjmij zaproszenie')}</button>`
      : p.rel === 'sent' ? `<button type="button" class="btn big w" disabled>${L('Friend request sent', 'Zaproszenie wysłane')}</button>`
      : p.rel === 'friend' ? `<span class="chip pfriend">✓ ${L('Friends', 'Znajomi')}</span>`
      : p.rel === 'guest' && !p.guest ? `<button type="button" class="btn big w" data-fr="account">${L('Create an account to add friends', 'Załóż konto, żeby dodawać znajomych')}</button>`
      : p.rel === 'noacc' ? `<span class="pfnote">${L("Guests can't be added as friends until they make an account.", 'Gości nie da się dodać do znajomych, dopóki nie założą konta.')}</span>` : ''}</div>
    ${p.me && st.me?.user ? `<div class="pdelrow"><button type="button" class="btn ghost-ink pdel" data-delacct>${L('Delete account', 'Usuń konto')}</button></div>` : ''}`);
  sheet.pt = p.pt;
  const { el } = sheet; el.querySelector('.sheet').classList.add('wide', 'psheet');
  petPics(el);
  for (const im of el.querySelectorAll('img[data-kit]:not([src])')) { const [k, i] = im.dataset.kit.split(':'); skinPic(k, +i, p.color, p.av).then(u => { if (u && im.isConnected) im.src = u; }); }
  const box = el.querySelector('.pisle .art');
  box.innerHTML = avatarHtml(p.color, p.av, 150, frameCls(p.fl)); // stays if the 3D isle cannot load
  (heroMod ||= import('./hero3d.js')).then(m => { m.setHeroNight(isNight()); if (box.isConnected) m.mountIsle(box, p.color, p.av, p.pets, p.fl, box.closest('.pisle')); }).catch(() => {});
  sheet.onClose = () => { if (playerSheet === sheet) playerSheet = null; };
  el.addEventListener('click', e => {
    const fr = e.target.closest('[data-fr]');
    if (fr?.dataset.fr === 'account') { sheet.close(); return openAccount('register'); }
    if (fr) { fr.disabled = true; sfx.pop(); return send({ t: 'friend', op: fr.dataset.fr, pt: p.pt }); }
    if (e.target.closest('[data-delacct]')) { sfx.click(); sheet.close(); return openDeleteAccount(); }
    if (e.target.closest('[data-done]')) sheet.close(); else if (e.target.closest('[data-style]')) { sheet.close(); openStyle(); }
  });
}
document.addEventListener('click', e => {
  const row = e.target.closest('[data-prof]'); if (!row) return;
  const hit = e.target.closest('button, a, input, label'); if (hit && row.contains(hit)) return;
  sfx.click(); send({ t: 'player', pt: row.dataset.prof });
});

function openAccount(mode = 'register') {
  const reg = mode === 'register';
  const { el, close } = modal(`
    <h2>${reg ? L('Create an account', 'Załóż konto') : L('Log in', 'Zaloguj się')}</h2>
    <p>${reg ? L('Just a username and a password, no email. Your rank, XP and wins so far move into the account, and you can log in from any device.', 'Wystarczy nazwa użytkownika i hasło, bez e-maila. Twoja ranga, XP i dotychczasowe wygrane przechodzą na konto, a zalogować się możesz z każdego urządzenia.')
      : L('Pick up your rank, XP and wins on this device.', 'Odzyskaj swoją rangę, XP i wygrane na tym urządzeniu.')}</p>
    <form class="authform">
      <label for="au">${L('Username', 'Nazwa użytkownika')}</label>
      <input class="field" id="au" maxlength="16" required autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="ap">${L('Password', 'Hasło')}</label>
      <input class="field" id="ap" type="password" minlength="6" maxlength="72" required autocomplete="${reg ? 'new-password' : 'current-password'}">
      <p class="autherr" role="alert" hidden></p>
      ${reg ? `<p style="font-size:14px">${L('Next you get a recovery code. Keep it somewhere safe: it lets you set a new password if you ever forget this one.', 'Za chwilę dostaniesz kod odzyskiwania. Schowaj go w bezpiecznym miejscu: pozwoli ustawić nowe hasło, jeśli kiedyś zapomnisz tego.')} <a href="/privacy" target="_blank" rel="noopener">${L('What we keep', 'Co zapisujemy')}</a></p>` : ''}
      <button class="btn big">${reg ? L('Create account', 'Załóż konto') : L('Log in', 'Zaloguj się')}</button>
      ${reg ? '' : `<button type="button" class="btn ghost-ink" data-forgot>${L('Forgot your password?', 'Nie pamiętasz hasła?')}</button>`}
      <button type="button" class="btn ghost-ink" data-swap>${reg ? L('I already have an account', 'Mam już konto') : L('I need an account', 'Chcę założyć konto')}</button>
    </form>`);
  setTimeout(() => el.querySelector('#au').focus(), 50);
  el.querySelector('[data-swap]').addEventListener('click', () => { close(); onAuth = null; openAccount(reg ? 'login' : 'register'); });
  el.querySelector('[data-forgot]')?.addEventListener('click', () => { const u = el.querySelector('#au').value.trim(); close(); onAuth = null; openRecover(u); });
  authForm(el, () => {
    if (!reg) adoptLook = true;
    return { t: mode, user: el.querySelector('#au').value.trim(), pass: el.querySelector('#ap').value };
  }, m => {
    close(); sfx.join();
    if (reg) showRecoveryCode(m.code, true); else toast(L('Welcome back!', 'Witaj z powrotem!'));
    if (st.view === 'lobby') renderLobby();
  });
}

// Shared by the account forms: sends what msg() builds, shows the server's error under the form, or calls done().
function authForm(el, msg, done) {
  const err = el.querySelector('.autherr'), btn = el.querySelector('.btn.big');
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (ws?.readyState !== 1) { err.textContent = L('Not connected. Try again in a moment.', 'Brak połączenia. Spróbuj ponownie za chwilę.'); err.hidden = false; return; }
    const m = msg(); if (!m) return;
    btn.disabled = true; err.hidden = true;
    onAuth = r => {
      btn.disabled = false;
      if (r.err) { sfx.bad(); err.textContent = srvText(r.err); err.hidden = false; return; }
      onAuth = null; done(r);
    };
    send(m);
  });
}
const showErr = (el, text) => { const err = el.querySelector('.autherr'); err.textContent = text; err.hidden = false; sfx.bad(); };

// Forgot the password: username + recovery code (or a reset code from the host) + a new password.
function openRecover(user = '') {
  const { el, close } = modal(`
    <h2>${L('Set a new password', 'Ustaw nowe hasło')}</h2>
    <p>${L('Type your username and your recovery code (you got it when you made the account). Lost the code too? Ask the person who runs this site for a reset code and type that instead.', 'Wpisz nazwę użytkownika i kod odzyskiwania (dostajesz go przy zakładaniu konta). Kod też przepadł? Poproś osobę, która prowadzi tę stronę, o kod resetujący i wpisz go zamiast tamtego.')}</p>
    <form class="authform">
      <label for="ru">${L('Username', 'Nazwa użytkownika')}</label>
      <input class="field" id="ru" maxlength="16" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(user)}">
      <label for="rc">${L('Recovery or reset code', 'Kod odzyskiwania albo resetujący')}</label>
      <input class="field" id="rc" maxlength="40" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR">
      <label for="rp">${L('New password', 'Nowe hasło')}</label>
      <input class="field" id="rp" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <p class="autherr" role="alert" hidden></p>
      <button class="btn big">${L('Set new password', 'Ustaw nowe hasło')}</button>
      <button type="button" class="btn ghost-ink" data-back>${L('Back to log in', 'Wróć do logowania')}</button>
    </form>`);
  setTimeout(() => el.querySelector(user ? '#rc' : '#ru').focus(), 50);
  el.querySelector('[data-back]').addEventListener('click', () => { close(); onAuth = null; openAccount('login'); });
  authForm(el, () => { adoptLook = true; return { t: 'recover', user: el.querySelector('#ru').value.trim(), code: el.querySelector('#rc').value, pass: el.querySelector('#rp').value }; }, m => {
    close(); sfx.join(); toast(L('New password set. You are logged in, and other devices were logged out.', 'Nowe hasło ustawione. Zalogowano cię, a inne urządzenia zostały wylogowane.'));
    showRecoveryCode(m.code, false, L('Your old code is used up, so here is a new one.', 'Stary kod został zużyty, więc oto nowy.'));
    if (st.view === 'lobby') renderLobby();
  });
}

// Shows a recovery code once, with a copy button. The server keeps only a scrambled copy, so it can't show it again.
function showRecoveryCode(code, fresh, note = '') {
  if (!code) return;
  const { el, close } = modal(`
    <h2>${fresh ? L('Account created!', 'Konto założone!') : L('Your recovery code', 'Twój kod odzyskiwania')}</h2>
    <p>${note ? note + ' ' : ''}${L('If you ever forget your password, this code lets you set a new one. Save it in a password manager, a note on your phone, or on paper. It is shown only this once.', 'Jeśli kiedyś zapomnisz hasła, ten kod pozwoli ustawić nowe. Zapisz go w menedżerze haseł, w notatce w telefonie albo na kartce. Widzisz go tylko ten jeden raz.')}</p>
    <p class="rcode" aria-label="${L('Recovery code', 'Kod odzyskiwania')}">${esc(code)}</p>
    <div class="row"><button type="button" class="btn w" data-copy>${L('Copy code', 'Skopiuj kod')}</button><button type="button" class="btn big" data-close>${L('I saved it', 'Kod zapisany')}</button></div>`, false);
  el.querySelector('[data-copy]').addEventListener('click', e => {
    navigator.clipboard?.writeText(code).then(() => { e.target.textContent = L('Copied!', 'Skopiowano!'); }, () => { e.target.textContent = L('Select the code and copy it', 'Zaznacz kod i skopiuj go'); });
  });
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); close(); if (fresh) toast(L('Your progress is saved!', 'Twoje postępy są zapisane!')); });
}

// Signed in: change the password, or make a new recovery code. Both ask for the current password.
function openSecurity() {
  const { el, close } = modal(`
    <h2>${L('Password and recovery', 'Hasło i odzyskiwanie')}</h2>
    <p>${L('Signed in as', 'Zalogowano jako')} <b>${esc(st.me?.user)}</b>.</p>
    <form class="authform" data-f="pw">
      <h3>${L('Change password', 'Zmień hasło')}</h3>
      <input type="text" autocomplete="username" value="${esc(st.me?.user)}" hidden>
      <label for="po">${L('Current password', 'Obecne hasło')}</label>
      <input class="field" id="po" type="password" maxlength="72" required autocomplete="current-password">
      <label for="pn">${L('New password', 'Nowe hasło')}</label>
      <input class="field" id="pn" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <label for="pn2">${L('New password again', 'Nowe hasło jeszcze raz')}</label>
      <input class="field" id="pn2" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <p class="autherr" role="alert" hidden></p>
      <p style="font-size:14px">${L('Any other phone or computer signed in to this account is logged out.', 'Każdy inny telefon i komputer zalogowany na to konto zostanie wylogowany.')}</p>
      <button class="btn big">${L('Change password', 'Zmień hasło')}</button>
    </form>
    <form class="authform" data-f="rc">
      <h3>${L('Recovery code', 'Kod odzyskiwania')}</h3>
      <p style="font-size:14px">${L('Lost your recovery code? Make a new one. The old one stops working.', 'Kod odzyskiwania przepadł? Wygeneruj nowy. Stary przestanie działać.')}</p>
      <label for="pr">${L('Password', 'Hasło')}</label>
      <input class="field" id="pr" type="password" maxlength="72" required autocomplete="current-password">
      <p class="autherr" role="alert" hidden></p>
      <button class="btn big w">${L('Make a new recovery code', 'Wygeneruj nowy kod odzyskiwania')}</button>
    </form>
    <button type="button" class="btn ghost-ink" data-close>${L('Close', 'Zamknij')}</button>`);
  const pw = el.querySelector('[data-f="pw"]'), rc = el.querySelector('[data-f="rc"]');
  setTimeout(() => el.querySelector('#po').focus(), 50);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); onAuth = null; close(); });
  const scoped = f => ({ querySelector: q => q === 'form' ? f : f.querySelector(q) }); // authForm looks inside one form
  authForm(scoped(pw), () => {
    const a = pw.querySelector('#pn').value, b = pw.querySelector('#pn2').value;
    if (a !== b) { showErr(pw, L('The two new passwords are not the same.', 'Nowe hasła nie są takie same.')); return null; }
    return { t: 'passwd', old: pw.querySelector('#po').value, pass: a };
  }, () => { close(); sfx.join(); toast(L('Password changed. Other devices were logged out.', 'Hasło zmienione. Inne urządzenia zostały wylogowane.')); });
  authForm(scoped(rc), () => ({ t: 'recode', pass: rc.querySelector('#pr').value }), m => { close(); showRecoveryCode(m.code, false); });
}

// Deleting your own account (a small link at the bottom of your profile card). It can't be undone, so it says plainly
// what goes and asks for the password and the username typed out. The server does the rest (store.deleteSelf).
function openDeleteAccount() {
  if (!st.me?.user) return;
  const user = st.me.user;
  const { el, close } = modal(`
    <h2>${L('Delete your account?', 'Usunąć konto?')}</h2>
    <p>${L('This cannot be undone. Everything on the account', 'Tego nie da się cofnąć. Wszystko, co jest na koncie')} <b>${esc(user)}</b> ${L('goes for good:', 'znika na zawsze:')}</p>
    <ul class="delist">
      <li>${L('your coins, clothes, items and Supporter pack', 'monety, ubrania, przedmioty i pakiet wspierającego')}</li>
      <li>${L('your scores, XP, rank and places in the rankings', 'wyniki, XP, ranga i miejsca w rankingach')}</li>
      <li>${L('your friends and friend requests', 'znajomi i zaproszenia do znajomych')}</li>
      <li>${L('your Pet Farm with all its pets, and any trade offers', 'Farma zwierzaków ze wszystkimi zwierzakami i ofertami wymiany')}</li>
      <li>${L('your messages in the hub chat and at tables', 'twoje wiadomości na czacie głównym i przy stołach')}</li>
    </ul>
    <p style="font-size:14px">${L('Every phone and computer signed in to it becomes a guest. A game you are playing right now carries on, as a guest. Nobody else can take the name', 'Każdy telefon i komputer zalogowany na to konto staje się gościem. Gra, w którą właśnie grasz, toczy się dalej, już jako gość. Nikt inny nie może zająć tej nazwy przez')} ${L('for 30 days.', '30 dni.')}</p>
    <form class="authform">
      <input type="text" autocomplete="username" value="${esc(user)}" hidden>
      <label for="du">${L('Type your username to confirm:', 'Wpisz nazwę użytkownika, żeby potwierdzić:')} <b>${esc(user)}</b></label>
      <input class="field" id="du" maxlength="16" required autocomplete="off" autocapitalize="none" spellcheck="false">
      <label for="dp">${L('Password', 'Hasło')}</label>
      <input class="field" id="dp" type="password" maxlength="72" required autocomplete="current-password">
      <p class="autherr" role="alert" hidden></p>
      <button class="btn big r">${L('Delete my account forever', 'Usuń konto na zawsze')}</button>
    </form>
    <button type="button" class="btn ghost-ink" data-close>${L('Keep my account', 'Zostaw konto')}</button>`);
  setTimeout(() => el.querySelector('#du').focus(), 50);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); onAuth = null; close(); });
  authForm(el, () => {
    const typed = el.querySelector('#du').value.trim();
    if (typed.toLowerCase() !== user.toLowerCase()) { showErr(el, L('Type your username exactly to confirm.', 'Wpisz dokładnie swoją nazwę użytkownika, żeby potwierdzić.')); return null; }
    return { t: 'delacct', user: typed, pass: el.querySelector('#dp').value };
  }, () => { close(); }); // the server says it is done ("This account was deleted...") and the page turns into a guest's
}

export function openRules(game) {
  const info = id => GAMES[id] || SOLO[id], ids = info(game) ? [game] : [...Object.keys(GAMES), ...Object.keys(SOLO)];
  const { el, close } = modal(`
    ${ids.map(id => `<h2>${L('How to play', 'Jak grać:')} ${info(id).name}</h2><div class="rules">${info(id).rules}</div>`).join('')}
    <button type="button" class="btn big" data-close>${L('Got it', 'Jasne')}</button>`);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); close(); });
}

// ---------- events ----------
$app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (['home', 'rules'].includes(act)) e.preventDefault();
  if (b.tagName === 'BUTTON') sfx.click();
  if (act === 'home') { if (st.room) send({ t: 'leave' }); else go('hub'); }
  else if (act === 'htab') setHubTab(b.dataset.tab);
  else if (act === 'gfilt') { st.gFilt = b.dataset.cat; LS.set('ct_gf', st.gFilt); filterGames(); }
  else if (act === 'acct') openAcct();
  else if (act === 'lang') setLang(b.dataset.lang);
  else if (act === 'gfx') { setGfx(GFX_NEXT[gfxPick()]); const sm = b.querySelector('small'); if (sm) sm.textContent = gfxLabel(); toast(`${L('Graphics', 'Grafika')}: ${esc(gfxLabel())}. ${L('Games opened from now on use it.', 'Obowiązuje w grach otwartych od teraz.')}`); }
  else if (act === 'mystats') openStats();
  else if (act === 'who') openWho();
  else if (act === 'notices') { closeAcct(); openNotices(); }
  else if (act === 'tables') openTables();
  else if (act === 'rkall') openRankings();
  else if (act === 'tpage') { sfx.click(); st.tPage += +b.dataset.d; renderTables(); }
  else if (act === 'rules') openRules(b.dataset.game || (st.view === 'lobby' ? st.room?.game : undefined));
  else if (act === 'profile') openProfile();
  else if (act === 'style') { if (!st.name) return openProfile(true); openStyle(); }
  else if (act === 'isle') { if (!st.name) return openProfile(true); openWardrobe({ sec: 'isle' }); }
  else if (act === 'shop') { if (!st.name) return openProfile(true); openWardrobe({ sec: 'drop', filt: 'shop' }); }
  else if (act === 'account') openAccount(b.dataset.mode);
  else if (act === 'security') openSecurity();
  else if (act === 'support') openSupport();
  else if (act === 'hcemo') hubEmoToggle();
  else if (act === 'hcemo-put') hubEmoPut(b.dataset.e);
  else if (act === 'hcemo-shop') { hubEmoToggle(false); openWardrobe({ sec: 'fx', sub: 'sp' }); }
  else if (act === 'hubdel') send({ t: 'hubdel', id: b.dataset.id });
  else if (act === 'logout') { send({ t: 'logout' }); toast(L('Logged out. This browser is a guest again.', 'Wylogowano. Ta przeglądarka znów gra jako gość.')); }
  else if (act === 'host' || act === 'solo') {
    const game = b.dataset.game;
    if (!GAMES[game]) return;
    if (!st.name) return openProfile(true);
    send(act === 'host' ? { t: 'create', game, opts: GAMES[game].host } : { t: 'create', game, priv: true, solo: true, opts: GAMES[game].solo });
  }
  else if (act === 'theme') { switchTheme(b); sfx.click(); }
  else if (act === 'friends') openFriends();
  else if (act === 'farm') { if (!st.name) return openProfile(true); openFarm(); }
  else if (act === 'hay') { if (!st.name) return openProfile(true); openHay(); }
  else if (act === 'pop') { if (!st.name) return openProfile(true); openPop(); }
  else if (act === 'mj') { if (!st.name) return openProfile(true); openMj(); }
  else if (act === 'daily') { if (!st.name) return openProfile(true); openDaily(); }
  else if (act === 'word') { if (!st.name) return openProfile(true); openWord(); }
  else if (act === 'wheel') { if (!st.name) return openProfile(true); openWheel(); }
  else if (act === 'join') send({ t: 'join', code: b.dataset.code });
  else if (act === 'leave') send({ t: 'leave' });
  else if (act === 'start') send({ t: 'start' });
  else if (act === 'sit') send({ t: 'sit', on: b.getAttribute('aria-pressed') !== 'true' });
  else if (act === 'opt') send({ t: 'opts', opts: { [b.dataset.opt]: ['timer', 'field', 'hands'].includes(b.dataset.opt) ? +b.dataset.val : b.dataset.val } });
  else if (act === 'copy') {
    const link = `${location.origin}/#${st.room.code}`;
    (navigator.clipboard?.writeText(link) ?? Promise.reject()).then(() => toast(L('Invite link copied!', 'Link z zaproszeniem skopiowany!')), () => toast(`${L('Share this', 'Udostępnij ten link')}: ${esc(link)}`));
  }
});
$app.addEventListener('change', e => { if (e.target.dataset.act === 'priv') send({ t: 'opts', priv: !e.target.checked }); });
$app.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'join') return;
  e.preventDefault();
  const code = e.target.querySelector('input').value.toUpperCase().trim();
  if (!validCode(code)) { sfx.bad(); toast(L('Codes are 4 letters or numbers', 'Kod to 4 litery lub cyfry'), true); return; }
  if (!st.name) { pendingJoin = code; return openProfile(true); }
  sfx.click(); send({ t: 'join', code });
});
$app.addEventListener('pointerover', e => {
  const b = e.target.closest('.btn, .round, .pills button'); if (b && !b.disabled && !b.contains(e.relatedTarget)) sfx.hover();
});
addEventListener('hashchange', () => {
  const c = location.hash.slice(1).toUpperCase();
  if (validCode(c) && st.name) { send({ t: 'join', code: c }); history.replaceState(null, '', location.pathname); }
});

let ipFailed = false, islePics = null;
const ipReady = import('./itempic.js').then(m => { IP = m; }).catch(() => { ipFailed = true; });
const p3Ready = import('./portraits.js').then(m => { P3 = m; if (st.view === 'hub' || st.view === 'lobby') go(st.view); }).catch(() => {});
onLangSwitch(l => { if (st.me?.user) send({ t: 'lang', v: l }); });
// Moving pictures (game card art, Today icons, profile effects) are SVG: every frame of their CSS animation lays out and
// repaints the picture, even off screen. Pause the ones out of view; on the low graphics level they all stand still (style.css).
{
  const io = new IntersectionObserver(es => { for (const e of es) e.target.classList.toggle('offview', !e.isIntersecting); });
  let q = 0; const watch = () => { q = 0; for (const s of document.querySelectorAll('#app svg:not([data-io]), .modal svg:not([data-io])')) { s.dataset.io = ''; io.observe(s); } };
  new MutationObserver(() => { q ||= setTimeout(watch, 250); }).observe(document.body, { childList: true, subtree: true });
}
gfx(); // sets the html.gfx-* class before the hub draws
onGfxTip(kind => toast(kind === 'soft'
  ? L('Your browser draws 3D without the graphics card, so we switched to light graphics. For the full look, turn on “Use hardware acceleration” in the browser’s settings (in Opera GX: Settings > Browser > System) and restart it.', 'Twoja przeglądarka rysuje 3D bez karty graficznej, więc włączyliśmy lekką grafikę. Po pełny wygląd włącz „Użyj akceleracji sprzętowej” w ustawieniach przeglądarki (w Operze GX: Ustawienia > Przeglądarka > System) i uruchom ją ponownie.')
  : L('The game can’t keep up even on low graphics. If you use Opera GX, check that GX Control’s CPU and RAM limiters are off and no page shader mod is on.', 'Gra nie nadąża nawet na niskiej grafice. Jeśli używasz Opery GX, sprawdź, czy limity procesora i RAM w GX Control są wyłączone i czy nie działa mod z shaderem strony.'), false, 10000));
go('hub');
initNotice({ send, modal, toast, sfx, me: () => st.me, inGame: () => !!st.game });
connect();
