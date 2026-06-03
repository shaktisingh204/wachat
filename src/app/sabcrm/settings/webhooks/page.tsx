'use client';

/**
 * SabCRM — Webhooks Settings page (`/sabcrm/settings/webhooks`).
 *
 * Mirrors Twenty CRM's "Settings → Developers → Webhooks" surface, self-written
 * on the SabNode stack. This client shell:
 *   1. Resolves the active project scope via `useProject()` (the same context the
 *      rest of SabCRM uses for tenant scoping).
 *   2. Renders the read-only page chrome (breadcrumb eyebrow, title, description)
 *      with ZoruUI page-heading primitives.
 *   3. Mounts `<WebhookManager>`, a fully self-contained subscription manager
 *      that handles list / create / edit / rotate-secret / delete through the
 *      gated `*WebhookAction` server actions. Each action independently re-runs
 *      the session → project → RBAC (`sabcrm:admin`) → plan pipeline, so the page
 *      fails closed even when the layout guard passes.
 *
 * Auth / onboarding / project-context guards are enforced by the parent layout
 * (`../../layout.tsx`); the manager's mutations re-gate server-side.
 *
 * Until the active project is resolved we show a skeleton, and if no project is
 * selected we surface an inline notice rather than mounting the manager with an
 * undefined scope.
 */

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import {
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Separator,
  Skeleton,
} from '@/components/zoruui';
import { useProject } from '@/context/project-context';
import { WebhookManager } from '@/components/sabcrm/webhook-manager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_BASE_PATH = '/sabcrm';
const SETTINGS_PATH = `${CRM_BASE_PATH}/settings`;

// ---------------------------------------------------------------------------
// Loading skeleton (shown while the active project resolves)
// ---------------------------------------------------------------------------

function WebhooksSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmWebhooksSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

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
            Webhooks
          </ZoruPageEyebrow>
          <ZoruPageTitle>Webhooks</ZoruPageTitle>
          <ZoruPageDescription>
            Send a POST request to a destination URL whenever a record is created,
            updated, or deleted. Manage outbound webhook subscriptions, filter the
            events they receive, and rotate their signing secrets.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Separator className="my-6" />

      {/* Body — gated on the active project resolving */}
      {isLoadingProject && !activeProjectId ? (
        <WebhooksSkeleton />
      ) : !activeProjectId ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project to manage its webhook subscriptions.
          </ZoruAlertDescription>
        </Alert>
      ) : (
        <WebhookManager projectId={activeProjectId} />
      )}
    </main>
  );
}
