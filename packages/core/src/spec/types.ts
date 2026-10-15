export type Style = 'blocky' | 'brick';
export type HairStyle = 'bald' | 'buzz' | 'short' | 'medium' | 'long' | 'afro';
export type Beard = 'none' | 'stubble' | 'full';
export type Mouth = 'neutral' | 'smile';
export type Sleeves = 'short' | 'long';

/** Everything needed to draw a character. Plain JSON: safe to store, share, and send over the API. */
export interface CharacterSpec {
  v: 1;
  style: Style;
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  pants: string;
  shoes: string;
  hairStyle: HairStyle;
  beard: Beard;
  mouth: Mouth;
  sleeves: Sleeves;
  glasses: boolean;
}

export const HAIR_STYLES: readonly HairStyle[] = ['bald', 'buzz', 'short', 'medium', 'long', 'afro'];
export const BEARDS: readonly Beard[] = ['none', 'stubble', 'full'];
export const MOUTHS: readonly Mouth[] = ['neutral', 'smile'];
export const SLEEVES: readonly Sleeves[] = ['short', 'long'];
export const STYLES: readonly Style[] = ['blocky', 'brick'];

export const DEFAULT_SPEC: CharacterSpec = {
  v: 1,
  style: 'blocky',
  skin: '#c68863',
  hair: '#3b2414',
  eyes: '#4a3020',
  shirt: '#3a7bd5',
  pants: '#2b3245',
  shoes: '#4a4a4a',
  hairStyle: 'short',
  beard: 'none',
  mouth: 'smile',
  sleeves: 'short',
  glasses: false,
};
