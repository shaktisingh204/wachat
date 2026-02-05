'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Check, X, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { updateUserPermissions } from "@/app/actions/admin.actions";
import { moduleCategories, permissionActions } from "@/lib/permission-modules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface AdminUserPermissionsDialogProps {
    userId: string;
    userName: string;
    initialPermissions?: any; // GlobalPermissions structure
}

export function AdminUserPermissionsDialog({ userId, userName, initialPermissions = {} }: AdminUserPermissionsDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [permissions, setPermissions] = useState<any>(initialPermissions?.agent || {}); // Editing 'agent' role permissions effectively for the user context
    const { toast } = useToast();

    // We mainly focus on the 'agent' role for user-specific overrides as that's the primary permission set applied to users.
    // However, if we need to override other roles, we can expand this. For simplicity, we assume we are overriding the user's base 'agent' permissions.

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // We wrap it back into the GlobalPermissions structure
            const globalPermissions = {
                agent: permissions
            };

            const result = await updateUserPermissions(userId, globalPermissions);
            if (result.success) {
                toast({
                    title: "Success",
                    description: "Permissions updated successfully",
                });
                setOpen(false);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || "Failed to update permissions",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const togglePermission = (moduleKey: string, action: string, checked: boolean) => {
        setPermissions((prev: any) => ({
            ...prev,
            [moduleKey]: {
                ...(prev[moduleKey] || {}),
                [action]: checked
            }
        }));
    };

    const toggleModule = (moduleKey: string, checked: boolean) => {
        setPermissions((prev: any) => ({
            ...prev,
            [moduleKey]: {
                view: checked,
                create: checked,
                edit: checked,
                delete: checked
            }
        }));
    };

    const toggleCategory = (category: string, checked: boolean) => {
        const modules = moduleCategories[category as keyof typeof moduleCategories];
        setPermissions((prev: any) => {
            const next = { ...prev };
            modules.forEach(mod => {
                next[mod] = {
                    view: checked,
                    create: checked,
                    edit: checked,
                    delete: checked
                };
            });
            return next;
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Manage Permissions">
                    <ShieldCheck className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Permissions for {userName}</DialogTitle>
                    <DialogDescription>
                        Override Plan permissions for this user. These settings will take precedence over their assigned plan.
                        Currently editing <strong>Agent</strong> role scope.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue={Object.keys(moduleCategories)[0]} className="h-full flex flex-col">
                        <ScrollArea className="w-full border-b">
                            <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1 mb-2">
                                {Object.keys(moduleCategories).map(category => (
                                    <TabsTrigger
                                        key={category}
                                        value={category}
                                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                                    >
                                        {category}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </ScrollArea>

                        <div className="flex-1 overflow-auto py-4">
                            {Object.entries(moduleCategories).map(([category, modules]) => (
                                <TabsContent key={category} value={category} className="mt-0">
                                    <div className="flex justify-between items-center mb-4 bg-muted/30 p-2 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm">{category} Modules</h3>
                                            <Badge variant="outline" className="text-[10px]">{modules.length}</Badge>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button className="h-7 px-2" variant="outline" onClick={() => toggleCategory(category, true)}>Enable All</Button>
                                            <Button className="h-7 px-2" variant="outline" onClick={() => toggleCategory(category, false)}>Disable All</Button>
                                        </div>
                                    </div>

                                    <div className="grid gap-4">
                                        {modules.map(moduleKey => {
                                            const modulePerms = permissions[moduleKey] || { view: false, create: false, edit: false, delete: false };
                                            const isAllEnabled = permissionActions.every(action => modulePerms[action]);

                                            return (
                                                <div key={moduleKey} className="border rounded-md p-3">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <div className="font-medium text-sm flex items-center gap-2">
                                                                {moduleKey.replace(/_/g, ' ')}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {moduleKey}
                                                            </p>
                                                        </div>
                                                        <Switch
                                                            checked={isAllEnabled}
                                                            onCheckedChange={(checked) => toggleModule(moduleKey, checked)}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        {permissionActions.map(action => (
                                                            <div key={action} className="flex items-center space-x-2">
                                                                <Switch
                                                                    id={`${moduleKey}-${action}`}
                                                                    checked={!!modulePerms[action]}
                                                                    onCheckedChange={(checked) => togglePermission(moduleKey, action, checked)}
                                                                />
                                                                <Label htmlFor={`${moduleKey}-${action}`} className="capitalize text-xs cursor-pointer">
                                                                    {action}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </TabsContent>
                            ))}
                        </div>
                    </Tabs>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
