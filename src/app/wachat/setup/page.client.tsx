'use client';

import {
  Alert,
  Button,
  Badge,
  Skeleton,
  Input,
  Modal,
  SelectField,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useState, useEffect, useMemo } from 'react';
import EmbeddedSignup from '@/components/20ui-domain/embedded-signup';
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
  ShoppingBag,
  Check,
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
          <ul className="list-disc list-inside text-xs space-y-1 rounded-lg p-3 font-mono bg-[var(--st-bg-muted)]">
            <li>NEXT_PUBLIC_META_ONBOARDING_APP_ID</li>
            <li>NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</li>
          </ul>
        </div>
      </Alert>
    </div>
  );
}

/**
 * Looping preview for the "Without Catalog" option: a small chat exchange
 * where bubbles pop in one after another. Decorative only.
 */
function ChatAnimPreview() {
  return (
    <div
      aria-hidden="true"
      className="flex h-16 flex-col justify-center gap-1.5 rounded-lg px-3 bg-[var(--st-bg-muted)] overflow-hidden"
    >
      <div className="st-cm-pop st-cm-d0 h-3 w-20 rounded-full rounded-bl-sm bg-[var(--st-border)]" />
      <div className="st-cm-pop st-cm-d1 ml-auto h-3 w-24 rounded-full rounded-br-sm bg-[var(--st-text)]" />
      <div className="st-cm-pop st-cm-d2 h-3 w-14 rounded-full rounded-bl-sm bg-[var(--st-border)]" />
    </div>
  );
}

/**
 * Looping preview for the "With Catalog" option: product tiles pop in and
 * a bag badge lands on the first one. Decorative only.
 */
function CatalogAnimPreview() {
  return (
    <div
      aria-hidden="true"
      className="flex h-16 items-center justify-center gap-2 rounded-lg px-3 bg-[var(--st-bg-muted)] overflow-hidden"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cx('st-cm-pop relative w-12 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1', `st-cm-d${i}`)}
        >
          {i === 0 && (
            <span className="st-cm-pop st-cm-d3 absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-text)]">
              <ShoppingBag className="h-2.5 w-2.5 text-[var(--st-text-inverted)]" />
            </span>
          )}
          <div className="h-5 rounded-sm bg-[var(--st-border)]" />
          <div className="mt-1 h-1.5 w-3/4 rounded-full bg-[var(--st-border)]" />
          <div className="mt-1 h-1.5 w-1/2 rounded-full bg-[var(--st-border)]" />
        </div>
      ))}
    </div>
  );
}

const CATALOG_MODES = [
  {
    includeCatalog: false,
    title: 'Without Catalog',
    description: 'Inbox, broadcasts, automations and chatbots.',
    Preview: ChatAnimPreview,
  },
  {
    includeCatalog: true,
    title: 'With Catalog',
    description: 'Everything in messaging, plus product catalog management.',
    Preview: CatalogAnimPreview,
  },
];

function CatalogModeSelector({
  includeCatalog,
  setIncludeCatalog,
  idPrefix,
}: {
  includeCatalog: boolean;
  setIncludeCatalog: (val: boolean) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 text-sm font-medium">Choose what to connect</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATALOG_MODES.map((mode) => {
          const id = `${idPrefix}-${mode.includeCatalog ? 'with' : 'without'}-catalog`;
          const selected = includeCatalog === mode.includeCatalog;
          return (
            <label
              key={id}
              htmlFor={id}
              className={cx(
                'relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3',
                'transition-[border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--st-text)] has-[:focus-visible]:ring-offset-2',
                selected
                  ? 'border-[var(--st-text)] shadow-[var(--st-shadow-md)]'
                  : 'border-[var(--st-border)] hover:border-[var(--st-text-muted)]',
              )}
            >
              <input
                type="radio"
                id={id}
                name={`${idPrefix}-catalog-mode`}
                className="sr-only"
                checked={selected}
                onChange={() => setIncludeCatalog(mode.includeCatalog)}
              />
              <span
                aria-hidden="true"
                className={cx(
                  'absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-[background-color,opacity] duration-150 ease-out',
                  selected
                    ? 'bg-[var(--st-text)] opacity-100'
                    : 'border border-[var(--st-border)] bg-[var(--st-bg)] opacity-70',
                )}
              >
                {selected && <Check className="h-3 w-3 text-[var(--st-text-inverted)]" />}
              </span>
              <mode.Preview />
              <span>
                <span className="block text-sm font-semibold">{mode.title}</span>
                <span className="mt-0.5 block text-xs text-[var(--st-text-muted)]">{mode.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {/* Previews render their final (fully visible) state by default; the
          loop only runs when the user allows motion. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .st-cm-pop {
            animation: st-cm-pop 5.4s cubic-bezier(0.23, 1, 0.32, 1) infinite both;
          }
          .st-cm-d0 { animation-delay: 0s; }
          .st-cm-d1 { animation-delay: 0.7s; }
          .st-cm-d2 { animation-delay: 1.4s; }
          .st-cm-d3 { animation-delay: 2.1s; }
        }
        @keyframes st-cm-pop {
          0% { opacity: 0; transform: translateY(5px) scale(0.96); }
          8%, 80% { opacity: 1; transform: translateY(0) scale(1); }
          90%, 100% { opacity: 0; transform: translateY(0) scale(1); }
        }
      `}</style>
    </fieldset>
  );
}

function SetupModal({
  open,
  onClose,
  appId,
  configId,
  includeCatalog,
  setIncludeCatalog,
  idPrefix,
  description,
}: {
  open: boolean;
  onClose: () => void;
  appId: string;
  configId: string;
  includeCatalog: boolean;
  setIncludeCatalog: (val: boolean) => void;
  idPrefix: string;
  description: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Guided WhatsApp Setup" description={description} size="md">
      <div className="space-y-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--st-text)]">
          <MessageCircle className="h-5 w-5 text-[var(--st-text-inverted)]" />
        </div>

        <CatalogModeSelector
          includeCatalog={includeCatalog}
          setIncludeCatalog={setIncludeCatalog}
          idPrefix={idPrefix}
        />

        <EmbeddedSignup appId={appId} configId={configId} includeCatalog={includeCatalog} state="whatsapp" />

        <div className="space-y-2">
          {TRUST.slice(0, 2).map((t) => (
            <div key={t.text} className="flex items-center gap-2 text-xs text-[var(--st-text-muted)]">
              <t.icon className="h-3.5 w-3.5 shrink-0 text-[var(--st-text)]" />
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
        <div className="absolute inset-0 rounded-3xl opacity-40 blur-xl scale-110 bg-[var(--st-bg-muted)]" />
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--st-text)] shadow-[var(--st-shadow-lg)]">
          <MessageCircle className="h-10 w-10 text-[var(--st-text-inverted)]" />
        </div>
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full shadow-lg bg-[var(--st-bg-muted)]" />
        <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full shadow-lg bg-[var(--st-bg-muted)]" />
      </div>

      <div className="flex justify-center">
        <Badge tone="neutral" kind="outline">
          <Sparkles className="mr-1.5 h-3 w-3" /> Official Meta Embedded Signup
        </Badge>
      </div>

      <p className="mx-auto max-w-xl text-lg leading-relaxed text-[var(--st-text-muted)]">
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
        idPrefix="setup-hero"
        description="You'll be redirected to Facebook to authorize access. It only takes a minute."
      />
    </div>
  );
}

function UnlocksSection() {
  return (
    <Card variant="elevated" padding="lg" className="lg:col-span-2 md:p-8">
      <p className="text-xs font-bold uppercase tracking-widest mb-6 text-[var(--st-text)]">
        What you unlock
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {UNLOCKS.map((u) => (
          <Card
            key={u.label}
            variant="outlined"
            padding="md"
            className="group flex flex-col gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <u.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="font-semibold text-sm">{u.label}</p>
              <p className="text-xs mt-0.5 text-[var(--st-text-muted)]">
                {u.description}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--st-border)]">
        <p className="text-xs font-bold uppercase tracking-widest mb-5 text-[var(--st-text)]">
          How it works
        </p>
        <div className="space-y-0">
          {STEPS.map((s, idx) => (
            <div key={s.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-[var(--st-text)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-md)]">
                  {s.n}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="mt-1 mb-1 w-px flex-1 bg-[var(--st-border)]" style={{ minHeight: 24 }} />
                )}
              </div>
              <div className="pb-5">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs mt-0.5 text-[var(--st-text-muted)]">
                  {s.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RightPanel({ appId, configId, includeCatalog, setIncludeCatalog }: { appId: string; configId: string; includeCatalog: boolean; setIncludeCatalog: (val: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Card variant="elevated" padding="md">
        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--st-text)]">
          Security & Trust
        </p>
        <div className="space-y-4">
          {TRUST.map((t) => (
            <div key={t.text} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <t.icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm leading-snug text-[var(--st-text-muted)]">
                {t.text}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="elevated" padding="md">
        <p className="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--st-text)]">
          Before you start
        </p>
        <ul className="space-y-3">
          {[
            'A Facebook account with admin access to your Business portfolio',
            'A verified Meta Business Account',
            'A phone number not already registered on WhatsApp personal',
          ].map((req) => (
            <li key={req} className="flex items-start gap-2.5 text-sm text-[var(--st-text-muted)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-text)]" />
              {req}
            </li>
          ))}
        </ul>
      </Card>

      <Card variant="elevated" padding="none" className="relative overflow-hidden rounded-3xl p-6 bg-[var(--st-text)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-lg)]">
        <div className="relative space-y-3">
          <Zap className="h-7 w-7 text-[var(--st-text-tertiary)]" />
          <p className="font-bold text-lg leading-snug">Ready to start reaching customers?</p>
          <p className="text-sm text-white/90">
            Connect your account in under 2 minutes.
          </p>
          <Button
            block
            iconLeft={MessageCircle}
            onClick={() => setOpen(true)}
            className="mt-1 bg-[var(--st-text-inverted)] text-[var(--st-text)]"
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
            idPrefix="setup-cta"
            description="You'll be redirected to Facebook to authorize access."
          />
        </div>
      </Card>
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
      <CardHeader className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
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
            <SelectField
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? 'all')}
              options={STATUS_OPTIONS}
              placeholder="Status"
              className="w-[140px]"
            />
            <SelectField
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-sm mt-0.5 font-mono text-[var(--st-text-muted)]">
                      {account.phoneNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium uppercase text-[var(--st-text-muted)]">
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
