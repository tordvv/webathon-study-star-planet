/**
 * GamblingTable — an interactable that opens the Blackjack mini-game.
 *
 * When the player presses E at this table, the provided callback fires
 * and Game.ts takes over by rendering the BlackjackGame overlay.
 * No game logic lives here — this is purely the world-space entity.
 */

import { InteractableObject } from "./InteractableObject.js";
import type { Camera } from "../Camera.js";

export class GamblingTable extends InteractableObject {
  /** Called when the player interacts — should open the blackjack overlay */
  private readonly onOpen: () => void;

  constructor(x: number, y: number, onOpen: () => void) {
    // Slightly larger than study tables so it's visually distinct
    super("gambling_table", "Gambling Table", x, y, 100, 60, 90);
    this.onOpen = onOpen;
  }

  // ── InteractableObject ───────────────────────────────────────────────────────

  get promptLabel(): string {
    return "E: Play Blackjack 🃏";
  }

  interact(_playerUsername: string): void {
    this.onOpen();
  }

  // ── Entity ───────────────────────────────────────────────────────────────────

  update(_dt: number): void {
    // Static object — nothing to simulate
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Green felt surface
    ctx.fillStyle = "#1a6b2a";
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 8);
    ctx.fill();

    // Gold border
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 8);
    ctx.stroke();

    // Card suit symbols
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♠ ♥ ♦ ♣", sx, sy - 8);

    // Label
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(this.label, sx, sy + 14);

    this.renderHighlight(ctx, sx, sy);
    ctx.restore();
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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
