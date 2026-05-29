import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Cubic Bezier curve
 * Defined by four control points: start, control1, control2, end
 * Formula: P(t) = (1-t)³*P0 + 3*(1-t)²*t*P1 + 3*(1-t)*t²*P2 + t³*P3, where t ∈ [0, 1]
 */
export class CubicBezier extends Shape {
  // Control points in local coordinates (relative to center)
  x0: number; // Start point
  y0: number;
  x1: number; // First control point
  y1: number;
  x2: number; // Second control point
  y2: number;
  x3: number; // End point
  y3: number;
  flatness: number;

  constructor(
    id: string,
    x0: number = -50,
    y0: number = 0,
    x1: number = -25,
    y1: number = -50,
    x2: number = 25,
    y2: number = -50,
    x3: number = 50,
    y3: number = 0,
    flatness: number = 1
  ) {
    super(id);

    // Calculate center
    const cx = (x0 + x1 + x2 + x3) / 4;
    const cy = (y0 + y1 + y2 + y3) / 4;

    // Store control points relative to center
    this.x0 = x0 - cx;
    this.y0 = y0 - cy;
    this.x1 = x1 - cx;
    this.y1 = y1 - cy;
    this.x2 = x2 - cx;
    this.y2 = y2 - cy;
    this.x3 = x3 - cx;
    this.y3 = y3 - cy;

    this.strokeWidth = 2; // Default stroke for curves
    this.flatness = flatness;
  }

  /**
   * Evaluate the Bezier curve at parameter t ∈ [0, 1] in local coordinates
   */
  evalLocal(t: number): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const a = mt3; // (1-t)³
    const b = 3 * mt2 * t; // 3*(1-t)²*t
    const c = 3 * mt * t2; // 3*(1-t)*t²
    const d = t3; // t³

    return {
      x: a * this.x0 + b * this.x1 + c * this.x2 + d * this.x3,
      y: a * this.y0 + b * this.y1 + c * this.y2 + d * this.y3,
    };
  }

  /**
   * Get all points along the curve for rendering (local coordinates)
   */
  private getCurvePoints(): [number, number][] {
    const chord = Math.hypot(this.x3 - this.x0, this.y3 - this.y0);
    const resolution = Math.max(30, Math.min(120, Math.ceil(chord / this.flatness)));
    const points: [number, number][] = [];
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const p = this.evalLocal(t);
      points.push([p.x, p.y]);
    }
    return points;
  }

  /**
   * Approximate the curve as a polyline in device (screen) coordinates
   */
  flattenDevicePoints(): { x: number; y: number }[] {
    return this.getCurvePoints().map(([x, y]) => this.transformPointToDevice(x, y));
  }

  /**
   * Draw the Bezier curve on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const curvePoints = this.getCurvePoints();
    const screenPoints = curvePoints.map(([x, y]) => this.transformPointToDevice(x, y));

    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    // Draw the curve as a series of lines
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const p1 = screenPoints[i];
        const p2 = screenPoints[i + 1];
        r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
      }
    }

    // Optionally draw control points (for debugging/editing)
    const showControlPoints = false;
    if (showControlPoints) {
      const p0 = this.transformPointToDevice(this.x0, this.y0);
      const p1 = this.transformPointToDevice(this.x1, this.y1);
      const p2 = this.transformPointToDevice(this.x2, this.y2);
      const p3 = this.transformPointToDevice(this.x3, this.y3);

      const cpColor = { r: 255, g: 0, b: 0, a: 200 };

      r.fillCircle(p0.x, p0.y, 3, cpColor, false);
      r.fillCircle(p1.x, p1.y, 3, cpColor, false);
      r.fillCircle(p2.x, p2.y, 3, cpColor, false);
      r.fillCircle(p3.x, p3.y, 3, cpColor, false);
    }
  }

  /**
   * Check if a point is near the curve (within strokeWidth distance)
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);
    const tolerance = this.strokeWidth + 2;

    const curvePoints = this.getCurvePoints();

    for (let i = 0; i < curvePoints.length - 1; i++) {
      const [x1, y1] = curvePoints[i];
      const [x2, y2] = curvePoints[i + 1];

      // Distance from point to line segment
      const dist = this.distancePointToSegment(local.x, local.y, x1, y1, x2, y2);
      if (dist < tolerance) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distancePointToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;

    if (len2 === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }

  /**
   * Get bounds in device (screen) coordinates
   */
  getBounds(): Bounds {
    const curvePoints = this.getCurvePoints();
    const screenPoints = curvePoints.map(([x, y]) => this.transformPointToDevice(x, y));

    let minX = screenPoints[0].x;
    let maxX = screenPoints[0].x;
    let minY = screenPoints[0].y;
    let maxY = screenPoints[0].y;

    for (const point of screenPoints) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    // Add stroke width margin
    const margin = this.strokeWidth / 2;
    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minY: minY - margin,
      maxY: maxY + margin,
    };
  }

  /**
   * Get bounds in local coordinates
   */
  getLocalBounds(): Bounds {
    const xs = [this.x0, this.x1, this.x2, this.x3];
    const ys = [this.y0, this.y1, this.y2, this.y3];

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  /**
   * Create a clone of this curve
   */
  protected createClone(): Shape {
    const center = {
      x: (this.x0 + this.x1 + this.x2 + this.x3) / 4,
      y: (this.y0 + this.y1 + this.y2 + this.y3) / 4,
    };
    return new CubicBezier(
      this.id,
      this.x0 + center.x,
      this.y0 + center.y,
      this.x1 + center.x,
      this.y1 + center.y,
      this.x2 + center.x,
      this.y2 + center.y,
      this.x3 + center.x,
      this.y3 + center.y
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    const center = {
      x: (this.x0 + this.x1 + this.x2 + this.x3) / 4,
      y: (this.y0 + this.y1 + this.y2 + this.y3) / 4,
    };
    return {
      id: this.id,
      type: 'CubicBezier',
      x0: this.x0 + center.x,
      y0: this.y0 + center.y,
      x1: this.x1 + center.x,
      y1: this.y1 + center.y,
      x2: this.x2 + center.x,
      y2: this.y2 + center.y,
      x3: this.x3 + center.x,
      y3: this.y3 + center.y,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
      flatness: this.flatness,
    };
  }
}
