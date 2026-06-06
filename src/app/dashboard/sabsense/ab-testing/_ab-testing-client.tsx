'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, FlaskConical } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  EmptyState,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { createAbTest, updateAbTest, deleteAbTest } from '@/app/actions/marketing/ab-testing.actions';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  running: 'info',
  completed: 'success',
};

export function AbTestClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form State
  const [experimentName, setExperimentName] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditingItem(null);
    setExperimentName('');
    setStatus('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setExperimentName(item.experimentName || '');
    setStatus(item.status || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      experimentName,
      status,
    };

    try {
      if (editingItem) {
        const res = await updateAbTest(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Record updated successfully.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createAbTest(payload);
        if (res.success) {
          // Optimistically reload page or add
          window.location.reload();
        } else {
          toast.error(res.error || 'Failed to create record.');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const res = await deleteAbTest(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Record deleted.');
    } else {
      toast.error(res.error || 'Failed to delete record.');
    }
  };

  return (
    <EntityListShell
      title="A/B Testing"
      subtitle="Manage your A/B Testing seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" iconLeft={Plus} onClick={openNew}>
              Create New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Field label="Experiment name">
                <Input
                  type="text"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  placeholder="Headline copy test"
                />
              </Field>

              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger aria-label="Status">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <DialogFooter>
              <Button variant="primary" loading={loading} onClick={handleSave}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {filteredData.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No records found"
          description="Create your first A/B test to start experimenting."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={openNew}>
              Create New
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          <Table>
            <THead>
              <Tr>
                <Th>Experiment name</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => {
                const statusValue = String(item.status || '');
                return (
                  <Tr key={item._id}>
                    <Td>{String(item.experimentName || '')}</Td>
                    <Td>
                      {statusValue ? (
                        <Badge tone={STATUS_TONE[statusValue] ?? 'neutral'} kind="soft" dot>
                          {statusValue}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          label="Edit record"
                          icon={Edit2}
                          variant="ghost"
                          onClick={() => openEdit(item)}
                        />
                        <IconButton
                          label="Delete record"
                          icon={Trash2}
                          variant="ghost"
                          onClick={() => handleDelete(item._id)}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </EntityListShell>
  );
}
