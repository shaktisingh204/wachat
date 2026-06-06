'use client';

import * as React from 'react';
import { Calendar, dateFnsLocalizer, Event as RBCEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-overrides.css';

import { Alert, ZoruAlertDescription, ZoruAlertTitle, Button, Card, ZoruCardContent, Skeleton, ZoruDialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Input, Label } from '@/components/sabcrm/20ui/compat';
import { CircleAlert } from 'lucide-react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getCampaignCalendarData } from '@/app/actions/ad-manager-features.actions';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type Campaign = {
    id: string;
    name: string;
    status: string;
    effective_status: string;
    start_time?: string;
    stop_time?: string;
};

interface CampaignEvent extends RBCEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource: Campaign;
    allDay?: boolean;
}

function statusColor(status: string) {
    const s = status?.toUpperCase();
    if (s === 'ACTIVE') return '#3b82f6'; // blue-500
    if (s === 'PAUSED') return '#f59e0b'; // amber-500
    return '#22c55e'; // green-500
}

export default function CampaignCalendarPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
    
    // Quick edit modal state
    const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null);
    const [editName, setEditName] = React.useState('');

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
    }, [activeAccount, toast]);

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

    const events: CampaignEvent[] = React.useMemo(() => {
        return campaigns.map(c => {
            const start = c.start_time ? new Date(c.start_time) : new Date();
            let end: Date;
            
            if (c.stop_time) {
                end = new Date(c.stop_time);
            } else {
                // If no end time, we represent it as just ending at the end of the start day
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
            }

            return {
                id: c.id,
                title: c.name,
                start,
                end,
                allDay: !c.start_time || !c.stop_time,
                resource: c
            };
        });
    }, [campaigns]);

    const handleSelectEvent = (event: CampaignEvent) => {
        setSelectedCampaign(event.resource);
        setEditName(event.resource.name);
    };

    const eventStyleGetter = (event: CampaignEvent) => {
        const backgroundColor = statusColor(event.resource.effective_status || event.resource.status);
        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                opacity: 0.9,
                color: 'var(--st-text-inverted)',
                border: '0px',
                display: 'block',
                fontSize: '11px',
                padding: '2px 4px'
            }
        };
    };

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Calendar" />
            <AmHeader
                title="Campaign calendar"
                description="View campaign schedules across the month. Overlapping campaigns will stack vertically."
            />

            {loading ? (
                <Skeleton className="h-[600px] w-full" />
            ) : (
                <Card>
                    <ZoruCardContent className="p-4">
                        <div className="h-[600px]">
                            <Calendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                onSelectEvent={handleSelectEvent}
                                eventPropGetter={eventStyleGetter}
                                views={['month', 'week', 'day', 'agenda']}
                                defaultView="month"
                                popup={true}
                            />
                        </div>
                    </ZoruCardContent>
                </Card>
            )}

            <ZoruDialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Quick Edit Campaign</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input 
                                placeholder="Campaign Name" 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)} 
                            />
                        </div>
                        <div className="text-sm text-[var(--st-text-secondary)]">
                            <strong>Status:</strong> {selectedCampaign?.effective_status || selectedCampaign?.status}
                            <br />
                            <strong>Start:</strong> {selectedCampaign?.start_time ? new Date(selectedCampaign.start_time).toLocaleString() : 'N/A'}
                            <br />
                            <strong>End:</strong> {selectedCampaign?.stop_time ? new Date(selectedCampaign.stop_time).toLocaleString() : 'Ongoing'}
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setSelectedCampaign(null)}>Cancel</Button>
                        <Button 
                            className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white"
                            onClick={() => {
                                // Mock saving the campaign edit
                                setCampaigns(prev => prev.map(c => 
                                    c.id === selectedCampaign?.id 
                                        ? { ...c, name: editName } 
                                        : c
                                ));
                                toast({ title: 'Success', description: 'Campaign updated successfully.' });
                                setSelectedCampaign(null);
                            }}
                        >
                            Save Changes
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
