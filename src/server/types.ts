/**
 * Shared type definitions for the WebSocket protocol between client and server.
 * Both the game server and client use these message shapes.
 */

// ── Geolocation ──────────────────────────────────────────────────────────────

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// ── Snapshot types sent over the wire ────────────────────────────────────────

/** A player's current state as broadcast to all clients */
export interface PlayerInfo {
  id: string;
  username: string;
  x: number;
  y: number;
  /** The task the player is currently doing, if any */
  currentTask: ActiveTask | null;
}

/** A task currently in progress for a player */
export interface ActiveTask {
  taskType: TaskType;
  targetId: string;
  startedAt: number; // Unix ms timestamp
}

export type TaskType = "sit" | "coffee";

export interface CoffeeMachineInfo {
  lastRunAt: number | null; // Unix ms timestamp
  runBy: string | null;     // username of last person who made coffee
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
  /** Sent to a newly connected client with the full current world state */
  | {
      type: "welcome";
      playerId: string;
      players: PlayerInfo[];
      coffeeMachine: CoffeeMachineInfo;
    }
  /** Broadcast when a new player joins */
  | { type: "player_join"; player: PlayerInfo }
  /** Broadcast when a player moves */
  | { type: "player_move"; playerId: string; x: number; y: number }
  /** Broadcast when a player disconnects */
  | { type: "player_leave"; playerId: string }
  /** Broadcast when a player starts a task */
  | {
      type: "task_start";
      playerId: string;
      taskType: TaskType;
      targetId: string;
      startedAt: number;
    }
  /** Broadcast when a player ends a task */
  | {
      type: "task_end";
      playerId: string;
      taskType: TaskType;
      targetId: string;
      duration: number; // ms
    }
  /** Broadcast when the coffee machine is used */
  | { type: "coffee_update"; lastRunAt: number; runBy: string };
