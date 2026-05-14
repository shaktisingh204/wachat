/**
 * Notices shared helpers — KPI math, filter types, status derivation.
 */

import type { WsNotice, WsNoticeView } from '@/lib/worksuite/knowledge-types';

export type NoticesKpiKey = 'all' | 'active' | 'pinned' | 'expired';

export type NoticesAudienceFilter = 'all' | 'everyone' | 'department' | 'employee';

export interface NoticesFilterState {
    search: string;
    kpiKey: NoticesKpiKey;
    audience: NoticesAudienceFilter;
    author: string;
    fromIso: string;
    toIso: string;
}

export const NOTICES_INITIAL_FILTERS: NoticesFilterState = {
    search: '',
    kpiKey: 'all',
    audience: 'all',
    author: '',
    fromIso: '',
    toIso: '',
};

export interface NoticesKpiCounts {
    total: number;
    active: number;
    pinned: number;
    expired: number;
    byEveryone: number;
    byDepartment: number;
    byEmployee: number;
    acknowledgedPct: number;
}

export function toDate(v: unknown): Date | null {
    if (!v) return null;
    const d = new Date(v as string);
    return Number.isFinite(d.getTime()) ? d : null;
}

export function fmtDate(v: unknown): string {
    const d = toDate(v);
    return d ? d.toLocaleDateString() : '—';
}

export function computeNoticesKpis(
    notices: readonly WsNotice[],
    views: readonly WsNoticeView[],
): NoticesKpiCounts {
    let pinned = 0;
    let active = 0;
    let expired = 0;
    let byEveryone = 0;
    let byDepartment = 0;
    let byEmployee = 0;
    const now = Date.now();
    for (const n of notices) {
        const created = toDate(n.createdAt);
        // No explicit expiry in current schema; treat older than 90 days as expired.
        const ageMs = created ? now - created.getTime() : 0;
        if (ageMs > 90 * 24 * 60 * 60 * 1000) expired += 1;
        else active += 1;
        if (n.pinned) pinned += 1;
        if (n.notice_to === 'all') byEveryone += 1;
        else if (n.notice_to === 'department') byDepartment += 1;
        else if (n.notice_to === 'employee') byEmployee += 1;
    }
    const viewedIds = new Set(views.map((v) => v.notice_id));
    const acknowledgedPct =
        notices.length === 0
            ? 0
            : Math.round(
                  (notices.filter((n) => viewedIds.has(String(n._id))).length / notices.length) * 100,
              );

    return {
        total: notices.length,
        active,
        pinned,
        expired,
        byEveryone,
        byDepartment,
        byEmployee,
        acknowledgedPct,
    };
}

export function filterNotices<T extends WsNotice>(notices: T[], f: NoticesFilterState): T[] {
    const q = f.search.trim().toLowerCase();
    const from = f.fromIso ? new Date(f.fromIso).getTime() : null;
    const to = f.toIso ? new Date(f.toIso).getTime() : null;
    return notices.filter((n) => {
        if (q) {
            const hay = `${n.heading ?? ''} ${n.description ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (f.audience === 'everyone' && n.notice_to !== 'all') return false;
        if (f.audience === 'department' && n.notice_to !== 'department') return false;
        if (f.audience === 'employee' && n.notice_to !== 'employee') return false;
        if (f.kpiKey === 'pinned' && !n.pinned) return false;
        const created = toDate(n.createdAt);
        if (created && from !== null && created.getTime() < from) return false;
        if (created && to !== null && created.getTime() > to) return false;
        if (f.kpiKey === 'expired') {
            const age = created ? Date.now() - created.getTime() : 0;
            if (age <= 90 * 24 * 60 * 60 * 1000) return false;
        }
        if (f.kpiKey === 'active') {
            const age = created ? Date.now() - created.getTime() : 0;
            if (age > 90 * 24 * 60 * 60 * 1000) return false;
        }
        return true;
    });
}
