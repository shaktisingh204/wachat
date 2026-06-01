import { type SyncableEntityOptions } from './syncableEntityOptionsType';
import { type ToolTriggerSettings } from './toolTriggerSettingsType';
import { type WorkflowActionTriggerSettings } from './workflowActionTriggerSettingsType';
import { type HTTPMethod } from '../types';

export type LogicFunctionManifest = SyncableEntityOptions & {
  name?: string;
  description?: string;
  timeoutSeconds?: number;
  cronTriggerSettings?: CronTriggerSettings;
  databaseEventTriggerSettings?: DatabaseEventTriggerSettings;
  httpRouteTriggerSettings?: HttpRouteTriggerSettings;
  toolTriggerSettings?: ToolTriggerSettings;
  workflowActionTriggerSettings?: WorkflowActionTriggerSettings;
  sourceHandlerPath: string;
  builtHandlerPath: string;
  builtHandlerChecksum: string;
  handlerName: string;
};

export type CronTriggerSettings = {
  pattern: string;
};

export type DatabaseEventTriggerSettings = {
  eventName: string;
  updatedFields?: string[];
};

export type HttpRouteTriggerSettings = {
  path: string;
  httpMethod: HTTPMethod | `${HTTPMethod}`;
  isAuthRequired: boolean;
  forwardedRequestHeaders?: string[];
};
