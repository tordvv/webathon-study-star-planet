/**
 * InputManager centralises all keyboard input.
 *
 * Usage:
 *   const input = new InputManager()
 *   // Each frame:
 *   if (input.isDown('w') || input.isDown('ArrowUp')) { ... }
 *   // Listen for a one-shot key press:
 *   input.onKeyPressed('e', () => player.tryInteract())
 */

export class InputManager {
  /** Keys that are currently held down */
  private held: Set<string> = new Set();
  /** One-shot callbacks triggered on keydown */
  private pressCallbacks: Map<string, Array<() => void>> = new Map();

  constructor() {
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  /** Returns true while the key is held */
  isDown(key: string): boolean {
    return this.held.has(key.toLowerCase());
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────

  /**
   * Register a callback that fires once per key-press (not while held).
   * Multiple callbacks can share the same key.
   */
  onKeyPressed(key: string, callback: () => void): void {
    const k = key.toLowerCase();
    if (!this.pressCallbacks.has(k)) {
      this.pressCallbacks.set(k, []);
    }
    this.pressCallbacks.get(k)!.push(callback);
  }

  /** Remove all registered press callbacks */
  clearCallbacks(): void {
    this.pressCallbacks.clear();
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (this.held.has(key)) return; // Ignore key-repeat
    this.held.add(key);

    const callbacks = this.pressCallbacks.get(key);
    if (callbacks) {
      for (const cb of callbacks) cb();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.held.delete(e.key.toLowerCase());
  }

  /** Destroy the input manager and remove event listeners */
  destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown as EventListener);
    window.removeEventListener("keyup", this.handleKeyUp as EventListener);
  }
}
