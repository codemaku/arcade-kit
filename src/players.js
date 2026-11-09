/*! @codemaku/arcade/players — profiles, "who's playing?", results and the village. © 2026 Codemaku. */

/*
 * Console-style players. A device keeps a short list of player profiles; one
 * is the current player. The list lives in a cookie on codemaku.com, so the
 * hub and every game (each on its own subdomain) see the same players. Each
 * game also keeps a copy in its own localStorage, used only if the cookie is
 * ever lost.
 *
 * A profile is { id, name, avatar } plus a secret device token. Both id and
 * token are made here, so a player can be created offline; the account is
 * registered with the API on the next sync. No email, no password.
 *
 * `record()` saves a result to this game's outbox at once and sends it in the
 * background. Results carry their own id, so a resend never duplicates.
 */

import { el, sheet, button } from "./ui.js";

const COOKIE = "cm_players";
const LOCAL = "cm_players";
const OUTBOX = "cm_outbox";
const OUTBOX_MAX = 1000;
const MAX_PLAYERS = 8;
const NAME_MAX = 12;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const BOARD = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

/** Player colours, by avatar number. */
export const AVATAR_COLORS = [
  "#ffb400", "#5cb5ff", "#ff7aa2", "#9be58f", "#ff5a36", "#b48cff", "#36d6c3", "#ffe14d",
  "#ff9f43", "#7fbcff", "#f78fb3", "#6fc15e", "#e056fd", "#c8d6e5", "#a3743b", "#f8f8f2",
];

// The Codemaku API (codemaku/api), on Codemaku's own Cloudflare account.
// An empty string keeps players and results on the device only.
const DEFAULT_API = "https://codemaku-api.codemaku.workers.dev";

let apiBase = (typeof globalThis !== "undefined" && globalThis.CODEMAKU_API) || DEFAULT_API;

/** Point the kit at another API, e.g. `http://localhost:8787` in development. */
export function configurePlayers({ api } = {}) {
  if (api) apiBase = String(api).replace(/\/+$/, "");
}

/* ---- small helpers ------------------------------------------------------- */

const cleanName = (n) =>
  String(n ?? "")
    .replace(/[^\p{L}\p{N} .'!?-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);

const uuid = () =>
  crypto.randomUUID?.() ??
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
  );

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
const dec = (s) =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    ),
  );

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

/* ---- the device's player list ------------------------------------------- */

// Shape on disk: { p: [{ i, n, a, t, r }], c: currentId, k: [pair keys] }.
// r = registered with the API; k = pairs of players already put in each
// other's village (so an unfriend in the village isn't undone).

function cookieDomain() {
  const h = location.hostname;
  return h === "codemaku.com" || h.endsWith(".codemaku.com") ? "; Domain=codemaku.com" : "";
}

function readCookie() {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
    return m ? dec(m[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(state) {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${enc(state)}; Path=/; Max-Age=34560000; SameSite=Lax${cookieDomain()}${secure}`;
  } catch {
    /* cookies blocked */
  }
}

const valid = (s) => s && Array.isArray(s.p);

function load() {
  const c = readCookie();
  if (valid(c)) return c;
  const l = readLocal(LOCAL, null);
  return valid(l) ? l : { p: [], c: null };
}

function save(state) {
  writeCookie(state); // also refreshes the cookie's lifetime
  writeLocal(LOCAL, state);
  announce(state);
}

let lastAnnounced;
function announce(state) {
  const key = JSON.stringify([state.c, state.p.map((p) => [p.i, p.n, p.a])]);
  if (key === lastAnnounced) return;
  lastAnnounced = key;
  try {
    dispatchEvent(new CustomEvent("arcade:players", { detail: { current: currentPlayer() } }));
  } catch {
    /* no window */
  }
}

const view = (p) => (p ? { id: p.i, name: p.n, avatar: p.a } : null);

/** Every player on this device. */
export const players = () => load().p.map(view);

/** Who's playing now, or null. */
export function currentPlayer() {
  const s = load();
  return view(s.p.find((p) => p.i === s.c));
}

/** Make `id` the current player (null for nobody). */
export function setCurrentPlayer(id) {
  const s = load();
  s.c = s.p.some((p) => p.i === id) ? id : null;
  save(s);
  return currentPlayer();
}

/** Run `fn(current)` whenever the players or the current player change. Returns an unsubscribe. */
export function onPlayersChange(fn) {
  const h = (e) => fn(e.detail.current);
  addEventListener("arcade:players", h);
  return () => removeEventListener("arcade:players", h);
}

/**
 * Make a new player on this device and make them current. Works offline.
 * `makeCurrent: false` adds them without switching (e.g. Player 2 in a game).
 */
export function createPlayer({ name, avatar, makeCurrent = true } = {}) {
  const s = load();
  if (s.p.length >= MAX_PLAYERS) throw new Error("too_many_players");
  const a = Number.isInteger(avatar) ? avatar : s.p.length % AVATAR_COLORS.length;
  const p = { i: uuid(), n: cleanName(name) || "PLAYER", a, t: newToken(), r: 0 };
  s.p.push(p);
  if (makeCurrent || !s.c) s.c = p.i;
  save(s);
  sync();
  return view(p);
}

/** Change a player's name or avatar here and on the server. */
export async function updatePlayer(id, { name, avatar } = {}) {
  const s = load();
  const p = s.p.find((x) => x.i === id);
  if (!p) return null;
  if (name !== undefined) p.n = cleanName(name) || p.n;
  if (Number.isInteger(avatar)) p.a = avatar;
  save(s);
  if (p.r) await api("PATCH", "/v1/me", p, { name: p.n, avatar: p.a }).catch(() => {});
  else sync();
  return view(p);
}

/** Take a player off this device. Their account and progress stay on the server. */
export async function removePlayer(id) {
  const s = load();
  const p = s.p.find((x) => x.i === id);
  if (!p) return;
  s.p = s.p.filter((x) => x.i !== id);
  if (s.c === id) s.c = null;
  s.k = (s.k || []).filter((k) => !k.split(":").includes(id.slice(0, 8)));
  save(s);
  if (p.r) await api("DELETE", "/v1/session", p).catch(() => {});
}

function addSignedIn(account, token) {
  const s = load();
  s.p = s.p.filter((x) => x.i !== account.id);
  if (s.p.length >= MAX_PLAYERS) throw new Error("too_many_players");
  s.p.push({ i: account.id, n: account.name, a: account.avatar, t: token, r: 1 });
  s.c = account.id;
  save(s);
  return view(s.p.at(-1));
}

/**
 * Add an existing player to this device with a code: an 8-character pair
 * code from another device, or a 16-character recovery code.
 */
export async function joinWithCode(code) {
  const clean = String(code ?? "").replace(/[^A-Za-z0-9]/g, "");
  const token = newToken();
  const path = clean.length > 8 ? "/v1/recover" : "/v1/pair/claim";
  const { account } = await api("POST", path, null, { code: clean, token });
  sync();
  return addSignedIn(account, token);
}

/** A random colour no one on this device has yet (any colour once all 8 are taken). */
export function freeAvatar() {
  const used = new Set(load().p.map((p) => p.a));
  const free = [...Array(8).keys()].filter((i) => !used.has(i));
  const pool = free.length ? free : [...Array(8).keys()];
  return pool[crypto.getRandomValues(new Uint8Array(1))[0] % pool.length];
}

/**
 * Sign this device in to a player who plays somewhere else: show `code`
 * (4 characters, 5 minutes) and approve it there with approveLink(). Resolves
 * `done` with the player once approved; rejects with "expired" or "cancelled".
 */
export async function startLink() {
  if (load().p.length >= MAX_PLAYERS) throw new Error("too_many_players");
  const token = newToken();
  const { code, expiresAt } = await api("POST", "/v1/link", null, { token });
  let stopped = false;
  let timer;
  const done = new Promise((resolve, reject) => {
    const poll = async () => {
      if (stopped) return reject(new Error("cancelled"));
      if (Date.now() > expiresAt) return reject(new Error("expired"));
      try {
        const { account } = await api("GET", "/v1/me", { t: token });
        const p = addSignedIn(account, token);
        sync();
        return resolve(p);
      } catch {
        /* not yet approved */
      }
      timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 2000);
  });
  return {
    code,
    expiresAt,
    done,
    cancel() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

/** On a signed-in device: approve the code another device is showing, signing it in as this player. */
export async function approveLink(code, id) {
  return playerApi("POST", "/v1/link/approve", id, { code });
}

/** Send a code to `email` to save it as the player's backup. Then verifyBackupEmail(code). */
export async function setBackupEmail(email, id) {
  return playerApi("POST", "/v1/email", id, { email });
}
export async function verifyBackupEmail(code, id) {
  return (await playerApi("POST", "/v1/email/verify", id, { code })).account;
}
export async function removeBackupEmail(id) {
  return (await playerApi("DELETE", "/v1/email", id)).account;
}

/** Email a sign-in code to a backup email. Then claimByEmail(email, code). */
export async function recoverByEmail(email) {
  return api("POST", "/v1/email/recover", null, { email });
}
/** Sign this device in to every player with that backup email. Resolves to the players added. */
export async function claimByEmail(email, code) {
  const room = Math.max(1, MAX_PLAYERS - load().p.length);
  const tokens = Array.from({ length: room }, newToken);
  const { players: got } = await api("POST", "/v1/email/claim", null, { email, code, tokens });
  if (!got.length) throw new Error("bad_code");
  const added = [];
  for (const { account, token } of got) {
    try {
      added.push(addSignedIn(account, token));
    } catch {
      /* device full */
    }
  }
  if (added[0]) setCurrentPlayer(added[0].id);
  sync();
  return added;
}

/* ---- API ----------------------------------------------------------------- */

const raw = (p) => load().p.find((x) => x.i === p);

/**
 * Call the Codemaku API as a player on this device (registering them first if
 * needed). Low level: games use record(), the scores helpers and the screens.
 */
export async function playerApi(method, path, id, body) {
  return api(method, path, await ensureRegistered(needPlayer(id)), body);
}

async function api(method, path, player, body) {
  if (!apiBase) throw new Error("offline");
  const res = await fetch(apiBase + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(player ? { Authorization: `Bearer ${player.t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Register a device-made player, if they aren't yet. Returns the raw profile. */
async function ensureRegistered(id) {
  const p = raw(id);
  if (!p) throw new Error("no_player");
  if (p.r) return p;
  const { account } = await api("POST", "/v1/accounts", null, {
    id: p.i,
    token: p.t,
    name: p.n,
    avatar: p.a,
  });
  const s = load();
  const q = s.p.find((x) => x.i === id);
  if (q) {
    q.r = 1;
    q.n = account.name;
    save(s);
  }
  return { ...p, r: 1 };
}

const needPlayer = (id) => {
  const p = id ?? currentPlayer()?.id;
  if (!p) throw new Error("no_player");
  return p;
};

/** My account: name, avatar, friend code, whether a recovery code exists. */
export async function fetchAccount(id) {
  const p = await ensureRegistered(needPlayer(id));
  return (await api("GET", "/v1/me", p)).account;
}

/** Stats per game and skill, plus the day streak. Sends unsent results first. */
export async function fetchProgress(id) {
  const pid = needPlayer(id);
  await sync().catch(() => {});
  return api("GET", "/v1/progress", await ensureRegistered(pid));
}

/** A 10-minute code that adds this player to another device. */
export async function pairCode(id) {
  return api("POST", "/v1/pair", await ensureRegistered(needPlayer(id)));
}

/** A new recovery code (the old one stops working). Show it once; it isn't stored. */
export async function recoveryCode(id) {
  return (await api("POST", "/v1/recovery", await ensureRegistered(needPlayer(id)))).code;
}

/** The village: { friends, incoming, outgoing }. Friends carry streak and 30-day bests. */
export async function fetchVillage(id) {
  return api("GET", "/v1/friends", await ensureRegistered(needPlayer(id)));
}
/** Ask someone to join your village by their friend code. */
export async function addFriend(code, id) {
  return api("POST", "/v1/friends", await ensureRegistered(needPlayer(id)), { code });
}
export async function acceptFriend(friendId, id) {
  return api("POST", `/v1/friends/${friendId}/accept`, await ensureRegistered(needPlayer(id)));
}
/** Unfriend, cancel a request, or decline one. */
export async function removeFriend(friendId, id) {
  return api("DELETE", `/v1/friends/${friendId}`, await ensureRegistered(needPlayer(id)));
}

/* ---- results ------------------------------------------------------------- */

/**
 * Save a result for the current player (or `player`). Returns the result id,
 * or null when nobody is playing or the result is invalid.
 *
 *   record({ game: "golf", skill: "spread", value: 4.2, unit: "m", better: "lower", seed })
 */
export function record(result, { player } = {}) {
  return recordResult(result, { player })?.id ?? null;
}

/** record(), returning the whole saved result. Used by submitScore(). */
export function recordResult(result, { player } = {}) {
  const pid = player ?? currentPlayer()?.id;
  if (!pid || !raw(pid)) return null;
  const { game, skill, value, unit = null, better = "higher", seed, challenge, board, details } = result || {};
  if (
    !SLUG.test(String(game)) ||
    !SLUG.test(String(skill)) ||
    !Number.isFinite(value) ||
    (board != null && !BOARD.test(String(board)))
  ) {
    console.warn("[arcade] record(): bad result", result);
    return null;
  }
  const r = {
    id: uuid(),
    player: pid,
    game,
    skill,
    value,
    unit,
    better: better === "lower" ? "lower" : "higher",
    playedAt: Date.now(),
    ...(Number.isInteger(seed) ? { seed: seed >>> 0 } : {}),
    ...(challenge ? { challenge: String(challenge) } : {}),
    ...(board != null ? { board: String(board) } : {}),
    ...(details && typeof details === "object" ? { details } : {}),
  };
  const box = readLocal(OUTBOX, []);
  box.push(r);
  writeLocal(OUTBOX, box.slice(-OUTBOX_MAX));
  sync();
  return r;
}

/** How many results are waiting to be sent from this game. */
export const unsent = () => readLocal(OUTBOX, []).length;

const pairKey = (a, b) => [a.slice(0, 8), b.slice(0, 8)].sort().join(":");

/**
 * Players on the same device are family or housemates: put each pair in each
 * other's village once. The device holds both tokens, which is the proof.
 */
async function linkDevicePlayers() {
  const reg = load().p.filter((p) => p.r);
  for (let i = 0; i < reg.length; i++)
    for (let j = i + 1; j < reg.length; j++) {
      const key = pairKey(reg[i].i, reg[j].i);
      if ((load().k || []).includes(key)) continue;
      await api("POST", "/v1/friends/device", reg[i], { token: reg[j].t });
      const s = load();
      s.k = [...new Set([...(s.k || []), key])];
      save(s);
    }
}

let syncing = null;

/**
 * Register new players and send waiting results. Runs on its own after
 * record(), when the page comes online or back into view; safe to call any time.
 */
export function sync() {
  if (!apiBase) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    // Yield first: with nothing to send this body would otherwise finish before
    // `syncing` is assigned, leaving a stale promise that blocks every later sync.
    await null;
    try {
      const s = load();
      for (const p of s.p) if (!p.r) await ensureRegistered(p.i).catch(() => {});
      await linkDevicePlayers().catch(() => {});
      let box = readLocal(OUTBOX, []);
      const byPlayer = new Map();
      for (const r of box) {
        if (!byPlayer.has(r.player)) byPlayer.set(r.player, []);
        byPlayer.get(r.player).push(r);
      }
      for (const [pid, list] of byPlayer) {
        const p = raw(pid);
        if (!p) {
          // Removed from this device: keep their results until they're back or the outbox fills.
          continue;
        }
        if (!p.r) continue;
        for (let i = 0; i < list.length; i += 200) {
          const chunk = list.slice(i, i + 200);
          const { accepted, rejected } = await api("POST", "/v1/results", p, {
            results: chunk.map(({ player, ...r }) => r),
          });
          const done = new Set([...accepted, ...rejected]);
          box = readLocal(OUTBOX, []).filter((r) => !done.has(r.id));
          writeLocal(OUTBOX, box);
        }
      }
    } catch {
      /* offline or server down: try again later */
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

if (typeof window !== "undefined") {
  // Once after load: send anything left from last time and link device players.
  setTimeout(() => load().p.length && sync(), 1500);
  addEventListener("online", () => sync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const s = load();
      if (s.p.length) save(s); // keep the shared cookie fresh (Safari caps script cookies)
      sync();
    }
  });
}

/* ---- dialogs ------------------------------------------------------------- */

/** A square avatar: the player's colour with their initial. */
export function avatarEl(player, size = 40) {
  const a = el("span", "ap-avatar", (player?.name || "?").slice(0, 1).toUpperCase());
  a.style.background = AVATAR_COLORS[player?.avatar ?? 0] || AVATAR_COLORS[0];
  a.style.width = a.style.height = `${size}px`;
  a.style.fontSize = `${Math.round(size * 0.45)}px`;
  a.setAttribute("aria-hidden", "true");
  return a;
}

const errorText = (e) =>
  ({
    bad_code: "THAT CODE DIDN'T WORK. CHECK IT AND TRY AGAIN.",
    bad_email: "THAT EMAIL DOESN'T LOOK RIGHT.",
    too_many_tries: "TOO MANY TRIES. WAIT A FEW MINUTES.",
    too_many_players: `THIS DEVICE HAS ${MAX_PLAYERS} PLAYERS ALREADY.`,
    expired: "THAT CODE RAN OUT. HERE'S A NEW ONE.",
    email_failed: "COULDN'T SEND THE EMAIL. TRY AGAIN SOON.",
    email_off: "EMAIL ISN'T SET UP YET. USE A CODE FROM ANOTHER DEVICE.",
    self: "THAT'S YOUR OWN CODE!",
  })[e?.message] || "COULDN'T REACH CODEMAKU. ARE YOU ONLINE?";

function statusLine() {
  const status = el("p", "ap-status");
  status.hidden = true;
  const say = (t) => {
    status.textContent = t || "";
    status.hidden = !t;
  };
  return { status, say };
}

/**
 * The quick "new player" row: type a name, go. A colour is picked for them
 * (they can change it on their player card). Calls `onMade(player)`.
 */
function quickName({ label = "NEW PLAYER", go = "LET'S PLAY", makeCurrent = true, onMade }) {
  const { wrap, input } = nameField(label);
  input.placeholder = "YOUR NAME";
  const { status, say } = statusLine();
  const submit = () => {
    const name = cleanName(input.value);
    if (!name) {
      say("TYPE A NAME FIRST.");
      return input.focus();
    }
    try {
      onMade(createPlayer({ name, avatar: freeAvatar(), makeCurrent }));
    } catch (e) {
      say(errorText(e));
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
  return { nodes: [wrap, status, button(go, "hot", submit)], input };
}

/**
 * The "WHO'S PLAYING?" screen: tap a player, or type a name to start, or
 * sign in a player from another device. Calls `onPick(player)` once someone
 * is chosen. `closable: false` hides the CLOSE button (e.g. on first launch).
 */
export function chooseWhoIsPlaying({ onPick, closable = true, title = "WHO'S PLAYING?" } = {}) {
  const d = sheet(title);
  const list = players();
  const cur = currentPlayer();
  const done = (p) => {
    d.close();
    onPick?.(p);
  };
  if (list.length) {
    const grid = el("div", "ap-grid");
    for (const p of list) {
      const b = button("", `ap-pick${cur?.id === p.id ? " on" : ""}`, () => done(setCurrentPlayer(p.id)));
      b.append(avatarEl(p, 44), el("span", "ap-name", p.name));
      grid.append(b);
    }
    d.card.append(grid);
  }
  let input;
  if (list.length < MAX_PLAYERS) {
    const q = quickName({ label: list.length ? "OR A NEW PLAYER" : "WHAT'S YOUR NAME?", onMade: done });
    input = q.input;
    d.card.append(...q.nodes);
    if (!list.length) d.card.append(el("p", "ap-note", "Just a name, no email or password. Pick a nickname."));
    d.card.append(
      button("I PLAY ON ANOTHER DEVICE", "alt", () => {
        d.close();
        linkDialog({ onPick, back: () => chooseWhoIsPlaying({ onPick, closable, title }) });
      }),
    );
  }
  if (closable) d.card.append(button("CLOSE", "alt", d.close));
  if (!list.length) input?.focus();
  return d;
}

/**
 * Pick who sits in a seat other than the current player's (Player 2, 3...):
 * a player on this device, a new player typed in right here (without
 * switching who's playing on the device), or a guest whose rounds aren't saved.
 * Calls `onPick(seat)` with `{ id, name, avatar, guest }` (`id` null for a guest).
 */
export function pickPlayer({ onPick, exclude = [], title = "WHO'S PLAYING?", guest = true } = {}) {
  const d = sheet(title);
  const skip = new Set(exclude.filter(Boolean));
  const list = players().filter((p) => !skip.has(p.id));
  const done = (seat) => {
    d.close();
    onPick?.(seat);
  };
  if (list.length) {
    const grid = el("div", "ap-grid");
    for (const p of list) {
      const b = button("", "ap-pick", () => done({ ...p, guest: false }));
      b.append(avatarEl(p, 44), el("span", "ap-name", p.name));
      grid.append(b);
    }
    d.card.append(grid);
  }
  if (players().length < MAX_PLAYERS) {
    const q = quickName({
      label: list.length ? "OR A NEW PLAYER" : "NAME",
      go: "ADD PLAYER",
      makeCurrent: false,
      onMade: (p) => done({ ...p, guest: false }),
    });
    d.card.append(...q.nodes);
  }
  if (guest)
    d.card.append(
      button("PLAY AS GUEST", "alt", () => done({ id: null, name: "GUEST", avatar: 0, guest: true })),
      el("p", "ap-note", "Guest rounds count in this game but aren't saved to anyone's progress."),
    );
  d.card.append(button("CANCEL", "alt", d.close));
  return d;
}

function avatarPicker(selected) {
  const row = el("div", "ap-colors");
  row.setAttribute("role", "radiogroup");
  row.setAttribute("aria-label", "Colour");
  let value = selected;
  const pick = (i) => {
    value = i;
    for (const [j, b] of [...row.children].entries()) b.setAttribute("aria-checked", String(j === i));
  };
  AVATAR_COLORS.slice(0, 8).forEach((c, i) => {
    const b = el("button", "ap-color");
    b.type = "button";
    b.style.background = c;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Colour ${i + 1}`);
    b.addEventListener("click", () => pick(i));
    row.append(b);
  });
  pick(selected);
  return { row, get value() { return value; } };
}

function nameField(label, value = "") {
  const wrap = el("label", "ap-field");
  wrap.append(el("span", null, label));
  const input = el("input");
  Object.assign(input, { type: "text", maxLength: NAME_MAX, value, autocomplete: "nickname" });
  input.setAttribute("enterkeyhint", "done");
  wrap.append(input);
  return { wrap, input };
}

/**
 * On the new device: show a 4-character code and wait for a signed-in device
 * to approve it. Offers the backup email and the recovery code instead.
 */
function linkDialog({ onPick, back }) {
  const d = sheet("SIGN IN");
  const code = el("p", "ap-bigcode", "····");
  code.setAttribute("aria-live", "polite");
  const { status, say } = statusLine();
  let link = null;
  const stop = () => link?.cancel();
  const close = () => {
    stop();
    d.close();
  };
  const begin = async () => {
    stop();
    code.textContent = "····";
    say("GETTING A CODE...");
    try {
      link = await startLink();
      code.textContent = link.code;
      say("WAITING FOR YOUR OTHER DEVICE...");
      const p = await link.done;
      close();
      onPick?.(p);
    } catch (e) {
      if (e.message === "cancelled") return;
      if (e.message === "expired") return begin();
      say(errorText(e));
    }
  };
  d.card.append(
    el("p", null, "On a device where you already play, open your player, tap SIGN IN ANOTHER DEVICE and type:"),
    code,
    status,
    button("USE MY BACKUP EMAIL", "", () => {
      close();
      emailSignInDialog({ onPick, back: () => linkDialog({ onPick, back }) });
    }),
    button("USE A RECOVERY CODE", "alt", () => {
      close();
      recoveryDialog({ onPick, back: () => linkDialog({ onPick, back }) });
    }),
    button("BACK", "alt", () => {
      close();
      back?.();
    }),
  );
  begin();
}

function codeField(label, { max = 8, placeholder = "", numeric = false } = {}) {
  const { wrap, input } = nameField(label);
  input.maxLength = max;
  input.placeholder = placeholder;
  input.autocomplete = "one-time-code";
  if (numeric) input.inputMode = "numeric";
  input.style.textTransform = "uppercase";
  return { wrap, input };
}

function emailField(label) {
  const { wrap, input } = nameField(label);
  Object.assign(input, { type: "email", maxLength: 254, autocomplete: "email", placeholder: "you@example.com" });
  input.style.textTransform = "none";
  return { wrap, input };
}

/** New device: get a code by email and sign in every player saved with that email. */
function emailSignInDialog({ onPick, back }) {
  const d = sheet("SIGN IN BY EMAIL");
  const mail = emailField("YOUR BACKUP EMAIL");
  const code = codeField("CODE FROM THE EMAIL", { max: 6, placeholder: "123456", numeric: true });
  code.wrap.hidden = true;
  const { status, say } = statusLine();
  const send = button("SEND ME A CODE", "hot", async () => {
    say("SENDING...");
    try {
      const r = await recoverByEmail(mail.input.value);
      say(`IF ${r.hint} IS A BACKUP EMAIL, A CODE IS ON ITS WAY. CHECK YOUR INBOX.`);
      if (r.devCode) code.input.value = r.devCode; // local development only
      code.wrap.hidden = false;
      go.hidden = false;
      code.input.focus();
    } catch (e) {
      say(errorText(e));
    }
  });
  const go = button("SIGN IN", "hot", async () => {
    say("CHECKING...");
    try {
      const added = await claimByEmail(mail.input.value, code.input.value);
      d.close();
      onPick?.(added[0]);
    } catch (e) {
      say(errorText(e));
    }
  });
  go.hidden = true;
  mail.input.addEventListener("keydown", (e) => e.key === "Enter" && send.click());
  code.input.addEventListener("keydown", (e) => e.key === "Enter" && go.click());
  d.card.append(
    el("p", null, "Every player saved with this email comes back on this device."),
    mail.wrap,
    send,
    code.wrap,
    go,
    status,
    button("BACK", "alt", () => {
      d.close();
      back?.();
    }),
  );
  mail.input.focus();
}

function recoveryDialog({ onPick, back }) {
  const d = sheet("RECOVERY CODE");
  const { wrap, input } = codeField("16-CHARACTER CODE", { max: 24, placeholder: "XXXX-XXXX-XXXX-XXXX" });
  const { status, say } = statusLine();
  const go = async () => {
    say("CHECKING...");
    try {
      const p = await joinWithCode(input.value);
      d.close();
      onPick?.(p);
    } catch (e) {
      say(errorText(e));
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
  d.card.append(
    wrap,
    status,
    button("SIGN IN", "hot", go),
    button("BACK", "alt", () => {
      d.close();
      back?.();
    }),
  );
  input.focus();
}

/** Signed-in device: type the code another device shows to sign it in as me. */
function approveDialog(me, back) {
  const d = sheet("SIGN IN ANOTHER DEVICE");
  const { wrap, input } = codeField("CODE ON THE OTHER DEVICE", { max: 4, placeholder: "K7QF" });
  input.classList.add("ap-bigcode");
  const { status, say } = statusLine();
  const go = async () => {
    if (input.value.replace(/[^A-Za-z0-9]/g, "").length !== 4) return say("TYPE THE 4 CHARACTERS.");
    say("SIGNING IN...");
    try {
      await approveLink(input.value, me.id);
      say(`DONE! ${me.name} IS PLAYING ON THE OTHER DEVICE NOW.`);
      input.value = "";
    } catch (e) {
      say(errorText(e));
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
  d.card.append(
    el("p", null, `On the new device, tap I PLAY ON ANOTHER DEVICE. Type the code it shows to sign in ${me.name} there.`),
    wrap,
    status,
    button("SIGN IN", "hot", go),
    button("BACK", "alt", () => {
      d.close();
      back();
    }),
  );
  input.focus();
}

/** Save, change or remove the player's backup email. */
function emailDialog(me, hint, back) {
  const d = sheet("BACKUP EMAIL");
  const mail = emailField(hint ? "NEW EMAIL" : "EMAIL");
  const code = codeField("CODE FROM THE EMAIL", { max: 6, placeholder: "123456", numeric: true });
  code.wrap.hidden = true;
  const { status, say } = statusLine();
  const save = button("SAVE", "hot", async () => {
    say("CHECKING...");
    try {
      const a = await verifyBackupEmail(code.input.value, me.id);
      say(`SAVED: ${a.emailHint}. USE IT TO GET ${me.name} BACK ON A NEW DEVICE.`);
      code.wrap.hidden = true;
      save.hidden = true;
    } catch (e) {
      say(errorText(e));
    }
  });
  save.hidden = true;
  const send = button("SEND A CODE", hint ? "" : "hot", async () => {
    say("SENDING...");
    try {
      const r = await setBackupEmail(mail.input.value, me.id);
      say(`CODE SENT TO ${r.hint}. TYPE IT BELOW.`);
      if (r.devCode) code.input.value = r.devCode; // local development only
      code.wrap.hidden = false;
      save.hidden = false;
      code.input.focus();
    } catch (e) {
      say(errorText(e));
    }
  });
  mail.input.addEventListener("keydown", (e) => e.key === "Enter" && send.click());
  code.input.addEventListener("keydown", (e) => e.key === "Enter" && save.click());
  d.card.append(
    el("p", null, hint
      ? `${me.name}'s backup email is ${hint}.`
      : `Optional. If you lose this device, a code sent to this email brings ${me.name} back. One email can back up the whole family.`),
    el("p", "ap-note", "Codemaku keeps only a scrambled copy of the address, never sends anything else."),
    mail.wrap,
    send,
    code.wrap,
    save,
    status,
  );
  if (hint)
    d.card.append(
      button("REMOVE BACKUP EMAIL", "alt", async () => {
        try {
          await removeBackupEmail(me.id);
          d.close();
          back();
        } catch (e) {
          say(errorText(e));
        }
      }),
    );
  d.card.append(
    button("BACK", "alt", () => {
      d.close();
      back();
    }),
  );
  mail.input.focus();
}

/**
 * The current player's card: switch, change name or colour, sign in another
 * device, backup email or recovery code, take them off this device.
 */
export function showPlayerCard({ onChange } = {}) {
  const me = currentPlayer();
  if (!me) return chooseWhoIsPlaying({ onPick: onChange });
  const d = sheet("PLAYER");
  const head = el("div", "ap-head");
  head.append(avatarEl(me, 56), el("span", "ap-big", me.name));
  const info = el("p", "ap-code", "FRIEND CODE: ...");
  const { status, say } = statusLine();
  status.classList.add("ap-select");
  const reopen = () => showPlayerCard({ onChange });
  let hint = null;
  const emailBtn = button("BACKUP EMAIL", "", () => {
    d.close();
    emailDialog(me, hint, reopen);
  });
  fetchAccount(me.id)
    .then((a) => {
      info.textContent = `FRIEND CODE: ${a.friendCode}`;
      hint = a.emailHint;
      emailBtn.textContent = hint ? `BACKUP EMAIL: ${hint}` : "ADD A BACKUP EMAIL";
    })
    .catch(() => (info.textContent = "FRIEND CODE: GO ONLINE TO SEE IT"));

  d.card.append(
    head,
    info,
    status,
    button("SWITCH PLAYER", "hot", () => {
      d.close();
      chooseWhoIsPlaying({ onPick: onChange });
    }),
    button("MY PROGRESS", "", () => {
      d.close();
      showProgress();
    }),
    button("EDIT NAME + COLOUR", "", () => {
      d.close();
      editDialog(me, onChange);
    }),
    button("SIGN IN ANOTHER DEVICE", "", () => {
      d.close();
      approveDialog(me, reopen);
    }),
    emailBtn,
    button("SAVE A RECOVERY CODE", "alt", async () => {
      say("GETTING A CODE...");
      try {
        const code = await recoveryCode(me.id);
        say(`YOUR RECOVERY CODE: ${code}  WRITE IT DOWN OR SCREENSHOT IT. IT BRINGS BACK YOUR PLAYER IF YOU LOSE YOUR DEVICE. ANY OLD CODE NO LONGER WORKS.`);
      } catch (e) {
        say(errorText(e));
      }
    }),
    button("REMOVE FROM THIS DEVICE", "alt", () => {
      d.close();
      confirmRemove(me, onChange);
    }),
    button("CLOSE", "alt", d.close),
  );
}

function editDialog(me, onChange) {
  const d = sheet("EDIT PLAYER");
  const { wrap, input } = nameField("NAME", me.name);
  const colors = avatarPicker(me.avatar ?? 0);
  d.card.append(
    wrap,
    colors.row,
    button("SAVE", "hot", async () => {
      await updatePlayer(me.id, { name: input.value, avatar: colors.value });
      d.close();
      onChange?.(currentPlayer());
    }),
    button("CANCEL", "alt", d.close),
  );
  input.focus();
}

function confirmRemove(me, onChange) {
  const d = sheet("REMOVE PLAYER?");
  d.card.append(
    el("p", null, `${me.name} comes off this device. Their scores are kept: add them back any time with a code from another device or their recovery code.`),
    button("REMOVE", "hot", async () => {
      await removePlayer(me.id);
      d.close();
      chooseWhoIsPlaying({ onPick: onChange });
    }),
    button("CANCEL", "alt", d.close),
  );
}

/* ---- progress and village screens ----------------------------------------- */

const label = (s) => String(s).replace(/[-_]+/g, " ").toUpperCase();
const fmt = (v, unit) => {
  const n = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${n}${unit ? (unit.length <= 2 ? unit : ` ${unit}`) : ""}`.toUpperCase();
};

/** Compare the newer half of recent rounds with the older half. */
function trend(stat) {
  const vals = (stat.recent || []).map((p) => p[1]);
  if (vals.length < 4) return null;
  const half = Math.floor(vals.length / 2);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const before = avg(vals.slice(0, half));
  const after = avg(vals.slice(-half));
  if (!before) return null;
  let pct = ((after - before) / Math.abs(before)) * 100;
  if (stat.better === "lower") pct = -pct;
  pct = Math.round(pct);
  return pct === 0 ? "SAME AS BEFORE" : pct > 0 ? `▲ ${pct}% BETTER` : `▼ ${-pct}% WORSE`;
}

/**
 * One stat per game: the measure it records each round. A game that once
 * recorded several measures per round shows only its main one, the measure
 * played most recently (then the most played).
 */
export function perGame(stats) {
  const by = new Map();
  for (const s of stats) {
    const b = by.get(s.game);
    if (!b || s.lastAt > b.lastAt || (s.lastAt === b.lastAt && s.plays > b.plays)) by.set(s.game, s);
  }
  return [...by.values()].sort((a, b) => b.lastAt - a.lastAt);
}

function statRow(stat, { detail = true } = {}) {
  const row = el("div", "ap-stat");
  row.append(el("b", null, `${label(stat.game)} · ${label(stat.skill)}`));
  const bits = [`BEST ${fmt(stat.best, stat.unit)}`];
  if (detail && stat.latest != null) bits.push(`LAST ${fmt(stat.latest, stat.unit)}`);
  bits.push(`${stat.plays} ${stat.plays === 1 ? "ROUND" : "ROUNDS"}`);
  row.append(el("span", null, bits.join("  ")));
  const t = detail && trend(stat);
  if (t) row.append(el("span", `ap-trend${t.startsWith("▼") ? " down" : ""}`, t));
  return row;
}

const streakText = (n) => (n ? `STREAK: ${n} ${n === 1 ? "DAY" : "DAYS"}` : "NO STREAK YET. PLAY TODAY!");

/**
 * The current player's progress: streak, then best / last / trend per game.
 * With `game`, only that game, every measure it has recorded (a game's own
 * PROGRESS button). `title` names the game in the heading.
 */
export function showProgress({ game, title } = {}) {
  const me = currentPlayer();
  if (!me) return chooseWhoIsPlaying({ onPick: (p) => p && showProgress({ game, title }) });
  const d = sheet(game ? `MY PROGRESS · ${String(title || label(game)).toUpperCase()}` : "MY PROGRESS");
  const head = el("div", "ap-head");
  head.append(avatarEl(me, 40), el("span", "ap-big", me.name));
  const body = el("div", "ap-list");
  body.append(el("p", "ap-status", "LOADING..."));
  d.card.append(head, body, button("CLOSE", "alt", d.close));
  fetchProgress(me.id)
    .then(({ streak, stats }) => {
      body.replaceChildren(el("p", "ap-streak", streakText(streak)));
      const games = game ? stats.filter((s) => s.game === game) : perGame(stats);
      if (!games.length)
        body.append(el("p", null, game ? "No rounds yet. Finish one and your numbers show up here." : "No rounds yet. Play a game and your numbers show up here."));
      for (const s of games) body.append(statRow(s));
    })
    .catch((e) => body.replaceChildren(el("p", "ap-status", errorText(e))));
  return d;
}

/** The village: your friend code, requests, and friends with their streaks and bests. */
export function showVillage() {
  const me = currentPlayer();
  if (!me) return chooseWhoIsPlaying({ onPick: () => showVillage() });
  const d = sheet("MY VILLAGE");
  const codeLine = el("p", "ap-code ap-select", "YOUR FRIEND CODE: ...");
  const body = el("div", "ap-list");
  const { wrap, input } = nameField("ADD SOMEONE BY THEIR FRIEND CODE");
  input.maxLength = 12;
  input.placeholder = "XXXX-XXXX";
  const status = el("p", "ap-status");
  status.hidden = true;
  const say = (t) => {
    status.textContent = t;
    status.hidden = !t;
  };

  const draw = async () => {
    try {
      const [acct, v] = await Promise.all([fetchAccount(me.id), fetchVillage(me.id)]);
      codeLine.textContent = `YOUR FRIEND CODE: ${acct.friendCode}`;
      body.replaceChildren();
      for (const p of v.incoming) {
        const row = el("div", "ap-friend");
        row.append(avatarEl(p, 28), el("span", "ap-name", `${p.name} WANTS TO JOIN`));
        row.append(
          button("YES", "mini hot", async () => {
            await acceptFriend(p.id, me.id).catch((e) => say(errorText(e)));
            draw();
          }),
          button("NO", "mini alt", async () => {
            await removeFriend(p.id, me.id).catch((e) => say(errorText(e)));
            draw();
          }),
        );
        body.append(row);
      }
      for (const f of v.friends) {
        const box = el("div", "ap-stat");
        const row = el("div", "ap-friend");
        row.append(avatarEl(f, 28), el("span", "ap-name", f.name));
        box.append(row, el("span", "ap-streak", streakText(f.streak)));
        for (const s of perGame(f.stats || []).slice(0, 3)) box.append(statRow(s, { detail: false }));
        body.append(box);
      }
      for (const p of v.outgoing) {
        const row = el("div", "ap-friend");
        row.append(avatarEl(p, 28), el("span", "ap-name", `WAITING FOR ${p.name}`));
        body.append(row);
      }
      if (!body.children.length)
        body.append(el("p", null, "Your village is empty. Swap friend codes with family and friends to see each other's streaks and bests."));
    } catch (e) {
      body.replaceChildren(el("p", "ap-status", errorText(e)));
    }
  };

  const add = async () => {
    say("SENDING...");
    try {
      const r = await addFriend(input.value, me.id);
      input.value = "";
      say(r.status === "accepted" ? `${r.friend.name} IS IN YOUR VILLAGE!` : `ASKED ${r.friend.name}. THEY NEED TO SAY YES.`);
      draw();
    } catch (e) {
      say(errorText(e));
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && add());

  body.append(el("p", "ap-status", "LOADING..."));
  d.card.append(codeLine, body, wrap, status, button("ADD TO VILLAGE", "hot", add), button("CLOSE", "alt", d.close));
  draw();
  return d;
}
