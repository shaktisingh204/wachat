
'use client';

import { useState, useEffect, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { saveProjectTags, type Project, type Tag } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

interface TagsSettingsTabProps {
  project: WithId<Project>;
}

export function TagsSettingsTab({ project }: TagsSettingsTabProps) {
    const { toast } = useToast();
    const [tags, setTags] = useState<Tag[]>([]);
    const [isSaving, startSavingTransition] = useTransition();

    useEffect(() => {
        setTags(project.tags || []);
    }, [project.tags]);

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

    const handleSaveChanges = () => {
        startSavingTransition(async () => {
            // Filter out empty tags and ensure new tags get a real ID if needed.
            // For now, we assume frontend generates a temporary one. The backend could formalize this.
            const validTags = tags.filter(tag => tag.name.trim() !== '');
            const result = await saveProjectTags(project._id.toString(), validTags);
            if (result.success) {
                toast({ title: 'Success', description: 'Tags have been saved successfully.' });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <Card className="card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>Tags & Labels</CardTitle>
                <CardDescription>Create and manage colored tags to organize your contacts.</CardDescription>
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
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTag(tag._id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button variant="outline" className="w-full" onClick={handleAddTag}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tag
                </Button>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    );
}
