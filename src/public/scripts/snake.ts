const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

// Grid config
const tileSize = 20;
const tilesX = canvas.width / tileSize;
const tilesY = canvas.height / tileSize;

type Vec = { x: number; y: number };

let snake: [Vec, ...Vec[]] = [{ x: 5, y: 5 }];
let dir: Vec = { x: 1, y: 0 };
let food: Vec = randomFood();
let gameOver = false;
let tickMs = 120;
let lastTime = 0;

window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
    case "w":
      if (dir.y === 1) break;
      dir = { x: 0, y: -1 };
      break;
    case "ArrowDown":
    case "s":
      if (dir.y === -1) break;
      dir = { x: 0, y: 1 };
      break;
    case "ArrowLeft":
    case "a":
      if (dir.x === 1) break;
      dir = { x: -1, y: 0 };
      break;
    case "ArrowRight":
    case "d":
      if (dir.x === -1) break;
      dir = { x: 1, y: 0 };
      break;
    case " ":
      if (gameOver) reset();
      break;
  }
});

function randomFood(): Vec {
  while (true) {
    const f = {
      x: Math.floor(Math.random() * tilesX),
      y: Math.floor(Math.random() * tilesY),
    };
    if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
  }
}

function reset() {
  snake = [{ x: 5, y: 5 }];
  dir = { x: 1, y: 0 };
  food = randomFood();
  gameOver = false;
}

function update() {
  if (gameOver) return;

  const head = snake[0];
  const next: Vec = { x: head.x + dir.x, y: head.y + dir.y };

  // Wall collision
  if (
    next.x < 0 ||
    next.y < 0 ||
    next.x >= tilesX ||
    next.y >= tilesY ||
    snake.some((s) => s.x === next.x && s.y === next.y)
  ) {
    gameOver = true;
    return;
  }

  snake.unshift(next);

  // Eat food
  if (next.x === food.x && next.y === food.y) {
    food = randomFood();
  } else {
    snake.pop();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background grid
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Food
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);

  // Snake
  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? "#2ecc71" : "#27ae60";
    ctx.fillRect(seg.x * tileSize, seg.y * tileSize, tileSize, tileSize);
  });

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over - Space to restart", canvas.width / 2, canvas.height / 2);
  }
}

function loop(timestamp: number) {
  if (timestamp - lastTime > tickMs) {
    update();
    draw();
    lastTime = timestamp;
  }
  requestAnimationFrame(loop);
}

draw();
requestAnimationFrame(loop);
