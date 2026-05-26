/**
 * IMeetTransport — pluggable WebRTC client contract.
 *
 * The Meeting module's room UI talks to an `IMeetTransport` implementation
 * for any "media plane" work (local mic/cam capture, remote tile streams,
 * mute/unmute, screen share, hand raise, chat). A real SFU integration
 * (mediasoup / livekit / janus / dailyish) provides one of these; until
 * then the room ships with `MockTransport` which simulates remote peers
 * deterministically so the UI is exercisable end-to-end.
 *
 * The contract is intentionally event-based: implementations dispatch
 * `MeetTransportEvent`s, and the UI reacts via `addEventListener`.
 *
 * TODO(SFU integrator): provide a `LiveKitTransport` (or similar) that
 * implements this interface — connection bootstrap should consume the
 * room's `sfuRoomId` field set by the backend.
 */

export type MeetMediaKind = 'camera' | 'microphone' | 'screen';

export interface MeetLocalTrackState {
  cameraOn: boolean;
  microphoneOn: boolean;
  screenSharing: boolean;
  handRaised: boolean;
}

export interface MeetRemoteParticipant {
  id: string;
  displayName: string;
  isHost: boolean;
  cameraOn: boolean;
  microphoneOn: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  /** Live stream attached to a `<video>`. `null` when camera is off. */
  videoStream: MediaStream | null;
}

export interface MeetChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export type MeetTransportEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'participant-joined'; participant: MeetRemoteParticipant }
  | { type: 'participant-left'; participantId: string }
  | { type: 'participant-updated'; participant: MeetRemoteParticipant }
  | { type: 'local-state-changed'; state: MeetLocalTrackState }
  | { type: 'chat'; message: MeetChatMessage };

export type MeetTransportEventListener = (event: MeetTransportEvent) => void;

export interface MeetTransportConnectOptions {
  roomId: string;
  /** Room's `sfuRoomId` from the backend — opaque to the UI. */
  sfuRoomId?: string;
  displayName: string;
  asRole: 'host' | 'cohost' | 'participant' | 'viewer';
  /** Pre-acquired local stream from the lobby's device check. */
  localStream: MediaStream | null;
}

/**
 * Pluggable transport contract. All methods are async so SFU adapters can
 * marshal RPC; mock implementations resolve synchronously.
 */
export interface IMeetTransport {
  /** Connect to the SFU and publish the local stream. */
  connect(options: MeetTransportConnectOptions): Promise<void>;
  /** Disconnect and release every remote / local track owned by the transport. */
  disconnect(): Promise<void>;
  /** Toggle mic mute. */
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  /** Toggle camera on/off. */
  setCameraEnabled(enabled: boolean): Promise<void>;
  /** Start / stop sharing the user's screen. */
  setScreenShareEnabled(enabled: boolean): Promise<void>;
  /** Raise / lower hand. */
  setHandRaised(raised: boolean): Promise<void>;
  /** Broadcast a chat message to every participant. */
  sendChat(text: string): Promise<void>;
  /** Read-only snapshot of the current remote participants. */
  listParticipants(): MeetRemoteParticipant[];
  /** Read-only snapshot of the local track state. */
  getLocalState(): MeetLocalTrackState;
  /** Subscribe to transport events. Returns an unsubscribe fn. */
  addEventListener(listener: MeetTransportEventListener): () => void;
}

// ─── MockTransport — deterministic, no network ───────────────────────

/**
 * Simulates 2 remote participants joining, ambient chat, periodic mic
 * toggles. Lets the UI be exercised without a real SFU.
 */
export class MockTransport implements IMeetTransport {
  private listeners = new Set<MeetTransportEventListener>();
  private remotes: MeetRemoteParticipant[] = [];
  private local: MeetLocalTrackState = {
    cameraOn: false,
    microphoneOn: false,
    screenSharing: false,
    handRaised: false,
  };
  private timers: ReturnType<typeof setTimeout>[] = [];
  private connected = false;

  async connect(options: MeetTransportConnectOptions): Promise<void> {
    this.local = {
      cameraOn: !!options.localStream?.getVideoTracks().some(t => t.enabled),
      microphoneOn: !!options.localStream?.getAudioTracks().some(t => t.enabled),
      screenSharing: false,
      handRaised: false,
    };
    this.connected = true;
    this.dispatch({ type: 'connected' });
    this.dispatch({ type: 'local-state-changed', state: this.local });

    // Simulate two remote participants joining.
    this.timers.push(
      setTimeout(() => this.simulateJoin('mock-1', 'Alex Chen', true, true), 700),
    );
    this.timers.push(
      setTimeout(() => this.simulateJoin('mock-2', 'Priya Sharma', false, true), 1500),
    );
    // Random chatter every 9s.
    const chat = () => {
      if (!this.connected) return;
      this.dispatch({
        type: 'chat',
        message: {
          id: `m_${Date.now()}`,
          fromId: 'mock-1',
          fromName: 'Alex Chen',
          text: pickAmbient(),
          at: Date.now(),
        },
      });
      this.timers.push(setTimeout(chat, 9000 + Math.random() * 4000));
    };
    this.timers.push(setTimeout(chat, 4000));
  }

  async disconnect(): Promise<void> {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.remotes = [];
    this.connected = false;
    this.dispatch({ type: 'disconnected' });
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.local = { ...this.local, microphoneOn: enabled };
    this.dispatch({ type: 'local-state-changed', state: this.local });
  }
  async setCameraEnabled(enabled: boolean): Promise<void> {
    this.local = { ...this.local, cameraOn: enabled };
    this.dispatch({ type: 'local-state-changed', state: this.local });
  }
  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    this.local = { ...this.local, screenSharing: enabled };
    this.dispatch({ type: 'local-state-changed', state: this.local });
  }
  async setHandRaised(raised: boolean): Promise<void> {
    this.local = { ...this.local, handRaised: raised };
    this.dispatch({ type: 'local-state-changed', state: this.local });
  }
  async sendChat(text: string): Promise<void> {
    this.dispatch({
      type: 'chat',
      message: {
        id: `me_${Date.now()}`,
        fromId: 'local',
        fromName: 'You',
        text,
        at: Date.now(),
      },
    });
  }

  listParticipants(): MeetRemoteParticipant[] {
    return [...this.remotes];
  }
  getLocalState(): MeetLocalTrackState {
    return { ...this.local };
  }

  addEventListener(listener: MeetTransportEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatch(event: MeetTransportEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* swallow listener errors */
      }
    }
  }

  private simulateJoin(
    id: string,
    displayName: string,
    isHost: boolean,
    micOn: boolean,
  ): void {
    const p: MeetRemoteParticipant = {
      id,
      displayName,
      isHost,
      cameraOn: false,
      microphoneOn: micOn,
      screenSharing: false,
      handRaised: false,
      videoStream: null,
    };
    this.remotes.push(p);
    this.dispatch({ type: 'participant-joined', participant: p });
  }
}

const AMBIENT = [
  'Hello everyone!',
  'Can you see my screen?',
  'Sorry, you were cutting out.',
  'Great point — agree.',
  'Adding that to the doc.',
  'Quick question before we move on…',
];

function pickAmbient(): string {
  return AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
}
