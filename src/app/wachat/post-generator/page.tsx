'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  EmptyState,
  Field,
  Spinner,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { Modal } from '@/components/sabcrm/20ui';
import {
  Copy,
  Lightbulb,
  Loader2,
  Sparkles,
  Facebook,
  MessageCircle,
  Save,
  Trash2,
  History,
  Send,
} from 'lucide-react';
import { mockFacebookDataString } from '@/lib/mock-data';
import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useProject } from '@/context/project-context';
import {
  getPostDrafts,
  savePostDraft,
  deletePostDraft,
  publishPostToFacebook,
  publishPostToWhatsappStatus,
  getPostPublishLog,
} from '@/app/actions/wachat-post-generator.actions';
import type {
  PostDraft,
  PublishLogEntry,
} from '@/lib/rust-client/wachat-post-generator';

type PublishChannel = 'facebook' | 'whatsapp-status';

/** Map a publish-log status to a Badge tone. */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'published':
      return 'success';
    case 'queued':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function channelLabel(channel: string): string {
  return channel === 'whatsapp-status' ? 'WhatsApp Status' : 'Facebook Page';
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function PostGeneratorPage() {
  const { toast } = useToast();
  const { activeProjectId } = useProject();
  const [publishTarget, setPublishTarget] = React.useState<string | null>(null);
  const [input, setInput] = React.useState(mockFacebookDataString);

  // --- Persistence + publish state (Rust crate) --------------------------
  const [drafts, setDrafts] = React.useState<PostDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = React.useState(false);
  const [draftsError, setDraftsError] = React.useState<string | null>(null);

  const [log, setLog] = React.useState<PublishLogEntry[]>([]);
  const [logLoading, setLogLoading] = React.useState(false);
  const [logError, setLogError] = React.useState<string | null>(null);

  // Tracks the suggestion currently being saved / published so individual
  // cards/buttons can show their own spinners without locking the whole page.
  const [busyText, setBusyText] = React.useState<string | null>(null);
  const [publishBusy, setPublishBusy] = React.useState<PublishChannel | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/wachat/post-generator/api' }),
    onError: (error) => {
      toast({
        title: 'Error generating suggestions',
        description: error.message || 'The AI provider might be slow or unavailable.',
        tone: 'danger',
      });
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // --- Load drafts + publish log for the active project ------------------
  const refreshDrafts = React.useCallback(async () => {
    if (!activeProjectId) {
      setDrafts([]);
      return;
    }
    setDraftsLoading(true);
    setDraftsError(null);
    const res = await getPostDrafts(activeProjectId);
    if (res.error) {
      setDraftsError(res.error);
      setDrafts([]);
    } else {
      setDrafts(res.drafts ?? []);
    }
    setDraftsLoading(false);
  }, [activeProjectId]);

  const refreshLog = React.useCallback(async () => {
    if (!activeProjectId) {
      setLog([]);
      return;
    }
    setLogLoading(true);
    setLogError(null);
    const res = await getPostPublishLog(activeProjectId);
    if (res.error) {
      setLogError(res.error);
      setLog([]);
    } else {
      setLog(res.entries ?? []);
    }
    setLogLoading(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    void refreshDrafts();
    void refreshLog();
  }, [refreshDrafts, refreshLog]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  // --- Save a suggestion as a draft --------------------------------------
  const handleSaveDraft = async (text: string) => {
    if (!activeProjectId) {
      toast({
        title: 'No project selected',
        description: 'Pick a WaChat project before saving drafts.',
        tone: 'warning',
      });
      return;
    }
    setBusyText(text);
    const res = await savePostDraft(activeProjectId, text);
    setBusyText(null);
    if (res.error) {
      toast({ title: 'Could not save draft', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Draft saved' });
    await refreshDrafts();
  };

  const handleDeleteDraft = async (draftId: string) => {
    setBusyText(draftId);
    const res = await deletePostDraft(draftId);
    setBusyText(null);
    if (res.error) {
      toast({ title: 'Could not delete draft', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Draft deleted' });
    await refreshDrafts();
  };

  // --- Publish flow ------------------------------------------------------
  const handlePublish = async (channel: PublishChannel) => {
    if (!publishTarget) return;
    if (!activeProjectId) {
      toast({
        title: 'No project selected',
        description: 'Pick a WaChat project before publishing.',
        tone: 'warning',
      });
      return;
    }
    setPublishBusy(channel);
    const action =
      channel === 'facebook' ? publishPostToFacebook : publishPostToWhatsappStatus;
    const res = await action(activeProjectId, { text: publishTarget });
    setPublishBusy(null);

    if (res.error) {
      toast({
        title: `Could not publish to ${channelLabel(channel)}`,
        description: res.error,
        tone: 'danger',
      });
      return;
    }

    const r = res.result;
    if (r?.status === 'published') {
      toast({
        title: 'Published to Facebook Page',
        description: r.postId ? `Post id: ${r.postId}` : 'Your post is live.',
      });
    } else if (r?.status === 'queued') {
      toast({
        title: 'Queued for WhatsApp Status',
        description: 'Your status intent was recorded.',
      });
    } else {
      toast({
        title: 'Publish recorded',
        description: r?.reason ?? 'See the publish history for details.',
        tone: 'warning',
      });
    }

    setPublishTarget(null);
    await refreshLog();
  };

  const lastMessage = messages[messages.length - 1];

  // Extract suggestions from the assistant's message. We split by "---" as instructed in the system prompt.
  const suggestions =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
          .split('---')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Post Generator' },
      ]}
      eyebrow="WaChat · AI"
      title="AI Post Generator"
      description="Paste your Facebook page data or use the bundled sample and the AI will draft post ideas you can save, repurpose, and publish to your connected channels."
    >
      {!activeProjectId ? (
        <Alert tone="warning" title="No project selected" className="mb-6">
          Choose a WaChat project to save drafts and publish posts. You can still
          generate and copy suggestions without one.
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 [color:var(--st-text-secondary)]" aria-hidden="true" />
              Source data
            </CardTitle>
            <CardDescription>
              Paste your Facebook page data below or use the sample to generate
              engaging post ideas.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Field label="Facebook Page Data">
                <Textarea
                  name="facebookData"
                  placeholder="Paste your data here…"
                  className="min-h-[250px]"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  required
                />
              </Field>
              <div className="flex items-center justify-between">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isLoading}
                  iconLeft={isLoading ? undefined : Sparkles}
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating…' : 'Generate Suggestions'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] tracking-tight [color:var(--st-text)]">
            Suggestions
          </h2>
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {suggestions.map((suggestion, index) => {
                const cardBusy = busyText === suggestion;
                return (
                  <Card key={index} variant="interactive">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed [color:var(--st-text)]">
                      {suggestion}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Copy}
                        onClick={() => handleCopy(suggestion)}
                        disabled={isLoading}
                      >
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Save}
                        loading={cardBusy}
                        disabled={isLoading || cardBusy || !activeProjectId}
                        onClick={() => handleSaveDraft(suggestion)}
                      >
                        Save draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={Send}
                        onClick={() => setPublishTarget(suggestion)}
                        disabled={isLoading}
                      >
                        Use post
                      </Button>
                    </div>
                  </Card>
                );
              })}
              {isLoading && (
                <div className="flex items-center justify-center p-4 [color:var(--st-text-secondary)]">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <span className="ml-2">AI is thinking...</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Suggestions appear here"
              description="Submit Facebook page data on the left and the AI will draft post ideas you can save, copy, or publish."
            />
          )}
        </div>
      </div>

      {/* Saved drafts */}
      <Card padding="none" className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-4 w-4 [color:var(--st-text-secondary)]" aria-hidden="true" />
            Saved drafts
          </CardTitle>
          <CardDescription>
            Posts you saved for this project. Reuse one to publish, or remove it.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {draftsError ? (
            <Alert tone="danger" title="Could not load drafts">
              {draftsError}
            </Alert>
          ) : draftsLoading ? (
            <div className="flex items-center gap-2 p-2 [color:var(--st-text-secondary)]">
              <Spinner size="sm" />
              <span className="text-[13px]">Loading drafts…</span>
            </div>
          ) : drafts.length === 0 ? (
            <EmptyState
              icon={Save}
              title="No saved drafts yet"
              description="Generate suggestions above and use “Save draft” to keep the ones you like."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {drafts.map((draft) => {
                const draftBusy = busyText === draft._id;
                return (
                  <Card key={draft._id} variant="outlined" padding="sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral" kind="soft">
                        {channelLabel(draft.channel)}
                      </Badge>
                      <span className="text-[12px] [color:var(--st-text-secondary)]">
                        {formatTs(draft.createdAt)}
                      </span>
                    </div>
                    {draft.title ? (
                      <p className="mt-2 text-[13px] font-medium [color:var(--st-text)]">
                        {draft.title}
                      </p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed [color:var(--st-text)]">
                      {draft.body}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Copy}
                        onClick={() => handleCopy(draft.body)}
                      >
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={Send}
                        onClick={() => setPublishTarget(draft.body)}
                      >
                        Use post
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        loading={draftBusy}
                        disabled={draftBusy}
                        onClick={() => handleDeleteDraft(draft._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Publish history */}
      <Card padding="none" className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 [color:var(--st-text-secondary)]" aria-hidden="true" />
            Publish history
          </CardTitle>
          <CardDescription>
            Every publish attempt for this project, newest first.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {logError ? (
            <Alert tone="danger" title="Could not load publish history">
              {logError}
            </Alert>
          ) : logLoading ? (
            <div className="flex items-center gap-2 p-2 [color:var(--st-text-secondary)]">
              <Spinner size="sm" />
              <span className="text-[13px]">Loading history…</span>
            </div>
          ) : log.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nothing published yet"
              description="Publish a suggestion or saved draft and the attempt shows up here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {log.map((entry) => (
                <Card key={entry._id} variant="outlined" padding="sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(entry.status)} kind="soft">
                        {entry.status}
                      </Badge>
                      <Badge tone="neutral" kind="outline">
                        {channelLabel(entry.channel)}
                      </Badge>
                    </div>
                    <span className="text-[12px] [color:var(--st-text-secondary)]">
                      {formatTs(entry.ts ?? entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed [color:var(--st-text)]">
                    {entry.text}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-[12px] [color:var(--st-danger,#dc2626)]">
                      {entry.reason}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Publish-post dialog */}
      <Modal
        open={publishTarget !== null}
        onClose={() => (publishBusy ? undefined : setPublishTarget(null))}
        title="Use this post?"
        description="Choose where you want to publish this suggestion or copy it to your clipboard."
        footer={
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                iconLeft={Facebook}
                className="w-full sm:w-auto"
                loading={publishBusy === 'facebook'}
                disabled={publishBusy !== null || !activeProjectId}
                onClick={() => handlePublish('facebook')}
              >
                Facebook Page
              </Button>
              <Button
                variant="outline"
                iconLeft={MessageCircle}
                className="w-full sm:w-auto"
                loading={publishBusy === 'whatsapp-status'}
                disabled={publishBusy !== null || !activeProjectId}
                onClick={() => handlePublish('whatsapp-status')}
              >
                WhatsApp Status
              </Button>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:mt-0 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={publishBusy !== null}
                onClick={() => setPublishTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                iconLeft={Copy}
                className="w-full sm:w-auto"
                disabled={publishBusy !== null}
                onClick={() => {
                  if (publishTarget) {
                    navigator.clipboard.writeText(publishTarget);
                    toast({
                      title: 'Ready to use',
                      description: 'Suggestion copied. Paste it into a broadcast or campaign.',
                    });
                  }
                  setPublishTarget(null);
                }}
              >
                Copy &amp; Use
              </Button>
            </div>
          </div>
        }
      >
        {!activeProjectId ? (
          <Alert tone="warning" title="No project selected" className="mb-3">
            Pick a WaChat project to publish. You can still copy the suggestion.
          </Alert>
        ) : null}
        {publishTarget ? (
          <Card variant="outlined" padding="sm" className="max-h-[200px] overflow-y-auto text-[13px] leading-relaxed">
            <p className="whitespace-pre-wrap [color:var(--st-text)]">{publishTarget}</p>
          </Card>
        ) : null}
      </Modal>
    </WachatPage>
  );
}
