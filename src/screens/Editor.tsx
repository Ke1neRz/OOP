import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MousePointer, Square, Circle, Type } from "lucide-react";
import { motion } from "framer-motion";
import {
  RasterRenderer,
  type LineAlg,
  type RGBA,
} from "../lib/raster/RasterRenderer";

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => {
      renderer.resize();
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    } else {
      ro.observe(canvas);
    }

    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    const red: RGBA = { r: 235, g: 60, b: 60, a: 255 };
    const blue: RGBA = { r: 55, g: 110, b: 240, a: 255 };
    const redA: RGBA = { r: 255, g: 0, b: 0, a: 140 };

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (r) {
        r.beginFrame(true);

        const w = r.width;
        const h = r.height;

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