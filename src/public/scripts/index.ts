import Camera from "./Camera.js";
import GameWorld from "./GameWorld.js";

const canvas = document.getElementById("game-window") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const backgroundImage = document.createElement("img");
backgroundImage.onload = (e) => ctx.drawImage(backgroundImage, 0, 0)
backgroundImage.width = 400
backgroundImage.height = 400
backgroundImage.src = "./images/LesesalBirdView.png"

const gameWorld = new GameWorld(backgroundImage)
const camera = new Camera(gameWorld, 200, 200, 50, 50, 1)

//camera.drawToCanvas(ctx)
//navigator.geolocation.getCurrentPosition()
/*
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
*/