import data from "@/public/game/manifest.json";

export type PageInfo = { id: string; width: number; height: number; regions: number; decor: number };
export type Pack = { id: string; title: string; button: string; icon: string; pages: PageInfo[] };
export type Manifest = { packs: Pack[]; colors: string[] };

export const manifest = data as Manifest;

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const GAME = `${BASE}/game`;
export const asset = (path: string) => `${GAME}/${path}`;
export const ui = (name: string) => asset(`ui/${encodeURIComponent(name)}`);

export function findPage(pageId: string): { pack: Pack; page: PageInfo; index: number } | null {
  for (const pack of manifest.packs) {
    const index = pack.pages.findIndex((p) => p.id === pageId);
    if (index >= 0) return { pack, page: pack.pages[index], index };
  }
  return null;
}

export const pageAsset = (pageId: string, file: "outline.png" | "labels.png" | "thumb.png") =>
  asset(`pages/${pageId}/${file}`);
