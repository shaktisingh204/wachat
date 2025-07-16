

'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save, Phone } from 'lucide-react';
import { handleUpdatePhoneNumberProfile, updatePhoneNumberCallingSettings } from '@/app/actions/whatsapp.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, PhoneNumber } from '@/lib/definitions';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const initialState = {
  message: null,
  error: null,
};

const verticals = [
    "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", 
    "ENTERTAIN", "EVENT_PLAN", "FINANCE", "GROCERY", "GOVT", 
    "HOTEL", "HEALTH", "NONPROFIT", "PROF_SERVICES", "RETAIL", 
    "TRAVEL", "RESTAURANT", "NOT_A_BIZ"
];


function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        <>
        <Save className="mr-2 h-4 w-4" />
          Save Changes
        </>
      )}
    </Button>
  );
}

interface EditPhoneNumberDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    project: WithId<Project>;
    phone: PhoneNumber;
    onUpdateSuccess: () => void;
}

export function EditPhoneNumberDialog({ isOpen, onOpenChange, project, phone, onUpdateSuccess }: EditPhoneNumberDialogProps) {
  const [profileState, profileFormAction] = useActionState(handleUpdatePhoneNumberProfile, initialState);
  const [isCallingEnabled, setIsCallingEnabled] = useState(phone.is_calling_enabled || false);
  const [inboundControl, setInboundControl] = useState(phone.inbound_call_control || 'DISABLED');
  const [isSavingCalling, startCallingSaveTransition] = useTransition();

  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (profileState.message) {
      toast({ title: 'Success!', description: profileState.message });
      onUpdateSuccess();
      onOpenChange(false);
    }
    if (profileState.error) {
      toast({ title: 'Error Updating Profile', description: profileState.error, variant: 'destructive' });
    }
  }, [profileState, toast, onOpenChange, onUpdateSuccess]);
  
  const handleCallingSettingsSave = () => {
    startCallingSaveTransition(async () => {
        const result = await updatePhoneNumberCallingSettings(project._id.toString(), phone.id, isCallingEnabled, inboundControl as any);
        if (result.success) {
            toast({ title: 'Success!', description: 'Calling settings updated.' });
            onUpdateSuccess();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={profileFormAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="phoneNumberId" value={phone.id} />
          <DialogHeader>
            <DialogTitle>Edit Phone Number Profile</DialogTitle>
            <DialogDescription>
              Update the public business profile for {phone.display_phone_number}.
            </DialogDescription>
          </DialogHeader>

            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="grid gap-6 py-6">
                    <div className="space-y-2">
                        <Label htmlFor="profilePicture">Display Picture</Label>
                        <Input id="profilePicture" name="profilePicture" type="file" accept="image/jpeg,image/png" />
                        <p className="text-xs text-muted-foreground">Upload a square image (e.g., 500x500px).</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="about">About Text</Label>
                        <Textarea id="about" name="about" defaultValue={phone.profile?.about} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" defaultValue={phone.profile?.description} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea id="address" name="address" defaultValue={phone.profile?.address} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" defaultValue={phone.profile?.email} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vertical">Vertical</Label>
                            <Select name="vertical" defaultValue={phone.profile?.vertical}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a vertical..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {verticals.map(v => <SelectItem key={v} value={v} className="capitalize">{v.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Websites</Label>
                        <Input name="websites" placeholder="https://www.example.com" defaultValue={phone.profile?.websites?.[0]} />
                        <Input name="websites" placeholder="https://shop.example.com" defaultValue={phone.profile?.websites?.[1]} />
                    </div>

                    <Separator />
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="isCallingEnabled" className="text-base font-semibold">Enable Calling</Label>
                                <p className="text-sm text-muted-foreground">Allow users to call this number from its profile.</p>
                            </div>
                            <Switch id="isCallingEnabled" name="isCallingEnabled" checked={isCallingEnabled} onCheckedChange={setIsCallingEnabled} />
                        </div>
                        {isCallingEnabled && (
                             <div className="space-y-2 pl-4 border-l-2 ml-2">
                                <Label htmlFor="inboundCallControl">Inbound Call Handling</Label>
                                <Select name="inboundCallControl" value={inboundControl} onValueChange={setInboundControl}>
                                    <SelectTrigger id="inboundCallControl">
                                        <SelectValue placeholder="Select handling method..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DISABLED">Prevent incoming calls</SelectItem>
                                        <SelectItem value="CALLBACK_REQUEST">Show "Request a callback" button</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button type="button" variant="secondary" onClick={handleCallingSettingsSave} disabled={isSavingCalling}>
                            {isSavingCalling ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Phone className="mr-2 h-4 w-4"/>}
                            Save Calling Settings
                        </Button>
                    </div>

                </div>
            </ScrollArea>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
