'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Filter, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, Textarea, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionCreateEmailSegment,
  actionDeleteEmailSegment,
  actionListEmailSegments,
  actionPreviewEmailSegment,
  actionRecountEmailSegment,
} from '@/app/actions/email/audience.actions';
import type { EmailSegmentDoc } from '@/lib/rust-client/email-audience';
import type { EmailFilterTree } from '@/lib/email/types';
import { EmailSegmentBuilder, emptyFilterTree } from './segment-builder';

export function EmailSegmentsClient() {
  const [segments, setSegments] = useState<EmailSegmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await actionListEmailSegments();
    if (!result.ok) {
      toast({ title: 'Failed to load segments', description: result.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setSegments(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleDelete = async (seg: EmailSegmentDoc) => {
    const result = await actionDeleteEmailSegment(seg._id);
    if (!result.ok) {
      toast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Segment deleted' });
    await refresh();
  };

  const handleRecount = async (seg: EmailSegmentDoc) => {
    const result = await actionRecountEmailSegment(seg._id);
    if (!result.ok) {
      toast({ title: 'Recount failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Segment matches ${result.data.matches.toLocaleString()}` });
    await refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Filter className="h-6 w-6" /> Segments
            </span>
          </PageTitle>
          <PageDescription>
            Build dynamic groups of subscribers using filters on profile, tags, and engagement.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New segment
          </Button>
        </PageActions>
      </PageHeader>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : segments.length === 0 ? (
        <EmptyState
          icon={<Filter />}
          title="No segments yet"
          description="Create your first segment to target campaigns by engagement, tags, or custom fields."
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg) => (
            <Card key={seg._id} className="p-0">
              <CardHeader>
                <CardTitle>{seg.name}</CardTitle>
                <CardDescription>
                  {seg.description ?? `Combinator: ${seg.filter.combinator}, ${seg.filter.filters.length} rule${seg.filter.filters.length === 1 ? '' : 's'}`}
                </CardDescription>
              </CardHeader>
              <CardBody>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {seg.cachedCount?.toLocaleString() ?? '—'} matches
                  </Badge>
                  {seg.cachedAt ? (
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      updated {new Date(seg.cachedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </CardBody>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRecount(seg)}>
                  <RefreshCw className="h-3 w-3" /> Recount
                </Button>
                <Button variant="ghost" size="sm" className="text-[var(--st-text)] ml-auto" onClick={() => handleDelete(seg)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <NewSegmentDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refresh} />
    </div>
  );
}

interface NewSegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewSegmentDialog({ open, onOpenChange, onCreated }: NewSegmentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<EmailFilterTree>(emptyFilterTree());
  const [previewMatches, setPreviewMatches] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const handlePreview = () => {
    startTransition(async () => {
      const result = await actionPreviewEmailSegment({ filter, sampleSize: 5 });
      if (!result.ok) {
        toast({ title: 'Preview failed', description: result.error, variant: 'destructive' });
        return;
      }
      setPreviewMatches(result.data.matches);
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await actionCreateEmailSegment({
        name: name.trim(),
        description: description.trim() || undefined,
        filter,
      });
      if (!result.ok) {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Segment created' });
      onCreated();
      onOpenChange(false);
      setName('');
      setDescription('');
      setFilter(emptyFilterTree());
      setPreviewMatches(null);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New segment</DialogTitle>
          <DialogDescription>
            Filter subscribers by profile, tags, and engagement. Preview the match count before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="seg-name">Name</Label>
            <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seg-desc">Description</Label>
            <Textarea id="seg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Filters</Label>
            <EmailSegmentBuilder value={filter} onChange={setFilter} />
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center gap-2 justify-between">
          <div className="text-sm text-[var(--st-text-secondary)]">
            {previewMatches !== null ? (
              <Badge variant="outline">{previewMatches.toLocaleString()} matches</Badge>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={pending}>
              Preview matches
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? 'Saving…' : 'Save segment'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
