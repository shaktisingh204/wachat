'use client';

import { useState } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    Button, Input, Label, Select, ZoruSelectContent, ZoruSelectItem, 
    ZoruSelectTrigger, ZoruSelectValue 
} from '@/components/zoruui';
import { CalendarClock, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { scheduleAnalyticsReport } from '@/app/actions/crm-analytics-reports.actions';

export function ScheduleReportDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const emails = formData.get('emails') as string;
        const frequency = formData.get('frequency') as any;
        const format = formData.get('format') as any;

        try {
            await scheduleAnalyticsReport({
                emails: emails.split(',').map(e => e.trim()),
                frequency,
                format
            });
        } catch (err) {
            toast.error('Failed to schedule report');
            setLoading(false);
            return;
        }
        setLoading(false);
        setOpen(false);
        toast.success('Report scheduled successfully. You will receive it via email.');
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                    <CalendarClock className="h-3 w-3" />
                    Schedule
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Schedule Analytics Report</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Email Recipients</Label>
                        <Input 
                            name="emails"
                            type="text" 
                            required 
                            placeholder="comma separated emails..." 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Select required defaultValue="weekly" name="frequency">
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select frequency" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                                <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                                <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <Select required defaultValue="pdf" name="format">
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select format" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="pdf">PDF Document</ZoruSelectItem>
                                <ZoruSelectItem value="png">PNG Image</ZoruSelectItem>
                                <ZoruSelectItem value="csv">Raw Data (CSV)</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Scheduling...' : 'Schedule Delivery'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
