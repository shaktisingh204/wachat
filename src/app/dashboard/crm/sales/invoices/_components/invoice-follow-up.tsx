'use client';

import * as React from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, useToast } from '@/components/sabcrm/20ui/compat';
import { Clock, Bell, Mail, MessageSquare, ShieldAlert, CheckCircle2 } from 'lucide-react';

export function InvoiceFollowUp({ invoiceId }: { invoiceId: string }) {
    const { toast } = useToast();
    const [scheduled, setScheduled] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [channel, setChannel] = React.useState<'email' | 'whatsapp' | 'both'>('email');
    const [frequency, setFrequency] = React.useState<'gentle' | 'standard' | 'aggressive'>('standard');
    const [customCc, setCustomCc] = React.useState('');

    const handleSave = () => {
        setLoading(true);
        setTimeout(() => {
            setScheduled(true);
            setLoading(false);
            toast({
                title: 'Follow-up strategy saved',
                description: `Reminders will be sent via ${channel === 'both' ? 'Email & WhatsApp' : channel.toUpperCase()} using a ${frequency} template pacing.`,
            });
        }, 800);
    };

    const handleCancel = () => {
        setLoading(true);
        setTimeout(() => {
            setScheduled(false);
            setLoading(false);
            toast({
                title: 'Automated follow-ups disabled',
                description: 'Automated triggers have been cancelled for this invoice.',
                variant: 'destructive',
            });
        }, 500);
    };

    return (
        <Card className="border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--st-border)] pb-3">
                <div className="flex flex-col gap-0.5">
                    <CardTitle className="text-[14px] font-semibold text-[var(--st-text)]">Automated Dunning & Follow-ups</CardTitle>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">Set up proactive, automated payment reminders and dunning sequences.</p>
                </div>
                <Bell className="h-4 w-4 text-[var(--st-text-secondary)]" />
            </CardHeader>
            <CardBody className="pt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Channel Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">
                            Communication Channel
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setChannel('email')}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition ${
                                    channel === 'email'
                                        ? 'border-primary bg-[var(--st-text)]/5 text-[var(--st-text)] font-medium'
                                        : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                }`}
                            >
                                <Mail className="h-4 w-4" />
                                Email
                            </button>
                            <button
                                type="button"
                                onClick={() => setChannel('whatsapp')}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition ${
                                    channel === 'whatsapp'
                                        ? 'border-primary bg-[var(--st-text)]/5 text-[var(--st-text)] font-medium'
                                        : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                }`}
                            >
                                <MessageSquare className="h-4 w-4" />
                                WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={() => setChannel('both')}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs gap-1 transition ${
                                    channel === 'both'
                                        ? 'border-primary bg-[var(--st-text)]/5 text-[var(--st-text)] font-medium'
                                        : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                }`}
                            >
                                <div className="flex gap-0.5">
                                    <Mail className="h-3 w-3" />
                                    <MessageSquare className="h-3 w-3" />
                                </div>
                                Multi-Channel
                            </button>
                        </div>
                    </div>

                    {/* Cadence Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">
                            Pacing Strategy
                        </label>
                        <select
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-lg px-3 py-2 text-xs text-[var(--st-text)] focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="gentle">Gentle (-3d, Due, +7d)</option>
                            <option value="standard">Standard (-3d, Due, +3d, +7d, +14d)</option>
                            <option value="aggressive">Aggressive (-5d, -1d, Due, +2d, +5d, +10d, +15d)</option>
                        </select>
                    </div>
                </div>

                {/* Additional CC Options */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">
                        Escalation CC Email (Optional)
                    </label>
                    <input
                        type="email"
                        placeholder="finance-escalation@company.com"
                        value={customCc}
                        onChange={(e) => setCustomCc(e.target.value)}
                        className="w-full bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-lg px-3 py-2 text-xs text-[var(--st-text)] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[var(--st-bg-muted)] p-3 rounded-lg border border-[var(--st-border)] mt-1">
                    <div className="flex items-start gap-2.5">
                        {scheduled ? (
                            <CheckCircle2 className="h-5 w-5 text-[var(--st-text)] mt-0.5" />
                        ) : (
                            <ShieldAlert className="h-5 w-5 text-[var(--st-text-secondary)] mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[12.5px] font-semibold text-[var(--st-text)]">
                                {scheduled ? 'Dunning Active' : 'Automated Dunning Suspended'}
                            </span>
                            <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                                {scheduled
                                    ? `Scheduled to fire reminders using ${frequency} cadence via ${channel}.`
                                    : 'Activate to trigger reminders based on the chosen strategy.'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {scheduled && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                onClick={handleCancel}
                                className="text-[var(--st-danger)] border-[var(--st-danger)] hover:bg-[var(--st-danger)]/5"
                            >
                                Disable
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant={scheduled ? 'outline' : 'default'}
                            disabled={loading}
                            onClick={handleSave}
                        >
                            {loading ? 'Saving...' : scheduled ? 'Update Strategy' : 'Enable Strategy'}
                        </Button>
                    </div>
                </div>

                {scheduled && (
                    <p className="text-[11px] text-[var(--st-text-secondary)] flex items-center gap-1.5 font-mono">
                        <Clock className="h-3 w-3 text-[var(--st-text)] animate-pulse" /> Next dunning trigger: 3 days before due date.
                    </p>
                )}
            </CardBody>
        </Card>
    );
}
