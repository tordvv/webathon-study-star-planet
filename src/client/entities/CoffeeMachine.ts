/**
 * CoffeeMachine — an interactable that lets the player make coffee.
 *
 * Interaction: pressing E instantly records a coffee run (task_start is sent
 * and the server handles the DB write and broadcast).
 *
 * The machine visually shows when the last brew was made.
 */

import { InteractableObject } from "./InteractableObject.js";
import type { Camera } from "../Camera.js";
import type { NetworkClient } from "../network/NetworkClient.js";

export class CoffeeMachine extends InteractableObject {
  /** Unix-ms timestamp of the last coffee run, or null */
  lastRunAt: number | null = null;
  /** Username of the person who last made coffee */
  lastRunBy: string | null = null;

  /** Whether a brew animation is playing */
  private brewingTimer: number = 0;
  private static readonly BREW_DURATION = 1.5; // seconds

  private net: NetworkClient;

  constructor(x: number, y: number, net: NetworkClient) {
    super("coffee_machine", "Coffee Machine", x, y, 60, 70, 90);
    this.net = net;
  }

  // ── InteractableObject ───────────────────────────────────────────────────────

  get promptLabel(): string {
    return "E: Make coffee ☕";
  }

  interact(playerUsername: string): void {
    void playerUsername; // The server uses the socket association to get the username
    this.net.sendTaskStart("coffee", this.id);
    this.brewingTimer = CoffeeMachine.BREW_DURATION;
  }

  // ── Entity ───────────────────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.brewingTimer > 0) {
      this.brewingTimer -= dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
    const w = this.width;
    const h = this.height;

    // Machine body
    ctx.save();
    const isBrewing = this.brewingTimer > 0;
    ctx.fillStyle = isBrewing ? "#8B4513" : "#5D3A1A";
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 8);
    ctx.fill();

    // Coffee cup icon area
    ctx.fillStyle = "#f0f0f0";
    roundRect(ctx, sx - 14, sy - 6, 28, 24, 4);
    ctx.fill();

    // Cup
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - 10, sy - 4, 20, 16);
    ctx.fillStyle = "#4B2E12";
    ctx.fillRect(sx - 10, sy - 4, 20, isBrewing ? 16 * (1 - this.brewingTimer / CoffeeMachine.BREW_DURATION) : 16);

    // Steam when brewing
    if (isBrewing) {
      ctx.strokeStyle = "rgba(200, 200, 200, 0.8)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ox = sx - 8 + i * 8;
        ctx.beginPath();
        ctx.moveTo(ox, sy - 6);
        ctx.bezierCurveTo(ox + 4, sy - 14, ox - 4, sy - 18, ox, sy - 24);
        ctx.stroke();
      }
    }

    // "Last coffee" label below the machine
    this.renderLastRunLabel(ctx, sx, sy + h / 2 + 12);

    // Interaction highlight
    this.renderHighlight(ctx, sx, sy);
    ctx.restore();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private renderLastRunLabel(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (!this.lastRunAt) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("No coffee yet", sx, sy);
      return;
    }

    const ago = formatTimeAgo(this.lastRunAt);
    ctx.fillStyle = "rgba(255,220,50,0.9)";
    ctx.fillText(`Coffee: ${ago}`, sx, sy);
    if (this.lastRunBy) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`by ${this.lastRunBy}`, sx, sy + 13);
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Draw a rounded rectangle path */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Format a Unix timestamp as a human-readable "X minutes ago" string */
function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
