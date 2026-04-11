/**
 * Entry point for the StudyStarPlanet server.
 *
 * Responsibilities:
 *  - Serve the static game client (HTML + bundled JS + assets)
 *  - Provide a WebSocket endpoint for real-time multiplayer at /ws
 *  - Provide REST endpoints for stats/data (expandable)
 */

import express from "express";
import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Database } from "./server/Database.js";
import { GameServer } from "./server/GameServer.js";

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Express setup ────────────────────────────────────────────────────────────

const app = express();
const port = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000;

// Parse JSON request bodies (for future REST endpoints)
app.use(express.json());

// Serve the compiled client bundle and HTML from src/public/
app.use(express.static(join(__dirname, "public")));

// Serve the game assets (sprites, backgrounds) from resources/
app.use("/assets", express.static(join(__dirname, "../resources")));

// Root route — serve the game page
app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

// ── REST: Stats endpoint (bonus: view activity from a browser) ───────────────

app.get("/api/stats", (_req, res) => {
  const sessions = db.getAllSessions();
  const tasks = db.getTasks();
  const coffee = db.getCoffeeMachine();
  res.json({ sessions, tasks, coffeeMachine: coffee });
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

const db = new Database();
const server = http.createServer(app);

// Attach the WebSocket game server to the same HTTP server
new GameServer(server, db);

server.listen(port, () => {
  console.log(`[Server] StudyStarPlanet running at http://localhost:${port}`);
});
