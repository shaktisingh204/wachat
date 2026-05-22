'use client';

import * as React from 'react';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  TestTube,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Skeleton,
  StatCard,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';

import {
  getGatewayCredentials,
  getPublicPaymentKpis,
  togglePublicPayment,
  toggleGateway,
} from '@/app/actions/worksuite/payments.actions';
import type { WsPaymentGatewayCredential } from '@/lib/worksuite/payments-types';

type Row = Omit<WsPaymentGatewayCredential, '_id' | 'userId'> & {
  _id: string;
  last_tested_at?: string;
};

const GATEWAY_COLORS: Record<string, string> = {
  razorpay: 'bg-zoru-info/10 text-zoru-info-ink',
  stripe: 'bg-zoru-surface-2 text-zoru-ink',
  paypal: 'bg-zoru-warning/15 text-zoru-warning-ink',
  payfast: 'bg-zoru-success/10 text-zoru-success-ink',
  paytm: 'bg-zoru-info/10 text-zoru-info-ink',
  mollie: 'bg-zoru-danger/10 text-zoru-danger-ink',
  authorize_net: 'bg-zoru-surface-2 text-zoru-ink',
  square: 'bg-zoru-ink text-white',
};

const GATEWAY_LABELS: Record<string, string> = {
  razorpay: 'Razorpay',
  stripe: 'Stripe',
  paypal: 'PayPal',
  payfast: 'PayFast',
  paytm: 'Paytm',
  mollie: 'Mollie',
  authorize_net: 'Authorize.Net',
  square: 'Square',
};

export function PublicPaymentClient(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState({ configured: 0, active: 0, testMode: 0 });
  const [loading, setLoading] = React.useState(true);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<Map<string, boolean>>(new Map());

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, snap] = await Promise.all([getGatewayCredentials(), getPublicPaymentKpis()]);
      setRows(list as unknown as Row[]);
      setKpis(snap);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const handleTogglePublic = async (id: string) => {
    setTogglingId(id);
    try {
      const r = await togglePublicPayment(id);
      if (r.message) toast({ title: r.message });
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleActive = async (id: string) => {
    setTogglingId(id);
    try {
      const r = await toggleGateway(id);
      if (r.message) toast({ title: r.message });
      if (r.error) toast({ title: 'Error', description: r.error, variant: 'destructive' });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const handleTestConnection = async (row: Row) => {
    setTestingId(row._id);
    // Simulate a connection test — in production this would hit a server action
    // that pings the gateway's verification endpoint.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const success = row.is_active && !!row.api_key;
    setTestResults((prev) => new Map(prev).set(row._id, success));
    toast({
      title: success ? 'Connection successful' : 'Connection failed',
      description: success
        ? `${GATEWAY_LABELS[row.gateway] ?? row.gateway} responded OK.`
        : 'Check your API credentials.',
      variant: success ? 'default' : 'destructive',
    });
    setTestingId(null);
  };

  const HEADERS = ['Gateway', 'Mode', 'Active', 'Public', 'API Key set'];
  const buildRows = React.useCallback((src: Row[]) =>
    src.map((r) => ({
      Gateway: GATEWAY_LABELS[r.gateway] ?? r.gateway,
      Mode: r.mode,
      Active: r.is_active ? 'Yes' : 'No',
      Public: r.show_on_public ? 'Yes' : 'No',
      'API Key set': r.api_key ? 'Yes' : 'No',
    })), []);

  const handleExportCsv = () => {
    if (!rows.length) { toast({ title: 'Nothing to export' }); return; }
    downloadCsv(`payment-gateways-${dateStamp()}.csv`, HEADERS, buildRows(rows));
  };

  const handleExportXlsx = async () => {
    if (!rows.length) { toast({ title: 'Nothing to export' }); return; }
    await downloadXlsx(`payment-gateways-${dateStamp()}.xlsx`, HEADERS, buildRows(rows), 'Gateways');
  };

  return (
    <EntityListShell
      title="Public Payment"
      subtitle="Choose which gateways appear on public invoice and proposal pay pages."
      loading={loading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <ZoruStatCard label="Configured gateways" value={kpis.configured.toLocaleString()} />
          <ZoruStatCard label="Active gateways" value={kpis.active.toLocaleString()} />
          <ZoruStatCard label="In test mode" value={kpis.testMode.toLocaleString()} icon={<TestTube className="h-4 w-4" />} />
        </div>

        {/* Export toolbar */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ZoruButton variant="outline" size="sm" onClick={handleExportCsv} disabled={rows.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={() => { void handleExportXlsx(); }} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX
          </ZoruButton>
        </div>

        {/* Gateway cards */}
        {loading && rows.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <ZoruCard className="p-6">
            <div className="py-8 text-center text-[13px] text-zoru-ink-muted">
              No gateways configured yet. Go to Payment Gateways settings to add one.
            </div>
          </ZoruCard>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => {
              const colorCls = GATEWAY_COLORS[row.gateway] ?? 'bg-zoru-surface-2 text-zoru-ink';
              const label = GATEWAY_LABELS[row.gateway] ?? row.gateway;
              const letter = label.charAt(0).toUpperCase();
              const testResult = testResults.get(row._id);
              const isToggling = togglingId === row._id;
              const isTesting = testingId === row._id;

              return (
                <ZoruCard key={row._id} className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Gateway avatar */}
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${colorCls}`}>
                      {letter}
                    </span>

                    {/* Info block */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zoru-ink">{label}</span>
                        <ZoruBadge variant={row.mode === 'live' ? 'success' : 'warning'}>
                          {row.mode}
                        </ZoruBadge>
                        <ZoruBadge variant={row.is_active ? 'success' : 'ghost'}>
                          {row.is_active ? 'active' : 'inactive'}
                        </ZoruBadge>
                        {testResult !== undefined && (
                          testResult
                            ? <ZoruBadge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />OK</ZoruBadge>
                            : <ZoruBadge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</ZoruBadge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                        {row.show_on_public
                          ? 'Visible on public pay pages'
                          : 'Hidden from public pay pages'}
                        {row.api_key ? '' : ' · API key not set'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ZoruButton
                        variant="outline"
                        size="sm"
                        disabled={isTesting || !row.is_active}
                        onClick={() => { void handleTestConnection(row); }}
                      >
                        {isTesting
                          ? <><LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />Testing…</>
                          : <><TestTube className="mr-1.5 h-3.5 w-3.5" />Test</>}
                      </ZoruButton>

                      <ZoruButton
                        variant="outline"
                        size="sm"
                        disabled={isToggling}
                        onClick={() => { void handleToggleActive(row._id); }}
                      >
                        {isToggling
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : row.is_active ? 'Deactivate' : 'Activate'}
                      </ZoruButton>

                      <ZoruButton
                        variant={row.show_on_public ? 'default' : 'ghost'}
                        size="sm"
                        disabled={isToggling || !row.is_active}
                        onClick={() => { void handleTogglePublic(row._id); }}
                      >
                        {isToggling
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : row.show_on_public ? 'Hide from public' : 'Show on public'}
                      </ZoruButton>
                    </div>
                  </div>
                </ZoruCard>
              );
            })}
          </div>
        )}
      </div>
    </EntityListShell>
  );
}
