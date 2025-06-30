
'use client';

import { useState, useTransition, useEffect } from 'react';
import type { WithId } from 'mongodb';
import type { Project, Contact } from '@/app/actions';
import { handleUpdateContactVariables } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';

interface ContactInfoPanelProps {
  project: WithId<Project>;
  contact: WithId<Contact>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContactUpdate: (updatedContact: WithId<Contact>) => void;
}

export function ContactInfoPanel({ project, contact, isOpen, onOpenChange, onContactUpdate }: ContactInfoPanelProps) {
  const [variables, setVariables] = useState<Record<string, string>>(contact.variables || {});
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const userAttributes = project.userAttributes || [];

  useEffect(() => {
    // Reset local state when the contact prop changes
    setVariables(contact.variables || {});
  }, [contact]);

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await handleUpdateContactVariables(contact._id.toString(), variables);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Contact details updated.' });
        onContactUpdate({ ...contact, variables });
        onOpenChange(false);
      }
    });
  };
  
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
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
  );
}
