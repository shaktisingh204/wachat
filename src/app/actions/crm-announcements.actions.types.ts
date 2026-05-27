/**
 * Types extracted from crm-announcements.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface AnnouncementKpis {
    total: number;
    activeOrPinned: number;
    publishedThisMonth: number;
    drafts: number;
}
