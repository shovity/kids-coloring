"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sky from "./Sky";
import { asset, manifest, pageAsset, ui, type Pack } from "@/lib/manifest";
import { isMuted, play, preload, setMuted, startMusic, unlockAudio } from "@/lib/sound";
import { loadThumb, onStorageChange, paintedPages } from "@/lib/storage";

function usePackFromHash(): [string | null, (id: string | null) => void] {
  const [pack, setPack] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setPack(decodeURIComponent(location.hash.slice(1)) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((id: string | null) => {
    if (id) location.hash = id;
    else history.replaceState(null, "", location.pathname);
    setPack(id);
  }, []);
  return [pack, go];
}

export default function Menu() {
  const [packId, setPackId] = usePackFromHash();
  const [muted, setMutedState] = useState(false);
  const pack = manifest.packs.find((p) => p.id === packId) ?? null;

  useEffect(() => {
    setMutedState(isMuted());
    preload(["click", "choose_tap", "menu-to-gallery", "menu-to-menu"]);
    startMusic();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <>
      <Sky />
      <main className="menu">
        <header className="topbar">
          {pack ? (
            <button
              className="icon-btn"
              aria-label="Quay lại"
              onClick={() => {
                play("menu-to-menu");
                setPackId(null);
              }}
            >
              <img src={ui("button-back.png")} alt="" />
            </button>
          ) : null}
          <h1>{pack ? pack.title : "Bé Tô Màu"}</h1>
          <SoundButton muted={muted} onClick={toggleMute} />
        </header>
        {pack ? (
          <PageGrid pack={pack} />
        ) : (
          <PackList
            onOpen={(id) => {
              play("menu-to-gallery");
              setPackId(id);
            }}
          />
        )}
      </main>
    </>
  );
}

function PackList({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="packs">
      {manifest.packs.map((p) => (
        <button key={p.id} className="pack" onClick={() => onOpen(p.id)}>
          <div className="pack-bubble">
            <img src={asset(p.button)} alt="" />
            <div className="pack-art">
              <img src={pageAsset(p.pages[0].id, "thumb.png")} alt="" />
            </div>
          </div>
          <span className="pack-title">{p.title}</span>
        </button>
      ))}
    </div>
  );
}

function PageGrid({ pack }: { pack: Pack }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    const refresh = async () => {
      const painted = await paintedPages();
      const next: Record<string, string> = {};
      for (const p of pack.pages) {
        if (!painted.has(p.id)) continue;
        const blob = await loadThumb(p.id);
        if (blob) next[p.id] = URL.createObjectURL(blob);
      }
      if (!alive) return Object.values(next).forEach(URL.revokeObjectURL);
      urls.forEach(URL.revokeObjectURL);
      urls = Object.values(next);
      setThumbs(next);
    };
    void refresh();
    const off = onStorageChange(() => void refresh());
    return () => {
      alive = false;
      off();
      urls.forEach(URL.revokeObjectURL);
    };
  }, [pack]);

  return (
    <div className="pages">
      {pack.pages.map((p, i) => (
        <Link
          key={p.id}
          href={`/color/${p.id}/`}
          className={`page-card${thumbs[p.id] ? " painted" : ""}`}
          style={{ animationDelay: `${i * 30}ms` }}
          onClick={() => play("choose_tap")}
        >
          <img src={thumbs[p.id] ?? pageAsset(p.id, "thumb.png")} alt="" />
          {thumbs[p.id] && <span className="star">⭐</span>}
        </Link>
      ))}
    </div>
  );
}

function SoundButton({ muted, onClick }: { muted: boolean; onClick: () => void }) {
  return (
    <button
      className={`sound-btn${muted ? " muted" : ""}`}
      onClick={onClick}
      aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
    >
      <svg viewBox="0 0 48 48" aria-hidden>
        <path d="M8 18h7l10-8v28l-10-8H8z" fill="#fff" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        {muted ? (
          <path d="M32 18l10 12M42 18L32 30" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        ) : (
          <>
            <path d="M31 17a9 9 0 0 1 0 14" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M36 11a17 17 0 0 1 0 26" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
