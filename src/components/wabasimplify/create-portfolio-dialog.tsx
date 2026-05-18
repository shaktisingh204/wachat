

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createSite } from '@/app/actions/portfolio.actions';

const initialState = { message: undefined, error: undefined, siteId: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Site
        </ZoruButton>
    )
}

interface CreatePortfolioDialogProps {
    onSuccess: () => void;
}

export function CreatePortfolioDialog({ onSuccess }: CreatePortfolioDialogProps) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(createSite, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSuccess();
            setOpen(false);
        }
        if (state.error) {
            toast({ title: 'Error Creating Site', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSuccess]);

    return (
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Site
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle>Create New Site</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Enter a name for your new portfolio or landing page site.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="name">Site Name</ZoruLabel>
                                <ZoruInput id="name" name="name" placeholder="e.g., My Awesome Portfolio" required />
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
