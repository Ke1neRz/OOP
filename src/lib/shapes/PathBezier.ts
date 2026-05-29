import { Shape, Bounds, ShapeJSON } from './Shape';
import { RasterRenderer, hexToRGBA } from '../raster/RasterRenderer';

export type PathMode = 'polyline' | 'bezier' | 'catmull';

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathBezierJSON extends ShapeJSON {
  anchors: PathPoint[];
  mode: PathMode;
  closed: boolean;
}

/**
 * PathBezier — составной путь, поддерживающий:
 *  - polyline   : ломаная по опорным точкам
 *  - bezier     : цепочка кубических сегментов Безье (4 точки на сегмент,
 *                 конец предыдущего = начало следующего)
 *  - catmull    : Catmull-Rom сплайн, автоматически преобразуемый
 *                 в кубические Безье-сегменты
 */
export class PathBezier extends Shape {
  anchors: PathPoint[] = [];
  mode: PathMode = 'polyline';
  closed: boolean = false;
  flatness: number;

  constructor(
    id: string,
    anchors: PathPoint[] = [],
    mode: PathMode = 'polyline',
    closed: boolean = false,
    flatness: number = 1
  ) {
    super(id);
    this.anchors = anchors.map((p) => ({ ...p }));
    this.mode = mode;
    this.closed = closed;
    this.flatness = flatness;
    this.strokeWidth = 2;
    this.fillOpacity = 0;
  }

  // ───────────────────────────────────────────────
  //  Редактирование опорных точек
  // ───────────────────────────────────────────────

  getControlPoints(): PathPoint[] {
    return this.anchors.map((p) => ({ ...p }));
  }

  setControlPoint(idx: number, localPt: PathPoint): void {
    if (idx >= 0 && idx < this.anchors.length) {
      this.anchors[idx] = { ...localPt };
    }
  }

  addPointLocal(localPt: PathPoint, insertAtIndex?: number): void {
    if (insertAtIndex === undefined || insertAtIndex >= this.anchors.length) {
      this.anchors.push({ ...localPt });
    } else {
      this.anchors.splice(insertAtIndex, 0, { ...localPt });
    }
  }

  removePoint(index: number): void {
    if (index >= 0 && index < this.anchors.length) {
      this.anchors.splice(index, 1);
    }
  }

  /**
   * Аппроксимировать путь ломаной и вернуть точки в экранных координатах.
   */
  flattenDevicePoints(resolution?: number): { x: number; y: number }[] {
    const local = this.flattenLocal(resolution);
    return local.map(([x, y]) => this.transformPointToDevice(x, y));
  }

  /**
   * Вычислить точку на кривой в локальных координатах для параметра t ∈ [0, 1].
   * t = 0 → начало пути, t = 1 → конец пути.
   */
  evalLocal(t: number): PathPoint {
    if (this.anchors.length === 0) return { x: 0, y: 0 };
    if (this.anchors.length === 1) return { ...this.anchors[0] };

    const tClamped = Math.max(0, Math.min(1, t));

    if (this.mode === 'polyline') {
      const pts = this.closed ? [...this.anchors, this.anchors[0]] : this.anchors;
      const segCount = pts.length - 1;
      if (segCount <= 0) return { ...pts[0] };
      const seg = Math.min(Math.floor(tClamped * segCount), segCount - 1);
      const localT = tClamped * segCount - seg;
      const a = pts[seg];
      const b = pts[seg + 1];
      return { x: a.x + (b.x - a.x) * localT, y: a.y + (b.y - a.y) * localT };
    }

    // Для bezier и catmull считаем сегменты кубических кривых
    let segCount = 0;
    if (this.mode === 'bezier') {
      segCount = Math.max(0, Math.floor((this.anchors.length - 1) / 3));
    } else if (this.mode === 'catmull') {
      if (this.closed) {
        segCount = this.anchors.length;
      } else {
        segCount = Math.max(0, this.anchors.length - 1);
      }
    }

    if (segCount === 0) return { ...this.anchors[0] };

    const seg = Math.min(Math.floor(tClamped * segCount), segCount - 1);
    const localT = tClamped * segCount - seg;

    if (this.mode === 'bezier') {
      const i = seg * 3;
      const [x0, y0, x1, y1, x2, y2, x3, y3] = [
        this.anchors[i].x, this.anchors[i].y,
        this.anchors[i + 1].x, this.anchors[i + 1].y,
        this.anchors[i + 2].x, this.anchors[i + 2].y,
        this.anchors[i + 3].x, this.anchors[i + 3].y,
      ];
      const [px, py] = this.evalCubic(x0, y0, x1, y1, x2, y2, x3, y3, localT);
      return { x: px, y: py };
    }

    // catmull
    const n = this.anchors.length;
    if (this.closed) {
      const p0 = this.anchors[(seg - 1 + n) % n];
      const p1 = this.anchors[seg % n];
      const p2 = this.anchors[(seg + 1) % n];
      const p3 = this.anchors[(seg + 2) % n];
      const bez = this.catmullSegmentToBezier(p0, p1, p2, p3);
      const [px, py] = this.evalCubic(
        bez.b0.x, bez.b0.y,
        bez.b1.x, bez.b1.y,
        bez.b2.x, bez.b2.y,
        bez.b3.x, bez.b3.y,
        localT
      );
      return { x: px, y: py };
    } else {
      const p0 = seg > 0 ? this.anchors[seg - 1] : this.anchors[seg];
      const p1 = this.anchors[seg];
      const p2 = this.anchors[seg + 1];
      const p3 = seg + 2 < n ? this.anchors[seg + 2] : this.anchors[seg + 1];
      const bez = this.catmullSegmentToBezier(p0, p1, p2, p3);
      const [px, py] = this.evalCubic(
        bez.b0.x, bez.b0.y,
        bez.b1.x, bez.b1.y,
        bez.b2.x, bez.b2.y,
        bez.b3.x, bez.b3.y,
        localT
      );
      return { x: px, y: py };
    }
  }

  /**
   * Преобразовать текущие опорные точки в массив кубических сегментов Безье
   * по правилам Catmull-Rom (независимо от текущего mode).
   */
  catmullToBeziers(): { b0: PathPoint; b1: PathPoint; b2: PathPoint; b3: PathPoint }[] {
    const n = this.anchors.length;
    if (n < 2) return [];
    const segs: { b0: PathPoint; b1: PathPoint; b2: PathPoint; b3: PathPoint }[] = [];
    if (this.closed) {
      for (let i = 0; i < n; i++) {
        const p0 = this.anchors[(i - 1 + n) % n];
        const p1 = this.anchors[i];
        const p2 = this.anchors[(i + 1) % n];
        const p3 = this.anchors[(i + 2) % n];
        segs.push(this.catmullSegmentToBezier(p0, p1, p2, p3));
      }
    } else {
      for (let i = 0; i < n - 1; i++) {
        const p0 = i > 0 ? this.anchors[i - 1] : this.anchors[i];
        const p1 = this.anchors[i];
        const p2 = this.anchors[i + 1];
        const p3 = i + 2 < n ? this.anchors[i + 2] : this.anchors[i + 1];
        segs.push(this.catmullSegmentToBezier(p0, p1, p2, p3));
      }
    }
    return segs;
  }

  // ───────────────────────────────────────────────
  //  Построение аппроксимирующей ломаной
  // ───────────────────────────────────────────────

  /**
   * Возвращает набор точек в локальных координатах, которые аппроксимируют
   * путь с заданным разрешением (число отрезков на сегмент).
   */
  private flattenLocal(resolution?: number): [number, number][] {
    if (this.anchors.length < 2) {
      return this.anchors.map((p) => [p.x, p.y] as [number, number]);
    }

    let res = resolution ?? this.computeResolution();
    res = Math.max(4, res);

    switch (this.mode) {
      case 'polyline':
        return this.flattenPolyline();
      case 'bezier':
        return this.flattenBezier(res);
      case 'catmull':
        return this.flattenCatmull(res);
      default:
        return this.flattenPolyline();
    }
  }

  private computeResolution(): number {
    let totalChord = 0;
    for (let i = 0; i < this.anchors.length - 1; i++) {
      const a = this.anchors[i];
      const b = this.anchors[i + 1];
      totalChord += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (this.closed && this.anchors.length > 1) {
      const a = this.anchors[this.anchors.length - 1];
      const b = this.anchors[0];
      totalChord += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return Math.max(20, Math.min(100, Math.ceil(totalChord / this.flatness)));
  }

  private flattenPolyline(): [number, number][] {
    const pts: [number, number][] = this.anchors.map((p) => [p.x, p.y]);
    if (this.closed && pts.length > 2) {
      pts.push([this.anchors[0].x, this.anchors[0].y]);
    }
    return pts;
  }

  private flattenBezier(resolution: number): [number, number][] {
    const pts: [number, number][] = [];
    const n = this.anchors.length;
    // Сегменты: (n - 1) должно делиться на 3
    const segCount = Math.floor((n - 1) / 3);
    if (segCount <= 0) {
      return this.anchors.map((p) => [p.x, p.y]);
    }

    for (let s = 0; s < segCount; s++) {
      const i = s * 3;
      const x0 = this.anchors[i].x;
      const y0 = this.anchors[i].y;
      const x1 = this.anchors[i + 1].x;
      const y1 = this.anchors[i + 1].y;
      const x2 = this.anchors[i + 2].x;
      const y2 = this.anchors[i + 2].y;
      const x3 = this.anchors[i + 3].x;
      const y3 = this.anchors[i + 3].y;

      for (let k = 0; k <= resolution; k++) {
        const t = k / resolution;
        const p = this.evalCubic(x0, y0, x1, y1, x2, y2, x3, y3, t);
        if (k === 0 && pts.length > 0) {
          // начало нового сегмента совпадает с концом предыдущего
          continue;
        }
        pts.push(p);
      }
    }

    return pts;
  }

  private flattenCatmull(resolution: number): [number, number][] {
    const pts: [number, number][] = [];
    const n = this.anchors.length;
    if (n < 2) {
      return this.anchors.map((p) => [p.x, p.y]);
    }

    if (this.closed) {
      for (let i = 0; i < n; i++) {
        const p0 = this.anchors[(i - 1 + n) % n];
        const p1 = this.anchors[i];
        const p2 = this.anchors[(i + 1) % n];
        const p3 = this.anchors[(i + 2) % n];
        const seg = this.catmullSegmentToBezier(p0, p1, p2, p3);
        for (let k = 0; k <= resolution; k++) {
          const t = k / resolution;
          const p = this.evalCubic(
            seg.b0.x, seg.b0.y,
            seg.b1.x, seg.b1.y,
            seg.b2.x, seg.b2.y,
            seg.b3.x, seg.b3.y,
            t
          );
          if (k === 0 && pts.length > 0) continue;
          pts.push(p);
        }
      }
      // для замкнутого пути последняя точка = первая
      if (pts.length > 0) {
        pts.push([pts[0][0], pts[0][1]]);
      }
    } else {
      for (let i = 0; i < n - 1; i++) {
        const p0 = i > 0 ? this.anchors[i - 1] : this.anchors[i];
        const p1 = this.anchors[i];
        const p2 = this.anchors[i + 1];
        const p3 = i + 2 < n ? this.anchors[i + 2] : this.anchors[i + 1];
        const seg = this.catmullSegmentToBezier(p0, p1, p2, p3);
        for (let k = 0; k <= resolution; k++) {
          const t = k / resolution;
          const p = this.evalCubic(
            seg.b0.x, seg.b0.y,
            seg.b1.x, seg.b1.y,
            seg.b2.x, seg.b2.y,
            seg.b3.x, seg.b3.y,
            t
          );
          if (k === 0 && pts.length > 0) continue;
          pts.push(p);
        }
      }
    }

    return pts;
  }

  /** Catmull-Rom → кубическая Безье (tension = 0.5) */
  private catmullSegmentToBezier(
    p0: PathPoint,
    p1: PathPoint,
    p2: PathPoint,
    p3: PathPoint
  ) {
    return {
      b0: { x: p1.x, y: p1.y },
      b1: {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6,
      },
      b2: {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6,
      },
      b3: { x: p2.x, y: p2.y },
    };
  }

  private evalCubic(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    t: number
  ): [number, number] {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const px = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const py = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    return [px, py];
  }

  // ───────────────────────────────────────────────
  //  Отрисовка
  // ───────────────────────────────────────────────

  drawRaster(r: RasterRenderer): void {
    if (this.anchors.length < 2) return;

    const localPts = this.flattenLocal();
    if (localPts.length < 2) return;

    const screenPts = localPts.map(([x, y]) => this.transformPointToDevice(x, y));
    const strokeColor = hexToRGBA(this.strokeStyle, Math.round(this.strokeOpacity * 255));

    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      for (let i = 0; i < screenPts.length - 1; i++) {
        const a = screenPts[i];
        const b = screenPts[i + 1];
        r.drawLine(a.x, a.y, b.x, b.y, strokeColor);
      }
    }

    // Если путь замкнут и задана заливка
    if (this.closed && this.fillOpacity > 0 && screenPts.length > 2) {
      const fillColor = hexToRGBA(this.fillStyle, Math.round(this.fillOpacity * 255));
      // убираем дублирующую замыкающую точку, если она есть
      const poly = screenPts.map((p) => ({ x: p.x, y: p.y }));
      if (
        poly.length > 1 &&
        Math.abs(poly[0].x - poly[poly.length - 1].x) < 1e-6 &&
        Math.abs(poly[0].y - poly[poly.length - 1].y) < 1e-6
      ) {
        poly.pop();
      }
      r.fillPolygon(poly, fillColor);
    }
  }

  // ───────────────────────────────────────────────
  //  Попадание
  // ───────────────────────────────────────────────

  hitTest(px: number, py: number): boolean {
    if (this.anchors.length < 2) return false;

    const local = this.transformPointToLocal(px, py);
    const tolerance = this.strokeWidth + 2;

    // Аппроксимируем в локальных координатах и проверяем расстояние до отрезков
    const localPts = this.flattenLocal();
    for (let i = 0; i < localPts.length - 1; i++) {
      const [x1, y1] = localPts[i];
      const [x2, y2] = localPts[i + 1];
      const dist = this.distancePointToSegment(local.x, local.y, x1, y1, x2, y2);
      if (dist < tolerance) return true;
    }

    // Для замкнутого пути с ненулевой заливкой можно проверить внутренность
    if (this.closed && this.fillOpacity > 0) {
      // простая проверка по чётности числа пересечений луча вправо
      if (this.pointInPolygon(local.x, local.y, localPts)) return true;
    }

    return false;
  }

  private distancePointToSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  }

  private pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      const intersect =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ───────────────────────────────────────────────
  //  Границы
  // ───────────────────────────────────────────────

  getBounds(): Bounds {
    if (this.anchors.length === 0) {
      const pt = this.transformPointToDevice(0, 0);
      return { minX: pt.x, maxX: pt.x, minY: pt.y, maxY: pt.y };
    }

    const localPts = this.flattenLocal();
    const screenPts = localPts.map(([x, y]) => this.transformPointToDevice(x, y));

    let minX = screenPts[0].x;
    let maxX = screenPts[0].x;
    let minY = screenPts[0].y;
    let maxY = screenPts[0].y;

    for (const p of screenPts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const margin = this.strokeWidth / 2;
    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minY: minY - margin,
      maxY: maxY + margin,
    };
  }

  getLocalBounds(): Bounds {
    if (this.anchors.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    // Для более точных границ используем аппроксимацию
    const localPts = this.flattenLocal();
    if (localPts.length === 0) {
      const xs = this.anchors.map((p) => p.x);
      const ys = this.anchors.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    }

    let minX = localPts[0][0];
    let maxX = localPts[0][0];
    let minY = localPts[0][1];
    let maxY = localPts[0][1];

    for (const [x, y] of localPts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    return { minX, maxX, minY, maxY };
  }

  // ───────────────────────────────────────────────
  //  Clone / JSON
  // ───────────────────────────────────────────────

  protected createClone(): Shape {
    return new PathBezier(
      this.id,
      this.anchors.map((p) => ({ ...p })),
      this.mode,
      this.closed,
      this.flatness
    );
  }

  toJSON(): PathBezierJSON {
    return {
      id: this.id,
      type: 'PathBezier',
      anchors: this.anchors.map((p) => ({ ...p })),
      mode: this.mode,
      closed: this.closed,
      flatness: this.flatness,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
