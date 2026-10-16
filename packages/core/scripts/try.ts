/**
 * Writes every output to ./out, from a photo or a built-in sample spec.
 *   pnpm try path/to/photo.jpg [--style brick] [--debug]
 *   pnpm try                    # all hand-written samples
 *   pnpm try afro long          # specific samples
 * --debug also writes <name>-debug.png showing which photo regions were sampled.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_SPEC, analyzePhoto, buildMosaic, encodeMosaic, renderMosaic, parseSpec, profilePic, skinFile, toPng, turntable, type CharacterSpec, type Style } from '../src';
import { createNodeDetector, readImage } from '../src/node';
import { SAMPLES } from './samples';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { style: { type: 'string' }, debug: { type: 'boolean', default: false } },
});
const style = values.style as Style | undefined;
if (style && style !== 'blocky' && style !== 'brick') throw new Error('--style must be blocky or brick');

const outDir = join(import.meta.dirname, '..', 'out');
mkdirSync(outDir, { recursive: true });

function writeOutputs(name: string, spec: CharacterSpec) {
  const t = performance.now();
  writeFileSync(join(outDir, `${name}-head.png`), profilePic(spec, { framing: 'head' }));
  writeFileSync(join(outDir, `${name}-bust.png`), profilePic(spec, { framing: 'bust' }));
  writeFileSync(join(outDir, `${name}-full.png`), profilePic(spec, { framing: 'full', background: 'transparent' }));
  if (spec.style === 'blocky') writeFileSync(join(outDir, `${name}-skin.png`), skinFile(spec));
  writeFileSync(join(outDir, `${name}-turntable.gif`), turntable(spec));
  writeFileSync(join(outDir, `${name}-spec.json`), JSON.stringify(spec, null, 2) + '\n');
  console.log(`${name}: rendered in ${(performance.now() - t).toFixed(0)}ms`);
}

const targets = positionals.length ? positionals : Object.keys(SAMPLES);
let detector: ReturnType<typeof createNodeDetector> | undefined;

for (const target of targets) {
  if (existsSync(target)) {
    detector ??= createNodeDetector();
    const name = basename(target, extname(target)) + (style ? `-${style}` : '');
    const t = performance.now();
    let res;
    try {
      res = await analyzePhoto(readImage(target), detector, { style, debug: values.debug });
    } catch (err) {
      // Report and move on; an uncaught error would trigger the wasm runtime's noisy crash handler.
      console.error(`${name}: ${err instanceof Error ? err.stack : err}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`${name}: analyzed in ${(performance.now() - t).toFixed(0)}ms`);
    for (const w of res.warnings) console.warn(`  ! ${w}`);
    const { scores, ...features } = res.features;
    console.log('  features:', JSON.stringify(features));
    console.log('  scores:  ', Object.entries(scores).map(([k, v]) => `${k}=${+v.toFixed(3)}`).join(' '));
    if (res.debugImage) writeFileSync(join(outDir, `${name}-debug.png`), toPng(res.debugImage));
    writeOutputs(name, res.spec);
    const mosaic = buildMosaic(res.image, res.face, { grid: 32 });
    for (const look of ['blocks', 'studs', 'flat'] as const)
      writeFileSync(join(outDir, `${name}-mosaic-${look}.png`), toPng(renderMosaic(mosaic, { size: 512, look })));
    console.log(`  mosaic: ${mosaic.grid}x${mosaic.grid}, ${mosaic.palette.length} colors, share code ${encodeMosaic(mosaic).length} chars`);
  } else {
    const sample = SAMPLES[target];
    if (!sample) throw new Error(`"${target}" is neither a file nor a sample (${Object.keys(SAMPLES).join(', ')})`);
    writeOutputs(target, parseSpec({ ...DEFAULT_SPEC, ...sample, ...(style ? { style } : {}) }));
  }
}
console.log(`Wrote outputs to ${outDir}`);
