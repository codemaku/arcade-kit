---
"@codemaku/arcade": patch
---

Fix badge sizing: `.arcade-brand .ab-link` now uses `font-size: 1em` instead of a fixed `var(--fs-md)`, so setting `font-size` on the brand container resizes the badge as documented.
