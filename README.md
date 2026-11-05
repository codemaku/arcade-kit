# @codemaku/arcade

Shared pixel-arcade base for Codemaku games: design tokens, base CSS, runtime
helpers, a Vite preset, and a post-build obfuscator.

One package, versioned once. Every game pins an exact version and upgrades on
purpose.

> **API reference:** [`KIT.md`](KIT.md) is the full, AI-facing contract for
> every export and CSS hook. Games consume this package; games never edit it.

## Install

```ini
# .npmrc in the game repo
save-exact=true
```

```bash
npm install --save-exact @codemaku/arcade@0.1.0
```

Requires Node ≥ 18 and Vite ≥ 5 (peer dependency).

## Use

### Vite preset

```js
// vite.config.js
import { defineConfig } from "vite";
import { arcade } from "@codemaku/arcade/vite";

export default defineConfig(arcade());
```

`arcade()` applies the house defaults — single-file output, terser minify,
no source maps, inlined CSS/assets — and passes any normal Vite options
straight through (`{ singlefile: false }` opts out of the single-file bundle).

### Runtime + styles

```js
// src/main.js
import "@codemaku/arcade/style.css";
import "./style.css"; // game-specific layout and token overrides
import {
  $,
  clamp,
  esc,
  haptic,
  readJSON,
  writeJSON,
  removeStored,
  createTheme,
  installPWA,
} from "@codemaku/arcade";

const theme = createTheme({
  storageKey: "mygame_theme",
  colors: { light: "#efe3b8", dark: "#1b1230" },
});

installPWA({
  name: "My Game",
  shortName: "Game",
  background: "#1b1230",
  icon(ctx, size) {
    ctx.fillStyle = "#1b1230";
    ctx.fillRect(0, 0, size, size);
    // draw the icon...
  },
});
```

Runtime exports at a glance:

| Export | What it does |
| --- | --- |
| `$(id)` | `document.getElementById` shorthand |
| `clamp(v, min, max)` | Numeric clamping |
| `esc(s)` | HTML-escape values before interpolation |
| `readJSON` / `writeJSON` / `removeStored` | Safe namespaced localStorage helpers |
| `haptic(pattern)` | Vibration with iOS fallback |
| `createTheme(options)` | auto/light/dark switcher, persisted, with `theme-color` meta sync |
| `installPWA(options)` | Generates a canvas icon + web manifest at runtime |

### Design tokens

`style.css` defines CSS custom properties on `:root` (dark by default) with
light overrides under `:root[data-theme="light"]` — e.g. `--bg`, `--panel`,
`--ink`, `--acc`, `--hot`, `--grn`, font sizes `--fs-xs…--fs-hero`, spacing
`--gap`/`--pad`. Override tokens in your own stylesheet; never fork the base
components.

### Build scripts

```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "build:shipped": "vite build && arcade-obfuscate"
  }
}
```

`arcade-obfuscate` post-processes the built single-file HTML (default
`dist/index.html`), obfuscating inline script blocks and restoring the
copyright banner. Flags: `[file] [--banner=src/main.js] [--no-banner]`. It
warns if any `.map` files are left in `dist/`.

## Publish

```bash
npm install
npm run check
npm publish
```

The package publishes to the public npm registry with `access: public`.
Run `npm login` first if needed. Releases go through
[Changesets](https://github.com/changesets/changesets): add a changeset, then
`npm run release`.

## Layout

```
src/index.js       runtime helpers
src/style.css      tokens + base components
src/vite.js        shared Vite preset
bin/               arcade-obfuscate CLI
types/             public TypeScript declarations
KIT.md             the AI-facing API reference
```

## Rules

- Games may override tokens, never fork base components.
- New shared UI goes in this repo, not in a game repo.
- Any visual/API change ships through a Changeset and a version bump.

## License

MIT © 2026 Codemaku
