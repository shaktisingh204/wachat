'use client';

import * as React from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Badge, Card, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, StatCard } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Phone,
  PhoneCall,
  Search,
  ShoppingCart,
  Trash2,
  Globe,
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

export default function VoiceDidsPage() {
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
      void load();
    } catch (e) {
      alert(`Purchase failed: ${(e as Error).message}`);
    } finally {
      setPurchasingNum(null);
    }
  };

  const handleRelease = async (id: string) => {
    if (!confirm('Release this number? It can no longer receive calls.')) return;
    await releaseVoiceDid(id);
    void load();
  };

  const active = data.filter((d) => d.status === 'active').length;
  const pending = data.filter((d) => d.status === 'pending').length;
  const released = data.filter((d) => d.status === 'released').length;
  const monthlyTotal = data
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + (d.monthlyCost ?? 0), 0);

  return (
    <>
      <EntityListShell
        title="Phone Numbers (DIDs)"
        subtitle="Provision, route, and release voice numbers."
        primaryAction={
          <Button onClick={() => setIsSearchOpen(true)}>
            <Search className="h-4 w-4 mr-2" />
            Buy New Number
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search numbers, labels, refs...',
        }}
        loading={loading}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active" value={active} icon={<Phone className="h-4 w-4" />} />
          <StatCard label="Pending" value={pending} icon={<PhoneCall className="h-4 w-4" />} />
          <StatCard label="Released" value={released} icon={<Trash2 className="h-4 w-4" />} />
          <StatCard
            label="Monthly Cost"
            value={`$${monthlyTotal.toFixed(2)}`}
            icon={<Globe className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Label className="text-sm">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="released">Released</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((d) => (
            <Card key={d._id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg">{d.number}</span>
                <Badge
                  variant={
                    d.status === 'active'
                      ? 'default'
                      : d.status === 'pending'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="capitalize"
                >
                  {d.status}
                </Badge>
              </div>
              <div className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wide">
                {d.country} · {d.provider}
              </div>
              {d.label && <div className="text-sm">{d.label}</div>}
              <div className="text-xs text-[var(--st-text-secondary)]">
                {(d.capabilities ?? []).join(', ')}
              </div>
              <div className="text-xs">
                ${(d.monthlyCost ?? 0).toFixed(2)} {d.currency ?? 'USD'} / mo
              </div>
              {d.status !== 'released' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-[var(--st-text)]"
                  onClick={() => handleRelease(d._id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Release
                </Button>
              )}
            </Card>
          ))}
        </div>
      </EntityListShell>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Search Available Numbers</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="mb-1.5 block">Country</Label>
              <Select value={searchCountry} onValueChange={setSearchCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="gb">United Kingdom</SelectItem>
                  <SelectItem value="in">India</SelectItem>
                  <SelectItem value="au">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Area Code</Label>
              <Input value={searchArea} onChange={(e) => setSearchArea(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pb-2">
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="border-t border-[var(--st-border)] pt-2 max-h-80 overflow-y-auto">
              {searchResults.map((n) => (
                <div
                  key={n.number}
                  className="flex items-center justify-between py-2 border-b border-[var(--st-border)] last:border-0"
                >
                  <div>
                    <div className="font-mono">{n.number}</div>
                    <div className="text-xs text-[var(--st-text-secondary)]">
                      {n.capabilities.join(', ')} · ${n.monthlyCost.toFixed(2)}/mo
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePurchase(n)}
                    disabled={purchasingNum === n.number}
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    {purchasingNum === n.number ? 'Buying...' : 'Buy'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSearchOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
