/**
 * Shared definition of the 12 SabNode modules.
 * Single source of truth — all green-themed for the tree landing page.
 */

import {
  MessageSquare, Bot, GitFork, Users, Send, ShoppingBag, Mail,
  MessageCircle, Search, Puzzle, ServerCog,
  type LucideIcon,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';

export type ModuleDef = {
  id: string;
  label: string;
  icon: LucideIcon | React.FC<{ className?: string; strokeWidth?: number }>;
  /** Brand accent color — all greens from the Tailwind green/emerald/teal/lime families */
  color: string;
  /** Darker shade for contrast */
  dark: string;
};

export const MODULES: readonly ModuleDef[] = [
  { id: 'inbox',        label: 'Unified Inbox',  icon: MessageSquare, color: '#10b981', dark: '#047857' },
  { id: 'whatsapp',     label: 'WhatsApp',       icon: WhatsAppIcon,  color: '#22c55e', dark: '#15803d' },
  { id: 'chatbot',      label: 'AI Chatbot',     icon: Bot,           color: '#14b8a6', dark: '#0f766e' },
  { id: 'flows',        label: 'SabFlow',        icon: GitFork,       color: '#059669', dark: '#065f46' },
  { id: 'crm',          label: 'CRM',            icon: Users,         color: '#84cc16', dark: '#4d7c0f' },
  { id: 'broadcasts',   label: 'Broadcasts',     icon: Send,          color: '#16a34a', dark: '#166534' },
  { id: 'catalog',      label: 'Catalog',        icon: ShoppingBag,   color: '#06b6d4', dark: '#0e7490' },
  { id: 'email',        label: 'Email',          icon: Mail,          color: '#10b981', dark: '#047857' },
  { id: 'sms',          label: 'SMS',            icon: MessageCircle, color: '#22c55e', dark: '#15803d' },
  { id: 'seo',          label: 'SEO',            icon: Search,        color: '#65a30d', dark: '#3f6212' },
  { id: 'integrations', label: 'Integrations',   icon: Puzzle,        color: '#0d9488', dark: '#115e59' },
  { id: 'workers',      label: 'Workers',        icon: ServerCog,     color: '#15803d', dark: '#14532d' },
] as const;
