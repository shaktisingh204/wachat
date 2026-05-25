'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
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
          <h2 className="mb-3 text-[16px] text-zoru-ink">
            New Estimate Request
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-zoru-ink">Requester Name</Label>
              <Input
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-zoru-ink">Requester Email</Label>
              <Input
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-zoru-ink">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What work is being estimated?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-zoru-ink">Desired Date</Label>
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
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <Table>
            <TableHeader>
              <TableRow className="border-zoru-line hover:bg-transparent">
                <TableHead className="text-zoru-ink-muted">Description</TableHead>
                <TableHead className="text-zoru-ink-muted">Requester</TableHead>
                <TableHead className="text-zoru-ink-muted">Desired Date</TableHead>
                <TableHead className="text-zoru-ink-muted">Status</TableHead>
                <TableHead className="text-zoru-ink-muted">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-zoru-line">
                  <TableCell colSpan={5} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-zoru-line">
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No estimate requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r._id}
                    className="cursor-pointer border-zoru-line hover:bg-zoru-surface-2"
                    onClick={() =>
                      router.push(`/dashboard/crm/sales/estimate-requests/${r._id}`)
                    }
                  >
                    <TableCell className="max-w-[320px] truncate text-zoru-ink">
                      <EntityRowLink
                        href={`/dashboard/crm/sales/estimate-requests/${r._id}`}
                        label={r.description}
                        subtitle={r.status ? `Status: ${r.status}` : undefined}
                      />
                    </TableCell>
                    <TableCell className="text-zoru-ink">
                      {r.requester_name || '—'}
                      {r.requester_email ? (
                        <span className="block text-[11.5px] text-zoru-ink-muted">
                          {r.requester_email}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-zoru-ink">
                      {fmtDate(r.desired_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] || 'ghost'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zoru-ink">
                      {fmtDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </EntityListShell>
  );
}
