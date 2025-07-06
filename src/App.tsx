import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Background } from "./effect/background";
import { eventEmitter } from "./effect/eventEmitter";
import GlassEffect from "./glassEffect";
import CanvasAnimation from "./effect/canvasAnimation";
// import { WebglTest } from "./effect/webglTest";
// import { Glass } from "./effect/glass";
function App() {
    const [currentImage, setCurrentImage] = useState<string>("./akira.png");
    const uiCanvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const background = new Background();

        const handleKeydown = (e: KeyboardEvent) => {
            eventEmitter.trigger("keyPress", [e.key]);
        };

        const handleMouseMove = (e: MouseEvent) => {
            eventEmitter.trigger("mouseMove", [e.clientX, e.clientY]);
        };

        if (!uiCanvas.current) return;
        const animation = new CanvasAnimation(uiCanvas.current);

        animation.animate();

        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("mousemove", handleMouseMove);
        return () => {
            document.removeEventListener("keydown", handleKeydown);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);

    return (
        <>
            <canvas id="canvas"></canvas>
            <div className="canvasContainer">
                <canvas ref={uiCanvas}></canvas>
            </div>
            <GlassEffect id="hello" image={currentImage} className="webgl uv">
                <p>Hello World</p>
            </GlassEffect>
            {/* dropDown */}
            <select
                className="select dropdown"
                onChange={(e) => {
                    eventEmitter.trigger("setImage", [e.target.value]);
                    console.log(e.target.value);
                }}
            >
                <option className="dropdown-option" value="./macos.png">
                    Blender Figma image
                </option>
                <option className="dropdown-option" value="./macos26.webp">
                    Macos 26 dark
                </option>
                <option className="dropdown-option" value="./macos26light.webp">
                    Macos 26 light
                </option>
                <option className="dropdown-option" value="./SequoiaDark.png">
                    Sequoia Dark
                </option>
                <option className="dropdown-option" value="./apple-wallpaper.jpg">
                    Apple wallpaper
                </option>
                <option className="dropdown-option" value="./apple-liquid-glass.jpg">
                    Apple liquid glass
                </option>
            </select>
        </>
    );
}

export default App;
