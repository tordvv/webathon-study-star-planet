/**
 * Player represents the locally controlled character.
 *
 * Movement:
 *   WASD / Arrow keys → velocity → position update (delta-time scaled)
 *   Diagonal movement is normalised so speed is always constant.
 *
 * The player sends its position to the server every POSITION_SEND_INTERVAL ms
 * (not every frame) to reduce network traffic.
 *
 * Call move(dt, worldW, worldH) from the Game loop (not the base update()).
 */

import { Entity } from "./Entity.js";
import type { Camera } from "../Camera.js";
import type { InputManager } from "../InputManager.js";
import type { NetworkClient } from "../network/NetworkClient.js";

const PLAYER_SPEED = 160;         // pixels per second
const POSITION_SEND_INTERVAL = 50; // ms between position broadcasts
const SPRITE_SIZE = 48;

export class Player extends Entity {
  readonly username: string;
  private sprite: HTMLImageElement | null;
  private input: InputManager;
  private net: NetworkClient;
  private lastSentX: number = -1;
  private lastSentY: number = -1;
  private timeSinceLastSend: number = 0;

  constructor(
    username: string,
    x: number,
    y: number,
    sprite: HTMLImageElement | null,
    input: InputManager,
    net: NetworkClient
  ) {
    super(x, y, SPRITE_SIZE, SPRITE_SIZE);
    this.username = username;
    this.sprite = sprite;
    this.input = input;
    this.net = net;
  }

  // ── Entity interface ─────────────────────────────────────────────────────────

  /** Base update — unused; call move() from the game loop instead. */
  update(_dt: number): void {
    // no-op
  }

  // ── Movement + networking ────────────────────────────────────────────────────

  /**
   * Move the player based on held keys and clamp to world bounds.
   * Also throttles position updates to the server.
   *
   * @param dt     Delta time in seconds
   * @param worldW Total world width in pixels
   * @param worldH Total world height in pixels
   */
  move(dt: number, worldW: number, worldH: number): void {
    let vx = 0;
    let vy = 0;

    if (this.input.isDown("a") || this.input.isDown("arrowleft")) vx -= 1;
    if (this.input.isDown("d") || this.input.isDown("arrowright")) vx += 1;
    if (this.input.isDown("w") || this.input.isDown("arrowup")) vy -= 1;
    if (this.input.isDown("s") || this.input.isDown("arrowdown")) vy += 1;

    // Normalise diagonal movement so diagonal speed equals straight speed
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    this.x += vx * PLAYER_SPEED * dt;
    this.y += vy * PLAYER_SPEED * dt;

    // Clamp to world bounds
    const hw = this.width / 2;
    const hh = this.height / 2;
    this.x = Math.max(hw, Math.min(worldW - hw, this.x));
    this.y = Math.max(hh, Math.min(worldH - hh, this.y));

    // Throttled position broadcast
    this.timeSinceLastSend += dt * 1000;
    const moved =
      Math.abs(this.x - this.lastSentX) > 1 ||
      Math.abs(this.y - this.lastSentY) > 1;

    if (moved && this.timeSinceLastSend >= POSITION_SEND_INTERVAL) {
      this.net.sendMove(Math.round(this.x), Math.round(this.y));
      this.lastSentX = this.x;
      this.lastSentY = this.y;
      this.timeSinceLastSend = 0;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);

    ctx.save();

    if (this.sprite) {
      ctx.drawImage(
        this.sprite,
        sx - this.width / 2,
        sy - this.height / 2,
        this.width,
        this.height
      );
    } else {
      // Fallback: blue circle
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(sx, sy, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name label above the sprite
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(this.username, sx, sy - this.height / 2 - 2);

    ctx.restore();
  }
}
