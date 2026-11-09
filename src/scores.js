/*! @codemaku/arcade/scores — one result per round, personal and village records. © 2026 Codemaku. */

/*
 * The one way a game scores a round:
 *
 *   const r = submitScore({ game: "golf", skill: "differential", value: 11.2, better: "lower",
 *                           board: "pebble-18-t100", details: { toPar: 6, gross: 78 } },
 *                         { player: seat.id });
 *   r.personalBest  // true when it beats this player's best on that board
 *
 * - A round is ONE result: `skill` is the measure the game is about, and it is
 *   the only thing shown in MY PROGRESS. Extra numbers go in `details`.
 * - `board` is a leaderboard inside the game (a course, a level, a mode).
 *   Records are compared only on the same board. Leave it out for games with
 *   one board; the game's slug is used.
 * - Records live on the Codemaku API, so they survive a cleared or
 *   short-lived browser storage (e.g. a game running in the hub app's frame).
 *   The device keeps a cache so records show at once and offline, and a
 *   round counts towards a record the moment it's submitted.
 */

import {
  currentPlayer,
  players,
  playerApi,
  recordResult,
  onPlayersChange,
} from "./players.js";

const CACHE = "cm_records";
const EVENT = "arcade:records";

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

/** True when `a` beats `b` (`b` missing counts as beaten). */
export const beats = (a, b, better = "higher") =>
  b == null ? a != null : better === "lower" ? a < b : a > b;

const boardOf = (game, board) => String(board ?? game);
const key = (game, skill, board) => `${game}|${skill}|${boardOf(game, board)}`;

// Cache shape: { [game|skill|board]: { better, unit, me: { [playerId]: entry }, village: [entry] } }
// entry: { id, name, avatar, value, at, details, plays }
const load = () => readLocal(CACHE, {});
const store = (c) => writeLocal(CACHE, c);

function announce(game) {
  try {
    dispatchEvent(new CustomEvent(EVENT, { detail: { game } }));
  } catch {
    /* no window */
  }
}

/** Run `fn(game)` whenever records change (a round submitted or records loaded). Returns an unsubscribe. */
export function onRecordsChange(fn) {
  const h = (e) => fn(e.detail.game);
  addEventListener(EVENT, h);
  return () => removeEventListener(EVENT, h);
}

function merge(entries, better) {
  // Best entry per player, best first.
  const by = new Map();
  for (const e of entries) {
    if (!e) continue;
    const b = by.get(e.id);
    if (!b || beats(e.value, b.value, better) || (e.value === b.value && e.at < b.at)) by.set(e.id, e);
  }
  const sign = better === "lower" ? 1 : -1;
  return [...by.values()].sort((x, y) => sign * (x.value - y.value) || x.at - y.at);
}

/**
 * Score a finished round for a player (default: the current player). Returns
 * `{ id, value, personalBest, previous, villageBest }`, or null for a guest or
 * a bad result. Queued offline and sent in the background, like record().
 */
export function submitScore(result, { player } = {}) {
  const pid = player === undefined ? currentPlayer()?.id : player;
  if (!pid) return null;
  const { game, skill, board, better = "higher", unit = null, details } = result || {};
  const r = recordResult({ ...result, board: boardOf(game, board) }, { player: pid });
  if (!r) return null;
  const who = players().find((p) => p.id === pid);
  const c = load();
  const k = key(game, skill, board);
  const b = (c[k] ||= { better, unit, me: {}, village: [] });
  const previous = b.me[pid] || null;
  const villageBefore = b.village[0] || null;
  const entry = {
    id: pid,
    name: who?.name ?? "",
    avatar: who?.avatar ?? 0,
    value: r.value,
    at: r.playedAt,
    details: details ?? null,
  };
  const personalBest = beats(r.value, previous?.value, r.better);
  b.me[pid] = personalBest
    ? { ...entry, plays: (previous?.plays || 0) + 1 }
    : { ...previous, plays: (previous?.plays || 0) + 1 };
  b.village = merge([...b.village, entry], r.better).slice(0, 10);
  store(c);
  announce(game);
  return {
    id: r.id,
    value: r.value,
    personalBest,
    previous,
    villageBest: beats(r.value, villageBefore?.value, r.better),
  };
}

/**
 * Records on one board, from the device cache (instant, works offline):
 * `{ me, village, better, unit }`. `me` is the player's best with `plays`;
 * `village` is the best of each person in their village, best first, them included.
 * Call loadRecords() to refresh from the server.
 */
export function getRecords({ game, skill, board, player } = {}) {
  const pid = player === undefined ? currentPlayer()?.id : player;
  const b = load()[key(game, skill, board)];
  if (!b) return { me: null, village: [], better: null, unit: null };
  return { me: (pid && b.me[pid]) || null, village: b.village, better: b.better, unit: b.unit };
}

/** Every cached board of a game and skill: `[{ board, me, village, better, unit }]`. */
export function listRecords({ game, skill, player } = {}) {
  const pid = player === undefined ? currentPlayer()?.id : player;
  const pre = `${game}|${skill}|`;
  return Object.entries(load())
    .filter(([k]) => k.startsWith(pre))
    .map(([k, b]) => ({
      board: k.slice(pre.length),
      me: (pid && b.me[pid]) || null,
      village: b.village,
      better: b.better,
      unit: b.unit,
    }));
}

const loading = new Map();

/**
 * Fetch a player's records for a game (every board, or one) from the server
 * into the cache. Keeps anything better from rounds not sent yet. Resolves to
 * listRecords() for that player; offline it resolves to the cache.
 */
export function loadRecords({ game, skill, board, player } = {}) {
  const pid = player === undefined ? currentPlayer()?.id : player;
  if (!pid) return Promise.resolve([]);
  const k = `${pid}|${game}|${board ?? ""}`;
  if (loading.has(k)) return loading.get(k);
  const q = `/v1/records?game=${encodeURIComponent(game)}${board != null ? `&board=${encodeURIComponent(board)}` : ""}`;
  const p = playerApi("GET", q, pid)
    .then(({ boards }) => {
      const c = load();
      for (const s of boards) {
        const kk = `${game}|${s.skill}|${s.board}`;
        const old = c[kk];
        const better = s.better;
        const mineBefore = old?.me?.[pid];
        const me = { ...(old?.me || {}) };
        if (s.me) me[pid] = beats(mineBefore?.value, s.me.value, better) ? { ...mineBefore, plays: Math.max(mineBefore.plays || 0, s.me.plays) } : s.me;
        // The server's village is this player's; keep cached rounds of players on this device too.
        const local = Object.values(me);
        c[kk] = { better, unit: s.unit, me, village: merge([...s.village, ...local], better).slice(0, 10) };
      }
      store(c);
      announce(game);
    })
    .catch(() => {
      /* offline: the cache stands */
    })
    .then(() => listRecords({ game, skill, player: pid }))
    .finally(() => loading.delete(k));
  loading.set(k, p);
  return p;
}

/* ---- a ready-made records panel ------------------------------------------- */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const defaultFormat = (v, unit) => {
  const n = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${n}${unit ? (unit.length <= 2 ? unit : ` ${unit}`) : ""}`.toUpperCase();
};

/**
 * Show MY BEST and VILLAGE BEST for one board in `target` (an element or id),
 * and keep it up to date. `format(value, details)` turns a value into text.
 * Returns `{ update(options), destroy() }`.
 *
 *   mountRecords("records", { game: "golf", skill: "differential", board, format: (v, d) => toPar(d.toPar) });
 */
export function mountRecords(target, options) {
  const root = typeof target === "string" ? document.getElementById(target) : target;
  let opts = { ...options };
  const draw = () => {
    if (!root) return;
    const { game, skill, board, format, player, title } = opts;
    const pid = player === undefined ? currentPlayer()?.id : player;
    const { me, village, unit } = getRecords({ game, skill, board, player: pid });
    const fmt = (e) => (format ? format(e.value, e.details || {}) : defaultFormat(e.value, unit));
    const top = village[0];
    root.replaceChildren();
    root.classList.add("arcade-records");
    if (title) root.append(el("div", "ar-title", title));
    const row = (label, value, note) => {
      const r = el("div", "ar-row");
      r.append(el("span", "ar-label", label), el("b", "ar-value", value));
      if (note) r.append(el("i", "ar-note", note));
      root.append(r);
    };
    if (!pid) row("MY BEST", "—", "CHOOSE A PLAYER TO SAVE RECORDS");
    else row("MY BEST", me ? fmt(me) : "—", me ? `${me.plays || 1} ${me.plays === 1 ? "ROUND" : "ROUNDS"}` : "NOT PLAYED YET");
    row("VILLAGE BEST", top ? fmt(top) : "—", top ? String(top.name).toUpperCase() : "NO ONE YET");
  };
  const offR = onRecordsChange((g) => g === opts.game && draw());
  const offP = onPlayersChange(() => {
    draw();
    refresh();
  });
  const refresh = () => {
    if (opts.player !== null) loadRecords({ game: opts.game, skill: opts.skill, player: opts.player });
  };
  draw();
  refresh();
  return {
    update(next = {}) {
      const reload = next.game !== undefined && next.game !== opts.game || next.player !== undefined && next.player !== opts.player;
      opts = { ...opts, ...next };
      draw();
      if (reload) refresh();
    },
    destroy() {
      offR();
      offP();
    },
  };
}
