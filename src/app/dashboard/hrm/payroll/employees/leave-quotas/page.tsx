'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Input,
  Label,
  Card,
  Button,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { Plus,
  Pencil,
  Trash2,
  LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Leave Quotas"
      subtitle="Allocate annual leave quotas per employee and leave type."
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Quota
        </Button>
      }
    >

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Label className="text-[12px] text-zoru-ink-muted">Filter by Employee</Label>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <ZoruSelectTrigger className="h-9 w-[220px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="__all__">All Employees</ZoruSelectItem>
              {employees.map((e) => <ZoruSelectItem key={e._id} value={e._id}>{e.name}</ZoruSelectItem>)}
            </ZoruSelectContent>
          </Select>
          <span className="text-[12px] text-zoru-ink-muted">{filtered.length} quota{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Leave Type</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Quota (days)</th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-[13px] text-zoru-ink-muted">No leave quotas found.</td></tr>
                ) : (
                  filtered.map((q) => (
                    <tr key={String(q._id)} className="border-t border-zoru-line hover:bg-zoru-surface-2/50">
                      <td className="px-4 py-2.5 text-zoru-ink">{empMap.get(String(q.user_id)) || q.user_id}</td>
                      <td className="px-4 py-2.5 text-zoru-ink">{ltMap.get(String(q.leave_type_id)) || q.leave_type_id}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-zoru-surface-2 px-2 text-[13px] text-zoru-ink">
                          {q.no_of_leaves}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(String(q._id))}>
                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-md border-zoru-line bg-zoru-bg">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">{form._id ? 'Edit Leave Quota' : 'Add Leave Quota'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Employee <span className="text-zoru-danger-ink">*</span></Label>
              <Select value={form.user_id || '__none__'} onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}>
                <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                  {employees.map((e) => <ZoruSelectItem key={e._id} value={e._id}>{e.name}</ZoruSelectItem>)}
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Leave Type <span className="text-zoru-danger-ink">*</span></Label>
              <Select value={form.leave_type_id || '__none__'} onValueChange={(v) => set('leave_type_id', v === '__none__' ? '' : v)}>
                <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select leave type…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— Select leave type —</ZoruSelectItem>
                  {leaveTypes.map((lt) => <ZoruSelectItem key={lt._id} value={lt._id}>{lt.name}</ZoruSelectItem>)}
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Number of Leaves <span className="text-zoru-danger-ink">*</span></Label>
              <Input type="number" min="0" value={form.no_of_leaves} onChange={(e) => set('no_of_leaves', e.target.value)} className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
            </div>
          </div>
          <ZoruDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {form._id ? 'Update' : 'Add'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
