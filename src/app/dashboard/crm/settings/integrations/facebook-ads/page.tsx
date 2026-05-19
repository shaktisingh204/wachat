'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Target,
  Workflow,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruSkeleton,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ModuleConnectionWizard,
  type ModuleWizardStep,
} from '@/components/crm/module-connection-wizard';
import { getAdAccounts } from '@/app/actions/ad-manager.actions';

type FbAdsDraft = {
  adAccountId: string;
  adAccountName: string;
  leadFormIds: string;
  defaultPipeline: string;
  defaultStage: string;
};

const DEFAULT_DRAFT: FbAdsDraft = {
  adAccountId: '',
  adAccountName: '',
  leadFormIds: '',
  defaultPipeline: '',
  defaultStage: '',
};

function AdAccountPicker({
  draft,
  setDraft,
}: {
  draft: FbAdsDraft;
  setDraft: (next: Partial<FbAdsDraft>) => void;
}) {
  const [accounts, setAccounts] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getAdAccounts();
      if (cancelled) return;
      if (res.error) setError(res.error);
      setAccounts(res.accounts ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!accounts) {
    return (
      <div className="space-y-2">
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
      </div>
    );
  }
  if (accounts.length === 0) {
    return (
      <div className="rounded-[var(--zoru-radius)] border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p>
          No ad accounts found. Connect a Meta Ad account from{' '}
          <Link
            href="/dashboard/ad-manager/ad-accounts"
            className="underline font-medium"
          >
            Ad Manager → Ad accounts
          </Link>{' '}
          first.
        </p>
        {error ? <p className="mt-1 text-xs text-amber-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <ZoruRadioGroup
      value={draft.adAccountId}
      onValueChange={(val) => {
        const match = accounts.find((a) => a.id === val || a.account_id === val);
        setDraft({
          adAccountId: val,
          adAccountName: match?.name ?? val,
        });
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto"
    >
      {accounts.map((a: any) => (
        <ZoruRadioCard
          key={a.id ?? a.account_id}
          value={a.id ?? a.account_id}
          label={a.name ?? a.account_id}
          description={`${a.currency ?? ''} · ${a.account_id ?? a.id}`}
        />
      ))}
    </ZoruRadioGroup>
  );
}

export default function FacebookAdsPage() {
  const steps = React.useMemo<ModuleWizardStep<FbAdsDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'Push Meta lead-form submissions straight into the CRM pipeline. Ad accounts and lead forms come from the SabNode Ad Manager.',
        render: () => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Megaphone, title: 'Ads run in Ad Manager', body: 'Campaigns, ad sets, creatives — all managed there.' },
              { icon: Target, title: 'Leads land in CRM', body: 'Each Meta lead form submission becomes a CRM lead.' },
              { icon: Workflow, title: 'Routed by pipeline', body: 'New leads enter the pipeline & stage you select.' },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
              >
                <p.icon className="h-5 w-5 text-zoru-ink" />
                <p className="mt-2 text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-zoru-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'account',
        title: 'Pick ad account',
        description: 'Pick the Meta ad account whose lead forms will sync.',
        render: ({ draft, setDraft }) => (
          <AdAccountPicker draft={draft} setDraft={setDraft} />
        ),
        validate: (d) => (d.adAccountId ? null : 'Pick an ad account.'),
      },
      {
        id: 'forms',
        title: 'Lead forms',
        description:
          'Comma-separated lead form IDs to sync. Leave blank to ingest all lead forms on the account.',
        render: ({ draft, setDraft }) => (
          <div>
            <ZoruLabel htmlFor="leadFormIds">Lead form IDs</ZoruLabel>
            <ZoruInput
              id="leadFormIds"
              value={draft.leadFormIds}
              onChange={(e) => setDraft({ leadFormIds: e.target.value })}
              placeholder="123456,789012  (leave blank for all)"
            />
            <p className="mt-2 text-xs text-zoru-ink-muted">
              Manage lead forms in{' '}
              <Link
                href="/dashboard/ad-manager/lead-forms"
                className="underline"
              >
                Ad Manager → Lead forms
              </Link>
              .
            </p>
          </div>
        ),
      },
      {
        id: 'routing',
        title: 'Routing',
        description: 'Where new Meta leads land inside the CRM.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="defaultPipeline">Default pipeline</ZoruLabel>
              <ZoruInput
                id="defaultPipeline"
                value={draft.defaultPipeline}
                onChange={(e) => setDraft({ defaultPipeline: e.target.value })}
                placeholder="Inbound sales"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="defaultStage">Default stage</ZoruLabel>
              <ZoruInput
                id="defaultStage"
                value={draft.defaultStage}
                onChange={(e) => setDraft({ defaultStage: e.target.value })}
                placeholder="New"
              />
            </div>
          </div>
        ),
      },
      {
        id: 'review',
        title: 'Review',
        render: ({ draft }) => (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zoru-ink-muted">Ad account</dt>
              <dd className="mt-0.5 font-medium">{draft.adAccountName}</dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Lead forms</dt>
              <dd className="mt-0.5 font-medium">
                {draft.leadFormIds || 'All on account'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Default pipeline</dt>
              <dd className="mt-0.5 font-medium">
                {draft.defaultPipeline || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Default stage</dt>
              <dd className="mt-0.5 font-medium">{draft.defaultStage || '—'}</dd>
            </div>
          </dl>
        ),
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Facebook ads"
      subtitle="Sync Meta lead-form submissions into the CRM pipeline."
    >
      <ModuleConnectionWizard<FbAdsDraft>
        moduleKey="facebook-ads"
        title="Facebook ads"
        subtitle="Meta lead-form submissions land in the CRM as new leads."
        icon={Megaphone}
        targetModuleLabel="Ad Manager"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => (
          <ZoruCard>
            <ZoruCardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zoru-ink-muted">Ad account</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.adAccountName ||
                      connection.config.adAccountId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Lead forms</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.leadFormIds || 'All on account'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Default route</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.defaultPipeline || '—'} ·{' '}
                    {connection.config.defaultStage || '—'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                  <Link href="/dashboard/ad-manager">
                    Open Ad Manager
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </ZoruButton>
                <ZoruButton variant="ghost" onClick={onReconnect}>
                  Edit
                </ZoruButton>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        )}
      />
    </EntityListShell>
  );
}
