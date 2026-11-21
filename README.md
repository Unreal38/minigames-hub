# Cozy Table: minigames for friends

A small self-hosted website where friends pick a username (accounts are optional), open or join a table with a 4-letter code, and play tiny multiplayer games. Empty seats are filled by bots.

**Game #1: Hot Pot**, a fan-made take on the Palia Hotpot card minigame. It has cute SVG food cards, a 3D table (three.js) with a bubbling split-broth pot, sound effects, emotes and a results screen.

**Game #2: Marble Rush**, a 3D marble race nobody steers. The marbles are plain colours that belong to nobody: every player bets their coins on a colour and watches a randomly generated track (pins, spinners, trapdoors, boost pads) do the rest. It has chaos events, one banana per heat to slip up a rival, and a knockout mode that drops the slowest marble each heat.

**Game #3: Texas Hold'em**, cozy no-limit poker for pretend chips at a 3D table with everyone's avatars. Bots fill empty seats, blinds creep up, and the biggest stack after the last hand wins.

**Game #4: Ludo**, the classic race round the board in chunky low-poly 3D, with everyone's avatar sitting in their own corner. Bots fill empty corners, and landing on a rival sends their pawn back to the yard.

**Game #5: Tower Stack**, one shared wobbly tower on a sky island. Take turns dropping a swinging block: stack it straight for points, and don't be the one who knocks it over. Rules live in `public/games/stack/rules.js`.

**Game #6: Mini Golf Party**, nine blocky 3D holes on sky islands that everyone plays together, taking turns with their own ball. Drag back and let go to putt past windmills, bumper posts, ramps, sand and water. Before each hole you can bet coins on who will take it. Courses are random by default: `server/games/golfgen.js` stacks a tee, a few obstacle sections and a green into a new hole, and the server only keeps holes its bots can finish. The nine hand-made holes are the Classic course. The holes and the ball physics are shared by the server and the client in `public/games/golf/course.js` (a hole is a small text map, so adding one is a few lines).

**Game #7: Liar's Dice**, the bluffing game at a round 3D table on a sky island. Everyone rolls in secret under a cup in their colour, bids go round on how many dice of one face there are in total, and calling "Liar!" lifts every cup. The server never sends a player anyone else's dice until the cups lift. Rules and odds shared by server and client live in `public/games/dice/rules.js`; bot personalities are the `BOTS` table in `server/games/dice.js`.

**Game #8: Pawperty**, a cozy pet-shop property game on a 3D ring board. Walk your avatar round a 40-tile board with eight streets of shops (one per Pet Farm island), adopt the pet waiting in each box and collect rent in treats. Pets nap on the job (no rent while asleep), Zoomies cards cause chaos, Bath Time stands in for jail, and nobody is knocked out: the richest player after 10, 20 or 30 rounds wins. The board, prices, cards and timings shared by server and client live in `public/games/paw/board.js`; rules and bots are in `server/games/paw.js`.

**Game #9: Kart Island Race**, short low-poly kart races on roads that hop between floating islands, with everyone's avatar at the wheel. Drift for boosts, hit the boost pads, grab gift boxes for silly power-ups (banana peels, a homing jelly, a chili boost, a bubble shield and a sleepy cloud) and try not to drive off the edge. It is the hub's first real-time game: each browser drives its own kart with the physics in `public/games/kart/track.js` and reports its position; `server/games/kart.js` checks the reports, counts laps, drives the bots, owns the power-ups and streams the race twenty times a second through the `fast()` game hook in `server/server.js`. Tracks are a list of points in `TRACKS` in track.js.

**Game #10: Cozy Kitchen Rush**, a co-op cooking game in a little open-air kitchen on a sky island. Everyone walks their avatar round the counters in real time: take ingredients from the crates, chop them on the boards, cook soups in the pots and patties in the pans, build salads and burgers on plates and hand them in at the serving window before the order tickets run out. The kitchen earns tips and up to three stars together; each dish's tip is shared by everyone who touched it, and coins go by those shares. Two kitchens: Sunny Diner and Pass-Through (the stoves are across a counter, so you pass things over). Kitchens, recipes, timings, movement and reach are shared by the server and the client in `public/games/kitchen/rules.js`; bots (they each take an order and cook it start to finish) are in `server/games/kitchen.js`.

**Game #11: Treasure Dig**, multiplayer Minesweeper on a grass field on a sky island. Take turns digging one tile: empty tiles show how many traps touch them and sparkle when a gem is buried next door, gems and the golden chest let you dig again, and traps cost points. Most points when the last gem is found wins. Board sizes, points and timings live in `public/games/dig/rules.js`; rules and the bots (which only use what players can see) are in `server/games/dig.js`.

**Game #12: Pan**, the Polish shedding card game with the 24 cards from nine to ace, at a round 3D table on a sky island. The nine of hearts starts; play the same or higher, put down four of a kind at once, or pick up the top three. The last one still holding cards is the Pan. The server never sends a player anyone else's hand. Rules shared by server and client live in `public/games/pan/rules.js`; bot habits are the `BOTS` table in `server/games/pan.js` (the bots pick up on purpose now and then, which is what lets a game finish).

**Coins and the avatar shop.** Coins are one balance per player (per account once you have one) that survives restarts. Every finished game pays 5 coins, a win 10 more; Marble Rush and Mini Golf Party bet them, and Pet Farm earns and spends the same coins. They buy avatar items in the Shop tab of the avatar creator: 59 hats, glasses, neck pieces, outfits, faces, shoes and colours from 30 to 250 coins. Everything that was in the creator before stays free. Players who already had games on the server get the coins those games would have paid, and Pet Farm coins moved into the account balance once.

- Avatar creator: outfit, skin, hair, eyes, mouth, face details and extras, shown as portraits in the UI and as the 3D characters at the table.
- Table chat and quick reactions (six snacks, six emoji) in the waiting room and during games.
- No dependencies: plain Node.js (20+) server with its own WebSocket code. There is no `npm install` step.
- The server owns the game state. Each player only receives their own hand, so you can't peek at other hands in devtools.
- Reconnects are handled: refresh the page and you're back in your seat. If you're gone for 30 s, a bot plays for you until you return.

## Run it locally

```bash
node server/server.js          # http://localhost:8080
npm test                       # a full Hot Pot game with simulated players, Marble Rush races, poker and Ludo games, persistence
```

Open two browser windows (or one normal and one private window) to play against yourself.

## Hot Pot rules

- 72 cards: 6 categories (colours) × 3 ingredients × 4 copies. Everyone holds 8.
- On your turn, **draw** a hidden card from the pot or the top card of another player's discard pile, then **discard** one.
- A **set** is 3 identical ingredients (30 pts) or 3 different ingredients of the same colour (15 pts).
- After drawing, if all 9 cards make 3 sets, press **Let's Eat!** to win (+90 pts).
- After 30 rounds with no winner, everyone scores the sets in their hand.
- The host chooses Chill or Sharp bots and a turn timer (20/30/45 s or off). When the timer runs out, the turn is played for you.

## Marble Rush rules

- 1 to 8 players, with bots betting from empty seats up to 4. The track has 4, 6 or 8 coloured marbles (host's choice) and nobody owns one.
- The race starts once every player at the table has bet (the host can start it early from then on; players who are away do not hold it up). The winning colour pays your stake times the number of marbles, and several players can back the same colour.
- Bets use your account coins (see Coins and the avatar shop). Stakes are 10, 25, 50 or 100, and anyone with under 10 coins is spotted a 10-coin bet.
- Each player has one banana per heat: it slows one marble of your choice for a moment.
- Chaos events (gravity flip, turbo, marblequake, switcheroo) can be switched off by the host.
- Knockout runs short heats on a fresh track each time. The last marble home is out until one is left.
- The server runs the physics and streams positions, so everyone sees the same race and nobody can cheat from devtools.

## Texas Hold'em rules

- 1 to 6 players; bots fill the table up to 2, 4 or 6 seats (host's choice). Chill bots play loose and friendly, Sharp bots bet their good hands and bluff now and then.
- Everyone starts with 1000 pretend chips. Blinds start at 10/20 and go up every 4 hands.
- Standard no-limit hold'em: fold, check, call, bet or raise any amount up to your stack. Side pots are handled for all-ins.
- A game is 10 hands, 20 hands, or "last one standing". The biggest stack at the end wins; anyone who runs out of chips is out.
- The turn timer (20/30/45 s or off) checks for you if it's free, otherwise folds.
- Someone who joins mid-game can take over a bot's seat (and its chips) from the next hand.
- The server deals and keeps every hand secret until the showdown, so nobody can peek from devtools.

## Ludo rules

- 1 to 4 players; bots fill the board up to 2, 3 or 4 corners (host's choice). Each corner takes its player's colour (a spare colour if two are too alike).
- Classic is 4 pawns each, Quick is 2. With "head start" on, everyone begins with one pawn already on the board.
- A pawn needs a 6 to leave the yard. With nothing on the board you get up to three tries. If more than one pawn can move you choose; otherwise it moves by itself.
- Landing on a single rival pawn sends it back to its yard. Star cells and start cells are safe, and two of your own pawns on one cell cannot be captured.
- A 6, a capture or a pawn getting home earns a bonus roll; three sixes in a row ends the turn.
- Hard mode (off by default) allows only one pawn per cell and has no safe cells: you cannot move onto your own pawn, and any rival you land on is captured, even on a star or a start cell.
- A pawn needs the exact number to step home. First to get every pawn home wins, and the rest are ranked by how far their pawns got.
- Someone who joins mid-game can take over a bot's corner when the current round of turns ends.

## Pet Farm

A persistent game rather than a table game: every account owns a small low-poly farm that is still there next visit. The farm is a floating island. You pick a starter pet, place and move buildings and decorations on a tile grid, grow the land, and send pets off by balloon on expeditions that take real time (15 minutes to 8 hours). They come back with materials and experience, and sometimes a wild pet follows them home. A bigger farmhouse opens more places to explore. Pets also fight turn-based battles, up to 3 against 3: practice at the Training Yard, or challenge other farms and three built-in neighbours at the Arena Flag, where everyone fights at level 20 and the other team is played by the game. The World map shows everyone's islands floating side by side: tap one to visit, help out (a few coins for you, a shorter trip for them), leave a gift, or challenge their team. Gifts and news (who helped, who challenged you) wait in the Mailbox, and the Pet Album tracks which species and forms you have found. Two pets of level 5 or more can share the Nest: an egg appears after two hours and hatches a few hours later. The baby takes after both parents in coat colour (each pet carries a hidden colour too), markings, one borrowed part such as ears or a tail, stat stars and talent, and some pairs hatch one of five species that cannot be found in the wild. Friends can open pets for playdates, and every pet keeps its family tree. When visiting a farm you can send a trade offer: pets, materials or coins for pets, materials or coins. What you offer is set aside until the other player accepts, declines or counters from their Mailbox, or for a week. When you are both online you can also invite them to a live battle: both players choose at the same time, with 30 seconds a turn. Garden Plots grow berries every hour, the Kitchen turns them into treats (experience for a pet, or a juice that heals once in a battle), the Storage Barn triples how much the farm can hold, and the Workshop unlocks fancier decorations and buys spare materials for coins. Huts, the gate, gardens, the barn, the Nest and the Training Yard can each be improved to level 3, pets left at the yard earn a little experience every hour, anything placed can be sold for its cost, the places to explore float at the edge of the World map, and two neighbours can compare Pet Albums.

The hub has one **friends list** for the whole site (the Friends button in the top bar). Friends are added by username and need an account. In Pet Farm, friends sit first on the World map with a green name tag, and "Visit farm" in the list walks straight to their island.

- It needs an account (guests are asked to create one), because the farm is saved to it.
- Farms are saved in their own file, `pet-farm.json`, next to `cozy-table.json` in `DATA_DIR`. Back up both.
- To send every player a gift, run `npm run gift -- wood=50 coins=20 "Happy weekend!"` on the machine the server runs on. It lands in every Mailbox within a few seconds, offline players included. If the server uses its own `DATA_DIR` (the systemd unit uses `/var/lib/cozy-table`), run it as `sudo DATA_DIR=/var/lib/cozy-table npm run gift -- ...`.
- Buildings, costs, land sizes, pets, expedition zones, trip lengths and rewards are all in `public/games/farm/data.js`, shared by the server and the browser. Battle rules, moves and stats are in `public/games/farm/battle.js`, breeding rules in `public/games/farm/breed.js`, and pet models in `public/games/farm/pets3d.js`. The server rules are in `server/farm.js`; models are built in code in `public/games/farm/models.js`.

## Deploy on an Oracle Cloud server

These steps assume an Ubuntu 22.04/24.04 instance; the Always Free Ampere A1 shape is plenty. Replace `example.com` with your domain.

**1. Point your domain at the server.** At your registrar, add an `A` record for `example.com` (and `www`) with the instance's public IP.

**No domain yet? Use a free DuckDNS name.** Sign in at duckdns.org and add a subdomain such as `cozytable`. Put your server's public IP in the box and press *update ip*. You now have `cozytable.duckdns.org`; use it wherever these steps say `example.com`, and drop the `www` line from the Caddyfile. Your Oracle IP doesn't change while the instance exists, so no updater is needed. If you ever want one, add this to `crontab -e` on the server (replace the token):

```
*/10 * * * * curl -s "https://www.duckdns.org/update?domains=cozytable&token=YOUR-TOKEN&ip=" >/dev/null
```

**2. Open ports 80 and 443.**
- In the Oracle console, go to Networking → Virtual Cloud Networks → your VCN → Security Lists → Default. Add **ingress rules** for TCP 80 and 443 from `0.0.0.0/0`.
- Oracle's Ubuntu images also block these ports in iptables, so open them on the VM too:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**3. Install Node.js and the app.**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo useradd --system --home /opt/cozy-table cozy
sudo git clone https://github.com/Unreal38/minigames-hub /opt/cozy-table
sudo chown -R cozy:cozy /opt/cozy-table
sudo cp /opt/cozy-table/deploy/cozy-table.service /etc/systemd/system/
sudo systemctl enable --now cozy-table
curl localhost:8080/health      # -> ok
```

**4. Add HTTPS with Caddy.** Caddy proxies WebSockets and renews certificates automatically.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo cp /opt/cozy-table/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # put your domain in place of example.com
sudo systemctl reload caddy
```

Visit `https://example.com`. To invite friends, host a table and press **Copy invite link**, or tell them the 4-letter code.

**Updating:** `cd /opt/cozy-table && sudo -u cozy git pull && sudo systemctl restart cozy-table`. A restart ends any game in progress, but every open table comes back in its waiting room with its scoreboard and chat, and players are reseated when their browsers reconnect (they have 90 seconds).

**Saved data:** accounts, player stats and open tables live in one file, `cozy-table.json`, inside `DATA_DIR` (`./data` by default, `/var/lib/cozy-table` with the systemd unit). Back that file up to keep everyone's progress. If you installed before scores and accounts existed, copy the unit again once so the server has somewhere it may write:

```bash
sudo cp /opt/cozy-table/deploy/cozy-table.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart cozy-table
```

**Logs:** `journalctl -u cozy-table -f`

## Scores, ranks and accounts

- **Table scoreboard:** every table keeps wins and points per player across all the games played at it, shown in the waiting room. It lasts as long as the table stays open, restarts included.
- **Stats, XP and ranks:** each finished game gives 15 XP, plus 35 for a win and up to 20 for points scored. Levels and rank titles are in `public/ranks.js`.
- **Accounts:** progress is kept per browser by default. A player can create an account with a username and password (no email) to keep it across devices. Passwords are stored as salted scrypt hashes.
- **Changing and recovering passwords:** signed-in players change their password from the **Password** button on their progress card (other devices get logged out). Every new account gets a recovery code, shown once; with it, *Log in → Forgot your password?* sets a new password. Players can make a new code from the same Password window. If someone loses the code too, the host makes a one-time reset code (valid 24 hours) on the server and sends it to them privately:

  ```bash
  cd /opt/cozy-table && sudo DATA_DIR=/var/lib/cozy-table npm run reset-password -- <username>
  ```
- **New games:** export `results(G)` from the server module, returning `{ pts, win }` per seat once the game has ended, and the scoreboard and XP work for it too.

## Security

- Logins, password changes and recovery codes are limited per address and per username (10 wrong tries per address and 20 per username in 15 minutes for passwords, fewer for codes). Only wrong tries count.
- One address may hold 20 connections at once and open 60 a minute; a connection that floods messages is closed. Wrong table codes are limited so private tables can't be found by guessing.
- The page sends a Content Security Policy (scripts only from this site and jsDelivr), plus `X-Frame-Options`, `nosniff` and, behind HTTPS, HSTS. Names have quotes and angle brackets neutralised on the server.
- The server trusts `X-Forwarded-For` only from Caddy on the same machine. If you put Cloudflare in front, add `Environment=TRUST_CLOUDFLARE=1` to the unit so the real visitor address is used, and only allow Cloudflare's addresses to reach ports 80/443.
- Large floods (DDoS) can't be stopped inside the app; that needs a shield in front of the server, such as Cloudflare's free plan.

## Customising

- **Site name:** change `SITE` in `public/app.js` and the `<title>` in `public/index.html`.
- **Colours & fonts:** CSS variables at the top of `public/style.css`.
- **three.js** loads from jsDelivr through the import map in `index.html`. To self-host it, download `three.module.min.js` (v0.170.0) into `public/vendor/` and point the import map at `/vendor/three.module.min.js`. If three.js fails to load, the game falls back to a flat illustrated table and stays playable.

## Adding another minigame

```
server/games/<id>.js           # create(players, opts, prev), act(G, seat, a), tick(G, now), view(G, seat), setAway(G, seat, away), meta, optional cleanOpts(opts), optional results(G)
public/games/<id>/client.js    # mount(appEl, ctx) -> { update(state), room(room), react(msg), destroy() }
```

Register the server module in `GAMES` in `server/server.js`, and the client in `GAMES` in `public/app.js` (name, table settings, rules), then add a card for it on the hub. Lobbies, codes, reconnects, bots-on-disconnect and emotes work for every game.

## Project layout

```
server/server.js          static files, lobbies, game loop
server/store.js           saved profiles, accounts and lobby scoreboards
server/ws.js              tiny WebSocket implementation (RFC 6455)
server/games/hotpot.js    Hot Pot engine + bots (authoritative)
server/games/marbles.js   Marble Rush physics, bets, chaos and knockout (authoritative)
public/index.html         single page app shell
public/app.js             username, hub, open tables, waiting room
public/ranks.js           XP curve and rank titles (shared with server)
public/games/hotpot/      rules (shared with server), SVG food icons, HUD client, 3D scene, styles
public/games/marbles/     track generator (shared with server), HUD client, 3D scene, styles
deploy/                   systemd unit + Caddyfile
test/smoke.js             end-to-end Hot Pot test
test/marbles.js           Marble Rush races on a fake clock + a table over WebSocket
```

Hot Pot is an unofficial fan project inspired by Palia's Hotpot minigame, and isn't affiliated with Singularity 6.
