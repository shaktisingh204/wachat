// PORT-NOTE: NestJS module-wiring — no Next.js equivalent.
// This registry documents what the original WorkflowApiModule wired together.

// Controllers ported:
//   WorkflowTriggerController
//     -> src/engine/core-modules/workflow/controllers/workflow-trigger.controller.ts

// Resolver/action modules wired:
//   WorkflowTriggerResolver
//     -> src/engine/core-modules/workflow/resolvers/workflow-trigger.resolver.ts
//   WorkflowBuilderResolver
//     -> src/engine/core-modules/workflow/resolvers/workflow-builder.resolver.ts
//   WorkflowVersionStepResolver
//     -> src/engine/core-modules/workflow/resolvers/workflow-version-step.resolver.ts
//   WorkflowVersionEdgeResolver
//     -> src/engine/core-modules/workflow/resolvers/workflow-version-edge.resolver.ts
//   WorkflowVersionResolver
//     -> src/engine/core-modules/workflow/resolvers/workflow-version.resolver.ts

// Imported modules (all ported separately):
//   WorkflowTriggerModule, WorkflowBuilderModule, WorkflowCommonModule,
//   WorkflowVersionModule, WorkflowRunModule, WorkflowRunnerModule,
//   PermissionsModule, ToolModule, LogicFunctionModule, CodeStepBuildModule,
//   WorkspaceManyOrAllFlatEntityMapsCacheModule, ConnectedAccountMetadataModule

export const WORKFLOW_API_MODULE_REGISTRY = {
  resolvers: [
    "WorkflowTriggerResolver",
    "WorkflowBuilderResolver",
    "WorkflowVersionStepResolver",
    "WorkflowVersionEdgeResolver",
    "WorkflowVersionResolver",
  ],
  controllers: ["WorkflowTriggerController"],
  imports: [
    "WorkflowTriggerModule",
    "WorkflowBuilderModule",
    "WorkflowCommonModule",
    "WorkflowVersionModule",
    "WorkflowRunModule",
    "WorkflowRunnerModule",
    "PermissionsModule",
    "ToolModule",
    "LogicFunctionModule",
    "CodeStepBuildModule",
    "WorkspaceManyOrAllFlatEntityMapsCacheModule",
    "ConnectedAccountMetadataModule",
  ],
} as const;
