// PORT-NOTE: NestJS @Global() @Module() has no Next.js equivalent.
// This file re-exports the ported pieces the module wired together so the
// 1:1 mapping stays complete and imports resolve correctly.

// Providers (services)
export * from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/ai-sdk-package.const';
export * from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
export * from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/model-family-labels.const';
export * from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/models-dev.const';

// The following services are ported in later batches; stub re-exports are
// provided here so consumers of this module index can import them centrally.
// PORT-NOTE: Uncomment each line as the corresponding service is ported.
// export * from '.../services/ai-model-config.service';
// export * from '.../services/ai-model-preferences.service';
// export * from '.../services/ai-model-registry.service';
// export * from '.../services/default-ai-catalog.service';
// export * from '.../services/models-dev-catalog.service';
// export * from '.../services/native-tool-binder.service';
// export * from '.../services/provider-config.service';
// export * from '.../services/sdk-provider-factory.service';
