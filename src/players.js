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

const COOKIE = "cm_players";
const LOCAL = "cm_players";
const OUTBOX = "cm_outbox";
const OUTBOX_MAX = 1000;
const MAX_PLAYERS = 8;
const NAME_MAX = 12;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

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

// Shape on disk: { p: [{ i, n, a, t, r }], c: currentId }. r = registered with the API.

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

/** Make a new player on this device and make them current. Works offline. */
export function createPlayer({ name, avatar } = {}) {
  const s = load();
  if (s.p.length >= MAX_PLAYERS) throw new Error("too_many_players");
  const a = Number.isInteger(avatar) ? avatar : s.p.length % AVATAR_COLORS.length;
  const p = { i: uuid(), n: cleanName(name) || "PLAYER", a, t: newToken(), r: 0 };
  s.p.push(p);
  s.c = p.i;
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

/* ---- API ----------------------------------------------------------------- */

const raw = (p) => load().p.find((x) => x.i === p);

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
  const pid = player ?? currentPlayer()?.id;
  if (!pid || !raw(pid)) return null;
  const { game, skill, value, unit = null, better = "higher", seed, challenge } = result || {};
  if (!SLUG.test(String(game)) || !SLUG.test(String(skill)) || !Number.isFinite(value)) {
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
  };
  const box = readLocal(OUTBOX, []);
  box.push(r);
  writeLocal(OUTBOX, box.slice(-OUTBOX_MAX));
  sync();
  return r.id;
}

/** How many results are waiting to be sent from this game. */
export const unsent = () => readLocal(OUTBOX, []).length;

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

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** A square avatar: the player's colour with their initial. */
export function avatarEl(player, size = 40) {
  const a = el("span", "ap-avatar", (player?.name || "?").slice(0, 1).toUpperCase());
  a.style.background = AVATAR_COLORS[player?.avatar ?? 0] || AVATAR_COLORS[0];
  a.style.width = a.style.height = `${size}px`;
  a.style.fontSize = `${Math.round(size * 0.45)}px`;
  a.setAttribute("aria-hidden", "true");
  return a;
}

function sheet(title) {
  const ov = el("div", "arcade-overlay ah-install arcade-players");
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", title);
  ov.style.display = "flex";
  const card = el("div", "card");
  card.append(el("h2", null, title));
  ov.append(card);
  document.body.append(ov);
  return { ov, card, close: () => ov.remove() };
}

function button(label, kind, onClick) {
  const b = el("button", `btn${kind ? ` ${kind}` : ""}`, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

const errorText = (e) =>
  ({
    bad_code: "THAT CODE DIDN'T WORK. CHECK IT AND TRY AGAIN.",
    too_many_tries: "TOO MANY TRIES. WAIT A FEW MINUTES.",
    too_many_players: `THIS DEVICE HAS ${MAX_PLAYERS} PLAYERS ALREADY.`,
    self: "THAT'S YOUR OWN CODE!",
  })[e?.message] || "COULDN'T REACH CODEMAKU. ARE YOU ONLINE?";

/**
 * The "WHO'S PLAYING?" screen: pick a player, make a new one, or add one from
 * another device. Calls `onPick(player)` once someone is chosen.
 * `closable: false` hides the CLOSE button (e.g. on first launch).
 */
export function chooseWhoIsPlaying({ onPick, closable = true, title = "WHO'S PLAYING?" } = {}) {
  const d = sheet(title);
  const list = players();
  const cur = currentPlayer();
  const grid = el("div", "ap-grid");
  for (const p of list) {
    const b = button("", `ap-pick${cur?.id === p.id ? " on" : ""}`, () => {
      setCurrentPlayer(p.id);
      d.close();
      onPick?.(currentPlayer());
    });
    b.append(avatarEl(p, 44), el("span", "ap-name", p.name));
    grid.append(b);
  }
  if (list.length) d.card.append(grid);
  else d.card.append(el("p", null, "Make a player to save your scores and watch yourself improve."));
  if (list.length < MAX_PLAYERS) {
    d.card.append(
      button("+ NEW PLAYER", "hot", () => {
        d.close();
        newPlayerDialog({ onPick, closable });
      }),
      button("I PLAY ON ANOTHER DEVICE", "alt", () => {
        d.close();
        joinDialog({ onPick, closable });
      }),
    );
  }
  if (closable) d.card.append(button("CLOSE", "alt", d.close));
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

function newPlayerDialog({ onPick, closable }) {
  const d = sheet("NEW PLAYER");
  const { wrap, input } = nameField("YOUR NAME");
  const colors = avatarPicker(players().length % 8);
  const status = el("p", "ap-status");
  status.hidden = true;
  const go = () => {
    const name = cleanName(input.value);
    if (!name) {
      status.textContent = "TYPE A NAME FIRST.";
      status.hidden = false;
      return input.focus();
    }
    try {
      const p = createPlayer({ name, avatar: colors.value });
      d.close();
      onPick?.(p);
    } catch (e) {
      status.textContent = errorText(e);
      status.hidden = false;
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
  d.card.append(
    wrap,
    colors.row,
    el("p", "ap-note", "Just a name, no email. Pick a nickname, not your full name."),
    status,
    button("LET'S PLAY", "hot", go),
    button("BACK", "alt", () => {
      d.close();
      chooseWhoIsPlaying({ onPick, closable });
    }),
  );
  input.focus();
}

function joinDialog({ onPick, closable }) {
  const d = sheet("ADD YOUR PLAYER");
  const { wrap, input } = nameField("CODE");
  input.maxLength = 24;
  input.autocomplete = "one-time-code";
  input.placeholder = "XXXX-XXXX";
  const status = el("p", "ap-status");
  status.hidden = true;
  const go = async () => {
    status.textContent = "CHECKING...";
    status.hidden = false;
    try {
      const p = await joinWithCode(input.value);
      d.close();
      onPick?.(p);
    } catch (e) {
      status.textContent = errorText(e);
    }
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
  d.card.append(
    el("p", null, "On a device you already play on, open your player and tap ADD TO ANOTHER DEVICE. Type the code here."),
    el("p", "ap-note", "Lost every device? Type your 16-character recovery code instead."),
    wrap,
    status,
    button("ADD PLAYER", "hot", go),
    button("BACK", "alt", () => {
      d.close();
      chooseWhoIsPlaying({ onPick, closable });
    }),
  );
  input.focus();
}

/**
 * The current player's card: change name or colour, add to another device,
 * save a recovery code, take them off this device, or switch player.
 */
export function showPlayerCard({ onChange } = {}) {
  const me = currentPlayer();
  if (!me) return chooseWhoIsPlaying({ onPick: onChange });
  const d = sheet("PLAYER");
  const head = el("div", "ap-head");
  head.append(avatarEl(me, 56), el("span", "ap-big", me.name));
  const info = el("p", "ap-code");
  info.textContent = "FRIEND CODE: ...";
  const status = el("p", "ap-status");
  status.hidden = true;
  const say = (t) => {
    status.textContent = t;
    status.hidden = !t;
    status.classList.add("ap-select");
  };
  fetchAccount(me.id)
    .then((a) => (info.textContent = `FRIEND CODE: ${a.friendCode}`))
    .catch(() => (info.textContent = "FRIEND CODE: GO ONLINE TO SEE IT"));

  d.card.append(
    head,
    info,
    status,
    button("SWITCH PLAYER", "hot", () => {
      d.close();
      chooseWhoIsPlaying({ onPick: onChange });
    }),
    button("EDIT NAME + COLOUR", "", () => {
      d.close();
      editDialog(me, onChange);
    }),
    button("ADD TO ANOTHER DEVICE", "", async () => {
      say("GETTING A CODE...");
      try {
        const { code } = await pairCode(me.id);
        say(`ON THE OTHER DEVICE, TAP "I PLAY ON ANOTHER DEVICE" AND TYPE ${code}. IT WORKS ONCE, FOR 10 MINUTES.`);
      } catch (e) {
        say(errorText(e));
      }
    }),
    button("SAVE A RECOVERY CODE", "", async () => {
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

/** The current player's progress: streak, then best / last / trend per game and skill. */
export function showProgress() {
  const me = currentPlayer();
  if (!me) return chooseWhoIsPlaying({ onPick: () => showProgress() });
  const d = sheet("MY PROGRESS");
  const head = el("div", "ap-head");
  head.append(avatarEl(me, 40), el("span", "ap-big", me.name));
  const body = el("div", "ap-list");
  body.append(el("p", "ap-status", "LOADING..."));
  d.card.append(head, body, button("CLOSE", "alt", d.close));
  fetchProgress(me.id)
    .then(({ streak, stats }) => {
      body.replaceChildren(el("p", "ap-streak", streakText(streak)));
      if (!stats.length) body.append(el("p", null, "No rounds yet. Play a game and your numbers show up here."));
      for (const s of stats) body.append(statRow(s));
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
        for (const s of (f.stats || []).slice(0, 3)) box.append(statRow(s, { detail: false }));
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
