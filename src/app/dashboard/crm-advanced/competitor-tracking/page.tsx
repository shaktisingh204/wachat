'use client';

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Dialog, Input, Label, Badge, Card } from '@/components/zoruui';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/zoruui/dialog';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { getCompetitorTrackings, createCompetitorTracking, updateCompetitorTracking, deleteCompetitorTracking } from '@/app/actions/crm-advanced/competitor-tracking';
import type { CompetitorTrackingType } from '@/app/actions/crm-advanced/competitor-tracking.schema';

export default function CompetitorTrackingPage() {
  const [data, setData] = React.useState<CompetitorTrackingType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CompetitorTrackingType | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCompetitorTrackings();
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

  const handleOpenEdit = (item: CompetitorTrackingType) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteCompetitorTracking(id);
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
        await updateCompetitorTracking(editingItem._id, payload);
      } else {
        await createCompetitorTracking(payload);
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
        title="Competitor Tracking"
        subtitle="Manage your competitor tracking items."
        primaryAction={
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Record
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search Competitor Tracking...',
        }}
        loading={loading}
        empty={!loading && filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-zoru-line">
            <div className="w-12 h-12 bg-zoru-surface rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-zoru-ink-muted" />
            </div>
            <h3 className="text-lg font-medium text-zoru-ink">No records found</h3>
            <p className="text-sm text-zoru-ink-muted mt-1">Get started by creating a new record.</p>
            <Button className="mt-4" onClick={handleOpenCreate}>Create Record</Button>
          </div>
        ) : null}
      >
        {filteredData.length > 0 && (
          <Card className="overflow-hidden border border-zoru-line rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zoru-surface-2">
                  <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted capitalize">competitor Name</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted capitalize">market Share</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted capitalize">threat Level</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-zoru-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map(item => (
                    <tr key={item._id} className="hover:bg-zoru-surface transition-colors">
                <td className="px-4 py-2 border-t border-zoru-line text-sm text-zoru-ink">{item.competitorName}</td>
                <td className="px-4 py-2 border-t border-zoru-line text-sm text-zoru-ink">{item.marketShare}</td>
                <td className="px-4 py-2 border-t border-zoru-line text-sm">
                  <Badge variant="outline">{item.threatLevel}</Badge>
                </td>
                      <td className="px-4 py-2 border-t border-zoru-line text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-zoru-ink hover:text-zoru-ink hover:bg-zoru-ink/10" onClick={() => handleDelete(item._id)}>
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
            <DialogTitle>{editingItem ? 'Edit' : 'Create'} Competitor Tracking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
            <div>
              <Label className="capitalize">competitor Name</Label>
              <Input
                name="competitorName"
                type="text"
                defaultValue={editingItem ? editingItem.competitorName : ''}
                required
              />
            </div>
            <div>
              <Label className="capitalize">market Share</Label>
              <Input
                name="marketShare"
                type="number"
                defaultValue={editingItem ? editingItem.marketShare : ''}
                required
              />
            </div>
            <div>
              <Label className="capitalize">threat Level</Label>
              <select
                name="threatLevel"
                defaultValue={editingItem ? editingItem.threatLevel : 'low'}
                className="w-full flex h-10 rounded-md border border-zoru-line bg-zoru-bg px-3 py-2 text-sm text-zoru-ink outline-none focus-visible:ring-2 focus-visible:ring-zoru-brand"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
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
