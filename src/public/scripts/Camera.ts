import GameWorld from "./GameWorld.js";

export default class Camera {
    private gameWorld: GameWorld;
    private x: number;
    private y: number;
    private viewWidth: number;
    private viewHeight: number;
    private zoomFactor: number;

    constructor(
        gameWorld: GameWorld,
        x: number,
        y: number,
        viewWidth: number,
        viewHeight: number,
        zoomFactor: number,
    ) {
        this.gameWorld = gameWorld;
        this.x = x;
        this.y = y;
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.zoomFactor = zoomFactor;
    }

    public drawToCanvas(ctx: CanvasRenderingContext2D): void {
        const backgroundImage = this.gameWorld.getBackgroundImage();
        ctx.drawImage(
            backgroundImage,
            0-(this.x + this.viewWidth / 2),
            0-(this.y + this.viewHeight / 2),
            this.zoomFactor * backgroundImage.width,
            this.zoomFactor * backgroundImage.height,
        )
    }
}