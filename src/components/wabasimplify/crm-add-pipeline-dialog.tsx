'use client';

import { useTransition, useState } from 'react';
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
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton variant="outline" className={defaultName ? "hidden" : ""}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Pipeline
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-foreground">Create New Pipeline</ZoruDialogTitle>
                        <ZoruDialogDescription className="text-muted-foreground">
                            Add a new sales pipeline to your CRM.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name" className="text-foreground">Pipeline Name</ZoruLabel>
                            <ZoruInput
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Enterprise Sales"
                                required
                            />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <ZoruButton
                            type="submit"
                            variant="obsidian"
                            disabled={isPending}
                            leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
                        >
                            Create Pipeline
                        </ZoruButton>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
