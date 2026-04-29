import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Line shape
 * Stores two endpoints and centers them around the midpoint
 */
export class Line extends Shape {
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  constructor(id: string, x1: number = 0, y1: number = 0, x2: number = 100, y2: number = 0) {
    super(id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.centerLine();
  }

  /**
   * Center the line around its midpoint
   * Stores points as offsets relative to the center
   */
  private centerLine(): void {
    const centerX = (this.x1 + this.x2) / 2;
    const centerY = (this.y1 + this.y2) / 2;

    this.x1 -= centerX;
    this.y1 -= centerY;
    this.x2 -= centerX;
    this.y2 -= centerY;

    this.transform.x = centerX;
    this.transform.y = centerY;
    this.invalidateMatrices();
  }

  /**
   * Get the two endpoints of the line in local coordinates
   */
  private getLocalEndpoints(): [[number, number], [number, number]] {
    return [
      [this.x1, this.y1],
      [this.x2, this.y2],
    ];
  }

  /**
   * Calculate the distance from a point to a line segment
   * Uses projection algorithm
   */
  private distanceToSegment(px: number, py: number): number {
    const x1 = this.x1;
    const y1 = this.y1;
    const x2 = this.x2;
    const y2 = this.y2;

    // Vector from P1 to P2
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Vector from P1 to P
    const px1 = px - x1;
    const py1 = py - y1;

    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // P1 and P2 are the same point
      return Math.sqrt(px1 * px1 + py1 * py1);
    }

    // Project P onto the line segment, clamped to [0, 1]
    let t = (px1 * dx + py1 * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    // Closest point on segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Distance from P to closest point
    const distX = px - closestX;
    const distY = py - closestY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  /**
   * Draw the line on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const endpoints = this.getLocalEndpoints();
    const p1 = this.transformPointToDevice(endpoints[0][0], endpoints[0][1]);
    const p2 = this.transformPointToDevice(endpoints[1][0], endpoints[1][1]);

    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
  }

  /**
   * Check if a point hits the line
   * Uses distance threshold based on stroke width
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);
    const distance = this.distanceToSegment(local.x, local.y);

    // Allow hit within stroke width (or minimum of 5 pixels)
    const threshold = Math.max(this.strokeWidth / 2, 5);

    return distance <= threshold;
  }

  /**
   * Get bounds in device (screen) coordinates
   */
  getBounds(): Bounds {
    const endpoints = this.getLocalEndpoints();
    const p1 = this.transformPointToDevice(endpoints[0][0], endpoints[0][1]);
    const p2 = this.transformPointToDevice(endpoints[1][0], endpoints[1][1]);

    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    // Add padding for stroke width
    const padding = this.strokeWidth / 2;

    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
  }

  /**
   * Get bounds in local coordinates
   */
  getLocalBounds(): Bounds {
    const x1 = Math.min(this.x1, this.x2);
    const x2 = Math.max(this.x1, this.x2);
    const y1 = Math.min(this.y1, this.y2);
    const y2 = Math.max(this.y1, this.y2);

    const padding = this.strokeWidth / 2;

    return {
      minX: x1 - padding,
      maxX: x2 + padding,
      minY: y1 - padding,
      maxY: y2 + padding,
    };
  }

  /**
   * Create a clone of this line
   */
  protected createClone(): Shape {
    return new Line(this.id, this.x1, this.y1, this.x2, this.y2);
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    return {
      id: this.id,
      type: 'Line',
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
