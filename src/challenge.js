/*! @codemaku/arcade/challenge — "same round, beat my score" links. © 2026 Codemaku. */

/*
 * A challenge lives entirely in the link: `?c=<base64url JSON>`.
 * The JSON always has `s` (round seed), `n` (who set it) and `p` (their
 * score). Games add their own short fields (level, course, ...). Nothing is
 * sent anywhere: the game rebuilds the same round from the seed.
 */

const PARAM = "c";
const NAME_KEY = "arcade_name";
const NAME_MAX = 12;

/** A fresh 32-bit round seed. */
export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

/**
 * A repeatable random generator (mulberry32). Same seed, same numbers, on
 * every device. Drop-in for `Math.random`: returns floats in [0, 1).
 */
export function seededRandom(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const toB64 = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64 = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

/** Tidy a player name: letters, digits, spaces and a little punctuation, at most 12 characters. */
export const cleanName = (n) =>
  String(n ?? "")
    .replace(/[^\p{L}\p{N} .'!?-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);

/**
 * The challenge in this page's link, or null. Always has a numeric `s` and
 * `p` and a string `n` (cleaned, may be ""). Other fields come straight from
 * the link: validate them before use.
 */
export function readChallenge({ param = PARAM, url = location.href } = {}) {
  try {
    const raw = new URL(url).searchParams.get(param);
    if (!raw || raw.length > 600) return null;
    const c = JSON.parse(fromB64(raw));
    if (!c || typeof c !== "object" || Array.isArray(c)) return null;
    if (!Number.isFinite(c.s) || !Number.isFinite(c.p)) return null;
    return { ...c, s: c.s >>> 0, n: cleanName(c.n) };
  } catch {
    return null;
  }
}

/** Remove the challenge from the address bar, so a reload starts a normal game. */
export function clearChallenge({ param = PARAM } = {}) {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has(param)) return;
    u.searchParams.delete(param);
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch {
    /* history unavailable */
  }
}

/** Build a challenge link for this game. `data` needs `s` and `p`; `n` is filled from the saved name. */
export function challengeURL(data, { param = PARAM, base = location.origin + location.pathname } = {}) {
  const c = { ...data, n: cleanName(data.n ?? challengeName()) };
  const u = new URL(base);
  u.searchParams.set(param, toB64(JSON.stringify(c)));
  return u.href;
}

/** The player's saved challenge name ("" when none). */
export function challengeName() {
  try {
    return cleanName(JSON.parse(localStorage.getItem(NAME_KEY) || '""'));
  } catch {
    return "";
  }
}

/** Save the player's challenge name. Shared by every Codemaku game on this site. */
export function setChallengeName(n) {
  try {
    localStorage.setItem(NAME_KEY, JSON.stringify(cleanName(n)));
  } catch {
    /* storage blocked */
  }
}

/**
 * Share a link: the system share sheet where there is one, else the
 * clipboard. Resolves to "shared", "copied", "cancelled" or "failed".
 */
export async function shareLink({ url, text = "", title = "" }) {
  if (navigator.share) {
    try {
      await navigator.share({ url, text, title });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      /* blocked (e.g. in a frame): fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(text ? `${text} ${url}` : url);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Compare a finished round with the challenge score.
 * Returns `"won"`, `"tied"` or `"lost"`. `lower: true` for golf-style scores.
 */
export function challengeOutcome(mine, theirs, { lower = false } = {}) {
  if (mine === theirs) return "tied";
  return (lower ? mine < theirs : mine > theirs) ? "won" : "lost";
}

/* ---- dialogs ---- */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// Title, lines, an optional name field, then buttons [{ label, hot, alt, keep, onClick(name) }].
function dialog({ title, lines = [], nameField = false, name, buttons }) {
  const ov = el("div", "arcade-overlay ah-install arcade-challenge");
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", title);
  ov.style.display = "flex";
  const card = el("div", "card");
  card.append(el("h2", null, title));
  const status = el("p", "ac-status");
  for (const l of lines) card.append(el("p", null, l));
  let input = null;
  if (nameField) {
    const label = el("label", "ac-name");
    label.append(el("span", null, "YOUR NAME"));
    input = el("input");
    Object.assign(input, { type: "text", maxLength: NAME_MAX, value: cleanName(name ?? challengeName()), autocomplete: "nickname" });
    input.setAttribute("enterkeyhint", "done");
    label.append(input);
    card.append(label);
  }
  card.append(status);
  status.hidden = true;
  const close = () => ov.remove();
  const ctl = {
    close,
    say(t) {
      status.textContent = t;
      status.hidden = !t;
    },
  };
  for (const b of buttons) {
    const btn = el("button", `btn${b.hot ? " hot" : b.alt ? " alt" : ""}`, b.label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      if (!b.keep) close();
      b.onClick?.(input ? cleanName(input.value) : "", ctl);
    });
    card.append(btn);
  }
  input?.addEventListener("keydown", (e) => e.key === "Enter" && card.querySelector("button")?.click());
  ov.addEventListener("click", (e) => e.target === ov && close());
  ov.addEventListener("keydown", (e) => e.key === "Escape" && close());
  ov.append(card);
  document.body.append(ov);
  (input || card.querySelector("button"))?.focus();
  return ctl;
}

/**
 * Opened from a challenge link: say who set it and what to beat.
 * `goal` is the line under the title, e.g. "SON shot +2 on PINE VALLEY."
 */
export function showChallengeIntro({ challenge, goal, onPlay, onSkip }) {
  const who = challenge?.n || "A FRIEND";
  return dialog({
    title: "CHALLENGE!",
    lines: [`${who} sent you a challenge.`, goal, "Same round they played. Can you beat it?"].filter(Boolean),
    buttons: [
      { label: "ACCEPT", hot: true, onClick: () => onPlay?.() },
      { label: "NOT NOW", alt: true, onClick: () => onSkip?.() },
    ],
  });
}

/**
 * The share flow: ask for a name, then share the link.
 * `text(name)` is the message that goes with it, e.g. `${name} scored 42 on Math Crush. Beat it?`.
 * `data` is the challenge payload (`s`, `p`, game fields). `name` prefills
 * the name field (default: the saved name).
 */
export function offerChallenge({ data, text, name, title = "CHALLENGE A FRIEND", lines }) {
  return dialog({
    title,
    lines: lines ?? ["Send this exact round to a friend. They play it and try to beat your score."],
    nameField: true,
    name,
    buttons: [
      {
        label: "SEND LINK",
        hot: true,
        keep: true,
        async onClick(name, ctl) {
          setChallengeName(name);
          const url = challengeURL({ ...data, n: name });
          const msg = typeof text === "function" ? text(name || "I") : text || "";
          const r = await shareLink({ url, text: msg, title: document.title });
          if (r === "shared") ctl.close();
          else if (r === "copied") ctl.say("LINK COPIED. Paste it in a text or chat.");
          else if (r === "failed") ctl.say(`COPY THIS LINK: ${url}`);
        },
      },
      { label: "CLOSE", alt: true },
    ],
  });
}
