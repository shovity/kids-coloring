import { RegionMap, type Box } from "./regionMap";
import { dabs, pressureScale, STROKE_SIZE, type Pt, type StrokeTool } from "./tools";

/** Thứ dùng để tô: màu đặc hoặc ảnh lặp (kim tuyến / họa tiết). */
export type Ink = { kind: "color"; color: string } | { kind: "texture"; image: CanvasImageSource; scale: number };

type Stroke = {
  tool: StrokeTool;
  region: number;
  box: Box;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  last: Pt;
  pointerType: string;
  size: number;
  stamp: HTMLCanvasElement | null;
};

type FillAnim = { region: number; box: Box; ink: Ink; origin: Pt; maxR: number; start: number };

// iPad giới hạn tổng bộ nhớ canvas → giữ ít bản sao và giải phóng sớm
const MAX_UNDO = 12;
const MAX_MASKS = 6;
const FILL_MS = 380;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/** WebKit chỉ trả bộ nhớ canvas khi thu kích thước về 0. */
function release(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D không khả dụng");
  return ctx;
}

/** Nhiễu hạt để nét bút chì có vân giấy. */
function makeGrain(): HTMLCanvasElement {
  const c = makeCanvas(96, 96);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = Math.random();
    img.data[i + 3] = r < 0.35 ? 70 + Math.random() * 110 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Dấu cọ mềm: tâm đặc, mép mờ dần. */
function makeSoftStamp(color: string): HTMLCanvasElement {
  const c = makeCanvas(128, 128);
  const ctx = ctx2d(c);
  // Gradient tới màu trong suốt cùng sắc độ để mép không bị xám
  const tmp = ctx2d(makeCanvas(1, 1));
  tmp.fillStyle = color;
  tmp.fillRect(0, 0, 1, 1);
  const [r, gg, b] = tmp.getImageData(0, 0, 1, 1).data;
  const soft = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  soft.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  soft.addColorStop(0.55, `rgba(${r},${gg},${b},0.9)`);
  soft.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  ctx.fillStyle = soft;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

export class PaintEngine {
  readonly width: number;
  readonly height: number;
  onChange?: () => void;

  private readonly paint: CanvasRenderingContext2D;
  private readonly overlay: CanvasRenderingContext2D;
  private readonly masks = new Map<number, HTMLCanvasElement>();
  private readonly undoStack: { box: Box; snap: HTMLCanvasElement }[] = [];
  private readonly grain = makeGrain();
  private stroke: Stroke | null = null;
  private fill: FillAnim | null = null;
  private composed: HTMLCanvasElement | null = null;
  private raf = 0;

  constructor(
    private readonly map: RegionMap,
    paintCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ) {
    this.width = map.width;
    this.height = map.height;
    for (const c of [paintCanvas, overlayCanvas]) {
      c.width = this.width;
      c.height = this.height;
    }
    this.paint = ctx2d(paintCanvas);
    this.overlay = ctx2d(overlayCanvas);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get busy(): boolean {
    return this.stroke !== null;
  }

  // ---------- Nét vẽ ----------

  beginStroke(tool: StrokeTool, ink: Ink, pt: Pt, pressure: number, pointerType: string): boolean {
    this.finishFill();
    if (this.stroke) this.endStroke();
    const region = this.map.pick(pt.x, pt.y);
    if (!region) return false;
    const box = this.map.box(region);
    this.pushUndo(box);
    const canvas = makeCanvas(box.w, box.h);
    const ctx = ctx2d(canvas);
    ctx.translate(-box.x, -box.y);
    ctx.fillStyle = this.inkStyle(ctx, ink);
    this.stroke = {
      tool,
      region,
      box,
      canvas,
      ctx,
      last: pt,
      pointerType,
      size: STROKE_SIZE[tool] * pressureScale(tool, pressure, pointerType),
      stamp: tool === "brush" && ink.kind === "color" ? makeSoftStamp(ink.color) : null,
    };
    this.dab(pt);
    this.schedule();
    return true;
  }

  moveStroke(pt: Pt, pressure: number): void {
    const s = this.stroke;
    if (!s) return;
    const target = STROKE_SIZE[s.tool] * pressureScale(s.tool, pressure, s.pointerType);
    s.size += (target - s.size) * 0.35; // làm mượt thay đổi lực nhấn
    const spacing = Math.max(1, s.size * (s.tool === "brush" ? 0.12 : 0.22));
    const pts = dabs(s.last, pt, spacing);
    for (const p of pts) this.dab(p);
    if (pts.length) {
      s.last = pts[pts.length - 1];
      this.schedule();
    }
  }

  endStroke(): void {
    const s = this.stroke;
    if (!s) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const out = this.composeStroke(s);
    this.overlay.clearRect(s.box.x, s.box.y, s.box.w, s.box.h);
    this.paint.drawImage(out, s.box.x, s.box.y);
    release(s.canvas);
    this.stroke = null;
    this.onChange?.();
  }

  private dab(p: Pt): void {
    const s = this.stroke!;
    const r = s.size / 2;
    if (s.stamp) {
      s.ctx.drawImage(s.stamp, p.x - r, p.y - r, s.size, s.size);
      return;
    }
    s.ctx.beginPath();
    s.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    s.ctx.fill();
  }

  /** Nét vẽ cắt theo vùng (+ vân hạt cho bút chì). */
  private composeStroke(s: Stroke): HTMLCanvasElement {
    const { w, h } = s.box;
    if (!this.composed || this.composed.width !== w || this.composed.height !== h) {
      this.composed = makeCanvas(w, h);
    }
    const ctx = ctx2d(this.composed);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(s.canvas, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.mask(s.region), 0, 0);
    if (s.tool === "pencil") {
      ctx.globalCompositeOperation = "destination-out";
      const pat = ctx.createPattern(this.grain, "repeat")!;
      pat.setTransform(new DOMMatrix().translate(-s.box.x, -s.box.y));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
    return this.composed;
  }

  // ---------- Đổ màu / họa tiết ----------

  /** Tô cả vùng tại điểm chạm, hiệu ứng loang từ điểm chạm. */
  fillAt(pt: Pt, ink: Ink): boolean {
    this.finishFill();
    if (this.stroke) this.endStroke();
    const region = this.map.pick(pt.x, pt.y);
    if (!region) return false;
    const box = this.map.box(region);
    this.pushUndo(box);
    const corners = [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x, box.y + box.h],
      [box.x + box.w, box.y + box.h],
    ];
    const maxR = Math.max(...corners.map(([x, y]) => Math.hypot(x - pt.x, y - pt.y)));
    this.fill = { region, box, ink, origin: pt, maxR, start: performance.now() };
    this.schedule();
    return true;
  }

  private drawFill(f: FillAnim, radius: number): HTMLCanvasElement {
    const { w, h } = f.box;
    if (!this.composed || this.composed.width !== w || this.composed.height !== h) {
      this.composed = makeCanvas(w, h);
    }
    const ctx = ctx2d(this.composed);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.mask(f.region), 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.save();
    ctx.translate(-f.box.x, -f.box.y);
    ctx.fillStyle = this.inkStyle(ctx, f.ink);
    ctx.beginPath();
    ctx.arc(f.origin.x, f.origin.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    return this.composed;
  }

  private finishFill(): void {
    const f = this.fill;
    if (!f) return;
    this.fill = null;
    const out = this.drawFill(f, f.maxR + 2);
    this.overlay.clearRect(f.box.x, f.box.y, f.box.w, f.box.h);
    this.paint.drawImage(out, f.box.x, f.box.y);
    this.onChange?.();
  }

  // ---------- Khung hình ----------

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.frame();
    });
  }

  private frame(): void {
    if (this.stroke) {
      const s = this.stroke;
      const out = this.composeStroke(s);
      this.overlay.clearRect(s.box.x, s.box.y, s.box.w, s.box.h);
      this.overlay.drawImage(out, s.box.x, s.box.y);
    }
    if (this.fill) {
      const f = this.fill;
      const t = Math.min(1, (performance.now() - f.start) / FILL_MS);
      if (t >= 1) {
        this.finishFill();
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      const out = this.drawFill(f, f.maxR * eased);
      this.overlay.clearRect(f.box.x, f.box.y, f.box.w, f.box.h);
      this.overlay.drawImage(out, f.box.x, f.box.y);
      this.schedule();
    }
  }

  private inkStyle(ctx: CanvasRenderingContext2D, ink: Ink): string | CanvasPattern {
    if (ink.kind === "color") return ink.color;
    const pat = ctx.createPattern(ink.image, "repeat")!;
    pat.setTransform(new DOMMatrix().scale(ink.scale));
    return pat;
  }

  private mask(id: number): HTMLCanvasElement {
    const hit = this.masks.get(id);
    if (hit) {
      this.masks.delete(id);
      this.masks.set(id, hit);
      return hit;
    }
    const { box, data } = this.map.maskData(id);
    const c = makeCanvas(box.w, box.h);
    ctx2d(c).putImageData(new ImageData(data, box.w, box.h), 0, 0);
    this.masks.set(id, c);
    if (this.masks.size > MAX_MASKS) {
      const oldest = this.masks.keys().next().value!;
      release(this.masks.get(oldest)!);
      this.masks.delete(oldest);
    }
    return c;
  }

  // ---------- Undo / xóa / lưu ----------

  private pushUndo(box: Box): void {
    const snap = makeCanvas(box.w, box.h);
    ctx2d(snap).drawImage(this.paint.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    this.undoStack.push({ box, snap });
    if (this.undoStack.length > MAX_UNDO) release(this.undoStack.shift()!.snap);
  }

  undo(): void {
    this.finishFill();
    if (this.stroke) this.endStroke();
    const u = this.undoStack.pop();
    if (!u) return;
    this.paint.clearRect(u.box.x, u.box.y, u.box.w, u.box.h);
    this.paint.drawImage(u.snap, u.box.x, u.box.y);
    release(u.snap);
    this.onChange?.();
  }

  clear(): void {
    this.finishFill();
    if (this.stroke) this.endStroke();
    this.pushUndo({ x: 0, y: 0, w: this.width, h: this.height });
    this.paint.clearRect(0, 0, this.width, this.height);
    this.onChange?.();
  }

  /** Giải phóng mọi canvas phụ khi rời màn tô. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.masks.forEach(release);
    this.masks.clear();
    this.undoStack.forEach((u) => release(u.snap));
    this.undoStack.length = 0;
    if (this.composed) release(this.composed);
    this.composed = null;
  }

  load(image: CanvasImageSource): void {
    this.paint.clearRect(0, 0, this.width, this.height);
    this.paint.drawImage(image, 0, 0, this.width, this.height);
  }

  /** Lớp màu (PNG giữ alpha) để lưu và mở lại. */
  async exportPaint(): Promise<Blob> {
    return new Promise((resolve, reject) =>
      this.paint.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob lỗi"))), "image/png"),
    );
  }

  /** Ảnh thu nhỏ: nền trắng + màu + nét viền. */
  async exportThumb(outline: CanvasImageSource, size = 360): Promise<Blob> {
    const c = makeCanvas(size, size);
    const ctx = ctx2d(c);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.paint.canvas, 0, 0, size, size);
    ctx.drawImage(outline, 0, 0, size, size);
    return new Promise((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob lỗi"))), "image/jpeg", 0.85),
    );
  }
}
