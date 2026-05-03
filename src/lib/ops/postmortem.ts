/**
 * Postmortem template generator.
 *
 * Implements the standard "blameless postmortem" structure:
 *   - Summary / Impact
 *   - Root cause + 5-whys ladder
 *   - Contributing factors
 *   - Action items with owners + due dates
 *   - Timeline (re-uses the incident's timeline)
 *
 * Two helpers are provided: `generatePostmortem` builds a `Postmortem` data
 * object, and `renderMarkdown` produces a human-friendly report you can paste
 * into a doc / Slack / wiki.
 */

import type { Incident, Postmortem, PostmortemAction } from './types';

export interface GeneratePostmortemInput {
    id: string;
    incident: Incident;
    summary: string;
    impact: string;
    rootCause: string;
    fiveWhys: string[];
    contributingFactors?: string[];
    actionItems?: PostmortemAction[];
    author?: string;
    lessonsLearned?: string;
    createdAt?: number;
}

/** Build a `Postmortem` data object from explicit inputs. */
export function generatePostmortem(input: GeneratePostmortemInput): Postmortem {
    const fiveWhys = padFiveWhys(input.fiveWhys);
    return {
        id: input.id,
        incidentId: input.incident.id,
        createdAt: input.createdAt ?? Date.now(),
        author: input.author,
        summary: input.summary,
        impact: input.impact,
        rootCause: input.rootCause,
        fiveWhys,
        contributingFactors: input.contributingFactors ?? [],
        actionItems: input.actionItems ?? [],
        timeline: input.incident.timeline,
        lessonsLearned: input.lessonsLearned,
    };
}

/** Always emit exactly five "why" entries — pad with placeholders when callers under-supply. */
function padFiveWhys(input: string[]): string[] {
    const trimmed = input.slice(0, 5);
    while (trimmed.length < 5) {
        trimmed.push('(unknown — investigate further)');
    }
    return trimmed;
}

/** Emit a starter `Postmortem` for callers who'll fill in the prose later. */
export function emptyTemplate(incident: Incident, id: string, createdAt: number = Date.now()): Postmortem {
    return generatePostmortem({
        id,
        incident,
        summary: '(fill in: 2-3 sentence summary of what happened)',
        impact: '(fill in: who was affected and how)',
        rootCause: '(fill in: technical root cause)',
        fiveWhys: [],
        contributingFactors: [],
        actionItems: [],
        createdAt,
    });
}

/** Render a postmortem as markdown. */
export function renderMarkdown(postmortem: Postmortem, incident: Incident): string {
    const lines: string[] = [];
    lines.push(`# Postmortem — ${incident.title}`);
    lines.push('');
    lines.push(`- **Incident**: ${incident.id}`);
    lines.push(`- **Severity**: ${incident.severity}`);
    lines.push(`- **Status**: ${incident.status}`);
    lines.push(`- **Started**: ${new Date(incident.startedAt).toISOString()}`);
    if (incident.resolvedAt !== undefined) {
        lines.push(`- **Resolved**: ${new Date(incident.resolvedAt).toISOString()}`);
    }
    if (postmortem.author) lines.push(`- **Author**: ${postmortem.author}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(postmortem.summary);
    lines.push('');
    lines.push('## Impact');
    lines.push(postmortem.impact);
    lines.push('');
    lines.push('## Root cause');
    lines.push(postmortem.rootCause);
    lines.push('');
    lines.push('## 5 Whys');
    postmortem.fiveWhys.forEach((why, i) => {
        lines.push(`${i + 1}. ${why}`);
    });
    lines.push('');
    lines.push('## Contributing factors');
    if (postmortem.contributingFactors.length === 0) {
        lines.push('_None recorded._');
    } else {
        for (const factor of postmortem.contributingFactors) lines.push(`- ${factor}`);
    }
    lines.push('');
    lines.push('## Action items');
    if (postmortem.actionItems.length === 0) {
        lines.push('_None recorded._');
    } else {
        lines.push('| Action | Owner | Due | Status | Link |');
        lines.push('| --- | --- | --- | --- | --- |');
        for (const item of postmortem.actionItems) {
            const due = item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : '—';
            lines.push(
                `| ${item.description} | ${item.owner ?? '—'} | ${due} | ${item.status} | ${item.link ?? '—'} |`,
            );
        }
    }
    lines.push('');
    lines.push('## Timeline');
    if (postmortem.timeline.length === 0) {
        lines.push('_No timeline events recorded._');
    } else {
        for (const evt of postmortem.timeline) {
            lines.push(
                `- ${new Date(evt.timestamp).toISOString()} — **${evt.kind}**${evt.actor ? ` (${evt.actor})` : ''}: ${evt.message}`,
            );
        }
    }
    if (postmortem.lessonsLearned) {
        lines.push('');
        lines.push('## Lessons learned');
        lines.push(postmortem.lessonsLearned);
    }
    return lines.join('\n');
}
