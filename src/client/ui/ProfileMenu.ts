/**
 * ProfileMenu renders a full-screen stats overlay for the local player.
 *
 * Toggle with Tab key (handled in Game.ts).
 *
 * Displays:
 *  - Token balance
 *  - Sitting time today / this year
 *  - Coffees made today / this year
 */

import { formatDuration } from "../entities/Table.js";

export interface PlayerStats {
  /** Total sitting time today (ms) */
  sittingTodayMs: number;
  /** Total sitting time this calendar year (ms) */
  sittingThisYearMs: number;
  /** Coffees made today */
  coffeesMadeToday: number;
  /** Coffees made this calendar year */
  coffeesMadeThisYear: number;
}

export class ProfileMenu {
  private canvas: HTMLCanvasElement;
  private username: string;
  private stats: PlayerStats;
  private tokens: number;

  constructor(canvas: HTMLCanvasElement, username: string) {
    this.canvas = canvas;
    this.username = username;
    this.stats = {
      sittingTodayMs: 0,
      sittingThisYearMs: 0,
      coffeesMadeToday: 0,
      coffeesMadeThisYear: 0,
    };
    this.tokens = 0;
  }

  // ── Data setters ─────────────────────────────────────────────────────────────

  updateStats(stats: PlayerStats): void {
    this.stats = { ...stats };
  }

  updateTokens(tokens: number): void {
    this.tokens = tokens;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const { width: cw, height: ch } = this.canvas;
    const panelW = Math.min(500, cw - 60);
    const panelH = Math.min(400, ch - 80);
    const px = (cw - panelW) / 2;
    const py = (ch - panelH) / 2;

    ctx.save();

    // ── Dark overlay ────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, cw, ch);

    // ── Panel background ────────────────────────────────────────────────────────
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, px, py, panelW, panelH, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, panelW, panelH, 16);
    ctx.stroke();

    const cx = cw / 2;
    let y = py + 28;

    // ── Header ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("📊 My Profile", cx, y);

    y += 34;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.username, cx, y);

    // ── Divider ─────────────────────────────────────────────────────────────────
    y += 26;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 20, y);
    ctx.lineTo(px + panelW - 20, y);
    ctx.stroke();
    y += 16;

    // ── Token balance (big and centred) ─────────────────────────────────────────
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${this.tokens} 🪙`, cx, y);

    y += 50;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.fillText("tokens", cx, y);

    // ── Stats rows ───────────────────────────────────────────────────────────────
    y += 30;
    const rows: Array<[string, string]> = [
      ["Studied today",    formatDuration(this.stats.sittingTodayMs)],
      ["Studied this year", formatDuration(this.stats.sittingThisYearMs)],
      ["Coffees today",    String(this.stats.coffeesMadeToday)],
      ["Coffees this year", String(this.stats.coffeesMadeThisYear)],
    ];

    const colX = px + panelW * 0.28;
    const valX = px + panelW * 0.72;

    for (const [label, value] of rows) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(label, colX, y);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(value, valX, y);

      // Row separator
      y += 22;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 30, y + 1);
      ctx.lineTo(px + panelW - 30, y + 1);
      ctx.stroke();
      y += 4;
    }

    // ── Footer ───────────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Press Tab to close", cx, py + panelH - 14);

    ctx.restore();
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

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
