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
