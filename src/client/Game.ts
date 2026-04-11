/**
 * Game is the top-level controller that ties all systems together.
 *
 * Lifecycle:
 *   1. new Game(canvas, username, geolocation)
 *   2. await game.init()   — loads assets, connects to server
 *   3. game.start()        — begins the requestAnimationFrame loop
 *
 * The Game class owns:
 *   - The render loop
 *   - NetworkClient subscriptions (bridges network → scene state)
 *   - Interaction handling (player presses E)
 */

import { Camera } from "./Camera.js";
import { InputManager } from "./InputManager.js";
import { Scene } from "./Scene.js";
import { Player } from "./entities/Player.js";
import { UIManager } from "./ui/UIManager.js";
import { NetworkClient } from "./network/NetworkClient.js";
import type { InteractableObject } from "./entities/InteractableObject.js";
import type { GeolocationData, CoffeeMachineInfo } from "./types.js";

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

  private coffeeMachineInfo: CoffeeMachineInfo = { lastRunAt: null, runBy: null };
  private nearbyObject: InteractableObject | null = null;

  private lastTimestamp: number = 0;
  private animFrameId: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    username: string,
    geolocation?: GeolocationData
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.username = username;
    this.geolocation = geolocation;

    this.camera = new Camera();
    this.input = new InputManager();
    this.net = new NetworkClient();
  }

  // ── Initialisation ───────────────────────────────────────────────────────────

  /**
   * Load sprites, connect to WebSocket, and wait for the server welcome.
   * Resolves once the player has been assigned an ID and the scene is set up.
   */
  async init(): Promise<void> {
    // Load image assets in parallel
    const [bgImage, playerSprite] = await Promise.allSettled([
      loadImage("/assets/LesesalBirdView.png"),
      loadImage("/assets/Student.png"),
    ]);

    const bg = bgImage.status === "fulfilled" ? bgImage.value : null;
    const sprite = playerSprite.status === "fulfilled" ? playerSprite.value : null;

    // Build the scene with the loaded assets
    this.scene = new Scene(bg, sprite, this.net);
    this.ui = new UIManager(this.canvas);

    // Connect to the server and wait for the welcome message
    await new Promise<void>((resolve) => {
      this.net.on("welcome", (msg) => {
        // Spawn the local player at the server's designated starting position
        // (we start the player at the default, server will set it via welcome)
        this.player = new Player(
          this.username,
          800,
          500,
          sprite,
          this.input,
          this.net
        );

        this.coffeeMachineInfo = msg.coffeeMachine;
        this.scene.coffeeMachine.lastRunAt = msg.coffeeMachine.lastRunAt;
        this.scene.coffeeMachine.lastRunBy = msg.coffeeMachine.runBy;

        // Add all currently online players
        for (const p of msg.players) {
          this.scene.addRemotePlayer(p);
          if (p.currentTask) {
            this.scene.setRemotePlayerTask(p.id, p.currentTask);
          }
        }

        resolve();
      });

      // Register all other network event handlers before connecting
      this.registerNetworkHandlers();

      // Now actually connect (triggers 'welcome' from server)
      this.net.connect(this.username, this.geolocation);
    });

    // Handle 'E' key for interactions
    this.input.onKeyPressed("e", () => this.handleInteractKey());

    // Handle canvas resize
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  // ── Network event subscriptions ──────────────────────────────────────────────

  private registerNetworkHandlers(): void {
    this.net.on("player_join", (msg) => {
      this.scene.addRemotePlayer(msg.player);
    });

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
    });

    this.net.on("coffee_update", (msg) => {
      this.coffeeMachineInfo = { lastRunAt: msg.lastRunAt, runBy: msg.runBy };
      this.scene.coffeeMachine.lastRunAt = msg.lastRunAt;
      this.scene.coffeeMachine.lastRunBy = msg.runBy;
    });
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  private handleInteractKey(): void {
    if (!this.nearbyObject) return;
    this.nearbyObject.interact(this.username);
  }

  // ── Game loop ────────────────────────────────────────────────────────────────

  start(): void {
    this.lastTimestamp = performance.now();
    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.input.destroy();
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1); // cap at 100ms
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Update local player (movement + network position send)
    this.player.move(dt, this.scene.worldWidth, this.scene.worldHeight);

    // Update scene (remote players + interaction proximity)
    const previousNearby = this.nearbyObject;
    this.nearbyObject = this.scene.update(dt, this.player);

    // If player walked away from an active interactable, call leave()
    if (previousNearby && previousNearby !== this.nearbyObject) {
      previousNearby.leave(this.username);
    }

    // Update camera to follow the local player
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

    // Scene (background + interactables + remote players)
    this.scene.render(ctx, this.camera);

    // Local player rendered on top
    this.player.render(ctx, this.camera);

    // HUD (screen-space — no camera offset needed)
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
      this.nearbyObject,
      this.scene.tables,
      this.coffeeMachineInfo,
      onlinePlayers
    );
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
