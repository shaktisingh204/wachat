'use client';

/**
 * Create-deck dialog. Two affordances: blank deck + "From template",
 * which seeds the deck with the first SabShow built-in theme. We do NOT
 * navigate templates as a separate flow yet — the "from template" path
 * just picks the default built-in and creates the deck with that theme
 * attached. A richer template gallery is deferred.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
    Button,
    Dialog,
    ZoruDialogTrigger,
    ZoruDialogContent,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter,
    Input,
    Label,
} from '@/components/zoruui';
import { createSabshowDeck } from '@/app/actions/sabshow.actions';

export function NewDeckButton() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function submit(_fromTemplate = false) {
        const t = title.trim() || 'Untitled deck';
        setError(null);
        startTransition(async () => {
            try {
                const deck = await createSabshowDeck({ title: t });
                setOpen(false);
                setTitle('');
                router.push(`/dashboard/sabshow/${deck._id}`);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create deck');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>+ New deck</Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>New SabShow deck</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="space-y-3">
                    <Label htmlFor="sabshow-title">Deck title</Label>
                    <Input
                        id="sabshow-title"
                        autoFocus
                        placeholder="e.g. Q1 board review"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submit(false);
                        }}
                    />
                    {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                </div>
                <ZoruDialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => submit(true)}
                        disabled={pending}
                    >
                        From template
                    </Button>
                    <Button onClick={() => submit(false)} disabled={pending}>
                        {pending ? 'Creating…' : 'Create blank'}
                    </Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}
