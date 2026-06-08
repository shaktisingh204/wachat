'use client';

import { useMemo, useState, useTransition } from 'react';
import useSWR from 'swr';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  Badge,
  StatCard,
  EmptyState,
  Field,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
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
import {
  createCustomObject,
  deleteCustomObject,
  getCustomObjects,
} from '@/app/actions/platform/custom-object-builder.actions';
import type { CustomObjectDefinition } from '@/types/platform';
import { Plus, Trash2, Database, Search, Boxes, ListTree } from 'lucide-react';

export function CustomObjectClient({ initialData }: { initialData: CustomObjectDefinition[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { data: objects = initialData, mutate } = useSWR<CustomObjectDefinition[]>(
    'custom-objects',
    getCustomObjects,
    { fallbackData: initialData },
  );

  const [form, setForm] = useState({
    singularName: '',
    pluralName: '',
    apiIdentifier: '',
    fields: '',
  });

  const handleCreate = async () => {
    if (!form.singularName || !form.apiIdentifier) return;
    startTransition(async () => {
      try {
        await createCustomObject({
          ...form,
          fields: form.fields
            .split(',')
            .map((f) => ({ name: f.trim(), type: 'string', required: false }))
            .filter((f) => f.name),
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

  const stats = useMemo(() => {
    const totalFields = objects.reduce((sum, o) => sum + o.fields.length, 0);
    return { total: objects.length, totalFields };
  }, [objects]);

  const filteredData = objects.filter((d) =>
    d.pluralName.toLowerCase().includes(query.toLowerCase()),
  );

  const newButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      New object
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Custom objects</PageTitle>
          <PageDescription>
            Model the data unique to your business with custom objects and fields.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{newButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Custom objects" value={stats.total} icon={Boxes} />
        <StatCard label="Total fields" value={stats.totalFields} icon={ListTree} />
      </div>

      <div className="w-full sm:max-w-sm">
        <Field label="Search objects" className="[&_.u-field__label]:sr-only">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search custom objects…"
            iconLeft={Search}
          />
        </Field>
      </div>

      {filteredData.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={Database}
            title={query ? 'No matching objects' : 'No custom objects yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Create a custom data model to tailor SabNode to your business.'
            }
            action={query ? undefined : newButton}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredData.map((item) => (
            <Card
              key={item.id}
              variant="interactive"
              padding="lg"
              className="group flex flex-col justify-between"
            >
              <CardBody className="flex-1 p-0">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                  <Database className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-[var(--st-text)]">{item.pluralName}</h3>
                <p className="mt-0.5 font-mono text-sm text-[var(--st-text-tertiary)]">
                  {item.apiIdentifier}
                </p>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                    Fields
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {item.fields.length > 0 ? (
                      item.fields.map((f) => (
                        <Badge key={f.name} tone="neutral" kind="soft" className="font-mono text-xs">
                          {f.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs italic text-[var(--st-text-tertiary)]">
                        No custom fields
                      </span>
                    )}
                  </div>
                </div>
              </CardBody>
              <CardFooter className="mt-5 flex justify-end border-t border-[var(--st-border)] p-0 pt-3">
                <IconButton
                  label={`Delete ${item.pluralName}`}
                  icon={Trash2}
                  variant="danger"
                  onClick={() => setPendingDeleteId(item.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
            <DialogTitle>New custom object</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Singular name">
                <Input
                  value={form.singularName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      singularName: e.target.value,
                      apiIdentifier: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                    })
                  }
                  placeholder="e.g. Property"
                  disabled={isPending}
                />
              </Field>
              <Field label="Plural name">
                <Input
                  value={form.pluralName}
                  onChange={(e) => setForm({ ...form, pluralName: e.target.value })}
                  placeholder="e.g. Properties"
                  disabled={isPending}
                />
              </Field>
            </div>
            <Field label="API identifier">
              <Input
                value={form.apiIdentifier}
                onChange={(e) => setForm({ ...form, apiIdentifier: e.target.value })}
                className="font-mono"
                disabled={isPending}
              />
            </Field>
            <Field label="Initial fields" help="Comma separated field names.">
              <Input
                value={form.fields}
                onChange={(e) => setForm({ ...form, fields: e.target.value })}
                placeholder="Address, Price, Status"
                disabled={isPending}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
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
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeleteId) handleDelete(pendingDeleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
