import { eventEmitter } from "./eventEmitter";

export class Webgl2GlassEffect {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;
    private marginLocation: WebGLUniformLocation | null = null;
    private blurRadius: WebGLUniformLocation | null = null;
    private maskLocation: WebGLUniformLocation | null = null;
    private background: WebGLUniformLocation | null = null;
    private canvasSizeLocation: WebGLUniformLocation | null = null;
    private backgroundSizeLocation: WebGLUniformLocation | null = null;
    private positionLocation: WebGLUniformLocation | null = null;
    private backgroundImage: WebGLTexture | null = null;
    private position: { x: number; y: number } | null = { x: 100, y: 100 };
    private vao: WebGLVertexArrayObject | null = null;

    constructor(img: ImageData, canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = this.canvas.getContext("webgl2") as WebGL2RenderingContext;

        if (!this.gl) {
            throw new Error("WebGL 2.0 not supported");
        }
        this.init();
        this.updateImage(img);

        eventEmitter.on("getImageDataAtPosition", this.updateBackground.bind(this));
    }

    public setPosition(x: number, y: number) {
        this.position = { x, y };
        this.render();
    }

    private updateBackground(imageData: ImageData) {
        const gl = this.gl;

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        this.backgroundImage = texture;
        console.log("this.backgroundImage", this.backgroundImage);

        this.render();
    }

    private init() {
        const gl = this.gl;

        // Vertex positions for a full-screen quad
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

        // Vertex shader - WebGL 2.0 / GLSL ES 3.00
        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        // Fragment shader - WebGL 2.0 / GLSL ES 3.00
        const fragmentShaderSource = `#version 300 es
          precision mediump float;

          in vec2 v_uv;
          out vec4 fragColor;

          uniform sampler2D u_mask;
          uniform sampler2D u_background;

          uniform float u_margin;
          uniform float u_blurRadius;
          uniform vec2 u_canvasSize;
          uniform vec2 u_backgroundSize;
          uniform vec2 u_position;

          #define MAX_KERNEL 31


          vec3 rgbToHsl(vec3 color) {
              float r = color.r;
              float g = color.g;
              float b = color.b;

              float maxC = max(r, max(g, b));
              float minC = min(r, min(g, b));
              float delta = maxC - minC;

              float h = 0.0;
              float s = 0.0;
              float l = (maxC + minC) / 2.0;

              if (delta != 0.0) {
                  s = delta / (1.0 - abs(2.0 * l - 1.0));

                  if (maxC == r) {
                      h = mod((g - b) / delta, 6.0);
                  } else if (maxC == g) {
                      h = (b - r) / delta + 2.0;
                  } else {
                      h = (r - g) / delta + 4.0;
                  }

                  h /= 6.0;
                  if (h < 0.0) h += 1.0;
              }

              return vec3(h, s, l);
          }

          float hueToRgb(float p, float q, float t) {
              if (t < 0.0) t += 1.0;
              if (t > 1.0) t -= 1.0;
              if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
              if (t < 1.0/2.0) return q;
              if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
              return p;
          }

          vec3 hslToRgb(vec3 hsl) {
              float h = hsl.x;
              float s = hsl.y;
              float l = hsl.z;

              float r, g, b;

              if (s == 0.0) {
                  r = g = b = l; // achromatic
              } else {
                  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
                  float p = 2.0 * l - q;
                  r = hueToRgb(p, q, h + 1.0/3.0);
                  g = hueToRgb(p, q, h);
                  b = hueToRgb(p, q, h - 1.0/3.0);
              }

              return vec3(r, g, b);
          }

          vec4 addLuminance(vec4 color, float luminanceDelta) {
              vec3 hsl = rgbToHsl(color.rgb);
              hsl.z = clamp(hsl.z + luminanceDelta, 0.0, 1.0);
              vec3 newRgb = hslToRgb(hsl);
              return vec4(newRgb, color.a);
          }

          float boxBlur(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              float sum = 0.0;
              int count = 0;
              int kernelSize = int(radius * 3.0);

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      sum += texture(image, uv + offset).r;
                      count++;
                  }
              }

              return sum / float(count);
          }

          vec4 boxBlurColor(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              vec4 sum = vec4(0.0);
              int count = 0;
              int kernelSize = int(radius * 3.0);

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      sum += texture(image, uv + offset);
                      count++;
                  }
              }

              return sum / float(count);
          }

          float getGaussianWeight(int x, int y, float sigma) {
              float distance = sqrt(float(x * x + y * y));
              return exp(-(distance * distance) / (2.0 * sigma * sigma));
          }

          float gaussian(float x, float sigma) {
              return exp(-(x * x) / (2.0 * sigma * sigma));
          }

          float gaussianBlur(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              float sum = 0.0;
              float weightSum = 0.0;
              float sigma = radius * 11.0;
              int kernelSize = int(radius * 11.0);

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = gaussian(length(vec2(float(x), float(y))), sigma);
                      sum += texture(image, uv + offset).r * weight;
                      weightSum += weight;
                  }
              }

              return sum / weightSum;
          }

          vec4 gaussianBlurColor(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              vec4 sum = vec4(0.0);
              float weightSum = 0.0;
              float sigma = radius * 11.0;
              int kernelSize = int(radius * 11.0);

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = gaussian(length(vec2(float(x), float(y))), sigma);
                      sum += texture(image, uv + offset) * weight;
                      weightSum += weight;
                  }
              }

              return sum / weightSum;
          }


          void main() {
              float margin = u_margin;
              float blurAmount = u_blurRadius;

              vec2 flipped_uv = vec2(v_uv.x, 1.0 - v_uv.y);

              float blurredDepth = gaussianBlur(u_mask, flipped_uv, blurAmount);
              // clip ouside the initial shape
              if (blurredDepth < 0.5) {
                    blurredDepth= 0.0;
              }

              float border = clamp((blurredDepth - 0.5) * 15.0, 0.0, 1.0);

              // Calculate background texture UV based on actual sizes
              vec2 pixelCoords = v_uv *  u_canvasSize / u_backgroundSize;
              vec2 backgroundUV = pixelCoords + vec2(u_position.x / u_backgroundSize.x, 1.0 - (u_position.y / u_backgroundSize.y) - (u_canvasSize.y / u_backgroundSize.y));

              vec4 backgroundColor = vec4(0.0);
              vec2 backgroundUVDistorted = backgroundUV;
              vec3 bumpColor = vec3(0.0);

              if (border > 0.0 && blurredDepth < 1.0) {
                  // get depth abound current pixel to determine its Normal vector
                  vec2 texelSize = 1.0 / u_canvasSize;
                  float depthC = blurredDepth;
                  float depthL = gaussianBlur(u_mask, flipped_uv + vec2(-texelSize.x, 0.0), blurAmount);
                  float depthR = gaussianBlur(u_mask, flipped_uv + vec2(texelSize.x, 0.0), blurAmount);
                  float depthU = gaussianBlur(u_mask, flipped_uv + vec2(0.0, texelSize.y), blurAmount);
                  float depthD = gaussianBlur(u_mask, flipped_uv + vec2(0.0, -texelSize.y), blurAmount);

                  float dx = depthR - depthL;
                  float dy = depthU - depthD;

                  float strength = 1.0; // Bump strength
                  vec3 normal = normalize(vec3(-dx * strength, -dy * strength, 1.0));
                  bumpColor = normal * 10.0;

                  // calculate the distortion based on the normal vector
                  backgroundUVDistorted += (vec2(pow(bumpColor.r , 1.0) / 10.0, pow(bumpColor.g, 1.0) / 10.0) * vec2(-1.0, 1.0) * vec2(1.0 - blurredDepth) * 2.0) * border;
              }

              // uv to color smoothing the borders using border variable
              if (border > 0.0) {
                vec4 backgroundColor1 = gaussianBlurColor(u_background, backgroundUVDistorted, 0.5);
                vec4 backgroundColor2 = texture(u_background, backgroundUV);

                backgroundColor = mix(backgroundColor2, backgroundColor1, border);
              } else {
                backgroundColor = texture(u_background, backgroundUV);
              }

              vec4 finalColor = backgroundColor;


              // compositing : lighten and add borders light
              if (border > 0.0) {
                  // add inverse color of luminance to final color
                  float luminanceValue =  0.1 - (finalColor.r + finalColor.g + finalColor.b) * 0.05;
                  finalColor = addLuminance(finalColor, 0.025);
                  finalColor = mix(finalColor, vec4(1.0), clamp((luminanceValue + 0.1) * border, 0.0, 1.0));

                  // add ring color around
                  float ring = border - border * border;
                  // get bumpColor for light ring effect
                  ring = bumpColor.r * bumpColor.g * 5.0 * ring;
                  finalColor = mix(finalColor, vec4(1.0), ring);

                  // finalColor = vec4(vec3(bumpColor.r * bumpColor.g * 5.0 * ring), 1.0);
              }


              fragColor = finalColor;
          }
        `;

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        gl.useProgram(this.program);

        // Create and bind VAO (Vertex Array Object) - WebGL 2.0 feature
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // Set up geometry
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Get uniform locations
        this.marginLocation = gl.getUniformLocation(this.program, "u_margin");
        this.background = gl.getUniformLocation(this.program, "u_background");
        this.maskLocation = gl.getUniformLocation(this.program, "u_mask");
        this.blurRadius = gl.getUniformLocation(this.program, "u_blurRadius");
        this.canvasSizeLocation = gl.getUniformLocation(this.program, "u_canvasSize");
        this.backgroundSizeLocation = gl.getUniformLocation(this.program, "u_backgroundSize");
        this.positionLocation = gl.getUniformLocation(this.program, "u_position");

        // Default margin
        gl.uniform1f(this.marginLocation, 1.0);
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

    public render() {
        if (!this.texture) return;

        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        // Bind VAO
        gl.bindVertexArray(this.vao);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.maskLocation, 0);

        // Bind texture background
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundImage);
        gl.uniform1i(this.background, 1); // u_background = TEXTURE1

        this.gl.uniform2f(this.canvasSizeLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.backgroundSizeLocation, window.innerWidth, window.innerHeight);
        if (this.position) {
            this.gl.uniform2f(this.positionLocation, this.position.x, this.position.y);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Ensure rendering is complete before reading pixels
        gl.finish();
    }

    public setMargin(value: number) {
        if (this.marginLocation) {
            this.gl.useProgram(this.program);
            this.gl.uniform1f(this.marginLocation, value);
        }
    }

    public setBlurAmount(value: number) {
        if (this.blurRadius) {
            this.gl.useProgram(this.program);
            this.gl.uniform1f(this.blurRadius, value);
        }
    }

    public async updateImage(image: ImageData) {
        const gl = this.gl;

        this.canvas.width = image.width;
        this.canvas.height = image.height;
        this.canvas.style.width = image.width.toString();
        this.canvas.style.height = image.height.toString();

        const imageBitmap = await createImageBitmap(image); // Convert ImageData to ImageBitmap

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageBitmap);

        this.texture = texture;

        this.render();
    }

    public getImageDataVia2D(): ImageData | null {
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = this.canvas.width;
        offscreenCanvas.height = this.canvas.height;
        const ctx = offscreenCanvas.getContext("2d");

        if (!ctx) return null;

        // Draw the WebGL canvas onto the 2D canvas
        ctx.drawImage(this.canvas, 0, 0);

        // Get ImageData from the 2D canvas
        return ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    public dispose() {
        const gl = this.gl;

        // Clean up WebGL resources
        if (this.texture) {
            gl.deleteTexture(this.texture);
            this.texture = null;
        }

        if (this.backgroundImage) {
            gl.deleteTexture(this.backgroundImage);
            this.backgroundImage = null;
        }

        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }

        if (this.vao) {
            gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
