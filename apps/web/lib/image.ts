import { Bitmap } from '@blockify/core';

/** Decodes any browser-supported image file into a Bitmap, honouring EXIF rotation (phone photos). */
export async function fileToBitmap(file: Blob, maxSize = 1024): Promise<Bitmap> {
  const src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSize / Math.max(src.width, src.height));
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);
  src.close();
  return new Bitmap(w, h, ctx.getImageData(0, 0, w, h).data);
}

export function bitmapToBlobUrl(bytes: Uint8Array, type: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
}

export function download(bytes: Uint8Array, filename: string, type: string): void {
  const url = bitmapToBlobUrl(bytes, type);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
