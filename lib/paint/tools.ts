export type ToolId = "pencil" | "marker" | "brush" | "shine" | "fill" | "pattern";
export type StrokeTool = "pencil" | "marker" | "brush" | "shine";

/** Thứ tự công cụ trên panel (giống game gốc). */
export const TOOLS: ToolId[] = ["pencil", "marker", "brush", "shine", "fill", "pattern"];

export const PATTERN_COUNT = 20;
export const SHINE_COUNT = 40;

export const isStrokeTool = (t: ToolId): t is StrokeTool => t !== "fill" && t !== "pattern";

/** Cỡ nét theo pixel của canvas tranh (1346px). */
export const STROKE_SIZE: Record<StrokeTool, number> = {
  pencil: 14,
  marker: 34,
  brush: 64,
  shine: 48,
};

/** Hệ số áp lực bút: Apple Pencil cho phép nét đậm/nhạt; ngón tay luôn = 1. */
export function pressureScale(tool: StrokeTool, pressure: number, pointerType: string): number {
  if (pointerType !== "pen" || pressure <= 0) return 1;
  const p = Math.min(1, Math.max(0, pressure));
  return tool === "brush" ? 0.45 + p * 0.9 : 0.75 + p * 0.5;
}

export type Pt = { x: number; y: number };

/** Các điểm đặt dấu dọc đoạn from→to, cách nhau `spacing`; trả về điểm cuối cùng đã đặt. */
export function dabs(from: Pt, to: Pt, spacing: number): Pt[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < spacing) return [];
  const n = Math.floor(len / spacing);
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = (i * spacing) / len;
    out.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  return out;
}

/** Chuyển tọa độ màn hình sang pixel canvas. */
export function toCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
): Pt {
  return {
    x: ((clientX - rect.left) / rect.width) * width,
    y: ((clientY - rect.top) / rect.height) * height,
  };
}
