import { mix, type RGBA } from '../util/color';
import type { Bitmap } from '../util/image';
import type { Point } from './types';

export interface Sample {
  colors: RGBA[];
  /** Fraction of the requested region that was inside the image. */
  inBounds: number;
}

/**
 * Samples pixels in a face-aligned coordinate frame, so regions follow head tilt:
 *   u: horizontal offset from the forehead-top landmark, in face widths (+u = image right)
 *   v: vertical offset from the forehead-top landmark, in face heights (+v = toward the chin)
 */
export class FaceSampler {
  readonly ux: Point;
  readonly uy: Point;

  constructor(
    readonly img: Bitmap,
    readonly origin: Point,
    right: Point,
    readonly faceWidth: number,
    readonly faceHeight: number,
    /** When set, every sampled region is tinted onto this bitmap for visual debugging. */
    readonly debug?: Bitmap,
  ) {
    const len = Math.hypot(right[0], right[1]);
    this.ux = [right[0] / len, right[1] / len];
    this.uy = [-this.ux[1], this.ux[0]];
  }

  toImage(u: number, v: number): Point {
    const du = u * this.faceWidth, dv = v * this.faceHeight;
    return [this.origin[0] + this.ux[0] * du + this.uy[0] * dv, this.origin[1] + this.ux[1] * du + this.uy[1] * dv];
  }

  /** Inverse of toImage: where an image point sits in face coordinates. */
  toFace([x, y]: Point): Point {
    const dx = x - this.origin[0], dy = y - this.origin[1];
    return [(dx * this.ux[0] + dy * this.ux[1]) / this.faceWidth, (dx * this.uy[0] + dy * this.uy[1]) / this.faceHeight];
  }

  /** Axis-aligned rectangle in face coordinates. */
  rect(u0: number, u1: number, v0: number, v1: number, tint: RGBA = [255, 0, 0, 255]): Sample {
    const step = Math.max(1, this.faceWidth / 60);
    const nu = Math.max(1, Math.round(((u1 - u0) * this.faceWidth) / step));
    const nv = Math.max(1, Math.round(((v1 - v0) * this.faceHeight) / step));
    const pts: Point[] = [];
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) pts.push(this.toImage(u0 + ((i + 0.5) / nu) * (u1 - u0), v0 + ((j + 0.5) / nv) * (v1 - v0)));
    if (this.debug) this.outline(u0, u1, v0, v1, tint);
    return this.points(pts, tint, false);
  }

  /** Draws the rectangle's border onto the debug image (a dotted fill is unreadable). */
  private outline(u0: number, u1: number, v0: number, v1: number, tint: RGBA) {
    const corners: Point[] = [this.toImage(u0, v0), this.toImage(u1, v0), this.toImage(u1, v1), this.toImage(u0, v1)];
    const thick = Math.max(1, Math.round(this.faceWidth / 120));
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = corners[k]!, [bx, by] = corners[(k + 1) % 4]!;
      const n = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let i = 0; i <= n; i++)
        for (let t = -thick; t <= thick; t++) {
          const x = Math.round(ax + ((bx - ax) * i) / n), y = Math.round(ay + ((by - ay) * i) / n) + t;
          if (x >= 0 && y >= 0 && x < this.debug!.width && y < this.debug!.height) this.debug!.set(x, y, tint);
        }
    }
  }

  /** Disc around an image-space point. `minR` carves out a hole (e.g. the pupil). */
  disc(center: Point, r: number, tint: RGBA = [0, 255, 0, 255], minR = 0): Sample {
    const pts: Point[] = [];
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= r && d >= minR) pts.push([center[0] + dx, center[1] + dy]);
      }
    return this.points(pts, tint);
  }

  private points(pts: Point[], tint: RGBA, paint = true): Sample {
    const colors: RGBA[] = [];
    for (const [fx, fy] of pts) {
      const x = Math.round(fx), y = Math.round(fy);
      if (x < 0 || y < 0 || x >= this.img.width || y >= this.img.height) continue;
      colors.push(this.img.get(x, y));
      if (paint && this.debug) this.debug.set(x, y, mix(this.debug.get(x, y), tint, 0.6));
    }
    return { colors, inBounds: pts.length ? colors.length / pts.length : 0 };
  }
}
