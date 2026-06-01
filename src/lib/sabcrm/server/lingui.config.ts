// PORT-NOTE: Twenty's lingui.config.ts drove i18n extraction for the NestJS
// server (decorators, Lingui catalog at
// src/engine/core-modules/i18n/locales/{locale}).
// SabNode uses Next.js and may wire Lingui separately. The config below
// preserves the catalog structure and locale list; update the catalog path to
// match wherever SabNode keeps its CRM locale files.

import { defineConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';

// Mirror the locale/source values from twenty-shared/translations
const SOURCE_LOCALE = 'en';
const APP_LOCALES: Record<string, string> = {
  en: 'en',
  // Add additional locales as needed to match twenty-shared/translations
};

export default defineConfig({
  sourceLocale: SOURCE_LOCALE,
  locales: Object.values(APP_LOCALES),
  pseudoLocale: 'pseudo-en',
  fallbackLocales: {
    'pseudo-en': 'en',
    default: SOURCE_LOCALE,
  },
  extractorParserOptions: {
    tsExperimentalDecorators: true,
  },
  catalogs: [
    {
      // PORT-NOTE: Update path to SabNode's CRM locale directory.
      path: '<rootDir>/src/lib/sabcrm/server/locales/{locale}',
      include: ['src/lib/sabcrm'],
    },
  ],
  catalogsMergePath:
    '<rootDir>/src/lib/sabcrm/server/locales/generated/{locale}',
  compileNamespace: 'ts',
  format: formatter({ lineNumbers: false, printLinguiId: true }),
});
