'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
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
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  cn,
} from '@/components/sabcrm/20ui';
import { Check, X, History, Search, PackageSearch } from 'lucide-react';
import { getPlans } from '@/app/actions/plan.actions';
import { planFeatureMap } from '@/lib/plans';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Plan, WithId } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WalletCard } from '@/components/20ui-domain/wallet-card';

import { PlanCategorySection } from './components/plan-category-section';
import { BillingSkeleton } from './components/billing-skeleton';

const CATEGORY_ORDER: { key: string; title: string }[] = [
  { key: 'All-In-One', title: 'All-In-One Plans' },
  { key: 'Wachat', title: 'Wachat Suite' },
  { key: 'CRM', title: 'CRM Suite' },
  { key: 'Meta Suite', title: 'Meta Suite' },
  { key: 'Instagram Suite', title: 'Instagram Suite' },
  { key: 'Email', title: 'Email Suite' },
  { key: 'SMS', title: 'SMS Suite' },
  { key: 'URL Shortener', title: 'URL Shortener' },
  { key: 'QR Code Generator', title: 'QR Code Generator' },
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

  if (!isClient || !sessionUser || isLoadingPlans) {
    return <BillingSkeleton />;
  }

  const noPlansFound = CATEGORY_ORDER.every((c) => categorizedPlans[c.key].length === 0);

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-7)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Billing &amp; Plans</PageTitle>
          <PageDescription>
            Manage your subscription, top up wallet credits, and review your billing history.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
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

      {/* Current plan + wallet */}
      <div className="grid grid-cols-1 gap-[var(--st-space-5)] lg:grid-cols-12">
        <Card variant="outlined" padding="none" className="lg:col-span-8 flex flex-col overflow-hidden">
          <CardHeader className="border-b border-[var(--st-border)]">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Current plan
              <Badge tone="accent">{sessionUser?.plan?.name || 'Free'}</Badge>
            </CardTitle>
            <CardDescription>What is included in your active subscription.</CardDescription>
          </CardHeader>
          <CardBody>
            <ul className="grid grid-cols-1 gap-x-[var(--st-space-6)] gap-y-[var(--st-space-3)] sm:grid-cols-2">
              {planFeatureMap.map((feature) => {
                const isAllowed =
                  sessionUser?.plan?.features?.[
                    feature.id as keyof typeof sessionUser.plan.features
                  ] ?? true;
                return (
                  <li key={feature.id} className="flex items-center gap-2">
                    {isAllowed ? (
                      <Check
                        className="h-4 w-4 flex-shrink-0 text-[var(--st-status-ok)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <X
                        className="h-4 w-4 flex-shrink-0 text-[var(--st-text-tertiary)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        'text-sm text-[var(--st-text)]',
                        !isAllowed && 'text-[var(--st-text-tertiary)] line-through',
                      )}
                    >
                      {feature.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <div className="lg:col-span-4">
          <WalletCard user={sessionUser} />
        </div>
      </div>

      {/* Plans */}
      <section id="upgrade" className="flex flex-col gap-[var(--st-space-5)]">
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
            description="No plans match your search. Try a different term or clear the filter."
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
              plans={categorizedPlans[c.key]}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
          ))
        )}
      </section>
    </div>
  );
}
