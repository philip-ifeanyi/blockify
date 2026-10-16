/// <reference path="../gifenc.d.ts" />
import { encode as encodePng } from 'fast-png';
import * as gifencModule from 'gifenc';
import { modelFor, type Framing } from '../render/model';
import { rasterize, type RenderOptions } from '../render/rasterize';
import { paintSkin } from '../skin/paint';
import type { CharacterSpec } from '../spec/types';
import { parseHex } from '../util/color';
import type { Bitmap } from '../util/image';

// gifenc ships CJS (Node sees only `default` = module.exports) and ESM (named exports, plus
// `default` = the GIFEncoder function), so pick whichever object actually has the named functions.
const gifenc = ('quantize' in gifencModule ? gifencModule : (gifencModule as { default: unknown }).default) as typeof gifencModule;
const { GIFEncoder, applyPalette, quantize } = gifenc;

export interface RenderParams {
  size?: number;
  framing?: Framing;
  yaw?: number;
  pitch?: number;
  /** '#rrggbb' or 'transparent'. */
  background?: string;
  padding?: number;
}

export const DEFAULT_BACKGROUND = '#9fd8f5';

function renderOptions(p: RenderParams, defaults: Partial<RenderOptions>): RenderOptions {
  const bg = p.background ?? DEFAULT_BACKGROUND;
  return {
    size: clampInt(p.size ?? defaults.size ?? 512, 16, 2048),
    framing: p.framing ?? defaults.framing ?? 'head',
    yaw: p.yaw ?? defaults.yaw ?? 25,
    pitch: p.pitch ?? defaults.pitch ?? 15,
    background: bg === 'transparent' ? null : parseHex(bg),
    padding: p.padding ?? defaults.padding ?? 0.1,
    ssaa: defaults.ssaa ?? 3,
  };
}

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

export function toPng(bmp: Bitmap): Uint8Array {
  return encodePng({ width: bmp.width, height: bmp.height, data: bmp.data, channels: 4, depth: 8 });
}

/** Renders the character to a bitmap (for previews, or further processing). */
export function renderCharacter(spec: CharacterSpec, params: RenderParams = {}): Bitmap {
  return rasterize(modelFor(spec.style, spec.arms, spec.hairStyle), paintSkin(spec, { accessories: true }), renderOptions(params, {}));
}

/** Square avatar PNG, framed so it survives a circular crop. */
export function profilePic(spec: CharacterSpec, params: RenderParams = {}): Uint8Array {
  return toPng(renderCharacter(spec, params));
}

/** A 64x64 skin PNG in the standard (1.8+) layout, importable into Minecraft. */
export function skinFile(spec: CharacterSpec): Uint8Array {
  if (spec.style !== 'blocky') throw new Error('Skin files are only available for the blocky style');
  return toPng(paintSkin(spec));
}

export interface TurntableParams extends Omit<RenderParams, 'yaw' | 'background'> {
  frames?: number;
  /** Milliseconds per frame. */
  delay?: number;
  /** GIF has no partial alpha, so the turntable always gets a solid background. */
  background?: string;
}

/** Looping GIF of the character spinning 360°. */
export function turntable(spec: CharacterSpec, params: TurntableParams = {}): Uint8Array {
  const frames = clampInt(params.frames ?? 24, 4, 72);
  const model = modelFor(spec.style, spec.arms, spec.hairStyle);
  const skin = paintSkin(spec, { accessories: true });
  const base = renderOptions(
    { ...params, background: params.background === 'transparent' ? undefined : params.background },
    { size: 256, framing: 'full', pitch: 10, ssaa: 2 },
  );

  const gif = GIFEncoder();
  for (let i = 0; i < frames; i++) {
    // Keep the camera fit constant across frames so the character doesn't "breathe".
    const bmp = rasterize(model, skin, { ...base, yaw: (360 * i) / frames });
    const palette = quantize(bmp.data, 256);
    gif.writeFrame(applyPalette(bmp.data, palette), bmp.width, bmp.height, { palette, delay: params.delay ?? 80 });
  }
  gif.finish();
  return gif.bytes();
}
