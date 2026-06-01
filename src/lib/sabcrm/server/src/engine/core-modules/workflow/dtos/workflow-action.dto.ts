import { WorkflowStepPosition } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-step-position.dto';

// PORT: dto
// Original: NestJS @ObjectType(); WorkflowActionType re-exported from workflow-action.type.ts

export enum WorkflowActionType {
  CODE = 'CODE',
  LOGIC_FUNCTION = 'LOGIC_FUNCTION',
  SEND_EMAIL = 'SEND_EMAIL',
  DRAFT_EMAIL = 'DRAFT_EMAIL',
  CREATE_RECORD = 'CREATE_RECORD',
  UPDATE_RECORD = 'UPDATE_RECORD',
  DELETE_RECORD = 'DELETE_RECORD',
  UPSERT_RECORD = 'UPSERT_RECORD',
  FIND_RECORDS = 'FIND_RECORDS',
  FORM = 'FORM',
  FILTER = 'FILTER',
  IF_ELSE = 'IF_ELSE',
  HTTP_REQUEST = 'HTTP_REQUEST',
  AI_AGENT = 'AI_AGENT',
  ITERATOR = 'ITERATOR',
  EMPTY = 'EMPTY',
  DELAY = 'DELAY',
}

export type WorkflowActionDTO = {
  id: string;
  name: string;
  type: WorkflowActionType;
  settings: object;
  valid: boolean;
  nextStepIds?: string[];
  position?: WorkflowStepPosition;
};
