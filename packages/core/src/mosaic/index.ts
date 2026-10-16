import type { DetectedFace } from '../analyze/types';
import { hash2, saturate, shade, type RGBA } from '../util/color';
import { Bitmap } from '../util/image';
import { quantize } from './quantize';

/** A photo rebuilt from N×N flat-colored cells. Small and plain, so it can live in a share link. */
export interface Mosaic {
  v: 1;
  grid: number;
  palette: RGBA[];
  /** grid*grid palette indices, row-major. */
  cells: Uint8Array;
}

export type MosaicCrop = 'head' | 'bust';
export type MosaicLook = 'blocks' | 'studs' | 'flat';

export const MOSAIC_GRIDS = [16, 24, 32, 48, 64] as const;

export interface BuildMosaicOptions {
  /** Cells per side. */
  grid?: number;
  /** Maximum palette size. Fewer colors = more "built from blocks", more = more photographic. */
  colors?: number;
  crop?: MosaicCrop;
}

/** Square crop around the face: head only, or head and shoulders. Clamped to the image. */
export function mosaicCrop(img: Bitmap, face: DetectedFace, crop: MosaicCrop = 'bust') {
  const m = face.mesh;
  const top = m[10]!, chin = m[152]!, l = m[234]!, r = m[454]!;
  const faceH = Math.hypot(chin[0] - top[0], chin[1] - top[1]);
  const cx = (l[0] + r[0]) / 2;
  const midY = (top[1] + chin[1]) / 2;
  // Landmark 10 is the hairline, not the top of the head: leave ~0.6 face-heights above it for hair.
  // head: hair to just under the chin (1.85 fh); bust: hair to mid-chest (2.8 fh).
  const side = Math.min(crop === 'head' ? faceH * 1.85 : faceH * 2.8, img.width, img.height);
  const cy = crop === 'head' ? midY - faceH * 0.175 : midY + faceH * 0.25;
  const x = Math.min(Math.max(0, cx - side / 2), img.width - side);
  const y = Math.min(Math.max(0, cy - side / 2), img.height - side);
  return { x, y, side };
}

export function buildMosaic(img: Bitmap, face: DetectedFace, opts: BuildMosaicOptions = {}): Mosaic {
  const grid = Math.max(8, Math.min(96, Math.round(opts.grid ?? 32)));
  const { x, y, side } = mosaicCrop(img, face, opts.crop);
  const cell = side / grid;

  // Box-average each cell (exact area sampling, so fine detail averages rather than aliases).
  const colors: RGBA[] = [];
  for (let j = 0; j < grid; j++)
    for (let i = 0; i < grid; i++) {
      const x0 = Math.floor(x + i * cell), x1 = Math.max(x0 + 1, Math.floor(x + (i + 1) * cell));
      const y0 = Math.floor(y + j * cell), y1 = Math.max(y0 + 1, Math.floor(y + (j + 1) * cell));
      let rs = 0, gs = 0, bs = 0, n = 0;
      for (let py = y0; py < Math.min(y1, img.height); py++)
        for (let px = x0; px < Math.min(x1, img.width); px++) {
          const k = (py * img.width + px) * 4;
          (rs += img.data[k]!), (gs += img.data[k + 1]!), (bs += img.data[k + 2]!), n++;
        }
      // A touch more saturation reads as "toy blocks" instead of "blurry photo".
      colors.push(saturate([Math.round(rs / n), Math.round(gs / n), Math.round(bs / n), 255], 1.12));
    }

  autoContrast(colors);

  const { palette, indices } = quantize(colors, opts.colors ?? 20);
  return { v: 1, grid, palette, cells: indices };
}

/**
 * Stretches brightness so the 3rd–97th percentile spans the full range (gain capped at 1.5).
 * Small cells average away contrast, which flattens eyes and mouths on pale or low-key photos.
 */
function autoContrast(colors: RGBA[]) {
  const luma = (c: RGBA) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const sorted = colors.map(luma).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.03)]!, hi = sorted[Math.floor(sorted.length * 0.97)]!;
  const gain = Math.min(1.5, 255 / Math.max(1, hi - lo));
  if (gain <= 1.02) return;
  const mid = (lo + hi) / 2;
  for (const c of colors)
    for (let ch = 0; ch < 3; ch++) c[ch] = Math.max(0, Math.min(255, Math.round(127.5 + (c[ch]! - mid) * gain)));
}

export interface RenderMosaicOptions {
  size?: number;
  look?: MosaicLook;
}

/** Draws the mosaic as beveled blocks, round studs, or flat pixels. */
export function renderMosaic(mosaic: Mosaic, opts: RenderMosaicOptions = {}): Bitmap {
  const size = Math.max(16, Math.min(2048, Math.round(opts.size ?? 512)));
  const look = opts.look ?? 'blocks';
  const { grid } = mosaic;
  const out = new Bitmap(size, size);
  // Cell edges at round(i * size / grid): any requested size works, cells differ by at most 1px.
  const edge = (i: number) => Math.round((i * size) / grid);

  for (let j = 0; j < grid; j++)
    for (let i = 0; i < grid; i++) {
      const base = mosaic.palette[mosaic.cells[j * grid + i]!] ?? [0, 0, 0, 255];
      const x0 = edge(i), x1 = edge(i + 1), y0 = edge(j), y1 = edge(j + 1);
      const w = x1 - x0, h = y1 - y0;
      const bevel = Math.max(1, Math.round(Math.min(w, h) * 0.12));
      const r = Math.min(w, h) * 0.32, ring = Math.max(1, Math.min(w, h) * 0.07);
      const jitter = 0.97 + 0.06 * hash2(i, j, 3); // blocks aren't all perfectly identical

      for (let py = y0; py < y1; py++)
        for (let px = x0; px < x1; px++) {
          const lx = px - x0, ly = py - y0;
          let c = base;
          if (look === 'blocks') {
            c = shade(base, jitter);
            if (lx < bevel || ly < bevel) c = shade(base, 1.16);
            if (lx >= w - bevel || ly >= h - bevel) c = shade(base, 0.76);
          } else if (look === 'studs') {
            // Thin grout line, then a round stud lit from the top-left.
            if (lx === w - 1 || ly === h - 1) c = shade(base, 0.8);
            const dx = lx + 0.5 - w / 2, dy = ly + 0.5 - h / 2, d = Math.hypot(dx, dy);
            if (d < r) c = d > r - ring ? shade(base, dx + dy < 0 ? 1.22 : 0.78) : shade(base, 1.04);
            else if (d < r + ring && dx + dy > 0) c = shade(base, 0.86); // stud shadow
          }
          out.set(px, py, c);
        }
    }
  return out;
}

// --- Compact encoding for share links: [v, grid, k, palette rgb…, bit-packed cells] ---

export function encodeMosaic(m: Mosaic): string {
  const k = m.palette.length;
  const bits = Math.max(1, Math.ceil(Math.log2(k)));
  const header = [1, m.grid, k, ...m.palette.flatMap(([r, g, b]) => [r, g, b])];
  const packed = new Uint8Array(Math.ceil((m.cells.length * bits) / 8));
  m.cells.forEach((c, i) => {
    for (let b = 0; b < bits; b++) if ((c >> b) & 1) packed[(i * bits + b) >> 3]! |= 1 << ((i * bits + b) & 7);
  });
  const bytes = new Uint8Array([...header, ...packed]);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeMosaic(encoded: string): Mosaic {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const [v, grid, k] = bytes;
  if (v !== 1 || !grid || !k || grid < 8 || grid > 96) throw new Error('Invalid mosaic data');
  const palette: RGBA[] = [];
  for (let i = 0; i < k; i++) palette.push([bytes[3 + i * 3]!, bytes[4 + i * 3]!, bytes[5 + i * 3]!, 255]);
  const bits = Math.max(1, Math.ceil(Math.log2(k)));
  const off = 3 + k * 3;
  if (bytes.length < off + Math.ceil((grid * grid * bits) / 8)) throw new Error('Invalid mosaic data');
  const cells = new Uint8Array(grid * grid);
  for (let i = 0; i < cells.length; i++) {
    let c = 0;
    for (let b = 0; b < bits; b++) if (bytes[off + ((i * bits + b) >> 3)]! & (1 << ((i * bits + b) & 7))) c |= 1 << b;
    if (c >= k) throw new Error('Invalid mosaic data');
    cells[i] = c;
  }
  return { v: 1, grid, palette, cells };
}

