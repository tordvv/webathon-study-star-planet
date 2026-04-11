/**
 * RemotePlayer renders another player whose position is received from the server.
 *
 * Positions are smoothly interpolated between received network updates
 * to avoid jittery movement.
 */

import { Entity } from "./Entity.js";
import type { Camera } from "../Camera.js";
import type { ActiveTask } from "../types.js";

const LERP_SPEED = 12; // higher = snappier interpolation
const SPRITE_SIZE = 48;

export class RemotePlayer extends Entity {
  readonly id: string;
  readonly username: string;
  currentTask: ActiveTask | null;

  /** Target position received from network (we lerp toward this) */
  private targetX: number;
  private targetY: number;
  private sprite: HTMLImageElement | null;

  constructor(
    id: string,
    username: string,
    x: number,
    y: number,
    sprite: HTMLImageElement | null,
    currentTask: ActiveTask | null = null
  ) {
    super(x, y, SPRITE_SIZE, SPRITE_SIZE);
    this.id = id;
    this.username = username;
    this.targetX = x;
    this.targetY = y;
    this.sprite = sprite;
    this.currentTask = currentTask;
  }

  // ── Receive server updates ───────────────────────────────────────────────────

  /** Called when a move message is received for this player */
  setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  // ── Entity ───────────────────────────────────────────────────────────────────

  update(dt: number): void {
    // Interpolate toward the server-authoritative position
    this.x += (this.targetX - this.x) * LERP_SPEED * dt;
    this.y += (this.targetY - this.y) * LERP_SPEED * dt;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);

    ctx.save();
    // Slight transparency so local player is easier to spot
    ctx.globalAlpha = 0.85;

    if (this.sprite) {
      ctx.drawImage(
        this.sprite,
        sx - this.width / 2,
        sy - this.height / 2,
        this.width,
        this.height
      );
    } else {
      // Fallback: different colour from local player
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(sx, sy, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Name tag
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(this.username, sx, sy - this.height / 2 - 2);

    // Task indicator badge
    if (this.currentTask) {
      const badge = this.currentTask.taskType === "sit" ? "📚" : "☕";
      ctx.font = "16px sans-serif";
      ctx.textBaseline = "top";
      ctx.shadowBlur = 0;
      ctx.fillText(badge, sx + this.width / 2 - 8, sy - this.height / 2);
    }

    ctx.restore();
  }
}
