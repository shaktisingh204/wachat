'use client';

import * as React from 'react';
import { useTransition, useActionState, useEffect, useState } from 'react';
import { LineChart, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';

import {
  ZoruCard,
  ZoruBadge,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  getCrmKpis,
  saveCrmKpi,
  deleteCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';
import { WithId } from 'mongodb';

const STATUS_VARIANTS: Record<CrmKpi['status'], 'success' | 'warning' | 'danger'> = {
  achieved: 'success',
  'on-track': 'warning',
  behind: 'danger',
};

function AchievementBar({ target, actual }: { target: number; actual: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zoru-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-zoru-ink-muted">{pct}%</span>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-zoru-ink">
            {isEdit ? 'Edit KPI' : 'New KPI'}
          </ZoruDialogTitle>
          <ZoruDialogDescription className="text-zoru-ink-muted">
            Define a key performance indicator and track progress.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form action={formAction} className="space-y-4 py-2">
          {isEdit && <input type="hidden" name="id" value={String(kpi!._id)} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <ZoruLabel className="text-zoru-ink">
                KPI Name <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                name="kpi_name"
                required
                defaultValue={kpi?.kpi_name ?? ''}
                placeholder="e.g. Monthly Sales Revenue"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Employee</ZoruLabel>
              <ZoruInput
                name="employee_id"
                defaultValue={kpi?.employee_id ?? ''}
                placeholder="Employee ID or name"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Period</ZoruLabel>
              <ZoruInput
                name="period"
                defaultValue={kpi?.period ?? ''}
                placeholder="Q1 2026"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Target Value</ZoruLabel>
              <ZoruInput
                name="target_value"
                type="number"
                defaultValue={kpi?.target_value ?? ''}
                placeholder="100"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Actual Value</ZoruLabel>
              <ZoruInput
                name="actual_value"
                type="number"
                defaultValue={kpi?.actual_value ?? ''}
                placeholder="0"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Unit</ZoruLabel>
              <ZoruSelect name="unit" defaultValue={kpi?.unit ?? '%'}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="%">% (Percentage)</ZoruSelectItem>
                  <ZoruSelectItem value="$">$ (Currency)</ZoruSelectItem>
                  <ZoruSelectItem value="count">Count</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
              <ZoruSelect name="status" defaultValue={kpi?.status ?? 'on-track'}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="on-track">On Track</ZoruSelectItem>
                  <ZoruSelectItem value="behind">Behind</ZoruSelectItem>
                  <ZoruSelectItem value="achieved">Achieved</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              type="submit"
              disabled={isPending}
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Update KPI' : 'Create KPI'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default function KpiTrackingPage() {
  const { toast } = useZoruToast();
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
      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">Delete KPI?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="KPI Tracking"
          subtitle="Define and monitor key performance indicators for teams and employees."
          icon={LineChart}
          actions={
            <ZoruButton
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New KPI
            </ZoruButton>
          }
        />

        <ZoruCard className="p-6">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">KPI Name</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Employee</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Period</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Target</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Actual</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Achievement</th>
                  <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-3 text-right text-[12px] text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && kpis.length === 0 ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-zoru-line">
                      <td colSpan={8} className="px-4 py-3">
                        <ZoruSkeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : kpis.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No KPIs yet — click New KPI to get started.
                    </td>
                  </tr>
                ) : (
                  kpis.map((kpi) => (
                    <tr
                      key={String(kpi._id)}
                      className="border-b border-zoru-line last:border-0"
                    >
                      <td className="px-4 py-3 text-zoru-ink">
                        {kpi.kpi_name}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-zoru-ink-muted">
                        {kpi.employee_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-zoru-ink-muted">{kpi.period || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-zoru-ink">
                        {kpi.target_value}
                        <span className="ml-0.5 text-[11px] text-zoru-ink-muted">
                          {kpi.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zoru-ink">
                        {kpi.actual_value}
                        <span className="ml-0.5 text-[11px] text-zoru-ink-muted">
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
                        <ZoruBadge variant={STATUS_VARIANTS[kpi.status] ?? 'secondary'}>
                          {kpi.status}
                        </ZoruBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(kpi);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(String(kpi._id))}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </ZoruButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      </div>
    </>
  );
}
