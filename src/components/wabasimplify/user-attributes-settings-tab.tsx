
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, Project, UserAttribute } from '@/lib/definitions';
import { handleSaveUserAttributes } from '@/app/actions/project.actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const saveAttributesInitialState = { message: null, error: null };

function SaveAttributesButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Attributes
    </Button>
  );
}

interface UserAttributesSettingsTabProps {
  project: WithId<Project>;
}

export function UserAttributesSettingsTab({ project }: UserAttributesSettingsTabProps) {
    const { toast } = useToast();
    const [attributes, setAttributes] = useState<UserAttribute[]>([]);
    const [state, formAction] = useActionState(handleSaveUserAttributes, saveAttributesInitialState);

    useEffect(() => {
        setAttributes(project.userAttributes || []);
    }, [project.userAttributes]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleAttributeChange = (index: number, value: string) => {
        const newAttributes = [...attributes];
        newAttributes[index].name = value;
        setAttributes(newAttributes);
    };

    const handleAddAttribute = () => {
        setAttributes(prev => [...prev, { id: uuidv4(), name: '', status: 'ACTIVE' }]);
    };

    const handleRemoveAttribute = (index: number) => {
        setAttributes(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="attributes" value={JSON.stringify(attributes)} />

            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                    <CardTitle>Custom User Attributes</CardTitle>
                    <CardDescription>Define custom data fields to store information about your contacts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {attributes.map((attr, index) => (
                            <div key={attr.id} className="flex items-center gap-2">
                                <Input
                                    value={attr.name}
                                    onChange={(e) => handleAttributeChange(index, e.target.value)}
                                    placeholder="e.g., membership_level, last_purchase_date"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveAttribute(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddAttribute}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Attribute
                    </Button>
                </CardContent>
                <CardFooter>
                    <SaveAttributesButton />
                </CardFooter>
            </Card>
        </form>
    );
}
