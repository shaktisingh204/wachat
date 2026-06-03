import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowCodeActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      logicFunctionId: z
        .string()
        .describe(
          'The ID of the logic function that holds the code. This is auto-generated when a CODE step is created via create_workflow_version_step — do NOT set this manually.',
        ),
      logicFunctionInput: z
        .record(z.string(), z.unknown())
        .describe(
          'Key-value map of input parameters to pass to the logic function at runtime.',
        ),
    }),
  });
