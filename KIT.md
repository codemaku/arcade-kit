# @codemaku/arcade — KIT

**This is the only document you need to read before writing game code.**
It describes every public export and the shared CSS contract. If something is
not documented here, it is not part of the game API.

Package: `@codemaku/arcade`
Subpaths: `.` (runtime), `./style.css`, `./vite` (preset and `offline` plugin), `./vite` types, `arcade-obfuscate` CLI.

> Games consume this package. Games never edit it. If a component is missing
> or broken, report it in the kit repo; do not fork it into the game.

---

## 1. Install and import

```ini
# .npmrc in the game repo
save-exact=true
```

```bash
npm install --save-exact @codemaku/arcade@0.1.0
```

```js
import "@codemaku/arcade/style.css";
import "./style.css"; // game layout + token overrides
import { $, clamp, esc, haptic, readJSON, writeJSON, createTheme, installPWA, mountBrand, mountHeader, drawLogo } from "@codemaku/arcade";
```

The Google Font is not bundled. Keep this in the game HTML:

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
```

---

## 2. Runtime API

### `$(id)`

`document.getElementById(id)` shorthand. Returns `HTMLElement | null`.

```js
$("score").textContent = "4";
```

### `clamp(v, min, max)`

Clamp a number into an inclusive range.

```js
clamp(dist, 1, 700);
```

### `esc(value)`

Escape `& < > "` for safe interpolation into an HTML string.

```js
el.innerHTML = `<b>${esc(player.name)}</b>`;
```

### `readJSON(key, fallback = null)`

Read and parse a `localStorage` key. Returns `fallback` when missing or invalid.

```js
const save = readJSON("mygame_save", null);
```

### `writeJSON(key, value)`

Serialise to `localStorage`. Returns `false` when storage is blocked.

```js
writeJSON("mygame_save", state);
```

### `removeStored(key)`

Remove a `localStorage` key.

### `haptic(pattern)`

Vibrate where supported, with the iOS hidden-switch fallback. Accepts a number
or an array pattern.

```js
haptic(40);
haptic([30, 40, 90]);
```

### `createTheme(options)`

Sets up the auto/light/dark switcher. It writes
`document.documentElement.dataset.theme`, persists the preference, and calls
`onChange(resolvedTheme, pref)` whenever the resolved theme changes.

```js
const theme = createTheme({
  storageKey: "mygame_theme",        // default "arcade_theme"
  themes: ["auto", "light", "dark"], // cycle order
  defaultTheme: "light",           // default "light"
  colors: { light: "#efe3b8", dark: "#1b1230" }, // meta theme-color
  onChange(theme, pref) {
    // update canvas palettes, sprites, etc.
  },
});

theme.pref;   // stored preference ("auto" | "light" | "dark")
theme.theme;  // resolved theme ("light" | "dark")
theme.cycle();// next preference, applies + persists
theme.set("light");
theme.apply();  // re-resolve (e.g. after the game changes palettes)
theme.destroy();
```

The base CSS keys off `:root[data-theme="light"]`.

### `installPWA(options)`

Adds an Apple touch icon and a generated web manifest. `icon(ctx, size)` draws
the icon; if omitted, the canvas is filled with `background`. Returns `false`
if the browser blocks canvas or blob work.

```js
installPWA({
  name: "My Game",
  shortName: "Game",
  background: "#1b1230",
  theme: "#1b1230",
  size: 192,
  icon(ctx, size) {
    ctx.fillStyle = "#1b1230";
    ctx.fillRect(0, 0, size, size);
    // draw pixels...
  },
});
```

### `registerOffline(options)`

Registers the offline service worker built by `arcade({ offline: true })`.
The preset already adds a registration script to every built page, so call
this only with `offline: { register: false }`. Resolves to the registration,
or `null` where service workers are unavailable or registration fails (as in
`vite dev`, which builds no worker).

```js
registerOffline(); // { url: "./sw.js" } by default
```

### Header: `mountHeader`, `inHub`, `backToHub`

Every game starts with the same header, so the way back to the hub and the
settings are always in the same place:

`[CODEMAKU]  GAME NAME ......  [INSTALL] [game buttons] [SND ON] [LIGHT]`

```html
<div id="header"></div>
```

```js
const header = mountHeader("header", {
  title: "Box Challenge",
  theme,                                   // from createTheme; omit to hide
  sound: { get: () => soundOn, set: (on) => { soundOn = on; /* save */ } }, // omit if silent
  actions: [{ label: "MENU", onClick: openMenu }],  // optional
  themeLabels: { auto: "Auto", light: "Paper", dark: "Ink" }, // optional
});
header.update();              // redraw after theme/sound changed elsewhere
header.update({ actions });   // or with new options
```

The CODEMAKU badge calls `backToHub()`. Inside the hub's home-screen app the
game runs in a full-screen frame; there it asks the hub to close the frame
(the game stays loaded, so reopening it resumes). Anywhere else it opens the
hub: in the same tab when the game was opened from the hub (so the hub
plays its lean-out), otherwise in a new tab by default (`newTab: false` to
leave the game instead).
INSTALL appears only when the game isn't already installed, isn't running
inside the hub, and the browser can install it. Tapping it offers two
choices: **INSTALL CODEMAKU** (the hub, every game in one app; it opens the
hub with `?install`, which shows the hub's install steps) and **JUST THIS
GAME** (Chrome/Android get the real install prompt, iPhone/iPad get the
Share → Add to Home Screen steps). `offerHub: false` skips the hub choice,
`install: false` hides the button. `isInstalled()`, `canInstall()`,
`promptInstall(name)`, `showInstall({ name, hub })` and `onInstallChange(fn)`
are exported too.

Don't add another hub link, install button, or put settings elsewhere.

Classes: `.arcade-header`, `.ah-hub`, `.ah-title`, `.ah-tools`, `.ah-sound`, `.ah-theme`.

### Challenge links: `readChallenge`, `offerChallenge`, `seededRandom`

"Same round, beat my score" links. Everything lives in the link
(`?c=<base64url JSON>`); nothing is sent to a server. Every round must be
built from a seed so it can be replayed exactly:

```js
import { readChallenge, clearChallenge, showChallengeIntro, offerChallenge,
  challengeOutcome, seededRandom, newSeed } from "@codemaku/arcade";

const ch = readChallenge(); // { s, n, p, ...game fields } or null
if (ch) showChallengeIntro({ challenge: ch, goal: `${ch.n || "THEY"} scored ${ch.p}.`, onPlay: () => start(ch) });

function start(ch) {
  const seed = ch?.s ?? newSeed();
  const rand = seededRandom(seed);   // use for everything that shapes the round
  // ... play; at the end:
  const result = ch && challengeOutcome(score, ch.p);          // "won" | "tied" | "lost"
  // CHALLENGE A FRIEND button:
  offerChallenge({ data: { s: seed, p: score, l: level }, text: (n) => `${n} scored ${score}. Beat it?` });
}
```

- `seededRandom(seed)` is a drop-in for `Math.random`; same seed, same numbers everywhere.
- `readChallenge()` checks `s`, `p` and cleans `n`. Validate your own fields.
- `clearChallenge()` drops `?c` from the address bar once the challenge is done.
- `offerChallenge` asks for a name (saved across games as `arcade_name`), then
  opens the share sheet, or copies the link where there is none.
- `challengeOutcome(mine, theirs, { lower: true })` for lower-is-better scores.
- `challengeURL(data)`, `shareLink({ url, text })`, `challengeName()`, `setChallengeName()` are exported too.
- Escape `ch.n` (`esc`) before putting it in HTML.

### Players: `chooseWhoIsPlaying`, `record`, `fetchProgress`

Console-style players: each device keeps up to 8 profiles and one current
player, shared by the hub and every game through a `codemaku.com` cookie. No
email or password: the device makes the account id and token, so players work
offline and register on the next sync. Results go to the Codemaku API
(`codemaku/api` repo).

```js
import { currentPlayer, chooseWhoIsPlaying, showPlayerCard, record, avatarEl,
  onPlayersChange } from "@codemaku/arcade";

if (!currentPlayer()) chooseWhoIsPlaying({ closable: false, onPick: start });

// At the end of a round, record what the game measures. Queued offline, sent in the background.
record({ game: "golf", skill: "spread", value: 4.2, unit: "m", better: "lower", seed });

// A player button in the header:
playerBtn.replaceChildren(avatarEl(currentPlayer(), 20));
playerBtn.onclick = () => showPlayerCard({ onChange: redraw });
onPlayersChange(redraw);
```

- Signing up is a name (or I PLAY ON ANOTHER DEVICE); the colour is picked for them.
- Another device signs in with a 4-character code it shows, approved from the
  player card's SIGN IN ANOTHER DEVICE; or with a backup email, or a recovery code.
- `record()` needs a current player (else returns null). `game` and `skill` are
  lowercase slugs; pick one `skill` per real measure and keep it stable.
- `better: "lower"` for golf-style measures; the default is `"higher"`.
- Pass `seed` for seeded rounds and `challenge` for challenge rounds, so
  same-round results can be compared.
- Pass-and-play: `record(result, { player: otherId })` for Player 2.
- `fetchProgress()` → `{ streak, stats: [{ game, skill, plays, best, latest, recent }] }`.
- Ready-made screens: `showProgress()` and `showVillage()`.
- The village: `fetchVillage()`, `addFriend(code)`, `acceptFriend(id)`, `removeFriend(id)`.
- Results go to `https://codemaku-api.codemaku.workers.dev`. Use
  `configurePlayers({ api: "http://localhost:8787" })` against a local API in development.
- `challengeName()` now returns the current player's name when there is one.

### Scores: `submitScore`, `mountRecords`, `pickPlayer`

**The one way to score a round.** Every game uses this, so MY PROGRESS,
records and the village work the same everywhere.

```js
import { currentPlayer, pickPlayer, submitScore, mountRecords, listRecords, loadRecords } from "@codemaku/arcade";

// Seats: Player 1 is the current player. Others pick a profile, make one, or play as a guest.
const seats = [currentPlayer()];
pickPlayer({ exclude: seats.map((s) => s?.id), onPick: (seat) => seats.push(seat) });

// Show records where the round is chosen (re-renders itself when they change):
const panel = mountRecords("records", { game: "golf", skill: "differential", board: "pebble-18-t100",
  format: (v, d) => (d.toPar > 0 ? `+${d.toPar}` : d.toPar || "E") });
panel.update({ board: "pebble-9-t100" });

// At the end, ONE result per seat per round:
for (const seat of seats) {
  const r = submitScore({ game: "golf", skill: "differential", value: 11.2, better: "lower",
    board: "pebble-18-t100", details: { toPar: 6, gross: 78, putts: 1.8 } }, { player: seat.id });
  if (r?.personalBest) say(`NEW PERSONAL BEST FOR ${seat.name}`);
}
```

Rules:

- **One result per round.** `skill` is the measure the game is about and the
  only one shown in MY PROGRESS. Keep it stable forever. Put everything else
  (putts, accuracy, time) in `details`.
- **`board`** is a leaderboard inside the game: a course at a length and tee,
  a level, a difficulty. Records only compare on the same board. Omit it for
  a game with one board.
- **Never keep records only in `localStorage`.** Inside the hub app on iPhone,
  a game's storage can be gone when the app is closed. `getRecords` /
  `listRecords` read the device cache (instant, offline); `loadRecords` refreshes
  it from the server; a submitted round counts at once.
- `submitScore(..., { player: null })` or a guest seat returns null: guests
  aren't saved. Say so on the results screen.
- Pass the seat's `id` through the round, don't match players by name.
- `record()` still works for older games; new code uses `submitScore`.
- Players on the same device are in each other's village automatically, so a
  family's VILLAGE BEST works with no friend codes.

### Online play: `showOnlinePlay`, `watchMatch`, `sendMove`

Turn-based games against people in your village. Live when both are on the
page (it polls every 2 seconds), or play your move and come back later. The
Codemaku API keeps the moves and checks them with the game's rules, so a game
needs its rules added to the API (`RULES` in `codemaku/api`) first.

```js
import { showOnlinePlay, watchMatch, sendMove, resignMatch } from "@codemaku/arcade";

showOnlinePlay({
  game: "gomoku",
  newOptions: () => ({ blocked: asteroids(), first: Math.random() < 0.5 ? 1 : 2 }),
  onOpen: (match) => {
    const w = watchMatch(match.id, draw);          // stop with w.stop()
    onTap = async (cell) => {
      if (!current.yourTurn) return;
      const m = await sendMove(current, cell);     // the server says if it's legal
      w.seen(m);
      draw(m);
    };
  },
});
```

- Seat 1 asked, seat 2 was asked. `match.seat` is mine; `yourTurn` says it all.
- Build the board from `options` + `moves`; never trust local state over the match.
- A failed `sendMove` (`stale`, `taken`, `not_your_turn`): fetch the match and redraw.

### Brand: `mountBrand`, `brandHTML`, `logoSVG`, `drawLogo`, `HUB_URL`

Every game shows the same lockup, **Title by CODEMAKU**, where CODEMAKU is a
bold pixel wordmark in a frame that links to the hub (`HUB_URL`). Do not
redraw or restyle the logo in a game. Use these exports.

```html
<span id="brand"></span>
```

```js
mountBrand("brand", { title: "Golf" });       // Golf by [C]odemaku → hub
mountBrand("brand");                          // bare wordmark
mountBrand(el, { title: "Golf", newTab: true });
el.innerHTML = brandHTML({ title: "Golf" });  // markup string only
el.innerHTML = logoSVG();                     // badge only
el.innerHTML = logoSVG("mark");               // square C badge

installPWA({ name: "Golf", icon: (ctx, s) => drawLogo(ctx, s) });
```

The logo is a single colour (`currentColor`, which is `--acc-t` inside the
lockup), so it follows the game's accent and theme. Size it with `font-size` on
the container (`.arcade-logo` is `2.5em` tall, so a `10px` container gives a
`25px` badge). It inherits the container's size, so reset `h1` and other
headings (`font-size: inherit` or an explicit size) before mounting it in one. `drawLogo` draws the framed C on
a solid square with fixed hex colours because canvas cannot read CSS variables.
Pass `{ b, f, m }` (background, frame, letters) to override.

Classes: `.arcade-brand`, `.ab-title`, `.ab-by`, `.ab-link`, `.arcade-logo`.

---

## 3. CSS tokens

All tokens live on `:root`. Override them in the game's own stylesheet. Do not
hard-code colours in game components.

| Token | Purpose |
| --- | --- |
| `--bg` | page background |
| `--panel` | raised surface |
| `--panel2` | secondary raised surface / button alt |
| `--well` | inset surface (inputs, stat tiles) |
| `--line` | outlines and drop shadows |
| `--ink` | primary text |
| `--acc` | accent fill |
| `--acc-t` | accent text |
| `--hot` / `--hot-t` | danger / primary action |
| `--grn` / `--grn-t` | success |
| `--water-t` | water / cool accent |
| `--scrim` | modal scrim |
| `--map-bg` | canvas map background |
| `--p0` … `--p3` | player/state colours |
| `--lie-tee` … `--lie-tree` | terrain colours |
| `--fs-xs` … `--fs-hero` | type scale |
| `--gap` | layout gap |
| `--pad` | page padding |
| `--btn-y` | button vertical padding |

Theme a game by overriding a handful in `src/style.css`:

```css
:root {
  --acc: #ff5a36;
  --acc-t: #ff5a36;
  --hot: #5cb5ff;
  --hot-t: #5cb5ff;
}
```

`@media (prefers-color-scheme)` is already handled through
`:root[data-theme="light"]`; never add a second dark-mode switch.

---

## 4. Base classes

These are provided by `@codemaku/arcade/style.css`.

### Buttons

| Class | Look |
| --- | --- |
| `.btn` | accent button (yellow by default) |
| `.btn.alt` | panel button |
| `.btn.hot` | red primary action |
| `.btn.on` | green selected state |
| `.btn.mini` | compact variant |
| `.btn[disabled]` | dimmed, no pointer events |

### Utilities

| Class | Purpose |
| --- | --- |
| `.sm` | small muted text |
| `.ic` | 30px pixel icon |
| `.big` | 80px pixel icon |
| `.ln` | centred line with accent `<b>` |

### Overlay

```html
<div id="ov" class="arcade-overlay">
  <div class="card" id="ovc"><!-- dialog content --></div>
</div>
```

`.arcade-overlay` is the fixed scrim; `.card` is the panel. Toggle visibility
with `el.style.display = "flex"` / `"none"`. The base handles sizing, scroll,
borders, and the responsive type scale.

### Number pad

```html
<div id="pad" class="arcade-pad">
  <div class="padbox" role="dialog" aria-label="Number pad">
    <div class="pdisp"><span id="pLbl"></span><b id="pVal"></b></div>
    <div class="plr" id="pLR">
      <button class="btn alt" data-pk="L">◀ L</button>
      <button class="btn alt" data-pk="R">R ▶</button>
    </div>
    <div class="keys">
      <button class="btn alt" data-pk="7">7</button>
      <!-- 8 9 4 5 6 1 2 3 CLR 0 DEL -->
    </div>
    <div class="pact">
      <button class="btn alt" data-pk="x">CANCEL</button>
      <button class="btn hot" data-pk="ok">OK</button>
    </div>
  </div>
</div>
```

The styles are scoped under `.arcade-pad`; the JS wiring is game-specific.

---

## 5. Vite preset

```js
import { defineConfig } from "vite";
import { arcade } from "@codemaku/arcade/vite";

export default defineConfig(arcade());
```

Defaults:

- `base: "./"`
- `vite-plugin-singlefile` (`removeViteModuleLoader: true`)
- terser with drop_console, toplevel mangle, 3 passes
- no source maps, CSS inlined, dynamic imports inlined
- `outDir: "dist"`
- `offline: false` (see Offline below)

All normal Vite options can be merged in:

```js
export default defineConfig(
  arcade({
    singlefile: false,
    plugins: [myPlugin()],
    build: { outDir: "build" },
  }),
);
```

### Offline

Every game should work offline once it has been opened online. Turn it on in
the preset:

```js
export default defineConfig(arcade({ offline: true }));
```

After `vite build`, the kit writes `dist/sw.js` and adds a small registration
script to each built HTML page. The worker:

- precaches every file in the output folder (`public/` sounds, icons and the
  manifest included; `.map` files and files over 10 MB skipped);
- caches the Google Fonts stylesheets linked from the HTML, and their font
  files, at install, so the pixel font survives offline after one visit;
- serves pages network first, falling back to the cache after 3 seconds or
  when offline; built files and fonts cache first;
- gets a new version (and a fresh precache) whenever any built file changes,
  then takes over straight away and deletes every older cache on the site,
  including ones left by vite-plugin-pwa or hand-written workers.

It never touches localStorage, so saves are unaffected. Inside the hub's
in-app game view the game's own worker serves it, so a game opened there once
loads there offline too. A game must have been opened once (in the hub app,
or on its own site) for its worker to be installed.

Options (`offline: { ... }`): `exclude` (globs or RegExps relative to the
output folder), `urls` (extra absolute URLs to cache), `fallback` (default
`"index.html"`), `timeout` (ms, default 3000), `maxFileSize`, `filename`
(default `"sw.js"`), `register` (default true).

Without the preset, add the plugin yourself:

```js
import { offline } from "@codemaku/arcade/vite";
export default defineConfig({ plugins: [react(), offline()] });
```

Don't add another service worker or vite-plugin-pwa alongside it. A web
manifest, if the game has one, goes in `public/manifest.webmanifest`.

## 6. Obfuscation

`arcade-obfuscate` is a post-build CLI. It reads the built HTML, obfuscates
inline scripts, and restores the `/*! ... */` banner from `src/main.js`.

```json
"scripts": {
  "build": "vite build",
  "build:shipped": "vite build && arcade-obfuscate"
}
```

Options:

```bash
arcade-obfuscate dist/index.html --banner=src/main.js
arcade-obfuscate dist/index.html --no-banner
```

---

## 7. Rules for game repos

1. Import only from `.`, `./style.css`, and `./vite`. Deep imports are not API.
2. Never edit `node_modules/@codemaku/arcade`.
3. Never bump the kit version without an explicit request. Pins are exact.
4. Override tokens; do not copy base components into the game.
5. If shared UI is missing, stop and report it. Add it to the kit instead.
6. Keep game rules, scoring, sprites, and game-specific layout in the game.
7. Run the game's smoke test after any UI change.
