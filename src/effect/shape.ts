import { eventEmitter } from "./eventEmitter";

const getColorAt = (
    position: { x: number; y: number },
    imageData: ImageData,
): { r: number; g: number; b: number } => {
    return {
        r: imageData.data[position.x * 4 + position.y * imageData.width * 4],
        g: imageData.data[position.x * 4 + position.y * imageData.width * 4 + 1],
        b: imageData.data[position.x * 4 + position.y * imageData.width * 4 + 2],
    };
};

const lerp = (a: number, b: number, factor: number) => {
    return a + (b - a) * factor;
};

const glassVariables = {
    glassRoundness: 10,
    brightness: 20,
    effectForce: 1,
    blurAmount: 10,
    margin: 40,
};

export class Shape {
    private container: HTMLDivElement;
    private ctx: CanvasRenderingContext2D | null;
    private canvas: HTMLCanvasElement;
    private dimentions: { width: number; height: number };
    private effectPosition: { x: number; y: number };
    private backgroundImageData: ImageData | null = null;
    private uvImageData: ImageData | null = null;
    private id;

    constructor(id: string, canvas: HTMLCanvasElement, container: HTMLDivElement) {
        this.id = id;
        this.container = container;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.dimentions = { width: 0, height: 0 };

        this.effectPosition = { x: 100, y: 100 };
        // this.drawUv();

        eventEmitter.on("resize", this.callResize.bind(this));
        eventEmitter.on("getImageDataAtPosition", this.updateImageData.bind(this));
        eventEmitter.on("keyPress", this.keyPress.bind(this));
        eventEmitter.on("mouseMove", this.mouseMove.bind(this));
        // eventEmitter.on("newUv", this.newUv.bind(this));
        //
        this.effectPosition.x = 100;
        this.container.style.left = `${100}px`;
        this.effectPosition.y = 400;
        this.container.style.top = `${400}px`;
    }

    // private newUv(imageData: ImageData) {
    //     console.log("imageData", imageData);
    //     this.uvImageData = imageData;
    //     this.uvCtx.putImageData(this.uvImageData, 0, 0);
    // }

    private keyPress(key: string) {
        console.log(key);
        if (key === "ArrowLeft") {
            this.effectPosition.x -= 10;
            this.container.style.left = `${this.effectPosition.x}px`;
        }
        if (key === "ArrowRight") {
            this.effectPosition.x += 10;
            this.container.style.left = `${this.effectPosition.x}px`;
        }
        if (key === "ArrowUp") {
            this.effectPosition.y -= 10;
            this.container.style.top = `${this.effectPosition.y}px`;
        }
        if (key === "ArrowDown") {
            this.effectPosition.y += 10;
            this.container.style.top = `${this.effectPosition.y}px`;
        }
        this.drawEffect();
    }
    private mouseMove(x: number, y: number) {
        // this.drawUv();
        this.effectPosition.x = Math.round(x) - this.canvas.getBoundingClientRect().width / 2;
        this.effectPosition.y = Math.round(y) - this.canvas.getBoundingClientRect().height / 2;
        this.container.style.left = `${this.effectPosition.x}px`;
        this.container.style.top = `${this.effectPosition.y}px`;
        // this.drawEffect();
    }

    private updateImageData(id: string, imageData: ImageData) {
        if (id !== this.id) return;
        const isImage = this.backgroundImageData !== null;
        this.backgroundImageData = imageData;
        this.dimentions.width = imageData.width;
        this.dimentions.height = imageData.height;
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        if (isImage) {
            this.drawEffect();
        }
    }

    public updateUv(imageData: ImageData) {
        console.log("imagedata", imageData, imageData.data[0]);
        // if (!this.ctx) return;
        // console.log(imageData);
        // this.uvImageData = imageData;
        // this.canvas.width = imageData.width;
        // this.canvas.height = imageData.height;
        // this.dimentions.width = imageData.width;
        // this.dimentions.height = imageData.height;
        // this.ctx.putImageData(this.uvImageData, 0, 0);
        // // this.drawEffect();
    }

    private callResize() {
        eventEmitter.trigger("sendData", []);
    }

    // private drawUv() {
    //     const webglCanvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
    //     const gl = webglCanvas.getContext("webgl") as WebGLRenderingContext;
    //     const width = webglCanvas.width;
    //     const height = webglCanvas.height;

    //     const pixels = new Uint8Array(width * height * 4); // RGBA for each pixel
    //     gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    //     console.log(pixels);

    //     // Flip Y axis since WebGL's origin is bottom-left
    //     const flippedPixels = new Uint8ClampedArray(width * height * 4);
    //     for (let row = 0; row < height; row++) {
    //         const sourceStart = row * width * 4;
    //         const destStart = (height - row - 1) * width * 4;
    //         flippedPixels.set(pixels.subarray(sourceStart, sourceStart + width * 4), destStart);
    //     }

    //     const imageData = new ImageData(flippedPixels, width, height);

    //     if (imageData.data[0] > 0) {
    //         this.uvImageData = imageData;
    //         this.uvCtx.putImageData(this.uvImageData, 0, 0);
    //     }
    //     // console.log(this.uvImageData);
    // }

    private drawEffect() {
        if (!this.backgroundImageData || !this.uvImageData || !this.ctx) {
            console.log("no image data", this.backgroundImageData, this.uvImageData);
            return;
        }
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.fillStyle = "rgba(0, 0, 0, 1)";
        this.ctx.fillRect(0, 0, this.dimentions.width, this.dimentions.height);

        if (!this.uvImageData) return;
        for (let x = 0; x < this.dimentions.width; x++) {
            for (let y = 0; y < this.dimentions.height; y++) {
                const uvColor = getColorAt({ x: x, y: y }, this.uvImageData);

                const ajustedUvColor = {
                    r: (((uvColor.r - 128) / 10) * glassVariables.effectForce) ** 2,
                    g: (((uvColor.g - 128) / 10) * glassVariables.effectForce) ** 2,
                };

                const roundUvColor = {
                    r: Math.floor(ajustedUvColor.r),
                    g: Math.floor(ajustedUvColor.g),
                };

                const luminosity = glassVariables.brightness;

                const color = getColorAt(
                    {
                        x: x + this.effectPosition.x + roundUvColor.r,
                        y: y + this.effectPosition.y + roundUvColor.g,
                    },
                    this.backgroundImageData,
                );

                this.ctx.fillStyle = `rgb(${color.r + luminosity}, ${color.g + luminosity}, ${color.b + luminosity})`;

                this.ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}
