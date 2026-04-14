'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { LayoutTemplate, LoaderCircle, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  deleteEstimateTemplate,
  getEstimateTemplates,
} from '@/app/actions/worksuite/proposals.actions';
import type { WsEstimateTemplate } from '@/lib/worksuite/proposals-types';

type Row = WsEstimateTemplate & { _id: string };

function fmtCurrency(v: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(v || 0);
  } catch {
    return `${currency || ''} ${(v || 0).toFixed(2)}`;
  }
}

export default function EstimateTemplatesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const data = await getEstimateTemplates();
      setRows(data);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setDeletingId(id);
    const res = await deleteEstimateTemplate(id);
    setDeletingId(null);
    if (res.success) {
      toast({ title: 'Template deleted' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Estimate Templates"
        subtitle="Reusable estimate templates for quick quoting."
        icon={LayoutTemplate}
        actions={
          <Link href="/dashboard/crm/sales/proposals/templates">
            <ClayButton variant="pill">Proposal Templates</ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Title</TableHead>
                <TableHead className="text-clay-ink-muted">Currency</TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Total
                </TableHead>
                <TableHead className="w-24 text-clay-ink-muted" />
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
                    No estimate templates yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow key={t._id} className="border-clay-border">
                    <TableCell className="font-medium text-clay-ink">
                      {t.name}
                    </TableCell>
                    <TableCell className="text-clay-ink">{t.title}</TableCell>
                    <TableCell className="text-clay-ink">{t.currency}</TableCell>
                    <TableCell className="text-right font-medium text-clay-ink">
                      {fmtCurrency(t.total, t.currency)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleDelete(t._id)}
                        disabled={deletingId === t._id}
                        className="rounded-clay-md p-1.5 text-clay-ink-muted hover:bg-clay-red-soft hover:text-clay-red disabled:opacity-50"
                        aria-label="Delete template"
                      >
                        {deletingId === t._id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
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
