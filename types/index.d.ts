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
export function createPlayer(options?: { name?: string; avatar?: number }): Player;
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
/** The current player's progress screen: streak, then best / last / trend per game and skill. */
export function showProgress(): PlayersDialog | undefined;
/** The village screen: friend code, requests, friends' streaks and bests, add by code. */
export function showVillage(): PlayersDialog | undefined;
