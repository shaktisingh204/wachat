/**
 * Funnel computation — pure function, no IO. Given a list of events and
 * an ordered list of step names, returns conversion stats per step.
 *
 * A user is counted at step N only if they performed steps 0..N in order
 * (chronologically), each occurring after the previous step's timestamp.
 * An optional time window restricts how long a funnel may take to complete.
 */

import type { FunnelEvent, FunnelResult, FunnelStepResult } from './types';

export interface ComputeFunnelOptions {
    /** Maximum allowed elapsed time between step 0 and step N (ms). */
    windowMs?: number;
}

function toMillis(ts: number | Date | string): number {
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return new Date(ts).getTime();
}

export function computeFunnel(
    events: FunnelEvent[],
    steps: string[],
    options: ComputeFunnelOptions = {},
): FunnelResult {
    if (!Array.isArray(steps) || steps.length === 0) {
        return {
            steps: [],
            totalEntered: 0,
            totalCompleted: 0,
            overallConversion: 0,
        };
    }

    // Group events per user, sorted by timestamp ascending.
    const byUser = new Map<string, FunnelEvent[]>();
    for (const ev of events) {
        if (!ev || !ev.userId || !ev.name) continue;
        const list = byUser.get(ev.userId);
        if (list) list.push(ev);
        else byUser.set(ev.userId, [ev]);
    }
    for (const list of byUser.values()) {
        list.sort((a, b) => toMillis(a.ts) - toMillis(b.ts));
    }

    const reachedAtStep = new Array<number>(steps.length).fill(0);

    for (const userEvents of byUser.values()) {
        let stepIdx = 0;
        let firstStepTs: number | null = null;
        for (const ev of userEvents) {
            if (ev.name !== steps[stepIdx]) continue;
            const ts = toMillis(ev.ts);
            if (stepIdx === 0) firstStepTs = ts;
            if (
                options.windowMs &&
                firstStepTs !== null &&
                ts - firstStepTs > options.windowMs
            ) {
                break;
            }
            reachedAtStep[stepIdx] += 1;
            stepIdx += 1;
            if (stepIdx >= steps.length) break;
        }
    }

    const totalEntered = reachedAtStep[0] ?? 0;
    const totalCompleted = reachedAtStep[reachedAtStep.length - 1] ?? 0;

    const stepResults: FunnelStepResult[] = steps.map((step, i) => {
        const users = reachedAtStep[i] ?? 0;
        const prev = i === 0 ? users : reachedAtStep[i - 1] ?? 0;
        const conversionFromPrev = prev === 0 ? 0 : users / prev;
        const conversionFromStart =
            totalEntered === 0 ? 0 : users / totalEntered;
        const dropOff = prev - users;
        return {
            step,
            users,
            conversionFromPrev,
            conversionFromStart,
            dropOff: dropOff < 0 ? 0 : dropOff,
        };
    });

    return {
        steps: stepResults,
        totalEntered,
        totalCompleted,
        overallConversion:
            totalEntered === 0 ? 0 : totalCompleted / totalEntered,
    };
}
