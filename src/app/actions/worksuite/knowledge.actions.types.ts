/**
 * Types extracted from knowledge.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface AwardKpis {
    totalPrograms: number;
    thisMonth: number;
    uniqueRecipients: number;
    awardTypes: number;
}

export interface DiscussionKpis {
    total: number;
    open: number;
    closed: number;
    repliesThisWeek: number;
}

export interface EventKpis {
    total: number;
    upcoming: number;
    todayCount: number;
    pastThisMonth: number;
}

export interface NoticeKpis {
    total: number;
    active: number;
    expired: number;
    expiringIn7Days: number;
}
