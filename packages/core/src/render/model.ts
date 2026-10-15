import type { Style } from '../spec/types';
import { SKIN_LAYOUT, type BoxUV } from '../skin/layout';

export type Vec3 = [number, number, number];

/** A textured cuboid in world space (units = skin pixels, y up, character faces +z). */
export interface Part {
  uv: BoxUV;
  min: Vec3;
  size: Vec3;
  /** Outer layers are pushed out slightly so they sit just above the base layer. */
  inflate: number;
}

export type Framing = 'head' | 'bust' | 'full';

export interface Model {
  parts: Part[];
  /** World-space boxes the camera fits to for each framing. */
  frames: Record<Framing, { min: Vec3; max: Vec3 }>;
  /** [ambient, diffuse] lighting mix. */
  light: [number, number];
}

const L = SKIN_LAYOUT;
const p = (uv: BoxUV, min: Vec3, size: Vec3, inflate = 0): Part => ({ uv, min, size, inflate });

function blocky(): Model {
  return {
    parts: [
      p(L.rightLeg, [-4, 0, -2], [4, 12, 4]),
      p(L.leftLeg, [0, 0, -2], [4, 12, 4]),
      p(L.body, [-4, 12, -2], [8, 12, 4]),
      p(L.rightArm, [-8, 12, -2], [4, 12, 4]),
      p(L.leftArm, [4, 12, -2], [4, 12, 4]),
      p(L.head, [-4, 24, -4], [8, 8, 8]),
      p(L.rightPants, [-4, 0, -2], [4, 12, 4], 0.25),
      p(L.leftPants, [0, 0, -2], [4, 12, 4], 0.25),
      p(L.jacket, [-4, 12, -2], [8, 12, 4], 0.25),
      p(L.rightSleeve, [-8, 12, -2], [4, 12, 4], 0.25),
      p(L.leftSleeve, [4, 12, -2], [4, 12, 4], 0.25),
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
function brick(): Model {
  return {
    parts: [
      p(L.rightLeg, [-4, 0, -2], [4, 8, 4]),
      p(L.leftLeg, [0, 0, -2], [4, 8, 4]),
      p(L.body, [-4, 8, -2], [8, 8, 4]),
      p(L.rightArm, [-8, 8, -2], [4, 8, 4]),
      p(L.leftArm, [4, 8, -2], [4, 8, 4]),
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

export function modelFor(style: Style): Model {
  return style === 'brick' ? brick() : blocky();
}
