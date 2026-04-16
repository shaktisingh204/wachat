import type { BlockType } from '@/lib/sabflow/types';
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

type BlockMeta = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>> | ComponentType<{ className?: string }>;
  category: 'bubbles' | 'inputs' | 'logic' | 'integrations';
  color?: string;
};

const BLOCK_REGISTRY: Record<string, BlockMeta> = {
  // ── Bubbles ──
  text:          { label: 'Text',           icon: LuMessageSquare, category: 'bubbles', color: '#6366f1' },
  image:         { label: 'Image',          icon: LuImage,         category: 'bubbles', color: '#8b5cf6' },
  video:         { label: 'Video',          icon: LuVideo,         category: 'bubbles', color: '#a855f7' },
  audio:         { label: 'Audio',          icon: LuMic,           category: 'bubbles', color: '#c084fc' },
  embed:         { label: 'Embed',          icon: LuCode,          category: 'bubbles', color: '#d946ef' },

  // ── Inputs ──
  text_input:    { label: 'Text Input',     icon: LuType,          category: 'inputs',  color: '#06b6d4' },
  number_input:  { label: 'Number',         icon: LuHash,          category: 'inputs',  color: '#0ea5e9' },
  email_input:   { label: 'Email',          icon: LuMail,          category: 'inputs',  color: '#3b82f6' },
  phone_input:   { label: 'Phone',          icon: LuPhone,         category: 'inputs',  color: '#2563eb' },
  url_input:     { label: 'URL',            icon: LuLink,          category: 'inputs',  color: '#1d4ed8' },
  date_input:    { label: 'Date',           icon: LuCalendar,      category: 'inputs',  color: '#60a5fa' },
  time_input:    { label: 'Time',           icon: LuClock,         category: 'inputs',  color: '#93c5fd' },
  rating_input:  { label: 'Rating',         icon: LuStar,          category: 'inputs',  color: '#fbbf24' },
  file_input:    { label: 'File Upload',    icon: LuUpload,        category: 'inputs',  color: '#f59e0b' },
  payment_input: { label: 'Payment',        icon: LuCreditCard,    category: 'inputs',  color: '#d97706' },
  choice_input:  { label: 'Buttons',        icon: LuSquareCheck,   category: 'inputs',  color: '#10b981' },
  picture_choice_input: { label: 'Picture Choice', icon: LuLayoutGrid, category: 'inputs', color: '#059669' },

  // ── Logic ──
  condition:     { label: 'Condition',      icon: LuGitBranch,     category: 'logic',   color: '#f97316' },
  set_variable:  { label: 'Set Variable',   icon: LuVariable,      category: 'logic',   color: '#fb923c' },
  redirect:      { label: 'Redirect',       icon: LuExternalLink,  category: 'logic',   color: '#fdba74' },
  script:        { label: 'Script',         icon: LuFileCode,      category: 'logic',   color: '#fed7aa' },
  typebot_link:  { label: 'Jump to Flow',   icon: LuLink2,         category: 'logic',   color: '#fde68a' },
  wait:          { label: 'Wait',           icon: LuTimer,         category: 'logic',   color: '#fcd34d' },
  jump:          { label: 'Jump',           icon: LuShuffle,       category: 'logic',   color: '#fbbf24' },
  ab_test:       { label: 'A/B Test',       icon: LuFlaskConical,  category: 'logic',   color: '#f59e0b' },

  // ── Integrations ──
  webhook:          { label: 'HTTP Request',     icon: LuGlobe,        category: 'integrations', color: '#ec4899' },
  send_email:       { label: 'Send Email',       icon: LuSend,         category: 'integrations', color: '#f43f5e' },
  google_sheets:    { label: 'Google Sheets',    icon: LuSheet,        category: 'integrations', color: '#22c55e' },
  google_analytics: { label: 'Google Analytics', icon: LuChartBar,     category: 'integrations', color: '#ef4444' },
  open_ai:          { label: 'OpenAI',           icon: LuBot,          category: 'integrations', color: '#10b981' },
  zapier:           { label: 'Zapier',           icon: LuZap,          category: 'integrations', color: '#f97316' },
  make_com:         { label: 'Make',             icon: LuLayers,       category: 'integrations', color: '#6366f1' },
  pabbly_connect:   { label: 'Pabbly',           icon: LuPlug,         category: 'integrations', color: '#8b5cf6' },
  chatwoot:         { label: 'Chatwoot',         icon: LuUsers,        category: 'integrations', color: '#0ea5e9' },
  pixel:            { label: 'Pixel',            icon: LuEye,          category: 'integrations', color: '#64748b' },
  segment:          { label: 'Segment',          icon: LuActivity,     category: 'integrations', color: '#6366f1' },
  cal_com:          { label: 'Cal.com',          icon: LuCalendarDays, category: 'integrations', color: '#3b82f6' },
  nocodb:           { label: 'NocoDB',           icon: LuDatabase,     category: 'integrations', color: '#22c55e' },
  elevenlabs:       { label: 'ElevenLabs',       icon: LuVolume2,      category: 'integrations', color: '#f59e0b' },
  anthropic:        { label: 'Anthropic',        icon: LuBrain,        category: 'integrations', color: '#f97316' },
  together_ai:      { label: 'Together AI',      icon: LuCpu,          category: 'integrations', color: '#8b5cf6' },
  mistral:          { label: 'Mistral AI',       icon: LuBot,          category: 'integrations', color: '#6366f1' },
};

export function getBlockLabel(type: string): string {
  return BLOCK_REGISTRY[type]?.label ?? type;
}

export function getBlockIcon(type: string) {
  return BLOCK_REGISTRY[type]?.icon ?? null;
}

export function getBlockColor(type: string): string {
  return BLOCK_REGISTRY[type]?.color ?? '#9ca3af';
}

export function getBlockCategory(type: string) {
  return BLOCK_REGISTRY[type]?.category ?? 'integrations';
}

export const BLOCK_CATEGORIES = {
  bubbles: {
    label: 'Bubbles',
    color: '#6366f1',
    types: ['text', 'image', 'video', 'audio', 'embed'],
  },
  inputs: {
    label: 'Inputs',
    color: '#0ea5e9',
    types: ['text_input', 'number_input', 'email_input', 'phone_input', 'url_input', 'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input', 'choice_input', 'picture_choice_input'],
  },
  logic: {
    label: 'Logic',
    color: '#f97316',
    types: ['condition', 'set_variable', 'redirect', 'script', 'typebot_link', 'wait', 'jump', 'ab_test'],
  },
  integrations: {
    label: 'Integrations',
    color: '#ec4899',
    types: ['webhook', 'send_email', 'google_sheets', 'google_analytics', 'open_ai', 'zapier', 'make_com', 'pabbly_connect', 'chatwoot', 'pixel', 'segment', 'cal_com', 'nocodb', 'elevenlabs', 'anthropic', 'together_ai', 'mistral'],
  },
} as const;

export { BLOCK_REGISTRY };
