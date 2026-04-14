'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { Globe, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getGatewayCredentials,
  togglePublicPayment,
} from '@/app/actions/worksuite/payments.actions';

const COLORS: Record<string, string> = {
  razorpay: 'bg-clay-blue-soft text-clay-blue',
  stripe: 'bg-clay-rose-soft text-clay-rose-ink',
  paypal: 'bg-clay-amber-soft text-clay-amber',
  payfast: 'bg-clay-green-soft text-clay-green',
  paytm: 'bg-clay-blue-soft text-clay-blue',
  mollie: 'bg-clay-red-soft text-clay-red',
  authorize_net: 'bg-clay-rose-soft text-clay-rose-ink',
  square: 'bg-clay-obsidian text-white',
};

export default function PublicPaymentPage() {
  const { toast } = useToast();
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

      <ClayCard>
        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-clay-ink-muted">
            Configure at least one gateway to expose it publicly.
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-clay-border">
            {rows.map((r) => {
              const letter = (r.gateway || '?').charAt(0).toUpperCase();
              return (
                <li
                  key={r._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-clay-md text-[13px] font-semibold ${
                        COLORS[r.gateway] ||
                        'bg-clay-surface-2 text-clay-ink'
                      }`}
                    >
                      {letter}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-clay-ink">
                          {r.gateway}
                        </span>
                        <ClayBadge
                          tone={r.mode === 'live' ? 'green' : 'amber'}
                        >
                          {r.mode}
                        </ClayBadge>
                        <ClayBadge
                          tone={r.is_active ? 'green' : 'neutral'}
                          dot
                        >
                          {r.is_active ? 'active' : 'inactive'}
                        </ClayBadge>
                      </div>
                      <p className="mt-0.5 text-[12px] text-clay-ink-muted">
                        {r.show_on_public
                          ? 'Visible on public pay pages'
                          : 'Hidden from public pay pages'}
                      </p>
                    </div>
                  </div>
                  <ClayButton
                    variant={r.show_on_public ? 'obsidian' : 'ghost'}
                    disabled={isPending || !r.is_active}
                    onClick={() => onToggle(r._id)}
                  >
                    {r.show_on_public ? 'Hide' : 'Show'}
                  </ClayButton>
                </li>
              );
            })}
          </ul>
        )}
      </ClayCard>
    </div>
  );
}
