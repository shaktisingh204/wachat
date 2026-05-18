'use client';

import { ZoruBadge, ZoruButton, ZoruCard, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { Globe,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getGatewayCredentials,
  togglePublicPayment,
} from '@/app/actions/worksuite/payments.actions';

const COLORS: Record<string, string> = {
  razorpay: 'bg-zoru-info/10 text-zoru-info-ink',
  stripe: 'bg-zoru-surface-2 text-zoru-ink',
  paypal: 'bg-zoru-warning/15 text-zoru-warning-ink',
  payfast: 'bg-zoru-success/10 text-zoru-success-ink',
  paytm: 'bg-zoru-info/10 text-zoru-info-ink',
  mollie: 'bg-zoru-danger/10 text-zoru-danger-ink',
  authorize_net: 'bg-zoru-surface-2 text-zoru-ink',
  square: 'bg-zoru-ink text-white',
};

export default function PublicPaymentPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isPending, startPending] = useTransition();

  const load = useCallback(() => {
    startLoad(async () => {
      const data = await getGatewayCredentials();
      setRows((data || []) as any[]);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onToggle = (id: string) => {
    startPending(async () => {
      const r = await togglePublicPayment(id);
      if (r.message) toast({ title: r.message });
      if (r.error)
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Public Payment"
        subtitle="Choose which gateways customers see on public invoice and proposal pay pages."
        icon={Globe}
      />

      <ZoruCard className="p-6">
        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
            Configure at least one gateway to expose it publicly.
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-zoru-line">
            {rows.map((r) => {
              const letter = (r.gateway || '?').charAt(0).toUpperCase();
              return (
                <li
                  key={r._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-[13px] ${
                        COLORS[r.gateway] ||
                        'bg-zoru-surface-2 text-zoru-ink'
                      }`}
                    >
                      {letter}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-zoru-ink">{r.gateway}</span>
                        <ZoruBadge
                          variant={r.mode === 'live' ? 'success' : 'warning'}
                        >
                          {r.mode}
                        </ZoruBadge>
                        <ZoruBadge variant={r.is_active ? 'success' : 'ghost'}>
                          {r.is_active ? 'active' : 'inactive'}
                        </ZoruBadge>
                      </div>
                      <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                        {r.show_on_public
                          ? 'Visible on public pay pages'
                          : 'Hidden from public pay pages'}
                      </p>
                    </div>
                  </div>
                  <ZoruButton
                    variant={r.show_on_public ? 'default' : 'ghost'}
                    disabled={isPending || !r.is_active}
                    onClick={() => onToggle(r._id)}
                  >
                    {r.show_on_public ? 'Hide' : 'Show'}
                  </ZoruButton>
                </li>
              );
            })}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}
