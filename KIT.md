# @codemaku/arcade — KIT

**This is the only document you need to read before writing game code.**
It describes every public export and the shared CSS contract. If something is
not documented here, it is not part of the game API.

Package: `@codemaku/arcade`
Subpaths: `.` (runtime), `./style.css`, `./vite`, `./vite` types, `arcade-obfuscate` CLI.

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
hub, in a new tab by default (`newTab: false` to leave the game instead).
INSTALL appears only when the game isn't already installed, isn't running
inside the hub, and the browser can install it: Chrome/Android get the real
install prompt, iPhone/iPad get the Share → Add to Home Screen steps.
`install: false` hides it. `isInstalled()`, `canInstall()` and
`promptInstall()` are exported too.

Don't add another hub link, install button, or put settings elsewhere.

Classes: `.arcade-header`, `.ah-hub`, `.ah-title`, `.ah-tools`, `.ah-sound`, `.ah-theme`.

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
