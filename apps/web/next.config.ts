import type { NextConfig } from 'next';
import { join } from 'node:path';

const humanBrowserBuild = './node_modules/@vladmandic/human/dist/human.esm.js';

const config: NextConfig = {
  // Self-contained server bundle (server.js plus only the node_modules it needs) for the Docker image.
  // The tracing root is the monorepo root, so workspace packages are included.
  output: 'standalone',
  outputFileTracingRoot: join(import.meta.dirname, '..', '..'),
  // @blockify/core ships TypeScript source.
  transpilePackages: ['@blockify/core'],
  turbopack: {
    resolveAlias: {
      // human's "exports" map sends Node/SSR to a build that needs native @tensorflow/tfjs-node.
      // We only ever run it in the browser, so always use its self-contained browser ESM bundle.
      '@vladmandic/human': humanBrowserBuild,
    },
  },
  webpack: (cfg) => {
    cfg.resolve.alias['@vladmandic/human$'] = join(import.meta.dirname, humanBrowserBuild);
    return cfg;
  },
};

export default config;
