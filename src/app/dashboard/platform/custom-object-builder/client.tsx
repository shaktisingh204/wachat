'use client';

import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, useZoruToast } from '@/components/zoruui';
import { createCustomObject, deleteCustomObject, getCustomObjects } from '@/app/actions/platform/custom-object-builder.actions';
import type { CustomObjectDefinition } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, Database } from 'lucide-react';

export function CustomObjectClient({ initialData }: { initialData: CustomObjectDefinition[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  const { data: objects = initialData, mutate } = useSWR<CustomObjectDefinition[]>('custom-objects', getCustomObjects, {
    fallbackData: initialData,
  });

  const [form, setForm] = useState({ singularName: '', pluralName: '', apiIdentifier: '', fields: '' });

  const handleCreate = async () => {
    if (!form.singularName || !form.apiIdentifier) return;
    startTransition(async () => {
      try {
        await createCustomObject({
          ...form,
          fields: form.fields.split(',').map(f => ({ name: f.trim(), type: 'string', required: false })).filter(f => f.name)
        });
        toast({ title: 'Custom object created', variant: 'success' });
        setDialogOpen(false);
        setForm({ singularName: '', pluralName: '', apiIdentifier: '', fields: '' });
        await mutate();
      } catch (err) {
        toast({ title: 'Error creating custom object', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startTransition(async () => {
      try {
        await deleteCustomObject(id);
        toast({ title: 'Custom object deleted', variant: 'success' });
        await mutate();
      } catch (err) {
        toast({ title: 'Error deleting custom object', variant: 'destructive' });
      }
    });
  };

  const filteredData = objects.filter(d => d.pluralName.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Custom Objects"
      subtitle="Define robust custom data models tailored to your business."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Object</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search custom objects...' }}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredData.map(item => (
          <Card key={item.id} className="p-6 flex flex-col justify-between hover:border-zoru-accent transition-all group">
            <div>
              <div className="w-12 h-12 bg-zoru-accent/10 rounded-xl flex items-center justify-center mb-4 text-zoru-accent">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-xl text-zoru-ink">{item.pluralName}</h3>
              <p className="text-sm font-mono text-zoru-ink-light mt-1">{item.apiIdentifier}</p>
              <div className="mt-4">
                <p className="text-xs text-zoru-ink-light uppercase font-semibold mb-2">Fields</p>
                <div className="flex flex-wrap gap-1">
                  {item.fields.map(f => (
                    <span key={f.name} className="px-2 py-1 bg-zoru-neutral-hover rounded text-xs text-zoru-ink">{f.name}</span>
                  ))}
                  {item.fields.length === 0 && <span className="text-xs text-zoru-ink-light italic">No custom fields</span>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" disabled={isPending}>
                <Trash2 className="w-4 h-4 text-zoru-ink" />
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 text-center text-zoru-ink-light">No custom objects found.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Custom Object</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Singular Name</Label>
                <Input value={form.singularName} onChange={e => setForm({ ...form, singularName: e.target.value, apiIdentifier: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="e.g. Property" disabled={isPending} />
              </div>
              <div className="grid gap-2">
                <Label>Plural Name</Label>
                <Input value={form.pluralName} onChange={e => setForm({ ...form, pluralName: e.target.value })} placeholder="e.g. Properties" disabled={isPending} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>API Identifier</Label>
              <Input value={form.apiIdentifier} onChange={e => setForm({ ...form, apiIdentifier: e.target.value })} className="font-mono" disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label>Initial Fields (comma separated)</Label>
              <Input value={form.fields} onChange={e => setForm({ ...form, fields: e.target.value })} placeholder="Address, Price, Status" disabled={isPending} />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} Create
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
