
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoaderCircle, Save, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateProjectTags } from '@/app/actions/index'; // Ensure this export exists
import type { WithId, Project, Tag } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };


function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Tags
        </Button>
    );
}

interface ProjectTagsManagerDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    project: WithId<Project>;
    onTagsUpdated: (tags: Tag[]) => void;
}

export function ProjectTagsManagerDialog({ isOpen, onOpenChange, project, onTagsUpdated }: ProjectTagsManagerDialogProps) {
    const [state, formAction] = useActionState(handleUpdateProjectTags, initialState);
    const { toast } = useToast();
    const [tags, setTags] = useState<Tag[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTags(JSON.parse(JSON.stringify(project.tags || [])));
        }
    }, [isOpen, project.tags]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onTagsUpdated(tags); // Optimistically update or rely on parent re-fetch
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, toast, onOpenChange]);

    const handleAddTag = () => {
        setTags(prev => [
            ...prev,
            { _id: `temp_${uuidv4()}`, name: '', color: '#CCCCCC' }
        ]);
    };

    const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
        setTags(prev => prev.map(tag => (tag._id === id ? { ...tag, [field]: value } : tag)));
        setValidationError(null);
    };

    const handleRemoveTag = (id: string) => {
        setTags(prev => prev.filter(tag => tag._id !== id));
    };

    const validateAndSubmit = (formData: FormData) => {
        const currentTags = JSON.parse(formData.get('tags') as string || '[]') as Tag[];
        const names = currentTags.map(t => t.name.trim().toLowerCase());

        if (names.some(name => name === '')) {
            setValidationError('Tag names cannot be empty. Please fill them in or remove the blank tags.');
            return;
        }

        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
            setValidationError('Tag names must be unique. Please remove or rename duplicates.');
            return;
        }

        setValidationError(null);
        formAction(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form action={validateAndSubmit}>
                    <input type="hidden" name="projectId" value={project._id.toString()} />
                    <input type="hidden" name="tags" value={JSON.stringify(tags.map(t => ({ name: t.name, color: t.color, _id: t._id })).filter(t => t.name.trim()))} />
                    <DialogHeader>
                        <DialogTitle>Manage Project Tags</DialogTitle>
                        <DialogDescription>Create, edit, or delete tags for this project.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-[1fr,auto,auto] items-center gap-2 p-2 font-medium text-sm text-muted-foreground">
                            <span>Tag Name</span>
                            <span className="text-center">Color</span>
                            <span className="w-10"></span>
                        </div>
                        <div className="space-y-2">
                            {tags.map(tag => (
                                <div key={tag._id} className="grid grid-cols-[1fr,auto,auto] items-center gap-2">
                                    <Input
                                        value={tag.name}
                                        onChange={(e) => handleTagChange(tag._id, 'name', e.target.value)}
                                        placeholder="Enter tag name"
                                    />
                                    <Input
                                        type="color"
                                        value={tag.color}
                                        onChange={(e) => handleTagChange(tag._id, 'color', e.target.value)}
                                        className="h-9 w-14 p-1"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTag(tag._id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" className="w-full" onClick={handleAddTag}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Tag
                        </Button>
                        {validationError && <p className="text-sm text-destructive">{validationError}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton disabled={!!validationError} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
