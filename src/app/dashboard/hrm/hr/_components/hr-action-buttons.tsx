'use client';

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
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Loader2 } from 'lucide-react';

/**
 * <HrActionButtons /> — shared client island for HR detail-page header
 * actions (§1D.2 of the CRM rebuild contract).
 *
 * Renders the supplied list of action descriptors as ZoruButtons and
 * wires each one to its server action via `useTransition` + toast. Three
 * shapes are supported:
 *
 *   1. `kind: 'action'` — fire-and-forget. Click → server action →
 *      toast → revalidate. Used for "Confirm KT", "Send", "Approve",
 *      etc.
 *   2. `kind: 'confirm'` — wraps the action in <ConfirmDialog/>. Used
 *      for destructive actions like "Reject", "Withdraw", "Terminate",
 *      "Retire".
 *   3. `kind: 'prompt'` — opens an inline <ZoruDialog/> with one or
 *      more input fields, then submits to the server action with the
 *      collected values. Used for "Renew" (expiry date), "Extend" (new
 *      end date), "Mark reimbursed" (amount), etc.
 *
 * The component lives next to the HR detail shells but is shape-agnostic
 * — it can be slotted into both `<EntityDetailShell>` and
 * `<RecruitmentDetailShell>` because it just emits `<ZoruButton>`
 * children.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';

/** Result shape every wired server action returns. */
export type HrActionResult = { message?: string; error?: string };

export interface HrActionPromptField {
  /** Key for the resulting value bag. */
  name: string;
  label: string;
  /** Optional placeholder text. */
  placeholder?: string;
  /** Default initial value. */
  defaultValue?: string;
  /** Input type — falls back to text. */
  type?: 'text' | 'textarea' | 'date' | 'number';
  /** Whether the field must have a value before submit enables. */
  required?: boolean;
}

interface BaseDescriptor {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: ButtonVariant;
  /** Optional client-side disable (e.g. already-sent offers). */
  disabled?: boolean;
}

interface ActionDescriptor extends BaseDescriptor {
  kind: 'action';
  onRun: () => Promise<HrActionResult>;
}

interface ConfirmDescriptor extends BaseDescriptor {
  kind: 'confirm';
  /** Title displayed in the confirm modal. */
  confirmTitle: string;
  confirmDescription?: string;
  confirmLabel?: string;
  onRun: () => Promise<HrActionResult>;
}

interface PromptDescriptor extends BaseDescriptor {
  kind: 'prompt';
  promptTitle: string;
  promptDescription?: string;
  submitLabel?: string;
  fields: HrActionPromptField[];
  onRun: (values: Record<string, string>) => Promise<HrActionResult>;
}

export type HrActionDescriptor =
  | ActionDescriptor
  | ConfirmDescriptor
  | PromptDescriptor;

export interface HrActionButtonsProps {
  actions: HrActionDescriptor[];
  /** Optional extra className for the wrapping flex container. */
  className?: string;
  /** Size applied to every button. Defaults to `sm`. */
  size?: 'sm' | 'md';
}

export function HrActionButtons({
  actions,
  className,
  size = 'sm',
}: HrActionButtonsProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = React.useTransition();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [confirmKey, setConfirmKey] = React.useState<string | null>(null);
  const [promptKey, setPromptKey] = React.useState<string | null>(null);

  const runAction = React.useCallback(
    (key: string, fn: () => Promise<HrActionResult>) => {
      setPendingKey(key);
      startTransition(async () => {
        try {
          const res = await fn();
          if (res?.error) {
            toast({
              title: 'Action failed',
              description: res.error,
              variant: 'destructive',
            });
          } else {
            toast({ title: res?.message || 'Saved.' });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          toast({
            title: 'Action failed',
            description: msg,
            variant: 'destructive',
          });
        } finally {
          setPendingKey(null);
        }
      });
    },
    [toast],
  );

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {actions.map((a) => {
        const busy = isPending && pendingKey === a.key;
        const variant = a.variant ?? 'outline';
        return (
          <React.Fragment key={a.key}>
            <ZoruButton
              variant={variant === 'destructive' ? 'ghost' : variant}
              size={size}
              type="button"
              disabled={busy || a.disabled || isPending}
              className={
                variant === 'destructive' ? 'text-zoru-danger-ink' : undefined
              }
              onClick={() => {
                if (a.disabled) return;
                if (a.kind === 'action') {
                  runAction(a.key, a.onRun);
                } else if (a.kind === 'confirm') {
                  setConfirmKey(a.key);
                } else if (a.kind === 'prompt') {
                  setPromptKey(a.key);
                }
              }}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                a.icon
              )}
              <span>{a.label}</span>
            </ZoruButton>

            {a.kind === 'confirm' ? (
              <ConfirmDialog
                open={confirmKey === a.key}
                onOpenChange={(next) => {
                  setConfirmKey(next ? a.key : null);
                }}
                title={a.confirmTitle}
                description={a.confirmDescription}
                confirmLabel={a.confirmLabel ?? a.label}
                confirmTone={variant === 'destructive' ? 'danger' : 'primary'}
                onConfirm={async () => {
                  const res = await a.onRun();
                  if (res?.error) {
                    toast({
                      title: 'Action failed',
                      description: res.error,
                      variant: 'destructive',
                    });
                    throw new Error(res.error);
                  }
                  toast({ title: res?.message || 'Saved.' });
                }}
              />
            ) : null}

            {a.kind === 'prompt' ? (
              <PromptDialog
                action={a}
                open={promptKey === a.key}
                onOpenChange={(next) => {
                  setPromptKey(next ? a.key : null);
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── PromptDialog — inline form for prompt-style actions ──────────── */

interface PromptDialogProps {
  action: PromptDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PromptDialog({ action, open, onOpenChange }: PromptDialogProps) {
  const { toast } = useZoruToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(action.fields.map((f) => [f.name, f.defaultValue ?? ''])),
  );

  // Reset state when the dialog closes so re-opens start fresh.
  React.useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setValues(
        Object.fromEntries(
          action.fields.map((f) => [f.name, f.defaultValue ?? '']),
        ),
      );
    }
  }, [open, action.fields]);

  const requiredOk = action.fields.every(
    (f) => !f.required || (values[f.name] ?? '').trim().length > 0,
  );

  const handleSubmit = async () => {
    if (!requiredOk || submitting) return;
    setSubmitting(true);
    try {
      const res = await action.onRun(values);
      if (res?.error) {
        toast({
          title: 'Action failed',
          description: res.error,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }
      toast({ title: res?.message || 'Saved.' });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast({
        title: 'Action failed',
        description: msg,
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  return (
    <ZoruDialog
      open={open}
      onOpenChange={(next) => (submitting ? null : onOpenChange(next))}
    >
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{action.promptTitle}</ZoruDialogTitle>
          {action.promptDescription ? (
            <ZoruDialogDescription>
              {action.promptDescription}
            </ZoruDialogDescription>
          ) : null}
        </ZoruDialogHeader>

        <div className="flex flex-col gap-3">
          {action.fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor={`hr-prompt-${f.name}`}>
                {f.label}
                {f.required ? <span className="ml-0.5 text-zoru-danger-ink">*</span> : null}
              </ZoruLabel>
              {f.type === 'textarea' ? (
                <ZoruTextarea
                  id={`hr-prompt-${f.name}`}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  disabled={submitting}
                  rows={3}
                />
              ) : (
                <ZoruInput
                  id={`hr-prompt-${f.name}`}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                  disabled={submitting}
                  autoFocus
                />
              )}
            </div>
          ))}
        </div>

        <ZoruDialogFooter>
          <ZoruButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !requiredOk}
            aria-busy={submitting || undefined}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                <span>Working…</span>
              </>
            ) : (
              action.submitLabel ?? 'Submit'
            )}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default HrActionButtons;
