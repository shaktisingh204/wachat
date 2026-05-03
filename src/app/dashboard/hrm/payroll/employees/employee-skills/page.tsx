'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Zap, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';
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
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getEmployeeSkills,
  saveEmployeeSkill,
  deleteEmployeeSkill,
  getSkills,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeSkill, WsSkill } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = { _id: string; name: string };
type SkillLite = { _id: string; name: string };
type AssignmentRow = WsEmployeeSkill & { _id: string };

type FormState = { _id: string; user_id: string; skill_id: string };
const EMPTY_FORM: FormState = { _id: '', user_id: '', skill_id: '' };

export default function EmployeeSkillsPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [skills, setSkills] = useState<SkillLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Filter state
  const [filterEmp, setFilterEmp] = useState('__all__');

  const load = () => {
    startLoading(async () => {
      const [as_, sk, es] = await Promise.all([getEmployeeSkills(), getSkills(), getCrmEmployees()]);
      setAssignments(as_ as AssignmentRow[]);
      setSkills((sk as WsSkill[]).map((s) => ({ _id: String(s._id), name: s.name })));
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

  const skillMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of skills) m.set(s._id, s.name);
    return m;
  }, [skills]);

  const filtered = useMemo(() =>
    filterEmp === '__all__' ? assignments : assignments.filter((a) => String(a.user_id) === filterEmp),
    [assignments, filterEmp]);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (a: AssignmentRow) => {
    setForm({ _id: String(a._id), user_id: String(a.user_id), skill_id: String(a.skill_id) });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this skill assignment?')) return;
    const r = await deleteEmployeeSkill(id);
    if (r.success) {
      toast({ title: 'Removed' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.user_id || !form.skill_id) {
      toast({ title: 'Select both employee and skill', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('skill_id', form.skill_id);
      const r = await saveEmployeeSkill(null, fd);
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
        title="Employee Skills"
        subtitle="Assign skills from the master list to employees."
        icon={Zap}
        actions={
          <ClayButton variant="obsidian" onClick={openAdd} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            Assign Skill
          </ClayButton>
        }
      />

      <ClayCard>
        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Label className="text-[12px] text-muted-foreground">Filter by Employee</Label>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="h-9 w-[220px] rounded-lg border-border bg-card text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Employees</SelectItem>
              {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[12px] text-muted-foreground">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Skill</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-[13px] text-muted-foreground">No skill assignments found.</td></tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={String(a._id)} className="border-t border-border hover:bg-secondary/50">
                      <td className="px-4 py-2.5 font-medium text-foreground">{empMap.get(String(a.user_id)) || a.user_id}</td>
                      <td className="px-4 py-2.5">
                        <ClayBadge tone="neutral">{skillMap.get(String(a.skill_id)) || a.skill_id}</ClayBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton variant="pill" size="sm" onClick={() => handleDelete(String(a._id))}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form._id ? 'Edit Skill Assignment' : 'Assign Skill to Employee'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-muted-foreground">Employee <span className="text-destructive">*</span></Label>
              <Select value={form.user_id || '__none__'} onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-border bg-card text-[13px]">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select employee —</SelectItem>
                  {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Skill <span className="text-destructive">*</span></Label>
              <Select value={form.skill_id || '__none__'} onValueChange={(v) => set('skill_id', v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-border bg-card text-[13px]">
                  <SelectValue placeholder="Select skill…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select skill —</SelectItem>
                  {skills.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setDialogOpen(false)}>Cancel</ClayButton>
            <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving}
              leading={isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : undefined}>
              {form._id ? 'Update' : 'Assign'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
