import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Rectangle shape
 * Stores width and height, centered at origin in local coordinates
 */
export class Rect extends Shape {
  width: number;
  height: number;

  constructor(id: string, width: number = 100, height: number = 100) {
    super(id);
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
  }

  /**
   * Get the four corners of the rectangle in local coordinates
   */
  private getLocalCorners(): [number, number][] {
    const w2 = this.width / 2;
    const h2 = this.height / 2;
    return [
      [-w2, -h2],
      [w2, -h2],
      [w2, h2],
      [-w2, h2],
    ];
  }

  /**
   * Draw the rectangle on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const corners = this.getLocalCorners();
    const screenCorners = corners.map(([x, y]) => this.transformPointToDevice(x, y));

    // Get colors with opacity
    const fillColor = hexToRGBA(this.fillStyle, Math.round(this.fillOpacity * 255));
    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    // Draw filled polygon
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        screenCorners.map((p) => ({ x: p.x, y: p.y })),
        fillColor
      );
    }

    // Draw stroke (outline)
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenCorners.length; i++) {
        const p1 = screenCorners[i];
        const p2 = screenCorners[(i + 1) % screenCorners.length];
        r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
      }
    }
  }

  /**
   * Check if a point hits the rectangle
   * Algorithm: transform point to local coords, check if within [-w/2, w/2] and [-h/2, h/2]
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);
    const w2 = this.width / 2;
    const h2 = this.height / 2;

    return local.x >= -w2 && local.x <= w2 && local.y >= -h2 && local.y <= h2;
  }

  /**
   * Get bounds in device (screen) coordinates
   */
  getBounds(): Bounds {
    const corners = this.getLocalCorners();
    const screenCorners = corners.map(([x, y]) => this.transformPointToDevice(x, y));

    let minX = screenCorners[0].x;
    let maxX = screenCorners[0].x;
    let minY = screenCorners[0].y;
    let maxY = screenCorners[0].y;

    for (const corner of screenCorners) {
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Get bounds in local coordinates
   */
  getLocalBounds(): Bounds {
    const w2 = this.width / 2;
    const h2 = this.height / 2;

    return {
      minX: -w2,
      maxX: w2,
      minY: -h2,
      maxY: h2,
    };
  }

  /**
   * Create a clone of this rectangle
   */
  protected createClone(): Shape {
    return new Rect(this.id, this.width, this.height);
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    return {
      id: this.id,
      type: 'Rect',
      width: this.width,
      height: this.height,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
