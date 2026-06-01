import path from 'path';

// Resolves the asset base path.
// In Twenty the distinction was between test builds (no /dist) and production
// builds (uses /assets). We keep the same logic for any Node.js script
// context inside SabNode.
const IS_BUILT_THROUGH_TESTING_MODULE =
  typeof __dirname === 'string' && !__dirname.includes('/dist/');

export const ASSET_PATH = IS_BUILT_THROUGH_TESTING_MODULE
  ? path.resolve(__dirname, '../')
  : path.resolve(__dirname, '../assets');
