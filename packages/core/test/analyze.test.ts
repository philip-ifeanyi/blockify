import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Bitmap,
  NoFaceError,
  analyzePhoto,
  buildMosaic,
  decodeMosaic,
  encodeMosaic,
  featuresToSpec,
  renderMosaic,
  type Beard,
  type Features,
  type HairStyle,
} from '../src';
import { createNodeDetector, decodeImage, readImage } from '../src/node';
import { toPng } from '../src';

const photos = join(import.meta.dirname, 'fixtures', 'photos');

/**
 * Hand-labelled expectations. Where a photo is genuinely ambiguous, several answers are accepted.
 * `knownMiss` documents current failures (they run as `it.fails`, so fixing one flags it here).
 */
const LABELS: Record<string, { hair: HairStyle[]; beard: Beard[]; glasses: boolean; lips?: true; knownMiss?: 'hair' }> = {
  'afro-woman': { hair: ['afro'], beard: ['none'], glasses: false },
  'beard-white-shirt': { hair: ['buzz', 'short'], beard: ['full'], glasses: false },
  'black-crew-man': { hair: ['bald', 'buzz'], beard: ['none', 'stubble'], glasses: false },
  'black-frames': { hair: ['short', 'medium'], beard: ['full'], glasses: true },
  'closeup-woman': { hair: ['long'], beard: ['none'], glasses: false, lips: true }, // red lipstick
  'glasses-turtleneck': { hair: ['short', 'medium'], beard: ['none'], glasses: true },
  'henley-man': { hair: ['short'], beard: ['none', 'stubble'], glasses: false },
  'long-blonde': { hair: ['long'], beard: ['none'], glasses: false, knownMiss: 'hair' },
  'smiling-woman': { hair: ['bun'], beard: ['none'], glasses: false },
  'vneck-man': { hair: ['short'], beard: ['none', 'stubble'], glasses: false },
  'white-beard': { hair: ['long', 'medium'], beard: ['full'], glasses: false },
};

describe('analyzePhoto on fixture portraits', { timeout: 60_000 }, () => {
  const detector = createNodeDetector();

  for (const [name, want] of Object.entries(LABELS)) {
    const run = want.knownMiss ? it.fails : it;
    run(`reads ${name}`, async () => {
      const { features: f, spec } = await analyzePhoto(readImage(join(photos, `${name}.jpg`)), detector);
      expect(want.hair).toContain(f.hairStyle);
      expect(want.beard).toContain(f.beard);
      expect(f.glasses).toBe(want.glasses);
      // Natural lips keep the default mouth; only clearly colored lips are picked up.
      expect(!!f.lips).toBe(!!want.lips);
      expect(!!spec.lips).toBe(!!want.lips);
      expect(spec.hairStyle).toBe(f.hairStyle);
    });
  }

  it('throws NoFaceError when there is no face', async () => {
    const blank = new Bitmap(320, 240);
    blank.fill([120, 160, 200, 255]);
    await expect(analyzePhoto(blank, detector)).rejects.toBeInstanceOf(NoFaceError);
  });
});

describe('featuresToSpec', () => {
  const base: Features = {
    skin: [141, 85, 36, 255],
    hair: null,
    hairStyle: 'bald',
    eyes: [40, 70, 120, 255],
    beard: 'full',
    beardColor: [60, 40, 30, 255],
    glasses: true,
    mouth: 'smile',
    lips: null,
    shirt: null,
    scores: {},
  };

  it('snaps iris samples to a readable palette color', () => {
    expect(featuresToSpec(base).eyes).toBe('#3d6fa8'); // blue
  });

  it('uses the beard color for hair when bald, and defaults the shirt', () => {
    const spec = featuresToSpec(base, 'brick');
    expect(spec).toMatchObject({ style: 'brick', hairStyle: 'bald', beard: 'full', glasses: true, shirt: '#3a7bd5' });
    expect(spec.hair).not.toBe('#3b2414');
  });
});

describe('decodeImage', () => {
  it('round-trips a PNG', () => {
    const bmp = new Bitmap(3, 2);
    bmp.set(1, 1, [10, 20, 30, 255]);
    const back = decodeImage(toPng(bmp));
    expect([back.width, back.height]).toEqual([3, 2]);
    expect(back.get(1, 1)).toEqual([10, 20, 30, 255]);
  });

  it('rejects unknown formats', () => {
    expect(() => decodeImage(new Uint8Array([1, 2, 3, 4]))).toThrow(/Unsupported/);
  });
});

describe('mosaic', () => {
  it('builds from a photo, round-trips through a share code, and renders any size', async () => {
    const { image, face } = await analyzePhoto(readImage(join(photos, 'henley-man.jpg')), createNodeDetector());
    const m = buildMosaic(image, face, { grid: 24, colors: 12 });
    expect(m.grid).toBe(24);
    expect(m.cells.length).toBe(24 * 24);
    expect(m.palette.length).toBeLessThanOrEqual(12);
    expect(Math.max(...m.cells)).toBeLessThan(m.palette.length);

    const back = decodeMosaic(encodeMosaic(m));
    expect(back.palette).toEqual(m.palette);
    expect([...back.cells]).toEqual([...m.cells]);

    for (const look of ['blocks', 'studs', 'flat'] as const) {
      const bmp = renderMosaic(m, { size: 500, look }); // 500 isn't a multiple of 24
      expect([bmp.width, bmp.height]).toEqual([500, 500]);
      expect(bmp.get(499, 499)[3]).toBe(255); // fully covered, no gaps at the edge
    }
  }, 60_000);

  it('rejects corrupted share codes', () => {
    expect(() => decodeMosaic('AAAA')).toThrow();
  });
});
