'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId,
  Project,
  UserAttribute } from '@/lib/definitions';
import { handleSaveUserAttributes } from '@/app/actions/project.actions';
import { useToast } from '@/hooks/use-toast';

import { LoaderCircle, Plus, Save, Trash2, Info } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const saveAttributesInitialState: any = { message: null, error: null };

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

type UIUserAttribute = UserAttribute & { isNew?: boolean };

export function UserAttributesSettingsTab({ project }: UserAttributesSettingsTabProps) {
    const { toast } = useToast();
    const [attributes, setAttributes] = useState<UIUserAttribute[]>([]);
    const [state, formAction] = useActionState(handleSaveUserAttributes, saveAttributesInitialState);

    useEffect(() => {
        setAttributes(project.userAttributes || []);
    }, [project.userAttributes]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            setAttributes(prev => prev.map(attr => {
              const { isNew, ...rest } = attr;
              return rest as UIUserAttribute;
            }));
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleAttributeChange = (index: number, field: keyof UIUserAttribute, value: string) => {
        const newAttributes = [...attributes];
        newAttributes[index] = { ...newAttributes[index], [field]: value };
        setAttributes(newAttributes);
    };

    const handleAddAttribute = () => {
        setAttributes(prev => [...prev, { id: uuidv4(), name: '', dataType: 'TEXT', webhookKey: '', status: 'ACTIVE', isNew: true }]);
    };

    const handleRemoveAttribute = (index: number) => {
        setAttributes(prev => prev.filter((_, i) => i !== index));
    };

    const attributesToSave = attributes.map(a => {
        const { isNew, ...rest } = a;
        return rest;
    });

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="attributes" value={JSON.stringify(attributesToSave)} />

            <Card className="card-gradient card-gradient-purple">
                <ZoruCardHeader>
                    <ZoruCardTitle>Custom User Attributes</ZoruCardTitle>
                    <ZoruCardDescription>Define custom data fields to store information about your contacts.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-4">
                        {attributes.map((attr, index) => (
                            <div key={attr.id} className="flex flex-col gap-3 p-4 border rounded-md bg-zoru-surface/50">
                                <div className="flex flex-col md:flex-row gap-4">
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-zoru-ink-muted">Attribute Name</Label>
                                    <Input
                                        value={attr.name}
                                        onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                                        placeholder="e.g., Membership Level"
                                    />
                                  </div>
                                  <div className="w-full md:w-1/3 space-y-1">
                                    <div className="flex items-center gap-1">
                                      <Label className="text-xs text-zoru-ink-muted">Data Type</Label>
                                      {!attr.isNew && (
                                        <div title="Data types cannot be changed after creation to prevent data corruption. Create a new attribute instead.">
                                          <Info className="h-3 w-3 text-zoru-ink-muted cursor-help" />
                                        </div>
                                      )}
                                    </div>
                                    <Select 
                                        disabled={!attr.isNew} 
                                        value={attr.dataType || 'TEXT'} 
                                        onValueChange={(val) => handleAttributeChange(index, 'dataType', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Data Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TEXT">Text</SelectItem>
                                            <SelectItem value="NUMBER">Number</SelectItem>
                                            <SelectItem value="BOOLEAN">Boolean</SelectItem>
                                            <SelectItem value="DATE">Date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex items-end gap-4">
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-zoru-ink-muted">Webhook Mapping Key (Optional)</Label>
                                    <Input
                                        value={attr.webhookKey || ''}
                                        onChange={(e) => handleAttributeChange(index, 'webhookKey', e.target.value)}
                                        placeholder="e.g., custom_field_1"
                                    />
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveAttribute(index)} className="mb-0.5">
                                      <Trash2 className="h-4 w-4 text-zoru-ink" />
                                  </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {attributes.length === 0 && (
                        <div className="text-sm text-zoru-ink-muted text-center py-4 border border-dashed rounded-md">
                            No custom attributes defined yet.
                        </div>
                    )}
                    <Button type="button" variant="outline" onClick={handleAddAttribute} className="w-full md:w-auto mt-2">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Attribute
                    </Button>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SaveAttributesButton />
                </ZoruCardFooter>
            </Card>
        </form>
    );
}
