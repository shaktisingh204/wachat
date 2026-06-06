'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { createCustomReport, deleteCustomReport } from '@/app/actions/platform/custom-report-builder.actions';
import type { CustomReport } from '@/types/platform';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

interface CustomReportBuilderClientProps {
  initialData: CustomReport[];
}

export function CustomReportBuilderClient({ initialData }: CustomReportBuilderClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const [form, setForm] = useState({ name: '', description: '', dataSource: '', columns: '' });

  const handleCreate = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        await createCustomReport({
          ...form,
          columns: form.columns.split(',').map(c => c.trim()).filter(Boolean)
        });
        toast({ title: 'Report created', variant: 'success' });
        setDialogOpen(false);
        setForm({ name: '', description: '', dataSource: '', columns: '' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error creating report', variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startTransition(async () => {
      try {
        await deleteCustomReport(id);
        toast({ title: 'Report deleted', variant: 'success' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error deleting report', variant: 'destructive' });
      }
    });
  };

  const filteredData = initialData.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Custom Report Builder"
      subtitle="Build and manage custom reports with drag-and-drop elements."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Report</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search reports...' }}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredData.map(item => (
          <Card key={item.id} className="p-4 flex flex-col justify-between hover:border-[var(--st-accent)] transition-colors">
            <div>
              <h3 className="font-semibold text-lg text-[var(--st-text)]">{item.name}</h3>
              <p className="text-sm text-[var(--st-text-tertiary)] mt-1">{item.description}</p>
              <div className="mt-4">
                <span className="text-xs font-semibold bg-[var(--st-hover)] px-2 py-1 rounded-md">{item.dataSource}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-4 h-4 text-[var(--st-text)]" />
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--st-text-tertiary)]">No reports found.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Custom Report</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Report Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Data Source</Label>
              <Input value={form.dataSource} onChange={e => setForm({ ...form, dataSource: e.target.value })} placeholder="e.g. deals, contacts" />
            </div>
            <div className="grid gap-2">
              <Label>Columns (comma separated)</Label>
              <Input value={form.columns} onChange={e => setForm({ ...form, columns: e.target.value })} placeholder="Revenue, Date, Rep" />
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
