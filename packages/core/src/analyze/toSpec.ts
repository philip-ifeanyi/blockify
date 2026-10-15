import { DEFAULT_SPEC, type CharacterSpec, type Style } from '../spec/types';
import { deltaE, saturate, shade, toHex, toLab, type RGBA } from '../util/color';
import type { Features } from './types';

/** Readable eye colors: raw iris samples are usually too dark/muddy to read at 1 pixel. */
const EYE_PALETTE: Record<string, RGBA> = {
  darkBrown: [59, 35, 20, 255],
  brown: [104, 64, 34, 255],
  hazel: [122, 106, 58, 255],
  green: [79, 122, 74, 255],
  blue: [61, 111, 168, 255],
  gray: [109, 123, 134, 255],
};

function snapEyes(c: RGBA): RGBA {
  // Compare on hue/chroma only; iris brightness mostly reflects lighting.
  const [, a, b] = toLab(c);
  let best = EYE_PALETTE.darkBrown!, bestD = Infinity;
  for (const p of Object.values(EYE_PALETTE)) {
    const [, pa, pb] = toLab(p);
    const d = Math.hypot(a - pa, b - pb);
    if (d < bestD) (bestD = d), (best = p);
  }
  return best;
}

/** Turns photo measurements into a stylized character: slightly punchier colors, readable details. */
export function featuresToSpec(f: Features, style: Style = 'blocky'): CharacterSpec {
  const skin = saturate(f.skin, 1.08);
  let hair = f.hair ?? f.beardColor ?? DEFAULT_SPEC.hair;
  if (typeof hair !== 'string') {
    hair = saturate(hair, 1.1);
    // Hair that nearly matches the skin vanishes on an 8px face; push it darker.
    if (deltaE(toLab(hair), toLab(skin)) < 12) hair = shade(hair, 0.75);
  }

  const shirt = f.shirt ? saturate(f.shirt, 1.15) : null;

  return {
    ...DEFAULT_SPEC,
    style,
    skin: toHex(skin),
    hair: typeof hair === 'string' ? hair : toHex(hair),
    eyes: f.eyes ? toHex(snapEyes(f.eyes)) : DEFAULT_SPEC.eyes,
    shirt: shirt ? toHex(shirt) : DEFAULT_SPEC.shirt,
    hairStyle: f.hairStyle,
    beard: f.beard,
    glasses: f.glasses,
    mouth: f.mouth,
  };
}
