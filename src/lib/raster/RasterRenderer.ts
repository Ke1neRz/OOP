export type RGBA = { r: number; g: number; b: number; a: number };
export type LineAlg = "bresenham" | "wu";

export function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return v | 0;
}

export function hexToRGBA(hex: string, alpha = 255): RGBA {
  const src = hex.trim().replace(/^#/, "");
  const a = clampByte(alpha);

  if (src.length === 3) {
    const r = parseInt(src[0] + src[0], 16);
    const g = parseInt(src[1] + src[1], 16);
    const b = parseInt(src[2] + src[2], 16);
    if ([r, g, b].some(Number.isNaN)) {
      throw new Error(`Invalid HEX color: ${hex}`);
    }
    return { r, g, b, a };
  }

  if (src.length === 6) {
    const r = parseInt(src.slice(0, 2), 16);
    const g = parseInt(src.slice(2, 4), 16);
    const b = parseInt(src.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) {
      throw new Error(`Invalid HEX color: ${hex}`);
    }
    return { r, g, b, a };
  }

  throw new Error(`Unsupported HEX format: ${hex}`);
}

export class RasterRenderer {
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private buf!: Uint8ClampedArray;

  width = 0;
  height = 0;
  dpr = 1;

  private canvas: HTMLCanvasElement;
  private _onWindowResize: () => void;
  private lineAlg: LineAlg = "bresenham";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No 2D context");
    }
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this._onWindowResize = () => this.resize();
    window.addEventListener("resize", this._onWindowResize);
    this.resize();
  }

  dispose() {
    window.removeEventListener("resize", this._onWindowResize);
  }

  setLineAlgorithm(a: LineAlg) {
    this.lineAlg = a;
  }

  getLineAlgorithm(): LineAlg {
    return this.lineAlg;
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    if (this.lineAlg === "wu") {
      this.drawLineWu(x0, y0, x1, y1, color);
    } else {
      this.drawLineBrassenham(x0, y0, x1, y1, color);
    }
  }

  private idx(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  setPixel(x: number, y: number, color: RGBA) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) {
      return;
    }

    const i = this.idx(xi, yi);
    this.buf[i] = clampByte(color.r);
    this.buf[i + 1] = clampByte(color.g);
    this.buf[i + 2] = clampByte(color.b);
    this.buf[i + 3] = clampByte(color.a);
  }

  private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) {
      return;
    }

    const i = this.idx(xi, yi);

    const srcA = (clampByte(color.a) / 255) * Math.max(0, Math.min(1, alphaFactor));
    if (srcA <= 0) {
      return;
    }

    const srcR = clampByte(color.r) / 255;
    const srcG = clampByte(color.g) / 255;
    const srcB = clampByte(color.b) / 255;

    const dstR = this.buf[i] / 255;
    const dstG = this.buf[i + 1] / 255;
    const dstB = this.buf[i + 2] / 255;
    const dstA = this.buf[i + 3] / 255;

    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) {
      this.buf[i] = 0;
      this.buf[i + 1] = 0;
      this.buf[i + 2] = 0;
      this.buf[i + 3] = 0;
      return;
    }

    const outR = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
    const outG = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
    const outB = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;

    this.buf[i] = clampByte(outR * 255);
    this.buf[i + 1] = clampByte(outG * 255);
    this.buf[i + 2] = clampByte(outB * 255);
    this.buf[i + 3] = clampByte(outA * 255);
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;

    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 1));
    const cssH = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 1));

    const w = Math.max(1, Math.round(cssW * this.dpr));
    const h = Math.max(1, Math.round(cssH * this.dpr));

    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    this.width = w;
    this.height = h;
    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.buf = this.imageData.data;
  }

  beginFrame(clear = true) {
    if (!this.imageData) {
      this.resize();
    }
    if (clear) {
      this.buf.fill(0);
    }
  }

  commit() {
    if (!this.imageData) {
      return;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    let xStart = Math.round(x0);
    let yStart = Math.round(y0);
    const xEnd = Math.round(x1);
    const yEnd = Math.round(y1);

    const dx = Math.abs(xEnd - xStart);
    const sx = xStart < xEnd ? 1 : -1;
    const dy = -Math.abs(yEnd - yStart);
    const sy = yStart < yEnd ? 1 : -1;

    let err = dx + dy;

    while (true) {
      this.setPixel(xStart, yStart, color);
      if (xStart === xEnd && yStart === yEnd) {
        break;
      }
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        xStart += sx;
      }
      if (e2 <= dx) {
        err += dx;
        yStart += sy;
      }
    }
  }

  drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    const ipart = Math.floor;
    const fpart = (x: number) => x - ipart(x);
    const rfpart = (x: number) => 1 - fpart(x);

    const plotBlend = (x: number, y: number, alpha: number) => {
      this.blendPixel(x, y, color, alpha);
    };

    let x0f = x0;
    let y0f = y0;
    let x1f = x1;
    let y1f = y1;

    const steep = Math.abs(y1f - y0f) > Math.abs(x1f - x0f);

    if (steep) {
      [x0f, y0f] = [y0f, x0f];
      [x1f, y1f] = [y1f, x1f];
    }

    if (x0f > x1f) {
      [x0f, x1f] = [x1f, x0f];
      [y0f, y1f] = [y1f, y0f];
    }

    const dx = x1f - x0f;
    const dy = y1f - y0f;

    const gradient = dx === 0 ? 1 : dy / dx;

    // Рисуем первый конец линии
    const xend0 = Math.round(x0f);
    const yend0 = y0f + gradient * (xend0 - x0f);
    const xgap0 = rfpart(x0f + 0.5);
    const ypxl0 = ipart(yend0);

    if (steep) {
      plotBlend(ypxl0, xend0, rfpart(yend0) * xgap0);
      plotBlend(ypxl0 + 1, xend0, fpart(yend0) * xgap0);
    } else {
      plotBlend(xend0, ypxl0, rfpart(yend0) * xgap0);
      plotBlend(xend0, ypxl0 + 1, fpart(yend0) * xgap0);
    }

    let intery = yend0 + gradient;

    // Рисуем второй конец линии
    const xend1 = Math.round(x1f);
    const yend1 = y1f + gradient * (xend1 - x1f);
    const xgap1 = fpart(x1f + 0.5);
    const ypxl1 = ipart(yend1);

    if (steep) {
      plotBlend(ypxl1, xend1, rfpart(yend1) * xgap1);
      plotBlend(ypxl1 + 1, xend1, fpart(yend1) * xgap1);
    } else {
      plotBlend(xend1, ypxl1, rfpart(yend1) * xgap1);
      plotBlend(xend1, ypxl1 + 1, fpart(yend1) * xgap1);
    }

    // Рисуем основную часть линии
    if (steep) {
      for (let x = xend0 + 1; x < xend1; x++) {
        const ypx = ipart(intery);
        plotBlend(ypx, x, rfpart(intery));
        plotBlend(ypx + 1, x, fpart(intery));
        intery += gradient;
      }
    } else {
      for (let x = xend0 + 1; x < xend1; x++) {
        const ypx = ipart(intery);
        plotBlend(x, ypx, rfpart(intery));
        plotBlend(x, ypx + 1, fpart(intery));
        intery += gradient;
      }
    }
  }

  private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
    const yi = Math.round(y);
    if (yi < 0 || yi >= this.height) {
      return;
    }

    let xs = Math.round(Math.min(x0, x1));
    let xe = Math.round(Math.max(x0, x1));

    if (xe < 0 || xs >= this.width) {
      return;
    }

    xs = Math.max(0, xs);
    xe = Math.min(this.width - 1, xe);

    let i = this.idx(xs, yi);
    const r = clampByte(color.r);
    const g = clampByte(color.g);
    const b = clampByte(color.b);
    const a = clampByte(color.a);

    for (let x = xs; x <= xe; x++) {
      this.buf[i] = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
      this.buf[i + 3] = a;
      i += 4;
    }
  }

  private drawHSpanBlended(y: number, x0: number, x1: number, color: RGBA) {
    const yi = Math.round(y);
    if (yi < 0 || yi >= this.height) {
      return;
    }

    let xs = Math.round(Math.min(x0, x1));
    let xe = Math.round(Math.max(x0, x1));

    if (xe < 0 || xs >= this.width) {
      return;
    }

    xs = Math.max(0, xs);
    xe = Math.min(this.width - 1, xe);

    for (let x = xs; x <= xe; x++) {
      this.blendPixel(x, yi, color, 1.0);
    }
  }

  fillPolygon(points: { x: number; y: number }[], color: RGBA, blend = false) {
    if (points.length < 3) {
      return;
    }

    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const yStart = Math.floor(minY);
    const yEnd = Math.ceil(maxY);

    const drawSpan = blend ? 
      (y: number, x0: number, x1: number) => this.drawHSpanBlended(y, x0, x1, color) :
      (y: number, x0: number, x1: number) => this.drawHSpan(y, x0, x1, color);

    for (let y = yStart; y <= yEnd; y++) {
      const scanY = y + 0.5;
      const intersections: number[] = [];

      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        const y1 = p1.y;
        const y2 = p2.y;

        if (y1 === y2) {
          continue;
        }

        const intersects = (scanY >= Math.min(y1, y2)) && (scanY < Math.max(y1, y2));
        if (!intersects) {
          continue;
        }

        const t = (scanY - y1) / (y2 - y1);
        const x = p1.x + t * (p2.x - p1.x);
        intersections.push(x);
      }

      intersections.sort((a, b) => a - b);

      for (let i = 0; i + 1 < intersections.length; i += 2) {
        drawSpan(y, intersections[i], intersections[i + 1]);
      }
    }
  }

  fillCircle(cx: number, cy: number, radius: number, color: RGBA, blend = false) {
    const r = Math.max(0, radius);
    const yStart = Math.ceil(cy - r);
    const yEnd = Math.floor(cy + r);

    const drawSpan = blend ?
      (y: number, x0: number, x1: number) => this.drawHSpanBlended(y, x0, x1, color) :
      (y: number, x0: number, x1: number) => this.drawHSpan(y, x0, x1, color);

    for (let y = yStart; y <= yEnd; y++) {
      const dy = y - cy;
      const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
      drawSpan(y, cx - dx, cx + dx);
    }
  }

  strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
    const w = Math.max(1, width);

    if (w <= 1) {
      this.drawLine(x0, y0, x1, y1, color);
      return;
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);

    if (len === 0) {
      this.fillCircle(x0, y0, w / 2, color);
      return;
    }

    const nx = -dy / len;
    const ny = dx / len;
    const half = w / 2;

    const p1 = { x: x0 + nx * half, y: y0 + ny * half };
    const p2 = { x: x0 - nx * half, y: y0 - ny * half };
    const p3 = { x: x1 - nx * half, y: y1 - ny * half };
    const p4 = { x: x1 + nx * half, y: y1 + ny * half };

    this.fillPolygon([p1, p2, p3, p4], color);
    this.fillCircle(x0, y0, half, color);
    this.fillCircle(x1, y1, half, color);
  }

  strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1) {
    if (points.length < 2) {
      return;
    }

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.strokeLine(a.x, a.y, b.x, b.y, color, width);
    }
  }
}
