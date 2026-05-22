import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Reply template detail page.
 *
 * Renders the canned reply body in a monospace preview block so the
 * `{{variable}}` placeholders are obvious to the operator.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getReplyTemplateById } from '@/app/actions/crm-reply-templates.actions';
import type { CrmReplyTemplateStatus } from '@/lib/rust-client/crm-reply-templates';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/reply-templates';

const STATUS_TONE: Record<CrmReplyTemplateStatus, StatusTone> = {
  active: 'green',
  archived: 'neutral',
};

export default async function ReplyTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const template = await getReplyTemplateById(id);
  if (!template) notFound();

  const status = (template.status ?? 'active') as CrmReplyTemplateStatus;
  const tone = STATUS_TONE[status] ?? 'neutral';
  const variables = Array.isArray(template.variables) ? template.variables : [];

  return (
    <EntityDetailShell
      eyebrow="REPLY TEMPLATE"
      title={template.name}
      back={{ href: BASE, label: 'Reply Templates' }}
      actions={
        <ZoruButton asChild>
          <Link href={`${BASE}/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
          <StatusPill label={status} tone={tone} />
          {template.category ? (
            <ZoruBadge variant="ghost" className="capitalize">
              {template.category}
            </ZoruBadge>
          ) : null}
          {template.language ? (
            <ZoruBadge variant="ghost" className="uppercase">
              {template.language}
            </ZoruBadge>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
          <div>
            <div className="text-zoru-ink-muted">Shortcut</div>
            <div className="font-mono text-zoru-ink">
              {template.shortcut || '—'}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Usage count</div>
            <div className="font-mono text-zoru-ink">
              {template.usageCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Active</div>
            <div className="text-zoru-ink">
              {template.isActive ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </ZoruCard>

      {variables.length > 0 ? (
        <ZoruCard className="p-4">
          <div className="mb-2 text-[13px] font-medium text-zoru-ink">
            Variables ({variables.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <ZoruBadge key={v} variant="ghost">
                <code className="font-mono text-xs">{`{{${v}}}`}</code>
              </ZoruBadge>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <ZoruCard className="p-6">
        <div className="mb-3 text-[15px] font-medium text-zoru-ink">
          Template body
        </div>
        {template.body ? (
          <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-mono text-[13px] text-zoru-ink">
            {template.body}
          </pre>
        ) : (
          <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
            This template has no body yet.
          </div>
        )}
      </ZoruCard>
    </EntityDetailShell>
  );
}
