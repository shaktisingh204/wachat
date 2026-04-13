'use client';

/**
 * ClayDashboardLayout — the shared Clay chrome used by every
 * authenticated SabNode route. Holds the topbar, sidebar, and
 * a main slot for route children.
 *
 * Reused by:
 *   - /home/layout.tsx
 *   - (later) /dashboard/layout.tsx — which will swap out the old
 *     AdminLayout in Phase 1 of the Clay rollout.
 */

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LuSearch,
  LuUserPlus,
  LuBell,
  LuEllipsis,
  LuLayoutDashboard,
  LuMessagesSquare,
  LuWorkflow,
  LuBriefcase,
  LuSettings,
  LuChevronDown,
  LuCalendar,
  LuRefreshCw,
  LuLogOut,
  LuUser,
  LuCircleHelp,
  LuKeyboard,
  LuSend,
  LuBot,
  LuMail,
  LuGlobe,
  LuSmartphone,
  LuPlus,
  LuLanguages,
  LuArrowLeft,
  LuUsers,
  LuInbox,
  LuBookCopy,
  LuPhone,
  LuGitBranch,
  LuShoppingBag,
  LuCreditCard,
  LuWebhook,
  LuBolt,
  LuActivity,
  LuServerCog,
  LuHash,
  LuPuzzle,
  LuReply,
  LuMegaphone,
  LuTarget,
  LuImage,
  LuChartBar,
  LuFileText,
  LuZap,
  LuFlaskConical,
  LuPackage,
  LuScanLine,
  LuRadar,
  LuListChecks,
  LuReceipt,
  LuWrench,
  LuSplit,
  LuTrendingUp,
  LuEye,
  LuMousePointerClick,
  LuFacebook,
  LuInstagram,
  LuSquarePen,
  LuCalendarClock,
  LuRadio,
  LuMessageCircle,
  LuColumns3,
  LuShoppingCart,
  LuStore,
  LuMap,
  LuCalendarDays,
  LuContact,
  LuStar,
  LuImagePlay,
  LuMessageSquareDashed,
  LuShieldCheck,
  LuClapperboard,
  LuCirclePlay,
  LuUserCheck,
  LuQrCode,
  LuKey,
  LuBookmark,
  LuUserCog,
  LuTag,
  LuClock,
  LuStickyNote,
  LuFileDown,
  LuShield,
  LuGroup,
  LuBan,
  LuMessageSquareQuote,
  LuBrainCircuit,
  LuStarHalf,
  LuLink2,
  LuListFilter,
  LuFolderOpen,
  LuLink,
  LuEarth,
  LuLayoutTemplate,
  LuMessageSquare,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import {
  ClayShell,
  ClaySidebar,
  ClayTopbar,
  ClayButton,
  ClayUserCard,
  type ClayNavItem,
} from '@/components/clay';
import { useProject } from '@/context/project-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

/* ── types ──────────────────────────────────────────────────────── */

export type ClayLayoutUser = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export type ClayLayoutPlan = {
  name?: string | null;
  credits?: number;
};

export type ClayLayoutContext = 'sabnode' | 'wachat' | 'meta-suite' | 'instagram' | 'ad-manager' | 'sabflow';

export interface ClayDashboardLayoutProps {
  user?: ClayLayoutUser;
  plan?: ClayLayoutPlan;
  /**
   * Which sidebar nav registry to render.
   * - `sabnode` (default) — top-level cross-app nav for /home
   * - `wachat` — WhatsApp module nav (Chat, Broadcasts, Templates, etc.)
   */
  context?: ClayLayoutContext;
  children: React.ReactNode;
}

/* ── nav registry ───────────────────────────────────────────────── */

type NavEntry = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  /** pathname prefixes that mark this item active */
  matches: string[];
};

const primaryNav: NavEntry[] = [
  {
    key: 'home',
    label: 'Home',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/home',
    matches: ['/home'],
  },
  {
    key: 'wachat',
    label: 'Wachat',
    icon: <LuMessagesSquare className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard',
    matches: [
      '/dashboard/chat',
      '/dashboard/broadcasts',
      '/dashboard/templates',
      '/dashboard/contacts',
      '/dashboard/wachat',
    ],
  },
  {
    key: 'sabflow',
    label: 'SabFlow',
    icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow',
    matches: ['/dashboard/sabflow', '/dashboard/flow-builder', '/dashboard/flows'],
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: <LuBriefcase className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/crm/sales-crm/leads',
    matches: ['/dashboard/crm'],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings',
    matches: ['/dashboard/settings', '/dashboard/profile', '/dashboard/team'],
  },
];

const appsNav: NavEntry[] = [
  {
    key: 'sabchat',
    label: 'SabChat',
    icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabchat',
    matches: ['/dashboard/sabchat'],
  },
  {
    key: 'seo',
    label: 'SEO Suite',
    icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/seo',
    matches: ['/dashboard/seo'],
  },
  {
    key: 'email',
    label: 'Email',
    icon: <LuMail className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/email',
    matches: ['/dashboard/email'],
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sms',
    matches: ['/dashboard/sms'],
  },
  {
    key: 'ad-manager',
    label: 'Ad Manager',
    icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/ad-manager/ad-accounts',
    matches: ['/dashboard/ad-manager'],
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/telegram',
    matches: ['/dashboard/telegram'],
  },
  {
    key: 'meta-suite',
    label: 'Meta Suite',
    icon: <LuFacebook className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/facebook/all-projects',
    matches: ['/dashboard/facebook', '/dashboard/meta-suite'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: <LuInstagram className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/instagram/connections',
    matches: ['/dashboard/instagram'],
  },
  {
    key: 'templates',
    label: 'Templates',
    icon: <LuLayoutTemplate className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/templates',
    matches: ['/dashboard/templates'],
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/shop',
    matches: ['/dashboard/shop'],
  },
  {
    key: 'url-shortener',
    label: 'URL Shortener',
    icon: <LuLink className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/url-shortener',
    matches: ['/dashboard/url-shortener'],
  },
  {
    key: 'qr-codes',
    label: 'QR Codes',
    icon: <LuQrCode className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-code-maker',
    matches: ['/dashboard/qr-code-maker'],
  },
  {
    key: 'website-builder',
    label: 'Website Builder',
    icon: <LuEarth className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/website-builder',
    matches: ['/dashboard/website-builder'],
  },
  {
    key: 'team',
    label: 'Team',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/team',
    matches: ['/dashboard/team'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/notifications',
    matches: ['/dashboard/notifications'],
  },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Wachat nav registry — loaded when context="wachat".
 *  Mirrors src/config/dashboard-config.ts `wachatMenuItems` but
 *  structured into the Clay sidebar's (primary + sub-groups) pattern.
 * ══════════════════════════════════════════════════════════════════ */

/* ── Primary: Core messaging & outreach ── */
const wachatPrimary: NavEntry[] = [
  {
    key: 'wachat-overview',
    label: 'Overview',
    icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/overview',
    matches: ['/dashboard/overview'],
  },
  {
    key: 'wachat-chat',
    label: 'Live Chat',
    icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/chat',
    matches: ['/dashboard/chat'],
  },
  {
    key: 'wachat-contacts',
    label: 'Contacts',
    icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/contacts',
    matches: ['/dashboard/contacts', '/dashboard/wachat/contacts'],
  },
  {
    key: 'wachat-broadcasts',
    label: 'Campaigns',
    icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/broadcasts',
    matches: ['/dashboard/broadcasts', '/dashboard/bulk'],
  },
  {
    key: 'wachat-templates',
    label: 'Templates',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/templates',
    matches: ['/dashboard/templates', '/dashboard/canned-messages'],
  },
];

/* ── Automate: Flow builders, auto-reply, bots ── */
const wachatAutomate: NavEntry[] = [
  {
    key: 'wachat-flow-builder',
    label: 'Flow Builder',
    icon: <LuGitBranch className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/flow-builder',
    matches: ['/dashboard/flow-builder'],
  },
  {
    key: 'wachat-flows',
    label: 'Meta Flows',
    icon: <LuServerCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/flows',
    matches: ['/dashboard/flows'],
  },
  {
    key: 'wachat-auto-reply',
    label: 'Auto Reply',
    icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/auto-reply',
    matches: ['/dashboard/auto-reply'],
  },
  {
    key: 'wachat-auto-reply-rules',
    label: 'Reply Rules',
    icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/auto-reply-rules',
    matches: ['/dashboard/auto-reply-rules'],
  },
  {
    key: 'wachat-chatbot',
    label: 'Chatbot',
    icon: <LuBrainCircuit className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/chatbot',
    matches: ['/dashboard/chatbot'],
  },
  {
    key: 'wachat-automation',
    label: 'Conversational AI',
    icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/automation',
    matches: ['/dashboard/automation'],
  },
  {
    key: 'wachat-scheduled-messages',
    label: 'Scheduled Messages',
    icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/scheduled-messages',
    matches: ['/dashboard/scheduled-messages'],
  },
];

/* ── Grow: Commerce, payments, links, QR ── */
const wachatGrow: NavEntry[] = [
  {
    key: 'wachat-catalog',
    label: 'Catalog',
    icon: <LuShoppingBag className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/catalog',
    matches: ['/dashboard/catalog'],
  },
  {
    key: 'wachat-pay',
    label: 'WhatsApp Pay',
    icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/whatsapp-pay',
    matches: ['/dashboard/whatsapp-pay'],
  },
  {
    key: 'wachat-qr-codes',
    label: 'QR Codes',
    icon: <LuQrCode className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/qr-codes',
    matches: ['/dashboard/qr-codes'],
  },
  {
    key: 'wachat-analytics',
    label: 'Analytics',
    icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/analytics',
    matches: ['/dashboard/analytics'],
  },
  { key: 'wachat-template-analytics', label: 'Template Analytics', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/template-analytics', matches: ['/dashboard/template-analytics'] },
  { key: 'wachat-message-analytics', label: 'Message Stats', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-analytics', matches: ['/dashboard/message-analytics'] },
  { key: 'wachat-broadcast-segments', label: 'Segments', icon: <LuGroup className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-segments', matches: ['/dashboard/broadcast-segments'] },
  { key: 'wachat-chat-labels', label: 'Chat Labels', icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-labels', matches: ['/dashboard/chat-labels'] },
  { key: 'wachat-contact-groups', label: 'Contact Groups', icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-groups', matches: ['/dashboard/contact-groups'] },
  { key: 'wachat-saved-replies', label: 'Saved Replies', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/saved-replies', matches: ['/dashboard/saved-replies'] },
  { key: 'wachat-media-library', label: 'Media Library', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/media-library', matches: ['/dashboard/media-library'] },
  { key: 'wachat-link-tracking', label: 'Link Tracking', icon: <LuLink2 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/link-tracking', matches: ['/dashboard/link-tracking'] },
  { key: 'wachat-chat-ratings', label: 'Chat Ratings', icon: <LuStarHalf className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-ratings', matches: ['/dashboard/chat-ratings'] },
  { key: 'wachat-customer-satisfaction', label: 'Satisfaction', icon: <LuStarHalf className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/customer-satisfaction', matches: ['/dashboard/customer-satisfaction'] },
  { key: 'wachat-response-tracker', label: 'Response Times', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/response-time-tracker', matches: ['/dashboard/response-time-tracker'] },
  { key: 'wachat-delivery-reports', label: 'Delivery Reports', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/delivery-reports', matches: ['/dashboard/delivery-reports'] },
  { key: 'wachat-message-stats', label: 'Message Statistics', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-statistics', matches: ['/dashboard/message-statistics'] },
  { key: 'wachat-credit-usage', label: 'Credit Usage', icon: <LuCreditCard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/credit-usage', matches: ['/dashboard/credit-usage'] },
  { key: 'wachat-broadcast-history', label: 'Broadcast History', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-history', matches: ['/dashboard/broadcast-history'] },
  { key: 'wachat-broadcast-scheduler', label: 'Broadcast Scheduler', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/broadcast-scheduler', matches: ['/dashboard/broadcast-scheduler'] },
  { key: 'wachat-campaign-ab', label: 'A/B Test', icon: <LuSplit className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/campaign-ab-test', matches: ['/dashboard/campaign-ab-test'] },
  { key: 'wachat-wa-link-gen', label: 'Link Generator', icon: <LuLink2 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/whatsapp-link-generator', matches: ['/dashboard/whatsapp-link-generator'] },
  { key: 'wachat-bulk-messaging', label: 'Bulk Messaging', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/bulk-messaging', matches: ['/dashboard/bulk-messaging'] },
];

/* ── Configure: Account, phone numbers, dev tools, project settings ── */
const wachatConfigure: NavEntry[] = [
  {
    key: 'wachat-numbers',
    label: 'Numbers',
    icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/numbers',
    matches: ['/dashboard/numbers'],
  },
  {
    key: 'wachat-calls',
    label: 'Calls',
    icon: <LuPhone className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/calls',
    matches: ['/dashboard/calls'],
  },
  {
    key: 'wachat-health',
    label: 'Account Health',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/health',
    matches: ['/dashboard/health'],
  },
  {
    key: 'wachat-integrations',
    label: 'Integrations',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/integrations',
    matches: ['/dashboard/integrations'],
  },
  {
    key: 'wachat-webhooks',
    label: 'Webhooks',
    icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/webhooks',
    matches: ['/dashboard/webhooks'],
  },
  {
    key: 'wachat-general-settings',
    label: 'General Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/general',
    matches: ['/dashboard/settings/general', '/dashboard/settings'],
  },
  {
    key: 'wachat-agents',
    label: 'Agents & Roles',
    icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/agents',
    matches: ['/dashboard/settings/agents'],
  },
  {
    key: 'wachat-attributes',
    label: 'User Attributes',
    icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/attributes',
    matches: ['/dashboard/settings/attributes'],
  },
  {
    key: 'wachat-canned',
    label: 'Canned Messages',
    icon: <LuBookmark className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/settings/canned',
    matches: ['/dashboard/settings/canned'],
  },
  { key: 'wachat-business-hours', label: 'Business Hours', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/business-hours', matches: ['/dashboard/business-hours'] },
  { key: 'wachat-opt-out', label: 'Opt-Out / DND', icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/opt-out', matches: ['/dashboard/opt-out'] },
  { key: 'wachat-blocked', label: 'Blocked Contacts', icon: <LuShield className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/blocked-contacts', matches: ['/dashboard/blocked-contacts'] },
  { key: 'wachat-team-perf', label: 'Team Performance', icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/team-performance', matches: ['/dashboard/team-performance'] },
  { key: 'wachat-assignments', label: 'Assignments', icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/assignments', matches: ['/dashboard/assignments'] },
  { key: 'wachat-contact-notes', label: 'Contact Notes', icon: <LuStickyNote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-notes', matches: ['/dashboard/contact-notes'] },
  { key: 'wachat-chat-export', label: 'Chat Export', icon: <LuFileDown className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-export', matches: ['/dashboard/chat-export'] },
  { key: 'wachat-greeting', label: 'Greeting Message', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/greeting-messages', matches: ['/dashboard/greeting-messages'] },
  { key: 'wachat-away', label: 'Away Message', icon: <LuMessageSquareQuote className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/away-messages', matches: ['/dashboard/away-messages'] },
  { key: 'wachat-blacklist', label: 'Blacklist', icon: <LuBan className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-blacklist', matches: ['/dashboard/contact-blacklist'] },
  { key: 'wachat-notif-prefs', label: 'Notifications', icon: <LuBell className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/notification-preferences', matches: ['/dashboard/notification-preferences'] },
  { key: 'wachat-msg-tags', label: 'Message Tags', icon: <LuTag className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-tags', matches: ['/dashboard/message-tags'] },
  { key: 'wachat-import-history', label: 'Import History', icon: <LuFileDown className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-import-history', matches: ['/dashboard/contact-import-history'] },
  { key: 'wachat-conv-filters', label: 'Filters', icon: <LuListFilter className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-filters', matches: ['/dashboard/conversation-filters'] },
  { key: 'wachat-api-keys', label: 'API Keys', icon: <LuKey className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/api-keys', matches: ['/dashboard/api-keys'] },
  { key: 'wachat-agent-avail', label: 'Agent Status', icon: <LuUserPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/agent-availability', matches: ['/dashboard/agent-availability'] },
  { key: 'wachat-phone-settings', label: 'Phone Settings', icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/phone-number-settings', matches: ['/dashboard/phone-number-settings'] },
  { key: 'wachat-qr-cats', label: 'Reply Categories', icon: <LuFolderOpen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/quick-reply-categories', matches: ['/dashboard/quick-reply-categories'] },
  { key: 'wachat-webhook-logs', label: 'Webhook Logs', icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/webhook-logs', matches: ['/dashboard/webhook-logs'] },
  { key: 'wachat-conv-search', label: 'Search Chats', icon: <LuSearch className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-search', matches: ['/dashboard/conversation-search'] },
  { key: 'wachat-conv-kanban', label: 'Kanban Board', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-kanban', matches: ['/dashboard/conversation-kanban'] },
  { key: 'wachat-conv-summary', label: 'Summaries', icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/conversation-summary', matches: ['/dashboard/conversation-summary'] },
  { key: 'wachat-contact-merge', label: 'Merge Contacts', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-merge', matches: ['/dashboard/contact-merge'] },
  { key: 'wachat-contact-timeline', label: 'Timeline', icon: <LuClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/contact-timeline', matches: ['/dashboard/contact-timeline'] },
  { key: 'wachat-chat-transfer', label: 'Transfer Chat', icon: <LuUserCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/chat-transfer', matches: ['/dashboard/chat-transfer'] },
  { key: 'wachat-tpl-library', label: 'Template Library', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/message-templates-library', matches: ['/dashboard/message-templates-library'] },
  { key: 'wachat-tpl-builder', label: 'Template Builder', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/template-builder', matches: ['/dashboard/template-builder'] },
  { key: 'wachat-interactive', label: 'Interactive Msgs', icon: <LuSmartphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/interactive-messages', matches: ['/dashboard/interactive-messages'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Ad Manager nav registry — loaded when context="ad-manager".
 *  Dedicated sidebar for Meta Ads Manager (campaigns, audiences,
 *  pixels, insights, etc.). Separate from Meta Suite.
 * ══════════════════════════════════════════════════════════════════ */

const admPrimary: NavEntry[] = [
  { key: 'adm-overview', label: 'Overview', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager', matches: ['/dashboard/ad-manager'] },
  { key: 'adm-insights', label: 'Performance', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/insights', matches: ['/dashboard/ad-manager/insights'] },
  { key: 'adm-reports', label: 'Reports', icon: <LuFileText className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/reports', matches: ['/dashboard/ad-manager/reports'] },
];

const admAdvertise: NavEntry[] = [
  { key: 'adm-campaigns', label: 'Campaigns', icon: <LuMegaphone className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/campaigns', matches: ['/dashboard/ad-manager/campaigns'] },
  { key: 'adm-adsets', label: 'Ad Sets', icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-sets', matches: ['/dashboard/ad-manager/ad-sets'] },
  { key: 'adm-ads', label: 'Ads', icon: <LuMousePointerClick className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ads', matches: ['/dashboard/ad-manager/ads'] },
  { key: 'adm-bulk', label: 'Bulk Editor', icon: <LuListChecks className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/bulk-editor', matches: ['/dashboard/ad-manager/bulk-editor'] },
  { key: 'adm-split', label: 'A/B Tests', icon: <LuSplit className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/split-tests', matches: ['/dashboard/ad-manager/split-tests'] },
  { key: 'adm-calendar', label: 'Calendar', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/calendar', matches: ['/dashboard/ad-manager/calendar'] },
  { key: 'adm-compare', label: 'Compare', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/compare', matches: ['/dashboard/ad-manager/compare'] },
  { key: 'adm-budget', label: 'Budget Optimizer', icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/budget-optimizer', matches: ['/dashboard/ad-manager/budget-optimizer'] },
  { key: 'adm-previews', label: 'Ad Previews', icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-previews', matches: ['/dashboard/ad-manager/ad-previews'] },
  { key: 'adm-funnel', label: 'Conversion Funnel', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/conversion-funnel', matches: ['/dashboard/ad-manager/conversion-funnel'] },
];

const admCreative: NavEntry[] = [
  { key: 'adm-creative', label: 'Creative Library', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/creative-library', matches: ['/dashboard/ad-manager/creative-library'] },
  { key: 'adm-ai-lab', label: 'AI Creative Lab', icon: <LuFlaskConical className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ai-lab', matches: ['/dashboard/ad-manager/ai-lab'] },
  { key: 'adm-catalogs', label: 'Product Catalogs', icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/catalogs', matches: ['/dashboard/ad-manager/catalogs'] },
  { key: 'adm-rules', label: 'Automated Rules', icon: <LuZap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/automated-rules', matches: ['/dashboard/ad-manager/automated-rules'] },
];

const admAudiences: NavEntry[] = [
  { key: 'adm-audiences', label: 'Audiences', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/audiences', matches: ['/dashboard/ad-manager/audiences'] },
  { key: 'adm-customer-lists', label: 'Customer Lists', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/customer-lists', matches: ['/dashboard/ad-manager/customer-lists'] },
  { key: 'adm-lead-forms', label: 'Lead Forms', icon: <LuInbox className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/lead-forms', matches: ['/dashboard/ad-manager/lead-forms'] },
];

const admMeasurement: NavEntry[] = [
  { key: 'adm-pixels', label: 'Pixels & Datasets', icon: <LuScanLine className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/pixels', matches: ['/dashboard/ad-manager/pixels'] },
  { key: 'adm-events', label: 'Events Manager', icon: <LuRadar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/events-manager', matches: ['/dashboard/ad-manager/events-manager'] },
  { key: 'adm-conversions', label: 'Custom Conversions', icon: <LuTrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/custom-conversions', matches: ['/dashboard/ad-manager/custom-conversions'] },
  { key: 'adm-capi', label: 'Conversions API', icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/capi', matches: ['/dashboard/ad-manager/capi'] },
];

const admSettings: NavEntry[] = [
  { key: 'adm-accounts', label: 'Ad Accounts', icon: <LuServerCog className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/ad-accounts', matches: ['/dashboard/ad-manager/ad-accounts'] },
  { key: 'adm-billing', label: 'Billing', icon: <LuReceipt className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/billing', matches: ['/dashboard/ad-manager/billing'] },
  { key: 'adm-settings', label: 'Settings', icon: <LuWrench className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/ad-manager/settings', matches: ['/dashboard/ad-manager/settings'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Meta Suite nav registry — loaded when context="meta-suite".
 *  Facebook pages, posts, messaging, broadcasts, subscribers,
 *  commerce + Instagram feed, stories, reels, DMs.
 * ══════════════════════════════════════════════════════════════════ */

const metaFbPrimary: NavEntry[] = [
  { key: 'ms-dashboard', label: 'Dashboard', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook', matches: ['/dashboard/facebook'] },
  { key: 'ms-projects', label: 'Pages & Projects', icon: <LuGlobe className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/all-projects', matches: ['/dashboard/facebook/all-projects', '/dashboard/facebook/pages'] },
];

const metaFbContent: NavEntry[] = [
  { key: 'ms-posts', label: 'Posts', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/posts', matches: ['/dashboard/facebook/posts', '/dashboard/facebook/create-post'] },
  { key: 'ms-scheduled', label: 'Scheduled', icon: <LuCalendarClock className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/scheduled', matches: ['/dashboard/facebook/scheduled'] },
  { key: 'ms-calendar', label: 'Calendar', icon: <LuCalendar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/calendar', matches: ['/dashboard/facebook/calendar'] },
  { key: 'ms-bulk-create', label: 'Bulk Create', icon: <LuPlus className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/bulk-create', matches: ['/dashboard/facebook/bulk-create'] },
  { key: 'ms-live', label: 'Live Studio', icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/live-studio', matches: ['/dashboard/facebook/live-studio'] },
  { key: 'ms-randomizer', label: 'Post Randomizer', icon: <LuZap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/post-randomizer', matches: ['/dashboard/facebook/post-randomizer'] },
  { key: 'ms-reels', label: 'Reels', icon: <LuClapperboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/reels', matches: ['/dashboard/facebook/reels'] },
  { key: 'ms-stories', label: 'Stories', icon: <LuCirclePlay className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/stories', matches: ['/dashboard/facebook/stories'] },
];

const metaFbEngage: NavEntry[] = [
  { key: 'ms-messages', label: 'Messages', icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/messages', matches: ['/dashboard/facebook/messages'] },
  { key: 'ms-kanban', label: 'Kanban', icon: <LuColumns3 className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/kanban', matches: ['/dashboard/facebook/kanban'] },
  { key: 'ms-broadcasts', label: 'Broadcasts', icon: <LuSend className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/broadcasts', matches: ['/dashboard/facebook/broadcasts'] },
  { key: 'ms-subscribers', label: 'Subscribers', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/subscribers', matches: ['/dashboard/facebook/subscribers'] },
  { key: 'ms-auto-reply', label: 'Auto Reply', icon: <LuReply className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/auto-reply', matches: ['/dashboard/facebook/auto-reply'] },
  { key: 'ms-messenger-settings', label: 'Messenger Settings', icon: <LuMessageSquareDashed className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/messenger-settings', matches: ['/dashboard/facebook/messenger-settings'] },
];

const metaFbGrowth: NavEntry[] = [
  { key: 'ms-events', label: 'Events', icon: <LuCalendarDays className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/events', matches: ['/dashboard/facebook/events'] },
  { key: 'ms-leads', label: 'Lead Forms', icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/leads', matches: ['/dashboard/facebook/leads'] },
  { key: 'ms-reviews', label: 'Reviews', icon: <LuStar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/reviews', matches: ['/dashboard/facebook/reviews'] },
  { key: 'ms-insights', label: 'Insights', icon: <LuChartBar className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/insights', matches: ['/dashboard/facebook/insights'] },
  { key: 'ms-media', label: 'Media Library', icon: <LuImagePlay className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/media', matches: ['/dashboard/facebook/media'] },
  { key: 'ms-moderation', label: 'Moderation', icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/moderation', matches: ['/dashboard/facebook/moderation'] },
  { key: 'ms-audience', label: 'Audience', icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/audience', matches: ['/dashboard/facebook/audience'] },
  { key: 'ms-competitors', label: 'Competitors', icon: <LuTarget className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/competitors', matches: ['/dashboard/facebook/competitors'] },
  { key: 'ms-visitor-posts', label: 'Visitor Posts', icon: <LuUserCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/visitor-posts', matches: ['/dashboard/facebook/visitor-posts'] },
];

const metaFbCommerce: NavEntry[] = [
  { key: 'ms-shops', label: 'Shops', icon: <LuStore className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/custom-ecommerce', matches: ['/dashboard/facebook/custom-ecommerce'] },
  { key: 'ms-products', label: 'Products', icon: <LuPackage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/commerce/products', matches: ['/dashboard/facebook/commerce'] },
  { key: 'ms-orders', label: 'Orders', icon: <LuShoppingCart className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/commerce/orders', matches: ['/dashboard/facebook/commerce/orders'] },
];

const metaFbAdvanced: NavEntry[] = [
  { key: 'ms-flows', label: 'Flow Builder', icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/flow-builder', matches: ['/dashboard/facebook/flow-builder'] },
  { key: 'ms-agents', label: 'AI Agents', icon: <LuBot className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/agents', matches: ['/dashboard/facebook/agents'] },
  { key: 'ms-knowledge', label: 'Knowledge Base', icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/knowledge', matches: ['/dashboard/facebook/knowledge'] },
  { key: 'ms-webhooks', label: 'Webhooks', icon: <LuWebhook className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/webhooks', matches: ['/dashboard/facebook/webhooks'] },
  { key: 'ms-page-roles', label: 'Page Roles', icon: <LuShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/page-roles', matches: ['/dashboard/facebook/page-roles'] },
  { key: 'ms-fb-settings', label: 'Settings', icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/facebook/settings', matches: ['/dashboard/facebook/settings'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  Instagram nav registry — loaded when context="instagram".
 *  Dedicated module for Instagram Graph API: feed, stories, reels,
 *  DMs, discovery, hashtag search, and account connections.
 * ══════════════════════════════════════════════════════════════════ */

const igPrimary: NavEntry[] = [
  { key: 'ig-dashboard', label: 'Dashboard', icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram', matches: ['/dashboard/instagram'] },
  { key: 'ig-connections', label: 'Connections', icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/connections', matches: ['/dashboard/instagram/connections', '/dashboard/instagram/setup'] },
];

const igContent: NavEntry[] = [
  { key: 'ig-feed', label: 'Feed', icon: <LuImage className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/feed', matches: ['/dashboard/instagram/feed'] },
  { key: 'ig-stories', label: 'Stories', icon: <LuEye className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/stories', matches: ['/dashboard/instagram/stories'] },
  { key: 'ig-reels', label: 'Reels', icon: <LuRadio className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/reels', matches: ['/dashboard/instagram/reels'] },
  { key: 'ig-create', label: 'Create Post', icon: <LuSquarePen className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/create-post', matches: ['/dashboard/instagram/create-post'] },
];

const igEngage: NavEntry[] = [
  { key: 'ig-messages', label: 'Messages', icon: <LuMessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/messages', matches: ['/dashboard/instagram/messages'] },
];

const igGrowth: NavEntry[] = [
  { key: 'ig-discovery', label: 'Discovery', icon: <LuMap className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/discovery', matches: ['/dashboard/instagram/discovery'] },
  { key: 'ig-hashtags', label: 'Hashtag Search', icon: <LuHash className="h-[15px] w-[15px]" strokeWidth={1.75} />, href: '/dashboard/instagram/hashtag-search', matches: ['/dashboard/instagram/hashtag-search'] },
];

/* ═══════════════════════════════════════════════════════════════════
 *  SabFlow nav registry — loaded when context="sabflow".
 *  Mirrors the /dashboard/sabflow/* directory structure.
 * ══════════════════════════════════════════════════════════════════ */

const sabflowPrimary: NavEntry[] = [
  {
    key: 'sf-flow-builder',
    label: 'Flow Builder',
    icon: <LuWorkflow className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/flow-builder',
    matches: ['/dashboard/sabflow/flow-builder'],
  },
  {
    key: 'sf-connections',
    label: 'Connections',
    icon: <LuPuzzle className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/connections',
    matches: ['/dashboard/sabflow/connections'],
  },
  {
    key: 'sf-logs',
    label: 'Execution Logs',
    icon: <LuActivity className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/logs',
    matches: ['/dashboard/sabflow/logs'],
  },
];

const sabflowManage: NavEntry[] = [
  {
    key: 'sf-settings',
    label: 'Settings',
    icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/settings',
    matches: ['/dashboard/sabflow/settings'],
  },
  {
    key: 'sf-docs',
    label: 'Docs',
    icon: <LuBookCopy className="h-[15px] w-[15px]" strokeWidth={1.75} />,
    href: '/dashboard/sabflow/docs',
    matches: ['/dashboard/sabflow/docs'],
  },
];

/**
 * Routes that should render without the Clay wachat container (no
 * padding, no max-width cap, no `overflow-y-auto` on main). Pages
 * like Live Chat and the flow-builder canvas manage their own
 * scrolling and need the full panel height to work properly.
 *
 * IMPORTANT: `/dashboard/flow-builder` (the LIST) and
 * `/dashboard/flow-builder/docs` stay padded — only the canvas
 * routes `/dashboard/flow-builder/<flowId>` are full-bleed.
 * SabFlow canvas `/dashboard/sabflow/flow-builder/<flowId>` is
 * likewise full-bleed, but the SabFlow list stays padded.
 */
const FULL_BLEED_PREFIXES = [
  '/dashboard/chat',
];

function isFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;

  // SabFlow canvas — only sub-routes of flow-builder, not list / new
  const sfb = pathname.match(/^\/dashboard\/sabflow\/flow-builder\/([^/]+)/);
  if (sfb && sfb[1] !== 'new') return true;

  // Flow-builder canvas — only sub-routes, and never /docs
  const fb = pathname.match(/^\/dashboard\/flow-builder\/([^/]+)/);
  if (fb && fb[1] !== 'docs') return true;

  return FULL_BLEED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function useActiveKey(context: ClayLayoutContext = 'sabnode'): string {
  const pathname = usePathname() || '';
  const registry =
    context === 'ad-manager'
      ? [admPrimary, admAdvertise, admCreative, admAudiences, admMeasurement, admSettings]
      : context === 'instagram'
        ? [igPrimary, igContent, igEngage, igGrowth]
        : context === 'meta-suite'
          ? [metaFbPrimary, metaFbContent, metaFbEngage, metaFbGrowth, metaFbCommerce, metaFbAdvanced]
          : context === 'wachat'
            ? [wachatPrimary, wachatAutomate, wachatGrow, wachatConfigure]
            : context === 'sabflow'
              ? [sabflowPrimary, sabflowManage]
              : [primaryNav, appsNav];
  let bestKey =
    context === 'ad-manager' ? 'adm-overview' :
    context === 'instagram' ? 'ig-dashboard' :
    context === 'meta-suite' ? 'ms-dashboard' :
    context === 'wachat' ? 'wachat-chat' :
    context === 'sabflow' ? 'sf-flow-builder' : 'home';
  let bestLen = 0;
  for (const group of registry) {
    for (const item of group) {
      for (const m of item.matches) {
        if (pathname.startsWith(m) && m.length > bestLen) {
          bestLen = m.length;
          bestKey = item.key;
        }
      }
    }
  }
  return bestKey;
}

/* ── layout ─────────────────────────────────────────────────────── */

export function ClayDashboardLayout({
  user,
  plan,
  context = 'sabnode',
  children,
}: ClayDashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = useActiveKey(context);
  const fullBleed = isFullBleed(pathname);

  /* ── Command palette state (Cmd+K / Ctrl+K) ── */
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /** Jump helper — closes search and navigates */
  const jump = React.useCallback(
    (href: string) => {
      setSearchOpen(false);
      router.push(href);
    },
    [router],
  );

  /** Refresh — refetches the current route's server data */
  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const toNavItem = React.useCallback(
    (entry: NavEntry): ClayNavItem => ({
      key: entry.key,
      label: entry.label,
      icon: entry.icon,
      href: entry.href,
      active: entry.key === activeKey,
    }),
    [activeKey],
  );

  const currentDate = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  return (
    <ClayShell className="flex flex-col">
      {/* ── TOPBAR ── */}
      <ClayTopbar
        left={
          <>
            <BrandGlyph />
            <div className="ml-3 flex items-center gap-2">
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => setSearchOpen(true)}
              >
                Search
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => router.push('/dashboard/wachat/contacts')}
              >
                Add contact
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuBell className="h-3.5 w-3.5" strokeWidth={2} />}
                onClick={() => router.push('/dashboard/notifications')}
              >
                Notifications
              </ClayButton>

              {/* More (…) dropdown — workspace shortcuts */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ClayButton variant="pill" size="icon" aria-label="More">
                    <LuEllipsis className="h-4 w-4" />
                  </ClayButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
                    <LuSettings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/team')}>
                    <LuUserPlus className="mr-2 h-4 w-4" /> Team
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/integrations')}>
                    <LuPlus className="mr-2 h-4 w-4" /> Integrations
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                    <LuUser className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => window.open('https://docs.sabnode.com', '_blank')}
                  >
                    <LuCircleHelp className="mr-2 h-4 w-4" /> Help & docs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSearchOpen(true)}>
                    <LuKeyboard className="mr-2 h-4 w-4" /> Keyboard shortcuts
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => (window.location.href = '/logout')}
                    className="text-clay-red focus:text-clay-red"
                  >
                    <LuLogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
        right={
          <>
            {/* Language dropdown (placeholder — real i18n not wired) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton
                  variant="pill"
                  size="sm"
                  trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
                >
                  En
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <LuLanguages className="mr-1 inline h-3.5 w-3.5" /> Language
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  English (default)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  हिन्दी · Hindi
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  Español · Spanish
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  Français · French
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date pill — click to refresh server data */}
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuCalendar className="h-3.5 w-3.5" strokeWidth={2} />}
              trailing={<LuRefreshCw className="h-3 w-3 opacity-60" />}
              onClick={refresh}
              aria-label="Refresh data"
            >
              {currentDate}
            </ClayButton>

            {/* Create dropdown — one-click entry into every creator */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton
                  variant="obsidian"
                  size="md"
                  className="px-5"
                  trailing={<LuChevronDown className="h-3.5 w-3.5 opacity-70" />}
                >
                  Create
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Create new</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/broadcasts')}>
                  <LuSend className="mr-2 h-4 w-4" /> WhatsApp broadcast
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sabflow')}>
                  <LuWorkflow className="mr-2 h-4 w-4" /> SabFlow automation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/crm/sales-crm/leads')}
                >
                  <LuBriefcase className="mr-2 h-4 w-4" /> CRM lead
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/templates')}>
                  <LuMessagesSquare className="mr-2 h-4 w-4" /> Message template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/email')}>
                  <LuMail className="mr-2 h-4 w-4" /> Email campaign
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sms')}>
                  <LuSmartphone className="mr-2 h-4 w-4" /> SMS campaign
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/sabchat')}>
                  <LuBot className="mr-2 h-4 w-4" /> SabChat bot
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/seo')}>
                  <LuGlobe className="mr-2 h-4 w-4" /> SEO project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Command palette — jump to any module from anywhere */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Jump to…  broadcasts, CRM, flows, SMS, SEO" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Primary">
            <CommandItem onSelect={() => jump('/home')}>
              <LuLayoutDashboard className="mr-2 h-4 w-4" /> Home
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard')}>
              <LuMessagesSquare className="mr-2 h-4 w-4" /> Wachat
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/broadcasts')}>
              <LuSend className="mr-2 h-4 w-4" /> Broadcasts
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/sabflow')}>
              <LuWorkflow className="mr-2 h-4 w-4" /> SabFlow
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/crm/sales-crm/leads')}>
              <LuBriefcase className="mr-2 h-4 w-4" /> CRM
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Apps">
            <CommandItem onSelect={() => jump('/dashboard/sabchat')}>
              <LuBot className="mr-2 h-4 w-4" /> SabChat
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/seo')}>
              <LuGlobe className="mr-2 h-4 w-4" /> SEO Suite
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/email')}>
              <LuMail className="mr-2 h-4 w-4" /> Email
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/sms')}>
              <LuSmartphone className="mr-2 h-4 w-4" /> SMS
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/ad-manager/ad-accounts')}>
              <LuSend className="mr-2 h-4 w-4" /> Ad Manager
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem onSelect={() => jump('/dashboard/notifications')}>
              <LuBell className="mr-2 h-4 w-4" /> Notifications
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/billing')}>
              <LuBriefcase className="mr-2 h-4 w-4" /> Billing &amp; credits
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/profile')}>
              <LuUser className="mr-2 h-4 w-4" /> Profile
            </CommandItem>
            <CommandItem onSelect={() => jump('/dashboard/settings')}>
              <LuSettings className="mr-2 h-4 w-4" /> Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* ── BODY ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ClaySidebar
          groupTitle={
            context === 'ad-manager' ? 'Ad Manager' :
            context === 'instagram' ? 'Instagram' :
            context === 'meta-suite' ? 'Meta Suite' :
            context === 'wachat' ? 'Wachat' :
            context === 'sabflow' ? 'SabFlow' : 'SabNode'
          }
          brand={
            context === 'ad-manager' ? <ClayAdManagerBrand /> :
            context === 'instagram' ? <ClayInstagramBrand /> :
            context === 'meta-suite' ? <ClayMetaBrand /> :
            context === 'wachat' ? <ClayWachatBrand /> :
            context === 'sabflow' ? <ClaySabFlowBrand /> :
            undefined
          }
          groups={
            context === 'ad-manager'
              ? [
                  { items: admPrimary.map(toNavItem) },
                  { title: 'Advertise', addable: false, items: admAdvertise.map(toNavItem) },
                  { title: 'Creative & Planning', addable: false, items: admCreative.map(toNavItem) },
                  { title: 'Audiences', addable: false, items: admAudiences.map(toNavItem) },
                  { title: 'Measurement', addable: false, items: admMeasurement.map(toNavItem) },
                  { title: 'Settings', addable: false, items: admSettings.map(toNavItem) },
                ]
              : context === 'instagram'
                ? [
                    { items: igPrimary.map(toNavItem) },
                    { title: 'Content', addable: false, items: igContent.map(toNavItem) },
                    { title: 'Engagement', addable: false, items: igEngage.map(toNavItem) },
                    { title: 'Growth', addable: false, items: igGrowth.map(toNavItem) },
                  ]
                : context === 'meta-suite'
                  ? [
                      { items: metaFbPrimary.map(toNavItem) },
                      { title: 'Content', addable: false, items: metaFbContent.map(toNavItem) },
                      { title: 'Engagement', addable: false, items: metaFbEngage.map(toNavItem) },
                      { title: 'Growth', addable: false, items: metaFbGrowth.map(toNavItem) },
                      { title: 'Commerce', addable: false, items: metaFbCommerce.map(toNavItem) },
                      { title: 'Advanced', addable: false, items: metaFbAdvanced.map(toNavItem) },
                    ]
                  : context === 'wachat'
                ? [
                    { items: wachatPrimary.map(toNavItem) },
                    {
                      title: 'Automate',
                      addable: false,
                      items: wachatAutomate.map(toNavItem),
                    },
                    {
                      title: 'Grow',
                      addable: false,
                      items: wachatGrow.map(toNavItem),
                    },
                    {
                      title: 'Configure',
                      addable: true,
                      onAdd: () => router.push('/dashboard/integrations'),
                      items: wachatConfigure.map(toNavItem),
                    },
                  ]
                : context === 'sabflow'
                ? [
                    { items: sabflowPrimary.map(toNavItem) },
                    {
                      title: 'Manage',
                      addable: false,
                      items: sabflowManage.map(toNavItem),
                    },
                  ]
                : [
                    { items: primaryNav.map(toNavItem) },
                    {
                      title: 'Apps',
                      addable: true,
                      onAdd: () => router.push('/dashboard/integrations'),
                      items: appsNav.map(toNavItem),
                    },
                  ]
          }
          footer={
            <>
              <ClayUserCard
                name={user?.name || 'SabNode user'}
                email={user?.email || undefined}
                avatarSrc={user?.avatar || undefined}
                onMenuClick={() => router.push('/dashboard/profile')}
              />
            </>
          }
        />

        <main
          className={cn(
            'min-w-0 flex-1',
            // Default: page handles its own scroll, container provides gutters
            !fullBleed && 'overflow-y-auto',
            // Full-bleed: page fills the panel edge-to-edge, manages own scroll
            fullBleed && 'flex h-full min-h-0 overflow-hidden',
            // Wachat & Meta Suite pages get generous consistent padding.
            // Page content uses the FULL available width (no max-width cap)
            // so tables and cards don't look shrink-wrapped on wide screens.
            (context === 'wachat' || context === 'meta-suite' || context === 'instagram' || context === 'ad-manager' || context === 'sabflow') && !fullBleed && 'px-10 pt-8 pb-12',
          )}
        >
          {fullBleed ? (
            // Full-bleed: children get 100% width AND 100% height
            <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
              {children}
            </div>
          ) : (context === 'wachat' || context === 'meta-suite' || context === 'instagram' || context === 'ad-manager' || context === 'sabflow') ? (
            // Wachat pages: full width AND full height — pages can fill
            // the entire available space. Each page's root <div> owns
            // its own clay-enter animation cascade so staggered child
            // reveals keep working.
            <div className="flex h-full w-full flex-col">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </ClayShell>
  );
}

/* ── brand glyph ────────────────────────────────────────────────── */

function BrandGlyph() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-clay-border bg-clay-surface shadow-clay-xs">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-clay-ink"
        aria-hidden
      >
        <path d="M3 3v10h3" />
        <path d="M3 3h10v4a2 2 0 0 1-2 2H8" />
        <path d="M13 13H8a2 2 0 0 1-2-2V9" />
      </svg>
    </div>
  );
}

/* ── Wachat sidebar brand — back-link + project switcher dropdown ── */

function WabaHealthDot({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const isGreen = s === 'available' || s === 'connected';
  const isAmber = s === 'limited' || s === 'flagged';
  const color = isGreen ? 'bg-emerald-500' : isAmber ? 'bg-amber-500' : 'bg-red-500';
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider leading-none',
      isGreen && 'bg-emerald-500/10 text-emerald-600',
      isAmber && 'bg-amber-500/10 text-amber-600',
      !isGreen && !isAmber && 'bg-red-500/10 text-red-600',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {label}
    </span>
  );
}

function ClayWachatBrand() {
  const router = useRouter();
  const { projects, activeProject, setActiveProjectId } = useProject();
  const [healthStatus, setHealthStatus] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!activeProject?._id) { setHealthStatus(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getWabaHealthStatus } = await import('@/app/actions/whatsapp.actions');
        const { healthStatus: hs } = await getWabaHealthStatus(activeProject._id.toString());
        if (!cancelled && hs?.can_send_message) {
          setHealthStatus(hs.can_send_message);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeProject?._id]);

  const onSelect = React.useCallback(
    (id: string) => {
      setActiveProjectId(id);
      setHealthStatus(undefined); // reset on switch
      try {
        localStorage.setItem('activeProjectId', id);
      } catch {
        /* ignore quota errors */
      }
    },
    [setActiveProjectId],
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Back to Apps */}
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>

      {/* Project switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[12px] border border-clay-border bg-clay-surface px-2.5 py-2 text-left hover:border-clay-border-strong hover:bg-clay-surface-2 transition-colors"
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-[8px] text-[10.5px] font-semibold uppercase',
                activeProject
                  ? 'bg-clay-rose-soft text-clay-rose-ink'
                  : 'bg-clay-bg-2 text-clay-ink-muted',
              )}
            >
              {(activeProject?.name || '—').slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-clay-ink-fade font-medium">
                Project
                <WabaHealthDot status={healthStatus} />
              </span>
              <span className="block truncate text-[12.5px] font-semibold text-clay-ink leading-tight">
                {activeProject?.name || 'Select a project'}
              </span>
            </span>
            <LuChevronDown
              className="h-3.5 w-3.5 shrink-0 text-clay-ink-fade"
              strokeWidth={2}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[216px]"
          sideOffset={6}
        >
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
          ) : (
            projects.slice(0, 10).map((p) => {
              const id = p._id.toString();
              const isActive = activeProject?._id?.toString() === id;
              return (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => onSelect(id)}
                  className={cn(isActive && 'bg-clay-rose-soft/50')}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-clay-rose-soft text-[9px] font-semibold uppercase text-clay-rose-ink mr-2">
                    {(p.name || '?').slice(0, 2)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
            <LuPlus className="mr-2 h-4 w-4" />
            Browse all projects
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ── Ad Manager sidebar brand ──────────────────────────────────── */

function ClayAdManagerBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #C7D2FE 0%, #4F46E5 100%)' }}
        >
          <LuMegaphone className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Ad Manager</p>
          <p className="text-[11px] text-clay-ink-muted">Facebook & Instagram Ads</p>
        </div>
      </div>
    </div>
  );
}

/* ── Instagram sidebar brand ──────────────────────────────────── */

function ClayInstagramBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)' }}
        >
          <LuImage className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Instagram</p>
          <p className="text-[11px] text-clay-ink-muted">Feed, Stories & Reels</p>
        </div>
      </div>
    </div>
  );
}

/* ── SabFlow sidebar brand ────────────────────────────────────── */

function ClaySabFlowBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)' }}
        >
          <LuWorkflow className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">SabFlow</p>
          <p className="text-[11px] text-clay-ink-muted">Visual automation engine</p>
        </div>
      </div>
    </div>
  );
}

/* ── Meta Suite sidebar brand ─────────────────────────────────── */

function ClayMetaBrand() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-clay-border bg-clay-surface px-2.5 py-1.5 text-[11.5px] font-medium text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong transition-colors"
      >
        <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
        Back to Apps
      </button>
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #1877F2 100%)' }}
        >
          <LuGlobe className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-clay-ink">Meta Suite</p>
          <p className="text-[11px] text-clay-ink-muted">Facebook & Instagram</p>
        </div>
      </div>
    </div>
  );
}
