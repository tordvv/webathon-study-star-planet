/**
 * BlackjackGame — a fully self-contained Blackjack mini-game.
 *
 * Renders as a full-screen canvas overlay on top of the study hall.
 * The game is driven entirely by keyboard input routed from Game.ts
 * while the overlay is active.
 *
 * Rules:
 *  - Standard Blackjack: beat the dealer without going over 21
 *  - Dealer hits on ≤ 16, stands on ≥ 17
 *  - Natural Blackjack (first 2 cards = 21) pays 3:2
 *  - Double Down available on first two cards
 *  - No splitting (keep it simple)
 *
 * Token economy:
 *  - Minimum bet: 1 token, maximum: all tokens
 *  - Win: bet × 1, Blackjack: bet × 1.5 (rounded down), Lose: lose bet
 *  - onTokenChange(delta) is called whenever the balance changes
 */

// ── Card types ────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
  suit: Suit;
  rank: Rank;
  hidden?: boolean; // true = face-down (only dealer's second card)
}

type GameState = "idle" | "playerTurn" | "dealerTurn" | "result";

// ── BlackjackGame ─────────────────────────────────────────────────────────────

export class BlackjackGame {
  private canvas: HTMLCanvasElement;
  private tokenBalance: number;
  private onTokenChange: (delta: number) => void;
  private onClose: () => void;

  private state: GameState = "idle";
  private deck: Card[] = [];
  private playerHand: Card[] = [];
  private dealerHand: Card[] = [];
  private bet: number = 5;
  private resultMessage: string = "";
  private resultColour: string = "#fff";

  // Dealer turn animation delay
  private dealerDelay: number = 0;
  private readonly DEALER_DELAY = 0.7; // seconds between dealer cards

  constructor(
    canvas: HTMLCanvasElement,
    initialTokens: number,
    onTokenChange: (delta: number) => void,
    onClose: () => void
  ) {
    this.canvas = canvas;
    this.tokenBalance = initialTokens;
    this.onTokenChange = onTokenChange;
    this.onClose = onClose;
    this.clampBet();
  }

  /** Call this when the player's token balance changes externally */
  setTokenBalance(n: number): void {
    this.tokenBalance = n;
    this.clampBet();
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  /**
   * Route a key press to the game.
   * Call this from InputManager's onKeyPressed handler while the overlay is open.
   */
  handleKey(key: string): void {
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
        if (k === "enter") { this.state = "idle"; this.clampBet(); }
        if (k === "escape") this.onClose();
        break;

      default:
        break;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.state !== "dealerTurn") return;

    this.dealerDelay -= dt;
    if (this.dealerDelay > 0) return;

    // Reveal hidden card first
    const hidden = this.dealerHand.find((c) => c.hidden);
    if (hidden) {
      hidden.hidden = false;
      this.dealerDelay = this.DEALER_DELAY;
      return;
    }

    const value = handValue(this.dealerHand);
    if (value <= 16) {
      // Dealer hits
      this.dealerHand.push(drawCard(this.deck));
      this.dealerDelay = this.DEALER_DELAY;

      if (handValue(this.dealerHand) > 21) {
        this.resolveRound();
      }
    } else {
      // Dealer stands — resolve
      this.resolveRound();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const { width: cw, height: ch } = this.canvas;

    ctx.save();

    // ── Background overlay ──────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
    ctx.fillRect(0, 0, cw, ch);

    // Felt table surface (centred panel)
    const panelW = Math.min(700, cw - 40);
    const panelH = Math.min(480, ch - 40);
    const px = (cw - panelW) / 2;
    const py = (ch - panelH) / 2;

    ctx.fillStyle = "#14532d";
    roundRect(ctx, px, py, panelW, panelH, 20);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    roundRect(ctx, px, py, panelW, panelH, 20);
    ctx.stroke();

    const cx = cw / 2;

    // ── Title ───────────────────────────────────────────────────────────────────
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("♠ BLACKJACK ♠", cx, py + 16);

    // ── Balance & Bet ───────────────────────────────────────────────────────────
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Balance: ${this.tokenBalance} 🪙   Bet: ${this.bet} 🪙`, cx, py + 54);

    // ── Dealer hand ─────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px sans-serif";
    ctx.textBaseline = "top";
    const dealerLabel = this.state === "idle" || this.state === "result"
      ? `Dealer: ${handValue(this.dealerHand)}`
      : this.dealerHand.some((c) => c.hidden)
        ? "Dealer: ?"
        : `Dealer: ${handValue(this.dealerHand)}`;
    ctx.fillText(dealerLabel, cx, py + 90);
    this.renderHand(ctx, this.dealerHand, cx, py + 112);

    // ── Player hand ─────────────────────────────────────────────────────────────
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

    // ── Controls / result message ───────────────────────────────────────────────
    const controlY = py + panelH - 56;

    if (this.state === "idle") {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "13px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("↑↓ Adjust bet   Enter = Deal   Esc = Exit", cx, controlY);
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
      // dealerTurn
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "13px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("Dealer playing…", cx, controlY);
    }

    ctx.restore();
  }

  // ── Game actions ──────────────────────────────────────────────────────────────

  private deal(): void {
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

    // Deduct bet immediately
    this.onTokenChange(-this.bet);
    this.tokenBalance -= this.bet;

    // Check for immediate player blackjack
    if (handValue(this.playerHand) === 21) {
      this.beginDealerTurn();
      return;
    }

    this.state = "playerTurn";
  }

  private hit(): void {
    if (this.state !== "playerTurn") return;
    this.playerHand.push(drawCard(this.deck));
    if (handValue(this.playerHand) > 21) {
      this.resolveRound();
    }
  }

  private stand(): void {
    if (this.state !== "playerTurn") return;
    this.beginDealerTurn();
  }

  private doubleDown(): void {
    if (this.state !== "playerTurn" || this.playerHand.length !== 2) return;
    if (this.tokenBalance < this.bet) return; // can't afford to double

    // Deduct another bet
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

  private beginDealerTurn(): void {
    this.state = "dealerTurn";
    this.dealerDelay = this.DEALER_DELAY;
  }

  private resolveRound(): void {
    this.state = "result";
    const pv = handValue(this.playerHand);
    const dv = handValue(this.dealerHand);
    const playerBJ = pv === 21 && this.playerHand.length === 2;
    const dealerBJ = dv === 21 && this.dealerHand.length === 2;

    let delta = 0;
    let msg: string;
    let colour: string;

    if (pv > 21) {
      msg = "Bust! You lose.";
      colour = "#ef4444";
      delta = 0; // bet already deducted
    } else if (dealerBJ && !playerBJ) {
      msg = "Dealer Blackjack! You lose.";
      colour = "#ef4444";
    } else if (playerBJ && !dealerBJ) {
      // Blackjack pays 3:2
      delta = this.bet + Math.floor(this.bet * 1.5);
      msg = `Blackjack! +${delta} 🪙`;
      colour = "#facc15";
    } else if (dv > 21) {
      delta = this.bet * 2;
      msg = `Dealer busts! You win +${this.bet} 🪙`;
      colour = "#4ade80";
    } else if (pv > dv) {
      delta = this.bet * 2;
      msg = `You win! +${this.bet} 🪙`;
      colour = "#4ade80";
    } else if (pv === dv) {
      delta = this.bet; // push — return bet
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

    // Reset bet for next round (was doubled for double-down)
    this.bet = Math.min(this.bet, this.tokenBalance) || 1;
    this.resultMessage = msg;
    this.resultColour = colour;
  }

  private adjustBet(direction: 1 | -1): void {
    if (this.state !== "idle") return;
    this.bet = Math.max(1, Math.min(this.tokenBalance || 1, this.bet + direction));
  }

  private clampBet(): void {
    this.bet = Math.max(1, Math.min(Math.max(1, this.tokenBalance), this.bet));
  }

  // ── Card rendering ────────────────────────────────────────────────────────────

  private renderHand(
    ctx: CanvasRenderingContext2D,
    hand: Card[],
    centreX: number,
    topY: number
  ): void {
    const cardW = 52;
    const cardH = 72;
    const gap = 8;
    const totalW = hand.length * (cardW + gap) - gap;
    const startX = centreX - totalW / 2;

    for (let i = 0; i < hand.length; i++) {
      const card = hand[i]!;
      const cx = startX + i * (cardW + gap);
      renderCard(ctx, card, cx, topY, cardW, cardH);
    }
  }
}

// ── Card / deck utilities ─────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = deck[i]!;
    const b = deck[j]!;
    deck[i] = b;
    deck[j] = a;
  }
}

function drawCard(deck: Card[]): Card {
  const card = deck.pop();
  if (!card) throw new Error("Deck is empty");
  return { ...card };
}

function cardNumericValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.hidden) continue; // don't count face-down cards
    if (card.rank === "A") aces++;
    total += cardNumericValue(card.rank);
  }

  // Reduce aces from 11 → 1 to avoid bust
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function renderCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();

  // Card face
  if (card.hidden) {
    // Back of card
    ctx.fillStyle = "#1e40af";
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 5);
    ctx.stroke();
    // Cross-hatch pattern
    ctx.strokeStyle = "rgba(147,197,253,0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 6) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x, y + i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - i, y + h); ctx.lineTo(x + w, y + h - i); ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#fff";
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 5);
    ctx.stroke();

    const isRed = card.suit === "♥" || card.suit === "♦";
    ctx.fillStyle = isRed ? "#dc2626" : "#111";

    // Rank top-left
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(card.rank, x + 4, y + 2);

    // Suit top-left below rank
    ctx.font = "11px sans-serif";
    ctx.fillText(card.suit, x + 4, y + 16);

    // Large suit in centre
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.suit, x + w / 2, y + h / 2);
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
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
