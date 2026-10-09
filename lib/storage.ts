import { createStore, del, get, keys, set } from "idb-keyval";

// Lưu tranh đã tô ngay trên thiết bị (IndexedDB). Lưu dạng ArrayBuffer vì một số bản
// WebKit không lưu được Blob vào IndexedDB.
const store =
  typeof indexedDB !== "undefined"
    ? createStore("kids-coloring", "artworks")
    : undefined;

type Stored = { type: string; data: ArrayBuffer };

async function put(key: string, blob: Blob): Promise<void> {
  await set(
    key,
    { type: blob.type, data: await blob.arrayBuffer() } satisfies Stored,
    store,
  );
}

async function take(key: string): Promise<Blob | undefined> {
  const v = await get<Stored>(key, store);
  return v ? new Blob([v.data], { type: v.type }) : undefined;
}

export async function savePaint(
  pageId: string,
  paint: Blob,
  thumb: Blob,
): Promise<void> {
  await put(`paint:${pageId}`, paint);
  await put(`thumb:${pageId}`, thumb);
  notify();
}

export const loadPaint = (pageId: string) => take(`paint:${pageId}`);
export const loadThumb = (pageId: string) => take(`thumb:${pageId}`);

export async function removePaint(pageId: string): Promise<void> {
  await del(`paint:${pageId}`, store);
  await del(`thumb:${pageId}`, store);
  notify();
}

/** Các pageId đã có tranh tô. */
export async function paintedPages(): Promise<Set<string>> {
  const all = (await keys(store)) as string[];
  return new Set(
    all.filter((k) => k.startsWith("thumb:")).map((k) => k.slice(6)),
  );
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function onStorageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
