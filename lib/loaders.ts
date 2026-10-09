import { RegionMap } from "./paint/regionMap";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Không tải được ${src}`));
    img.src = src;
  });
}

/** Giải mã labels.png (grayscale) thành RegionMap, không qua chuyển đổi màu. */
export async function loadRegionMap(src: string): Promise<RegionMap> {
  const blob = await (await fetch(src)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
  const labels = new Uint8Array(c.width * c.height);
  for (let i = 0; i < labels.length; i++) labels[i] = rgba[i * 4];
  return new RegionMap(labels, c.width, c.height);
}

export async function blobToImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}
