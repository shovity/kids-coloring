"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import ToolSprite, { type Swatch } from "./ToolSprite";
import { findPage, manifest, pageAsset, ui } from "@/lib/manifest";
import { blobToImage, loadImage, loadRegionMap } from "@/lib/loaders";
import { PaintEngine, type Ink } from "@/lib/paint/engine";
import { isStrokeTool, PATTERN_COUNT, SHINE_COUNT, toCanvas, TOOLS, type ToolId } from "@/lib/paint/tools";
import { play, preload, stopMusic, unlockAudio } from "@/lib/sound";
import { loadPaint, savePaint } from "@/lib/storage";

const COLORS = manifest.colors;
const shineUrl = (i: number) => ui(`shine-${i + 1}.jpg`);
const patternUrl = (i: number) => ui(`cg-pattern${i + 1}.png`);
const SHINE_SCALE = 0.7;
const PATTERN_SCALE = 0.8;
const PALM_GUARD_MS = 1500;
const SAVE_DELAY_MS = 1200;
const PREFS_KEY = "bimi-prefs";

type Prefs = { tool: ToolId; color: number; shine: number; pattern: number };
const DEFAULT_PREFS: Prefs = { tool: "marker", color: 1, shine: 1, pattern: 0 };

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Ảnh texture dùng chung giữa các lần mở tranh
const textures = new Map<string, HTMLImageElement>();
function texture(url: string): HTMLImageElement | null {
  const hit = textures.get(url);
  if (hit?.complete && hit.naturalWidth) return hit;
  if (!hit) {
    const img = new Image();
    img.src = url;
    textures.set(url, img);
  }
  return null;
}

export default function ColoringScreen({ pageId }: { pageId: string }) {
  const router = useRouter();
  const found = findPage(pageId)!;
  const backHref = `/#${found.pack.id}`;

  const paintRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PaintEngine | null>(null);
  const outlineRef = useRef<HTMLImageElement | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastPen = useRef(0);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [confirmClear, setConfirmClear] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // ---------- Lưu ----------

  const save = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const engine = engineRef.current;
    if (!engine || !dirty.current || !outlineRef.current) return;
    dirty.current = false;
    try {
      const [paint, thumb] = await Promise.all([engine.exportPaint(), engine.exportThumb(outlineRef.current)]);
      await savePaint(pageId, paint, thumb);
    } catch (err) {
      dirty.current = true;
      console.warn("Không lưu được tranh", err);
    }
  }, [pageId]);

  // ---------- Tải tranh ----------

  useEffect(() => {
    let alive = true;
    stopMusic();
    setPrefs(readPrefs());
    preload(["fill", "color", "swoosh", "click", "end", "badge", "push"]);
    (async () => {
      const [map, outline, saved] = await Promise.all([
        loadRegionMap(pageAsset(pageId, "labels.png")),
        loadImage(pageAsset(pageId, "outline.png")),
        loadPaint(pageId),
      ]);
      if (!alive) return;
      const engine = new PaintEngine(map, paintRef.current!, overlayRef.current!);
      if (saved) engine.load(await blobToImage(saved));
      engine.onChange = () => {
        dirty.current = true;
        setCanUndo(engine.canUndo);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
      };
      engineRef.current = engine;
      outlineRef.current = outline;
      setReady(true);
      play("appear", 0.5);
    })();

    const flush = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      const engine = engineRef.current;
      void save().finally(() => engine?.dispose());
    };
  }, [pageId, save]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
    // Tải trước texture khi chọn công cụ kim tuyến / họa tiết
    if (prefs.tool === "shine") for (let i = 0; i < SHINE_COUNT; i++) texture(shineUrl(i));
    if (prefs.tool === "pattern") for (let i = 0; i < PATTERN_COUNT; i++) texture(patternUrl(i));
  }, [prefs]);

  // ---------- Mực theo công cụ ----------

  const currentInk = (): Ink => {
    if (prefs.tool === "shine") {
      const img = texture(shineUrl(prefs.shine));
      return img ? { kind: "texture", image: img, scale: SHINE_SCALE } : { kind: "color", color: COLORS[prefs.shine] };
    }
    if (prefs.tool === "pattern") {
      const img = texture(patternUrl(prefs.pattern));
      return img ? { kind: "texture", image: img, scale: PATTERN_SCALE } : { kind: "color", color: "#ccc" };
    }
    return { kind: "color", color: COLORS[prefs.color] };
  };

  const swatchFor = (tool: ToolId, index?: number): Swatch => {
    if (tool === "shine") return { texture: shineUrl(index ?? prefs.shine) };
    if (tool === "pattern") return { texture: patternUrl(index ?? prefs.pattern) };
    return { color: COLORS[index ?? prefs.color] };
  };

  // ---------- Thao tác vẽ ----------

  const point = (e: { clientX: number; clientY: number }) => {
    const engine = engineRef.current!;
    const rect = paintRef.current!.getBoundingClientRect();
    return toCanvas(e.clientX, e.clientY, rect, engine.width, engine.height);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine || activePointer.current !== null) return;
    unlockAudio();
    if (e.pointerType === "pen") lastPen.current = Date.now();
    // Chặn lòng bàn tay chạm màn hình khi đang dùng Apple Pencil
    else if (e.pointerType === "touch" && Date.now() - lastPen.current < PALM_GUARD_MS) return;
    const pt = point(e);
    if (isStrokeTool(prefs.tool)) {
      if (engine.beginStroke(prefs.tool, currentInk(), pt, e.pressure, e.pointerType)) {
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } else if (engine.fillAt(pt, currentInk())) {
      play("fill");
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointer.current) return;
    if (e.pointerType === "pen") lastPen.current = Date.now();
    const native = e.nativeEvent;
    const events = native.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [native]) {
      engineRef.current?.moveStroke(point(ev), ev.pressure);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointer.current) return;
    if (e.pointerType === "pen") lastPen.current = Date.now();
    activePointer.current = null;
    engineRef.current?.endStroke();
  };

  // ---------- Nút ----------

  const goHome = async () => {
    play("click");
    await save();
    router.push(backHref);
  };

  const finish = async () => {
    play("end");
    const saving = save();
    const thumb = outlineRef.current && (await engineRef.current?.exportThumb(outlineRef.current, 720));
    if (thumb) setDone(URL.createObjectURL(thumb));
    setTimeout(() => play("badge"), 400);
    await saving;
  };

  const selectTool = (tool: ToolId) => {
    play("swoosh", 0.6);
    setPrefs((p) => ({ ...p, tool }));
  };

  const selectSwatch = (index: number) => {
    play("color", 0.6);
    setPrefs((p) =>
      p.tool === "shine"
        ? { ...p, shine: index }
        : p.tool === "pattern"
          ? { ...p, pattern: index }
          : { ...p, color: index },
    );
  };

  const paletteCount = prefs.tool === "pattern" ? PATTERN_COUNT : prefs.tool === "shine" ? SHINE_COUNT : COLORS.length;
  const paletteSelected = prefs.tool === "pattern" ? prefs.pattern : prefs.tool === "shine" ? prefs.shine : prefs.color;

  return (
    <main className="coloring">
      <nav className="side">
        <button className="icon-btn" aria-label="Về menu" onClick={goHome}>
          <img src={ui("button-back.png")} alt="" />
        </button>
        <button
          className="icon-btn"
          aria-label="Hoàn tác"
          disabled={!canUndo}
          onClick={() => {
            play("click");
            engineRef.current?.undo();
          }}
        >
          <span className="undo-btn">
            <img src={ui("back.png")} alt="" />
          </span>
        </button>
        <button
          className="icon-btn"
          aria-label="Xóa hết"
          onClick={() => {
            play("click");
            setConfirmClear(true);
          }}
        >
          <img src={ui("button-trash.png")} alt="" />
        </button>
        <div className="spacer" />
        <button className="icon-btn" aria-label="Xong" onClick={finish} disabled={!ready}>
          <img src={ui("button-save.png")} alt="" />
        </button>
      </nav>

      <div className="stage-wrap">
        <div
          className={`stage${ready ? "" : " loading"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={paintRef} />
          <canvas ref={overlayRef} />
          <img src={pageAsset(pageId, "outline.png")} alt="" />
        </div>
      </div>

      <Palette
        key={prefs.tool}
        count={paletteCount}
        selected={paletteSelected}
        render={(i) => <ToolSprite tool={prefs.tool} swatch={swatchFor(prefs.tool, i)} selected={i === paletteSelected} />}
        onSelect={selectSwatch}
      />

      <div className="tools">
        {TOOLS.map((t) => (
          <button key={t} aria-label={t} onClick={() => selectTool(t)}>
            <ToolSprite tool={t} swatch={swatchFor(t)} selected={t === prefs.tool} />
          </button>
        ))}
      </div>

      {confirmClear && (
        <div className="celebrate" onClick={() => setConfirmClear(false)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <img src={ui("button-trash.png")} alt="" className="confirm-icon" />
            <div className="confirm-actions">
              <button
                aria-label="Xóa"
                onClick={() => {
                  play("push");
                  engineRef.current?.clear();
                  setConfirmClear(false);
                }}
              >
                <img src={ui("button-yes.png")} alt="" />
              </button>
              <button
                aria-label="Không xóa"
                onClick={() => {
                  play("click");
                  setConfirmClear(false);
                }}
              >
                <img src={ui("button-no.png")} alt="" />
              </button>
            </div>
          </div>
        </div>
      )}

      {done && <Celebrate image={done} onClose={() => router.push(backHref)} />}
    </main>
  );
}

function Palette({
  count,
  selected,
  render,
  onSelect,
}: {
  count: number;
  selected: number;
  render: (i: number) => React.ReactNode;
  onSelect: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Cuộn tới màu đang chọn khi đổi công cụ
    const el = ref.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="palette" ref={ref}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} onClick={() => onSelect(i)} aria-label={`Màu ${i + 1}`}>
          {render(i)}
        </button>
      ))}
    </div>
  );
}

function Celebrate({ image, onClose }: { image: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(image);
    };
  }, [image, onClose]);
  const sparkles = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const d = 220 + (i % 3) * 90;
    return (
      <span
        key={i}
        className="sparkle"
        style={
          {
            left: "50%",
            top: "50%",
            fontSize: 28 + (i % 4) * 10,
            animationDelay: `${(i % 6) * 0.08}s`,
            "--dx": `${Math.cos(a) * d}px`,
            "--dy": `${Math.sin(a) * d}px`,
          } as React.CSSProperties
        }
      >
        {i % 2 ? "⭐" : "✨"}
      </span>
    );
  });
  return (
    <div className="celebrate" onClick={onClose}>
      <div className="frame">
        <img src={image} alt="Tranh đã tô" />
      </div>
      {sparkles}
    </div>
  );
}
