'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, CardDescription, Input, Label, Textarea, PageHeader, PageTitle, PageDescription, PageActions, StatCard, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui';
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
import { ExternalLink, Play, StopCircle, Plus } from 'lucide-react';

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
  const [busy, startTransition] = React.useTransition();
  const publicUrl = `/webinar/${webinar.slug}`;

  const onStart = () =>
    startTransition(async () => {
      await startSabwebinar(webinar._id);
    });
  const onEnd = () =>
    startTransition(async () => {
      await endSabwebinar(webinar._id);
    });

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageTitle>{webinar.title}</PageTitle>
        <PageDescription>
          <Link href={publicUrl} className="inline-flex items-center gap-1 underline">
            {publicUrl} <ExternalLink className="size-3" />
          </Link>{' '}
          · <Badge variant="secondary">{webinar.status}</Badge>
        </PageDescription>
        <PageActions>
          {webinar.status !== 'live' ? (
            <Button onClick={onStart} disabled={busy || webinar.status === 'ended'}>
              <Play className="size-4" /> Start broadcast
            </Button>
          ) : (
            <Button variant="destructive" onClick={onEnd} disabled={busy}>
              <StopCircle className="size-4" /> End broadcast
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
            <strong>Duration:</strong> {webinar.durationMinutes ?? '—'} minutes
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
        <div className="flex flex-col gap-2">
          <Label>Hero image (from SabFiles)</Label>
          <SabFilePickerButton
            accept="image"
            value={heroFileId ? { fileId: heroFileId } : undefined}
            onPick={(pick) => setHeroFileId(pick?.fileId ?? '')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={theme.headline}
            onChange={(e) => setTheme({ ...theme, headline: e.target.value })}
            placeholder={webinar.title}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="subHeadline">Sub-headline</Label>
          <Input
            id="subHeadline"
            value={theme.subHeadline}
            onChange={(e) => setTheme({ ...theme, subHeadline: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="accent">Accent color</Label>
            <Input
              id="accent"
              type="color"
              value={theme.accentColor}
              onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bg">Background</Label>
            <Input
              id="bg"
              type="color"
              value={theme.backgroundColor}
              onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="text">Text color</Label>
            <Input
              id="text"
              type="color"
              value={theme.textColor}
              onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cta">CTA label</Label>
          <Input
            id="cta"
            value={theme.ctaLabel}
            onChange={(e) => setTheme({ ...theme, ctaLabel: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bio">Host bio</Label>
          <Textarea
            id="bio"
            rows={3}
            value={theme.hostBio}
            onChange={(e) => setTheme({ ...theme, hostBio: e.target.value })}
          />
        </div>
        <div>
          <Button onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save landing'}
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
    return <p className="text-sm opacity-70">No registrations yet.</p>;
  }
  return (
    <Card>
      <CardBody className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Registered</th>
              <th className="px-3 py-2 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r._id} className="border-b last:border-0">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.company ?? '—'}</td>
                <td className="px-3 py-2">{r.source ?? 'direct'}</td>
                <td className="px-3 py-2">
                  {new Date(r.registeredAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {r.joinedAt ? new Date(r.joinedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              ? 'Mock HLS stream — replace with Mux / Cloudflare Stream / LiveKit Egress.'
              : 'Start the broadcast to enable preview.'}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex aspect-video w-full items-center justify-center rounded-md bg-black text-white">
            {isLive ? (
              <p className="text-sm opacity-70">Live stream URL bound via IWebinarTransport</p>
            ) : (
              <p className="text-sm opacity-50">Offline</p>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Live console</CardTitle>
          <CardDescription>Chat, presence, polls, Q&amp;A controls.</CardDescription>
        </CardHeader>
        <CardBody className="text-sm opacity-70">
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
      if (clean.length < 2 || !question.trim()) return;
      await createSabwebinarPoll({ webinarId, question: question.trim(), options: clean });
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
          <Input
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {options.map((o, i) => (
            <Input
              key={i}
              placeholder={`Option ${i + 1}`}
              value={o}
              onChange={(e) => updateOption(i, e.target.value)}
            />
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}>
              <Plus className="size-4" /> Option
            </Button>
            <Button onClick={onCreate} disabled={busy}>
              Create poll
            </Button>
          </div>
        </CardBody>
      </Card>

      {polls.length === 0 ? (
        <p className="text-sm opacity-70">No polls yet.</p>
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
  const [busy, startTransition] = React.useTransition();
  const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
  const next = poll.status === 'draft' ? 'open' : poll.status === 'open' ? 'closed' : 'closed';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{poll.question}</CardTitle>
          <Badge variant="secondary">{poll.status}</Badge>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {poll.options.map((o) => {
          const pct = totalVotes > 0 ? Math.round((o.voteCount / totalVotes) * 100) : 0;
          return (
            <div key={o.id} className="flex items-center justify-between text-sm">
              <span>{o.label}</span>
              <span className="opacity-70">
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
              onClick={() =>
                startTransition(async () => {
                  await setSabwebinarPollStatus(poll._id, next);
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
  if (items.length === 0) return <p className="text-sm opacity-70">No questions yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      {items.map((q) => (
        <QnaRow key={q._id} item={q} />
      ))}
    </div>
  );
}

function QnaRow({ item }: { item: SabwebinarQnaItem }) {
  const [busy, startTransition] = React.useTransition();
  const [answer, setAnswer] = React.useState('');
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{item.question}</CardTitle>
          <Badge variant="secondary">{item.upvotes} upvotes</Badge>
        </div>
        <CardDescription>
          {item.askerName ?? 'Anonymous'} ·{' '}
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
            <Input
              placeholder="Answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <Button
              disabled={busy || !answer.trim()}
              onClick={() =>
                startTransition(async () => {
                  await answerSabwebinarQuestion(item._id, answer.trim());
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
  const [busy, startTransition] = React.useTransition();
  const [fileId, setFileId] = React.useState(webinar.recordingFileId ?? '');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Post-event recording</CardTitle>
        <CardDescription>Upload via SabFiles — no external URL paste.</CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <SabFilePickerButton
          accept="video"
          value={fileId ? { fileId } : undefined}
          onPick={(pick) => setFileId(pick?.fileId ?? '')}
        />
        <div>
          <Button
            disabled={busy || !fileId}
            onClick={() =>
              startTransition(async () => {
                await updateSabwebinar(webinar._id, { recordingFileId: fileId });
              })
            }
          >
            {busy ? 'Saving…' : 'Attach recording'}
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
            <p className="text-sm opacity-70">No registrations yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {analytics.registrationsBySource.map((s) => (
                <li key={s.source} className="flex justify-between">
                  <span>{s.source}</span>
                  <span className="opacity-70">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
