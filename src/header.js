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

// codemaku.com redirects to www.codemaku.com, so treat the two as one site.
const siteOf = (url) => {
  const u = new URL(url);
  return `${u.protocol}//${u.host.replace(/^www\./, "")}`;
};

/** True when this page was opened from the hub (by its PLAY button). */
export function cameFromHub(hub = HUB_URL) {
  try {
    return siteOf(document.referrer) === siteOf(hub);
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

/** Call `fn` whenever installing becomes possible or stops being possible. Returns an unsubscribe. */
export function onInstallChange(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}
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

// A small kit dialog: title, lines of text, then buttons [{ label, hot, onClick }].
function dialog(title, lines, buttons) {
  const ov = el("div", "arcade-overlay ah-install", { role: "dialog", "aria-modal": "true", "aria-label": title });
  ov.style.display = "flex";
  const card = el("div", "card");
  const h = el("h2");
  h.textContent = title;
  card.append(h);
  for (const line of lines) {
    const p = el("p");
    p.textContent = line;
    card.append(p);
  }
  const close = () => ov.remove();
  for (const b of buttons) {
    const btn = el("button", `btn${b.hot ? " hot" : b.alt ? " alt" : ""}`, { type: "button" });
    btn.textContent = b.label;
    btn.addEventListener("click", () => {
      close();
      b.onClick?.();
    });
    card.append(btn);
  }
  ov.addEventListener("click", (e) => e.target === ov && close());
  ov.addEventListener("keydown", (e) => e.key === "Escape" && close());
  ov.append(card);
  document.body.append(ov);
  card.querySelector("button")?.focus();
}

function showIOSInstall(name) {
  dialog(
    "INSTALL",
    [
      ...(name ? [`To add ${name} to your home screen:`] : []),
      "1. Tap the Share button in Safari.",
      '2. Choose "Add to Home Screen".',
      "It keeps working offline.",
    ],
    [{ label: "OK" }],
  );
}

/** Show the browser's install prompt, or the iOS steps. Needs a tap to have just happened. */
export async function promptInstall(name) {
  if (installPrompt) {
    const e = installPrompt;
    installPrompt = null;
    await e.prompt();
    installChanged();
    return;
  }
  if (isIOS()) showIOSInstall(name);
}

/**
 * The INSTALL flow. With `hub`, offer the hub first (every game in one app),
 * with installing just this game as the second choice. Without it, install
 * this page: the iOS steps, or a dialog whose button opens the browser's
 * prompt (the prompt needs a tap, so it can't open by itself).
 */
export function showInstall({ name = "", hub = null } = {}) {
  if (isInstalled() || inHub()) return;
  if (hub) {
    const url = new URL(hub);
    url.searchParams.set("install", "");
    dialog(
      "INSTALL",
      [
        "Install Codemaku once and play every game, this one too, from your home screen.",
        "Either way, games you have opened keep working offline.",
      ],
      [
        { label: "INSTALL CODEMAKU", hot: true, onClick: () => location.assign(url.href.replace(/=$/, "")) },
        { label: name ? `JUST ${name.toUpperCase()}` : "JUST THIS GAME", alt: true, onClick: () => promptInstall(name) },
        { label: "CANCEL", alt: true },
      ],
    );
    return;
  }
  if (isIOS()) return showIOSInstall(name);
  if (installPrompt)
    dialog("INSTALL", [`Add ${name || "this app"} to your home screen?`, "It keeps working offline."], [
      { label: "INSTALL", hot: true, onClick: () => promptInstall(name) },
      { label: "NOT NOW", alt: true },
    ]);
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
 *   browser can install it (`install: false` to never show it). It offers the
 *   hub first, then just this game (`offerHub: false` to skip the hub).
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
      b.addEventListener("click", () =>
        showInstall({ name: opts.title, hub: opts.offerHub === false ? null : opts.hub }),
      );
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
