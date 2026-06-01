// PORT: dto
// Original: NestJS @ObjectType() WorkflowRunDTO; WorkflowRunStatus from workspace entity

export enum WorkflowRunStatus {
  NOT_STARTED = 'NOT_STARTED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ENQUEUED = 'ENQUEUED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
}

export type WorkflowRunDTO = {
  id: string;
  status: WorkflowRunStatus;
};
