import type { ObjectId } from 'mongodb';

/* ── Coordinates ──────────────────────────────────────── */
export type Coordinates = { x: number; y: number };
export type GraphPosition = Coordinates & { scale: number };

/* ── Connecting IDs (edge dragging) ───────────────────── */
export type ConnectingIds = {
  source:
    | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined }
    | { groupId: string; blockId?: string; itemId?: string; eventId?: undefined };
  target?: {
    groupId?: string;
    blockId?: string;
  };
};

/* ── Block Categories ─────────────────────────────────── */
export type BlockCategory =
  | 'bubbles'
  | 'inputs'
  | 'logic'
  | 'integrations'
  | 'events';

/* ── Block Types (Typebot-style) ──────────────────────── */
export type BubbleBlockType =
  | 'text'
  | 'image'
  | 'video'
  | 'embed'
  | 'audio';

export type InputBlockType =
  | 'text_input'
  | 'number_input'
  | 'email_input'
  | 'phone_input'
  | 'url_input'
  | 'date_input'
  | 'time_input'
  | 'rating_input'
  | 'file_input'
  | 'payment_input'
  | 'choice_input'
  | 'picture_choice_input';

export type LogicBlockType =
  | 'condition'
  | 'set_variable'
  | 'redirect'
  | 'script'
  | 'typebot_link'
  | 'wait'
  | 'jump'
  | 'ab_test';

export type IntegrationBlockType =
  | 'webhook'
  | 'send_email'
  | 'google_sheets'
  | 'google_analytics'
  | 'open_ai'
  | 'zapier'
  | 'make_com'
  | 'pabbly_connect'
  | 'chatwoot'
  | 'pixel'
  | 'segment'
  | 'cal_com'
  | 'nocodb'
  | 'elevenlabs'
  | 'anthropic'
  | 'together_ai'
  | 'mistral';

export type BlockType =
  | BubbleBlockType
  | InputBlockType
  | LogicBlockType
  | IntegrationBlockType;

/* ── Block data ───────────────────────────────────────── */
export type BlockItem = {
  id: string;
  content?: string;
  [key: string]: unknown;
};

export type Block = {
  id: string;
  type: BlockType;
  groupId: string;
  options?: Record<string, unknown>;
  items?: BlockItem[];
  outgoingEdgeId?: string;
};

/* ── Group ────────────────────────────────────────────── */
export type Group = {
  id: string;
  title: string;
  graphCoordinates: Coordinates;
  blocks: Block[];
};

/* ── Event ────────────────────────────────────────────── */
export type EventType = 'start';

export type SabFlowEvent = {
  id: string;
  type: EventType;
  graphCoordinates: Coordinates;
  outgoingEdgeId?: string;
};

/* ── Edge ─────────────────────────────────────────────── */
export type EdgeFrom =
  | { eventId: string; groupId?: undefined; blockId?: undefined; itemId?: undefined }
  | { groupId: string; blockId?: undefined; itemId?: undefined; eventId?: undefined }
  | { groupId: string; blockId: string; itemId?: undefined; eventId?: undefined }
  | { groupId: string; blockId: string; itemId: string; eventId?: undefined };

export type EdgeTo = {
  groupId: string;
  blockId?: string;
};

export type Edge = {
  id: string;
  from: EdgeFrom;
  to: EdgeTo;
};

/* ── Variable ─────────────────────────────────────────── */
export type Variable = {
  id: string;
  name: string;
  value?: string;
};

/* ── Theme ────────────────────────────────────────────── */
export type SabFlowTheme = {
  general?: {
    font?: string;
    background?: { type: 'color' | 'image' | 'none'; content?: string };
  };
  chat?: {
    container?: { maxWidth?: string; maxHeight?: string };
    hostBubble?: { backgroundColor?: string; color?: string };
    guestBubble?: { backgroundColor?: string; color?: string };
    input?: { backgroundColor?: string; color?: string };
  };
};

/* ── SabFlow (document) ───────────────────────────────── */
export type SabFlowDoc = {
  _id?: ObjectId;
  userId: string;
  projectId?: string;
  name: string;
  events: SabFlowEvent[];
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  theme: SabFlowTheme;
  settings: Record<string, unknown>;
  publicId?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
};

/* ── Draggable state ──────────────────────────────────── */
export type DraggedBlock = Block & { groupId: string };
export type DraggedItem = BlockItem & { type: BlockType; blockId: string };

/* ── Runtime / Execution types ────────────────────────── */

/** A message the flow engine sends out to the user (bubble output). */
export type OutgoingMessage =
  | { type: 'text';  content: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string }
  | { type: 'audio'; url: string }
  | { type: 'embed'; url: string };

/** A pending input request waiting for the user's reply. */
export type InputRequest = {
  blockId: string;
  inputType: InputBlockType;
  /** Variable name to store the answer into */
  variableName?: string;
  /** For choice / picture_choice inputs */
  choices?: { id: string; label: string; imageUrl?: string }[];
  /** Validation hints forwarded to the client */
  validation?: Record<string, unknown>;
};

/** Status of a single flow execution session. */
export type SessionState = {
  sessionId: string;
  flowId: string;
  /** Resolved variable map (variable id → current value) */
  variables: Record<string, string>;
  /** Current position in the flow graph */
  currentGroupId: string | null;
  currentBlockIndex: number;
  isCompleted: boolean;
  /** ISO timestamp */
  createdAt: string;
  updatedAt: string;
};
