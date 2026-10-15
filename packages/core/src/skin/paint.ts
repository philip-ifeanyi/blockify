import type { CharacterSpec } from '../spec/types';
import { hash2, mix, parseHex, shade, type RGBA } from '../util/color';
import { Bitmap } from '../util/image';
import { faceRect, FACES, SKIN_LAYOUT, SKIN_SIZE, type BoxUV, type FaceName } from './layout';

/** (x, y) are local to the face; `front` is how many pixels this column is from the box's front edge (side faces only). */
type FacePainter = (x: number, y: number, ctx: { face: FaceName; w: number; h: number; front: number }) => RGBA | null;

const CLEAR: RGBA = [0, 0, 0, 0];
const FRAME: RGBA = [34, 34, 40, 255];
const WHITE: RGBA = [240, 240, 240, 255];

/** Absolute skin coordinates of the pixel currently being painted (used to seed texture noise). */
const cursor = { x: 0, y: 0 };

function paintBox(bmp: Bitmap, box: BoxUV, painter: FacePainter, faces: readonly FaceName[] = FACES) {
  for (const face of faces) {
    const r = faceRect(box, face);
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        // Right face runs back→front left-to-right; left face runs front→back.
        const front = face === 'right' ? r.w - 1 - x : face === 'left' ? x : -1;
        cursor.x = r.x + x;
        cursor.y = r.y + y;
        const c = painter(x, y, { face, w: r.w, h: r.h, front });
        if (c) bmp.set(r.x + x, r.y + y, c);
      }
  }
}

/** Is this head pixel covered by hair on the base (inner) layer? */
function hairOnHead(spec: CharacterSpec, face: FaceName, x: number, y: number, front: number): boolean {
  const s = spec.hairStyle;
  if (s === 'bald') return false;
  if (face === 'top') return true;
  if (face === 'bottom') return false;
  const edge = x === 0 || x === 7;
  if (face === 'front') {
    switch (s) {
      case 'buzz':
        return y === 0;
      case 'short':
        return y === 0 || (y === 1 && (x <= 2 || x === 7));
      case 'medium':
        return y <= 1 || (y <= 3 && edge);
      case 'long':
        return y <= 1 || edge;
      case 'afro':
        return y <= 1 || (y <= 4 && edge);
    }
  }
  if (face === 'back') {
    const rows = { buzz: 3, short: 6, medium: 7, long: 7, afro: 7 }[s];
    return y <= rows;
  }
  // Sides: leave the ear/temple area (near the front, middle rows) as skin.
  switch (s) {
    case 'buzz':
      return y === 0 || (y <= 3 && front >= 3);
    case 'short':
      return y <= 2 || (y <= 5 && front >= 4);
    case 'medium':
      return y <= 3 || (y <= 7 && front >= 4);
    case 'long':
      return y <= 2 || front >= 2;
    case 'afro':
      return y <= 5 || front >= 2;
  }
}

/** Extra volume drawn on the hat (outer) layer. */
function hairOnHat(spec: CharacterSpec, face: FaceName, x: number, y: number, front: number): boolean {
  switch (spec.hairStyle) {
    case 'afro':
      if (face === 'top' || face === 'back') return true;
      if (face === 'front') return y === 0;
      if (face === 'right' || face === 'left') return y <= 4 || front >= 3;
      return false;
    case 'long':
      if (face === 'back') return true;
      if (face === 'right' || face === 'left') return y <= 1 || front >= 3;
      if (face === 'front') return y === 0;
      return face === 'top';
    case 'medium':
      return face === 'back' && y <= 6;
    default:
      return false;
  }
}

export function paintSkin(spec: CharacterSpec): Bitmap {
  const bmp = new Bitmap(SKIN_SIZE, SKIN_SIZE);
  const blocky = spec.style === 'blocky';
  const L = SKIN_LAYOUT;

  const skin = parseHex(spec.skin);
  const hair = parseHex(spec.hair);
  const eyes = parseHex(spec.eyes);
  const shirt = parseHex(spec.shirt);
  const pants = parseHex(spec.pants);
  const shoes = parseHex(spec.shoes);

  // Blocky gets subtle per-pixel noise for that hand-painted texture; brick stays flat.
  const tex = (c: RGBA, amount = 0.08): RGBA =>
    blocky ? shade(c, 1 - amount / 2 + amount * hash2(cursor.x, cursor.y, 7)) : c;

  // --- Head ---
  const beardColor = mix(hair, skin, 0.15);
  paintBox(bmp, L.head, (x, y, { face, front }) => {
    if (hairOnHead(spec, face, x, y, front)) return tex(spec.hairStyle === 'buzz' ? mix(hair, skin, 0.3) : hair, 0.14);

    if (face === 'front') {
      if (blocky) {
        // Eyes: white on the outside, iris on the inside.
        if (y === 4 && (x === 1 || x === 6)) return WHITE;
        if (y === 4 && (x === 2 || x === 5)) return eyes;
        // Brows.
        if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6))
          return spec.hairStyle === 'bald' ? shade(skin, 0.8) : shade(hair, 0.9);
        // Nose.
        if (y === 5 && (x === 3 || x === 4)) return shade(skin, 0.88);
      } else {
        // Brick: classic smiley — tall black eyes.
        if ((y === 3 || y === 4) && (x === 2 || x === 5)) return [20, 20, 20, 255];
      }
      if (blocky) {
        const mouthDark = shade(skin, 0.55);
        if (spec.mouth === 'smile' && y === 6 && x >= 2 && x <= 5) return x === 2 || x === 5 ? shade(skin, 0.75) : mouthDark;
        if (spec.mouth === 'neutral' && y === 6 && (x === 3 || x === 4)) return mouthDark;
      } else {
        const ink: RGBA = [20, 20, 20, 255];
        if (spec.mouth === 'smile' && ((y === 5 && (x === 1 || x === 6)) || (y === 6 && x >= 2 && x <= 5))) return ink;
        if (spec.mouth === 'neutral' && y === 6 && x >= 3 && x <= 4) return ink;
      }

      if (spec.beard === 'full' && (y === 7 || (y === 6 && (x <= 1 || x >= 6)) || (y === 5 && (x === 0 || x === 7))))
        return tex(beardColor, 0.14);
      if (spec.beard === 'stubble' && y >= 6) return tex(mix(skin, beardColor, 0.35));
    }
    if ((face === 'right' || face === 'left') && spec.beard === 'full' && y >= 5 && front <= 1) return tex(beardColor, 0.14);
    return tex(skin, 0.05);
  });

  // Hat layer: transparent except hair volume and glasses.
  paintBox(bmp, L.hat, (x, y, { face, front }) => {
    if (hairOnHat(spec, face, x, y, front)) return tex(shade(hair, 1.08), 0.16);
    if (spec.glasses) {
      if (face === 'front' && ((y === 3 && x !== 0 && x !== 7 && x !== 3 && x !== 4) || (y === 4 && [0, 3, 4, 7].includes(x))))
        return FRAME;
      if ((face === 'right' || face === 'left') && y === 4 && front <= 3) return FRAME;
    }
    return CLEAR;
  });

  // --- Torso ---
  paintBox(bmp, L.body, (x, y, { face }) => {
    // Crew-neck collar showing a little skin.
    if (face === 'front' && y === 0 && (x === 3 || x === 4)) return tex(skin, 0.05);
    if (face === 'front' && y === 11) return tex(shade(pants, 0.85)); // belt line
    return tex(face === 'bottom' ? pants : shirt);
  });
  paintBox(bmp, L.jacket, (x, y, { face }) =>
    spec.hairStyle === 'long' && face === 'back' && y <= 2 ? tex(shade(hair, 1.08), 0.16) : CLEAR,
  );

  // --- Arms ---
  const sleeveRows = spec.sleeves === 'long' ? 11 : 4;
  const arm: FacePainter = (_x, y, { face }) => {
    if (face === 'top') return tex(shirt);
    if (face === 'bottom') return tex(skin, 0.05);
    return y < sleeveRows ? tex(y === sleeveRows - 1 ? shade(shirt, 0.9) : shirt) : tex(skin, 0.05);
  };
  paintBox(bmp, L.rightArm, arm);
  paintBox(bmp, L.leftArm, arm);

  // --- Legs ---
  const leg: FacePainter = (_x, y, { face }) => {
    if (face === 'top') return tex(pants);
    if (face === 'bottom') return tex(shade(shoes, 0.8));
    return y >= 9 ? tex(y === 11 ? shade(shoes, 0.8) : shoes) : tex(pants);
  };
  paintBox(bmp, L.rightLeg, leg);
  paintBox(bmp, L.leftLeg, leg);

  // Remaining overlay layers stay transparent (Bitmap starts zeroed).
  return bmp;
}
