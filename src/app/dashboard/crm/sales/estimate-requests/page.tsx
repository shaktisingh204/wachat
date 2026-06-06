'use client';

import { Badge, Button, Card, Input, Label, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  getEstimateRequests,
  saveEstimateRequest,
} from '@/app/actions/worksuite/proposals.actions';
import type {
  WsEstimateRequest,
  WsEstimateRequestStatus,
} from '@/lib/worksuite/proposals-types';

type Row = WsEstimateRequest & { _id: string };
type Variant = 'ghost' | 'warning' | 'success' | 'danger';

const STATUS_VARIANT: Record<WsEstimateRequestStatus, Variant> = {
  pending: 'warning',
  'in-review': 'ghost',
  quoted: 'ghost',
  declined: 'danger',
};

import { fmtDate } from '@/lib/utils';

export default function EstimateRequestsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [description, setDescription] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const data = await getEstimateRequests();
      setRows(data);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!description.trim()) {
      toast({ title: 'Description required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const res = await saveEstimateRequest({
      requester_name: requesterName,
      requester_email: requesterEmail,
      description,
      desired_date: desiredDate || undefined,
    });
    setIsSaving(false);
    if (res.success) {
      toast({ title: 'Request saved' });
      setRequesterName('');
      setRequesterEmail('');
      setDescription('');
      setDesiredDate('');
      setShowForm(false);
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="Estimate Requests"
      subtitle="Incoming estimate requests from clients and leads."
      primaryAction={
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? 'Close' : 'New Request'}
        </Button>
      }
    >

      {showForm ? (
        <Card className="p-6">
          <h2 className="mb-3 text-[16px] text-[var(--st-text)]">
            New Estimate Request
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[var(--st-text)]">Requester Name</Label>
              <Input
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Requester Email</Label>
              <Input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[var(--st-text)]">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What work is being estimated?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Desired Date</Label>
              <Input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>
            <Button disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Description</Th>
                <Th className="text-[var(--st-text-secondary)]">Requester</Th>
                <Th className="text-[var(--st-text-secondary)]">Desired Date</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="text-[var(--st-text-secondary)]">Created</Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading ? (
                <Tr className="border-[var(--st-border)]">
                  <Td colSpan={5} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                  </Td>
                </Tr>
              ) : rows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No estimate requests yet.
                  </Td>
                </Tr>
              ) : (
                rows.map((r) => (
                  <Tr
                    key={r._id}
                    className="cursor-pointer border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]"
                    onClick={() =>
                      router.push(`/dashboard/crm/sales/estimate-requests/${r._id}`)
                    }
                  >
                    <Td className="max-w-[320px] truncate text-[var(--st-text)]">
                      <EntityRowLink
                        href={`/dashboard/crm/sales/estimate-requests/${r._id}`}
                        label={r.description}
                        subtitle={r.status ? `Status: ${r.status}` : undefined}
                      />
                    </Td>
                    <Td className="text-[var(--st-text)]">
                      {r.requester_name || '—'}
                      {r.requester_email ? (
                        <span className="block text-[11.5px] text-[var(--st-text-secondary)]">
                          {r.requester_email}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-[var(--st-text)]">
                      {fmtDate(r.desired_date)}
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[r.status] || 'ghost'}>
                        {r.status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text)]">
                      {fmtDate(r.createdAt)}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
