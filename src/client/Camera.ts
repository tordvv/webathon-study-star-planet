/**
 * Camera controls the viewport into the game world.
 *
 * The camera follows the local player with soft clamping so it never
 * shows outside the world bounds.  All draw calls should offset by
 * (-camera.x, -camera.y) to convert world coordinates to screen coords.
 */

export class Camera {
  x: number = 0;
  y: number = 0;

  /**
   * Smoothly recentre the camera on a target position.
   *
   * @param targetX   World-space X of the target (e.g. player centre)
   * @param targetY   World-space Y of the target
   * @param canvasW   Viewport width in pixels
   * @param canvasH   Viewport height in pixels
   * @param worldW    Total world width in pixels
   * @param worldH    Total world height in pixels
   * @param lerpSpeed How quickly to catch up (0 = no movement, 1 = instant)
   */
  follow(
    targetX: number,
    targetY: number,
    canvasW: number,
    canvasH: number,
    worldW: number,
    worldH: number,
    lerpSpeed: number = 0.1
  ): void {
    // Desired top-left so the target sits at the viewport centre
    const desiredX = targetX - canvasW / 2;
    const desiredY = targetY - canvasH / 2;

    // Smooth follow via linear interpolation
    this.x += (desiredX - this.x) * lerpSpeed;
    this.y += (desiredY - this.y) * lerpSpeed;

    // Clamp so we never reveal outside the world
    this.x = Math.max(0, Math.min(worldW - canvasW, this.x));
    this.y = Math.max(0, Math.min(worldH - canvasH, this.y));
  }

  /** Convert a world-space point to screen-space */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: worldX - this.x, y: worldY - this.y };
  }

  /** Convert a screen-space point to world-space */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX + this.x, y: screenY + this.y };
  }
}
