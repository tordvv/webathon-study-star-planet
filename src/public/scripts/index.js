"use strict";
(() => {
  // src/public/scripts/index.ts
  var canvas = document.getElementById("game-window");
  var ctx = canvas.getContext("2d");
  var x = canvas.width / 2;
  var y = canvas.height / 2;
  var speed = 5;
  var score = 0;
  var boxes = [];
  var numBoxes = 5;
  function createBox() {
    return {
      x: Math.random() * (canvas.width - 50),
      y: Math.random() * (canvas.height - 50),
      width: 50,
      height: 50,
      type: Math.random() > 0.5 ? 1 : -1
    };
  }
  function initBoxes() {
    for (let i = 0; i < numBoxes; i++) {
      boxes.push(createBox());
    }
  }
  var keys = {};
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    boxes.forEach((box) => {
      ctx.fillStyle = box.type === 1 ? "green" : "red";
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.fillText(box.type > 0 ? "+" : "-", box.x + 20, box.y + 30);
    });
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.font = "24px Arial";
    ctx.fillText(`Score: ${score}`, 10, 30);
  }
  function collides(box) {
    return x + 20 > box.x && x - 20 < box.x + box.width && y + 20 > box.y && y - 20 < box.y + box.height;
  }
  function update() {
    if (keys["ArrowUp"]) y -= speed;
    if (keys["ArrowDown"]) y += speed;
    if (keys["ArrowLeft"]) x -= speed;
    if (keys["ArrowRight"]) x += speed;
    if (x < 20) x = 20;
    if (x > canvas.width - 20) x = canvas.width - 20;
    if (y < 20) y = 20;
    if (y > canvas.height - 20) y = canvas.height - 20;
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
  async function loadScore() {
    try {
      const response = await fetch("/score");
      const data = await response.json();
      score = data.score;
    } catch (error) {
      console.error("Failed to load score:", error);
    }
  }
  async function saveScore() {
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
  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }
  document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
  });
  document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });
  initBoxes();
  loadScore().then(() => {
    gameLoop();
  });
})();
