import type { Bitmap, DetectedFace, FaceDetector, Point } from '@blockify/core';

type HumanInstance = {
  load(): Promise<void>;
  init(): Promise<void>;
  detect(input: ImageData): Promise<{
    error: string | null;
    face: { score: number; box: [number, number, number, number]; mesh: number[][]; rotation?: { angle: { yaw: number; pitch: number; roll: number } } | null }[];
  }>;
};

let instance: Promise<HumanInstance> | null = null;

async function getHuman(): Promise<HumanInstance> {
  // ~3MB including TensorFlow.js, so it's only fetched once someone actually picks a photo.
  const { Human } = await import('@vladmandic/human');
  const human = new Human({
    backend: 'webgl',
    modelBasePath: '/models/',
    debug: false,
    cacheSensitivity: 0,
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
    filter: { enabled: false },
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
  }) as unknown as HumanInstance;
  await human.load();
  await human.init();
  return human;
}

/** Starts downloading the models early (e.g. when the user opens the file picker). */
export function preloadDetector(): void {
  instance ??= getHuman();
}

/** Same detector as the Node one in @blockify/core/node, on the browser's WebGL backend. */
export const browserDetector: FaceDetector = {
  async detect(img: Bitmap): Promise<DetectedFace[]> {
    instance ??= getHuman();
    let human: HumanInstance;
    try {
      human = await instance;
    } catch (err) {
      instance = null; // let the next attempt retry the download
      throw err;
    }
    const res = await human.detect(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height));
    if (res.error) throw new Error(`Face detection failed: ${res.error}`);
    return res.face
      .filter((f) => f.mesh.length >= 468)
      .map((f) => ({
        mesh: f.mesh.map(([x, y]) => [x!, y!] as Point),
        box: f.box,
        score: f.score,
        rotation: f.rotation?.angle,
      }));
  },
};
