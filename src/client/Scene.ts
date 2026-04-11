/**
 * Scene holds all entities in the study hall world.
 *
 * Responsibilities:
 *  - Manage the list of interactable objects (tables, coffee machine)
 *  - Manage remote player entities
 *  - Render the background image and all entities in the correct order
 *  - Update interaction proximity checks each frame
 *
 * ── Adding a new interactable ─────────────────────────────────────────────────
 * 1. Import or define a new class that extends InteractableObject
 * 2. Add an entry to INTERACTABLE_CONFIG below
 * 3. Instantiate it in buildInteractables() and push to this.interactables
 */

import { CoffeeMachine } from "./entities/CoffeeMachine.js";
import { Table } from "./entities/Table.js";
import { RemotePlayer } from "./entities/RemotePlayer.js";
import type { InteractableObject } from "./entities/InteractableObject.js";
import type { Player } from "./entities/Player.js";
import type { Camera } from "./Camera.js";
import type { NetworkClient } from "./network/NetworkClient.js";
import type { PlayerInfo, ActiveTask } from "./types.js";

// ── Interactable layout config ────────────────────────────────────────────────
// Adjust x/y coordinates to match the positions in LesesalBirdView.png

interface TableConfig {
  id: string;
  label: string;
  x: number;
  y: number;
}

const TABLE_CONFIG: TableConfig[] = [
  { id: "table_1", label: "Table 1", x: 320, y: 280 },
  { id: "table_2", label: "Table 2", x: 520, y: 280 },
  { id: "table_3", label: "Table 3", x: 720, y: 280 },
  { id: "table_4", label: "Table 4", x: 420, y: 460 },
  { id: "table_5", label: "Table 5", x: 620, y: 460 },
  { id: "table_6", label: "Table 6", x: 320, y: 640 },
  { id: "table_7", label: "Table 7", x: 520, y: 640 },
  { id: "table_8", label: "Table 8", x: 720, y: 640 },
];

const COFFEE_MACHINE_X = 140;
const COFFEE_MACHINE_Y = 180;

// ── Scene ─────────────────────────────────────────────────────────────────────

export class Scene {
  /** Background (study hall bird's-eye view) */
  private bgImage: HTMLImageElement | null;
  /** Total world size in pixels (set from the loaded background image) */
  worldWidth: number = 1200;
  worldHeight: number = 900;

  readonly coffeeMachine: CoffeeMachine;
  readonly tables: Table[];
  /** All interactables in one flat array for easy iteration */
  readonly interactables: InteractableObject[];

  /** Remote players keyed by server-assigned player ID */
  private remotePlayers: Map<string, RemotePlayer> = new Map();

  private playerSprite: HTMLImageElement | null;

  constructor(
    bgImage: HTMLImageElement | null,
    playerSprite: HTMLImageElement | null,
    net: NetworkClient
  ) {
    this.bgImage = bgImage;
    this.playerSprite = playerSprite;

    // Size the world to the background image dimensions
    if (bgImage) {
      this.worldWidth = bgImage.naturalWidth;
      this.worldHeight = bgImage.naturalHeight;
    }

    // Build interactable objects
    this.coffeeMachine = new CoffeeMachine(COFFEE_MACHINE_X, COFFEE_MACHINE_Y, net);
    this.tables = TABLE_CONFIG.map(
      (cfg) => new Table(cfg.id, cfg.label, cfg.x, cfg.y, net)
    );
    this.interactables = [this.coffeeMachine, ...this.tables];
  }

  // ── Remote player management ─────────────────────────────────────────────────

  addRemotePlayer(info: PlayerInfo): void {
    const rp = new RemotePlayer(
      info.id,
      info.username,
      info.x,
      info.y,
      this.playerSprite,
      info.currentTask
    );
    this.remotePlayers.set(info.id, rp);
  }

  removeRemotePlayer(id: string): void {
    this.remotePlayers.delete(id);
  }

  moveRemotePlayer(id: string, x: number, y: number): void {
    this.remotePlayers.get(id)?.setTargetPosition(x, y);
  }

  /** Update a remote player's active task and reflect it on the relevant table */
  setRemotePlayerTask(
    id: string,
    task: ActiveTask | null
  ): void {
    const rp = this.remotePlayers.get(id);
    if (rp) rp.currentTask = task;

    // Update table sitter tracking
    for (const table of this.tables) {
      table.remoteSitters.delete(id);
    }
    if (task?.taskType === "sit") {
      const table = this.tables.find((t) => t.id === task.targetId);
      if (table && rp) table.remoteSitters.add(rp.username);
    }
  }

  /** Get all remote players as an array (for the HUD player list) */
  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  /**
   * Update all entities and compute interaction proximity.
   * Returns the nearest interactable within range, or null.
   */
  update(dt: number, player: Player): InteractableObject | null {
    // Update remote players (interpolation)
    for (const rp of this.remotePlayers.values()) {
      rp.update(dt);
    }

    // Update interactables
    for (const obj of this.interactables) {
      obj.update(dt);
    }

    // Proximity check: find the nearest interactable within its interaction radius
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

  /**
   * Render order:
   *   1. Background image
   *   2. Interactable objects
   *   3. Remote players
   *   (Local player is rendered by Game after this call, above everyone)
   */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // 1. Background
    if (this.bgImage) {
      ctx.drawImage(this.bgImage, -camera.x, -camera.y);
    } else {
      // Fallback: plain green floor
      ctx.fillStyle = "#2d5a27";
      ctx.fillRect(-camera.x, -camera.y, this.worldWidth, this.worldHeight);
    }

    // 2. Interactables
    for (const obj of this.interactables) {
      obj.render(ctx, camera);
    }

    // 3. Remote players
    for (const rp of this.remotePlayers.values()) {
      rp.render(ctx, camera);
    }
  }
}
