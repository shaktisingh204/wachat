'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  ColorPicker,
  EmptyState,
  Field,
  Input,
  Textarea,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  type Sabwebinar,
  type SabwebinarAnalytics,
  type SabwebinarPoll,
  type SabwebinarQnaItem,
  type SabwebinarRegistration,
  endSabwebinar,
  startSabwebinar,
  updateSabwebinar,
  createSabwebinarPoll,
  setSabwebinarPollStatus,
  answerSabwebinarQuestion,
} from '@/app/actions/sabwebinar.actions';
import { ExternalLink, Play, StopCircle, Plus, Users, Inbox, MessageSquare } from 'lucide-react';

interface Props {
  webinar: Sabwebinar;
  registrations: SabwebinarRegistration[];
  polls: SabwebinarPoll[];
  qna: SabwebinarQnaItem[];
  analytics: SabwebinarAnalytics;
}

export function SabwebinarDetailClient({
  webinar,
  registrations,
  polls,
  qna,
  analytics,
}: Props) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const publicUrl = `/webinar/${webinar.slug}`;

  const onStart = () =>
    startTransition(async () => {
      await startSabwebinar(webinar._id);
      toast.success('Broadcast started');
    });
  const onEnd = () =>
    startTransition(async () => {
      await endSabwebinar(webinar._id);
      toast.success('Broadcast ended');
    });

  return (
    <div className="ui20 flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{webinar.title}</PageTitle>
          <PageDescription>
            <Link href={publicUrl} className="inline-flex items-center gap-1 underline">
              {publicUrl} <ExternalLink className="size-3" aria-hidden="true" />
            </Link>{' '}
            <span className="text-[var(--st-text-tertiary)]">·</span>{' '}
            <Badge tone="neutral">{webinar.status}</Badge>
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          {webinar.status !== 'live' ? (
            <Button
              variant="primary"
              iconLeft={Play}
              onClick={onStart}
              disabled={busy || webinar.status === 'ended'}
            >
              Start broadcast
            </Button>
          ) : (
            <Button variant="danger" iconLeft={StopCircle} onClick={onEnd} disabled={busy}>
              End broadcast
            </Button>
          )}
        </PageActions>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="landing">Landing</TabsTrigger>
          <TabsTrigger value="registrations">
            Registrations ({registrations.length})
          </TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="polls">Polls ({polls.length})</TabsTrigger>
          <TabsTrigger value="qna">Q&amp;A ({qna.length})</TabsTrigger>
          <TabsTrigger value="recording">Recording</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab webinar={webinar} analytics={analytics} />
        </TabsContent>

        <TabsContent value="landing" className="mt-4">
          <LandingTab webinar={webinar} />
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <RegistrationsTab registrations={registrations} />
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          <LiveTab webinar={webinar} />
        </TabsContent>

        <TabsContent value="polls" className="mt-4">
          <PollsTab webinarId={webinar._id} polls={polls} />
        </TabsContent>

        <TabsContent value="qna" className="mt-4">
          <QnaTab items={qna} />
        </TabsContent>

        <TabsContent value="recording" className="mt-4">
          <RecordingTab webinar={webinar} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab analytics={analytics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({
  webinar,
  analytics,
}: {
  webinar: Sabwebinar;
  analytics: SabwebinarAnalytics;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Registered" value={analytics.registeredCount} />
      <StatCard label="Attended" value={analytics.attendedCount} />
      <StatCard label="Peak concurrent" value={analytics.peakConcurrent} />
      <StatCard
        label="Avg watch (min)"
        value={analytics.avgWatchTimeMinutes.toFixed(1)}
      />
      <Card className="md:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
          <div>
            <strong>Scheduled:</strong>{' '}
            {webinar.scheduledStart
              ? new Date(webinar.scheduledStart).toLocaleString()
              : 'Not scheduled'}
          </div>
          <div>
            <strong>Duration:</strong> {webinar.durationMinutes ?? '-'} minutes
          </div>
          <div>
            <strong>Capacity:</strong> {webinar.capacity ?? 'Unlimited'}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function LandingTab({ webinar }: { webinar: Sabwebinar }) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const [theme, setTheme] = React.useState({
    headline: webinar.landingTheme?.headline ?? '',
    subHeadline: webinar.landingTheme?.subHeadline ?? '',
    accentColor: webinar.landingTheme?.accentColor ?? '#2563eb',
    backgroundColor: webinar.landingTheme?.backgroundColor ?? '#0b0d12',
    textColor: webinar.landingTheme?.textColor ?? '#ffffff',
    ctaLabel: webinar.landingTheme?.ctaLabel ?? 'Register',
    hostBio: webinar.landingTheme?.hostBio ?? '',
  });
  const [heroFileId, setHeroFileId] = React.useState(webinar.heroFileId ?? '');

  const onSave = () =>
    startTransition(async () => {
      await updateSabwebinar(webinar._id, {
        landingTheme: theme,
        heroFileId: heroFileId || undefined,
      });
      toast.success('Landing page saved');
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Landing page</CardTitle>
        <CardDescription>
          Public URL:{' '}
          <Link href={`/webinar/${webinar.slug}`} className="underline">
            /webinar/{webinar.slug}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <Field label="Hero image (from SabFiles)">
          <SabFilePickerButton
            accept="image"
            onPick={(pick) => setHeroFileId(pick?.id ?? '')}
          >
            {heroFileId ? 'Change hero image' : 'Choose hero image'}
          </SabFilePickerButton>
        </Field>
        <Field label="Headline">
          <Input
            value={theme.headline}
            onChange={(e) => setTheme({ ...theme, headline: e.target.value })}
            placeholder={webinar.title}
          />
        </Field>
        <Field label="Sub-headline">
          <Input
            value={theme.subHeadline}
            onChange={(e) => setTheme({ ...theme, subHeadline: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Accent color">
            <ColorPicker
              value={theme.accentColor}
              onChange={(color) => setTheme({ ...theme, accentColor: color })}
            />
          </Field>
          <Field label="Background">
            <ColorPicker
              value={theme.backgroundColor}
              onChange={(color) => setTheme({ ...theme, backgroundColor: color })}
            />
          </Field>
          <Field label="Text color">
            <ColorPicker
              value={theme.textColor}
              onChange={(color) => setTheme({ ...theme, textColor: color })}
            />
          </Field>
        </div>
        <Field label="CTA label">
          <Input
            value={theme.ctaLabel}
            onChange={(e) => setTheme({ ...theme, ctaLabel: e.target.value })}
          />
        </Field>
        <Field label="Host bio">
          <Textarea
            rows={3}
            value={theme.hostBio}
            onChange={(e) => setTheme({ ...theme, hostBio: e.target.value })}
          />
        </Field>
        <div>
          <Button variant="primary" onClick={onSave} disabled={busy} loading={busy}>
            {busy ? 'Saving' : 'Save landing'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function RegistrationsTab({
  registrations,
}: {
  registrations: SabwebinarRegistration[];
}) {
  if (registrations.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={Users}
            title="No registrations yet"
            description="Share the public landing page to start collecting sign-ups."
          />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card padding="none">
      <CardBody className="p-0">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Company</Th>
              <Th>Source</Th>
              <Th>Registered</Th>
              <Th>Joined</Th>
            </Tr>
          </THead>
          <TBody>
            {registrations.map((r) => (
              <Tr key={r._id}>
                <Td>{r.name}</Td>
                <Td>{r.email}</Td>
                <Td>{r.company ?? '-'}</Td>
                <Td>{r.source ?? 'direct'}</Td>
                <Td>{new Date(r.registeredAt).toLocaleString()}</Td>
                <Td>{r.joinedAt ? new Date(r.joinedAt).toLocaleString() : '-'}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}

function LiveTab({ webinar }: { webinar: Sabwebinar }) {
  const isLive = webinar.status === 'live';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Stream preview</CardTitle>
          <CardDescription>
            {isLive
              ? 'Mock HLS stream. Replace with Mux, Cloudflare Stream, or LiveKit Egress.'
              : 'Start the broadcast to enable preview.'}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex aspect-video w-full items-center justify-center rounded-[var(--st-radius)] bg-black text-white">
            {isLive ? (
              <p className="text-sm text-white/70">Live stream URL bound via IWebinarTransport</p>
            ) : (
              <p className="text-sm text-white/50">Offline</p>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Live console</CardTitle>
          <CardDescription>Chat, presence, polls, Q&amp;A controls.</CardDescription>
        </CardHeader>
        <CardBody className="text-sm text-[var(--st-text-secondary)]">
          Open the dedicated tabs (Polls, Q&amp;A) to manage during the broadcast.
        </CardBody>
      </Card>
    </div>
  );
}

function PollsTab({
  webinarId,
  polls,
}: {
  webinarId: string;
  polls: SabwebinarPoll[];
}) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const [question, setQuestion] = React.useState('');
  const [options, setOptions] = React.useState<string[]>(['', '']);

  const updateOption = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };

  const onCreate = () =>
    startTransition(async () => {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2 || !question.trim()) {
        toast.error('Add a question and at least two options');
        return;
      }
      await createSabwebinarPoll({ webinarId, question: question.trim(), options: clean });
      toast.success('Poll created');
      setQuestion('');
      setOptions(['', '']);
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>New poll</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Field label="Question">
            <Input
              placeholder="What should we cover next?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </Field>
          {options.map((o, i) => (
            <Field key={i} label={`Option ${i + 1}`}>
              <Input
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => updateOption(i, e.target.value)}
              />
            </Field>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" iconLeft={Plus} onClick={() => setOptions([...options, ''])}>
              Option
            </Button>
            <Button variant="primary" onClick={onCreate} disabled={busy} loading={busy}>
              Create poll
            </Button>
          </div>
        </CardBody>
      </Card>

      {polls.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Inbox}
              title="No polls yet"
              description="Create your first poll to gather audience feedback live."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {polls.map((p) => (
            <PollRow key={p._id} poll={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PollRow({ poll }: { poll: SabwebinarPoll }) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
  const next = poll.status === 'draft' ? 'open' : poll.status === 'open' ? 'closed' : 'closed';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{poll.question}</CardTitle>
          <Badge tone="neutral">{poll.status}</Badge>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {poll.options.map((o) => {
          const pct = totalVotes > 0 ? Math.round((o.voteCount / totalVotes) * 100) : 0;
          return (
            <div key={o.id} className="flex items-center justify-between text-sm">
              <span>{o.label}</span>
              <span className="text-[var(--st-text-secondary)]">
                {o.voteCount} ({pct}%)
              </span>
            </div>
          );
        })}
        {poll.status !== 'closed' ? (
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              loading={busy}
              onClick={() =>
                startTransition(async () => {
                  await setSabwebinarPollStatus(poll._id, next);
                  toast.success(poll.status === 'draft' ? 'Poll opened' : 'Poll closed');
                })
              }
            >
              {poll.status === 'draft' ? 'Open' : 'Close'} poll
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function QnaTab({ items }: { items: SabwebinarQnaItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={MessageSquare}
            title="No questions yet"
            description="Audience questions will appear here as they come in."
          />
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((q) => (
        <QnaRow key={q._id} item={q} />
      ))}
    </div>
  );
}

function QnaRow({ item }: { item: SabwebinarQnaItem }) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const [answer, setAnswer] = React.useState('');
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{item.question}</CardTitle>
          <Badge tone="neutral">{item.upvotes} upvotes</Badge>
        </div>
        <CardDescription>
          {item.askerName ?? 'Anonymous'}{' '}
          <span className="text-[var(--st-text-tertiary)]">·</span>{' '}
          {new Date(item.createdAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {item.answered ? (
          <p className="text-sm">
            <strong>Answer:</strong> {item.answer}
          </p>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Answer">
                <Input
                  placeholder="Type your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={busy || !answer.trim()}
              loading={busy}
              onClick={() =>
                startTransition(async () => {
                  await answerSabwebinarQuestion(item._id, answer.trim());
                  toast.success('Answer posted');
                  setAnswer('');
                })
              }
            >
              Answer
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RecordingTab({ webinar }: { webinar: Sabwebinar }) {
  const { toast } = useToast();
  const [busy, startTransition] = React.useTransition();
  const [fileId, setFileId] = React.useState(webinar.recordingFileId ?? '');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Post-event recording</CardTitle>
        <CardDescription>Upload via SabFiles. No external URL paste.</CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <Field label="Recording file (from SabFiles)">
          <SabFilePickerButton
            accept="video"
            onPick={(pick) => setFileId(pick?.id ?? '')}
          >
            {fileId ? 'Change recording' : 'Choose recording'}
          </SabFilePickerButton>
        </Field>
        <div>
          <Button
            variant="primary"
            disabled={busy || !fileId}
            loading={busy}
            onClick={() =>
              startTransition(async () => {
                await updateSabwebinar(webinar._id, { recordingFileId: fileId });
                toast.success('Recording attached');
              })
            }
          >
            {busy ? 'Saving' : 'Attach recording'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AnalyticsTab({ analytics }: { analytics: SabwebinarAnalytics }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Registered" value={analytics.registeredCount} />
      <StatCard label="Attended" value={analytics.attendedCount} />
      <StatCard label="Peak concurrent" value={analytics.peakConcurrent} />
      <StatCard
        label="Avg watch (min)"
        value={analytics.avgWatchTimeMinutes.toFixed(1)}
      />
      <StatCard
        label="Conversion"
        value={`${(analytics.conversionRate * 100).toFixed(1)}%`}
      />
      <StatCard label="Poll votes" value={analytics.pollEngagementCount} />
      <StatCard label="Q&A items" value={analytics.qnaCount} />
      <Card className="md:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Registrations by source</CardTitle>
        </CardHeader>
        <CardBody>
          {analytics.registrationsBySource.length === 0 ? (
            <EmptyState
              icon={Users}
              size="sm"
              title="No registrations yet"
              description="Source breakdown appears once people sign up."
            />
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {analytics.registrationsBySource.map((s) => (
                <li key={s.source} className="flex justify-between">
                  <span>{s.source}</span>
                  <span className="text-[var(--st-text-secondary)]">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
