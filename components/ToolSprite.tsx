import type { CSSProperties } from "react";
import { ui } from "@/lib/manifest";
import type { ToolId } from "@/lib/paint/tools";

type Size = [number, number];

// Kích thước gốc (px) của từng lớp sprite: thân, phần nhận màu, viền sáng khi chọn
const SPRITES: Record<ToolId, { body: Size; ink: Size; inkMask: string; glow: Size }> = {
  pencil: { body: [241, 115], ink: [235, 108], inkMask: "pencil-color.png", glow: [250, 124] },
  marker: { body: [243, 121], ink: [236, 108], inkMask: "marker-color.png", glow: [252, 130] },
  brush: { body: [241, 138], ink: [235, 132], inkMask: "brush-color.png", glow: [250, 147] },
  fill: { body: [244, 139], ink: [238, 130], inkMask: "fill-color.png", glow: [254, 148] },
  shine: { body: [242, 114], ink: [234, 110], inkMask: "shine-select.png", glow: [251, 123] },
  pattern: { body: [241, 116], ink: [233, 111], inkMask: "pattern-select.png", glow: [250, 125] },
};

/** Đặt lớp có kích thước `s` vào giữa khung của lớp thân `b` (theo %). */
function place(s: Size, b: Size): CSSProperties {
  const w = (s[0] / b[0]) * 100;
  const h = (s[1] / b[1]) * 100;
  return { width: `${w}%`, height: `${h}%`, left: `${(100 - w) / 2}%`, top: `${(100 - h) / 2}%` };
}

export type Swatch = { color: string } | { texture: string };

export default function ToolSprite({
  tool,
  swatch,
  selected,
}: {
  tool: ToolId;
  swatch: Swatch;
  selected: boolean;
}) {
  const s = SPRITES[tool];
  const mask = `url(${ui(s.inkMask)})`;
  const ink: CSSProperties = {
    ...place(s.ink, s.body),
    WebkitMaskImage: mask,
    maskImage: mask,
    ...("color" in swatch ? { background: swatch.color } : { backgroundImage: `url(${swatch.texture})` }),
  };
  return (
    <div
      className={`tool-item${selected ? " selected" : ""}`}
      style={{ aspectRatio: `${s.body[0]} / ${s.body[1]}` }}
    >
      <img className="tool-glow" src={ui(`${tool}-select.png`)} alt="" style={place(s.glow, s.body)} />
      <div className="tool-ink" style={ink} />
      <img src={ui(`${tool}.png`)} alt="" style={{ inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
