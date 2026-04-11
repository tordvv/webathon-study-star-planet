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

  // src/client/entities/Bookshelf.ts
  var Bookshelf = class extends InteractableObject {
    /** URL that will be opened in a new tab when the player interacts */
    url;
    constructor(id, label, x, y, url) {
      super(id, label, x, y, 70, 100, 85);
      this.url = url;
    }
    // ── InteractableObject ───────────────────────────────────────────────────────
    get promptLabel() {
      return "E: Browse books \u{1F4D6}";
    }
    interact(_playerUsername) {
      window.open(this.url, "_blank", "noopener,noreferrer");
    }
    // ── Entity ───────────────────────────────────────────────────────────────────
    update(_dt) {
    }
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.fillStyle = "#3b1f0a";
      ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      const shelfRows = 3;
      const bookColors = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad"];
      const rowH = (h - 16) / shelfRows;
      for (let row = 0; row < shelfRows; row++) {
        const rowY = sy - h / 2 + 8 + row * rowH;
        let bx = sx - w / 2 + 4;
        let bookIdx = row * 3;
        while (bx < sx + w / 2 - 8) {
          const bw = 8 + bookIdx * 7 % 10;
          ctx.fillStyle = bookColors[bookIdx % bookColors.length];
          ctx.fillRect(bx, rowY, bw, rowH - 4);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(bx, rowY, 2, rowH - 4);
          bx += bw + 2;
          bookIdx++;
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(this.label, sx, sy + h / 2 - 2);
      this.renderHighlight(ctx, sx, sy);
      ctx.restore();
    }
  };

  // src/client/entities/GamblingTable.ts
  var GamblingTable = class extends InteractableObject {
    /** Called when the player interacts — should open the blackjack overlay */
    onOpen;
    constructor(x, y, onOpen) {
      super("gambling_table", "Gambling Table", x, y, 100, 60, 90);
      this.onOpen = onOpen;
    }
    // ── InteractableObject ───────────────────────────────────────────────────────
    get promptLabel() {
      return "E: Play Blackjack \u{1F0CF}";
    }
    interact(_playerUsername) {
      this.onOpen();
    }
    // ── Entity ───────────────────────────────────────────────────────────────────
    update(_dt) {
    }
    render(ctx, camera) {
      const { x: sx, y: sy } = camera.worldToScreen(this.x, this.y);
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.fillStyle = "#1a6b2a";
      roundRect3(ctx, sx - w / 2, sy - h / 2, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 3;
      roundRect3(ctx, sx - w / 2, sy - h / 2, w, h, 8);
      ctx.stroke();
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u2660 \u2665 \u2666 \u2663", sx, sy - 8);
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(this.label, sx, sy + 14);
      this.renderHighlight(ctx, sx, sy);
      ctx.restore();
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

  // src/client/MapBounds.ts
  var WALKABLE_BOUNDS = {
    minX: 30,
    minY: 30,
    maxX: 1170,
    // will be clamped to worldWidth  if smaller
    maxY: 870
    // will be clamped to worldHeight if smaller
  };

  // src/client/Scene.ts
  var SHOW_BOUNDS_DEBUG = false;
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
  var COFFEE_MACHINE_POS = { x: 140, y: 180 };
  var GAMBLING_TABLE_POS = { x: 950, y: 300 };
  var BOOKSHELF_CONFIG = [
    {
      id: "bookshelf_1",
      label: "Library",
      x: 880,
      y: 180,
      /** URL opened when the player interacts — change this to any study resource */
      url: "https://en.wikipedia.org/wiki/Main_Page"
    }
  ];
  var Scene = class {
    bgImage;
    worldWidth = 1200;
    worldHeight = 900;
    /** The walkable area — clamped to world size after image loads */
    mapBounds;
    coffeeMachine;
    tables;
    bookshelves;
    gamblingTable;
    interactables;
    remotePlayers = /* @__PURE__ */ new Map();
    playerSprite;
    constructor(bgImage, playerSprite, net, onOpenBlackjack) {
      this.bgImage = bgImage;
      this.playerSprite = playerSprite;
      if (bgImage) {
        this.worldWidth = bgImage.naturalWidth;
        this.worldHeight = bgImage.naturalHeight;
      }
      this.mapBounds = {
        minX: WALKABLE_BOUNDS.minX,
        minY: WALKABLE_BOUNDS.minY,
        maxX: Math.min(WALKABLE_BOUNDS.maxX, this.worldWidth),
        maxY: Math.min(WALKABLE_BOUNDS.maxY, this.worldHeight)
      };
      this.coffeeMachine = new CoffeeMachine(COFFEE_MACHINE_POS.x, COFFEE_MACHINE_POS.y, net);
      this.tables = TABLE_CONFIG.map((cfg) => new Table(cfg.id, cfg.label, cfg.x, cfg.y, net));
      this.bookshelves = BOOKSHELF_CONFIG.map(
        (cfg) => new Bookshelf(cfg.id, cfg.label, cfg.x, cfg.y, cfg.url)
      );
      this.gamblingTable = new GamblingTable(GAMBLING_TABLE_POS.x, GAMBLING_TABLE_POS.y, onOpenBlackjack);
      this.interactables = [
        this.coffeeMachine,
        ...this.tables,
        ...this.bookshelves,
        this.gamblingTable
      ];
    }
    // ── Remote player management ──────────────────────────────────────────────────
    addRemotePlayer(info) {
      const rp = new RemotePlayer(info.id, info.username, info.x, info.y, this.playerSprite, info.currentTask);
      this.remotePlayers.set(info.id, rp);
    }
    removeRemotePlayer(id) {
      this.remotePlayers.delete(id);
    }
    moveRemotePlayer(id, x, y) {
      this.remotePlayers.get(id)?.setTargetPosition(x, y);
    }
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
    getRemotePlayers() {
      return Array.from(this.remotePlayers.values());
    }
    // ── Update ────────────────────────────────────────────────────────────────────
    update(dt, player) {
      for (const rp of this.remotePlayers.values()) rp.update(dt);
      for (const obj of this.interactables) obj.update(dt);
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
    render(ctx, camera) {
      if (this.bgImage) {
        ctx.drawImage(this.bgImage, -camera.x, -camera.y);
      } else {
        ctx.fillStyle = "#2d5a27";
        ctx.fillRect(-camera.x, -camera.y, this.worldWidth, this.worldHeight);
      }
      if (SHOW_BOUNDS_DEBUG) {
        const b = this.mapBounds;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(b.minX - camera.x, b.minY - camera.y, b.maxX - b.minX, b.maxY - b.minY);
        ctx.setLineDash([]);
        ctx.restore();
      }
      for (const obj of this.interactables) obj.render(ctx, camera);
      for (const rp of this.remotePlayers.values()) rp.render(ctx, camera);
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
     * Move the player based on held keys and clamp to the given bounding box.
     * Also throttles position updates to the server.
     *
     * @param dt     Delta time in seconds
     * @param bounds Walkable area in world-space (see MapBounds.ts)
     */
    move(dt, bounds) {
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
      this.x = Math.max(bounds.minX + hw, Math.min(bounds.maxX - hw, this.x));
      this.y = Math.max(bounds.minY + hh, Math.min(bounds.maxY - hh, this.y));
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
    draw(ctx, nearbyObject, activeTables, coffeeMachine, onlinePlayers, tokens) {
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
      roundRect4(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 220, 50, 0.9)";
      ctx.lineWidth = 1.5;
      roundRect4(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 8);
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
      roundRect4(ctx, x, y - ph / 2, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
      ctx.lineWidth = 1.5;
      roundRect4(ctx, x, y - ph / 2, pw, ph, 8);
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
      roundRect4(ctx, x, y, pw, ph, 8);
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
    /**
     * Token balance counter in the top-left corner:
     *   🪙 42
     */
    drawTokenCounter(ctx, tokens) {
      ctx.save();
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillText(`\u{1FA99} ${tokens}`, 13, 13);
      ctx.fillStyle = "#facc15";
      ctx.fillText(`\u{1FA99} ${tokens}`, 12, 12);
      ctx.restore();
    }
    /**
     * Subtle hint reminding the player they can press Tab for their profile.
     */
    drawTabHint(ctx) {
      ctx.save();
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText("Tab \u2014 Profile", 12, 32);
      ctx.restore();
    }
  };
  function roundRect4(ctx, x, y, w, h, r) {
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

  // src/client/ui/ProfileMenu.ts
  var ProfileMenu = class {
    canvas;
    username;
    stats;
    tokens;
    constructor(canvas, username) {
      this.canvas = canvas;
      this.username = username;
      this.stats = {
        sittingTodayMs: 0,
        sittingThisYearMs: 0,
        coffeesMadeToday: 0,
        coffeesMadeThisYear: 0
      };
      this.tokens = 0;
    }
    // ── Data setters ─────────────────────────────────────────────────────────────
    updateStats(stats) {
      this.stats = { ...stats };
    }
    updateTokens(tokens) {
      this.tokens = tokens;
    }
    // ── Render ────────────────────────────────────────────────────────────────────
    render(ctx) {
      const { width: cw, height: ch } = this.canvas;
      const panelW = Math.min(500, cw - 60);
      const panelH = Math.min(400, ch - 80);
      const px = (cw - panelW) / 2;
      const py = (ch - panelH) / 2;
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#1e293b";
      roundRect5(ctx, px, py, panelW, panelH, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
      ctx.lineWidth = 2;
      roundRect5(ctx, px, py, panelW, panelH, 16);
      ctx.stroke();
      const cx = cw / 2;
      let y = py + 28;
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("\u{1F4CA} My Profile", cx, y);
      y += 34;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "14px sans-serif";
      ctx.fillText(this.username, cx, y);
      y += 26;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 20, y);
      ctx.lineTo(px + panelW - 20, y);
      ctx.stroke();
      y += 16;
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${this.tokens} \u{1FA99}`, cx, y);
      y += 50;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.fillText("tokens", cx, y);
      y += 30;
      const rows = [
        ["Studied today", formatDuration(this.stats.sittingTodayMs)],
        ["Studied this year", formatDuration(this.stats.sittingThisYearMs)],
        ["Coffees today", String(this.stats.coffeesMadeToday)],
        ["Coffees this year", String(this.stats.coffeesMadeThisYear)]
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
        y += 22;
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 30, y + 1);
        ctx.lineTo(px + panelW - 30, y + 1);
        ctx.stroke();
        y += 4;
      }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("Press Tab to close", cx, py + panelH - 14);
      ctx.restore();
    }
  };
  function roundRect5(ctx, x, y, w, h, r) {
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

  // src/client/ui/BlackjackGame.ts
  var BlackjackGame = class {
    canvas;
    tokenBalance;
    onTokenChange;
    onClose;
    state = "idle";
    deck = [];
    playerHand = [];
    dealerHand = [];
    bet = 5;
    resultMessage = "";
    resultColour = "#fff";
    // Dealer turn animation delay
    dealerDelay = 0;
    DEALER_DELAY = 0.7;
    // seconds between dealer cards
    constructor(canvas, initialTokens, onTokenChange, onClose) {
      this.canvas = canvas;
      this.tokenBalance = initialTokens;
      this.onTokenChange = onTokenChange;
      this.onClose = onClose;
      this.clampBet();
    }
    /** Call this when the player's token balance changes externally */
    setTokenBalance(n) {
      this.tokenBalance = n;
      this.clampBet();
    }
    // ── Input ─────────────────────────────────────────────────────────────────────
    /**
     * Route a key press to the game.
     * Call this from InputManager's onKeyPressed handler while the overlay is open.
     */
    handleKey(key) {
      const k = key.toLowerCase();
      switch (this.state) {
        case "idle":
          if (k === "enter") this.deal();
          if (k === "arrowup") this.adjustBet(1);
          if (k === "arrowdown") this.adjustBet(-1);
          if (k === "escape") this.onClose();
          break;
        case "playerTurn":
          if (k === "h") this.hit();
          if (k === "s") this.stand();
          if (k === "d") this.doubleDown();
          break;
        case "result":
          if (k === "enter") {
            this.state = "idle";
            this.clampBet();
          }
          if (k === "escape") this.onClose();
          break;
        default:
          break;
      }
    }
    // ── Update ────────────────────────────────────────────────────────────────────
    update(dt) {
      if (this.state !== "dealerTurn") return;
      this.dealerDelay -= dt;
      if (this.dealerDelay > 0) return;
      const hidden = this.dealerHand.find((c) => c.hidden);
      if (hidden) {
        hidden.hidden = false;
        this.dealerDelay = this.DEALER_DELAY;
        return;
      }
      const value = handValue(this.dealerHand);
      if (value <= 16) {
        this.dealerHand.push(drawCard(this.deck));
        this.dealerDelay = this.DEALER_DELAY;
        if (handValue(this.dealerHand) > 21) {
          this.resolveRound();
        }
      } else {
        this.resolveRound();
      }
    }
    // ── Render ────────────────────────────────────────────────────────────────────
    render(ctx) {
      const { width: cw, height: ch } = this.canvas;
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
      ctx.fillRect(0, 0, cw, ch);
      const panelW = Math.min(700, cw - 40);
      const panelH = Math.min(480, ch - 40);
      const px = (cw - panelW) / 2;
      const py = (ch - panelH) / 2;
      ctx.fillStyle = "#14532d";
      roundRect6(ctx, px, py, panelW, panelH, 20);
      ctx.fill();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 3;
      roundRect6(ctx, px, py, panelW, panelH, 20);
      ctx.stroke();
      const cx = cw / 2;
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 28px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("\u2660 BLACKJACK \u2660", cx, py + 16);
      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.fillText(`Balance: ${this.tokenBalance} \u{1FA99}   Bet: ${this.bet} \u{1FA99}`, cx, py + 54);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "13px sans-serif";
      ctx.textBaseline = "top";
      const dealerLabel = this.state === "idle" || this.state === "result" ? `Dealer: ${handValue(this.dealerHand)}` : this.dealerHand.some((c) => c.hidden) ? "Dealer: ?" : `Dealer: ${handValue(this.dealerHand)}`;
      ctx.fillText(dealerLabel, cx, py + 90);
      this.renderHand(ctx, this.dealerHand, cx, py + 112);
      const playerVal = handValue(this.playerHand);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "13px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(
        this.playerHand.length ? `You: ${playerVal}${playerVal > 21 ? "  BUST" : ""}` : "Your hand:",
        cx,
        py + 255
      );
      this.renderHand(ctx, this.playerHand, cx, py + 278);
      const controlY = py + panelH - 56;
      if (this.state === "idle") {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText("\u2191\u2193 Adjust bet   Enter = Deal   Esc = Exit", cx, controlY);
      } else if (this.state === "playerTurn") {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 14px sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText("H = Hit   S = Stand   D = Double Down", cx, controlY);
      } else if (this.state === "result") {
        ctx.fillStyle = this.resultColour;
        ctx.font = "bold 22px serif";
        ctx.textBaseline = "top";
        ctx.fillText(this.resultMessage, cx, controlY - 10);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px sans-serif";
        ctx.fillText("Enter = Play again   Esc = Exit", cx, controlY + 22);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText("Dealer playing\u2026", cx, controlY);
      }
      ctx.restore();
    }
    // ── Game actions ──────────────────────────────────────────────────────────────
    deal() {
      if (this.tokenBalance < this.bet) {
        this.resultMessage = "Not enough tokens!";
        this.resultColour = "#ef4444";
        this.state = "result";
        return;
      }
      this.deck = buildDeck();
      shuffle(this.deck);
      this.playerHand = [drawCard(this.deck), drawCard(this.deck)];
      this.dealerHand = [drawCard(this.deck), { ...drawCard(this.deck), hidden: true }];
      this.onTokenChange(-this.bet);
      this.tokenBalance -= this.bet;
      if (handValue(this.playerHand) === 21) {
        this.beginDealerTurn();
        return;
      }
      this.state = "playerTurn";
    }
    hit() {
      if (this.state !== "playerTurn") return;
      this.playerHand.push(drawCard(this.deck));
      if (handValue(this.playerHand) > 21) {
        this.resolveRound();
      }
    }
    stand() {
      if (this.state !== "playerTurn") return;
      this.beginDealerTurn();
    }
    doubleDown() {
      if (this.state !== "playerTurn" || this.playerHand.length !== 2) return;
      if (this.tokenBalance < this.bet) return;
      this.onTokenChange(-this.bet);
      this.tokenBalance -= this.bet;
      this.bet *= 2;
      this.playerHand.push(drawCard(this.deck));
      if (handValue(this.playerHand) > 21) {
        this.resolveRound();
      } else {
        this.beginDealerTurn();
      }
    }
    beginDealerTurn() {
      this.state = "dealerTurn";
      this.dealerDelay = this.DEALER_DELAY;
    }
    resolveRound() {
      this.state = "result";
      const pv = handValue(this.playerHand);
      const dv = handValue(this.dealerHand);
      const playerBJ = pv === 21 && this.playerHand.length === 2;
      const dealerBJ = dv === 21 && this.dealerHand.length === 2;
      let delta = 0;
      let msg;
      let colour;
      if (pv > 21) {
        msg = "Bust! You lose.";
        colour = "#ef4444";
        delta = 0;
      } else if (dealerBJ && !playerBJ) {
        msg = "Dealer Blackjack! You lose.";
        colour = "#ef4444";
      } else if (playerBJ && !dealerBJ) {
        delta = this.bet + Math.floor(this.bet * 1.5);
        msg = `Blackjack! +${delta} \u{1FA99}`;
        colour = "#facc15";
      } else if (dv > 21) {
        delta = this.bet * 2;
        msg = `Dealer busts! You win +${this.bet} \u{1FA99}`;
        colour = "#4ade80";
      } else if (pv > dv) {
        delta = this.bet * 2;
        msg = `You win! +${this.bet} \u{1FA99}`;
        colour = "#4ade80";
      } else if (pv === dv) {
        delta = this.bet;
        msg = "Push. Bet returned.";
        colour = "#93c5fd";
      } else {
        msg = "Dealer wins. You lose.";
        colour = "#ef4444";
      }
      if (delta > 0) {
        this.onTokenChange(delta);
        this.tokenBalance += delta;
      }
      this.bet = Math.min(this.bet, this.tokenBalance) || 1;
      this.resultMessage = msg;
      this.resultColour = colour;
    }
    adjustBet(direction) {
      if (this.state !== "idle") return;
      this.bet = Math.max(1, Math.min(this.tokenBalance || 1, this.bet + direction));
    }
    clampBet() {
      this.bet = Math.max(1, Math.min(Math.max(1, this.tokenBalance), this.bet));
    }
    // ── Card rendering ────────────────────────────────────────────────────────────
    renderHand(ctx, hand, centreX, topY) {
      const cardW = 52;
      const cardH = 72;
      const gap = 8;
      const totalW = hand.length * (cardW + gap) - gap;
      const startX = centreX - totalW / 2;
      for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        const cx = startX + i * (cardW + gap);
        renderCard(ctx, card, cx, topY, cardW, cardH);
      }
    }
  };
  var SUITS = ["\u2660", "\u2665", "\u2666", "\u2663"];
  var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
    return deck;
  }
  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = deck[i];
      const b = deck[j];
      deck[i] = b;
      deck[j] = a;
    }
  }
  function drawCard(deck) {
    const card = deck.pop();
    if (!card) throw new Error("Deck is empty");
    return { ...card };
  }
  function cardNumericValue(rank) {
    if (rank === "A") return 11;
    if (["J", "Q", "K"].includes(rank)) return 10;
    return parseInt(rank, 10);
  }
  function handValue(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.hidden) continue;
      if (card.rank === "A") aces++;
      total += cardNumericValue(card.rank);
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }
  function renderCard(ctx, card, x, y, w, h) {
    ctx.save();
    if (card.hidden) {
      ctx.fillStyle = "#1e40af";
      roundRect6(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1.5;
      roundRect6(ctx, x, y, w, h, 5);
      ctx.stroke();
      ctx.strokeStyle = "rgba(147,197,253,0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 6) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x, y + i);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w - i, y + h);
        ctx.lineTo(x + w, y + h - i);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#fff";
      roundRect6(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 1;
      roundRect6(ctx, x, y, w, h, 5);
      ctx.stroke();
      const isRed = card.suit === "\u2665" || card.suit === "\u2666";
      ctx.fillStyle = isRed ? "#dc2626" : "#111";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(card.rank, x + 4, y + 2);
      ctx.font = "11px sans-serif";
      ctx.fillText(card.suit, x + 4, y + 16);
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.suit, x + w / 2, y + h / 2);
    }
    ctx.restore();
  }
  function roundRect6(ctx, x, y, w, h, r) {
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
    profileMenu;
    blackjack;
    coffeeMachineInfo = { lastRunAt: null, runBy: null };
    nearbyObject = null;
    tokens = 0;
    stats = {
      sittingTodayMs: 0,
      sittingThisYearMs: 0,
      coffeesMadeToday: 0,
      coffeesMadeThisYear: 0,
      tokens: 0
    };
    overlay = "none";
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
    // ── Initialisation ────────────────────────────────────────────────────────────
    async init() {
      const [bgResult, spriteResult] = await Promise.allSettled([
        loadImage("/assets/LesesalBirdView.png"),
        loadImage("/assets/Student.png")
      ]);
      const bg = bgResult.status === "fulfilled" ? bgResult.value : null;
      const sprite = spriteResult.status === "fulfilled" ? spriteResult.value : null;
      this.scene = new Scene(bg, sprite, this.net, () => this.openBlackjack());
      this.ui = new UIManager(this.canvas);
      this.profileMenu = new ProfileMenu(this.canvas, this.username);
      await new Promise((resolve) => {
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
      this.input.onKeyPressed("tab", () => this.toggleProfile());
      this.input.onKeyPressed("e", () => this.handleInteractKey());
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
    registerNetworkHandlers() {
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
      this.net.on("token_update", (msg) => {
        this.tokens = msg.tokens;
        this.profileMenu.updateTokens(this.tokens);
        this.blackjack?.setTokenBalance(this.tokens);
        this.stats.tokens = this.tokens;
        this.profileMenu.updateStats(this.stats);
      });
    }
    // ── Interaction ───────────────────────────────────────────────────────────────
    handleInteractKey() {
      if (this.overlay !== "none") return;
      if (!this.nearbyObject) return;
      this.nearbyObject.interact(this.username);
    }
    // ── Overlay management ────────────────────────────────────────────────────────
    toggleProfile() {
      if (this.overlay === "profile") {
        this.overlay = "none";
      } else if (this.overlay === "none") {
        this.overlay = "profile";
      }
    }
    openBlackjack() {
      if (this.overlay !== "none") return;
      this.blackjack.setTokenBalance(this.tokens);
      this.overlay = "blackjack";
    }
    closeBlackjack() {
      this.overlay = "none";
    }
    handleBlackjackTokenChange(delta) {
      this.tokens = Math.max(0, this.tokens + delta);
      this.profileMenu.updateTokens(this.tokens);
      this.stats.tokens = this.tokens;
      this.profileMenu.updateStats(this.stats);
    }
    // ── Game loop ─────────────────────────────────────────────────────────────────
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
      if (this.overlay === "none") {
        this.player.move(dt, this.scene.mapBounds);
        const previousNearby = this.nearbyObject;
        this.nearbyObject = this.scene.update(dt, this.player);
        if (previousNearby && previousNearby !== this.nearbyObject) {
          previousNearby.leave(this.username);
        }
      } else {
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
    render() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.scene.render(ctx, this.camera);
      this.player.render(ctx, this.camera);
      if (this.overlay !== "blackjack") {
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
          this.overlay === "none" ? this.nearbyObject : null,
          this.scene.tables,
          this.coffeeMachineInfo,
          onlinePlayers,
          this.tokens
        );
      }
      if (this.overlay === "profile") {
        this.profileMenu.render(ctx);
      } else if (this.overlay === "blackjack") {
        this.blackjack.render(ctx);
      }
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
