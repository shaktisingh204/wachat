'use client';

/**
 * Payment configuration dialogs (wachat-local, ZoruUI).
 *
 * - CreatePaymentConfigDialog
 * - RegenerateOauthDialog
 * - UpdateDataEndpointDialog
 * - DeletePaymentConfigButton
 *
 * All preserve the original server-action wiring and prop signatures so
 * the whatsapp-pay/settings page can swap imports without behavior
 * change.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, Link as LinkIcon, Loader2, Settings, Trash2 } from 'lucide-react';

import {
  handleCreatePaymentConfiguration,
  handleDeletePaymentConfiguration,
  handleRegenerateOauthLink,
  handleUpdateDataEndpoint,
} from '@/app/actions/whatsapp-pay.actions';
import type { PaymentConfiguration, Project, WithId } from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruAlertTitle,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruScrollArea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

/* ── shared submit button ─────────────────────────────────────── */

function PendingSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </ZoruButton>
  );
}

/* ── CreatePaymentConfigDialog ────────────────────────────────── */

type CreateState = {
  message?: string | null;
  error?: string;
  oauth_url?: string | null;
};

const createInitialState: CreateState = {
  message: null,
  error: undefined,
  oauth_url: undefined,
};

interface CreatePaymentConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreatePaymentConfigDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: CreatePaymentConfigDialogProps) {
  const [state, formAction] = useActionState(
    handleCreatePaymentConfiguration as any,
    createInitialState,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [providerType, setProviderType] = useState('gateway');

  useEffect(() => {
    if (state.message && !state.oauth_url) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      onOpenChange(false);
    }
  }, [state, toast, onSuccess, onOpenChange]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      formRef.current?.reset();
      setProviderType('gateway');
    }
    onOpenChange(open);
  };

  if (state.oauth_url) {
    return (
      <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Complete Onboarding</ZoruDialogTitle>
            <ZoruDialogDescription>
              Your payment configuration has been created. Please complete the
              setup with your payment provider.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruAlert>
            <ZoruAlertTitle>Action Required</ZoruAlertTitle>
            <ZoruAlertDescription>
              Click the button below to go to the provider&apos;s site and
              authorize the connection.
            </ZoruAlertDescription>
          </ZoruAlert>
          <ZoruDialogFooter>
            <ZoruButton asChild>
              <a
                href={state.oauth_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOpenChange(false)}
              >
                Complete Onboarding
              </a>
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    );
  }

  return (
    <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction as any} ref={formRef}>
          <input
            type="hidden"
            name="projectId"
            value={
              typeof window !== 'undefined'
                ? localStorage.getItem('activeProjectId') || ''
                : ''
            }
          />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Create Payment Configuration</ZoruDialogTitle>
            <ZoruDialogDescription>
              This information should match the details in your Meta Commerce
              Manager account.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {state.error && (
            <ZoruAlert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
            </ZoruAlert>
          )}
          <ZoruScrollArea className="my-4 max-h-[60vh]">
            <div className="grid gap-4 py-4 pr-2">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="configuration_name">
                  Configuration Name
                </ZoruLabel>
                <ZoruInput
                  id="configuration_name"
                  name="configuration_name"
                  placeholder="e.g., my-razorpay-setup"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="provider_name">Provider</ZoruLabel>
                <ZoruSelect
                  name="provider_name"
                  onValueChange={setProviderType}
                  defaultValue="gateway"
                  required
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Select provider type..." />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="razorpay">Razorpay</ZoruSelectItem>
                    <ZoruSelectItem value="payu">PayU</ZoruSelectItem>
                    <ZoruSelectItem value="zaakpay">Zaakpay</ZoruSelectItem>
                    <ZoruSelectItem value="upi_vpa">UPI VPA</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              {providerType !== 'upi_vpa' ? (
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="redirect_url">Redirect URL</ZoruLabel>
                  <ZoruInput
                    id="redirect_url"
                    name="redirect_url"
                    type="url"
                    placeholder="https://your-site.com/payment/callback"
                    required
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="merchant_vpa">Merchant VPA</ZoruLabel>
                  <ZoruInput
                    id="merchant_vpa"
                    name="merchant_vpa"
                    placeholder="your-business@okhdfcbank"
                    required
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="purpose_code">Purpose Code</ZoruLabel>
                <ZoruInput
                  id="purpose_code"
                  name="purpose_code"
                  placeholder="e.g., 00"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="merchant_category_code">
                  Merchant Category Code (MCC)
                </ZoruLabel>
                <ZoruInput
                  id="merchant_category_code"
                  name="merchant_category_code"
                  placeholder="e.g., 0000"
                  required
                />
              </div>
            </div>
          </ZoruScrollArea>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <PendingSubmit>Create Configuration</PendingSubmit>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── RegenerateOauthDialog ────────────────────────────────────── */

const regenInitialState: {
  message?: string | null;
  error?: string;
  oauth_url?: string | null;
} = { message: undefined, error: undefined, oauth_url: undefined };

interface RegenerateOauthDialogProps {
  project: WithId<Project>;
  config: PaymentConfiguration;
  onSuccess: () => void;
}

export function RegenerateOauthDialog({
  project,
  config,
  onSuccess,
}: RegenerateOauthDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleRegenerateOauthLink as any,
    regenInitialState,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if ((state as any).message && !(state as any).oauth_url) {
      toast({ title: 'Success!', description: (state as any).message });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSuccess]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
      if (state.oauth_url) {
        window.location.reload();
      }
    }
    setOpen(isOpen);
  };

  if (state.oauth_url) {
    return (
      <ZoruDialog open={open} onOpenChange={handleOpenChange}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Complete Re-onboarding</ZoruDialogTitle>
            <ZoruDialogDescription>
              Your OAuth link has been regenerated. Please complete the setup
              with your payment provider.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruAlert>
            <ZoruAlertTitle>Action Required</ZoruAlertTitle>
            <ZoruAlertDescription>
              Click the button below to go to the provider&apos;s site and
              re-authorize the connection.
            </ZoruAlertDescription>
          </ZoruAlert>
          <ZoruDialogFooter>
            <ZoruButton asChild>
              <a
                href={state.oauth_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOpenChange(false)}
              >
                Complete Onboarding
              </a>
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    );
  }

  return (
    <ZoruDialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <LinkIcon />
          Regenerate Link
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction as any} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="configuration_name"
            value={config.configuration_name}
          />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Regenerate OAuth Link</ZoruDialogTitle>
            <ZoruDialogDescription>
              This will generate a new onboarding link for &quot;
              {config.configuration_name}&quot;.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <ZoruLabel htmlFor="redirect_url">Redirect URL</ZoruLabel>
            <ZoruInput
              id="redirect_url"
              name="redirect_url"
              type="url"
              placeholder="https://your-site.com/payment/callback"
              required
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <PendingSubmit>Regenerate Link</PendingSubmit>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── UpdateDataEndpointDialog ─────────────────────────────────── */

const updateInitialState: { message?: string | null; error?: string } = {
  message: null,
  error: undefined,
};

interface UpdateDataEndpointDialogProps {
  project: WithId<Project>;
  config: PaymentConfiguration;
  onSuccess: () => void;
}

export function UpdateDataEndpointDialog({
  project,
  config,
  onSuccess,
}: UpdateDataEndpointDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleUpdateDataEndpoint as any,
    updateInitialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({
        title: 'Error Updating Endpoint',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSuccess]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <Settings />
          Data Endpoint
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction as any} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="configurationName"
            value={config.configuration_name}
          />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update Data Endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set the URL for WhatsApp to fetch dynamic data for coupons,
              shipping, etc for the &quot;{config.configuration_name}&quot;
              configuration.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <ZoruLabel htmlFor="dataEndpointUrl">Endpoint URL</ZoruLabel>
            <ZoruInput
              id="dataEndpointUrl"
              name="dataEndpointUrl"
              placeholder="https://your-api.com/whatsapp-data"
              required
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <PendingSubmit>
              <LinkIcon />
              Update Endpoint
            </PendingSubmit>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── DeletePaymentConfigButton ────────────────────────────────── */

interface DeletePaymentConfigButtonProps {
  projectId: string;
  configName: string;
  onSuccess: () => void;
}

export function DeletePaymentConfigButton({
  projectId,
  configName,
  onSuccess,
}: DeletePaymentConfigButtonProps) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await handleDeletePaymentConfiguration(
        projectId,
        configName,
      );
      if (result.success) {
        toast({
          title: 'Success',
          description: `Configuration "${configName}" deleted.`,
        });
        onSuccess();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton variant="destructive" size="sm" disabled={isPending}>
          <Trash2 />
          Delete
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This will permanently delete the payment configuration &quot;
            {configName}&quot;. This action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            destructive
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Confirm Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
