import "server-only";

// PORT-NOTE: FastInstanceCommand — adds toolTriggerSettings (jsonb) and
// workflowActionTriggerSettings (jsonb) columns to the logicFunction table.
// In Mongo, both fields are added implicitly to sabcrm_logicFunction documents.
// Version: 2.3.0  Timestamp: 1797000001000

export interface AddToolAndWorkflowActionTriggerSettingsMigration {
  version: "2.3.0";
  timestamp: 1797000001000;
  type: "fast";
  description: "Add toolTriggerSettings and workflowActionTriggerSettings (jsonb) to logicFunction";
}

/**
 * Mongo analogue:
 *
 * up:
 *   ALTER TABLE "core"."logicFunction" ADD "toolTriggerSettings" jsonb
 *   ALTER TABLE "core"."logicFunction" ADD "workflowActionTriggerSettings" jsonb
 *   -> Both fields are schema-less in MongoDB; add to the LogicFunction TS type.
 *
 * down:
 *   ALTER TABLE "core"."logicFunction" DROP COLUMN "workflowActionTriggerSettings"
 *   ALTER TABLE "core"."logicFunction" DROP COLUMN "toolTriggerSettings"
 *   -> $unset both fields from all sabcrm_logicFunction documents if rolling back.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: Update the LogicFunction document type to include:
  //   toolTriggerSettings?: { inputSchema: Record<string, unknown> } | null
  //   workflowActionTriggerSettings?: { inputSchema: Array<Record<string, unknown>> } | null
}

export async function down(): Promise<void> {
  // PORT-NOTE: $unset toolTriggerSettings and workflowActionTriggerSettings
  //            from all sabcrm_logicFunction documents.
}
