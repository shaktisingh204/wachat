'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Filter, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruTextarea,
  zoruToast,
} from '@/components/zoruui';
import {
  actionCreateEmailSegment,
  actionDeleteEmailSegment,
  actionListEmailSegments,
  actionPreviewEmailSegment,
  actionRecountEmailSegment,
  type EmailSegmentDoc,
} from '@/app/actions/email/audience.actions';
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
      zoruToast({ title: 'Failed to load segments', description: result.error, variant: 'destructive' });
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
      zoruToast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
      return;
    }
    zoruToast({ title: 'Segment deleted' });
    await refresh();
  };

  const handleRecount = async (seg: EmailSegmentDoc) => {
    const result = await actionRecountEmailSegment(seg._id);
    if (!result.ok) {
      zoruToast({ title: 'Recount failed', description: result.error, variant: 'destructive' });
      return;
    }
    zoruToast({ title: `Segment matches ${result.data.matches.toLocaleString()}` });
    await refresh();
  };

  return (
    <div className="space-y-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Filter className="h-6 w-6" /> Segments
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Build dynamic groups of subscribers using filters on profile, tags, and engagement.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New segment
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <ZoruSkeleton className="h-40" />
          <ZoruSkeleton className="h-40" />
        </div>
      ) : segments.length === 0 ? (
        <ZoruEmptyState
          icon={<Filter />}
          title="No segments yet"
          description="Create your first segment to target campaigns by engagement, tags, or custom fields."
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg) => (
            <ZoruCard key={seg._id} className="p-0">
              <ZoruCardHeader>
                <ZoruCardTitle>{seg.name}</ZoruCardTitle>
                <ZoruCardDescription>
                  {seg.description ?? `Combinator: ${seg.filter.combinator}, ${seg.filter.filters.length} rule${seg.filter.filters.length === 1 ? '' : 's'}`}
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="flex items-center justify-between">
                  <ZoruBadge variant="outline">
                    {seg.cachedCount?.toLocaleString() ?? '—'} matches
                  </ZoruBadge>
                  {seg.cachedAt ? (
                    <span className="text-xs text-zoru-ink-muted">
                      updated {new Date(seg.cachedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </ZoruCardContent>
              <ZoruCardFooter className="gap-2">
                <ZoruButton variant="outline" size="sm" onClick={() => handleRecount(seg)}>
                  <RefreshCw className="h-3 w-3" /> Recount
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" className="text-destructive ml-auto" onClick={() => handleDelete(seg)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </ZoruButton>
              </ZoruCardFooter>
            </ZoruCard>
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
        zoruToast({ title: 'Preview failed', description: result.error, variant: 'destructive' });
        return;
      }
      setPreviewMatches(result.data.matches);
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      zoruToast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await actionCreateEmailSegment({
        name: name.trim(),
        description: description.trim() || undefined,
        filter,
      });
      if (!result.ok) {
        zoruToast({ title: 'Create failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: 'Segment created' });
      onCreated();
      onOpenChange(false);
      setName('');
      setDescription('');
      setFilter(emptyFilterTree());
      setPreviewMatches(null);
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-3xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>New segment</ZoruDialogTitle>
          <ZoruDialogDescription>
            Filter subscribers by profile, tags, and engagement. Preview the match count before saving.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <ZoruLabel htmlFor="seg-name">Name</ZoruLabel>
            <ZoruInput id="seg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <ZoruLabel htmlFor="seg-desc">Description</ZoruLabel>
            <ZoruTextarea id="seg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <ZoruLabel>Filters</ZoruLabel>
            <EmailSegmentBuilder value={filter} onChange={setFilter} />
          </div>
        </div>

        <ZoruDialogFooter className="flex flex-row items-center gap-2 justify-between">
          <div className="text-sm text-zoru-ink-muted">
            {previewMatches !== null ? (
              <ZoruBadge variant="outline">{previewMatches.toLocaleString()} matches</ZoruBadge>
            ) : null}
          </div>
          <div className="flex gap-2">
            <ZoruButton variant="outline" onClick={handlePreview} disabled={pending}>
              Preview matches
            </ZoruButton>
            <ZoruButton onClick={handleSubmit} disabled={pending}>
              {pending ? 'Saving…' : 'Save segment'}
            </ZoruButton>
          </div>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
