// PORT-NOTE: NestJS module wiring for CoreCommonApiModule.
// In SabNode (Next.js + Mongo), there is no DI container or module system.
// This file re-exports the ported pieces that this module wired together so
// downstream barrel imports stay intact.

export {
  processNestedRelations,
  processNestedRelationsV2,
} from '@/lib/sabcrm/server/src/engine/api/common/common-nested-relations-processor/process-nested-relations.helper';

// PORT-NOTE: CommonArgsProcessors, CommonQueryRunners, CommonResultGettersService,
// GroupByWithRecordsService, ProcessAggregateHelper are ported in their own
// respective modules. Import them from those target paths when needed.
// TypeORM/NestJS-specific wiring (WorkspaceQueryRunnerModule, WorkspaceQueryHookModule,
// TypeOrmModule.forFeature, ThrottlerModule, MetricsModule, etc.) has no Next.js
// equivalent and is intentionally omitted.
