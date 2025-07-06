export class Glass {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private backgroundImage: HTMLImageElement;
    private dimensions: { width: number; height: number; top: number; left: number };
    private parameters: { roundness: number; blurAmount: number };

    constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.backgroundImage = image;
        this.canvas = canvas;
        this.parameters = { roundness: 20, blurAmount: 10 };

        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        this.canvas.width = width;
        this.canvas.height = height;
        this.dimensions = { width: width, height: height, top: top, left: left };
        console.log(this.dimensions);
        this.generateUv();
    }

    private generateUv() {
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
        this.ctx.filter = `blur(${this.parameters.blurAmount}px)`;
        this.ctx.drawImage(
            this.backgroundImage,
            this.parameters.roundness,
            this.parameters.roundness,
            this.dimensions.width,
            this.dimensions.height,
        );
    }

    public updateImage(image: HTMLImageElement) {
        this.backgroundImage = image;
        this.generateUv();
    }

    public updateUv(roundness?: number, blurAmount?: number) {
        if (roundness) this.parameters.roundness = roundness;
        if (blurAmount) this.parameters.blurAmount = blurAmount;
        this.generateUv();
    }
}
