// Copies the face models the browser detector needs from @vladmandic/human into public/models,
// so they're served from our own origin (no third-party CDN, works offline).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const src = join(dirname(dirname(require.resolve('@vladmandic/human'))), 'models');
const dest = join(import.meta.dirname, '..', 'public', 'models');
mkdirSync(dest, { recursive: true });
for (const model of ['blazeface', 'facemesh', 'iris'])
  for (const ext of ['json', 'bin']) copyFileSync(join(src, `${model}.${ext}`), join(dest, `${model}.${ext}`));
console.log(`Copied face models to ${dest}`);
