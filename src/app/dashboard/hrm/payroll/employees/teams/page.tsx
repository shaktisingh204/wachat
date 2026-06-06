'use client';

import { Card, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { Plus,
  Pencil,
  Trash2,
  LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell
      title="Employee Teams"
      subtitle="Define employee teams with designated leaders."
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Team
        </Button>
      }
    >

      <Card className="p-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Team Name</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Team Leader</th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-[var(--st-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-[13px] text-[var(--st-text-secondary)]">
                      No teams yet.
                    </td>
                  </tr>
                ) : (
                  teams.map((t) => (
                    <tr key={t._id} className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50">
                      <td className="px-4 py-2.5 text-[var(--st-text)]">{t.team_name}</td>
                      <td className="px-4 py-2.5 text-[var(--st-text-secondary)]">{empName(t.leader_user_id ?? '')}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t._id)} disabled={isSaving}>
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{form._id ? 'Edit Team' : 'Add Team'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">
                Team Name <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                value={form.team_name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, team_name: e.target.value }))}
                placeholder="e.g. Engineering Squad"
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">Team Leader</Label>
              <Select
                value={form.leader_user_id || undefined}
                onValueChange={(v) => setForm((p) => ({ ...p, leader_user_id: v }))}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {form._id ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
