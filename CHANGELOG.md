# @codemaku/arcade

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
