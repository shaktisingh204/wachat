/**
 * Shared TS types for `team-chat.actions.ts`.
 *
 * Kept in a sibling file (not the `'use server'` module) because some
 * Next.js builds reject non-async exports from server-action files.
 */
import type { WithId } from 'mongodb';
import type { TeamMessage } from '@/lib/definitions';

export type TeamReactionView = {
    emoji: string;
    count: number;
    userIds: string[];
};

export type TeamThreadView = {
    root: WithId<TeamMessage>;
    replies: WithId<TeamMessage>[];
};

export type PinnedMessageView = WithId<TeamMessage> & {
    pinnedAt: string;
    pinnedBy: string;
};

export type BookmarkView = {
    _id: string;
    channelId: string;
    messageId: string;
    savedAt: string;
    message?: WithId<TeamMessage>;
};

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

export type PresenceView = {
    userId: string;
    status: PresenceStatus;
    statusText?: string;
    lastActiveAt: string;
};

export type HuddleView = {
    _id: string;
    channelId: string;
    startedBy: string;
    status: 'active' | 'ended';
    participantIds: string[];
    startedAt: string;
    endedAt?: string;
};
