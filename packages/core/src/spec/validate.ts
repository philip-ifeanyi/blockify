import { ARMS, BEARDS, HAIR_STYLES, MOUTHS, SLEEVES, STYLES, DEFAULT_SPEC, type CharacterSpec } from './types';

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
  spec.arms = pick('arms', ARMS) ?? spec.arms;
  for (const k of ['glasses', 'lashes'] as const) {
    if (o[k] === undefined) continue;
    if (typeof o[k] !== 'boolean') throw new Error(`${k} must be a boolean`);
    spec[k] = o[k] as boolean;
  }
  if (o.lips !== undefined && o.lips !== null) {
    if (typeof o.lips !== 'string' || !HEX.test(o.lips)) throw new Error('lips must be a #rrggbb color');
    spec.lips = o.lips.toLowerCase();
  }
  return spec;
}
