// PORT-NOTE: NestJS @Module() has no direct Next.js equivalent.
// This file re-exports the pieces the module wired together so that
// the 1:1 mapping stays complete and imports resolve correctly.

export { handleGenerateText } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-generate-text/controllers/ai-generate-text.controller';
export type { GenerateTextInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-generate-text/dtos/generate-text.input';

// Dependencies the module imported:
//   TokenModule, WorkspaceCacheStorageModule, PermissionsModule,
//   BillingModule, AiBillingModule
// These are plain library modules in SabNode and do not need re-exporting here.
