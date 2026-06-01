import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// Depends on WorkspaceCacheService, ApplicationService,
// WorkspaceMigrationValidateBuildAndRunService, and GlobalWorkspaceOrmManager (for
// workflowVersion updates). Mongo collection access replaces GlobalWorkspaceOrmManager.

import { connectToDatabase } from "@/lib/mongodb";

export type MigrateAiAgentTextToJsonResponseFormatOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

const TEXT_AGENT_DEFAULT_JSON_RESPONSE_FORMAT = {
  type: "json" as const,
  schema: {
    type: "object" as const,
    properties: {
      response: {
        type: "string" as const,
        description: "Response of the agent",
      },
    },
    required: ["response"],
    additionalProperties: false as const,
  },
};

const TEXT_AGENT_DEFAULT_OUTPUT_SCHEMA = {
  response: {
    isLeaf: true,
    type: "string",
    label: "Response",
    value: null,
  },
};

type WorkflowStep = {
  type: string;
  settings?: {
    input?: { agentId?: string };
    outputSchema?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Workspace command: 1.21.0 / 1775500008000
 * Migrate AI agents with text response format to JSON with a default response field.
 * Also updates workflow version step outputSchemas for affected agents.
 *
 * PORT-NOTE: The agent metadata update (via WorkspaceMigrationValidateBuildAndRunService)
 * is stubbed — wire once ApplicationService is ported. The workflow step output schema
 * backfill is fully implemented using Mongo.
 */
export async function migrateAiAgentTextToJsonResponseFormat(
  options: MigrateAiAgentTextToJsonResponseFormatOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  const { db } = await connectToDatabase();

  // Find agents with text/unset responseFormat
  const agentsCol = db.collection<{
    id: string;
    workspaceId: string;
    isCustom: boolean;
    responseFormat?: { type?: string } | null;
  }>("sabcrm_agent");

  const textAgents = await agentsCol
    .find({
      workspaceId,
      isCustom: true,
      $or: [
        { "responseFormat.type": { $exists: false } },
        { "responseFormat.type": null },
        { "responseFormat.type": "text" },
        { responseFormat: null },
      ],
    })
    .toArray();

  if (textAgents.length === 0) {
    console.log(
      `No text-format agents found for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Found ${textAgents.length} text-format agent(s) for workspace ${workspaceId}`,
  );

  if (dryRun) {
    return;
  }

  const agentIds = textAgents.map((a) => a.id);

  // Update agents to JSON response format
  await agentsCol.updateMany(
    { id: { $in: agentIds }, workspaceId },
    { $set: { responseFormat: TEXT_AGENT_DEFAULT_JSON_RESPONSE_FORMAT } },
  );

  // Update workflowVersion step outputSchemas
  const workflowVersionCol = db.collection<{
    id: string;
    workspaceId: string;
    steps?: WorkflowStep[];
  }>("sabcrm_workflow_version");

  const allVersions = await workflowVersionCol
    .find({ workspaceId })
    .toArray();

  let updatedVersionCount = 0;

  for (const version of allVersions) {
    if (!Array.isArray(version.steps)) {
      continue;
    }

    let versionModified = false;

    const updatedSteps = version.steps.map((step: WorkflowStep) => {
      if (step.type !== "AI_AGENT") {
        return step;
      }

      const agentId = step.settings?.input?.agentId;

      if (!agentId || !agentIds.includes(agentId)) {
        return step;
      }

      const currentOutputSchema = step.settings?.outputSchema;

      if (
        currentOutputSchema &&
        Object.keys(currentOutputSchema).length > 0
      ) {
        return step;
      }

      versionModified = true;

      return {
        ...step,
        settings: {
          ...step.settings,
          outputSchema: TEXT_AGENT_DEFAULT_OUTPUT_SCHEMA,
        },
      };
    });

    if (versionModified) {
      await workflowVersionCol.updateOne(
        { id: version.id },
        { $set: { steps: updatedSteps } },
      );
      updatedVersionCount++;
    }
  }

  if (updatedVersionCount > 0) {
    console.log(
      `Updated output schemas in ${updatedVersionCount} workflow version(s) for workspace ${workspaceId}`,
    );
  }

  console.log(
    `Successfully migrated ${textAgents.length} agent(s) to JSON response format for workspace ${workspaceId}`,
  );
}
