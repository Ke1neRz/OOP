import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Oval (ellipse) shape
 * Stores two radii: rx (horizontal) and ry (vertical)
 */
export class Oval extends Shape {
  rx: number;
  ry: number;
  private pointCount: number = 64; // Number of points for drawing

  constructor(id: string, rx: number = 100, ry: number = 100) {
    super(id);
    this.rx = Math.max(0, rx);
    this.ry = Math.max(0, ry);
  }

  /**
   * Get points on the ellipse using parametric equation
   * x = rx * cos(θ)
   * y = ry * sin(θ)
   */
  private getEllipsePoints(): [number, number][] {
    const points: [number, number][] = [];
    const step = (2 * Math.PI) / this.pointCount;

    for (let i = 0; i < this.pointCount; i++) {
      const theta = i * step;
      const x = this.rx * Math.cos(theta);
      const y = this.ry * Math.sin(theta);
      points.push([x, y]);
    }

    return points;
  }

  /**
   * Draw the oval on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const points = this.getEllipsePoints();
    const screenPoints = points.map(([x, y]) => this.transformPointToDevice(x, y));

    const fillColor = hexToRGBA(this.fillStyle, Math.round(this.fillOpacity * 255));
    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    // Draw filled polygon
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        screenPoints.map((p) => ({ x: p.x, y: p.y })),
        fillColor
      );
    }

    // Draw stroke (outline)
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenPoints.length; i++) {
        const p1 = screenPoints[i];
        const p2 = screenPoints[(i + 1) % screenPoints.length];
        r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
      }
    }
  }

  /**
   * Check if a point hits the oval
   * Algorithm: transform to local coords, check ellipse equation
   * (x / rx)² + (y / ry)² ≤ 1
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);

    if (this.rx === 0 || this.ry === 0) {
      return false;
    }

    const normalizedX = local.x / this.rx;
    const normalizedY = local.y / this.ry;
    const distance = normalizedX * normalizedX + normalizedY * normalizedY;

    return distance <= 1;
  }

  /**
   * Get bounds in device (screen) coordinates
   */
  getBounds(): Bounds {
    const points = this.getEllipsePoints();
    const screenPoints = points.map(([x, y]) => this.transformPointToDevice(x, y));

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

    return { minX, maxX, minY, maxY };
  }

  /**
   * Get bounds in local coordinates
   */
  getLocalBounds(): Bounds {
    return {
      minX: -this.rx,
      maxX: this.rx,
      minY: -this.ry,
      maxY: this.ry,
    };
  }

  /**
   * Create a clone of this oval
   */
  protected createClone(): Shape {
    return new Oval(this.id, this.rx, this.ry);
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    return {
      id: this.id,
      type: 'Oval',
      rx: this.rx,
      ry: this.ry,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
