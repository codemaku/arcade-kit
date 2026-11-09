---
"@codemaku/arcade": minor
---

Invites on the hub, rematches on the board, and the village feed.

- `rematchMatch(id, options)`: REMATCH on a finished match. The player who didn't open last time opens. The finished match gets `next` (`{ id, status, askedByMe }`), so the other player sees the invite on the board they're looking at, and their REMATCH says yes to it.
- Every match carries `record`, the running head-to-head for that game.
- `matchLink(url, id)` and `readMatchLink()`: the hub opens a match straight in its game with `?match=<id>`.
- `fetchFeed()`: finished online games (with the record after them) and new personal bests in your village. Needs the API's `GET /v1/feed`.
- MY PROGRESS per game: `showProgress({ game, title })`, and `mountHeader({ progress: "<slug>" })` adds a PROGRESS button.
- The player card has MY PROGRESS (every game).
- PLAY ONLINE says invites show up on the Codemaku hub.
