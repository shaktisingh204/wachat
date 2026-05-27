'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Checkbox,
  Label,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Badge,
  Skeleton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/zoruui';
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
import { cn } from '@/lib/utils';

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

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function SetupSkeleton() {
  return (
    <div className="mx-auto max-w-6xl pb-12 space-y-12">
      <div className="flex flex-col items-center justify-center space-y-4 pt-10">
        <Skeleton className="h-20 w-20 rounded-3xl" />
        <Skeleton className="h-6 w-48 rounded-full" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-6 w-3/4 max-w-xl" />
        <Skeleton className="h-12 w-48 rounded-full mt-4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-96 rounded-3xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

function ConfigError() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Alert variant="destructive" className="max-w-lg w-full rounded-2xl">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Configuration Missing</ZoruAlertTitle>
        <ZoruAlertDescription className="space-y-2 mt-2">
          <p>Add these env variables to your <code>.env</code> file:</p>
          <ul className="list-disc list-inside text-xs space-y-1 font-mono bg-destructive/10 rounded-lg p-3">
            <li>NEXT_PUBLIC_META_ONBOARDING_APP_ID</li>
            <li>NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</li>
          </ul>
        </ZoruAlertDescription>
      </Alert>
    </div>
  );
}

function HeroSection({ appId, configId, includeCatalog, setIncludeCatalog }: { appId: string; configId: string; includeCatalog: boolean; setIncludeCatalog: (val: boolean) => void }) {
  return (
    <div className="mb-14 text-center space-y-5">
      <div className="relative mx-auto w-fit">
        <div className="absolute inset-0 rounded-3xl bg-emerald-200 opacity-40 blur-xl scale-110" />
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-[0_8px_32px_rgba(5,150,105,0.28)]">
          <MessageCircle className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-lime-400 shadow-lg shadow-lime-400/50" />
        <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-teal-400 shadow-lg" />
      </div>

      <Badge className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-1 text-xs font-semibold hover:bg-emerald-100">
        <Sparkles className="mr-1.5 h-3 w-3" /> Official Meta Embedded Signup
      </Badge>

      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        Connect Your <span className="text-emerald-700">WhatsApp Account</span>
      </h1>

      <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
        Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard.
      </p>

      <Dialog>
        <ZoruDialogTrigger asChild>
          <Button size="lg" className="rounded-full px-10 text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.03] transition-all mt-2">
            <MessageCircle className="mr-2 h-5 w-5" />
            Connect WhatsApp Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </ZoruDialogTrigger>
        <ZoruDialogContent className="sm:max-w-md rounded-3xl border-emerald-200/40">
          <ZoruDialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <ZoruDialogTitle className="text-lg">Guided WhatsApp Setup</ZoruDialogTitle>
            <ZoruDialogDescription>
              You'll be redirected to Facebook to authorize access. It only takes a minute.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="py-4 space-y-5">
            <EmbeddedSignup
              appId={appId}
              configId={configId}
              includeCatalog={includeCatalog}
              state="whatsapp"
            />

            <div className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3">
              <Checkbox
                id="include-catalog"
                checked={includeCatalog}
                onCheckedChange={(c) => setIncludeCatalog(Boolean(c))}
                className="mt-0.5 border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <div>
                <Label htmlFor="include-catalog" className="text-sm font-medium cursor-pointer">
                  Include Catalog Management
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Grants permission to manage your WhatsApp product catalog
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {TRUST.slice(0, 2).map((t) => (
                <div key={t.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <t.icon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  {t.text}
                </div>
              ))}
            </div>
          </div>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

function UnlocksSection() {
  return (
    <div className="lg:col-span-2 rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-6">What you unlock</p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {UNLOCKS.map((u) => (
          <div key={u.label} className="group flex flex-col gap-2.5 rounded-2xl border border-emerald-100/60 bg-white p-4 transition hover:shadow-md hover:border-emerald-200">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <u.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="font-semibold text-sm">{u.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{u.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-emerald-100/60">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-5">How it works</p>
        <div className="space-y-0">
          {STEPS.map((s, idx) => (
            <div key={s.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-md shadow-emerald-500/25">
                  {s.n}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="mt-1 mb-1 w-px flex-1 bg-emerald-200" style={{ minHeight: 24 }} />
                )}
              </div>
              <div className="pb-5">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RightPanel({ appId, configId, includeCatalog, setIncludeCatalog }: { appId: string; configId: string; includeCatalog: boolean; setIncludeCatalog: (val: boolean) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-4">Security & Trust</p>
        <div className="space-y-4">
          {TRUST.map((t) => (
            <div key={t.text} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <t.icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{t.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-4">Before you start</p>
        <ul className="space-y-3">
          {[
            'A Facebook account with admin access to your Business portfolio',
            'A verified Meta Business Account',
            'A phone number not already registered on WhatsApp personal',
          ].map((req) => (
            <li key={req} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {req}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-700 bg-emerald-700 p-6 text-white shadow-xl shadow-emerald-500/25">
        <div className="relative space-y-3">
          <Zap className="h-7 w-7 text-lime-300" />
          <p className="font-bold text-lg leading-snug">Ready to start reaching customers?</p>
          <p className="text-sm text-white/90">Connect your account in under 2 minutes.</p>
          <Dialog>
            <ZoruDialogTrigger asChild>
              <Button className="w-full rounded-xl bg-white text-emerald-700 hover:bg-white/90 font-semibold shadow-lg mt-1">
                <MessageCircle className="mr-2 h-4 w-4" />
                Connect Now
              </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md rounded-3xl border-emerald-200/40">
              <ZoruDialogHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <ZoruDialogTitle className="text-lg">Guided WhatsApp Setup</ZoruDialogTitle>
                <ZoruDialogDescription>
                  You'll be redirected to Facebook to authorize access.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <div className="py-4 space-y-5">
                <EmbeddedSignup
                  appId={appId}
                  configId={configId}
                  includeCatalog={includeCatalog}
                  state="whatsapp"
                />
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3">
                  <Checkbox
                    id="include-catalog-2"
                    checked={includeCatalog}
                    onCheckedChange={(c) => setIncludeCatalog(Boolean(c))}
                    className="mt-0.5 border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div>
                    <Label htmlFor="include-catalog-2" className="text-sm font-medium cursor-pointer">
                      Include Catalog Management
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Grants permission to manage your WhatsApp product catalog
                    </p>
                  </div>
                </div>
              </div>
            </ZoruDialogContent>
          </Dialog>
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
    <div className="mt-16 mb-8 rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your linked WhatsApp Business accounts.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(val: 'name' | 'lastSynced') => setSortBy(val)}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastSynced">Last Synced</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>Error</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : filteredAndSortedAccounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Phone className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p>No accounts found matching your criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    account.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    account.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  )}>
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-sm text-muted-foreground font-mono mt-0.5">{account.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Last Synced</p>
                    <p className="text-sm">{new Date(account.lastSynced).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "px-2.5 py-0.5 capitalize font-medium",
                    account.status === 'active' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                    account.status === 'pending' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                    'border-rose-200 text-rose-700 bg-rose-50'
                  )}>
                    {account.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function SetupPage() {
  const [mounted, setMounted] = useState(false);
  const [includeCatalog, setIncludeCatalog] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SetupSkeleton />;
  }

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;

  if (!appId || !configId) {
    return <ConfigError />;
  }

  return (
    <div className="relative">
      <div className="mx-auto max-w-6xl pb-12">
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
      </div>
    </div>
  );
}
