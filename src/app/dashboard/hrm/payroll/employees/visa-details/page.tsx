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
  LoaderCircle,
  ExternalLink,
  Upload } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getVisaDetails,
  saveVisaDetail,
  deleteVisaDetail,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsVisaDetail } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = { _id: string; name: string };
type VisaRow = WsVisaDetail & { _id: string };

type FormState = {
  _id: string;
  user_id: string;
  country: string;
  visa_number: string;
  issue_date: string;
  expiry_date: string;
  file: string;
};

const EMPTY_FORM: FormState = { _id: '', user_id: '', country: '', visa_number: '', issue_date: '', expiry_date: '', file: '' };

function toDateInput(v: any): string {
  if (!v) return '';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
}

function fmtDate(v: any): string {
  if (!v) return '—';
  try { return format(new Date(v), 'dd MMM yyyy'); } catch { return '—'; }
}

function expiryVariant(v: any): 'success' | 'warning' | 'danger' | 'secondary' {
  if (!v) return 'secondary';
  try {
    const days = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
    if (days < 0) return 'danger';
    if (days < 90) return 'warning';
    return 'success';
  } catch { return 'secondary'; }
}

export default function VisaDetailsPage() {
  const { toast } = useZoruToast();
  const [visas, setVisas] = useState<VisaRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () => {
    startLoading(async () => {
      const [vs, es] = await Promise.all([getVisaDetails(), getCrmEmployees()]);
      setVisas(vs as VisaRow[]);
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
  const openEdit = (v: VisaRow) => {
    setForm({ _id: String(v._id), user_id: String(v.user_id), country: v.country, visa_number: v.visa_number ?? '', issue_date: toDateInput(v.issue_date), expiry_date: toDateInput(v.expiry_date), file: v.file ?? '' });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this visa record?')) return;
    const r = await deleteVisaDetail(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.user_id) { toast({ title: 'Select an employee', variant: 'destructive' }); return; }
    if (!form.country.trim()) { toast({ title: 'Country is required', variant: 'destructive' }); return; }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('country', form.country);
      fd.append('visa_number', form.visa_number);
      if (form.issue_date) fd.append('issue_date', form.issue_date);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      fd.append('file', form.file);
      const r = await saveVisaDetail(null, fd);
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
      title="Visa Details"
      subtitle="Track employee work visas and expiry dates."
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Visa
        </Button>
      }
    >

      <Card className="p-6">
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
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Country</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Visa #</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Issued</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">Expires</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">File</th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visas.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-[13px] text-zoru-ink-muted">No visa records found.</td></tr>
                ) : (
                  visas.map((v) => (
                    <tr key={String(v._id)} className="border-t border-zoru-line hover:bg-zoru-surface-2/50">
                      <td className="px-4 py-2.5 text-zoru-ink">{empMap.get(String(v.user_id)) || v.user_id}</td>
                      <td className="px-4 py-2.5 text-zoru-ink">{v.country}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-zoru-ink">{v.visa_number || '—'}</td>
                      <td className="px-4 py-2.5 text-zoru-ink-muted">{fmtDate(v.issue_date)}</td>
                      <td className="px-4 py-2.5">
                        {v.expiry_date ? (
                          <Badge variant={expiryVariant(v.expiry_date)}>{fmtDate(v.expiry_date)}</Badge>
                        ) : <span className="text-zoru-ink-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {v.file ? (
                          <a href={v.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-sky-500 hover:underline">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : <span className="text-zoru-ink-muted">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(String(v._id))}>
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
        <ZoruDialogContent className="max-w-lg border-zoru-line bg-zoru-bg">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">{form._id ? 'Edit Visa Details' : 'Add Visa Details'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="md:col-span-2">
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
              <Label className="text-[12px] text-zoru-ink-muted">Country <span className="text-zoru-danger-ink">*</span></Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. United States" className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Visa Number</Label>
              <Input value={form.visa_number} onChange={(e) => set('visa_number', e.target.value)} className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Issue Date</Label>
              <Input type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-zoru-ink-muted">Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[12px] text-zoru-ink-muted">File URL</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input type="url" value={form.file} onChange={(e) => set('file', e.target.value)} placeholder="https://…" className="h-10 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                <SabFilePickerButton
                  accept="document"
                  onPick={({ url }) => set('file', url)}
                >
                  <Upload className="h-4 w-4" /> Choose file
                </SabFilePickerButton>
              </div>
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
