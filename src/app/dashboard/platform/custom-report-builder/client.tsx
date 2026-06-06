'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  CardTitle,
  CardDescription,
  Badge,
  EmptyState,
  Field,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  useToast,
} from '@/components/sabcrm/20ui';
import { createCustomReport, deleteCustomReport } from '@/app/actions/platform/custom-report-builder.actions';
import type { CustomReport } from '@/types/platform';
import { FileBarChart, Plus, Trash2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

interface CustomReportBuilderClientProps {
  initialData: CustomReport[];
}

export function CustomReportBuilderClient({ initialData }: CustomReportBuilderClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [form, setForm] = useState({ name: '', description: '', dataSource: '', columns: '' });

  const handleCreate = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        await createCustomReport({
          ...form,
          columns: form.columns.split(',').map(c => c.trim()).filter(Boolean)
        });
        toast.success('Report created');
        setDialogOpen(false);
        setForm({ name: '', description: '', dataSource: '', columns: '' });
        router.refresh();
      } catch (err) {
        toast.error('Error creating report');
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startTransition(async () => {
      try {
        await deleteCustomReport(id);
        toast.success('Report deleted');
        router.refresh();
      } catch (err) {
        toast.error('Error deleting report');
      }
    });
  };

  const filteredData = initialData.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Custom Report Builder"
      subtitle="Build and manage custom reports with drag-and-drop elements."
      primaryAction={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>Create Report</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search reports...' }}
    >
      {filteredData.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No reports found"
          description="Create a custom report to get started."
          action={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>Create Report</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredData.map(item => (
            <Card key={item.id} variant="interactive" padding="md" className="flex flex-col justify-between">
              <CardBody className="flex flex-col gap-2">
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
                <div>
                  <Badge tone="accent">{item.dataSource}</Badge>
                </div>
              </CardBody>
              <CardFooter className="justify-end">
                <IconButton
                  label="Delete report"
                  icon={Trash2}
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Custom Report</DialogTitle>
            <DialogDescription>Define the report name, source, and columns to include.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Field label="Report Name">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Data Source">
              <Input value={form.dataSource} onChange={e => setForm({ ...form, dataSource: e.target.value })} placeholder="e.g. deals, contacts" />
            </Field>
            <Field label="Columns (comma separated)">
              <Input value={form.columns} onChange={e => setForm({ ...form, columns: e.target.value })} placeholder="Revenue, Date, Rep" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
