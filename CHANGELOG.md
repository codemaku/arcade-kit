# @codemaku/arcade

## 0.7.0

### Minor Changes

- 3775aae: Invites on the hub, rematches on the board, and the village feed.

  - `rematchMatch(id, options)`: REMATCH on a finished match. The player who didn't open last time opens. The finished match gets `next` (`{ id, status, askedByMe }`), so the other player sees the invite on the board they're looking at, and their REMATCH says yes to it.
  - Every match carries `record`, the running head-to-head for that game.
  - `matchLink(url, id)` and `readMatchLink()`: the hub opens a match straight in its game with `?match=<id>`.
  - `fetchFeed()`: finished online games (with the record after them) and new personal bests in your village. Needs the API's `GET /v1/feed`.
  - MY PROGRESS per game: `showProgress({ game, title })`, and `mountHeader({ progress: "<slug>" })` adds a PROGRESS button.
  - The player card has MY PROGRESS (every game).
  - PLAY ONLINE says invites show up on the Codemaku hub.

## 0.6.0

### Minor Changes

- Add scores: one result per round, with personal and village records that live on the Codemaku API.

  - `submitScore(result, { player })` scores a finished round: one `skill` (the measure MY PROGRESS shows), an optional `board` (a course, level or mode; records only compare on the same board) and `details` (extra numbers shown with the round, never their own measure). Returns `{ personalBest, previous, villageBest }` straight away, offline too.
  - `getRecords`, `listRecords` (device cache, instant) and `loadRecords` (refresh from the server) give `{ me, village }` per board. Records survive cleared or short-lived storage, such as a game in the hub app's frame on iPhone.
  - `mountRecords(el, { game, skill, board, format })`: a ready-made MY BEST / VILLAGE BEST panel that keeps itself up to date. `onRecordsChange(fn)`.
  - `pickPlayer({ exclude, onPick })`: choose who sits in Player 2's seat: a player on this device, a new player made right there (without switching who's playing on the device), or a guest.
  - `createPlayer({ makeCurrent: false })`. `record()` accepts `board` and `details`. `playerApi()` for low-level API calls.
  - MY PROGRESS and the village show one stat per game.
  - Players on the same device join each other's village automatically (once per pair, so an unfriend sticks). Needs the API's `POST /v1/friends/device`.
  - Faster sign-up: WHO'S PLAYING? asks for just a name (a free colour is picked; change it on the player card), or I PLAY ON ANOTHER DEVICE. Player 2's picker works the same way.
  - Signing in another device: the new device shows a 4-character code for 5 minutes; on a signed-in device, the player card's SIGN IN ANOTHER DEVICE approves it (`startLink`, `approveLink`). Replaces typing an 8-character pair code on the new device.
  - Backup email: save one from the player card (verified with a 6-digit code). On a new device, USE MY BACKUP EMAIL brings back every player saved with it, so one parent's email covers the family (`setBackupEmail`, `verifyBackupEmail`, `removeBackupEmail`, `recoverByEmail`, `claimByEmail`). Only a hash of the address is stored. Recovery codes still work.
  - Online play against your village: `showOnlinePlay({ game, newOptions, onOpen })` (YOUR TURN, invites, THEIR TURN, NEW GAME from your village, finished games with your head-to-head record), and `createMatch`, `listMatches`, `getMatch`, `acceptMatch`, `declineMatch`, `sendMove`, `resignMatch`, `watchMatch` (live while both are on the page), `waitingOnMe`. The API checks every move with the game's rules; gomoku first.

## 0.5.0

### Minor Changes

- Add players: console-style profiles shared across Codemaku sites by a `codemaku.com` cookie, the WHO'S PLAYING? screen, a player card (switch, edit, add to another device with a pair code, recovery code, remove), `record()` with an offline outbox and background sync to the Codemaku API, `fetchProgress()`, and the village (`fetchVillage`, `addFriend`, `acceptFriend`, `removeFriend`). No email or passwords.
- `challengeName()` returns the current player's name when there is one.

## 0.4.0

### Minor Changes

- Add challenge links: "same round, beat my score" links that live entirely in the URL. `readChallenge`, `challengeURL`, `clearChallenge`, `seededRandom`, `newSeed`, `challengeOutcome`, `showChallengeIntro` (the CHALLENGE! dialog when a link is opened) and `offerChallenge` (name field, then the share sheet or copy to clipboard). The challenger's name is shared across games as `arcade_name`.

## 0.3.3

### Patch Changes

- Add offline support. `arcade({ offline: true })` writes a precaching service worker (`sw.js`) into the build and registers it from every built page, so a game (or the hub) works offline after one online visit. It precaches every built file, including `public/` files such as sounds and icons, and the Google Fonts stylesheets the HTML links to with their font files. Pages are network first with a 3-second fallback to the cache, so deploys still show up straight away. Works with single-file builds and inside the hub's in-app game frame.
- Add `offline(options)` to `@codemaku/arcade/vite` for projects that don't use the preset (`plugins: [react(), offline()]`), and `registerOffline()` to the runtime for `offline: { register: false }`.
- The worker owns the site's Cache Storage: on activate it deletes caches from older builds and from previous workers (vite-plugin-pwa/workbox, hand-written ones). localStorage is never touched.
- The INSTALL dialogs now say the game keeps working offline, whether you install Codemaku or just this game.

## 0.3.2

### Patch Changes

- Fix the same-tab return to the hub: `codemaku.com` redirects to `www.codemaku.com`, so `cameFromHub()` now treats the two as the same site. Without this the badge still opened a new tab and the hub never leaned out.
- INSTALL in a game header now offers the hub first ("INSTALL CODEMAKU", every game in one app) and installing just this game second. `offerHub: false` skips the hub choice. The hub link adds `?install` so the hub can open its own install steps.
- Add `showInstall({ name, hub })` and `onInstallChange(fn)`; `promptInstall(name)` takes the app's name for the iOS steps.

## 0.3.1

### Patch Changes

- The header's CODEMAKU badge goes back to the hub in the same tab when the game was opened from the hub, so the hub plays its lean-out instead of booting fresh in a new tab. Adds `cameFromHub()`.

## 0.3.0

### Minor Changes

- Add `mountHeader`, the shared game header: CODEMAKU badge, game name, then optional game buttons, sound and theme. Every game uses it so the way back to the hub and the settings sit in the same place everywhere.
- The header shows INSTALL when the game can be installed and isn't already installed or inside the hub (browser prompt on Chrome/Android, Share → Add to Home Screen steps on iOS). Adds `isInstalled()`, `canInstall()`, `promptInstall()`.
- `createTheme` now defaults to `"light"` instead of `"auto"` when nothing is stored.
- Add `inHub()` and `backToHub()`. Inside the hub's home-screen game view, the badge asks the hub to close the game instead of opening Safari's sheet.

### Patch Changes

- 1ce578f: Fix badge sizing: `.arcade-brand .ab-link` now uses `font-size: 1em` instead of a fixed `var(--fs-md)`, so setting `font-size` on the brand container resizes the badge as documented.

## 0.2.0

### Minor Changes

- 1ee46fa: Add the Codemaku pixel badge brand: `logoSVG`, `drawLogo`, `brandHTML`, `mountBrand`, `HUB_URL`, and the `.arcade-brand` / `.arcade-logo` styles. Add a `demo/` showcase page.
