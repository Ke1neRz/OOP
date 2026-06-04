import {
  Shape,
  Rect,
  Line,
  Oval,
  Triangle,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
  type ShapeJSON,
  type PathMode,
} from './index';

export function shapeFromJSON(data: ShapeJSON): Shape | null {
  const type = data.type;

  let shape: Shape | null = null;

  switch (type) {
    case 'Rect': {
      const s = new Rect(data.id, data.width ?? 100, data.height ?? 100);
      shape = s;
      break;
    }
    case 'Line': {
      const s = new Line(data.id, data.x1 ?? 0, data.y1 ?? 0, data.x2 ?? 100, data.y2 ?? 0);
      shape = s;
      break;
    }
    case 'Oval': {
      const s = new Oval(data.id, data.rx ?? 100, data.ry ?? 100);
      shape = s;
      break;
    }
    case 'Triangle': {
      const s = new Triangle(
        data.id,
        data.x1 ?? -50,
        data.y1 ?? -50,
        data.x2 ?? 50,
        data.y2 ?? -50,
        data.x3 ?? 0,
        data.y3 ?? 50
      );
      shape = s;
      break;
    }
    case 'QuadraticBezier': {
      const s = new QuadraticBezier(
        data.id,
        data.x0 ?? -50,
        data.y0 ?? 0,
        data.x1 ?? 0,
        data.y1 ?? -50,
        data.x2 ?? 50,
        data.y2 ?? 0,
        data.flatness ?? 1
      );
      shape = s;
      break;
    }
    case 'CubicBezier': {
      const s = new CubicBezier(
        data.id,
        data.x0 ?? -50,
        data.y0 ?? 0,
        data.x1 ?? -25,
        data.y1 ?? -50,
        data.x2 ?? 25,
        data.y2 ?? -50,
        data.x3 ?? 50,
        data.y3 ?? 0,
        data.flatness ?? 1
      );
      shape = s;
      break;
    }
    case 'PathBezier': {
      const anchors = (data.anchors as { x: number; y: number }[]) ?? [];
      const mode = (data.mode as PathMode) ?? 'polyline';
      const closed = !!data.closed;
      const flatness = (data.flatness as number) ?? 1;
      const s = new PathBezier(data.id, anchors, mode, closed, flatness);
      shape = s;
      break;
    }
    default:
      return null;
  }

  if (!shape) return null;

  // Restore common properties
  if (data.transform) {
    shape.transform = { ...data.transform };
  }
  if (data.fillStyle !== undefined) shape.fillStyle = data.fillStyle;
  if (data.fillOpacity !== undefined) shape.fillOpacity = data.fillOpacity;
  if (data.strokeStyle !== undefined) shape.strokeStyle = data.strokeStyle;
  if (data.strokeWidth !== undefined) shape.strokeWidth = data.strokeWidth;
  if (data.strokeOpacity !== undefined) shape.strokeOpacity = data.strokeOpacity;

  return shape;
}
