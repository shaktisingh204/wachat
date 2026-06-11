import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';

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
import { EmailSettingsForm } from './_components/email-settings-form';

export const dynamic = 'force-dynamic';

const PROVIDER_LABELS: Record<string, string> = {
  smtp: 'SMTP',
  google: 'Google (Gmail)',
  outlook: 'Outlook',
};

export default async function SabbiginEmailSettingsPage() {
  const status = await getSabbiginEmailStatus();
  const providerLabel = status.provider
    ? PROVIDER_LABELS[status.provider] ?? status.provider
    : null;

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
          <PageTitle>Email</PageTitle>
          <PageDescription>
            Set how SabBigin sends mail on your behalf and manage your sender
            identity.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Connection status */}
      <Card padding="none">
        <CardBody className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)]',
                status.connected
                  ? 'bg-[var(--st-success)]/15 text-[var(--st-success)]'
                  : 'bg-[var(--st-bg-muted)] text-[var(--st-text-tertiary)]',
              ].join(' ')}
              aria-hidden="true"
            >
              {status.connected ? (
                <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2} />
              ) : (
                <Mail className="h-4.5 w-4.5" strokeWidth={2} />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--st-text)]">
                {status.connected ? 'Email connected' : 'No email connection'}
              </p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                {status.connected
                  ? `Sending via ${providerLabel}${status.fromEmail ? ` · ${status.fromEmail}` : ''}.`
                  : 'Connect a provider to send and log email from SabBigin.'}
              </p>
            </div>
          </div>
          {status.connected ? (
            <Badge tone="success" kind="soft">Active</Badge>
          ) : (
            <Link
              href="/dashboard/sabbigin/settings/integrations"
              className="u-btn u-btn--outline u-btn--sm"
            >
              <span className="u-btn__label">Connect provider</span>
            </Link>
          )}
        </CardBody>
      </Card>

      {/* Presentation form */}
      <EmailSettingsForm
        fromName={status.fromName}
        signature={status.signature}
      />
    </div>
  );
}
