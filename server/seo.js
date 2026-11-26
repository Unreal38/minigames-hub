// What search engines and link previews read. public/index.html is written in Polish (the site's main language).
// Search and preview bots always get that Polish page, so Google indexes one steady version of the one address.
// People whose language guess is English get the same page with these English texts swapped in.
import { gamesHtml, gamesLd } from './gamelist.js';
import './gamepages.js'; // sets the game page addresses the list links to

const BOTS = /googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|yandex|baiduspider|applebot|slurp|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|telegrambot|whatsapp|linkedinbot|skypeuripreview|redditbot|embedly|pinterest/i;
export const isBot = ua => BOTS.test(String(ua || ''));

const EN = [
  [/<title>[^<]*<\/title>/, '<title>Zatoka Gier: free online games with friends</title>'],
  [/<meta name="description" content="[^"]*">/, '<meta name="description" content="Free browser games with friends: cards, board games, chess, draughts, party games and a Pet Farm. Join an open table or host your own. Nothing to install, no ads.">'],
  [/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Zatoka Gier: free online games with friends">'],
  [/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Cards, board games, racing, hidden-role party games, hide and seek, a dress-up show and a Pet Farm. Play together in your browser.">'],
  [/<meta property="og:image:alt" content="[^"]*">/, '<meta property="og:image:alt" content="Zatoka Gier: a floating island with a lighthouse, a pawn and a die">'],
  [/<meta property="og:locale" content="[^"]*">\s*<meta property="og:locale:alternate" content="[^"]*">/, '<meta property="og:locale" content="en_GB">\n<meta property="og:locale:alternate" content="pl_PL">'],
  [/<!--seo-->[\s\S]*?<!--\/seo-->/, `<!--seo--><main class="wrap seo-intro">
<h1>Zatoka Gier</h1>
<p>Free browser games to play with friends. Host a table, send your friends the code and play together. Nothing to install, no ads.</p>
<p>Tables are public by default: the Open tables list on the home page shows live every game you can join or watch, no code needed. A code or invite link is only for private tables with friends. Bots take any empty seats, so you can play at any time, even alone. The site also has a shared chat and shows how many people are online right now.</p>
<p>Can\'t decide what to play? The Game wheel on the home page picks a game from the ones you tick, for example only games that fit your group or short ones. Save your favourite wheels and spin as often as you like, for free.</p>
<!--games--><!--/games-->
<h2>Progress that stays</h2>
<p>You can play straight away, without signing up. A free account (just a name and a password) keeps everything for good and works on any device, along with your friends list.</p>
<ul>
<li>Levels and ranks: every game gives XP, and ranks climb from Seedling to Sky Legend and beyond, with endless stars.</li>
<li>Coins: every game pays by finishing place. Spend them in the Wardrobe on clothes, hats, accessories, frames and player card backgrounds. Save your favourite looks as outfits and put one on in a click. New items arrive in the shop every season.</li>
<li>Rankings: leaderboards for every game plus an overall ranking. Only matches between people count.</li>
<li>Player card: your avatar, rank, favourite games and your own isle with pets that others can see.</li>
<li>Pet Farm: raise and breed 70+ species with inherited traits and elements, grow your farm, fight turn-based 3v3 battles, visit friends' farms and fill your album. The Farm Journal leads you through chapters of tasks, far expeditions to Legend Isle bring back rare pets, orders at the Order Board pay Stamps for new decorations, and the Pet Museum grows with your collection.</li>
<li>Safe to play: anyone can be reported from their player card, and moderators warn, mute and ban people who spoil the fun.</li>
<li>Every day: a new Mystery Pet puzzle, plus levels and best scores in Pet Pop, Pet Mahjong and Hay Hunch.</li>
</ul>
</main><!--/seo-->`],
];
// lang is 'pl' or 'en'; <html lang> and data-geo carry it to the page (i18n.js reads data-geo on a first visit).
// enHome: the page is /en, the English twin of / (its own canonical address); both list each other through hreflang.
const HREFLANG = '<link rel="alternate" hreflang="pl" href="https://zatokagier.com/">\n<link rel="alternate" hreflang="en" href="https://zatokagier.com/en">\n<link rel="alternate" hreflang="x-default" href="https://zatokagier.com/">';
export function pageFor(html, lang, enHome = false) {
  let out = html.replace(/<html lang="[a-z]+"/, `<html lang="${lang}" data-geo="${lang}"`);
  if (lang === 'en') for (const [from, to] of EN) out = out.replace(from, to);
  out = out.replace(/(<link rel="canonical" href="[^"]*">)/, `$1\n${HREFLANG}`);
  if (enHome) out = out.replace('<link rel="canonical" href="https://zatokagier.com/">', '<link rel="canonical" href="https://zatokagier.com/en">')
    .replace('<meta property="og:url" content="https://zatokagier.com/">', '<meta property="og:url" content="https://zatokagier.com/en">')
    .replace('"@id":"https://zatokagier.com/#page","url":"https://zatokagier.com/"', '"@id":"https://zatokagier.com/en#page","url":"https://zatokagier.com/en"')
    .replace(/("@id":"https:\/\/zatokagier\.com\/en#page"[^\n]*"inLanguage":)"pl"/, '$1"en"');
  // Every game with its description, players and playtime, read from the hub's registry (server/gamelist.js).
  if (out.includes('<!--games-->')) try {
    out = out.replace(/<!--games-->[\s\S]*?<!--\/games-->/, () => `<!--games-->${gamesHtml(lang)}<!--/games-->`)
      .replace('</head>', () => `<script type="application/ld+json">${gamesLd(lang)}</script>\n</head>`);
  } catch (e) { console.error('seo game list', e); }
  return out;
}
