'use client';

import { useEffect, useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, useZoruToast, ZoruSelect, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
import { getOrganizations, createOrganization, deleteOrganization } from '@/app/actions/platform/org-switcher.actions';
import type { Organization } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, Building } from 'lucide-react';

export default function OrgSwitcherPage() {
  const [data, setData] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const [form, setForm] = useState({ name: '', slug: '', role: 'owner', active: true });

  const loadData = async () => {
    setLoading(true);
    const res = await getOrganizations();
    setData(res);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.slug) return;
    startTransition(async () => {
      try {
        await createOrganization(form);
        toast({ title: 'Organization created', variant: 'success' });
        setDialogOpen(false);
        setForm({ name: '', slug: '', role: 'owner', active: true });
        loadData();
      } catch (err) {
        toast({ title: 'Error creating organization', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteOrganization(id);
      toast({ title: 'Organization deleted', variant: 'success' });
      loadData();
    } catch (err) {
      toast({ title: 'Error deleting organization', variant: 'destructive' });
    }
  };

  const filteredData = data.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Organizations"
      subtitle="Manage your organizations and workspaces."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Organization</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search orgs...' }}
      loading={loading}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredData.map(item => (
          <Card key={item.id} className="p-6 flex flex-col justify-between hover:border-zoru-accent transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-zoru-neutral-hover flex items-center justify-center">
                  <Building className="w-5 h-5 text-zoru-ink" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zoru-ink">{item.name}</h3>
                  <p className="text-sm text-zoru-ink-light">@{item.slug}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-zoru-line pt-4">
              <span className="text-sm font-medium capitalize px-2 py-1 bg-zoru-bg border border-zoru-line rounded-md">{item.role}</span>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 text-center text-zoru-ink-light">No organizations found.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Organization</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Organization Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Your Role</Label>
              <ZoruSelect value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select role" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="owner">Owner</ZoruSelectItem>
                  <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                  <ZoruSelectItem value="member">Member</ZoruSelectItem>
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
