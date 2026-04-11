/**
 * Table — a study table the player can sit at.
 *
 * Interaction:
 *  - Press E to sit down → starts a "sit" task (timer begins, server notified)
 *  - Press E again to stand up → ends the task (duration recorded)
 *  - Walking away while seated also ends the task
 *
 * The table tracks who is sitting at it (the local player and remote players)
 * so it can show a "seat taken" indicator.
 */

import { InteractableObject } from "./InteractableObject.js";
import type { Camera } from "../Camera.js";
import type { NetworkClient } from "../network/NetworkClient.js";

export class Table extends InteractableObject {
  /** True when the local player is currently sitting here */
  isLocalPlayerSitting: boolean = false;
  /** Timestamp (ms) when the local player sat down */
  private sitStartTime: number = 0;
  /** Elapsed sitting time visible on the HUD while seated */
  get sittingDuration(): number {
    if (!this.isLocalPlayerSitting) return 0;
    return Date.now() - this.sitStartTime;
  }

  /**
   * Usernames of remote players currently sitting here.
   * Updated via network events.
   */
  remoteSitters: Set<string> = new Set();

  private net: NetworkClient;

  constructor(id: string, label: string, x: number, y: number, net: NetworkClient) {
    // Tables are 80×50 with an 85-pixel interaction radius
    super(id, label, x, y, 90, 50, 85);
    this.net = net;
  }

  // ── InteractableObject ───────────────────────────────────────────────────────

  get promptLabel(): string {
    return this.isLocalPlayerSitting ? "E: Stand up" : "E: Sit down";
  }

  interact(_playerUsername: string): void {
    if (this.isLocalPlayerSitting) {
      this.standUp();
    } else {
      this.sitDown();
    }
  }

  /** Called when the player walks away while still seated */
  leave(_playerUsername: string): void {
    if (this.isLocalPlayerSitting) {
      this.standUp();
    }
  }

  // ── Sitting logic ────────────────────────────────────────────────────────────

  private sitDown(): void {
    this.isLocalPlayerSitting = true;
    this.sitStartTime = Date.now();
    this.net.sendTaskStart("sit", this.id);
  }

  private standUp(): void {
    if (!this.isLocalPlayerSitting) return;
    this.isLocalPlayerSitting = false;
    this.net.sendTaskEnd("sit", this.id);
  }

  // ── Entity ───────────────────────────────────────────────────────────────────

  update(_dt: number): void {
    // Nothing to simulate — sitting timer is computed on the fly
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Table surface (wood colour)
    ctx.fillStyle = "#8B6914";
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 6);
    ctx.fill();

    // Darker border
    ctx.strokeStyle = "#5C4309";
    ctx.lineWidth = 2;
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 6);
    ctx.stroke();

    // Seated-player indicator dots (up to 4 seats visualised as small circles)
    const totalSitters = this.remoteSitters.size + (this.isLocalPlayerSitting ? 1 : 0);
    const seatPositions = [
      { ox: -24, oy: -20 },
      { ox: 24, oy: -20 },
      { ox: -24, oy: 20 },
      { ox: 24, oy: 20 },
    ];
    for (let i = 0; i < seatPositions.length; i++) {
      const pos = seatPositions[i]!;
      const occupied = i < totalSitters;
      ctx.fillStyle = occupied ? "#4ade80" : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(sx + pos.ox, sy + pos.oy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Table label
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, sx, sy);

    // Sitting timer for the local player
    if (this.isLocalPlayerSitting) {
      const elapsed = formatDuration(this.sittingDuration);
      ctx.fillStyle = "#facc15";
      ctx.font = "12px monospace";
      ctx.fillText(elapsed, sx, sy + h / 2 + 12);
    }

    this.renderHighlight(ctx, sx, sy);
    ctx.restore();
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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

/** Format milliseconds as HH:MM:SS or MM:SS */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
