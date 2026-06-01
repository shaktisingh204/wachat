import { type WorkflowActionTriggerSettings } from '@/lib/sabcrm/shared/src/application';
import { jsonSchemaToInputSchema } from '@/lib/sabcrm/shared/src/logic-function/json-schema-to-input-schema';

export const SEED_WORKFLOW_ACTION_TRIGGER_SETTINGS: WorkflowActionTriggerSettings =
  {
    inputSchema: jsonSchemaToInputSchema({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
    }),
  };
