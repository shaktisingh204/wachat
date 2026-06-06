'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, THead, TBody, Tr, Th, Td, useToast } from '@/components/sabcrm/20ui';
import { createWebhook, deleteWebhook } from '@/app/actions/platform/webhooks.actions';
import type { WebhookEndpoint } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WebhooksClient({ initialData }: { initialData: WebhookEndpoint[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', events: '' });

  const handleCreate = async () => {
    if (!form.name || !form.url) return;
    startTransition(async () => {
      try {
        await createWebhook({
          ...form,
          events: form.events.split(',').map(e => e.trim()).filter(Boolean)
        });
        toast({ title: 'Webhook created', variant: 'success' });
        setDialogOpen(false);
        setForm({ name: '', url: '', events: '' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error creating webhook', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteWebhook(id);
        toast({ title: 'Webhook deleted', variant: 'success' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error deleting webhook', variant: 'destructive' });
        setDeletingId(null);
      }
    });
  };

  const filteredData = initialData.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Webhooks & Zapier Integrations"
      subtitle="Connect SabNode to external apps using webhooks."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Webhook</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search webhooks...' }}
    >
      <Card className="border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>URL</Th>
              <Th>Status</Th>
              <Th>Events</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {filteredData.map(item => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.name}</Td>
                <Td className="text-sm font-mono text-[var(--st-text-tertiary)]">{item.url}</Td>
                <Td>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'active' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
                    {item.status}
                  </span>
                </Td>
                <Td>{item.events.join(', ')}</Td>
                <Td className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(item.secret);
                    toast({ title: 'Secret copied to clipboard' });
                  }}>
                    <Key className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? <LoaderCircle className="w-4 h-4 text-[var(--st-text)] animate-spin" /> : <Trash2 className="w-4 h-4 text-[var(--st-text)]" />}
                  </Button>
                </Td>
              </Tr>
            ))}
            {filteredData.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-center py-8 text-[var(--st-text-tertiary)]">No webhooks found.</Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Webhook Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Zapier Deals" />
            </div>
            <div className="grid gap-2">
              <Label>Endpoint URL</Label>
              <Input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label>Events (comma separated)</Label>
              <Input value={form.events} onChange={e => setForm({ ...form, events: e.target.value })} placeholder="crm.deal.created, crm.contact.updated" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
