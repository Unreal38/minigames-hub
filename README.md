# Cozy Table: minigames for friends

A small self-hosted website where friends pick a username (no accounts), open or join a table with a 4-letter code, and play tiny multiplayer games. Empty seats are filled by bots.

**Game #1: Hot Pot**, a fan-made take on the Palia Hotpot card minigame. It has cute SVG food cards, a 3D table (three.js) with a bubbling split-broth pot, sound effects, emotes and a results screen.

- Avatar creator: outfit, skin, hair, eyes, mouth, face details and extras, shown as portraits in the UI and as the 3D characters at the table.
- Table chat and quick reactions (six snacks, six emoji) in the waiting room and during games.
- No dependencies: plain Node.js (20+) server with its own WebSocket code. There is no `npm install` step.
- The server owns the game state. Each player only receives their own hand, so you can't peek at other hands in devtools.
- Reconnects are handled: refresh the page and you're back in your seat. If you're gone for 30 s, a bot plays for you until you return.

## Run it locally

```bash
node server/server.js          # http://localhost:8080
npm test                       # simulated 2 players + 2 bots play a full game
```

Open two browser windows (or one normal and one private window) to play against yourself.

## Hot Pot rules

- 72 cards: 6 categories (colours) × 3 ingredients × 4 copies. Everyone holds 8.
- On your turn, **draw** a hidden card from the pot or the top card of another player's discard pile, then **discard** one.
- A **set** is 3 identical ingredients (30 pts) or 3 different ingredients of the same colour (15 pts).
- After drawing, if all 9 cards make 3 sets, press **Let's Eat!** to win (+90 pts).
- After 30 rounds with no winner, everyone scores the sets in their hand.
- The host chooses Chill or Sharp bots and a turn timer (20/30/45 s or off). When the timer runs out, the turn is played for you.

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

**Updating:** `cd /opt/cozy-table && sudo -u cozy git pull && sudo systemctl restart cozy-table`. A restart ends any tables in progress, because the game state is kept in memory.

**Logs:** `journalctl -u cozy-table -f`

## Customising

- **Site name:** change `SITE` in `public/app.js` and the `<title>` in `public/index.html`.
- **Colours & fonts:** CSS variables at the top of `public/style.css`.
- **three.js** loads from jsDelivr through the import map in `index.html`. To self-host it, download `three.module.min.js` (v0.170.0) into `public/vendor/` and point the import map at `/vendor/three.module.min.js`. If three.js fails to load, the game falls back to a flat illustrated table and stays playable.

## Adding another minigame

```
server/games/<id>.js           # create(players, opts, prev), act(G, seat, a), tick(G, now), view(G, seat), setAway(G, seat, away), meta
public/games/<id>/client.js    # mount(appEl, ctx) -> { update(state), room(room), react(msg), destroy() }
```

Register the server module in `GAMES` in `server/server.js`, and the client in `GAMES` in `public/app.js`, then add a card for it on the hub. Lobbies, codes, reconnects, bots-on-disconnect and emotes work for every game.

## Project layout

```
server/server.js          static files, lobbies, game loop
server/ws.js              tiny WebSocket implementation (RFC 6455)
server/games/hotpot.js    Hot Pot engine + bots (authoritative)
public/index.html         single page app shell
public/app.js             username, hub, open tables, waiting room
public/games/hotpot/      rules (shared with server), SVG food icons, HUD client, 3D scene, styles
deploy/                   systemd unit + Caddyfile
test/smoke.js             end-to-end server test
```

Hot Pot is an unofficial fan project inspired by Palia's Hotpot minigame, and isn't affiliated with Singularity 6.
