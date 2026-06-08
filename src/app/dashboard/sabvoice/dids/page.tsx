'use client';

import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Field,
  Badge,
  Card,
  SelectField,
  StatCard,
  SearchInput,
  EmptyState,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Phone,
  PhoneCall,
  Search,
  ShoppingCart,
  Trash2,
  Globe,
  DollarSign,
} from 'lucide-react';
import {
  listVoiceDids,
  searchAvailableDids,
  purchaseVoiceDid,
  releaseVoiceDid,
} from '@/app/actions/sabvoice.actions';

type DidRow = {
  _id: string;
  number: string;
  country: string;
  capabilities?: string[];
  status: 'active' | 'pending' | 'released';
  label?: string | null;
  provider: 'twilio' | 'plivo' | 'mock';
  monthlyCost?: number;
  currency?: string;
};

type AvailableNumber = {
  number: string;
  country: string;
  capabilities: string[];
  monthlyCost: number;
  currency: string;
  provider: 'mock';
};

const STATUS_TONE: Record<DidRow['status'], React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  pending: 'warning',
  released: 'neutral',
};

export default function VoiceDidsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<DidRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchCountry, setSearchCountry] = React.useState('us');
  const [searchArea, setSearchArea] = React.useState('415');
  const [searchResults, setSearchResults] = React.useState<AvailableNumber[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [purchasingNum, setPurchasingNum] = React.useState<string | null>(null);
  const [releasingId, setReleasingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoiceDids({ q: search, status: statusFilter });
      if (res.success) setData(res.data as DidRow[]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await searchAvailableDids({
        country: searchCountry,
        areaCode: searchArea,
        limit: 10,
      });
      setSearchResults(res.items as AvailableNumber[]);
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async (n: AvailableNumber) => {
    setPurchasingNum(n.number);
    try {
      await purchaseVoiceDid({
        number: n.number,
        country: n.country,
        provider: n.provider,
        capabilities: n.capabilities,
        status: 'active',
        monthlyCost: n.monthlyCost,
        currency: n.currency,
      });
      setIsSearchOpen(false);
      setSearchResults([]);
      toast.success(`${n.number} added to your numbers`);
      void load();
    } catch (e) {
      toast.error(`Purchase failed: ${(e as Error).message}`);
    } finally {
      setPurchasingNum(null);
    }
  };

  const handleRelease = async (id: string, number: string) => {
    setReleasingId(id);
    try {
      await releaseVoiceDid(id);
      toast.success(`${number} released`);
      void load();
    } catch (e) {
      toast.error(`Release failed: ${(e as Error).message}`);
    } finally {
      setReleasingId(null);
    }
  };

  const active = data.filter((d) => d.status === 'active').length;
  const pending = data.filter((d) => d.status === 'pending').length;
  const released = data.filter((d) => d.status === 'released').length;
  const monthlyTotal = data
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + (d.monthlyCost ?? 0), 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabVoice</PageEyebrow>
          <PageTitle>Phone numbers</PageTitle>
          <PageDescription>Provision, route, and release voice numbers (DIDs).</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Search} onClick={() => setIsSearchOpen(true)}>
            Buy a number
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Number metrics" className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
        <StatCard label="Active" value={active} icon={Phone} accent="#1f9d55" />
        <StatCard label="Pending" value={pending} icon={PhoneCall} accent="#d97706" />
        <StatCard label="Released" value={released} icon={Trash2} accent="#64748b" />
        <StatCard
          label="Monthly cost"
          value={`$${monthlyTotal.toFixed(2)}`}
          icon={DollarSign}
          accent="#3b7af5"
        />
      </section>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-4)]">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search numbers, labels, or refs"
              />
            </Field>
          </div>
          <Field label="Status">
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'released', label: 'Released' },
              ]}
            />
          </Field>
        </div>

        <div className="p-[var(--st-space-4)]">
          {loading ? (
            <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No numbers yet"
              description="Buy your first number to start routing inbound and outbound calls."
              action={
                <Button variant="primary" iconLeft={Search} onClick={() => setIsSearchOpen(true)}>
                  Buy a number
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2 lg:grid-cols-3">
              {data.map((d) => (
                <Card key={d._id} variant="outlined" className="flex flex-col gap-[var(--st-space-2)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg tabular-nums text-[var(--st-text)]">
                      {d.number}
                    </span>
                    <Badge tone={STATUS_TONE[d.status]} className="capitalize">
                      {d.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    {d.country} · {d.provider}
                  </div>
                  {d.label ? <div className="text-sm text-[var(--st-text)]">{d.label}</div> : null}
                  {(d.capabilities ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(d.capabilities ?? []).map((cap) => (
                        <Badge key={cap} tone="neutral" kind="outline" className="capitalize">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                    ${(d.monthlyCost ?? 0).toFixed(2)} {d.currency ?? 'USD'} / month
                  </div>
                  {d.status !== 'released' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={Trash2}
                      className="mt-auto self-start"
                      loading={releasingId === d._id}
                      onClick={() => handleRelease(d._id, d.number)}
                    >
                      Release
                    </Button>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Search available numbers"
        description="Pick a country and area code, then buy a number instantly."
        footer={
          <Button variant="secondary" onClick={() => setIsSearchOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Country">
              <SelectField
                value={searchCountry}
                onChange={(v) => setSearchCountry(v ?? 'us')}
                options={[
                  { value: 'us', label: 'United States' },
                  { value: 'ca', label: 'Canada' },
                  { value: 'gb', label: 'United Kingdom' },
                  { value: 'in', label: 'India' },
                  { value: 'au', label: 'Australia' },
                ]}
              />
            </Field>
            <Field label="Area code">
              <Input value={searchArea} onChange={(e) => setSearchArea(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button iconLeft={Search} onClick={handleSearch} loading={searching}>
              Search
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <div className="max-h-80 divide-y divide-[var(--st-border)] overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              {searchResults.map((n) => (
                <div
                  key={n.number}
                  className="flex items-center justify-between gap-3 p-[var(--st-space-3)]"
                >
                  <div>
                    <div className="font-mono tabular-nums text-[var(--st-text)]">{n.number}</div>
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {n.capabilities.join(', ')} · ${n.monthlyCost.toFixed(2)}/mo
                    </div>
                  </div>
                  <Button
                    size="sm"
                    iconLeft={ShoppingCart}
                    onClick={() => handlePurchase(n)}
                    loading={purchasingNum === n.number}
                  >
                    Buy
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>
    </main>
  );
}
