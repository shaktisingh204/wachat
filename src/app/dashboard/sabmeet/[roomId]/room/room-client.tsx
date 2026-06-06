'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Badge, Input, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Hand,
  PhoneOff,
  Users,
  MessageSquare,
  BarChart3,
  HelpCircle,
  Send,
} from 'lucide-react';
import type { MeetRoom, MeetPoll, MeetQna } from '@/app/actions/sabmeet.actions.types';
import {
  leaveMeetRoom,
  listMeetPolls,
  listMeetQna,
  createMeetPoll,
  voteMeetPoll,
  askMeetQuestion,
  answerMeetQuestion,
} from '@/app/actions/sabmeet.actions';
import {
  MockTransport,
  type IMeetTransport,
  type MeetChatMessage,
  type MeetLocalTrackState,
  type MeetRemoteParticipant,
} from '@/app/dashboard/sabmeet/_lib/sabmeet-transport';

type SidePanel = 'participants' | 'chat' | 'polls' | 'qna' | null;

interface RoomClientProps {
  room: MeetRoom;
}

export function RoomClient({ room }: RoomClientProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const participantId = sp?.get('participantId') ?? null;
  const displayName = sp?.get('displayName') ?? 'You';
  const initialMic = sp?.get('mic') !== '0';
  const initialCam = sp?.get('cam') !== '0';

  const transportRef = React.useRef<IMeetTransport | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const [local, setLocal] = React.useState<MeetLocalTrackState>({
    cameraOn: initialCam,
    microphoneOn: initialMic,
    screenSharing: false,
    handRaised: false,
  });
  const [remotes, setRemotes] = React.useState<MeetRemoteParticipant[]>([]);
  const [chat, setChat] = React.useState<MeetChatMessage[]>([]);
  const [panel, setPanel] = React.useState<SidePanel>(null);

  // ─── Init transport ────────────────────────────────────────────────
  React.useEffect(() => {
    // Pick up the stream the lobby parked on `window`. Fallback: acquire
    // again (will trigger another permission prompt).
    const w = window as Window & { __MEET_LOCAL_STREAM__?: MediaStream | null };
    let stream = w.__MEET_LOCAL_STREAM__ ?? null;
    const transport: IMeetTransport = new MockTransport();
    transportRef.current = transport;

    const off = transport.addEventListener(ev => {
      switch (ev.type) {
        case 'participant-joined':
          setRemotes(prev => [...prev, ev.participant]);
          break;
        case 'participant-left':
          setRemotes(prev => prev.filter(p => p.id !== ev.participantId));
          break;
        case 'participant-updated':
          setRemotes(prev => prev.map(p => (p.id === ev.participant.id ? ev.participant : p)));
          break;
        case 'local-state-changed':
          setLocal(ev.state);
          break;
        case 'chat':
          setChat(prev => [...prev, ev.message]);
          break;
      }
    });

    const start = async () => {
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          stream = null;
        }
      }
      localStreamRef.current = stream;
      if (stream) {
        stream.getVideoTracks().forEach(t => (t.enabled = initialCam));
        stream.getAudioTracks().forEach(t => (t.enabled = initialMic));
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
      await transport.connect({
        roomId: room._id,
        sfuRoomId: room.sfuRoomId,
        displayName,
        asRole: 'participant',
        localStream: stream,
      });
    };
    start();

    return () => {
      off();
      transport.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      w.__MEET_LOCAL_STREAM__ = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror local state changes back to the actual track + transport.
  const toggleMic = async () => {
    const next = !local.microphoneOn;
    localStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = next));
    await transportRef.current?.setMicrophoneEnabled(next);
  };
  const toggleCam = async () => {
    const next = !local.cameraOn;
    localStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = next));
    await transportRef.current?.setCameraEnabled(next);
  };
  const toggleScreen = async () => {
    await transportRef.current?.setScreenShareEnabled(!local.screenSharing);
  };
  const toggleHand = async () => {
    await transportRef.current?.setHandRaised(!local.handRaised);
  };
  const leave = async () => {
    if (participantId) {
      try {
        await leaveMeetRoom(participantId);
      } catch {
        /* swallow */
      }
    }
    await transportRef.current?.disconnect();
    router.push('/dashboard/meetings');
  };

  const sendChat = async (text: string) => {
    if (!text.trim()) return;
    await transportRef.current?.sendChat(text.trim());
  };

  const allTiles = React.useMemo(
    () => [
      {
        kind: 'local' as const,
        id: 'local',
        displayName,
        cameraOn: local.cameraOn,
        microphoneOn: local.microphoneOn,
        screenSharing: local.screenSharing,
        handRaised: local.handRaised,
      },
      ...remotes.map(r => ({
        kind: 'remote' as const,
        id: r.id,
        displayName: r.displayName,
        cameraOn: r.cameraOn,
        microphoneOn: r.microphoneOn,
        screenSharing: r.screenSharing,
        handRaised: r.handRaised,
        videoStream: r.videoStream,
      })),
    ],
    [displayName, local, remotes],
  );

  return (
    <div className="flex h-screen flex-col bg-[var(--st-text)] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--st-border)]">
        <div className="flex items-center gap-3">
          <Badge variant="default">LIVE</Badge>
          <div>
            <div className="text-sm font-medium">{room.name}</div>
            <div className="text-xs text-[var(--st-text-secondary)]">{room.joinCode}</div>
          </div>
        </div>
        <div className="text-xs text-[var(--st-text-secondary)]">{allTiles.length} in room</div>
      </div>

      {/* Tiles + side panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 grid auto-rows-fr gap-2 p-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))] content-start">
          {allTiles.map(t =>
            t.kind === 'local' ? (
              <LocalTile
                key={t.id}
                displayName={t.displayName}
                cameraOn={t.cameraOn}
                microphoneOn={t.microphoneOn}
                handRaised={t.handRaised}
                videoRef={localVideoRef}
              />
            ) : (
              <RemoteTile key={t.id} participant={t as MeetRemoteParticipant} />
            ),
          )}
        </div>
        {panel ? (
          <SidePanel
            panel={panel}
            onClose={() => setPanel(null)}
            chat={chat}
            onSendChat={sendChat}
            remotes={remotes}
            room={room}
            displayName={displayName}
          />
        ) : null}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--st-border)] bg-[var(--st-text)]">
        <ControlButton
          active={local.microphoneOn}
          onClick={toggleMic}
          label={local.microphoneOn ? 'Mute mic' : 'Unmute mic'}
          danger={!local.microphoneOn}
        >
          {local.microphoneOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </ControlButton>
        <ControlButton
          active={local.cameraOn}
          onClick={toggleCam}
          label={local.cameraOn ? 'Stop video' : 'Start video'}
          danger={!local.cameraOn}
        >
          {local.cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </ControlButton>
        <ControlButton
          active={local.screenSharing}
          onClick={toggleScreen}
          label={local.screenSharing ? 'Stop share' : 'Share screen'}
        >
          {local.screenSharing ? (
            <ScreenShareOff className="h-4 w-4" />
          ) : (
            <ScreenShare className="h-4 w-4" />
          )}
        </ControlButton>
        <ControlButton
          active={local.handRaised}
          onClick={toggleHand}
          label={local.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="h-4 w-4" />
        </ControlButton>

        <div className="mx-2 h-6 w-px bg-[var(--st-text)]" />

        <ControlButton
          active={panel === 'participants'}
          onClick={() => setPanel(p => (p === 'participants' ? null : 'participants'))}
          label="Participants"
        >
          <Users className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          active={panel === 'chat'}
          onClick={() => setPanel(p => (p === 'chat' ? null : 'chat'))}
          label="Chat"
        >
          <MessageSquare className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          active={panel === 'polls'}
          onClick={() => setPanel(p => (p === 'polls' ? null : 'polls'))}
          label="Polls"
        >
          <BarChart3 className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          active={panel === 'qna'}
          onClick={() => setPanel(p => (p === 'qna' ? null : 'qna'))}
          label="Q&A"
        >
          <HelpCircle className="h-4 w-4" />
        </ControlButton>

        <div className="mx-2 h-6 w-px bg-[var(--st-text)]" />

        <Button onClick={leave} variant="destructive" size="sm">
          <PhoneOff className="h-4 w-4 mr-2" /> Leave
        </Button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function ControlButton({
  active,
  danger,
  onClick,
  label,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full border transition ${
        danger
          ? 'border-[var(--st-border)] bg-[var(--st-text)]/20 text-[var(--st-text-secondary)]'
          : active
            ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/20 text-white'
            : 'border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text-secondary)] hover:bg-[var(--st-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function LocalTile({
  displayName,
  cameraOn,
  microphoneOn,
  handRaised,
  videoRef,
}: {
  displayName: string;
  cameraOn: boolean;
  microphoneOn: boolean;
  handRaised: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--st-text)]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${cameraOn ? '' : 'opacity-0'}`}
      />
      {!cameraOn ? (
        <div className="absolute inset-0 grid place-items-center text-[var(--st-text-secondary)]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--st-text)] text-xl font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="rounded bg-black/60 px-2 py-0.5 text-xs">{displayName} (you)</div>
        <div className="flex gap-1">
          {handRaised ? (
            <div className="rounded bg-[var(--st-text)]/80 p-1">
              <Hand className="h-3 w-3 text-black" />
            </div>
          ) : null}
          {!microphoneOn ? (
            <div className="rounded bg-[var(--st-text)]/80 p-1">
              <MicOff className="h-3 w-3 text-white" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RemoteTile({ participant }: { participant: MeetRemoteParticipant }) {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.srcObject = participant.videoStream;
  }, [participant.videoStream]);
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--st-text)]">
      {participant.videoStream && participant.cameraOn ? (
        <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[var(--st-text-secondary)]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--st-text)] text-xl font-medium">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="rounded bg-black/60 px-2 py-0.5 text-xs">
          {participant.displayName} {participant.isHost ? '· Host' : ''}
        </div>
        <div className="flex gap-1">
          {participant.handRaised ? (
            <div className="rounded bg-[var(--st-text)]/80 p-1">
              <Hand className="h-3 w-3 text-black" />
            </div>
          ) : null}
          {!participant.microphoneOn ? (
            <div className="rounded bg-[var(--st-text)]/80 p-1">
              <MicOff className="h-3 w-3 text-white" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Side panel ──────────────────────────────────────────────────────

function SidePanel({
  panel,
  onClose,
  chat,
  onSendChat,
  remotes,
  room,
  displayName,
}: {
  panel: SidePanel;
  onClose: () => void;
  chat: MeetChatMessage[];
  onSendChat: (text: string) => void;
  remotes: MeetRemoteParticipant[];
  room: MeetRoom;
  displayName: string;
}) {
  return (
    <aside className="w-80 border-l border-[var(--st-border)] bg-[var(--st-text)] flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2">
        <div className="text-sm font-medium capitalize">{panel}</div>
        <button onClick={onClose} className="text-[var(--st-text-secondary)] hover:text-white text-sm">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {panel === 'participants' ? (
          <ParticipantsPanel remotes={remotes} you={displayName} />
        ) : panel === 'chat' ? (
          <ChatPanel chat={chat} onSend={onSendChat} />
        ) : panel === 'polls' ? (
          <PollsPanel room={room} you={displayName} />
        ) : panel === 'qna' ? (
          <QnaPanel room={room} you={displayName} />
        ) : null}
      </div>
    </aside>
  );
}

function ParticipantsPanel({
  remotes,
  you,
}: {
  remotes: MeetRemoteParticipant[];
  you: string;
}) {
  return (
    <ul className="divide-y divide-[var(--st-border)]">
      <li className="px-3 py-2 text-sm">{you} (you)</li>
      {remotes.map(r => (
        <li key={r.id} className="px-3 py-2 text-sm flex items-center justify-between">
          <span>
            {r.displayName} {r.isHost ? '· Host' : ''}
          </span>
          {!r.microphoneOn ? <MicOff className="h-3 w-3 text-[var(--st-text-secondary)]" /> : null}
        </li>
      ))}
    </ul>
  );
}

function ChatPanel({
  chat,
  onSend,
}: {
  chat: MeetChatMessage[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = React.useState('');
  const endRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {chat.length === 0 ? (
          <div className="text-xs text-[var(--st-text)]">No messages yet.</div>
        ) : (
          chat.map(m => (
            <div key={m.id} className="text-sm">
              <span className="font-medium text-white">{m.fromName}: </span>
              <span className="text-[var(--st-text-secondary)]">{m.text}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          onSend(text);
          setText('');
        }}
        className="flex gap-2 border-t border-[var(--st-border)] p-2"
      >
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message everyone"
          className="bg-[var(--st-text)] border-[var(--st-border)]"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function PollsPanel({ room, you }: { room: MeetRoom; you: string }) {
  const [polls, setPolls] = React.useState<MeetPoll[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [options, setOptions] = React.useState('');

  const refresh = React.useCallback(async () => {
    const res = await listMeetPolls(room._id);
    if (res.success) setPolls(res.data);
  }, [room._id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    const opts = options.split('\n').map(s => s.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return;
    await createMeetPoll({ roomId: room._id, question: question.trim(), options: opts });
    setQuestion('');
    setOptions('');
    setCreating(false);
    refresh();
  };

  const vote = async (pollId: string, optionId: string) => {
    await voteMeetPoll({ pollId, optionIds: [optionId], voter: you });
    refresh();
  };

  return (
    <div className="p-3 space-y-3">
      {creating ? (
        <div className="space-y-2 rounded border border-[var(--st-border)] p-2">
          <Input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Question"
            className="bg-[var(--st-text)] border-[var(--st-border)]"
          />
          <Textarea
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder="One option per line"
            rows={3}
            className="bg-[var(--st-text)] border-[var(--st-border)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit}>
              Launch
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="w-full">
          Create poll
        </Button>
      )}
      {polls.length === 0 ? (
        <div className="text-xs text-[var(--st-text)]">No polls yet.</div>
      ) : (
        polls.map(p => {
          const total = p.options.reduce((a, b) => a + (b.voteCount ?? 0), 0);
          return (
            <div key={p._id} className="rounded border border-[var(--st-border)] p-2 space-y-2">
              <div className="text-sm font-medium">{p.question}</div>
              {p.options.map(o => {
                const pct = total ? Math.round(((o.voteCount ?? 0) / total) * 100) : 0;
                return (
                  <button
                    key={o.id}
                    onClick={() => vote(p._id, o.id)}
                    className="block w-full text-left text-xs rounded bg-[var(--st-text)] hover:bg-[var(--st-text)] p-2"
                  >
                    <div className="flex justify-between">
                      <span>{o.label}</span>
                      <span className="text-[var(--st-text-secondary)]">
                        {o.voteCount ?? 0} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded bg-[var(--st-text)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--st-accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

function QnaPanel({ room, you }: { room: MeetRoom; you: string }) {
  const [items, setItems] = React.useState<MeetQna[]>([]);
  const [question, setQuestion] = React.useState('');
  const [answering, setAnswering] = React.useState<string | null>(null);
  const [answerText, setAnswerText] = React.useState('');

  const refresh = React.useCallback(async () => {
    const res = await listMeetQna(room._id);
    if (res.success) setItems(res.data);
  }, [room._id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const ask = async () => {
    if (!question.trim()) return;
    await askMeetQuestion({ roomId: room._id, question, askerName: you });
    setQuestion('');
    refresh();
  };
  const answer = async (qnaId: string) => {
    if (!answerText.trim()) return;
    await answerMeetQuestion({ qnaId, answer: answerText });
    setAnswerText('');
    setAnswering(null);
    refresh();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-2">
        <Textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question"
          rows={2}
          className="bg-[var(--st-text)] border-[var(--st-border)]"
        />
        <Button size="sm" onClick={ask} className="w-full" disabled={!question.trim()}>
          Submit
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-[var(--st-text)]">No questions yet.</div>
      ) : (
        items.map(q => (
          <div key={q._id} className="rounded border border-[var(--st-border)] p-2 space-y-1">
            <div className="text-sm">{q.question}</div>
            <div className="text-xs text-[var(--st-text-secondary)]">
              by {q.askerName ?? 'anonymous'} · {q.upvotes ?? 0} upvotes
            </div>
            {q.answered ? (
              <div className="text-xs rounded bg-[var(--st-text)] p-2">
                <span className="font-medium">Answer: </span>
                {q.answer}
              </div>
            ) : answering === q._id ? (
              <div className="space-y-1">
                <Textarea
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  rows={2}
                  className="bg-[var(--st-text)] border-[var(--st-border)]"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => answer(q._id)}>
                    Post
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAnswering(q._id)}>
                Answer
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
