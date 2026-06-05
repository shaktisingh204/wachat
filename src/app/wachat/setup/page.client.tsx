'use client';

import {
  Alert,
  Checkbox,
  Button,
  Badge,
  Skeleton,
  Input,
  Modal,
  Select,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useState, useEffect, useMemo } from 'react';
import EmbeddedSignup from '@/components/zoruui-domain/embedded-signup';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  CheckCircle2,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
  Search,
  RefreshCw,
  Phone,
} from 'lucide-react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Types & Interfaces                                                 */
/* ------------------------------------------------------------------ */

interface UnlockItem {
  icon: React.ElementType;
  label: string;
  description: string;
}

interface TrustItem {
  icon: React.ElementType;
  text: string;
}

interface StepItem {
  n: string;
  title: string;
  sub: string;
}

interface WabaAccount {
  id: string;
  name: string;
  phoneNumber: string;
  status: 'active' | 'pending' | 'disconnected';
  lastSynced: string;
}

interface ApiResponse<T> {
  data: T;
  error: string | null;
  status: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const UNLOCKS: UnlockItem[] = [
  { icon: Send, label: 'Bulk Broadcasts', description: 'Reach thousands with a single click' },
  { icon: MessageCircle, label: 'Live Chat Inbox', description: 'Reply to conversations in real-time' },
  { icon: Workflow, label: 'Flow Automation', description: 'Auto-reply & drip campaigns' },
  { icon: Users, label: 'Contact Management', description: 'Segments, tags & smart lists' },
  { icon: Bot, label: 'AI Chatbot', description: 'Handles queries 24/7' },
  { icon: Briefcase, label: 'CRM Integration', description: 'Leads, deals & pipeline' },
];

const TRUST: TrustItem[] = [
  { icon: ShieldCheck, text: 'Official Meta Partner — uses the secure Embedded Signup flow' },
  { icon: Lock, text: 'No passwords stored — access via OAuth token only' },
  { icon: BadgeCheck, text: 'Revoke access anytime from your Meta Business Settings' },
];

const STEPS: StepItem[] = [
  { n: '1', title: 'Click "Connect WhatsApp"', sub: 'Opens the official Meta authorization flow in a popup.' },
  { n: '2', title: 'Log in to Facebook', sub: 'Use the Facebook account linked to your Business portfolio.' },
  { n: '3', title: 'Select your WABA', sub: 'Choose an existing WhatsApp Business Account or create one.' },
  { n: '4', title: "You're live", sub: 'Return here — your project appears instantly.' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'disconnected', label: 'Disconnected' },
];

const SORT_OPTIONS = [
  { value: 'lastSynced', label: 'Last Synced' },
  { value: 'name', label: 'Name (A-Z)' },
];

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function SetupSkeleton() {
  return (
    <div className="pb-12 space-y-12">
      <div className="flex flex-col items-center justify-center space-y-4 pt-10">
        <Skeleton width={80} height={80} radius={24} />
        <Skeleton width={192} height={24} radius={9999} />
        <Skeleton width={384} height={40} />
        <Skeleton className="w-3/4 max-w-xl" height={24} />
        <Skeleton width={192} height={48} radius={9999} className="mt-4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2" height={384} radius={24} />
        <div className="flex flex-col gap-4">
          <Skeleton height={192} radius={24} />
          <Skeleton height={192} radius={24} />
          <Skeleton height={256} radius={24} />
        </div>
      </div>
    </div>
  );
}

function ConfigError() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Alert
        tone="danger"
        icon={AlertCircle}
        title="Configuration Missing"
        className="max-w-lg w-full"
      >
        <div className="space-y-2">
          <p>
            Add these env variables to your <code>.env</code> file:
          </p>
          <ul
            className="list-disc list-inside text-xs space-y-1 rounded-lg p-3"
            style={{
              fontFamily: 'var(--st-font-mono)',
              background: 'var(--st-bg-muted)',
            }}
          >
            <li>NEXT_PUBLIC_META_ONBOARDING_APP_ID</li>
            <li>NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</li>
          </ul>
        </div>
      </Alert>
    </div>
  );
}

function SetupModal({
  open,
  onClose,
  appId,
  configId,
  includeCatalog,
  setIncludeCatalog,
  checkboxId,
  description,
}: {
  open: boolean;
  onClose: () => void;
  appId: string;
  configId: string;
  includeCatalog: boolean;
  setIncludeCatalog: (val: boolean) => void;
  checkboxId: string;
  description: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Guided WhatsApp Setup" description={description} size="md">
      <div className="space-y-5">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: 'var(--st-text)' }}
        >
          <MessageCircle className="h-5 w-5" style={{ color: 'var(--st-text-inverted)' }} />
        </div>

        <EmbeddedSignup appId={appId} configId={configId} includeCatalog={includeCatalog} state="whatsapp" />

        <div
          className="flex items-start gap-3 rounded-xl p-3"
          style={{ border: '1px solid var(--st-border)', background: 'var(--st-bg-muted)' }}
        >
          <Checkbox
            id={checkboxId}
            checked={includeCatalog}
            onChange={(e) => setIncludeCatalog(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <label htmlFor={checkboxId} className="text-sm font-medium cursor-pointer">
              Include Catalog Management
            </label>
            <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>
              Grants permission to manage your WhatsApp product catalog
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {TRUST.slice(0, 2).map((t) => (
            <div key={t.text} className="flex items-center gap-2 text-xs" style={{ color: 'var(--st-text-muted)' }}>
              <t.icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--st-text)' }} />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function HeroSection({ appId, configId, includeCatalog, setIncludeCatalog }: { appId: string; configId: string; includeCatalog: boolean; setIncludeCatalog: (val: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-14 text-center space-y-5">
      <div className="relative mx-auto w-fit">
        <div
          className="absolute inset-0 rounded-3xl opacity-40 blur-xl scale-110"
          style={{ background: 'var(--st-bg-muted)' }}
        />
        <div
          className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: 'var(--st-text)', boxShadow: 'var(--st-shadow-lg)' }}
        >
          <MessageCircle className="h-10 w-10" style={{ color: 'var(--st-text-inverted)' }} />
        </div>
        <div
          className="absolute -right-1 -top-1 h-4 w-4 rounded-full shadow-lg"
          style={{ background: 'var(--st-bg-muted)' }}
        />
        <div
          className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full shadow-lg"
          style={{ background: 'var(--st-bg-muted)' }}
        />
      </div>

      <div className="flex justify-center">
        <Badge tone="neutral" kind="outline">
          <Sparkles className="mr-1.5 h-3 w-3" /> Official Meta Embedded Signup
        </Badge>
      </div>

      <p className="mx-auto max-w-xl text-lg leading-relaxed" style={{ color: 'var(--st-text-muted)' }}>
        Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard.
      </p>

      <div className="flex justify-center pt-2">
        <Button variant="primary" size="lg" iconLeft={MessageCircle} iconRight={ArrowRight} onClick={() => setOpen(true)}>
          Connect WhatsApp Account
        </Button>
      </div>

      <SetupModal
        open={open}
        onClose={() => setOpen(false)}
        appId={appId}
        configId={configId}
        includeCatalog={includeCatalog}
        setIncludeCatalog={setIncludeCatalog}
        checkboxId="include-catalog"
        description="You'll be redirected to Facebook to authorize access. It only takes a minute."
      />
    </div>
  );
}

function UnlocksSection() {
  return (
    <div
      className="lg:col-span-2 rounded-3xl p-6 md:p-8"
      style={{ border: '1px solid var(--st-border)', background: 'var(--st-surface)', boxShadow: 'var(--st-shadow-sm)' }}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: 'var(--st-text)' }}>
        What you unlock
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {UNLOCKS.map((u) => (
          <div
            key={u.label}
            className="group flex flex-col gap-2.5 rounded-2xl p-4 transition"
            style={{ border: '1px solid var(--st-border)', background: 'var(--st-surface)' }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{ background: 'var(--st-bg-muted)', color: 'var(--st-text)' }}
            >
              <u.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="font-semibold text-sm">{u.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>
                {u.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--st-border)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--st-text)' }}>
          How it works
        </p>
        <div className="space-y-0">
          {STEPS.map((s, idx) => (
            <div key={s.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--st-text)', color: 'var(--st-text-inverted)', boxShadow: 'var(--st-shadow-md)' }}
                >
                  {s.n}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="mt-1 mb-1 w-px flex-1" style={{ background: 'var(--st-border)', minHeight: 24 }} />
                )}
              </div>
              <div className="pb-5">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--st-text-muted)' }}>
                  {s.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RightPanel({ appId, configId, includeCatalog, setIncludeCatalog }: { appId: string; configId: string; includeCatalog: boolean; setIncludeCatalog: (val: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-3xl p-6"
        style={{ border: '1px solid var(--st-border)', background: 'var(--st-surface)', boxShadow: 'var(--st-shadow-sm)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--st-text)' }}>
          Security & Trust
        </p>
        <div className="space-y-4">
          {TRUST.map((t) => (
            <div key={t.text} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--st-bg-muted)', color: 'var(--st-text)' }}
              >
                <t.icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm leading-snug" style={{ color: 'var(--st-text-muted)' }}>
                {t.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-3xl p-6"
        style={{ border: '1px solid var(--st-border)', background: 'var(--st-surface)', boxShadow: 'var(--st-shadow-sm)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--st-text)' }}>
          Before you start
        </p>
        <ul className="space-y-3">
          {[
            'A Facebook account with admin access to your Business portfolio',
            'A verified Meta Business Account',
            'A phone number not already registered on WhatsApp personal',
          ].map((req) => (
            <li key={req} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--st-text-muted)' }}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--st-text)' }} />
              {req}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl p-6"
        style={{ border: '1px solid var(--st-border)', background: 'var(--st-text)', color: 'var(--st-text-inverted)', boxShadow: 'var(--st-shadow-lg)' }}
      >
        <div className="relative space-y-3">
          <Zap className="h-7 w-7" style={{ color: 'var(--st-text-tertiary)' }} />
          <p className="font-bold text-lg leading-snug">Ready to start reaching customers?</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Connect your account in under 2 minutes.
          </p>
          <Button
            block
            iconLeft={MessageCircle}
            onClick={() => setOpen(true)}
            className="mt-1"
            style={{ background: 'var(--st-text-inverted)', color: 'var(--st-text)' }}
          >
            Connect Now
          </Button>
          <SetupModal
            open={open}
            onClose={() => setOpen(false)}
            appId={appId}
            configId={configId}
            includeCatalog={includeCatalog}
            setIncludeCatalog={setIncludeCatalog}
            checkboxId="include-catalog-2"
            description="You'll be redirected to Facebook to authorize access."
          />
        </div>
      </div>
    </div>
  );
}

function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<WabaAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'lastSynced'>('lastSynced');

  useEffect(() => {
    // Simulate API fetch
    const fetchAccounts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response: ApiResponse<WabaAccount[]> = {
          data: [],
          error: null,
          status: 200,
        };
        if (response.error) throw new Error(response.error);
        setAccounts(response.data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch accounts');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const filteredAndSortedAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.phoneNumber.includes(searchQuery);
        const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return new Date(b.lastSynced).getTime() - new Date(a.lastSynced).getTime();
        }
      });
  }, [accounts, searchQuery, statusFilter, sortBy]);

  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAccounts([]);
      setIsLoading(false);
    }, 500);
  };

  return (
    <Card variant="elevated" padding="none" className="mt-16 mb-8 overflow-hidden">
      <CardHeader
        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--st-border)', background: 'var(--st-bg-muted)' }}
      >
        <div>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Manage your linked WhatsApp Business accounts.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          iconLeft={RefreshCw}
          loading={isLoading}
          onClick={refreshData}
        >
          Refresh
        </Button>
      </CardHeader>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Input
              iconLeft={Search}
              placeholder="Search by name or number..."
              aria-label="Search accounts by name or number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? 'all')}
              options={STATUS_OPTIONS}
              placeholder="Status"
              className="w-[140px]"
            />
            <Select
              aria-label="Sort accounts"
              value={sortBy}
              onChange={(val) => setSortBy((val as 'name' | 'lastSynced') ?? 'lastSynced')}
              options={SORT_OPTIONS}
              placeholder="Sort by"
              className="w-[140px]"
            />
          </div>
        </div>

        {error && (
          <Alert tone="danger" icon={AlertCircle} title="Error" className="mb-6">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="w-full" height={80} radius={12} />
            <Skeleton className="w-full" height={80} radius={12} />
          </div>
        ) : filteredAndSortedAccounts.length === 0 ? (
          <EmptyState icon={Phone} title="No accounts found matching your criteria." />
        ) : (
          <div className="space-y-3">
            {filteredAndSortedAccounts.map((account) => (
              <Card
                key={account.id}
                variant="outlined"
                padding="md"
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--st-bg-muted)', color: 'var(--st-text)' }}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--st-text-muted)', fontFamily: 'var(--st-font-mono)' }}>
                      {account.phoneNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium uppercase" style={{ color: 'var(--st-text-muted)' }}>
                      Last Synced
                    </p>
                    <p className="text-sm">{new Date(account.lastSynced).toLocaleString()}</p>
                  </div>
                  <Badge tone="neutral" kind="outline" className="capitalize">
                    {account.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Setup' },
];

export default function SetupPage() {
  const [mounted, setMounted] = useState(false);
  const [includeCatalog, setIncludeCatalog] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Connect Your WhatsApp Account"
        description="Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard."
      >
        <SetupSkeleton />
      </WachatPage>
    );
  }

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;

  if (!appId || !configId) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Connect Your WhatsApp Account"
        description="Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard."
      >
        <ConfigError />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Connect Your WhatsApp Account"
      description="Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard."
    >
      <HeroSection
        appId={appId}
        configId={configId}
        includeCatalog={includeCatalog}
        setIncludeCatalog={setIncludeCatalog}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <UnlocksSection />
        <RightPanel
          appId={appId}
          configId={configId}
          includeCatalog={includeCatalog}
          setIncludeCatalog={setIncludeCatalog}
        />
      </div>

      <ConnectedAccounts />
    </WachatPage>
  );
}
