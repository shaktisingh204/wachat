'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Label, Badge, Button, Card, useToast } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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

function expiryVariant(expiryDate?: Date | string): 'danger' | 'warning' | 'success' {
  if (!expiryDate) return 'success';
  const exp = new Date(expiryDate);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'danger';
  if (diffDays < 30) return 'warning';
  return 'success';
}

function expiryLabel(expiryDate?: Date | string): string {
  if (!expiryDate) return '—';
  const variant = expiryVariant(expiryDate);
  const formatted = new Date(expiryDate).toLocaleDateString();
  if (variant === 'danger') return `${formatted} (Expired)`;
  if (variant === 'warning') return `${formatted} (<30d)`;
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
    <EntityListShell
      title="Employee Documents"
      subtitle="Upload and track employee documents with expiry dates."
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Document
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
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">
                    Employee
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">
                    Document
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">
                    Uploaded
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">
                    Expires
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">
                    File
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-[var(--st-text-secondary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-[var(--st-text-secondary)]">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  docs.map((d) => (
                    <tr
                      key={String(d._id)}
                      className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50"
                    >
                      <td className="px-4 py-2.5 text-[var(--st-text)]">
                        {empMap.get(String(d.user_id)) || d.user_id}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--st-text)]">{d.name}</td>
                      <td className="px-4 py-2.5 text-[var(--st-text)]">
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.expiry_date ? (
                          <Badge variant={expiryVariant(d.expiry_date)}>
                            {expiryLabel(d.expiry_date)}
                          </Badge>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.file ? (
                          <a
                            href={d.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--st-text)] hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </a>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(String(d._id))}
                          >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-[var(--st-border)] bg-[var(--st-bg)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--st-text)]">
              {form._id ? 'Edit Document' : 'Add Document'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">
                Employee <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Select
                value={form.user_id || '__none__'}
                onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
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
              <Label className="text-[12px] text-[var(--st-text-secondary)]">
                Document Name <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Passport, ID Card…"
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
            </div>

            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">File URL</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  type="url"
                  value={form.file}
                  onChange={(e) => set('file', e.target.value)}
                  placeholder="https://…"
                  className="h-10 flex-1 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
                <SabFilePickerButton
                  accept="all"
                  onPick={({ url }) => set('file', url)}
                >
                  <Upload className="h-4 w-4" /> Choose file
                </SabFilePickerButton>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px] text-[var(--st-text-secondary)]">Uploaded Date</Label>
                <Input
                  type="date"
                  value={form.uploaded_at}
                  onChange={(e) => set('uploaded_at', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[12px] text-[var(--st-text-secondary)]">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {form._id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
