export type Box = { x: number; y: number; w: number; h: number };

/** Bản đồ vùng tô: mỗi pixel giữ chỉ số vùng (0 = không thuộc vùng nào). */
export class RegionMap {
  readonly count: number;
  private readonly boxes: Box[] = [];

  constructor(
    readonly labels: Uint8Array,
    readonly width: number,
    readonly height: number,
  ) {
    const minX = new Int32Array(256).fill(width);
    const minY = new Int32Array(256).fill(height);
    const maxX = new Int32Array(256).fill(-1);
    const maxY = new Int32Array(256).fill(-1);
    let count = 0;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const id = labels[row + x];
        if (!id) continue;
        if (x < minX[id]) minX[id] = x;
        if (x > maxX[id]) maxX[id] = x;
        if (y < minY[id]) minY[id] = y;
        if (y > maxY[id]) maxY[id] = y;
        if (id > count) count = id;
      }
    }
    for (let id = 0; id <= count; id++) {
      this.boxes[id] =
        maxX[id] < 0
          ? { x: 0, y: 0, w: 0, h: 0 }
          : { x: minX[id], y: minY[id], w: maxX[id] - minX[id] + 1, h: maxY[id] - minY[id] + 1 };
    }
    this.count = count;
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.labels[y * this.width + x];
  }

  box(id: number): Box {
    return this.boxes[id] ?? { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Vùng tại điểm chạm; nếu chạm khe trống thì lấy vùng gần nhất trong bán kính `radius`. */
  pick(fx: number, fy: number, radius = 16): number {
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    const hit = this.at(cx, cy);
    if (hit) return hit;
    let best = 0;
    let bestD = Infinity;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const id = this.at(cx + dx, cy + dy);
        if (!id) continue;
        const ex = cx + dx + 0.5 - fx;
        const ey = cy + dy + 0.5 - fy;
        const d = ex * ex + ey * ey;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
    }
    return best;
  }

  /** Dữ liệu RGBA (trắng, alpha = thuộc vùng) cắt theo bbox của vùng. */
  maskData(id: number): { box: Box; data: Uint8ClampedArray<ArrayBuffer> } {
    const box = this.box(id);
    const data = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) {
      const src = (box.y + y) * this.width + box.x;
      const dst = y * box.w;
      for (let x = 0; x < box.w; x++) {
        if (this.labels[src + x] === id) {
          const o = (dst + x) * 4;
          data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 255;
        }
      }
    }
    return { box, data };
  }
}
