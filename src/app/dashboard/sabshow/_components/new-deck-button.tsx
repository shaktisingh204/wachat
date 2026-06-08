'use client';

/**
 * Create-deck dialog. Collects a title and creates a blank deck, then
 * navigates into the editor. A richer template gallery is deferred — the
 * old "From template" affordance was removed because it created an
 * identical blank deck (no template was ever attached).
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';

import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    Input,
} from '@/components/sabcrm/20ui';
import { createSabshowDeck } from '@/app/actions/sabshow.actions';

export function NewDeckButton() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function submit() {
        const t = title.trim() || 'Untitled deck';
        setError(null);
        startTransition(async () => {
            try {
                const deck = await createSabshowDeck({ title: t });
                setOpen(false);
                setTitle('');
                router.push(`/dashboard/sabshow/${deck._id}`);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'We could not create the deck. Please try again.');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button iconLeft={Plus} onClick={() => setOpen(true)}>
                New deck
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New deck</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Field
                        label="Deck title"
                        id="sabshow-title"
                        error={error ?? undefined}
                        help="You can rename the deck any time from the editor."
                    >
                        <Input
                            autoFocus
                            placeholder="e.g. Q1 board review"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submit();
                            }}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button iconLeft={Plus} onClick={submit} loading={pending} disabled={pending}>
                        {pending ? 'Creating' : 'Create deck'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
