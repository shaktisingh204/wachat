/**
 * Revenue Recognition — ASC 606 helpers.
 *
 * For each invoice line item with a defined service period we generate a
 * `RevenueRecognition` record holding a daily/monthly schedule. A nightly
 * cron worker then walks the schedule, marks past entries as recognized,
 * and posts the accounting journal.
 *
 * Two methods are supported:
 *   - `ratable_daily`   : straight-line allocation per day in the period.
 *   - `ratable_monthly` : straight-line allocation per calendar month.
 *   - `point_in_time`   : recognize entire amount on `periodStart`.
 */

import type { Invoice, RevenueRecognition } from './types';

export interface RecognitionScheduleInput {
    method: 'ratable_daily' | 'ratable_monthly' | 'point_in_time';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function recognizeRevenue(
    invoice: Invoice,
    schedule: RecognitionScheduleInput,
): RevenueRecognition[] {
    if (!invoice.lineItems?.length) return [];
    if (!invoice._id) {
        throw new Error('invoice._id required for revenue recognition');
    }

    const out: RevenueRecognition[] = [];

    invoice.lineItems.forEach((line, idx) => {
        const start = line.periodStart ?? invoice.periodStart ?? invoice.issuedAt;
        const end = line.periodEnd ?? invoice.periodEnd ?? invoice.issuedAt;

        const ledger = buildSchedule(line.amountCents, start, end, schedule.method);

        out.push({
            invoiceId: invoice._id!,
            tenantId: invoice.tenantId,
            lineItemIndex: idx,
            totalCents: line.amountCents,
            currency: invoice.currency,
            periodStart: start,
            periodEnd: end,
            recognizedCents: 0,
            deferredCents: line.amountCents,
            method: schedule.method,
            schedule: ledger,
        });
    });

    return out;
}

function buildSchedule(
    totalCents: number,
    startIso: string,
    endIso: string,
    method: 'ratable_daily' | 'ratable_monthly' | 'point_in_time',
): RevenueRecognition['schedule'] {
    if (method === 'point_in_time' || startIso === endIso) {
        return [{ date: startIso, amountCents: totalCents, recognized: false }];
    }

    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (end <= start) {
        return [{ date: startIso, amountCents: totalCents, recognized: false }];
    }

    if (method === 'ratable_daily') {
        const days = Math.max(1, Math.round((end - start) / DAY_MS));
        const per = Math.floor(totalCents / days);
        const remainder = totalCents - per * days;
        const out: RevenueRecognition['schedule'] = [];
        for (let i = 0; i < days; i += 1) {
            const date = new Date(start + i * DAY_MS).toISOString();
            // Drop remainder onto last day so totals reconcile exactly.
            const amount = i === days - 1 ? per + remainder : per;
            out.push({ date, amountCents: amount, recognized: false });
        }
        return out;
    }

    // ratable_monthly
    const out: RevenueRecognition['schedule'] = [];
    const months: string[] = [];
    const cursor = new Date(start);
    cursor.setUTCDate(1);
    while (cursor.getTime() <= end) {
        months.push(cursor.toISOString());
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    if (!months.length) months.push(new Date(start).toISOString());

    const per = Math.floor(totalCents / months.length);
    const remainder = totalCents - per * months.length;
    months.forEach((d, i) => {
        const amount = i === months.length - 1 ? per + remainder : per;
        out.push({ date: d, amountCents: amount, recognized: false });
    });
    return out;
}

/**
 * Walk a recognition record and recompute `recognizedCents` / `deferredCents`
 * by marking schedule entries with `date <= now` as recognized. Useful for
 * the nightly recognition cron.
 */
export function applyRecognitionAsOf(
    record: RevenueRecognition,
    asOf: Date = new Date(),
): RevenueRecognition {
    const cutoff = asOf.getTime();
    let recognized = 0;
    const schedule = record.schedule.map((entry) => {
        const due = new Date(entry.date).getTime() <= cutoff;
        if (due) recognized += entry.amountCents;
        return { ...entry, recognized: due };
    });
    return {
        ...record,
        schedule,
        recognizedCents: recognized,
        deferredCents: Math.max(0, record.totalCents - recognized),
    };
}
