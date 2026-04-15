'use client';

import { useEffect, useState, useTransition } from 'react';
import { Users2, Plus, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getEmployeeTeams,
  saveEmployeeTeam,
  deleteEmployeeTeam,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeTeam } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };
type TeamRow = WsEmployeeTeam & { _id: string };

const EMPTY: Partial<TeamRow> = { team_name: '', leader_user_id: '' };

export default function EmployeeTeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<TeamRow>>(EMPTY);

  const load = () => {
    startLoad(async () => {
      const [rows, emps] = await Promise.all([
        getEmployeeTeams(),
        getCrmEmployees(),
      ]);
      setTeams(rows as TeamRow[]);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
    });
  };

  useEffect(load, []);

  const empName = (id: string) => {
    const e = employees.find((x) => x._id === id);
    if (!e) return id || '—';
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed';
  };

  const openAdd = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (t: TeamRow) => { setForm({ ...t }); setOpen(true); };

  const handleSave = () => {
    if (!form.team_name?.trim()) {
      toast({ title: 'Team name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('team_name', form.team_name ?? '');
      fd.append('leader_user_id', form.leader_user_id ?? '');
      const res = await saveEmployeeTeam(null, fd);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: form._id ? 'Updated' : 'Created' });
      setOpen(false);
      load();
    });
  };

  const handleDelete = (id: string) => {
    startSave(async () => {
      await deleteEmployeeTeam(id);
      toast({ title: 'Deleted' });
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employee Teams"
        subtitle="Define employee teams with designated leaders."
        icon={Users2}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={openAdd}
          >
            Add Team
          </ClayButton>
        }
      />

      <ClayCard>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-clay-ink-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-clay-border bg-clay-surface-2">
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Team Name</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Team Leader</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-[13px] text-clay-ink-muted">
                      No teams yet.
                    </td>
                  </tr>
                ) : (
                  teams.map((t) => (
                    <tr key={t._id} className="border-t border-clay-border hover:bg-clay-surface-2/50">
                      <td className="px-4 py-2.5 font-medium text-clay-ink">{t.team_name}</td>
                      <td className="px-4 py-2.5 text-clay-ink-muted">{empName(t.leader_user_id ?? '')}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton variant="pill" size="sm" onClick={() => handleDelete(t._id)} disabled={isSaving}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{form._id ? 'Edit Team' : 'Add Team'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-clay-ink-muted">
                Team Name <span className="text-clay-red">*</span>
              </Label>
              <Input
                value={form.team_name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, team_name: e.target.value }))}
                placeholder="e.g. Engineering Squad"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[12px] text-clay-ink-muted">Team Leader</Label>
              <Select
                value={form.leader_user_id ?? ''}
                onValueChange={(v) => setForm((p) => ({ ...p, leader_user_id: v }))}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <ClayButton variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
            <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : form._id ? 'Save' : 'Create'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
