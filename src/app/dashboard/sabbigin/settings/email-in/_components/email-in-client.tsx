'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, AtSign } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Badge,
  toast,
} from '@/components/sabcrm/20ui';
import {
  createSabbiginEmailInAlias,
  deleteSabbiginEmailInAlias,
  type SabbiginEmailInData,
} from '@/app/actions/sabbigin-emailin.actions';

export function EmailInClient({
  data,
  pipelines,
}: {
  data: SabbiginEmailInData;
  pipelines: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [localPart, setLocalPart] = React.useState('sales');
  const [domainId, setDomainId] = React.useState(data.domains[0]?.id ?? '');
  const [accountId, setAccountId] = React.useState(data.accounts[0]?.id ?? '');
  const [pipelineId, setPipelineId] = React.useState(pipelines[0]?.id ?? '');
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    const res = await createSabbiginEmailInAlias({
      domainId,
      localPart,
      targetAccountId: accountId || undefined,
      pipelineId,
      createDeal: true,
    });
    setBusy(false);
    if (res.success) {
      toast.success({ title: 'Email-In alias created' });
      router.refresh();
    } else {
      toast.error({ title: 'Could not create', description: res.error });
    }
  }

  async function remove(id: string, sourceAddress: string) {
    const res = await deleteSabbiginEmailInAlias(id, sourceAddress);
    if (res.success) {
      toast.success({ title: 'Alias removed' });
      router.refresh();
    } else {
      toast.error({ title: 'Could not remove', description: res.error });
    }
  }

  const pipelineName = (id?: string | null) =>
    pipelines.find((p) => p.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Create a pipeline inbox</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Alias name">
              <Input value={localPart} onChange={(e) => setLocalPart(e.target.value)} />
            </Field>
            <Field label="Domain">
              <select
                className="u-input"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
              >
                {data.domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    @{d.domain} {d.verified ? '' : '(unverified)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Deliver a copy to mailbox (optional)">
              <select
                className="u-input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">— none —</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.address}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Create deals in pipeline">
              <select
                className="u-input"
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[12px] text-[var(--st-text-secondary)]">
              Mail sent to{' '}
              <code className="text-[var(--st-accent)]">
                {localPart}@{data.domains.find((d) => d.id === domainId)?.domain ?? '…'}
              </code>{' '}
              opens a deal automatically.
            </p>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus size={14} />}
              loading={busy}
              disabled={!domainId || !pipelineId}
              onClick={create}
            >
              Create alias
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Active inboxes</CardTitle>
        </CardHeader>
        <CardBody>
          {data.aliases.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No Email-In aliases yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.aliases.map((al) => (
                <li
                  key={al.id}
                  className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <AtSign className="h-4 w-4 text-[var(--st-text-secondary)]" />
                  <code className="text-[13px] text-[var(--st-text)]">
                    {al.sourceAddress}
                  </code>
                  {al.pipelineId ? (
                    <Badge tone="info">→ {pipelineName(al.pipelineId)}</Badge>
                  ) : (
                    <Badge tone="neutral">no pipeline</Badge>
                  )}
                  <button
                    type="button"
                    className="u-icon-btn u-icon-btn--sm ml-auto"
                    aria-label="Remove alias"
                    onClick={() => remove(al.id, al.sourceAddress)}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
