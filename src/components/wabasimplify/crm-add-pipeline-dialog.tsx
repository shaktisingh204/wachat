'use client';

import { useTransition, useState } from 'react';
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
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCrmPipeline } from '@/app/actions/crm-pipelines.actions';

interface CrmAddPipelineDialogProps {
    onPipelineAdded: (pipeline: any) => void;
    defaultOpen?: boolean;
    defaultName?: string;
}

export function CrmAddPipelineDialog({ onPipelineAdded, defaultOpen = false, defaultName = '' }: CrmAddPipelineDialogProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [name, setName] = useState(defaultName);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        startTransition(async () => {
            const result = await createCrmPipeline(name);
            if (result.success && result.pipeline) {
                toast({ title: 'Success', description: 'Pipeline created successfully' });
                setOpen(false);
                onPipelineAdded(result.pipeline);
            } else {
                toast({ title: 'Error', description: result.error || 'Failed to create pipeline', variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={defaultName ? "hidden" : ""}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Pipeline
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Pipeline</DialogTitle>
                        <DialogDescription>
                            Add a new sales pipeline to your CRM.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Pipeline Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Enterprise Sales"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Create Pipeline
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
