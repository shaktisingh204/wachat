'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Input,
    Label,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui/compat';
import { addSabworkerlyTimesheet } from '@/app/actions/sabworkerly.actions';

interface PlacementOpt { id: string; label: string; workerId: string }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAYS)[number];

function mondayOf(d: Date): string {
    const dt = new Date(d);
    const day = dt.getDay(); // Sunday = 0
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return dt.toISOString().slice(0, 10);
}

export function NewTimesheetForm({ placements }: { placements: PlacementOpt[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [placementId, setPlacementId] = useState<string>(placements[0]?.id ?? '');
    const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
    const [hours, setHours] = useState<Record<DayKey, string>>({
        mon: '8', tue: '8', wed: '8', thu: '8', fri: '8', sat: '0', sun: '0',
    });

    const total = useMemo(
        () => DAYS.reduce((acc, k) => acc + (Number(hours[k]) || 0), 0),
        [hours],
    );

    if (placements.length === 0) {
        return (
            <p className="text-sm text-[color:var(--zoru-muted-fg)]">
                No active placements — place a worker into a job first.
            </p>
        );
    }

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        const placement = placements.find((p) => p.id === placementId);
        if (!placement) {
            setError('Pick a placement');
            return;
        }
        const dailyHoursJson = Object.fromEntries(
            DAYS.map((k) => [k, Number(hours[k]) || 0]),
        );
        startTransition(async () => {
            const res = await addSabworkerlyTimesheet({
                placementId,
                workerId: placement.workerId,
                weekStart: new Date(weekStart).toISOString(),
                dailyHoursJson,
                totalHours: total,
                status: 'draft',
            });
            if (res.success) {
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error && (
                <div className="rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-2 text-sm text-zoru-ink-muted">
                    {error}
                </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1 md:col-span-2">
                    <Label>Placement</Label>
                    <Select value={placementId} onValueChange={setPlacementId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {placements.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="weekStart">Week starting (Mon)</Label>
                    <Input
                        id="weekStart"
                        type="date"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {DAYS.map((d) => (
                    <div key={d} className="flex flex-col gap-1">
                        <Label htmlFor={`ts-${d}`} className="text-xs uppercase">{d}</Label>
                        <Input
                            id={`ts-${d}`}
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            value={hours[d]}
                            onChange={(e) => setHours((prev) => ({ ...prev, [d]: e.target.value }))}
                        />
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-[color:var(--zoru-muted-fg)]">
                    Total: <span className="font-semibold text-[color:var(--zoru-fg)]">{total.toFixed(2)} h</span>
                </span>
                <Button type="submit" disabled={pending}>
                    {pending ? 'Saving…' : 'Save draft'}
                </Button>
            </div>
        </form>
    );
}
