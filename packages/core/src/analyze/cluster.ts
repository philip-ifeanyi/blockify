import { toLab, type Lab, type RGBA } from '../util/color';

export interface Cluster {
  color: RGBA;
  lab: Lab;
  /** Fraction of the input in this cluster. */
  share: number;
}

/**
 * Deterministic k-means in Lab space (farthest-point init), returning clusters largest-first.
 * Photos are noisy; the biggest cluster is a far more stable "color of this region" than a mean.
 */
export function clusterColors(colors: RGBA[], k = 3, iterations = 8): Cluster[] {
  if (colors.length === 0) return [];
  const labs = colors.map(toLab);
  k = Math.min(k, colors.length);

  const centers: Lab[] = [labs[0]!];
  while (centers.length < k) {
    let best = 0, bestD = -1;
    for (let i = 0; i < labs.length; i++) {
      const d = Math.min(...centers.map((c) => dist2(c, labs[i]!)));
      if (d > bestD) (bestD = d), (best = i);
    }
    centers.push(labs[best]!);
  }

  const assign = new Int32Array(labs.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < labs.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(centers[c]!, labs[i]!);
        if (d < bestD) (bestD = d), (best = c);
      }
      assign[i] = best;
    }
    for (let c = 0; c < k; c++) {
      const s: Lab = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < labs.length; i++)
        if (assign[i] === c) (s[0] += labs[i]![0]), (s[1] += labs[i]![1]), (s[2] += labs[i]![2]), n++;
      if (n) centers[c] = [s[0] / n, s[1] / n, s[2] / n];
    }
  }

  const out: Cluster[] = [];
  for (let c = 0; c < k; c++) {
    const members = colors.filter((_, i) => assign[i] === c);
    if (!members.length) continue;
    out.push({ color: medianColor(members), lab: centers[c]!, share: members.length / colors.length });
  }
  return out.sort((a, b) => b.share - a.share);
}

export function medianColor(colors: RGBA[]): RGBA {
  const med = (ch: number) => {
    const v = colors.map((c) => c[ch]!).sort((a, b) => a - b);
    return v[v.length >> 1]!;
  };
  return [med(0), med(1), med(2), 255];
}

const dist2 = (p: Lab, q: Lab) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
