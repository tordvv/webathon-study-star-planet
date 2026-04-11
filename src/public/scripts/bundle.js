"use strict";
(() => {
  // src/client/Camera.ts
  var Camera = class {
    x = 0;
    y = 0;
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
    follow(targetX, targetY, canvasW, canvasH, worldW, worldH, lerpSpeed = 0.1) {
      const desiredX = targetX - canvasW / 2;
      const desiredY = targetY - canvasH / 2;
      this.x += (desiredX - this.x) * lerpSpeed;
      this.y += (desiredY - this.y) * lerpSpeed;
      this.x = Math.max(0, Math.min(worldW - canvasW, this.x));
      this.y = Math.max(0, Math.min(worldH - canvasH, this.y));
    }
    /** Convert a world-space point to screen-space */
    worldToScreen(worldX, worldY) {
      return { x: worldX - this.x, y: worldY - this.y };
    }
    /** Convert a screen-space point to world-space */
    screenToWorld(screenX, screenY) {
      return { x: screenX + this.x, y: screenY + this.y };
    }
  };

  // src/client/InputManager.ts
  var InputManager = class {
    /** Keys that are currently held down */
    held = /* @__PURE__ */ new Set();
    /** One-shot callbacks triggered on keydown */
    pressCallbacks = /* @__PURE__ */ new Map();
    constructor() {
      window.addEventListener("keydown", (e) => this.handleKeyDown(e));
      window.addEventListener("keyup", (e) => this.handleKeyUp(e));
    }
    // ── Query ────────────────────────────────────────────────────────────────────
    /** Returns true while the key is held */
    isDown(key) {
      return this.held.has(key.toLowerCase());
    }
    // ── Subscriptions ────────────────────────────────────────────────────────────
    /**
     * Register a callback that fires once per key-press (not while held).
     * Multiple callbacks can share the same key.
     */
    onKeyPressed(key, callback) {
      const k = key.toLowerCase();
      if (!this.pressCallbacks.has(k)) {
        this.pressCallbacks.set(k, []);
      }
      this.pressCallbacks.get(k).push(callback);
    }
    /** Remove all registered press callbacks */
    clearCallbacks() {
      this.pressCallbacks.clear();
    }
    // ── Event handlers ───────────────────────────────────────────────────────────
    handleKeyDown(e) {
      const key = e.key.toLowerCase();
      if (this.held.has(key)) return;
      this.held.add(key);
      const callbacks = this.pressCallbacks.get(key);
      if (callbacks) {
        for (const cb of callbacks) cb();
      }
    }
    handleKeyUp(e) {
      this.held.delete(e.key.toLowerCase());
    }
    /** Destroy the input manager and remove event listeners */
    destroy() {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
    }
  };

  // src/client/entities/Entity.ts
  var Entity = class {
    /** World-space centre X position */
    x;
    /** World-space centre Y position */
    y;
    width;
    height;
    constructor(x, y, width, height) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }
    /** The axis-aligned bounding box for this entity */
    get bounds() {
      return {
        left: this.x - this.width / 2,
        top: this.y - this.height / 2,
        right: this.x + this.width / 2,
        bottom: this.y + this.height / 2
      };
    }
    /** Returns the Euclidean distance from this entity's centre to another point */
    distanceTo(ox, oy) {
      const dx = this.x - ox;
      const dy = this.y - oy;
      return Math.sqrt(dx * dx + dy * dy);
    }
  };

  // src/client/entities/InteractableObject.ts
  var InteractableObject = class extends Entity {
    /** Unique identifier used in task records and network messages */
    id;
    /** Human-readable name shown in the interaction prompt */
    label;
    /** Pixels from the entity centre within which the player can interact */
    interactionRadius;
    /**
     * Whether the local player is currently close enough to interact.
     * Updated by the Scene each frame.
     */
    isNearby = false;
    constructor(id, label, x, y, width, height, interactionRadius = 80) {
      super(x, y, width, height);
      this.id = id;
      this.label = label;
      this.interactionRadius = interactionRadius;
    }
    /**
     * Called when the player walks out of range while an interaction is active.
     * Override to cancel in-progress tasks.
     */
    leave(playerUsername) {
      void playerUsername;
    }
    // ── Shared rendering helpers ─────────────────────────────────────────────────
    /**
     * Draw a highlight ring around the object when the player is nearby.
     * Subclasses should call this inside their render() implementation.
     */
    renderHighlight(ctx, sx, sy) {
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
  };

  // src/client/entities/CoffeeMachine.ts
  var CoffeeMachine = class _CoffeeMachine extends InteractableObject {
    /** Unix-ms timestamp of the last coffee run, or null */
    lastRunAt = null;
    /** Username of the person who last made coffee */
    lastRunBy = null;
    /** Whether a brew animation is playing */
    brewingTimer = 0;
    static BREW_DURATION = 1.5;
    // seconds
    net;
    constructor(x, y, net) {
      super("coffee_machine", "Coffee Machine", x, y, 60, 70, 90);
      this.net = net;
    }
    // ── InteractableObject ───────────────────────────────────────────────────────
    get promptLabel() {
      return "E: Make coffee \u2615";
    }
    interact(playerUsername) {
      void playerUsername;
      this.net.sendTaskStart("coffee", this.id);
      this.brewingTimer = _CoffeeMachine.BREW_DURATION;
    }
    // ── Entity ───────────────────────────────────────────────────────────────────
    update(dt) {
      if (this.brewingTimer > 0) {
        this.brewingTimer -= dt;
      }
    }
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      const w = this.width;
      const h = this.height;
      ctx.save();
      const isBrewing = this.brewingTimer > 0;
      ctx.fillStyle = isBrewing ? "#8B4513" : "#5D3A1A";
      roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 8);
      ctx.fill();
      ctx.fillStyle = "#f0f0f0";
      roundRect(ctx, sx - 14, sy - 6, 28, 24, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx - 10, sy - 4, 20, 16);
      ctx.fillStyle = "#4B2E12";
      ctx.fillRect(sx - 10, sy - 4, 20, isBrewing ? 16 * (1 - this.brewingTimer / _CoffeeMachine.BREW_DURATION) : 16);
      if (isBrewing) {
        ctx.strokeStyle = "rgba(200, 200, 200, 0.8)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const ox = sx - 8 + i * 8;
          ctx.beginPath();
          ctx.moveTo(ox, sy - 6);
          ctx.bezierCurveTo(ox + 4, sy - 14, ox - 4, sy - 18, ox, sy - 24);
          ctx.stroke();
        }
      }
      this.renderLastRunLabel(ctx, sx, sy + h / 2 + 12);
      this.renderHighlight(ctx, sx, sy);
      ctx.restore();
    }
    // ── Helpers ──────────────────────────────────────────────────────────────────
    renderLastRunLabel(ctx, sx, sy) {
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      if (!this.lastRunAt) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText("No coffee yet", sx, sy);
        return;
      }
      const ago = formatTimeAgo(this.lastRunAt);
      ctx.fillStyle = "rgba(255,220,50,0.9)";
      ctx.fillText(`Coffee: ${ago}`, sx, sy);
      if (this.lastRunBy) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`by ${this.lastRunBy}`, sx, sy + 13);
      }
    }
  };
  function roundRect(ctx, x, y, w, h, r) {
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
  function formatTimeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1e3);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }

  // src/client/entities/Table.ts
  var Table = class extends InteractableObject {
    /** True when the local player is currently sitting here */
    isLocalPlayerSitting = false;
    /** Timestamp (ms) when the local player sat down */
    sitStartTime = 0;
    /** Elapsed sitting time visible on the HUD while seated */
    get sittingDuration() {
      if (!this.isLocalPlayerSitting) return 0;
      return Date.now() - this.sitStartTime;
    }
    /**
     * Usernames of remote players currently sitting here.
     * Updated via network events.
     */
    remoteSitters = /* @__PURE__ */ new Set();
    net;
    constructor(id, label, x, y, net) {
      super(id, label, x, y, 90, 50, 85);
      this.net = net;
    }
    // ── InteractableObject ───────────────────────────────────────────────────────
    get promptLabel() {
      return this.isLocalPlayerSitting ? "E: Stand up" : "E: Sit down";
    }
    interact(_playerUsername) {
      if (this.isLocalPlayerSitting) {
        this.standUp();
      } else {
        this.sitDown();
      }
    }
    /** Called when the player walks away while still seated */
    leave(_playerUsername) {
      if (this.isLocalPlayerSitting) {
        this.standUp();
      }
    }
    // ── Sitting logic ────────────────────────────────────────────────────────────
    sitDown() {
      this.isLocalPlayerSitting = true;
      this.sitStartTime = Date.now();
      this.net.sendTaskStart("sit", this.id);
    }
    standUp() {
      if (!this.isLocalPlayerSitting) return;
      this.isLocalPlayerSitting = false;
      this.net.sendTaskEnd("sit", this.id);
    }
    // ── Entity ───────────────────────────────────────────────────────────────────
    update(_dt) {
    }
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.fillStyle = "#8B6914";
      roundRect2(ctx, sx - w / 2, sy - h / 2, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = "#5C4309";
      ctx.lineWidth = 2;
      roundRect2(ctx, sx - w / 2, sy - h / 2, w, h, 6);
      ctx.stroke();
      const totalSitters = this.remoteSitters.size + (this.isLocalPlayerSitting ? 1 : 0);
      const seatPositions = [
        { ox: -24, oy: -20 },
        { ox: 24, oy: -20 },
        { ox: -24, oy: 20 },
        { ox: 24, oy: 20 }
      ];
      for (let i = 0; i < seatPositions.length; i++) {
        const pos = seatPositions[i];
        const occupied = i < totalSitters;
        ctx.fillStyle = occupied ? "#4ade80" : "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.arc(sx + pos.ox, sy + pos.oy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, sx, sy);
      if (this.isLocalPlayerSitting) {
        const elapsed = formatDuration(this.sittingDuration);
        ctx.fillStyle = "#facc15";
        ctx.font = "12px monospace";
        ctx.fillText(elapsed, sx, sy + h / 2 + 12);
      }
      this.renderHighlight(ctx, sx, sy);
      ctx.restore();
    }
  };
  function roundRect2(ctx, x, y, w, h, r) {
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
  function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1e3);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor(totalSec % 3600 / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${mm}:${ss}`;
  }

  // src/client/entities/RemotePlayer.ts
  var LERP_SPEED = 12;
  var SPRITE_SIZE = 48;
  var RemotePlayer = class extends Entity {
    id;
    username;
    currentTask;
    /** Target position received from network (we lerp toward this) */
    targetX;
    targetY;
    sprite;
    constructor(id, username, x, y, sprite, currentTask = null) {
      super(x, y, SPRITE_SIZE, SPRITE_SIZE);
      this.id = id;
      this.username = username;
      this.targetX = x;
      this.targetY = y;
      this.sprite = sprite;
      this.currentTask = currentTask;
    }
    // ── Receive server updates ───────────────────────────────────────────────────
    /** Called when a move message is received for this player */
    setTargetPosition(x, y) {
      this.targetX = x;
      this.targetY = y;
    }
    // ── Entity ───────────────────────────────────────────────────────────────────
    update(dt) {
      this.x += (this.targetX - this.x) * LERP_SPEED * dt;
      this.y += (this.targetY - this.y) * LERP_SPEED * dt;
    }
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      ctx.save();
      ctx.globalAlpha = 0.85;
      if (this.sprite) {
        ctx.drawImage(
          this.sprite,
          sx - this.width / 2,
          sy - this.height / 2,
          this.width,
          this.height
        );
      } else {
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(sx, sy, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      ctx.fillText(this.username, sx, sy - this.height / 2 - 2);
      if (this.currentTask) {
        const badge = this.currentTask.taskType === "sit" ? "\u{1F4DA}" : "\u2615";
        ctx.font = "16px sans-serif";
        ctx.textBaseline = "top";
        ctx.shadowBlur = 0;
        ctx.fillText(badge, sx + this.width / 2 - 8, sy - this.height / 2);
      }
      ctx.restore();
    }
  };

  // src/client/Scene.ts
  var TABLE_CONFIG = [
    { id: "table_1", label: "Table 1", x: 320, y: 280 },
    { id: "table_2", label: "Table 2", x: 520, y: 280 },
    { id: "table_3", label: "Table 3", x: 720, y: 280 },
    { id: "table_4", label: "Table 4", x: 420, y: 460 },
    { id: "table_5", label: "Table 5", x: 620, y: 460 },
    { id: "table_6", label: "Table 6", x: 320, y: 640 },
    { id: "table_7", label: "Table 7", x: 520, y: 640 },
    { id: "table_8", label: "Table 8", x: 720, y: 640 }
  ];
  var COFFEE_MACHINE_X = 140;
  var COFFEE_MACHINE_Y = 180;
  var Scene = class {
    /** Background (study hall bird's-eye view) */
    bgImage;
    /** Total world size in pixels (set from the loaded background image) */
    worldWidth = 1200;
    worldHeight = 900;
    coffeeMachine;
    tables;
    /** All interactables in one flat array for easy iteration */
    interactables;
    /** Remote players keyed by server-assigned player ID */
    remotePlayers = /* @__PURE__ */ new Map();
    playerSprite;
    constructor(bgImage, playerSprite, net) {
      this.bgImage = bgImage;
      this.playerSprite = playerSprite;
      if (bgImage) {
        this.worldWidth = bgImage.naturalWidth;
        this.worldHeight = bgImage.naturalHeight;
      }
      this.coffeeMachine = new CoffeeMachine(COFFEE_MACHINE_X, COFFEE_MACHINE_Y, net);
      this.tables = TABLE_CONFIG.map(
        (cfg) => new Table(cfg.id, cfg.label, cfg.x, cfg.y, net)
      );
      this.interactables = [this.coffeeMachine, ...this.tables];
    }
    // ── Remote player management ─────────────────────────────────────────────────
    addRemotePlayer(info) {
      const rp = new RemotePlayer(
        info.id,
        info.username,
        info.x,
        info.y,
        this.playerSprite,
        info.currentTask
      );
      this.remotePlayers.set(info.id, rp);
    }
    removeRemotePlayer(id) {
      this.remotePlayers.delete(id);
    }
    moveRemotePlayer(id, x, y) {
      this.remotePlayers.get(id)?.setTargetPosition(x, y);
    }
    /** Update a remote player's active task and reflect it on the relevant table */
    setRemotePlayerTask(id, task) {
      const rp = this.remotePlayers.get(id);
      if (rp) rp.currentTask = task;
      for (const table of this.tables) {
        table.remoteSitters.delete(id);
      }
      if (task?.taskType === "sit") {
        const table = this.tables.find((t) => t.id === task.targetId);
        if (table && rp) table.remoteSitters.add(rp.username);
      }
    }
    /** Get all remote players as an array (for the HUD player list) */
    getRemotePlayers() {
      return Array.from(this.remotePlayers.values());
    }
    // ── Update ────────────────────────────────────────────────────────────────────
    /**
     * Update all entities and compute interaction proximity.
     * Returns the nearest interactable within range, or null.
     */
    update(dt, player) {
      for (const rp of this.remotePlayers.values()) {
        rp.update(dt);
      }
      for (const obj of this.interactables) {
        obj.update(dt);
      }
      let nearest = null;
      let nearestDist = Infinity;
      for (const obj of this.interactables) {
        const dist = obj.distanceTo(player.x, player.y);
        obj.isNearby = dist <= obj.interactionRadius;
        if (obj.isNearby && dist < nearestDist) {
          nearestDist = dist;
          nearest = obj;
        }
      }
      return nearest;
    }
    // ── Render ────────────────────────────────────────────────────────────────────
    /**
     * Render order:
     *   1. Background image
     *   2. Interactable objects
     *   3. Remote players
     *   (Local player is rendered by Game after this call, above everyone)
     */
    render(ctx, camera) {
      if (this.bgImage) {
        ctx.drawImage(this.bgImage, -camera.x, -camera.y);
      } else {
        ctx.fillStyle = "#2d5a27";
        ctx.fillRect(-camera.x, -camera.y, this.worldWidth, this.worldHeight);
      }
      for (const obj of this.interactables) {
        obj.render(ctx, camera);
      }
      for (const rp of this.remotePlayers.values()) {
        rp.render(ctx, camera);
      }
    }
  };

  // src/client/entities/Player.ts
  var PLAYER_SPEED = 160;
  var POSITION_SEND_INTERVAL = 50;
  var SPRITE_SIZE2 = 48;
  var Player = class extends Entity {
    username;
    sprite;
    input;
    net;
    lastSentX = -1;
    lastSentY = -1;
    timeSinceLastSend = 0;
    constructor(username, x, y, sprite, input, net) {
      super(x, y, SPRITE_SIZE2, SPRITE_SIZE2);
      this.username = username;
      this.sprite = sprite;
      this.input = input;
      this.net = net;
    }
    // ── Entity interface ─────────────────────────────────────────────────────────
    /** Base update — unused; call move() from the game loop instead. */
    update(_dt) {
    }
    // ── Movement + networking ────────────────────────────────────────────────────
    /**
     * Move the player based on held keys and clamp to world bounds.
     * Also throttles position updates to the server.
     *
     * @param dt     Delta time in seconds
     * @param worldW Total world width in pixels
     * @param worldH Total world height in pixels
     */
    move(dt, worldW, worldH) {
      let vx = 0;
      let vy = 0;
      if (this.input.isDown("a") || this.input.isDown("arrowleft")) vx -= 1;
      if (this.input.isDown("d") || this.input.isDown("arrowright")) vx += 1;
      if (this.input.isDown("w") || this.input.isDown("arrowup")) vy -= 1;
      if (this.input.isDown("s") || this.input.isDown("arrowdown")) vy += 1;
      if (vx !== 0 && vy !== 0) {
        vx *= Math.SQRT1_2;
        vy *= Math.SQRT1_2;
      }
      this.x += vx * PLAYER_SPEED * dt;
      this.y += vy * PLAYER_SPEED * dt;
      const hw = this.width / 2;
      const hh = this.height / 2;
      this.x = Math.max(hw, Math.min(worldW - hw, this.x));
      this.y = Math.max(hh, Math.min(worldH - hh, this.y));
      this.timeSinceLastSend += dt * 1e3;
      const moved = Math.abs(this.x - this.lastSentX) > 1 || Math.abs(this.y - this.lastSentY) > 1;
      if (moved && this.timeSinceLastSend >= POSITION_SEND_INTERVAL) {
        this.net.sendMove(Math.round(this.x), Math.round(this.y));
        this.lastSentX = this.x;
        this.lastSentY = this.y;
        this.timeSinceLastSend = 0;
      }
    }
    // ── Rendering ────────────────────────────────────────────────────────────────
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      ctx.save();
      if (this.sprite) {
        ctx.drawImage(
          this.sprite,
          sx - this.width / 2,
          sy - this.height / 2,
          this.width,
          this.height
        );
      } else {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(sx, sy, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      ctx.fillText(this.username, sx, sy - this.height / 2 - 2);
      ctx.restore();
    }
  };

  // src/client/ui/UIManager.ts
  var UIManager = class {
    canvas;
    constructor(canvas) {
      this.canvas = canvas;
    }
    // ── Main draw call (called after all entity rendering) ─────────────────────
    draw(ctx, nearbyObject, activeTables, coffeeMachine, onlinePlayers) {
      ctx.save();
      this.drawInteractionPrompt(ctx, nearbyObject);
      this.drawActiveSittingTimer(ctx, activeTables);
      this.drawCoffeeStatus(ctx, coffeeMachine);
      this.drawPlayerList(ctx, onlinePlayers);
      ctx.restore();
    }
    // ── Individual panels ────────────────────────────────────────────────────────
    /**
     * Draws a centred interaction prompt at the bottom of the screen:
     *   ┌─────────────────────────────┐
     *   │  E: Sit down · Study Table 1 │
     *   └─────────────────────────────┘
     */
    drawInteractionPrompt(ctx, obj) {
      if (!obj) return;
      const text = `${obj.promptLabel}  \xB7  ${obj.label}`;
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height - 48;
      ctx.font = "bold 14px sans-serif";
      const metrics = ctx.measureText(text);
      const pw = metrics.width + 28;
      const ph = 34;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      roundRect3(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 220, 50, 0.9)";
      ctx.lineWidth = 1.5;
      roundRect3(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, cx, cy);
    }
    /**
     * Draws the sitting timer in the bottom-left corner while seated:
     *   📚 Study Table 1 · 00:05:23
     */
    drawActiveSittingTimer(ctx, tables) {
      const sitting = tables.find((t) => t.isLocalPlayerSitting);
      if (!sitting) return;
      const duration = formatDuration(sitting.sittingDuration);
      const text = `\u{1F4DA} ${sitting.label}  \xB7  ${duration}`;
      const x = 16;
      const y = this.canvas.height - 48;
      ctx.font = "bold 14px sans-serif";
      const metrics = ctx.measureText(text);
      const pw = metrics.width + 28;
      const ph = 34;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      roundRect3(ctx, x, y - ph / 2, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
      ctx.lineWidth = 1.5;
      roundRect3(ctx, x, y - ph / 2, pw, ph, 8);
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
    drawCoffeeStatus(ctx, coffee) {
      const line1 = coffee.lastRunAt ? `\u2615 ${timeAgo(coffee.lastRunAt)}` : "\u2615 No coffee yet";
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
    drawPlayerList(ctx, players) {
      if (players.length === 0) return;
      const lineH = 18;
      const pw = 180;
      const ph = players.length * lineH + 24;
      const x = this.canvas.width - pw - 12;
      const y = 12;
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      roundRect3(ctx, x, y, pw, ph, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Online (${players.length})`, x + 10, y + 7);
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const py = y + 24 + i * lineH;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "12px sans-serif";
        const label = p.taskLabel ? `${p.username} ${p.taskLabel}` : p.username;
        ctx.fillText(`\u2022 ${label}`, x + 10, py);
      }
    }
  };
  function roundRect3(ctx, x, y, w, h, r) {
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
  function timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1e3);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }

  // src/client/network/NetworkClient.ts
  var NetworkClient = class {
    ws = null;
    handlers = /* @__PURE__ */ new Map();
    messageQueue = [];
    // ── Connection ───────────────────────────────────────────────────────────────
    /**
     * Open the WebSocket connection and send the initial 'join' message.
     * The server replies with 'welcome' which contains the player's assigned ID.
     */
    connect(username, geolocation) {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${location.host}/ws`;
      this.ws = new WebSocket(url);
      this.ws.addEventListener("open", () => {
        console.log("[Network] Connected to server");
        const joinMsg = geolocation ? { type: "join", username, geolocation } : { type: "join", username };
        this.send(joinMsg);
        for (const msg of this.messageQueue) {
          this.send(msg);
        }
        this.messageQueue = [];
      });
      this.ws.addEventListener("message", (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        this.dispatch(msg);
      });
      this.ws.addEventListener("close", () => {
        console.log("[Network] Disconnected from server");
        this.dispatch({ type: "player_leave", playerId: "" });
      });
      this.ws.addEventListener("error", (e) => {
        console.error("[Network] WebSocket error", e);
      });
    }
    // ── Outgoing messages ────────────────────────────────────────────────────────
    sendMove(x, y) {
      this.send({ type: "move", x, y });
    }
    sendTaskStart(taskType, targetId) {
      this.send({ type: "task_start", taskType, targetId });
    }
    sendTaskEnd(taskType, targetId) {
      this.send({ type: "task_end", taskType, targetId });
    }
    sendGeolocation(lat, lng, accuracy) {
      this.send({
        type: "geolocation_update",
        geolocation: { latitude: lat, longitude: lng, accuracy }
      });
    }
    // ── Event subscription ───────────────────────────────────────────────────────
    /**
     * Listen for a specific message type from the server.
     * Multiple handlers can be registered for the same type.
     */
    on(type, handler) {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, []);
      }
      this.handlers.get(type).push(handler);
    }
    // ── Private helpers ──────────────────────────────────────────────────────────
    send(msg) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      } else {
        this.messageQueue.push(msg);
      }
    }
    dispatch(msg) {
      const list = this.handlers.get(msg.type);
      if (list) {
        for (const handler of list) {
          handler(msg);
        }
      }
    }
  };

  // src/client/Game.ts
  var Game = class {
    canvas;
    ctx;
    username;
    geolocation;
    camera;
    input;
    net;
    scene;
    player;
    ui;
    coffeeMachineInfo = { lastRunAt: null, runBy: null };
    nearbyObject = null;
    lastTimestamp = 0;
    animFrameId = 0;
    constructor(canvas, username, geolocation) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
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
    async init() {
      const [bgImage, playerSprite] = await Promise.allSettled([
        loadImage("/assets/LesesalBirdView.png"),
        loadImage("/assets/Student.png")
      ]);
      const bg = bgImage.status === "fulfilled" ? bgImage.value : null;
      const sprite = playerSprite.status === "fulfilled" ? playerSprite.value : null;
      this.scene = new Scene(bg, sprite, this.net);
      this.ui = new UIManager(this.canvas);
      await new Promise((resolve) => {
        this.net.on("welcome", (msg) => {
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
          for (const p of msg.players) {
            this.scene.addRemotePlayer(p);
            if (p.currentTask) {
              this.scene.setRemotePlayerTask(p.id, p.currentTask);
            }
          }
          resolve();
        });
        this.registerNetworkHandlers();
        this.net.connect(this.username, this.geolocation);
      });
      this.input.onKeyPressed("e", () => this.handleInteractKey());
      this.resizeCanvas();
      window.addEventListener("resize", () => this.resizeCanvas());
    }
    // ── Network event subscriptions ──────────────────────────────────────────────
    registerNetworkHandlers() {
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
          startedAt: msg.startedAt
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
    handleInteractKey() {
      if (!this.nearbyObject) return;
      this.nearbyObject.interact(this.username);
    }
    // ── Game loop ────────────────────────────────────────────────────────────────
    start() {
      this.lastTimestamp = performance.now();
      this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }
    stop() {
      cancelAnimationFrame(this.animFrameId);
      this.input.destroy();
    }
    loop(timestamp) {
      const dt = Math.min((timestamp - this.lastTimestamp) / 1e3, 0.1);
      this.lastTimestamp = timestamp;
      this.update(dt);
      this.render();
      this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }
    // ── Update ────────────────────────────────────────────────────────────────────
    update(dt) {
      this.player.move(dt, this.scene.worldWidth, this.scene.worldHeight);
      const previousNearby = this.nearbyObject;
      this.nearbyObject = this.scene.update(dt, this.player);
      if (previousNearby && previousNearby !== this.nearbyObject) {
        previousNearby.leave(this.username);
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
    render() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.scene.render(ctx, this.camera);
      this.player.render(ctx, this.camera);
      const onlinePlayers = [
        { username: this.username },
        ...this.scene.getRemotePlayers().map((rp) => {
          const entry = { username: rp.username };
          if (rp.currentTask) {
            entry.taskLabel = rp.currentTask.taskType === "sit" ? "\u{1F4DA}" : "\u2615";
          }
          return entry;
        })
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
    resizeCanvas() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  };
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  // src/client/main.ts
  var loginOverlay = document.getElementById("login-overlay");
  var usernameInput = document.getElementById("username-input");
  var joinBtn = document.getElementById("join-btn");
  var statusMsg = document.getElementById("status-msg");
  var gameCanvas = document.getElementById("game-canvas");
  joinBtn.addEventListener("click", () => void handleJoin());
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void handleJoin();
  });
  async function handleJoin() {
    const username = usernameInput.value.trim();
    if (!username) {
      usernameInput.style.borderColor = "#ef4444";
      return;
    }
    joinBtn.disabled = true;
    setStatus("Requesting location\u2026");
    let geolocation;
    try {
      geolocation = await requestGeolocation();
      setStatus("Connecting to study hall\u2026");
    } catch {
      setStatus("Location unavailable \u2014 connecting anyway\u2026");
    }
    try {
      const game = new Game(gameCanvas, username, geolocation);
      await game.init();
      loginOverlay.style.display = "none";
      gameCanvas.style.display = "block";
      game.start();
    } catch (err) {
      console.error(err);
      setStatus("Failed to connect. Is the server running?");
      joinBtn.disabled = false;
    }
  }
  function requestGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not available"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => reject(err),
        { timeout: 5e3 }
      );
    });
  }
  function setStatus(msg) {
    statusMsg.textContent = msg;
  }
})();
