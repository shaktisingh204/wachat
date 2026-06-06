'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Input,
  Field,
  Label,
  Badge,
  EmptyState,
  Pagination,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/sabcrm/20ui';
import { createRedactionPolicy, deleteRedactionPolicy, updateRedactionPolicy } from '@/app/actions/platform/data-redaction.actions';
import type { RedactionPolicy } from '@/types/platform';
import { Plus, Trash2, Filter, Pencil, ShieldOff } from 'lucide-react';

interface DataRedactionClientProps {
  initialData: RedactionPolicy[];
  total: number;
  currentPage: number;
  totalPages: number;
}

export function DataRedactionClient({ initialData, total, currentPage, totalPages }: DataRedactionClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [form, setForm] = useState({ name: '', targetFields: '', maskPattern: '***', status: 'active' });

  // Filter states.
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const targetFieldFilter = searchParams.get('targetField') || '';
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (targetFieldFilter !== '' ? 1 : 0);

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 on filter change.
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetForm = () => setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' });

  const handleSave = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          targetFields: form.targetFields.split(',').map(f => f.trim()).filter(Boolean),
        };

        if (editingId) {
          await updateRedactionPolicy(editingId, payload);
          toast.success('Policy updated');
        } else {
          await createRedactionPolicy(payload);
          toast.success('Policy created');
        }
        setDialogOpen(false);
        setEditingId(null);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(`Error ${editingId ? 'updating' : 'creating'} policy`);
      }
    });
  };

  const handleEdit = (item: RedactionPolicy) => {
    setForm({
      name: item.name,
      targetFields: item.targetFields.join(', '),
      maskPattern: item.maskPattern,
      status: item.status,
    });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteRedactionPolicy(id);
      toast.success('Policy deleted');
      router.refresh();
    } catch (err) {
      toast.error('Error deleting policy');
    }
  };

  return (
    <EntityListShell
      title="Data Redaction Policies"
      subtitle="Automatically mask sensitive fields across the platform."
      primaryAction={
        <Button
          variant="primary"
          iconLeft={Plus}
          onClick={() => { setEditingId(null); resetForm(); setDialogOpen(true); }}
        >
          New Policy
        </Button>
      }
      search={{
        value: search,
        onChange: (v) => updateFilters('search', v),
        placeholder: 'Search policies...',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-tertiary)]">
          <span>{total} total policies</span>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" iconLeft={Filter}>
                Advanced Activity Log Filters
                {activeFilterCount > 0 && (
                  <Badge tone="accent" className="ml-2">{activeFilterCount}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none text-[var(--st-text)]">Advanced Filters</h4>
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Filter policies by specific criteria.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-status">Status</Label>
                    <div className="col-span-2">
                      <Select value={statusFilter} onValueChange={(v) => updateFilters('status', v === 'all' ? '' : v)}>
                        <SelectTrigger id="filter-status" aria-label="Status">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-target-field">Target Field</Label>
                    <div className="col-span-2">
                      <Input
                        id="filter-target-field"
                        inputSize="sm"
                        value={targetFieldFilter}
                        onChange={(e) => updateFilters('targetField', e.target.value)}
                        placeholder="e.g. email"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  onClick={() => {
                    updateFilters('status', '');
                    updateFilters('targetField', '');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Target Fields</Th>
              <Th>Mask Pattern</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {initialData.map(item => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.name}</Td>
                <Td className="font-mono text-sm">{item.targetFields.join(', ')}</Td>
                <Td>{item.maskPattern}</Td>
                <Td>
                  <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>
                    {item.status}
                  </Badge>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-2">
                    <IconButton label="Edit policy" icon={Pencil} onClick={() => handleEdit(item)} />
                    <IconButton label="Delete policy" icon={Trash2} onClick={() => handleDelete(item.id)} />
                  </div>
                </Td>
              </Tr>
            ))}
            {initialData.length === 0 && (
              <Tr>
                <Td colSpan={5}>
                  <EmptyState
                    icon={ShieldOff}
                    title="No redaction policies found"
                    description="Create a policy to start masking sensitive fields across the platform."
                  />
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] px-4 py-4">
            <p className="text-sm text-[var(--st-text-tertiary)]">
              Page {currentPage} of {totalPages}
            </p>
            <Pagination
              page={currentPage}
              pageCount={totalPages}
              onPageChange={handlePageChange}
              size="compact"
            />
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Redaction Policy' : 'New Redaction Policy'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Policy Name">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mask SSN" />
            </Field>
            <Field label="Target Fields" help="Comma separated JSON keys.">
              <Input value={form.targetFields} onChange={e => setForm({ ...form, targetFields: e.target.value })} placeholder="ssn, social_security" />
            </Field>
            <Field label="Mask Pattern">
              <Input value={form.maskPattern} onChange={e => setForm({ ...form, maskPattern: e.target.value })} placeholder="***-**-****" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger aria-label="Status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending} disabled={isPending}>
              {editingId ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
