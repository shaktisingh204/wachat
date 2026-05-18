'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruButton,
  ZoruCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { LoaderCircle,
  Pencil,
  Plus,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Skills Master"
      subtitle={`Manage the master list of skills used across the organisation.${!isLoading && skills.length > 0 ? `  ${skills.length} skill${skills.length !== 1 ? 's' : ''} defined.` : ''}`}
      primaryAction={
        <ZoruButton onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Skill
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                    Skill Name
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {skills.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-10 text-center text-[13px] text-zoru-ink-muted">
                      No skills defined yet.
                    </td>
                  </tr>
                ) : (
                  skills.map((s) => (
                    <tr
                      key={String(s._id)}
                      className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                    >
                      <td className="px-4 py-2.5 text-zoru-ink">{s.name}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton variant="ghost" size="sm" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(String(s._id))}
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
        )}
      </ZoruCard>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-sm border-zoru-line bg-zoru-bg">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {form._id ? 'Edit Skill' : 'Add Skill'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="py-2">
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">
              Skill Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder="e.g. JavaScript, Project Management…"
              className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              autoFocus
            />
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {form._id ? 'Update' : 'Add'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </EntityListShell>
  );
}
