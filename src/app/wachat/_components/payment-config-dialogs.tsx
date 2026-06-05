'use client';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Field,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle,
  Link as LinkIcon,
  Loader2,
  Settings,
  Trash2 } from 'lucide-react';

import {
  handleCreatePaymentConfiguration,
  handleDeletePaymentConfiguration,
  handleRegenerateOauthLink,
  handleUpdateDataEndpoint,
  } from '@/app/actions/whatsapp-pay.actions';
import type { PaymentConfiguration,
  Project,
  WithId } from '@/lib/definitions';

/**
 * Payment configuration dialogs (wachat-local, 20ui).
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

/* ── shared submit button ─────────────────────────────────────── */

function PendingSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [providerType, setProviderType] = useState('gateway');

  useEffect(() => {
    if (state.message && !state.oauth_url) {
      toast({ title: 'Success!', description: state.message, tone: 'success' });
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
      <Modal
        open={isOpen}
        onClose={() => handleOpenChange(false)}
        title="Complete Onboarding"
        description="Your payment configuration has been created. Please complete the setup with your payment provider."
        footer={
          <a
            href={state.oauth_url}
            target="_blank"
            rel="noopener noreferrer"
            className="u-btn u-btn--primary u-btn--md"
            onClick={() => handleOpenChange(false)}
          >
            <span className="u-btn__label">Complete Onboarding</span>
          </a>
        }
      >
        <Alert tone="info" title="Action Required">
          Click the button below to go to the provider&apos;s site and authorize
          the connection.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => handleOpenChange(false)}
      title="Create Payment Configuration"
      description="This information should match the details in your Meta Commerce Manager account."
      size="md"
    >
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
        <input type="hidden" name="provider_name" value={providerType} />
        {state.error && (
          <Alert tone="danger" icon={AlertCircle} className="mb-3">
            {state.error}
          </Alert>
        )}
        <div className="grid gap-4">
          <Field label="Configuration Name" id="configuration_name">
            <Input
              name="configuration_name"
              placeholder="e.g., my-razorpay-setup"
              required
            />
          </Field>
          <Field label="Provider" id="provider_name">
            <Select
              value={providerType}
              onChange={(v) => setProviderType(v ?? 'gateway')}
              placeholder="Select provider type..."
              options={[
                { value: 'razorpay', label: 'Razorpay' },
                { value: 'payu', label: 'PayU' },
                { value: 'zaakpay', label: 'Zaakpay' },
                { value: 'upi_vpa', label: 'UPI VPA' },
              ]}
            />
          </Field>
          {providerType !== 'upi_vpa' ? (
            <Field label="Redirect URL" id="redirect_url">
              <Input
                name="redirect_url"
                type="url"
                placeholder="https://your-site.com/payment/callback"
                required
              />
            </Field>
          ) : (
            <Field label="Merchant VPA" id="merchant_vpa">
              <Input
                name="merchant_vpa"
                placeholder="your-business@okhdfcbank"
                required
              />
            </Field>
          )}
          <Field label="Purpose Code" id="purpose_code">
            <Input name="purpose_code" placeholder="e.g., 00" required />
          </Field>
          <Field
            label="Merchant Category Code (MCC)"
            id="merchant_category_code"
          >
            <Input
              name="merchant_category_code"
              placeholder="e.g., 0000"
              required
            />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <PendingSubmit>Create Configuration</PendingSubmit>
        </div>
      </form>
    </Modal>
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if ((state as any).message && !(state as any).oauth_url) {
      toast({
        title: 'Success!',
        description: (state as any).message,
        tone: 'success',
      });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
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
      <Modal
        open={open}
        onClose={() => handleOpenChange(false)}
        title="Complete Re-onboarding"
        description="Your OAuth link has been regenerated. Please complete the setup with your payment provider."
        footer={
          <a
            href={state.oauth_url}
            target="_blank"
            rel="noopener noreferrer"
            className="u-btn u-btn--primary u-btn--md"
            onClick={() => handleOpenChange(false)}
          >
            <span className="u-btn__label">Complete Onboarding</span>
          </a>
        }
      >
        <Alert tone="info" title="Action Required">
          Click the button below to go to the provider&apos;s site and
          re-authorize the connection.
        </Alert>
      </Modal>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" iconLeft={LinkIcon} onClick={() => setOpen(true)}>
        Regenerate Link
      </Button>
      <Modal
        open={open}
        onClose={() => handleOpenChange(false)}
        title="Regenerate OAuth Link"
        description={
          <>
            This will generate a new onboarding link for &quot;
            {config.configuration_name}&quot;.
          </>
        }
        size="md"
      >
        <form action={formAction as any} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="configuration_name"
            value={config.configuration_name}
          />
          <Field label="Redirect URL" id="redirect_url">
            <Input
              name="redirect_url"
              type="url"
              placeholder="https://your-site.com/payment/callback"
              required
            />
          </Field>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingSubmit>Regenerate Link</PendingSubmit>
          </div>
        </form>
      </Modal>
    </>
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message, tone: 'success' });
      onSuccess();
      setOpen(false);
    }
    if (state.error) {
      toast({
        title: 'Error Updating Endpoint',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast, onSuccess]);

  return (
    <>
      <Button variant="outline" size="sm" iconLeft={Settings} onClick={() => setOpen(true)}>
        Data Endpoint
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Update Data Endpoint"
        description={
          <>
            Set the URL for WhatsApp to fetch dynamic data for coupons,
            shipping, etc for the &quot;{config.configuration_name}&quot;
            configuration.
          </>
        }
        size="md"
      >
        <form action={formAction as any} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="configurationName"
            value={config.configuration_name}
          />
          <Field label="Endpoint URL" id="dataEndpointUrl">
            <Input
              name="dataEndpointUrl"
              placeholder="https://your-api.com/whatsapp-data"
              required
            />
          </Field>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingSubmit>
              <LinkIcon />
              Update Endpoint
            </PendingSubmit>
          </div>
        </form>
      </Modal>
    </>
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
  const { toast } = useToast();
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
          tone: 'success',
        });
        onSuccess();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          tone: 'danger',
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="danger" size="sm" iconLeft={Trash2} disabled={isPending}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the payment configuration &quot;
            {configName}&quot;. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            intent="danger"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
