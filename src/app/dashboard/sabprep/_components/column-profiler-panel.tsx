'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardBody, Badge, Button, Progress } from '@/components/sabcrm/20ui';
import type { ColumnProfile } from '@/lib/rust-client/sabprep-profiles';

interface Props {
    profiles: ColumnProfile[];
    onAddSuggestion: (column: string, kind: string) => void;
}

export function ColumnProfilerPanel({ profiles, onAddSuggestion }: Props) {
    if (profiles.length === 0) {
        return null;
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Column profiler</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
                {profiles.map((p) => (
                    <ColumnRow key={p.name} profile={p} onAdd={onAddSuggestion} />
                ))}
            </CardBody>
        </Card>
    );
}

function ColumnRow({
    profile,
    onAdd,
}: {
    profile: ColumnProfile;
    onAdd: (column: string, kind: string) => void;
}) {
    const total = Math.max(1, profile.distinctCount + profile.nullCount);
    const nullPct = (profile.nullCount / total) * 100;
    return (
        <div className="grid gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--st-text)]">{profile.name}</span>
                <Badge variant="outline">{profile.type}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--st-text-secondary)]">
                <div>distinct: {profile.distinctCount}</div>
                <div>nulls: {profile.nullCount}</div>
                {typeof profile.mean === 'number' ? (
                    <div>mean: {profile.mean.toFixed(2)}</div>
                ) : (
                    <div />
                )}
            </div>
            <Progress value={Math.min(100, nullPct)} size="sm" />
            {profile.topValues && profile.topValues.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {profile.topValues.slice(0, 5).map((tv, i) => (
                        <Badge key={i} variant="secondary">
                            {String(tv.value)} - {tv.count}
                        </Badge>
                    ))}
                </div>
            ) : null}
            {profile.suggestedCleansing && profile.suggestedCleansing.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                    {profile.suggestedCleansing.map((s) => (
                        <Button
                            key={s.kind}
                            size="sm"
                            variant="outline"
                            title={s.reason}
                            onClick={() => onAdd(profile.name, s.kind)}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
