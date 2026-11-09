/*! @codemaku/arcade/matches — online play against your village. © 2026 Codemaku. */

/*
 * Turn-based online matches between players in the same village. The
 * Codemaku API keeps the moves and checks them with the game's rules, so the
 * game only draws the board and sends moves:
 *
 *   showOnlinePlay({ game: "gomoku", newOptions: () => ({ blocked, first }), onOpen: openMatch });
 *
 *   const stop = watchMatch(match.id, (m) => draw(m));   // live while both are here
 *   await sendMove(match, { row, col });                 // throws "not_your_turn", "taken", "stale"...
 *
 * A match is { id, game, options, moves: [{ seat, move, at }], status
 * ("invited" | "active" | "done" | "declined"), turn, winner (1, 2, 0 = draw),
 * endedBy ("win" | "draw" | "resign"), version, seat (mine), players: { 1, 2 },
 * opponent, yourTurn }. Seat 1 is whoever asked.
 */

import { currentPlayer, chooseWhoIsPlaying, fetchVillage, playerApi, avatarEl, showVillage } from "./players.js";
import { el, sheet, button } from "./ui.js";

const need = () => {
  const me = currentPlayer();
  if (!me) throw new Error("no_player");
  return me.id;
};

/** Ask someone in your village to play. Resolves to the new match (status "invited"). */
export async function createMatch({ game, opponent, options = {} }) {
  return (await playerApi("POST", "/v1/matches", need(), { game, opponent, options })).match;
}
/** My open matches and ones finished in the last two weeks, plus `records[opponentId]` = { won, lost, drawn }. */
export async function listMatches(game) {
  return playerApi("GET", `/v1/matches${game ? `?game=${encodeURIComponent(game)}` : ""}`, need());
}
export async function getMatch(id) {
  return (await playerApi("GET", `/v1/matches/${id}`, need())).match;
}
export async function acceptMatch(id) {
  return (await playerApi("POST", `/v1/matches/${id}/accept`, need())).match;
}
/** Say no to an invite, or take back one you sent. */
export async function declineMatch(id) {
  return (await playerApi("POST", `/v1/matches/${id}/decline`, need())).match;
}
/** Play a move on the match as you last saw it. Resolves to the updated match. */
export async function sendMove(match, move) {
  return (await playerApi("POST", `/v1/matches/${match.id}/move`, need(), { v: match.version, move })).match;
}
export async function resignMatch(id) {
  return (await playerApi("POST", `/v1/matches/${id}/resign`, need())).match;
}

/**
 * Keep a match up to date: calls `onChange(match)` whenever it changes, every
 * 2 seconds while the page is visible (30 when hidden). Returns stop().
 */
export function watchMatch(id, onChange, { every = 2000, hidden = 30000 } = {}) {
  let version = 0;
  let timer = null;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await playerApi("GET", `/v1/matches/${id}?v=${version}`, need());
      if (r.match && !stopped) {
        version = r.match.version;
        onChange(r.match);
      }
    } catch {
      /* offline: try again */
    }
    if (!stopped) timer = setTimeout(tick, document.visibilityState === "visible" ? every : hidden);
  };
  const wake = () => {
    if (document.visibilityState !== "visible" || stopped) return;
    clearTimeout(timer);
    tick();
  };
  document.addEventListener("visibilitychange", wake);
  tick();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    },
    /** Note a match you already have (e.g. after sendMove), so it isn't reported again. */
    seen(match) {
      version = Math.max(version, match.version);
    },
  };
}

/** How many matches are waiting on you (your turn, or an invite to answer). */
export async function waitingOnMe(game) {
  if (!currentPlayer()) return 0;
  const { matches } = await listMatches(game);
  return matches.filter((m) => m.yourTurn || (m.status === "invited" && m.seat === 2)).length;
}

/* ---- the PLAY ONLINE screen ------------------------------------------------ */

const errorText = (e) =>
  ({
    not_in_village: "YOU CAN ONLY PLAY PEOPLE IN YOUR VILLAGE.",
    too_many_matches: "THAT'S A LOT OF GAMES! FINISH SOME FIRST.",
    not_invited: "THAT INVITE IS GONE.",
  })[e?.message] || "COULDN'T REACH CODEMAKU. ARE YOU ONLINE?";

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "JUST NOW";
  if (m < 60) return `${m}M AGO`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}H AGO` : `${Math.round(h / 24)}D AGO`;
};

function resultText(m) {
  if (m.status === "declined") return m.seat === 1 ? "SAID NO" : "YOU SAID NO";
  if (m.winner === 0) return "DRAW";
  const won = m.winner === m.seat;
  return `${won ? "YOU WON" : "YOU LOST"}${m.endedBy === "resign" ? (won ? " (THEY RESIGNED)" : " (RESIGNED)") : ""}`;
}

/**
 * The PLAY ONLINE screen for a game: games waiting on you first, then theirs,
 * invites, a NEW GAME button that lists your village, and recent results with
 * your head-to-head record. `newOptions()` makes a fresh game's options (the
 * board, who opens). `onOpen(match)` opens a match in the game. Refreshes
 * itself every few seconds while open. Returns { close() }.
 */
export function showOnlinePlay({ game, title = "PLAY ONLINE", newOptions = () => ({}), onOpen } = {}) {
  if (!currentPlayer()) {
    chooseWhoIsPlaying({ onPick: (p) => p && showOnlinePlay({ game, title, newOptions, onOpen }) });
    return { close() {} };
  }
  const d = sheet(title);
  const body = el("div", "ap-list");
  const status = el("p", "ap-status");
  status.hidden = true;
  const say = (t) => {
    status.textContent = t || "";
    status.hidden = !t;
  };
  let timer = null;
  const close = () => {
    clearTimeout(timer);
    d.close();
  };
  const open = (m) => {
    close();
    onOpen?.(m);
  };

  const row = (m, records, actions) => {
    const r = el("div", "ap-friend am-row");
    const rec = records[m.opponent.id];
    const sub = rec ? `YOU ${rec.won} · ${m.opponent.name.toUpperCase()} ${rec.lost}${rec.drawn ? ` · ${rec.drawn} DRAWN` : ""}` : "FIRST GAME";
    const text = el("span", "ap-name");
    text.append(el("b", null, m.opponent.name), el("i", "am-sub", sub));
    r.append(avatarEl(m.opponent, 28), text, ...actions);
    return r;
  };
  const section = (label, rows) => {
    if (!rows.length) return;
    body.append(el("div", "am-head", label), ...rows);
  };

  const draw = async () => {
    try {
      const { matches, records } = await listMatches(game);
      body.replaceChildren();
      const mine = matches.filter((m) => m.yourTurn);
      const theirs = matches.filter((m) => m.status === "active" && !m.yourTurn);
      const asked = matches.filter((m) => m.status === "invited" && m.seat === 2);
      const sent = matches.filter((m) => m.status === "invited" && m.seat === 1);
      const done = matches.filter((m) => m.status === "done" || m.status === "declined").slice(0, 8);
      section("YOUR TURN", mine.map((m) => row(m, records, [button("PLAY", "mini hot", () => open(m))])));
      section(
        "ASKED YOU TO PLAY",
        asked.map((m) =>
          row(m, records, [
            button("YES", "mini hot", async () => {
              try {
                open(await acceptMatch(m.id));
              } catch (e) {
                say(errorText(e));
                draw();
              }
            }),
            button("NO", "mini alt", async () => {
              await declineMatch(m.id).catch((e) => say(errorText(e)));
              draw();
            }),
          ]),
        ),
      );
      section("THEIR TURN", theirs.map((m) => row(m, records, [button("WATCH", "mini alt", () => open(m))])));
      section(
        "WAITING FOR A YES",
        sent.map((m) =>
          row(m, records, [
            button("CANCEL", "mini alt", async () => {
              await declineMatch(m.id).catch((e) => say(errorText(e)));
              draw();
            }),
          ]),
        ),
      );
      section(
        "FINISHED",
        done.map((m) => {
          const r = row(m, records, [button("SEE", "mini alt", () => open(m))]);
          const sub = r.querySelector(".am-sub");
          sub.textContent = `${resultText(m)} · ${ago(m.updatedAt)}${records[m.opponent.id] ? ` · ${sub.textContent}` : ""}`;
          return r;
        }),
      );
      if (!matches.length) body.append(el("p", null, "No games yet. Tap NEW GAME to play someone in your village."));
    } catch (e) {
      body.replaceChildren(el("p", "ap-status", errorText(e)));
    }
    timer = setTimeout(draw, 5000);
  };

  const pick = async () => {
    clearTimeout(timer);
    body.replaceChildren(el("p", "ap-status", "LOADING YOUR VILLAGE..."));
    try {
      const { friends } = await fetchVillage();
      body.replaceChildren(el("div", "am-head", "WHO DO YOU WANT TO PLAY?"));
      if (!friends.length) {
        body.append(
          el("p", null, "Your village is empty. Players on this device join it on their own; add others with their friend code."),
          button("MY VILLAGE", "", () => {
            close();
            showVillage();
          }),
        );
      }
      for (const f of friends) {
        const r = el("div", "ap-friend am-row");
        r.append(
          avatarEl(f, 28),
          el("span", "ap-name", f.name),
          button("ASK", "mini hot", async () => {
            say("SENDING...");
            try {
              const m = await createMatch({ game, opponent: f.id, options: newOptions() });
              say(`ASKED ${f.name.toUpperCase()}. THEY'LL SEE IT WHEN THEY OPEN THE GAME.`);
              open(m);
            } catch (e) {
              say(errorText(e));
            }
          }),
        );
        body.append(r);
      }
      body.append(button("BACK", "alt", () => {
        say("");
        draw();
      }));
    } catch (e) {
      body.replaceChildren(el("p", "ap-status", errorText(e)));
    }
  };

  body.append(el("p", "ap-status", "LOADING..."));
  d.card.append(button("NEW GAME", "hot", pick), status, body, button("CLOSE", "alt", close));
  draw();
  return { close };
}
