/**
 * Matrix 3×3 for 2D Affine Transformations
 * 
 * Storage format (row-major):
 * [ m00, m01, m02, m10, m11, m12, m20, m21, m22 ]
 * 
 * For affine transformations, the bottom row is always [0, 0, 1]:
 * [a   b   tx  ]
 * [c   d   ty  ]
 * [0   0   1   ]
 */

export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

export interface Point2D {
  x: number;
  y: number;
}

export const EPS = 1e-10;

export const mat3 = {
  /**
   * Create identity matrix: no transformation applied
   */
  identity(): Mat3 {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  },

  /**
   * Multiply two 3×3 matrices: result = a * b
   * Using three nested loops (r, c, k) for clarity
   */
  multiply(a: Mat3, b: Mat3): Mat3 {
    const result: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          const a_idx = r * 3 + k;
          const b_idx = k * 3 + c;
          sum += a[a_idx] * b[b_idx];
        }
        result[r * 3 + c] = sum;
      }
    }

    return result;
  },

  /**
   * Create translation matrix
   * Shifts object by (tx, ty)
   */
  translate(tx: number, ty: number): Mat3 {
    return [1, 0, tx, 0, 1, ty, 0, 0, 1];
  },

  /**
   * Create scaling matrix
   * Scales object by (sx, sy) relative to origin (0, 0)
   */
  scale(sx: number, sy: number): Mat3 {
    return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
  },

  /**
   * Create rotation matrix
   * Rotates object by angle (in radians) counter-clockwise around origin
   * Formula:
   * [cos(θ)  -sin(θ)  0]
   * [sin(θ)   cos(θ)  0]
   * [0        0       1]
   */
  rotate(rad: number): Mat3 {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
  },

  /**
   * Compose transformation: translate * rotate * scale
   * Applied to a point in order: scale → rotate → translate
   */
  fromTransform(
    tx: number,
    ty: number,
    rotationRad: number,
    sx: number,
    sy: number
  ): Mat3 {
    const T = this.translate(tx, ty);
    const R = this.rotate(rotationRad);
    const S = this.scale(sx, sy);

    // M = T * (R * S)
    const RS = this.multiply(R, S);
    const M = this.multiply(T, RS);

    return M;
  },

  /**
   * Transform a point by a matrix
   * Point is assumed to be in homogeneous coordinates (x, y, 1)
   * Result: {x: m00*x + m01*y + m02, y: m10*x + m11*y + m12}
   */
  transformPoint(m: Mat3, x: number, y: number): Point2D {
    const x_new = m[0] * x + m[1] * y + m[2];
    const y_new = m[3] * x + m[4] * y + m[5];

    return { x: x_new, y: y_new };
  },

  /**
   * Invert an affine 3×3 matrix
   * Returns null if matrix is degenerate (determinant ≈ 0)
   * 
   * For affine matrix:
   * [a  b  tx]
   * [c  d  ty]
   * [0  0  1 ]
   * 
   * Inverse formula:
   * det = a*d - b*c
   * [d/det   -b/det   (b*ty - d*tx)/det]
   * [-c/det   a/det   (c*tx - a*ty)/det]
   * [0        0        1                ]
   */
  invert(m: Mat3): Mat3 | null {
    // Extract linear part
    const a = m[0];
    const b = m[1];
    const tx = m[2];
    const c = m[3];
    const d = m[4];
    const ty = m[5];

    // Compute determinant
    const det = a * d - b * c;

    // Check if matrix is invertible
    if (Math.abs(det) < EPS) {
      return null;
    }

    const invDet = 1.0 / det;

    // Compute inverse matrix
    return [
      d * invDet,
      -b * invDet,
      (b * ty - d * tx) * invDet,
      -c * invDet,
      a * invDet,
      (c * tx - a * ty) * invDet,
      0,
      0,
      1,
    ];
  },
};
