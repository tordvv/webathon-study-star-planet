const canvas = document.getElementById("game-window") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
    type: number; // 1 for add, -1 for subtract
}

// Figure position
let x = canvas.width / 2;
let y = canvas.height / 2;
const speed = 5;

// Score
let score = 0;

// Boxes
const boxes: Box[] = [];
const numBoxes = 5;

function createBox(): Box {
    return {
        x: Math.random() * (canvas.width - 50),
        y: Math.random() * (canvas.height - 50),
        width: 50,
        height: 50,
        type: Math.random() > 0.5 ? 1 : -1
    };
}

function initBoxes(): void {
    for (let i = 0; i < numBoxes; i++) {
        boxes.push(createBox());
    }
}

// Key states
const keys: { [key: string]: boolean } = {};

function draw(): void {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw boxes
    boxes.forEach(box => {
        ctx.fillStyle = box.type === 1 ? "green" : "red";
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText(box.type > 0 ? "+" : "-", box.x + 20, box.y + 30);
    });

    // Draw figure (a circle)
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();

    // Draw score
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.fillText(`Score: ${score}`, 10, 30);
}

function collides(box: Box): boolean {
    return x + 20 > box.x && x - 20 < box.x + box.width &&
           y + 20 > box.y && y - 20 < box.y + box.height;
}

function update(): void {
    // Update position based on keys
    if (keys["ArrowUp"]) y -= speed;
    if (keys["ArrowDown"]) y += speed;
    if (keys["ArrowLeft"]) x -= speed;
    if (keys["ArrowRight"]) x += speed;

    // Keep figure within canvas bounds
    if (x < 20) x = 20;
    if (x > canvas.width - 20) x = canvas.width - 20;
    if (y < 20) y = 20;
    if (y > canvas.height - 20) y = canvas.height - 20;

    // Check space key for interaction
    if (keys[" "]) {
        boxes.forEach((box, index) => {
            if (collides(box)) {
                score += box.type;
                boxes.splice(index, 1);
                boxes.push(createBox());
                saveScore();
            }
        });
    }
}

async function loadScore(): Promise<void> {
    try {
        const response = await fetch("/score");
        const data = await response.json();
        score = data.score;
    } catch (error) {
        console.error("Failed to load score:", error);
    }
}

async function saveScore(): Promise<void> {
    try {
        await fetch("/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score })
        });
    } catch (error) {
        console.error("Failed to save score:", error);
    }
}

function gameLoop(): void {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener("keydown", (e: KeyboardEvent) => {
    keys[e.key] = true;
});

document.addEventListener("keyup", (e: KeyboardEvent) => {
    keys[e.key] = false;
});

// Initialize
initBoxes();
loadScore().then(() => {
    gameLoop();
});
