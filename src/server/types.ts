/**
 * Shared type definitions for the WebSocket protocol between client and server.
 */

// ── Geolocation ───────────────────────────────────────────────────────────────

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// ── Snapshot types sent over the wire ────────────────────────────────────────

export interface PlayerInfo {
  id: string;
  username: string;
  x: number;
  y: number;
  currentTask: ActiveTask | null;
}

export interface ActiveTask {
  taskType: TaskType;
  targetId: string;
  startedAt: number;
}

export type TaskType = "sit" | "coffee";

export interface CoffeeMachineInfo {
  lastRunAt: number | null;
  runBy: string | null;
}

/**
 * Lifetime stats for a player, computed from task history.
 * Sent in the welcome message and used by the Profile overlay.
 */
export interface PlayerStats {
  /** Total sitting duration for today (ms) */
  sittingTodayMs: number;
  /** Total sitting duration this calendar year (ms) */
  sittingThisYearMs: number;
  /** Number of coffees made today */
  coffeesMadeToday: number;
  /** Number of coffees made this calendar year */
  coffeesMadeThisYear: number;
  /** Current token balance */
  tokens: number;
}

// ── Client → Server messages ──────────────────────────────────────────────────

export type C2SMessage =
  | { type: "join"; username: string; geolocation?: GeolocationData }
  | { type: "move"; x: number; y: number }
  | { type: "task_start"; taskType: TaskType; targetId: string }
  | { type: "task_end"; taskType: TaskType; targetId: string }
  | { type: "geolocation_update"; geolocation: GeolocationData };

// ── Server → Client messages ──────────────────────────────────────────────────

export type S2CMessage =
  | {
      type: "welcome";
      playerId: string;
      players: PlayerInfo[];
      coffeeMachine: CoffeeMachineInfo;
      /** The connecting player's own stats & token balance */
      stats: PlayerStats;
    }
  | { type: "player_join"; player: PlayerInfo }
  | { type: "player_move"; playerId: string; x: number; y: number }
  | { type: "player_leave"; playerId: string }
  | {
      type: "task_start";
      playerId: string;
      taskType: TaskType;
      targetId: string;
      startedAt: number;
    }
  | {
      type: "task_end";
      playerId: string;
      taskType: TaskType;
      targetId: string;
      duration: number;
    }
  | { type: "coffee_update"; lastRunAt: number; runBy: string }
  /** Private message: sent only to the player whose token balance changed */
  | { type: "token_update"; tokens: number; delta: number };
