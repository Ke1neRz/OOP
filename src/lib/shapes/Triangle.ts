import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

/**
 * Triangle shape
 * Stores three vertices, centered at their geometric center in local coordinates
 */
export class Triangle extends Shape {
  // Vertices in local coordinates (relative to center)
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  centerX: number;
  centerY: number;

  constructor(
    id: string,
    x1: number = -50,
    y1: number = -50,
    x2: number = 50,
    y2: number = -50,
    x3: number = 0,
    y3: number = 50
  ) {
    super(id);

    // Calculate the center of the triangle
    const cx = (x1 + x2 + x3) / 3;
    const cy = (y1 + y2 + y3) / 3;
    this.centerX = cx;
    this.centerY = cy;

    // Store vertices relative to center (in local coordinates)
    this.x1 = x1 - cx;
    this.y1 = y1 - cy;
    this.x2 = x2 - cx;
    this.y2 = y2 - cy;
    this.x3 = x3 - cx;
    this.y3 = y3 - cy;
  }

  /**
   * Get the three vertices in local coordinates
   */
  private getLocalVertices(): [number, number][] {
    return [
      [this.x1, this.y1],
      [this.x2, this.y2],
      [this.x3, this.y3],
    ];
  }

  /**
   * Draw the triangle on the raster renderer
   */
  drawRaster(r: RasterRenderer): void {
    const vertices = this.getLocalVertices();
    const screenVertices = vertices.map(([x, y]) => this.transformPointToDevice(x, y));

    const fillColor = hexToRGBA(this.fillStyle, Math.round(this.fillOpacity * 255));
    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    // Draw filled triangle
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        screenVertices.map((p) => ({ x: p.x, y: p.y })),
        fillColor
      );
    }

    // Draw stroke (outline)
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenVertices.length; i++) {
        const p1 = screenVertices[i];
        const p2 = screenVertices[(i + 1) % screenVertices.length];
        r.drawLine(p1.x, p1.y, p2.x, p2.y, strokeColor);
      }
    }
  }

  /**
   * Check if a point hits the triangle using the sign of cross product method
   * A point is inside the triangle if it's on the same side of all three edges
   */
  hitTest(px: number, py: number): boolean {
    const local = this.transformPointToLocal(px, py);
    
    // Use barycentric coordinate method for better accuracy
    const x = local.x;
    const y = local.y;
    
    const v0x = this.x3 - this.x1;
    const v0y = this.y3 - this.y1;
    const v1x = this.x2 - this.x1;
    const v1y = this.y2 - this.y1;
    const v2x = x - this.x1;
    const v2y = y - this.y1;
    
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    
    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    const EPS = 1e-9;
    return (u >= -EPS) && (v >= -EPS) && (u + v <= 1 + EPS);
  }

  /**
   * Get bounds in device (screen) coordinates
   */
  getBounds(): Bounds {
    const vertices = this.getLocalVertices();
    const screenVertices = vertices.map(([x, y]) => this.transformPointToDevice(x, y));

    let minX = screenVertices[0].x;
    let maxX = screenVertices[0].x;
    let minY = screenVertices[0].y;
    let maxY = screenVertices[0].y;

    for (const vertex of screenVertices) {
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Get bounds in local coordinates
   */
  getLocalBounds(): Bounds {
    const xs = [this.x1, this.x2, this.x3];
    const ys = [this.y1, this.y2, this.y3];
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return { minX, maxX, minY, maxY };
  }

  /**
   * Create a clone of this triangle
   */
  protected createClone(): Shape {
    return new Triangle(
      this.id,
      this.x1 + this.centerX,
      this.y1 + this.centerY,
      this.x2 + this.centerX,
      this.y2 + this.centerY,
      this.x3 + this.centerX,
      this.y3 + this.centerY
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ShapeJSON {
    return {
      id: this.id,
      type: 'Triangle',
      x1: this.x1 + this.centerX,
      y1: this.y1 + this.centerY,
      x2: this.x2 + this.centerX,
      y2: this.y2 + this.centerY,
      x3: this.x3 + this.centerX,
      y3: this.y3 + this.centerY,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
