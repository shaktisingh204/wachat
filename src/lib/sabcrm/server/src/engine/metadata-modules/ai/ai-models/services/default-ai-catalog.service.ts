import "server-only";

// PORT-NOTE: NestJS @Injectable / OnModuleInit removed. Plain class; call
// initialize() once at startup (or lazily) in the DI composition root.
// FileStorageDriverFactory replaced with a simple fs.readFile for catalog
// override — SabNode uses its own R2/local storage layer.
// The bundled JSON catalog is imported statically via require() so it works in
// both Node.js and edge-adjacent environments.

import { readFile } from 'fs/promises';

import { aiProvidersConfigSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.schema';
import { type AiProvidersConfig } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.type';
import { normalizeAiProviders } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/utils/normalize-ai-providers.util';

// Bundled catalog — reference copy vendored from twenty-server.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultAiProviders = require('@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/ai-providers.json') as AiProvidersConfig;

export class DefaultAiCatalogService {
  private catalog: AiProvidersConfig = normalizeAiProviders(defaultAiProviders);

  // PORT-NOTE: catalogStoragePath replaces AI_CATALOG_STORAGE_PATH env read;
  // pass the resolved value from TwentyConfigService at the call site.
  async initialize(catalogStoragePath?: string): Promise<void> {
    if (!catalogStoragePath) {
      // Using built-in AI catalog (AI_CATALOG_STORAGE_PATH not set)
      return;
    }

    try {
      const raw = await this.fetchCatalog(catalogStoragePath);

      this.catalog = normalizeAiProviders(raw);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      // Failed to load AI catalog from storage — reset to empty so the
      // system is clearly misconfigured rather than silently using stale data.
      console.warn(`DefaultAiCatalogService: Failed to load AI catalog from storage: ${message}`);
      this.catalog = {};
    }
  }

  getDefaultAiCatalog(): AiProvidersConfig {
    return structuredClone(this.catalog);
  }

  private async fetchCatalog(filePath: string): Promise<AiProvidersConfig> {
    // PORT-NOTE: In Twenty the FileStorageDriverFactory abstraction is used
    // (S3 / local). In SabNode files come from R2 or the local filesystem
    // depending on deployment. For catalog override we read from the local FS
    // path; callers that need R2 should download to a temp path first.
    const body = await readFile(filePath, 'utf-8');

    return aiProvidersConfigSchema.parse(JSON.parse(body));
  }
}
