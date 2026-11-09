/** @codemaku/arcade — public runtime API. */

export function $(id: string): HTMLElement | null;
export function clamp(v: number, min: number, max: number): number;
export function esc(s: unknown): string;

export function readJSON<T = unknown>(key: string, fallback?: T): T;
export function writeJSON(key: string, value: unknown): boolean;
export function removeStored(key: string): void;

export function haptic(pattern: number | number[]): void;

export interface CreateThemeOptions {
  /** localStorage key. Default `"arcade_theme"`. */
  storageKey?: string;
  /** Options in cycle order. Default `["auto", "light", "dark"]`. */
  themes?: string[];
  /** Preference used when nothing valid is stored. Default `"light"`. */
  defaultTheme?: string;
  /** Map resolved theme → `<meta name="theme-color">` value. */
  colors?: Record<string, string>;
  /** Called with the resolved theme and the stored preference. */
  onChange?: (theme: string, pref: string) => void;
}

export interface ThemeController {
  readonly pref: string;
  readonly theme: string;
  readonly themes: string[];
  apply(): string;
  cycle(): string;
  set(pref: string): string;
  destroy(): void;
}

export function createTheme(options?: CreateThemeOptions): ThemeController;

export interface InstallPWAOptions {
  name?: string;
  shortName?: string;
  background?: string;
  theme?: string;
  startUrl?: string;
  size?: number;
  /** Draw the icon onto a `size × size` canvas context. */
  icon?: (ctx: CanvasRenderingContext2D, size: number) => void;
}

export function installPWA(options?: InstallPWAOptions): boolean;

/**
 * Register the offline service worker built by `arcade({ offline: true })`.
 * Only needed with `offline: { register: false }`. Resolves to null when
 * service workers are unavailable or registration fails.
 */
export function registerOffline(options?: {
  /** Worker URL. Default `"./sw.js"`. */
  url?: string;
}): Promise<ServiceWorkerRegistration | null>;

/* ---- brand ---- */

/** Where the Codemaku link points. */
export const HUB_URL: string;
/** The sprite wrench-C as an inline SVG string (`.arcade-logo`). */
export function logoSVG(variant?: "word" | "mark"): string;
/** Draw the sprite onto a square canvas of `size` px. Colours are fixed hex. */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  size: number,
  colors?: Partial<Record<"b" | "f" | "m", string>>,
): void;
export interface BrandOptions {
  /** Game name shown before "by". Omit for the bare wordmark. */
  title?: string;
  /** Link target. Default `HUB_URL`. */
  hub?: string;
  /** Open the hub in a new tab. Default false. */
  newTab?: boolean;
}
export function brandHTML(options?: BrandOptions): string;
export function mountBrand(
  target: string | HTMLElement,
  options?: BrandOptions,
): HTMLElement | null;

/* ---- header ---- */

/** True when the game is running inside the hub's in-app game view. */
export function inHub(): boolean;
/** True when this page was opened from the hub. */
export function cameFromHub(hub?: string): boolean;
/** Close the hub's game view, or open the hub (in a new tab when `newTab`). */
export function backToHub(options?: { hub?: string; newTab?: boolean }): void;

/** True when running as an installed home-screen app. */
export function isInstalled(): boolean;
/** Not installed, not in the hub, and the browser can install. */
export function canInstall(): boolean;
/** Show the browser's install prompt, or the iOS Add to Home Screen steps. Call from a tap. */
export function promptInstall(name?: string): Promise<void>;
/**
 * The INSTALL flow. With `hub`, offers the hub first and just this app second.
 * Without it, shows the iOS steps or a dialog that opens the browser's prompt.
 */
export function showInstall(options?: { name?: string; hub?: string | null }): void;
/** Called whenever installing becomes possible or not. Returns an unsubscribe. */
export function onInstallChange(fn: () => void): () => void;

export interface HeaderAction {
  label: string;
  onClick: (e: MouseEvent) => void;
  ariaLabel?: string;
  /** Use the hot (accent red) button style. */
  hot?: boolean;
}
export interface HeaderOptions {
  /** Game name shown next to the CODEMAKU badge. */
  title?: string;
  /** Theme controller from `createTheme`. Omit to hide the theme button. */
  theme?: ThemeController;
  /** Button labels per theme preference. Default: the preference itself. */
  themeLabels?: Record<string, string>;
  /** Sound toggle. Omit to hide the sound button. */
  sound?: { get(): boolean; set(on: boolean): void };
  /** Extra game buttons, shown before sound and theme. */
  actions?: HeaderAction[];
  /** The game's slug (as given to submitScore): adds PROGRESS, which opens MY PROGRESS for this game. */
  progress?: string;
  /** Show INSTALL when installable. Default true. */
  install?: boolean;
  /** INSTALL offers the hub first (every game in one app). Default true. */
  offerHub?: boolean;
  /** Hub URL. Default `HUB_URL`. */
  hub?: string;
  /** Outside the hub's game view, open the hub in a new tab. Default true. */
  newTab?: boolean;
}
export interface HeaderController {
  readonly el: HTMLElement;
  /** Redraw, optionally with new options merged in. */
  update(options?: HeaderOptions): void;
  destroy(): void;
}
export function mountHeader(
  target: string | HTMLElement,
  options?: HeaderOptions,
): HeaderController | null;

/* ---- challenge links ---- */

/** A challenge decoded from a link: seed, sender name, score, plus game fields. */
export interface Challenge {
  /** Round seed. */
  s: number;
  /** Who set the challenge (cleaned; may be ""). */
  n: string;
  /** Their score. */
  p: number;
  [field: string]: unknown;
}
export function newSeed(): number;
/** Repeatable generator (mulberry32), drop-in for Math.random. */
export function seededRandom(seed: number | string): () => number;
export function cleanName(name: unknown): string;
export function readChallenge(options?: { param?: string; url?: string }): Challenge | null;
export function clearChallenge(options?: { param?: string }): void;
export function challengeURL(
  data: { s: number; p: number; n?: string; [field: string]: unknown },
  options?: { param?: string; base?: string },
): string;
export function challengeName(): string;
export function setChallengeName(name: string): void;
export function shareLink(options: { url: string; text?: string; title?: string }): Promise<"shared" | "copied" | "cancelled" | "failed">;
export function challengeOutcome(mine: number, theirs: number, options?: { lower?: boolean }): "won" | "tied" | "lost";
export interface ChallengeDialog {
  close(): void;
  say(text: string): void;
}
export function showChallengeIntro(options: {
  challenge: Challenge;
  goal?: string;
  onPlay?: () => void;
  onSkip?: () => void;
}): ChallengeDialog;
export function offerChallenge(options: {
  data: { s: number; p: number; [field: string]: unknown };
  text?: string | ((name: string) => string);
  /** Prefill for the name field. Default: the saved name. */
  name?: string;
  title?: string;
  lines?: string[];
}): ChallengeDialog;

/* ---- players ---- */

/** A player profile on this device. */
export interface Player {
  id: string;
  name: string;
  /** Index into AVATAR_COLORS. */
  avatar: number;
}
export const AVATAR_COLORS: string[];
/** Point the kit at the API, e.g. `http://localhost:8787` in development. */
export function configurePlayers(options: { api?: string }): void;
export function players(): Player[];
export function currentPlayer(): Player | null;
export function setCurrentPlayer(id: string | null): Player | null;
/** Runs on any change to the players or the current player. Returns an unsubscribe. */
export function onPlayersChange(fn: (current: Player | null) => void): () => void;
/** Make a player on this device (works offline) and make them current. */
export function createPlayer(options?: { name?: string; avatar?: number; makeCurrent?: boolean }): Player;
export function updatePlayer(id: string, changes: { name?: string; avatar?: number }): Promise<Player | null>;
/** Take a player off this device. Their account and progress stay on the server. */
export function removePlayer(id: string): Promise<void>;
/** Add an existing player with an 8-character pair code or 16-character recovery code. */
export function joinWithCode(code: string): Promise<Player>;

export interface ResultInput {
  /** Game slug, e.g. "golf". Lowercase letters, digits, - and _. */
  game: string;
  /** What was measured, e.g. "spread". Same rules as `game`. */
  skill: string;
  value: number;
  unit?: string | null;
  /** Default "higher". */
  better?: "higher" | "lower";
  /** Round seed, so same-round results can be compared. */
  seed?: number;
  /** Challenge id or tag, when the round came from a challenge link. */
  challenge?: string;
  /** Leaderboard inside the game: lowercase letters, digits, . - and _ (64 max). */
  board?: string;
  /** Extra numbers or short labels about the round (16 keys, 1 KB). */
  details?: Record<string, number | string | boolean>;
}
/** Save a result for the current player (or `player`) and send it in the background. Returns its id, or null. */
export function record(result: ResultInput, options?: { player?: string }): string | null;
/** Results from this game still waiting to be sent. */
export function unsent(): number;
/** Register new players and send waiting results. Safe to call any time. */
export function sync(): Promise<void>;

export interface SkillStat {
  game: string;
  skill: string;
  better: "higher" | "lower";
  unit: string | null;
  plays: number;
  best: number;
  firstAt?: number;
  lastAt: number;
  latest?: number | null;
  /** [playedAt, value] pairs, oldest first. */
  recent?: [number, number][];
}
export interface Account {
  id: string;
  name: string;
  avatar: number;
  friendCode: string;
  hasRecovery: boolean;
  /** "w•••@gmail.com" when a backup email is saved, else null. */
  emailHint: string | null;
  createdAt: number;
}
export function fetchAccount(id?: string): Promise<Account>;
export function fetchProgress(id?: string): Promise<{ streak: number; stats: SkillStat[] }>;
export function pairCode(id?: string): Promise<{ code: string; expiresAt: number }>;
export function recoveryCode(id?: string): Promise<string>;

export interface Friend extends Player {
  streak?: number;
  stats?: SkillStat[];
}
export function fetchVillage(id?: string): Promise<{ friends: Friend[]; incoming: Player[]; outgoing: Player[] }>;
export function addFriend(code: string, id?: string): Promise<{ friend: Player; status: "pending" | "accepted" }>;
export function acceptFriend(friendId: string, id?: string): Promise<{ ok: true }>;
export function removeFriend(friendId: string, id?: string): Promise<{ ok: true }>;

/** A seat in a multi-player round. `id` is null for a guest. */
export interface Seat extends Player {
  id: string | null;
  guest: boolean;
}
/** Choose Player 2 (3, 4...): a player on this device, a new one made here, or a guest. */
export function pickPlayer(options?: {
  onPick?: (seat: Seat) => void;
  /** Player ids already seated. */
  exclude?: (string | null)[];
  title?: string;
  /** Offer PLAY AS GUEST. Default true. */
  guest?: boolean;
}): PlayersDialog;
/** One stat per game: the measure it records each round. */
export function perGame(stats: SkillStat[]): SkillStat[];
/** A random colour index no player on this device has yet. */
export function freeAvatar(): number;
/** New device: get a 4-character code to show; `done` resolves once a signed-in device approves it. */
export function startLink(): Promise<{ code: string; expiresAt: number; done: Promise<Player>; cancel(): void }>;
/** Signed-in device: approve the code another device shows, signing it in as this player. */
export function approveLink(code: string, id?: string): Promise<{ ok: true; account: Player }>;
/** Send a verification code to save a backup email; then verifyBackupEmail(code). */
export function setBackupEmail(email: string, id?: string): Promise<{ sent: true; hint: string }>;
export function verifyBackupEmail(code: string, id?: string): Promise<Account>;
export function removeBackupEmail(id?: string): Promise<Account>;
/** New device: email a sign-in code to a backup email; then claimByEmail(email, code). */
export function recoverByEmail(email: string): Promise<{ sent: true; hint: string }>;
/** Sign this device in to every player saved with that email. */
export function claimByEmail(email: string, code: string): Promise<Player[]>;
/** Low-level authenticated API call as a player on this device. */
export function playerApi(method: string, path: string, id?: string, body?: unknown): Promise<any>;

/* ---- scores ---- */

export interface RecordEntry {
  id: string;
  name: string;
  avatar: number;
  value: number;
  at: number;
  details: Record<string, number | string | boolean> | null;
  plays?: number;
}
export interface BoardRecords {
  board?: string;
  me: RecordEntry | null;
  /** Best of each person in the village, best first, the player included. */
  village: RecordEntry[];
  better: "higher" | "lower" | null;
  unit: string | null;
}
export interface ScoreResult {
  id: string;
  value: number;
  personalBest: boolean;
  previous: RecordEntry | null;
  villageBest: boolean;
}
/** Score a finished round: one result. Null for a guest or a bad result. */
export function submitScore(result: ResultInput, options?: { player?: string | null }): ScoreResult | null;
export function getRecords(q: { game: string; skill: string; board?: string; player?: string | null }): BoardRecords;
export function listRecords(q: { game: string; skill: string; player?: string | null }): (BoardRecords & { board: string })[];
export function loadRecords(q: { game: string; skill: string; board?: string; player?: string | null }): Promise<(BoardRecords & { board: string })[]>;
export function onRecordsChange(fn: (game: string) => void): () => void;
export function beats(a: number | null | undefined, b: number | null | undefined, better?: "higher" | "lower"): boolean;
export function mountRecords(
  target: string | HTMLElement,
  options: {
    game: string;
    skill: string;
    board?: string;
    player?: string | null;
    title?: string;
    format?: (value: number, details: Record<string, any>) => string;
  },
): { update(options: Partial<{ game: string; skill: string; board: string; player: string | null; title: string }>): void; destroy(): void };

export interface PlayersDialog {
  close(): void;
}
/** The WHO'S PLAYING? screen. `closable: false` for first launch. */
export function chooseWhoIsPlaying(options?: {
  onPick?: (player: Player | null) => void;
  closable?: boolean;
  title?: string;
}): PlayersDialog;
/** The current player's card: switch, edit, add to another device, recovery code, remove. */
export function showPlayerCard(options?: { onChange?: (player: Player | null) => void }): void;
/** A square avatar element: the player's colour with their initial. */
export function avatarEl(player: Player | null, size?: number): HTMLSpanElement;
/** The current player's progress screen. With `game`, just that game (every measure it records). */
export function showProgress(options?: { game?: string; title?: string }): PlayersDialog | undefined;
/** The village screen: friend code, requests, friends' streaks and bests, add by code. */
export function showVillage(): PlayersDialog | undefined;

/* ---- online matches ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Match<Options = any, Move = any> {
  id: string;
  game: string;
  options: Options;
  moves: { seat: 1 | 2; move: Move; at: number }[];
  status: "invited" | "active" | "done" | "declined";
  /** Seat to move. */
  turn: 1 | 2;
  /** 1 or 2, 0 for a draw, null while playing. */
  winner: 0 | 1 | 2 | null;
  endedBy: "win" | "draw" | "resign" | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  /** My seat. Seat 1 is whoever asked. */
  seat: 1 | 2;
  players: { 1: Player; 2: Player };
  opponent: Player;
  yourTurn: boolean;
  /** All our finished games of this game, from my side, this one included once it's over. */
  record: HeadToHead;
  /** The rematch, once either player asked for one. */
  next: { id: string; status: Match["status"]; askedByMe: boolean } | null;
}
export interface HeadToHead {
  won: number;
  lost: number;
  drawn: number;
}
/** Same two players, new options; the other player opens. Says yes if they asked first. */
export function rematchMatch<O>(id: string, options?: O): Promise<Match<O>>;
export interface FeedPlayer {
  id: string;
  name: string;
  avatar: number;
}
export type FeedItem =
  | {
      id: string;
      kind: "match";
      game: string;
      at: number;
      /** The winner, or seat 1 for a draw. */
      a: FeedPlayer;
      b: FeedPlayer;
      data: { match: string; result: "win" | "draw"; by: "win" | "draw" | "resign"; moves: number; record: { a: number; b: number; drawn: number } };
    }
  | {
      id: string;
      kind: "best";
      game: string;
      at: number;
      a: FeedPlayer;
      b: null;
      data: { skill: string; board: string | null; value: number; prev: number; unit: string | null; better: "higher" | "lower"; details: Record<string, number | string | boolean> | null };
    };
/** The last two weeks in my village, newest first: finished online games and new personal bests. */
export function fetchFeed(): Promise<{ items: FeedItem[] }>;
/** `url` with `?match=<id>`, to open that match in its game. */
export function matchLink(url: string, id: string): string;
/** The match id this page was opened with (`?match=`), taken off the address bar. */
export function readMatchLink(): string | null;
export function createMatch<O>(q: { game: string; opponent: string; options?: O }): Promise<Match<O>>;
export function listMatches(game?: string): Promise<{ matches: Match[]; records: Record<string, HeadToHead> }>;
export function getMatch(id: string): Promise<Match>;
export function acceptMatch(id: string): Promise<Match>;
export function declineMatch(id: string): Promise<Match>;
/** Throws Error("not_your_turn" | "taken" | "stale" | "bad_move" | "not_active"). */
export function sendMove<O, M>(match: Match<O, M>, move: M): Promise<Match<O, M>>;
export function resignMatch(id: string): Promise<Match>;
export function watchMatch(
  id: string,
  onChange: (match: Match) => void,
  options?: { every?: number; hidden?: number },
): { stop(): void; seen(match: Match): void };
export function waitingOnMe(game?: string): Promise<number>;
export function showOnlinePlay(options: {
  game: string;
  title?: string;
  newOptions?: () => Record<string, unknown>;
  onOpen?: (match: Match) => void;
}): { close(): void };
