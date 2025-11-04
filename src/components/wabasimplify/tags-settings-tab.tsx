
'use client';

import { useState, useEffect, useActionState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { handleUpdateUserProfile, type User, type Tag } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

const updateTagsInitialState = { message: null, error: null };

interface TagsSettingsTabProps {
  user: (Omit<User, 'password'> & { _id: string, tags?: Tag[] });
}

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Tags
        </Button>
    )
}

export function TagsSettingsTab({ user }: TagsSettingsTabProps) {
    const { toast } = useToast();
    const [tags, setTags] = useState<Tag[]>([]);
    const [state, formAction] = useActionState(handleUpdateUserProfile, updateTagsInitialState);

    useEffect(() => {
        setTags(JSON.parse(JSON.stringify(user.tags || [])));
    }, [user.tags]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleAddTag = () => {
        setTags(prev => [
            ...prev,
            { _id: `temp_${Date.now()}`, name: '', color: '#CCCCCC' }
        ]);
    };

    const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
        setTags(prev => prev.map(tag => (tag._id === id ? { ...tag, [field]: value } : tag)));
    };

    const handleRemoveTag = (id: string) => {
        setTags(prev => prev.filter(tag => tag._id !== id));
    };

    return (
        <form action={formAction}>
            <input type="hidden" name="name" value={user.name} />
            <input type="hidden" name="tags" value={JSON.stringify(tags.map(t => ({ name: t.name, color: t.color })).filter(t => t.name.trim()))} />
            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Manage Your Tags</CardTitle>
                    <CardDescription>Create and manage colored tags to organize your short links and QR codes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-[1fr,auto,auto] items-center gap-2 p-2 border-b font-medium text-sm text-muted-foreground">
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
                </CardContent>
                <CardFooter>
                    <SaveButton />
                </CardFooter>
            </Card>
        </form>
    );
}
