'use client';
/**
 * SabFlow block registry — single source of truth for block display metadata.
 *
 * Every entry maps a BlockType → { label, icon, category, description, color }.
 * Icons come exclusively from `react-icons/lu` (Lu-prefixed).
 */

import type { ComponentType, SVGProps } from 'react';
import {
  LuMessageSquare,
  LuImage,
  LuVideo,
  LuMic,
  LuCode,
  LuType,
  LuHash,
  LuMail,
  LuPhone,
  LuLink,
  LuCalendar,
  LuClock,
  LuStar,
  LuUpload,
  LuCreditCard,
  LuSquareCheck,
  LuLayoutGrid,
  LuGitBranch,
  LuVariable,
  LuExternalLink,
  LuFileCode,
  LuLink2,
  LuTimer,
  LuShuffle,
  LuFlaskConical,
  LuGlobe,
  LuSend,
  LuSheet,
  LuChartBar,
  LuBot,
  LuZap,
  LuLayers,
  LuPlug,
  LuUsers,
  LuEye,
  LuActivity,
  LuCalendarDays,
  LuDatabase,
  LuVolume2,
  LuBrain,
  LuCpu,
} from 'react-icons/lu';

import type { BlockCategory, BlockType } from '@/lib/sabflow/types';

/** Icon type accepted by both react-icons/lu and our render layer. */
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type BlockRegistryEntry = {
  type: BlockType;
  label: string;
  icon: IconComponent;
  category: BlockCategory;
  description: string;
  color: string;
};

/* ── Registry ─────────────────────────────────────────────── */

export const blockRegistry: BlockRegistryEntry[] = [
  // ── Bubbles ───────────────────────────────────────────────
  {
    type: 'text',
    label: 'Text',
    icon: LuMessageSquare as IconComponent,
    category: 'bubbles',
    description: 'Send a text message to the user',
    color: '#6366f1',
  },
  {
    type: 'image',
    label: 'Image',
    icon: LuImage as IconComponent,
    category: 'bubbles',
    description: 'Display an image in the chat',
    color: '#8b5cf6',
  },
  {
    type: 'video',
    label: 'Video',
    icon: LuVideo as IconComponent,
    category: 'bubbles',
    description: 'Embed a video in the chat',
    color: '#a855f7',
  },
  {
    type: 'audio',
    label: 'Audio',
    icon: LuMic as IconComponent,
    category: 'bubbles',
    description: 'Play an audio file for the user',
    color: '#c084fc',
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: LuCode as IconComponent,
    category: 'bubbles',
    description: 'Embed any webpage or iframe',
    color: '#d946ef',
  },

  // ── Inputs ────────────────────────────────────────────────
  {
    type: 'text_input',
    label: 'Text Input',
    icon: LuType as IconComponent,
    category: 'inputs',
    description: 'Collect a free-text answer',
    color: '#06b6d4',
  },
  {
    type: 'number_input',
    label: 'Number',
    icon: LuHash as IconComponent,
    category: 'inputs',
    description: 'Collect a numeric value',
    color: '#0ea5e9',
  },
  {
    type: 'email_input',
    label: 'Email',
    icon: LuMail as IconComponent,
    category: 'inputs',
    description: 'Collect a valid email address',
    color: '#3b82f6',
  },
  {
    type: 'phone_input',
    label: 'Phone',
    icon: LuPhone as IconComponent,
    category: 'inputs',
    description: 'Collect a phone number',
    color: '#2563eb',
  },
  {
    type: 'url_input',
    label: 'URL',
    icon: LuLink as IconComponent,
    category: 'inputs',
    description: 'Collect a web address',
    color: '#1d4ed8',
  },
  {
    type: 'date_input',
    label: 'Date',
    icon: LuCalendar as IconComponent,
    category: 'inputs',
    description: 'Collect a date',
    color: '#60a5fa',
  },
  {
    type: 'time_input',
    label: 'Time',
    icon: LuClock as IconComponent,
    category: 'inputs',
    description: 'Collect a time value',
    color: '#93c5fd',
  },
  {
    type: 'rating_input',
    label: 'Rating',
    icon: LuStar as IconComponent,
    category: 'inputs',
    description: 'Collect a star or NPS rating',
    color: '#fbbf24',
  },
  {
    type: 'file_input',
    label: 'File Upload',
    icon: LuUpload as IconComponent,
    category: 'inputs',
    description: 'Let the user upload a file',
    color: '#f59e0b',
  },
  {
    type: 'payment_input',
    label: 'Payment',
    icon: LuCreditCard as IconComponent,
    category: 'inputs',
    description: 'Collect a payment',
    color: '#d97706',
  },
  {
    type: 'choice_input',
    label: 'Buttons',
    icon: LuSquareCheck as IconComponent,
    category: 'inputs',
    description: 'Show multiple-choice buttons',
    color: '#10b981',
  },
  {
    type: 'picture_choice_input',
    label: 'Picture Choice',
    icon: LuLayoutGrid as IconComponent,
    category: 'inputs',
    description: 'Show image-based choice options',
    color: '#059669',
  },

  // ── Logic ─────────────────────────────────────────────────
  {
    type: 'condition',
    label: 'Condition',
    icon: LuGitBranch as IconComponent,
    category: 'logic',
    description: 'Branch the flow with if/else logic',
    color: '#f97316',
  },
  {
    type: 'set_variable',
    label: 'Set Variable',
    icon: LuVariable as IconComponent,
    category: 'logic',
    description: 'Assign a value to a variable',
    color: '#fb923c',
  },
  {
    type: 'redirect',
    label: 'Redirect',
    icon: LuExternalLink as IconComponent,
    category: 'logic',
    description: 'Redirect the user to a URL',
    color: '#fdba74',
  },
  {
    type: 'script',
    label: 'Script',
    icon: LuFileCode as IconComponent,
    category: 'logic',
    description: 'Run custom JavaScript',
    color: '#fed7aa',
  },
  {
    type: 'typebot_link',
    label: 'Jump to Flow',
    icon: LuLink2 as IconComponent,
    category: 'logic',
    description: 'Link to another SabFlow',
    color: '#fde68a',
  },
  {
    type: 'wait',
    label: 'Wait',
    icon: LuTimer as IconComponent,
    category: 'logic',
    description: 'Pause execution for a duration',
    color: '#fcd34d',
  },
  {
    type: 'jump',
    label: 'Jump',
    icon: LuShuffle as IconComponent,
    category: 'logic',
    description: 'Jump to another group in the flow',
    color: '#fbbf24',
  },
  {
    type: 'ab_test',
    label: 'A/B Test',
    icon: LuFlaskConical as IconComponent,
    category: 'logic',
    description: 'Split traffic for A/B testing',
    color: '#f59e0b',
  },

  // ── Integrations ──────────────────────────────────────────
  {
    type: 'webhook',
    label: 'HTTP Request',
    icon: LuGlobe as IconComponent,
    category: 'integrations',
    description: 'Call any HTTP endpoint',
    color: '#ec4899',
  },
  {
    type: 'send_email',
    label: 'Send Email',
    icon: LuSend as IconComponent,
    category: 'integrations',
    description: 'Send an email via SMTP or API',
    color: '#f43f5e',
  },
  {
    type: 'google_sheets',
    label: 'Google Sheets',
    icon: LuSheet as IconComponent,
    category: 'integrations',
    description: 'Read or write Google Sheets rows',
    color: '#22c55e',
  },
  {
    type: 'google_analytics',
    label: 'Google Analytics',
    icon: LuChartBar as IconComponent,
    category: 'integrations',
    description: 'Track events in Google Analytics',
    color: '#ef4444',
  },
  {
    type: 'open_ai',
    label: 'OpenAI',
    icon: LuBot as IconComponent,
    category: 'integrations',
    description: 'Generate text with OpenAI GPT',
    color: '#10b981',
  },
  {
    type: 'zapier',
    label: 'Zapier',
    icon: LuZap as IconComponent,
    category: 'integrations',
    description: 'Trigger a Zapier automation',
    color: '#f97316',
  },
  {
    type: 'make_com',
    label: 'Make',
    icon: LuLayers as IconComponent,
    category: 'integrations',
    description: 'Trigger a Make.com scenario',
    color: '#6366f1',
  },
  {
    type: 'pabbly_connect',
    label: 'Pabbly',
    icon: LuPlug as IconComponent,
    category: 'integrations',
    description: 'Trigger a Pabbly Connect workflow',
    color: '#8b5cf6',
  },
  {
    type: 'chatwoot',
    label: 'Chatwoot',
    icon: LuUsers as IconComponent,
    category: 'integrations',
    description: 'Create or update a Chatwoot contact',
    color: '#0ea5e9',
  },
  {
    type: 'pixel',
    label: 'Pixel',
    icon: LuEye as IconComponent,
    category: 'integrations',
    description: 'Fire a Meta or custom pixel event',
    color: '#64748b',
  },
  {
    type: 'segment',
    label: 'Segment',
    icon: LuActivity as IconComponent,
    category: 'integrations',
    description: 'Track events in Segment',
    color: '#6366f1',
  },
  {
    type: 'cal_com',
    label: 'Cal.com',
    icon: LuCalendarDays as IconComponent,
    category: 'integrations',
    description: 'Embed a Cal.com booking page',
    color: '#3b82f6',
  },
  {
    type: 'nocodb',
    label: 'NocoDB',
    icon: LuDatabase as IconComponent,
    category: 'integrations',
    description: 'Read or write NocoDB rows',
    color: '#22c55e',
  },
  {
    type: 'elevenlabs',
    label: 'ElevenLabs',
    icon: LuVolume2 as IconComponent,
    category: 'integrations',
    description: 'Generate speech with ElevenLabs',
    color: '#f59e0b',
  },
  {
    type: 'anthropic',
    label: 'Anthropic',
    icon: LuBrain as IconComponent,
    category: 'integrations',
    description: 'Generate text with Claude AI',
    color: '#f97316',
  },
  {
    type: 'together_ai',
    label: 'Together AI',
    icon: LuCpu as IconComponent,
    category: 'integrations',
    description: 'Run open-source models on Together AI',
    color: '#8b5cf6',
  },
  {
    type: 'mistral',
    label: 'Mistral AI',
    icon: LuBot as IconComponent,
    category: 'integrations',
    description: 'Generate text with Mistral models',
    color: '#6366f1',
  },
];

/* ── Derived lookups ──────────────────────────────────────── */

/** Flat map: type → entry */
export const blockRegistryMap = new Map<BlockType, BlockRegistryEntry>(
  blockRegistry.map((e) => [e.type, e]),
);

/** Entries grouped by category, preserving display order. */
export const REGISTRY_CATEGORIES: {
  key: BlockCategory;
  label: string;
  color: string;
  entries: BlockRegistryEntry[];
}[] = [
  {
    key: 'bubbles',
    label: 'Bubbles',
    color: '#6366f1',
    entries: blockRegistry.filter((e) => e.category === 'bubbles'),
  },
  {
    key: 'inputs',
    label: 'Inputs',
    color: '#0ea5e9',
    entries: blockRegistry.filter((e) => e.category === 'inputs'),
  },
  {
    key: 'logic',
    label: 'Logic',
    color: '#f97316',
    entries: blockRegistry.filter((e) => e.category === 'logic'),
  },
  {
    key: 'integrations',
    label: 'Integrations',
    color: '#ec4899',
    entries: blockRegistry.filter((e) => e.category === 'integrations'),
  },
];

/** Get a single entry by BlockType — returns undefined if unknown. */
export function getRegistryEntry(type: BlockType): BlockRegistryEntry | undefined {
  return blockRegistryMap.get(type);
}
