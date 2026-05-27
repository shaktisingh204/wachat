'use client';

import React, { useEffect, useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Input, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, EmptyState } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';

interface EntityCrudPageProps<T> {
  title: string;
  description: string;
  entityName: string;
  fetchFn: () => Promise<T[]>;
  saveFn: (payload: Partial<T>) => Promise<any>;
  deleteFn: (id: string) => Promise<any>;
  columns: { header: string; accessorKey: keyof T; render?: (val: any, row: T) => React.ReactNode }[];
  formFields: { name: keyof T; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'select'; options?: string[] }[];
  defaultValues: Partial<T>;
}

export function EntityCrudPage<T extends { _id?: string }>({
  title,
  description,
  entityName,
  fetchFn,
  saveFn,
  deleteFn,
  columns,
  formFields,
  defaultValues
}: EntityCrudPageProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<T> | null>(null);
  const { toast } = useZoruToast();

  const loadData = () => {
    setIsLoading(true);
    fetchFn().then((res) => {
      setData(res || []);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      setIsLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      await saveFn(editingItem as Partial<T>);
      toast({ title: 'Success', description: `${entityName} saved successfully.` });
      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteFn(id);
      toast({ title: 'Success', description: `${entityName} deleted.` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filteredData = data.filter(item => 
    Object.values(item).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <EntityListShell
      title={title}
      subtitle={description}
      loading={isLoading}
      search={{ value: search, onChange: setSearch, placeholder: `Search ${title.toLowerCase()}...` }}
      primaryAction={
        <Button onClick={() => { setEditingItem(defaultValues); setIsDialogOpen(true); }}>
          Add {entityName}
        </Button>
      }
      empty={
        <EmptyState
          title={`No ${title.toLowerCase()} found`}
          description={`Get started by adding a new ${entityName.toLowerCase()}.`}
          action={<Button onClick={() => { setEditingItem(defaultValues); setIsDialogOpen(true); }}>Add {entityName}</Button>}
        />
      }
    >
      <div className="rounded-md border border-zoru-line overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              {columns.map(c => <ZoruTableHead key={String(c.accessorKey)}>{c.header}</ZoruTableHead>)}
              <ZoruTableHead className="w-[120px] text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredData.map((row, i) => (
              <ZoruTableRow key={row._id || i}>
                {columns.map(c => (
                  <ZoruTableCell key={String(c.accessorKey)}>
                    {c.render ? c.render(row[c.accessorKey], row) : String(row[c.accessorKey] || '')}
                  </ZoruTableCell>
                ))}
                <ZoruTableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingItem(row); setIsDialogOpen(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-zoru-ink" onClick={() => handleDelete(row._id!)}>Del</Button>
                  </div>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editingItem?._id ? 'Edit' : 'Add'} {entityName}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            {formFields.map(f => (
              <div key={String(f.name)} className="flex flex-col gap-1">
                <label className="text-sm font-medium">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="flex h-10 w-full rounded-md border border-zoru-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zoru-brand"
                    value={String(editingItem?.[f.name] || '')}
                    onChange={(e) => setEditingItem({ ...editingItem, [f.name]: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(editingItem?.[f.name])}
                    onChange={(e) => setEditingItem({ ...editingItem, [f.name]: e.target.checked })}
                  />
                ) : (
                  <Input
                    type={f.type}
                    value={String(editingItem?.[f.name] || '')}
                    onChange={(e) => setEditingItem({ ...editingItem, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
