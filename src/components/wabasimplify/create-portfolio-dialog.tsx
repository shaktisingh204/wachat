

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createSite } from '@/app/actions/portfolio.actions';

const initialState = { message: null, error: undefined, siteId: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Site
        </Button>
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Site
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <form action={formAction} ref={formRef}>
                    <DialogHeader>
                        <DialogTitle>Create New Site</DialogTitle>
                        <DialogDescription>
                            Enter a name for your new portfolio or landing page site.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Site Name</Label>
                            <Input id="name" name="name" placeholder="e.g., My Awesome Portfolio" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
