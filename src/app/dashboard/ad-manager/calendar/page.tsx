'use client';

import * as React from 'react';
import { LuCalendarDays, LuChevronLeft, LuChevronRight, LuAlertCircle } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getCampaignCalendarData } from '@/app/actions/ad-manager-features.actions';

type Campaign = {
    id: string;
    name: string;
    status: string;
    effective_status: string;
    start_time?: string;
    stop_time?: string;
};

function statusColor(status: string) {
    const s = status?.toUpperCase();
    if (s === 'ACTIVE') return 'bg-blue-500';
    if (s === 'PAUSED') return 'bg-amber-500';
    return 'bg-green-500';
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export default function CampaignCalendarPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
    const [currentDate, setCurrentDate] = React.useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month);
    const todayStr = new Date().toISOString().split('T')[0];

    React.useEffect(() => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        getCampaignCalendarData(actId).then((res) => {
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
                setCampaigns([]);
            } else {
                setCampaigns(res.campaigns || []);
            }
            setLoading(false);
        });
    }, [activeAccount]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const campaignsOnDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return campaigns.filter((c) => {
            const start = c.start_time ? c.start_time.split('T')[0] : null;
            const end = c.stop_time ? c.stop_time.split('T')[0] : null;
            if (!start) return false;
            if (start > dateStr) return false;
            if (end && end < dateStr) return false;
            return true;
        });
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <LuAlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view the campaign calendar.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells: (number | null)[] = Array.from({ length: startDay }, () => null).concat(
        Array.from({ length: totalDays }, (_, i) => i + 1)
    );
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <LuCalendarDays className="h-6 w-6" /> Campaign calendar
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    View campaign schedules across the month.
                </p>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={prevMonth}><LuChevronLeft className="h-4 w-4" /></Button>
                <span className="text-lg font-semibold w-48 text-center">{monthLabel}</span>
                <Button variant="outline" size="icon" onClick={nextMonth}><LuChevronRight className="h-4 w-4" /></Button>
            </div>

            {loading ? (
                <Skeleton className="h-96 w-full" />
            ) : (
                <Card>
                    <CardContent className="p-2">
                        <div className="grid grid-cols-7 gap-px">
                            {dayNames.map((d) => (
                                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                            ))}
                            {cells.map((day, idx) => {
                                const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                                const isToday = dateStr === todayStr;
                                const dayC = day ? campaignsOnDay(day) : [];
                                return (
                                    <div
                                        key={idx}
                                        className={`min-h-[80px] border rounded-sm p-1 text-xs ${isToday ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400' : 'border-border'} ${!day ? 'bg-muted/30' : ''}`}
                                    >
                                        {day && <div className={`font-medium mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>{day}</div>}
                                        {dayC.slice(0, 3).map((c) => (
                                            <a
                                                key={c.id}
                                                href={`/dashboard/ad-manager/campaigns/${c.id}`}
                                                className="block truncate rounded px-1 py-0.5 mb-0.5 text-white text-[10px] leading-tight hover:opacity-80"
                                                style={{ maxWidth: '100%' }}
                                            >
                                                <span className={`inline-block w-full truncate rounded px-1 ${statusColor(c.effective_status || c.status)}`}>
                                                    {c.name}
                                                </span>
                                            </a>
                                        ))}
                                        {dayC.length > 3 && <div className="text-muted-foreground text-[10px]">+{dayC.length - 3} more</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
