import Entity from "./Entity.js"

export default class GameWorld {
    private entities: Array<Entity>;
    private backgroundImage: HTMLImageElement;

    constructor(backgroundImage: HTMLImageElement) {
        this.entities = [];
        this.backgroundImage = backgroundImage;
    }

    public getEntities(): Iterable<Entity> {
        return this.entities;
    }

    public getBackgroundImage(): HTMLImageElement {
        return this.backgroundImage
    }
}