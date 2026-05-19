'use client';

import * as React from 'react';
import Link from 'next/link';
import { Folder, HardDrive, Sparkles, ArrowUpRight, CheckCircle2 } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruSkeleton,
  ZoruSwitch,
  ZoruLabel,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ModuleConnectionWizard,
  type ModuleWizardStep,
} from '@/components/crm/module-connection-wizard';

import { listNodes } from '@/app/actions/sabfiles.actions';

type StorageDraft = {
  rootFolderId: string | null;
  rootFolderName: string;
  autoOrganize: boolean;
};

const DEFAULT_DRAFT: StorageDraft = {
  rootFolderId: null,
  rootFolderName: 'My files (root)',
  autoOrganize: true,
};

function FolderPicker({
  draft,
  setDraft,
}: {
  draft: StorageDraft;
  setDraft: (next: Partial<StorageDraft>) => void;
}) {
  const [folders, setFolders] = React.useState<
    { id: string; name: string }[] | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listNodes({ parent: null });
      if (cancelled) return;
      const list = (res.nodes ?? [])
        .filter((n) => n.type === 'folder' && !n.trashed)
        .map((n) => ({ id: n.id, name: n.name }));
      setFolders([{ id: '__root__', name: 'My files (root)' }, ...list]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!folders) {
    return (
      <div className="space-y-2">
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <ZoruRadioGroup
      value={draft.rootFolderId ?? '__root__'}
      onValueChange={(val) => {
        const match = folders.find((f) => f.id === val);
        setDraft({
          rootFolderId: val === '__root__' ? null : val,
          rootFolderName: match?.name ?? 'My files (root)',
        });
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1"
    >
      {folders.map((f) => (
        <ZoruRadioCard
          key={f.id}
          value={f.id}
          icon={<Folder className="h-4 w-4 text-zoru-ink-muted" />}
          label={f.name}
        />
      ))}
    </ZoruRadioGroup>
  );
}

export default function StorageIntegrationPage() {
  const steps = React.useMemo<ModuleWizardStep<StorageDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'The CRM stores invoices, quote PDFs, contract files, and lead attachments in SabFiles — your tenant-scoped R2 file library.',
        render: () => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: HardDrive, title: 'One backend', body: 'Reuses SabFiles’ R2-backed storage. No extra credentials.' },
              { icon: Sparkles, title: 'Auto-organized', body: 'CRM uploads land in dated subfolders inside the folder you pick.' },
              { icon: CheckCircle2, title: 'Shareable', body: 'Share-link controls and download gating come from SabFiles.' },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
              >
                <p.icon className="h-5 w-5 text-zoru-ink" />
                <p className="mt-2 text-sm font-medium text-zoru-ink">
                  {p.title}
                </p>
                <p className="mt-1 text-xs text-zoru-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'folder',
        title: 'Pick a root folder',
        description:
          'New CRM uploads will land inside this folder. You can change it later.',
        render: ({ draft, setDraft }) => (
          <FolderPicker draft={draft} setDraft={setDraft} />
        ),
      },
      {
        id: 'options',
        title: 'Options',
        description: 'Fine-tune how files are organized.',
        render: ({ draft, setDraft }) => (
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
              <ZoruSwitch
                checked={draft.autoOrganize}
                onCheckedChange={(v) => setDraft({ autoOrganize: v })}
                className="mt-1"
              />
              <div>
                <ZoruLabel className="text-sm">Auto-organize uploads</ZoruLabel>
                <p className="text-xs text-zoru-ink-muted">
                  Place files into <code>YYYY/MM/&lt;module&gt;/</code>{' '}
                  subfolders so they don&apos;t crowd the root.
                </p>
              </div>
            </label>
          </div>
        ),
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Confirm your storage binding.',
        render: ({ draft }) => (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zoru-ink-muted">Root folder</dt>
              <dd className="mt-0.5 font-medium">{draft.rootFolderName}</dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Auto-organize</dt>
              <dd className="mt-0.5 font-medium">
                {draft.autoOrganize ? 'On' : 'Off'}
              </dd>
            </div>
          </dl>
        ),
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Storage"
      subtitle="Bind the CRM to SabFiles as its file backend."
    >
      <ModuleConnectionWizard<StorageDraft>
        moduleKey="storage"
        title="Storage"
        subtitle="Where CRM uploads (invoices, contracts, lead attachments) are stored."
        icon={HardDrive}
        targetModuleLabel="SabFiles"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => (
          <ZoruCard>
            <ZoruCardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm text-zoru-ink-muted">Root folder</p>
                  <p className="mt-0.5 text-sm font-medium flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-zoru-ink-muted" />
                    {connection.config.rootFolderName ?? 'My files (root)'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zoru-ink-muted">Auto-organize</p>
                  <ZoruBadge
                    variant={connection.config.autoOrganize ? 'default' : 'outline'}
                  >
                    {connection.config.autoOrganize ? 'On' : 'Off'}
                  </ZoruBadge>
                </div>
                <div>
                  <p className="text-sm text-zoru-ink-muted">Connected at</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {connection.connectedAt
                      ? new Date(connection.connectedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                  <Link href="/dashboard/sabfiles">
                    Open SabFiles
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
