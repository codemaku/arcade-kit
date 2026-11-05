/*! @codemaku/arcade — shared arcade base. © 2026 Codemaku. All rights reserved. */

/* ---- tiny DOM / math helpers ------------------------------------------- */

/** Shorthand for document.getElementById. Returns null if missing. */
export const $ = (id) => document.getElementById(id);

/** Clamp v into [min, max]. */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Escape a value for safe interpolation into HTML. */
export const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/* ---- namespaced JSON storage ------------------------------------------- */

/**
 * Read and parse a localStorage key. Returns `fallback` when the key is
 * missing or holds invalid JSON.
 */
export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Serialise a value to localStorage. Returns false when storage is blocked. */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Remove a localStorage key. */
export function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/* ---- haptics ------------------------------------------------------------ */

let hapticEl = null;

function hapticFallback() {
  if (hapticEl) return hapticEl;
  const label = document.createElement("label");
  label.innerHTML = '<input type="checkbox" switch>';
  label.style.cssText =
    "position:fixed;left:-99px;top:0;opacity:0;pointer-events:none";
  document.body.appendChild(label);
  hapticEl = label;
  return label;
}

/**
 * Vibrate where supported; on iOS fall back to the hidden-switch tap trick.
 * Accepts a duration like `40` or a pattern like `[30, 40, 30]`.
 */
export function haptic(pattern) {
  try {
    if (navigator.vibrate) return navigator.vibrate(pattern);
    const n = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1;
    const el = hapticFallback();
    for (let i = 0; i < n; i++) setTimeout(() => el.click(), i * 90);
  } catch {
    /* haptics are always best-effort */
  }
}

/* ---- theme -------------------------------------------------------------- */

const DEFAULT_THEMES = ["auto", "light", "dark"];

// Accept both JSON-quoted values (new games) and bare strings (hand-written
// or pre-kit values such as localStorage.theme = "light").
function readThemePref(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

/**
 * Set up the auto/light/dark theme switcher.
 *
 * - Writes `document.documentElement.dataset.theme` to the resolved theme.
 * - Persists the preference under `storageKey`.
 * - Calls `onChange(resolved, pref)` whenever the resolved theme changes.
 *
 * `colors` can map a resolved theme to a `<meta name="theme-color">` value.
 */
export function createTheme(options = {}) {
  const {
    storageKey = "arcade_theme",
    themes = DEFAULT_THEMES,
    defaultTheme = "auto",
    colors = {},
    onChange,
  } = options;

  const mq = matchMedia("(prefers-color-scheme: light)");
  let pref = readThemePref(storageKey);
  if (!themes.includes(pref)) pref = defaultTheme;

  const resolve = () =>
    pref === "auto" ? (mq.matches ? "light" : "dark") : pref;

  const apply = () => {
    const theme = resolve();
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && colors[theme]) meta.setAttribute("content", colors[theme]);
    onChange?.(theme, pref);
    return theme;
  };

  const set = (next) => {
    pref = themes.includes(next) ? next : defaultTheme;
    writeJSON(storageKey, pref);
    return apply();
  };

  const cycle = () => set(themes[(themes.indexOf(pref) + 1) % themes.length]);

  const onMedia = () => {
    if (pref === "auto") apply();
  };
  mq.addEventListener?.("change", onMedia);
  apply();

  return {
    get pref() {
      return pref;
    },
    get theme() {
      return resolve();
    },
    get themes() {
      return themes.slice();
    },
    apply,
    cycle,
    set,
    destroy() {
      mq.removeEventListener?.("change", onMedia);
    },
  };
}

/* ---- PWA ---------------------------------------------------------------- */

/**
 * Add an Apple touch icon and a generated web manifest.
 *
 * `icon(ctx, size)` draws the icon; if omitted the canvas is filled with
 * `background`. Returns false when the browser blocks canvas/manifest work.
 */
export function installPWA(options = {}) {
  const {
    name = "Arcade Game",
    shortName = name,
    background = "#1b1230",
    theme = background,
    startUrl = location.href.split("#")[0],
    size = 192,
    icon,
  } = options;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (icon) icon(ctx, size);
    else {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    const url = canvas.toDataURL("image/png");

    const touch = document.createElement("link");
    touch.rel = "apple-touch-icon";
    touch.href = url;
    document.head.appendChild(touch);

    const manifest = {
      name,
      short_name: shortName,
      display: "standalone",
      orientation: "any",
      background_color: background,
      theme_color: theme,
      start_url: startUrl,
      icons: [{ src: url, sizes: `${size}x${size}`, type: "image/png" }],
    };
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], {
        type: "application/manifest+json",
      }),
    );
    document.head.appendChild(link);
    return true;
  } catch {
    return false;
  }
}
