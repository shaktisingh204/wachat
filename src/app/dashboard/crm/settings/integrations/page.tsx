import {
  Plug,
  Slack,
  Zap,
  FileSpreadsheet,
  Mail,
  CalendarDays,
  BellRing,
  BellPlus,
  HardDrive,
  KeyRound,
  MessageSquare,
  Ticket,
} from 'lucide-react';

import { CrmModuleOverview } from '../../_components/crm-module-overview';

export const dynamic = 'force-dynamic';

export default function IntegrationsLandingPage() {
  return (
    <CrmModuleOverview
      title="Integrations"
      subtitle="Connect 3rd-party services — messaging, calendars, storage, accounting, and notifications."
      icon={Plug}
      sections={[
        {
          href: '/dashboard/crm/settings/integrations/slack',
          label: 'Slack',
          description: 'Post notifications to a Slack channel via webhook.',
          icon: Slack,
        },
        {
          href: '/dashboard/crm/settings/integrations/pusher',
          label: 'Pusher',
          description: 'Realtime app credentials for live updates.',
          icon: Zap,
        },
        {
          href: '/dashboard/crm/settings/integrations/quickbooks',
          label: 'QuickBooks',
          description: 'Sync invoices and payments with QuickBooks Online.',
          icon: FileSpreadsheet,
        },
        {
          href: '/dashboard/crm/settings/integrations/smtp',
          label: 'SMTP',
          description: 'Outbound email server configuration.',
          icon: Mail,
        },
        {
          href: '/dashboard/crm/settings/integrations/google-calendar',
          label: 'Google Calendar',
          description: 'Two-way sync events with Google Calendar.',
          icon: CalendarDays,
        },
        {
          href: '/dashboard/crm/settings/integrations/email-notifications',
          label: 'Email Notifications',
          description: 'Per-event email delivery toggles.',
          icon: BellRing,
        },
        {
          href: '/dashboard/crm/settings/integrations/push-notifications',
          label: 'Push Notifications',
          description: 'Firebase Cloud Messaging for web/mobile push.',
          icon: BellPlus,
        },
        {
          href: '/dashboard/crm/settings/integrations/storage',
          label: 'Storage',
          description: 'Choose where uploaded files are stored.',
          icon: HardDrive,
        },
        {
          href: '/dashboard/crm/settings/integrations/social-auth',
          label: 'Social Auth',
          description: 'OAuth credentials for social sign-in providers.',
          icon: KeyRound,
        },
        {
          href: '/dashboard/crm/settings/integrations/message-settings',
          label: 'Message Settings',
          description: 'Internal messaging limits and attachments.',
          icon: MessageSquare,
        },
        {
          href: '/dashboard/crm/settings/integrations/ticket-email',
          label: 'Ticket Email',
          description: 'IMAP inbox that converts emails into tickets.',
          icon: Ticket,
        },
      ]}
    />
  );
}
