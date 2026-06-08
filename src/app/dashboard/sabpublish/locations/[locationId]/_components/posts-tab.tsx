'use client';

import * as React from 'react';
import { CalendarClock, ImagePlus, Megaphone, Send } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
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
      setError('Write something before publishing.');
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
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone size={16} aria-hidden="true" />
            <CardTitle>New post</CardTitle>
          </div>
          <CardDescription>
            Publish an update to every connected listing at once.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Post body">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's new at your business?"
            />
          </Field>

          <div className="space-y-2">
            <Label>Providers</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
            <Field label="Schedule for" help="Leave blank to publish immediately.">
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </Field>
            <div className="space-y-2">
              <Label>Media</Label>
              <SabFilePickerButton
                accept="image"
                onPick={(pick) =>
                  setMediaFileIds((prev) => [...prev, pick.id])
                }
              >
                <ImagePlus size={14} aria-hidden="true" />
                Add from library
              </SabFilePickerButton>
              {mediaFileIds.length > 0 ? (
                <p className="text-xs text-[var(--st-text-secondary)] tabular-nums">
                  {mediaFileIds.length} file
                  {mediaFileIds.length === 1 ? '' : 's'} attached
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <Alert tone="danger" title="Could not save post">
              {error}
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={() => handlePublish(false)}
              loading={pending}
            >
              Publish now
            </Button>
            <Button
              variant="secondary"
              iconLeft={CalendarClock}
              onClick={() => handlePublish(true)}
              disabled={pending || !scheduleAt}
            >
              Schedule
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock size={16} aria-hidden="true" />
            <CardTitle>Recent posts</CardTitle>
          </div>
          <CardDescription>Everything you have drafted or sent.</CardDescription>
        </CardHeader>
        <CardBody>
          {posts.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No posts yet"
              description="Your published and scheduled posts will appear here."
            />
          ) : (
            <ul className="flex list-none flex-col gap-3 p-0">
              {posts.map((p) => (
                <li
                  key={p._id}
                  className="space-y-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>
                      {p.status}
                    </Badge>
                    <span className="text-xs text-[var(--st-text-secondary)] tabular-nums">
                      {p.scheduleAt
                        ? `Scheduled for ${new Date(p.scheduleAt).toLocaleString()}`
                        : p.publishedAt
                          ? `Published ${new Date(p.publishedAt).toLocaleString()}`
                          : ''}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--st-text)]">{p.body}</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    Providers: {(p.providerIds ?? []).join(', ') || 'None'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
