'use client';

import { useEffect, useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, useZoruToast, ZoruSelect, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
import { getRedactionPolicies, createRedactionPolicy, deleteRedactionPolicy } from '@/app/actions/platform/data-redaction.actions';
import type { RedactionPolicy } from '@/types/platform';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

export default function DataRedactionPage() {
  const [data, setData] = useState<RedactionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const [form, setForm] = useState({ name: '', targetFields: '', maskPattern: '***', status: 'active' });

  const loadData = async () => {
    setLoading(true);
    const res = await getRedactionPolicies();
    setData(res);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        await createRedactionPolicy({
          ...form,
          targetFields: form.targetFields.split(',').map(f => f.trim()).filter(Boolean)
        });
        toast({ title: 'Policy created', variant: 'success' });
        setDialogOpen(false);
        setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' });
        loadData();
      } catch (err) {
        toast({ title: 'Error creating policy', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteRedactionPolicy(id);
      toast({ title: 'Policy deleted', variant: 'success' });
      loadData();
    } catch (err) {
      toast({ title: 'Error deleting policy', variant: 'destructive' });
    }
  };

  const filteredData = data.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Data Redaction Policies"
      subtitle="Automatically mask sensitive fields across the platform."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Policy</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search policies...' }}
      loading={loading}
    >
      <Card className="border-zoru-line bg-zoru-bg overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Target Fields</ZoruTableHead>
              <ZoruTableHead>Mask Pattern</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="font-medium">{item.name}</ZoruTableCell>
                <ZoruTableCell className="font-mono text-sm">{item.targetFields.join(', ')}</ZoruTableCell>
                <ZoruTableCell>{item.maskPattern}</ZoruTableCell>
                <ZoruTableCell>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-zoru-neutral-hover text-zoru-ink'}`}>
                    {item.status}
                  </span>
                </ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
            {filteredData.length === 0 && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="text-center py-8 text-zoru-ink-light">No redaction policies found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Redaction Policy</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Policy Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mask SSN" />
            </div>
            <div className="grid gap-2">
              <Label>Target Fields (comma separated JSON keys)</Label>
              <Input value={form.targetFields} onChange={e => setForm({ ...form, targetFields: e.target.value })} placeholder="ssn, social_security" />
            </div>
            <div className="grid gap-2">
              <Label>Mask Pattern</Label>
              <Input value={form.maskPattern} onChange={e => setForm({ ...form, maskPattern: e.target.value })} placeholder="***-**-****" />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <ZoruSelect value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select status" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="active">Active</ZoruSelectItem>
                  <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} Create
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
