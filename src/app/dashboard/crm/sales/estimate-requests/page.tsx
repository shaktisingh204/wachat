'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileQuestion,
  LoaderCircle,
  Plus,
  Save,
  } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
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

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function EstimateRequestsPage() {
  const router = useRouter();
  const { toast } = useZoruToast();

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
          <ZoruButton onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? 'Close' : 'New Request'}
          </ZoruButton>
        }
      />

      {showForm ? (
        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">
            New Estimate Request
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel className="text-zoru-ink">Requester Name</ZoruLabel>
              <ZoruInput
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Requester Email</ZoruLabel>
              <ZoruInput
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <ZoruLabel className="text-zoru-ink">Description</ZoruLabel>
              <ZoruTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What work is being estimated?"
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Desired Date</ZoruLabel>
              <ZoruInput
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <ZoruButton variant="outline" onClick={() => setShowForm(false)}>
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </ZoruButton>
            <ZoruButton disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </ZoruButton>
          </div>
        </ZoruCard>
      ) : null}

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Requester</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Desired Date</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Created</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={5} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No estimate requests yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r) => (
                  <ZoruTableRow
                    key={r._id}
                    className="cursor-pointer border-zoru-line hover:bg-zoru-surface-2"
                    onClick={() =>
                      router.push(`/dashboard/crm/sales/estimate-requests/${r._id}`)
                    }
                  >
                    <ZoruTableCell className="max-w-[320px] truncate text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/sales/estimate-requests/${r._id}`}
                        className="hover:underline"
                      >
                        {r.description}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {r.requester_name || '—'}
                      {r.requester_email ? (
                        <span className="block text-[11.5px] text-zoru-ink-muted">
                          {r.requester_email}
                        </span>
                      ) : null}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {fmtDate(r.desired_date)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_VARIANT[r.status] || 'ghost'}>
                        {r.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {fmtDate(r.createdAt)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
