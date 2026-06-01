// PORT-NOTE: module-wiring / server-logic
// Original: NestJS CommonArgsProcessors array registering DI providers for all arg-processor
// services + QueryRunnerArgsFactory. NestJS DI has no Next.js equivalent.
// This module re-exports the ported processor types so barrel imports continue to work.
// Callers that depended on NestJS injection should call each processor's exported
// functions directly from their respective ported modules.

export { DataArgProcessorService } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/data-arg-processor.service";
export { FilterArgProcessorService } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/filter-arg-processor.service";
export { GroupByArgProcessorService } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/group-by-arg-processor/group-by-arg-processor.service";
export { OrderByArgProcessorService } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/order-by-arg-processor/order-by-arg-processor.service";
export { OrderByWithGroupByArgProcessorService } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/order-by-with-group-by-arg-processor/order-by-with-group-by-arg-processor.service";
export { QueryRunnerArgsFactory } from "@/lib/sabcrm/server/src/engine/api/common/common-args-processors/query-runner-args.factory";

/**
 * CommonArgsProcessors — registry array mirroring the original NestJS provider list.
 * Used where the source code iterated over this array to set up processors.
 * In SabNode, call each exported function directly rather than via DI.
 *
 * TODO: Refacto-common Remove QueryRunnerArgsFactory (retained from original)
 */
export const CommonArgsProcessors = [
  "DataArgProcessorService",
  "FilterArgProcessorService",
  "GroupByArgProcessorService",
  "OrderByArgProcessorService",
  "OrderByWithGroupByArgProcessorService",
  "QueryRunnerArgsFactory",
] as const;
