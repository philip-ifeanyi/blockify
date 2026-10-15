import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { DetectedFace, FaceDetector, Point } from '../analyze/types';
import type { Bitmap } from '../util/image';

const require = createRequire(import.meta.url);

// tfjs loads models with fetch(), and Node's fetch can't read file:// URLs. Teach it to, once.
let fetchPatched = false;
function patchFetchForFiles() {
  if (fetchPatched) return;
  fetchPatched = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('file://')) return new Response(await readFile(fileURLToPath(url)));
    return realFetch(input, init);
  }) as typeof fetch;
}

// Minimal shape of the parts of @vladmandic/human we use (its bundled types pull in DOM-only tfjs types).
interface HumanFace {
  score: number;
  box: [number, number, number, number];
  mesh: [number, number, number?][];
  rotation?: { angle: { yaw: number; pitch: number; roll: number } } | null;
}
interface Human {
  load(): Promise<void>;
  init(): Promise<void>;
  detect(input: unknown): Promise<{ face: HumanFace[]; error: string | null }>;
  tf: {
    tensor(data: Float32Array, shape: number[], dtype: 'float32'): { dispose(): void };
  };
}

let instance: Promise<Human> | null = null;

async function getHuman(): Promise<Human> {
  patchFetchForFiles();
  // human's package "exports" map doesn't expose the wasm build, so load it by path.
  const humanDir = dirname(dirname(require.resolve('@vladmandic/human')));
  const wasmDir = dirname(require.resolve('@tensorflow/tfjs-backend-wasm')); // .../dist, next to the .wasm files
  const { Human } = require(join(humanDir, 'dist/human.node-wasm.js')) as { Human: new (cfg: object) => Human };
  const human = new Human({
    backend: 'wasm',
    wasmPath: pathToFileURL(wasmDir).href + '/',
    modelBasePath: pathToFileURL(join(humanDir, 'models')).href + '/',
    debug: false,
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
    face: {
      enabled: true,
      detector: { maxDetected: 5, rotation: true },
      mesh: { enabled: true },
      iris: { enabled: true },
      emotion: { enabled: false },
      description: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
  });
  await human.load();
  await human.init();
  return human;
}

/**
 * Face detector for Node: @vladmandic/human on the WebAssembly backend (no native build needed).
 * Models ship inside the npm package, so this works offline. The first call takes a second or two to load.
 */
export function createNodeDetector(): FaceDetector {
  return {
    async detect(img: Bitmap): Promise<DetectedFace[]> {
      instance ??= getHuman();
      const human = await instance;
      const n = img.width * img.height;
      const rgb = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        rgb[i * 3] = img.data[i * 4]!;
        rgb[i * 3 + 1] = img.data[i * 4 + 1]!;
        rgb[i * 3 + 2] = img.data[i * 4 + 2]!;
      }
      const tensor = human.tf.tensor(rgb, [1, img.height, img.width, 3], 'float32');
      try {
        const res = await human.detect(tensor);
        if (res.error) throw new Error(`Face detection failed: ${res.error}`);
        return res.face
          .filter((f) => f.mesh.length >= 468)
          .map((f) => ({
            mesh: f.mesh.map(([x, y]) => [x, y] as Point),
            box: f.box,
            score: f.score,
            rotation: f.rotation?.angle,
          }));
      } finally {
        tensor.dispose();
      }
    },
  };
}
