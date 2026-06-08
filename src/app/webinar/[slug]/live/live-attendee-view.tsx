'use client';

import * as React from 'react';
import { MessageSquare, BarChart3, HelpCircle, Send } from 'lucide-react';
import {
  type SabwebinarLandingTheme,
  type SabwebinarPoll,
  type SabwebinarQnaItem,
  type SabwebinarChat,
  type SabwebinarStatus,
  askSabwebinarQuestion,
  joinSabwebinar,
  listSabwebinarChat,
  sendSabwebinarChat,
  voteSabwebinarPoll,
} from '@/app/actions/sabwebinar.actions';
import { webinarTransport, type WebinarPresence } from '@/lib/sabwebinar/transport';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  SegmentedControl,
} from '@/components/sabcrm/20ui';

interface Props {
  webinarId: string;
  slug: string;
  title: string;
  theme?: SabwebinarLandingTheme;
  status: SabwebinarStatus;
  joinToken?: string;
  initialPolls: SabwebinarPoll[];
  initialQna: SabwebinarQnaItem[];
}

type TabKey = 'chat' | 'polls' | 'qna';

const TAB_ITEMS = [
  { value: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { value: 'polls' as const, label: 'Polls', icon: BarChart3 },
  { value: 'qna' as const, label: 'Q&A', icon: HelpCircle },
];

export function LiveAttendeeView({
  webinarId,
  slug,
  title,
  theme,
  status,
  joinToken,
  initialPolls,
  initialQna,
}: Props) {
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null);
  const [presence, setPresence] = React.useState<WebinarPresence>({ current: 0, peak: 0 });
  const [chat, setChat] = React.useState<SabwebinarChat[]>([]);
  const [polls, setPolls] = React.useState(initialPolls);
  const [qna, setQna] = React.useState(initialQna);
  const [tab, setTab] = React.useState<TabKey>('chat');
  const [draft, setDraft] = React.useState('');
  const [name, setName] = React.useState<string>('Guest');

  // Bind transport + record join.
  React.useEffect(() => {
    let alive = true;
    void webinarTransport.connect(webinarId).then(async () => {
      const url = await webinarTransport.getLiveStreamUrl({ webinarId, joinToken });
      if (alive) setStreamUrl(url);
    });
    if (joinToken) void joinSabwebinar(joinToken);
    const offPresence = webinarTransport.subscribePresence((p) => {
      if (alive) setPresence(p);
    });
    return () => {
      alive = false;
      offPresence();
      void webinarTransport.disconnect();
    };
  }, [webinarId, joinToken]);

  // Poll chat every 4s (transport's pluggable real-time fan-out replaces
  // this when wired).
  React.useEffect(() => {
    let alive = true;
    let lastTs: string | undefined;
    const tick = async () => {
      const { data } = await listSabwebinarChat(webinarId, { since: lastTs, limit: 100 });
      if (!alive) return;
      if (data.length > 0) {
        setChat((prev) => [...prev, ...data]);
        lastTs = data[data.length - 1].ts;
      }
    };
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [webinarId]);

  // Per-webinar branding is genuinely runtime-computed (chosen by the host), so
  // these page-frame colours stay as runtime style values.
  const bg = theme?.backgroundColor ?? '#0b0d12';
  const fg = theme?.textColor ?? '#ffffff';

  const onSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    void sendSabwebinarChat({ webinarId, senderName: name || 'Guest', body });
  };

  const onAsk = (q: string) => {
    if (!q.trim()) return;
    void askSabwebinarQuestion({
      webinarId,
      question: q.trim(),
      askerName: name || undefined,
    }).then((res) => setQna((prev) => [res.data, ...prev]));
  };

  const onVote = (pollId: string, optionId: string) => {
    void voteSabwebinarPoll({ pollId, optionId, voter: joinToken ?? name });
  };

  return (
    <main className="20ui min-h-screen" style={{ background: bg, color: fg }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:grid lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-3">
          <PageHeader bordered={false} compact>
            <PageHeaderHeading>
              <PageTitle>{title}</PageTitle>
            </PageHeaderHeading>
            <PageActions>
              <Badge tone="accent" dot>
                {presence.current} watching
              </Badge>
              <Badge tone="neutral">peak {presence.peak}</Badge>
            </PageActions>
          </PageHeader>
          <div className="aspect-video w-full overflow-hidden rounded-[var(--st-radius)] bg-black">
            {streamUrl && status === 'live' ? (
              <video
                src={streamUrl}
                controls
                autoPlay
                playsInline
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--st-text-secondary)]">
                {status === 'live' ? 'Connecting.' : `Webinar is ${status}`}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--st-text-tertiary)]">/webinar/{slug}/live</p>
        </section>

        <Card variant="outlined" padding="sm" className="flex flex-col gap-3">
          <SegmentedControl
            items={TAB_ITEMS}
            value={tab}
            onChange={setTab}
            fullWidth
            aria-label="Live panel"
          />

          <Field label="Display name">
            <Input
              inputSize="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {tab === 'chat' ? (
            <div className="flex h-[55vh] flex-col gap-2">
              <div className="flex-1 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-sm">
                {chat.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={MessageSquare}
                    title="No messages yet"
                    description="Be the first to say hello."
                  />
                ) : (
                  chat.map((m) => (
                    <p key={m._id} className="py-0.5 text-[var(--st-text)]">
                      <strong>{m.senderName}:</strong> {m.body}
                    </p>
                  ))
                )}
              </div>
              <form onSubmit={onSendChat} className="flex items-end gap-2">
                <Field label="Message" className="flex-1">
                  <Input
                    inputSize="sm"
                    placeholder="Say hi"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </Field>
                <Button type="submit" variant="primary" iconLeft={Send}>
                  Send
                </Button>
              </form>
            </div>
          ) : null}

          {tab === 'polls' ? (
            <div className="flex flex-col gap-3 text-sm">
              {polls.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={BarChart3}
                  title="No polls"
                  description="Polls from the host will appear here."
                />
              ) : (
                polls.map((p) => (
                  <Card key={p._id} variant="outlined" padding="sm" className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-[var(--st-text)]">{p.question}</p>
                      <Badge tone={p.status === 'open' ? 'success' : 'neutral'}>{p.status}</Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      {p.options.map((o) => (
                        <Button
                          key={o.id}
                          block
                          variant="outline"
                          disabled={p.status !== 'open'}
                          onClick={() => onVote(p._id, o.id)}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span>{o.label}</span>
                            <Badge tone="neutral">{o.voteCount}</Badge>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : null}

          {tab === 'qna' ? <QnaPanel items={qna} onAsk={onAsk} /> : null}
        </Card>
      </div>
    </main>
  );
}

function QnaPanel({
  items,
  onAsk,
}: {
  items: SabwebinarQnaItem[];
  onAsk: (q: string) => void;
}) {
  const [q, setQ] = React.useState('');
  return (
    <div className="flex flex-col gap-2 text-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(q);
          setQ('');
        }}
        className="flex items-end gap-2"
      >
        <Field label="Your question" className="flex-1">
          <Input
            inputSize="sm"
            placeholder="Ask a question"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" iconLeft={HelpCircle}>
          Ask
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState
            size="sm"
            icon={HelpCircle}
            title="No questions yet"
            description="Ask the host anything during the session."
          />
        ) : (
          items.map((it) => (
            <Card key={it._id} variant="outlined" padding="sm" className="flex flex-col gap-1">
              <p className="font-medium text-[var(--st-text)]">{it.question}</p>
              {it.answered ? (
                <p className="text-[var(--st-text-secondary)]">
                  <strong>A:</strong> {it.answer}
                </p>
              ) : (
                <p className="text-xs text-[var(--st-text-tertiary)]">
                  Awaiting answer. {it.upvotes} upvotes
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
