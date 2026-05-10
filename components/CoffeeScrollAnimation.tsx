import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";

type CoffeeScrollAnimationProps = {
  frameCount: number;
  /** Path under /public, e.g. "/coffee-sequence" */
  framesPath?: string;
  /** Total scroll height for this section */
  heightVh?: number;
  /** Optional className for outer wrapper */
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export default function CoffeeScrollAnimation({
  frameCount,
  framesPath = "/coffee-sequence",
  heightVh = 360,
  className,
}: CoffeeScrollAnimationProps) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    mass: 0.8,
  });

  const frameIndexMv = useTransform(smoothProgress, (p) => {
    const idx = Math.floor(clamp(p, 0, 1) * (frameCount - 1));
    return idx;
  });

  const frameUrls = useMemo(() => {
    return Array.from({ length: frameCount }, (_, i) => `${framesPath}/frame_${i}.webp`);
  }, [frameCount, framesPath]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = isBrowser() ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    const nextW = Math.floor(w * dpr);
    const nextH = Math.floor(h * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
  }

  function drawFrame(idx: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imagesRef.current[idx];
    if (!canvas || !ctx) return;

    resizeCanvas();

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    if (!img || !img.complete || !img.naturalWidth) return;

    // Contain-fit: no cropping, preserve aspect ratio.
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function scheduleDraw(idx: number) {
    currentFrameRef.current = idx;
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      drawFrame(currentFrameRef.current);
    });
  }

  useEffect(() => {
    if (!isBrowser()) return;

    let cancelled = false;
    setLoaded(0);
    setReady(false);

    const imgs: HTMLImageElement[] = new Array(frameCount);
    let done = 0;

    const bump = () => {
      done += 1;
      if (cancelled) return;
      setLoaded(done);
      if (done >= frameCount) {
        imagesRef.current = imgs;
        setReady(true);
      }
    };

    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = bump;
      img.onerror = bump;
      img.src = frameUrls[i];
      imgs[i] = img;
    }

    return () => {
      cancelled = true;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [frameCount, frameUrls]);

  useEffect(() => {
    if (!isBrowser()) return;
    const onResize = () => scheduleDraw(currentFrameRef.current);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    // First render as soon as we have frames.
    scheduleDraw(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useMotionValueEvent(frameIndexMv, "change", (v) => {
    if (!ready) return;
    scheduleDraw(Math.round(v));
  });

  const loaderPct = frameCount ? Math.round((loaded / frameCount) * 100) : 0;

  return (
    <section
      ref={(node) => {
        wrapperRef.current = node;
      }}
      className={className}
      style={{ height: `${heightVh}vh`, position: "relative" }}
      aria-label="Coffee scroll animation"
    >
      <div style={{ position: "sticky", top: 0, height: "100vh", width: "100%" }}>
        <canvas
          ref={(node) => {
            canvasRef.current = node;
          }}
          style={{ height: "100%", width: "100%", display: "block" }}
        />

        {!ready && (
          <div
            aria-label="Loading animation frames"
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              pointerEvents: "none",
              fontFamily: "inherit",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Loading {loaderPct}%
          </div>
        )}
      </div>
    </section>
  );
}

