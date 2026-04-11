/**
 * UIManager draws all HUD and overlay elements onto the canvas.
 *
 * This is separate from entity rendering so HUD elements are always drawn
 * in screen-space (not affected by the camera offset).
 *
 * Current HUD elements:
 *  - Interaction prompt box (when near an interactable)
 *  - Sitting timer (when seated at a table)
 *  - Coffee machine status (last brew time)
 *  - Online player list (top-right)
 */

import type { InteractableObject } from "../entities/InteractableObject.js";
import type { Table } from "../entities/Table.js";
import type { CoffeeMachineInfo } from "../types.js";
import { formatDuration } from "../entities/Table.js";

interface OnlinePlayer {
  username: string;
  taskLabel?: string;
}

export class UIManager {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // ── Main draw call (called after all entity rendering) ─────────────────────

  draw(
    ctx: CanvasRenderingContext2D,
    nearbyObject: InteractableObject | null,
    activeTables: Table[],
    coffeeMachine: CoffeeMachineInfo,
    onlinePlayers: OnlinePlayer[],
    tokens: number
  ): void {
    ctx.save();

    this.drawInteractionPrompt(ctx, nearbyObject);
    this.drawActiveSittingTimer(ctx, activeTables);
    this.drawCoffeeStatus(ctx, coffeeMachine);
    this.drawPlayerList(ctx, onlinePlayers);
    this.drawTokenCounter(ctx, tokens);
    this.drawTabHint(ctx);

    ctx.restore();
  }

  // ── Individual panels ────────────────────────────────────────────────────────

  /**
   * Draws a centred interaction prompt at the bottom of the screen:
   *   ┌─────────────────────────────┐
   *   │  E: Sit down · Study Table 1 │
   *   └─────────────────────────────┘
   */
  private drawInteractionPrompt(
    ctx: CanvasRenderingContext2D,
    obj: InteractableObject | null
  ): void {
    if (!obj) return;

    const text = `${obj.promptLabel}  ·  ${obj.label}`;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height - 48;

    ctx.font = "bold 14px sans-serif";
    const metrics = ctx.measureText(text);
    const pw = metrics.width + 28;
    const ph = 34;

    // Box background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255, 220, 50, 0.9)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
  }

  /**
   * Draws the sitting timer in the bottom-left corner while seated:
   *   📚 Study Table 1 · 00:05:23
   */
  private drawActiveSittingTimer(
    ctx: CanvasRenderingContext2D,
    tables: Table[]
  ): void {
    const sitting = tables.find((t) => t.isLocalPlayerSitting);
    if (!sitting) return;

    const duration = formatDuration(sitting.sittingDuration);
    const text = `📚 ${sitting.label}  ·  ${duration}`;
    const x = 16;
    const y = this.canvas.height - 48;

    ctx.font = "bold 14px sans-serif";
    const metrics = ctx.measureText(text);
    const pw = metrics.width + 28;
    const ph = 34;

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    roundRect(ctx, x, y - ph / 2, pw, ph, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y - ph / 2, pw, ph, 8);
    ctx.stroke();

    ctx.fillStyle = "#4ade80";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 14, y);
  }

  /**
   * Draws a small coffee status badge in the bottom-right:
   *   ☕ 5m ago · by Alice
   */
  private drawCoffeeStatus(
    ctx: CanvasRenderingContext2D,
    coffee: CoffeeMachineInfo
  ): void {
    const line1 = coffee.lastRunAt
      ? `☕ ${timeAgo(coffee.lastRunAt)}`
      : "☕ No coffee yet";
    const line2 = coffee.runBy ? `by ${coffee.runBy}` : "";

    const x = this.canvas.width - 16;
    const y = this.canvas.height - 48;

    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(line1, x + 1, y + 1);
    ctx.fillStyle = "rgba(255,220,50,0.9)";
    ctx.fillText(line1, x, y);

    if (line2) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(line2, x, y + 15);
    }
  }

  /**
   * Draws a list of online players in the top-right corner.
   */
  private drawPlayerList(
    ctx: CanvasRenderingContext2D,
    players: OnlinePlayer[]
  ): void {
    if (players.length === 0) return;

    const lineH = 18;
    const pw = 180;
    const ph = players.length * lineH + 24;
    const x = this.canvas.width - pw - 12;
    const y = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    roundRect(ctx, x, y, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Online (${players.length})`, x + 10, y + 7);

    for (let i = 0; i < players.length; i++) {
      const p = players[i]!;
      const py = y + 24 + i * lineH;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "12px sans-serif";
      const label = p.taskLabel ? `${p.username} ${p.taskLabel}` : p.username;
      ctx.fillText(`• ${label}`, x + 10, py);
    }
  }

  /**
   * Token balance counter in the top-left corner:
   *   🪙 42
   */
  private drawTokenCounter(ctx: CanvasRenderingContext2D, tokens: number): void {
    ctx.save();
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(`🪙 ${tokens}`, 13, 13);
    ctx.fillStyle = "#facc15";
    ctx.fillText(`🪙 ${tokens}`, 12, 12);
    ctx.restore();
  }

  /**
   * Subtle hint reminding the player they can press Tab for their profile.
   */
  private drawTabHint(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText("Tab — Profile", 12, 32);
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

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
