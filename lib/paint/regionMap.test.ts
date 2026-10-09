import { describe, expect, it } from "vitest";
import { RegionMap } from "./regionMap";

// 6x4:
// 1 1 1 1 1 1
// 1 2 2 0 3 1
// 1 2 2 0 3 1
// 1 1 1 1 1 1
const W = 6;
const H = 4;
const labels = Uint8Array.from([
  1, 1, 1, 1, 1, 1,
  1, 2, 2, 0, 3, 1,
  1, 2, 2, 0, 3, 1,
  1, 1, 1, 1, 1, 1,
]);

describe("RegionMap", () => {
  const map = new RegionMap(labels, W, H);

  it("đọc nhãn tại một điểm", () => {
    expect(map.at(0, 0)).toBe(1);
    expect(map.at(2, 2)).toBe(2);
    expect(map.at(3, 1)).toBe(0);
    expect(map.at(-1, 0)).toBe(0);
    expect(map.at(6, 0)).toBe(0);
  });

  it("đếm số vùng và tính bbox", () => {
    expect(map.count).toBe(3);
    expect(map.box(1)).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(map.box(2)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(map.box(3)).toEqual({ x: 4, y: 1, w: 1, h: 2 });
  });

  it("pick tìm vùng gần nhất khi chạm vào khe/nét viền", () => {
    expect(map.pick(2.4, 1.6)).toBe(2);
    expect(map.pick(3.8, 1.5)).toBe(3); // 3 gần hơn 2
    expect(map.pick(3.2, 1.5)).toBe(2);
    expect(map.pick(3.0, 1.0, 0)).toBe(0);
  });

  it("làm tròn tọa độ thực về pixel", () => {
    expect(map.pick(4.9, 2.9)).toBe(3);
  });

  it("tạo alpha mask theo bbox của vùng", () => {
    const m = map.maskData(2);
    expect(m.box).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(Array.from(m.data.filter((_, i) => i % 4 === 3))).toEqual([255, 255, 255, 255]);
    const bg = map.maskData(1);
    const alpha = Array.from(bg.data.filter((_, i) => i % 4 === 3));
    expect(alpha.filter((a) => a === 255).length).toBe(16);
    expect(alpha[1 * 6 + 1]).toBe(0);
  });
});
