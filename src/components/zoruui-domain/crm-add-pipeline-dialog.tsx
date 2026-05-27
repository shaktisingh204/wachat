'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
} from '@/components/zoruui';
import {
  useTransition,
  useState } from 'react';

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
            <ZoruDialogTrigger asChild>
                <Button variant="outline" className={defaultName ? "hidden" : ""}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Pipeline
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-zoru-ink">Create New Pipeline</ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Add a new sales pipeline to your CRM.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-zoru-ink">Pipeline Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Enterprise Sales"
                                required
                            />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="obsidian"
                            disabled={isPending}
                            leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
                        >
                            Create Pipeline
                        </Button>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
