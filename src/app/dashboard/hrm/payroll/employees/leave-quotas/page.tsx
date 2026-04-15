'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getEmployeeLeaveQuotas,
  saveEmployeeLeaveQuota,
  deleteEmployeeLeaveQuota,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getLeaveTypes } from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeLeaveQuota } from '@/lib/worksuite/hr-ext-types';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; name: string };
type LeaveTypeLite = { _id: string; name: string };
type QuotaRow = WsEmployeeLeaveQuota & { _id: string };

type FormState = { _id: string; user_id: string; leave_type_id: string; no_of_leaves: string };
const EMPTY_FORM: FormState = { _id: '', user_id: '', leave_type_id: '', no_of_leaves: '' };

export default function EmployeeLeaveQuotasPage() {
  const { toast } = useToast();
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterEmp, setFilterEmp] = useState('__all__');

  const load = () => {
    startLoading(async () => {
      const [qs, lts, es] = await Promise.all([getEmployeeLeaveQuotas(), getLeaveTypes(), getCrmEmployees()]);
      setQuotas(qs as QuotaRow[]);
      setLeaveTypes((lts as WsLeaveType[]).map((lt) => ({ _id: String(lt._id), name: lt.type_name })));
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          name: [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.email || 'Unnamed',
        })),
      );
    });
  };

  useEffect(() => { load(); }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e._id, e.name);
    return m;
  }, [employees]);

  const ltMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const lt of leaveTypes) m.set(lt._id, lt.name);
    return m;
  }, [leaveTypes]);

  const filtered = useMemo(() =>
    filterEmp === '__all__' ? quotas : quotas.filter((q) => String(q.user_id) === filterEmp),
    [quotas, filterEmp]);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (q: QuotaRow) => {
    setForm({ _id: String(q._id), user_id: String(q.user_id), leave_type_id: String(q.leave_type_id), no_of_leaves: String(q.no_of_leaves) });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this leave quota?')) return;
    const r = await deleteEmployeeLeaveQuota(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.user_id || !form.leave_type_id) {
      toast({ title: 'Select employee and leave type', variant: 'destructive' });
      return;
    }
    if (!form.no_of_leaves || isNaN(Number(form.no_of_leaves))) {
      toast({ title: 'Enter a valid number of leaves', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('leave_type_id', form.leave_type_id);
      fd.append('no_of_leaves', form.no_of_leaves);
      const r = await saveEmployeeLeaveQuota(null, fd);
      if (r.message) {
        toast({ title: 'Saved' });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Quotas"
        subtitle="Allocate annual leave quotas per employee and leave type."
        icon={CalendarDays}
        actions={
          <ClayButton variant="obsidian" onClick={openAdd} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            Add Quota
          </ClayButton>
        }
      />

      <ClayCard>
        {/* Filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Label className="text-[12px] text-clay-ink-muted">Filter by Employee</Label>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="h-9 w-[220px] rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Employees</SelectItem>
              {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[12px] text-clay-ink-muted">{filtered.length} quota{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-clay-ink-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-clay-border bg-clay-surface-2">
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Leave Type</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Quota (days)</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-[13px] text-clay-ink-muted">No leave quotas found.</td></tr>
                ) : (
                  filtered.map((q) => (
                    <tr key={String(q._id)} className="border-t border-clay-border hover:bg-clay-surface-2/50">
                      <td className="px-4 py-2.5 font-medium text-clay-ink">{empMap.get(String(q.user_id)) || q.user_id}</td>
                      <td className="px-4 py-2.5 text-clay-ink">{ltMap.get(String(q.leave_type_id)) || q.leave_type_id}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-clay-sm bg-clay-surface-2 px-2 text-[13px] font-semibold text-clay-ink">
                          {q.no_of_leaves}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(q)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton variant="pill" size="sm" onClick={() => handleDelete(String(q._id))}>
                            <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                          </ClayButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-clay-border bg-clay-surface">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">{form._id ? 'Edit Leave Quota' : 'Add Leave Quota'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-clay-ink-muted">Employee <span className="text-clay-red">*</span></Label>
              <Select value={form.user_id || '__none__'} onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select employee —</SelectItem>
                  {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-clay-ink-muted">Leave Type <span className="text-clay-red">*</span></Label>
              <Select value={form.leave_type_id || '__none__'} onValueChange={(v) => set('leave_type_id', v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="Select leave type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select leave type —</SelectItem>
                  {leaveTypes.map((lt) => <SelectItem key={lt._id} value={lt._id}>{lt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-clay-ink-muted">Number of Leaves <span className="text-clay-red">*</span></Label>
              <Input type="number" min="0" value={form.no_of_leaves} onChange={(e) => set('no_of_leaves', e.target.value)} className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setDialogOpen(false)}>Cancel</ClayButton>
            <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving}
              leading={isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : undefined}>
              {form._id ? 'Update' : 'Add'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
