# @codemaku/arcade

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
