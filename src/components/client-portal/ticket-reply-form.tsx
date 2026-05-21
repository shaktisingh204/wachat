'use client';

/**
 * Reply form for `/portal/client/tickets/[id]`. Submits via the
 * `replyToClientTicket` server action and refreshes the page so the
 * new reply appears in the thread.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { ZoruButton } from '@/components/zoruui/button';
import { ZoruTextarea } from '@/components/zoruui/textarea';
import { replyToClientTicket } from '@/app/actions/client-portal.actions';

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const [message, setMessage] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        const res = await replyToClientTicket(ticketId, message);
        setSubmitting(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        setMessage('');
        router.refresh();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <ZoruTextarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your reply…"
                required
            />
            {error ? (
                <div className="text-sm text-zoru-danger-ink" role="alert">
                    {error}
                </div>
            ) : null}
            <div className="flex justify-end">
                <ZoruButton type="submit" disabled={submitting || !message.trim()}>
                    {submitting ? 'Sending…' : 'Send reply'}
                </ZoruButton>
            </div>
        </form>
    );
}
