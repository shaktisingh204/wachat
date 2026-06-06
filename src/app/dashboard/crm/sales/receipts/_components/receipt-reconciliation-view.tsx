import * as React from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { setPaymentReceiptStatus } from '@/app/actions/crm/payment-receipts.actions';

interface ReceiptReconciliationViewProps {
  receipts: CrmPaymentReceiptDoc[];
  loading: boolean;
  onStatusUpdated: () => void;
}

export function ReceiptReconciliationView({
  receipts,
  loading,
  onStatusUpdated,
}: ReceiptReconciliationViewProps) {
  const { toast } = useZoruToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Filter out receipts that are already cleared/bounced if we want this to be a strict "pending" view,
  // but maybe it's useful to see all in the reconciliation context. We'll group by bank account.
  // Actually, we'll just show "received" (pending) ones.
  const pendingReceipts = receipts.filter((r) => r.status === 'received' || !r.status);

  const grouped = pendingReceipts.reduce((acc, r) => {
    const bank = r.bankAccountId || 'unspecified';
    if (!acc[bank]) acc[bank] = [];
    acc[bank].push(r);
    return acc;
  }, {} as Record<string, CrmPaymentReceiptDoc[]>);

  const [selectedBank, setSelectedBank] = React.useState<string>(Object.keys(grouped)[0] || 'unspecified');

  React.useEffect(() => {
    if (!grouped[selectedBank] && Object.keys(grouped).length > 0) {
      setSelectedBank(Object.keys(grouped)[0]);
    }
  }, [grouped, selectedBank]);

  const handleUpdateStatus = async (id: string, status: 'cleared' | 'bounced') => {
    setBusyId(id);
    try {
      const res = await setPaymentReceiptStatus(id, status);
      if (res.success) {
        toast({ title: 'Status updated', description: `Receipt marked as ${status}.` });
        onStatusUpdated();
      } else {
        toast({ title: 'Update failed', description: res?.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (pendingReceipts.length === 0) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed">
        <CheckCircle2 className="h-10 w-10 text-[var(--st-status-ok)] mb-4" />
        <h3 className="text-lg font-medium text-[var(--st-text)]">All caught up!</h3>
        <p className="text-sm text-[var(--st-text-secondary)]">No pending receipts to reconcile.</p>
      </Card>
    );
  }

  const currentGroup = grouped[selectedBank] || [];

  return (
    <Card className="overflow-hidden flex min-h-[500px]">
      <div className="w-1/3 border-r border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
        <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4">Pending by Bank</h3>
        <div className="space-y-1">
          {Object.entries(grouped).map(([bankId, items]) => (
            <button
              key={bankId}
              onClick={() => setSelectedBank(bankId)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center ${selectedBank === bankId ? 'bg-[var(--st-text)] text-zoru-primary-ink' : 'hover:bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}
            >
              <div className="flex-1 truncate pr-2">
                {bankId === 'unspecified' ? 'Unspecified Bank' : <EntityPickerChip entity="bankAccount" id={bankId} />}
              </div>
              <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${selectedBank === bankId ? 'bg-white/20' : 'bg-[var(--st-bg-secondary)]'}`}>
                {items.length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="w-2/3 p-0 bg-[var(--st-bg)] overflow-y-auto">
        <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center sticky top-0 bg-[var(--st-bg)]/95 backdrop-blur z-10">
          <h2 className="text-sm font-medium">Reconciling {currentGroup.length} items</h2>
          {busyId && <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-2"><Clock className="h-3 w-3 animate-spin"/> Updating...</div>}
        </div>
        <div className="divide-y divide-[var(--st-border)]">
          {currentGroup.map(r => (
            <div key={String(r._id)} className="p-4 flex flex-col gap-3 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-medium text-[var(--st-text)]">{r.receiptNo}</div>
                  <div className="text-xs text-[var(--st-text-secondary)] mt-1">
                    {r.date ? new Date(r.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No date'} • {r.mode || 'Unknown mode'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-medium">{r.currency || 'INR'} {r.amount}</div>
                  <div className="text-xs text-[var(--st-text-secondary)] mt-1">{r.chequeNo || r.txnId || r.reference || 'No ref'}</div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--st-border)]/50">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-[var(--st-danger)] border-[var(--st-danger)]/20 hover:bg-[var(--st-danger-soft)] hover:border-[var(--st-danger)]/30"
                  disabled={busyId === String(r._id)}
                  onClick={() => handleUpdateStatus(String(r._id), 'bounced')}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Mark Bounced
                </Button>
                <Button 
                  size="sm" 
                  className="bg-zoru-success-bg text-[var(--st-status-ok)] hover:bg-zoru-success-bg/80 border border-[var(--st-status-ok)]/20"
                  disabled={busyId === String(r._id)}
                  onClick={() => handleUpdateStatus(String(r._id), 'cleared')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Cleared
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
