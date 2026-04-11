/**
 * Bookshelf — an interactable that opens an external URL in a new tab.
 *
 * Use case: link to the university library catalogue, a study resource,
 * a reading list, etc.
 *
 * Configuration:
 *   Pass the destination URL to the constructor.
 *   The URL is opened via window.open so it always opens in a new tab.
 *
 * To add another bookshelf pointing to a different site, simply add a second
 * entry to the BOOKSHELF_CONFIG array in Scene.ts with a different url.
 */

import { InteractableObject } from "./InteractableObject.js";
import type { Camera } from "../Camera.js";

export class Bookshelf extends InteractableObject {
  /** URL that will be opened in a new tab when the player interacts */
  readonly url: string;

  constructor(id: string, label: string, x: number, y: number, url: string) {
    // 70×100 visual size, 85px interaction radius
    super(id, label, x, y, 70, 100, 85);
    this.url = url;
  }

  // ── InteractableObject ───────────────────────────────────────────────────────

  get promptLabel(): string {
    return "E: Browse books 📖";
  }

  interact(_playerUsername: string): void {
    window.open(this.url, "_blank", "noopener,noreferrer");
  }

  // ── Entity ───────────────────────────────────────────────────────────────────

  update(_dt: number): void {
    // Bookshelf is static — nothing to simulate
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Shelf backing (dark wood)
    ctx.fillStyle = "#3b1f0a";
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

    // Three shelf rows of colourful book spines
    const shelfRows = 3;
    const bookColors = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad"];
    const rowH = (h - 16) / shelfRows;

    for (let row = 0; row < shelfRows; row++) {
      const rowY = sy - h / 2 + 8 + row * rowH;
      let bx = sx - w / 2 + 4;
      let bookIdx = row * 3;

      while (bx < sx + w / 2 - 8) {
        const bw = 8 + ((bookIdx * 7) % 10);
        ctx.fillStyle = bookColors[bookIdx % bookColors.length]!;
        ctx.fillRect(bx, rowY, bw, rowH - 4);
        // Spine highlight
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(bx, rowY, 2, rowH - 4);
        bx += bw + 2;
        bookIdx++;
      }
    }

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.label, sx, sy + h / 2 - 2);

    this.renderHighlight(ctx, sx, sy);
    ctx.restore();
  }
}
