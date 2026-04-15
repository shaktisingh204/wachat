'use client';

import * as React from 'react';
import { useTransition, useActionState, useEffect, useState } from 'react';
import { LineChart, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmKpis,
  saveCrmKpi,
  deleteCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';
import { WithId } from 'mongodb';

const STATUS_TONES: Record<CrmKpi['status'], 'green' | 'amber' | 'red'> = {
  achieved: 'green',
  'on-track': 'amber',
  behind: 'red',
};

function AchievementBar({ target, actual }: { target: number; actual: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-clay-amber' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-clay-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-clay-ink-muted">{pct}%</span>
    </div>
  );
}

const SAVE_INITIAL = { message: '', error: '' };

function KpiFormDialog({
  open,
  onOpenChange,
  kpi,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kpi: WithId<CrmKpi> | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(saveCrmKpi, SAVE_INITIAL);
  const isEdit = Boolean(kpi?._id);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      onOpenChange(false);
      onSaved();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-clay-ink">
            {isEdit ? 'Edit KPI' : 'New KPI'}
          </DialogTitle>
          <DialogDescription className="text-clay-ink-muted">
            Define a key performance indicator and track progress.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 py-2">
          {isEdit && <input type="hidden" name="id" value={String(kpi!._id)} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-clay-ink">
                KPI Name <span className="text-clay-red">*</span>
              </Label>
              <Input
                name="kpi_name"
                required
                defaultValue={kpi?.kpi_name ?? ''}
                placeholder="e.g. Monthly Sales Revenue"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Employee</Label>
              <Input
                name="employee_id"
                defaultValue={kpi?.employee_id ?? ''}
                placeholder="Employee ID or name"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Period</Label>
              <Input
                name="period"
                defaultValue={kpi?.period ?? ''}
                placeholder="Q1 2026"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Target Value</Label>
              <Input
                name="target_value"
                type="number"
                defaultValue={kpi?.target_value ?? ''}
                placeholder="100"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Actual Value</Label>
              <Input
                name="actual_value"
                type="number"
                defaultValue={kpi?.actual_value ?? ''}
                placeholder="0"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Unit</Label>
              <Select name="unit" defaultValue={kpi?.unit ?? '%'}>
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="%">% (Percentage)</SelectItem>
                  <SelectItem value="$">$ (Currency)</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-clay-ink">Status</Label>
              <Select name="status" defaultValue={kpi?.status ?? 'on-track'}>
                <SelectTrigger className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="behind">Behind</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <ClayButton type="button" variant="pill" onClick={() => onOpenChange(false)}>
              Cancel
            </ClayButton>
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null
              }
            >
              {isEdit ? 'Update KPI' : 'Create KPI'}
            </ClayButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function KpiTrackingPage() {
  const { toast } = useToast();
  const [kpis, setKpis] = useState<WithId<CrmKpi>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<CrmKpi> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const data = await getCrmKpis();
        setKpis(data);
      } catch {
        setKpis([]);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteCrmKpi(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'KPI removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <>
      <KpiFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kpi={editing}
        onSaved={refresh}
      />
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">Delete KPI?</AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="KPI Tracking"
          subtitle="Define and monitor key performance indicators for teams and employees."
          icon={LineChart}
          actions={
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              New KPI
            </ClayButton>
          }
        />

        <ClayCard>
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-clay-border">
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">KPI Name</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Employee</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Period</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Target</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Actual</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Achievement</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-clay-ink-muted">Status</th>
                  <th className="px-4 py-3 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && kpis.length === 0 ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-clay-border">
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : kpis.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[13px] text-clay-ink-muted"
                    >
                      No KPIs yet — click New KPI to get started.
                    </td>
                  </tr>
                ) : (
                  kpis.map((kpi) => (
                    <tr
                      key={String(kpi._id)}
                      className="border-b border-clay-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-clay-ink">
                        {kpi.kpi_name}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-clay-ink-muted">
                        {kpi.employee_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-clay-ink-muted">{kpi.period || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-clay-ink">
                        {kpi.target_value}
                        <span className="ml-0.5 text-[11px] text-clay-ink-muted">
                          {kpi.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-clay-ink">
                        {kpi.actual_value}
                        <span className="ml-0.5 text-[11px] text-clay-ink-muted">
                          {kpi.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AchievementBar
                          target={kpi.target_value}
                          actual={kpi.actual_value}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ClayBadge tone={STATUS_TONES[kpi.status] ?? 'neutral'} dot>
                          {kpi.status}
                        </ClayBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton
                            variant="pill"
                            size="sm"
                            leading={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
                            onClick={() => {
                              setEditing(kpi);
                              setDialogOpen(true);
                            }}
                          />
                          <ClayButton
                            variant="pill"
                            size="sm"
                            leading={
                              <Trash2 className="h-3.5 w-3.5 text-clay-red" strokeWidth={1.75} />
                            }
                            onClick={() => setDeletingId(String(kpi._id))}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ClayCard>
      </div>
    </>
  );
}
