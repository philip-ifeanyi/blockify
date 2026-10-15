import type { HairStyle } from '../spec/types';
import { deltaE, toLab, type Lab, type RGBA } from '../util/color';
import type { Bitmap } from '../util/image';
import { clusterColors, medianColor } from './cluster';
import { FaceSampler } from './sampler';
import type { DetectedFace, Features, Point } from './types';

/** MediaPipe face-mesh landmark indices we rely on. */
export const LM = {
  foreheadTop: 10,
  chin: 152,
  faceRight: 234, // subject's right = image left
  faceLeft: 454,
  cheekRight: 50,
  cheekLeft: 280,
  foreheadMid: 151,
  noseBridge: 168,
  noseMid: 6,
  noseDorsum: 195,
  noseBase: 2,
  upperLipTop: 0,
  upperLipInner: 13,
  lowerLipInner: 14,
  lowerLipBottom: 17,
  mouthRight: 61,
  mouthLeft: 291,
  irisRight: 468, // 469–472 ring
  irisLeft: 473, // 474–477 ring
} as const;

// Debug tints for each sampled region.
const T = {
  skin: [255, 220, 0, 255],
  hair: [255, 0, 255, 255],
  volume: [160, 0, 255, 255],
  side: [0, 160, 255, 255],
  long: [0, 80, 255, 255],
  beard: [255, 90, 0, 255],
  glasses: [0, 255, 0, 255],
  eyes: [0, 255, 255, 255],
  shirt: [255, 0, 0, 255],
  ref: [128, 128, 128, 255],
} satisfies Record<string, RGBA>;

export function extractFeatures(img: Bitmap, face: DetectedFace, debug?: Bitmap): Features {
  const m = face.mesh;
  const p = (i: number): Point => m[i]!;
  if (m.length < 468) throw new Error('Face mesh must have at least 468 landmarks');

  const right: Point = [p(LM.faceLeft)[0] - p(LM.faceRight)[0], p(LM.faceLeft)[1] - p(LM.faceRight)[1]];
  const faceWidth = Math.hypot(right[0], right[1]);
  const probe = new FaceSampler(img, p(LM.foreheadTop), right, faceWidth, 1);
  const faceHeight = Math.max(1, probe.toFace(p(LM.chin))[1]);
  const S = new FaceSampler(img, p(LM.foreheadTop), right, faceWidth, faceHeight, debug);
  const v = (i: number) => S.toFace(p(i))[1];
  const scores: Record<string, number> = { faceWidth, faceHeight };

  // --- Background: dominant colors along the top and upper sides of the image ---
  const bgPx: RGBA[] = [];
  const stepX = Math.max(1, Math.floor(img.width / 80)), stepY = Math.max(1, Math.floor(img.height / 80));
  const edge = Math.max(2, Math.round(Math.min(img.width, img.height) * 0.03));
  for (let x = 0; x < img.width; x += stepX) for (let y = 0; y < edge; y++) bgPx.push(img.get(x, y));
  for (let y = 0; y < img.height * 0.6; y += stepY)
    for (let x = 0; x < edge; x++) bgPx.push(img.get(x, Math.floor(y)), img.get(img.width - 1 - x, Math.floor(y)));
  const background = clusterColors(bgPx, 3).filter((c) => c.share >= 0.15).map((c) => c.lab);

  // --- Skin: median of each patch (cheeks, forehead, nose), then the second-darkest patch ---
  // The darkest patch is usually a shadowed cheek; the brightest ones are highlights or background
  // creeping in on a turned head. This never "lightens" a face beyond what it actually looks like.
  const r = faceWidth * 0.09;
  const patches = [
    S.disc(p(LM.cheekRight), r, T.skin).colors,
    S.disc(p(LM.cheekLeft), r, T.skin).colors,
    S.disc(p(LM.foreheadMid), r * 0.8, T.skin).colors,
    S.disc(p(LM.noseDorsum), r * 0.5, T.skin).colors,
  ].map((cs) =>
    cs.filter((c) => {
      // Drop highlights, and background showing through when the head is turned.
      const lab = toLab(c);
      return lab[0] < 95 && background.every((bgLab) => deltaE(lab, bgLab) > 15);
    }),
  );
  const skinPx = patches.flat();
  const patchMedians = patches.filter((cs) => cs.length).map(medianColor).sort((x, y) => toLab(x)[0] - toLab(y)[0]);
  const skin: RGBA = patchMedians[Math.min(1, patchMedians.length - 1)] ?? [198, 136, 99, 255];
  const skinLab = toLab(skin);
  // Lit and shaded variants of the skin. Clusters far from the chosen tone are something else
  // caught in a patch (a beard over the cheek, a fringe over the forehead) and are dropped.
  const skinTones = clusterColors(skinPx, 3)
    .filter((c) => c.share >= 0.15 && deltaE(c.lab, skinLab) < 22)
    .map((c) => c.lab);
  skinTones.push(skinLab);
  const nearSkin = (lab: Lab, d: number) => skinTones.some((t) => deltaE(lab, t) <= d);
  const notSkin = (c: RGBA) => !nearSkin(toLab(c), 18);

  // --- Hair ---
  // The band above the hairline landmark is scalp or hair on virtually every photo. Hair color is
  // its most distinctly non-skin cluster (forehead skin often sneaks into the band).
  const near = S.rect(-0.25, 0.25, -0.3, -0.04, T.hair);
  const nearHair = near.colors.filter(notSkin);
  const nearCoverage = near.colors.length ? nearHair.length / near.colors.length : 0;
  scores.hairNear = nearCoverage;

  let hair: RGBA | null = null;
  let hairStyle: HairStyle = 'bald';
  if (nearCoverage >= 0.3 && nearHair.length) {
    let candidates = clusterColors(nearHair, 3).filter((c) => c.share >= 0.2);
    // Thin or light hair against a dark backdrop: the backdrop shows through the band, so prefer
    // clusters that don't look like the background.
    const notBg = candidates.filter((c) => background.every((b) => deltaE(c.lab, b) > 15));
    if (notBg.length) candidates = notBg;
    const top = candidates.sort((x, y) => minDist(y.lab, skinTones) - minDist(x.lab, skinTones))[0]!;
    hair = top.color;
    const hairLab = top.lab;
    const isHair = (c: RGBA) => {
      const lab = toLab(c);
      return deltaE(lab, hairLab) < 18 && !nearSkin(lab, 15);
    };
    const frac = (colors: RGBA[]) => (colors.length ? colors.filter(isHair).length / colors.length : 0);

    // If the background looks like the hair (dark hair on a dark wall), "hair beside the head" is
    // ambiguous, so subtract the same measure taken further out at the same height.
    const bgLikeHair = background.some((b) => deltaE(b, hairLab) < 20);
    scores.bgLikeHair = +bgLikeHair;
    const beside = (u0: number, u1: number, v0: number, v1: number, tint: RGBA, refOffset = 0.45) => {
      const l = S.rect(-u1, -u0, v0, v1, tint), r = S.rect(u0, u1, v0, v1, tint);
      const here = frac([...l.colors, ...r.colors]);
      if (!bgLikeHair) return here;
      const ref = frac([
        ...S.rect(-u1 - refOffset, -u0 - refOffset, v0, v1, T.ref).colors,
        ...S.rect(u0 + refOffset, u1 + refOffset, v0, v1, T.ref).colors,
      ]);
      return Math.max(0, here - ref);
    };

    // Above the head, the reference is beside the head at the same height (u ±1.1–1.4).
    const above = (u: number, v0: number, v1: number, tint: RGBA) => {
      const sample = S.rect(-u, u, v0, v1, tint);
      const here = frac(sample.colors);
      if (!bgLikeHair) return { score: here, inBounds: sample.inBounds };
      const ref = frac([...S.rect(-1.4, -1.1, v0, v1, T.ref).colors, ...S.rect(1.1, 1.4, v0, v1, T.ref).colors]);
      return { score: Math.max(0, here - ref), inBounds: sample.inBounds };
    };
    const crown = above(0.25, -0.42, -0.3, T.hair).score;
    const volumeSample = above(0.4, -0.6, -0.42, T.volume);
    const volume = volumeSample.score;
    const wide = beside(0.62, 0.9, -0.2, 0.15, T.volume, 0.6);
    const side = beside(0.53, 0.7, 0.2, 0.5, T.side);
    const long = beside(0.5, 0.85, 0.85, 1.3, T.long);
    Object.assign(scores, { hairCrown: crown, hairVolume: volume, hairWide: wide, hairSide: side, hairLong: long });

    // An afro is wide at the temples and tall (or cropped off by the top of the photo).
    const tall = volume > 0.4 || volumeSample.inBounds < 0.5;
    if (wide > 0.5 && side > 0.3 && tall) hairStyle = 'afro';
    else if (long > 0.3) hairStyle = 'long';
    else if (side > 0.35) hairStyle = 'medium';
    else if (nearCoverage < 0.6 && crown < 0.5) hairStyle = 'buzz';
    else hairStyle = 'short';
  }

  // --- Beard: chin and moustache that differ clearly from skin ---
  // Darker (most beards), or colorless (grey/white beards). The bands skip the shadow
  // right under the lower lip and nose.
  const skinRefLab = toLab(medianColor(skinPx.filter((c) => nearSkin(toLab(c), 22)).concat([skin])));
  const skinChroma = Math.hypot(skinRefLab[1], skinRefLab[2]);
  const isBeard = (c: RGBA) => {
    const lab = toLab(c);
    if (deltaE(lab, skinRefLab) < 12) return false;
    const darker = skinRefLab[0] - lab[0];
    const chroma = Math.hypot(lab[1], lab[2]);
    // Grey/white beards: colorless (skin almost never is).
    if (chroma < 10) return true;
    // Beard hair is darker *and* less saturated than skin; shadows and lips stay saturated.
    return (darker > 10 && chroma < skinChroma * 0.7) || (darker > 20 && chroma < skinChroma * 0.85);
  };
  const chin = S.rect(-0.15, 0.15, v(LM.lowerLipBottom) + 0.05, v(LM.chin) - 0.02, T.beard).colors;
  const stache = S.rect(-0.12, 0.12, v(LM.noseBase) + 0.03, v(LM.upperLipTop) - 0.01, T.beard).colors;
  const beardPx = [...chin, ...stache].filter(isBeard);
  const beardScore = beardPx.length / Math.max(1, chin.length + stache.length);
  scores.beard = beardScore;
  // Conservative on purpose: a false beard is a worse result than a missed bit of stubble.
  const beard = beardScore > 0.7 ? 'full' : beardScore > 0.5 ? 'stubble' : 'none';
  const beardColor = beard !== 'none' && beardPx.length ? clusterColors(beardPx, 2)[0]!.color : null;

  // --- Glasses: a dark frame across the nose bridge plus at least one temple arm ---
  // Frames are near-black. Relative to skin for light skin, proportional for dark skin (where
  // "30 darker than skin" would be below black).
  const frameL = Math.max(skinRefLab[0] - 30, skinRefLab[0] * 0.45);
  // Hair covering the temples is dark too, so hair-colored pixels don't count as frames there.
  const hairLab = hair && toLab(hair);
  const veryDark = (cs: RGBA[], notHair = false) =>
    cs.length
      ? cs.filter((c) => {
          const lab = toLab(c);
          return lab[0] < frameL && !(notHair && hairLab && deltaE(lab, hairLab) < 12);
        }).length / cs.length
      : 0;
  const bridge = veryDark(S.rect(-0.035, 0.035, v(LM.noseBridge) - 0.02, v(LM.noseMid) + 0.02, T.glasses).colors);
  const eyeV = (v(LM.irisRight) + v(LM.irisLeft)) / 2;
  const temple = Math.max(
    veryDark(S.rect(-0.46, -0.36, eyeV - 0.04, eyeV + 0.02, T.glasses).colors, true),
    veryDark(S.rect(0.36, 0.46, eyeV - 0.04, eyeV + 0.02, T.glasses).colors, true),
  );
  Object.assign(scores, { glassesBridge: bridge, glassesTemple: temple });
  const glasses = bridge > 0.12 && temple > 0.12;

  // --- Eyes: iris ring, minus pupil and highlights ---
  let eyes: RGBA | null = null;
  if (m.length >= 478) {
    const irisPx: RGBA[] = [];
    for (const [c, ring] of [[LM.irisRight, 469], [LM.irisLeft, 474]] as const) {
      const ir = Math.hypot(p(ring)[0] - p(c)[0], p(ring)[1] - p(c)[1]);
      if (ir < 2) continue;
      irisPx.push(...S.disc(p(c), ir * 0.75, T.eyes, ir * 0.3).colors);
    }
    const usable = irisPx.filter((c) => {
      const L = toLab(c)[0];
      return L > 8 && L < 80;
    });
    if (usable.length >= 6) eyes = medianColor(usable);
  }

  // --- Mouth: corners lifted above the lip line, or a wide mouth ---
  const lipCenter = (v(LM.upperLipInner) + v(LM.lowerLipInner)) / 2;
  const cornerLift = lipCenter - (v(LM.mouthRight) + v(LM.mouthLeft)) / 2;
  const mouthWidth = Math.hypot(p(LM.mouthLeft)[0] - p(LM.mouthRight)[0], p(LM.mouthLeft)[1] - p(LM.mouthRight)[1]) / faceWidth;
  Object.assign(scores, { smileLift: cornerLift, mouthWidth });
  const mouth = cornerLift > 0.012 || mouthWidth > 0.45 ? 'smile' : 'neutral';

  // --- Shirt: below the chin, ignoring neck skin ---
  const shirtSample = S.rect(-0.45, 0.45, 1.35, 1.8, T.shirt);
  scores.shirtInBounds = shirtSample.inBounds;
  // Long hair and big beards often hang into this region; don't mistake them for clothing.
  const notClothing = [
    hairStyle === 'long' || hairStyle === 'afro' ? hair : null,
    beard === 'full' ? beardColor : null,
  ].filter((c): c is RGBA => !!c).map(toLab);
  const pickShirt = (exclude: Lab[]) => {
    const px = shirtSample.colors.filter((c) => notSkin(c) && exclude.every((h) => deltaE(toLab(c), h) > 15));
    return shirtSample.inBounds > 0.4 && px.length > shirtSample.colors.length * 0.3 ? clusterColors(px, 3)[0]!.color : null;
  };
  // If excluding hair leaves nothing, the clothing simply matches the hair (black coat, black afro).
  const shirt = pickShirt(notClothing) ?? pickShirt([]);

  return { skin, hair, hairStyle, eyes, beard, beardColor, glasses, mouth, shirt, scores };
}

const minDist = (lab: Lab, set: Lab[]) => Math.min(...set.map((t) => deltaE(lab, t)));
