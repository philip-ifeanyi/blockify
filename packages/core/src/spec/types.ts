export type Style = 'blocky' | 'brick';
export type HairStyle = 'bald' | 'buzz' | 'short' | 'medium' | 'bob' | 'long' | 'afro' | 'bun' | 'ponytail';
export type Beard = 'none' | 'stubble' | 'full';
export type Mouth = 'neutral' | 'smile';
export type Sleeves = 'short' | 'long';
/** Classic = 4px arms (Steve), slim = 3px arms (Alex). Minecraft supports both skin models. */
export type Arms = 'classic' | 'slim';

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
  arms: Arms;
  glasses: boolean;
  lashes: boolean;
  /** Lip color; when absent the mouth is drawn as a darker skin tone. */
  lips?: string;
}

export const HAIR_STYLES: readonly HairStyle[] = ['bald', 'buzz', 'short', 'medium', 'bob', 'long', 'afro', 'bun', 'ponytail'];
export const BEARDS: readonly Beard[] = ['none', 'stubble', 'full'];
export const MOUTHS: readonly Mouth[] = ['neutral', 'smile'];
export const SLEEVES: readonly Sleeves[] = ['short', 'long'];
export const ARMS: readonly Arms[] = ['classic', 'slim'];
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
  arms: 'classic',
  glasses: false,
  lashes: false,
};
