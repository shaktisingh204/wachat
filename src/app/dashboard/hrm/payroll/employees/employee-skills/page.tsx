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
  Label,
  Card,
  Button,
  Badge,
  useZoruToast,
} from '@/components/zoruui';
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
  const { toast } = useZoruToast();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [skills, setSkills] = useState<SkillLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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
    <EntityListShell
      title="Employee Skills"
      subtitle="Assign skills from the master list to employees."
      primaryAction={
        <ZoruButton onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Assign Skill
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ZoruLabel className="text-[12px] text-zoru-ink-muted">Filter by Employee</ZoruLabel>
          <ZoruSelect value={filterEmp} onValueChange={setFilterEmp}>
            <ZoruSelectTrigger className="h-9 w-[220px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="__all__">All Employees</ZoruSelectItem>
              {employees.map((e) => <ZoruSelectItem key={e._id} value={e._id}>{e.name}</ZoruSelectItem>)}
            </ZoruSelectContent>
          </ZoruSelect>
          <span className="text-[12px] text-zoru-ink-muted">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</span>
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
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Skill</th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-[13px] text-zoru-ink-muted">No skill assignments found.</td></tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={String(a._id)} className="border-t border-zoru-line hover:bg-zoru-surface-2/50">
                      <td className="px-4 py-2.5 text-zoru-ink">{empMap.get(String(a.user_id)) || a.user_id}</td>
                      <td className="px-4 py-2.5">
                        <ZoruBadge variant="secondary">{skillMap.get(String(a.skill_id)) || a.skill_id}</ZoruBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton variant="ghost" size="sm" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                          <ZoruButton variant="ghost" size="sm" onClick={() => handleDelete(String(a._id))}>
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
        )}
      </ZoruCard>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-md border-zoru-line bg-zoru-bg">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">{form._id ? 'Edit Skill Assignment' : 'Assign Skill to Employee'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Employee <span className="text-zoru-danger-ink">*</span></ZoruLabel>
              <ZoruSelect value={form.user_id || '__none__'} onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}>
                <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                  {employees.map((e) => <ZoruSelectItem key={e._id} value={e._id}>{e.name}</ZoruSelectItem>)}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Skill <span className="text-zoru-danger-ink">*</span></ZoruLabel>
              <ZoruSelect value={form.skill_id || '__none__'} onValueChange={(v) => set('skill_id', v === '__none__' ? '' : v)}>
                <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select skill…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— Select skill —</ZoruSelectItem>
                  {skills.map((s) => <ZoruSelectItem key={s._id} value={s._id}>{s.name}</ZoruSelectItem>)}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <ZoruDialogFooter className="gap-2">
            <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>Cancel</ZoruButton>
            <ZoruButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {form._id ? 'Update' : 'Assign'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </EntityListShell>
  );
}
