import type { ComponentType, SVGProps } from 'react';
import {
  Globe,
  Clock,
  Play,
  Send,
  Mail,
  Database,
  GitBranch,
  Shuffle,
  Merge,
  Split,
  Code2,
  FileText,
  Terminal,
  Sheet,
  MessageSquare,
  Webhook,
} from 'lucide-react';
import type { N8NNodeType } from './types';

/** Fallback metadata returned for unrecognised node types. */
const FALLBACK_META: N8NNodeMeta = {
  label: 'Unknown Node',
  description: 'No metadata registered for this node type.',
  icon: Terminal,
  color: '#9ca3af',
  category: 'actions',
  inputs: 1,
  outputs: 1,
};

export type N8NNodeCategory =
  | 'triggers'
  | 'actions'
  | 'logic'
  | 'transform'
  | 'integrations';

export type N8NNodeMeta = {
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>> | ComponentType<{ className?: string }>;
  color: string;
  category: N8NNodeCategory;
  /** Number of input ports (left side). Triggers have 0. */
  inputs: number;
  /** Number of output ports (right side). */
  outputs: number;
};

export const N8N_NODE_REGISTRY: Record<string, N8NNodeMeta> = {
  // ── Triggers ────────────────────────────────────────────────────────────────
  'n8n-nodes-base.webhook': {
    label: 'Webhook',
    description: 'Starts the workflow when an HTTP request is received.',
    icon: Webhook,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },
  'n8n-nodes-base.scheduleTrigger': {
    label: 'Schedule',
    description: 'Runs the workflow on a cron schedule.',
    icon: Clock,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },
  'n8n-nodes-base.manualTrigger': {
    label: 'Manual Trigger',
    description: 'Runs the workflow when triggered manually.',
    icon: Play,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  'n8n-nodes-base.httpRequest': {
    label: 'HTTP Request',
    description: 'Makes an HTTP request to any URL.',
    icon: Globe,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.emailSend': {
    label: 'Send Email',
    description: 'Sends an email via SMTP or API.',
    icon: Mail,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.set': {
    label: 'Set Data',
    description: 'Sets or overwrites fields on the current item.',
    icon: Database,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },

  // ── Logic ───────────────────────────────────────────────────────────────────
  'n8n-nodes-base.if': {
    label: 'If',
    description: 'Routes items into true / false branches.',
    icon: GitBranch,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 2,
  },
  'n8n-nodes-base.switch': {
    label: 'Switch',
    description: 'Routes items based on a value across multiple outputs.',
    icon: Shuffle,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 4,
  },
  'n8n-nodes-base.merge': {
    label: 'Merge',
    description: 'Combines items from multiple branches.',
    icon: Merge,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 2,
    outputs: 1,
  },
  'n8n-nodes-base.splitInBatches': {
    label: 'Split In Batches',
    description: 'Splits items into smaller batches for processing.',
    icon: Split,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 2,
  },

  // ── Transform ───────────────────────────────────────────────────────────────
  'n8n-nodes-base.extractFromFile': {
    label: 'Extract from File',
    description: 'Extract data from binary file content.',
    icon: Code2,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.convertToFile': {
    label: 'Convert to File',
    description: 'Convert data to binary file content.',
    icon: FileText,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.code': {
    label: 'Code',
    description: 'Execute custom JavaScript / Python logic.',
    icon: Terminal,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },

  // ── Integrations ────────────────────────────────────────────────────────────
  'n8n-nodes-base.googleSheets': {
    label: 'Google Sheets',
    description: 'Read, write, or update rows in a spreadsheet.',
    icon: Sheet,
    color: '#22c55e',
    category: 'integrations',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.slack': {
    label: 'Slack',
    description: 'Send messages or interact with Slack workspaces.',
    icon: MessageSquare,
    color: '#4f46e5',
    category: 'integrations',
    inputs: 1,
    outputs: 1,
  },
  'n8n-nodes-base.whatsapp': {
    label: 'WhatsApp',
    description: 'Send WhatsApp messages via the Cloud API.',
    icon: Send,
    color: '#22c55e',
    category: 'integrations',
    inputs: 1,
    outputs: 1,
  },
};

export const N8N_NODE_CATEGORIES: Record<
  N8NNodeCategory,
  { label: string; color: string; types: N8NNodeType[] }
> = {
  triggers: {
    label: 'Triggers',
    color: '#f97316',
    types: [
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.scheduleTrigger',
      'n8n-nodes-base.manualTrigger',
    ],
  },
  actions: {
    label: 'Actions',
    color: '#3b82f6',
    types: [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.emailSend',
      'n8n-nodes-base.set',
    ],
  },
  logic: {
    label: 'Logic',
    color: '#8b5cf6',
    types: [
      'n8n-nodes-base.if',
      'n8n-nodes-base.switch',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.splitInBatches',
    ],
  },
  transform: {
    label: 'Transform',
    color: '#06b6d4',
    types: [
      'n8n-nodes-base.extractFromFile',
      'n8n-nodes-base.convertToFile',
      'n8n-nodes-base.code',
    ],
  },
  integrations: {
    label: 'Integrations',
    color: '#22c55e',
    types: [
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.slack',
      'n8n-nodes-base.whatsapp',
    ],
  },
};

export function getNodeMeta(type: string): N8NNodeMeta {
  return N8N_NODE_REGISTRY[type] ?? FALLBACK_META;
}
