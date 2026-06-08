/**
 * Public types for the SabMeet UI layer.
 *
 * These mirror the canonical `Sabmeet*` document shapes defined inside
 * `sabmeet.actions.ts` (which can't export them directly under Turbopack's
 * `'use server'` export restrictions). They are kept in sync with the actions'
 * serialized return values so callers get accurate field types. The historical
 * `Meet*` names are retained because every UI caller imports them.
 */

export type SabmeetRoomStatus = 'scheduled' | 'live' | 'ended' | 'canceled';

export type SabmeetParticipantRole = 'host' | 'cohost' | 'participant' | 'viewer';

export type SabmeetRecordingStatus =
  | 'recording'
  | 'processing'
  | 'ready'
  | 'failed';

export type SabmeetPollStatus = 'draft' | 'open' | 'closed';

export interface MeetRoom {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  agenda?: string[];
  hostUserId: string;
  cohostUserIds?: string[];
  inviteeUserIds?: string[];
  inviteeEmails?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  timezone?: string;
  joinCode: string;
  passcode?: string;
  lobbyEnabled: boolean;
  recordingEnabled: boolean;
  requireAuth: boolean;
  sfuRoomId?: string;
  status: SabmeetRoomStatus;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MeetParticipant {
  _id: string;
  userId: string;
  roomId: string;
  participantUserId?: string;
  guestEmail?: string;
  displayName: string;
  role: SabmeetParticipantRole;
  joinedAt: string;
  leftAt?: string;
  durationSecs?: number;
}

export interface MeetRecording {
  _id: string;
  userId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  durationSecs?: number;
  fileId?: string;
  audioFileId?: string;
  transcriptFileId?: string;
  status: SabmeetRecordingStatus;
  errorMessage?: string;
}

export interface MeetPollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface MeetPoll {
  _id: string;
  userId: string;
  roomId: string;
  question: string;
  options: MeetPollOption[];
  multiSelect: boolean;
  anonymous: boolean;
  status: SabmeetPollStatus;
}

export interface MeetQna {
  _id: string;
  userId: string;
  roomId: string;
  askerName?: string;
  question: string;
  answered: boolean;
  answer?: string;
  upvotes: number;
}

export interface MeetRoomAnalytics {
  totalAttendees: number;
  uniqueAttendees: number;
  peakConcurrent: number;
  avgDurationSecs: number;
  totalRecordings: number;
}
