import type { CharacterSpec, Style } from '../spec/types';
import { Bitmap, downscale } from '../util/image';
import { extractFeatures } from './features';
import { featuresToSpec } from './toSpec';
import type { DetectedFace, FaceDetector, Features } from './types';

export * from './types';
export { extractFeatures, LM } from './features';
export { featuresToSpec } from './toSpec';

export class NoFaceError extends Error {
  constructor() {
    super('No face found in the photo. Try a well-lit, front-facing picture.');
    this.name = 'NoFaceError';
  }
}

export interface AnalyzeOptions {
  style?: Style;
  /** Draw sampled regions onto a copy of the photo (returned as `debugImage`). */
  debug?: boolean;
  /** Photos are downscaled to this before detection; plenty for color sampling. */
  maxSize?: number;
}

export interface AnalyzeResult {
  spec: CharacterSpec;
  features: Features;
  face: DetectedFace;
  warnings: string[];
  /** The (downscaled) photo the face coordinates refer to; reused for the mosaic. */
  image: Bitmap;
  debugImage?: Bitmap;
}

/** Photo → CharacterSpec. Uses the largest face; warns about things that hurt accuracy. */
export async function analyzePhoto(photo: Bitmap, detector: FaceDetector, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const img = downscale(photo, opts.maxSize ?? 1024);
  const faces = await detector.detect(img);
  if (!faces.length) throw new NoFaceError();

  const area = (f: DetectedFace) => f.box[2] * f.box[3];
  const face = faces.reduce((a, b) => (area(b) > area(a) ? b : a));

  const warnings: string[] = [];
  if (faces.length > 1) warnings.push(`Found ${faces.length} faces; used the largest.`);
  if (face.box[2] < 80) warnings.push('The face is small in the photo, so details may be off. A closer photo works better.');
  if (face.rotation && Math.abs(face.rotation.yaw) > 0.45) warnings.push('The face is turned to the side. A front-facing photo works better.');

  const debugImage = opts.debug ? new Bitmap(img.width, img.height, img.data.slice()) : undefined;
  const features = extractFeatures(img, face, debugImage);
  return { spec: featuresToSpec(features, opts.style), features, face, warnings, image: img, debugImage };
}
