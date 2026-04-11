export default class Entity {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public sprite: HTMLImageElement;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        sprite: HTMLImageElement
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.sprite = sprite;
    }
}