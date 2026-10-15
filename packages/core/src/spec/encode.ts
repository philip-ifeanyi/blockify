import { parseSpec } from './validate';
import type { CharacterSpec } from './types';

/** URL-safe compact encoding, used for share links and the cacheable /avatar/:spec.png route. */
export function encodeSpec(spec: CharacterSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSpec(encoded: string): CharacterSpec {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return parseSpec(JSON.parse(new TextDecoder().decode(bytes)));
}
