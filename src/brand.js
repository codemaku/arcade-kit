/*! @codemaku/arcade/brand — Codemaku pixel wordmark + "by Codemaku" lockup. © 2026 Codemaku. */

/** Where the Codemaku link goes. Change it here and every game follows. */
export const HUB_URL = "https://codemaku.com";

// Bold 7-row glyphs with 2px strokes. X = filled. Edit a letter here and every game follows.
const FONT = {
  C: [".XXXXX", "XX....", "XX....", "XX....", "XX....", "XX....", ".XXXXX"],
  O: [".XXXX.", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", ".XXXX."],
  D: ["XXXXX.", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XXXXX."],
  E: ["XXXXXX", "XX....", "XX....", "XXXXX.", "XX....", "XX....", "XXXXXX"],
  M: ["XX...XX", "XXX.XXX", "XXXXXXX", "XX.X.XX", "XX...XX", "XX...XX", "XX...XX"],
  A: [".XXXX.", "XX..XX", "XX..XX", "XXXXXX", "XX..XX", "XX..XX", "XX..XX"],
  K: ["XX..XX", "XX.XX.", "XXXX..", "XXX...", "XXXX..", "XX.XX.", "XX..XX"],
  U: ["XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", "XX..XX", ".XXXX."],
};
const GH = 7; // glyph height
const GAP = 1; // space between letters
const PAD = 2; // space between letters and frame
const FRAME = 2; // frame thickness

// Cell kinds: f frame, m letters. Both use currentColor in the page.
const ORDER = ["f", "m"];

function build(text) {
  const kind = new Map();
  const put = (x, y, k) => kind.set(`${x},${y}`, k);
  let cx = 0;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) continue;
    g.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "X") put(cx + x, y, "m");
    });
    cx += g[0].length + GAP;
  }
  const tw = cx - GAP;
  // frame with rounded corners
  const x0 = -PAD - FRAME, y0 = -PAD - FRAME, x1 = tw - 1 + PAD + FRAME, y1 = GH - 1 + PAD + FRAME;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y1 - y);
      if (dx >= FRAME && dy >= FRAME) continue; // inside
      if (dx + dy < FRAME - 1 || (dx === 0 && dy === 0)) continue; // round corners
      put(x, y, "f");
    }
  }
  const cells = [...kind].map(([key, k]) => [...key.split(",").map(Number), k]);
  return { cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const WORD = build("CODEMAKU");
const MARK = build("C");

const escHTML = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function svg({ cells, x0, y0, w, h }) {
  const d = Object.fromEntries(ORDER.map((k) => [k, ""]));
  for (const [x, y, k] of cells) d[k] += `M${x} ${y}h1v1h-1z`;
  return (
    `<svg class="arcade-logo" viewBox="${x0} ${y0} ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">` +
    ORDER.map((k) => `<path class="${k}" d="${d[k]}"/>`).join("") +
    `</svg>`
  );
}

/** The CODEMAKU badge wordmark as an inline SVG string. Pass "mark" for the C badge. */
export function logoSVG(variant = "word") {
  return svg(variant === "mark" ? MARK : WORD);
}

/**
 * Draw the square C badge onto a canvas (`size` × `size`). Useful for
 * installPWA icons. Colours are fixed hex because canvas can't read CSS
 * variables; override b (background), f (frame) or m (letters).
 */
export function drawLogo(ctx, size, colors = {}) {
  const pal = { b: "#1b1230", f: "#ffb400", m: "#ffb400", ...colors };
  ctx.fillStyle = pal.b;
  ctx.fillRect(0, 0, size, size);
  const { cells, x0, y0, w, h } = MARK;
  const u = size / (Math.max(w, h) + 4);
  const ox = (size - w * u) / 2, oy = (size - h * u) / 2;
  for (const [x, y, k] of cells) {
    ctx.fillStyle = pal[k];
    ctx.fillRect(ox + (x - x0) * u, oy + (y - y0) * u, Math.ceil(u), Math.ceil(u));
  }
}

/**
 * Markup for "Title by CODEMAKU". Omit `title` for the bare badge.
 * The badge is always a link to `hub`.
 */
export function brandHTML({ title = "", hub = HUB_URL, newTab = false } = {}) {
  const lead = title
    ? `<span class="ab-title">${escHTML(title)}</span><span class="ab-by">by</span>`
    : "";
  const tgt = newTab ? ' target="_blank" rel="noopener"' : "";
  return (
    `<span class="arcade-brand">${lead}` +
    `<a class="ab-link" href="${escHTML(hub)}"${tgt} aria-label="Codemaku home">` +
    `${logoSVG()}</a></span>`
  );
}

/** Render the lockup into an element (or element id). Returns the element. */
export function mountBrand(target, options) {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el) return null;
  el.innerHTML = brandHTML(options);
  return el;
}
