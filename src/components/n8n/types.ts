/**
 * Re-export the canonical lib types so UI components can import
 * from a single @/components/n8n/types path without touching the
 * server-only lib directory.
 *
 * NOTE: The DB / execution types live in @/lib/n8n/types — these
 * component-side types are a thin UI layer on top.
 */

/**
 * The node types recognised by the canvas. These correspond to the
 * `type` field used in @/lib/n8n/types#N8NNode.  A superset is
 * allowed (open string union) so custom nodes don't break the UI.
 */
export type N8NNodeType =
  | 'n8n-nodes-base.webhook'
  | 'n8n-nodes-base.scheduleTrigger'
  | 'n8n-nodes-base.manualTrigger'
  | 'n8n-nodes-base.httpRequest'
  | 'n8n-nodes-base.emailSend'
  | 'n8n-nodes-base.set'
  | 'n8n-nodes-base.if'
  | 'n8n-nodes-base.switch'
  | 'n8n-nodes-base.merge'
  | 'n8n-nodes-base.splitInBatches'
  | 'n8n-nodes-base.code'
  | 'n8n-nodes-base.extractFromFile'
  | 'n8n-nodes-base.convertToFile'
  | 'n8n-nodes-base.googleSheets'
  | 'n8n-nodes-base.slack'
  | 'n8n-nodes-base.whatsapp'
  | (string & {});

/**
 * A single node on the canvas.
 * Position is stored as [x, y] — matching n8n's native wire format
 * (see @/lib/n8n/types#N8NNode).
 */
export type N8NCanvasNode = {
  id: string;
  name: string;
  type: N8NNodeType;
  typeVersion: number;
  /** [x, y] in canvas-space pixels. */
  position: [number, number];
  parameters: Record<string, unknown>;
  disabled?: boolean;
  notes?: string;
};

/**
 * A single connection between two nodes on the canvas.
 * The id field is generated client-side and is not stored in MongoDB.
 */
export type N8NCanvasConnection = {
  /** Client-side only — used as React key. */
  id: string;
  sourceNodeName: string;
  sourceOutputIndex: number;
  targetNodeName: string;
  targetInputIndex: number;
};

/**
 * Lightweight workflow shape used only within the canvas editor.
 * The authoritative DB shape lives in @/lib/n8n/types#N8NWorkflow.
 */
export type N8NCanvasWorkflow = {
  /** MongoDB string id (_id.toString()). */
  _id: string;
  name: string;
  nodes: N8NCanvasNode[];
  connections: N8NCanvasConnection[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/* ─────────────────────────────────────────────────────────────────────────
 * BACKWARD-COMPAT ALIASES
 *
 * The files under panels/ and edges/ were written before the canvas types
 * were introduced.  They use the old dot-notation N8NNodeType enum and the
 * flat N8NNode / N8NConnection shapes.  Keep these aliases so those files
 * compile without modification.
 * ───────────────────────────────────────────────────────────────────────── */

/** @deprecated Use N8NNodeType (open string union) instead. */
export type LegacyN8NNodeType =
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

/**
 * Old flat-array node shape used by NodePropertiesPanel.
 * @deprecated Use N8NCanvasNode instead.
 */
export type N8NNode = {
  id: string;
  name: string;
  type: LegacyN8NNodeType | N8NNodeType;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  disabled?: boolean;
};

/**
 * Old flat connection shape used by WorkflowEdge / WorkflowEdges.
 * @deprecated Use N8NCanvasConnection instead.
 */
export type N8NConnection = {
  id: string;
  sourceNodeId: string;
  sourceOutputIndex: number;
  targetNodeId: string;
  targetInputIndex: number;
};

/**
 * Old workflow shape used by N8NWorkflowEditorPage (legacy adapter).
 * @deprecated Use N8NCanvasWorkflow instead.
 */
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
  sourceNodeName: string;
  sourceOutputIndex: number;
  /** Current mouse position in canvas-space. */
  mouseX: number;
  mouseY: number;
};
