'use client';

import * as React from 'react';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, useZoruToast } from '@/components/zoruui';
import { Clock, Bell } from 'lucide-react';

export function InvoiceFollowUp({ invoiceId }: { invoiceId: string }) {
    const { toast } = useZoruToast();
    const [scheduled, setScheduled] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const handleSchedule = () => {
        setLoading(true);
        // Placeholder for real scheduling logic
        setTimeout(() => {
            setScheduled(true);
            setLoading(false);
            toast({
                title: 'Follow-up scheduled',
                description: 'Automated reminders have been enabled for this invoice.',
            });
        }, 1000);
    };

    return (
        <Card>
            <ZoruCardHeader className="flex flex-row items-center justify-between">
                <ZoruCardTitle>Automated Follow-ups</ZoruCardTitle>
                <Bell className="h-4 w-4 text-zoru-ink-muted" />
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zoru-surface-2 p-3 rounded-md border border-zoru-line">
                    <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-zoru-ink">Schedule Reminders</span>
                        <span className="text-[12px] text-zoru-ink-muted">Automatically follow up via email before and after the due date.</span>
                    </div>
                    <Button 
                        size="sm" 
                        variant={scheduled ? 'outline' : 'default'}
                        disabled={loading || scheduled}
                        onClick={handleSchedule}
                    >
                        {loading ? 'Scheduling...' : scheduled ? 'Scheduled' : 'Enable Schedule'}
                    </Button>
                </div>
                {scheduled && (
                    <p className="mt-3 text-[11px] text-zoru-ink-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Next reminder scheduled 3 days before due date.
                    </p>
                )}
            </ZoruCardContent>
        </Card>
    );
}
