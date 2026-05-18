
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
import { LoaderCircle, Save, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateUserProfile } from '@/app/actions/index.ts';
import type { WithId, User, Tag } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Tags
    </ZoruButton>
  );
}

interface TagsManagerDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: (Omit<User, 'password'> & { _id: string, tags?: Tag[] });
    onTagsUpdated: () => void;
}

export function TagsManagerDialog({ isOpen, onOpenChange, user, onTagsUpdated }: TagsManagerDialogProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile as any, initialState as any);
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
            setValidationError('ZoruLabel names cannot be empty. Please fill them in or remove the blank labels.');
            return;
        }

        const uniqueNames = new Set(names);
        if (uniqueNames.size !== names.length) {
            setValidationError('ZoruLabel names must be unique. Please remove or rename duplicates.');
            return;
        }
        
        setValidationError(null);
        (formAction as any)(formData);
    };

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-lg">
                <form action={validateAndSubmit}>
                    <input type="hidden" name="name" value={user.name} />
                    <input type="hidden" name="tags" value={JSON.stringify(tags.map(t => ({ name: t.name, color: t.color, _id: t._id })).filter(t => t.name.trim()))} />
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Manage Labels</ZoruDialogTitle>
                        <ZoruDialogDescription>Create, edit, or delete your custom labels.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid grid-cols-[1fr,auto,auto] items-center gap-2 p-2 font-medium text-sm text-muted-foreground">
                            <span>ZoruLabel Name</span>
                            <span className="text-center">Color</span>
                            <span className="w-10"></span>
                        </div>
                        <div className="space-y-2">
                            {tags.map(tag => (
                                <div key={tag._id} className="grid grid-cols-[1fr,auto,auto] items-center gap-2">
                                    <ZoruInput
                                        value={tag.name}
                                        onChange={(e) => handleTagChange(tag._id, 'name', e.target.value)}
                                        placeholder="Enter tag name"
                                    />
                                    <ZoruInput
                                        type="color"
                                        value={tag.color}
                                        onChange={(e) => handleTagChange(tag._id, 'color', e.target.value)}
                                        className="h-9 w-14 p-1"
                                    />
                                    <ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveTag(tag._id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            ))}
                        </div>
                         <ZoruButton type="button" variant="outline" className="w-full" onClick={handleAddTag}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add ZoruLabel
                        </ZoruButton>
                        {validationError && <p className="text-sm text-destructive">{validationError}</p>}
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton disabled={!!validationError} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
