/**
 * SabCRM — API Settings page (`/sabcrm/settings/api`).
 *
 * Admin-gated server component shell that:
 *   1. Fetches the active project's API keys and webhook subscriptions via the
 *      gated server actions (`listApiKeysAction`, `listWebhooksAction`). Both
 *      actions run the full session → project → RBAC → plan pipeline, so the
 *      page fails closed (error state) even when the layout guard passes.
 *   2. Renders the read-only page chrome (heading, breadcrumb, admin notice)
 *      server-side for fast TTFB.
 *   3. Hands all interactivity to the `ApiSettingsClient` child, seeded with
 *      the pre-fetched data so it renders without a client-side loading state
 *      on first paint.
 *
 * Auth / onboarding / project context guards are enforced by
 * `../../layout.tsx`. Mutations (issue / revoke keys; create / update / delete
 * / rotate webhooks) run through the same gated actions and are handled
 * client-side with optimistic UI updates.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, Webhook, AlertTriangle } from 'lucide-react';

import {
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Badge,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Separator,
} from '@/components/zoruui';
import {
  listApiKeysAction,
  listWebhooksAction,
} from '@/app/actions/sabcrm.actions';
import type { SabcrmApiKey } from '@/lib/sabcrm/apikeys.server';
import type { WebhookSubscription } from '@/lib/sabcrm/webhooks.server';

import { ApiSettingsClient } from './api-settings-client';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'API & Webhooks · SabCRM',
  description:
    'Manage SabCRM API keys and outbound webhook subscriptions for programmatic integration.',
};

// Per-request, tenant-scoped data — never cached.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_BASE_PATH = '/sabcrm';
const SETTINGS_PATH = `${CRM_BASE_PATH}/settings`;

// ---------------------------------------------------------------------------
// Admin capability notice (server-rendered, static)
// ---------------------------------------------------------------------------

function AdminGuardNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-zoru-ink-muted" aria-hidden />
      <p className="text-sm leading-relaxed text-zoru-ink-muted">
        API keys and webhooks grant programmatic access to this project. Issuing
        and revoking keys, and managing webhook subscriptions, requires the{' '}
        <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-xs">
          sabcrm:admin
        </code>{' '}
        RBAC capability.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner (server-rendered)
// ---------------------------------------------------------------------------

interface FetchErrorBannerProps {
  section: string;
  message: string;
}

function FetchErrorBanner({ section, message }: FetchErrorBannerProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <ZoruAlertTitle>Unable to load {section}</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Stat chip (server-rendered, shows counts in the page heading area)
// ---------------------------------------------------------------------------

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
}

function StatChip({ icon, label }: StatChipProps) {
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1.5 text-xs font-normal">
      {icon}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SabcrmApiSettingsPage(): Promise<React.JSX.Element> {
  // Fetch in parallel — both actions are independent reads.
  const [keysRes, webhooksRes] = await Promise.all([
    listApiKeysAction(undefined),
    listWebhooksAction(undefined),
  ]);

  const keys: SabcrmApiKey[] = keysRes.ok ? keysRes.data : [];
  const webhooks: WebhookSubscription[] = webhooksRes.ok ? webhooksRes.data : [];

  const activeKeyCount = keys.filter((k) => !k.revoked).length;
  const activeWebhookCount = webhooks.filter((w) => w.active).length;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
      {/* Page heading */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            <Link
              href={CRM_BASE_PATH}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              SabCRM
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            <Link
              href={SETTINGS_PATH}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              Settings
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            API &amp; Webhooks
          </ZoruPageEyebrow>
          <ZoruPageTitle className="flex flex-wrap items-center gap-3">
            API &amp; Webhooks
            {keysRes.ok && (
              <StatChip
                icon={<KeyRound className="h-3 w-3" aria-hidden />}
                label={`${activeKeyCount} active ${activeKeyCount === 1 ? 'key' : 'keys'}`}
              />
            )}
            {webhooksRes.ok && (
              <StatChip
                icon={<Webhook className="h-3 w-3" aria-hidden />}
                label={`${activeWebhookCount} active ${activeWebhookCount === 1 ? 'webhook' : 'webhooks'}`}
              />
            )}
          </ZoruPageTitle>
          <ZoruPageDescription>
            Issue and revoke bearer tokens for the SabCRM REST API, manage outbound
            webhook subscriptions, and view integration reference documentation.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {/* Admin guard notice */}
      <AdminGuardNotice />

      <Separator className="my-6" />

      {/* Fetch error banners (hard failures only — partial data is still shown) */}
      {(!keysRes.ok || !webhooksRes.ok) && (
        <div className="mb-6 flex flex-col gap-3">
          {!keysRes.ok && (
            <FetchErrorBanner section="API keys" message={keysRes.error} />
          )}
          {!webhooksRes.ok && (
            <FetchErrorBanner section="webhooks" message={webhooksRes.error} />
          )}
        </div>
      )}

      {/* Interactive client — seeded with pre-fetched data */}
      <ApiSettingsClient initialKeys={keys} initialWebhooks={webhooks} />
    </main>
  );
}
