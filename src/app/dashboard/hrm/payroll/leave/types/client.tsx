'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition 
} from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeaveTypes,
  saveLeaveType,
  deleteLeaveType,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';

type FormValues = {
  _id?: string;
  type_name: string;
  no_of_leaves: number;
  color: string;
  monthly_limit: number;
  paid: string;
  leave_unit: string;
  status: string;
  accrual_enabled: string;
  accrual_rate: number;
  accrual_frequency: string;
};

export default function LeaveTypesClient({
  initialTypes,
}: {
  initialTypes: (WsLeaveType & { _id: string })[];
}) {
  const { toast } = useZoruToast();
  const [types, setTypes] = useState<(WsLeaveType & { _id: string })[]>(initialTypes);
  const [isLoadingList, startLoadList] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isSaving, startSave] = useTransition();

  // dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(WsLeaveType & { _id: string }) | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);

  const { register, handleSubmit, control, reset, watch } = useForm<FormValues>({
    defaultValues: {
      type_name: '',
      no_of_leaves: 0,
      color: '#EAB308',
      monthly_limit: 0,
      paid: 'true',
      leave_unit: 'days',
      status: 'active',
      accrual_enabled: 'false',
      accrual_rate: 0,
      accrual_frequency: 'monthly',
    },
  });

  const loadTypes = () => {
    startLoadList(async () => {
      const ts = await getLeaveTypes();
      setTypes(ts as (WsLeaveType & { _id: string })[]);
    });
  };

  // Initialization via props

  const onSubmit = (data: FormValues) => {
    const fd = new globalThis.FormData();
    if (data._id) fd.append('_id', data._id);
    fd.append('type_name', data.type_name);
    fd.append('no_of_leaves', String(data.no_of_leaves));
    fd.append('color', data.color);
    fd.append('monthly_limit', String(data.monthly_limit));
    fd.append('paid', data.paid);
    fd.append('leave_unit', data.leave_unit);
    fd.append('status', data.status);
    fd.append('accrual_enabled', data.accrual_enabled);
    fd.append('accrual_rate', String(data.accrual_rate));
    fd.append('accrual_frequency', data.accrual_frequency);

    startSave(async () => {
      const res = await saveLeaveType(undefined, fd);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else if (res.message) {
        toast({ title: 'Saved', description: res.message });
        setOpen(false);
        loadTypes();
      }
    });
  };

  const openNew = () => {
    setEditing(null);
    reset({
      _id: undefined,
      type_name: '',
      no_of_leaves: 0,
      color: '#EAB308',
      monthly_limit: 0,
      paid: 'true',
      leave_unit: 'days',
      status: 'active',
      accrual_enabled: 'false',
      accrual_rate: 0,
      accrual_frequency: 'monthly',
    });
    setOpen(true);
  };

  const openEdit = (t: WsLeaveType & { _id: string }) => {
    setEditing(t);
    reset({
      _id: t._id,
      type_name: t.type_name,
      no_of_leaves: t.no_of_leaves,
      color: t.color || '#EAB308',
      monthly_limit: t.monthly_limit,
      paid: t.paid ? 'true' : 'false',
      leave_unit: t.leave_unit,
      status: t.status,
      accrual_enabled: t.accrual_enabled ? 'true' : 'false',
      accrual_rate: t.accrual_rate || 0,
      accrual_frequency: t.accrual_frequency || 'monthly',
    });
    setOpen(true);
  };

  const confirmDeleteType = () => {
    if (!typeToDelete) return;
    startDelete(async () => {
      const r = await deleteLeaveType(typeToDelete);
      if (r.success) {
        toast({ title: 'Deleted' });
        setTypeToDelete(null);
        loadTypes();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <EntityListShell
      title="Leave Types"
      subtitle="Define leave categories with annual quota, color, monthly cap, and paid status."
      primaryAction={
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Leave Type
        </Button>
      }
    >

      <Card className="p-6">
        {isLoadingList && types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">Loading…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            No leave types yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line">
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Type</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Per Year</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Monthly Cap</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Unit</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Paid</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-zoru-ink-muted">Accrual</th>
                  <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t._id} className="border-b border-zoru-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        <span className="font-medium text-zoru-ink">{t.type_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zoru-ink">{t.no_of_leaves}</td>
                    <td className="px-4 py-3 text-zoru-ink">{t.monthly_limit}</td>
                    <td className="px-4 py-3 text-zoru-ink capitalize">{t.leave_unit}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.paid ? 'success' : 'warning'}>
                        {t.paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === 'active' ? 'success' : 'warning'}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {t.accrual_enabled ? (
                        <span className="text-[12px] text-zoru-ink-muted">
                          Earn {t.accrual_rate} {t.leave_unit} per {t.accrual_frequency ? t.accrual_frequency.replace('ly', '') : 'month'}
                        </span>
                      ) : (
                        <span className="text-[12px] text-zoru-ink-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Edit
                        </Button>
                        <ZoruAlertDialog>
                          <ZoruAlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTypeToDelete(t._id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />
                              Delete
                            </Button>
                          </ZoruAlertDialogTrigger>
                          <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                              <ZoruAlertDialogTitle>Delete Leave Type</ZoruAlertDialogTitle>
                              <ZoruAlertDialogDescription>
                                Are you sure you want to delete this leave type? This action cannot be undone.
                              </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                              <ZoruAlertDialogCancel onClick={() => setTypeToDelete(null)}>Cancel</ZoruAlertDialogCancel>
                              <ZoruAlertDialogAction destructive onClick={confirmDeleteType} disabled={isDeleting}>
                                Delete
                              </ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                          </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-zoru-ink">
                {editing ? 'Edit Leave Type' : 'Add Leave Type'}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-zoru-ink">Type Name *</Label>
                <Input
                  {...register('type_name')}
                  required
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <Label className="text-zoru-ink">Leaves Per Year</Label>
                <Input
                  {...register('no_of_leaves')}
                  type="number"
                  step="0.5"
                  min="0"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <Label className="text-zoru-ink">Monthly Limit</Label>
                <Input
                  {...register('monthly_limit')}
                  type="number"
                  step="0.5"
                  min="0"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <Label className="text-zoru-ink">Color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    {...register('color')}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-zoru-line bg-zoru-bg p-1"
                  />
                  <span className="text-[13px] text-zoru-ink-muted">{watch('color')}</span>
                </div>
              </div>

              <div>
                <Label className="text-zoru-ink">Leave Unit</Label>
                <Controller
                  control={control}
                  name="leave_unit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="days">Days</ZoruSelectItem>
                        <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                        <ZoruSelectItem value="half-days">Half Days</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label className="text-zoru-ink">Paid</Label>
                <Controller
                  control={control}
                  name="paid"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label className="text-zoru-ink">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="active">Active</ZoruSelectItem>
                        <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="md:col-span-2 mt-2 border-t border-zoru-line pt-4">
                <h3 className="text-[14px] font-medium text-zoru-ink mb-3">Accrual Rules</h3>
              </div>

              <div>
                <Label className="text-zoru-ink">Enable Accrual</Label>
                <Controller
                  control={control}
                  name="accrual_enabled"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  )}
                />
              </div>

              {watch('accrual_enabled') === 'true' && (
                <>
                  <div>
                    <Label className="text-zoru-ink">Accrual Rate</Label>
                    <Input
                      {...register('accrual_rate')}
                      type="number"
                      step="0.1"
                      min="0"
                      className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                    />
                  </div>

                  <div>
                    <Label className="text-zoru-ink">Frequency</Label>
                    <Controller
                      control={control}
                      name="accrual_frequency"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                            <ZoruSelectValue />
                          </ZoruSelectTrigger>
                          <ZoruSelectContent>
                            <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                            <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                            <ZoruSelectItem value="yearly">Yearly</ZoruSelectItem>
                          </ZoruSelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  
                  <div className="md:col-span-2 rounded-lg bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink-muted">
                    Preview: Earn <strong className="text-zoru-ink">{watch('accrual_rate') || 0}</strong> {watch('leave_unit')} per {watch('accrual_frequency')?.replace('ly', '') || 'month'}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 md:col-span-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </EntityListShell>
  );
}
