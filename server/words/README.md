# Word lists for Word in a Bottle (server/word.js)

- `pl-valid.txt`: every five-letter word a Polish guess may be. From the SJP.PL game dictionary
  (https://sjp.pl/sl/growy/, version 2026-11-01), used under Creative Commons Attribution 4.0.
- `pl-answers.txt`: the words that can be the word of the day. Common base forms picked from SJP.PL with the help
  of word counts from the FrequencyWords project (https://github.com/hermitdave/FrequencyWords, CC BY-SA 4.0),
  then cleaned by hand (no names, no rude words).
- `en-valid.txt`: five-letter words from the ENABLE word list (public domain).
- `en-answers.txt`: common words from ENABLE, ranked with FrequencyWords and cleaned by hand.

To drop a word from the daily answers, delete its line and restart the server. To add one, add a line; it must also
be in the matching `-valid.txt` file. One word per line, lower case.

## Word Reef (server/games/reef.js, server/reefdict.js)

- `reef-pl.br`: every word of 2 to 15 letters from the SJP.PL game dictionary (version 2026-11-01, CC BY 4.0), about
  3.2 million forms. `reef-en.br`: ENABLE, about 169,000 words. Both sorted, front coded and brotli packed.
- `reef-pl-bot.txt`, `reef-en-bot.txt`: the everyday words the bots know, most common first (FrequencyWords lists,
  CC BY-SA 4.0, only words that are in the dictionary). Easy bots know the first 5,000, normal 16,000, hard all of
  them plus every word of up to 3 letters.
- Rebuild all four with `node server/words/build-reef.js <slowa.txt> <enable1.txt> <pl_50k.txt> <en_50k.txt>`
  (a new SJP.PL version comes out every month). A word that should not be a bot word can be deleted from the bot
  list by hand.
