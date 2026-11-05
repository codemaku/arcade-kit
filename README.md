# @codemaku/arcade

Shared pixel-arcade base for Codemaku games: design tokens, base CSS, runtime
helpers, a Vite preset, and a post-build obfuscator.

One package, versioned once. Every game pins an exact version and upgrades on
purpose.

## Install

```ini
# .npmrc in the game repo
save-exact=true
```

```bash
npm install --save-exact @codemaku/arcade@0.1.0
```

## Use

```js
// vite.config.js
import { defineConfig } from "vite";
import { arcade } from "@codemaku/arcade/vite";

export default defineConfig(arcade());
```

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

```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "build:shipped": "vite build && arcade-obfuscate"
  }
}
```

## Publish

```bash
npm install
npm run check
npm publish
```

The package publishes to the public npm registry with `access: public`.
Run `npm login` first if needed.

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
