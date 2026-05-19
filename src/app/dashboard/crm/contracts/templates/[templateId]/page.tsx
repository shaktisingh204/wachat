import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import {
  EntityDetailShell,
  type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getContractTemplateById } from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractTemplate } from '@/lib/worksuite/contracts-ext-types';

import { TemplateDetailActions } from './_components/template-detail-actions';
import { TemplatePreview } from './_components/template-preview';

export const dynamic = 'force-dynamic';

type StoredTemplate = WsContractTemplate & {
  _id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusTone(status?: string): EntityStatusTone {
  switch (status) {
    case 'active':
    case 'published':
      return 'green';
    case 'archived':
      return 'neutral';
    case 'draft':
      return 'amber';
    default:
      return 'neutral';
  }
}

function extractVariables(body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1]);
  }
  return [...found].sort();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function ContractTemplateDetailPage(props: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await props.params;
  const tpl = (await getContractTemplateById(
    templateId,
  )) as StoredTemplate | null;

  if (!tpl) {
    return (
      <div className="flex w-full flex-col gap-4 p-6">
        <p className="text-[14px] text-zoru-ink">
          Couldn&apos;t load this template.
        </p>
        <ZoruButton variant="outline" asChild>
          <Link href="/dashboard/crm/contracts/templates">
            <ArrowLeft className="h-4 w-4" /> Back to Templates
          </Link>
        </ZoruButton>
      </div>
    );
  }

  const body = tpl.body ?? '';
  const status = tpl.status ?? 'draft';
  const variables = extractVariables(body);
  const title = tpl.name || 'Contract Template';

  return (
    <EntityDetailShell
      eyebrow="CONTRACT TEMPLATE"
      title={title}
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/contracts/templates', label: 'Templates' }}
      actions={
        <TemplateDetailActions
          templateId={templateId}
          name={tpl.name || ''}
          body={body}
        />
      }
      audit={
        <EntityAuditTimeline
          entityKind="contract_template"
          entityId={templateId}
        />
      }
      rightRail={
        <>
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Status</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">State</span>
                  <ZoruBadge variant="outline">{status}</ZoruBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Variables</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {variables.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Body size</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {body.length}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Quick actions</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/sales/contracts/new?templateId=${templateId}`}
                  className="text-zoru-primary hover:underline"
                >
                  Use to create contract →
                </Link>
                <Link
                  href="/dashboard/crm/contracts/templates"
                  className="text-zoru-primary hover:underline"
                >
                  All templates →
                </Link>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Lifecycle</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>{fmtDate(tpl.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>{fmtDate(tpl.updatedAt)}</span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      }
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Template name">{tpl.name || '—'}</Field>
            <Field label="Status">
              <ZoruBadge variant="outline">{status}</ZoruBadge>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Body (raw)">
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zoru-line bg-zoru-surface p-3 font-mono text-[12px] leading-relaxed text-zoru-ink">
                {body || '—'}
              </pre>
            </Field>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Preview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <TemplatePreview body={body} variables={variables} />
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Variables</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {variables.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No <code>{'{{variables}}'}</code> detected in the body.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-[12.5px]">
              {variables.map((v) => (
                <li
                  key={v}
                  className="rounded-md border border-zoru-line bg-zoru-surface px-2 py-1 font-mono text-zoru-ink"
                >
                  {'{{'}
                  {v}
                  {'}}'}
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Linked contracts</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-[13px] text-zoru-ink-muted">
            Contracts created from this template will appear here once the
            `templateId` linkage is persisted on the contract record.
          </p>
          <div className="mt-2">
            <Link
              href={`/dashboard/crm/sales/contracts?templateId=${templateId}`}
              className="text-[12.5px] text-zoru-primary hover:underline"
            >
              Search contracts with this template →
            </Link>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <p className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(tpl.createdAt)} · Updated {fmtDate(tpl.updatedAt)}
      </p>
    </EntityDetailShell>
  );
}
