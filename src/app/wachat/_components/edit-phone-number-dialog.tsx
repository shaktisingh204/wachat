'use client';

/**
 * EditPhoneNumberDialog (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/edit-phone-number-dialog. Same
 * server action (handleUpdatePhoneNumberProfile), same form fields and
 * file-upload behaviour. Visual-only swap to neutral zoru tokens.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Camera, Loader2, Save, UserRound } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleUpdatePhoneNumberProfile } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber, Project } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

const verticals = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'NOT_A_BIZ',
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      {pending ? 'Saving…' : 'Save changes'}
    </ZoruButton>
  );
}

interface EditPhoneNumberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: WithId<Project>;
  phone: PhoneNumber;
  onUpdateSuccess: () => void;
}

export function EditPhoneNumberDialog({
  isOpen,
  onOpenChange,
  project,
  phone,
  onUpdateSuccess,
}: EditPhoneNumberDialogProps) {
  const [profileState, profileFormAction] = useActionState(
    handleUpdatePhoneNumberProfile,
    initialState,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    phone.profile?.profile_picture_url || null,
  );

  useEffect(() => {
    if (profileState.message) {
      toast({ title: 'Success!', description: profileState.message });
      onUpdateSuccess();
      onOpenChange(false);
    }
    if (profileState.error) {
      toast({
        title: 'Error Updating Profile',
        description: profileState.error,
        variant: 'destructive',
      });
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
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-h-[85vh] max-w-[680px] overflow-hidden p-0">
        <form
          action={profileFormAction}
          ref={formRef}
          className="flex h-full flex-col overflow-hidden"
        >
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="phoneNumberId" value={phone.id} />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-zoru-line px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] text-zoru-ink">
                Edit phone number profile
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Update the public business profile details for{' '}
                {phone.display_phone_number}.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-6">
              {/* Top: profile pic + basic info */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-center gap-3">
                  <div className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zoru-line bg-zoru-surface transition-colors hover:bg-zoru-surface-2">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-zoru-ink-muted">
                        <Camera className="h-6 w-6" />
                        <span className="text-[11px]">Upload photo</span>
                      </div>
                    )}
                    <label
                      htmlFor="profilePicture"
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-zoru-ink/60 text-[13px] text-zoru-on-primary opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Change
                    </label>
                    <input
                      id="profilePicture"
                      name="profilePicture"
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                  <p className="px-2 text-center text-[10.5px] text-zoru-ink-muted">
                    Recommended: 500x500 px, JPG or PNG.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <ZoruLabel htmlFor="vertical">Business Category</ZoruLabel>
                    <ZoruSelect
                      name="vertical"
                      defaultValue={phone.profile?.vertical}
                    >
                      <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Select a category..." />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {verticals.map((v) => (
                          <ZoruSelectItem
                            key={v}
                            value={v}
                            className="capitalize"
                          >
                            {v.replace(/_/g, ' ').toLowerCase()}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <ZoruLabel htmlFor="email">Business Email</ZoruLabel>
                    <ZoruInput
                      id="email"
                      name="email"
                      type="email"
                      placeholder="contact@example.com"
                      defaultValue={phone.profile?.email}
                    />
                  </div>
                </div>
              </div>

              <ZoruSeparator />

              {/* Middle: text fields */}
              <div className="grid gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <ZoruLabel htmlFor="about">Status (About)</ZoruLabel>
                    <span className="text-[11px] text-zoru-ink-muted">
                      Max 139 chars
                    </span>
                  </div>
                  <ZoruInput
                    id="about"
                    name="about"
                    defaultValue={phone.profile?.about}
                    maxLength={139}
                    placeholder="Hey there! I am using WhatsApp."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <ZoruLabel htmlFor="description">
                      Business Description
                    </ZoruLabel>
                    <span className="text-[11px] text-zoru-ink-muted">
                      Max 256 chars
                    </span>
                  </div>
                  <ZoruTextarea
                    id="description"
                    name="description"
                    defaultValue={phone.profile?.description}
                    maxLength={256}
                    className="h-24 resize-none"
                    placeholder="Tell your customers about your business..."
                  />
                </div>
              </div>

              <ZoruSeparator />

              {/* Bottom: contact & socials */}
              <div className="grid gap-4">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="address">Business Address</ZoruLabel>
                  <ZoruInput
                    id="address"
                    name="address"
                    defaultValue={phone.profile?.address}
                    placeholder="1234 Main St, City, Country"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Websites</ZoruLabel>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ZoruInput
                      name="websites"
                      placeholder="https://www.example.com"
                      defaultValue={phone.profile?.websites?.[0]}
                    />
                    <ZoruInput
                      name="websites"
                      placeholder="https://shop.example.com"
                      defaultValue={phone.profile?.websites?.[1]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ZoruDialogFooter className="gap-2 border-t border-zoru-line px-6 py-4 sm:justify-end">
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
