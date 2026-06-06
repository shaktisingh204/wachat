'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    EmptyState,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    useToast,
} from '@/components/sabcrm/20ui';
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
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();

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
            <EmptyState
                icon={CalendarOff}
                title="No active placements"
                description="Place a worker into a job first, then log their timesheet here."
            />
        );
    }

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const placement = placements.find((p) => p.id === placementId);
        if (!placement) {
            toast.error('Pick a placement');
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
                toast.success('Timesheet draft saved');
                router.refresh();
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <Card>
            <CardBody>
                <form onSubmit={onSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-2 flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-[var(--st-text-secondary)]">
                                Placement
                            </span>
                            <Select value={placementId} onValueChange={setPlacementId}>
                                <SelectTrigger aria-label="Placement">
                                    <SelectValue placeholder="Pick a placement" />
                                </SelectTrigger>
                                <SelectContent>
                                    {placements.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Field label="Week starting (Mon)">
                            <Input
                                type="date"
                                value={weekStart}
                                onChange={(e) => setWeekStart(e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {DAYS.map((d) => (
                            <Field key={d} label={<span className="uppercase">{d}</span>}>
                                <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    max="24"
                                    value={hours[d]}
                                    onChange={(e) => setHours((prev) => ({ ...prev, [d]: e.target.value }))}
                                />
                            </Field>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <span className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            Total
                            <Badge tone="info">{total.toFixed(2)} h</Badge>
                        </span>
                        <Button type="submit" variant="primary" loading={pending}>
                            {pending ? 'Saving' : 'Save draft'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
