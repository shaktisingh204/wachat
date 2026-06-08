'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardFooter,
  CardTitle,
  CardDescription,
  Badge,
  StatCard,
  EmptyState,
  Field,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createCustomReport,
  deleteCustomReport,
} from '@/app/actions/platform/custom-report-builder.actions';
import type { CustomReport } from '@/types/platform';
import { FileBarChart, Plus, Trash2, Search, Database, Columns3 } from 'lucide-react';

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
          columns: form.columns.split(',').map((c) => c.trim()).filter(Boolean),
        });
        toast.success('Report created');
        setDialogOpen(false);
        setForm({ name: '', description: '', dataSource: '', columns: '' });
        router.refresh();
      } catch {
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
      } catch {
        toast.error('Error deleting report');
      }
    });
  };

  const stats = useMemo(() => {
    const sources = new Set(initialData.map((d) => d.dataSource).filter(Boolean)).size;
    return { total: initialData.length, sources };
  }, [initialData]);

  const filteredData = initialData.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  const newButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      Create report
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Custom report builder</PageTitle>
          <PageDescription>
            Compose reusable reports from any data source and the columns that matter.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{newButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Reports" value={stats.total} icon={FileBarChart} />
        <StatCard label="Data sources" value={stats.sources} icon={Database} />
      </div>

      <div className="w-full sm:max-w-sm">
        <Field label="Search reports" className="[&_.u-field__label]:sr-only">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            iconLeft={Search}
          />
        </Field>
      </div>

      {filteredData.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={FileBarChart}
            title={query ? 'No matching reports' : 'No reports yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Create a custom report to surface the metrics you care about.'
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
              <CardBody className="flex flex-col gap-2 p-0">
                <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                  <FileBarChart className="h-5 w-5" aria-hidden="true" />
                </span>
                <CardTitle>{item.name}</CardTitle>
                {item.description ? (
                  <CardDescription>{item.description}</CardDescription>
                ) : null}
                {item.dataSource ? (
                  <div className="mt-1">
                    <Badge tone="accent" kind="soft" className="inline-flex items-center gap-1">
                      <Columns3 className="h-3 w-3" aria-hidden="true" />
                      {item.dataSource}
                    </Badge>
                  </div>
                ) : null}
              </CardBody>
              <CardFooter className="mt-5 justify-end border-t border-[var(--st-border)] p-0 pt-3">
                <IconButton
                  label={`Delete ${item.name}`}
                  icon={Trash2}
                  variant="danger"
                  onClick={() => handleDelete(item.id)}
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
            <DialogTitle>New custom report</DialogTitle>
            <DialogDescription>
              Define the report name, source, and columns to include.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Field label="Report name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Data source">
              <Input
                value={form.dataSource}
                onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
                placeholder="e.g. deals, contacts"
              />
            </Field>
            <Field label="Columns" help="Comma separated column names.">
              <Input
                value={form.columns}
                onChange={(e) => setForm({ ...form, columns: e.target.value })}
                placeholder="Revenue, Date, Rep"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
