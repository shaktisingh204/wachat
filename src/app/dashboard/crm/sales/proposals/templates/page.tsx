'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  deleteProposalTemplate,
  getProposalTemplates,
} from '@/app/actions/worksuite/proposals.actions';
import type { WsProposalTemplate } from '@/lib/worksuite/proposals-types';

type Row = WsProposalTemplate & { _id: string };

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

export default function ProposalTemplatesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const r = await getProposalTemplates();
      setRows(r);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setDeletingId(id);
    const res = await deleteProposalTemplate(id);
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
        title="Proposal Templates"
        subtitle="Reusable templates you can clone into new proposals."
        icon={LayoutTemplate}
        actions={
          <>
            <Link href="/dashboard/crm/sales/proposals">
              <ZoruButton variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </ZoruButton>
            </Link>
            <Link href="/dashboard/crm/sales/proposals/templates/new">
              <ZoruButton>
                <Plus className="h-4 w-4" />
                New Template
              </ZoruButton>
            </Link>
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Currency</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Total
                </ZoruTableHead>
                <ZoruTableHead className="w-24 text-zoru-ink-muted" />
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
                    No templates yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((t) => (
                  <ZoruTableRow key={t._id} className="border-zoru-line">
                    <ZoruTableCell className="text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/sales/proposals/templates/${t._id}`}
                        className="hover:underline"
                      >
                        {t.name}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{t.title}</ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{t.currency}</ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink">
                      {fmtCurrency(t.total, t.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <button
                        type="button"
                        onClick={() => handleDelete(t._id)}
                        disabled={deletingId === t._id}
                        className="rounded-lg p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-danger-ink disabled:opacity-50"
                        aria-label="Delete template"
                      >
                        {deletingId === t._id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
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
