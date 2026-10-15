import type { RGBA } from './color';

/** Minimal RGBA bitmap. Pure JS so it runs identically in the browser and Node. */
export class Bitmap {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number, data?: Uint8ClampedArray) {
    this.data = data ?? new Uint8ClampedArray(width * height * 4);
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.width + x) * 4;
    const d = this.data;
    return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
  }

  set(x: number, y: number, [r, g, b, a]: RGBA): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGBA | ((x: number, y: number) => RGBA)): void {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.set(i, j, typeof color === 'function' ? color(i, j) : color);
  }

  fill(color: RGBA): void {
    this.fillRect(0, 0, this.width, this.height, color);
  }
}

/** Box-filter downscale so the longest side is at most `max` (returns `src` if already small enough). */
export function downscale(src: Bitmap, max: number): Bitmap {
  const f = Math.max(src.width, src.height) / max;
  if (f <= 1) return src;
  const w = Math.round(src.width / f), h = Math.round(src.height / f);
  const dst = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * f), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * f), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let j = y0; j < y1; j++)
        for (let i = x0; i < x1; i++) {
          const k = (j * src.width + i) * 4;
          r += src.data[k]!, g += src.data[k + 1]!, b += src.data[k + 2]!, a += src.data[k + 3]!, n++;
        }
      dst.set(x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)]);
    }
  }
  return dst;
}
