import { Mat3, mat3, Point2D } from '../math/mat3';
import { RasterRenderer } from '../raster/RasterRenderer';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface ShapeJSON {
  id: string;
  transform: Transform;
  fillStyle: string;
  fillOpacity: number;
  strokeStyle: string;
  strokeWidth: number;
  strokeOpacity: number;
  type: string;
  [key: string]: any;
}

/**
 * Base abstract class for all geometric shapes
 * Handles common transformation and styling logic
 */
export abstract class Shape {
  id: string;
  transform: Transform;
  fillStyle: string;
  fillOpacity: number;
  strokeStyle: string;
  strokeWidth: number;
  strokeOpacity: number;

  private localToDeviceMatrix: Mat3 | null = null;
  private deviceToLocalMatrix: Mat3 | null = null;

  constructor(id: string) {
    this.id = id;
    this.transform = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.fillStyle = '#000000';
    this.fillOpacity = 1;
    this.strokeStyle = '#000000';
    this.strokeWidth = 1;
    this.strokeOpacity = 1;
  }

  /**
   * Get the local to device transformation matrix
   * Converts from shape's local coordinates to screen coordinates
   */
  getLocalToDeviceMatrix(): Mat3 {
    if (this.localToDeviceMatrix === null) {
      this.localToDeviceMatrix = mat3.fromTransform(
        this.transform.x,
        this.transform.y,
        this.transform.rotation,
        this.transform.scaleX,
        this.transform.scaleY
      );
    }
    return this.localToDeviceMatrix;
  }

  /**
   * Get the device to local transformation matrix
   * Converts from screen coordinates to shape's local coordinates
   */
  getDeviceToLocalMatrix(): Mat3 {
    if (this.deviceToLocalMatrix === null) {
      const localToDevice = this.getLocalToDeviceMatrix();
      const inverted = mat3.invert(localToDevice);
      if (inverted === null) {
        throw new Error('Cannot invert transformation matrix');
      }
      this.deviceToLocalMatrix = inverted;
    }
    return this.deviceToLocalMatrix;
  }

  /**
   * Transform a point from local coordinates to device (screen) coordinates
   */
  transformPointToDevice(px: number, py: number): Point2D {
    const matrix = this.getLocalToDeviceMatrix();
    return mat3.transformPoint(matrix, px, py);
  }

  /**
   * Transform a point from device (screen) coordinates to local coordinates
   */
  transformPointToLocal(px: number, py: number): Point2D {
    const matrix = this.getDeviceToLocalMatrix();
    return mat3.transformPoint(matrix, px, py);
  }

  /**
   * Get the center of the shape based on its bounds
   */
  getCenter(): Point2D {
    const bounds = this.getBounds();
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  /**
   * Resize the shape from device (screen) bounds
   * This updates the transform to fit the new bounds
   */
  resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
    const localBounds = this.getLocalBounds();
    
    // Calculate new scale
    const localWidth = localBounds.maxX - localBounds.minX;
    const localHeight = localBounds.maxY - localBounds.minY;
    const deviceWidth = maxX - minX;
    const deviceHeight = maxY - minY;

    const newScaleX = localWidth !== 0 ? deviceWidth / localWidth : 1;
    const newScaleY = localHeight !== 0 ? deviceHeight / localHeight : 1;

    // Calculate new position (center of device bounds)
    const newX = (minX + maxX) / 2;
    const newY = (minY + maxY) / 2;

    // Update transform
    this.transform.x = newX;
    this.transform.y = newY;
    this.transform.scaleX = newScaleX;
    this.transform.scaleY = newScaleY;

    // Invalidate cached matrices
    this.localToDeviceMatrix = null;
    this.deviceToLocalMatrix = null;
  }

  /**
   * Set bounds of the shape (wrapper for resizeFromDeviceAABB)
   */
  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
  }

  /**
   * Invalidate cached matrices when transform changes
   */
  public invalidateMatrices(): void {
    this.localToDeviceMatrix = null;
    this.deviceToLocalMatrix = null;
  }

  /**
   * Clone the shape with the same parameters
   */
  clone(): Shape {
    const cloned = this.createClone();
    cloned.id = this.id;
    cloned.transform = { ...this.transform };
    cloned.fillStyle = this.fillStyle;
    cloned.fillOpacity = this.fillOpacity;
    cloned.strokeStyle = this.strokeStyle;
    cloned.strokeWidth = this.strokeWidth;
    cloned.strokeOpacity = this.strokeOpacity;
    return cloned;
  }

  /**
   * Create a clone of the shape (to be implemented by subclasses)
   * Subclasses should override this to properly clone their specific data
   */
  protected abstract createClone(): Shape;

  /**
   * Draw the shape on the raster renderer
   * Must be implemented by subclasses
   */
  abstract drawRaster(r: RasterRenderer): void;

  /**
   * Check if a point hits the shape
   * Must be implemented by subclasses
   */
  abstract hitTest(px: number, py: number): boolean;

  /**
   * Get the bounds of the shape in device (screen) coordinates
   * Must be implemented by subclasses
   */
  abstract getBounds(): Bounds;

  /**
   * Get the bounds of the shape in local coordinates
   * Must be implemented by subclasses
   */
  abstract getLocalBounds(): Bounds;

  /**
   * Serialize the shape to JSON
   * Must be implemented by subclasses
   */
  abstract toJSON(): ShapeJSON;
}
