'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, SearchX } from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
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
  SearchInput,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createAudienceSegment,
  updateAudienceSegment,
  deleteAudienceSegment,
} from '@/app/actions/marketing/audience-segmentation.actions';

interface Segment {
  _id: string;
  name?: string;
  [key: string]: unknown;
}

export function AudienceSegmentClient({ initialData }: { initialData: Segment[] }) {
  const [data, setData] = useState<Segment[]>(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Segment | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState('');

  const filteredData = useMemo(
    () =>
      data.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );

  const openNew = () => {
    setEditingItem(null);
    setName('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: Segment) => {
    setEditingItem(item);
    setName(item.name || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = { name };

    try {
      if (editingItem) {
        const res = await updateAudienceSegment(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Segment updated.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Could not update the segment.');
        }
      } else {
        const res = await createAudienceSegment(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast.error(res.error || 'Could not create the segment.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this audience segment?')) return;

    const res = await deleteAudienceSegment(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Segment deleted.');
    } else {
      toast.error(res.error || 'Could not delete the segment.');
    }
  };

  const dialog = (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" iconLeft={Plus} onClick={openNew}>
          New segment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit segment' : 'Create a segment'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Field label="Segment name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-intent shoppers"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>
            {editingItem ? 'Save changes' : 'Create segment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Audience segmentation</PageTitle>
          <PageDescription>
            Group your contacts into reusable segments to target campaigns more precisely.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{dialog}</PageActions>
      </PageHeader>

      <section aria-label="Segment overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total segments" value={data.length.toLocaleString()} icon={Users} accent="#3b7af5" />
      </section>

      <Card padding="none">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
          <div>
            <CardTitle>Segments</CardTitle>
            <CardDescription>
              {filteredData.length} of {data.length} segments
            </CardDescription>
          </div>
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search segments"
              aria-label="Search audience segments"
            />
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={search ? SearchX : Users}
              title={search ? 'No segments match your search' : 'No segments yet'}
              description={
                search
                  ? 'Try a different name.'
                  : 'Create your first segment to start targeting the right audience.'
              }
              action={
                search ? undefined : (
                  <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                    New segment
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">{String(item.name || 'Untitled segment')}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit segment"
                        icon={Pencil}
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete segment"
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
