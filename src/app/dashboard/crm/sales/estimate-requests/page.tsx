'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileQuestion,
  LoaderCircle,
  Plus,
  Save,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getEstimateRequests,
  saveEstimateRequest,
} from '@/app/actions/worksuite/proposals.actions';
import type {
  WsEstimateRequest,
  WsEstimateRequestStatus,
} from '@/lib/worksuite/proposals-types';

type Row = WsEstimateRequest & { _id: string };
type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'blue';

const STATUS_TONE: Record<WsEstimateRequestStatus, Tone> = {
  pending: 'amber',
  'in-review': 'blue',
  quoted: 'blue',
  declined: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Estimate Requests"
        subtitle="Incoming estimate requests from clients and leads."
        icon={FileQuestion}
        actions={
          <ClayButton
            variant="obsidian"
            onClick={() => setShowForm((v) => !v)}
            leading={<Plus className="h-4 w-4" />}
          >
            {showForm ? 'Close' : 'New Request'}
          </ClayButton>
        }
      />

      {showForm ? (
        <ClayCard>
          <h2 className="mb-3 text-[16px] font-semibold text-clay-ink">
            New Estimate Request
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-clay-ink">Requester Name</Label>
              <Input
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Requester Email</Label>
              <Input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-clay-ink">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What work is being estimated?"
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Desired Date</Label>
              <Input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <ClayButton
              variant="pill"
              onClick={() => setShowForm(false)}
              leading={<ArrowLeft className="h-4 w-4" />}
            >
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              disabled={isSaving}
              onClick={handleSave}
              leading={
                isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              }
            >
              Save
            </ClayButton>
          </div>
        </ClayCard>
      ) : null}

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Description</TableHead>
                <TableHead className="text-clay-ink-muted">Requester</TableHead>
                <TableHead className="text-clay-ink-muted">Desired Date</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-clay-ink-muted">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={5} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No estimate requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r._id}
                    className="cursor-pointer border-clay-border hover:bg-clay-surface-2"
                    onClick={() =>
                      router.push(`/dashboard/crm/sales/estimate-requests/${r._id}`)
                    }
                  >
                    <TableCell className="max-w-[320px] truncate text-clay-ink">
                      <Link
                        href={`/dashboard/crm/sales/estimate-requests/${r._id}`}
                        className="font-medium hover:underline"
                      >
                        {r.description}
                      </Link>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {r.requester_name || '—'}
                      {r.requester_email ? (
                        <span className="block text-[11.5px] text-clay-ink-muted">
                          {r.requester_email}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {fmtDate(r.desired_date)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={STATUS_TONE[r.status] || 'neutral'} dot>
                        {r.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {fmtDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
