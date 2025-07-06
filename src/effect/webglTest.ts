// import { eventEmitter } from "./eventEmitter";

import { eventEmitter } from "./eventEmitter";

export class WebglTest {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;
    private marginLocation: WebGLUniformLocation | null = null;
    private marginWidth: WebGLUniformLocation | null = null;
    private maskLocation: WebGLUniformLocation | null = null;
    private background: WebGLUniformLocation | null = null;
    private canvasSizeLocation: WebGLUniformLocation | null = null;
    private backgroundSizeLocation: WebGLUniformLocation | null = null;
    private positionLocation: WebGLUniformLocation | null = null;
    private backgroundImage: WebGLTexture | null = null;
    private position: { x: number; y: number } | null = { x: 100, y: 100 };

    constructor(img: ImageData, canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        // this.canvas = document.getElementById("glass-effect-canvas") as HTMLCanvasElement;
        this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;

        if (!this.gl) {
            throw new Error("WebGL not supported");
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

        // Vertex shader
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

          uniform sampler2D u_mask;
          uniform sampler2D u_background;

          uniform float u_margin;
          uniform float u_marginWidth;
          uniform vec2 u_canvasSize;
          uniform vec2 u_backgroundSize;
          uniform vec2 u_position;

          const int kernelSize = 5;

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

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      sum += texture2D(image, uv + offset).r;
                      count++;
                  }
              }

              return sum / float(count);
          }

          vec4 boxBlurColor(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              vec4 sum = vec4(0.0);
              int count = 0;

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      sum += texture2D(image, uv + offset);
                      count++;
                  }
              }

              return sum / float(count);
          }

          // Replace your boxBlur and boxBlurColor functions with these Gaussian versions:

          // Gaussian weights for 5x5 kernel (kernelSize = 5)
          // You can adjust sigma to control blur strength (lower = sharper, higher = more blur)
          float getGaussianWeight(int x, int y, float sigma) {
              float distance = sqrt(float(x * x + y * y));
              return exp(-(distance * distance) / (2.0 * sigma * sigma));
          }

          float gaussianBlur(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              float sum = 0.0;
              float weightSum = 0.0;
              float sigma = 2.0; // Adjust this for blur strength

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = getGaussianWeight(x, y, sigma);
                      sum += texture2D(image, uv + offset).r * weight;
                      weightSum += weight;
                  }
              }

              return sum / weightSum;
          }

          vec4 gaussianBlurColor(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              vec4 sum = vec4(0.0);
              float weightSum = 0.0;
              float sigma = 2.0; // Adjust this for blur strength

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = getGaussianWeight(x, y, sigma);
                      sum += texture2D(image, uv + offset) * weight;
                      weightSum += weight;
                  }
              }

              return sum / weightSum;
          }

          // Alternative: Pre-calculated Gaussian weights for better performance
          // WebGL 1.0 compatible version using conditionals instead of arrays
          float getPreCalculatedWeight(int x, int y) {
              // Pre-calculated 5x5 Gaussian kernel weights (sigma ≈ 1.4)
              // Convert int to float for abs() function and comparisons
              float fx = float(x);
              float fy = float(y);

              // Center point (0,0)
              if (x == 0 && y == 0) return 0.159576912161;

              // Distance 1 from center
              if ((abs(fx) == 1.0 && y == 0) || (x == 0 && abs(fy) == 1.0)) return 0.097766061048;

              // Distance sqrt(2) (diagonal neighbors)
              if (abs(fx) == 1.0 && abs(fy) == 1.0) return 0.059924578060;

              // Distance 2 from center
              if ((abs(fx) == 2.0 && y == 0) || (x == 0 && abs(fy) == 2.0)) return 0.035955372593;

              // Distance sqrt(5)
              if ((abs(fx) == 2.0 && abs(fy) == 1.0) || (abs(fx) == 1.0 && abs(fy) == 2.0)) return 0.022024145328;

              // Distance sqrt(8) (far diagonal)
              if (abs(fx) == 2.0 && abs(fy) == 2.0) return 0.013490721344;

              // Distance 3 from center
              if ((abs(fx) == 3.0 && y == 0) || (x == 0 && abs(fy) == 3.0)) return 0.013255976673;

              // Distance sqrt(10)
              if ((abs(fx) == 3.0 && abs(fy) == 1.0) || (abs(fx) == 1.0 && abs(fy) == 3.0)) return 0.008124034943;

              // Distance sqrt(13)
              if ((abs(fx) == 3.0 && abs(fy) == 2.0) || (abs(fx) == 2.0 && abs(fy) == 3.0)) return 0.004976767409;

              // Distance sqrt(18) (far diagonal)
              if (abs(fx) == 3.0 && abs(fy) == 3.0) return 0.003049581678;

              // Distance 4 from center
              if ((abs(fx) == 4.0 && y == 0) || (x == 0 && abs(fy) == 4.0)) return 0.003049581678;

              // Distance sqrt(17)
              if ((abs(fx) == 4.0 && abs(fy) == 1.0) || (abs(fx) == 1.0 && abs(fy) == 4.0)) return 0.001867048890;

              // Distance sqrt(20)
              if ((abs(fx) == 4.0 && abs(fy) == 2.0) || (abs(fx) == 2.0 && abs(fy) == 4.0)) return 0.001143431706;

              // Distance 5 (corners and edges)
              if ((abs(fx) == 5.0 && y == 0) || (x == 0 && abs(fy) == 5.0)) return 0.000700638161;

              // Default for any other case (should not happen with kernelSize = 5)
              return 0.0;
          }

          float gaussianBlurOptimized(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              float sum = 0.0;

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = getPreCalculatedWeight(x, y);
                      sum += texture2D(image, uv + offset).r * weight;
                  }
              }

              return sum;
          }

          vec4 gaussianBlurColorOptimized(sampler2D image, vec2 uv, float radius) {
              vec2 texel = 1.0 / u_canvasSize;
              vec4 sum = vec4(0.0);

              for (int x = -kernelSize; x <= kernelSize; x++) {
                  for (int y = -kernelSize; y <= kernelSize; y++) {
                      vec2 offset = vec2(float(x), float(y)) * texel * radius;
                      float weight = getPreCalculatedWeight(x, y);
                      sum += texture2D(image, uv + offset) * weight;
                  }
              }

              return sum;
          }

          void main() {
              float margin = u_margin;
              float radius = u_marginWidth;

              vec2 flipped_uv = vec2(v_uv.x, 1.0 - v_uv.y);
              float s = gaussianBlur(u_mask, flipped_uv, radius);
              // clip ouside the initial shape
              if (s < 0.50) {
                if (s < 0.45) {
                    s = 0.0;
                } else {
                    s = 0.25;
                }
              }
              vec2 texelSize = 1.0 / u_canvasSize;
              float s_left  = gaussianBlur(u_mask, flipped_uv - vec2(texelSize.x, 0.0), radius);
              float s_right = gaussianBlur(u_mask, flipped_uv + vec2(texelSize.x, 0.0), radius);
              float s_up    = gaussianBlur(u_mask, flipped_uv - vec2(0.0, texelSize.y), radius);
              float s_down  = gaussianBlur(u_mask, flipped_uv + vec2(0.0, texelSize.y), radius);

              vec2 grad = vec2(s_right - s_left, s_down - s_up);
              float dist = (1.0 - s) * margin;

              vec2 normGrad = normalize(grad + 1e-6) * dist;

              vec4 edgeColor = vec4(0.5 + 0.5 * normGrad.x, 0.5 + 0.5 * normGrad.y, s, 1.0);
              vec4 fillColor = vec4(0.5, 0.5, 0.0, 1.0);
              vec4 distortionColor = dist > margin ? fillColor : edgeColor;

              // Calculate background texture UV based on actual sizes
              vec2 pixelCoords = v_uv *  u_canvasSize / u_backgroundSize;
              vec2 backgroundUV = pixelCoords + vec2(u_position.x / u_backgroundSize.x, 1.0 - (u_position.y / u_backgroundSize.y) - (u_canvasSize.y / u_backgroundSize.y));

              vec2 backgroundUVDistorted = backgroundUV + vec2(pow(distortionColor.r , 2.0) / 10.0, pow(distortionColor.g, 2.0) / 10.0) - vec2(0.025, 0.025);

              if (edgeColor.b <= 0.0) {
                  backgroundUVDistorted = backgroundUV;
              }
              // Sample background with corrected UV
              vec4 backgroundColor = texture2D(u_background, backgroundUVDistorted);

              vec4 finalColor = backgroundColor;
              if (edgeColor.b > 0.0) {
                // add luminance to finalColor
                finalColor += addLuminance(backgroundColor, 0.005);
              }

              // add light borders
              if (edgeColor.b > 0.0 && edgeColor.b < 0.05) {
              float luminance = abs((edgeColor.r + edgeColor.g / 2.0) - 0.75);
                    finalColor = addLuminance(backgroundColor, luminance / 1.5);
              }

              // blur image here to make it look more like a glass
              if (edgeColor.b > 0.0) {
                  finalColor = gaussianBlurColor(u_background, backgroundUVDistorted, 0.5);
                  finalColor += addLuminance(finalColor, 0.004); // add a soft glow effect
              }

              // optional: add a light border effect again if needed
              if (edgeColor.b > 0.0 && edgeColor.b < 0.55) {
                  float luminance = abs((edgeColor.r + edgeColor.g / 2.0) - 0.75);
                  finalColor = addLuminance(finalColor, luminance / 1.5);
              }

              finalColor = mix(finalColor, vec4(1.0), edgeColor.b == 0.0 ? 0.0 : 0.1);

              gl_FragColor = finalColor;
          }
        `;

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        gl.useProgram(this.program);

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
        this.marginWidth = gl.getUniformLocation(this.program, "u_marginWidth");
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

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.maskLocation, 0);

        // Bind texture background
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundImage);
        gl.uniform1i(this.background, 1); // u_background = TEXTURE1
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.gl.uniform2f(this.canvasSizeLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.backgroundSizeLocation, window.innerWidth, window.innerHeight);
        if (this.position) {
            this.gl.uniform2f(this.positionLocation, this.position.x, this.position.y);
        }

        // Ensure rendering is complete before reading pixels
        gl.finish();
    }

    public setMargin(value: number) {
        if (this.marginLocation) {
            this.gl.useProgram(this.program);
            this.gl.uniform1f(this.marginLocation, value);
        }
    }
    public setMarginWidth(value: number) {
        if (this.marginWidth) {
            this.gl.useProgram(this.program);
            this.gl.uniform1f(this.marginWidth, value);
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
}
