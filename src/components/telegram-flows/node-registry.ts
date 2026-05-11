/**
 * Telegram-specific node-type registry consumed by the lightweight canvas
 * and the inspector panel. Each entry contains a stable `type` string (the
 * value that gets persisted to Mongo), a display label, a one-line subtitle,
 * a lucide icon name, and an accent colour the canvas card uses for its
 * left-edge bar.
 *
 * Mirrors the spec's Telegram-specific node types. Adding a new node means
 * dropping a row here and (optionally) a custom inspector form in
 * `FlowInspectorPanel`; the engine on the Rust side accepts any free-form
 * `data` payload so no Rust change is required.
 */
import {
  ArrowRightCircle,
  CornerDownRight,
  Flag,
  GitBranch,
  Globe,
  Image as ImageIcon,
  KeySquare,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Send,
  Tag,
  UserCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type { TelegramNodeType } from '@/lib/rust-client/telegram-flows';

export type NodeCategory = 'trigger' | 'send' | 'control' | 'crm' | 'utility' | 'end';

export interface NodeTypeMeta {
  type: TelegramNodeType;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  category: NodeCategory;
  /** Default `data` payload when a fresh node of this type is dropped. */
  defaultData: () => Record<string, unknown>;
}

export const TELEGRAM_NODE_TYPES: NodeTypeMeta[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    subtitle: 'How the flow starts',
    icon: Flag,
    accent: '#229ED9',
    category: 'trigger',
    defaultData: () => ({}),
  },
  {
    type: 'send_message',
    label: 'Send message',
    subtitle: 'Plain or formatted text reply',
    icon: Send,
    accent: '#229ED9',
    category: 'send',
    defaultData: () => ({ text: 'Hello from SabNode!', parseMode: 'HTML' }),
  },
  {
    type: 'send_media',
    label: 'Send media',
    subtitle: 'Photo, video, document, audio',
    icon: ImageIcon,
    accent: '#7B61FF',
    category: 'send',
    defaultData: () => ({
      mediaKind: 'photo',
      caption: '',
      sabFile: null,
    }),
  },
  {
    type: 'send_keyboard',
    label: 'Send keyboard',
    subtitle: 'Inline buttons / reply keyboard',
    icon: LayoutGrid,
    accent: '#FFB020',
    category: 'send',
    defaultData: () => ({
      text: 'Pick one:',
      buttons: [{ label: 'Option A', data: 'opt_a' }],
    }),
  },
  {
    type: 'wait_for_reply',
    label: 'Wait for reply',
    subtitle: 'Pause until the user responds',
    icon: MessageCircle,
    accent: '#22C55E',
    category: 'control',
    defaultData: () => ({ timeoutSeconds: 300, saveAs: 'lastReply' }),
  },
  {
    type: 'branch_by_text',
    label: 'Branch by text',
    subtitle: 'Route on message contents',
    icon: GitBranch,
    accent: '#F97316',
    category: 'control',
    defaultData: () => ({ matchType: 'contains', cases: ['yes', 'no'] }),
  },
  {
    type: 'branch_by_callback',
    label: 'Branch by callback',
    subtitle: 'Route on callback data',
    icon: CornerDownRight,
    accent: '#F97316',
    category: 'control',
    defaultData: () => ({ cases: ['opt_a', 'opt_b'] }),
  },
  {
    type: 'assign_agent',
    label: 'Assign agent',
    subtitle: 'Hand off to a human agent',
    icon: UserCheck,
    accent: '#0EA5E9',
    category: 'crm',
    defaultData: () => ({ team: 'support' }),
  },
  {
    type: 'tag_contact',
    label: 'Tag contact',
    subtitle: 'Apply CRM tags',
    icon: Tag,
    accent: '#0EA5E9',
    category: 'crm',
    defaultData: () => ({ tags: [] as string[] }),
  },
  {
    type: 'set_variable',
    label: 'Set variable',
    subtitle: 'Store a value for later steps',
    icon: KeySquare,
    accent: '#A855F7',
    category: 'utility',
    defaultData: () => ({ name: 'myVar', value: '' }),
  },
  {
    type: 'http_request',
    label: 'HTTP request',
    subtitle: 'Call an external API',
    icon: Globe,
    accent: '#14B8A6',
    category: 'utility',
    defaultData: () => ({ method: 'GET', url: 'https://', headers: {} }),
  },
  {
    type: 'run_subflow',
    label: 'Run subflow',
    subtitle: 'Invoke another flow',
    icon: Workflow,
    accent: '#A855F7',
    category: 'utility',
    defaultData: () => ({ subflowId: '' }),
  },
  {
    type: 'end',
    label: 'End',
    subtitle: 'Finish the flow',
    icon: ArrowRightCircle,
    accent: '#6B7280',
    category: 'end',
    defaultData: () => ({}),
  },
];

export const NODE_TYPE_BY_KIND = new Map<string, NodeTypeMeta>(
  TELEGRAM_NODE_TYPES.map((n) => [n.type, n]),
);

export function nodeMeta(kind: string): NodeTypeMeta {
  return (
    NODE_TYPE_BY_KIND.get(kind) ?? {
      type: 'send_message',
      label: kind,
      subtitle: 'Unknown node type',
      icon: MessageSquare,
      accent: '#6B7280',
      category: 'utility',
      defaultData: () => ({}),
    }
  );
}
