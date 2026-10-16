import { toLab, type RGBA } from '../util/color';

export interface Quantized {
  palette: RGBA[];
  indices: Uint8Array;
}

/**
 * Reduces colors to at most `k` (median cut, then a few k-means passes in Lab so the palette
 * lands on perceptually meaningful colors). Deterministic: the same photo gives the same mosaic.
 */
export function quantize(colors: RGBA[], k: number): Quantized {
  k = Math.max(2, Math.min(64, Math.min(k, colors.length)));

  // --- Median cut for a well-spread starting palette ---
  let boxes: number[][] = [colors.map((_, i) => i)];
  while (boxes.length < k) {
    let best = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((box, bi) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const i of box) (lo = Math.min(lo, colors[i]![ch]!)), (hi = Math.max(hi, colors[i]![ch]!));
        // Weight by population so big regions (skin, background) get more shades than specks.
        const score = (hi - lo) * Math.sqrt(box.length);
        if (score > bestRange) (bestRange = score), (best = bi), (bestCh = ch);
      }
    });
    if (best < 0 || bestRange <= 0) break;
    const box = boxes[best]!.sort((a, b) => colors[a]![bestCh]! - colors[b]![bestCh]!);
    const mid = box.length >> 1;
    boxes = [...boxes.slice(0, best), box.slice(0, mid), box.slice(mid), ...boxes.slice(best + 1)];
  }

  const labs = colors.map(toLab);
  let centers = boxes.map((box) => meanLab(box.map((i) => labs[i]!)));
  const indices = new Uint8Array(colors.length);

  // --- k-means refinement ---
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < labs.length; i++) {
      let bestC = 0, bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const p = centers[c]!, q = labs[i]!;
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < bestD) (bestD = d), (bestC = c);
      }
      indices[i] = bestC;
    }
    centers = centers.map((old, c) => {
      const members: [number, number, number][] = [];
      for (let i = 0; i < labs.length; i++) if (indices[i] === c) members.push(labs[i]!);
      return members.length ? meanLab(members) : old;
    });
  }

  // Palette entries are the RGB mean of their members (exact, no Lab→RGB round trip needed).
  const sums = centers.map(() => [0, 0, 0, 0]);
  for (let i = 0; i < colors.length; i++) {
    const s = sums[indices[i]!]!, c = colors[i]!;
    (s[0]! += c[0]), (s[1]! += c[1]), (s[2]! += c[2]), s[3]!++;
  }
  const palette = sums.map(([r, g, b, n]) => (n ? [Math.round(r! / n), Math.round(g! / n), Math.round(b! / n), 255] : [0, 0, 0, 255]) as RGBA);
  return compact(palette, indices);
}

/** Drops unused palette entries and renumbers. */
function compact(palette: RGBA[], indices: Uint8Array): Quantized {
  const used = [...new Set(indices)].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  return { palette: used.map((i) => palette[i]!), indices: indices.map((i) => remap.get(i)!) };
}

function meanLab(labs: [number, number, number][]): [number, number, number] {
  const s = [0, 0, 0];
  for (const l of labs) (s[0]! += l[0]), (s[1]! += l[1]), (s[2]! += l[2]);
  return [s[0]! / labs.length, s[1]! / labs.length, s[2]! / labs.length];
}
