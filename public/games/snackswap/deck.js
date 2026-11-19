// Snack Swap deck: shared by the server (dealing, validation) and the browser (names, colours).
// 36 item cards in six colours, plus the built-in prompts. Only append: games in progress hold indexes.
export const KINDS = [
  { name: 'Snacks', col: '#e5604a' }, { name: 'Critters', col: '#5cb85c' }, { name: 'Stuff', col: '#4a9be0' },
  { name: 'Fancy', col: '#b98ad8' }, { name: 'Noisy', col: '#f0b429' }, { name: 'Weird', col: '#b07a52' },
];
export const ITEMS = [
  'Banana', 'Cheese Wedge', 'Birthday Cake', 'Pineapple', 'Pickle', 'Dumpling',
  'Rubber Duck', 'Goldfish', 'Garden Gnome', 'Pet Rock', 'Cactus', 'Squid',
  'Wet Sock', 'Traffic Cone', 'Toaster', 'Plunger', 'Umbrella', 'Toilet Roll',
  'Crown', 'Love Letter', 'Disco Ball', 'Candle', 'Diamond Ring', 'Balloon',
  'Trumpet', 'Whoopee Cushion', 'Alarm Clock', 'Cowbell', 'Mixtape', 'Rubber Chicken',
  'Ghost', 'Slime', 'Mystery Box', 'Tooth', 'Onion', 'Tofu',
];
export const ITEM_COUNT = ITEMS.length;
export const kindOf = i => KINDS[Math.floor(i / 6)] || KINDS[0];
export const HAND = 6;
export const MAX_PROMPTS = 30, PROMPT_LEN = 90;

export const CHAOS = {
  swap: { name: 'Swap Hands', when: 'play', text: 'Trade your whole hand with another player before you play a card.' },
  double: { name: 'Double Down', when: 'play', text: 'Your card scores double this round. Brave if it flops.' },
  steal: { name: 'Steal a Vote', when: 'vote', text: 'Pinch one vote from the most popular card this round.' },
};

export const cleanPrompt = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PROMPT_LEN);

export const PROMPTS = [
  'Worst thing to bring to a first date',
  'What is really in the mystery box under grandma\'s bed',
  'The only thing I would save from a burning house',
  'A terrible gift for your boss',
  'What I am secretly hiding in my backpack',
  'The worst thing to find in your bed',
  'My weapon of choice in a zombie apocalypse',
  'What the aliens took home as a souvenir from Earth',
  'The real reason I was late today',
  'Do not bring this to a job interview',
  'The secret ingredient in my famous soup',
  'What I would smuggle into the cinema',
  'The worst thing to hand someone who is crying',
  'My emotional support object',
  'What the dog actually ate',
  'The worst wedding present',
  'What is ticking inside the suitcase',
  'The last thing you want to see on an airplane',
  'A surprisingly good pillow',
  'What I would trade my best friend for',
  'The worst thing to drop in a quiet library',
  'What keeps me up at night',
  'The new official mascot of this friend group',
  'What I would put on a pizza to ruin it',
  'The thing I talk to when nobody is home',
  'Worst item to juggle',
  'What the tooth fairy leaves when she is broke',
  'My entire personality, in one object',
  'What you find at the bottom of the hot pot',
  'The first thing I would buy as a billionaire',
  'A bad thing to throw at a wedding',
  'What I bring to a sword fight',
  'The worst thing to step on barefoot',
  'What is living in the office fridge',
  'The best excuse for not doing homework',
  'What I would put in a time capsule to confuse the future',
  'The worst thing to win in a raffle',
  'What the babysitter found in the closet',
  'My date brought this instead of flowers',
  'The thing that will finally fix my life',
  'What I would use as an umbrella in an emergency',
  'The worst microphone for karaoke night',
  'What Santa leaves for the really naughty kids',
  'The only thing I packed for a two week holiday',
  'What the plumber pulled out of the pipe',
  'The worst thing to hide in a birthday cake',
  'My secret to staying young',
  'What I would send into space first',
  'The real treasure at the end of the rainbow',
  'What I am giving up for the new year',
  'The worst thing to wear as a hat',
  'What fell out of the piñata',
  'The thing my neighbour borrowed and never returned',
  'A terrible thing to use as a bookmark',
  'What I would defend with my life',
  'The star of my next cooking show',
  'The worst thing to bring to a potluck',
  'What the magician pulled out of the hat instead',
  'It was a quiet night, until someone brought this',
  'What I would name my first child after',
];
