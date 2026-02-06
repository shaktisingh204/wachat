
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Project, Contact, Agent, Tag } from '@/lib/definitions';
import { handleUpdateContactDetails, handleUpdateContactStatus, updateContactTags } from '@/app/actions/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save, Phone, Mail, FileText, Link, ThumbsUp, Pencil, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectTagsManagerDialog } from './project-tags-manager-dialog';
import { useProject } from '@/context/project-context';


interface ContactInfoPanelProps {
    project: WithId<Project>;
    contact: WithId<Contact>;
    onContactUpdate: (updatedContact: WithId<Contact>) => void;
    onClose: () => void;
}

function MultiSelectCombobox({
    options,
    selected,
    onSelectionChange,
    placeholder = "Select...",
    className
}: {
    options: { value: string, label: string, color?: string }[],
    selected: string[],
    onSelectionChange: (selected: string[]) => void,
    placeholder?: string,
    className?: string
}) {
    const [open, setOpen] = useState(false);

    const handleSelect = (currentValue: string) => {
        const newSelected = selected.includes(currentValue)
            ? selected.filter((item) => item !== currentValue)
            : [...selected, currentValue];
        onSelectionChange(newSelected);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto min-h-10"
                >
                    <div className="flex gap-1 flex-wrap">
                        {selected.length > 0 ? (
                            selected.map(id => {
                                const option = options.find(o => o.value === id);
                                if (!option) return null;
                                return (
                                    <Badge
                                        key={id}
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal"
                                        style={option.color ? { backgroundColor: option.color, color: '#fff' } : {}}
                                    >
                                        {option.label}
                                    </Badge>
                                );
                            })
                        ) : (
                            <span className="text-muted-foreground font-normal">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => handleSelect(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function ContactInfoPanel({ project, contact, onContactUpdate, onClose }: ContactInfoPanelProps) {
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [status, setStatus] = useState(contact.status || 'new');
    const [assignedAgentId, setAssignedAgentId] = useState(contact.assignedAgentId || '');
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(contact.name);
    const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);

    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { reloadProject } = useProject();
    const userAttributes = project.userAttributes || [];

    useEffect(() => {
        // Reset local state when the contact prop changes
        setVariables(contact.variables || {});
        setStatus(contact.status || 'new');
        setAssignedAgentId(contact.assignedAgentId || '');
        setTagIds(contact.tagIds ? contact.tagIds.map(id => id.toString()) : []);
        setEditedName(contact.name);
        setIsEditingName(false);
    }, [contact]);

    const handleVariableChange = (name: string, value: string) => {
        setVariables(prev => ({ ...prev, [name]: value }));
    };

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);
        startTransition(async () => {
            const result = await handleUpdateContactStatus(contact._id.toString(), newStatus, assignedAgentId);
            if (result.success) {
                toast({ title: 'Status Updated', description: `Conversation marked as ${newStatus}.` });
                onContactUpdate({ ...contact, status: newStatus as any, assignedAgentId });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                setStatus(contact.status || 'new'); // Revert on failure
            }
        });
    };

    const handleAgentChange = (newAgentId: string) => {
        const finalAgentId = newAgentId === 'unassigned' ? '' : newAgentId;
        setAssignedAgentId(finalAgentId);
        startTransition(async () => {
            const result = await handleUpdateContactStatus(contact._id.toString(), status, finalAgentId);
            if (result.success) {
                toast({ title: 'Agent Assigned', description: `Conversation assigned.` });
                onContactUpdate({ ...contact, status: status as any, assignedAgentId: finalAgentId });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                setAssignedAgentId(contact.assignedAgentId || ''); // Revert on failure
            }
        });
    };

    const handleTagsChange = (newTagIds: string[]) => {
        setTagIds(newTagIds);
        startTransition(async () => {
            const result = await updateContactTags(contact._id.toString(), newTagIds);
            if (result.success) {
                toast({ title: 'Tags Updated' });
                onContactUpdate({ ...contact, tagIds: newTagIds as any });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                setTagIds(contact.tagIds ? contact.tagIds.map(id => id.toString()) : []); // Revert
            }
        });
    }

    const handleSaveName = () => {
        if (!editedName.trim()) return;

        startTransition(async () => {
            const formData = new FormData();
            formData.append('contactId', contact._id.toString());
            formData.append('name', editedName);

            const result = await handleUpdateContactDetails(null, formData);

            if (result.success) {
                toast({ title: 'Name Updated', description: "Contact name changed successfully." });
                onContactUpdate({ ...contact, name: editedName });
                setIsEditingName(false);
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const handleSaveVariables = () => {
        startTransition(async () => {
            // This is a separate action now, only for variables
            const formData = new FormData();
            formData.append('contactId', contact._id.toString());
            formData.append('variables', JSON.stringify(variables));
            const result = await handleUpdateContactDetails(null, formData);
            if (result.success) {
                toast({ title: 'Success', description: 'Contact variables updated.' });
                onContactUpdate({ ...contact, variables });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const tagOptions = useMemo(() => {
        return (project.tags || []).map(tag => ({
            value: tag._id,
            label: tag.name,
            color: tag.color,
        }));
    }, [project.tags]);

    return (
        <div className="flex flex-col h-full bg-background border-l">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20 flex-shrink-0">
                <h3 className="font-semibold text-lg">Contact Info</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 flex flex-col items-center border-b">
                    <Avatar className="h-20 w-20 mb-3 shadow-sm border">
                        <AvatarFallback className="text-xl">{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    {isEditingName ? (
                        <div className="flex items-center gap-2 mb-1 w-full max-w-[240px] justify-center">
                            <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="h-8 text-center font-medium"
                                autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleSaveName} disabled={isPending}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => { setIsEditingName(false); setEditedName(contact.name); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group mb-1 justify-center">
                            <h2 className="text-xl font-semibold">{contact.name}</h2>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditingName(true)}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mb-4">{contact.waId}</p>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
                                <SelectTrigger id="status" className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Agent</Label>
                            <Select value={assignedAgentId || 'unassigned'} onValueChange={handleAgentChange} disabled={isPending}>
                                <SelectTrigger id="agent" className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {project.agents?.map((agent: Agent) => (
                                        <SelectItem key={agent.userId.toString()} value={agent.userId.toString()}>{agent.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Tags</Label>
                            <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-muted-foreground" onClick={() => setIsTagsManagerOpen(true)}>
                                <Settings className="h-3 w-3" />
                                Manage
                            </Button>
                        </div>
                        <MultiSelectCombobox
                            options={tagOptions}
                            selected={tagIds}
                            onSelectionChange={handleTagsChange}
                            placeholder="Select tags..."
                        />
                    </div>

                    <ProjectTagsManagerDialog
                        isOpen={isTagsManagerOpen}
                        onOpenChange={setIsTagsManagerOpen}
                        project={project}
                        onTagsUpdated={() => {
                            reloadProject();
                        }}
                    />

                    <Separator />

                    <Tabs defaultValue="attributes" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="attributes">Attributes</TabsTrigger>
                            <TabsTrigger value="files">Files</TabsTrigger>
                        </TabsList>
                        <TabsContent value="attributes" className="mt-4 space-y-4">
                            {userAttributes.length > 0 ? (
                                <div className="space-y-3">
                                    {userAttributes.map(attr => (
                                        <div key={attr.id} className="space-y-1.5">
                                            <Label htmlFor={`attr-${attr.id}`} className="text-xs">{attr.name}</Label>
                                            <Input
                                                id={`attr-${attr.id}`}
                                                value={variables[attr.name] || ''}
                                                onChange={(e) => handleVariableChange(attr.name, e.target.value)}
                                                placeholder={`Value`}
                                                className="h-9"
                                            />
                                        </div>
                                    ))}
                                    <Button onClick={handleSaveVariables} disabled={isPending} className="w-full mt-2" size="sm">
                                        {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-8 bg-muted/30 rounded-lg border border-dashed">
                                    No custom attributes found
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="files" className="mt-4">
                            <div className="text-center text-sm text-muted-foreground py-8 bg-muted/30 rounded-lg border border-dashed">
                                No shared files
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </ScrollArea>
        </div>
    );
}
