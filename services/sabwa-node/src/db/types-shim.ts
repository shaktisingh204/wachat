/**
 * Local mirror of the SabWa Mongo collection types.
 *
 * The single source of truth is `src/lib/sabwa/types.ts` in the Next.js
 * monorepo root. We can't import across service boundaries (different
 * `tsconfig.json`, no project-references wiring), so this file mirrors the
 * subset of `SabwaChat` / `SabwaMessage` that this worker reads/writes.
 *
 * **Keep this file 1:1 with `src/lib/sabwa/types.ts`.** If the canonical
 * shape changes, port the diff here.
 */

import type { ObjectId } from 'mongodb';

export type SabwaChatType = 'individual' | 'group' | 'broadcast' | 'status';

export type SabwaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll'
  | 'reaction'
  | 'system';

export type SabwaMessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface SabwaChatLastMessage {
  id: string;
  body: string;
  ts: Date;
  fromMe: boolean;
}

export interface SabwaChat {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  jid: string;
  type: SabwaChatType;
  name?: string;
  profilePicUrl?: string;
  lastMessage?: SabwaChatLastMessage;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  muteEndAt?: Date;
  labels: ObjectId[];
  isReadOnly?: boolean;
  participants?: number;
  updatedAt: Date;
}

export interface SabwaReaction {
  jid: string;
  emoji: string;
  ts: Date;
}

export interface SabwaMessage {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId: ObjectId;
  chatJid: string;
  messageId: string;
  fromJid: string;
  fromMe: boolean;
  type: SabwaMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaSize?: number;
  caption?: string;
  quotedMessageId?: string;
  reactions: SabwaReaction[];
  status: SabwaMessageStatus;
  forwarded?: boolean;
  starred?: boolean;
  ts: Date;
  editedAt?: Date;
  deletedAt?: Date;
}
