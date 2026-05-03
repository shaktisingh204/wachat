/**
 * Alert evaluation. Reads enabled rules for the tenant, evaluates each
 * against the metrics store and fires notifications via existing
 * channels. De-duplicates using `lastFiredAt + cooldownMinutes`.
 */

import 'server-only';

import type { AlertEvaluationResult, AlertOp, AlertRule } from './types';
import { readWindow } from './metrics';

const RULES_COLLECTION = 'analytics_alert_rules';

async function db() {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    return db;
}

function compare(actual: number, op: AlertOp, threshold: number): boolean {
    switch (op) {
        case 'gt':
            return actual > threshold;
        case 'gte':
            return actual >= threshold;
        case 'lt':
            return actual < threshold;
        case 'lte':
            return actual <= threshold;
        case 'eq':
            return actual === threshold;
        case 'ne':
            return actual !== threshold;
        default:
            return false;
    }
}

async function notify(
    rule: AlertRule,
    actualValue: number,
): Promise<void> {
    const message = `[Alert] ${rule.name}: ${rule.metric} (${rule.agg}) is ${actualValue} ${rule.op} ${rule.threshold}`;
    for (const ch of rule.channels) {
        try {
            if (ch.type === 'email') {
                const mod = await import('@/lib/email-service');
                const sendEmail = (mod as Record<string, unknown>)['sendEmail'] as
                    | ((args: { to: string; subject: string; html: string }) => Promise<unknown>)
                    | undefined;
                if (typeof sendEmail === 'function') {
                    await sendEmail({
                        to: ch.to,
                        subject: `[Alert] ${rule.name}`,
                        html: `<p>${message}</p>`,
                    }).catch(() => undefined);
                }
            } else if (ch.type === 'inapp') {
                const { notifyTeamMember } = await import('@/lib/team-notifications');
                await notifyTeamMember({
                    recipientUserId: ch.userId,
                    message,
                    eventType: 'analytics_alert',
                    sourceApp: 'system',
                }).catch(() => undefined);
            } else if (ch.type === 'webhook') {
                await fetch(ch.url, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        ruleId: rule._id,
                        name: rule.name,
                        metric: rule.metric,
                        actualValue,
                        threshold: rule.threshold,
                        op: rule.op,
                    }),
                }).catch(() => undefined);
            }
        } catch {
            // Channel failures should not block the alert evaluation loop.
        }
    }
}

export async function evaluateAlerts(
    tenantId: string,
): Promise<AlertEvaluationResult[]> {
    const database = await db();
    const rules = (await database
        .collection(RULES_COLLECTION)
        .find({ tenantId, enabled: true })
        .toArray()) as unknown as AlertRule[];

    const results: AlertEvaluationResult[] = [];
    for (const rule of rules) {
        const evaluatedAt = new Date();
        try {
            const actualValue = await readWindow(
                tenantId,
                rule.metric,
                rule.windowMinutes,
                rule.agg,
            );
            const fired = compare(actualValue, rule.op, rule.threshold);

            const cooldownMs = (rule.cooldownMinutes ?? 0) * 60_000;
            const lastFired = rule.lastFiredAt
                ? new Date(rule.lastFiredAt).getTime()
                : 0;
            const inCooldown = cooldownMs > 0 && Date.now() - lastFired < cooldownMs;

            if (fired && !inCooldown) {
                await notify(rule, actualValue);
                await database
                    .collection(RULES_COLLECTION)
                    .updateOne(
                        { _id: rule._id as any },
                        { $set: { lastFiredAt: evaluatedAt } },
                    )
                    .catch(() => undefined);
            }

            results.push({
                ruleId: String(rule._id ?? ''),
                fired: fired && !inCooldown,
                actualValue,
                threshold: rule.threshold,
                evaluatedAt,
                ...(inCooldown && fired ? { reason: 'cooldown' } : {}),
            });
        } catch (e: unknown) {
            results.push({
                ruleId: String(rule._id ?? ''),
                fired: false,
                actualValue: 0,
                threshold: rule.threshold,
                evaluatedAt,
                reason: e instanceof Error ? e.message : 'evaluation failed',
            });
        }
    }
    return results;
}

/** Convenience helper for create/update from the admin UI. */
export async function upsertAlertRule(rule: AlertRule): Promise<void> {
    if (!rule.tenantId) throw new Error('tenantId required');
    const database = await db();
    if (rule._id) {
        await database
            .collection(RULES_COLLECTION)
            .updateOne({ _id: rule._id as any }, { $set: rule }, { upsert: true });
    } else {
        await database.collection(RULES_COLLECTION).insertOne(rule as any);
    }
}
