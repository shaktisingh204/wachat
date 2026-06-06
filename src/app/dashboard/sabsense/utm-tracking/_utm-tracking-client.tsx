'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Plus, Pencil, Trash2, Wand2, Link2 } from 'lucide-react';
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
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createUtmLink,
  updateUtmLink,
  deleteUtmLink,
  generateOptimalUtmTags,
} from '@/app/actions/marketing/utm-tracking.actions';

export function UtmLinkClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form State
  const [url, setUrl] = useState<any>('');
  const [source, setSource] = useState<any>('');
  const [medium, setMedium] = useState<any>('');
  const [campaign, setCampaign] = useState<any>('');

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTags = async () => {
    setIsGenerating(true);
    try {
      const res = await generateOptimalUtmTags(url);
      if (res.success && res.data) {
        setSource(res.data.source);
        setMedium(res.data.medium);
        setCampaign(res.data.campaign);
        toast.success('Tags generated successfully.');
      } else {
        toast.error(res.error || 'Failed to generate tags.');
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setUrl('');
    setSource('');
    setMedium('');
    setCampaign('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setUrl(item.url || '');
    setSource(item.source || '');
    setMedium(item.medium || '');
    setCampaign(item.campaign || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      url,
      source,
      medium,
      campaign,
    };

    try {
      if (editingItem) {
        const res = await updateUtmLink(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Record updated successfully.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createUtmLink(payload);
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

    const res = await deleteUtmLink(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Record deleted.');
    } else {
      toast.error(res.error || 'Failed to delete record.');
    }
  };

  return (
    <EntityListShell
      title="UTM Tracking"
      subtitle="Manage your UTM Tracking seamlessly."
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
              <Field label="URL">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    placeholder="https://example.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    iconLeft={Wand2}
                    loading={isGenerating}
                    onClick={handleGenerateTags}
                    title="AI Suggest Tags"
                  >
                    Suggest
                  </Button>
                </div>
              </Field>

              <Field label="Source">
                <Input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </Field>

              <Field label="Medium">
                <Input
                  type="text"
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                />
              </Field>

              <Field label="Campaign">
                <Input
                  type="text"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                />
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
          icon={Link2}
          title="No records found"
          description="Create a UTM tracking link to start measuring your campaigns."
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
                <Th>URL</Th>
                <Th>Source</Th>
                <Th>Medium</Th>
                <Th>Campaign</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.url || '')}</Td>
                  <Td>{String(item.source || '')}</Td>
                  <Td>{String(item.medium || '')}</Td>
                  <Td>{String(item.campaign || '')}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Edit record" icon={Pencil} onClick={() => openEdit(item)} />
                      <IconButton
                        label="Delete record"
                        icon={Trash2}
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </EntityListShell>
  );
}
