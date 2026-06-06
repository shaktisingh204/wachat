'use client';

import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  Badge,
  EmptyState,
  Field,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { createCustomObject, deleteCustomObject, getCustomObjects } from '@/app/actions/platform/custom-object-builder.actions';
import type { CustomObjectDefinition } from '@/types/platform';
import { Plus, Trash2, Database } from 'lucide-react';

export function CustomObjectClient({ initialData }: { initialData: CustomObjectDefinition[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
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
        toast.success('Custom object created');
        setDialogOpen(false);
        setForm({ singularName: '', pluralName: '', apiIdentifier: '', fields: '' });
        await mutate();
      } catch {
        toast.error('Error creating custom object');
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCustomObject(id);
        toast.success('Custom object deleted');
        setPendingDeleteId(null);
        await mutate();
      } catch {
        toast.error('Error deleting custom object');
      }
    });
  };

  const filteredData = objects.filter(d => d.pluralName.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Custom Objects"
      subtitle="Define robust custom data models tailored to your business."
      primaryAction={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>New Object</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search custom objects...' }}
    >
      {filteredData.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No custom objects found"
          description="Create a custom data model to tailor SabNode to your business."
          action={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>New Object</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredData.map(item => (
            <Card key={item.id} variant="interactive" padding="lg" className="group flex flex-col justify-between">
              <CardBody className="flex-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                  <Database className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-[var(--st-text)]">{item.pluralName}</h3>
                <p className="mt-1 font-mono text-sm text-[var(--st-text-tertiary)]">{item.apiIdentifier}</p>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-[var(--st-text-tertiary)]">Fields</p>
                  <div className="flex flex-wrap gap-1">
                    {item.fields.map(f => (
                      <Badge key={f.name} tone="neutral" kind="soft">{f.name}</Badge>
                    ))}
                    {item.fields.length === 0 && (
                      <span className="text-xs italic text-[var(--st-text-tertiary)]">No custom fields</span>
                    )}
                  </div>
                </div>
              </CardBody>
              <CardFooter className="mt-6 flex justify-end">
                <IconButton
                  label={`Delete ${item.pluralName}`}
                  icon={Trash2}
                  variant="ghost"
                  onClick={() => setPendingDeleteId(item.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  disabled={isPending}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Custom Object</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Singular Name">
                <Input
                  value={form.singularName}
                  onChange={e => setForm({ ...form, singularName: e.target.value, apiIdentifier: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g. Property"
                  disabled={isPending}
                />
              </Field>
              <Field label="Plural Name">
                <Input
                  value={form.pluralName}
                  onChange={e => setForm({ ...form, pluralName: e.target.value })}
                  placeholder="e.g. Properties"
                  disabled={isPending}
                />
              </Field>
            </div>
            <Field label="API Identifier">
              <Input
                value={form.apiIdentifier}
                onChange={e => setForm({ ...form, apiIdentifier: e.target.value })}
                className="font-mono"
                disabled={isPending}
              />
            </Field>
            <Field label="Initial Fields (comma separated)">
              <Input
                value={form.fields}
                onChange={e => setForm({ ...form, fields: e.target.value })}
                placeholder="Address, Price, Status"
                disabled={isPending}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this custom object?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the object and its field definitions. You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              disabled={isPending}
              onClick={(e) => { e.preventDefault(); if (pendingDeleteId) handleDelete(pendingDeleteId); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}
