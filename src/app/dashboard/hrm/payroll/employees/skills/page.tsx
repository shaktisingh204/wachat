'use client';

import { useEffect, useState, useTransition } from 'react';
import { LoaderCircle, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  deleteSkill,
  getSkills,
  saveSkill,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsSkill } from '@/lib/worksuite/hr-ext-types';

type SkillRow = WsSkill & { _id: string };
type FormState = { _id: string; name: string };
const EMPTY_FORM: FormState = { _id: '', name: '' };

export default function SkillsMasterPage() {
  const { toast } = useToast();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () => {
    startLoading(async () => {
      const data = await getSkills();
      setSkills(data as SkillRow[]);
    });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (s: SkillRow) => {
    setForm({ _id: String(s._id), name: s.name });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    const r = await deleteSkill(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'Skill name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('name', form.name.trim());
      const r = await saveSkill(null, fd);
      if (r.message) {
        toast({ title: 'Saved' });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Skills Master"
        subtitle={`Manage the master list of skills used across the organisation.${!isLoading && skills.length > 0 ? `  ${skills.length} skill${skills.length !== 1 ? 's' : ''} defined.` : ''}`}
        icon={Sparkles}
        actions={
          <ClayButton
            variant="obsidian"
            onClick={openAdd}
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          >
            Add Skill
          </ClayButton>
        }
      />

      <ClayCard>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">
                    Skill Name
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {skills.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-10 text-center text-[13px] text-muted-foreground">
                      No skills defined yet.
                    </td>
                  </tr>
                ) : (
                  skills.map((s) => (
                    <tr
                      key={String(s._id)}
                      className="border-t border-border hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton
                            variant="pill"
                            size="sm"
                            onClick={() => handleDelete(String(s._id))}
                          >
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
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {form._id ? 'Edit Skill' : 'Add Skill'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <Label className="text-[12px] text-muted-foreground">
              Skill Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder="e.g. JavaScript, Project Management…"
              className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setDialogOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              onClick={handleSave}
              disabled={isSaving}
              leading={
                isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : undefined
              }
            >
              {form._id ? 'Update' : 'Add'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
