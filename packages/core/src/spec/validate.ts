import { BEARDS, HAIR_STYLES, MOUTHS, SLEEVES, STYLES, DEFAULT_SPEC, type CharacterSpec } from './types';

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS = ['skin', 'hair', 'eyes', 'shirt', 'pants', 'shoes'] as const;

/** Validates untrusted input (API bodies, share links) into a CharacterSpec, filling defaults. */
export function parseSpec(input: unknown): CharacterSpec {
  if (typeof input !== 'object' || input === null) throw new Error('Spec must be an object');
  const o = input as Record<string, unknown>;
  const spec: CharacterSpec = { ...DEFAULT_SPEC };

  for (const k of COLOR_KEYS) {
    if (o[k] === undefined) continue;
    if (typeof o[k] !== 'string' || !HEX.test(o[k] as string)) throw new Error(`${k} must be a #rrggbb color`);
    spec[k] = (o[k] as string).toLowerCase();
  }
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    if (o[key] === undefined) return undefined;
    if (!allowed.includes(o[key] as T)) throw new Error(`${key} must be one of ${allowed.join(', ')}`);
    return o[key] as T;
  };
  spec.style = pick('style', STYLES) ?? spec.style;
  spec.hairStyle = pick('hairStyle', HAIR_STYLES) ?? spec.hairStyle;
  spec.beard = pick('beard', BEARDS) ?? spec.beard;
  spec.mouth = pick('mouth', MOUTHS) ?? spec.mouth;
  spec.sleeves = pick('sleeves', SLEEVES) ?? spec.sleeves;
  if (o.glasses !== undefined) {
    if (typeof o.glasses !== 'boolean') throw new Error('glasses must be a boolean');
    spec.glasses = o.glasses;
  }
  return spec;
}
