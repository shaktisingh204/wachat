// PORT-NOTE: NestJS @Module() has no Next.js equivalent.
// This registry re-exports the ported pieces that the original module wired:
//   controllers:  [SdkClientController]
//   providers:    [SdkClientGenerationService, SdkClientArchiveService]
//   exports:      [SdkClientGenerationService, SdkClientArchiveService]
//   imports:      TypeOrmModule([ApplicationEntity, WorkspaceEntity]),
//                 WorkspaceCacheModule, CoreGraphQLApiModule, ApplicationModule
//
// Consumers should import from this barrel to get the same surface.

export {
  SdkClientArchiveService,
  getClientModuleFromArchive,
  downloadArchiveBuffer,
  downloadAndExtractToPackage,
  markSdkLayerFresh,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/sdk-client-archive.service";

export {
  SdkClientGenerationService,
  generateSdkClientForApplication,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/sdk-client-generation.service";

export { handleGetSdkModule } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/controllers/sdk-client.controller";

export {
  ALLOWED_SDK_MODULES,
  type SdkModuleName,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/constants/allowed-sdk-modules";

export {
  SdkClientException,
  SdkClientExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/exceptions/sdk-client.exception";
