'use client';

import {
  Button,
  Modal,
  Field,
  Input,
  SelectField as Select,
  Separator,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Camera,
  Save,
  UserRound } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleUpdatePhoneNumberProfile } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber,
  Project } from '@/lib/definitions';

/**
 * EditPhoneNumberDialog (wachat-local, 20ui).
 *
 * Replaces the legacy edit-phone-number-dialog. Same
 * server action (handleUpdatePhoneNumberProfile), same form fields and
 * file-upload behaviour. Visual-only swap to neutral 20ui tokens.
 */

import * as React from 'react';

import { SabFileToFileButton } from '@/components/sabfiles';

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

const verticalOptions = verticals.map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').toLowerCase(),
}));

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      loading={pending}
      iconLeft={Save}
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    phone.profile?.profile_picture_url || null,
  );
  const [vertical, setVertical] = useState<string | null>(
    phone.profile?.vertical ?? null,
  );

  useEffect(() => {
    if (profileState.message) {
      toast({ title: 'Success!', description: profileState.message, tone: 'success' });
      onUpdateSuccess();
      onOpenChange(false);
    }
    if (profileState.error) {
      toast({
        title: 'Error Updating Profile',
        description: profileState.error,
        tone: 'danger',
      });
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

  const title = (
    <span className="flex flex-row items-start gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] [background:var(--st-bg-muted)] [color:var(--st-text)]"
      >
        <UserRound className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px]">Edit phone number profile</span>
        <span className="mt-0.5 block text-[12px] font-normal [color:var(--st-text-secondary)]">
          Update the public business profile details for{' '}
          {phone.display_phone_number}.
        </span>
      </span>
    </span>
  );

  return (
    <Modal
      open={isOpen}
      onClose={() => onOpenChange(false)}
      title={title}
      size="lg"
      className="max-h-[85vh] max-w-[680px] overflow-hidden p-0"
    >
      <form
        action={profileFormAction}
        ref={formRef}
        className="flex h-full flex-col overflow-hidden"
      >
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <input type="hidden" name="phoneNumberId" value={phone.id} />
        <input type="hidden" name="vertical" value={vertical ?? ''} />

        <div className="flex-1 overflow-y-auto px-1 py-1">
          <div className="grid gap-6">
            {/* Top: profile pic + basic info */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors [border-color:var(--st-border)] [background:var(--st-bg-secondary)]"
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 [color:var(--st-text-secondary)]">
                      <Camera className="h-6 w-6" />
                      <span className="text-[11px]">Upload photo</span>
                    </div>
                  )}
                  <label
                    htmlFor="profilePicture"
                    className="absolute inset-0 flex cursor-pointer items-center justify-center text-[13px] opacity-0 transition-opacity group-hover:opacity-100 [background:rgba(0,0,0,0.6)] [color:var(--st-text-inverted)]"
                  >
                    Change
                  </label>
                  <input
                    ref={profilePictureInputRef}
                    id="profilePicture"
                    name="profilePicture"
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
                <p className="px-2 text-center text-[10.5px] [color:var(--st-text-secondary)]">
                  Recommended: 500x500 px, JPG or PNG.
                </p>
                <SabFileToFileButton
                  accept="image"
                  onPickFile={handleSabFilePick}
                  onError={(err) =>
                    toast({
                      title: 'Pick failed',
                      description: err.message,
                      tone: 'danger',
                    })
                  }
                >
                  Pick from SabFiles
                </SabFileToFileButton>
              </div>

              <div className="flex flex-col gap-4">
                <Field label="Business Category">
                  <Select
                    aria-label="Business Category"
                    value={vertical}
                    onChange={setVertical}
                    options={verticalOptions}
                    placeholder="Select a category..."
                    searchable
                  />
                </Field>
                <Field label="Business Email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contact@example.com"
                    defaultValue={phone.profile?.email}
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Middle: text fields */}
            <div className="grid gap-4">
              <Field
                label={
                  <span className="flex w-full justify-between">
                    <span>Status (About)</span>
                    <span className="text-[11px] font-normal [color:var(--st-text-secondary)]">
                      Max 139 chars
                    </span>
                  </span>
                }
              >
                <Input
                  id="about"
                  name="about"
                  defaultValue={phone.profile?.about}
                  maxLength={139}
                  placeholder="Hey there! I am using WhatsApp."
                />
              </Field>
              <Field
                label={
                  <span className="flex w-full justify-between">
                    <span>Business Description</span>
                    <span className="text-[11px] font-normal [color:var(--st-text-secondary)]">
                      Max 256 chars
                    </span>
                  </span>
                }
              >
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={phone.profile?.description}
                  maxLength={256}
                  className="h-24 resize-none"
                  placeholder="Tell your customers about your business..."
                />
              </Field>
            </div>

            <Separator />

            {/* Bottom: contact & socials */}
            <div className="grid gap-4">
              <Field label="Business Address">
                <Input
                  id="address"
                  name="address"
                  defaultValue={phone.profile?.address}
                  placeholder="1234 Main St, City, Country"
                />
              </Field>
              <Field label="Websites">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    name="websites"
                    aria-label="Primary website"
                    placeholder="https://www.example.com"
                    defaultValue={phone.profile?.websites?.[0]}
                  />
                  <Input
                    name="websites"
                    aria-label="Secondary website"
                    placeholder="https://shop.example.com"
                    defaultValue={phone.profile?.websites?.[1]}
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-t px-1 pt-4 sm:justify-end [border-color:var(--st-border)]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </form>
    </Modal>
  );
}
