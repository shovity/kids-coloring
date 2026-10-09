import { describe, expect, it } from "vitest";
import { dabs, isStrokeTool, pressureScale, toCanvas } from "./tools";

describe("dabs", () => {
  it("không đặt dấu khi đoạn ngắn hơn khoảng cách", () => {
    expect(dabs({ x: 0, y: 0 }, { x: 2, y: 0 }, 5)).toEqual([]);
  });

  it("đặt dấu đều dọc đoạn thẳng", () => {
    expect(dabs({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual([
      { x: 4, y: 0 },
      { x: 8, y: 0 },
    ]);
  });

  it("hoạt động theo đường chéo", () => {
    const pts = dabs({ x: 0, y: 0 }, { x: 3, y: 4 }, 5);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBeCloseTo(3);
    expect(pts[0].y).toBeCloseTo(4);
  });
});

describe("pressureScale", () => {
  it("ngón tay và chuột luôn = 1", () => {
    expect(pressureScale("brush", 0.5, "touch")).toBe(1);
    expect(pressureScale("brush", 0.5, "mouse")).toBe(1);
  });

  it("bút cảm ứng thay đổi theo lực nhấn, cọ nhạy hơn", () => {
    expect(pressureScale("brush", 1, "pen")).toBeCloseTo(1.35);
    expect(pressureScale("brush", 0, "pen")).toBe(1);
    expect(pressureScale("pencil", 1, "pen")).toBeCloseTo(1.25);
    expect(pressureScale("pencil", 0.2, "pen")).toBeCloseTo(0.85);
  });
});

describe("toCanvas", () => {
  it("quy đổi theo tỉ lệ hiển thị", () => {
    const rect = { left: 100, top: 50, width: 673, height: 673 };
    expect(toCanvas(100 + 336.5, 50 + 673, rect, 1346, 1346)).toEqual({ x: 673, y: 1346 });
  });
});

describe("isStrokeTool", () => {
  it("phân biệt công cụ vẽ nét và công cụ tô vùng", () => {
    expect(isStrokeTool("pencil")).toBe(true);
    expect(isStrokeTool("shine")).toBe(true);
    expect(isStrokeTool("fill")).toBe(false);
    expect(isStrokeTool("pattern")).toBe(false);
  });
});
