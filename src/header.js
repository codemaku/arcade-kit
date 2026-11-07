/*! @codemaku/arcade/header — the shared game header. © 2026 Codemaku. */

import { HUB_URL, logoSVG } from "./brand.js";

/**
 * True when this game is running inside the Codemaku hub's in-app game view
 * (the hub's home-screen app loads games in a full-screen frame).
 */
export function inHub() {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/** True when this page was opened from the hub (by its PLAY button). */
export function cameFromHub(hub = HUB_URL) {
  try {
    return new URL(document.referrer).origin === new URL(hub).origin;
  } catch {
    return false;
  }
}

/**
 * Go back to the hub. Inside the hub's game view this asks the hub to close
 * the frame (the game stays loaded, so reopening it resumes where you were).
 * Opened from the hub, it goes back in the same tab, so the hub can play its
 * lean-out. Otherwise it opens the hub, in a new tab when `newTab` is set.
 */
export function backToHub({ hub = HUB_URL, newTab = false } = {}) {
  if (inHub()) {
    // "*" is fine: the message carries no data, and the hub checks the sender.
    window.parent.postMessage({ type: "codemaku:close" }, "*");
    return;
  }
  if (newTab && !cameFromHub(hub)) window.open(hub, "_blank", "noopener");
  else location.assign(hub);
}

/* ---- install to home screen ---- */

/** True when the game is running as an installed home-screen app. */
export function isInstalled() {
  try {
    return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

// iPhone/iPad have no install prompt; iPadOS reports itself as a Mac.
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

let installPrompt = null;
const installListeners = new Set();
const installChanged = () => installListeners.forEach((fn) => fn());
if (typeof window !== "undefined") {
  // Caught at import so the event isn't missed before the header mounts.
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    installChanged();
  });
  addEventListener("appinstalled", () => {
    installPrompt = null;
    installChanged();
  });
}

/**
 * Whether an install button makes sense here: not installed, not inside the
 * hub, and the browser can install (an install prompt, or iOS's Share menu).
 */
export function canInstall() {
  return !isInstalled() && !inHub() && (!!installPrompt || isIOS());
}

function showIOSInstall() {
  const ov = el("div", "arcade-overlay ah-install", { role: "dialog", "aria-modal": "true", "aria-label": "Install" });
  ov.style.display = "flex";
  const card = el("div", "card");
  const h = el("h2");
  h.textContent = "INSTALL";
  const p1 = el("p");
  p1.textContent = "1. Tap the Share button in Safari.";
  const p2 = el("p");
  p2.textContent = '2. Choose "Add to Home Screen".';
  const ok = el("button", "btn", { type: "button" });
  ok.textContent = "OK";
  const close = () => ov.remove();
  ok.addEventListener("click", close);
  ov.addEventListener("click", (e) => e.target === ov && close());
  card.append(h, p1, p2, ok);
  ov.append(card);
  document.body.append(ov);
  ok.focus();
}

/** Show the browser's install prompt, or the iOS steps. */
export async function promptInstall() {
  if (installPrompt) {
    const e = installPrompt;
    installPrompt = null;
    await e.prompt();
    installChanged();
    return;
  }
  if (isIOS()) showIOSInstall();
}

const el = (tag, cls, attrs = {}) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/**
 * Mount the shared header: [CODEMAKU] GAME NAME ...... [INSTALL] [extras] [SND] [THEME]
 *
 * - The CODEMAKU badge goes back to the hub (see `backToHub`).
 * - `theme`: a controller from `createTheme`. Omit to hide the theme button.
 * - `sound`: `{ get(): boolean, set(on: boolean): void }`. Omit to hide it.
 * - `actions`: extra game buttons, `{ label, onClick, ariaLabel?, hot? }`.
 * - INSTALL shows when the game isn't installed or inside the hub and the
 *   browser can install it (`install: false` to never show it).
 *
 * Returns `{ el, update(options?), destroy() }`. Call `update()` after the
 * theme or sound changes from somewhere else, or pass new options (for
 * example a different `actions` list) to redraw.
 */
export function mountHeader(target, options = {}) {
  const host = typeof target === "string" ? document.getElementById(target) : target;
  if (!host) return null;
  let opts = { hub: HUB_URL, newTab: true, ...options };

  const header = el("header", "arcade-header");
  const hubLink = el("a", "ah-hub", { "aria-label": "Back to Codemaku" });
  // Full wordmark, or the square C badge on narrow phones (CSS picks one).
  hubLink.innerHTML =
    `<span class="ah-word">${logoSVG()}</span><span class="ah-mark">${logoSVG("mark")}</span>`;
  hubLink.addEventListener("click", (e) => {
    // Let modified clicks (new tab, etc.) do their usual thing outside the hub.
    if (!inHub() && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
    e.preventDefault();
    backToHub(opts);
  });
  const title = el("h1", "ah-title");
  const tools = el("div", "ah-tools");
  header.append(hubLink, title, tools);

  const render = () => {
    hubLink.href = opts.hub;
    title.textContent = opts.title || "";
    title.hidden = !opts.title;
    tools.replaceChildren();

    if (opts.install !== false && canInstall()) {
      const b = el("button", "btn mini ah-install-btn", { type: "button", "aria-label": "Install to home screen" });
      b.textContent = "INSTALL";
      b.addEventListener("click", () => promptInstall());
      tools.append(b);
    }

    for (const a of opts.actions || []) {
      const b = el("button", `btn mini ${a.hot ? "hot" : "alt"}`, { type: "button" });
      b.textContent = a.label;
      if (a.ariaLabel) b.setAttribute("aria-label", a.ariaLabel);
      b.addEventListener("click", a.onClick);
      tools.append(b);
    }

    if (opts.sound) {
      const on = !!opts.sound.get();
      const b = el("button", "btn mini alt ah-sound", {
        type: "button",
        "aria-pressed": String(on),
        "aria-label": "Sound",
      });
      b.textContent = on ? "SND ON" : "SND OFF";
      b.addEventListener("click", () => {
        opts.sound.set(!opts.sound.get());
        render();
      });
      tools.append(b);
    }

    if (opts.theme) {
      const pref = opts.theme.pref;
      const label = opts.themeLabels?.[pref] ?? pref;
      const b = el("button", "btn mini alt ah-theme", {
        type: "button",
        "aria-label": `Color theme: ${label}. Activate to change.`,
      });
      b.textContent = String(label).toUpperCase();
      b.addEventListener("click", () => {
        opts.theme.cycle();
        render();
      });
      tools.append(b);
    }
  };

  installListeners.add(render);
  render();
  host.replaceChildren(header);

  return {
    el: header,
    update(next) {
      if (next) opts = { ...opts, ...next };
      render();
    },
    destroy() {
      installListeners.delete(render);
      header.remove();
    },
  };
}
