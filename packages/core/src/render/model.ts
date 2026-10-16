import type { Arms, HairStyle, Style } from '../spec/types';
import { ACCESSORY_UV } from '../skin/paint';
import type { Rect } from '../skin/layout';
import { skinLayout, type BoxUV } from '../skin/layout';

export type Vec3 = [number, number, number];

/** A textured cuboid in world space (units = skin pixels, y up, character faces +z). */
export interface Part {
  uv: BoxUV;
  min: Vec3;
  size: Vec3;
  /** Outer layers are pushed out slightly so they sit just above the base layer. */
  inflate: number;
  /** Texture every face from this one rect instead of the box unwrap (render-only accessories). */
  uvRect?: Rect;
}

export type Framing = 'head' | 'bust' | 'full';

export interface Model {
  parts: Part[];
  /** World-space boxes the camera fits to for each framing. */
  frames: Record<Framing, { min: Vec3; max: Vec3 }>;
  /** [ambient, diffuse] lighting mix. */
  light: [number, number];
}

const p = (uv: BoxUV, min: Vec3, size: Vec3, inflate = 0): Part => ({ uv, min, size, inflate });

function blocky(arms: Arms): Model {
  const L = skinLayout(arms);
  const aw = arms === 'slim' ? 3 : 4;
  return {
    parts: [
      p(L.rightLeg, [-4, 0, -2], [4, 12, 4]),
      p(L.leftLeg, [0, 0, -2], [4, 12, 4]),
      p(L.body, [-4, 12, -2], [8, 12, 4]),
      p(L.rightArm, [-4 - aw, 12, -2], [aw, 12, 4]),
      p(L.leftArm, [4, 12, -2], [aw, 12, 4]),
      p(L.head, [-4, 24, -4], [8, 8, 8]),
      p(L.rightPants, [-4, 0, -2], [4, 12, 4], 0.25),
      p(L.leftPants, [0, 0, -2], [4, 12, 4], 0.25),
      p(L.jacket, [-4, 12, -2], [8, 12, 4], 0.25),
      p(L.rightSleeve, [-4 - aw, 12, -2], [aw, 12, 4], 0.25),
      p(L.leftSleeve, [4, 12, -2], [aw, 12, 4], 0.25),
      p(L.hat, [-4, 24, -4], [8, 8, 8], 0.5),
    ],
    frames: {
      head: { min: [-5, 23, -5], max: [5, 33, 5] },
      bust: { min: [-9, 15, -5], max: [9, 33, 5] },
      full: { min: [-8, 0, -4], max: [8, 32.5, 4] },
    },
    light: [0.55, 0.45],
  };
}

/** Chunkier, toy-like proportions: short limbs, wide torso, smaller head. */
function brick(arms: Arms): Model {
  const L = skinLayout(arms);
  const aw = arms === 'slim' ? 3 : 4;
  return {
    parts: [
      p(L.rightLeg, [-4, 0, -2], [4, 8, 4]),
      p(L.leftLeg, [0, 0, -2], [4, 8, 4]),
      p(L.body, [-4, 8, -2], [8, 8, 4]),
      p(L.rightArm, [-4 - aw, 8, -2], [aw, 8, 4]),
      p(L.leftArm, [4, 8, -2], [aw, 8, 4]),
      p(L.head, [-2.5, 16, -2.5], [5, 5, 5]),
      p(L.hat, [-2.5, 16, -2.5], [5, 5, 5], 0.35),
    ],
    frames: {
      head: { min: [-3.5, 15.5, -3.5], max: [3.5, 21.8, 3.5] },
      bust: { min: [-8.5, 9, -3.5], max: [8.5, 22, 3.5] },
      full: { min: [-8, 0, -3], max: [8, 21.5, 3] },
    },
    light: [0.72, 0.28],
  };
}

/**
 * Hair that sticks out of the head (which a 64x64 skin can't express): a knot on the crown, or a
 * tail hanging off the back. Coordinates are relative to the head box.
 */
function hairAccessories(hairStyle: HairStyle | undefined, head: { min: Vec3; size: number }): Part[] {
  const [hx, hy, hz] = head.min, s = head.size;
  const acc = (min: Vec3, size: Vec3): Part => ({ uv: { u: 0, v: 0, w: 0, h: 0, d: 0 }, min, size, inflate: 0, uvRect: ACCESSORY_UV });
  if (hairStyle === 'bun') return [acc([hx + s * 0.25, hy + s, hz + s * 0.1], [s * 0.5, s * 0.38, s * 0.45])];
  if (hairStyle === 'ponytail')
    return [
      acc([hx + s * 0.37, hy + s * 0.55, hz - s * 0.2], [s * 0.26, s * 0.26, s * 0.25]), // tie
      acc([hx + s * 0.31, hy - s * 0.25, hz - s * 0.3], [s * 0.38, s * 0.85, s * 0.22]), // tail
    ];
  return [];
}

export function modelFor(style: Style, arms: Arms = 'classic', hairStyle?: HairStyle): Model {
  const model = style === 'brick' ? brick(arms) : blocky(arms);
  const head = style === 'brick' ? { min: [-2.5, 16, -2.5] as Vec3, size: 5 } : { min: [-4, 24, -4] as Vec3, size: 8 };
  model.parts.push(...hairAccessories(hairStyle, head));
  return model;
}
