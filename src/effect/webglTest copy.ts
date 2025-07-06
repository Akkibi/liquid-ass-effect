export class WebglTest {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;

    constructor() {
        this.canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
        this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;

        if (!this.gl) {
            throw new Error("WebGL not supported");
        }

        this.init();
    }

    private init() {
        const gl = this.gl;

        // Vertex data for a fullscreen triangle strip
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

        // Shaders
        const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_uv;
            void main() {
                gl_FragColor = vec4(v_uv.x, v_uv.y, 0.0, 1.0);
            }
        `;

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = this.createProgram(vertexShader, fragmentShader);
        gl.useProgram(this.program);

        // Buffer for positions
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private createShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            throw new Error("Shader compile error");
        }

        return shader;
    }

    private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
        const program = this.gl.createProgram()!;
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            throw new Error("Program link error");
        }

        return program;
    }
}
