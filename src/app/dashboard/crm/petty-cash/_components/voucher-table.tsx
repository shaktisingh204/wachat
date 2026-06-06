'use client';

import * as React from 'react';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, useToast } from '@/components/sabcrm/20ui/compat';
import { Download, Check, X, Eye } from 'lucide-react';
import { updateVoucherStatus } from '../extended-actions';

function fmtMoney(value: unknown, currency?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency ?? 'INR'} ${value}`;
  }
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

interface VoucherTableProps {
  floatId: string;
  currency?: string;
  vouchers: Array<{
    _id?: string;
    category?: string;
    amount?: number;
    payee?: string;
    date?: string;
    glCode?: string;
    requesterName?: string;
    receiptUrl?: string;
    status?: string;
  }>;
}

export function VoucherTable({ floatId, currency, vouchers }: VoucherTableProps) {
  const { toast } = useToast();
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleExportCsv = () => {
    const headers = ['Date', 'Category', 'GL Code', 'Payee', 'Requester', 'Amount', 'Status'];
    const rows = vouchers.map(v => [
      fmtDate(v.date),
      v.category || 'misc',
      v.glCode || '',
      v.payee || '',
      v.requesterName || '',
      v.amount || 0,
      v.status || 'pending_approval'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n' 
      + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "gl_codes_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = (voucherId: string, status: string) => {
    startTransition(async () => {
      const res = await updateVoucherStatus(floatId, voucherId, status);
      if (res.success) {
        toast({ title: 'Status updated' });
      } else {
        toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  if (vouchers.length === 0) {
    return <p className="text-[13px] text-[var(--st-text-secondary)]">No vouchers recorded yet.</p>;
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="outline" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--st-border)]/60 text-left text-[11px] uppercase text-[var(--st-text-secondary)]">
            <th className="py-2">Date</th>
            <th className="py-2">Category</th>
            <th className="py-2">GL Code</th>
            <th className="py-2">Payee & Req</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2 text-center">Status</th>
            <th className="py-2 text-center">Receipt</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.slice().reverse().map((v, idx) => (
            <tr key={v._id ?? `${v.date}-${idx}`} className="border-b border-[var(--st-border)]/40 last:border-0">
              <td className="py-2">{fmtDate(v.date)}</td>
              <td className="py-2">
                <Badge variant="outline">{(v.category || 'misc').replace(/_/g, ' ')}</Badge>
              </td>
              <td className="py-2">{v.glCode || '—'}</td>
              <td className="py-2">
                <div>{v.payee || '—'}</div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">{v.requesterName}</div>
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {fmtMoney(v.amount, currency)}
              </td>
              <td className="py-2 text-center">
                <Badge variant={v.status === 'approved' ? 'default' : v.status === 'rejected' ? 'destructive' : 'outline'}>
                  {(v.status || 'pending').replace('_', ' ')}
                </Badge>
              </td>
              <td className="py-2 text-center">
                {v.receiptUrl ? (
                  <button onClick={() => setLightboxUrl(v.receiptUrl!)} className="text-[var(--st-text)] hover:underline flex items-center justify-center w-full">
                    <Eye className="h-4 w-4" />
                  </button>
                ) : '—'}
              </td>
              <td className="py-2 text-right space-x-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleStatusChange(v._id!, 'approved')} disabled={isPending || v.status === 'approved'}>
                  <Check className="h-4 w-4 text-[var(--st-text)]" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleStatusChange(v._id!, 'rejected')} disabled={isPending || v.status === 'rejected'}>
                  <X className="h-4 w-4 text-[var(--st-text)]" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Receipt Image</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <div className="mt-4 flex justify-center bg-[var(--st-hover)] p-4 rounded-lg">
              <img 
                src={lightboxUrl} 
                alt="Receipt" 
                className="max-h-[60vh] object-contain" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1pbWFnZS1vZmYiPjxsaW5lIHgxPSIyIiB5MT0iMiIgeDI9IjIyIiB5Mj0iMjIiLz48cGF0aCBkPSJNMTAuNDEgMTAuNDFBMiAyIDAgMCAwIDEyIDEyIi8+PHBhdGggZD0iTTEwIDEwLjQxIDEwIDEwaDQiLz48cGF0aCBkPSJNMjEgMjF2LThhMiAyIDAgMCAwLTIuNS0xLjliLTIuNS0xLjl2LTVhMiAyIDAgMCAwLTItMmgtNWEyIDIgMCAwIDAtMiAydjVoLTIiLz48cGF0aCBkPSJNMzEgMjFIMiIvPjwvc3ZnPg=='; // Basic broken image icon
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
