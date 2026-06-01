import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';
import { type WorkflowRunStepInfos } from '@/lib/sabcrm/shared/src/workflow/types/WorkflowRunStateStepInfos';

export const getWorkflowRunContext = (
  stepInfos: WorkflowRunStepInfos,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(stepInfos)
      .filter(([, value]) => isDefined(value?.['result']))
      .map(([key, value]) => [key, value?.['result']]),
  );
};
