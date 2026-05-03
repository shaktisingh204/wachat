'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Plane, Plus, Pencil, Trash2, LoaderCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
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

function expiryTone(v: any): 'green' | 'amber' | 'red' | 'neutral' {
  if (!v) return 'neutral';
  try {
    const days = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
    if (days < 0) return 'red';
    if (days < 90) return 'amber';
    return 'green';
  } catch { return 'neutral'; }
}

export default function VisaDetailsPage() {
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Visa Details"
        subtitle="Track employee work visas and expiry dates."
        icon={Plane}
        actions={
          <ClayButton variant="obsidian" onClick={openAdd} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            Add Visa
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
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Country</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Visa #</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Issued</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Expires</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">File</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visas.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-[13px] text-muted-foreground">No visa records found.</td></tr>
                ) : (
                  visas.map((v) => (
                    <tr key={String(v._id)} className="border-t border-border hover:bg-secondary/50">
                      <td className="px-4 py-2.5 font-medium text-foreground">{empMap.get(String(v.user_id)) || v.user_id}</td>
                      <td className="px-4 py-2.5 text-foreground">{v.country}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-foreground">{v.visa_number || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(v.issue_date)}</td>
                      <td className="px-4 py-2.5">
                        {v.expiry_date ? (
                          <ClayBadge tone={expiryTone(v.expiry_date)}>{fmtDate(v.expiry_date)}</ClayBadge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {v.file ? (
                          <a href={v.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-sky-500 hover:underline">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="pill" size="sm" onClick={() => openEdit(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ClayButton>
                          <ClayButton variant="pill" size="sm" onClick={() => handleDelete(String(v._id))}>
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
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form._id ? 'Edit Visa Details' : 'Add Visa Details'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="md:col-span-2">
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
              <Label className="text-[12px] text-muted-foreground">Country <span className="text-destructive">*</span></Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. United States" className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Visa Number</Label>
              <Input value={form.visa_number} onChange={(e) => set('visa_number', e.target.value)} className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Issue Date</Label>
              <Input type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[12px] text-muted-foreground">File URL</Label>
              <Input type="url" value={form.file} onChange={(e) => set('file', e.target.value)} placeholder="https://…" className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setDialogOpen(false)}>Cancel</ClayButton>
            <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving}
              leading={isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : undefined}>
              {form._id ? 'Update' : 'Add'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
