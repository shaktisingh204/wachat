'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Field,
  Label,
  Badge,
  StatCard,
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
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
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
import {
  createRedactionPolicy,
  deleteRedactionPolicy,
  updateRedactionPolicy,
} from '@/app/actions/platform/data-redaction.actions';
import type { RedactionPolicy } from '@/types/platform';
import {
  Plus,
  Trash2,
  Filter,
  Pencil,
  ShieldOff,
  Shield,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface DataRedactionClientProps {
  initialData: RedactionPolicy[];
  total: number;
  currentPage: number;
  totalPages: number;
}

export function DataRedactionClient({
  initialData,
  total,
  currentPage,
  totalPages,
}: DataRedactionClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    targetFields: '',
    maskPattern: '***',
    status: 'active',
  });

  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const targetFieldFilter = searchParams.get('targetField') || '';
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (targetFieldFilter !== '' ? 1 : 0);

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetForm = () =>
    setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' });

  const handleSave = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          targetFields: form.targetFields.split(',').map((f) => f.trim()).filter(Boolean),
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
      } catch {
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
    } catch {
      toast.error('Error deleting policy');
    }
  };

  const stats = useMemo(() => {
    const active = initialData.filter((d) => d.status === 'active').length;
    const inactive = initialData.length - active;
    return { active, inactive };
  }, [initialData]);

  const newButton = (
    <Button
      variant="primary"
      iconLeft={Plus}
      onClick={() => {
        setEditingId(null);
        resetForm();
        setDialogOpen(true);
      }}
    >
      New policy
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Data redaction policies</PageTitle>
          <PageDescription>
            Automatically mask sensitive fields wherever they appear across the platform.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{newButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total policies" value={total} icon={Shield} />
        <StatCard label="Active (page)" value={stats.active} icon={ShieldCheck} />
        <StatCard label="Inactive (page)" value={stats.inactive} icon={ShieldOff} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--st-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Policies</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-56">
              <Field label="Search policies" className="[&_.u-field__label]:sr-only">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => updateFilters('search', e.target.value)}
                  placeholder="Search policies…"
                  iconLeft={Search}
                />
              </Field>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" iconLeft={Filter}>
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge tone="accent" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <h4 className="font-medium leading-none text-[var(--st-text)]">
                      Advanced filters
                    </h4>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                      Narrow policies by status or target field.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-3 items-center gap-3">
                      <Label htmlFor="filter-status">Status</Label>
                      <div className="col-span-2">
                        <Select
                          value={statusFilter}
                          onValueChange={(v) => updateFilters('status', v === 'all' ? '' : v)}
                        >
                          <SelectTrigger id="filter-status" aria-label="Status">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-3">
                      <Label htmlFor="filter-target-field">Target field</Label>
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
                    Clear filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        {initialData.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title="No redaction policies found"
            description="Create a policy to start masking sensitive fields across the platform."
            action={newButton}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Target fields</Th>
                <Th>Mask pattern</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {initialData.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.name}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.targetFields.map((f) => (
                        <Badge key={f} tone="neutral" kind="soft" className="font-mono text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="font-mono text-sm">{item.maskPattern}</Td>
                  <Td>
                    <Badge tone={item.status === 'active' ? 'success' : 'neutral'} dot>
                      {item.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label={`Edit ${item.name}`}
                        icon={Pencil}
                        variant="ghost"
                        onClick={() => handleEdit(item)}
                      />
                      <IconButton
                        label={`Delete ${item.name}`}
                        icon={Trash2}
                        variant="danger"
                        onClick={() => handleDelete(item.id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] px-4 py-3">
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
            <DialogTitle>{editingId ? 'Edit redaction policy' : 'New redaction policy'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Policy name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mask SSN"
              />
            </Field>
            <Field label="Target fields" help="Comma separated JSON keys.">
              <Input
                value={form.targetFields}
                onChange={(e) => setForm({ ...form, targetFields: e.target.value })}
                placeholder="ssn, social_security"
              />
            </Field>
            <Field label="Mask pattern">
              <Input
                value={form.maskPattern}
                onChange={(e) => setForm({ ...form, maskPattern: e.target.value })}
                placeholder="***-**-****"
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isPending} disabled={isPending}>
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
