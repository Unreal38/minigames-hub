// Cozy Table hub: username, open tables, waiting rooms. Games mount on top of this.
import { potLogo, tableArt, marbleArt, laddersArt, pokerArt, ludoArt, farmArt, stackArt, golfArt, diceArt, pawArt, kartArt, kitchenArt, digArt, beanArt, bricksArt, tysArt, panArt } from './art.js';
import { backSvg } from './games/hotpot/icons.js';
import { cardHtml } from './games/hotpot/cards.js';
import { sfx } from './sfx.js';
import { EMOJI, FOODS, floatAt } from './react.js';
import { COS, WORN, cosItem, cosPrice, cosOnSale, cosSeason, cosHas, earnProgress, flairOf, stickersOf, nameHtml, titleHtml, frameCls } from './cosmetics.js';
import { playWinFx } from './winfx.js';
import { petImg, petPics } from './petpic.js';
import { progress } from './ranks.js';
import { avatarHtml, cleanAv, randomAv, OPT, AV_KEYS, AV_COLOR_KEYS, AV_TABS, priceOf, wearable, lockedIn, SEASON, SEASONS, seasonOn, seasonOf, onSale } from './avatar.js';

export const SITE = 'Cozy Table';
// The 3D head snapshots and the creator's 3D preview need three.js, so they load on the side: the hub still works
// (with flat stand-in heads) if that fails.
let P3 = null;
const COLORS = ['#ff8fab', '#ffb547', '#7ed3b2', '#9aa8ff', '#e8a0e0', '#7fd1e8', '#ff7a59', '#c8e66b'];
const GAMES = {
  hotpot: {
    name: 'Hot Pot', load: () => import('./games/hotpot/client.js'), start: 'Start the pot',
    host: { bots: 'chill', timer: 30 }, solo: { bots: 'chill', timer: 0 },
    openSeat: 'A bot sits here if nobody joins', seats: r => r.max,
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
    host: { mode: 'classic', chaos: 'on', field: 6 }, solo: { mode: 'classic', chaos: 'on', field: 6 },
    openSeat: 'A bot bets from this seat if nobody joins', seats: r => Math.max(4, r.players.length),
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
    host: { size: 'classic', party: 'on', bounce: 'on', seats: 4, timer: 20, hard: 'off' }, solo: { size: 'classic', party: 'on', bounce: 'on', seats: 4, timer: 0, hard: 'off' },
    openSeat: 'A bot plays here if nobody joins', seats: r => Math.max(r.opts.seats || 4, r.players.length),
    settings: pill => `<div class="opt"><b>Board</b><div class="pills">${pill('size', 'classic', 'Classic 100')}${pill('size', 'short', 'Quick 60')}</div></div>
      <div class="opt"><b>Party tiles</b><div class="pills">${pill('party', 'on', 'On')}${pill('party', 'off', 'Off')}</div></div>
      <div class="opt"><b>Hard mode</b><div class="pills">${pill('hard', 'off', 'Off')}${pill('hard', 'on', 'On')}</div></div>
      <div class="opt"><b>Exact roll to finish</b><div class="pills">${pill('bounce', 'on', 'Yes')}${pill('bounce', 'off', 'No')}</div></div>
      <div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 4, '4')}${pill('seats', 6, '6')}</div></div>
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
    host: { variant: 'holdem', bots: 'chill', field: 6, hands: 10, timer: 30 }, solo: { variant: 'holdem', bots: 'chill', field: 6, hands: 10, timer: 0 },
    openSeat: 'A bot sits here if nobody joins', seats: r => Math.min(6, Math.max(r.opts.field || 6, r.players.length)),
    settings: (pill, r) => `<div class="opt"><b>Game</b><div class="pills">${pill('variant', 'holdem', "Texas Hold'em")}${pill('variant', 'mango', 'Mango Poker')}</div></div>
      <div class="opt"><b>Seats at the table</b><div class="pills">${r?.opts.variant === 'mango' ? '' : pill('field', 2, '2')}${pill('field', 4, '4')}${pill('field', 6, '6')}</div></div>
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
  ludo: {
    name: 'Ludo', load: () => import('./games/ludo/client.js'), start: 'Start the game',
    host: { seats: 4, pawns: 4, head: 'on', timer: 20, hard: 'off' }, solo: { seats: 4, pawns: 4, head: 'on', timer: 0, hard: 'off' },
    openSeat: 'A bot plays here if nobody joins', seats: r => Math.max(r.opts.seats || 4, r.players.length),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}</div></div>
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
    host: { seats: 4, towers: 3, blocks: 'classic', bots: 'chill', timer: 10 }, solo: { seats: 4, towers: 3, blocks: 'classic', bots: 'chill', timer: 0 },
    openSeat: 'A bot stacks here if nobody joins', seats: r => Math.max(r.opts.seats || 4, r.players.length),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 4, '4')}${pill('seats', 6, '6')}</div></div>
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
  golf: {
    name: 'Mini Golf Party', load: () => import('./games/golf/client.js'), start: 'Tee off',
    host: { holes: 6, seats: 4, bets: 'on', bots: 'chill', course: 'random' }, solo: { holes: 6, seats: 4, bets: 'on', bots: 'chill', course: 'random' },
    openSeat: 'A bot putts here if nobody joins', seats: r => Math.max(r.opts.seats || 4, r.players.length),
    settings: pill => `<div class="opt"><b>Holes</b><div class="pills">${pill('holes', 3, 'Quick 3')}${pill('holes', 6, '6')}${pill('holes', 9, '9')}</div></div>
      <div class="opt"><b>Course</b><div class="pills">${pill('course', 'random', 'Random')}${pill('course', 'classic', 'Classic')}</div></div>
      <div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 4, '4')}${pill('seats', 6, '6')}</div></div>
      <div class="opt"><b>Coin bets on each hole</b><div class="pills">${pill('bets', 'on', 'On')}${pill('bets', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone plays the same hole and takes turns, one putt each, with their own ball. Drag back and let go to putt. Fewest strokes over the round wins, and before each hole you can bet coins on who will take it.`,
    rules: `<ol>
      <li>Everyone plays the same hole and <b>takes turns</b>, one putt each, until every ball is in. You each have your own ball, and balls pass through each other. Whoever took the last hole tees off first.</li>
      <li>You have <b>25 seconds</b> for a putt. If the time runs out, the game makes a clumsy putt for you.</li>
      <li><b>Drag back</b> anywhere on the screen and <b>let go</b> to putt: the further you pull, the harder the hit. On a keyboard, use the arrow keys to aim and set the power, then space.</li>
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
    host: { seats: 4, dice: 5, wild: 'on', spot: 'on', bots: 'chill', timer: 30 }, solo: { seats: 4, dice: 5, wild: 'on', spot: 'on', bots: 'chill', timer: 0 },
    openSeat: 'A bot bluffs from this seat if nobody joins', seats: r => Math.min(6, Math.max(r.opts.seats || 4, r.players.length)),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}${pill('seats', 5, '5')}${pill('seats', 6, '6')}</div></div>
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
      <li>Shortcuts: arrow keys change the bid, <b>Enter</b> bids, <b>L</b> calls liar, <b>S</b> calls spot on.</li>
    </ol>`,
  },
  paw: {
    name: 'Pawperty', load: () => import('./games/paw/client.js'), start: 'Open the shops',
    host: { seats: 4, rounds: 20, naps: 'on', bots: 'chill', timer: 30 }, solo: { seats: 4, rounds: 20, naps: 'on', bots: 'chill', timer: 0 },
    openSeat: 'A bot plays here if nobody joins', seats: r => Math.min(6, Math.max(r.opts.seats || 4, r.players.length)),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}${pill('seats', 5, '5')}${pill('seats', 6, '6')}</div></div>
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
      <li>The board has ten places along each side and eight streets of three shops. Own a <b>whole street</b> and its rent doubles, and you can build the <b>Pet Palace</b> for the biggest rent of all.</li>
      <li>Land on your own shop and your pet is happy to see you: <b>+10</b>.</li>
      <li><b>Zoomies!</b> tiles deal a silly card. <b>Vet Visit</b> costs 40, which goes in the <b>Lost &amp; Found</b> jar. Land on the jar's corner to take everything in it.</li>
      <li><b>Muddy Puddle</b>, or three doubles in a row, sends you to <b>Bath Time</b>. Roll doubles to hop out, or pay 30. After three tries you pay and go. You still collect rent in the tub.</li>
      <li>Doubles roll again. <b>Nobody is knocked out</b>: if you cannot pay, upgrades and then shops are sold back at half price, and anything still missing is let off.</li>
      <li>After the last round, treats in hand plus everything you spent on shops and upgrades are added up. <b>The richest player wins.</b></li>
      <li>Tap any tile to read about it. Shortcuts: <b>Space</b> rolls, adopts or ends your turn, <b>N</b> says no thanks.</li>
    </ol>`,
  },
  kart: {
    name: 'Kart Island Race', load: () => import('./games/kart/client.js'), start: 'Start your engines',
    host: { seats: 6, laps: 3, track: 'random', items: 'on', bots: 'chill' }, solo: { seats: 6, laps: 3, track: 'random', items: 'on', bots: 'chill' },
    openSeat: 'A bot drives here if nobody joins', seats: r => Math.min(8, Math.max(r.opts.seats || 6, r.players.length)),
    settings: pill => `<div class="opt"><b>Track</b><div class="pills">${pill('track', 'random', 'Random')}${pill('track', 'meadow', 'Meadow Loop')}${pill('track', 'bakery', 'Sugar Bridges')}${pill('track', 'peaks', 'Twisty Peaks')}</div></div>
      <div class="opt"><b>Laps</b><div class="pills">${pill('laps', 2, 'Quick 2')}${pill('laps', 3, '3')}${pill('laps', 5, '5')}</div></div>
      <div class="opt"><b>Karts on the grid</b><div class="pills">${pill('seats', 4, '4')}${pill('seats', 6, '6')}${pill('seats', 8, '8')}</div></div>
      <div class="opt"><b>Power-ups</b><div class="pills">${pill('items', 'on', 'On')}${pill('items', 'chaos', 'Chaos')}${pill('items', 'off', 'Off')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>`,
    howto: `Everyone's avatar drives a little kart round roads that hop between floating islands. Grab gift boxes for silly power-ups, drift round the corners for a boost, and don't drive off the edge. First over the line after the last lap wins.`,
    rules: `<ol>
      <li>Everyone drives their own kart with their avatar at the wheel. Empty spots on the grid are bots.</li>
      <li>Your kart <b>speeds up by itself</b>. Steer with <b>← →</b> or <b>A D</b>, brake or reverse with <b>↓</b>. On a phone, use the arrow pads in the bottom corners.</li>
      <li><b>Drift</b>: hold <b>Space</b> (or the Drift pad) while turning at speed. Keep it up until the sparks glow, then let go for a speed boost. Orange sparks give a longer one.</li>
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
    host: { seats: 3, time: 180, map: 'diner', bots: 'chill' }, solo: { seats: 3, time: 180, map: 'diner', bots: 'chill' },
    openSeat: 'A bot cooks here if nobody joins', seats: r => Math.min(4, Math.max(r.opts.seats || 3, r.players.length)),
    settings: pill => `<div class="opt"><b>Cooks</b><div class="pills">${pill('seats', 1, '1')}${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}</div></div>
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
    host: { seats: 3, target: 1000, bots: 'chill', timer: 30 }, solo: { seats: 3, target: 1000, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays this seat if nobody joins', seats: r => Math.min(4, Math.max(r.opts.seats || 3, r.players.length)),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 3, '3')}${pill('seats', 4, '4 (dealer sits out)')}</div></div>
      <div class="opt"><b>Play to</b><div class="pills">${pill('target', 1000, 'Classic 1000')}${pill('target', 500, 'Quick 500')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The Polish classic for three. Bid how many points you will take, pick up the three hidden cards (the musik), then win tricks. Leading a king or queen while you hold both of a suit announces a marriage: bonus points, and that suit becomes trumps. Make your bid to score it, miss it and you lose it. First to 1000 wins.`,
    rules: `<ol>
      <li>24 cards: 9 to ace in four suits. <b>Ace 11, ten 10, king 4, queen 3, jack 2, nine 0</b>, and the ten beats the king. Everyone gets <b>7 cards</b> and 3 go face down in the middle: the <b>musik</b>. Empty seats are played by bots. With four at the table, the dealer sits the hand out.</li>
      <li><b>Bidding.</b> The player after the dealer starts at <b>100</b> and has to play for that if nobody bids more. Bids go up in tens. Once you pass you are out for the hand. You may not bid over <b>120</b> unless you hold a marriage (king and queen of one suit).</li>
      <li>The winner turns the <b>musik</b> over for everyone, takes it, then <b>gives one card to each opponent</b> and may raise the contract.</li>
      <li><b>Tricks.</b> The winner of the bidding leads. You must <b>follow suit</b>; with none of it you must play a <b>trump</b>; and you must <b>beat</b> the winning card whenever you can. The trick's winner leads the next one.</li>
      <li><b>Marriages.</b> When it is your lead and you hold the king and queen of a suit, play one of them and announce it: <b>hearts 100, diamonds 80, clubs 60, spades 40</b>. That suit is trumps from then on, until the next marriage.</li>
      <li><b>Scoring.</b> The player with the contract scores exactly the contract if they took at least that many points (cards plus marriages), and <b>loses it</b> if they did not. The other two score what they took, rounded to tens.</li>
      <li><b>The barrel.</b> From <b>800</b> points you only score by playing a contract yourself, so the last 200 have to be won, not collected.</li>
      <li>First to <b>1000</b> wins. If the turn timer runs out, the game passes for you in the bidding and plays a sensible card otherwise.</li>
    </ol>`,
  },
  dig: {
    name: 'Treasure Dig', load: () => import('./games/dig/client.js'), start: 'Start digging',
    host: { seats: 4, size: 'big', bots: 'chill', timer: 25 }, solo: { seats: 4, size: 'big', bots: 'chill', timer: 0 },
    openSeat: 'A bot digs here if nobody joins', seats: r => Math.min(6, Math.max(r.opts.seats || 4, r.players.length)),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}${pill('seats', 5, '5')}${pill('seats', 6, '6')}</div></div>
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
    host: { seats: 4, speed: 'normal', bots: 'chill' }, solo: { seats: 4, speed: 'normal', bots: 'chill' },
    openSeat: 'A bot stacks here if nobody joins', seats: r => Math.min(6, Math.max(r.opts.seats || 4, r.players.length)),
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}${pill('seats', 5, '5')}${pill('seats', 6, '6')}</div></div>
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
  bean: {
    name: 'Beanstalk Bounce', load: () => import('./games/bean/client.js'), start: 'Start climbing',
    host: { seats: 4, pace: 'normal', bots: 'chill' }, solo: { seats: 4, pace: 'normal', bots: 'chill' },
    openSeat: 'A bot climbs here if nobody joins', seats: r => Math.min(6, Math.max(r.opts.seats || 4, r.players.length)),
    settings: pill => `<div class="opt"><b>Climbers</b><div class="pills">${pill('seats', 1, 'Just us')}${pill('seats', 2, '2')}${pill('seats', 4, '4')}${pill('seats', 6, '6')}</div></div>
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
  pan: {
    name: 'Pan', load: () => import('./games/pan/client.js'), start: 'Deal the cards',
    host: { seats: 4, bots: 'chill', timer: 30 }, solo: { seats: 4, bots: 'chill', timer: 0 },
    openSeat: 'A bot plays this hand if nobody joins', seats: r => [2, 3, 4, 6].find(n => n >= Math.max(r.opts.seats || 4, r.players.length)) || 6,
    settings: pill => `<div class="opt"><b>Players</b><div class="pills">${pill('seats', 2, '2')}${pill('seats', 3, '3')}${pill('seats', 4, '4')}${pill('seats', 6, '6')}</div></div>
      <div class="opt"><b>Bots</b><div class="pills">${pill('bots', 'chill', 'Chill')}${pill('bots', 'sharp', 'Sharp')}</div></div>
      <div class="opt"><b>Turn timer</b><div class="pills">${pill('timer', 20, '20s')}${pill('timer', 30, '30s')}${pill('timer', 45, '45s')}${pill('timer', 0, 'Off')}</div></div>`,
    howto: `The Polish card game with the 24 cards from nine to ace. Put down a card at least as high as the one on top, or pick up three from the pile. Get rid of all your cards to be safe: the last one still holding cards is the Pan.`,
    rules: `<ol>
      <li>The <b>24 cards</b> from nine to ace are dealt out evenly. Whoever holds the <b>nine of hearts</b> starts by putting it down. Empty seats are played by bots.</li>
      <li>On your turn, put down <b>one card that is the same or higher</b> than the card on top of the pile. Suits do not matter.</li>
      <li>If you hold <b>all four</b> cards of a rank that fits, you can put them down together. The three other nines can go together straight onto the nine of hearts.</li>
      <li>Instead of playing you can <b>pick up the top three cards</b> of the pile. You have to when nothing you hold fits. The nine of hearts always stays at the bottom.</li>
      <li>The pile only ever climbs, so a low card can only go after someone picks the pile back down. Picking up on purpose is part of the game.</li>
      <li>Run out of cards and you are <b>safe</b>. The first one out wins, and the <b>last player still holding cards is the Pan</b>.</li>
      <li>Five players sit at a table for six: a bot takes the spare hand, so the cards still share out evenly.</li>
      <li>Shortcuts: <b>Enter</b> plays your lowest card that fits, <b>T</b> takes three.</li>
    </ol>`,
  },
};

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
  token: LS.get('ct_token', ''), id: null, me: null, rooms: [], room: null, view: 'hub', game: null, gameLoading: null, lastState: null, farm: null,
};
const validCode = s => /^[A-Z0-9]{4}$/.test(s);
let pendingJoin = (location.hash.slice(1) || '').toUpperCase();
if (!validCode(pendingJoin)) pendingJoin = '';

// ---------- toasts ----------
export function toast(html, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = html;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 2900);
}

// ---------- network ----------
// One live connection per browser token. Tabs share the token through localStorage, so a second tab
// takes the seat over and the first one is told it was replaced. A replaced tab stays quiet until the
// player clicks "Play here" (reconnecting on its own would kick the other tab, which would kick back...).
let ws = null, retry = 0, replaced = false, retryT = 0, stableT = 0;
const $conn = document.getElementById('conn');
function connBar(mode) {
  if (!mode) { $conn.hidden = true; return; }
  $conn.hidden = false; $conn.classList.toggle('replaced', mode === 'replaced');
  if (mode === 'replaced') {
    $conn.innerHTML = 'Cozy Table is open in another tab. <button type="button">Play here</button>';
    $conn.querySelector('button').onclick = () => { replaced = false; retry = 0; connBar('reconnecting'); connect(); };
  } else $conn.textContent = 'Reconnecting…';
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
    if (m.t === 'welcome') { connBar(null); clearTimeout(stableT); stableT = setTimeout(() => { retry = 0; }, 10_000); }
    onMsg(m);
  };
  s.onclose = e => {
    if (s !== ws) return;
    clearTimeout(stableT);
    console.warn(`[cozy] connection closed: code ${e.code}${e.reason ? ' ' + e.reason : ''}${replaced ? ' (replaced by another tab)' : ''}`);
    if (replaced || e.code === 4000) { replaced = true; connBar('replaced'); return; }
    connBar('reconnecting');
    // back off with jitter so a flaky network or a restarting server isn't hammered
    const wait = Math.min(10_000, 500 * 2 ** Math.min(retry++, 5)) * (0.7 + Math.random() * 0.6);
    retryT = setTimeout(connect, wait);
  };
}
// coming back to the tab or the network: try right away instead of waiting out the backoff
const reconnectNow = () => { if (!replaced && retryT) { retry = 0; connect(); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnectNow(); });
addEventListener('online', reconnectNow);
export function send(m) { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); }

function onMsg(m) {
  if (m.t === 'welcome') {
    st.token = m.token; st.id = m.id; LS.set('ct_token', m.token);
    if (pendingJoin && st.name) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
    st.farm?.reopen(); // back after a dropped connection
    if (st.view === 'hub') { send({ t: 'rankings', game: st.rkTab }); send({ t: 'hubchat' }); }
  } else if (m.t === 'pets') {
    st.pets = m.pets || []; st.onMe?.();
  } else if (m.t === 'me') {
    st.me = m.me;
    let adopted = false;
    if (adoptLook && m.me.user) { // just logged in: wear the look saved with the account
      adoptLook = false; adopted = true;
      st.name = m.me.name || st.name; st.color = m.me.color || st.color; if (m.me.av) st.av = cleanAv(m.me.av);
      LS.set('ct_name', st.name); LS.set('ct_color', st.color); LS.set('ct_av', JSON.stringify(st.av));
    }
    // Wearing something this profile has not bought (say, after logging out): take it off here too.
    if (!adopted && !st.creatorOpen && lockedIn(st.av, m.me.owned).length) {
      st.av = wearable(st.av, m.me.owned); LS.set('ct_av', JSON.stringify(st.av)); send({ t: 'profile', name: st.name, color: st.color, av: st.av });
    }
    st.onMe?.(); emojiPaint();
    if (m.gain) {
      const cg = m.gain.coins | 0;
      const pl = m.gain.place, ord = n => n + ([, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th');
      toast(`${m.gain.win ? 'Win! ' : pl > 1 && m.gain.of > 1 ? `${ord(pl)} place · ` : ''}+${m.gain.xp} XP${cg ? ` · ${cg > 0 ? '+' : '−'}${Math.abs(cg)} coins` : ''}`);
      if (m.gain.levelUp) { sfx.join(); toast(`${m.me.icon} Level ${m.me.level}: ${esc(m.me.rank)}`); }
    }
    if (st.view === 'hub') { if (adopted) renderHub(); else paintMe(); } else if (st.view === 'lobby') renderLobby(); else if (st.view === 'farm') st.farm?.me();
    if (m.me.user !== st.hc.for) { st.hc.for = m.me.user; paintHubFoot(); if (st.view === 'hub') send({ t: 'hubchat' }); }
    if (m.me.user !== st.friendsFor) { st.friendsFor = m.me.user; st.friends = null; if (m.me.user) send({ t: 'friends' }); paintFriends(); }
  } else if (m.t === 'friends') {
    st.friends = { friends: m.friends || [], reqs: m.reqs || [], sent: m.sent || [] };
    if (m.news) { sfx.join(); toast(m.news.now ? `${esc(m.news.from)} and you are now friends!` : `${esc(m.news.from)} wants to be friends. Open Friends to answer.`); }
    paintFriends();
  } else if (m.t === 'friended') {
    toast(m.op === 'add' ? (m.now ? `You and ${esc(m.user)} are now friends!` : `Asked ${esc(m.user)} to be friends.`) : m.op === 'accept' ? `You and ${esc(m.user)} are now friends!` : m.op === 'remove' ? `${esc(m.user)} was removed from your friends.` : 'Request declined.');
  } else if (m.t === 'farm') {
    if (st.farm) st.farm.msg(m);
    else if (m.invite) { farmInvite = m; toast(`${esc(m.invite.from)} invites you to a live battle. Open Pet Farm within a minute to answer.`); }
  } else if (m.t === 'rankings') {
    st.rk[m.game] = m; if (m.game === st.rkTab) paintRankings();
  } else if (m.t === 'hubchat') {
    onHubChat(m);
  } else if (m.t === 'stats') {
    st.stats = { online: m.online | 0, visitors: m.visitors | 0 }; paintStats();
  } else if (m.t === 'auth') {
    onAuth?.(m);
  } else if (m.t === 'rooms') {
    st.rooms = m.rooms || [];
    if (st.view === 'hub') renderTables();
  } else if (m.t === 'room') {
    const prev = st.room; st.room = m.room;
    if (m.room) closeFarm();
    if (!m.room || m.room.code !== prev?.code) chatReset();
    $chat.hidden = !m.room; scoresPaint();
    if (!m.room) { unmountGame(); st.lastState = null; watchPaint(); if (st.view !== 'farm') go('hub'); return; }
    if (prev && prev.code === m.room.code) {
      const before = new Set(prev.players.map(p => p.id));
      const joined = m.room.players.filter(p => !before.has(p.id));
      if (joined.length) { sfx.join(); joined.forEach(p => toast(`${esc(p.name)} pulled up a chair`)); }
    }
    if (st.game) st.game.room(m.room); else go('lobby');
    watchPaint();
  } else if (m.t === 'state') {
    // Each seat gets its player's cosmetics (fl), so a game can show their card back, dice, ball or kart paint.
    if (m.s?.seats && st.room) { const by = new Map(st.room.players.map(p => [p.id, p.fl])); for (const seat of m.s.seats) if (seat) seat.fl = (seat.id && by.get(seat.id)) || {}; }
    st.lastState = m.s;
    if (!m.s) { unmountGame(); watchPaint(); if (st.room) go('lobby'); return; }
    mountGame().then(g => { g?.update(st.lastState); watchPaint(); });
  } else if (m.t === 'react') {
    if (st.game) st.game.react(m); else floatAt(document.querySelector(`.seat[data-pid="${CSS.escape(String(m.id))}"]`), m.k);
    sfx.pop();
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
    sfx.join(); const [k, i] = m.id.split(':'); toast(`Bought ${esc(COS[k] ? `${cosItem(k, +i).n} (${COS[k].label.toLowerCase()})` : itemName(k, +i))}! It's yours to keep.`);
  } else if (m.t === 'winfx') {
    playWinFx(m.k, { banner: m.id === st.id ? '' : `${m.name} wins!` });
  } else if (m.t === 'err') {
    sfx.bad(); toast(esc(m.msg), true);
  }
}

// ---------- game mounting ----------
function mountGame() {
  if (st.game) return Promise.resolve(st.game);
  if (st.gameLoading) return st.gameLoading;
  const g = GAMES[st.room?.game];
  if (!g) return Promise.resolve(null);
  st.view = 'game';
  st.gameLoading = g.load().then(mod => {
    st.game = mod.mount($app, {
      act: a => send({ t: 'act', a }), react: k => send({ t: 'react', k }),
      myId: () => st.id, room: () => st.room, isHost: () => st.room?.host === st.id,
      again: () => send({ t: 'start' }), vote: on => send({ t: 'again', on }), sit: on => send({ t: 'sit', on }), toLobby: () => send({ t: 'lobby' }), leave: () => send({ t: 'leave' }),
      toast, rules: () => openRules(st.room?.game),
    });
    st.game.room(st.room); placeGameSwitch();
    st.gameLoading = null;
    return st.game;
  }).catch(err => { console.error(err); st.gameLoading = null; toast('Could not load the game. Refresh?', true); return null; });
  return st.gameLoading;
}
function unmountGame() { st.game?.destroy(); st.game = null; }

// Pet Farm is a persistent game with no table: it opens straight from the hub.
let farmInvite = null, farmLoading = null, farmVisit = null; // farmVisit: a friend's farm to walk to once the farm has loaded
function openFarm() {
  if (st.farm || farmLoading) return;
  st.view = 'farm'; document.title = `Pet Farm · ${SITE}`;
  $app.innerHTML = '<main class="wrap"><p style="padding:40px 0;font-family:var(--fd);font-size:22px">Walking to the farm…</p></main>';
  farmLoading = import('./games/farm/client.js').then(mod => {
    farmLoading = null;
    if (st.view !== 'farm') return;
    st.farm = mod.mount($app, { send: a => send({ t: 'farm', a }), toast, me: () => st.me, home: () => { closeFarm(); go('hub'); }, account: mode => openAccount(mode), friends: () => openFriends() });
    st.farm.reopen(); placeGameSwitch();
    if (farmVisit) { st.farm.visit(farmVisit); farmVisit = null; }
    if (farmInvite) { st.farm.msg(farmInvite); farmInvite = null; }
  }).catch(err => { console.error(err); farmLoading = null; toast('Could not load Pet Farm. Refresh?', true); go('hub'); });
}
function closeFarm() { st.farm?.destroy(); st.farm = null; }

// ---------- views ----------
function go(view) {
  st.view = view;
  document.title = view === 'lobby' && st.room ? `${st.room.code} · ${SITE}` : SITE;
  if (view === 'hub') renderHub();
  else if (view === 'lobby') renderLobby();
}

let adoptLook = false, onAuth = null;
const lvChip = (lv, icon, rank) => `<span class="lv" title="${esc(rank)}, level ${lv}">${icon} ${lv}</span>`;
const meChip = () => st.me ? lvChip(st.me.level, st.me.icon, st.me.rank) : '';

// "Your progress" card on the hub: rank, XP bar, lifetime numbers and the account buttons.
function meCard() {
  const m = st.me; if (!m) return '';
  const pct = Math.round(100 * m.into / m.need), rate = m.games ? Math.round(100 * m.wins / m.games) : 0;
  const per = Object.entries(m.byGame || {}).filter(([id]) => GAMES[id]).map(([id, g]) =>
    `<li><b>${GAMES[id].name}</b><span>${g.wins} ${g.wins === 1 ? 'win' : 'wins'} in ${g.games} · best ${g.best} pts</span></li>`).join('');
  return `<div class="mecard">
    <div class="rankrow">
      <span class="rankicon">${m.icon}</span>
      <div class="rankname"><b>${esc(m.rank)}</b><span>Level ${m.level}${m.nextRank ? ` · ${esc(m.nextRank)} at level ${m.nextRankLv}` : ''}</span></div>
      <div class="acct">${m.user
        ? `<span>Signed in as <b>${esc(m.user)}</b></span><button type="button" class="btn sm ghost" data-act="security">Password</button><button type="button" class="btn sm ghost" data-act="logout">Log out</button>`
        : `<span>Playing as a guest. Progress stays on this browser.</span><button type="button" class="btn sm m" data-act="account" data-mode="register">Create account</button><button type="button" class="btn sm w" data-act="account" data-mode="login">Log in</button>`}</div>
    </div>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.need}" aria-valuenow="${m.into}" aria-label="XP to next level"><i style="width:${pct}%"></i></div>
    <div class="xpnote"><span>${m.into} / ${m.need} XP to level ${m.level + 1}</span><span>${m.xp} XP in total</span></div>
    <div class="stats">
      <div><b>${m.wins}</b><span>Wins</span></div><div><b>${m.games}</b><span>Games</span></div>
      <div><b>${rate}%</b><span>Win rate</span></div><div><b>${m.pts}</b><span>Points</span></div>
      <div><b>${m.coins}</b><span>Coins</span></div>
    </div>
    ${per ? `<ul class="pergame">${per}</ul>` : `<p class="xpnote">Finish a game to earn XP. Wins are worth the most.</p>`}
  </div>`;
}
function paintMe() {
  const card = document.getElementById('me-card'); if (card) card.innerHTML = meCard();
  const chip = document.querySelector('.me .lvslot'); if (chip) chip.innerHTML = meChip();
  const cs = document.querySelector('.coinslot'); if (cs && st.me) cs.textContent = st.me.coins;
}

// Day or night: the sky look comes in both. Saved per browser; first visit follows the system setting.
let heroMod = null; // the hub's 3D hero module, loaded on first visit to the hub
const isNight = () => document.body.classList.contains('night');
function setNight(on, save) {
  document.body.classList.toggle('night', on);
  if (save) LS.set('ct_theme', on ? 'night' : 'day');
  [...document.querySelectorAll('.themebtn'), gameSwitch].forEach(b => { b.textContent = on ? '☀️' : '🌙'; b.title = b.ariaLabel = on ? 'Switch to day' : 'Switch to night'; });
  heroMod?.then(m => m.setHeroNight?.(on)).catch(() => {});
  if (document.body.classList.contains('in-game')) import('./scenery3d.js').then(m => m.setScenesNight(on)).catch(() => {}); // repaint the game's sky live
}
// Inside the games (which draw their own screens, without the top bar) the switch joins the game's round
// buttons at the top right, just before the sound button.
const gameSwitch = document.createElement('button');
gameSwitch.type = 'button'; gameSwitch.className = 'round gamesw';
gameSwitch.addEventListener('click', e => { e.stopPropagation(); switchTheme(gameSwitch); sfx.click(); });
function placeGameSwitch() {
  const tr = $app.querySelector('.tr'); if (!tr || tr.contains(gameSwitch)) return;
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
  <a class="brand" href="/" data-act="home">${potLogo(42)}<span>${SITE}</span></a>
  <nav class="navl" aria-label="Sections"><a href="#games" data-act="scroll" data-to="games">Games</a><a href="#rankings" data-act="scroll" data-to="rankings">Rankings</a><a href="#tables" data-act="scroll" data-to="tables">Open tables</a><a href="#hubchat" data-act="scroll" data-to="hubchat">Chat</a><a href="#" data-act="rules">How to play</a></nav>
  <button type="button" class="me frbtn" data-act="friends">Friends<span class="frbadge" ${st.friends?.reqs.length ? '' : 'hidden'}>${st.friends?.reqs.length || ''}</span></button>
  <button type="button" class="me coinbtn" data-act="shop" title="Coins: spend them on avatar items">${coinIco}<span class="coinslot">${st.me ? st.me.coins : '…'}</span><small>· shop</small></button>
  <button type="button" class="me stylebtn" data-act="style" title="Style: name colours, frames, titles, win effects and stickers" aria-label="Style: name colours, frames, titles, win effects and stickers">✨</button>
  <button type="button" class="me" data-act="profile">${avatarHtml(st.color, st.av, 38, frameCls(flairOf(st.me)))}${st.name ? nameHtml(st.name, flairOf(st.me)) : 'Pick a name'}<span class="lvslot">${meChip()}</span><small>· change</small></button>
  <button type="button" class="themebtn" data-act="theme" aria-label="${isNight() ? 'Switch to day' : 'Switch to night'}" title="${isNight() ? 'Switch to day' : 'Switch to night'}">${isNight() ? '☀️' : '🌙'}</button>
</header>`;

// The hub's live 3D hero (your avatar on a floating island). The SVG table stays as the fallback until three.js loads.
function mountSkyHero() {
  const box = document.querySelector('.hero .art'); if (!box) return;
  box.classList.add('sky3d');
  (heroMod ||= import('./hero3d.js')).then(m => { m.setHeroNight(isNight()); if (box.isConnected) m.mountHero(box, st.color, st.av); }).catch(() => {});
}
function renderHub() {
  $app.innerHTML = `${topbar()}
  <main class="wrap hubgrid">
    <section class="hero">
      <div>
        <h1>Pull up a chair.<br>The pot's already bubbling.</h1>
        <p>Tiny games for you and your friends. No downloads and no sign-up needed: pick a name, share a four-letter code and play. Empty seats get friendly bots.</p>
        <div class="row">
          <button type="button" class="btn big" data-act="host">Host a table</button>
        </div>
        <form class="codeform" data-form="join">
          <label for="code">Got a code?</label>
          <input id="code" class="field code-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" required>
          <button class="btn m">Join</button>
        </form>
        <p class="livestats" id="live-stats" aria-live="polite">${statsHtml()}</p>
      </div>
      <div class="art">${tableArt()}</div>
    </section>
    <div class="hubmid">
    <section id="progress" style="margin-bottom:44px">
      <h2>Your progress</h2>
      <div id="me-card">${meCard()}</div>
    </section>
    <section id="games">
      <h2>Games on the menu</h2>
      <div class="games">
        <article class="gcard">
          <div class="pic">${cardHtml(0, { w: 70 })}${cardHtml(40, { w: 78 })}${cardHtml(64, { w: 70 })}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Hot Pot</h3><span class="tag">1–4 players</span></div>
            <p>Draw, swap and collect three sets of three ingredients, then call “Let's Eat!” before anyone else.</p>
            <div class="row"><button type="button" class="btn" data-act="host">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic marblepic">${marbleArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Marble Rush</h3><span class="tag">1–8 players</span></div>
            <p>Pick a colour, bet your coins and watch the marbles tumble down a random 3D track.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="marbles">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic ladderpic">${laddersArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Snakes &amp; Ladders</h3><span class="tag">1–6 players</span></div>
            <p>The classic race to the top on a fresh 3D board every game, with your avatars as tokens and a few party tiles.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="ladders">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic pokerpic">${pokerArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Texas Hold'em</h3><span class="tag">1–6 players</span></div>
            <p>Cozy no-limit poker for pretend chips. Bluff your friends, out-read the bots and stack the whole table. New: <b>Mango Poker</b>, where the flop comes from the cards you all throw away.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="poker">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic ludopic">${ludoArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Ludo</h3><span class="tag">1–4 players</span></div>
            <p>Race your pawns round a chunky 3D board and bump your friends back to their yard. Sixes, stars and sweet revenge.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="ludo">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic stackpic">${stackArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Tower Stack</h3><span class="tag">1–6 players</span></div>
            <p>Take turns dropping swinging blocks on one shared, wobbly tower. Stack it high, and don't be the one who knocks it down.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="stack">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic golfpic">${golfArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Mini Golf Party</h3><span class="tag">1–6 players</span></div>
            <p>Take turns putting the same blocky 3D hole. Dodge the windmill, sink it in the fewest putts, and bet coins on who takes each hole.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="golf">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic dicepic">${diceArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Liar's Dice</h3><span class="tag">1–6 players</span></div>
            <p>Roll in secret under your cup, bid on everyone's dice and bluff with a straight face. Call “Liar!” when you smell one.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="dice">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic tyspic">${tysArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Tysiąc</h3><span class="tag">1–4 players</span></div>
            <p>The Polish card classic. Bid for the musik, announce king-and-queen marriages to set trumps, and be first to 1000.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="tys">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic pawpic">${pawArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Pawperty</h3><span class="tag">1–6 players</span></div>
            <p>Adopt pet shops round a cozy 3D board and collect rent in treats. Mind the Zoomies cards, Bath Time and the pets napping on the job.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="paw">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic kartpic">${kartArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Kart Island Race</h3><span class="tag">1–8 players</span></div>
            <p>Race little low-poly karts round roads that hop between floating islands. Drift for boosts, grab gift boxes and throw silly power-ups at your friends.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="kart">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic kitchenpic">${kitchenArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Kitchen Rush</h3><span class="tag">Co-op · 1–4</span></div>
            <p>Chop, cook and serve orders together in a little sky-island kitchen before the tickets run out. Don't burn the soup!</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="kitchen">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic digpic">${digArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Treasure Dig</h3><span class="tag">1–6 players</span></div>
            <p>Take turns digging up a grass field for gems and a golden chest. Read the numbers to dodge the traps, like Minesweeper with friends.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="dig">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic brickspic">${bricksArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Sky Bricks</h3><span class="tag">1–6 players</span></div>
            <p>Stack falling bricks in your own well while your friends do the same. Clear rows to send stone lines their way. Last one stacking wins.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="bricks">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic beanpic">${beanArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Beanstalk Bounce</h3><span class="tag">1–6 players</span></div>
            <p>Race your friends up a giant beanstalk, hopping from ledge to ledge. Run faster to jump higher, chain big jumps for streaks, and stay ahead of the storm.</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="bean">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic panpic">${panArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Pan</h3><span class="tag">1–6 players</span></div>
            <p>The Polish card game: nine of hearts starts, play the same or higher, or pick up three. Don't be the last one holding cards!</p>
            <div class="row"><button type="button" class="btn" data-act="host" data-game="pan">Host a table</button></div>
          </div>
        </article>
        <article class="gcard">
          <div class="pic farmpic">${farmArt()}</div>
          <div class="body">
            <div class="row" style="justify-content:space-between"><h3>Pet Farm</h3><span class="tag">Your own farm</span></div>
            <p>Build a little low-poly farm and raise pets on it. It keeps going between visits, so it needs an account.</p>
            <div class="row"><button type="button" class="btn" data-act="farm">Visit my farm</button></div>
          </div>
        </article>
        <article class="soon">${backSvg('width="84" height="84"')}<h3>Got an idea?</h3><p>New minigames drop into the hub as one folder each.</p></article>
      </div>
    </section>
    </div>
    <aside class="hubside left" aria-label="Open tables">
      <section id="tables">
        <div class="sidehead"><h2>Open tables</h2><span class="tcount" id="tables-count"></span></div>
        <p class="sidenote"><span class="livedot"></span>Updates live. Join a seat or watch a game.</p>
        <div class="tables" id="tables-list"></div>
        <button type="button" class="btn w sidehost" data-act="host">Host a table</button>
      </section>
      <section id="hubchat" aria-label="Hub chat">
        <div class="sidehead"><h2>Chat</h2></div>
        <p class="sidenote">One room for everyone on ${SITE}.</p>
        <div class="hccard">
          <div class="hclog" id="hc-log" role="log" aria-live="polite">${hubLogHtml()}</div>
          <div class="hcfoot" id="hc-foot">${hubFootHtml()}</div>
        </div>
      </section>
    </aside>
    <aside class="hubside right" aria-label="Rankings">
      <section id="rankings">
        <div class="sidehead"><h2>Rankings</h2></div>
        <p class="sidenote">Everyone on Cozy Table. Bots don't count.</p>
        <div class="rkcard">
          <div class="rktabs" role="tablist" aria-label="Rankings by game">${RK_TABS.map(([id, n]) => `<button type="button" role="tab" data-act="rktab" data-tab="${id}" aria-selected="${id === st.rkTab}">${n}</button>`).join('')}</div>
          <div id="rk-body" role="tabpanel">${rankingsHtml()}</div>
        </div>
      </section>
    </aside>
  </main>
  <footer>Made for friends. Coins are only for fun: they buy avatar items, nothing else. Poker chips are pretend. Hot Pot is a fan-made game inspired by Palia's Hotpot minigame.</footer>`;
  renderTables();
  document.body.classList.add('sky');
  mountSkyHero();
  send({ t: 'rankings', game: st.rkTab });
  send({ t: 'hubchat' }); hubScrollEnd();
  if (!st.name) openProfile(true);
}

// ---------- global rankings ----------
// One leaderboard per minigame across every player on the site (bots never count), plus an overall one by XP.
const RK_TABS = [['overall', 'Overall'], ...Object.entries(GAMES).map(([id, g]) => [id, g.name]), ['farm', 'Pet Farm']];
const RK_NOTE = {
  overall: 'Ranked by XP from every game. Wins earn the most.',
  marbles: 'Ranked by bets won, then by coins won overall.',
  farm: 'The Pet Farm ladder: points from Arena battles against other farms.',
  default: 'Ranked by wins, then win rate.',
};
const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
function rkStat(game, r) {
  if (game === 'overall') return [`${r.xp.toLocaleString()} XP`, `${plural(r.wins, 'win')} · ${plural(r.games, 'game')}`];
  if (game === 'farm') return [plural(r.pts, 'pt'), `${plural(r.pets, 'pet')} · best Lv ${r.top}`];
  if (game === 'marbles') return [plural(r.wins, 'bet') + ' won', `${plural(r.games, 'race')} · ${r.net >= 0 ? '+' : '−'}${Math.abs(r.net).toLocaleString()} coins`];
  return [plural(r.wins, 'win'), `${plural(r.games, 'game')} · ${r.rate}%${r.best ? ` · best ${r.best} pts` : ''}`];
}
function rkRow(game, r) {
  const [main, sub] = rkStat(game, r), medal = ['🥇', '🥈', '🥉'][r.pos - 1];
  return `<li class="${r.me ? 'you' : ''}">
    <span class="pos">${medal || r.pos}</span>${avatarHtml(r.color, r.av, 36, frameCls(r.fl))}
    <span class="who"><b>${nameHtml(r.name, r.fl)}${r.me ? ' <em>(you)</em>' : ''}</b><span>${r.lv ? lvChip(r.lv, r.icon, r.rank) : ''}${titleHtml(r.fl)}${r.guest ? '<i>guest</i>' : ''}</span></span>
    <b class="main">${main}</b><span class="sub">${sub}</span>
  </li>`;
}
function rankingsHtml() {
  if (!RK_TABS.some(([id]) => id === st.rkTab)) st.rkTab = 'overall';
  const g = st.rkTab, d = st.rk[g];
  if (!d) return `<p class="rknote">Loading…</p>`;
  const note = `<p class="rknote">${RK_NOTE[g] || RK_NOTE.default}${d.total > d.rows.length ? ` Top ${d.rows.length} of ${d.total.toLocaleString()} players.` : ''}</p>`;
  if (!d.rows.length) return note + `<div class="empty">${g === 'farm' ? 'No farms with pets yet. Visit your farm to be the first!' : 'Nobody has finished a game here yet. Play one to take first place!'}</div>`;
  return note + `<ol class="rk">${d.rows.map(r => rkRow(g, r)).join('')}${d.mine ? `<li class="gap" aria-hidden="true">…</li>${rkRow(g, d.mine)}` : ''}</ol>`
    + (d.rows.some(r => r.me) || d.mine ? '' : `<p class="rknote">${g === 'farm' ? 'Raise a pet on your farm to join this ladder.' : 'Finish a game to get on this board.'}</p>`);
}
function paintRankings() {
  const el = document.getElementById('rk-body'); if (el) el.innerHTML = rankingsHtml();
  document.querySelectorAll('[data-act="rktab"]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === st.rkTab));
}

// ---------- hub chat ----------
// One site-wide room on the hub. Everyone can read it, accounts can write. The server cleans and rate limits every
// line; here every piece of text still goes through esc(), so nothing a player types can become markup.
// Name flair (colours, titles from the cosmetics shop) arrives as `fl` on each line; flairName paints it.
export const flairName = (name, fl) => nameHtml(name, fl);
const hcTime = at => {
  const d = new Date(at), today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return today ? t : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${t}`;
};
const hcSame = (a, b) => a && b && a.user === b.user && b.at - a.at < 3 * 60_000;
function hubLine(m, prev) {
  const cont = hcSame(prev, m);
  return `<div class="hcl${m.own ? ' own' : ''}${cont ? ' cont' : ''}" data-id="${esc(m.id)}">
    ${cont ? '<span class="hcav"></span>' : `<span class="hcav">${avatarHtml(m.color, m.av, 34, frameCls(m.fl))}</span>`}
    <div class="hcbody">
      ${cont ? '' : `<div class="hcmeta"><b class="hcname">${flairName(m.name, m.fl)}</b>${m.lv ? lvChip(m.lv, m.icon, m.rank) : ''}${titleHtml(m.fl)}<time datetime="${new Date(m.at).toISOString()}">${esc(hcTime(m.at))}</time></div>`}
      <p>${esc(m.text)}</p>
    </div>
    ${m.del ? `<button type="button" class="hcdel" data-act="hubdel" data-id="${esc(m.id)}" aria-label="Remove this message" title="Remove">×</button>` : ''}
  </div>`;
}
function hubLogHtml() {
  const L = st.hc.log;
  if (!L) return '<p class="hcempty">Loading…</p>';
  if (!L.length) return '<p class="hcempty">Nobody has said anything yet. Say hi to everyone!</p>';
  return L.map((m, i) => hubLine(m, L[i - 1])).join('');
}
function hubFootHtml() {
  if (!st.me) return '';
  if (!st.me.user) return `<div class="hcguest"><span>Make a free account to join the chat.</span>
    <button type="button" class="btn sm m" data-act="account" data-mode="register">Create account</button><button type="button" class="btn sm w" data-act="account" data-mode="login">Log in</button></div>`;
  return `<form class="hcform" data-form="hubchat"><input class="field" id="hc-in" maxlength="${st.hc.max}" placeholder="Say something to everyone…" autocomplete="off" enterkeyhint="send" aria-label="Message to everyone"><button class="btn m">Send</button></form>`;
}
const $hcLog = () => document.getElementById('hc-log');
const hubAtEnd = () => { const el = $hcLog(); return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60; };
function hubScrollEnd() { const el = $hcLog(); if (el) el.scrollTop = el.scrollHeight; }
function paintHubLog() { const el = $hcLog(); if (el) { el.innerHTML = hubLogHtml(); hubScrollEnd(); } }
function paintHubFoot() { const el = document.getElementById('hc-foot'); if (el && !el.contains(document.activeElement)) el.innerHTML = hubFootHtml(); }
function onHubChat(m) {
  const hc = st.hc;
  if (m.err) { sfx.bad(); toast(esc(m.err), true); const inp = document.getElementById('hc-in'); if (inp && !inp.value && hc.pending) inp.value = hc.pending; return; }
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
  st.hc.pending = text; send({ t: 'hubchat', text }); inp.value = '';
});

// "3 playing now · 128 visitors so far" under the hero buttons.
function statsHtml() {
  const s = st.stats; if (!s) return '';
  const n = x => x.toLocaleString();
  return `<span class="on"><i></i><b>${n(s.online)}</b> ${s.online === 1 ? 'person' : 'people'} here now</span><span><b>${n(s.visitors)}</b> ${s.visitors === 1 ? 'visitor' : 'visitors'} so far</span>`;
}
function paintStats() { const el = document.getElementById('live-stats'); if (el) el.innerHTML = statsHtml(); }

function renderTables() {
  const el = document.getElementById('tables-list'); if (!el) return;
  const cnt = document.getElementById('tables-count'); if (cnt) cnt.textContent = st.rooms.length || '';
  if (!st.rooms.length) { el.innerHTML = `<div class="empty">No open tables right now. Host one and send your friends the code!</div>`; return; }
  el.innerHTML = st.rooms.map(r => `<div class="trow">
    ${avatarHtml(r.hostColor, r.hostAv, 46)}
    <div class="who"><b>${esc(r.host)}'s table</b><span>${esc(r.gameName)} · ${r.state === 'lobby' ? 'Waiting for players' : r.state === 'play' ? 'Playing' : 'Just finished'}${r.state !== 'lobby' && r.n < r.max ? ' · watch and take over a bot' : ''}${r.w ? ` · ${r.w} watching` : ''}</span></div>
    <div class="dots" aria-label="${r.n} of ${r.max} seats taken">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="tcode">${esc(r.code)}</span>
    <button type="button" class="btn ${r.n < r.max && r.state === 'lobby' ? 'm' : 'w'}" data-act="join" data-code="${esc(r.code)}">${r.n < r.max && r.state === 'lobby' ? 'Join' : 'Watch'}</button>
  </div>`).join('');
}

function renderLobby() {
  document.body.classList.add('sky');
  const r = st.room; if (!r) return go('hub');
  const host = r.host === st.id, gm = GAMES[r.game] || GAMES.hotpot, max = gm.seats(r);
  const seated = r.players.filter(p => !p.watch);
  const seats = Array.from({ length: max }, (_, i) => seated[i] || null);
  const watchers = [...seated.slice(max), ...r.players.filter(p => p.watch)];
  const meWatch = r.players.find(p => p.id === st.id)?.watch, saving = (r.sit || []).includes(st.id);
  const pill = (opt, val, label) => `<button type="button" aria-pressed="${String(r.opts[opt]) === String(val)}" data-act="opt" data-opt="${opt}" data-val="${val}" ${host ? '' : 'disabled'}>${label}</button>`;
  $app.innerHTML = `${topbar()}
  <main class="wrap lobby">
    <div class="main">
      <div class="crumb">${potLogo(34)} ${esc(r.gameName)} · waiting room</div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:15px;color:var(--muted);margin-bottom:6px">Table code</div>
          <div class="codetiles" aria-label="Table code ${esc(r.code)}">${[...r.code].map(ch => `<span>${esc(ch)}</span>`).join('')}</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
          <button type="button" class="btn" data-act="copy">Copy invite link</button>
          <span style="font-size:14px;color:var(--muted)">Friends can also type the code on the home page.</span>
        </div>
      </div>
      <div class="seats">${seats.map((p, i) => p ? `<div class="seat full ${p.online ? '' : 'offline'}" data-pid="${esc(p.id)}">
          ${avatarHtml(p.color, p.av, 64, frameCls(p.fl))}${petImg(p.pet, 52)}
          <div><b>${nameHtml(p.name, p.fl)} ${p.lv ? lvChip(p.lv, p.icon, p.rank) : ''}</b>${titleHtml(p.fl)}<span>${p.id === r.host ? 'Host' : 'Ready'}${p.id === st.id ? ' · you' : ''}${p.online ? '' : ' · reconnecting'}</span></div></div>`
        : `<div class="seat open">${backSvg('width="56" height="56"')}<div><b>Seat ${i + 1} is open</b><span>${gm.openSeat}</span></div></div>`).join('')}</div>
      ${watchers.length ? `<p style="margin:0;color:var(--muted)">Watching: ${watchers.map(p => nameHtml(p.name, p.fl)).join(', ')}</p>` : ''}
      ${meWatch ? `<div class="row"><button type="button" class="btn m" data-act="sit" aria-pressed="${saving}">${saving ? '✓ Next free seat is yours' : 'Take a seat'}</button></div>` : ''}
      <div class="row" style="margin-top:6px">
        ${host ? `<button type="button" class="btn big r" data-act="start">${gm.start}</button>` : `<span class="chip">Waiting for the host to start…</span>`}
        <button type="button" class="btn big ghost" data-act="leave">Leave</button>
      </div>
    </div>
    <aside>
      <h2 style="font-size:26px;margin:0">Table scoreboard</h2>
      ${boardHtml(r)}
      <h2 style="font-size:26px;margin:0">Table settings</h2>
      ${gm.settings(pill, r)}
      <label class="toggle">Show in open tables<input type="checkbox" data-act="priv" ${r.priv ? '' : 'checked'} ${host ? '' : 'disabled'}></label>
      ${host ? '' : `<p style="margin:0;font-size:14px;color:var(--muted)">Only the host can change settings.</p>`}
      <div class="howto"><b>How to win</b><br>${gm.howto} <a href="#" data-act="rules">Full rules</a></div>
    </aside>
  </main>`;
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
  const full = when === 'game' ? r.players.filter(p => !p.watch).length >= r.max : !bots;
  const soon = { game: 'when the next game starts', round: 'when this round of turns ends', hand: 'from the next hand', hole: 'from the next hole', now: 'right away' }[when] || 'when the next game starts';
  const msg = !saving ? 'You’re watching.'
    : full ? (when === 'game' ? 'Every seat is taken. You get the next free one.' : 'Every seat has a player. You get one next game.')
    : `You take over a bot ${soon}.`;
  const btn = saving ? 'Just watch' : full && when === 'game' ? 'Get the next free seat'
    : when === 'round' || when === 'now' ? 'Take over a bot' : when === 'hand' ? 'Play from next hand' : when === 'hole' ? 'Play from next hole' : 'Play next game';
  $watch.innerHTML = `<span>${msg}</span>
    <button type="button" class="btn ${saving ? 'w' : 'm'}" data-w="sit" aria-pressed="${saving}">${btn}</button>`;
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
const boardHtml = r => r.board?.length ? `<ol class="board">${r.board.map((e, i) => `<li>
    <span class="pos">${i + 1}</span>${avatarHtml(e.color, e.av, 36, frameCls(e.fl))}
    <b>${nameHtml(e.name, e.fl)}</b>
    <span class="num"><b>${e.wins}</b> ${e.wins === 1 ? 'win' : 'wins'}</span><span class="num"><b>${e.pts}</b> pts</span>${e.coins !== undefined ? `<span class="num"><b>${e.coins}</b> coins</span>` : ''}
  </li>`).join('')}</ol>
  <p class="boardnote">${r.played} ${r.played === 1 ? 'game' : 'games'} played at this table. Scores stay with the table, even through a server restart.</p>`
  : `<p class="boardnote">No games finished yet. Wins and points add up here for as long as the table stays open.</p>`;
function scoresPaint() { if (st.room) $chat.querySelector('.scorebody').innerHTML = boardHtml(st.room); else $chat.querySelector('.scorepanel').hidden = true; }
$chat.innerHTML = `
  <div class="chatpanel" hidden role="dialog" aria-label="Table chat">
    <div class="chathead"><b>Table chat</b><button type="button" class="round" data-c="toggle" aria-label="Close chat">×</button></div>
    <div class="chatlog" aria-live="polite"></div>
    <div class="chatemoji"></div>
    <form class="chatform"><input class="field" maxlength="160" placeholder="Say something nice…" autocomplete="off" aria-label="Message"><button class="btn m">Send</button></form>
  </div>
  <div class="chatpanel scorepanel" hidden role="dialog" aria-label="Table scoreboard">
    <div class="chathead"><b>Table scoreboard</b><button type="button" class="round" data-c="scores" aria-label="Close scoreboard">×</button></div>
    <div class="scorebody"></div>
  </div>
  <div class="chatpeek" hidden></div>
  <div class="chatbtns">
    <button type="button" class="btn w scorebtn" data-c="scores" aria-label="Table scoreboard">${SCORE_ICON}<span class="lbl">Scores</span></button>
    <button type="button" class="btn chatbtn" data-c="toggle" aria-label="Open chat">${CHAT_ICON}<span class="lbl">Chat</span><span class="badge" hidden></span></button>
  </div>`;
const $scores = $chat.querySelector('.scorepanel');
emojiPaint();
const $log = $chat.querySelector('.chatlog'), $panel = $chat.querySelector('.chatpanel'), $peek = $chat.querySelector('.chatpeek');
const chatLine = m => `<div class="cl${m.id === st.id ? ' own' : ''}">${avatarHtml(m.color, m.av, 30, frameCls(m.fl))}<p><b>${nameHtml(m.name, m.fl)}</b> ${esc(m.text)}</p></div>`;
// The reaction row: the six free emoji, then the stickers from packs this player has bought.
function emojiPaint() {
  const mine = stickersOf(st.me);
  const row = $chat.querySelector('.chatemoji'); row.classList.toggle('more', mine.length > 0);
  row.innerHTML = EMOJI.map((e, i) => `<button type="button" data-c="emo" data-k="${FOODS.length + i}" aria-label="React ${e}">${e}</button>`).join('')
    + mine.map(s => `<button type="button" data-c="emo" data-k="${s.k}" aria-label="Sticker ${s.e}">${s.e}</button>`).join('');
}
function chatPaint() {
  $log.innerHTML = chat.log.length ? chat.log.map(chatLine).join('') : '<p class="chatempty">No messages yet. Say hi!</p>';
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
  const f = st.friends, who = x => `${avatarHtml(x.color, x.av, 40, frameCls(x.fl))}<span class="frname"><b>${nameHtml(x.name, x.fl)}</b><small>${esc(x.user)}${x.lv ? ` · level ${x.lv}` : ''}</small></span>`;
  if (!st.me?.user) return `<h2>Friends</h2><p>Friends are kept with your account, so you find each other again on any device. Create one first: it only takes a username and a password.</p>
    <div class="row"><button type="button" class="btn m" data-fr="account" data-mode="register">Create account</button><button type="button" class="btn w" data-fr="account" data-mode="login">Log in</button></div>`;
  if (!f) return '<h2>Friends</h2><p>Loading…</p>';
  return `<h2>Friends</h2>
    <form class="fradd"><input class="field" id="fruser" maxlength="16" placeholder="A friend's username" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="A friend's username"><button class="btn m">Add</button></form>
    <p style="font-size:14px">Your username is <b>${esc(st.me.user)}</b>. Share it so friends can add you.</p>
    ${f.reqs.length ? `<h3>Wants to be your friend</h3><ul class="frlist">${f.reqs.map(x => `<li>${who(x)}<span class="fract"><button type="button" class="btn sm m" data-fr="accept" data-user="${esc(x.user)}">Accept</button><button type="button" class="btn sm ghost-ink" data-fr="decline" data-user="${esc(x.user)}">No thanks</button></span></li>`).join('')}</ul>` : ''}
    ${f.friends.length ? `<ul class="frlist">${f.friends.map(x => `<li>${who(x)}<span class="frdot ${x.online ? 'on' : ''}">${x.online ? 'Here now' : 'Away'}</span>
      <span class="fract">${x.farm ? `<button type="button" class="btn sm" data-fr="visit" data-farm="${esc(x.farm)}">Visit farm</button>` : ''}<button type="button" class="btn sm ghost-ink" data-fr="remove" data-user="${esc(x.user)}" aria-label="Remove ${esc(x.name)}">Remove</button></span></li>`).join('')}</ul>`
      : '<p>No friends yet. Add someone by their username.</p>'}
    ${f.sent.length ? `<p style="font-size:14px">Waiting for an answer from ${f.sent.map(x => `<b>${esc(x.user)}</b>`).join(', ')}.</p>` : ''}`;
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
  friendsSheet = modal('<div class="frbody"></div><button type="button" class="btn ghost-ink" data-fr="close">Close</button>');
  friendsSheet.onClose = () => { friendsSheet = null; };
  const el = friendsSheet.el;
  paintFriends(); if (st.me?.user) send({ t: 'friends' });
  el.addEventListener('submit', e => { e.preventDefault(); const u = el.querySelector('#fruser').value.trim(); if (!u) return; el.querySelector('#fruser').value = ''; send({ t: 'friend', op: 'add', user: u }); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-fr]'); if (!b) return;
    const a = b.dataset.fr; sfx.click();
    if (a === 'close') friendsSheet.close();
    else if (a === 'account') { friendsSheet.close(); openAccount(b.dataset.mode); }
    else if (a === 'visit') { friendsSheet.close(); if (st.farm) st.farm.visit(b.dataset.farm); else if (st.room) toast('Leave this table first, then visit.', true); else { farmVisit = b.dataset.farm; openFarm(); } }
    else if (a === 'remove') { if (b.dataset.sure) send({ t: 'friend', op: 'remove', user: b.dataset.user }); else { b.dataset.sure = 1; b.textContent = 'Really remove?'; } }
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

// The coin shop lives inside the creator: paid items show their price, can be tried on, and are bought one by one.
const coinIco = '<i class="cn" aria-hidden="true"></i>';
const ROW_LABEL = Object.fromEntries(AV_TABS.flatMap(([, rows]) => rows));
const itemName = (k, i) => AV_COLOR_KEYS.includes(k) ? ROW_LABEL[k] : OPT[k][i];
const SHOP_ORDER = ['top', 'hat', 'back', 'glasses', 'neck', 'shoes', 'hairC', 'eyes', 'eyeC', 'mouth', 'marks', 'botC', 'shoeC'];
const SHOP_ROWS = SHOP_ORDER.filter(k => OPT[k].some((_, i) => priceOf(k, i))).map(k => [k, ROW_LABEL[k]]);

function openProfile(first = false, startTab = 0) {
  let color = st.color, av = st.av.slice(), tab = startTab;
  const KI = Object.fromEntries(AV_KEYS.map((k, i) => [k, i]));
  const TABS = [...AV_TABS.map(([n]) => n), 'Shop'];
  const sheet = modal(`
    <h2>${first ? 'Who is joining the table?' : 'Your avatar'}</h2>
    <p>${first ? 'No account needed. Pick a name and a look; friends see both at the table.' : 'Change your name and how you look at the table. Items with a price come from the shop: try them on, then buy them with the coins you earn by playing.'}</p>
    <form data-form="profile" class="creator">
      <div class="cmain">
        <div class="pvcol">
          <div class="pv3d" id="pv"></div>
          <div class="pvbar">
            <span class="pvseg"><button type="button" data-cam="0" aria-pressed="true">Body</button><button type="button" data-cam="1" aria-pressed="false">Face</button></span>
            <button type="button" class="btn w sm" data-rand>Surprise me</button>
          </div>
        </div>
        <div class="optcol">
          <div class="namecol"><label for="nm">Name</label>
            <input class="field" id="nm" maxlength="16" required placeholder="e.g. Noodle Queen" value="${esc(st.name)}" autocomplete="nickname"></div>
          <div class="ctabs" role="tablist">${TABS.map((n, i) => `<button type="button" role="tab" data-tab="${i}"${i === AV_TABS.length ? ' class="shoptab"' : ''}>${i === AV_TABS.length ? coinIco : ''}${n}</button>`).join('')}</div>
          <div class="crows"></div>
        </div>
      </div>
      <div class="cart" aria-live="polite"></div>
      <button class="btn big">${first ? "Let's go" : 'Save'}</button>
      ${first ? '<button type="button" class="btn ghost-ink" data-login>I already have an account</button>' : ''}
    </form>`, !first);
  const { el, close } = sheet;
  const nm = el.querySelector('#nm'), pv = el.querySelector('#pv'), rows = el.querySelector('.crows'), cart = el.querySelector('.cart');
  let view = P3?.creatorPreview(pv) || null, open = true;
  st.creatorOpen = true;
  sheet.onClose = () => { open = false; st.creatorOpen = false; st.onMe = null; view?.dispose(); };
  if (!P3) p3Ready.then(() => { if (!open || !P3) return; pv.innerHTML = ''; view = P3.creatorPreview(pv); show(); });
  const show = () => { if (view) view.set(color, av); else pv.innerHTML = avatarHtml(color, av, 150); };
  const val = k => k === 'color' ? color : av[KI[k]];
  const owned = () => st.me?.owned || [], coins = () => st.me?.coins || 0;
  const isLocked = (k, i) => priceOf(k, i) > 0 && !owned().includes(k + ':' + i);
  const tag = (k, i) => { const p = priceOf(k, i); return !p ? '' : isLocked(k, i) ? ` data-p="${p}" class="lk"` : ' class="own"'; };
  // Seasonal items are sold only while their drop is on (the server's date decides). Out of season they are hidden
  // from the normal rows unless you own them, and the Shop tab lists them as "back in ...".
  const today = () => st.me?.today ? new Date(st.me.today + 'T12:00') : new Date();
  const away = (k, i) => !!seasonOf(k, i) && isLocked(k, i) && !onSale(k, i, today());
  const pill = (k, i) => `<button type="button" aria-pressed="${val(k) === i}" data-k="${k}" data-v="${i}"${tag(k, i)}>${OPT[k][i]}${isLocked(k, i) ? ` <small class="pr">${coinIco}${priceOf(k, i)}</small>` : ''}</button>`;
  const rowHtml = (k, label, only) => {
    const hex = k === 'color', list = hex ? COLORS : OPT[k], sw = hex || AV_COLOR_KEYS.includes(k);
    const idx = list.map((_, i) => i).filter(i => hex || (only ? priceOf(k, i) && !seasonOf(k, i) : !away(k, i)));
    if (!idx.length) return '';
    return `<div class="crow"><b>${label}</b><div class="${sw ? 'swatches' : 'pills'}">${idx.map(i => { const v = list[i]; return sw
      ? `<button type="button" style="--c:${v}" aria-label="${label} ${i + 1}${priceOf(k, i) ? (isLocked(k, i) ? `, ${priceOf(k, i)} coins` : ', owned') : ''}" aria-pressed="${val(k) === (hex ? v : i)}" data-k="${k}" data-v="${hex ? v : i}"${hex ? '' : tag(k, i)}></button>`
      : pill(k, i); }).join('')}</div></div>`;
  };
  const SEASON_ICO = { winter: '❄️', spring: '🌷', summer: '🌴', halloween: '🎃' };
  const dropsHtml = () => {
    const by = {}; for (const [id, sn] of Object.entries(SEASON)) { const [k, i] = id.split(':'); (by[sn] ||= []).push([k, +i]); }
    const on = Object.keys(SEASONS).filter(sn => by[sn] && seasonOn(sn, today())), off = Object.keys(SEASONS).filter(sn => by[sn] && !seasonOn(sn, today()));
    return on.map(sn => `<div class="crow drop"><b>${SEASON_ICO[sn]} ${SEASONS[sn].name} <small>Limited: on sale until ${SEASONS[sn].ends}. What you buy is yours to keep.</small></b><div class="pills">${by[sn].map(([k, i]) => pill(k, i)).join('')}</div></div>`).join('')
      + (off.length ? `<div class="crow drop off"><b>Other seasons <small>These come back with their season.</small></b><div class="pills">${off.map(sn => by[sn].map(([k, i]) => isLocked(k, i)
        ? `<button type="button" disabled title="Back in ${SEASONS[sn].back}">${SEASON_ICO[sn]} ${OPT[k][i]} <small class="pr">${SEASONS[sn].back}</small></button>` : pill(k, i)).join('')).join('')}</div></div>` : '');
  };
  const paintRows = () => {
    el.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', +b.dataset.tab === tab));
    rows.innerHTML = tab === AV_TABS.length
      ? `<p class="shopnote">${coinIco}You have <b>${coins()}</b> coins. Every finished game pays by where you finished: 10 for 1st, down to 1 for last, and Pet Farm and Marble Rush use the same coins. Tap an item to try it on.</p><button type="button" class="btn sm w tostyle" data-tostyle>✨ Name colours, frames, titles, win effects and stickers</button>` + dropsHtml() + SHOP_ROWS.map(([k, label]) => rowHtml(k, label, true)).join('')
      : AV_TABS[tab][1].map(([k, label]) => rowHtml(k, label)).join('');
  };
  const paintCart = () => {
    const ids = lockedIn(av, owned());
    cart.innerHTML = ids.length ? `<div class="cartlist"><b>Trying on</b>${ids.map(id => { const [k, i] = id.split(':'), p = priceOf(k, +i), short = p - coins();
      return `<span class="cartitem">${AV_COLOR_KEYS.includes(k) ? `<i class="dot" style="--c:${OPT[k][+i]}"></i>` : ''}${esc(itemName(k, +i))}<button type="button" class="btn sm" data-buy="${id}" ${short > 0 ? 'disabled' : ''}>${short > 0 ? `Need ${short} more` : `Buy ${coinIco}${p}`}</button></span>`; }).join('')}</div>
      <small>You have ${coinIco}${coins()}. Saving takes off anything you have not bought.</small>` : '';
  };
  st.onMe = () => { if (open) { paintRows(); paintCart(); } };
  paintRows(); paintCart(); show();
  if (first) setTimeout(() => nm.focus(), 50);
  el.addEventListener('click', e => {
    const by = e.target.closest('[data-buy]');
    if (by) { const [k, i] = by.dataset.buy.split(':'); by.disabled = true; send({ t: 'buy', k, i: +i }); return; }
    const b = e.target.closest('[data-k]');
    if (b) {
      const k = b.dataset.k; if (k === 'color') color = b.dataset.v; else av[KI[k]] = +b.dataset.v;
      rows.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.setAttribute('aria-pressed', x === b));
      sfx.pop(); show(); paintCart(); return;
    }
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = +tb.dataset.tab; sfx.click(); paintRows(); view?.face(tab === 1); camBtns(tab === 1); return; }
    const cb = e.target.closest('[data-cam]'); if (cb) { view?.face(cb.dataset.cam === '1'); camBtns(cb.dataset.cam === '1'); return; }
    if (e.target.closest('[data-login]')) { close(); openAccount('login'); return; }
    if (e.target.closest('[data-tostyle]')) { close(); openStyle(); return; }
    if (e.target.closest('[data-rand]')) { av = randomAv(); color = COLORS[Math.random() * COLORS.length | 0]; sfx.set(); paintRows(); paintCart(); show(); }
  });
  const camBtns = face => el.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.cam === '1') === face));
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const n = nm.value.replace(/[<>]/g, '').trim().slice(0, 16); if (!n) return;
    if (lockedIn(av, owned()).length) toast('Took off the items you have not bought yet.');
    st.name = n; st.color = color; st.av = wearable(av, owned());
    LS.set('ct_name', n); LS.set('ct_color', color); LS.set('ct_av', JSON.stringify(st.av));
    send({ t: 'profile', name: n, color, av: st.av });
    sfx.click(); close();
    if (pendingJoin) { send({ t: 'join', code: pendingJoin }); pendingJoin = ''; history.replaceState(null, '', location.pathname); }
    go(st.view === 'game' ? 'game' : st.view);
  });
}

// Account style: name colour, profile frame, title, win effect and sticker packs (public/cosmetics.js). What you own
// goes on with one tap; anything else can be tried on the preview card first and bought from the bar underneath.
function openStyle() {
  const pick = {}; // kinds where a not-yet-owned entry is being tried on: k -> i
  const sheet = modal(`
    <h2>Your style</h2>
    <p>How your name and picture look to everyone: in waiting rooms, chat and the rankings. Titles with a goal are earned by playing, the rest cost coins.</p>
    <div class="creator stylebox">
      <div class="stylecard"></div>
      <div class="crows stylerows"></div>
      <div class="cart" aria-live="polite"></div>
      <div class="row"><button type="button" class="btn big" data-done>Done</button><button type="button" class="btn big w" data-toshop>${coinIco}Avatar shop</button></div>
    </div>`);
  sheet.el.querySelector('.sheet').classList.add('wide');
  const { el, close } = sheet, card = el.querySelector('.stylecard'), rows = el.querySelector('.stylerows'), cart = el.querySelector('.cart');
  let open = true;
  const me = () => st.me || {}, coins = () => me().coins || 0, today = () => me().today ? new Date(me().today + 'T12:00') : new Date();
  const worn = k => pick[k] ?? (me().cos?.[k] | 0), has = (k, i) => cosHas(me(), k, i);
  const pill = (k, i) => {
    const it = cosItem(k, i), own = has(k, i), multi = COS[k].multi, on = multi ? own || pick[k] === i : worn(k) === i, pr = earnProgress(it, me());
    const look = k === 'nm' ? nameHtml(it.n, { nm: i }) : k === 'sp' ? `${esc(it.n)} <span class="stk">${it.e.slice(0, 6).join('') || EMOJI.join('')}</span>` : esc(it.n);
    if (!own && pr) return `<button type="button" disabled class="goal" title="${esc(pr[2])}">${look} <small class="pr">${pr[0]}/${pr[1]} · ${esc(pr[2])}</small></button>`;
    if (!own && !cosOnSale(k, i, today())) return `<button type="button" disabled title="Back in ${cosSeason(k, i).back}">${look} <small class="pr">back in ${cosSeason(k, i).back}</small></button>`;
    return `<button type="button" aria-pressed="${on}" data-k="${k}" data-v="${i}" class="${own ? (i && it.p ? 'own' : '') : 'lk'}">${look}${own ? '' : ` <small class="pr">${coinIco}${it.p}</small>`}${it.s && !own ? ` <small class="pr">· ${cosSeason(k, i).name}</small>` : ''}</button>`;
  };
  const paint = () => {
    for (const k of Object.keys(pick)) if (has(k, pick[k])) delete pick[k];
    const fl = Object.fromEntries(WORN.map(k => [k, worn(k)]));
    card.innerHTML = `${avatarHtml(st.color, st.av, 84, frameCls(fl))}<div><b>${nameHtml(st.name, fl)} ${meChip()}</b>${titleHtml(fl) || '<span class="ttl none">no title</span>'}<small>${fl.wn ? `Win effect: ${esc(cosItem('wn', fl.wn).n)}` : 'No win effect'}</small></div>`;
    rows.innerHTML = Object.entries(COS).map(([k, c]) => `<div class="crow"><b>${c.label}${k === 'sp' ? ' <small>Extra reactions for the chat row at any table.</small>' : k === 'wn' ? ' <small>Plays on everyone’s screen when you win. Tap one to see it.</small>' : c.where ? ` <small>${c.where}</small>` : ''}</b><div class="pills">${c.items.map((_, i) => pill(k, i)).join('')}</div></div>`).join('');
    const pal = me().cos?.pet || '', pets = st.pets || [];
    rows.insertAdjacentHTML('beforeend', `<div class="crow"><b>Lobby companion <small>One of your Pet Farm pets sits beside you in waiting rooms.</small></b><div class="pills palpills">${
      !me().user ? '<small>Log in and start a Pet Farm to bring a pet along.</small>' : !pets.length ? '<small>Hatch a pet in Pet Farm and it can come along.</small>'
      : `<button type="button" aria-pressed="${!pets.some(x => x.id === pal)}" data-pal="">None</button>` + pets.map(x => `<button type="button" aria-pressed="${x.id === pal}" data-pal="${esc(x.id)}">${petImg(x, 30, 'palpic')}${esc(x.name)} <small class="pr">lv ${x.lv | 0}</small></button>`).join('')}</div></div>`);
    petPics(rows);
    const myPal = pets.find(x => x.id === pal);
    if (myPal) { card.insertAdjacentHTML('afterbegin', petImg(myPal, 64)); card.prepend(card.children[1]); petPics(card); }
    const want = Object.entries(pick);
    cart.innerHTML = want.length ? `<div class="cartlist"><b>Trying on</b>${want.map(([k, i]) => { const it = cosItem(k, i), short = it.p - coins();
      return `<span class="cartitem">${esc(it.n)} <small>${esc(COS[k].label.toLowerCase())}</small><button type="button" class="btn sm" data-buy="${k}:${i}" ${short > 0 ? 'disabled' : ''}>${short > 0 ? `Need ${short} more` : `Buy ${coinIco}${it.p}`}</button></span>`; }).join('')}</div>
      <small>You have ${coinIco}${coins()}. Only what you buy is shown to others.</small>` : '';
  };
  st.onMe = () => { if (open) paint(); };
  if (me().user) send({ t: 'pets' });
  sheet.onClose = () => { open = false; st.onMe = null; if (st.view === 'hub' || st.view === 'lobby') go(st.view); };
  paint();
  el.addEventListener('click', e => {
    if (e.target.closest('[data-done]')) return close();
    if (e.target.closest('[data-toshop]')) { close(); return openProfile(false, AV_TABS.length); }
    const by = e.target.closest('[data-buy]');
    if (by) { const [k, i] = by.dataset.buy.split(':'); by.disabled = true; send({ t: 'buy', k, i: +i }); return; }
    const pl = e.target.closest('[data-pal]');
    if (pl) { sfx.pop(); (st.me.cos ||= {}).pet = pl.dataset.pal; send({ t: 'wear', k: 'pet', i: pl.dataset.pal }); return paint(); }
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, i = +b.dataset.v; sfx.pop();
    if (k === 'wn' && i) playWinFx(i, { ms: 2600 });
    if (has(k, i)) { delete pick[k]; if (!COS[k].multi) { (st.me.cos ||= {})[k] = i; send({ t: 'wear', k, i }); } }
    else if (pick[k] === i) delete pick[k]; else pick[k] = i;
    paint();
  });
}

function openAccount(mode = 'register') {
  const reg = mode === 'register';
  const { el, close } = modal(`
    <h2>${reg ? 'Create an account' : 'Log in'}</h2>
    <p>${reg ? 'Just a username and a password, no email. Your rank, XP and wins so far move into the account, and you can log in from any device.'
      : 'Pick up your rank, XP and wins on this device.'}</p>
    <form class="authform">
      <label for="au">Username</label>
      <input class="field" id="au" maxlength="16" required autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="ap">Password</label>
      <input class="field" id="ap" type="password" minlength="6" maxlength="72" required autocomplete="${reg ? 'new-password' : 'current-password'}">
      <p class="autherr" role="alert" hidden></p>
      ${reg ? '<p style="font-size:14px">Next you get a recovery code. Keep it somewhere safe: it lets you set a new password if you ever forget this one.</p>' : ''}
      <button class="btn big">${reg ? 'Create account' : 'Log in'}</button>
      ${reg ? '' : '<button type="button" class="btn ghost-ink" data-forgot>Forgot your password?</button>'}
      <button type="button" class="btn ghost-ink" data-swap>${reg ? 'I already have an account' : 'I need an account'}</button>
    </form>`);
  setTimeout(() => el.querySelector('#au').focus(), 50);
  el.querySelector('[data-swap]').addEventListener('click', () => { close(); onAuth = null; openAccount(reg ? 'login' : 'register'); });
  el.querySelector('[data-forgot]')?.addEventListener('click', () => { const u = el.querySelector('#au').value.trim(); close(); onAuth = null; openRecover(u); });
  authForm(el, () => {
    if (!reg) adoptLook = true;
    return { t: mode, user: el.querySelector('#au').value.trim(), pass: el.querySelector('#ap').value };
  }, m => {
    close(); sfx.join();
    if (reg) showRecoveryCode(m.code, true); else toast('Welcome back!');
    if (st.view === 'lobby') renderLobby();
  });
}

// Shared by the account forms: sends what msg() builds, shows the server's error under the form, or calls done().
function authForm(el, msg, done) {
  const err = el.querySelector('.autherr'), btn = el.querySelector('.btn.big');
  el.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (ws?.readyState !== 1) { err.textContent = 'Not connected. Try again in a moment.'; err.hidden = false; return; }
    const m = msg(); if (!m) return;
    btn.disabled = true; err.hidden = true;
    onAuth = r => {
      btn.disabled = false;
      if (r.err) { sfx.bad(); err.textContent = r.err; err.hidden = false; return; }
      onAuth = null; done(r);
    };
    send(m);
  });
}
const showErr = (el, text) => { const err = el.querySelector('.autherr'); err.textContent = text; err.hidden = false; sfx.bad(); };

// Forgot the password: username + recovery code (or a reset code from the host) + a new password.
function openRecover(user = '') {
  const { el, close } = modal(`
    <h2>Set a new password</h2>
    <p>Type your username and your recovery code (you got it when you made the account). Lost the code too? Ask the
      person who runs this site for a reset code and type that instead.</p>
    <form class="authform">
      <label for="ru">Username</label>
      <input class="field" id="ru" maxlength="16" required autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(user)}">
      <label for="rc">Recovery or reset code</label>
      <input class="field" id="rc" maxlength="40" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR">
      <label for="rp">New password</label>
      <input class="field" id="rp" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <p class="autherr" role="alert" hidden></p>
      <button class="btn big">Set new password</button>
      <button type="button" class="btn ghost-ink" data-back>Back to log in</button>
    </form>`);
  setTimeout(() => el.querySelector(user ? '#rc' : '#ru').focus(), 50);
  el.querySelector('[data-back]').addEventListener('click', () => { close(); onAuth = null; openAccount('login'); });
  authForm(el, () => { adoptLook = true; return { t: 'recover', user: el.querySelector('#ru').value.trim(), code: el.querySelector('#rc').value, pass: el.querySelector('#rp').value }; }, m => {
    close(); sfx.join(); toast('New password set. You are logged in, and other devices were logged out.');
    showRecoveryCode(m.code, false, 'Your old code is used up, so here is a new one.');
    if (st.view === 'lobby') renderLobby();
  });
}

// Shows a recovery code once, with a copy button. The server keeps only a scrambled copy, so it can't show it again.
function showRecoveryCode(code, fresh, note = '') {
  if (!code) return;
  const { el, close } = modal(`
    <h2>${fresh ? 'Account created!' : 'Your recovery code'}</h2>
    <p>${note ? note + ' ' : ''}If you ever forget your password, this code lets you set a new one. Save it in a password manager,
      a note on your phone, or on paper. It is shown only this once.</p>
    <p class="rcode" aria-label="Recovery code">${esc(code)}</p>
    <div class="row"><button type="button" class="btn w" data-copy>Copy code</button><button type="button" class="btn big" data-close>I saved it</button></div>`, false);
  el.querySelector('[data-copy]').addEventListener('click', e => {
    navigator.clipboard?.writeText(code).then(() => { e.target.textContent = 'Copied!'; }, () => { e.target.textContent = 'Select the code and copy it'; });
  });
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); close(); if (fresh) toast('Your progress is saved!'); });
}

// Signed in: change the password, or make a new recovery code. Both ask for the current password.
function openSecurity() {
  const { el, close } = modal(`
    <h2>Password and recovery</h2>
    <p>Signed in as <b>${esc(st.me?.user)}</b>.</p>
    <form class="authform" data-f="pw">
      <h3>Change password</h3>
      <input type="text" autocomplete="username" value="${esc(st.me?.user)}" hidden>
      <label for="po">Current password</label>
      <input class="field" id="po" type="password" maxlength="72" required autocomplete="current-password">
      <label for="pn">New password</label>
      <input class="field" id="pn" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <label for="pn2">New password again</label>
      <input class="field" id="pn2" type="password" minlength="6" maxlength="72" required autocomplete="new-password">
      <p class="autherr" role="alert" hidden></p>
      <p style="font-size:14px">Any other phone or computer signed in to this account is logged out.</p>
      <button class="btn big">Change password</button>
    </form>
    <form class="authform" data-f="rc">
      <h3>Recovery code</h3>
      <p style="font-size:14px">Lost your recovery code? Make a new one. The old one stops working.</p>
      <label for="pr">Password</label>
      <input class="field" id="pr" type="password" maxlength="72" required autocomplete="current-password">
      <p class="autherr" role="alert" hidden></p>
      <button class="btn big w">Make a new recovery code</button>
    </form>
    <button type="button" class="btn ghost-ink" data-close>Close</button>`);
  const pw = el.querySelector('[data-f="pw"]'), rc = el.querySelector('[data-f="rc"]');
  setTimeout(() => el.querySelector('#po').focus(), 50);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); onAuth = null; close(); });
  const scoped = f => ({ querySelector: q => q === 'form' ? f : f.querySelector(q) }); // authForm looks inside one form
  authForm(scoped(pw), () => {
    const a = pw.querySelector('#pn').value, b = pw.querySelector('#pn2').value;
    if (a !== b) { showErr(pw, 'The two new passwords are not the same.'); return null; }
    return { t: 'passwd', old: pw.querySelector('#po').value, pass: a };
  }, () => { close(); sfx.join(); toast('Password changed. Other devices were logged out.'); });
  authForm(scoped(rc), () => ({ t: 'recode', pass: rc.querySelector('#pr').value }), m => { close(); showRecoveryCode(m.code, false); });
}

export function openRules(game) {
  const ids = GAMES[game] ? [game] : Object.keys(GAMES);
  const { el, close } = modal(`
    ${ids.map(id => `<h2>How to play ${GAMES[id].name}</h2><div class="rules">${GAMES[id].rules}</div>`).join('')}
    <button type="button" class="btn big" data-close>Got it</button>`);
  el.querySelector('[data-close]').addEventListener('click', () => { sfx.click(); close(); });
}

// ---------- events ----------
$app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (['home', 'scroll', 'rules'].includes(act)) e.preventDefault();
  if (b.tagName === 'BUTTON') sfx.click();
  if (act === 'home') { if (st.room) send({ t: 'leave' }); else go('hub'); }
  else if (act === 'scroll') document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: 'smooth' });
  else if (act === 'rktab') { st.rkTab = b.dataset.tab; LS.set('ct_rk', st.rkTab); sfx.click(); paintRankings(); send({ t: 'rankings', game: st.rkTab }); }
  else if (act === 'rules') openRules(st.view === 'lobby' ? st.room?.game : undefined);
  else if (act === 'profile') openProfile();
  else if (act === 'style') { if (!st.name) return openProfile(true); openStyle(); }
  else if (act === 'shop') { if (!st.name) return openProfile(true); openProfile(false, AV_TABS.length); }
  else if (act === 'account') openAccount(b.dataset.mode);
  else if (act === 'security') openSecurity();
  else if (act === 'hubdel') send({ t: 'hubdel', id: b.dataset.id });
  else if (act === 'logout') { send({ t: 'logout' }); toast('Logged out. This browser is a guest again.'); }
  else if (act === 'host' || act === 'solo') {
    if (!st.name) return openProfile(true);
    const game = GAMES[b.dataset.game] ? b.dataset.game : 'hotpot';
    send(act === 'host' ? { t: 'create', game, opts: GAMES[game].host } : { t: 'create', game, priv: true, solo: true, opts: GAMES[game].solo });
  }
  else if (act === 'theme') { switchTheme(b); sfx.click(); }
  else if (act === 'friends') openFriends();
  else if (act === 'farm') { if (!st.name) return openProfile(true); openFarm(); }
  else if (act === 'join') send({ t: 'join', code: b.dataset.code });
  else if (act === 'leave') send({ t: 'leave' });
  else if (act === 'start') send({ t: 'start' });
  else if (act === 'sit') send({ t: 'sit', on: b.getAttribute('aria-pressed') !== 'true' });
  else if (act === 'opt') send({ t: 'opts', opts: { [b.dataset.opt]: ['timer', 'field', 'hands'].includes(b.dataset.opt) ? +b.dataset.val : b.dataset.val } });
  else if (act === 'copy') {
    const link = `${location.origin}/#${st.room.code}`;
    (navigator.clipboard?.writeText(link) ?? Promise.reject()).then(() => toast('Invite link copied!'), () => toast(`Share this: ${esc(link)}`));
  }
});
$app.addEventListener('change', e => { if (e.target.dataset.act === 'priv') send({ t: 'opts', priv: !e.target.checked }); });
$app.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'join') return;
  e.preventDefault();
  const code = e.target.querySelector('input').value.toUpperCase().trim();
  if (!validCode(code)) { sfx.bad(); toast('Codes are 4 letters or numbers', true); return; }
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

const p3Ready = import('./portraits.js').then(m => { P3 = m; if (st.view === 'hub' || st.view === 'lobby') go(st.view); }).catch(() => {});
go('hub');
connect();
