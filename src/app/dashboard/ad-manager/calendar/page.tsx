'use client';

import * as React from 'react';
import { Calendar, dateFnsLocalizer, Event as RBCEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-overrides.css';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { CalendarRange } from 'lucide-react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
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
                toast.error({ title: 'Error', description: res.error });
                setCampaigns([]);
            } else {
                setCampaigns(res.campaigns || []);
            }
            setLoading(false);
        });
    }, [activeAccount, toast]);

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
            // Runtime-computed status color passed to react-big-calendar's API.
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

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Calendar" />
                <EmptyState
                    icon={CalendarRange}
                    title="No ad account selected"
                    description="Pick an ad account to view the campaign calendar."
                    tone="warning"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Calendar" />
            <AmHeader
                title="Campaign calendar"
                description="View campaign schedules across the month. Overlapping campaigns will stack vertically."
            />

            {loading ? (
                <Skeleton height={600} width="100%" />
            ) : (
                <Card>
                    <CardBody>
                        <div className="h-[600px]">
                            <Calendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                className="h-full"
                                onSelectEvent={handleSelectEvent}
                                eventPropGetter={eventStyleGetter}
                                views={['month', 'week', 'day', 'agenda']}
                                defaultView="month"
                                popup={true}
                            />
                        </div>
                    </CardBody>
                </Card>
            )}

            <Dialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Quick edit campaign</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Field label="Campaign name">
                            <Input
                                placeholder="Campaign name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        </Field>
                        <dl className="space-y-2 text-sm text-[var(--st-text-secondary)]">
                            <div className="flex items-center gap-2">
                                <dt className="font-medium text-[var(--st-text)]">Status</dt>
                                <dd>
                                    <Badge tone="neutral">
                                        {selectedCampaign?.effective_status || selectedCampaign?.status}
                                    </Badge>
                                </dd>
                            </div>
                            <div className="flex gap-2">
                                <dt className="font-medium text-[var(--st-text)]">Start</dt>
                                <dd>{selectedCampaign?.start_time ? new Date(selectedCampaign.start_time).toLocaleString() : 'N/A'}</dd>
                            </div>
                            <div className="flex gap-2">
                                <dt className="font-medium text-[var(--st-text)]">End</dt>
                                <dd>{selectedCampaign?.stop_time ? new Date(selectedCampaign.stop_time).toLocaleString() : 'Ongoing'}</dd>
                            </div>
                        </dl>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedCampaign(null)}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                // Mock saving the campaign edit
                                setCampaigns(prev => prev.map(c =>
                                    c.id === selectedCampaign?.id
                                        ? { ...c, name: editName }
                                        : c
                                ));
                                toast.success({ title: 'Success', description: 'Campaign updated successfully.' });
                                setSelectedCampaign(null);
                            }}
                        >
                            Save changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
