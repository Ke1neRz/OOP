import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MousePointer, Square, Circle, Type } from "lucide-react";
import { motion } from "framer-motion";
import {
  RasterRenderer,
  type LineAlg,
  type RGBA,
} from "../lib/raster/RasterRenderer";
import {
  Rect,
  Line,
  Oval,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
  type Shape,
} from "../lib/shapes";

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");
  const [shapes] = useState<Shape[]>(() => {
    // Create demo shapes
    const shapeList: Shape[] = [];

    // Rectangle
    const rect = new Rect("rect1", 80, 60);
    rect.transform.x = 150;
    rect.transform.y = 150;
    rect.fillStyle = "#FF6B6B";
    rect.strokeStyle = "#000000";
    rect.strokeWidth = 2;
    shapeList.push(rect);

    // Line
    const line = new Line("line1", 50, 50, 250, 150);
    line.strokeStyle = "#4ECDC4";
    line.strokeWidth = 3;
    shapeList.push(line);

    // Oval
    const oval = new Oval("oval1", 80, 60);
    oval.transform.x = 350;
    oval.transform.y = 150;
    oval.fillStyle = "#FFD93D";
    oval.strokeStyle = "#000000";
    oval.strokeWidth = 2;
    shapeList.push(oval);

    // Another rotated rectangle
    const rect2 = new Rect("rect2", 100, 80);
    rect2.transform.x = 150;
    rect2.transform.y = 300;
    rect2.transform.rotation = Math.PI / 6;
    rect2.fillStyle = "#95E1D3";
    rect2.strokeStyle = "#000000";
    rect2.strokeWidth = 2;
    shapeList.push(rect2);

    // Scaled oval
    const oval2 = new Oval("oval2", 100, 50);
    oval2.transform.x = 350;
    oval2.transform.y = 300;
    oval2.transform.scaleX = 1.2;
    oval2.transform.scaleY = 0.8;
    oval2.fillStyle = "#A8E6CF";
    oval2.strokeStyle = "#000000";
    oval2.strokeWidth = 2;
    shapeList.push(oval2);

    // Lab 6 curves (top-right, ordered top-to-bottom)
    // Three-petal rose via Catmull-Rom spline (real smooth curve, not a hard-coded polyline)
    const petalRadius = 90;
    const petalCount = 12;
    const petalOffset = Math.PI / 6;
    const anchors: { x: number; y: number }[] = [];
    for (let i = 0; i < petalCount; i++) {
      const t = petalOffset + (i / petalCount) * Math.PI * 2;
      const r = petalRadius * Math.cos(3 * t);
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      anchors.push({ x, y });
    }
    const pathBezier = new PathBezier("path1", anchors, "catmull", true);
    pathBezier.strokeStyle = "#000000";
    pathBezier.strokeWidth = 2;
    shapeList.push(pathBezier);

    const quadBezier = new QuadraticBezier("quad1", -90, 0, 0, -80, 90, 0);
    quadBezier.strokeStyle = "#000000";
    quadBezier.strokeWidth = 2;
    shapeList.push(quadBezier);

    const cubicBezier = new CubicBezier(
      "cubic1",
      -90,
      0,
      -30,
      -60,
      30,
      60,
      90,
      0
    );
    cubicBezier.strokeStyle = "#000000";
    cubicBezier.strokeWidth = 2;
    shapeList.push(cubicBezier);

    return shapeList;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const positionLab6Shapes = () => {
      const path = shapes.find((shape) => shape.id === "path1");
      const quad = shapes.find((shape) => shape.id === "quad1");
      const cubic = shapes.find((shape) => shape.id === "cubic1");
      if (!path || !quad || !cubic) {
        return;
      }

      const r = rendererRef.current;
      if (!r) {
        return;
      }

      const margin = Math.max(16, Math.round(24 * r.dpr));
      const gap = Math.max(Math.round(18 * r.dpr), Math.round(r.height * 0.04));

      const size = (shape: Shape) => {
        const b = shape.getLocalBounds();
        return {
          halfW: (b.maxX - b.minX) / 2,
          halfH: (b.maxY - b.minY) / 2,
        };
      };

      const p = size(path);
      const q = size(quad);
      const c = size(cubic);
      const maxHalfW = Math.max(p.halfW, q.halfW, c.halfW);

      const maxRightX = r.width - margin - maxHalfW;
      const minRightX = margin + maxHalfW;
      const rightX = maxRightX >= minRightX ? maxRightX : minRightX;

      const place = (shape: Shape, cx: number, cy: number, halfW: number, halfH: number) => {
        shape.setBounds(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
      };

      let y = margin + p.halfH;
      place(path, rightX, y, p.halfW, p.halfH);
      y += p.halfH + q.halfH + gap;
      place(quad, rightX, y, q.halfW, q.halfH);
      y += q.halfH + c.halfH + gap;
      place(cubic, rightX, y, c.halfW, c.halfH);
    };

    const ro = new ResizeObserver(() => {
      renderer.resize();
      positionLab6Shapes();
    });

    positionLab6Shapes();

    if (containerRef.current) {
      ro.observe(containerRef.current);
    } else {
      ro.observe(canvas);
    }

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (r) {
        r.beginFrame(true);

        const w = r.width;
        const h = r.height;

        // Draw demo shapes
        for (const shape of shapes) {
          shape.drawRaster(r);
        }

        const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
        const red: RGBA = { r: 235, g: 60, b: 60, a: 255 };
        const blue: RGBA = { r: 55, g: 110, b: 240, a: 255 };
        const redA: RGBA = { r: 255, g: 0, b: 0, a: 140 };

        const quad = shapes.find((shape) => shape.id === "quad1");
        if (quad instanceof QuadraticBezier) {
          const q0 = quad.transformPointToDevice(quad.x0, quad.y0);
          const q2 = quad.transformPointToDevice(quad.x2, quad.y2);
          r.drawLine(q0.x, q0.y, q2.x, q2.y, black);
        }

        const cubic = shapes.find((shape) => shape.id === "cubic1");
        if (cubic instanceof CubicBezier) {
          const c0 = cubic.transformPointToDevice(cubic.x0, cubic.y0);
          const c3 = cubic.transformPointToDevice(cubic.x3, cubic.y3);
          r.drawLine(c0.x, c0.y, c3.x, c3.y, black);
        }

        const tri = [
          { x: w * 0.2, y: h * 0.18 },
          { x: w * 0.72, y: h * 0.22 },
          { x: w * 0.32, y: h * 0.72 },
        ];
        r.fillPolygon(tri, red);
        r.strokePolygon(tri, black, Math.max(2, Math.round(3 * r.dpr)));

        r.fillPolygon(
          [
            { x: w * 0.58, y: h * 0.56 },
            { x: w * 0.84, y: h * 0.56 },
            { x: w * 0.84, y: h * 0.82 },
            { x: w * 0.58, y: h * 0.82 },
          ],
          blue
        );
        r.fillCircle(w * 0.7, h * 0.68, h * 0.11, redA, true);

        const polyline = [
          { x: w * 0.08, y: h * 0.84 },
          { x: w * 0.2, y: h * 0.62 },
          { x: w * 0.32, y: h * 0.88 },
          { x: w * 0.5, y: h * 0.7 },
          { x: w * 0.66, y: h * 0.9 },
        ];

        for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          r.strokeLine(
            a.x,
            a.y,
            b.x,
            b.y,
            { r: 245, g: 245, b: 245, a: 255 },
            Math.max(2, Math.round(6 * r.dpr))
          );
        }

        r.drawLine(w * 0.08, h * 0.12, w * 0.42, h * 0.42, {
          r: 255,
          g: 255,
          b: 0,
          a: 255,
        });

        r.commit();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  return (  
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-screen flex flex-col"
    >
      <div className="h-screen flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
          <button className="g-blue-600 hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all px-4 py-2 rounded" onClick={() => navigate(-1)}>Назад</button>
          <div className="flex items-center gap-4">
            <h1>Редактирование проекта #{id}</h1>
            <div className="flex gap-2 text-sm">
              <button
                className={`px-3 py-1 rounded border ${
                  lineAlg === "bresenham"
                    ? "bg-blue-600 border-blue-500"
                    : "border-slate-600 hover:border-slate-400"
                }`}
                onClick={() => setLineAlg("bresenham")}
              >
                Bresenham
              </button>
              <button
                className={`px-3 py-1 rounded border ${
                  lineAlg === "wu"
                    ? "bg-blue-600 border-blue-500"
                    : "border-slate-600 hover:border-slate-400"
                }`}
                onClick={() => setLineAlg("wu")}
              >
                Xiaolin Wu
              </button>
            </div>
          </div>
          <button className="g-blue-600 hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all px-4 py-2 rounded" onClick={() => navigate("/")}>Сохранить</button>
        </header>

        <div className="flex flex-1">
          <aside className="w-16 border-r border-slate-800">
            <p>Tools</p>

            <button className="p-2 hover:bg-slate-700 rounded">
              <MousePointer size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Square size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Circle size={20} />
            </button>

            <button className="p-2 hover:bg-slate-700 rounded">
              <Type size={20} />
            </button>
          </aside>

          <main className="flex-1 bg-slate-100 p-6">
            <div
              ref={containerRef}
              className="w-full h-full min-h-[320px] bg-white shadow overflow-hidden"
            >
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          </main>

          <aside className="w-64 border-l border-slate-800">Props</aside>
        </div>
      </div>
    </motion.div>
  );
}