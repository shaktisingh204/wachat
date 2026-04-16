import type { BlockType } from '@/lib/sabflow/types';
import type { ComponentType, SVGProps } from 'react';

import {
  MessageSquare, Image, Video, Mic, Code,
  Type, Hash, Mail, Phone, Link, Calendar, Clock, Star, Upload, CreditCard,
  CheckSquare, LayoutGrid,
  GitBranch, Variable, ExternalLink, FileCode, Link2, Timer, Shuffle, FlaskConical,
  Globe, Send, Sheet, BarChart, Bot, Zap, Users, Plug, Eye, BarChart2,
  CalendarDays, Database, Volume2, Brain, Cpu, Layers
} from 'lucide-react';

type BlockMeta = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>> | ComponentType<{ className?: string }>;
  category: 'bubbles' | 'inputs' | 'logic' | 'integrations';
  color?: string;
};

const BLOCK_REGISTRY: Record<string, BlockMeta> = {
  // ── Bubbles ──
  text:          { label: 'Text',           icon: MessageSquare, category: 'bubbles', color: '#6366f1' },
  image:         { label: 'Image',          icon: Image,         category: 'bubbles', color: '#8b5cf6' },
  video:         { label: 'Video',          icon: Video,         category: 'bubbles', color: '#a855f7' },
  audio:         { label: 'Audio',          icon: Mic,           category: 'bubbles', color: '#c084fc' },
  embed:         { label: 'Embed',          icon: Code,          category: 'bubbles', color: '#d946ef' },

  // ── Inputs ──
  text_input:    { label: 'Text Input',     icon: Type,          category: 'inputs',  color: '#06b6d4' },
  number_input:  { label: 'Number',         icon: Hash,          category: 'inputs',  color: '#0ea5e9' },
  email_input:   { label: 'Email',          icon: Mail,          category: 'inputs',  color: '#3b82f6' },
  phone_input:   { label: 'Phone',          icon: Phone,         category: 'inputs',  color: '#2563eb' },
  url_input:     { label: 'URL',            icon: Link,          category: 'inputs',  color: '#1d4ed8' },
  date_input:    { label: 'Date',           icon: Calendar,      category: 'inputs',  color: '#60a5fa' },
  time_input:    { label: 'Time',           icon: Clock,         category: 'inputs',  color: '#93c5fd' },
  rating_input:  { label: 'Rating',         icon: Star,          category: 'inputs',  color: '#fbbf24' },
  file_input:    { label: 'File Upload',    icon: Upload,        category: 'inputs',  color: '#f59e0b' },
  payment_input: { label: 'Payment',        icon: CreditCard,    category: 'inputs',  color: '#d97706' },
  choice_input:  { label: 'Buttons',        icon: CheckSquare,   category: 'inputs',  color: '#10b981' },
  picture_choice_input: { label: 'Picture Choice', icon: LayoutGrid, category: 'inputs', color: '#059669' },

  // ── Logic ──
  condition:     { label: 'Condition',      icon: GitBranch,     category: 'logic',   color: '#f97316' },
  set_variable:  { label: 'Set Variable',   icon: Variable,      category: 'logic',   color: '#fb923c' },
  redirect:      { label: 'Redirect',       icon: ExternalLink,  category: 'logic',   color: '#fdba74' },
  script:        { label: 'Script',         icon: FileCode,      category: 'logic',   color: '#fed7aa' },
  typebot_link:  { label: 'Jump to Flow',   icon: Link2,         category: 'logic',   color: '#fde68a' },
  wait:          { label: 'Wait',           icon: Timer,         category: 'logic',   color: '#fcd34d' },
  jump:          { label: 'Jump',           icon: Shuffle,       category: 'logic',   color: '#fbbf24' },
  ab_test:       { label: 'A/B Test',       icon: FlaskConical,  category: 'logic',   color: '#f59e0b' },

  // ── Integrations ──
  webhook:          { label: 'HTTP Request',     icon: Globe,        category: 'integrations', color: '#ec4899' },
  send_email:       { label: 'Send Email',       icon: Send,         category: 'integrations', color: '#f43f5e' },
  google_sheets:    { label: 'Google Sheets',    icon: Sheet,        category: 'integrations', color: '#22c55e' },
  google_analytics: { label: 'Google Analytics', icon: BarChart,     category: 'integrations', color: '#ef4444' },
  open_ai:          { label: 'OpenAI',           icon: Bot,          category: 'integrations', color: '#10b981' },
  zapier:           { label: 'Zapier',           icon: Zap,          category: 'integrations', color: '#f97316' },
  make_com:         { label: 'Make',             icon: Layers,       category: 'integrations', color: '#6366f1' },
  pabbly_connect:   { label: 'Pabbly',           icon: Plug,         category: 'integrations', color: '#8b5cf6' },
  chatwoot:         { label: 'Chatwoot',         icon: Users,        category: 'integrations', color: '#0ea5e9' },
  pixel:            { label: 'Pixel',            icon: Eye,          category: 'integrations', color: '#64748b' },
  segment:          { label: 'Segment',          icon: BarChart2,    category: 'integrations', color: '#6366f1' },
  cal_com:          { label: 'Cal.com',          icon: CalendarDays, category: 'integrations', color: '#3b82f6' },
  nocodb:           { label: 'NocoDB',           icon: Database,     category: 'integrations', color: '#22c55e' },
  elevenlabs:       { label: 'ElevenLabs',       icon: Volume2,      category: 'integrations', color: '#f59e0b' },
  anthropic:        { label: 'Anthropic',        icon: Brain,        category: 'integrations', color: '#f97316' },
  together_ai:      { label: 'Together AI',      icon: Cpu,          category: 'integrations', color: '#8b5cf6' },
  mistral:          { label: 'Mistral AI',       icon: Bot,          category: 'integrations', color: '#6366f1' },
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
