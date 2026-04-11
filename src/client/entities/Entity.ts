/**
 * Entity is the abstract base class for all objects in the game world.
 *
 * Every entity has a position (x, y) representing its centre point in
 * world-space, and dimensions (width, height) used for collision and
 * interaction checks.
 *
 * Subclasses must implement:
 *   - update(dt)  — advance simulation state
 *   - render(ctx, camera) — draw to the canvas
 */

import type { Camera } from "../Camera.js";

export abstract class Entity {
  /** World-space centre X position */
  x: number;
  /** World-space centre Y position */
  y: number;
  width: number;
  height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Called every frame to update simulation state.
   * @param dt  Delta time in seconds since the last frame
   */
  abstract update(dt: number): void;

  /**
   * Called every frame to draw the entity.
   * Implementations should offset all draw calls by (-camera.x, -camera.y).
   */
  abstract render(ctx: CanvasRenderingContext2D, camera: Camera): void;

  /** The axis-aligned bounding box for this entity */
  get bounds(): { left: number; top: number; right: number; bottom: number } {
    return {
      left: this.x - this.width / 2,
      top: this.y - this.height / 2,
      right: this.x + this.width / 2,
      bottom: this.y + this.height / 2,
    };
  }

  /** Returns the Euclidean distance from this entity's centre to another point */
  distanceTo(ox: number, oy: number): number {
    const dx = this.x - ox;
    const dy = this.y - oy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
