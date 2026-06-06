'use client';

/**
 * Envelope detail — shows status, signers (with sign URLs for in-person
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
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
} from '@/components/sabcrm/20ui/compat';
import {
  generateAuditTrailPdf,
  generateKioskLink,
  getEnvelope,
  sendEnvelope,
  voidEnvelope,
  createTemplateFromEnvelope,
} from '@/app/actions/sabsign.actions';
import type { EsignEnvelopeDoc } from '@/lib/rust-client/esign-envelopes';

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  sent: 'secondary',
  in_progress: 'secondary',
  completed: 'default',
  declined: 'destructive',
  voided: 'destructive',
  expired: 'destructive',
};

export default function EnvelopeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const envelopeId = params.id;

  const [env, setEnv] = React.useState<EsignEnvelopeDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [kioskInfo, setKioskInfo] = React.useState<{ url: string; pin: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEnvelope(envelopeId);
      setEnv(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    setBusy(true);
    try {
      await sendEnvelope(envelopeId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async () => {
    if (!confirm('Void this envelope? Signers will no longer be able to sign.')) return;
    setBusy(true);
    try {
      await voidEnvelope(envelopeId, 'Voided from detail view');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleAuditPdf = async () => {
    setBusy(true);
    try {
      const res = await generateAuditTrailPdf(envelopeId);
      alert(`Audit snapshot saved (id=${res.snapshotId}). PDF rendering pipeline is a TODO.`);
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async () => {
    const name = prompt('Template name?');
    if (!name) return;
    setBusy(true);
    try {
      const res = await createTemplateFromEnvelope(envelopeId, name.trim());
      router.push(`/dashboard/sabsign/templates`);
    } finally {
      setBusy(false);
    }
  };

  const handleKiosk = async (signerId: string) => {
    const pin = prompt('Set a numeric PIN for this signer (4-8 digits):');
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      alert('PIN must be 4-8 digits.');
      return;
    }
    setBusy(true);
    try {
      const res = await generateKioskLink(envelopeId, signerId, pin);
      setKioskInfo(res);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>;
  }
  if (!env) {
    return <div className="p-6 text-sm text-[var(--st-text)]">Envelope not found.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/sabsign')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-[var(--st-text)]">{env.name}</h1>
          <Badge variant={STATUS_BADGE[env.status] || 'outline'}>
            {env.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {env.status === 'draft' && (
            <Button onClick={handleSend} disabled={busy}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          )}
          {env.status !== 'completed' && env.status !== 'voided' && (
            <Button variant="outline" onClick={handleVoid} disabled={busy}>
              <Ban className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}
          <Button variant="outline" onClick={handleClone} disabled={busy}>
            <Layers className="h-4 w-4 mr-2" />
            Save as template
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/sabsign/${env._id}/audit`}>
              <History className="h-4 w-4 mr-2" />
              Audit trail
            </Link>
          </Button>
          <Button variant="outline" onClick={handleAuditPdf} disabled={busy}>
            <FileDown className="h-4 w-4 mr-2" />
            Audit PDF
          </Button>
        </div>
      </div>

      <Card className="p-4 border border-[var(--st-border)]">
        <h3 className="text-sm font-medium text-[var(--st-text)] mb-2">Document</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--st-text)]">{env.docName || env.docId}</span>
          {env.docUrl && (
            <a
              href={env.docUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--st-accent)] hover:underline"
            >
              Open
            </a>
          )}
        </div>
      </Card>

      {kioskInfo && (
        <Card className="p-4 border border-[var(--st-border)] bg-[var(--st-bg-muted)]/20">
          <h3 className="text-sm font-medium text-[var(--st-text)] mb-2">Kiosk link ready</h3>
          <div className="text-sm">
            <div>URL: <code className="text-xs">{kioskInfo.url}</code></div>
            <div>PIN: <code className="text-xs">{kioskInfo.pin}</code></div>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Open the URL on the in-person device and enter the PIN. The
              PIN hash is stored on the signer record server-side.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4 border border-[var(--st-border)]">
        <h3 className="text-sm font-medium text-[var(--st-text)] mb-2">Signers</h3>
        <table className="w-full text-sm">
          <thead className="bg-[var(--st-bg-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Auth</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {env.signers.map((s) => (
              <tr key={s.id} className="border-t border-[var(--st-border)]">
                <td className="px-3 py-2">{s.order}</td>
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2 text-[var(--st-text-secondary)]">{s.authMethod}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{s.status}</Badge>
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  {s.accessToken && (
                    <a
                      className="text-xs text-[var(--st-accent)] hover:underline"
                      href={`/sign/${env._id}?signerId=${s.id}&t=${s.accessToken}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Mail className="h-3 w-3 inline" /> Sign link
                    </a>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleKiosk(s.id)}>
                    <Monitor className="h-3 w-3 mr-1" />
                    Kiosk
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 border border-[var(--st-border)]">
        <h3 className="text-sm font-medium text-[var(--st-text)] mb-2">Fields ({env.fields.length})</h3>
        <ul className="text-sm space-y-1">
          {env.fields.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <Badge variant="outline">{f.fieldType}</Badge>
              <span className="text-[var(--st-text-secondary)]">{f.recipientRole}</span>
              <span>{f.label || '—'}</span>
              {f.value && (
                <span className="text-[var(--st-accent)] truncate max-w-xs">= {f.value}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
