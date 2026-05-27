/**
 * Types extracted from sabmeet.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type SabmeetRoomStatus = 'scheduled' | 'live' | 'ended' | 'canceled';

export type SabmeetRecordingStatus = 'recording' | 'processing' | 'ready' | 'failed';

export interface MeetRoom {
  _id: string;
  userId?: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  hostDisplayName?: string;
  maxParticipants?: number;
  enableWaitingRoom?: boolean;
  enableRecording?: boolean;
  enableChat?: boolean;
  enableScreenShare?: boolean;
  enablePolls?: boolean;
  enableQna?: boolean;
  enableBreakout?: boolean;
  enableDialIn?: boolean;
  dialInNumbers?: string[];
  password?: string;
  status: SabmeetRoomStatus;
  participants?: Array<{
    _id: string;
    userId?: string;
    displayName: string;
    role: 'host' | 'co-host' | 'attendee';
    joinedAt?: string;
    leftAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetPoll {
  _id: string;
  roomId: string;
  question: string;
  options: Array<{ id: string; label: string; voteCount: number }>;
  closed?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface MeetQna {
  _id: string;
  roomId: string;
  question: string;
  askerName?: string;
  answer?: string;
  answered?: boolean;
  answeredBy?: string;
  createdAt?: string;
  answeredAt?: string;
}

export interface MeetRecording {
  _id: string;
  roomId: string;
  userId?: string;
  fileName?: string;
  fileKey?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status: SabmeetRecordingStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
