/**
 * NetworkClient wraps the browser's native WebSocket API.
 *
 * Usage:
 *   const net = new NetworkClient()
 *   net.on('player_join', (msg) => { ... })
 *   net.connect('MyName', geoloc)
 *   net.sendMove(100, 200)
 */

import type { C2SMessage, S2CMessage } from "../types.js";

type MessageHandler<T extends S2CMessage> = (msg: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = MessageHandler<any>;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, AnyHandler[]> = new Map();
  private messageQueue: C2SMessage[] = [];

  // ── Connection ───────────────────────────────────────────────────────────────

  /**
   * Open the WebSocket connection and send the initial 'join' message.
   * The server replies with 'welcome' which contains the player's assigned ID.
   */
  connect(
    username: string,
    geolocation?: { latitude: number; longitude: number; accuracy: number }
  ): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      console.log("[Network] Connected to server");
      // Send the join message immediately
      const joinMsg: C2SMessage = geolocation
        ? { type: "join", username, geolocation }
        : { type: "join", username };
      this.send(joinMsg);
      // Flush any messages queued before the connection was ready
      for (const msg of this.messageQueue) {
        this.send(msg);
      }
      this.messageQueue = [];
    });

    this.ws.addEventListener("message", (event: MessageEvent<string>) => {
      let msg: S2CMessage;
      try {
        msg = JSON.parse(event.data) as S2CMessage;
      } catch {
        return;
      }
      this.dispatch(msg);
    });

    this.ws.addEventListener("close", () => {
      console.log("[Network] Disconnected from server");
      this.dispatch({ type: "player_leave", playerId: "" }); // Signal game to handle
    });

    this.ws.addEventListener("error", (e) => {
      console.error("[Network] WebSocket error", e);
    });
  }

  // ── Outgoing messages ────────────────────────────────────────────────────────

  sendMove(x: number, y: number): void {
    this.send({ type: "move", x, y });
  }

  sendTaskStart(taskType: "sit" | "coffee", targetId: string): void {
    this.send({ type: "task_start", taskType, targetId });
  }

  sendTaskEnd(taskType: "sit" | "coffee", targetId: string): void {
    this.send({ type: "task_end", taskType, targetId });
  }

  sendGeolocation(lat: number, lng: number, accuracy: number): void {
    this.send({
      type: "geolocation_update",
      geolocation: { latitude: lat, longitude: lng, accuracy },
    });
  }

  // ── Event subscription ───────────────────────────────────────────────────────

  /**
   * Listen for a specific message type from the server.
   * Multiple handlers can be registered for the same type.
   */
  on<T extends S2CMessage["type"]>(
    type: T,
    handler: MessageHandler<Extract<S2CMessage, { type: T }>>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as AnyHandler);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private send(msg: C2SMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Queue the message if the socket isn't open yet
      this.messageQueue.push(msg);
    }
  }

  private dispatch(msg: S2CMessage): void {
    const list = this.handlers.get(msg.type);
    if (list) {
      for (const handler of list) {
        handler(msg);
      }
    }
  }
}
