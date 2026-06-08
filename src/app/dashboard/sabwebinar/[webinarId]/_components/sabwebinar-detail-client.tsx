'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  type BadgeTone,
  type BadgeStyleKind,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  ColorPicker,
  Dot,
  EmptyState,
  Field,
  Input,
  Progress,
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
  type ChartConfig,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  type Sabwebinar,
  type SabwebinarStatus,
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
import {
  ExternalLink,
  Play,
  StopCircle,
  Plus,
  Users,
  UserCheck,
  Activity,
  Clock,
  Target,
  Calendar,
  Gauge,
  Inbox,
  MessageSquare,
  BarChart3,
} from 'lucide-react';

const { BarChart, Bar, CartesianGrid, XAxis, YAxis } = Recharts;

const STATUS_BADGE: Record<
  SabwebinarStatus,
  { tone: BadgeTone; kind: BadgeStyleKind; label: string; dot?: boolean }
> = {
  draft: { tone: 'neutral', kind: 'outline', label: 'Draft' },
  scheduled: { tone: 'info', kind: 'soft', label: 'Scheduled' },
  live: { tone: 'success', kind: 'solid', label: 'Live', dot: true },
  ended: { tone: 'neutral', kind: 'soft', label: 'Ended' },
  cancelled: { tone: 'danger', kind: 'soft', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: SabwebinarStatus }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <Badge tone={badge.tone} kind={badge.kind}>
      {badge.dot ? <Dot tone="success" pulse aria-hidden="true" /> : null}
      {badge.label}
    </Badge>
  );
}

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
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{webinar.title}</PageTitle>
          <PageDescription>
            <span className="inline-flex flex-wrap items-center gap-2">
              <Link
                href={publicUrl}
                className="inline-flex items-center gap-1 underline underline-offset-2 transition-colors hover:text-[var(--st-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] rounded-sm"
              >
                {publicUrl} <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              <span className="text-[var(--st-text-tertiary)]" aria-hidden="true">·</span>
              <StatusBadge status={webinar.status} />
            </span>
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
  const conversionPct = Math.round((analytics.conversionRate ?? 0) * 100);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registered"
          value={analytics.registeredCount.toLocaleString()}
          icon={Users}
          accent="#3b7af5"
        />
        <StatCard
          label="Attended"
          value={analytics.attendedCount.toLocaleString()}
          icon={UserCheck}
          accent="#1f9d55"
        />
        <StatCard
          label="Peak concurrent"
          value={analytics.peakConcurrent.toLocaleString()}
          icon={Activity}
          accent="#7c3aed"
        />
        <StatCard
          label="Avg watch time"
          value={`${analytics.avgWatchTimeMinutes.toFixed(1)}m`}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <CardTitle>Schedule</CardTitle>
            </div>
            <CardDescription>When the broadcast runs and how many can attend.</CardDescription>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <ScheduleRow
                label="Scheduled"
                value={
                  webinar.scheduledStart
                    ? new Date(webinar.scheduledStart).toLocaleString()
                    : 'Not scheduled'
                }
              />
              <ScheduleRow
                label="Duration"
                value={webinar.durationMinutes ? `${webinar.durationMinutes} minutes` : '—'}
              />
              <ScheduleRow
                label="Capacity"
                value={
                  typeof webinar.capacity === 'number'
                    ? webinar.capacity.toLocaleString()
                    : 'Unlimited'
                }
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
              <CardTitle>Conversion</CardTitle>
            </div>
            <CardDescription>Share of registrants who attended.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-[var(--st-text)]">
                {conversionPct}%
              </span>
              <span className="text-sm text-[var(--st-text-secondary)] tabular-nums">
                {analytics.attendedCount.toLocaleString()} of{' '}
                {analytics.registeredCount.toLocaleString()}
              </span>
            </div>
            <Progress value={conversionPct} aria-label="Attendance conversion rate" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ScheduleRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </dt>
      <dd className="text-sm tabular-nums text-[var(--st-text)]">{value}</dd>
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
          <CardTitle>Registrations</CardTitle>
        </div>
        <CardDescription>
          {registrations.length.toLocaleString()} people signed up through the landing page.
        </CardDescription>
      </CardHeader>
      <CardBody className="p-0">
        <Table hover>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Company</Th>
              <Th>Source</Th>
              <Th>Registered</Th>
              <Th>Attendance</Th>
            </Tr>
          </THead>
          <TBody>
            {registrations.map((r) => (
              <Tr key={r._id}>
                <Td>
                  <span className="font-medium text-[var(--st-text)]">{r.name}</span>
                </Td>
                <Td>
                  <span className="text-[var(--st-text-secondary)]">{r.email}</span>
                </Td>
                <Td>
                  <span className="text-[var(--st-text-secondary)]">{r.company ?? '—'}</span>
                </Td>
                <Td>
                  <Badge tone="neutral" kind="soft">
                    {r.source ?? 'direct'}
                  </Badge>
                </Td>
                <Td>
                  <span className="tabular-nums text-[var(--st-text-secondary)]">
                    {new Date(r.registeredAt).toLocaleString()}
                  </span>
                </Td>
                <Td>
                  {r.joinedAt ? (
                    <Badge tone="success" kind="soft" dot>
                      Attended
                    </Badge>
                  ) : (
                    <Badge tone="neutral" kind="outline">
                      Registered
                    </Badge>
                  )}
                </Td>
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

const SOURCE_CHART_CONFIG = {
  count: { label: 'Registrations', color: 'var(--st-accent)' },
} satisfies ChartConfig;

function AnalyticsTab({ analytics }: { analytics: SabwebinarAnalytics }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Registered"
          value={analytics.registeredCount.toLocaleString()}
          icon={Users}
          accent="#3b7af5"
        />
        <StatCard
          label="Attended"
          value={analytics.attendedCount.toLocaleString()}
          icon={UserCheck}
          accent="#1f9d55"
        />
        <StatCard
          label="Peak concurrent"
          value={analytics.peakConcurrent.toLocaleString()}
          icon={Activity}
          accent="#7c3aed"
        />
        <StatCard
          label="Avg watch time"
          value={`${analytics.avgWatchTimeMinutes.toFixed(1)}m`}
          icon={Clock}
        />
        <StatCard
          label="Conversion"
          value={`${(analytics.conversionRate * 100).toFixed(1)}%`}
          icon={Gauge}
        />
        <StatCard label="Poll votes" value={analytics.pollEngagementCount.toLocaleString()} icon={Inbox} />
        <StatCard label="Q&A items" value={analytics.qnaCount.toLocaleString()} icon={MessageSquare} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
            <CardTitle>Registrations by source</CardTitle>
          </div>
          <CardDescription>Where your attendees came from.</CardDescription>
        </CardHeader>
        <CardBody>
          {analytics.registrationsBySource.length === 0 ? (
            <EmptyState
              icon={Users}
              size="sm"
              title="No registrations yet"
              description="The source breakdown appears once people sign up."
            />
          ) : (
            <ChartContainer config={SOURCE_CHART_CONFIG} className="h-[280px] w-full">
              <BarChart
                data={analytics.registrationsBySource}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--st-border)" strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  tickLine={false}
                  axisLine={false}
                  width={88}
                  fontSize={12}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
