/**
 * Types extracted from team.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type InvitationView = {
    _id: string;
    token: string;
    inviteeEmail: string;
    role: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    inviterId: string;
    inviterName?: string;
    inviterEmail?: string;
    projectId?: string;
    projectName?: string;
    expiresAt: string;
    createdAt: string;
    isExpired: boolean;
};
