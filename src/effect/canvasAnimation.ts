import { eventEmitter } from "./eventEmitter";

class CanvasAnimation {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tick: number = 0;
    private pause: boolean = false;
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.canvas.width = 500;
        this.canvas.height = 200;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2d context");
        this.ctx = ctx;

        window.addEventListener("keydown", (e) => this.handleKeydown.bind(this)(e));
    }

    private handleKeydown(e: KeyboardEvent) {
        if (e.key === " ") {
            this.pause = !this.pause;
        }
    }

    public animate() {
        if (!this.pause) {
            this.ctx.fillStyle = "#000000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.draw();
            this.tick++;
            // get image data from canvas
        }
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        eventEmitter.trigger("update", [imageData]);
        requestAnimationFrame(() => this.animate());
    }

    private draw() {
        this.ctx.fillStyle = "#ffffff";
        // draw circle
        this.ctx.beginPath();
        this.ctx.arc(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.canvas.height / 3,
            0,
            2 * Math.PI,
        );
        this.ctx.fill();
        // circle 2
        this.ctx.beginPath();
        this.ctx.arc(
            this.canvas.width / 2 + Math.sin(this.tick / 50) * 150,
            this.canvas.height / 2,
            this.canvas.height / 3,
            0,
            2 * Math.PI,
        );
        this.ctx.fill();
    }
}

export default CanvasAnimation;
