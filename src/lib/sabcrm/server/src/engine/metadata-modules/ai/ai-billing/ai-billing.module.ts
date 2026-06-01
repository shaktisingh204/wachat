// PORT-NOTE: NestJS @Module has no Next.js equivalent.
// This file re-exports the pieces that AiBillingModule wired together so that
// the rest of the ported codebase can import from a single entry point.
//
// Original wiring:
//   imports:  WorkspaceEventEmitterModule, AiModelsModule, BillingModule, WorkspaceCacheModule
//   providers: [AiBillingService]
//   exports:   [AiBillingService]

export { AiBillingService } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service";
export type { BillingUsageInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service";
