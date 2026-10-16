import { createHash } from 'node:crypto';
import { decode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEC,
  SKIN_LAYOUT,
  decodeSpec,
  encodeSpec,
  faceRect,
  skinLayout,
  paintSkin,
  parseSpec,
  profilePic,
  renderCharacter,
  skinFile,
  turntable,
} from '../src';
import { SAMPLES } from '../scripts/samples';

const spec = (o = {}) => parseSpec({ ...DEFAULT_SPEC, ...o });

describe('skin layout', () => {
  it('matches the standard 64x64 coordinates', () => {
    expect(faceRect(SKIN_LAYOUT.head, 'front')).toEqual({ x: 8, y: 8, w: 8, h: 8 });
    expect(faceRect(SKIN_LAYOUT.hat, 'front')).toEqual({ x: 40, y: 8, w: 8, h: 8 });
    expect(faceRect(SKIN_LAYOUT.body, 'front')).toEqual({ x: 20, y: 20, w: 8, h: 12 });
    expect(faceRect(SKIN_LAYOUT.rightArm, 'front')).toEqual({ x: 44, y: 20, w: 4, h: 12 });
    expect(faceRect(SKIN_LAYOUT.leftLeg, 'front')).toEqual({ x: 20, y: 52, w: 4, h: 12 });
    expect(faceRect(SKIN_LAYOUT.head, 'back')).toEqual({ x: 24, y: 8, w: 8, h: 8 });
  });
});

describe('slim arms', () => {
  it('uses 3px-wide arm boxes at the standard origins', () => {
    const slim = skinLayout('slim');
    expect(faceRect(slim.rightArm, 'front')).toEqual({ x: 44, y: 20, w: 3, h: 12 });
    expect(faceRect(slim.leftArm, 'back')).toEqual({ x: 43, y: 52, w: 3, h: 12 });
    // The 4th column of the classic arm front is left unpainted in a slim skin.
    expect(paintSkin(spec({ arms: 'slim' })).get(47 + 4 + 3, 20)[3]).toBe(0);
  });
});

describe('paintSkin', () => {
  it('puts skin color on the face and leaves unused regions transparent', () => {
    const bmp = paintSkin(spec({ style: 'brick' })); // brick is noise-free, so colors are exact
    expect(bmp.get(8 + 0, 8 + 7)).toEqual([0xc6, 0x88, 0x63, 255]); // bottom-left of face
    expect(bmp.get(0, 0)[3]).toBe(0); // unused corner
    expect(bmp.get(56, 16)[3]).toBe(0); // unused region right of the right arm
  });

  it('only draws the hat layer where needed', () => {
    const bald = paintSkin(spec({ hairStyle: 'bald' }));
    const hatFront = faceRect(SKIN_LAYOUT.hat, 'front');
    expect(bald.get(hatFront.x + 3, hatFront.y + 3)[3]).toBe(0);
    const glasses = paintSkin(spec({ glasses: true }));
    expect(glasses.get(hatFront.x + 0, hatFront.y + 4)[3]).toBe(255);
  });

  it('keeps render-only accessories out of the skin file', () => {
    const bun = spec({ hairStyle: 'bun' });
    expect(paintSkin(bun, { accessories: true }).get(56, 16)[3]).toBe(255);
    expect(decode(skinFile(bun)).data[(16 * 64 + 56) * 4 + 3]).toBe(0);
  });

  it('is deterministic', () => {
    expect(paintSkin(spec()).data).toEqual(paintSkin(spec()).data);
  });
});

describe('spec', () => {
  it('accepts the newer fields and still decodes older links without them', () => {
    expect(parseSpec({ arms: 'slim', lashes: true, lips: '#C2465A', hairStyle: 'ponytail' })).toMatchObject({
      arms: 'slim',
      lashes: true,
      lips: '#c2465a',
      hairStyle: 'ponytail',
    });
    const old = { v: 1, style: 'blocky', skin: '#c68863', hairStyle: 'short' }; // pre-arms/lashes/lips link
    expect(parseSpec(old)).toMatchObject({ arms: 'classic', lashes: false });
    expect(parseSpec(old).lips).toBeUndefined();
  });

  it('round-trips through the URL encoding', () => {
    const s = spec(SAMPLES.afro);
    expect(decodeSpec(encodeSpec(s))).toEqual(s);
  });

  it('rejects bad input', () => {
    expect(() => parseSpec({ skin: 'red' })).toThrow(/skin/);
    expect(() => parseSpec({ hairStyle: 'mohawk' })).toThrow(/hairStyle/);
    expect(() => parseSpec({ arms: 'wide' })).toThrow(/arms/);
    expect(() => parseSpec({ lips: 'pink' })).toThrow(/lips/);
    expect(() => parseSpec({ lashes: 'yes' })).toThrow(/lashes/);
    expect(() => parseSpec(null)).toThrow();
  });
});

describe('outputs', () => {
  it('writes a 64x64 skin PNG', () => {
    const png = decode(skinFile(spec()));
    expect([png.width, png.height, png.channels]).toEqual([64, 64, 4]);
  });

  it('refuses skin files for the brick style', () => {
    expect(() => skinFile(spec({ style: 'brick' }))).toThrow();
  });

  it('respects size and transparency', () => {
    const png = decode(profilePic(spec(), { size: 128, background: 'transparent' }));
    expect([png.width, png.height]).toEqual([128, 128]);
    expect(png.data[3]).toBe(0); // top-left corner is empty space
  });

  it('produces a GIF', () => {
    const gif = turntable(spec(), { frames: 4, size: 64 });
    expect(new TextDecoder().decode(gif.slice(0, 6))).toBe('GIF89a');
  });

  // Golden renders: if these change on purpose, review the images in ./out and run `vitest -u`.
  for (const [name, sample] of Object.entries(SAMPLES)) {
    for (const framing of ['head', 'full'] as const) {
      it(`renders ${name} (${framing}) stably`, () => {
        const bmp = renderCharacter(spec(sample), { size: 96, framing });
        expect(createHash('sha256').update(bmp.data).digest('hex').slice(0, 16)).toMatchSnapshot();
      });
    }
  }
});
