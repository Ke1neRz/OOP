import { test, expect, describe } from "vitest";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";

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
