// Pet Farm: everything the server and the client must agree on. Balance changes are edits to this file.
// A farm is a square grid of tiles. An item sits at tile (x, y) with a rotation r (0-3, quarter turns).

export const SIZES = [10, 12, 14, 16, 18];
// Cost of growing the land to SIZES[i].
export const EXPAND = [null, { wood: 40, stone: 30 }, { wood: 80, stone: 60, fiber: 30 }, { wood: 140, stone: 110, fiber: 60 }, { wood: 220, stone: 180, fiber: 100 }];
export const MATS = { wood: 'Wood', stone: 'Stone', fiber: 'Fiber', shells: 'Shells', coal: 'Coal', crystal: 'Crystal', berries: 'Berries', sunberry: 'Sunberries', cookie: 'Berry Cookies', cake: 'Honey Cakes', juice: 'Berry Juice', pie: 'Sunberry Pies', tonic: 'Rest Tonics', coins: 'Coins' };
// What each thing in the top bar is: where it comes from, and what it is for.
export const MAT_INFO = {
  wood:     ['Expeditions, most of all Mossy Woods.', 'Most buildings and decorations.'],
  stone:    ['Expeditions, most of all Pebble Ridge.', 'Buildings, paths and stone decorations.'],
  fiber:    ['Expeditions to Mossy Woods and Tidepool Cove.', 'Huts, the Nest, soft decorations and Honey Cakes.'],
  shells:   ['Expeditions to Tidepool Cove (farmhouse level 2).', 'Improving buildings and fancy decorations.'],
  coal:     ['Expeditions to Ember Hills (farmhouse level 3).', 'Higher building levels and fancy decorations.'],
  crystal:  ['Rare. Expeditions to Pebble Ridge (farmhouse level 2) and Thunder Meadow (level 4). Longer trips with more pets find more.', 'The Nest, top building levels and the fanciest decorations.'],
  berries:  ['Garden Plots grow them every hour. Tap "Pick berries".', 'Cooking treats in the Kitchen. Spare ones sell at the Workshop.'],
  sunberry: ['Garden Plots of level 2 or 3 grow them with each harvest.', 'The best Kitchen recipes: Sunberry Pie and Rest Tonic.'],
  cookie:   ['Cooked in the Kitchen from 4 berries.', 'Tap a pet and feed it one for 30 experience.'],
  cake:     ['Cooked in the Kitchen from 10 berries and 5 fiber.', 'Tap a pet and feed it one for 90 experience.'],
  juice:    ['Cooked in the Kitchen from 6 berries.', 'Drink one in a practice or arena battle to heal 40%, once a battle.'],
  pie:      ['Cooked in a level 2 Kitchen.', 'Tap a pet and feed it one for 220 experience.'],
  tonic:    ['Cooked in a level 3 Kitchen.', 'Give it to a resting pet so it can go to the Nest again at once.'],
  coins:    ['Battles, helping neighbours, selling materials at the Workshop, and the other games on the site.', 'Trees and bushes here, trades with friends, and the avatar shop on the main page.'],
};
export const START_INV = { wood: 150, stone: 100, fiber: 80, coins: 100 };
export const MAX_ITEMS = 300;

// kind: 'b' building, 'd' decoration. w x h is the footprint before rotation. max = how many a farm may hold.
// fine: a small prop that snaps to half tiles (its w and h may be .5). Everything else sits on whole tiles.
// walk: pets can stroll across it. craft: a decoration that needs a Workshop of that level on the farm.
export const ITEMS = {
  house:    { name: 'Farmhouse', kind: 'b', w: 3, h: 3, max: 1, fixed: true, cost: {}, desc: 'Home sweet home. A bigger farmhouse opens up new places to explore.' },
  hut:      { name: 'Pet Hut', kind: 'b', w: 2, h: 2, max: 3, cost: { wood: 30, fiber: 10 }, desc: 'A snug place for four more pets to sleep.' },
  gate:     { name: 'Expedition Gate', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 25, stone: 15 }, desc: 'Pets set off by balloon from here and come back with materials, and sometimes a new friend.' },
  garden:   { name: 'Garden Plot', kind: 'b', w: 1, h: 1, max: 8, cost: { wood: 5, fiber: 5 }, desc: 'A patch of soil. Berries ripen here every hour.' },
  kitchen:  { name: 'Kitchen', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 30, stone: 20 }, desc: 'Turns berries into treats for your pets.' },
  barn:     { name: 'Storage Barn', kind: 'b', w: 2, h: 3, max: 1, cost: { wood: 45, stone: 10 }, desc: 'Room for three times as many materials.' },
  nest:     { name: 'Nest', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 20, fiber: 30, crystal: 2 }, desc: 'Two pets rest here and an egg appears.' },
  yard:     { name: 'Training Yard', kind: 'b', w: 3, h: 2, max: 1, cost: { wood: 25, stone: 25 }, desc: 'Pets practise their moves here against friendly partners.' },
  flag:     { name: 'Arena Flag', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 10, fiber: 10 }, desc: 'Challenge other farms here, and choose the team that defends yours.' },
  mailbox:  { name: 'Mailbox', kind: 'b', w: 1, h: 1, max: 1, cost: { wood: 8 }, desc: 'Gifts and letters from friends land here.' },
  workshop: { name: 'Workshop', kind: 'b', w: 2, h: 2, max: 1, cost: { wood: 35, stone: 25 }, desc: 'Unlocks fancier decorations, and buys your spare materials for coins.' },

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
  wattbat:   { name: 'Wattbat', el: 'Spark', rare: 1, blurb: 'A fluffy bat with lightning bolts for ears.' },
  pebblet:   { name: 'Pebblet', el: 'Stone', rare: 0, blurb: 'A hedgehog with pebbles for spines.' },
  cragcrab:  { name: 'Cragcrab', el: 'Stone', rare: 1, blurb: 'A crab that carries a boulder for a shell.' },
  dustmole:  { name: 'Dustmole', el: 'Stone', rare: 2, blurb: 'A mole that never takes off its tiny hard hat.' },
  rubblet:   { name: 'Rubblet', el: 'Stone', rare: 1, blurb: 'A boulder that stacks itself into a gentle little golem.' },
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
  munchmew:  { name: 'Munchmew', el: 'Ember', rare: 1, blurb: 'A munchkin cat with tiny legs and pink icing, named after the little donut.' },
  rocktopus: { name: 'Rocktopus', el: 'Stone', rare: 1, blurb: 'An octopus that hides among the rocks and stacks pebbles on its head.' },
  driftle:   { name: 'Driftle', el: 'Tide', rare: 1, blurb: 'A sea turtle that glides through the air with a starfish on its shell.' },
  zapuff:    { name: 'Zapuff', el: 'Spark', rare: 1, blurb: 'A pufferfish that floats like a balloon and crackles when it puffs up.' },
  ottershell: { name: 'Ottershell', el: 'Tide', rare: 0, blurb: 'An otter that never lets go of its favourite seashell.' },
  cinnapanda: { name: 'Cinnapanda', el: 'Ember', rare: 1, blurb: 'A red panda the colour of cinnamon with a long ringed tail.' },
  yuzubara:  { name: 'Yuzubara', el: 'Leaf', rare: 1, blurb: 'A calm capybara that balances a yuzu on its head.' },
  snoozloth: { name: 'Snoozloth', el: 'Leaf', rare: 2, blurb: 'A sloth that wears a nightcap all day, just in case.' },
  glidenut:  { name: 'Glidenut', el: 'Spark', rare: 1, blurb: 'A flying squirrel with huge eyes that glides on its own little flaps.' },
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
  // breeding only: two elements, never found in the wild. hint is all the Pet Album gives away.
  truffowl:   { name: 'Truffowl', el: 'Leaf', el2: 'Tide', rare: 3, blurb: 'A round owl that grows its own mushroom cap.', hint: 'Hatches where moss meets the tide.' },
  magmutt:    { name: 'Magmutt', el: 'Ember', el2: 'Stone', rare: 3, blurb: 'A lava puppy in a coat of cracked rock.', hint: 'Hatches where fire warms the stone.' },
  nimbowhale: { name: 'Nimbowhale', el: 'Tide', el2: 'Spark', rare: 3, blurb: 'A tiny whale that carries its own rain cloud.', hint: 'Hatches where rain meets lightning.' },
  glimmoth:   { name: 'Glimmoth', el: 'Spark', el2: 'Leaf', rare: 3, blurb: 'A moth whose wings glow after dark.', hint: 'Hatches where a spark lands on a leaf.' },
  geodeer:    { name: 'Geodeer', el: 'Stone', el2: 'Tide', rare: 3, blurb: 'A fawn with antlers of clear crystal.', hint: 'Hatches where water wears the stone.' },
};
export const RARITY = ['Common', 'Uncommon', 'Rare', 'Breeding only'];
export const STARTERS = ['mossbun', 'cindercub', 'puddlepup'];
export const FORMS = ['Baby', 'Young', 'Adult'];
export const formOf = lv => lv < 5 ? 0 : lv < 12 ? 1 : 2;
export const MAX_LV = 20;
export const xpFor = lv => 10 + lv * 10; // experience needed to go from lv to lv + 1
// The farmhouse sleeps two pets and every Pet Hut four more.
// Building levels. Each building starts at level 1 and can be improved twice; level n needs a farmhouse of level n.
export const UP_MAX = 3;
export const UPGRADES = {
  hut:    { what: 'Two more beds', cost: [{ wood: 40, fiber: 20 }, { wood: 80, fiber: 40, shells: 10 }] },
  gate:   { what: 'One more party can be out exploring', cost: [{ wood: 40, stone: 30, shells: 8 }, { wood: 80, stone: 60, coal: 12 }] },
  kitchen:  { what: ['A new recipe: Sunberry Pie', 'A new recipe: Rest Tonic'], cost: [{ wood: 40, stone: 30, shells: 6 }, { wood: 80, stone: 60, coal: 12 }] },
  workshop: { what: ['A second set of decorations', 'The grandest decorations'], cost: [{ wood: 50, stone: 40, shells: 8 }, { wood: 100, stone: 80, coal: 15, crystal: 1 }] },
  garden: { what: ['Ripens 15 minutes sooner, and grows a Sunberry each time', 'Ripens 15 minutes sooner again, and grows two Sunberries'], cost: [{ wood: 10, fiber: 15 }, { wood: 20, fiber: 30, shells: 4 }] },
  barn:   { what: 'Room for 600 more of each material', cost: [{ wood: 60, stone: 30 }, { wood: 120, stone: 60, coal: 10 }] },
  nest:   { what: ['A second egg slot', 'Eggs hatch a quarter sooner'], cost: [{ fiber: 40, shells: 10 }, { fiber: 80, coal: 10, crystal: 2 }] },
  yard:   { what: 'One more training spot', cost: [{ wood: 40, stone: 40 }, { wood: 80, stone: 80, coal: 10 }] },
};
export const lvOf = item => Math.min(UP_MAX, Math.max(1, item?.lv | 0 || 1));
export const topLv = (farm, type) => Math.max(0, ...farm.items.filter(i => i.type === type).map(lvOf)); // 0 when there is none
export const upCost = item => UPGRADES[item.type]?.cost[lvOf(item) - 1] || null; // what the next level costs
export const whatUp = item => { const w = UPGRADES[item.type]?.what; return Array.isArray(w) ? w[lvOf(item) - 1] : w; }; // what the next level gives
export const TRAIN_XP = 6; // experience an hour for each pet training at the Training Yard
export const palsOf = farm => Object.values(farm.pals || {}).reduce((n, v) => n + v, 0); // every friendship point earned
export const petRoom = farm => 2 + farm.items.filter(i => i.type === 'hut').reduce((n, i) => n + 2 + 2 * lvOf(i), 0);

// The farmhouse: HOUSE_UP[n] is the cost of reaching level n.
export const HOUSE_MAX = 4;
export const HOUSE_UP = [null, null, { wood: 60, stone: 40, fiber: 30 }, { wood: 120, stone: 90, shells: 30 }, { wood: 200, stone: 150, shells: 40, coal: 40 }];

// What one gift to a neighbour can be. The giver pays it from their own stock, once a day per neighbour.
export const GIFTS = { wood: 10, stone: 10, fiber: 10, shells: 5, coal: 5, crystal: 1, berries: 5, cookie: 1, coins: 10 };
// Gardens, kitchen, barn and workshop.
export const GROW_MIN = 60, BERRIES = 3; // each Garden Plot gives 3 berries an hour
export const RECIPES = {
  cookie: { name: 'Berry Cookie', cost: { berries: 4 }, xp: 30, desc: 'Feed it to a pet for 30 experience.' },
  cake:   { name: 'Honey Cake', cost: { berries: 10, fiber: 5 }, xp: 90, desc: 'Feed it to a pet for 90 experience.' },
  juice:  { name: 'Berry Juice', cost: { berries: 6 }, heal: .4, desc: 'Drink one in a battle to get back 40% health. One a battle.' },
  pie:    { name: 'Sunberry Pie', lv: 2, cost: { sunberry: 3, berries: 6 }, xp: 220, desc: 'Feed it to a pet for 220 experience.' },
  tonic:  { name: 'Rest Tonic', lv: 3, cost: { sunberry: 4, crystal: 1 }, rest: true, desc: 'A pet that drinks it is rested at once and can go to the Nest again.' },
};
export const STORED = ['wood', 'stone', 'fiber', 'shells', 'coal', 'berries'], CAP = { base: 300, barn: 900 }; // the most a farm can hold of each
export const capOf = f => { const lv = topLv(f, 'barn'); return lv ? CAP.barn + 600 * (lv - 1) : CAP.base; };
export const growMin = item => GROW_MIN - 15 * (lvOf(item) - 1);
export const SELL = { wood: 4, stone: 4, fiber: 4, shells: 12, coal: 12, berries: 8 }, SELL_LOT = 10; // coins the Workshop pays for a lot of ten

// ---------- expeditions ----------
// A party of 1 to 3 pets flies to a zone and comes back with materials. Nothing can go wrong on a trip.
// gives: materials per pet per hour. house: farmhouse level that opens the zone. wild: species found there and how often.
export const ZONES = {
  woods:  { name: 'Mossy Woods', el: 'Leaf', house: 1, gives: { wood: 14, fiber: 10, stone: 5, coins: 3 }, wild: { mossbun: 5, sproutle: 5, petalpuff: 2, acornip: 2, bambear: 2, patchkit: 2, snoozloth: 1 }, blurb: 'Tall trees and soft moss.' },
  cove:   { name: 'Tidepool Cove', el: 'Tide', house: 2, gives: { shells: 8, fiber: 10, stone: 5, coins: 3 }, wild: { puddlepup: 5, bubblefin: 5, shrimplet: 5, ripplet: 2, waddlet: 2, coralcolt: 2, driftle: 2, axolily: 1, skipfin: 1 }, blurb: 'Warm pools full of shells.' },
  ridge:  { name: 'Pebble Ridge', el: 'Stone', house: 2, gives: { stone: 16, wood: 4, crystal: .5, coins: 3 }, wild: { pebblet: 5, cragcrab: 2, rubblet: 2, siamew: 2, rocktopus: 2, dustmole: 1, tricerock: 1 }, blurb: 'Rocky paths and a glint of crystal.' },
  hills:  { name: 'Ember Hills', el: 'Ember', house: 3, gives: { coal: 8, stone: 9, wood: 5, coins: 4 }, wild: { cindercub: 5, toastoad: 5, gingersnap: 5, lanternail: 2, cinnapanda: 2, flickit: 1, sizzlet: 1 }, blurb: 'Warm slopes that glow at night.' },
  meadow: { name: 'Thunder Meadow', el: 'Spark', house: 4, gives: { wood: 12, fiber: 6, crystal: 1, coins: 5 }, wild: { zapkit: 5, buzzlet: 2, wattbat: 2, oinkwatt: 2, zapuff: 2, glidenut: 2, voltvole: 1 }, blurb: 'Tall grass that crackles before rain.' },
  // themed islands: each is home to one set of pets
  grove:  { name: 'Fruit Grove', el: 'Leaf', theme: 'fruit', house: 2, gives: { fiber: 10, wood: 8, coins: 4 }, wild: { strawbun: 5, lemonzest: 5, chilipup: 2, melonwhale: 2, coconutkin: 2, yuzubara: 2, pinepine: 1 }, blurb: 'Orchards where the fruit looks back at you.' },
  patch:  { name: 'Veggie Patch', el: 'Leaf', theme: 'veggie', house: 2, gives: { fiber: 14, wood: 6, coins: 3 }, wild: { carrofox: 5, peapillar: 5, pumpkit: 2, shroomouse: 1 }, blurb: 'Tidy rows with something rustling in them.' },
  bakery: { name: 'Bakery Bluff', el: 'Ember', theme: 'bakery', house: 3, gives: { coal: 6, fiber: 8, coins: 5 }, wild: { croissab: 5, donuseal: 5, pretzelisk: 2, cupcowl: 1 }, blurb: 'Warm ovens and the smell of fresh bread.' },
  sweets: { name: 'Sweet Shop Isle', el: 'Spark', theme: 'sweets', house: 3, gives: { shells: 5, fiber: 8, coins: 6 }, wild: { mallowlamb: 5, jellifrog: 2, munchmew: 2, candraffe: 1 }, blurb: 'Lollipop trees and a sticky breeze.' },
  peak:   { name: 'Weather Peak', el: 'Tide', theme: 'weather', house: 4, gives: { stone: 8, shells: 4, crystal: 1, coins: 5 }, wild: { dripfrog: 5, ottershell: 5, snowfox: 2, twistret: 2, sunlion: 1, fluffcoon: 1 }, blurb: 'Sun, snow and rain, all at once.' },
  night:  { name: 'Starfall Isle', el: 'Spark', theme: 'night', house: 4, gives: { crystal: 1.5, stone: 6, coins: 6 }, wild: { starjelly: 5, ringbear: 5, moonbun: 2, tuxpurr: 2, cometail: 1 }, blurb: 'An island where it is always just after dusk.' },
};
// find: chance that a wild pet follows the party home. xp: what every pet in the party learns.
export const TRIPS = {
  stroll: { name: 'Stroll', min: 15, find: .1, xp: 8, blurb: 'While you play' },
  outing: { name: 'Outing', min: 60, find: .22, xp: 22, blurb: 'A lunch break' },
  trek:   { name: 'Trek', min: 240, find: .4, xp: 60, blurb: 'While you are busy' },
  camp:   { name: 'Camp-out', min: 480, find: .6, xp: 100, blurb: 'Overnight' },
};
export const PARTY = 3;
// What a party should bring back, before luck (the server adds up to 15% either way).
// Longer trips bring a little less per hour, pets of the zone's element 25% more, and each level 4% more.
export function tripLoot(zone, trip, pets) {
  const z = ZONES[zone], hours = Math.pow(TRIPS[trip].min / 60, .9), out = {};
  let power = 0;
  for (const p of pets) power += (SPECIES[p.sp]?.el === z.el ? 1.25 : 1) * (1 + (p.lv - 1) * .04);
  for (const [k, n] of Object.entries(z.gives)) out[k] = n * hours * power;
  return out;
}

export const footprint = (type, r) => { const it = ITEMS[type]; return r % 2 ? [it.h, it.w] : [it.w, it.h]; };
export const canAfford = (inv, cost) => Object.entries(cost || {}).every(([k, n]) => (inv[k] || 0) >= n);
export const costText = cost => Object.entries(cost || {}).map(([k, n]) => `${n} ${MATS[k].toLowerCase()}`).join(', ') || 'Free';

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
// The same for everyone: it is worked out from the clock alone, in 40 minute spells. A rainbow follows rain.
// Weather never takes anything away. Each kind gives one small bonus while it lasts.
export const WEATHER = {
  sunny:   { name: 'Sunny', bonus: 'Parties that set off now bring home 20% more.' },
  cloudy:  { name: 'Cloudy', bonus: 'Cool air: battles give 25% more experience.' },
  rain:    { name: 'Rain', bonus: 'Each garden plot you pick gives one extra berry.' },
  wind:    { name: 'Windy', bonus: 'A tailwind: parties that set off now are back 20% sooner.' },
  rainbow: { name: 'Rainbow', bonus: 'Lucky: parties that set off now are far more likely to meet a wild pet.' },
};
export const WEATHER_MS = 40 * 60_000;
const wHash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const wRaw = n => { const r = wHash(n); return r < .42 ? 'sunny' : r < .62 ? 'cloudy' : r < .8 ? 'rain' : 'wind'; };
export function weatherAt(ms = Date.now()) {
  const n = Math.floor(ms / WEATHER_MS), raw = wRaw(n), kind = raw !== 'rain' && wRaw(n - 1) === 'rain' ? 'rainbow' : raw;
  return { kind, left: (n + 1) * WEATHER_MS - ms, ...WEATHER[kind] };
}
