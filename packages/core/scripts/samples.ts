import type { CharacterSpec } from '../src';

/** Hand-written specs covering each template; used by the try script and render tests. */
export const SAMPLES: Record<string, Partial<CharacterSpec>> = {
  default: {},
  afro: { skin: '#7a4a2c', hair: '#1c1410', hairStyle: 'afro', shirt: '#e8b23a', beard: 'full', eyes: '#2a1a10' },
  long: { skin: '#f0c8a8', hair: '#c9873a', hairStyle: 'long', shirt: '#4caf6e', glasses: true, eyes: '#3b6ea8', mouth: 'neutral' },
  buzz: { skin: '#a8714c', hair: '#2a2a2a', hairStyle: 'buzz', beard: 'stubble', shirt: '#222831', sleeves: 'long' },
  brick: { style: 'brick', hairStyle: 'medium', shirt: '#d64545', pants: '#3858b8' },
};
