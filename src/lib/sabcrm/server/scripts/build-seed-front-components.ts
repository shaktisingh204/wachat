// PORT-NOTE: This script used esbuild + twenty-sdk's getFrontComponentBuildPlugins
// to compile seed front-component .tsx files into .mjs bundles inside the
// NestJS engine's seed-project directory. It depended on:
//   - twenty-sdk/front-component-renderer/build (not available in SabNode)
//   - src/engine/metadata-modules/front-component/constants/seed-project/
//
// SabNode does not use the Twenty SDK's Remote DOM front-component renderer.
// If a similar seed-component build is needed, wire esbuild directly (without
// the twenty-sdk plugin) and point SEED_PROJECT_DIR at the equivalent SabNode
// path. The script shell is preserved below with PORT-NOTEs marking the gaps.

import * as esbuild from 'esbuild';
import { join, resolve } from 'path';

// PORT-NOTE: twenty-sdk/front-component-renderer/build is not available.
// Replace getFrontComponentBuildPlugins with any needed esbuild plugins,
// or remove the plugins array if no Remote DOM wrapping is required.
// import { getFrontComponentBuildPlugins } from 'twenty-sdk/front-component-renderer/build';

const ROOT_DIR = resolve(__dirname, '../../../..');
const ROOT_NODE_MODULES = resolve(ROOT_DIR, 'node_modules');

// PORT-NOTE: Update SEED_PROJECT_DIR to the SabNode equivalent.
const SEED_PROJECT_DIR = resolve(
  __dirname,
  '../seed-project',
);

const alias: Record<string, string> = {
  react: join(ROOT_NODE_MODULES, 'react'),
  'react-dom': join(ROOT_NODE_MODULES, 'react-dom'),
};

const COMPONENTS = ['hello-world', 'show-notification'];

const build = async (): Promise<void> => {
  for (const component of COMPONENTS) {
    const entryPoint = join(SEED_PROJECT_DIR, component, 'index.tsx');
    const outdir = join(SEED_PROJECT_DIR, component);

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      splitting: false,
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      external: [
        'twenty-client-sdk/core',
        'twenty-client-sdk/metadata',
        'twenty-shared/*',
      ],
      jsx: 'automatic',
      sourcemap: false,
      metafile: false,
      minify: true,
      logLevel: 'info',
      outdir,
      alias,
      // PORT-NOTE: Re-add plugins when/if Remote DOM wrapping is needed.
      plugins: [],
    });

    console.log(`Built ${component}/index.mjs`);
  }
};

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
