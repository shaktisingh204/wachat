import * as React from 'react';

import type { SabmonitorTraceSpanDoc } from '@/lib/rust-client/sabmonitor-trace-spans';

/**
 * Server-rendered span waterfall. No interactivity yet — just shows each
 * span as a horizontal bar sized by `durationMs` and offset by relative
 * start time.
 */
export function TraceWaterfall({
    spans,
}: {
    spans: SabmonitorTraceSpanDoc[];
}): React.JSX.Element {
    if (spans.length === 0) {
        return <p className="text-sm text-[var(--st-text-secondary)]">No spans ingested for this trace.</p>;
    }
    const starts = spans.map((s) => new Date(s.startedAt).getTime());
    const minStart = Math.min(...starts);
    const ends = spans.map((s, i) => starts[i] + s.durationMs);
    const maxEnd = Math.max(...ends);
    const total = Math.max(maxEnd - minStart, 1);

    return (
        <ul className="flex flex-col gap-1.5">
            {spans.map((s) => {
                const start = new Date(s.startedAt).getTime() - minStart;
                const pctStart = (start / total) * 100;
                const pctWidth = Math.max((s.durationMs / total) * 100, 0.5);
                return (
                    <li key={s.spanId} className="flex items-center gap-2">
                        <div className="w-44 truncate text-[12px] text-[var(--st-text-secondary)]" title={`${s.service}.${s.operation}`}>
                            {s.service}.{s.operation}
                        </div>
                        <div className="relative h-5 flex-1 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                            <div
                                className={`absolute top-0 h-full rounded-[var(--st-radius)] ${s.errored ? 'bg-[var(--st-text)]/70' : 'bg-[var(--st-accent)]/70'}`}
                                style={{ left: `${pctStart}%`, width: `${pctWidth}%` }}
                                title={`${s.durationMs}ms`}
                            />
                        </div>
                        <div className="w-16 text-right text-[11px] text-[var(--st-text-secondary)]">{s.durationMs}ms</div>
                    </li>
                );
            })}
        </ul>
    );
}
