'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, DialogDescription } from '@/components/sabcrm/20ui';
import { getMaintenanceLogs, addMaintenanceLog, type MaintenanceLog } from './maintenance.actions';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function MaintenanceLogCard({ assetId, currency }: { assetId: string, currency: string }) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [date, setDate] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [provider, setProvider] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMaintenanceLogs(assetId).then(res => {
      if (res.logs) setLogs(res.logs);
      setLoading(false);
    });
  }, [assetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await addMaintenanceLog(assetId, {
      date,
      type,
      description,
      cost: Number(cost),
      provider
    });
    setSubmitting(false);
    setOpen(false);
    setDate(''); setType(''); setDescription(''); setCost(''); setProvider('');
    const res = await getMaintenanceLogs(assetId);
    if (res.logs) setLogs(res.logs);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Maintenance log</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">Loading logs...</p>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-6 text-center">
            <p className="text-[13px] text-[var(--st-text-secondary)]">No maintenance history recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log._id} className="flex justify-between border-b border-[var(--st-border)] pb-3 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[13px]">{log.type}</span>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">{new Date(log.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[12px] text-[var(--st-text-secondary)]">{log.description}</p>
                  {log.provider && <p className="text-[12px] text-[var(--st-text-secondary)]">Provider: {log.provider}</p>}
                </div>
                <div className="text-[13px] font-mono font-medium">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(log.cost)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
            <DialogDescription>Log a repair, inspection, or service for this asset.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[12px] font-medium">Date</label>
              <Input type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] font-medium">Type (e.g. Repair, Oil Change)</label>
              <Input required value={type} onChange={e => setType(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] font-medium">Description</label>
              <Input required value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium">Cost</label>
                <Input type="number" required min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
              </div>
              <div>
                <label className="text-[12px] font-medium">Provider / Vendor</label>
                <Input value={provider} onChange={e => setProvider(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Saving...' : 'Save Record'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
