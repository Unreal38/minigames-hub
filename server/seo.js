// What search engines and link previews read. public/index.html is written in Polish (the site's main language).
// Search and preview bots always get that Polish page, so Google indexes one steady version of the one address.
// People whose language guess is English get the same page with these English texts swapped in.
const BOTS = /googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|yandex|baiduspider|applebot|slurp|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|telegrambot|whatsapp|linkedinbot|skypeuripreview|redditbot|embedly|pinterest/i;
export const isBot = ua => BOTS.test(String(ua || ''));

const EN = [
  [/<title>[^<]*<\/title>/, '<title>Zatoka Gier: free online games with friends</title>'],
  [/<meta name="description" content="[^"]*">/, '<meta name="description" content="Free browser games to play with friends: cards, dice, board games, racing and a Pet Farm. Host a table, share the code and play. Nothing to install, no ads.">'],
  [/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="Zatoka Gier: free online games with friends">'],
  [/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="Cards, dice, board games, racing and a Pet Farm. Host a table, share the code and play in your browser.">'],
  [/<meta property="og:image:alt" content="[^"]*">/, '<meta property="og:image:alt" content="Zatoka Gier: a floating island with a lighthouse, a pawn and a die">'],
  [/<meta property="og:locale" content="[^"]*">\s*<meta property="og:locale:alternate" content="[^"]*">/, '<meta property="og:locale" content="en_GB">\n<meta property="og:locale:alternate" content="pl_PL">'],
  [/<!--seo-->[\s\S]*?<!--\/seo-->/, `<!--seo--><main class="wrap seo-intro">
<h1>Zatoka Gier</h1>
<p>Free browser games to play with friends. Host a table, send your friends the code and play together. Nothing to install, no ads.</p>
<p>Tables are public by default: the Open tables list on the home page shows live every game you can join or watch, no code needed. A code or invite link is only for private tables with friends. Bots take any empty seats, so you can play at any time, even alone. The site also has a shared chat and shows how many people are online right now.</p>
<p>Zatoka has 20+ multiplayer games and 5 daily games, and the whole site works in Polish and English.</p>
<p>Cards: Hot Pot, Texas Hold'em, Tysiąc, Pan, Piotruś. Dice and board games: Liar's Dice, Pip Party, Ludo, Snakes &amp; Ladders, Pawperty, Tic-Tac-Toe, Mahjong Race. Action: Kart Island Race, Marble Rush, Mini Golf Party, Sky Darts, Tower Stack, Sky Bricks, Beanstalk Bounce, Cozy Kitchen Rush, Treasure Dig. Every day: Pet Farm, Pet Pop, Pet Mahjong, Hay Hunch and Mystery Pet.</p>
<h2>Progress that stays</h2>
<p>You can play straight away, without signing up. A free account (just a name and a password) keeps everything for good and works on any device, along with your friends list.</p>
<ul>
<li>Levels and ranks: every game gives XP, and ranks climb from Seedling to Sky Legend and beyond, with endless stars.</li>
<li>Coins: every game pays by finishing place. Spend them in the Wardrobe on clothes, hats, accessories, frames and player card backgrounds. New items arrive in the shop every season.</li>
<li>Rankings: leaderboards for every game plus an overall ranking. Only matches between people count.</li>
<li>Player card: your avatar, rank, favourite games and your own isle with pets that others can see.</li>
<li>Pet Farm: raise and breed 70+ species with inherited traits and elements, grow your farm, fight turn-based 3v3 battles, visit friends' farms and fill your album.</li>
<li>Every day: a new Mystery Pet puzzle, plus levels and best scores in Pet Pop, Pet Mahjong and Hay Hunch.</li>
</ul>
</main><!--/seo-->`],
];
// lang is 'pl' or 'en'; <html lang> and data-geo carry it to the page (i18n.js reads data-geo on a first visit).
export function pageFor(html, lang) {
  let out = html.replace(/<html lang="[a-z]+"/, `<html lang="${lang}" data-geo="${lang}"`);
  if (lang === 'en') for (const [from, to] of EN) out = out.replace(from, to);
  return out;
}
