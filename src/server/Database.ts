/**
 * Database layer — in-memory store with JSON file persistence.
 *
 * Tracks:
 *  - Online sessions (geolocation, online status)
 *  - Completed tasks (type, duration, timestamps)
 *  - Coffee machine state
 *  - Token balances (keyed by lowercase username for persistence across sessions)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { GeolocationData, TaskType, CoffeeMachineInfo, PlayerStats } from "./types.js";

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface Session {
  playerId: string;
  username: string;
  isOnline: boolean;
  joinedAt: number;
  lastSeen: number;
  geolocation?: GeolocationData;
}

export interface TaskRecord {
  id: string;
  playerId: string;
  username: string;
  taskType: TaskType;
  targetId: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  /** Tokens awarded for this task */
  tokensEarned: number;
}

interface PersistedData {
  sessions: Session[];
  tasks: TaskRecord[];
  coffeeMachine: CoffeeMachineInfo;
  /** Token balances by lowercase username — survives session reconnects */
  tokens: Record<string, number>;
}

// ── Database ──────────────────────────────────────────────────────────────────

export class Database {
  private sessions: Map<string, Session> = new Map();
  private tasks: TaskRecord[] = [];
  private coffeeMachine: CoffeeMachineInfo = { lastRunAt: null, runBy: null };
  /** Persistent token balances keyed by lowercase username */
  private tokens: Map<string, number> = new Map();
  private dataFilePath: string;

  constructor() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const dataDir = join(__dirname, "../../data");

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.dataFilePath = join(dataDir, "game-data.json");
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private load(): void {
    if (!existsSync(this.dataFilePath)) return;
    try {
      const raw = readFileSync(this.dataFilePath, "utf-8");
      const data: PersistedData = JSON.parse(raw) as PersistedData;
      for (const session of data.sessions) {
        session.isOnline = false;
        this.sessions.set(session.playerId, session);
      }
      this.tasks = data.tasks ?? [];
      this.coffeeMachine = data.coffeeMachine ?? { lastRunAt: null, runBy: null };
      for (const [username, balance] of Object.entries(data.tokens ?? {})) {
        this.tokens.set(username, balance);
      }
    } catch {
      console.warn("[Database] Could not load game-data.json, starting fresh.");
    }
  }

  private save(): void {
    const tokenObj: Record<string, number> = {};
    for (const [k, v] of this.tokens) tokenObj[k] = v;

    const data: PersistedData = {
      sessions: Array.from(this.sessions.values()),
      tasks: this.tasks,
      coffeeMachine: this.coffeeMachine,
      tokens: tokenObj,
    };
    writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  }

  // ── Session management ────────────────────────────────────────────────────────

  upsertSession(
    playerId: string,
    username: string,
    geolocation?: GeolocationData
  ): Session {
    const now = Date.now();
    const existing = this.sessions.get(playerId);
    const resolvedGeo = geolocation ?? existing?.geolocation;
    const session: Session = {
      playerId,
      username,
      isOnline: true,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
      ...(resolvedGeo ? { geolocation: resolvedGeo } : {}),
    };
    this.sessions.set(playerId, session);
    this.save();
    return session;
  }

  markOffline(playerId: string): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    session.isOnline = false;
    session.lastSeen = Date.now();
    this.sessions.set(playerId, session);
    this.save();
  }

  updateGeolocation(playerId: string, geolocation: GeolocationData): void {
    const session = this.sessions.get(playerId);
    if (!session) return;
    session.geolocation = geolocation;
    session.lastSeen = Date.now();
    this.sessions.set(playerId, session);
    this.save();
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getOnlineSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.isOnline);
  }

  // ── Task tracking ─────────────────────────────────────────────────────────────

  /**
   * Record a completed task, compute and award tokens.
   * Returns the task record and how many tokens were earned.
   */
  addTask(
    playerId: string,
    username: string,
    taskType: TaskType,
    targetId: string,
    startedAt: number,
    endedAt: number
  ): { record: TaskRecord; tokensEarned: number } {
    const duration = endedAt - startedAt;

    // Token rules:
    //  sit   → 1 token per full hour
    //  coffee → 1 token per brew
    const tokensEarned =
      taskType === "sit"
        ? Math.floor(duration / 3_600_000)
        : 1; // coffee

    const record: TaskRecord = {
      id: `${playerId}_${taskType}_${startedAt}`,
      playerId,
      username,
      taskType,
      targetId,
      startedAt,
      endedAt,
      duration,
      tokensEarned,
    };
    this.tasks.push(record);

    if (tokensEarned > 0) {
      this.addTokens(username, tokensEarned);
    }

    this.save();
    return { record, tokensEarned };
  }

  getTasks(playerId?: string): TaskRecord[] {
    if (playerId) return this.tasks.filter((t) => t.playerId === playerId);
    return [...this.tasks];
  }

  // ── Stats ──────────────────────────────────────────────────────────────────────

  /**
   * Compute the ProfileStats for a given username from task history.
   */
  getPlayerStats(username: string): PlayerStats {
    const lc = username.toLowerCase();
    const todayStart = startOfToday();
    const yearStart = startOfYear();

    let sittingTodayMs = 0;
    let sittingThisYearMs = 0;
    let coffeesMadeToday = 0;
    let coffeesMadeThisYear = 0;

    for (const task of this.tasks) {
      if (task.username.toLowerCase() !== lc) continue;

      const inYear = task.endedAt >= yearStart;
      const inDay = task.endedAt >= todayStart;

      if (task.taskType === "sit") {
        if (inYear) sittingThisYearMs += task.duration;
        if (inDay) sittingTodayMs += task.duration;
      } else if (task.taskType === "coffee") {
        if (inYear) coffeesMadeThisYear++;
        if (inDay) coffeesMadeToday++;
      }
    }

    return {
      sittingTodayMs,
      sittingThisYearMs,
      coffeesMadeToday,
      coffeesMadeThisYear,
      tokens: this.getTokens(username),
    };
  }

  // ── Tokens ────────────────────────────────────────────────────────────────────

  /** Get the current token balance for a username */
  getTokens(username: string): number {
    return this.tokens.get(username.toLowerCase()) ?? 0;
  }

  /** Add (or subtract) tokens for a username and return the new balance */
  addTokens(username: string, delta: number): number {
    const lc = username.toLowerCase();
    const current = this.tokens.get(lc) ?? 0;
    const next = Math.max(0, current + delta);
    this.tokens.set(lc, next);
    this.save();
    return next;
  }

  // ── Coffee machine ────────────────────────────────────────────────────────────

  recordCoffeeRun(username: string): CoffeeMachineInfo {
    this.coffeeMachine = { lastRunAt: Date.now(), runBy: username };
    this.save();
    return { ...this.coffeeMachine };
  }

  getCoffeeMachine(): CoffeeMachineInfo {
    return { ...this.coffeeMachine };
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfYear(): number {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
