'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, KeyRound, Webhook } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Badge,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { createWebhook, deleteWebhook } from '@/app/actions/platform/webhooks.actions';
import type { WebhookEndpoint } from '@/types/platform';

const STATUS_TONE: Record<WebhookEndpoint['status'], BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  failing: 'danger',
};

export default function WebhooksClient({ initialData }: { initialData: WebhookEndpoint[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', events: '' });

  const handleCreate = () => {
    if (!form.name || !form.url) return;
    startTransition(async () => {
      try {
        await createWebhook({
          ...form,
          events: form.events.split(',').map((e) => e.trim()).filter(Boolean),
        });
        toast.success('Webhook created');
        setDialogOpen(false);
        setForm({ name: '', url: '', events: '' });
        router.refresh();
      } catch {
        toast.error('Error creating webhook');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure?')) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteWebhook(id);
        toast.success('Webhook deleted');
        router.refresh();
      } catch {
        toast.error('Error deleting webhook');
        setDeletingId(null);
      }
    });
  };

  const filteredData = initialData.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <EntityListShell
      title="Webhooks & Zapier Integrations"
      subtitle="Connect SabNode to external apps using webhooks."
      primaryAction={
        <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
          Add Webhook
        </Button>
      }
      search={{ value: query, onChange: setQuery, placeholder: 'Search webhooks...' }}
    >
      <Card padding="none" className="overflow-hidden">
        {filteredData.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks found"
            description="Add a webhook to push SabNode events to your external apps."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
                Add Webhook
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>URL</Th>
                <Th>Status</Th>
                <Th>Events</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.name}</Td>
                  <Td className="font-mono text-[var(--st-text-secondary)]">{item.url}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[item.status]} dot>
                      {item.status}
                    </Badge>
                  </Td>
                  <Td>{item.events.join(', ')}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Copy signing secret"
                        icon={KeyRound}
                        onClick={() => {
                          navigator.clipboard.writeText(item.secret);
                          toast.success('Secret copied to clipboard');
                        }}
                      />
                      <IconButton
                        label="Delete webhook"
                        icon={Trash2}
                        variant="danger"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                      />
                    </div>
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
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Register an endpoint to receive SabNode event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Webhook Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Zapier Deals"
              />
            </Field>
            <Field label="Endpoint URL">
              <Input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <Field label="Events" help="Comma separated event names.">
              <Input
                value={form.events}
                onChange={(e) => setForm({ ...form, events: e.target.value })}
                placeholder="crm.deal.created, crm.contact.updated"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
