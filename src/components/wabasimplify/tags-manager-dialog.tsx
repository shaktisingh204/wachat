
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
import { LoaderCircle, Save, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateUserProfile } from '@/app/actions/index.ts';
import type { WithId, User, Tag } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Tags
    </Button>
  );
}

interface TagsManagerDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: (Omit<User, 'password'> & { _id: string, tags?: Tag[] });
    onTagsUpdated: () => void;
}

export function TagsManagerDialog({ isOpen, onOpenChange, user, onTagsUpdated }: TagsManagerDialogProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
    const { toast } = useToast();
    const [tags, setTags] = useState<Tag[]>([]);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if(isOpen) {
            setTags(JSON.parse(JSON.stringify(user.tags || [])));
        }
    }, [isOpen, user.tags]);
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onTagsUpdated();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onTagsUpdated]);

    const handleAddTag = () => {
        setTags(prev => [
            ...prev,
            { _id: `temp_${uuidv4()}`, name: '', color: '#CCCCCC' }
        ]);
    };
    
    const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
        setTags(prev => prev.map(tag => (tag._id === id ? { ...tag, [field]: value } : tag)));
        setValidationError(null); // Clear error on change
    };
    
    const handleRemoveTag = (id: string) => {
        setTags(prev => prev.filter(tag => tag._id !== id));
    };
    
    const validateAndSubmit = (formData: FormData) => {
        const currentTags = JSON.parse(formData.get('tags') as string || '[]') as Tag[];
        const names = currentTags.map(t => t.name.trim().toLowerCase());
        
        if (names.some(name => name === '')) {
            setValidationError('Label names cannot be empty. Please fill them in or remove the blank labels.');
            return;
        }

        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
            setValidationError('Label names must be unique. Please remove or rename duplicates.');
            return;
        }
        
        setValidationError(null);
        formAction(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form action={validateAndSubmit}>
                    <input type="hidden" name="name" value={user.name} />
                    <input type="hidden" name="tags" value={JSON.stringify(tags.map(t => ({ name: t.name, color: t.color, _id: t._id })).filter(t => t.name.trim()))} />
                    <DialogHeader>
                        <DialogTitle>Manage Labels</DialogTitle>
                        <DialogDescription>Create, edit, or delete your custom labels.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-[1fr,auto,auto] items-center gap-2 p-2 font-medium text-sm text-muted-foreground">
                            <span>Label Name</span>
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
                            Add Label
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
