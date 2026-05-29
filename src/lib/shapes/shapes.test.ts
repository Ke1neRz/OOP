import { test, expect, describe } from "vitest";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";
import { Triangle } from "./Triangle";
import { QuadraticBezier } from "./QuadraticBezier";
import { CubicBezier } from "./CubicBezier";
import { PathBezier } from "./PathBezier";

const EPS = 1e-6;

function expectBoundsClose(actual: any, expected: any, eps = EPS) {
  expect(actual.minX).toBeCloseTo(expected.minX, Math.log10(1 / eps));
  expect(actual.minY).toBeCloseTo(expected.minY, Math.log10(1 / eps));
  expect(actual.maxX).toBeCloseTo(expected.maxX, Math.log10(1 / eps));
  expect(actual.maxY).toBeCloseTo(expected.maxY, Math.log10(1 / eps));
}

describe("Rect", () => {
  test("getLocalBounds returns correct dimensions", () => {
    const rect = new Rect("rect1", 80, 40);
    const bounds = rect.getLocalBounds();
    
    expectBoundsClose(bounds, {
      minX: -40,
      maxX: 40,
      minY: -20,
      maxY: 20,
    });
  });

  test("getBounds without transform", () => {
    const rect = new Rect("rect2", 100, 100);
    const bounds = rect.getBounds();

    expectBoundsClose(bounds, {
      minX: -50,
      maxX: 50,
      minY: -50,
      maxY: 50,
    });
  });

  test("getBounds with translation", () => {
    const rect = new Rect("rect3", 100, 100);
    rect.transform.x = 150;
    rect.transform.y = 75;
    const bounds = rect.getBounds();

    expectBoundsClose(bounds, {
      minX: 100,
      maxX: 200,
      minY: 25,
      maxY: 125,
    });
  });

  test("getBounds with scale", () => {
    const rect = new Rect("rect4", 100, 100);
    rect.transform.scaleX = 2;
    rect.transform.scaleY = 1.5;
    const bounds = rect.getBounds();

    expectBoundsClose(bounds, {
      minX: -100,
      maxX: 100,
      minY: -75,
      maxY: 75,
    });
  });

  test("getBounds with rotation", () => {
    const rect = new Rect("rect5", 100, 100);
    rect.transform.rotation = Math.PI / 4; // 45 degrees
    const bounds = rect.getBounds();

    // For a 100x100 square rotated 45 degrees, diagonal = 100*sqrt(2) ≈ 141.42
    // Half diagonal ≈ 70.71
    expectBoundsClose(bounds, {
      minX: -70.71,
      maxX: 70.71,
      minY: -70.71,
      maxY: 70.71,
    }, 0.1);
  });

  test("hitTest inside rectangle", () => {
    const rect = new Rect("rect6", 80, 40);
    
    expect(rect.hitTest(0, 0)).toBe(true);
    expect(rect.hitTest(10, -5)).toBe(true);
    expect(rect.hitTest(-20, 15)).toBe(true);
  });

  test("hitTest outside rectangle", () => {
    const rect = new Rect("rect7", 80, 40);
    
    expect(rect.hitTest(50, 0)).toBe(false);
    expect(rect.hitTest(0, 30)).toBe(false);
    expect(rect.hitTest(50, 30)).toBe(false);
  });

  test("hitTest with transform", () => {
    const rect = new Rect("rect8", 100, 100);
    rect.transform.x = 100;
    rect.transform.y = 100;
    
    // Point at (100, 100) should hit (center of rect)
    expect(rect.hitTest(100, 100)).toBe(true);
    // Boundary is included: corner point maps to local (-50, -50)
    expect(rect.hitTest(50, 50)).toBe(true);
  });

  test("setBounds resizes rectangle", () => {
    const rect = new Rect("rect9", 100, 100);
    rect.setBounds(0, 0, 200, 100);

    const bounds = rect.getBounds();
    expectBoundsClose(bounds, {
      minX: 0,
      maxX: 200,
      minY: 0,
      maxY: 100,
    });
  });
});

describe("Line", () => {
  test("getLocalBounds returns correct bounds", () => {
    const line = new Line("line1", 0, 0, 100, 0);
    const bounds = line.getLocalBounds();

    // Includes half stroke width padding (default strokeWidth = 1)
    expect(bounds.minX).toBeCloseTo(-50.5, 1);
    expect(bounds.maxX).toBeCloseTo(50.5, 1);
  });

  test("getBounds without transform", () => {
    const line = new Line("line2", 0, 0, 100, 0);
    const bounds = line.getBounds();

    // Centered line has transform at (50, 0), so device X range is [0, 100]
    // then expanded by half stroke width.
    expect(bounds.minX).toBeCloseTo(-0.5, 1);
    expect(bounds.maxX).toBeCloseTo(100.5, 1);
  });

  test("hitTest on line segment", () => {
    const line = new Line("line3", 0, 0, 100, 0);
    
    // Points on the line should hit
    expect(line.hitTest(50, 0)).toBe(true);
    expect(line.hitTest(0, 0)).toBe(true);
  });

  test("hitTest near line segment", () => {
    const line = new Line("line4", 0, 0, 100, 0);
    line.strokeWidth = 10;
    
    // Points near the line should hit (within strokeWidth/2)
    expect(line.hitTest(50, 5)).toBe(true);
  });

  test("hitTest far from line segment", () => {
    const line = new Line("line5", 0, 0, 100, 0);
    
    // Points far from the line should not hit
    expect(line.hitTest(50, 50)).toBe(false);
  });
});

describe("Oval", () => {
  test("getLocalBounds returns correct dimensions", () => {
    const oval = new Oval("oval1", 100, 50);
    const bounds = oval.getLocalBounds();

    expectBoundsClose(bounds, {
      minX: -100,
      maxX: 100,
      minY: -50,
      maxY: 50,
    });
  });

  test("getBounds without transform", () => {
    const oval = new Oval("oval2", 100, 50);
    const bounds = oval.getBounds();

    expectBoundsClose(bounds, {
      minX: -100,
      maxX: 100,
      minY: -50,
      maxY: 50,
    });
  });

  test("hitTest inside oval", () => {
    const oval = new Oval("oval3", 100, 50);
    
    // Center should always hit
    expect(oval.hitTest(0, 0)).toBe(true);
    // Test point from lab: (50, 25) should be inside when rx=100, ry=50
    // (50/100)^2 + (25/50)^2 = 0.25 + 0.25 = 0.5 <= 1
    expect(oval.hitTest(50, 25)).toBe(true);
  });

  test("hitTest outside oval", () => {
    const oval = new Oval("oval4", 100, 50);
    
    // Test point from lab: (120, 60) should be outside when rx=100, ry=50
    // (120/100)^2 + (60/50)^2 = 1.44 + 1.44 = 2.88 > 1
    expect(oval.hitTest(120, 60)).toBe(false);
  });

  test("hitTest on oval boundary", () => {
    const oval = new Oval("oval5", 100, 50);
    
    // Point on the boundary (rightmost point)
    expect(oval.hitTest(100, 0)).toBe(true);
  });

  test("getBounds with scale", () => {
    const oval = new Oval("oval6", 100, 50);
    oval.transform.scaleX = 2;
    oval.transform.scaleY = 1.5;
    const bounds = oval.getBounds();

    expectBoundsClose(bounds, {
      minX: -200,
      maxX: 200,
      minY: -75,
      maxY: 75,
    });
  });

  test("hitTest with rotation", () => {
    const oval = new Oval("oval7", 100, 100);
    oval.transform.rotation = Math.PI / 4; // 45 degrees
    
    // Center should still hit
    expect(oval.hitTest(0, 0)).toBe(true);
  });

  test("getBounds with translation", () => {
    const oval = new Oval("oval8", 100, 50);
    oval.transform.x = 200;
    oval.transform.y = 150;
    const bounds = oval.getBounds();

    expectBoundsClose(bounds, {
      minX: 100,
      maxX: 300,
      minY: 100,
      maxY: 200,
    });
  });
});

describe("Shape transformations", () => {
  test("getCenter returns center of bounds", () => {
    const rect = new Rect("rect10", 100, 100);
    const center = rect.getCenter();

    expect(center.x).toBeCloseTo(0, 1);
    expect(center.y).toBeCloseTo(0, 1);
  });

  test("getCenter with translation", () => {
    const rect = new Rect("rect11", 100, 100);
    rect.transform.x = 150;
    rect.transform.y = 75;
    const center = rect.getCenter();

    expect(center.x).toBeCloseTo(150, 1);
    expect(center.y).toBeCloseTo(75, 1);
  });

  test("transformPointToDevice and back", () => {
    const rect = new Rect("rect12", 100, 100);
    rect.transform.x = 100;
    rect.transform.y = 100;
    rect.transform.rotation = Math.PI / 4;

    const localPoint = { x: 50, y: 0 };
    const devicePoint = rect.transformPointToDevice(localPoint.x, localPoint.y);
    const backToLocal = rect.transformPointToLocal(devicePoint.x, devicePoint.y);

    expect(backToLocal.x).toBeCloseTo(localPoint.x, 1);
    expect(backToLocal.y).toBeCloseTo(localPoint.y, 1);
  });

  test("clone preserves all properties", () => {
    const original = new Rect("rect13", 100, 100);
    original.transform.x = 50;
    original.transform.rotation = 0.5;
    original.fillStyle = "#FF0000";
    original.fillOpacity = 0.5;
    original.strokeStyle = "#00FF00";
    original.strokeWidth = 3;
    original.strokeOpacity = 0.8;

    const cloned = original.clone() as Rect;

    expect(cloned.id).toBe(original.id);
    expect(cloned.width).toBe(original.width);
    expect(cloned.height).toBe(original.height);
    expect(cloned.transform.x).toBe(original.transform.x);
    expect(cloned.transform.rotation).toBe(original.transform.rotation);
    expect(cloned.fillStyle).toBe(original.fillStyle);
    expect(cloned.fillOpacity).toBe(original.fillOpacity);
    expect(cloned.strokeStyle).toBe(original.strokeStyle);
    expect(cloned.strokeWidth).toBe(original.strokeWidth);
    expect(cloned.strokeOpacity).toBe(original.strokeOpacity);
  });
});

describe("PathBezier", () => {
  test("polyline local bounds matches anchors", () => {
    const path = new PathBezier(
      "pb1",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ],
      "polyline",
      false
    );
    const b = path.getLocalBounds();
    expect(b.minX).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(100);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxY).toBeCloseTo(50);
  });

  test("catmull curve bounds exceed anchor bounds", () => {
    // S-like chain: the spline will bulge outside the anchor Y-range
    const anchors = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
      { x: 150, y: 100 },
      { x: 200, y: 0 },
    ];
    const path = new PathBezier("pb2", anchors, "catmull", false);
    const b = path.getLocalBounds();
    // For Catmull-Rom the spline overshoots the anchor extrema
    expect(b.maxY).toBeGreaterThan(100);
    expect(b.minY).toBeLessThanOrEqual(0);
  });

  test("hitTest on polyline segment", () => {
    const path = new PathBezier(
      "pb3",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      "polyline",
      false
    );
    path.strokeWidth = 5;
    expect(path.hitTest(50, 0)).toBe(true);
    expect(path.hitTest(50, 4)).toBe(true);
    expect(path.hitTest(50, 10)).toBe(false);
  });

  test("closed polyline hitTest inside fill", () => {
    const path = new PathBezier(
      "pb4",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
      "polyline",
      true
    );
    path.fillOpacity = 1;
    path.fillStyle = "#000000";
    expect(path.hitTest(50, 30)).toBe(true);
    expect(path.hitTest(200, 200)).toBe(false);
  });

  test("getControlPoints / setControlPoint", () => {
    const path = new PathBezier(
      "pb5",
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      "polyline",
      false
    );
    expect(path.getControlPoints()).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    path.setControlPoint(1, { x: 20, y: 5 });
    expect(path.getControlPoints()[1]).toEqual({ x: 20, y: 5 });
  });

  test("addPointLocal and removePoint", () => {
    const path = new PathBezier("pb6", [{ x: 0, y: 0 }], "polyline", false);
    path.addPointLocal({ x: 50, y: 50 });
    expect(path.anchors.length).toBe(2);
    path.removePoint(0);
    expect(path.anchors.length).toBe(1);
    expect(path.anchors[0]).toEqual({ x: 50, y: 50 });
  });

  test("clone preserves mode, closed and anchors", () => {
    const original = new PathBezier(
      "pb7",
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      "catmull",
      true
    );
    original.strokeWidth = 4;
    const cloned = original.clone() as PathBezier;
    expect(cloned.mode).toBe("catmull");
    expect(cloned.closed).toBe(true);
    expect(cloned.anchors).toEqual(original.anchors);
    expect(cloned.strokeWidth).toBe(4);
  });

  test("toJSON serialization", () => {
    const path = new PathBezier(
      "pb8",
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      "bezier",
      true
    );
    path.fillStyle = "#FF0000";
    const json = path.toJSON();
    expect(json.type).toBe("PathBezier");
    expect(json.mode).toBe("bezier");
    expect(json.closed).toBe(true);
    expect(json.anchors).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(json.fillStyle).toBe("#FF0000");
  });

  test("bezier mode with insufficient points falls back to anchors", () => {
    const path = new PathBezier(
      "pb9",
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      "bezier",
      false
    );
    // 2 points are not enough for a cubic segment; should not crash
    const b = path.getLocalBounds();
    expect(b.minX).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(10);
  });

  test("catmullToBeziers converts anchors to cubic segments", () => {
    const path = new PathBezier(
      "pb10",
      [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 50 },
        { x: 150, y: 100 },
      ],
      "catmull",
      false
    );
    const segs = path.catmullToBeziers();
    expect(segs.length).toBe(3); // 4 points → 3 segments
    // Each segment should have 4 control points
    segs.forEach((seg) => {
      expect(seg.b0).toBeDefined();
      expect(seg.b1).toBeDefined();
      expect(seg.b2).toBeDefined();
      expect(seg.b3).toBeDefined();
    });
    // First segment starts at first anchor
    expect(segs[0].b0.x).toBeCloseTo(0);
    expect(segs[0].b0.y).toBeCloseTo(0);
  });

  test("catmullToBeziers on closed path", () => {
    const path = new PathBezier(
      "pb11",
      [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ],
      "catmull",
      true
    );
    const segs = path.catmullToBeziers();
    expect(segs.length).toBe(3); // closed: n segments for n points
  });
});

describe("Triangle", () => {
  test("getLocalBounds returns correct dimensions", () => {
    const tri = new Triangle("tri1", 0, 0, 100, 0, 50, 100);
    const b = tri.getLocalBounds();
    // Center = (50, 33.33); local vertices relative to center
    expect(b.minX).toBeCloseTo(-50, 1);
    expect(b.maxX).toBeCloseTo(50, 1);
    expect(b.minY).toBeCloseTo(-33.33, 1);
    expect(b.maxY).toBeCloseTo(66.67, 1);
  });

  test("getBounds without transform", () => {
    const tri = new Triangle("tri2", 0, 0, 100, 0, 50, 100);
    const b = tri.getBounds();
    // Without transform screen coords = local coords
    expect(b.minX).toBeCloseTo(-50);
    expect(b.maxX).toBeCloseTo(50);
    expect(b.minY).toBeCloseTo(-33.33, 1);
    expect(b.maxY).toBeCloseTo(66.67, 1);
  });

  test("hitTest inside triangle", () => {
    const tri = new Triangle("tri3", 0, 0, 100, 0, 50, 100);
    // Move triangle to its original screen position
    tri.transform.x = 50;
    tri.transform.y = 100 / 3;
    expect(tri.hitTest(50, 30)).toBe(true);
    expect(tri.hitTest(10, 5)).toBe(true);
  });

  test("hitTest outside triangle", () => {
    const tri = new Triangle("tri3", 0, 0, 100, 0, 50, 100);
    tri.transform.x = 50;
    tri.transform.y = 100 / 3;
    expect(tri.hitTest(200, 200)).toBe(false);
    expect(tri.hitTest(50, -10)).toBe(false);
  });

  test("hitTest on boundary", () => {
    const tri = new Triangle("tri4", 0, 0, 100, 0, 50, 100);
    tri.transform.x = 50;
    tri.transform.y = 100 / 3;
    expect(tri.hitTest(50, 0)).toBe(true);
    expect(tri.hitTest(25, 50)).toBe(true);
  });

  test("clone preserves vertices", () => {
    const tri = new Triangle("tri5", 10, 10, 20, 10, 15, 20);
    const cloned = tri.clone() as Triangle;
    expect(cloned.x1).toBeCloseTo(tri.x1);
    expect(cloned.y1).toBeCloseTo(tri.y1);
    expect(cloned.x2).toBeCloseTo(tri.x2);
    expect(cloned.y2).toBeCloseTo(tri.y2);
    expect(cloned.x3).toBeCloseTo(tri.x3);
    expect(cloned.y3).toBeCloseTo(tri.y3);
  });

  test("toJSON serialization", () => {
    const tri = new Triangle("tri6", 0, 0, 100, 0, 50, 100);
    tri.fillStyle = "#123456";
    const json = tri.toJSON();
    expect(json.type).toBe("Triangle");
    expect(json.fillStyle).toBe("#123456");
    expect(json.x1).toBeCloseTo(0);
    expect(json.x2).toBeCloseTo(100);
    expect(json.x3).toBeCloseTo(50);
  });
});

describe("QuadraticBezier", () => {
  test("getLocalBounds covers control points", () => {
    const q = new QuadraticBezier("qb1", -50, 0, 0, -50, 50, 0);
    const b = q.getLocalBounds();
    // Center = (0, -16.67); local points: (-50,16.67), (0,-33.33), (50,16.67)
    expect(b.minX).toBeCloseTo(-50);
    expect(b.maxX).toBeCloseTo(50);
    expect(b.minY).toBeCloseTo(-33.33, 1);
    expect(b.maxY).toBeCloseTo(16.67, 1);
  });

  test("getBounds without transform", () => {
    const q = new QuadraticBezier("qb2", -50, 0, 0, -50, 50, 0);
    const b = q.getBounds();
    // Without transform screen coords = local coords expanded by half stroke width
    expect(b.minX).toBeCloseTo(-51); // -50 - 1 (strokeWidth/2)
    expect(b.maxX).toBeCloseTo(51);
    expect(b.minY).toBeLessThanOrEqual(0);
    expect(b.maxY).toBeCloseTo(17.67, 1); // 16.67 + 1
  });

  test("hitTest on curve", () => {
    const q = new QuadraticBezier("qb3", -50, 0, 0, -50, 50, 0);
    q.strokeWidth = 4;
    // Local coords center = (0, -50/3); curve endpoints in screen = local
    expect(q.hitTest(-50, 50 / 3)).toBe(true);   // start (local y = +50/3)
    expect(q.hitTest(50, 50 / 3)).toBe(true);    // end
    expect(q.hitTest(0, -25 / 3)).toBe(true);    // near midpoint (local y ≈ -8.33)
  });

  test("hitTest far from curve", () => {
    const q = new QuadraticBezier("qb4", -50, 0, 0, -50, 50, 0);
    expect(q.hitTest(0, 100)).toBe(false);
    expect(q.hitTest(200, 0)).toBe(false);
  });

  test("flatness affects resolution", () => {
    const q1 = new QuadraticBezier("qb5", -100, 0, 0, -100, 100, 0, 1);
    const q2 = new QuadraticBezier("qb6", -100, 0, 0, -100, 100, 0, 10);
    expect(q1.flatness).toBe(1);
    expect(q2.flatness).toBe(10);
  });

  test("clone preserves control points", () => {
    const q = new QuadraticBezier("qb7", -10, 0, 0, -20, 10, 0);
    const cloned = q.clone() as QuadraticBezier;
    expect(cloned.x0).toBeCloseTo(q.x0);
    expect(cloned.x1).toBeCloseTo(q.x1);
    expect(cloned.x2).toBeCloseTo(q.x2);
  });

  test("evalLocal at t=0 and t=1", () => {
    const q = new QuadraticBezier("qb8b", -50, 0, 0, -50, 50, 0);
    expect(q.evalLocal(0).x).toBeCloseTo(q.x0);
    expect(q.evalLocal(0).y).toBeCloseTo(q.y0);
    expect(q.evalLocal(1).x).toBeCloseTo(q.x2);
    expect(q.evalLocal(1).y).toBeCloseTo(q.y2);
  });

  test("flattenDevicePoints returns screen coords", () => {
    const q = new QuadraticBezier("qb8c", -50, 0, 0, -50, 50, 0);
    q.transform.x = 100;
    q.transform.y = 50;
    const pts = q.flattenDevicePoints();
    expect(pts.length).toBeGreaterThan(2);
    // First point should be start point transformed to device
    const start = q.transformPointToDevice(q.x0, q.y0);
    expect(pts[0].x).toBeCloseTo(start.x);
    expect(pts[0].y).toBeCloseTo(start.y);
  });

  test("toJSON serialization", () => {
    const q = new QuadraticBezier("qb8", -50, 0, 0, -50, 50, 0);
    q.strokeStyle = "#AABBCC";
    q.flatness = 2;
    const json = q.toJSON();
    expect(json.type).toBe("QuadraticBezier");
    expect(json.strokeStyle).toBe("#AABBCC");
    expect(json.x0).toBeCloseTo(-50);
    expect(json.x2).toBeCloseTo(50);
    expect(json.flatness).toBe(2);
  });
});

describe("CubicBezier", () => {
  test("getLocalBounds covers control points", () => {
    const c = new CubicBezier("cb1", -50, 0, -25, -50, 25, -50, 50, 0);
    const b = c.getLocalBounds();
    // Center = (0, -25); local points: (-50,25), (-25,-25), (25,-25), (50,25)
    expect(b.minX).toBeCloseTo(-50);
    expect(b.maxX).toBeCloseTo(50);
    expect(b.minY).toBeCloseTo(-25);
    expect(b.maxY).toBeCloseTo(25);
  });

  test("getBounds without transform", () => {
    const c = new CubicBezier("cb2", -50, 0, -25, -50, 25, -50, 50, 0);
    const b = c.getBounds();
    // expanded by half stroke width (default strokeWidth = 2)
    expect(b.minX).toBeCloseTo(-51);
    expect(b.maxX).toBeCloseTo(51);
    expect(b.minY).toBeLessThanOrEqual(0);
    expect(b.maxY).toBeCloseTo(26);
  });

  test("hitTest on curve", () => {
    const c = new CubicBezier("cb3", -50, 0, -25, -50, 25, -50, 50, 0);
    c.strokeWidth = 4;
    // Local center = (0, -25); screen = local without transform
    expect(c.hitTest(-50, 25)).toBe(true);   // start (local y = +25)
    expect(c.hitTest(50, 25)).toBe(true);    // end
    expect(c.hitTest(0, -12.5)).toBe(true);  // near midpoint
  });

  test("hitTest far from curve", () => {
    const c = new CubicBezier("cb4", -50, 0, -25, -50, 25, -50, 50, 0);
    expect(c.hitTest(0, 100)).toBe(false);
    expect(c.hitTest(200, 0)).toBe(false);
  });

  test("flatness affects resolution", () => {
    const c1 = new CubicBezier("cb5", -100, 0, -50, -50, 50, -50, 100, 0, 1);
    const c2 = new CubicBezier("cb6", -100, 0, -50, -50, 50, -50, 100, 0, 10);
    expect(c1.flatness).toBe(1);
    expect(c2.flatness).toBe(10);
  });

  test("clone preserves control points", () => {
    const c = new CubicBezier("cb7", -10, 0, -5, -10, 5, -10, 10, 0);
    const cloned = c.clone() as CubicBezier;
    expect(cloned.x0).toBeCloseTo(c.x0);
    expect(cloned.x3).toBeCloseTo(c.x3);
  });

  test("evalLocal at t=0 and t=1", () => {
    const c = new CubicBezier("cb8b", -50, 0, -25, -50, 25, -50, 50, 0);
    expect(c.evalLocal(0).x).toBeCloseTo(c.x0);
    expect(c.evalLocal(0).y).toBeCloseTo(c.y0);
    expect(c.evalLocal(1).x).toBeCloseTo(c.x3);
    expect(c.evalLocal(1).y).toBeCloseTo(c.y3);
  });

  test("flattenDevicePoints returns screen coords", () => {
    const c = new CubicBezier("cb8c", -50, 0, -25, -50, 25, -50, 50, 0);
    c.transform.x = 200;
    c.transform.y = 100;
    const pts = c.flattenDevicePoints();
    expect(pts.length).toBeGreaterThan(2);
    const start = c.transformPointToDevice(c.x0, c.y0);
    expect(pts[0].x).toBeCloseTo(start.x);
    expect(pts[0].y).toBeCloseTo(start.y);
  });

  test("toJSON serialization", () => {
    const c = new CubicBezier("cb8", -50, 0, -25, -50, 25, -50, 50, 0);
    c.strokeStyle = "#DDEEFF";
    c.flatness = 3;
    const json = c.toJSON();
    expect(json.type).toBe("CubicBezier");
    expect(json.strokeStyle).toBe("#DDEEFF");
    expect(json.x0).toBeCloseTo(-50);
    expect(json.x3).toBeCloseTo(50);
    expect(json.flatness).toBe(3);
  });
});
