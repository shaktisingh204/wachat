'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
  Input,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  EmptyState,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  History,
  Search,
  PackageSearch,
  Crown,
  Wallet,
  Coins,
  ShieldCheck,
  Layers,
  MessageCircle,
  Mail,
  Smartphone,
  Link2,
  QrCode,
  Boxes,
  Instagram,
  Megaphone,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPlans } from '@/app/actions/plan.actions';
import {
  PlanFeatureGroups,
  getVisiblePlanFeatureGroups,
} from '@/components/20ui-domain/plan-feature-groups';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Plan, WithId } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WalletCard } from '@/components/20ui-domain/wallet-card';

import { PlanCategorySection } from './components/plan-category-section';
import { BillingSkeleton } from './components/billing-skeleton';

const CATEGORY_ORDER: { key: string; title: string; icon: LucideIcon }[] = [
  { key: 'All-In-One', title: 'All-In-One Plans', icon: Boxes },
  { key: 'Wachat', title: 'Wachat Suite', icon: MessageCircle },
  { key: 'CRM', title: 'CRM Suite', icon: Layers },
  { key: 'Meta Suite', title: 'Meta Suite', icon: Megaphone },
  { key: 'Instagram Suite', title: 'Instagram Suite', icon: Instagram },
  { key: 'Email', title: 'Email Suite', icon: Mail },
  { key: 'SMS', title: 'SMS Suite', icon: Smartphone },
  { key: 'URL Shortener', title: 'URL Shortener', icon: Link2 },
  { key: 'QR Code Generator', title: 'QR Code Generator', icon: QrCode },
];

export default function BillingPage() {
  const [isClient, setIsClient] = useState(false);
  const { sessionUser, activeProjectId } = useProject();
  const [plans, setPlans] = useState<WithId<Plan>[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('price-asc');

  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const paymentTxn = searchParams.get('txn');

  useEffect(() => {
    setIsClient(true);
    document.title = 'Billing & Plans | SabNode';
    const fetchData = async () => {
      setIsLoadingPlans(true);
      setFetchError(null);
      try {
        const plansData = await getPlans({ isPublic: true });
        setPlans(plansData);
      } catch (error) {
        console.error('Error fetching plans:', error);
        setFetchError('Failed to load plans. Please try again later.');
      } finally {
        setIsLoadingPlans(false);
      }
    };
    fetchData();
  }, []);

  const categorizedPlans = useMemo(() => {
    let filtered = [...plans];

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return (a.price || 0) - (b.price || 0);
        case 'price-desc':
          return (b.price || 0) - (a.price || 0);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    const categories: Record<string, WithId<Plan>[]> = Object.fromEntries(
      CATEGORY_ORDER.map((c) => [c.key, [] as WithId<Plan>[]]),
    );

    filtered.forEach((p) => {
      const key = p.appCategory && categories[p.appCategory] ? p.appCategory : 'All-In-One';
      categories[key].push(p);
    });

    return categories;
  }, [plans, searchQuery, sortBy]);

  const userPlanId = sessionUser?.plan?._id;

  // Pick a single tasteful "Popular" pick: the flagship (highest-priced)
  // All-In-One plan, so exactly one card gets the recommended accent.
  const popularPlanId = useMemo(() => {
    const flagship = [...plans]
      .filter((p) => (p.appCategory ?? 'All-In-One') === 'All-In-One' && (p.price ?? 0) > 0)
      .sort((a, b) => (b.price || 0) - (a.price || 0))[0];
    return flagship?._id?.toString();
  }, [plans]);

  // Hero usage stats — wallet + credits (representative metrics).
  const walletCurrency = sessionUser?.wallet?.currency || 'INR';
  const walletBalance = (sessionUser?.wallet?.balance ?? 0) / 100;
  const walletDisplay = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: walletCurrency,
        maximumFractionDigits: 0,
      }).format(walletBalance),
    [walletBalance, walletCurrency],
  );
  const totalCredits = useMemo(() => {
    const c = sessionUser?.credits;
    if (!c) return 0;
    return (c.broadcast || 0) + (c.sms || 0) + (c.meta || 0) + (c.email || 0) + (c.seo || 0);
  }, [sessionUser?.credits]);

  // "X of Y features included" headline over the user-visible (non-hidden) groups.
  const featureSummary = useMemo(() => {
    const planFeatures = sessionUser?.plan?.features as
      | Record<string, boolean | undefined>
      | undefined;
    const visible = getVisiblePlanFeatureGroups().flatMap((g) => g.features);
    const included = visible.filter((f) => planFeatures?.[f.id] ?? true).length;
    return { included, total: visible.length };
  }, [sessionUser?.plan?.features]);

  if (!isClient || !sessionUser || isLoadingPlans) {
    return <BillingSkeleton />;
  }

  const noPlansFound = CATEGORY_ORDER.every((c) => categorizedPlans[c.key].length === 0);

  return (
    <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-[var(--st-space-7)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Billing &amp; Plans</PageTitle>
          <PageDescription>
            Manage your subscription, top up wallet credits, and review your billing history.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <a href="#upgrade">
            <Button variant="primary" iconLeft={Sparkles}>
              Upgrade plan
            </Button>
          </a>
          <Link href="/dashboard/user/billing/history">
            <Button variant="outline" iconLeft={History}>
              Billing history
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      {paymentStatus === 'success' && (
        <Alert tone="success">
          <AlertTitle>Payment successful</AlertTitle>
          <AlertDescription>
            Your payment has been processed.
            {paymentTxn ? (
              <>
                {' '}Transaction ID:{' '}
                <span className="font-mono rounded bg-[var(--st-bg-secondary)] px-1">{paymentTxn}</span>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      )}
      {paymentStatus === 'failed' && (
        <Alert tone="danger">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            We could not process your payment. No funds were deducted — please try again or contact support.
          </AlertDescription>
        </Alert>
      )}
      {fetchError && (
        <Alert tone="danger">
          <AlertTitle>Failed to load plans</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {/* Hero: current plan + usage at a glance */}
      <section aria-label="Account summary" className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard
          icon={Crown}
          label="Current plan"
          value={sessionUser?.plan?.name || 'Free'}
        />
        <StatCard
          icon={Wallet}
          label="Wallet balance"
          value={walletDisplay}
        />
        <StatCard
          icon={Coins}
          label="Available credits"
          value={<span className="tabular-nums">{totalCredits.toLocaleString('en-IN')}</span>}
        />
      </section>

      {/* Plan details + top-up */}
      <div className="grid grid-cols-1 gap-[var(--st-space-5)] lg:grid-cols-12">
        <Card variant="outlined" padding="none" className="flex flex-col overflow-hidden lg:col-span-7">
          <CardHeader className="border-b border-[var(--st-border)]">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
              Plan features
              <Badge tone="accent">{sessionUser?.plan?.name || 'Free'}</Badge>
            </CardTitle>
            <CardDescription>
              {featureSummary.included === featureSummary.total
                ? `All ${featureSummary.total} features included in your active subscription.`
                : `${featureSummary.included} of ${featureSummary.total} features included in your active subscription.`}
            </CardDescription>
          </CardHeader>
          <CardBody className="pt-0">
            <PlanFeatureGroups features={sessionUser?.plan?.features} />
          </CardBody>
        </Card>

        <div className="lg:col-span-5">
          <WalletCard user={sessionUser} />
        </div>
      </div>

      <Separator />

      {/* Plan catalog */}
      <section id="upgrade" className="flex flex-col gap-[var(--st-space-5)] scroll-mt-6">
        <div className="flex flex-col gap-[var(--st-space-3)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
              Upgrade your workspace
            </h2>
            <p className="text-sm text-[var(--st-text-secondary)]">
              Pick a plan that fits your needs and scale as you grow.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Field label="Search plans" className="w-full sm:w-[200px] [&_.u-field__label]:sr-only">
              <Input
                placeholder="Search plans…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                iconLeft={Search}
              />
            </Field>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort plans" className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="name-asc">Name: A to Z</SelectItem>
                <SelectItem value="name-desc">Name: Z to A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {noPlansFound ? (
          <EmptyState
            icon={PackageSearch}
            title="No plans found"
            description={
              searchQuery
                ? 'No plans match your search. Try a different term or clear the filter.'
                : 'No plans are available right now. Check back soon.'
            }
            action={
              searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          CATEGORY_ORDER.map((c) => (
            <PlanCategorySection
              key={c.key}
              title={c.title}
              icon={c.icon}
              plans={categorizedPlans[c.key]}
              currentPlanId={userPlanId?.toString()}
              popularPlanId={popularPlanId}
              projectId={activeProjectId}
            />
          ))
        )}
      </section>
    </div>
  );
}
