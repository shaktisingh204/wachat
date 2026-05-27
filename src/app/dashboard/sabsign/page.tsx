'use client';

/**
 * Envelopes list — the home of the e-signatures module.
 *
 * Mirrors Zoho Sign's "Documents" tab:
 *   * status filter chips (draft, sent, in_progress, completed, declined,
 *     voided, expired)
 *   * search by name / doc name
 *   * primary CTA → new envelope builder
 *   * secondary CTAs → templates, bulk send
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  FileSignature,
  Send,
  Layers,
  History,
  Upload as UploadIcon,
  FileText,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Badge,
  Button,
  Card,
  Input,
} from '@/components/zoruui';
import {
  listEnvelopes,
  voidEnvelope,
} from '@/app/actions/sabsign.actions';
import type {
  EnvelopeStatus,
  EsignEnvelopeDoc,
} from '@/lib/rust-client/esign-envelopes';

const STATUS_FILTERS: Array<{ value: EnvelopeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'voided', label: 'Voided' },
];

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  sent: 'secondary',
  in_progress: 'secondary',
  completed: 'default',
  declined: 'destructive',
  voided: 'destructive',
  expired: 'destructive',
};

export default function EnvelopesListPage() {
  const [data, setData] = React.useState<EsignEnvelopeDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<EnvelopeStatus | 'all'>('all');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEnvelopes({
        status: statusFilter,
        q: search || undefined,
        limit: 100,
      });
      setData(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleVoid = async (id: string) => {
    if (!confirm('Void this envelope? Signers will no longer be able to sign.')) return;
    await voidEnvelope(id, 'Voided from envelopes list');
    load();
  };

  return (
    <EntityListShell
      title="E-Signatures"
      subtitle="Send documents for signature, manage envelopes, and pull audit trails."
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/sabsign/docs">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/sabsign/templates">
              <Layers className="h-4 w-4 mr-2" />
              Templates
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/sabsign/bulk">
              <UploadIcon className="h-4 w-4 mr-2" />
              Bulk send
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sabsign/new">
              <Plus className="h-4 w-4 mr-2" />
              New envelope
            </Link>
          </Button>
        </div>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search envelopes by name or document…',
      }}
      loading={loading}
      empty={
        !loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-zoru-line">
            <div className="w-12 h-12 bg-zoru-surface rounded-full flex items-center justify-center mb-4">
              <FileSignature className="h-6 w-6 text-zoru-ink-muted" />
            </div>
            <h3 className="text-lg font-medium text-zoru-ink">No envelopes yet</h3>
            <p className="text-sm text-zoru-ink-muted mt-1">
              Upload a document, place fields, add signers, and send.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/sabsign/new">
                <Plus className="h-4 w-4 mr-2" />
                Create your first envelope
              </Link>
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {data.length > 0 && (
        <Card className="overflow-hidden border border-zoru-line rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zoru-surface-2">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted">Name</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted">Document</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted">Signers</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted">Routing</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((env) => (
                  <tr key={env._id} className="hover:bg-zoru-surface transition-colors">
                    <td className="px-4 py-2 border-t border-zoru-line text-sm text-zoru-ink">
                      <Link
                        href={`/dashboard/sabsign/${env._id}`}
                        className="font-medium hover:underline"
                      >
                        {env.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 border-t border-zoru-line text-sm text-zoru-ink-muted">
                      {env.docName || env.docId}
                    </td>
                    <td className="px-4 py-2 border-t border-zoru-line text-sm">
                      {env.signers.length}{' '}
                      <span className="text-zoru-ink-muted">
                        ({env.signers.filter((s) => s.status === 'completed').length} signed)
                      </span>
                    </td>
                    <td className="px-4 py-2 border-t border-zoru-line text-sm text-zoru-ink-muted">
                      {env.routingOrder}
                    </td>
                    <td className="px-4 py-2 border-t border-zoru-line text-sm">
                      <Badge variant={STATUS_BADGE[env.status] || 'outline'}>
                        {env.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 border-t border-zoru-line text-right space-x-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/dashboard/sabsign/${env._id}/audit`}
                        >
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                      {env.status === 'draft' && (
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/dashboard/sabsign/${env._id}`}
                          >
                            <Send className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {env.status !== 'completed' && env.status !== 'voided' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleVoid(env._id)}
                        >
                          Void
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </EntityListShell>
  );
}
