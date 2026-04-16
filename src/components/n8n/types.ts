export type N8NNodeType =
  | 'trigger.webhook'
  | 'trigger.schedule'
  | 'trigger.manual'
  | 'action.http'
  | 'action.send_email'
  | 'action.set_data'
  | 'logic.if'
  | 'logic.switch'
  | 'logic.merge'
  | 'logic.split'
  | 'transform.json'
  | 'transform.text'
  | 'transform.code'
  | 'integration.google_sheets'
  | 'integration.slack'
  | 'integration.whatsapp';

export type N8NNode = {
  id: string;
  type: N8NNodeType;
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  disabled?: boolean;
};

export type N8NConnection = {
  id: string;
  sourceNodeId: string;
  sourceOutputIndex: number;
  targetNodeId: string;
  targetInputIndex: number;
};

export type N8NWorkflow = {
  id: string;
  name: string;
  nodes: N8NNode[];
  connections: N8NConnection[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Canvas transform state: pan + zoom. */
export type N8NGraphPosition = {
  x: number;
  y: number;
  scale: number;
};

/** A pending connection being drawn from a source output port. */
export type N8NDraftConnection = {
  sourceNodeId: string;
  sourceOutputIndex: number;
  /** Current mouse position in canvas-space. */
  mouseX: number;
  mouseY: number;
};
