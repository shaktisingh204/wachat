// Triggers
export { WebhookTrigger }  from './nodes/triggers/WebhookTrigger';
export type {
  WebhookTriggerConfig,
  WebhookTriggerOutput,
  WebhookTriggerMethod,
  WebhookTriggerAuth,
  WebhookTriggerProps,
} from './nodes/triggers/WebhookTrigger';

export { ScheduleTrigger } from './nodes/triggers/ScheduleTrigger';
export type {
  ScheduleTriggerConfig,
  ScheduleTriggerOutput,
  ScheduleTriggerProps,
  ScheduleMode,
  IntervalUnit,
} from './nodes/triggers/ScheduleTrigger';

export { WhatsAppTrigger } from './nodes/triggers/WhatsAppTrigger';
export type {
  WhatsAppTriggerConfig,
  WhatsAppTriggerOutput,
  WhatsAppTriggerProps,
  WhatsAppEventType,
  WhatsAppKeywordFilter,
} from './nodes/triggers/WhatsAppTrigger';

// Actions
export { HttpRequestNode } from './nodes/actions/HttpRequestNode';
export type {
  HttpRequestNodeConfig,
  HttpRequestOutput,
  HttpRequestNodeProps,
  HttpMethod,
  BodyFormat,
  AuthMode,
  KeyValuePair,
  HttpRequestAuth,
} from './nodes/actions/HttpRequestNode';

export { WhatsAppSendNode } from './nodes/actions/WhatsAppSendNode';
export type {
  WhatsAppSendConfig,
  WhatsAppSendOutput,
  WhatsAppSendNodeProps,
  WaMessageType,
  TemplateComponent,
} from './nodes/actions/WhatsAppSendNode';

export { GoogleSheetsNode } from './nodes/actions/GoogleSheetsNode';
export type {
  GoogleSheetsNodeConfig,
  GoogleSheetsOutput,
  GoogleSheetsNodeProps,
  GoogleSheetsOperation,
  ColumnMapping,
} from './nodes/actions/GoogleSheetsNode';

export { SetDataNode } from './nodes/actions/SetDataNode';
export type {
  SetDataNodeConfig,
  SetDataNodeProps,
  SetDataMode,
  SetDataValueType,
  DataEntry,
} from './nodes/actions/SetDataNode';

// Logic
export { IfNode } from './nodes/logic/IfNode';
export type {
  IfNodeConfig,
  IfNodeOutput,
  IfNodeProps,
  Condition,
  ConditionOperator,
  CombineLogic,
} from './nodes/logic/IfNode';

export { SwitchNode } from './nodes/logic/SwitchNode';
export type {
  SwitchNodeConfig,
  SwitchNodeProps,
  SwitchCase,
  SwitchOperator,
} from './nodes/logic/SwitchNode';

// Registry
export {
  NODE_REGISTRY,
  NODE_CATEGORIES,
  getNodeMeta,
  getNodeLabel,
  getNodeIcon,
  getNodeColor,
  getNodeCategory,
  getNodesByCategory,
  getTriggerNodes,
  isTriggerNode,
  searchNodes,
} from './registry/nodeRegistry';
export type { NodeMeta, NodeCategory, PortDescriptor } from './registry/nodeRegistry';
