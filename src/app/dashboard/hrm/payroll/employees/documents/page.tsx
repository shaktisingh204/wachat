'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ExternalLink, FileText, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  deleteEmployeeDocument,
  getEmployeeDocuments,
  saveEmployeeDocument,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeDocument } from '@/lib/worksuite/hr-ext-types';

type DocRow = WsEmployeeDocument & { _id: string };
type EmployeeLite = { _id: string; name: string };

type FormState = {
  _id: string;
  user_id: string;
  name: string;
  file: string;
  uploaded_at: string;
  expiry_date: string;
};

const EMPTY_FORM: FormState = {
  _id: '',
  user_id: '',
  name: '',
  file: '',
  uploaded_at: '',
  expiry_date: '',
};

function expiryTone(expiryDate?: Date | string): 'red' | 'amber' | 'green' {
  if (!expiryDate) return 'green';
  const exp = new Date(expiryDate);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  if (diffDays < 30) return 'amber';
  return 'green';
}

function expiryLabel(expiryDate?: Date | string): string {
  if (!expiryDate) return '—';
  const tone = expiryTone(expiryDate);
  const formatted = new Date(expiryDate).toLocaleDateString();
  if (tone === 'red') return `${formatted} (Expired)`;
  if (tone === 'amber') return `${formatted} (<30d)`;
  return formatted;
}

export default function EmployeeDocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () => {
    startLoading(async () => {
      const [ds, es] = await Promise.all([getEmployeeDocuments(), getCrmEmployees()]);
      setDocs(ds as DocRow[]);
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

  const openAdd = () => { setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (d: DocRow) => {
    setForm({
      _id: String(d._id),
      user_id: String(d.user_id),
      name: d.name,
      file: d.file ?? '',
      uploaded_at: d.uploaded_at ? new Date(d.uploaded_at).toISOString().slice(0, 10) : '',
      expiry_date: d.expiry_date ? new Date(d.expiry_date).toISOString().slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    const r = await deleteEmployeeDocument(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.user_id) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: 'Document name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('name', form.name);
      if (form.file) fd.append('file', form.file);
      if (form.uploaded_at) fd.append('uploaded_at', form.uploaded_at);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      const r = await saveEmployeeDocument(null, fd);
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
        title="Employee Documents"
        subtitle="Upload and track employee documents with expiry dates."
        icon={FileText}
        actions={
          <ClayButton
            variant="obsidian"
            onClick={openAdd}
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
          >
            Add Document
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
                    Employee
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">
                    Document
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">
                    Uploaded
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">
                    Expires
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">
                    File
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-muted-foreground">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  docs.map((d) => (
                    <tr
                      key={String(d._id)}
                      className="border-t border-border hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {empMap.get(String(d.user_id)) || d.user_id}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{d.name}</td>
                      <td className="px-4 py-2.5 text-foreground">
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.expiry_date ? (
                          <ClayBadge tone={expiryTone(d.expiry_date)} dot>
                            {expiryLabel(d.expiry_date)}
                          </ClayBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.file ? (
                          <a
                            href={d.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent-foreground hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton
                            variant="pill"
                            size="sm"
                            onClick={() => handleDelete(String(d._id))}
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
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {form._id ? 'Edit Document' : 'Add Document'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-muted-foreground">
                Employee <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.user_id || '__none__'}
                onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-border bg-card text-[13px]">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select employee —</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground">
                Document Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Passport, ID Card…"
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div>
              <Label className="text-[12px] text-muted-foreground">File URL</Label>
              <Input
                type="url"
                value={form.file}
                onChange={(e) => set('file', e.target.value)}
                placeholder="https://…"
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px] text-muted-foreground">Uploaded Date</Label>
                <Input
                  type="date"
                  value={form.uploaded_at}
                  onChange={(e) => set('uploaded_at', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[12px] text-muted-foreground">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
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
