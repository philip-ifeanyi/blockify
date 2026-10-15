import { readFileSync } from 'node:fs';
import { decode as decodePng } from 'fast-png';
import jpeg from 'jpeg-js';
import { Bitmap } from '../util/image';

/** Decodes a JPEG or PNG buffer into an RGBA bitmap (pure JS, no native deps). */
export function decodeImage(buf: Uint8Array): Bitmap {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
    return new Bitmap(img.width, img.height, new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length));
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const png = decodePng(buf);
    if (png.depth !== 8) throw new Error('Only 8-bit PNGs are supported');
    const rgba = new Bitmap(png.width, png.height);
    const src = png.data;
    const ch = png.channels;
    for (let i = 0, j = 0; i < png.width * png.height; i++, j += ch) {
      const gray = ch < 3;
      rgba.data[i * 4] = src[j]!;
      rgba.data[i * 4 + 1] = src[gray ? j : j + 1]!;
      rgba.data[i * 4 + 2] = src[gray ? j : j + 2]!;
      rgba.data[i * 4 + 3] = ch === 4 ? src[j + 3]! : ch === 2 ? src[j + 1]! : 255;
    }
    return rgba;
  }
  throw new Error('Unsupported image format (use JPEG or PNG)');
}

export function readImage(path: string): Bitmap {
  return decodeImage(readFileSync(path));
}
