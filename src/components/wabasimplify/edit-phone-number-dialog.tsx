
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
import { handleUpdatePhoneNumberProfile } from '@/app/actions/whatsapp.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, PhoneNumber } from '@/lib/definitions';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(phone.profile?.profile_picture_url || null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={profileFormAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="phoneNumberId" value={phone.id} />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Edit Phone Number Profile</DialogTitle>
            <DialogDescription>
              Update the public business profile details for {phone.display_phone_number}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-6">

              {/* Top Section: Profile Pic & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-40 w-40 rounded-full border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors group">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="Profile Preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground group-hover:text-foreground transition-colors">
                        <LoaderCircle className="h-8 w-8 mb-2 opacity-50" /> {/* Using Loader as a placeholder icon if UserCircle isn't imported, but user requested 'better preview', image tag handles preview */}
                        <span className="text-xs font-medium">Upload Photo</span>
                      </div>
                    )}
                    <label htmlFor="profilePicture" className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium text-sm">
                      Change
                    </label>
                    <Input
                      id="profilePicture"
                      name="profilePicture"
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center px-4">
                    Recommended: 500x500px, JPG or PNG.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vertical">Business Category</Label>
                    <Select name="vertical" defaultValue={phone.profile?.vertical}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {verticals.map(v => <SelectItem key={v} value={v} className="capitalize">{v.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Business Email</Label>
                    <Input id="email" name="email" type="email" placeholder="contact@example.com" defaultValue={phone.profile?.email} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Middle Section: Text Fields */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="about">Status (About)</Label>
                    <span className="text-xs text-muted-foreground">Max 139 chars</span>
                  </div>
                  <Input id="about" name="about" defaultValue={phone.profile?.about} maxLength={139} placeholder="Hey there! I am using WhatsApp." />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="description">Business Description</Label>
                    <span className="text-xs text-muted-foreground">Max 256 chars</span>
                  </div>
                  <Textarea id="description" name="description" defaultValue={phone.profile?.description} maxLength={256} className="h-24 resize-none" placeholder="Tell your customers about your business..." />
                </div>
              </div>

              <Separator />

              {/* Bottom Section: Contact & Socials */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input id="address" name="address" defaultValue={phone.profile?.address} placeholder="1234 Main St, City, Country" />
                </div>
                <div className="space-y-2">
                  <Label>Websites</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input name="websites" placeholder="https://www.example.com" defaultValue={phone.profile?.websites?.[0]} />
                    <Input name="websites" placeholder="https://shop.example.com" defaultValue={phone.profile?.websites?.[1]} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
