/**
 * Scene holds all entities in the study hall world.
 *
 * ── Adding a new interactable ─────────────────────────────────────────────────
 * 1. Import or define a class extending InteractableObject
 * 2. Instantiate it in the constructor and push to this.interactables
 *
 * ── Adjusting the walkable area ───────────────────────────────────────────────
 * Edit WALKABLE_BOUNDS in MapBounds.ts to match the floor in your image.
 * Toggle SHOW_BOUNDS_DEBUG = true below to see the bounding box at runtime.
 */

import { CoffeeMachine } from "./entities/CoffeeMachine.js";
import { Table } from "./entities/Table.js";
import { Bookshelf } from "./entities/Bookshelf.js";
import { GamblingTable } from "./entities/GamblingTable.js";
import { RemotePlayer } from "./entities/RemotePlayer.js";
import type { InteractableObject } from "./entities/InteractableObject.js";
import type { Player } from "./entities/Player.js";
import type { Camera } from "./Camera.js";
import type { NetworkClient } from "./network/NetworkClient.js";
import type { PlayerInfo, ActiveTask } from "./types.js";
import { fullWorldBounds, WALKABLE_BOUNDS, type MapBounds } from "./MapBounds.js";

// ── Debug flag ─────────────────────────────────────────────────────────────────
/** Set to true to draw the walkable bounding box — useful for calibration */
const SHOW_BOUNDS_DEBUG = true;

// ── Layout config ─────────────────────────────────────────────────────────────
// Adjust x/y to match furniture positions in LesesalBirdView.png

const TABLE_CONFIG = [
  { id: "table_1", label: "Table 1", x: 320, y: 280 },
  { id: "table_2", label: "Table 2", x: 520, y: 280 },
  { id: "table_3", label: "Table 3", x: 720, y: 280 },
  { id: "table_4", label: "Table 4", x: 420, y: 460 },
  { id: "table_5", label: "Table 5", x: 620, y: 460 },
  { id: "table_6", label: "Table 6", x: 320, y: 640 },
  { id: "table_7", label: "Table 7", x: 520, y: 640 },
  { id: "table_8", label: "Table 8", x: 720, y: 640 },
] as const;

const COFFEE_MACHINE_POS = { x: 140, y: 180 };
const GAMBLING_TABLE_POS = { x: 950, y: 300 };
const BOOKSHELF_CONFIG = [
  {
    id: "bookshelf_1",
    label: "Library",
    x: 880,
    y: 180,
    /** URL opened when the player interacts — change this to any study resource */
    url: "https://en.wikipedia.org/wiki/Main_Page",
  },
] as const;

// ── Scene ─────────────────────────────────────────────────────────────────────

export class Scene {
  private bgImage: HTMLImageElement | null;
  worldWidth: number = 2500;
  worldHeight: number = 1080;

  /** The walkable area — clamped to world size after image loads */
  readonly mapBounds: MapBounds;

  readonly coffeeMachine: CoffeeMachine;
  readonly tables: Table[];
  readonly bookshelves: Bookshelf[];
  readonly gamblingTable: GamblingTable;
  readonly interactables: InteractableObject[];

  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private playerSprite: HTMLImageElement | null;

  constructor(
    bgImage: HTMLImageElement | null,
    playerSprite: HTMLImageElement | null,
    net: NetworkClient,
    onOpenBlackjack: () => void
  ) {
    this.bgImage = bgImage;
    this.playerSprite = playerSprite;

/*     if (bgImage) {
      this.worldWidth = bgImage.naturalWidth;
      this.worldHeight = bgImage.naturalHeight;
    } */

    // Clamp the walkable bounds so they don't exceed the world size
/*     this.mapBounds = {
      minX: WALKABLE_BOUNDS.minX,
      minY: WALKABLE_BOUNDS.minY,
      maxX: Math.min(WALKABLE_BOUNDS.maxX, this.worldWidth),
      maxY: Math.min(WALKABLE_BOUNDS.maxY, this.worldHeight),
    }; */
    this.mapBounds = fullWorldBounds(this.worldWidth, this.worldHeight);

    // ── Entities ────────────────────────────────────────────────────────────────
    this.coffeeMachine = new CoffeeMachine(COFFEE_MACHINE_POS.x, COFFEE_MACHINE_POS.y, net);
    this.tables = TABLE_CONFIG.map((cfg) => new Table(cfg.id, cfg.label, cfg.x, cfg.y, net));
    this.bookshelves = BOOKSHELF_CONFIG.map(
      (cfg) => new Bookshelf(cfg.id, cfg.label, cfg.x, cfg.y, cfg.url)
    );
    this.gamblingTable = new GamblingTable(GAMBLING_TABLE_POS.x, GAMBLING_TABLE_POS.y, onOpenBlackjack);

    this.interactables = [
      this.coffeeMachine,
      ...this.tables,
      ...this.bookshelves,
      this.gamblingTable,
    ];
  }

  // ── Remote player management ──────────────────────────────────────────────────

  addRemotePlayer(info: PlayerInfo): void {
    const rp = new RemotePlayer(info.id, info.username, info.x, info.y, this.playerSprite, info.currentTask);
    this.remotePlayers.set(info.id, rp);
  }

  removeRemotePlayer(id: string): void {
    this.remotePlayers.delete(id);
  }

  moveRemotePlayer(id: string, x: number, y: number): void {
    this.remotePlayers.get(id)?.setTargetPosition(x, y);
  }

  setRemotePlayerTask(id: string, task: ActiveTask | null): void {
    const rp = this.remotePlayers.get(id);
    if (rp) rp.currentTask = task;

    for (const table of this.tables) {
      table.remoteSitters.delete(id);
    }
    if (task?.taskType === "sit") {
      const table = this.tables.find((t) => t.id === task.targetId);
      if (table && rp) table.remoteSitters.add(rp.username);
    }
  }

  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(dt: number, player: Player): InteractableObject | null {
    for (const rp of this.remotePlayers.values()) rp.update(dt);
    for (const obj of this.interactables) obj.update(dt);

    let nearest: InteractableObject | null = null;
    let nearestDist = Infinity;

    for (const obj of this.interactables) {
      const dist = obj.distanceTo(player.x, player.y);
      obj.isNearby = dist <= obj.interactionRadius;
      if (obj.isNearby && dist < nearestDist) {
        nearestDist = dist;
        nearest = obj;
      }
    }

    return nearest;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // 1. Background
    if (this.bgImage) {
      ctx.drawImage(this.bgImage, -camera.x, -camera.y);
    } else {
      ctx.fillStyle = "#2d5a27";
      ctx.fillRect(-camera.x, -camera.y, this.worldWidth, this.worldHeight);
    }

    // 2. Debug: walkable bounding box
    if (SHOW_BOUNDS_DEBUG) {
      const b = this.mapBounds;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(b.minX - camera.x, b.minY - camera.y, b.maxX - b.minX, b.maxY - b.minY);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3. Interactables
    for (const obj of this.interactables) obj.render(ctx, camera);

    // 4. Remote players
    for (const rp of this.remotePlayers.values()) rp.render(ctx, camera);
  }
}
