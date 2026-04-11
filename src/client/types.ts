/**
 * Client-side type definitions — mirrors src/server/types.ts.
 */

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type TaskType = "sit" | "coffee";

export interface ActiveTask {
  taskType: TaskType;
  targetId: string;
  startedAt: number;
}

export interface PlayerInfo {
  id: string;
  username: string;
  x: number;
  y: number;
  currentTask: ActiveTask | null;
}

export interface CoffeeMachineInfo {
  lastRunAt: number | null;
  runBy: string | null;
}

export interface PlayerStats {
  sittingTodayMs: number;
  sittingThisYearMs: number;
  coffeesMadeToday: number;
  coffeesMadeThisYear: number;
  tokens: number;
}

// ── Client → Server ───────────────────────────────────────────────────────────

export type C2SMessage =
  | { type: "join"; username: string; geolocation?: GeolocationData }
  | { type: "move"; x: number; y: number }
  | { type: "task_start"; taskType: TaskType; targetId: string }
  | { type: "task_end"; taskType: TaskType; targetId: string }
  | { type: "geolocation_update"; geolocation: GeolocationData };

// ── Server → Client ───────────────────────────────────────────────────────────

export type S2CMessage =
  | {
      type: "welcome";
      playerId: string;
      players: PlayerInfo[];
      coffeeMachine: CoffeeMachineInfo;
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
  | { type: "token_update"; tokens: number; delta: number };
