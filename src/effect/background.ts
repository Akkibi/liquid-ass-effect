import { eventEmitter } from "./eventEmitter";

export class Background {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private width: number;
    private height: number;
    private image: HTMLImageElement;
    constructor() {
        this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.image = new Image();
        this.image.src = "./macos.png";
        this.image.onload = () => this.draw();
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        window.addEventListener("resize", this.draw.bind(this));
        eventEmitter.on("setImage", this.setImage.bind(this));
    }

    public setImage(src: string) {
        this.image = new Image();
        this.image.src = src;
        console.log(this.image.src);
        this.image.onload = () => this.draw();
    }

    private sendData() {
        eventEmitter.trigger("getImageDataAtPosition", [
            this.ctx.getImageData(0, 0, this.width, this.height),
        ]);
    }

    public draw() {
        if (!this.ctx || !this.canvas || !this.image) return;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        const scaleX = this.canvas.width / this.image.width;
        const scaleY = this.canvas.height / this.image.height;
        const scale = Math.max(scaleX, scaleY);

        // Calculate dimensions and position to center the this.image
        const scaledWidth = this.image.width * scale;
        const scaledHeight = this.image.height * scale;
        const x = (this.canvas.width - scaledWidth) / 2;
        const y = (this.canvas.height - scaledHeight) / 2;
        console.log("resize");
        this.ctx.drawImage(this.image, x, y, scaledWidth, scaledHeight);
        this.sendData();
    }
}
