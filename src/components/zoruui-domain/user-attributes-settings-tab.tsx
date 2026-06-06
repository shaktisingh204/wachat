'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Alert, Skeleton } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import type { WithId, Project } from '@/lib/definitions';
import {
  getProjectAttributes,
  saveProjectAttributes,
} from '@/app/actions/wachat-project-attributes.actions';
import type { WachatUserAttribute } from '@/lib/rust-client/wachat-project-attributes';
import { useToast } from '@/hooks/use-toast';

import { LoaderCircle, Plus, Save, Trash2, Info } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface UserAttributesSettingsTabProps {
  project: WithId<Project>;
}

type UIUserAttribute = WachatUserAttribute & { isNew?: boolean };

export function UserAttributesSettingsTab({ project }: UserAttributesSettingsTabProps) {
    const { toast } = useToast();
    const projectId = project._id.toString();

    const [attributes, setAttributes] = useState<UIUserAttribute[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSaving, startSaving] = useTransition();

    // ---- Load: GET projects.userAttributes[] via the Rust crate ----------
    const fetchAttributes = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        const res = await getProjectAttributes(projectId);
        if (res.error) {
            setLoadError(res.error);
            setAttributes([]);
        } else {
            setAttributes((res.attributes ?? []).map((a) => ({ ...a })));
        }
        setIsLoading(false);
    }, [projectId]);

    useEffect(() => {
        void fetchAttributes();
    }, [fetchAttributes]);

    // ---- Row mutations (local state) -------------------------------------
    const handleAttributeChange = (
        index: number,
        field: keyof UIUserAttribute,
        value: string,
    ) => {
        setAttributes((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAddAttribute = () => {
        setAttributes((prev) => [
            ...prev,
            { id: uuidv4(), name: '', dataType: 'TEXT', webhookKey: '', status: 'ACTIVE', isNew: true },
        ]);
    };

    const handleRemoveAttribute = (index: number) => {
        setAttributes((prev) => prev.filter((_, i) => i !== index));
    };

    // ---- Save: PATCH the whole array via the Rust crate ------------------
    const handleSave = () => {
        const payload: WachatUserAttribute[] = attributes.map((a) => ({
            id: a.id,
            name: a.name,
            dataType: a.dataType,
            webhookKey: a.webhookKey ?? null,
            status: a.status,
        }));

        startSaving(async () => {
            const res = await saveProjectAttributes(projectId, payload);
            if (res.error) {
                toast({ title: 'Error', description: res.error, tone: 'danger' });
                return;
            }
            toast({ title: 'Success', description: 'User attributes saved successfully.', tone: 'success' });
            // Drop the `isNew` flag so data-type selects lock after a successful save.
            setAttributes((prev) =>
                prev.map((attr) => {
                    const { isNew: _isNew, ...rest } = attr;
                    return rest as UIUserAttribute;
                }),
            );
        });
    };

    if (isLoading) {
        return (
            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                    <CardTitle>Custom User Attributes</CardTitle>
                    <CardDescription>Define custom data fields to store information about your contacts.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-3">
                    <Skeleton height={96} />
                    <Skeleton height={96} />
                </CardBody>
            </Card>
        );
    }

    return (
        <Card className="card-gradient card-gradient-purple">
            <CardHeader>
                <CardTitle>Custom User Attributes</CardTitle>
                <CardDescription>Define custom data fields to store information about your contacts.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                {loadError && (
                    <Alert tone="danger" title="Could not load attributes">
                        <div className="flex flex-wrap items-center gap-2">
                            <span>{loadError}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void fetchAttributes()}>
                                Retry
                            </Button>
                        </div>
                    </Alert>
                )}

                <div className="space-y-4">
                    {attributes.map((attr, index) => (
                        <div key={attr.id ?? index} className="flex flex-col gap-3 p-4 border rounded-md bg-[var(--st-bg-secondary)]/50">
                            <div className="flex flex-col md:flex-row gap-4">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-[var(--st-text-secondary)]">Attribute Name</Label>
                                <Input
                                    value={attr.name}
                                    onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                                    placeholder="e.g., Membership Level"
                                />
                              </div>
                              <div className="w-full md:w-1/3 space-y-1">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs text-[var(--st-text-secondary)]">Data Type</Label>
                                  {!attr.isNew && (
                                    <div title="Data types cannot be changed after creation to prevent data corruption. Create a new attribute instead.">
                                      <Info className="h-3 w-3 text-[var(--st-text-secondary)] cursor-help" />
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
                                <Label className="text-xs text-[var(--st-text-secondary)]">Webhook Mapping Key (Optional)</Label>
                                <Input
                                    value={attr.webhookKey || ''}
                                    onChange={(e) => handleAttributeChange(index, 'webhookKey', e.target.value)}
                                    placeholder="e.g., custom_field_1"
                                />
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveAttribute(index)} className="mb-0.5">
                                  <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                              </Button>
                            </div>
                        </div>
                    ))}
                </div>
                {attributes.length === 0 && !loadError && (
                    <div className="text-sm text-[var(--st-text-secondary)] text-center py-4 border border-dashed rounded-md">
                        No custom attributes defined yet.
                    </div>
                )}
                <Button type="button" variant="outline" onClick={handleAddAttribute} className="w-full md:w-auto mt-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Attribute
                </Button>
            </CardBody>
            <CardFooter>
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Attributes
                </Button>
            </CardFooter>
        </Card>
    );
}
