import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Path segment definition
 */
export interface PathSegment {
  type: 'line' | 'quadratic' | 'cubic';
  // For all: start point is implicit (end of previous segment)
  // line: just needs end point
  // quadratic: control point and end point
  // cubic: two control points and end point
  points: [number, number][]; // 1 for line, 2 for quadratic, 3 for cubic
}

/**
 * PathBezier - A composite path that can contain multiple curve segments
 * Supports lines, quadratic, and cubic Bezier curves
 */
export class PathBezier extends Shape {
  // List of path segments
  segments: PathSegment[] = [];
  
  // Starting point for the path
  startX: number = -50;
  startY: number = 0;

  constructor(id: string, startX: number = -50, startY: number = 0) {
    super(id);
    this.startX = startX;
    this.startY = startY;
    this.strokeWidth = 2; // Default stroke for paths
    this.fillOpacity = 0; // Paths are not filled by default
  }

  /**
   * Add a line segment
   */
  addLine(x: number, y: number): PathBezier {
    this.segments.push({
      type: 'line',
      points: [[x, y]],
    });
    return this;
  }

  /**
   * Add a quadratic Bezier segment
   */
  addQuadratic(cx: number, cy: number, x: number, y: number): PathBezier {
    this.segments.push({
      type: 'quadratic',
      points: [[cx, cy], [x, y]],
    });
    return this;
  }

  /**
   * Add a cubic Bezier segment
   */
  addCubic(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): PathBezier {
    this.segments.push({
      type: 'cubic',
      points: [[c1x, c1y], [c2x, c2y], [x, y]],
    });
    return this;
  }

  /**
   * Get all points along the path for rendering
   */
  private getPathPoints(resolution: number = 50): [number, number][] {
    const points: [number, number][] = [];
    let currentX = this.startX;
    let currentY = this.startY;

    points.push([currentX, currentY]);

    for (const segment of this.segments) {
      if (segment.type === 'line') {
        const [x, y] = segment.points[0];
        points.push([x, y]);
        currentX = x;
        currentY = y;
      } else if (segment.type === 'quadratic') {
        const [cx, cy] = segment.points[0];
        const [x, y] = segment.points[1];
        
        const segPoints = this.getQuadraticSegmentPoints(currentX, currentY, cx, cy, x, y, resolution);
        for (let i = 1; i < segPoints.length; i++) {
          points.push(segPoints[i]);
        }
        
        currentX = x;
        currentY = y;
      } else if (segment.type === 'cubic') {
        const [c1x, c1y] = segment.points[0];
        const [c2x, c2y] = segment.points[1];
        const [x, y] = segment.points[2];
        
        const segPoints = this.getCubicSegmentPoints(currentX, currentY, c1x, c1y, c2x, c2y, x, y, resolution);
        for (let i = 1; i < segPoints.length; i++) {
          points.push(segPoints[i]);
        }
        
        currentX = x;
        currentY = y;
      }
    }

    return points;
  }

  /**
   * Get points for a quadratic Bezier segment
   */
  private getQuadraticSegmentPoints(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x: number,
    y: number,
    resolution: number
  ): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;

      const px = mt2 * x0 + 2 * mt * t * cx + t2 * x;
      const py = mt2 * y0 + 2 * mt * t * cy + t2 * y;

      points.push([px, py]);
    }
    return points;
  }

  /**
   * Get points for a cubic Bezier segment
   */
  private getCubicSegmentPoints(
    x0: number,
    y0: number,
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
    resolution: number
  ): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;

      const px = mt3 * x0 + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t3 * x;
      const py = mt3 * y0 + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t3 * y;

      points.push([px, py]);
    }
    return points;
  }

  /**
   * Draw the path on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const resolution = Math.max(30, Math.min(100, Math.ceil(Math.sqrt(
      (this.startX) ** 2 + (this.startY) ** 2
    ) * 2)));

    const pathPoints = this.getPathPoints(resolution);
    const screenPoints = pathPoints.map(([x, y]) => this.transformPointToDevice(x, y));

    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    // Draw the path as a series of lines
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const p1 = screenPoints[i];
        const p2 = screenPoints[i + 1];
        r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
      }
    }
  }

  /**
   * Check if a point is near the path
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);
    const tolerance = this.strokeWidth + 2;

    const resolution = 50;
    const pathPoints = this.getPathPoints(resolution);

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const [x1, y1] = pathPoints[i];
      const [x2, y2] = pathPoints[i + 1];

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
    const resolution = 50;
    const pathPoints = this.getPathPoints(resolution);
    const screenPoints = pathPoints.map(([x, y]) => this.transformPointToDevice(x, y));

    if (screenPoints.length === 0) {
      const pt = this.transformPointToDevice(0, 0);
      return { minX: pt.x, maxX: pt.x, minY: pt.y, maxY: pt.y };
    }

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
    const xs = [this.startX];
    const ys = [this.startY];

    for (const segment of this.segments) {
      for (const [x, y] of segment.points) {
        xs.push(x);
        ys.push(y);
      }
    }

    if (xs.length === 0) xs.push(0);
    if (ys.length === 0) ys.push(0);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  /**
   * Create a clone of this path
   */
  protected createClone(): Shape {
    const cloned = new PathBezier(this.id, this.startX, this.startY);
    cloned.segments = this.segments.map(seg => ({
      type: seg.type,
      points: seg.points.map(p => [...p] as [number, number]),
    }));
    return cloned;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    return {
      id: this.id,
      type: 'PathBezier',
      startX: this.startX,
      startY: this.startY,
      segments: this.segments.map(seg => ({
        type: seg.type,
        points: seg.points,
      })),
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
