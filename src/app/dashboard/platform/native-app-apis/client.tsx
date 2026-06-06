'use client';
import { fmtDate } from "@/lib/utils";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { createNativeAppAPIKey, deleteNativeAppAPIKey } from '@/app/actions/platform/native-app-apis.actions';
import type { NativeAppAPIKey } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, KeyRound } from 'lucide-react';

export default function NativeAppAPIsClient({ initialData }: { initialData: NativeAppAPIKey[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  const [newKey, setNewKey] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', scopes: '' });

  const handleCreate = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const res = await createNativeAppAPIKey({
          ...form,
          scopes: form.scopes.split(',').map(s => s.trim()).filter(Boolean)
        });
        setNewKey(res.key);
        toast({ title: 'API Key generated', variant: 'success' });
        setForm({ name: '', scopes: '' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error creating key', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startTransition(async () => {
      try {
        await deleteNativeAppAPIKey(id);
        toast({ title: 'Key deleted', variant: 'success' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error deleting key', variant: 'destructive' });
      }
    });
  };

  const filteredData = initialData.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Native API Keys"
      subtitle="Manage access tokens for mobile apps and integrations."
      primaryAction={<Button onClick={() => { setDialogOpen(true); setNewKey(null); }}><Plus className="w-4 h-4 mr-2" />Generate Key</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search keys...' }}
    >
      <Card className="border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Key Prefix</ZoruTableHead>
              <ZoruTableHead>Scopes</ZoruTableHead>
              <ZoruTableHead>Created</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map(item => (
              <ZoruTableRow key={item.id}>
                <ZoruTableCell className="font-medium flex items-center"><KeyRound className="w-4 h-4 mr-2 text-[var(--st-text-tertiary)]" />{item.name}</ZoruTableCell>
                <ZoruTableCell className="font-mono text-sm">{item.keyPrefix}...</ZoruTableCell>
                <ZoruTableCell>
                  <div className="flex gap-1 flex-wrap">
                    {item.scopes.map(s => <span key={s} className="bg-zoru-neutral-hover px-2 py-0.5 rounded text-xs">{s}</span>)}
                  </div>
                </ZoruTableCell>
                <ZoruTableCell className="text-sm text-[var(--st-text-tertiary)]">{fmtDate(item.createdAt)}</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={isPending}>
                    <Trash2 className="w-4 h-4 text-[var(--st-text)]" />
                  </Button>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
            {filteredData.length === 0 && (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="text-center py-8 text-[var(--st-text-tertiary)]">No API keys found.</ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{newKey ? 'Save Your Key' : 'Generate API Key'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            {newKey ? (
              <div className="bg-[var(--st-bg-muted)] p-4 rounded-lg border border-[var(--st-border)]">
                <p className="text-sm text-[var(--st-text)] mb-2 font-medium">Please copy your API key now. It will not be shown again.</p>
                <code className="block p-3 bg-white border border-[var(--st-border)] rounded text-[var(--st-text)] font-mono break-all">
                  {newKey}
                </code>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Key Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mobile App Production" />
                </div>
                <div className="grid gap-2">
                  <Label>Scopes (comma separated)</Label>
                  <Input value={form.scopes} onChange={e => setForm({ ...form, scopes: e.target.value })} placeholder="read:deals, write:contacts" />
                </div>
              </>
            )}
          </div>
          <ZoruDialogFooter>
            {newKey ? (
              <Button onClick={() => setDialogOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} Generate
                </Button>
              </>
            )}
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
