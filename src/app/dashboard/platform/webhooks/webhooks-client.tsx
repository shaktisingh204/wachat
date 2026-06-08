'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  KeyRound,
  Webhook,
  Search,
  Activity,
  AlertTriangle,
  PauseCircle,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Badge,
  StatCard,
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
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
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

  const stats = useMemo(() => {
    const total = initialData.length;
    const active = initialData.filter((d) => d.status === 'active').length;
    const failing = initialData.filter((d) => d.status === 'failing').length;
    const inactive = initialData.filter((d) => d.status === 'inactive').length;
    return { total, active, failing, inactive };
  }, [initialData]);

  const filteredData = initialData.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  const addButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      Add webhook
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Webhooks &amp; Zapier</PageTitle>
          <PageDescription>
            Push SabNode events to external apps in real time. Each endpoint is signed with a
            secret you can rotate.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{addButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Endpoints" value={stats.total} icon={Webhook} />
        <StatCard label="Active" value={stats.active} icon={Activity} />
        <StatCard label="Failing" value={stats.failing} icon={AlertTriangle} />
        <StatCard label="Paused" value={stats.inactive} icon={PauseCircle} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--st-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Endpoints</CardTitle>
          </div>
          <div className="w-full sm:w-64">
            <Field label="Search webhooks" className="[&_.u-field__label]:sr-only">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search webhooks…"
                iconLeft={Search}
              />
            </Field>
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title={query ? 'No matching webhooks' : 'No webhooks yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Add a webhook to push SabNode events to your external apps.'
            }
            action={query ? undefined : addButton}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Endpoint URL</Th>
                <Th>Status</Th>
                <Th>Events</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.name}</Td>
                  <Td className="max-w-[22rem] truncate font-mono text-xs text-[var(--st-text-secondary)]">
                    {item.url}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[item.status]} dot>
                      {item.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.events.length > 0 ? (
                        item.events.map((ev) => (
                          <Badge key={ev} tone="neutral" kind="soft" className="font-mono text-xs">
                            {ev}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--st-text-tertiary)]">All events</span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label={`Copy signing secret for ${item.name}`}
                        icon={KeyRound}
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(item.secret);
                          toast.success('Secret copied to clipboard');
                        }}
                      />
                      <IconButton
                        label={`Delete webhook ${item.name}`}
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
            <DialogTitle>Add webhook</DialogTitle>
            <DialogDescription>
              Register an endpoint to receive SabNode event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Webhook name">
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
                placeholder="https://…"
              />
            </Field>
            <Field label="Events" help="Comma separated event names. Leave blank for all events.">
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
    </div>
  );
}
