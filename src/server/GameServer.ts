/**
 * GameServer manages all WebSocket connections and the authoritative game state.
 *
 * Responsibilities:
 *  - Track connected players and their positions / active tasks
 *  - Broadcast state changes to all other clients
 *  - Delegate persistence to the Database layer
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { Database } from "./Database.js";
import type {
  C2SMessage,
  S2CMessage,
  PlayerInfo,
  ActiveTask,
  TaskType,
} from "./types.js";

// ── Per-connection player state (server-side) ────────────────────────────────

interface ConnectedPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  ws: WebSocket;
  currentTask: ActiveTask | null;
}

// ── GameServer ────────────────────────────────────────────────────────────────

export class GameServer {
  private wss: WebSocketServer;
  private db: Database;
  /** Map from player ID → player state */
  private players: Map<string, ConnectedPlayer> = new Map();

  constructor(httpServer: Server, db: Database) {
    this.db = db;
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    console.log("[GameServer] WebSocket server ready at /ws");
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────────

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    // We don't have the player ID yet — the client must send a 'join' message first.
    let player: ConnectedPlayer | null = null;

    ws.on("message", (raw) => {
      let msg: C2SMessage;
      try {
        msg = JSON.parse(raw.toString()) as C2SMessage;
      } catch {
        return; // Ignore malformed messages
      }

      if (msg.type === "join") {
        // ── Player joins ──────────────────────────────────────────────────────
        const id = generateId();
        player = {
          id,
          username: msg.username,
          x: 800, // Starting position in the study hall
          y: 500,
          ws,
          currentTask: null,
        };
        this.players.set(id, player);

        // Persist the session
        this.db.upsertSession(id, msg.username, msg.geolocation);

        // Welcome the new player with the full world state
        this.send(ws, {
          type: "welcome",
          playerId: id,
          players: this.getPlayerList(id),
          coffeeMachine: this.db.getCoffeeMachine(),
        });

        // Announce the new player to everyone else
        this.broadcast(
          { type: "player_join", player: this.toPlayerInfo(player) },
          id
        );

        console.log(`[GameServer] ${msg.username} (${id}) joined. Total: ${this.players.size}`);
        return;
      }

      // All other messages require the player to have already joined
      if (!player) return;

      switch (msg.type) {
        case "move":
          this.handleMove(player, msg.x, msg.y);
          break;
        case "task_start":
          this.handleTaskStart(player, msg.taskType, msg.targetId);
          break;
        case "task_end":
          this.handleTaskEnd(player, msg.taskType, msg.targetId);
          break;
        case "geolocation_update":
          this.db.updateGeolocation(player.id, msg.geolocation);
          break;
      }
    });

    ws.on("close", () => {
      if (!player) return;
      // If they were in the middle of a task, end it now
      if (player.currentTask) {
        const task = player.currentTask;
        const now = Date.now();
        this.db.addTask(
          player.id,
          player.username,
          task.taskType,
          task.targetId,
          task.startedAt,
          now
        );
      }
      this.db.markOffline(player.id);
      this.players.delete(player.id);
      this.broadcast({ type: "player_leave", playerId: player.id });
      console.log(`[GameServer] ${player.username} disconnected. Total: ${this.players.size}`);
    });

    ws.on("error", (err) => {
      console.error("[GameServer] WebSocket error:", err.message);
    });
  }

  // ── Message handlers ─────────────────────────────────────────────────────────

  private handleMove(
    player: ConnectedPlayer,
    x: number,
    y: number
  ): void {
    player.x = x;
    player.y = y;
    this.broadcast({ type: "player_move", playerId: player.id, x, y }, player.id);
  }

  private handleTaskStart(
    player: ConnectedPlayer,
    taskType: TaskType,
    targetId: string
  ): void {
    const startedAt = Date.now();

    if (taskType === "coffee") {
      // Coffee is instantaneous — record it and broadcast immediately
      const info = this.db.recordCoffeeRun(player.username);
      this.broadcast({
        type: "coffee_update",
        lastRunAt: info.lastRunAt!,
        runBy: info.runBy!,
      });

      // Also record it as a zero-duration task
      this.db.addTask(
        player.id,
        player.username,
        "coffee",
        targetId,
        startedAt,
        startedAt
      );
      return;
    }

    // For ongoing tasks (e.g., sitting), store the start time
    player.currentTask = { taskType, targetId, startedAt };
    this.broadcast({
      type: "task_start",
      playerId: player.id,
      taskType,
      targetId,
      startedAt,
    });
  }

  private handleTaskEnd(
    player: ConnectedPlayer,
    taskType: TaskType,
    targetId: string
  ): void {
    if (!player.currentTask) return;
    const endedAt = Date.now();
    const { startedAt } = player.currentTask;

    this.db.addTask(
      player.id,
      player.username,
      taskType,
      targetId,
      startedAt,
      endedAt
    );

    player.currentTask = null;

    this.broadcast({
      type: "task_end",
      playerId: player.id,
      taskType,
      targetId,
      duration: endedAt - startedAt,
    });
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  /** Convert internal player state to the wire format */
  private toPlayerInfo(p: ConnectedPlayer): PlayerInfo {
    return {
      id: p.id,
      username: p.username,
      x: p.x,
      y: p.y,
      currentTask: p.currentTask,
    };
  }

  /** Get the list of all players except the one with the given id */
  private getPlayerList(excludeId?: string): PlayerInfo[] {
    return Array.from(this.players.values())
      .filter((p) => p.id !== excludeId)
      .map((p) => this.toPlayerInfo(p));
  }

  /** Send a message to a single WebSocket client */
  private send(ws: WebSocket, msg: S2CMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Broadcast a message to all connected clients.
   * @param excludeId - Optional player ID to skip (usually the sender)
   */
  private broadcast(msg: S2CMessage, excludeId?: string): void {
    const payload = JSON.stringify(msg);
    for (const player of this.players.values()) {
      if (player.id === excludeId) continue;
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(payload);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a short random ID for a new player */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
