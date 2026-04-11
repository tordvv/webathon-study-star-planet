/**
 * main.ts — Client entry point.
 *
 * Flow:
 *  1. User sees the login overlay
 *  2. Enters a username and clicks "Join"
 *  3. Browser requests geolocation (optional, user may deny)
 *  4. Game initialises, overlay hides, game loop starts
 */

import { Game } from "./Game.js";
import type { GeolocationData } from "./types.js";

// ── DOM references ────────────────────────────────────────────────────────────

const loginOverlay = document.getElementById("login-overlay") as HTMLDivElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const statusMsg = document.getElementById("status-msg") as HTMLParagraphElement;
const gameCanvas = document.getElementById("game-canvas") as HTMLCanvasElement;

// ── Login handler ─────────────────────────────────────────────────────────────

joinBtn.addEventListener("click", () => void handleJoin());
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void handleJoin();
});

async function handleJoin(): Promise<void> {
  const username = usernameInput.value.trim();
  if (!username) {
    usernameInput.style.borderColor = "#ef4444";
    return;
  }

  joinBtn.disabled = true;
  setStatus("Requesting location…");

  // Attempt to get geolocation (gracefully degrades if denied)
  let geolocation: GeolocationData | undefined;
  try {
    geolocation = await requestGeolocation();
    setStatus("Connecting to study hall…");
  } catch {
    setStatus("Location unavailable — connecting anyway…");
  }

  // Initialise and start the game
  try {
    const game = new Game(gameCanvas, username, geolocation);
    await game.init();

    // Hide login, show canvas
    loginOverlay.style.display = "none";
    gameCanvas.style.display = "block";

    game.start();
  } catch (err) {
    console.error(err);
    setStatus("Failed to connect. Is the server running?");
    joinBtn.disabled = false;
  }
}

// ── Geolocation ───────────────────────────────────────────────────────────────

function requestGeolocation(): Promise<GeolocationData> {
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
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err),
      { timeout: 5000 }
    );
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(msg: string): void {
  statusMsg.textContent = msg;
}
