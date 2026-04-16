import type { ComponentType } from 'react';
import type { SVGProps } from 'react';
import {
  LuWebhook,
  LuCalendarClock,
  LuMessageSquare,
  LuGlobe,
  LuSend,
  LuSheet,
  LuVariable,
  LuGitBranch,
  LuGitFork,
  LuClock,
  LuCode,
  LuZap,
  LuDatabase,
  LuMail,
  LuBot,
  LuBrain,
  LuLayers,
  LuFileText,
  LuRefreshCw,
  LuFilter,
  LuMerge,
  LuLayoutPanelLeft,
  LuHash,
  LuRepeat,
} from 'react-icons/lu';

/* ── Category definitions ────────────────────────────────── */

export type NodeCategory = 'triggers' | 'actions' | 'logic' | 'transform' | 'integrations';

/* ── Port descriptor ─────────────────────────────────────── */

export interface PortDescriptor {
  /** Unique ID for this port on the node */
  id: string;
  /** Display label shown near the port handle */
  label: string;
  /** Optional accent color (hex) for the port handle */
  color?: string;
}

/* ── Node meta ───────────────────────────────────────────── */

export interface NodeMeta {
  label: string;
  description: string;
  /**
   * Icon component — compatible with both lucide-react and react-icons
   * (both use `className?: string` signature)
   */
  icon: ComponentType<SVGProps<SVGSVGElement>> | ComponentType<{ className?: string }>;
  /** Primary accent color (hex) used for the node header and icon bg */
  color: string;
  category: NodeCategory;
  /**
   * Number of data inputs the node accepts.
   * Triggers have 0 inputs; most other nodes have 1; merge has 2+.
   */
  inputs: number;
  /**
   * Number of data outputs.
   * Most nodes: 1. If / Switch: multiple.
   */
  outputs: number;
  /**
   * Detailed port descriptors when inputs or outputs > 1.
   * Omit for the common single-input / single-output case.
   */
  inputPorts?: PortDescriptor[];
  outputPorts?: PortDescriptor[];
  /**
   * Whether this node can be used as an entry point to the workflow
   * (i.e. it is a trigger that produces initial data).
   */
  isTrigger?: boolean;
  /**
   * Docs page / help URL for this node type.
   * Relative paths are resolved against the SabNode docs base URL.
   */
  docsUrl?: string;
  /** Stable version string for the node implementation */
  version?: string;
}

/* ── Registry ────────────────────────────────────────────── */

export const NODE_REGISTRY: Record<string, NodeMeta> = {

  /* ────────── TRIGGERS ──────────────────────────────────── */

  webhook_trigger: {
    label:       'Webhook Trigger',
    description: 'Start a workflow when an HTTP request is received at a unique URL.',
    icon:        LuWebhook,
    color:       '#6366f1',
    category:    'triggers',
    inputs:      0,
    outputs:     1,
    isTrigger:   true,
    outputPorts: [{ id: 'out', label: 'Request', color: '#6366f1' }],
    docsUrl:     '/docs/nodes/triggers/webhook',
    version:     '1.0.0',
  },

  schedule_trigger: {
    label:       'Schedule Trigger',
    description: 'Run a workflow on a cron schedule or a fixed interval.',
    icon:        LuCalendarClock,
    color:       '#f59e0b',
    category:    'triggers',
    inputs:      0,
    outputs:     1,
    isTrigger:   true,
    outputPorts: [{ id: 'out', label: 'Tick', color: '#f59e0b' }],
    docsUrl:     '/docs/nodes/triggers/schedule',
    version:     '1.0.0',
  },

  whatsapp_trigger: {
    label:       'WhatsApp Trigger',
    description: 'Start a workflow when an incoming WhatsApp message matches configured filters.',
    icon:        LuMessageSquare,
    color:       '#25d366',
    category:    'triggers',
    inputs:      0,
    outputs:     1,
    isTrigger:   true,
    outputPorts: [{ id: 'out', label: 'Message', color: '#25d366' }],
    docsUrl:     '/docs/nodes/triggers/whatsapp',
    version:     '1.0.0',
  },

  /* ────────── ACTIONS ───────────────────────────────────── */

  http_request: {
    label:       'HTTP Request',
    description: 'Make an HTTP/HTTPS request to any external API.',
    icon:        LuGlobe,
    color:       '#ec4899',
    category:    'actions',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/actions/http-request',
    version:     '1.0.0',
  },

  whatsapp_send: {
    label:       'Send WhatsApp Message',
    description: 'Send a text, template, or media message via WhatsApp Business API.',
    icon:        LuSend,
    color:       '#25d366',
    category:    'actions',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/actions/whatsapp-send',
    version:     '1.0.0',
  },

  google_sheets: {
    label:       'Google Sheets',
    description: 'Read, append, update, or delete rows in a Google Sheets spreadsheet.',
    icon:        LuSheet,
    color:       '#22c55e',
    category:    'actions',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/actions/google-sheets',
    version:     '1.0.0',
  },

  set_data: {
    label:       'Set Data',
    description: 'Define or overwrite key-value pairs in the current item\'s data.',
    icon:        LuVariable,
    color:       '#fb923c',
    category:    'actions',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/actions/set-data',
    version:     '1.0.0',
  },

  send_email: {
    label:       'Send Email',
    description: 'Send a transactional email via SMTP or a configured provider.',
    icon:        LuMail,
    color:       '#f43f5e',
    category:    'actions',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/actions/send-email',
    version:     '1.0.0',
  },

  /* ────────── LOGIC ─────────────────────────────────────── */

  if_condition: {
    label:       'If / Condition',
    description: 'Split item flow into True and False branches based on one or more conditions.',
    icon:        LuGitBranch,
    color:       '#f97316',
    category:    'logic',
    inputs:      1,
    outputs:     2,
    outputPorts: [
      { id: 'true',  label: 'True',  color: '#22c55e' },
      { id: 'false', label: 'False', color: '#ef4444' },
    ],
    docsUrl:     '/docs/nodes/logic/if',
    version:     '1.0.0',
  },

  switch: {
    label:       'Switch',
    description: 'Route items to multiple output branches based on a value and set of cases.',
    icon:        LuGitFork,
    color:       '#8b5cf6',
    category:    'logic',
    inputs:      1,
    outputs:     -1, // dynamic — one per case + optional default
    docsUrl:     '/docs/nodes/logic/switch',
    version:     '1.0.0',
  },

  wait: {
    label:       'Wait',
    description: 'Pause workflow execution for a fixed duration or until a date-time.',
    icon:        LuClock,
    color:       '#fcd34d',
    category:    'logic',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/logic/wait',
    version:     '1.0.0',
  },

  loop: {
    label:       'Loop',
    description: 'Iterate over an array and process each item individually.',
    icon:        LuRepeat,
    color:       '#0ea5e9',
    category:    'logic',
    inputs:      1,
    outputs:     2,
    outputPorts: [
      { id: 'loop',  label: 'Loop Item', color: '#0ea5e9' },
      { id: 'done',  label: 'Done',      color: '#64748b' },
    ],
    docsUrl:     '/docs/nodes/logic/loop',
    version:     '1.0.0',
  },

  filter: {
    label:       'Filter',
    description: 'Remove items from the workflow that do not satisfy a condition.',
    icon:        LuFilter,
    color:       '#14b8a6',
    category:    'logic',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/logic/filter',
    version:     '1.0.0',
  },

  merge: {
    label:       'Merge',
    description: 'Combine data from two or more input branches into a single output.',
    icon:        LuMerge,
    color:       '#64748b',
    category:    'logic',
    inputs:      2,
    outputs:     1,
    inputPorts: [
      { id: 'in1', label: 'Input 1' },
      { id: 'in2', label: 'Input 2' },
    ],
    docsUrl:     '/docs/nodes/logic/merge',
    version:     '1.0.0',
  },

  /* ────────── TRANSFORM ─────────────────────────────────── */

  code: {
    label:       'Code',
    description: 'Run a custom JavaScript function to transform item data.',
    icon:        LuCode2,
    color:       '#6366f1',
    category:    'transform',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/transform/code',
    version:     '1.0.0',
  },

  split_out: {
    label:       'Split Out',
    description: 'Split an array field into individual items, one per array element.',
    icon:        LuSplitSquareHorizontal,
    color:       '#a855f7',
    category:    'transform',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/transform/split-out',
    version:     '1.0.0',
  },

  /* ────────── INTEGRATIONS ──────────────────────────────── */

  open_ai: {
    label:       'OpenAI',
    description: 'Call OpenAI APIs — completions, embeddings, image generation, and more.',
    icon:        LuBot,
    color:       '#10b981',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/openai',
    version:     '1.0.0',
  },

  anthropic: {
    label:       'Anthropic / Claude',
    description: 'Generate text completions using Anthropic\'s Claude models.',
    icon:        LuBrain,
    color:       '#f97316',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/anthropic',
    version:     '1.0.0',
  },

  make_com: {
    label:       'Make (Integromat)',
    description: 'Trigger a Make scenario or receive data from a Make webhook.',
    icon:        LuLayers,
    color:       '#6366f1',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/make',
    version:     '1.0.0',
  },

  zapier: {
    label:       'Zapier',
    description: 'Trigger a Zap or receive data from a Zapier webhook.',
    icon:        LuZap,
    color:       '#f97316',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/zapier',
    version:     '1.0.0',
  },

  nocodb: {
    label:       'NocoDB',
    description: 'Read and write records in a NocoDB base.',
    icon:        LuDatabase,
    color:       '#22c55e',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/nocodb',
    version:     '1.0.0',
  },

  google_docs: {
    label:       'Google Docs',
    description: 'Read or append content in a Google Docs document.',
    icon:        LuFileText,
    color:       '#4285f4',
    category:    'integrations',
    inputs:      1,
    outputs:     1,
    docsUrl:     '/docs/nodes/integrations/google-docs',
    version:     '1.0.0',
  },
};

/* ── Utility accessors ───────────────────────────────────── */

/** Get metadata for a node type. Returns undefined for unknown types. */
export function getNodeMeta(type: string): NodeMeta | undefined {
  return NODE_REGISTRY[type];
}

/** Get the display label for a node type. Falls back to the raw key. */
export function getNodeLabel(type: string): string {
  return NODE_REGISTRY[type]?.label ?? type;
}

/** Get the icon component for a node type. Returns null if not found. */
export function getNodeIcon(type: string): NodeMeta['icon'] | null {
  return NODE_REGISTRY[type]?.icon ?? null;
}

/** Get the primary accent color for a node type. */
export function getNodeColor(type: string): string {
  return NODE_REGISTRY[type]?.color ?? '#9ca3af';
}

/** Get the category for a node type. */
export function getNodeCategory(type: string): NodeCategory {
  return NODE_REGISTRY[type]?.category ?? 'actions';
}

/** Returns all node types that belong to a given category, sorted by label. */
export function getNodesByCategory(category: NodeCategory): string[] {
  return Object.entries(NODE_REGISTRY)
    .filter(([, meta]) => meta.category === category)
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([type]) => type);
}

/** Returns all trigger node types. */
export function getTriggerNodes(): string[] {
  return getNodesByCategory('triggers');
}

/** Returns true if the given node type is a trigger (entry point). */
export function isTriggerNode(type: string): boolean {
  return NODE_REGISTRY[type]?.isTrigger === true;
}

/** Search node registry by label or description (case-insensitive). */
export function searchNodes(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return Object.keys(NODE_REGISTRY);
  return Object.entries(NODE_REGISTRY)
    .filter(([type, meta]) =>
      type.includes(q) ||
      meta.label.toLowerCase().includes(q) ||
      meta.description.toLowerCase().includes(q),
    )
    .map(([type]) => type);
}

/* ── Category metadata ───────────────────────────────────── */

export const NODE_CATEGORIES: Record<NodeCategory, { label: string; color: string; description: string }> = {
  triggers:     { label: 'Triggers',     color: '#6366f1', description: 'Start workflow execution' },
  actions:      { label: 'Actions',      color: '#ec4899', description: 'Perform operations and side effects' },
  logic:        { label: 'Logic',        color: '#f97316', description: 'Control flow and branching' },
  transform:    { label: 'Transform',    color: '#8b5cf6', description: 'Modify and reshape data' },
  integrations: { label: 'Integrations', color: '#0ea5e9', description: 'Connect to external services' },
};
