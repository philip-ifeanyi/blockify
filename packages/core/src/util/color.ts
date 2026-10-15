export type RGBA = [r: number, g: number, b: number, a: number];

export function parseHex(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function toHex([r, g, b]: RGBA): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Multiply RGB channels by `f` (f < 1 darkens, f > 1 lightens), clamped. */
export function shade([r, g, b, a]: RGBA, f: number): RGBA {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return [c(r), c(g), c(b), a];
}

export function mix(x: RGBA, y: RGBA, t: number): RGBA {
  const l = (p: number, q: number) => Math.round(p + (q - p) * t);
  return [l(x[0], y[0]), l(x[1], y[1]), l(x[2], y[2]), l(x[3], y[3])];
}

/** Deterministic per-pixel hash in [0, 1), used for texture noise. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type Lab = [L: number, a: number, b: number];

/** sRGB → CIELAB (D65). Used for perceptual color distances. */
export function toLab([r, g, b]: RGBA | [number, number, number, number?]): Lab {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 ΔE: ~2 is barely noticeable, ~10+ is clearly different, ~40+ is a different color family. */
export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Scales chroma around the pixel's own gray; f > 1 makes colors punchier. */
export function saturate([r, g, b, a]: RGBA, f: number): RGBA {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(gray + (v - gray) * f)));
  return [c(r), c(g), c(b), a];
}
