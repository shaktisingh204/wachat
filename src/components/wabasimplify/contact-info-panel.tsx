
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Project, Contact, Agent, Tag } from '@/app/actions';
import { handleUpdateContactDetails, handleUpdateContactStatus, updateContactTags } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ContactInfoPanelProps {
  project: WithId<Project>;
  contact: WithId<Contact>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContactUpdate: (updatedContact: WithId<Contact>) => void;
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
                    className="w-full justify-between h-auto"
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
                            <span>{placeholder}</span>
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

export function ContactInfoPanel({ project, contact, isOpen, onOpenChange, onContactUpdate }: ContactInfoPanelProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(contact.status || 'new');
  const [assignedAgentId, setAssignedAgentId] = useState(contact.assignedAgentId || '');
  const [tagIds, setTagIds] = useState<string[]>([]);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const userAttributes = project.userAttributes || [];

  useEffect(() => {
    // Reset local state when the contact prop changes
    setVariables(contact.variables || {});
    setStatus(contact.status || 'new');
    setAssignedAgentId(contact.assignedAgentId || '');
    setTagIds(contact.tagIds || []);
  }, [contact]);

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    startTransition(async () => {
        const result = await handleUpdateContactStatus(contact._id.toString(), newStatus, assignedAgentId);
        if (result.success) {
            toast({ title: 'Status Updated', description: `Conversation marked as ${newStatus}.`});
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
            toast({ title: 'Agent Assigned', description: `Conversation assigned.`});
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
            onContactUpdate({ ...contact, tagIds: newTagIds });
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
            setTagIds(contact.tagIds || []); // Revert
        }
    });
  }

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
        onOpenChange(false);
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col">
            <SheetHeader>
                <SheetTitle>{contact.name}</SheetTitle>
                <SheetDescription>
                    {contact.waId} - Manage contact-specific attributes.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
                                <SelectTrigger id="status"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="agent">Assigned Agent</Label>
                             <Select value={assignedAgentId || 'unassigned'} onValueChange={handleAgentChange} disabled={isPending}>
                                <SelectTrigger id="agent"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {project.agents?.map((agent: Agent) => (
                                        <SelectItem key={agent.userId.toString()} value={agent.userId.toString()}>{agent.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Tags</Label>
                        <MultiSelectCombobox
                            options={tagOptions}
                            selected={tagIds}
                            onSelectionChange={handleTagsChange}
                            placeholder="Select tags..."
                        />
                    </div>

                    <Separator />
                    <h3 className="font-semibold text-lg">Contact Attributes</h3>
                    
                    {userAttributes.length > 0 ? (
                        userAttributes.map(attr => (
                            <div key={attr.id} className="space-y-2">
                                <Label htmlFor={`attr-${attr.id}`}>{attr.name}</Label>
                                <Input
                                    id={`attr-${attr.id}`}
                                    value={variables[attr.name] || ''}
                                    onChange={(e) => handleVariableChange(attr.name, e.target.value)}
                                    placeholder={`Enter value for ${attr.name}`}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            No custom attributes defined for this project. You can add them in Project Settings.
                        </div>
                    )}
                </div>
            </ScrollArea>
            <SheetFooter className="mt-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={handleSaveVariables} disabled={isPending}>
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Attributes
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
  );
}
