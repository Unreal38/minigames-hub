// Random guest names, so a visitor can sit down without thinking one up. Two cozy words, at most 16 letters.
// Polish adjectives agree with the noun, so they come in a masculine and a feminine form.
const EN_A = ['Sleepy', 'Lucky', 'Fuzzy', 'Brave', 'Jolly', 'Sunny', 'Misty', 'Cozy', 'Quick', 'Tiny', 'Happy', 'Clever', 'Gentle', 'Merry', 'Bouncy', 'Witty', 'Mellow', 'Snowy', 'Minty', 'Plucky'];
const EN_N = ['Otter', 'Panda', 'Fox', 'Noodle', 'Dumpling', 'Badger', 'Pebble', 'Muffin', 'Hedgehog', 'Penguin', 'Owl', 'Pancake', 'Comet', 'Acorn', 'Kitten', 'Walrus', 'Bean', 'Gecko', 'Turnip', 'Seal'];
// [masculine, feminine]
const PL_A = [['Śpiący', 'Śpiąca'], ['Wesoły', 'Wesoła'], ['Puchaty', 'Puchata'], ['Dzielny', 'Dzielna'], ['Sprytny', 'Sprytna'], ['Słoneczny', 'Słoneczna'], ['Mały', 'Mała'], ['Szybki', 'Szybka'], ['Miły', 'Miła'], ['Bystry', 'Bystra'], ['Cichy', 'Cicha'], ['Śnieżny', 'Śnieżna'], ['Złoty', 'Złota'], ['Psotny', 'Psotna'], ['Senny', 'Senna'], ['Rumiany', 'Rumiana']];
const PL_N = [['Lis', 0], ['Jeż', 0], ['Pierożek', 0], ['Borsuk', 0], ['Pingwin', 0], ['Kotek', 0], ['Żołądź', 0], ['Naleśnik', 0], ['Bóbr', 0], ['Gekon', 0], ['Wydra', 1], ['Panda', 1], ['Sowa', 1], ['Kluska', 1], ['Foka', 1], ['Babeczka', 1], ['Kometa', 1], ['Rzepka', 1], ['Wiewiórka', 1], ['Żabka', 1]];
const pick = a => a[Math.random() * a.length | 0];
export function randomName(pl = false) {
  for (let i = 0; i < 20; i++) {
    const n = pl ? (([w, f]) => `${pick(PL_A)[f]} ${w}`)(pick(PL_N)) : `${pick(EN_A)} ${pick(EN_N)}`;
    if (n.length <= 16) return n;
  }
  return pl ? 'Wesoły Lis' : 'Jolly Fox';
}
