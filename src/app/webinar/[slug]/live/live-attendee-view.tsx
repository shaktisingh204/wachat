'use client';

import * as React from 'react';
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

  const bg = theme?.backgroundColor ?? '#0b0d12';
  const fg = theme?.textColor ?? '#ffffff';
  const accent = theme?.accentColor ?? '#2563eb';

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
    <main style={{ background: bg, color: fg, minHeight: '100vh' }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:grid lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{title}</h1>
            <span className="text-sm opacity-70">
              {presence.current} watching · peak {presence.peak}
            </span>
          </header>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            {streamUrl && status === 'live' ? (
              <video
                src={streamUrl}
                controls
                autoPlay
                playsInline
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-60">
                {status === 'live' ? 'Connecting…' : `Webinar is ${status}`}
              </div>
            )}
          </div>
          <p className="text-xs opacity-50">/webinar/{slug}/live</p>
        </section>

        <aside className="flex flex-col gap-3 rounded-md border border-white/10 p-3">
          <div className="flex gap-1 text-sm">
            {(['chat', 'polls', 'qna'] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-md px-3 py-1"
                style={{
                  background: tab === t ? accent : 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                {t === 'chat' ? 'Chat' : t === 'polls' ? 'Polls' : 'Q&A'}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="opacity-70">Display name</span>
            <input
              className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {tab === 'chat' ? (
            <div className="flex h-[55vh] flex-col gap-2">
              <div className="flex-1 overflow-auto rounded-md border border-white/10 p-2 text-sm">
                {chat.length === 0 ? (
                  <p className="opacity-50">No messages yet.</p>
                ) : (
                  chat.map((m) => (
                    <p key={m._id} className="py-0.5">
                      <strong>{m.senderName}:</strong> {m.body}
                    </p>
                  ))
                )}
              </div>
              <form onSubmit={onSendChat} className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
                  placeholder="Say hi"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md px-3 py-1 text-sm font-medium"
                  style={{ background: accent, color: '#fff' }}
                >
                  Send
                </button>
              </form>
            </div>
          ) : null}

          {tab === 'polls' ? (
            <div className="flex flex-col gap-3 text-sm">
              {polls.length === 0 ? (
                <p className="opacity-50">No polls.</p>
              ) : (
                polls.map((p) => (
                  <div
                    key={p._id}
                    className="rounded-md border border-white/10 p-2"
                  >
                    <p className="font-medium">{p.question}</p>
                    <p className="text-xs opacity-60">{p.status}</p>
                    <div className="mt-1 flex flex-col gap-1">
                      {p.options.map((o) => (
                        <button
                          key={o.id}
                          disabled={p.status !== 'open'}
                          onClick={() => onVote(p._id, o.id)}
                          className="flex justify-between rounded-md border border-white/15 px-2 py-1 text-left disabled:opacity-50"
                        >
                          <span>{o.label}</span>
                          <span className="opacity-70">{o.voteCount}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === 'qna' ? <QnaPanel items={qna} onAsk={onAsk} /> : null}
        </aside>
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
        className="flex gap-2"
      >
        <input
          className="flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1"
          placeholder="Ask a question"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md border border-white/20 px-3 py-1"
        >
          Ask
        </button>
      </form>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="opacity-50">No questions yet.</p>
        ) : (
          items.map((it) => (
            <div key={it._id} className="rounded-md border border-white/10 p-2">
              <p className="font-medium">{it.question}</p>
              {it.answered ? (
                <p className="mt-1 opacity-80">
                  <strong>A:</strong> {it.answer}
                </p>
              ) : (
                <p className="opacity-50 text-xs">Awaiting answer · {it.upvotes} upvotes</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
