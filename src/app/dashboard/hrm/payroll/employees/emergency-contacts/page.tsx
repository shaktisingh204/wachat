'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Label, Textarea, Card, Button, useToast } from '@/components/sabcrm/20ui';
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
  getEmergencyContacts,
  saveEmergencyContact,
  deleteEmergencyContact,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmergencyContact } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = { _id: string; name: string };
type ContactRow = WsEmergencyContact & { _id: string };

type FormState = {
  _id: string;
  user_id: string;
  name: string;
  relation: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = { _id: '', user_id: '', name: '', relation: '', phone: '', address: '' };

export default function EmergencyContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () => {
    startLoading(async () => {
      const [cs, es] = await Promise.all([getEmergencyContacts(), getCrmEmployees()]);
      setContacts(cs as ContactRow[]);
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
  const openEdit = (c: ContactRow) => {
    setForm({ _id: String(c._id), user_id: String(c.user_id), name: c.name, relation: c.relation ?? '', phone: c.phone ?? '', address: c.address ?? '' });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this emergency contact?')) return;
    const r = await deleteEmergencyContact(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleSave = () => {
    if (!form.user_id) { toast({ title: 'Select an employee', variant: 'destructive' }); return; }
    if (!form.name.trim()) { toast({ title: 'Contact name is required', variant: 'destructive' }); return; }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('name', form.name);
      fd.append('relation', form.relation);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      const r = await saveEmergencyContact(null, fd);
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
      title="Emergency Contacts"
      subtitle="Emergency contact details for each employee."
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Contact
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
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Name</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Relation</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Phone</th>
                  <th className="px-4 py-2.5 text-left text-[12px] text-[var(--st-text-secondary)]">Address</th>
                  <th className="px-4 py-2.5 text-right text-[12px] text-[var(--st-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[var(--st-text-secondary)]">No emergency contacts found.</td></tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={String(c._id)} className="border-t border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50">
                      <td className="px-4 py-2.5 text-[var(--st-text)]">{empMap.get(String(c.user_id)) || c.user_id}</td>
                      <td className="px-4 py-2.5 text-[var(--st-text)]">{c.name}</td>
                      <td className="px-4 py-2.5 text-[var(--st-text-secondary)]">{c.relation || '—'}</td>
                      <td className="px-4 py-2.5 text-[var(--st-text)]">{c.phone || '—'}</td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-[var(--st-text-secondary)]">{c.address || '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(String(c._id))}>
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
        <DialogContent className="max-w-lg border-[var(--st-border)] bg-[var(--st-bg)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--st-text)]">{form._id ? 'Edit Emergency Contact' : 'Add Emergency Contact'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">Employee <span className="text-[var(--st-danger)]">*</span></Label>
              <Select value={form.user_id || '__none__'} onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select employee —</SelectItem>
                  {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-[12px] text-[var(--st-text-secondary)]">Contact Name <span className="text-[var(--st-danger)]">*</span></Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]" />
              </div>
              <div>
                <Label className="text-[12px] text-[var(--st-text-secondary)]">Relation</Label>
                <Input value={form.relation} onChange={(e) => set('relation', e.target.value)} placeholder="e.g. Spouse, Parent" className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]" />
              </div>
              <div>
                <Label className="text-[12px] text-[var(--st-text-secondary)]">Phone</Label>
                <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]" />
              </div>
            </div>
            <div>
              <Label className="text-[12px] text-[var(--st-text-secondary)]">Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className="mt-1.5 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
