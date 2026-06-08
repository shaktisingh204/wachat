'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  IconButton,
  Badge,
  Dot,
  Input,
  Textarea,
  Field,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
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
  X,
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

  // Init transport.
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
    <div className="20ui dark flex h-screen flex-col bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--st-border)]">
        <div className="flex items-center gap-3">
          <Badge tone="danger" kind="solid">
            <Dot tone="danger" pulse className="mr-1.5" />
            LIVE
          </Badge>
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
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--st-border)] bg-[var(--st-bg)]">
        <IconButton
          icon={local.microphoneOn ? Mic : MicOff}
          variant={local.microphoneOn ? 'primary' : 'danger'}
          onClick={toggleMic}
          label={local.microphoneOn ? 'Mute mic' : 'Unmute mic'}
        />
        <IconButton
          icon={local.cameraOn ? Video : VideoOff}
          variant={local.cameraOn ? 'primary' : 'danger'}
          onClick={toggleCam}
          label={local.cameraOn ? 'Stop video' : 'Start video'}
        />
        <IconButton
          icon={local.screenSharing ? ScreenShareOff : ScreenShare}
          variant={local.screenSharing ? 'primary' : 'ghost'}
          onClick={toggleScreen}
          label={local.screenSharing ? 'Stop share' : 'Share screen'}
        />
        <IconButton
          icon={Hand}
          variant={local.handRaised ? 'primary' : 'ghost'}
          onClick={toggleHand}
          label={local.handRaised ? 'Lower hand' : 'Raise hand'}
        />

        <div className="mx-2 h-6 w-px bg-[var(--st-border)]" aria-hidden="true" />

        <IconButton
          icon={Users}
          variant={panel === 'participants' ? 'primary' : 'ghost'}
          onClick={() => setPanel(p => (p === 'participants' ? null : 'participants'))}
          label="Participants"
        />
        <IconButton
          icon={MessageSquare}
          variant={panel === 'chat' ? 'primary' : 'ghost'}
          onClick={() => setPanel(p => (p === 'chat' ? null : 'chat'))}
          label="Chat"
        />
        <IconButton
          icon={BarChart3}
          variant={panel === 'polls' ? 'primary' : 'ghost'}
          onClick={() => setPanel(p => (p === 'polls' ? null : 'polls'))}
          label="Polls"
        />
        <IconButton
          icon={HelpCircle}
          variant={panel === 'qna' ? 'primary' : 'ghost'}
          onClick={() => setPanel(p => (p === 'qna' ? null : 'qna'))}
          label="Questions and answers"
        />

        <div className="mx-2 h-6 w-px bg-[var(--st-border)]" aria-hidden="true" />

        <Button onClick={leave} variant="danger" size="sm" iconLeft={PhoneOff}>
          Leave
        </Button>
      </div>
    </div>
  );
}

// Subcomponents.

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
    <div className="relative aspect-video rounded-[var(--st-radius)] overflow-hidden bg-[var(--st-bg-secondary)]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${cameraOn ? '' : 'opacity-0'}`}
      />
      {!cameraOn ? (
        <div className="absolute inset-0 grid place-items-center text-[var(--st-text-secondary)]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--st-bg)] text-xl font-medium text-[var(--st-text)]">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="rounded-[var(--st-radius)] bg-black/60 px-2 py-0.5 text-xs text-white">
          {displayName} (you)
        </div>
        <div className="flex gap-1">
          {handRaised ? (
            <div className="rounded-[var(--st-radius)] bg-[var(--st-warn)] p-1">
              <Hand className="h-3 w-3 text-black" aria-hidden="true" />
            </div>
          ) : null}
          {!microphoneOn ? (
            <div className="rounded-[var(--st-radius)] bg-[var(--st-danger)] p-1">
              <MicOff className="h-3 w-3 text-white" aria-hidden="true" />
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
    <div className="relative aspect-video rounded-[var(--st-radius)] overflow-hidden bg-[var(--st-bg-secondary)]">
      {participant.videoStream && participant.cameraOn ? (
        <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[var(--st-text-secondary)]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--st-bg)] text-xl font-medium text-[var(--st-text)]">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="rounded-[var(--st-radius)] bg-black/60 px-2 py-0.5 text-xs text-white">
          {participant.displayName} {participant.isHost ? '. Host' : ''}
        </div>
        <div className="flex gap-1">
          {participant.handRaised ? (
            <div className="rounded-[var(--st-radius)] bg-[var(--st-warn)] p-1">
              <Hand className="h-3 w-3 text-black" aria-hidden="true" />
            </div>
          ) : null}
          {!participant.microphoneOn ? (
            <div className="rounded-[var(--st-radius)] bg-[var(--st-danger)] p-1">
              <MicOff className="h-3 w-3 text-white" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Side panel.

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
  const PANEL_TITLE: Record<Exclude<SidePanel, null>, string> = {
    participants: 'Participants',
    chat: 'Chat',
    polls: 'Polls',
    qna: 'Questions and answers',
  };
  return (
    <aside className="w-80 border-l border-[var(--st-border)] bg-[var(--st-bg)] flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2">
        <div className="text-sm font-medium">{panel ? PANEL_TITLE[panel] : ''}</div>
        <IconButton icon={X} variant="ghost" size="sm" label="Close panel" onClick={onClose} />
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
            {r.displayName} {r.isHost ? '. Host' : ''}
          </span>
          {!r.microphoneOn ? (
            <MicOff className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
          ) : null}
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
          <EmptyState
            icon={MessageSquare}
            size="sm"
            title="No messages yet"
            description="Say hello to everyone in the room."
          />
        ) : (
          chat.map(m => (
            <div key={m.id} className="text-sm">
              <span className="font-medium text-[var(--st-text)]">{m.fromName}: </span>
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
        <Field className="flex-1">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Message everyone"
            aria-label="Message everyone"
          />
        </Field>
        <Button type="submit" size="sm" iconLeft={Send} disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

function PollsPanel({ room, you }: { room: MeetRoom; you: string }) {
  const { toast } = useToast();
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
    if (!question.trim() || opts.length < 2) {
      toast.error('Add a question and at least two options.');
      return;
    }
    await createMeetPoll({ roomId: room._id, question: question.trim(), options: opts });
    setQuestion('');
    setOptions('');
    setCreating(false);
    toast.success('Poll launched');
    refresh();
  };

  const vote = async (pollId: string, optionId: string) => {
    await voteMeetPoll({ pollId, optionIds: [optionId], voter: you });
    refresh();
  };

  return (
    <div className="p-3 space-y-3">
      {creating ? (
        <div className="space-y-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2">
          <Field label="Question">
            <Input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What should we ask?"
            />
          </Field>
          <Field label="Options" help="One option per line.">
            <Textarea
              value={options}
              onChange={e => setOptions(e.target.value)}
              placeholder={'Yes\nNo'}
              rows={3}
            />
          </Field>
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
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} block>
          Create poll
        </Button>
      )}
      {polls.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          size="sm"
          title="No polls yet"
          description="Create a poll to gather quick feedback."
        />
      ) : (
        polls.map(p => {
          const total = p.options.reduce((a, b) => a + (b.voteCount ?? 0), 0);
          return (
            <div
              key={p._id}
              className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 space-y-2"
            >
              <div className="text-sm font-medium">{p.question}</div>
              {p.options.map(o => {
                const pct = total ? Math.round(((o.voteCount ?? 0) / total) * 100) : 0;
                return (
                  <Button
                    key={o.id}
                    variant="ghost"
                    onClick={() => vote(p._id, o.id)}
                    className="block w-full text-left"
                  >
                    <span className="block w-full">
                      <span className="flex justify-between text-xs">
                        <span>{o.label}</span>
                        <span className="text-[var(--st-text-secondary)]">
                          {o.voteCount ?? 0} ({pct}%)
                        </span>
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-[var(--st-bg-secondary)] overflow-hidden">
                        <span
                          className="block h-full bg-[var(--st-accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                  </Button>
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
  const { toast } = useToast();
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
    toast.success('Question submitted');
    refresh();
  };
  const answer = async (qnaId: string) => {
    if (!answerText.trim()) return;
    await answerMeetQuestion({ qnaId, answer: answerText });
    setAnswerText('');
    setAnswering(null);
    toast.success('Answer posted');
    refresh();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="space-y-2">
        <Field label="Ask a question">
          <Textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Type your question for the host"
            rows={2}
          />
        </Field>
        <Button size="sm" onClick={ask} block disabled={!question.trim()}>
          Submit
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          size="sm"
          title="No questions yet"
          description="Be the first to ask the host a question."
        />
      ) : (
        items.map(q => (
          <div
            key={q._id}
            className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 space-y-1"
          >
            <div className="text-sm">{q.question}</div>
            <div className="text-xs text-[var(--st-text-secondary)]">
              by {q.askerName ?? 'anonymous'} . {q.upvotes ?? 0} upvotes
            </div>
            {q.answered ? (
              <div className="text-xs rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-2">
                <span className="font-medium">Answer: </span>
                {q.answer}
              </div>
            ) : answering === q._id ? (
              <div className="space-y-1">
                <Field label="Your answer">
                  <Textarea
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    placeholder="Write a response"
                    rows={2}
                  />
                </Field>
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
