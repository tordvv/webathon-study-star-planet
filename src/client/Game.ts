/**
 * Game — top-level controller that ties all systems together.
 *
 * Lifecycle:
 *   1. new Game(canvas, username, geolocation)
 *   2. await game.init()
 *   3. game.start()
 *
 * Overlay state machine (only one overlay active at a time):
 *   none → profile  (Tab)
 *   none → blackjack (E at gambling table)
 *   profile/blackjack → none (Tab / Esc)
 */

import { Camera } from "./Camera.js";
import { InputManager } from "./InputManager.js";
import { Scene } from "./Scene.js";
import { Player } from "./entities/Player.js";
import { UIManager } from "./ui/UIManager.js";
import { ProfileMenu } from "./ui/ProfileMenu.js";
import { BlackjackGame } from "./ui/BlackjackGame.js";
import { NetworkClient } from "./network/NetworkClient.js";
import type { InteractableObject } from "./entities/InteractableObject.js";
import type { GeolocationData, CoffeeMachineInfo, PlayerStats } from "./types.js";

type Overlay = "none" | "profile" | "blackjack";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private username: string;
  private geolocation: GeolocationData | undefined;

  private camera: Camera;
  private input: InputManager;
  private net: NetworkClient;
  private scene!: Scene;
  private player!: Player;
  private ui!: UIManager;
  private profileMenu!: ProfileMenu;
  private blackjack!: BlackjackGame;

  private coffeeMachineInfo: CoffeeMachineInfo = { lastRunAt: null, runBy: null };
  private nearbyObject: InteractableObject | null = null;
  private tokens: number = 0;
  private stats: PlayerStats = {
    sittingTodayMs: 0,
    sittingThisYearMs: 0,
    coffeesMadeToday: 0,
    coffeesMadeThisYear: 0,
    tokens: 0,
  };

  private overlay: Overlay = "none";
  private lastTimestamp: number = 0;
  private animFrameId: number = 0;

  constructor(canvas: HTMLCanvasElement, username: string, geolocation?: GeolocationData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.username = username;
    this.geolocation = geolocation;

    this.camera = new Camera();
    this.input = new InputManager();
    this.net = new NetworkClient();
  }

  // ── Initialisation ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    const [bgResult, spriteResult] = await Promise.allSettled([
      loadImage("/assets/LesesalBirdView.png"),
      loadImage("/assets/Student.png"),
    ]);

    const bg = bgResult.status === "fulfilled" ? bgResult.value : null;
    const sprite = spriteResult.status === "fulfilled" ? spriteResult.value : null;

    this.scene = new Scene(bg, sprite, this.net, () => this.openBlackjack());
    this.ui = new UIManager(this.canvas);
    this.profileMenu = new ProfileMenu(this.canvas, this.username);

    await new Promise<void>((resolve) => {
      this.net.on("welcome", (msg) => {
        this.player = new Player(this.username, 800, 500, sprite, this.input, this.net);

        this.coffeeMachineInfo = msg.coffeeMachine;
        this.scene.coffeeMachine.lastRunAt = msg.coffeeMachine.lastRunAt;
        this.scene.coffeeMachine.lastRunBy = msg.coffeeMachine.runBy;

        this.tokens = msg.stats.tokens;
        this.stats = { ...msg.stats };
        this.profileMenu.updateTokens(this.tokens);
        this.profileMenu.updateStats(this.stats);

        for (const p of msg.players) {
          this.scene.addRemotePlayer(p);
          if (p.currentTask) this.scene.setRemotePlayerTask(p.id, p.currentTask);
        }

        // Blackjack is created after we know the token balance
        this.blackjack = new BlackjackGame(
          this.canvas,
          this.tokens,
          (delta) => this.handleBlackjackTokenChange(delta),
          () => this.closeBlackjack()
        );

        resolve();
      });

      this.registerNetworkHandlers();
      this.net.connect(this.username, this.geolocation);
    });

    // ── Global key bindings ──────────────────────────────────────────────────────
    this.input.onKeyPressed("tab", () => this.toggleProfile());
    this.input.onKeyPressed("e", () => this.handleInteractKey());

    // Blackjack keys are only active while the overlay is open
    for (const key of ["h", "s", "d", "enter", "escape", "arrowup", "arrowdown"]) {
      this.input.onKeyPressed(key, () => {
        if (this.overlay === "blackjack") this.blackjack.handleKey(key);
        if (key === "escape" && this.overlay === "profile") this.overlay = "none";
      });
    }

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  // ── Network handlers ──────────────────────────────────────────────────────────

  private registerNetworkHandlers(): void {
    this.net.on("player_join", (msg) => this.scene.addRemotePlayer(msg.player));

    this.net.on("player_leave", (msg) => {
      if (msg.playerId) this.scene.removeRemotePlayer(msg.playerId);
    });

    this.net.on("player_move", (msg) => {
      this.scene.moveRemotePlayer(msg.playerId, msg.x, msg.y);
    });

    this.net.on("task_start", (msg) => {
      this.scene.setRemotePlayerTask(msg.playerId, {
        taskType: msg.taskType,
        targetId: msg.targetId,
        startedAt: msg.startedAt,
      });
    });

    this.net.on("task_end", (msg) => {
      this.scene.setRemotePlayerTask(msg.playerId, null);
      // Optimistically update local stats when OUR own task ends
      // (server sends token_update immediately after)
    });

    this.net.on("coffee_update", (msg) => {
      this.coffeeMachineInfo = { lastRunAt: msg.lastRunAt, runBy: msg.runBy };
      this.scene.coffeeMachine.lastRunAt = msg.lastRunAt;
      this.scene.coffeeMachine.lastRunBy = msg.runBy;
    });

    this.net.on("token_update", (msg) => {
      this.tokens = msg.tokens;
      this.profileMenu.updateTokens(this.tokens);
      this.blackjack?.setTokenBalance(this.tokens);

      // Also bump the stats accumulated locally
      this.stats.tokens = this.tokens;
      this.profileMenu.updateStats(this.stats);
    });
  }

  // ── Interaction ───────────────────────────────────────────────────────────────

  private handleInteractKey(): void {
    if (this.overlay !== "none") return;
    if (!this.nearbyObject) return;
    this.nearbyObject.interact(this.username);
  }

  // ── Overlay management ────────────────────────────────────────────────────────

  private toggleProfile(): void {
    if (this.overlay === "profile") {
      this.overlay = "none";
    } else if (this.overlay === "none") {
      this.overlay = "profile";
    }
    // Don't toggle from blackjack — use Esc there
  }

  private openBlackjack(): void {
    if (this.overlay !== "none") return;
    this.blackjack.setTokenBalance(this.tokens);
    this.overlay = "blackjack";
  }

  private closeBlackjack(): void {
    this.overlay = "none";
  }

  private handleBlackjackTokenChange(delta: number): void {
    // Client-side token tracking during blackjack (optimistic).
    // The server doesn't know about blackjack — tokens are managed locally here.
    this.tokens = Math.max(0, this.tokens + delta);
    this.profileMenu.updateTokens(this.tokens);
    this.stats.tokens = this.tokens;
    this.profileMenu.updateStats(this.stats);
  }

  // ── Game loop ─────────────────────────────────────────────────────────────────

  start(): void {
    this.lastTimestamp = performance.now();
    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.destroy();
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    this.update(dt);
    this.render();
    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Pause world movement while an overlay is active
    if (this.overlay === "none") {
      this.player.move(dt, this.scene.mapBounds);

      const previousNearby = this.nearbyObject;
      this.nearbyObject = this.scene.update(dt, this.player);

      if (previousNearby && previousNearby !== this.nearbyObject) {
        previousNearby.leave(this.username);
      }
    } else {
      // Still update scene animations (remote players, etc.) but not the camera
      this.scene.update(dt, this.player);
    }

    if (this.overlay === "blackjack") {
      this.blackjack.update(dt);
    }

    this.camera.follow(
      this.player.x,
      this.player.y,
      this.canvas.width,
      this.canvas.height,
      this.scene.worldWidth,
      this.scene.worldHeight
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  private render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // World
    this.scene.render(ctx, this.camera);
    this.player.render(ctx, this.camera);

    // HUD (only when no overlay is blocking the view)
    if (this.overlay !== "blackjack") {
      const onlinePlayers: Array<{ username: string; taskLabel?: string }> = [
        { username: this.username },
        ...this.scene.getRemotePlayers().map((rp) => {
          const entry: { username: string; taskLabel?: string } = { username: rp.username };
          if (rp.currentTask) {
            entry.taskLabel = rp.currentTask.taskType === "sit" ? "📚" : "☕";
          }
          return entry;
        }),
      ];

      this.ui.draw(
        ctx,
        this.overlay === "none" ? this.nearbyObject : null,
        this.scene.tables,
        this.coffeeMachineInfo,
        onlinePlayers,
        this.tokens
      );
    }

    // Overlays
    if (this.overlay === "profile") {
      this.profileMenu.render(ctx);
    } else if (this.overlay === "blackjack") {
      this.blackjack.render(ctx);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}

// ── Asset loader ──────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
