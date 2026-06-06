'use client';

import * as React from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  Textarea,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  createSabpublishPost,
  publishSabpublishPostNow,
  schedulePost,
} from '@/app/actions/sabpublish.actions';
import type { SabpublishPostDoc } from '@/lib/rust-client/sabpublish-posts';
import {
  ALL_SABPUBLISH_PROVIDER_IDS,
  SABPUBLISH_PROVIDER_LABELS,
  type SabpublishProviderId,
} from '@/lib/sabpublish/provider-ids';

const STATUS_TONE: Record<string, BadgeTone> = {
  published: 'success',
  scheduled: 'info',
  draft: 'neutral',
  failed: 'danger',
};

export function SabpublishPostsTab({
  locationId,
  initial,
}: {
  locationId: string;
  initial: SabpublishPostDoc[];
}) {
  const [posts, setPosts] = React.useState(initial);
  const [body, setBody] = React.useState('');
  const [scheduleAt, setScheduleAt] = React.useState('');
  const [selectedProviders, setSelectedProviders] = React.useState<
    SabpublishProviderId[]
  >([...ALL_SABPUBLISH_PROVIDER_IDS] as SabpublishProviderId[]);
  const [mediaFileIds, setMediaFileIds] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggleProvider(p: SabpublishProviderId) {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handlePublish(scheduled: boolean) {
    setError(null);
    if (!body.trim()) {
      setError('Body is required');
      return;
    }
    const scheduleAtMs = scheduleAt ? new Date(scheduleAt).getTime() : undefined;
    startTransition(async () => {
      const action = scheduled ? schedulePost : createSabpublishPost;
      const res = await action({
        locationId,
        body,
        providerIds: selectedProviders,
        mediaFileIds,
        scheduleAtMs,
        status: scheduled ? 'scheduled' : 'draft',
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      let saved = res.data;
      if (!scheduled) {
        const pubRes = await publishSabpublishPostNow(saved._id);
        if (pubRes.ok) saved = pubRes.data;
      }
      setPosts((p) => [saved, ...p]);
      setBody('');
      setScheduleAt('');
      setMediaFileIds([]);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4 p-6">
          <Field label="Post body">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's new at your business?"
            />
          </Field>
          <div>
            <Label>Providers</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ALL_SABPUBLISH_PROVIDER_IDS.map((p) => (
                <Checkbox
                  key={p}
                  checked={selectedProviders.includes(p)}
                  onChange={() => toggleProvider(p)}
                  label={SABPUBLISH_PROVIDER_LABELS[p]}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Schedule for (optional)">
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </Field>
            <div className="space-y-2">
              <Label>Media (from SabFiles)</Label>
              <SabFilePickerButton
                accept="image"
                onPick={(pick) =>
                  setMediaFileIds((prev) => [...prev, pick.id])
                }
              >
                Add media from library
              </SabFilePickerButton>
              {mediaFileIds.length > 0 ? (
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {mediaFileIds.length} file(s) attached
                </div>
              ) : null}
            </div>
          </div>
          {error ? (
            <Alert tone="danger" title="Could not save post">
              {error}
            </Alert>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => handlePublish(false)}
              loading={pending}
            >
              {pending ? 'Publishing...' : 'Publish now'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePublish(true)}
              disabled={pending || !scheduleAt}
            >
              Schedule
            </Button>
          </div>
        </CardBody>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--st-text-secondary)]">
          Recent posts
        </h3>
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Your published and scheduled posts will appear here."
          />
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p._id}>
                <CardBody className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>
                      {p.status}
                    </Badge>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {p.scheduleAt
                        ? `Scheduled for ${new Date(p.scheduleAt).toLocaleString()}`
                        : p.publishedAt
                          ? `Published ${new Date(p.publishedAt).toLocaleString()}`
                          : ''}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--st-text)]">{p.body}</p>
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    Providers: {(p.providerIds ?? []).join(', ') || '-'}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
