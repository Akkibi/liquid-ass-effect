import { useEffect, useRef } from "react";
import { eventEmitter } from "./effect/eventEmitter";
import { Webgl2GlassEffect } from "./effect/webgl2glassEffect";

const htmlImageToImageData = (img: HTMLImageElement): ImageData | null => {
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = img.width;
    offscreenCanvas.height = img.height;

    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    return imageData;
};

const GlassEffect = ({
    image,
    imageData,
    children,
    effectForce,
    ...props
}: {
    imageData?: ImageData;
    image?: string;
    children: React.ReactNode;
    className: string;
    effectForce: number;
    id: string;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRefUV = useRef<HTMLCanvasElement>(null);
    const glassRefUV = useRef<Webgl2GlassEffect | null>(null);
    // const glassRef = useRef<Shape | null>(null);

    useEffect(() => {
        const canvasUv = canvasRefUV.current;
        const container = containerRef.current;
        if (!canvasUv || !container) return;
        if (image) {
            const img = new Image();
            img.src = image;
            img.onload = () => {
                const imageData = htmlImageToImageData(img);
                if (!imageData || containerRef.current == null) return;
                glassRefUV.current = new Webgl2GlassEffect(imageData, canvasUv);
                glassRefUV.current.setMargin(0.1);
                glassRefUV.current.setBlurAmount(effectForce);
                containerRef.current.style.width = img.width.toString() + "px";
                containerRef.current.style.height = img.height.toString() + "px";
            };
        } else if (imageData) {
            glassRefUV.current = new Webgl2GlassEffect(imageData, canvasUv);
            glassRefUV.current.setMargin(1);
            glassRefUV.current.setBlurAmount(effectForce);
        }

        const mouseMoveHandler = (e: MouseEvent) => {
            if (glassRefUV.current == null) return;
            glassRefUV.current.setPosition(
                e.clientX - container.offsetWidth / 2,
                e.clientY - container.offsetHeight / 2,
            );
            container.style.left = (e.clientX - container.offsetWidth / 2).toString() + "px";
            container.style.top = (e.clientY - container.offsetHeight / 2).toString() + "px";
        };

        document.addEventListener("mousemove", mouseMoveHandler);

        return () => {};
    }, [canvasRefUV, containerRef]);

    useEffect(() => {
        if (glassRefUV.current == null) return;
        if (image) {
            const img = new Image();
            img.src = image;

            img.onload = () => {
                const imageData = htmlImageToImageData(img);
                if (glassRefUV.current == null) return;
                if (!imageData) return;
                if (containerRef.current == null) return;
                glassRefUV.current.updateImage(imageData);
                containerRef.current.style.width = img.width.toString() + "px";
                containerRef.current.style.height = img.height.toString() + "px";
                console.log(imageData.width.toString() + "px");
            };
        }
    }, [image]);

    useEffect(() => {
        const handleUpdate = (imageData: ImageData) => {
            if (containerRef.current == null || glassRefUV.current == null) return;
            glassRefUV.current.updateImage(imageData);
            containerRef.current.style.width = imageData.width.toString() + "px";
            containerRef.current.style.height = imageData.height.toString() + "px";
            console.log(imageData.width.toString() + "px");
        };
        eventEmitter.on("update", handleUpdate);
        return () => {
            eventEmitter.off("update");
        };
    }, []);

    useEffect(() => {
        if (glassRefUV.current == null || !imageData) return;
        if (containerRef.current == null) return;
        glassRefUV.current.render();
        glassRefUV.current.updateImage(imageData);
        containerRef.current.style.width = imageData.width.toString() + "px";
        containerRef.current.style.height = imageData.height.toString() + "px";
        console.log(imageData.width.toString() + "px");
    }, [imageData]);

    return (
        <>
            <div {...props} ref={containerRef}>
                <div className="glass-effect-content">{children}</div>
                <canvas ref={canvasRefUV}></canvas>
            </div>
        </>
    );
};

export default GlassEffect;
