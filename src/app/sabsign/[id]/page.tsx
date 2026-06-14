'use client';

/**
 * Envelope detail. Shows status, signers (with sign URLs for in-person
 * + email-link flows), fields, and lets the sender:
 *   * send a draft
 *   * void an active envelope
 *   * generate an audit-trail PDF
 *   * generate a kiosk link for in-person signing
 *   * clone into a template
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Ban,
  Layers,
  Monitor,
  FileDown,
  Mail,
  History,
  FileText,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Modal,
  PageActions,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useToast,
  type BadgeTone,
  type ButtonSize,
  type ButtonVariant,
} from '@/components/sabcrm/20ui';
import {
  generateAuditTrailPdf,
  generateKioskLink,
  getEnvelope,
  sendEnvelope,
  voidEnvelope,
  createTemplateFromEnvelope,
} from '@/app/actions/sabsign.actions';
import type { SabSignEnvelopeDoc } from '@/lib/rust-client/sabsign-envelopes';

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  in_progress: 'info',
  completed: 'success',
  declined: 'danger',
  voided: 'danger',
  expired: 'danger',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

/**
 * A real anchor that looks like a 20ui Button. The 20ui `Button` always renders a
 * native `<button>` (no `asChild`), so for navigation we render a link styled with
 * the same `u-btn` classes instead of nesting an anchor inside a button.
 */
function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  external = false,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  external?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const cls = ['u-btn', `u-btn--${variant}`, `u-btn--${size}`].join(' ');
  const content = (
    <>
      {Icon ? <Icon size={ICON_SIZE[size]} aria-hidden="true" /> : null}
      <span className="u-btn__label">{children}</span>
    </>
  );
  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {content}
    </Link>
  );
}

export default function EnvelopeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const envelopeId = params.id;
  const { toast } = useToast();

  const [env, setEnv] = React.useState<SabSignEnvelopeDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [kioskInfo, setKioskInfo] = React.useState<{ url: string; pin: string } | null>(null);

  // Void confirmation modal.
  const [voidOpen, setVoidOpen] = React.useState(false);

  // Clone-to-template modal.
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [cloneName, setCloneName] = React.useState('');

  // Kiosk-PIN modal.
  const [kioskSignerId, setKioskSignerId] = React.useState<string | null>(null);
  const [kioskPin, setKioskPin] = React.useState('');
  const [kioskError, setKioskError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEnvelope(envelopeId);
      setEnv(data);
    } catch (err) {
      console.error(err);
      toast.error('Could not load this envelope.');
    } finally {
      setLoading(false);
    }
  }, [envelopeId, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    setBusy(true);
    try {
      await sendEnvelope(envelopeId);
      toast.success('Envelope sent.');
      await load();
    } catch {
      toast.error('Could not send the envelope.');
    } finally {
      setBusy(false);
    }
  };

  const confirmVoid = async () => {
    setBusy(true);
    try {
      await voidEnvelope(envelopeId, 'Voided from detail view');
      toast.success('Envelope voided.');
      setVoidOpen(false);
      await load();
    } catch {
      toast.error('Could not void the envelope.');
    } finally {
      setBusy(false);
    }
  };

  const handleAuditPdf = async () => {
    setBusy(true);
    try {
      const res = await generateAuditTrailPdf(envelopeId);
      toast({
        title: 'Audit snapshot saved',
        description: `Snapshot id ${res.snapshotId}. PDF rendering pipeline is a TODO.`,
        tone: 'success',
      });
    } catch {
      toast.error('Could not generate the audit snapshot.');
    } finally {
      setBusy(false);
    }
  };

  const confirmClone = async () => {
    const name = cloneName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createTemplateFromEnvelope(envelopeId, name);
      toast.success('Template created.');
      setCloneOpen(false);
      setCloneName('');
      router.push('/sabsign/templates');
    } catch {
      toast.error('Could not create the template.');
    } finally {
      setBusy(false);
    }
  };

  const confirmKiosk = async () => {
    if (!kioskSignerId) return;
    const pin = kioskPin.trim();
    if (!/^\d{4,8}$/.test(pin)) {
      setKioskError('PIN must be 4 to 8 digits.');
      return;
    }
    setBusy(true);
    try {
      const res = await generateKioskLink(envelopeId, kioskSignerId, pin);
      setKioskInfo(res);
      toast.success('Kiosk link generated.');
      setKioskSignerId(null);
      setKioskPin('');
      setKioskError(null);
      await load();
    } catch {
      setKioskError('Could not generate the kiosk link.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="20ui p-6 flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
        <Spinner size="sm" />
        Loading
      </div>
    );
  }
  if (!env) {
    return (
      <div className="20ui p-6">
        <EmptyState
          icon={Inbox}
          title="Envelope not found"
          description="This envelope may have been removed or you may not have access to it."
          action={
            <Button variant="outline" iconLeft={ArrowLeft} onClick={() => router.push('/sabsign')}>
              Back to envelopes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="20ui p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={ArrowLeft}
              onClick={() => router.push('/sabsign')}
            >
              Back
            </Button>
            <PageTitle>{env.name}</PageTitle>
            <Badge tone={STATUS_TONE[env.status] ?? 'neutral'}>
              {env.status.replace('_', ' ')}
            </Badge>
          </div>
        </PageHeaderHeading>
        <PageActions>
          {env.status === 'draft' && (
            <Button variant="primary" iconLeft={Send} onClick={handleSend} disabled={busy}>
              Send
            </Button>
          )}
          {env.status !== 'completed' && env.status !== 'voided' && (
            <Button variant="outline" iconLeft={Ban} onClick={() => setVoidOpen(true)} disabled={busy}>
              Void
            </Button>
          )}
          <Button variant="outline" iconLeft={Layers} onClick={() => setCloneOpen(true)} disabled={busy}>
            Save as template
          </Button>
          <LinkButton href={`/sabsign/${env._id}/audit`} variant="outline" icon={History}>
            Audit trail
          </LinkButton>
          <Button variant="outline" iconLeft={FileDown} onClick={handleAuditPdf} disabled={busy}>
            Audit PDF
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-[var(--st-text)]">
              <FileText className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              {env.docName || env.docId}
            </span>
            {env.docUrl && (
              <LinkButton href={env.docUrl} variant="ghost" size="sm" external>
                Open
              </LinkButton>
            )}
          </div>
        </CardBody>
      </Card>

      {kioskInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Kiosk link ready</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[var(--st-text-secondary)]">URL</span>
                <code className="text-xs text-[var(--st-text)] break-all">{kioskInfo.url}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--st-text-secondary)]">PIN</span>
                <code className="text-xs text-[var(--st-text)]">{kioskInfo.pin}</code>
              </div>
              <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                Open the URL on the in-person device and enter the PIN. The PIN hash is stored on the
                signer record server-side.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <Card padding="none">
        <CardHeader className="px-4 pt-4">
          <CardTitle>Signers</CardTitle>
        </CardHeader>
        {env.signers.length === 0 ? (
          <CardBody>
            <EmptyState icon={Mail} size="sm" title="No signers" description="This envelope has no signers yet." />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>#</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Auth</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {env.signers.map((s) => (
                <Tr key={s.id}>
                  <Td>{s.order}</Td>
                  <Td>{s.name}</Td>
                  <Td>{s.email}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{s.authMethod}</Td>
                  <Td>
                    <Badge tone="neutral" kind="outline">
                      {s.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      {s.accessToken && (
                        <LinkButton
                          href={`/sign/${env._id}?signerId=${s.id}&t=${s.accessToken}`}
                          variant="ghost"
                          size="sm"
                          icon={Mail}
                          external
                        >
                          Sign link
                        </LinkButton>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Monitor}
                        onClick={() => {
                          setKioskSignerId(s.id);
                          setKioskPin('');
                          setKioskError(null);
                        }}
                        disabled={busy}
                      >
                        Kiosk
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fields ({env.fields.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {env.fields.length === 0 ? (
            <EmptyState
              icon={FileText}
              size="sm"
              title="No fields"
              description="This envelope has no fields placed on the document."
            />
          ) : (
            <ul className="text-sm space-y-1">
              {env.fields.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <Badge tone="neutral" kind="outline">
                    {f.fieldType}
                  </Badge>
                  <span className="text-[var(--st-text-secondary)]">{f.recipientRole}</span>
                  <span className="text-[var(--st-text)]">{f.label || '-'}</span>
                  {f.value && (
                    <span className="text-[var(--st-accent)] truncate max-w-xs">= {f.value}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void this envelope?"
        description="Signers will no longer be able to sign. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft={Ban} onClick={confirmVoid} loading={busy}>
              Void envelope
            </Button>
          </>
        }
      />

      <Modal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        title="Save as template"
        description="Create a reusable template from this envelope."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloneOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={Layers}
              onClick={confirmClone}
              loading={busy}
              disabled={!cloneName.trim()}
            >
              Create template
            </Button>
          </>
        }
      >
        <Field label="Template name">
          <Input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="e.g. Standard NDA"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cloneName.trim()) confirmClone();
            }}
          />
        </Field>
      </Modal>

      <Modal
        open={kioskSignerId !== null}
        onClose={() => {
          setKioskSignerId(null);
          setKioskError(null);
        }}
        title="Generate kiosk link"
        description="Set a numeric PIN the in-person signer will enter on the kiosk device."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setKioskSignerId(null);
                setKioskError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Monitor} onClick={confirmKiosk} loading={busy}>
              Generate link
            </Button>
          </>
        }
      >
        <Field label="PIN" help="4 to 8 digits." error={kioskError ?? undefined}>
          <Input
            value={kioskPin}
            inputMode="numeric"
            onChange={(e) => {
              setKioskPin(e.target.value);
              if (kioskError) setKioskError(null);
            }}
            placeholder="e.g. 1234"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmKiosk();
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}
