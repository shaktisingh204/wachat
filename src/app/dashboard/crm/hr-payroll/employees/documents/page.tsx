'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruInput,
  ZoruLabel,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { ExternalLink,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
  const { toast } = useZoruToast();
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
          <ZoruButton onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Document
          </ZoruButton>
        }
      />

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
                    Employee
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                    Document
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                    Uploaded
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                    Expires
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                    File
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-zoru-ink-muted">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  docs.map((d) => (
                    <tr
                      key={String(d._id)}
                      className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                    >
                      <td className="px-4 py-2.5 text-zoru-ink">
                        {empMap.get(String(d.user_id)) || d.user_id}
                      </td>
                      <td className="px-4 py-2.5 text-zoru-ink">{d.name}</td>
                      <td className="px-4 py-2.5 text-zoru-ink">
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.expiry_date ? (
                          <ZoruBadge variant={expiryVariant(d.expiry_date)}>
                            {expiryLabel(d.expiry_date)}
                          </ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.file ? (
                          <a
                            href={d.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-zoru-ink hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </a>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton variant="ghost" size="sm" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(String(d._id))}
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
        <ZoruDialogContent className="max-w-md border-zoru-line bg-zoru-bg">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {form._id ? 'Edit Document' : 'Add Document'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Employee <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruSelect
                value={form.user_id || '__none__'}
                onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}
              >
                <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id} value={e._id}>
                      {e.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Document Name <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Passport, ID Card…"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">File URL</ZoruLabel>
              <div className="mt-1.5 flex items-center gap-2">
                <ZoruInput
                  type="url"
                  value={form.file}
                  onChange={(e) => set('file', e.target.value)}
                  placeholder="https://…"
                  className="h-10 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
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
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Uploaded Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={form.uploaded_at}
                  onChange={(e) => set('uploaded_at', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Expiry Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
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
    </div>
  );
}
