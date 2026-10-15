/**
 * The standard 64x64 Minecraft skin layout. Each box is unwrapped as:
 *
 *            [top ][bottom]
 *     [right][front][left ][back ]
 *
 * where "right"/"left" are the character's own right/left (viewer's left/right when facing it).
 */
export interface BoxUV {
  u: number;
  v: number;
  w: number;
  h: number;
  d: number;
}

export type FaceName = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';
export const FACES: readonly FaceName[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function faceRect({ u, v, w, h, d }: BoxUV, face: FaceName): Rect {
  switch (face) {
    case 'top':
      return { x: u + d, y: v, w, h: d };
    case 'bottom':
      return { x: u + d + w, y: v, w, h: d };
    case 'right':
      return { x: u, y: v + d, w: d, h };
    case 'front':
      return { x: u + d, y: v + d, w, h };
    case 'left':
      return { x: u + d + w, y: v + d, w: d, h };
    case 'back':
      return { x: u + 2 * d + w, y: v + d, w, h };
  }
}

const box = (u: number, v: number, w: number, h: number, d: number): BoxUV => ({ u, v, w, h, d });

export const SKIN_SIZE = 64;

export const SKIN_LAYOUT = {
  head: box(0, 0, 8, 8, 8),
  hat: box(32, 0, 8, 8, 8),
  body: box(16, 16, 8, 12, 4),
  jacket: box(16, 32, 8, 12, 4),
  rightArm: box(40, 16, 4, 12, 4),
  rightSleeve: box(40, 32, 4, 12, 4),
  leftArm: box(32, 48, 4, 12, 4),
  leftSleeve: box(48, 48, 4, 12, 4),
  rightLeg: box(0, 16, 4, 12, 4),
  rightPants: box(0, 32, 4, 12, 4),
  leftLeg: box(16, 48, 4, 12, 4),
  leftPants: box(0, 48, 4, 12, 4),
} as const;

export type PartName = keyof typeof SKIN_LAYOUT;
