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

export const N8N_NODE_REGISTRY: Record<N8NNodeType, N8NNodeMeta> = {
  // ── Triggers ────────────────────────────────────────────────────────────────
  'trigger.webhook': {
    label: 'Webhook',
    description: 'Starts the workflow when an HTTP request is received.',
    icon: Webhook,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },
  'trigger.schedule': {
    label: 'Schedule',
    description: 'Runs the workflow on a cron schedule.',
    icon: Clock,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },
  'trigger.manual': {
    label: 'Manual Trigger',
    description: 'Runs the workflow when triggered manually.',
    icon: Play,
    color: '#f97316',
    category: 'triggers',
    inputs: 0,
    outputs: 1,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  'action.http': {
    label: 'HTTP Request',
    description: 'Makes an HTTP request to any URL.',
    icon: Globe,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },
  'action.send_email': {
    label: 'Send Email',
    description: 'Sends an email via SMTP or API.',
    icon: Mail,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },
  'action.set_data': {
    label: 'Set Data',
    description: 'Sets or overwrites fields on the current item.',
    icon: Database,
    color: '#3b82f6',
    category: 'actions',
    inputs: 1,
    outputs: 1,
  },

  // ── Logic ───────────────────────────────────────────────────────────────────
  'logic.if': {
    label: 'If',
    description: 'Routes items into true / false branches.',
    icon: GitBranch,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 2,
  },
  'logic.switch': {
    label: 'Switch',
    description: 'Routes items based on a value across multiple outputs.',
    icon: Shuffle,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 4,
  },
  'logic.merge': {
    label: 'Merge',
    description: 'Combines items from multiple branches.',
    icon: Merge,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 2,
    outputs: 1,
  },
  'logic.split': {
    label: 'Split',
    description: 'Splits a single flow into parallel branches.',
    icon: Split,
    color: '#8b5cf6',
    category: 'logic',
    inputs: 1,
    outputs: 2,
  },

  // ── Transform ───────────────────────────────────────────────────────────────
  'transform.json': {
    label: 'JSON',
    description: 'Parse, stringify, or transform JSON data.',
    icon: Code2,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },
  'transform.text': {
    label: 'Text',
    description: 'Manipulate text: replace, extract, format.',
    icon: FileText,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },
  'transform.code': {
    label: 'Code',
    description: 'Execute custom JavaScript / Python logic.',
    icon: Terminal,
    color: '#06b6d4',
    category: 'transform',
    inputs: 1,
    outputs: 1,
  },

  // ── Integrations ────────────────────────────────────────────────────────────
  'integration.google_sheets': {
    label: 'Google Sheets',
    description: 'Read, write, or update rows in a spreadsheet.',
    icon: Sheet,
    color: '#22c55e',
    category: 'integrations',
    inputs: 1,
    outputs: 1,
  },
  'integration.slack': {
    label: 'Slack',
    description: 'Send messages or interact with Slack workspaces.',
    icon: MessageSquare,
    color: '#4f46e5',
    category: 'integrations',
    inputs: 1,
    outputs: 1,
  },
  'integration.whatsapp': {
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
    types: ['trigger.webhook', 'trigger.schedule', 'trigger.manual'],
  },
  actions: {
    label: 'Actions',
    color: '#3b82f6',
    types: ['action.http', 'action.send_email', 'action.set_data'],
  },
  logic: {
    label: 'Logic',
    color: '#8b5cf6',
    types: ['logic.if', 'logic.switch', 'logic.merge', 'logic.split'],
  },
  transform: {
    label: 'Transform',
    color: '#06b6d4',
    types: ['transform.json', 'transform.text', 'transform.code'],
  },
  integrations: {
    label: 'Integrations',
    color: '#22c55e',
    types: [
      'integration.google_sheets',
      'integration.slack',
      'integration.whatsapp',
    ],
  },
};

export function getNodeMeta(type: N8NNodeType): N8NNodeMeta {
  return N8N_NODE_REGISTRY[type];
}
