'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { moduleCategories, permissionActions } from '@/lib/permission-modules';
import type { GlobalPermissions } from '@/lib/definitions';

interface PlanPermissionSelectorProps {
    defaultPermissions?: GlobalPermissions;
}

export function PlanPermissionSelector({ defaultPermissions }: PlanPermissionSelectorProps) {
    // defaultPermissions structure is typically { agent: { module_action: boolean } } for roles
    // For plans, we might store it as { module_action: boolean } flattened, or reuse the structure.
    // Let's use a flat structure for the form submission: name="perm_module_action"

    // Helper to check if a specific permission is enabled in defaults
    // Since Plan type has `permissions?: GlobalPermissions`, which is nested, 
    // but for Plans we might just want to store "Allowed Capabilities".
    // Let's assume for now we save it as a flat list or the same nested structure.
    // For simplicity in form submission, inputs with names `permissions[module][action]` works if we use a parser,
    // but `module_action` string is easier to handle plain FormData.

    // Let's assume the Plan permissions are stored in the same structure as GlobalPermissions:
    // permissions: { module: { action: boolean } } (Plan level doesn't need 'agent' key wrapper like user roles)
    // Wait, GlobalPermissions is { agent: GlobalRolePermissions, [roleId]: ... }
    // For a Plan, we just need `GlobalRolePermissions` structure directly.

    // Let's safely access defaults. 
    // If the prop passed is the full `permissions` object from Plan, it might be `GlobalRolePermissions`.

    const [expandedSections, setExpandedSections] = useState<string[]>(Object.keys(moduleCategories));

    const handleSelectAll = (category: string, select: boolean) => {
        const modules = moduleCategories[category as keyof typeof moduleCategories];
        modules.forEach(module => {
            permissionActions.forEach(action => {
                const el = document.getElementById(`${module}_${action}`) as HTMLInputElement;
                if (el) {
                    el.checked = select;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Master Permission Control</CardTitle>
                <CardDescription>
                    Define the absolute maximum capabilities for this plan. Users on this plan cannot use or assign permissions that are unchecked here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" defaultValue={Object.keys(moduleCategories)} className="space-y-4">
                    {Object.entries(moduleCategories).map(([category, modules]) => (
                        <AccordionItem value={category} key={category} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-4 w-full">
                                    <span className="font-semibold text-base">{category}</span>
                                    <span className="text-xs text-muted-foreground font-normal">({modules.length} modules)</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4">
                                <div className="flex justify-end gap-2 mb-4">
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAll(category, true)}>Select All</Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAll(category, false)}>Deselect All</Button>
                                </div>
                                <div className="space-y-6">
                                    {modules.map(module => (
                                        <div key={module} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                            <div className="md:col-span-1">
                                                <Label className="text-sm font-medium break-words">
                                                    {module.replace(/_/g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}
                                                </Label>
                                            </div>
                                            <div className="md:col-span-4 flex flex-wrap gap-4">
                                                {permissionActions.map(action => (
                                                    <div key={`${module}_${action}`} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${module}_${action}`}
                                                            name={`${module}_${action}`}
                                                            defaultChecked={(defaultPermissions as any)?.[module]?.[action] ?? true}
                                                        />
                                                        <Label htmlFor={`${module}_${action}`} className="capitalize cursor-pointer text-muted-foreground hover:text-foreground">
                                                            {action}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <p className="text-xs text-muted-foreground mt-6 text-center">
                    Note: "View" permission is usually required for other permissions to work effectively.
                </p>
            </CardContent>
        </Card>
    );
}
