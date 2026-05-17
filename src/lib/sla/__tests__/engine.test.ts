/**
 * Unit tests for `src/lib/sla/engine.ts`. Runs with Node's built-in
 * `node:test` + `tsx` so no extra deps are required:
 *
 *   npx tsx --test src/lib/sla/__tests__/engine.test.ts
 *
 * Covers per §6.4:
 *   • basic minute math (24×7 SLAs)
 *   • business-hours skip (weekends / off-hours)
 *   • at-risk threshold (within last 25% of budget)
 *   • breach detection
 *   • rule matching specificity
 *
 * All tests are deterministic — every `evaluateBreachState` /
 * `isBreached` call passes an explicit `now`, and every business-hours
 * helper uses a fixed `Asia/Kolkata` calendar.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    addBusinessHours,
    computeDueBy,
    computeFirstResponseDueBy,
    computeResolutionDueBy,
    evaluateBreachState,
    findApplicableSlaRule,
    isBreached,
    DEFAULT_BUSINESS_HOURS,
    type BusinessHours,
    type SlaRule,
    type SlaTicket,
} from '../engine';

const KOLKATA_HOURS: BusinessHours = {
    timezone: 'Asia/Kolkata',
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
    startHour: 9,
    endHour: 18, // 9h workday
    holidays: [],
};

const RULE_24x7: SlaRule = {
    priority: 'high',
    firstResponseMinutes: 60,
    resolutionMinutes: 240,
    businessHoursOnly: false,
};

const RULE_BUSINESS: SlaRule = {
    priority: 'high',
    firstResponseMinutes: 60,
    resolutionMinutes: 240,
    businessHoursOnly: true,
};

/* ── Basic minute math (24×7) ─────────────────────────────────── */

test('computeDueBy: 24×7 rule adds wall-clock minutes', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = { createdAt: created, status: 'open' };

    const { firstResponseDueAt, resolutionDueAt } = computeDueBy(ticket, RULE_24x7);

    assert.equal(firstResponseDueAt?.toISOString(), '2026-05-18T11:00:00.000Z');
    assert.equal(resolutionDueAt?.toISOString(), '2026-05-18T14:00:00.000Z');
});

test('computeFirstResponseDueBy: 24×7 adds the requested minutes exactly', () => {
    const created = new Date('2026-05-18T00:00:00Z');
    const ticket: SlaTicket = { createdAt: created };
    const due = computeFirstResponseDueBy(ticket, {
        ...RULE_24x7,
        firstResponseMinutes: 15,
    });
    assert.equal(due.getTime() - created.getTime(), 15 * 60_000);
});

test('computeResolutionDueBy: 24×7 adds the requested minutes exactly', () => {
    const created = new Date('2026-05-18T00:00:00Z');
    const ticket: SlaTicket = { createdAt: created };
    const due = computeResolutionDueBy(ticket, {
        ...RULE_24x7,
        resolutionMinutes: 90,
    });
    assert.equal(due.getTime() - created.getTime(), 90 * 60_000);
});

test('computeDueBy: terminal status returns null on both clocks', () => {
    const ticket: SlaTicket = {
        createdAt: new Date('2026-05-18T10:00:00Z'),
        status: 'resolved',
    };
    const due = computeDueBy(ticket, RULE_24x7);
    assert.equal(due.firstResponseDueAt, null);
    assert.equal(due.resolutionDueAt, null);
});

test('computeDueBy: existing firstResponseAt suppresses firstResponseDueAt', () => {
    const ticket: SlaTicket = {
        createdAt: new Date('2026-05-18T10:00:00Z'),
        firstResponseAt: new Date('2026-05-18T10:30:00Z'),
        status: 'open',
    };
    const due = computeDueBy(ticket, RULE_24x7);
    assert.equal(due.firstResponseDueAt, null);
    assert.ok(due.resolutionDueAt instanceof Date);
});

/* ── Business-hours math ─────────────────────────────────────── */

test('addBusinessHours: stays inside the workday when budget fits', () => {
    // Mon 2026-05-18 10:00 IST  → 04:30 UTC. Add 60 minutes of work.
    const start = new Date('2026-05-18T04:30:00Z');
    const out = addBusinessHours(start, 60, KOLKATA_HOURS);
    assert.equal(out.toISOString(), '2026-05-18T05:30:00.000Z');
});

test('addBusinessHours: skips weekends — Friday 17:30 IST + 60min lands on Monday 09:30 IST', () => {
    // Friday 2026-05-15 17:30 IST = 12:00 UTC. Budget 60 min, workday ends 18:00 IST.
    // 30 min consumed Friday, 30 min carry into Monday → Monday 09:30 IST = 04:00 UTC.
    const friday = new Date('2026-05-15T12:00:00Z');
    const out = addBusinessHours(friday, 60, KOLKATA_HOURS);
    assert.equal(out.toISOString(), '2026-05-18T04:00:00.000Z');
});

test('addBusinessHours: a ticket arriving on Saturday jumps to Monday 09:00 IST', () => {
    // Saturday 2026-05-16 12:00 IST = 06:30 UTC. Add 30 min of work
    // → Monday 2026-05-18 09:30 IST = 04:00 UTC.
    const sat = new Date('2026-05-16T06:30:00Z');
    const out = addBusinessHours(sat, 30, KOLKATA_HOURS);
    assert.equal(out.toISOString(), '2026-05-18T04:00:00.000Z');
});

test('addBusinessHours: holiday on Monday rolls into Tuesday', () => {
    const bhWithHoliday: BusinessHours = {
        ...KOLKATA_HOURS,
        holidays: ['2026-05-18'],
    };
    // Saturday 2026-05-16 12:00 IST = 06:30 UTC.
    // Saturday/Sunday are off, Monday is a holiday → Tuesday 09:30 IST = 04:00 UTC.
    const sat = new Date('2026-05-16T06:30:00Z');
    const out = addBusinessHours(sat, 30, bhWithHoliday);
    assert.equal(out.toISOString(), '2026-05-19T04:00:00.000Z');
});

test('computeResolutionDueBy: business-hours rule respects weekends', () => {
    // Friday 2026-05-15 17:00 IST = 11:30 UTC. 4h of work to consume:
    //   60 min eats remainder of Friday, 180 min on Monday from 09:00 IST.
    //   → Monday 12:00 IST = 06:30 UTC.
    const ticket: SlaTicket = {
        createdAt: new Date('2026-05-15T11:30:00Z'),
        status: 'open',
    };
    const due = computeResolutionDueBy(ticket, RULE_BUSINESS, KOLKATA_HOURS);
    assert.equal(due.toISOString(), '2026-05-18T06:30:00.000Z');
});

/* ── At-risk threshold ───────────────────────────────────────── */

test('evaluateBreachState: ok when plenty of budget remains', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = { createdAt: created, status: 'open' };
    // 10 minutes elapsed of a 60-min first-response budget → 83% remaining.
    const now = new Date('2026-05-18T10:10:00Z');
    const state = evaluateBreachState(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(state.firstResponse, 'ok');
    assert.equal(state.resolution, 'ok');
});

test('evaluateBreachState: at_risk when within the last 25% of budget', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = { createdAt: created, status: 'open' };
    // 50 minutes elapsed of 60-min budget → 10 min left = 16.7% < 25% threshold.
    const now = new Date('2026-05-18T10:50:00Z');
    const state = evaluateBreachState(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(state.firstResponse, 'at_risk');
});

test('evaluateBreachState: still ok at exactly 75% elapsed (boundary)', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = { createdAt: created, status: 'open' };
    // 44 minutes elapsed of 60-min budget → 16 min left = 26.7% > 25%.
    const now = new Date('2026-05-18T10:44:00Z');
    const state = evaluateBreachState(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(state.firstResponse, 'ok');
});

/* ── Breach detection ────────────────────────────────────────── */

test('evaluateBreachState: first-response clock flips to breached past due', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = { createdAt: created, status: 'open' };
    const now = new Date('2026-05-18T11:01:00Z'); // 1 minute past due.
    const state = evaluateBreachState(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(state.firstResponse, 'breached');
});

test('evaluateBreachState: resolution clock independent of first-response', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = {
        createdAt: created,
        firstResponseAt: new Date('2026-05-18T10:30:00Z'), // agent already replied
        status: 'pending',
    };
    // 60 min after creation → 3 hours of resolution budget left = still ok.
    const now = new Date('2026-05-18T11:00:00Z');
    const state = evaluateBreachState(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(state.firstResponse, 'ok'); // suppressed — already responded
    assert.equal(state.resolution, 'ok');
    assert.equal(state.firstResponseDueBy, null);
});

test('evaluateBreachState: terminal status freezes both clocks to ok', () => {
    const ticket: SlaTicket = {
        createdAt: new Date('2020-01-01T00:00:00Z'), // ancient
        status: 'resolved',
    };
    const state = evaluateBreachState(ticket, RULE_24x7);
    assert.equal(state.firstResponse, 'ok');
    assert.equal(state.resolution, 'ok');
    assert.equal(state.firstResponseDueBy, null);
    assert.equal(state.resolutionDueBy, null);
});

test('isBreached: resolution breach reported with overdue minutes', () => {
    const created = new Date('2026-05-18T10:00:00Z');
    const ticket: SlaTicket = {
        createdAt: created,
        firstResponseAt: new Date('2026-05-18T10:30:00Z'),
        status: 'open',
    };
    // 4h budget → due at 14:00. now = 14:10 → 10 minutes overdue.
    const now = new Date('2026-05-18T14:10:00Z');
    const verdict = isBreached(ticket, RULE_24x7, DEFAULT_BUSINESS_HOURS, now);
    assert.equal(verdict.breached, true);
    assert.equal(verdict.type, 'resolution');
    assert.equal(verdict.minutesOverdue, 10);
});

test('isBreached: resolved tickets never report a breach', () => {
    const ticket: SlaTicket = {
        createdAt: new Date('2020-01-01T00:00:00Z'),
        status: 'closed',
    };
    const verdict = isBreached(ticket, RULE_24x7);
    assert.equal(verdict.breached, false);
    assert.equal(verdict.type, null);
});

/* ── Rule matching ───────────────────────────────────────────── */

test('findApplicableSlaRule: picks the priority+severity+channel match over a priority-only rule', () => {
    const rules: SlaRule[] = [
        { priority: 'high', firstResponseMinutes: 60, resolutionMinutes: 240, businessHoursOnly: false },
        {
            priority: 'high',
            severity: 'critical',
            channel: 'email',
            firstResponseMinutes: 15,
            resolutionMinutes: 60,
            businessHoursOnly: false,
            name: 'specific',
        },
    ];
    const ticket: SlaTicket = { priority: 'high', severity: 'critical', channel: 'email' };
    const rule = findApplicableSlaRule(ticket, rules);
    assert.equal(rule?.name, 'specific');
});

test('findApplicableSlaRule: rejects rules whose severity does not match the ticket', () => {
    const rules: SlaRule[] = [
        {
            priority: 'high',
            severity: 'critical',
            firstResponseMinutes: 15,
            resolutionMinutes: 60,
            businessHoursOnly: false,
        },
    ];
    const ticket: SlaTicket = { priority: 'high', severity: 'minor' };
    const rule = findApplicableSlaRule(ticket, rules);
    assert.equal(rule, null);
});

test('findApplicableSlaRule: returns null when no rules supplied', () => {
    assert.equal(findApplicableSlaRule({}, []), null);
});
