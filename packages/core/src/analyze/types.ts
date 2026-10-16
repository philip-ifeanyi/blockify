import type { Beard, HairStyle, Mouth } from '../spec/types';
import type { RGBA } from '../util/color';
import type { Bitmap } from '../util/image';

export type Point = [x: number, y: number];

/** One detected face: the 478-point MediaPipe face mesh (468 face + 10 iris), in image pixels. */
export interface DetectedFace {
  mesh: Point[];
  /** [x, y, width, height] in image pixels. */
  box: [number, number, number, number];
  score: number;
  /** Head rotation in radians, when the detector provides it. */
  rotation?: { yaw: number; pitch: number; roll: number };
}

/**
 * Pluggable face detector so the analysis stays isomorphic: Node uses `createNodeDetector()`
 * (@blockify/core/node), the browser wraps the same library with a WebGL backend.
 */
export interface FaceDetector {
  detect(image: Bitmap): Promise<DetectedFace[]>;
}

/** What we measured from the photo, before it's turned into a stylized spec. */
export interface Features {
  skin: RGBA;
  hair: RGBA | null;
  hairStyle: HairStyle;
  eyes: RGBA | null;
  beard: Beard;
  beardColor: RGBA | null;
  glasses: boolean;
  mouth: Mouth;
  /** Set only when the lips stand out clearly from the skin (e.g. lipstick). */
  lips: RGBA | null;
  shirt: RGBA | null;
  /** Raw measurements behind the decisions above; handy for tuning thresholds. */
  scores: Record<string, number>;
}
