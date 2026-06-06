'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import { CalendarClock, Mail } from 'lucide-react';
import { scheduleAnalyticsReport } from '@/app/actions/crm-analytics-reports.actions';

export function ScheduleReportDialog() {
    const { toast } = useToast();
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
            toast({ title: 'Error', description: 'Failed to schedule report', variant: 'destructive' });
            setLoading(false);
            return;
        }
        setLoading(false);
        setOpen(false);
        toast({ title: 'Success', description: 'Report scheduled successfully. You will receive it via email.' });
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
                            <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <Select required defaultValue="pdf" name="format">
                            <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pdf">PDF Document</SelectItem>
                                <SelectItem value="png">PNG Image</SelectItem>
                                <SelectItem value="csv">Raw Data (CSV)</SelectItem>
                            </SelectContent>
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
