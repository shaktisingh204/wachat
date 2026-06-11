import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowUpRight,
  Mail,
  MessageCircle,
  Sheet,
  Workflow,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { getSabbiginEmailStatus } from '@/app/actions/sabbigin-email-settings.actions';

export const dynamic = 'force-dynamic';

interface Integration {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
  status: { label: string; tone: 'success' | 'neutral' | 'info' };
}

export default async function SabbiginIntegrationsSettingsPage() {
  const email = await getSabbiginEmailStatus();

  const integrations: Integration[] = [
    {
      key: 'whatsapp',
      title: 'WhatsApp (WaChat)',
      description:
        'Message contacts on WhatsApp and log conversations against their CRM record.',
      icon: MessageCircle,
      href: '/dashboard/wachat',
      linkLabel: 'Open WaChat',
      status: { label: 'Available', tone: 'info' },
    },
    {
      key: 'automations',
      title: 'Automations (SabFlow)',
      description:
        'Trigger workflows when deals move stage, contacts are created, or forms are submitted.',
      icon: Workflow,
      href: '/dashboard/sabflow',
      linkLabel: 'Open SabFlow',
      status: { label: 'Available', tone: 'info' },
    },
    {
      key: 'sheets',
      title: 'Export to SabSheet',
      description:
        'Push deals and contacts into a spreadsheet for ad-hoc reporting and sharing.',
      icon: Sheet,
      href: '/dashboard/sabsheet',
      linkLabel: 'Open SabSheet',
      status: { label: 'Available', tone: 'info' },
    },
    {
      key: 'email',
      title: 'Email',
      description:
        'Send and log email from inside SabBigin using your connected mail provider.',
      icon: Mail,
      href: '/dashboard/sabbigin/settings/email',
      linkLabel: 'Email settings',
      status: email.connected
        ? { label: 'Connected', tone: 'success' }
        : { label: 'Not connected', tone: 'neutral' },
    },
  ];

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Settings
            </Link>
          </PageEyebrow>
          <PageTitle>Integrations</PageTitle>
          <PageDescription>
            Connect SabBigin to the rest of SabNode — messaging, automations,
            spreadsheets, and email.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {integrations.map((it) => {
          const Icon = it.icon;
          return (
            <Card key={it.key} padding="none">
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/12 text-[var(--st-accent)]"
                    aria-hidden="true"
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <Badge tone={it.status.tone} kind="soft">
                    {it.status.label}
                  </Badge>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--st-text)]">
                    {it.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                    {it.description}
                  </p>
                </div>
                <Link
                  href={it.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                >
                  {it.linkLabel}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
