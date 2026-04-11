/**
 * Database layer using in-memory storage with JSON file persistence.
 * Tracks online sessions, completed tasks, and coffee machine state.
 *
 * Data is saved to data/game-data.json whenever it changes.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { GeolocationData, TaskType, CoffeeMachineInfo } from "./types.js";

// ── Data shapes stored in the DB ──────────────────────────────────────────────

export interface Session {
  playerId: string;
  username: string;
  isOnline: boolean;
  joinedAt: number;       // Unix ms
  lastSeen: number;       // Unix ms
  geolocation?: GeolocationData;
}

export interface TaskRecord {
  id: string;
  playerId: string;
  username: string;
  taskType: TaskType;
  targetId: string;
  startedAt: number;  // Unix ms
  endedAt: number;    // Unix ms
  duration: number;   // ms
}

interface PersistedData {
  sessions: Session[];
  tasks: TaskRecord[];
  coffeeMachine: CoffeeMachineInfo;
}

// ── Database class ────────────────────────────────────────────────────────────

export class Database {
  private sessions: Map<string, Session> = new Map();
  private tasks: TaskRecord[] = [];
  private coffeeMachine: CoffeeMachineInfo = { lastRunAt: null, runBy: null };
  private dataFilePath: string;

  constructor() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const dataDir = join(__dirname, "../../data");

    // Ensure the data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.dataFilePath = join(dataDir, "game-data.json");
    this.load();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  /** Load data from the JSON file on startup */
  private load(): void {
    if (!existsSync(this.dataFilePath)) return;
    try {
      const raw = readFileSync(this.dataFilePath, "utf-8");
      const data: PersistedData = JSON.parse(raw) as PersistedData;
      // Mark all stored sessions as offline (server restarted)
      for (const session of data.sessions) {
        session.isOnline = false;
        this.sessions.set(session.playerId, session);
      }
      this.tasks = data.tasks ?? [];
      this.coffeeMachine = data.coffeeMachine ?? { lastRunAt: null, runBy: null };
    } catch {
      console.warn("[Database] Could not load game-data.json, starting fresh.");
    }
  }

  /** Persist current state to disk */
  private save(): void {
    const data: PersistedData = {
      sessions: Array.from(this.sessions.values()),
      tasks: this.tasks,
      coffeeMachine: this.coffeeMachine,
    };
    writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  }

  // ── Session management ───────────────────────────────────────────────────────

  /**
   * Called when a player connects and joins the study hall.
   * Creates or updates their session record.
   */
  upsertSession(
    playerId: string,
    username: string,
    geolocation?: GeolocationData
  ): Session {
    const now = Date.now();
    const existing = this.sessions.get(playerId);
    const resolvedGeolocation = geolocation ?? existing?.geolocation;
    const session: Session = {
      playerId,
      username,
      isOnline: true,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
      ...(resolvedGeolocation ? { geolocation: resolvedGeolocation } : {}),
    };
    this.sessions.set(playerId, session);
    this.save();
    return session;
  }

  /** Called when a player closes the page or disconnects */
  markOffline(playerId: string): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    session.isOnline = false;
    session.lastSeen = Date.now();
    this.sessions.set(playerId, session);
    this.save();
  }

  /** Update the stored geolocation for a player */
  updateGeolocation(playerId: string, geolocation: GeolocationData): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    session.geolocation = geolocation;
    session.lastSeen = Date.now();
    this.sessions.set(playerId, session);
    this.save();
  }

  /** Returns all sessions (online and offline) */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** Returns only currently online sessions */
  getOnlineSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.isOnline);
  }

  // ── Task tracking ────────────────────────────────────────────────────────────

  /**
   * Record a completed task.
   * Called when a player stands up from a table or finishes an activity.
   */
  addTask(
    playerId: string,
    username: string,
    taskType: TaskType,
    targetId: string,
    startedAt: number,
    endedAt: number
  ): TaskRecord {
    const record: TaskRecord = {
      id: `${playerId}_${taskType}_${startedAt}`,
      playerId,
      username,
      taskType,
      targetId,
      startedAt,
      endedAt,
      duration: endedAt - startedAt,
    };
    this.tasks.push(record);
    this.save();
    return record;
  }

  /** Get all task records, optionally filtered by player */
  getTasks(playerId?: string): TaskRecord[] {
    if (playerId) return this.tasks.filter((t) => t.playerId === playerId);
    return [...this.tasks];
  }

  // ── Coffee machine ───────────────────────────────────────────────────────────

  /** Record a coffee machine run and return the updated state */
  recordCoffeeRun(username: string): CoffeeMachineInfo {
    this.coffeeMachine = { lastRunAt: Date.now(), runBy: username };
    this.save();
    return { ...this.coffeeMachine };
  }

  /** Get the current coffee machine state */
  getCoffeeMachine(): CoffeeMachineInfo {
    return { ...this.coffeeMachine };
  }
}
