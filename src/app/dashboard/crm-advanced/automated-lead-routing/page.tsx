'use client';

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Dialog, Input, Label, Badge, Card } from '@/components/sabcrm/20ui/compat';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/sabcrm/20ui/compat';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { getAutomatedLeadRoutings, createAutomatedLeadRouting, updateAutomatedLeadRouting, deleteAutomatedLeadRouting } from '@/app/actions/crm-advanced/automated-lead-routing';
import type { AutomatedLeadRoutingType } from '@/app/actions/crm-advanced/automated-lead-routing.schema';

export default function AutomatedLeadRoutingPage() {
  const [data, setData] = React.useState<AutomatedLeadRoutingType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<AutomatedLeadRoutingType | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAutomatedLeadRoutings();
      if (res.success) setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = data.filter(item => 
    Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: AutomatedLeadRoutingType) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteAutomatedLeadRouting(id);
      loadData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      
      if (editingItem) {
        await updateAutomatedLeadRouting(editingItem._id, payload);
      } else {
        await createAutomatedLeadRouting(payload);
      }
      setIsDialogOpen(false);
      loadData();
    } catch (err) {
      console.error('Submit failed', err);
      alert('Validation error. Check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <EntityListShell
        title="Automated Lead Routing"
        subtitle="Manage your automated lead routing items."
        primaryAction={
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Record
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search Automated Lead Routing...',
        }}
        loading={loading}
        empty={!loading && filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-[var(--st-border)]">
            <div className="w-12 h-12 bg-[var(--st-bg-secondary)] rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-[var(--st-text-secondary)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--st-text)]">No records found</h3>
            <p className="text-sm text-[var(--st-text-secondary)] mt-1">Get started by creating a new record.</p>
            <Button className="mt-4" onClick={handleOpenCreate}>Create Record</Button>
          </div>
        ) : null}
      >
        {filteredData.length > 0 && (
          <Card className="overflow-hidden border border-[var(--st-border)] rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--st-bg-muted)]">
                  <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-[var(--st-text-secondary)] capitalize">name</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-[var(--st-text-secondary)] capitalize">status</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-[var(--st-text-secondary)] capitalize">logic</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-[var(--st-text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map(item => (
                    <tr key={item._id} className="hover:bg-[var(--st-bg-secondary)] transition-colors">
                <td className="px-4 py-2 border-t border-[var(--st-border)] text-sm text-[var(--st-text)]">{item.name}</td>
                <td className="px-4 py-2 border-t border-[var(--st-border)] text-sm">
                  <Badge variant="outline">{item.status}</Badge>
                </td>
                <td className="px-4 py-2 border-t border-[var(--st-border)] text-sm text-[var(--st-text)]">{item.logic}</td>
                      <td className="px-4 py-2 border-t border-[var(--st-border)] text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-text)]/10" onClick={() => handleDelete(item._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </EntityListShell>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Create'} Automated Lead Routing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
            <div>
              <Label className="capitalize">name</Label>
              <Input
                name="name"
                type="text"
                defaultValue={editingItem ? editingItem.name : ''}
                required
              />
            </div>
            <div>
              <Label className="capitalize">status</Label>
              <select
                name="status"
                defaultValue={editingItem ? editingItem.status : 'active'}
                className="w-full flex h-10 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div>
              <Label className="capitalize">logic</Label>
              <Input
                name="logic"
                type="text"
                defaultValue={editingItem ? editingItem.logic : ''}
                required
              />
            </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
