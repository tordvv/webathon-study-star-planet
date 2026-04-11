export function loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
        const image = document.createElement("img");
        image.onload = (e) => resolve(image)
    })
} 