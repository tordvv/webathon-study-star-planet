const canvas = document.getElementById("game-window") as HTMLCanvasElement
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D

ctx.fillStyle = "blue"
ctx.fillRect(10, 10, 150, 100)

console.log("Great success")