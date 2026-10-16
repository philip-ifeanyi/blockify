import { faceRect, FACES, type FaceName } from '../skin/layout';
import { type RGBA } from '../util/color';
import { Bitmap } from '../util/image';
import type { Framing, Model, Part, Vec3 } from './model';

export interface RenderOptions {
  /** Output width/height in pixels. */
  size: number;
  framing: Framing;
  /** Degrees; 0 faces the camera, positive turns the character to its left. */
  yaw: number;
  /** Degrees; positive looks down from above. */
  pitch: number;
  /** '#rrggbb' or 'transparent'. */
  background: RGBA | null;
  /** Fraction of the image left empty around the framed region. */
  padding: number;
  /** Supersampling factor for anti-aliased edges. */
  ssaa: number;
}

interface Face {
  origin: Vec3; // world position of texel (0,0)
  u: Vec3; // edge along texture x
  v: Vec3; // edge along texture y
  normal: Vec3;
}

function faceGeometry(part: Part, face: FaceName): Face {
  const i = part.inflate;
  const [x0, y0, z0] = part.min.map((c) => c - i) as Vec3;
  const [sx, sy, sz] = part.size.map((c) => c + 2 * i) as Vec3;
  const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
  switch (face) {
    case 'front':
      return { origin: [x0, y1, z1], u: [sx, 0, 0], v: [0, -sy, 0], normal: [0, 0, 1] };
    case 'back':
      return { origin: [x1, y1, z0], u: [-sx, 0, 0], v: [0, -sy, 0], normal: [0, 0, -1] };
    case 'right':
      return { origin: [x0, y1, z0], u: [0, 0, sz], v: [0, -sy, 0], normal: [-1, 0, 0] };
    case 'left':
      return { origin: [x1, y1, z1], u: [0, 0, -sz], v: [0, -sy, 0], normal: [1, 0, 0] };
    case 'top':
      return { origin: [x0, y1, z0], u: [sx, 0, 0], v: [0, 0, sz], normal: [0, 1, 0] };
    case 'bottom':
      return { origin: [x0, y0, z1], u: [sx, 0, 0], v: [0, 0, -sz], normal: [0, -1, 0] };
  }
}

/** Orthographic camera: yaw about Y, then pitch about X. Returned z grows toward the viewer. */
function makeCamera(yawDeg: number, pitchDeg: number) {
  const a = (yawDeg * Math.PI) / 180, b = (pitchDeg * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return ([x, y, z]: Vec3): Vec3 => {
    const x1 = x * ca + z * sa;
    const z1 = -x * sa + z * ca;
    return [x1, y * cb - z1 * sb, y * sb + z1 * cb];
  };
}

const LIGHT: Vec3 = (() => {
  const l: Vec3 = [-0.45, 0.7, 0.55];
  const n = Math.hypot(...l);
  return l.map((c) => c / n) as Vec3;
})();

/** Draws `model` textured with `skin` into a new bitmap. */
export function rasterize(model: Model, skin: Bitmap, opts: RenderOptions): Bitmap {
  const ss = Math.max(1, Math.round(opts.ssaa));
  const W = opts.size * ss;
  const cam = makeCamera(opts.yaw, opts.pitch);

  // Fit the framing box (all 8 corners, projected) into the output with padding.
  const { min, max } = model.frames[opts.framing];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cx of [min[0], max[0]])
    for (const cy of [min[1], max[1]])
      for (const cz of [min[2], max[2]]) {
        const [px, py] = cam([cx, cy, cz]);
        minX = Math.min(minX, px), maxX = Math.max(maxX, px);
        minY = Math.min(minY, py), maxY = Math.max(maxY, py);
      }
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = (W * (1 - 2 * opts.padding)) / span;
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const toScreen = (p: Vec3): Vec3 => {
    const [x, y, z] = cam(p);
    return [W / 2 + (x - midX) * scale, W / 2 - (y - midY) * scale, z];
  };

  const out = new Bitmap(W, W);
  const zbuf = new Float32Array(W * W).fill(-Infinity);
  const [ambient, diffuse] = model.light;

  for (const part of model.parts) {
    for (const face of FACES) {
      const g = faceGeometry(part, face);
      const n = cam(g.normal);
      if (n[2] <= 1e-6) continue; // back-face cull
      const bright = ambient + diffuse * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);

      const o = toScreen(g.origin);
      const pu = toScreen([g.origin[0] + g.u[0], g.origin[1] + g.u[1], g.origin[2] + g.u[2]]);
      const pv = toScreen([g.origin[0] + g.v[0], g.origin[1] + g.v[1], g.origin[2] + g.v[2]]);
      const ax = pu[0] - o[0], ay = pu[1] - o[1], az = pu[2] - o[2];
      const bx = pv[0] - o[0], by = pv[1] - o[1], bz = pv[2] - o[2];
      const det = ax * by - ay * bx;
      if (Math.abs(det) < 1e-9) continue;

      const rect = part.uvRect ?? faceRect(part.uv, face);
      const xs = [o[0], pu[0], pv[0], pu[0] + bx];
      const ys = [o[1], pu[1], pv[1], pu[1] + by];
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(W - 1, Math.ceil(Math.max(...ys)));

      for (let py = y0; py <= y1; py++) {
        const dy = py + 0.5 - o[1];
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - o[0];
          const s = (dx * by - dy * bx) / det;
          const t = (ax * dy - ay * dx) / det;
          if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
          const z = o[2] + s * az + t * bz;
          const zi = py * W + px;
          if (z <= zbuf[zi]!) continue;
          const tx = rect.x + Math.min(rect.w - 1, Math.floor(s * rect.w));
          const ty = rect.y + Math.min(rect.h - 1, Math.floor(t * rect.h));
          const c = skin.get(tx, ty);
          if (c[3] < 128) continue; // overlay layers use cut-out transparency
          zbuf[zi] = z;
          out.set(px, py, [
            Math.min(255, Math.round(c[0] * bright)),
            Math.min(255, Math.round(c[1] * bright)),
            Math.min(255, Math.round(c[2] * bright)),
            255,
          ]);
        }
      }
    }
  }

  return composite(downsample(out, ss), opts.background);
}

function downsample(src: Bitmap, f: number): Bitmap {
  if (f === 1) return src;
  const w = src.width / f, h = src.height / f;
  const dst = new Bitmap(w, h);
  const n = f * f;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Premultiplied average so transparent samples don't darken edges.
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < f; j++)
        for (let i = 0; i < f; i++) {
          const c = src.get(x * f + i, y * f + j);
          r += c[0] * c[3], g += c[1] * c[3], b += c[2] * c[3], a += c[3];
        }
      dst.set(x, y, a ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)] : [0, 0, 0, 0]);
    }
  return dst;
}

function composite(img: Bitmap, bg: RGBA | null): Bitmap {
  if (!bg) return img;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255;
    d[i] = Math.round(d[i]! * a + bg[0] * (1 - a));
    d[i + 1] = Math.round(d[i + 1]! * a + bg[1] * (1 - a));
    d[i + 2] = Math.round(d[i + 2]! * a + bg[2] * (1 - a));
    d[i + 3] = 255;
  }
  return img;
}
