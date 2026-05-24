'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, useZoruToast } from '@/components/zoruui';
import { createWebhook, deleteWebhook } from '@/app/actions/platform/webhooks.actions';
import type { WebhookEndpoint } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WebhooksClient({ initialData }: { initialData: WebhookEndpoint[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  const router = useRouter();

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
    try {
      await deleteWebhook(id);
      toast({ title: 'Webhook deleted', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Error deleting webhook', variant: 'destructive' });
    }
  };

  const filteredData = initialData.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Webhooks & Zapier Integrations"
      subtitle="Connect SabNode to external apps using webhooks."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Webhook</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search webhooks...' }}
    >
      <Card className="border-zoru-line bg-zoru-bg overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>URL</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead>Events</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="font-medium">{item.name}</ZoruTableCell>
                <ZoruTableCell className="text-sm font-mono text-zoru-ink-light">{item.url}</ZoruTableCell>
                <ZoruTableCell>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.status}
                  </span>
                </ZoruTableCell>
                <ZoruTableCell>{item.events.join(', ')}</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(item.secret);
                    toast({ title: 'Secret copied to clipboard' });
                  }}>
                    <Key className="w-4 h-4 text-zoru-ink-light" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
            {filteredData.length === 0 && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="text-center py-8 text-zoru-ink-light">No webhooks found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add Webhook</ZoruDialogTitle>
          </ZoruDialogHeader>
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
