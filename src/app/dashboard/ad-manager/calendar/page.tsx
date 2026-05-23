'use client';

import { Alert, ZoruAlertDescription, ZoruAlertTitle, Button, Card, ZoruCardContent, Skeleton, ZoruDialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Popover, ZoruPopoverTrigger, ZoruPopoverContent, Input, Label } from '@/components/zoruui';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
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
    const [scheduleDate, setScheduleDate] = React.useState<string | null>(null);
    const [newCampaignName, setNewCampaignName] = React.useState('');

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
            <div className="space-y-6">
                <AmBreadcrumb page="Calendar" />
                <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view the campaign calendar.</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const nullCells: (number | null)[] = new Array(startDay).fill(null);
    const dayCells: (number | null)[] = Array.from({ length: totalDays }, (_, i) => i + 1);
    const cells: (number | null)[] = [...nullCells, ...dayCells];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Calendar" />
            <AmHeader
                title="Campaign calendar"
                description="View campaign schedules across the month."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-semibold w-48 text-center inline-flex items-center justify-center gap-2">
                            <CalendarDays className="h-4 w-4" /> {monthLabel}
                        </span>
                        <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                }
            />

            {loading ? (
                <Skeleton className="h-96 w-full" />
            ) : (
                <Card>
                    <ZoruCardContent className="p-2">
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
                                        <div
                                            className="absolute top-1 left-1 bottom-1 right-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-sm z-0"
                                            onClick={() => {
                                                if (day) {
                                                    setScheduleDate(dateStr);
                                                    setNewCampaignName('');
                                                }
                                            }}
                                        />
                                        {day && <div className={`font-medium mb-1 relative z-10 pointer-events-none ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>{day}</div>}
                                        <div className="relative z-10 flex flex-col gap-0.5">
                                            {dayC.slice(0, 3).map((c) => (
                                                <a
                                                    key={c.id}
                                                    href={`/dashboard/ad-manager/campaigns/${c.id}`}
                                                    className="block truncate rounded px-1 py-0.5 text-white text-[10px] leading-tight hover:opacity-80"
                                                    style={{ maxWidth: '100%' }}
                                                >
                                                    <span className={`inline-block w-full truncate rounded px-1 ${statusColor(c.effective_status || c.status)}`}>
                                                        {c.name}
                                                    </span>
                                                </a>
                                            ))}
                                            {dayC.length > 3 && (
                                                <Popover>
                                                    <ZoruPopoverTrigger asChild>
                                                        <button className="text-muted-foreground text-[10px] text-left hover:text-foreground w-full py-0.5">+{dayC.length - 3} more</button>
                                                    </ZoruPopoverTrigger>
                                                    <ZoruPopoverContent className="w-64 p-2 z-50">
                                                        <div className="text-sm font-medium mb-2 border-b pb-1">Campaigns on {dateStr}</div>
                                                        <div className="space-y-1 max-h-60 overflow-y-auto">
                                                            {dayC.map(c => (
                                                                <a
                                                                    key={c.id}
                                                                    href={`/dashboard/ad-manager/campaigns/${c.id}`}
                                                                    className="block truncate rounded px-2 py-1 text-white text-xs leading-tight hover:opacity-80"
                                                                >
                                                                    <span className={`inline-block w-full truncate rounded px-1 ${statusColor(c.effective_status || c.status)}`}>
                                                                        {c.name}
                                                                    </span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </ZoruPopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ZoruCardContent>
                </Card>
            )}

            <ZoruDialog open={!!scheduleDate} onOpenChange={(o) => !o && setScheduleDate(null)}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Schedule Campaign for {scheduleDate}</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input 
                                placeholder="e.g. Summer Sale 2024" 
                                value={newCampaignName} 
                                onChange={(e) => setNewCampaignName(e.target.value)} 
                            />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setScheduleDate(null)}>Cancel</Button>
                        <Button 
                            className="bg-[#1877F2] hover:bg-[#1877F2]/90"
                            onClick={() => {
                                toast({ title: 'Scheduled', description: `Scheduled ${newCampaignName} for ${scheduleDate}` });
                                setScheduleDate(null);
                            }}
                        >
                            Schedule
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
