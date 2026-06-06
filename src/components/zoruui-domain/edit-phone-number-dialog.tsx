'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Separator, Button } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LuLoader,
  LuSave,
  LuUserRound,
  LuCamera } from 'react-icons/lu';
import type { WithId } from 'mongodb';

import { handleUpdatePhoneNumberProfile } from '@/app/actions/whatsapp.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project, PhoneNumber } from '@/lib/definitions';
import { SabFileToFileButton } from '@/components/sabfiles';

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
    <Button
      type="submit"
      variant="rose"
      size="md"
      disabled={pending}
      leading={
        pending ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LuSave className="h-3.5 w-3.5" strokeWidth={2} />
        )
      }
    >
      {pending ? 'Saving…' : 'Save changes'}
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
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
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

  const acceptProfileImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      acceptProfileImage(file);
    }
  };

  const handleSabFilePick = (file: File) => {
    const input = profilePictureInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    acceptProfileImage(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden p-0 rounded-[18px] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-lg">
        <form
          action={profileFormAction}
          ref={formRef}
          className="flex h-full flex-col overflow-hidden"
        >
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="phoneNumberId" value={phone.id} />

          <DialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <LuUserRound className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold text-[var(--st-text)] leading-tight">
                Edit phone number profile
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] leading-snug">
                Update the public business profile details for{' '}
                {phone.display_phone_number}.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-6">

              {/* Top Section: Profile Pic & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] transition-colors hover:bg-[var(--st-bg-muted)]">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-[var(--st-text-secondary)]">
                        <LuCamera className="h-6 w-6" strokeWidth={1.75} />
                        <span className="text-[11px] font-medium">
                          Upload photo
                        </span>
                      </div>
                    )}
                    <label
                      htmlFor="profilePicture"
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-[var(--st-text)]/60 text-[13px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Change
                    </label>
                    <Input
                      ref={profilePictureInputRef}
                      id="profilePicture"
                      name="profilePicture"
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                  <p className="px-2 text-center text-[10.5px] text-[var(--st-text-secondary)]">
                    Recommended: 500×500 px, JPG or PNG.
                  </p>
                  <SabFileToFileButton
                    accept="image"
                    onPickFile={handleSabFilePick}
                    onError={(err) =>
                      toast({
                        title: 'Pick failed',
                        description: err.message,
                        variant: 'destructive',
                      })
                    }
                  >
                    Pick from SabFiles
                  </SabFileToFileButton>
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
                    <span className="text-xs text-[var(--st-text-secondary)]">Max 139 chars</span>
                  </div>
                  <Input id="about" name="about" defaultValue={phone.profile?.about} maxLength={139} placeholder="Hey there! I am using WhatsApp." />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="description">Business Description</Label>
                    <span className="text-xs text-[var(--st-text-secondary)]">Max 256 chars</span>
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

          <DialogFooter className="border-t border-[var(--st-border)] px-6 py-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="pill"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
