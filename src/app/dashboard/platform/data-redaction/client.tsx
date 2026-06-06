'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Table, THead, TBody, Tr, Th, Td, useToast, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import { createRedactionPolicy, deleteRedactionPolicy, updateRedactionPolicy } from '@/app/actions/platform/data-redaction.actions';
import type { RedactionPolicy } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, Filter, ChevronLeft, ChevronRight, X, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/sabcrm/20ui/compat';

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

  // Filter states
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const targetFieldFilter = searchParams.get('targetField') || '';

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // reset to page 1 on filter change
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSave = async () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          targetFields: form.targetFields.split(',').map(f => f.trim()).filter(Boolean)
        };
        
        if (editingId) {
          await updateRedactionPolicy(editingId, payload);
          toast({ title: 'Policy updated', variant: 'success' });
        } else {
          await createRedactionPolicy(payload);
          toast({ title: 'Policy created', variant: 'success' });
        }
        setDialogOpen(false);
        setEditingId(null);
        setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' });
        router.refresh();
      } catch (err) {
        toast({ title: `Error ${editingId ? 'updating' : 'creating'} policy`, variant: 'destructive' });
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
      toast({ title: 'Policy deleted', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Error deleting policy', variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="Data Redaction Policies"
      subtitle="Automatically mask sensitive fields across the platform."
      primaryAction={<Button onClick={() => { setEditingId(null); setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' }); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />New Policy</Button>}
      search={{ 
        value: search, 
        onChange: (v) => updateFilters('search', v), 
        placeholder: 'Search policies...' 
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-tertiary)]">
          <span>{total} total policies</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Advanced Activity Log Filters
                {(statusFilter !== 'all' || targetFieldFilter !== '') && (
                  <span className="ml-2 rounded-full bg-[var(--st-text)]/20 px-1.5 py-0.5 text-xs font-semibold">
                    {(statusFilter !== 'all' ? 1 : 0) + (targetFieldFilter !== '' ? 1 : 0)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Advanced Filters</h4>
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Filter policies by specific criteria.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="status">Status</Label>
                    <div className="col-span-2">
                      <Select value={statusFilter} onValueChange={(v) => updateFilters('status', v === 'all' ? '' : v)}>
                        <SelectTrigger id="status"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="targetField">Target Field</Label>
                    <Input
                      id="targetField"
                      value={targetFieldFilter}
                      onChange={(e) => updateFilters('targetField', e.target.value)}
                      className="col-span-2 h-8"
                      placeholder="e.g. email"
                    />
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full text-xs" 
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

      <Card className="border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Target Fields</Th>
              <Th>Mask Pattern</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {initialData.map(item => (
              <Tr key={item.id}>
                <Td className="font-medium">{item.name}</Td>
                <Td className="font-mono text-sm">{item.targetFields.join(', ')}</Td>
                <Td>{item.maskPattern}</Td>
                <Td>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'active' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-hover)] text-[var(--st-text)]'}`}>
                    {item.status}
                  </span>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4 text-[var(--st-text)]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-[var(--st-text)]" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
            {initialData.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-center py-8 text-[var(--st-text-tertiary)]">No redaction policies found.</Td>
              </Tr>
            )}
          </TBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-[var(--st-border)]">
            <p className="text-sm text-[var(--st-text-tertiary)]">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingId(null);
          setForm({ name: '', targetFields: '', maskPattern: '***', status: 'active' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Redaction Policy' : 'New Redaction Policy'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Policy Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mask SSN" />
            </div>
            <div className="grid gap-2">
              <Label>Target Fields (comma separated JSON keys)</Label>
              <Input value={form.targetFields} onChange={e => setForm({ ...form, targetFields: e.target.value })} placeholder="ssn, social_security" />
            </div>
            <div className="grid gap-2">
              <Label>Mask Pattern</Label>
              <Input value={form.maskPattern} onChange={e => setForm({ ...form, maskPattern: e.target.value })} placeholder="***-**-****" />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : null} {editingId ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
