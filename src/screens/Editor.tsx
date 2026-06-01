import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MousePointer,
  Square,
  Circle,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
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
  Triangle,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
  type Shape,
  type Bounds,
} from "../lib/shapes";

type Tool =
  | "select"
  | "rect"
  | "oval"
  | "line"
  | "triangle"
  | "quadbezier"
  | "cubicbezier"
  | "pathbezier";

type InteractionMode =
  | "idle"
  | "moving"
  | "resizing"
  | "rotating"
  | "editing-cp"
  | "creating";

const SEL_COLOR: RGBA = { r: 0, g: 200, b: 255, a: 255 };
const HANDLE_FILL: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const HANDLE_STROKE: RGBA = { r: 0, g: 150, b: 200, a: 255 };
const ROT_COLOR: RGBA = { r: 255, g: 200, b: 0, a: 255 };
const CP_COLOR: RGBA = { r: 255, g: 60, b: 60, a: 255 };
const CP_LINE: RGBA = { r: 255, g: 60, b: 60, a: 180 };

function getShapeTypeName(shape: Shape): string {
  if (shape instanceof Rect) return "Rect";
  if (shape instanceof Oval) return "Oval";
  if (shape instanceof Line) return "Line";
  if (shape instanceof Triangle) return "Triangle";
  if (shape instanceof QuadraticBezier) return "QuadBezier";
  if (shape instanceof CubicBezier) return "CubicBezier";
  if (shape instanceof PathBezier) return "PathBezier";
  return "Shape";
}

function drawHandleSquare(
  r: RasterRenderer,
  cx: number,
  cy: number,
  size: number,
  fill: RGBA,
  stroke: RGBA
) {
  const s2 = size;
  const poly = [
    { x: cx - s2, y: cy - s2 },
    { x: cx + s2, y: cy - s2 },
    { x: cx + s2, y: cy + s2 },
    { x: cx - s2, y: cy + s2 },
  ];
  r.fillPolygon(poly, fill);
  r.strokePolygon(poly, stroke, 1);
}

function hitTestHandles(
  shape: Shape,
  devX: number,
  devY: number,
  dpr: number
): string | number | null {
  const hs = 10 * dpr;
  const bounds = shape.getBounds();
  const centerX = (bounds.minX + bounds.maxX) / 2;

  // Rotation handle
  const rotY = bounds.minY - 28 * dpr;
  if (Math.hypot(devX - centerX, devY - rotY) < 9 * dpr) {
    return "rot";
  }

  // Resize handles (skip Line)
  if (!(shape instanceof Line)) {
    const corners = [
      { x: bounds.minX, y: bounds.minY, name: "nw" },
      { x: bounds.maxX, y: bounds.minY, name: "ne" },
      { x: bounds.maxX, y: bounds.maxY, name: "se" },
      { x: bounds.minX, y: bounds.maxY, name: "sw" },
    ];
    for (const c of corners) {
      if (Math.abs(devX - c.x) < hs && Math.abs(devY - c.y) < hs) {
        return c.name;
      }
    }
  }

  // Control points
  const cpRadius = 8 * dpr;
  if (shape instanceof QuadraticBezier) {
    const pts = [
      shape.transformPointToDevice(shape.x0, shape.y0),
      shape.transformPointToDevice(shape.x1, shape.y1),
      shape.transformPointToDevice(shape.x2, shape.y2),
    ];
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(devX - pts[i].x, devY - pts[i].y) < cpRadius) {
        return `cp-${i}`;
      }
    }
  }
  if (shape instanceof CubicBezier) {
    const pts = [
      shape.transformPointToDevice(shape.x0, shape.y0),
      shape.transformPointToDevice(shape.x1, shape.y1),
      shape.transformPointToDevice(shape.x2, shape.y2),
      shape.transformPointToDevice(shape.x3, shape.y3),
    ];
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(devX - pts[i].x, devY - pts[i].y) < cpRadius) {
        return `cp-${i}`;
      }
    }
  }
  if (shape instanceof PathBezier) {
    for (let i = 0; i < shape.anchors.length; i++) {
      const p = shape.transformPointToDevice(
        shape.anchors[i].x,
        shape.anchors[i].y
      );
      if (Math.hypot(devX - p.x, devY - p.y) < cpRadius) {
        return `cp-${i}`;
      }
    }
  }

  return null;
}

function drawSelectionUI(r: RasterRenderer, shape: Shape) {
  const bounds = shape.getBounds();
  const dpr = r.dpr;
  const hs = 6 * dpr;

  // Bounding box
  r.strokeLine(bounds.minX, bounds.minY, bounds.maxX, bounds.minY, SEL_COLOR, Math.max(1, Math.round(1 * dpr)));
  r.strokeLine(bounds.maxX, bounds.minY, bounds.maxX, bounds.maxY, SEL_COLOR, Math.max(1, Math.round(1 * dpr)));
  r.strokeLine(bounds.maxX, bounds.maxY, bounds.minX, bounds.maxY, SEL_COLOR, Math.max(1, Math.round(1 * dpr)));
  r.strokeLine(bounds.minX, bounds.maxY, bounds.minX, bounds.minY, SEL_COLOR, Math.max(1, Math.round(1 * dpr)));

  // Corner handles (skip Line)
  if (!(shape instanceof Line)) {
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ];
    for (const c of corners) {
      drawHandleSquare(r, c.x, c.y, hs, HANDLE_FILL, HANDLE_STROKE);
    }
  }

  // Rotation handle
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const rotY = bounds.minY - 28 * dpr;
  r.drawLine(centerX, bounds.minY, centerX, rotY, ROT_COLOR);
  r.fillCircle(centerX, rotY, 5 * dpr, ROT_COLOR, false);

  // Control points
  if (shape instanceof QuadraticBezier) {
    const pts = [
      shape.transformPointToDevice(shape.x0, shape.y0),
      shape.transformPointToDevice(shape.x1, shape.y1),
      shape.transformPointToDevice(shape.x2, shape.y2),
    ];
    r.drawLine(pts[0].x, pts[0].y, pts[1].x, pts[1].y, CP_LINE);
    r.drawLine(pts[1].x, pts[1].y, pts[2].x, pts[2].y, CP_LINE);
    for (const p of pts) {
      r.fillCircle(p.x, p.y, 4 * dpr, CP_COLOR, false);
    }
  }
  if (shape instanceof CubicBezier) {
    const pts = [
      shape.transformPointToDevice(shape.x0, shape.y0),
      shape.transformPointToDevice(shape.x1, shape.y1),
      shape.transformPointToDevice(shape.x2, shape.y2),
      shape.transformPointToDevice(shape.x3, shape.y3),
    ];
    r.drawLine(pts[0].x, pts[0].y, pts[1].x, pts[1].y, CP_LINE);
    r.drawLine(pts[2].x, pts[2].y, pts[3].x, pts[3].y, CP_LINE);
    for (const p of pts) {
      r.fillCircle(p.x, p.y, 4 * dpr, CP_COLOR, false);
    }
  }
  if (shape instanceof PathBezier) {
    for (let i = 0; i < shape.anchors.length; i++) {
      const p = shape.transformPointToDevice(
        shape.anchors[i].x,
        shape.anchors[i].y
      );
      r.fillCircle(p.x, p.y, 4 * dpr, CP_COLOR, false);
    }
  }
}

function makeInitialShapes(): Shape[] {
  const shapes: Shape[] = [];

  const rect = new Rect("rect1", 80, 60);
  rect.transform.x = 150;
  rect.transform.y = 150;
  rect.fillStyle = "#FF6B6B";
  rect.strokeStyle = "#000000";
  rect.strokeWidth = 2;
  shapes.push(rect);

  const line = new Line("line1", 50, 50, 250, 150);
  line.strokeStyle = "#4ECDC4";
  line.strokeWidth = 3;
  shapes.push(line);

  const oval = new Oval("oval1", 80, 60);
  oval.transform.x = 350;
  oval.transform.y = 150;
  oval.fillStyle = "#FFD93D";
  oval.strokeStyle = "#000000";
  oval.strokeWidth = 2;
  shapes.push(oval);

  const rect2 = new Rect("rect2", 100, 80);
  rect2.transform.x = 150;
  rect2.transform.y = 300;
  rect2.transform.rotation = Math.PI / 6;
  rect2.fillStyle = "#95E1D3";
  rect2.strokeStyle = "#000000";
  rect2.strokeWidth = 2;
  shapes.push(rect2);

  const oval2 = new Oval("oval2", 100, 50);
  oval2.transform.x = 350;
  oval2.transform.y = 300;
  oval2.transform.scaleX = 1.2;
  oval2.transform.scaleY = 0.8;
  oval2.fillStyle = "#A8E6CF";
  oval2.strokeStyle = "#000000";
  oval2.strokeWidth = 2;
  shapes.push(oval2);

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
  pathBezier.transform.x = 550;
  pathBezier.transform.y = 200;
  pathBezier.strokeStyle = "#000000";
  pathBezier.strokeWidth = 2;
  shapes.push(pathBezier);

  const quadBezier = new QuadraticBezier("quad1", -90, 0, 0, -80, 90, 0);
  quadBezier.transform.x = 550;
  quadBezier.transform.y = 350;
  quadBezier.strokeStyle = "#000000";
  quadBezier.strokeWidth = 2;
  shapes.push(quadBezier);

  const cubicBezier = new CubicBezier("cubic1", -90, 0, -30, -60, 30, 60, 90, 0);
  cubicBezier.transform.x = 550;
  cubicBezier.transform.y = 500;
  cubicBezier.strokeStyle = "#000000";
  cubicBezier.strokeWidth = 2;
  shapes.push(cubicBezier);

  return shapes;
}

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);

  const [shapes, setShapes] = useState<Shape[]>(makeInitialShapes);
  const shapesRef = useRef<Shape[]>(shapes);
  shapesRef.current = shapes;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>(tool);
  toolRef.current = tool;

  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");

  const interactionRef = useRef<{
    mode: InteractionMode;
    startX: number;
    startY: number;
    startTransform: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    } | null;
    startBounds: Bounds | null;
    activeHandle: string | number | null;
    pointerId: number;
    startCenterX: number;
    startCenterY: number;
    startAngle: number;
    startCpLocal: { x: number; y: number } | null;
  }>({
    mode: "idle",
    startX: 0,
    startY: 0,
    startTransform: null,
    startBounds: null,
    activeHandle: null,
    pointerId: -1,
    startCenterX: 0,
    startCenterY: 0,
    startAngle: 0,
    startCpLocal: null,
  });

  // Keyboard: Delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const sid = selectedIdRef.current;
        if (sid) {
          const arr = shapesRef.current.filter((s) => s.id !== sid);
          shapesRef.current = arr;
          setShapes(arr);
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Renderer + RAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (!r) return;

      r.beginFrame(true);

      for (const shape of shapesRef.current) {
        shape.drawRaster(r);
      }

      const selId = selectedIdRef.current;
      if (selId) {
        const shape = shapesRef.current.find((s) => s.id === selId);
        if (shape) {
          drawSelectionUI(r, shape);
        }
      }

      r.commit();
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

  // Line algorithm switch
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  const getDeviceCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * renderer.dpr,
      y: (e.clientY - rect.top) * renderer.dpr,
    };
  };

  const createShapeAt = (t: Tool, x: number, y: number) => {
    const newId =
      Date.now().toString() + Math.random().toString(36).slice(2, 5);
    let shape: Shape;

    switch (t) {
      case "rect": {
        const s = new Rect(newId, 100, 80);
        s.transform.x = x;
        s.transform.y = y;
        s.fillStyle = "#60A5FA";
        s.strokeStyle = "#1E3A8A";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      case "oval": {
        const s = new Oval(newId, 80, 60);
        s.transform.x = x;
        s.transform.y = y;
        s.fillStyle = "#FBBF24";
        s.strokeStyle = "#92400E";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      case "line": {
        const s = new Line(newId, x - 50, y, x + 50, y);
        s.strokeStyle = "#34D399";
        s.strokeWidth = 3;
        shape = s;
        break;
      }
      case "triangle": {
        const s = new Triangle(newId, -40, 30, 40, 30, 0, -30);
        s.transform.x = x;
        s.transform.y = y;
        s.fillStyle = "#A78BFA";
        s.strokeStyle = "#5B21B6";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      case "quadbezier": {
        const s = new QuadraticBezier(newId, -50, 0, 0, -50, 50, 0);
        s.transform.x = x;
        s.transform.y = y;
        s.strokeStyle = "#F87171";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      case "cubicbezier": {
        const s = new CubicBezier(newId, -50, 0, -25, -50, 25, -50, 50, 0);
        s.transform.x = x;
        s.transform.y = y;
        s.strokeStyle = "#60A5FA";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      case "pathbezier": {
        const s = new PathBezier(
          newId,
          [
            { x: 0, y: 0 },
            { x: 40, y: -40 },
            { x: 80, y: 0 },
          ],
          "polyline",
          false
        );
        s.transform.x = x;
        s.transform.y = y;
        s.strokeStyle = "#F472B6";
        s.strokeWidth = 2;
        shape = s;
        break;
      }
      default:
        return;
    }

    const newShapes = [...shapesRef.current, shape];
    shapesRef.current = newShapes;
    setShapes(newShapes);
    setSelectedId(newId);
    setTool("select");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();

    const { x, y } = getDeviceCoords(e);
    const currentTool = toolRef.current;

    if (currentTool !== "select") {
      createShapeAt(currentTool, x, y);
      return;
    }

    // Selection / interaction
    const selId = selectedIdRef.current;
    if (selId) {
      const shape = shapesRef.current.find((s) => s.id === selId);
      if (shape) {
        const handle = hitTestHandles(shape, x, y, rendererRef.current?.dpr || 1);
        if (handle !== null) {
          const center = shape.getCenter();
          if (handle === "rot") {
            const startAngle = Math.atan2(y - center.y, x - center.x);
            interactionRef.current = {
              ...interactionRef.current,
              mode: "rotating",
              startX: x,
              startY: y,
              startTransform: { ...shape.transform },
              activeHandle: handle,
              pointerId: e.pointerId,
              startCenterX: center.x,
              startCenterY: center.y,
              startAngle,
              startBounds: null,
              startCpLocal: null,
            };
          } else if (
            typeof handle === "string" &&
            ["nw", "ne", "se", "sw"].includes(handle)
          ) {
            interactionRef.current = {
              ...interactionRef.current,
              mode: "resizing",
              startX: x,
              startY: y,
              startBounds: shape.getBounds(),
              activeHandle: handle,
              pointerId: e.pointerId,
              startTransform: null,
              startCenterX: center.x,
              startCenterY: center.y,
              startAngle: 0,
              startCpLocal: null,
            };
          } else if (
            typeof handle === "string" &&
            handle.startsWith("cp-")
          ) {
            const cpIdx = parseInt(handle.slice(3), 10);
            let startLocal: { x: number; y: number } | null = null;
            if (shape instanceof PathBezier && cpIdx < shape.anchors.length) {
              startLocal = { ...shape.anchors[cpIdx] };
            } else if (shape instanceof QuadraticBezier) {
              const arr = [
                { x: shape.x0, y: shape.y0 },
                { x: shape.x1, y: shape.y1 },
                { x: shape.x2, y: shape.y2 },
              ];
              if (cpIdx < arr.length) startLocal = arr[cpIdx];
            } else if (shape instanceof CubicBezier) {
              const arr = [
                { x: shape.x0, y: shape.y0 },
                { x: shape.x1, y: shape.y1 },
                { x: shape.x2, y: shape.y2 },
                { x: shape.x3, y: shape.y3 },
              ];
              if (cpIdx < arr.length) startLocal = arr[cpIdx];
            }
            interactionRef.current = {
              ...interactionRef.current,
              mode: "editing-cp",
              startX: x,
              startY: y,
              activeHandle: handle,
              pointerId: e.pointerId,
              startTransform: null,
              startBounds: null,
              startCenterX: 0,
              startCenterY: 0,
              startAngle: 0,
              startCpLocal: startLocal,
            };
          }
          return;
        }
      }
    }

    // Hit-test shapes from top to bottom
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i];
      if (shape.hitTest(x, y)) {
        setSelectedId(shape.id);
        interactionRef.current = {
          ...interactionRef.current,
          mode: "moving",
          startX: x,
          startY: y,
          startTransform: { ...shape.transform },
          activeHandle: null,
          pointerId: e.pointerId,
          startBounds: null,
          startCenterX: 0,
          startCenterY: 0,
          startAngle: 0,
          startCpLocal: null,
        };
        return;
      }
    }

    // Clicked empty space
    setSelectedId(null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inter = interactionRef.current;
    if (inter.mode === "idle") return;
    if (e.pointerId !== inter.pointerId) return;
    e.preventDefault();

    const { x, y } = getDeviceCoords(e);
    const selId = selectedIdRef.current;
    if (!selId) return;
    const shape = shapesRef.current.find((s) => s.id === selId);
    if (!shape) return;

    if (inter.mode === "moving" && inter.startTransform) {
      const dx = x - inter.startX;
      const dy = y - inter.startY;
      shape.transform.x = inter.startTransform.x + dx;
      shape.transform.y = inter.startTransform.y + dy;
      shape.invalidateMatrices();
    } else if (inter.mode === "resizing" && inter.startBounds) {
      const sb = inter.startBounds;
      let minX = sb.minX;
      let minY = sb.minY;
      let maxX = sb.maxX;
      let maxY = sb.maxY;
      const h = inter.activeHandle as string;
      if (h === "nw") {
        minX = x;
        minY = y;
      } else if (h === "ne") {
        maxX = x;
        minY = y;
      } else if (h === "se") {
        maxX = x;
        maxY = y;
      } else if (h === "sw") {
        minX = x;
        maxY = y;
      }
      const MIN = 10;
      if (maxX - minX < MIN) {
        if (h === "nw" || h === "sw") minX = maxX - MIN;
        else maxX = minX + MIN;
      }
      if (maxY - minY < MIN) {
        if (h === "nw" || h === "ne") minY = maxY - MIN;
        else maxY = minY + MIN;
      }
      shape.resizeFromDeviceAABB(minX, minY, maxX, maxY);
      shape.invalidateMatrices();
    } else if (inter.mode === "rotating" && inter.startTransform) {
      const currentAngle = Math.atan2(
        y - inter.startCenterY,
        x - inter.startCenterX
      );
      shape.transform.rotation =
        inter.startTransform.rotation + (currentAngle - inter.startAngle);
      shape.invalidateMatrices();
    } else if (inter.mode === "editing-cp") {
      const local = shape.transformPointToLocal(x, y);
      const h = inter.activeHandle as string;
      const cpIdx = parseInt(h.slice(3), 10);
      if (shape instanceof PathBezier) {
        shape.setControlPoint(cpIdx, local);
      } else if (shape instanceof QuadraticBezier) {
        if (cpIdx === 0) {
          shape.x0 = local.x;
          shape.y0 = local.y;
        } else if (cpIdx === 1) {
          shape.x1 = local.x;
          shape.y1 = local.y;
        } else if (cpIdx === 2) {
          shape.x2 = local.x;
          shape.y2 = local.y;
        }
        shape.invalidateMatrices();
      } else if (shape instanceof CubicBezier) {
        if (cpIdx === 0) {
          shape.x0 = local.x;
          shape.y0 = local.y;
        } else if (cpIdx === 1) {
          shape.x1 = local.x;
          shape.y1 = local.y;
        } else if (cpIdx === 2) {
          shape.x2 = local.x;
          shape.y2 = local.y;
        } else if (cpIdx === 3) {
          shape.x3 = local.x;
          shape.y3 = local.y;
        }
        shape.invalidateMatrices();
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inter = interactionRef.current;
    if (inter.pointerId === e.pointerId && inter.mode !== "idle") {
      interactionRef.current = {
        ...interactionRef.current,
        mode: "idle",
        activeHandle: null,
        pointerId: -1,
      };
      // Sync React state after interaction ends
      setShapes([...shapesRef.current]);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleDelete = (shapeId: string) => {
    const arr = shapesRef.current.filter((s) => s.id !== shapeId);
    shapesRef.current = arr;
    setShapes(arr);
    if (selectedId === shapeId) setSelectedId(null);
  };

  const moveLayer = (shapeId: string, dir: "up" | "down") => {
    const arr = [...shapesRef.current];
    const idx = arr.findIndex((s) => s.id === shapeId);
    if (dir === "up" && idx >= 0 && idx < arr.length - 1) {
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    } else if (dir === "down" && idx > 0) {
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
    }
    shapesRef.current = arr;
    setShapes(arr);
  };

  const selectedShape = shapes.find((s) => s.id === selectedId) || null;

  const setTransformProp = (
    key: "x" | "y" | "rotation" | "scaleX" | "scaleY",
    value: number
  ) => {
    if (!selectedShape) return;
    const shape = shapesRef.current.find((s) => s.id === selectedId);
    if (!shape) return;
    shape.transform[key] = value;
    shape.invalidateMatrices();
    setShapes([...shapesRef.current]);
  };

  const setProp = <K extends keyof Shape>(
    key: K,
    value: Shape[K]
  ) => {
    if (!selectedShape) return;
    const shape = shapesRef.current.find((s) => s.id === selectedId);
    if (!shape) return;
    (shape as any)[key] = value;
    setShapes([...shapesRef.current]);
  };

  const isToolActive = (t: Tool) => tool === t;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-screen flex flex-col"
    >
      <div className="h-screen flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950">
          <button
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all px-4 py-2 rounded text-sm"
            onClick={() => navigate(-1)}
          >
            Назад
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold">
              Редактирование проекта #{id}
            </h1>
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
          <button
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all px-4 py-2 rounded text-sm"
            onClick={() => navigate("/")}
          >
            Сохранить
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Toolbar */}
          <aside className="w-16 border-r border-slate-800 bg-slate-950 flex flex-col gap-2 p-2">
            <button
              title="Выбор"
              className={`p-2 rounded ${
                isToolActive("select")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("select")}
            >
              <MousePointer size={20} />
            </button>
            <button
              title="Прямоугольник"
              className={`p-2 rounded ${
                isToolActive("rect")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("rect")}
            >
              <Square size={20} />
            </button>
            <button
              title="Овал"
              className={`p-2 rounded ${
                isToolActive("oval")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("oval")}
            >
              <Circle size={20} />
            </button>
            <button
              title="Линия"
              className={`p-2 rounded text-lg ${
                isToolActive("line")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("line")}
            >
              ―
            </button>
            <button
              title="Треугольник"
              className={`p-2 rounded text-lg ${
                isToolActive("triangle")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("triangle")}
            >
              △
            </button>
            <button
              title="Квадр. Безье"
              className={`p-2 rounded text-sm ${
                isToolActive("quadbezier")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("quadbezier")}
            >
              Q
            </button>
            <button
              title="Куб. Безье"
              className={`p-2 rounded text-sm ${
                isToolActive("cubicbezier")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("cubicbezier")}
            >
              C
            </button>
            <button
              title="Путь"
              className={`p-2 rounded text-sm ${
                isToolActive("pathbezier")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
              onClick={() => setTool("pathbezier")}
            >
              P
            </button>
            <div className="flex-1" />
            <button
              title="Удалить выделенное (Del)"
              className={`p-2 rounded text-red-400 hover:bg-red-900/30 ${
                selectedId ? "" : "opacity-30"
              }`}
              onClick={() => {
                if (selectedId) handleDelete(selectedId);
              }}
            >
              <Trash2 size={20} />
            </button>
          </aside>

          {/* Canvas */}
          <main className="flex-1 bg-slate-100 p-6 relative overflow-hidden">
            <div
              ref={containerRef}
              className="w-full h-full min-h-[320px] bg-white shadow overflow-hidden"
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full block touch-none"
                style={{ touchAction: "none" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onLostPointerCapture={onPointerUp}
              />
            </div>
          </main>

          {/* Right panel */}
          <aside className="w-72 border-l border-slate-800 bg-slate-950 p-4 overflow-y-auto flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-300 mb-2">Слои</h3>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {[...shapes].reverse().map((shape) => {
                  const isSel = shape.id === selectedId;
                  return (
                    <div
                      key={shape.id}
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs ${
                        isSel
                          ? "bg-blue-700 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                      onClick={() => setSelectedId(shape.id)}
                    >
                      <span className="truncate">
                        {getShapeTypeName(shape)} {shape.id.slice(-4)}
                      </span>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          className="p-1 rounded hover:bg-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(shape.id, "up");
                          }}
                          title="Вверх"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayer(shape.id, "down");
                          }}
                          title="Вниз"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-800 text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(shape.id);
                          }}
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {shapes.length === 0 && (
                  <div className="text-xs text-slate-500 px-2 py-1">
                    Нет объектов
                  </div>
                )}
              </div>
            </div>

            {selectedShape && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-300">Свойства</h3>

                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs items-center">
                  <span className="text-slate-400">X</span>
                  <input
                    type="number"
                    step="1"
                    className="bg-slate-800 text-white px-2 py-1 rounded"
                    value={Math.round(selectedShape.transform.x)}
                    onChange={(e) =>
                      setTransformProp("x", parseFloat(e.target.value) || 0)
                    }
                  />
                  <span className="text-slate-400">Y</span>
                  <input
                    type="number"
                    step="1"
                    className="bg-slate-800 text-white px-2 py-1 rounded"
                    value={Math.round(selectedShape.transform.y)}
                    onChange={(e) =>
                      setTransformProp("y", parseFloat(e.target.value) || 0)
                    }
                  />
                  <span className="text-slate-400">Поворот °</span>
                  <input
                    type="number"
                    step="1"
                    className="bg-slate-800 text-white px-2 py-1 rounded"
                    value={Math.round(
                      (selectedShape.transform.rotation * 180) / Math.PI
                    )}
                    onChange={(e) =>
                      setTransformProp(
                        "rotation",
                        ((parseFloat(e.target.value) || 0) * Math.PI) / 180
                      )
                    }
                  />
                  <span className="text-slate-400">Scale X</span>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-slate-800 text-white px-2 py-1 rounded"
                    value={parseFloat(selectedShape.transform.scaleX.toFixed(2))}
                    onChange={(e) =>
                      setTransformProp(
                        "scaleX",
                        parseFloat(e.target.value) || 0.01
                      )
                    }
                  />
                  <span className="text-slate-400">Scale Y</span>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-slate-800 text-white px-2 py-1 rounded"
                    value={parseFloat(selectedShape.transform.scaleY.toFixed(2))}
                    onChange={(e) =>
                      setTransformProp(
                        "scaleY",
                        parseFloat(e.target.value) || 0.01
                      )
                    }
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Заливка</span>
                    <input
                      type="color"
                      value={selectedShape.fillStyle}
                      onChange={(e) => setProp("fillStyle", e.target.value)}
                      className="w-8 h-6 rounded bg-transparent"
                    />
                    <span className="text-slate-400 ml-2">Непрозр.</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      className="w-16 bg-slate-800 text-white px-2 py-1 rounded"
                      value={selectedShape.fillOpacity}
                      onChange={(e) =>
                        setProp(
                          "fillOpacity",
                          Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Обводка</span>
                    <input
                      type="color"
                      value={selectedShape.strokeStyle}
                      onChange={(e) =>
                        setProp("strokeStyle", e.target.value)
                      }
                      className="w-8 h-6 rounded bg-transparent"
                    />
                    <span className="text-slate-400 ml-2">Ширина</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="w-16 bg-slate-800 text-white px-2 py-1 rounded"
                      value={selectedShape.strokeWidth}
                      onChange={(e) =>
                        setProp(
                          "strokeWidth",
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                    />
                  </div>
                </div>

                {selectedShape instanceof Rect && (
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs items-center">
                    <span className="text-slate-400">Ширина</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="bg-slate-800 text-white px-2 py-1 rounded"
                      value={Math.round(selectedShape.width)}
                      onChange={(e) => {
                        const v = Math.max(1, parseFloat(e.target.value) || 1);
                        const s = shapesRef.current.find(
                          (sh) => sh.id === selectedId
                        ) as Rect;
                        if (s) {
                          s.width = v;
                          setShapes([...shapesRef.current]);
                        }
                      }}
                    />
                    <span className="text-slate-400">Высота</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="bg-slate-800 text-white px-2 py-1 rounded"
                      value={Math.round(selectedShape.height)}
                      onChange={(e) => {
                        const v = Math.max(1, parseFloat(e.target.value) || 1);
                        const s = shapesRef.current.find(
                          (sh) => sh.id === selectedId
                        ) as Rect;
                        if (s) {
                          s.height = v;
                          setShapes([...shapesRef.current]);
                        }
                      }}
                    />
                  </div>
                )}

                {selectedShape instanceof Oval && (
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs items-center">
                    <span className="text-slate-400">Rx</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="bg-slate-800 text-white px-2 py-1 rounded"
                      value={Math.round(selectedShape.rx)}
                      onChange={(e) => {
                        const v = Math.max(1, parseFloat(e.target.value) || 1);
                        const s = shapesRef.current.find(
                          (sh) => sh.id === selectedId
                        ) as Oval;
                        if (s) {
                          s.rx = v;
                          setShapes([...shapesRef.current]);
                        }
                      }}
                    />
                    <span className="text-slate-400">Ry</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="bg-slate-800 text-white px-2 py-1 rounded"
                      value={Math.round(selectedShape.ry)}
                      onChange={(e) => {
                        const v = Math.max(1, parseFloat(e.target.value) || 1);
                        const s = shapesRef.current.find(
                          (sh) => sh.id === selectedId
                        ) as Oval;
                        if (s) {
                          s.ry = v;
                          setShapes([...shapesRef.current]);
                        }
                      }}
                    />
                  </div>
                )}

                {selectedShape instanceof PathBezier && (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400">
                      Точек: {selectedShape.anchors.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white"
                        onClick={() => {
                          const s = shapesRef.current.find(
                            (sh) => sh.id === selectedId
                          ) as PathBezier;
                          if (s) {
                            s.addPointLocal({ x: 0, y: 0 });
                            setShapes([...shapesRef.current]);
                          }
                        }}
                      >
                        + Точка
                      </button>
                      <button
                        className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-200"
                        onClick={() => {
                          const s = shapesRef.current.find(
                            (sh) => sh.id === selectedId
                          ) as PathBezier;
                          if (s && s.anchors.length > 2) {
                            s.removePoint(s.anchors.length - 1);
                            setShapes([...shapesRef.current]);
                          }
                        }}
                      >
                        − Точка
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
