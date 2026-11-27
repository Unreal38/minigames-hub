// Pet Farm: everything the server and the client must agree on. Balance changes are edits to this file.
// A farm is a square grid of tiles. An item sits at tile (x, y) with a rotation r (0-3, quarter turns).

import { L, PL } from '../../i18n.js';

export const SIZES = [10, 12, 14, 16, 18, 20, 22, 24];
// Cost of growing the land to SIZES[i]. LAND_HOUSE[i]: the farmhouse level that size needs (none when missing).
export const EXPAND = [null, { wood: 40, stone: 30 }, { wood: 80, stone: 60, fiber: 30 }, { wood: 140, stone: 110, fiber: 60 }, { wood: 220, stone: 180, fiber: 100 },
  { wood: 320, stone: 260, fiber: 140, shells: 20 }, { wood: 440, stone: 360, fiber: 190, coal: 30 }, { wood: 600, stone: 480, fiber: 250, coal: 50, crystal: 3 }];
export const LAND_HOUSE = { 7: 5 };
export const MATS = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', shells: 'Shells', coal: 'Coal', crystal: 'Crystal', berries: 'Berries', sunberry: 'Sunberries', cookie: 'Berry Cookies', cake: 'Honey Cakes', juice: 'Berry Juice', pie: 'Sunberry Pies', tonic: 'Rest Tonics', pack: 'Trail Packs', coins: 'Coins', stamps: 'Stamps' };
// What each thing in the top bar is: where it comes from, and what it is for.
export const MAT_INFO = {
  wood:     ['Expeditions, most of all Mossy Woods.', 'Most buildings and decorations.'],
  stone:    ['Expeditions, most of all Pebble Ridge.', 'Buildings, paths and stone decorations.'],
  fiber:    ['Expeditions to Mossy Woods and Tidepool Cove.', 'Huts, the Nest, soft decorations and Honey Cakes.'],
  shells:   ['Expeditions to Tidepool Cove (farmhouse level 2).', 'Improving buildings and fancy decorations.'],
  coal:     ['Expeditions to Ember Hills (farmhouse level 3).', 'Higher building levels and fancy decorations.'],
  crystal:  ['Rare. Expeditions to Pebble Ridge (farmhouse level 2) and Thunder Meadow (level 4). Longer trips with more pets find more.', 'The Nest, top building levels, the fanciest decorations, and balloon fuel for far expeditions.'],
  berries:  ['Garden Plots grow them every hour. Tap "Pick berries".', 'Cooking treats in the Kitchen. Spare ones can be swapped at the Workshop.'],
  sunberry: ['Garden Plots of level 2 or 3 grow them with each harvest.', 'The best Kitchen recipes: Sunberry Pie and Rest Tonic.'],
  cookie:   ['Cooked in the Kitchen from 4 berries.', 'Tap a pet and feed it one for 30 experience.'],
  cake:     ['Cooked in the Kitchen from 10 berries and 5 fiber.', 'Tap a pet and feed it one for 90 experience.'],
  juice:    ['Cooked in the Kitchen from 6 berries.', 'Drink one in a practice or arena battle to heal 40%, once a battle.'],
  pie:      ['Cooked in a level 2 Kitchen.', 'Tap a pet and feed it one for 220 experience.'],
  tonic:    ['Cooked in a level 3 Kitchen.', 'Give it to a resting pet so it can go to the Nest again at once.'],
  stamps:   ['Delivering island orders at the Order Board.', 'Stamp decorations, under Edit farm, Stamps. Stamps stay on your farm: they cannot be traded, gifted or swapped.'],
  pack:     ['Packed in the Kitchen from 8 berries, 10 fiber and 4 coal.', 'Food for the long way: every far expedition takes a few.'],
  coins:    ['Battles, helping neighbours, and the other games on the site.', 'Trees and bushes here, and the avatar shop on the main page. Coins stay with you: they cannot be traded or gifted.'],
};
export const START_INV = { wood: 150, stone: 100, fiber: 80, coins: 100 };
export const MAX_ITEMS = 450;

// kind: 'b' building, 'd' decoration. w x h is the footprint before rotation. max = how many a farm may hold.
// fine: a small prop that snaps to half tiles (its w and h may be .5). Everything else sits on whole tiles.
// walk: pets can stroll across it. craft: a decoration that needs a Workshop of that level on the farm.
export const ITEMS = {
  house:    { name: 'Farmhouse', kind: 'b', w: 3, h: 3, max: 1, fixed: true, cost: {}, desc: 'Home sweet home. A bigger farmhouse opens up new places to explore.' },
  hut:      { name: 'Pet Hut', kind: 'b', w: 2, h: 2, max: 3, cost: { wood: 30, fiber: 10 }, desc: 'A snug place for four more pets to sleep.' },
  lodge:    { name: 'Pet Lodge', kind: 'b', w: 3, h: 2, max: 1, house: 4, cost: { wood: 120, stone: 80, fiber: 60, shells: 15 }, desc: 'A big cosy lodge where 60 more pets nap indoors, sorted into collections of your own. They can still go anywhere and do anything.' },
  museum:   { name: 'Pet Museum', kind: 'b', w: 3, h: 3, max: 1, house: 6, cost: { wood: 200, stone: 200, fiber: 80, shells: 20 }, desc: 'A grand hall that shows off your Pet Album. Its five medallions fill up as you find pets of each element.' },
  gate:     { name: 'Expedition Gate', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 25, stone: 15 }, desc: 'Pets set off by balloon from here and come back with materials, and sometimes a new friend.' },
  garden:   { name: 'Garden Plot', kind: 'b', w: 1, h: 1, max: 8, cost: { wood: 5, fiber: 5 }, desc: 'A patch of soil. Berries ripen here every hour.' },
  kitchen:  { name: 'Kitchen', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 30, stone: 20 }, desc: 'Turns berries into treats for your pets.' },
  barn:     { name: 'Storage Barn', kind: 'b', w: 2, h: 3, max: 1, cost: { wood: 45, stone: 10 }, desc: 'Room for three times as many materials.' },
  nest:     { name: 'Nest', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 20, fiber: 30, crystal: 2 }, desc: 'Two pets rest here and an egg appears.' },
  yard:     { name: 'Training Yard', kind: 'b', w: 3, h: 2, max: 1, cost: { wood: 25, stone: 25 }, desc: 'Pets practise their moves here against friendly partners.' },
  flag:     { name: 'Arena Flag', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 10, fiber: 10 }, desc: 'Challenge other farms here, and choose the team that defends yours.' },
  mailbox:  { name: 'Mailbox', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 8 }, desc: 'Gifts and letters from friends land here.' },
  board:    { name: 'Order Board', kind: 'b', w: 2, h: 1, max: 1, house: 2, cost: { wood: 30, stone: 15, fiber: 10 }, desc: 'Pets from the islands nearby pin their orders here. Deliver what they ask for and get Stamps.' },
  workshop: { name: 'Workshop', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 35, stone: 25 }, desc: 'Unlocks fancier decorations, and swaps spare materials for ones you need.' },

  fence:    { name: 'Fence', kind: 'd', w: 1, h: 1, cost: { wood: 2 }, desc: 'Keeps things tidy.' },
  path:     { name: 'Stone Path', kind: 'd', w: 1, h: 1, walk: true, cost: { stone: 1 }, desc: 'Pets like to stroll along it.' },
  tree:     { name: 'Leafy Tree', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 8 }, desc: 'A bit of shade.' },
  pine:     { name: 'Pine Tree', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 8 }, desc: 'Smells like a walk in the woods.' },
  bush:     { name: 'Bush', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 4 }, desc: 'Round and friendly.' },
  flowers:  { name: 'Flower Bed', kind: 'd', w: .5, h: .5, fine: true, walk: true, cost: { fiber: 3 }, desc: 'A splash of colour.' },
  lamp:     { name: 'Lantern', kind: 'd', w: .5, h: .5, fine: true, cost: { wood: 4, stone: 2 }, desc: 'A warm little light.' },
  pond:     { name: 'Pond', kind: 'd', w: 2, h: 2, cost: { stone: 12 }, desc: 'Cool water with a lily pad.' },
  bench:    { name: 'Bench', kind: 'd', w: 1, h: .5, fine: true, cost: { wood: 8 }, desc: 'For watching pets go by.' },
  rock:     { name: 'Mossy Rock', kind: 'd', w: .5, h: .5, fine: true, cost: { stone: 4 }, desc: 'It has always been here, probably.' },
  fountain: { name: 'Fountain', kind: 'd', w: 2, h: 2, craft: 1, cost: { stone: 30, shells: 8 }, desc: 'Splashes all day long.' },
  windmill: { name: 'Windmill', kind: 'd', w: 1, h: 1, craft: 1, cost: { wood: 30, coal: 5 }, desc: 'Turns slowly in the island breeze.' },
  arch:     { name: 'Flower Arch', kind: 'd', w: 1, h: 1, walk: true, craft: 1, cost: { wood: 10, fiber: 15, shells: 4 }, desc: 'Pets love to walk under it.' },
  statue:   { name: 'Pet Statue', kind: 'd', w: 1, h: 1, craft: 2, cost: { stone: 25, crystal: 1 }, desc: 'A proud little monument.' },
  glow:     { name: 'Crystal Lamp', kind: 'd', w: .5, h: .5, fine: true, craft: 2, cost: { coal: 4, crystal: 1 }, desc: 'Glows softly, day and night.' },
  tower:    { name: 'Climbing Tower', kind: 'd', w: 1, h: 1, craft: 1, cost: { wood: 15, fiber: 10, shells: 3 }, desc: 'Something to climb, scratch and nap on.' },
  cherry:   { name: 'Cherry Tree', kind: 'd', w: .5, h: .5, fine: true, cost: { coins: 15 }, desc: 'Pink blossom all year round.' },
  well:     { name: 'Wishing Well', kind: 'd', w: 1, h: 1, cost: { stone: 18, wood: 8 }, desc: 'Drop a coin in and make a wish.' },
  scarecrow:{ name: 'Scarecrow', kind: 'd', w: .5, h: .5, fine: true, cost: { wood: 6, fiber: 8 }, desc: 'Scares nobody. The pets think it is a friend.' },
  campfire: { name: 'Campfire', kind: 'd', w: .5, h: .5, fine: true, cost: { wood: 6, stone: 4 }, desc: 'A cosy spot for the evening.' },
  shrooms:  { name: 'Mushroom Ring', kind: 'd', w: .5, h: .5, fine: true, walk: true, cost: { fiber: 5 }, desc: 'Red caps in a little circle.' },
  picnic:   { name: 'Picnic Blanket', kind: 'd', w: 1, h: 1, walk: true, cost: { fiber: 12 }, desc: 'A basket, a blanket and a sunny afternoon.' },
  birdbath: { name: 'Bird Bath', kind: 'd', w: .5, h: .5, fine: true, cost: { stone: 8 }, desc: 'A small bird has already moved in.' },
  haybale:  { name: 'Hay Bales', kind: 'd', w: .5, h: .5, fine: true, cost: { fiber: 6 }, desc: 'Stacked up and good for climbing.' },
  gazebo:   { name: 'Gazebo', kind: 'd', w: 2, h: 2, craft: 2, cost: { wood: 40, shells: 10 }, desc: 'A shady pavilion for the middle of the farm.' },
  swing:    { name: 'Garden Swing', kind: 'd', w: 1, h: 1, craft: 1, cost: { wood: 18, fiber: 8, shells: 2 }, desc: 'Sways gently, even with nobody on it.' },
  lighthouse:{ name: 'Little Lighthouse', kind: 'd', w: 1, h: 1, craft: 2, cost: { stone: 30, coal: 6, shells: 6 }, desc: 'Helps balloons find their way home.' },
  hotspring:{ name: 'Hot Spring', kind: 'd', w: 2, h: 2, craft: 3, cost: { stone: 30, coal: 10 }, desc: 'Warm water and rising steam.' },
  rainbow:  { name: 'Rainbow Arch', kind: 'd', w: 2, h: 1, walk: true, craft: 3, cost: { shells: 12, crystal: 2 }, desc: 'A rainbow that stays put.' },
  treehouse:{ name: 'Tree House', kind: 'd', w: 2, h: 2, craft: 3, cost: { wood: 60, fiber: 20, coal: 5 }, desc: 'A hideout up in the branches.' },
  palbench: { name: "Friends' Bench", kind: 'd', w: 1, h: 1, pals: 5, cost: { wood: 12 }, desc: 'A bench for two. Unlocked by friendship.' },
  palflag:  { name: 'Friendship Flag', kind: 'd', w: .5, h: .5, fine: true, pals: 15, cost: { wood: 6, fiber: 10 }, desc: 'Bunting that says friends live here.' },
  ball:     { name: 'Pet Ball', kind: 'd', w: .5, h: .5, fine: true, walk: true, cost: { fiber: 6 }, desc: 'A toy for the pets.' },
  // The lucky set (wheel: true): prizes of the Lucky Wheel on the main page. Never bought or crafted; won ones wait under Edit farm.
  clover:    { name: 'Lucky Clover Patch', kind: 'd', w: .5, h: .5, fine: true, walk: true, wheel: true, max: 1, cost: {}, desc: 'Every leaf has four leaves. Won on the Lucky Wheel.' },
  carousel:  { name: 'Little Carousel', kind: 'd', w: 2, h: 2, wheel: true, max: 1, cost: {}, desc: 'It turns all day, with or without riders. Won on the Lucky Wheel.' },
  chest:     { name: 'Treasure Chest', kind: 'd', w: .5, h: .5, fine: true, wheel: true, max: 1, cost: {}, desc: 'Full to the brim and far too heavy to carry off. Won on the Lucky Wheel.' },
  goldpet:   { name: 'Golden Pet Statue', kind: 'd', w: 1, h: 1, wheel: true, max: 1, cost: {}, desc: 'A pet in shining gold. Won on the Lucky Wheel.' },
  balloon:   { name: 'Tethered Balloon', kind: 'd', w: 1, h: 1, wheel: true, max: 1, cost: {}, desc: 'It tugs at its rope whenever the wind picks up. Won on the Lucky Wheel.' },
  coinfount: { name: 'Coin Fountain', kind: 'd', w: 2, h: 2, wheel: true, max: 1, cost: {}, desc: 'Somebody has thrown in a lot of wishes. Won on the Lucky Wheel.' },
  horseshoe: { name: 'Horseshoe Gate', kind: 'd', w: 1, h: 1, walk: true, wheel: true, max: 1, cost: {}, desc: 'Walk under it for good luck. Won on the Lucky Wheel.' },
  // The stamp set (stamp: true): paid with Stamps from island orders (orders.js), never with materials, and never given as gifts.
  vane:      { name: 'Weather Vane', kind: 'd', w: .5, h: .5, fine: true, stamp: true, cost: { stamps: 30 }, desc: 'A little pet on a pole that turns to face the wind.' },
  topiary:   { name: 'Bunny Topiary', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 40 }, desc: 'A hedge trimmed into a bunny. The real bunnies are not sure what to make of it.' },
  hives:     { name: 'Bee Hives', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 50 }, desc: 'Two striped hives and a few busy bees.' },
  cart:      { name: 'Berry Cart', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 50 }, desc: 'A market cart with a sunshade, piled high with berries.' },
  flowerclock:{ name: 'Flower Clock', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 70 }, desc: 'A round flower bed whose hands show the real time.' },
  geode:     { name: 'Crystal Geode', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 80 }, desc: 'A rock split open to show the glowing crystals inside.' },
  telescope: { name: 'Star Telescope', kind: 'd', w: 1, h: 1, stamp: true, cost: { stamps: 90 }, desc: 'A brass telescope that slowly sweeps the sky for new islands.' },
  bandstand: { name: 'Bandstand', kind: 'd', w: 2, h: 2, stamp: true, cost: { stamps: 180 }, desc: 'A round little stage with a striped roof. Music notes drift out of it all day.' },
  miniwheel: { name: 'Mini Lucky Wheel', kind: 'd', w: 1, h: 1, wheel: true, max: 1, cost: {}, desc: 'A small wheel that never stops on a bad day. Won on the Lucky Wheel.' },
  // The Farm Journal set (jn: the chapter that gives it, see journal.js). Never bought or crafted; each waits under Edit farm.
  jsign:   { name: 'Welcome Sign', kind: 'd', w: 1, h: .5, fine: true, jn: 1, max: 1, cost: {}, desc: 'Says hello to every visitor. A Farm Journal reward.' },
  jboard:  { name: 'Notice Board', kind: 'd', w: 1, h: .5, fine: true, jn: 2, max: 1, cost: {}, desc: 'Notes, lists and a drawing of a pet. A Farm Journal reward.' },
  jpost:   { name: 'Signpost', kind: 'd', w: .5, h: .5, fine: true, jn: 3, max: 1, cost: {}, desc: 'Points the way to every island. A Farm Journal reward.' },
  jcradle: { name: 'Egg Cradle', kind: 'd', w: .5, h: .5, fine: true, jn: 4, max: 1, cost: {}, desc: 'A soft basket that rocks a spotted egg. A Farm Journal reward.' },
  jtable:  { name: 'Neighbours’ Table', kind: 'd', w: 1, h: 1, jn: 5, max: 1, cost: {}, desc: 'Room for everyone, and tea for two. A Farm Journal reward.' },
  jvane:   { name: 'Prize Pumpkin', kind: 'd', w: 1, h: 1, jn: 6, max: 1, cost: {}, desc: 'A blue ribbon for the best farm around. A Farm Journal reward.' },
  jscope:  { name: 'Star Globe', kind: 'd', w: 1, h: 1, jn: 7, max: 1, cost: {}, desc: 'Brass rings turn slowly round a little star. A Farm Journal reward.' },
  jcup:    { name: 'Collector’s Cup', kind: 'd', w: 1, h: 1, jn: 8, max: 1, cost: {}, desc: 'For a farmer who found nearly everything. A Farm Journal reward.' },
};

export const ELEMENTS = { Leaf: '#3f9a52', Ember: '#e0592f', Tide: '#2f86cc', Spark: '#d9a400', Stone: '#8a7f76' };
// rare: 0 common, 1 uncommon, 2 rare. Breeding-only hybrids join with breeding.
export const SPECIES = {
  mossbun:   { name: 'Mossbun', el: 'Leaf', rare: 0, blurb: 'A bunny whose back grows a coat of moss.' },
  sproutle:  { name: 'Sproutle', el: 'Leaf', rare: 0, blurb: 'A turtle with a sprout growing on its shell.' },
  petalpuff: { name: 'Petalpuff', el: 'Leaf', rare: 1, blurb: 'A fluffy sheep that wears a crown of flowers.' },
  acornip:   { name: 'Acornip', el: 'Leaf', rare: 1, blurb: 'A squirrel that hatches looking just like an acorn.' },
  cindercub: { name: 'Cindercub', el: 'Ember', rare: 0, blurb: 'A fox cub with a tail that flickers like a flame.' },
  toastoad:  { name: 'Toastoad', el: 'Ember', rare: 0, blurb: 'A toad as warm and golden as fresh toast.' },
  flickit:   { name: 'Flickit', el: 'Ember', rare: 2, blurb: 'A chick with a candle flame on its head.' },
  lanternail: { name: 'Lanternail', el: 'Ember', rare: 1, blurb: 'A snail that carries a warm lantern for a shell.' },
  puddlepup: { name: 'Puddlepup', el: 'Tide', rare: 0, blurb: 'A seal pup that carries its own puddle around.' },
  bubblefin: { name: 'Bubblefin', el: 'Tide', rare: 0, blurb: 'A round fish that floats along in a bubble.' },
  axolily:   { name: 'Axolily', el: 'Tide', rare: 2, blurb: 'An axolotl with lily pads for gills.' },
  ripplet:   { name: 'Ripplet', el: 'Tide', rare: 1, blurb: 'A duckling with a little wave curling on its head.' },
  zapkit:    { name: 'Zapkit', el: 'Spark', rare: 0, blurb: 'A kitten with a lightning bolt for a tail.' },
  buzzlet:   { name: 'Buzzlet', el: 'Spark', rare: 1, blurb: 'A chubby bee covered in static fuzz.' },
  voltvole:  { name: 'Voltvole', el: 'Spark', rare: 2, blurb: 'A hamster whose cheeks glow when it is happy.' },
  wattbat:   { name: 'Wattbat', el: 'Spark', rare: 0, blurb: 'A fluffy bat with lightning bolts for ears.' },
  pebblet:   { name: 'Pebblet', el: 'Stone', rare: 0, blurb: 'A hedgehog with pebbles for spines.' },
  cragcrab:  { name: 'Cragcrab', el: 'Stone', rare: 0, blurb: 'A crab that carries a boulder for a shell.' },
  dustmole:  { name: 'Dustmole', el: 'Stone', rare: 2, blurb: 'A mole that never takes off its tiny hard hat.' },
  rubblet:   { name: 'Rubblet', el: 'Stone', rare: 0, blurb: 'A boulder that stacks itself into a gentle little golem.' },
  bambear:   { name: 'Bambear', el: 'Leaf', rare: 1, blurb: 'A panda cub that grows its own bamboo shoot to snack on.' },
  sizzlet:   { name: 'Sizzlet', el: 'Ember', rare: 2, blurb: 'A dragon hatchling still learning to puff a flame.' },
  waddlet:   { name: 'Waddlet', el: 'Tide', rare: 1, blurb: 'A penguin chick that wears a seashell as a hat.' },
  oinkwatt:  { name: 'Oinkwatt', el: 'Spark', rare: 1, blurb: 'A piglet whose curly tail crackles with sparks.' },
  tricerock: { name: 'Tricerock', el: 'Stone', rare: 2, blurb: 'A baby three-horn with a frill of polished stone.' },
  shrimplet: { name: 'Shrimplet', el: 'Tide', rare: 0, blurb: 'A pink shrimp that hovers curled up like a comma and flicks its fan tail.' },
  siamew:    { name: 'Siamew', el: 'Stone', rare: 1, blurb: 'A Siamese cat with chocolate ears and paws and a sapphire on its collar.' },
  coralcolt: { name: 'Coralcolt', el: 'Tide', rare: 1, blurb: 'A sea horse that wears a crown of pink coral.' },
  skipfin:   { name: 'Skipfin', el: 'Tide', rare: 2, blurb: 'A dolphin that swims through the air with a beach ball on its nose.' },
  gingersnap: { name: 'Gingersnap', el: 'Ember', rare: 0, blurb: 'An orange tabby with white mittens that grows a new stripe with every nap.' },
  patchkit:  { name: 'Patchkit', el: 'Leaf', rare: 1, blurb: 'A calico cat in three colours with a daisy tucked behind one ear.' },
  tuxpurr:   { name: 'Tuxpurr', el: 'Spark', rare: 1, blurb: 'A tuxedo cat that never goes out without its bow tie and top hat.' },
  fluffcoon: { name: 'Fluffcoon', el: 'Tide', rare: 2, blurb: 'A huge fluffy Maine Coon that loves snow and splashing in puddles.' },
  munchmew:  { name: 'Munchmew', el: 'Ember', rare: 1, blurb: 'A munchkin cat with a long body, very short legs and a ribbon bow.' },
  rocktopus: { name: 'Rocktopus', el: 'Stone', rare: 1, blurb: 'An octopus that hides among the rocks and stacks pebbles on its head.' },
  driftle:   { name: 'Driftle', el: 'Tide', rare: 1, blurb: 'A sea turtle that glides through the air with a starfish on its shell.' },
  zapuff:    { name: 'Zapuff', el: 'Spark', rare: 1, blurb: 'A pufferfish that floats like a balloon and crackles when it puffs up.' },
  ottershell: { name: 'Ottershell', el: 'Tide', rare: 0, blurb: 'An otter that never lets go of its favourite seashell.' },
  cinnapanda: { name: 'Cinnapanda', el: 'Ember', rare: 1, blurb: 'A red panda the colour of cinnamon with a long ringed tail.' },
  yuzubara:  { name: 'Yuzubara', el: 'Leaf', rare: 1, blurb: 'A calm capybara that balances a yuzu on its head.' },
  snoozloth: { name: 'Snoozloth', el: 'Leaf', rare: 2, blurb: 'A sloth that wears a nightcap all day, just in case.' },
  glidenut:  { name: 'Glidenut', el: 'Spark', rare: 0, blurb: 'A flying squirrel with huge eyes that glides on its own little flaps.' },
  glazemew:  { name: 'Glazemew', el: 'Spark', rare: 1, blurb: 'A munchkin cat from the bakery, iced in pink like a little donut.' },
  // themed sets, found on their own islands
  strawbun: { name: 'Strawbun', el: 'Leaf', rare: 0, blurb: 'A strawberry bunny with seed freckles and a leafy collar.' },
  chilipup: { name: 'Chilipup', el: 'Ember', rare: 1, blurb: 'A long chili pepper puppy whose curled tail smokes.' },
  melonwhale: { name: 'Melonwhale', el: 'Tide', rare: 1, blurb: 'A watermelon whale with a pink slice for a belly.' },
  lemonzest: { name: 'Lemonzest', el: 'Spark', rare: 0, blurb: 'A fizzy lemon chick with a peel curl on its head.' },
  coconutkin: { name: 'Coconutkin', el: 'Stone', rare: 1, blurb: 'A coconut armadillo that grows a palm sprout.' },
  pinepine: { name: 'Pinepine', el: 'Leaf', rare: 2, blurb: 'A pineapple hedgehog with a tall leafy crown.' },
  croissab: { name: 'Croissab', el: 'Ember', rare: 0, blurb: 'A croissant crab whose two tips are its pincers.' },
  donuseal: { name: 'Donuseal', el: 'Tide', rare: 0, blurb: 'A seal pup that wears an iced donut as a swim ring.' },
  cupcowl: { name: 'Cupcowl', el: 'Leaf', rare: 2, blurb: 'An owl in a cupcake wrapper with a cherry on top.' },
  pretzelisk: { name: 'Pretzelisk', el: 'Stone', rare: 1, blurb: 'A snake that ties itself into a salted pretzel.' },
  mallowlamb: { name: 'Mallowlamb', el: 'Leaf', rare: 0, blurb: 'A marshmallow lamb, toasted on top when grown.' },
  candraffe: { name: 'Candraffe', el: 'Spark', rare: 2, blurb: 'A candy cane giraffe with cane-hook horns.' },
  jellifrog: { name: 'Jellifrog', el: 'Tide', rare: 1, blurb: 'A see-through jelly frog with fruit bits inside.' },
  carrofox: { name: 'Carrofox', el: 'Ember', rare: 0, blurb: 'A fox with a carrot for a tail.' },
  pumpkit: { name: 'Pumpkit', el: 'Ember', rare: 1, blurb: 'A kitten curled up inside a pumpkin.' },
  peapillar: { name: 'Peapillar', el: 'Leaf', rare: 0, blurb: 'Three peas in a pod that wake up one by one.' },
  shroomouse: { name: 'Shroomouse', el: 'Stone', rare: 2, blurb: 'A tiny mouse under a spotted mushroom cap.' },
  snowfox: { name: 'Snowfox', el: 'Tide', rare: 1, blurb: 'A snow fox with a snowflake on its forehead.' },
  sunlion: { name: 'Sunlion', el: 'Ember', rare: 2, blurb: 'A lion cub with a mane of sun rays.' },
  dripfrog: { name: 'Dripfrog', el: 'Tide', rare: 0, blurb: 'A raindrop frog that grows up to carry a leaf umbrella.' },
  twistret: { name: 'Twistret', el: 'Spark', rare: 1, blurb: 'A ferret riding its own little whirlwind.' },
  moonbun: { name: 'Moonbun', el: 'Spark', rare: 1, blurb: 'A sleepy lilac bunny that carries a slice of moon.' },
  starjelly: { name: 'Starjelly', el: 'Tide', rare: 0, blurb: 'A star-shaped jellyfish with glowing tips.' },
  cometail: { name: 'Cometail', el: 'Spark', rare: 2, blurb: 'A streak of a ferret with a comet for a tail.' },
  ringbear: { name: 'Ringbear', el: 'Stone', rare: 0, blurb: 'A dozy bear cub that wears a planet ring.' },
  // pets from old stories: found only on Legend Isle, at the end of a far expedition (far: true)
  griffling: { name: 'Griffling', el: 'Ember', rare: 2, far: true, blurb: 'A griffin cub with the white head and hooked beak of an eagle, big brown wings and the tufted tail of a lion.' },
  bloomicorn: { name: 'Bloomicorn', el: 'Leaf', rare: 2, far: true, blurb: 'A unicorn foal with a mane of blossoms and a little spiral horn.' },
  dreampir: { name: 'Dreampir', el: 'Spark', rare: 2, far: true, blurb: 'A baby tapir with a starry coat that blows dream bubbles from its trunk.' },
  yetiny: { name: 'Yetiny', el: 'Tide', rare: 2, far: true, blurb: 'A shaggy yeti cub with frosty horns and big snowshoe feet.' },
  gargoylet: { name: 'Gargoylet', el: 'Stone', rare: 2, far: true, blurb: 'A little stone gargoyle that sits as still as a statue until you look away.' },
  nessling: { name: 'Nessling', el: 'Tide', rare: 2, far: true, blurb: 'A baby lake monster with a long neck, a row of humps and four flippers.' },
  // Lucky Wheel pets (wheel: the season they can be won in): won only from the daily wheel, never found, hatched, sold or traded,
  // and they cannot have eggs. rare 4 keeps them out of the pet of the day, Mystery Pet and everything that rolls a species.
  tusklet: { name: 'Tusklet', el: 'Tide', rare: 4, wheel: 'winter', blurb: 'A chubby walrus pup in a knitted bobble hat and a red scarf. Its tusks grow longer every winter.', hint: 'Won only on the Lucky Wheel in winter.' },
  // breeding only: two elements, never found in the wild. hint is all the Pet Album gives away.
  truffowl:   { name: 'Truffowl', el: 'Leaf', el2: 'Tide', rare: 3, blurb: 'A round owl that grows its own mushroom cap.', hint: 'Hatches where moss meets the tide.' },
  magmutt:    { name: 'Magmutt', el: 'Ember', el2: 'Stone', rare: 3, blurb: 'A lava puppy in a coat of cracked rock.', hint: 'Hatches where fire warms the stone.' },
  nimbowhale: { name: 'Nimbowhale', el: 'Tide', el2: 'Spark', rare: 3, blurb: 'A tiny whale that carries its own rain cloud.', hint: 'Hatches where rain meets lightning.' },
  glimmoth:   { name: 'Glimmoth', el: 'Spark', el2: 'Leaf', rare: 3, blurb: 'A moth whose wings glow after dark.', hint: 'Hatches where a spark lands on a leaf.' },
  geodeer:    { name: 'Geodeer', el: 'Stone', el2: 'Tide', rare: 3, blurb: 'A fawn with antlers of clear crystal.', hint: 'Hatches where water wears the stone.' },
  maplander:  { name: 'Maplander', el: 'Leaf', el2: 'Ember', rare: 3, blurb: 'A salamander whose tail is an autumn leaf that never stops glowing.', hint: 'Hatches where embers fall on dry leaves.' },
  koalith:    { name: 'Koalith', el: 'Stone', el2: 'Leaf', rare: 3, blurb: 'A stone-grey koala with moss in its ears. It naps like a rock.', hint: 'Hatches where moss covers the stone.' },
  kettlephant: { name: 'Kettlephant', el: 'Tide', el2: 'Ember', rare: 3, blurb: 'A little elephant that whistles steam when it is happy.', hint: 'Hatches where fire brings water to the boil.' },
  bangaroo:   { name: 'Bangaroo', el: 'Ember', el2: 'Spark', rare: 3, blurb: 'A joey that keeps a firework in its pouch for special days.', hint: 'Hatches where a spark meets a flame.' },
  magnebug:   { name: 'Magnebug', el: 'Spark', el2: 'Stone', rare: 3, blurb: 'A beetle with a magnet for a horn. Pebbles follow it around.', hint: 'Hatches where lightning strikes the rock.' },
};
// Animal families: species that are the same kind of animal. The album shows them together and breeding will treat them as kin.
export const FAMILIES = {
  cat: ['Cats', ['zapkit', 'pumpkit', 'siamew', 'gingersnap', 'patchkit', 'tuxpurr', 'fluffcoon', 'munchmew', 'glazemew']],
  bunny: ['Bunnies', ['mossbun', 'strawbun', 'moonbun']], fox: ['Foxes', ['cindercub', 'carrofox', 'snowfox']],
  frog: ['Frogs and toads', ['toastoad', 'jellifrog', 'dripfrog']], bear: ['Bears', ['bambear', 'ringbear', 'cinnapanda']],
  chick: ['Chicks', ['flickit', 'lemonzest']], seal: ['Seals', ['puddlepup', 'donuseal']], hedgehog: ['Hedgehogs', ['pebblet', 'pinepine']],
  crab: ['Crabs', ['cragcrab', 'croissab']], dog: ['Dogs', ['chilipup', 'magmutt']], whale: ['Whales', ['melonwhale', 'nimbowhale']],
  owl: ['Owls', ['cupcowl', 'truffowl']], ferret: ['Ferrets', ['twistret', 'cometail']], turtle: ['Turtles', ['sproutle', 'driftle']],
  squirrel: ['Squirrels', ['acornip', 'glidenut']], sheep: ['Sheep', ['petalpuff', 'mallowlamb']],
};
const FAM = {}; for (const [k, [, list]] of Object.entries(FAMILIES)) for (const sp of list) FAM[sp] = k;
export const familyOf = sp => FAM[sp] || null; // null: a family of one
export const kin = (a, b) => !!FAM[a] && FAM[a] === FAM[b];
// Does this species get the 25% carry bonus in this zone? Its element matches, or on a themed island it lives there.
export const atHome = (z, sp, el = SPECIES[sp]?.el) => !!SPECIES[sp] && (z.theme ? sp in z.wild : el === z.el);
// Element variants: a pet of a one-element species can hatch with another element (p.el), which replaces its own.
export const elOf = p => { const d = SPECIES[p.sp]; return d && !d.el2 && p.el && ELEMENTS[p.el] ? p.el : d?.el; };
export const variantOf = p => elOf(p) !== SPECIES[p.sp]?.el ? elOf(p) : null;
export const RARITY = ['Common', 'Uncommon', 'Rare', 'Breeding only', 'Lucky Wheel only'];
export const wheelOnly = sp => !!SPECIES[sp]?.wheel; // a Lucky Wheel pet: no eggs, no trades, no playdates
export const STARTERS = ['mossbun', 'cindercub', 'puddlepup'];
export const FORMS = ['Baby', 'Young', 'Adult'];
export const formOf = lv => lv < 5 ? 0 : lv < 12 ? 1 : 2;
export const MAX_LV = 30;
export const xpFor = lv => 10 + lv * 10; // experience needed to go from lv to lv + 1
// The farmhouse sets how far pets can grow (Kuba, 2026-11-27): HOUSE_LV[house level] is the top pet level. A pet
// already above it (from before) keeps its level; it just learns nothing more until the farmhouse catches up.
export const HOUSE_LV = [0, 8, 12, 15, 18, 20, 25, 30];
export const lvCap = farm => HOUSE_LV[Math.min(HOUSE_MAX, Math.max(1, farm?.house || 1))];
export const houseFor = lv => HOUSE_LV.findIndex(n => n >= lv); // the farmhouse level that lets a pet reach lv
// Treats are for growing up: they give experience only below TREAT_LV (Adult). After that pets learn by doing.
export const TREAT_LV = 12;
// Battle experience for each pet that fought, [win, loss] (2026-11-27: battles pay more than treats for grown pets).
// The first win of the day counts double; a foe team well above yours pays half again, one well below half.
export const BATTLE_XP = { arena: [60, 25], live: [60, 25], wild: [50, 20], practice: [40, 15] };
export const FIRST_WIN_X = 2, STRONG_X = 1.5, WEAK_X = .5, STRONG_GAP = 2, WEAK_GAP = 3;
export const teamLv = pets => pets.length ? pets.reduce((n, p) => n + p.lv, 0) / pets.length : 1;
// How a foe team's average level changes the experience: x1.5 when it is STRONG_GAP or more above, x0.5 when WEAK_GAP or more below.
export const gapX = (mine, theirs) => theirs - mine >= STRONG_GAP ? STRONG_X : mine - theirs >= WEAK_GAP ? WEAK_X : 1;
// Levels past 20 make pets stronger in battle only: helpers and expeditions count at most level 20, so the economy stays put.
export const WORK_LV = 20;
// Building levels. Each building starts at level 1 and can be improved once for each cost in its UPGRADES entry
// (twice for all of them now); level n needs a farmhouse of level n.
export const UP_MAX = 3;
export const UPGRADES = {
  hut:    { what: 'Two more beds', cost: [{ wood: 40, fiber: 20 }, { wood: 80, fiber: 40, shells: 10 }] },
  lodge:  { what: ['Room for 150 pets inside', 'Room for 300 pets inside'], cost: [{ wood: 200, stone: 140, fiber: 100, coal: 20 }, { wood: 320, stone: 220, fiber: 160, coal: 35, crystal: 3 }] },
  gate:   { what: 'One more party can be out exploring', cost: [{ wood: 40, stone: 30, shells: 8 }, { wood: 80, stone: 60, coal: 12 }] },
  kitchen:  { what: ['A new recipe: Sunberry Pie', 'A new recipe: Rest Tonic'], cost: [{ wood: 40, stone: 30, shells: 6 }, { wood: 80, stone: 60, coal: 12 }] },
  workshop: { what: ['A second set of decorations, and better swaps', 'The grandest decorations, and the best swaps'], cost: [{ wood: 50, stone: 40, shells: 8 }, { wood: 100, stone: 80, coal: 15, crystal: 1 }] },
  garden: { what: ['Ripens 15 minutes sooner, and grows a Sunberry each time', 'Ripens 15 minutes sooner again, and grows two Sunberries'], cost: [{ wood: 10, fiber: 15 }, { wood: 20, fiber: 30, shells: 4 }] },
  barn:   { what: 'Room for 600 more of each material', cost: [{ wood: 60, stone: 30 }, { wood: 120, stone: 60, coal: 10 }] },
  nest:   { what: ['A second egg slot', 'A third egg slot, and eggs hatch a quarter sooner'], cost: [{ fiber: 40, shells: 10 }, { fiber: 80, coal: 10, crystal: 2 }] },
  yard:   { what: 'One more training spot', cost: [{ wood: 40, stone: 40 }, { wood: 80, stone: 80, coal: 10 }] },
  // The Pet Museum is a landmark: its levels change only its look, and each one needs more species in the album (need)
  // instead of a bigger farmhouse. It is a long-term place to spend spare materials.
  museum: { what: ['A blue dome with a gold lantern', 'Skylights, gold trim and element banners', 'Two side wings and pet statues by the steps', 'A golden dome with a star, flags and a red carpet'],
    need: [10, 20, 32, 45],
    cost: [{ wood: 300, stone: 300, fiber: 100, shells: 40, coal: 20, crystal: 2 }, { wood: 450, stone: 450, fiber: 150, shells: 60, coal: 40, crystal: 5 },
      { wood: 600, stone: 600, fiber: 200, shells: 80, coal: 60, crystal: 10 }, { wood: 800, stone: 800, fiber: 300, shells: 100, coal: 80, crystal: 20 }] },
  // Decorations that can be improved: pets stay on them longer and do more there (ROUTES in models.js has the moves).
  // does: what pets do on it at each level, shown on its card.
  tower:  { what: ['Pets stay twice as long: they scratch the post, bat a toy mouse and nap in a basket bed', 'Pets stay three times as long: a hammock, a basket shelf and a hideout on top to peek out of'],
    does: ['Pets climb to the top and look around.', 'Pets scratch the post, bat the toy mouse and nap in the basket on top.', 'Pets scratch, bat the mouse, rock in the hammock, wash in the basket and peek out of the hideout.'],
    cost: [{ wood: 20, fiber: 15, shells: 4 }, { wood: 40, fiber: 30, shells: 8, coal: 4 }] },
};
export const lvMax = type => (UPGRADES[type]?.cost.length || 0) + 1; // the top level of that building
export const lvOf = item => Math.min(lvMax(item?.type), Math.max(1, item?.lv | 0 || 1));
export const topLv = (farm, type) => Math.max(0, ...farm.items.filter(i => i.type === type).map(lvOf)); // 0 when there is none
export const upCost = item => UPGRADES[item.type]?.cost[lvOf(item) - 1] || null; // what the next level costs
export const whatUp = item => { const w = UPGRADES[item.type]?.what; return Array.isArray(w) ? w[lvOf(item) - 1] : w; }; // what the next level gives
// Species with a page in the album that the player has owned (a page only seen at a friend's does not count).
export const albumHave = album => Object.values(album || {}).filter(a => Array.isArray(a) && a.some(Boolean)).length;
// Why an item cannot go up a level yet (English, the server's words), or '' when only materials stand in the way.
export function upBlock(farm, item) {
  const lv = lvOf(item), need = UPGRADES[item.type]?.need;
  if (need) { const n = need[lv - 1] || 0; return albumHave(farm.album) < n ? `Level ${lv + 1} needs ${n} kinds of pets in the album.` : ''; }
  return (farm.house || 1) < lv + 1 ? `Level ${lv + 1} needs a level ${lv + 1} farmhouse.` : '';
}
// The museum's five medallions, Leaf Ember Tide Spark Stone: how full each is in eighths (8 only when every species of
// that element is found; a hybrid counts for both of its elements). A 5-digit string, so a model can be keyed on it.
// A Lucky Wheel pet counts once it has been won, and is never needed for a full medallion.
export function museumFill(album) {
  return Object.keys(ELEMENTS).map(e => {
    const all = Object.entries(SPECIES).filter(([sp, d]) => (d.el === e || d.el2 === e) && (!d.wheel || album?.[sp]?.some?.(Boolean))), got = all.filter(([sp]) => album?.[sp]?.some?.(Boolean)).length;
    return got >= all.length ? 8 : Math.min(7, Math.floor(got / all.length * 8));
  }).join('');
}
// Helpers: one pet of the right element can work at each of these buildings. Its boost grows with its level and one of
// its stars (stat: 0 Health, 1 Attack, 2 Defence, 3 Speed). A hybrid counts for both of its elements.
export const WORK = {
  garden:  { el: 'Tide', stat: 3, job: 'waters the plots', what: n => `Berries ripen ${n}% sooner` },
  nest:    { el: 'Leaf', stat: 0, job: 'keeps the Nest cosy', what: n => `New eggs hatch ${n}% sooner` },
  yard:    { el: 'Stone', stat: 2, job: 'coaches at the yard', what: n => `Training gives ${n}% more experience` },
  gate:    { el: 'Spark', stat: 3, job: 'charges the balloon', what: n => `New parties come home ${n}% sooner` },
  kitchen: { el: 'Ember', stat: 1, job: 'tends the oven', what: n => `${n}% chance of a second treat for free` },
};
export const elsOf = p => { const d = SPECIES[p.sp]; return d?.el2 ? [d.el, d.el2] : [elOf(p)]; };
export const canWork = (p, type) => !!WORK[type] && elsOf(p).includes(WORK[type].el);
export const workPct = (p, type) => canWork(p, type) ? 5 + Math.min(p.lv, WORK_LV) + 3 * (p.stars?.[WORK[type].stat] || 3) : 0; // 9% for a level 1 with one star, 40% at level 20 with five
export const TRAIN_XP = 6; // experience an hour for each pet training at the Training Yard
export const palsOf = farm => Object.values(farm.pals || {}).reduce((n, v) => n + v, 0); // every friendship point earned
// Beds on the island: the farmhouse sleeps two pets and every Pet Hut four, plus two a level: 26 at most. Kuba kept the
// island at that size on purpose (2026-11-24): collections grow in the Pet Lodge, not on the island.
// The Pet Lodge holds LODGE_BEDS[level] more; pets there nap indoors when they have nothing to do, so they are not
// drawn walking about (p.lodge), which is why it can hold so many. Inside, the owner sorts them into collections
// (f.shelves, p.shelf). allRoom is everything together: the most pets a farm can keep.
export const petRoom = farm => 2 + farm.items.filter(i => i.type === 'hut').reduce((n, i) => n + 2 + 2 * lvOf(i), 0);
export const LODGE_BEDS = [0, 60, 150, 300], SHELF_MAX = 12, SHELF_NAME = 16;
export const GROUP_MAX = 8, GROUP_NAME = 16; // saved expedition groups
export const lodgeRoom = farm => LODGE_BEDS[topLv(farm, 'lodge')] || 0;
export const allRoom = farm => petRoom(farm) + lodgeRoom(farm);
// How many of a building a farm may hold.
export const maxOf = (farm, type) => ITEMS[type]?.max;

// The farmhouse: HOUSE_UP[n] is the cost of reaching level n.
// Levels 6 and 7 (2026-11-25, economy plan) add no beds: they are the door to the late game (far expeditions, Nest
// charms, landmarks), about 2,000 and 4,000 Workshop value and heavy on crystal, so they soak up a hoard.
export const HOUSE_MAX = 7;
export const HOUSE_UP = [null, null, { wood: 60, stone: 40, fiber: 30 }, { wood: 120, stone: 90, shells: 30 }, { wood: 200, stone: 150, shells: 40, coal: 40 },
  { wood: 300, stone: 220, shells: 50, coal: 50, crystal: 3 },
  { wood: 400, stone: 300, fiber: 150, shells: 60, coal: 60, crystal: 20 },
  { wood: 600, stone: 450, fiber: 250, shells: 90, coal: 90, crystal: 50 }];

// Nest charms: made at the Nest from crystal once the farmhouse is level CHARM_HOUSE, kept in f.charms { kind: count },
// and put into a pairing (one of each kind at most). They only change what the egg holds, nothing else.
//   el: an Element Charm lifts each parent's variant chance from 15% to 40% (50% to 70% from a parent that is a variant itself)
//   hyb: a Hybrid Charm lifts the chance of a breeding-only species from 20% to 40%
//   pat: a Pattern Charm makes sure the baby keeps at least one of its parents' markings
//   spk: a Sparkle Charm makes a sparkly baby four times as likely (needs farmhouse 7)
export const CHARM_HOUSE = 6;
export const CHARMS = {
  el:  { name: 'Element Charm', cost: { crystal: 6 }, desc: 'Variant chance up from 15% to 40%.' },
  hyb: { name: 'Hybrid Charm', cost: { crystal: 8 }, desc: 'Chance of a breeding-only pet up from 20% to 40%.' },
  pat: { name: 'Pattern Charm', cost: { crystal: 3, berries: 20 }, desc: "The baby keeps at least one of its parents' markings." },
  spk: { name: 'Sparkle Charm', house: 7, cost: { crystal: 15, sunberry: 5 }, desc: 'A sparkly baby is four times as likely.' },
};
export const charmHouse = k => CHARMS[k]?.house || CHARM_HOUSE;

// What one gift to a neighbour can be. The giver pays it from their own stock, once a day per neighbour.
export const GIFTS = { wood: 10, stone: 10, fiber: 10, shells: 5, coal: 5, crystal: 1, berries: 5, cookie: 1 };
// Coins are the player's account money (the avatar shop, other games), so they never move between players: not in gifts, not in trades.
// Stamps (island orders) stay on the farm that earned them in the same way.
export const TRADE_MATS = Object.keys(MATS).filter(k => k !== 'coins' && k !== 'stamps');
// Gardens, kitchen, barn and workshop.
export const GROW_MIN = 60, BERRIES = 3; // each Garden Plot gives 3 berries an hour
export const RECIPES = {
  cookie: { name: 'Berry Cookie', cost: { berries: 4 }, xp: 30, desc: 'Feed it to a pet for 30 experience.' },
  cake:   { name: 'Honey Cake', cost: { berries: 10, fiber: 5 }, xp: 90, desc: 'Feed it to a pet for 90 experience.' },
  juice:  { name: 'Berry Juice', cost: { berries: 6 }, heal: .4, desc: 'Drink one in a battle to get back 40% health. One a battle.' },
  pack:   { name: 'Trail Pack', house: 6, cost: { berries: 8, fiber: 10, coal: 4 }, desc: 'Food for the long way. Every far expedition takes a few.' },
  pie:    { name: 'Sunberry Pie', lv: 2, cost: { sunberry: 3, berries: 6 }, xp: 220, desc: 'Feed it to a pet for 220 experience.' },
  tonic:  { name: 'Rest Tonic', lv: 3, cost: { sunberry: 4, crystal: 1 }, rest: true, desc: 'A pet that drinks it is rested at once and can go to the Nest again.' },
};
export const STORED = ['wood', 'stone', 'fiber', 'shells', 'coal', 'berries'], CAP = { base: 300, barn: 900 }; // the most a farm can hold of each
export const capOf = f => { const lv = topLv(f, 'barn'); return lv ? CAP.barn + 600 * (lv - 1) : CAP.base; };
export const growMin = item => GROW_MIN - 15 * (lvOf(item) - 1);
// The Workshop swaps one material for another. WORTH is what one of each is worth, SWAP_LOT how many one swap hands
// you, and SWAP_KEEP the share of the value you get back at Workshop level 1, 2 and 3 (the rest is the Workshop's cut,
// so swapping back and forth always loses a little).
export const WORTH = { wood: 1, stone: 1, fiber: 1, berries: 2, shells: 3, coal: 3, crystal: 40 };
export const SWAP_LOT = { wood: 10, stone: 10, fiber: 10, berries: 5, shells: 5, coal: 5, crystal: 1 }, SWAP_KEEP = [.6, .7, .8], SWAP_MAX = 10;
// One swap of `give` for `get` at a Workshop of level lv: { pay, get } (how many go in, how many come out).
export function swapDeal(give, get, lv) {
  if (!WORTH[give] || !WORTH[get] || give === get) return null;
  const keep = SWAP_KEEP[Math.min(SWAP_KEEP.length, Math.max(1, lv | 0)) - 1], need = SWAP_LOT[get] * WORTH[get] / (WORTH[give] * keep);
  return need <= 1 ? { pay: 1, get: Math.floor(WORTH[give] * keep / WORTH[get]) } : { pay: Math.ceil(need - 1e-9), get: SWAP_LOT[get] };
}

// ---------- expeditions ----------
// A party of 1 to 3 pets flies to a zone and comes back with materials. Nothing can go wrong on a trip.
// gives: materials per pet per hour before the economy pass (tripRate scales them). house: farmhouse level that opens the zone. wild: species found there and how often.
export const ZONES = {
  woods:  { name: 'Mossy Woods', el: 'Leaf', house: 1, gives: { wood: 14, fiber: 10, stone: 5, coins: 3 }, wild: { mossbun: 5, sproutle: 5, petalpuff: 2, acornip: 2, bambear: 2, patchkit: 2, snoozloth: 1 }, blurb: 'Tall trees and soft moss.' },
  cove:   { name: 'Tidepool Cove', el: 'Tide', house: 2, gives: { shells: 8, fiber: 10, stone: 5, coins: 3 }, wild: { puddlepup: 5, bubblefin: 5, ottershell: 5, ripplet: 2, waddlet: 2, axolily: 1, fluffcoon: 1 }, blurb: 'Warm pools full of shells.' },
  ridge:  { name: 'Pebble Ridge', el: 'Stone', house: 2, gives: { stone: 16, wood: 4, crystal: .5, coins: 3 }, wild: { pebblet: 5, cragcrab: 5, rubblet: 5, siamew: 2, dustmole: 1, tricerock: 1 }, blurb: 'Rocky paths and a glint of crystal.' },
  hills:  { name: 'Ember Hills', el: 'Ember', house: 3, gives: { coal: 8, stone: 9, wood: 5, coins: 4 }, wild: { cindercub: 5, toastoad: 5, gingersnap: 5, lanternail: 2, cinnapanda: 2, munchmew: 2, flickit: 1, sizzlet: 1 }, blurb: 'Warm slopes that glow at night.' },
  meadow: { name: 'Thunder Meadow', el: 'Spark', house: 4, gives: { wood: 12, fiber: 6, crystal: 1, coins: 5 }, wild: { zapkit: 5, wattbat: 5, glidenut: 5, buzzlet: 2, oinkwatt: 2, tuxpurr: 2, voltvole: 1 }, blurb: 'Tall grass that crackles before rain.' },
  // themed islands: each is home to one set of pets
  grove:  { name: 'Fruit Grove', el: 'Leaf', theme: 'fruit', house: 2, gives: { fiber: 10, wood: 8, coins: 4 }, wild: { strawbun: 5, lemonzest: 5, chilipup: 2, melonwhale: 2, coconutkin: 2, yuzubara: 2, pinepine: 1 }, blurb: 'Orchards where the fruit looks back at you.' },
  patch:  { name: 'Veggie Patch', el: 'Leaf', theme: 'veggie', house: 2, gives: { fiber: 14, wood: 6, coins: 3 }, wild: { carrofox: 5, peapillar: 5, pumpkit: 2, shroomouse: 1 }, blurb: 'Tidy rows with something rustling in them.' },
  bakery: { name: 'Bakery Bluff', el: 'Ember', theme: 'bakery', house: 3, gives: { coal: 6, fiber: 8, coins: 5 }, wild: { croissab: 5, donuseal: 5, pretzelisk: 2, glazemew: 2, cupcowl: 1 }, blurb: 'Warm ovens and the smell of fresh bread.' },
  sweets: { name: 'Sweet Shop Isle', el: 'Spark', theme: 'sweets', house: 3, gives: { shells: 5, fiber: 8, coins: 6 }, wild: { mallowlamb: 5, jellifrog: 2, candraffe: 1 }, blurb: 'Lollipop trees and a sticky breeze.' },
  reef:   { name: 'Coral Reef', el: 'Tide', theme: 'sea', house: 3, gives: { shells: 10, stone: 4, coins: 5 }, wild: { shrimplet: 5, coralcolt: 2, driftle: 2, rocktopus: 2, zapuff: 2, skipfin: 1 }, blurb: 'A reef in the sky where the sea pets drift between the corals.' },
  peak:   { name: 'Weather Peak', el: 'Tide', theme: 'weather', house: 4, gives: { stone: 8, shells: 4, crystal: 1, coins: 5 }, wild: { dripfrog: 5, snowfox: 2, twistret: 2, sunlion: 1 }, blurb: 'Sun, snow and rain, all at once.' },
  night:  { name: 'Starfall Isle', el: 'Spark', theme: 'night', house: 4, gives: { crystal: 1.5, stone: 6, coins: 6 }, wild: { starjelly: 5, ringbear: 5, moonbun: 2, cometail: 1 }, blurb: 'An island where it is always just after dusk.' },
  // far islands (far: true): only far trips go there, and they are the only home of their pets. A new one can come each season.
  legend: { name: 'Legend Isle', el: 'Spark', theme: 'legend', far: true, house: 6, gives: { shells: 2, coal: 2, coins: 4 }, wild: { griffling: 3, bloomicorn: 3, yetiny: 3, gargoylet: 3, nessling: 2, dreampir: 2 }, blurb: 'A misty island far past the edge of the map, where the pets from old stories live.' },
};
// find: chance that a wild pet follows the party home. xp: what every pet in the party learns.
export const TRIPS = {
  stroll: { name: 'Stroll', min: 15, find: .1, xp: 8, blurb: 'While you play' },
  outing: { name: 'Outing', min: 60, find: .22, xp: 22, blurb: 'A lunch break' },
  trek:   { name: 'Trek', min: 240, find: .4, xp: 60, blurb: 'While you are busy' },
  camp:   { name: 'Camp-out', min: 480, find: .6, xp: 100, blurb: 'Overnight' },
  // Far expeditions (Kuba's economy plan, 2026-11-25): a big sink for late players. Only these go to a far island, and a
  // party pays its fuel when it sets off: crystal for the balloon and Trail Packs from the Kitchen (500 to 800 WORTH).
  voyage: { name: 'Voyage', far: true, min: 720, find: .6, xp: 160, fuel: { crystal: 8, pack: 4 }, blurb: 'Half a day away' },
  odyssey: { name: 'Grand Voyage', far: true, min: 1440, find: .9, xp: 280, fuel: { crystal: 14, pack: 6 }, blurb: 'A whole day away' },
};
// Can this trip go to this zone? Far trips go to far islands and nowhere else.
export const tripFits = (zone, trip) => !!ZONES[zone] && !!TRIPS[trip] && !ZONES[zone].far === !TRIPS[trip].far;
// A pet found on a far island may come in another element (see variantOf), which wild pets elsewhere never do.
export const FAR_VARIANT = .2;
export const PARTY = 3;
// The economy pass (Kuba, 2026-11-25: a dedicated player maxed every building in 6 days, so make it grindier): a trip
// pays TRIP_MAT of the zone's `gives` in materials, and its own TRIP_SHARE of coins and crystal. tripRate is what one
// pet brings an hour, the number the expedition panel shows. TRIP_CURVE: how much longer trips lose per hour.
export const TRIP_CURVE = .8, TRIP_MAT = .5, TRIP_SHARE = { coins: 1 / 3, crystal: .4 };
export const tripRate = (k, n) => n * (TRIP_SHARE[k] ?? TRIP_MAT);
// What a party should bring back, before luck (the server adds up to 15% either way).
// Longer trips bring less per hour, pets at home in the zone (atHome) 25% more, and each level 4% more.
export function tripLoot(zone, trip, pets) {
  const z = ZONES[zone], hours = Math.pow(TRIPS[trip].min / 60, TRIP_CURVE), out = {};
  let power = 0;
  for (const p of pets) power += (atHome(z, p.sp, elOf(p)) ? 1.25 : 1) * (1 + (Math.min(p.lv, WORK_LV) - 1) * .04);
  for (const [k, n] of Object.entries(z.gives)) out[k] = tripRate(k, n) * hours * power;
  return out;
}

export const footprint = (type, r) => { const it = ITEMS[type]; return r % 2 ? [it.h, it.w] : [it.w, it.h]; };
export const canAfford = (inv, cost) => Object.entries(cost || {}).every(([k, n]) => (inv[k] || 0) >= n);
export const costText = cost => Object.entries(cost || {}).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') || L('Free', 'Za darmo');

// Placement is checked on a grid of half tiles, so small props can share a tile.
// Returns that grid (2n x 2n). With walkable = true, items pets can cross count as free.
export function occupied(farm, { ignore = null, walkable = false } = {}) {
  const n = farm.size * 2, g = new Uint8Array(n * n);
  for (const it of farm.items) {
    if (it.id === ignore || !ITEMS[it.type] || (walkable && ITEMS[it.type].walk)) continue;
    const [w, h] = footprint(it.type, it.r), x0 = Math.round(it.x * 2), y0 = Math.round(it.y * 2);
    for (let y = y0; y < y0 + h * 2; y++) for (let x = x0; x < x0 + w * 2; x++) if (x >= 0 && y >= 0 && x < n && y < n) g[y * n + x] = 1;
  }
  return g;
}
// Whole tiles a pet cannot walk on: any tile with something solid on part of it.
export function blockedTiles(farm) {
  const n = farm.size, h = occupied(farm, { walkable: true }), g = new Uint8Array(n * n);
  for (let y = 0; y < n * 2; y++) for (let x = 0; x < n * 2; x++) if (h[y * n * 2 + x]) g[(y >> 1) * n + (x >> 1)] = 1;
  return g;
}
export const stepOf = type => ITEMS[type]?.fine ? .5 : 1;

// Would this item fit at (x, y)? ignore = id of the item being moved.
export function fits(farm, type, x, y, r, ignore = null) {
  if (!ITEMS[type] || !Number.isInteger(r) || r < 0 || r > 3) return false;
  const st = stepOf(type);
  if (![x, y].every(v => typeof v === 'number' && Number.isInteger(v / st))) return false;
  const [w, h] = footprint(type, r), n = farm.size;
  if (x < 0 || y < 0 || x + w > n || y + h > n) return false;
  const g = occupied(farm, { ignore }), n2 = n * 2;
  for (let j = y * 2; j < (y + h) * 2; j++) for (let i = x * 2; i < (x + w) * 2; i++) if (g[j * n2 + i]) return false;
  return true;
}
export const countOf = (farm, type) => farm.items.filter(i => i.type === type).length;

// ---------- weather ----------
// The same for everyone, from the clock alone; it only ever adds a small bonus. It lives in public/weather.js so the hub can show it too.
export { WEATHER, WEATHER_MS, weatherAt } from '../../weather.js';

// The page in Polish: the same tables with Polish text (the server always keeps the English).
const EL_PL = PL ? (await import('../../lang/farm-pl.js')).EL_PL : null;
/** An element's name as shown to the player. The English name stays the key everywhere. */
export const elName = e => EL_PL?.[e] || e;
if (PL) (await import('../../lang/farm-pl.js')).plData({ MATS, MAT_INFO, ITEMS, SPECIES, FAMILIES, RARITY, FORMS, UPGRADES, WORK, RECIPES, ZONES, TRIPS, CHARMS });
