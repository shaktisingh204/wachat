import { z } from 'zod';
import { StepStatus } from '../types/WorkflowRunStateStepInfos';

// StepStatus is a TypeScript enum; use z.nativeEnum for proper Zod compatibility
export const workflowRunStepStatusSchema = z.nativeEnum(StepStatus);
