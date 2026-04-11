/**
 * InteractableObject is the base class for all objects the player can interact with.
 *
 * When the local player enters the interaction radius, isNearby is set to true
 * and the UIManager will show an interaction prompt.  Pressing E calls interact().
 *
 * To add a new interactable:
 *  1. Extend this class
 *  2. Override interact() and leave() with your logic
 *  3. Override render() for custom visuals
 *  4. Add it to Scene.interactables
 */

import { Entity } from "./Entity.js";
import type { Camera } from "../Camera.js";

export abstract class InteractableObject extends Entity {
  /** Unique identifier used in task records and network messages */
  readonly id: string;
  /** Human-readable name shown in the interaction prompt */
  readonly label: string;
  /** Pixels from the entity centre within which the player can interact */
  readonly interactionRadius: number;

  /**
   * Whether the local player is currently close enough to interact.
   * Updated by the Scene each frame.
   */
  isNearby: boolean = false;

  constructor(
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    interactionRadius: number = 80
  ) {
    super(x, y, width, height);
    this.id = id;
    this.label = label;
    this.interactionRadius = interactionRadius;
  }

  /**
   * Called when the player presses E while in range.
   * Return the action label to show in the prompt (e.g. "Sit down" / "Stand up").
   */
  abstract interact(playerUsername: string): void;

  /**
   * Called when the player walks out of range while an interaction is active.
   * Override to cancel in-progress tasks.
   */
  leave(playerUsername: string): void {
    // Default: no-op. Override in subclasses that have ongoing tasks.
    void playerUsername;
  }

  /** The prompt label to display near the object ("E: Make coffee") */
  abstract get promptLabel(): string;

  // ── Shared rendering helpers ─────────────────────────────────────────────────

  /**
   * Draw a highlight ring around the object when the player is nearby.
   * Subclasses should call this inside their render() implementation.
   */
  protected renderHighlight(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    if (!this.isNearby) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 220, 50, 0.8)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.ellipse(sx, sy, this.width / 2 + 8, this.height / 2 + 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
