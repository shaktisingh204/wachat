'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, KeyRound } from 'lucide-react';

import { fmtDate } from '@/lib/utils';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { createNativeAppAPIKey, deleteNativeAppAPIKey } from '@/app/actions/platform/native-app-apis.actions';
import type { NativeAppAPIKey } from '@/types/platform';

export default function NativeAppAPIsClient({ initialData }: { initialData: NativeAppAPIKey[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NativeAppAPIKey | null>(null);

  const [form, setForm] = useState({ name: '', scopes: '' });

  const handleCreate = () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const res = await createNativeAppAPIKey({
          ...form,
          scopes: form.scopes.split(',').map((s) => s.trim()).filter(Boolean),
        });
        setNewKey(res.key);
        toast.success('API key generated');
        setForm({ name: '', scopes: '' });
        router.refresh();
      } catch {
        toast.error('Error creating key');
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteNativeAppAPIKey(id);
        toast.success('Key deleted');
        router.refresh();
      } catch {
        toast.error('Error deleting key');
      } finally {
        setPendingDelete(null);
      }
    });
  };

  const filteredData = initialData.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Native API Keys"
      subtitle="Manage access tokens for mobile apps and integrations."
      primaryAction={
        <Button variant="primary" iconLeft={Plus} onClick={() => { setDialogOpen(true); setNewKey(null); }}>
          Generate Key
        </Button>
      }
      search={{ value: query, onChange: setQuery, placeholder: 'Search keys...' }}
    >
      <Card padding="none" className="overflow-hidden">
        {filteredData.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys found"
            description="Generate a key to give a mobile app or integration access."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Key Prefix</Th>
                <Th>Scopes</Th>
                <Th>Created</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">
                    <span className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      {item.name}
                    </span>
                  </Td>
                  <Td className="font-mono text-sm">{item.keyPrefix}...</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.scopes.map((s) => (
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-sm text-[var(--st-text-tertiary)]">{fmtDate(item.createdAt)}</Td>
                  <Td align="right">
                    <IconButton
                      label={`Delete ${item.name}`}
                      icon={Trash2}
                      variant="ghost"
                      onClick={() => setPendingDelete(item)}
                      disabled={isPending}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'Save Your Key' : 'Generate API Key'}</DialogTitle>
            <DialogDescription>
              {newKey
                ? 'Copy this key now. For your security, it will not be shown again.'
                : 'Name the key and grant the scopes a mobile app or integration needs.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {newKey ? (
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                <p className="mb-2 text-sm font-medium text-[var(--st-text)]">
                  Please copy your API key now. It will not be shown again.
                </p>
                <code className="block break-all rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 font-mono text-[var(--st-text)]">
                  {newKey}
                </code>
              </div>
            ) : (
              <>
                <Field label="Key Name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Mobile App Production"
                  />
                </Field>
                <Field label="Scopes (comma separated)">
                  <Input
                    value={form.scopes}
                    onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                    placeholder="read:deals, write:contacts"
                  />
                </Field>
              </>
            )}
          </div>
          <DialogFooter>
            {newKey ? (
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={isPending} onClick={handleCreate}>
                  Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently revokes "${pendingDelete.name}". Any app using it will lose access. You cannot undo this.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep key</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                // Keep the dialog mounted until the async delete settles.
                e.preventDefault();
                if (pendingDelete) handleDelete(pendingDelete.id);
              }}
            >
              Delete key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}
