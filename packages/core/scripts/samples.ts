import type { CharacterSpec } from '../src';

/** Hand-written specs covering each template; used by the try script and render tests. */
export const SAMPLES: Record<string, Partial<CharacterSpec>> = {
  default: {},
  afro: { skin: '#7a4a2c', hair: '#1c1410', hairStyle: 'afro', shirt: '#e8b23a', beard: 'full', eyes: '#2a1a10' },
  long: { skin: '#f0c8a8', hair: '#c9873a', hairStyle: 'long', shirt: '#4caf6e', glasses: true, eyes: '#3b6ea8', mouth: 'neutral' },
  buzz: { skin: '#a8714c', hair: '#2a2a2a', hairStyle: 'buzz', beard: 'stubble', shirt: '#222831', sleeves: 'long' },
  brick: { style: 'brick', hairStyle: 'medium', shirt: '#d64545', pants: '#3858b8' },
  bun: { skin: '#e8b996', hair: '#2a1d18', hairStyle: 'bun', arms: 'slim', lashes: true, lips: '#c2465a', shirt: '#f2f2f2', eyes: '#5a3a22' },
  bob: { skin: '#8d5524', hair: '#140c08', hairStyle: 'bob', arms: 'slim', lashes: true, shirt: '#7b4fd6', mouth: 'neutral' },
  ponytail: { style: 'brick', skin: '#f1c27d', hair: '#a8652f', hairStyle: 'ponytail', arms: 'slim', lashes: true, lips: '#d9506a', shirt: '#2fa38a' },
};
