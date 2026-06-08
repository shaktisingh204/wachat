'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Separator,
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
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  cn,
} from '@/components/sabcrm/20ui';
import {
  Check,
  X,
  History,
  Zap,
  Sparkles,
  Search,
  PackageSearch,
} from 'lucide-react';
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

export default function BillingPage() {
  const [isClient, setIsClient] = useState(false);
  const { sessionUser, activeProjectId } = useProject();
  const [plans, setPlans] = useState<WithId<Plan>[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filtering and Sorting State
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
    let filteredPlans = [...plans];

    // Apply Search Filter
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      filteredPlans = filteredPlans.filter((p) => p.name.toLowerCase().includes(lowerQuery));
    }

    // Apply Sorting
    filteredPlans.sort((a, b) => {
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

    const categories: Record<string, WithId<Plan>[]> = {
      'All-In-One': [],
      Wachat: [],
      CRM: [],
      'Meta Suite': [],
      'Instagram Suite': [],
      Email: [],
      SMS: [],
      'URL Shortener': [],
      'QR Code Generator': [],
    };

    filteredPlans.forEach((p) => {
      const categoryKey = p.appCategory || 'All-In-One';
      if (categories[categoryKey]) {
        categories[categoryKey].push(p);
      } else {
        categories['All-In-One'].push(p);
      }
    });

    return categories;
  }, [plans, searchQuery, sortBy]);

  const userPlanId = sessionUser?.plan?._id;

  if (!isClient || !sessionUser || isLoadingPlans) {
    return <BillingSkeleton />;
  }

  const noPlansFound = Object.entries(categorizedPlans).every(([, p]) => p.length === 0);

  return (
    <div className="20ui flex flex-col gap-10 w-full motion-safe:animate-slide-up">
      {/* Hero Header Area */}
      <PageHeader className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-8 md:p-10 border border-[var(--st-border)]">
        <PageHeaderHeading>
          <PageEyebrow className="inline-flex items-center gap-2">
            <Zap className="h-3 w-3" aria-hidden="true" /> Workspace Billing
          </PageEyebrow>
          <PageTitle>Billing &amp; Plans</PageTitle>
          <PageDescription>
            Manage your subscription, top up your wallet credits, and view your billing history in one place.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/dashboard/user/billing/history">
            <Button variant="outline" iconLeft={History}>
              View Billing History
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      {/* Payment Alerts */}
      {paymentStatus === 'success' && (
        <Alert tone="success" icon={null}>
          <AlertTitle>Payment successful</AlertTitle>
          <AlertDescription>
            Your payment has been processed successfully. Transaction ID:{' '}
            <span className="font-mono rounded bg-[var(--st-bg-secondary)] px-1">{paymentTxn}</span>
          </AlertDescription>
        </Alert>
      )}
      {paymentStatus === 'failed' && (
        <Alert tone="danger">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            We could not process your payment. No funds were deducted. Please try again or contact support.
          </AlertDescription>
        </Alert>
      )}
      {fetchError && (
        <Alert tone="danger">
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {/* Current Plan & Wallet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <Card variant="elevated" padding="none" className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] p-6">
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-[var(--st-text)]" aria-hidden="true" />
                Your Current Plan:
                <Badge tone="accent">{sessionUser?.plan?.name || 'Free'}</Badge>
              </CardTitle>
              <CardDescription>
                Here is what is included in your active workspace subscription.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                {planFeatureMap.map((feature) => {
                  const isAllowed =
                    sessionUser?.plan?.features?.[
                      feature.id as keyof typeof sessionUser.plan.features
                    ] ?? true;
                  return (
                    <div key={feature.id} className="flex items-start gap-3">
                      {isAllowed ? (
                        <div className="mt-0.5 rounded-full bg-[var(--st-status-ok)]/10 p-1">
                          <Check
                            className="h-3.5 w-3.5 text-[var(--st-status-ok)] flex-shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                      ) : (
                        <div className="mt-0.5 rounded-full bg-[var(--st-bg-secondary)] p-1">
                          <X
                            className="h-3.5 w-3.5 text-[var(--st-text-secondary)] flex-shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                      <span
                        className={cn(
                          'text-sm font-medium text-[var(--st-text)]',
                          !isAllowed &&
                            'text-[var(--st-text-tertiary)] line-through decoration-[var(--st-border-strong)]',
                        )}
                      >
                        {feature.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-4 flex flex-col h-full">
          <div className="flex-1">
            <WalletCard user={sessionUser} />
          </div>
        </div>
      </div>

      <Separator className="my-4 opacity-50" />

      {/* Pricing Tiers with Filters */}
      <div id="upgrade" className="space-y-12 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-[var(--st-text)]">
              Upgrade Your Workspace
            </h2>
            <p className="text-[var(--st-text-secondary)]">
              Find the perfect plan for your business needs. Scale seamlessly as you grow.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <Field className="w-full sm:w-[200px]">
              <Input
                aria-label="Search plans"
                placeholder="Search plans..."
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
          />
        ) : (
          <>
            <PlanCategorySection
              title="All-In-One Plans"
              plans={categorizedPlans['All-In-One']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="Wachat Suite Plans"
              plans={categorizedPlans['Wachat']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="CRM Suite Plans"
              plans={categorizedPlans['CRM']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="Meta Suite Plans"
              plans={categorizedPlans['Meta Suite']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="Instagram Suite Plans"
              plans={categorizedPlans['Instagram Suite']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="Email Suite Plans"
              plans={categorizedPlans['Email']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="SMS Suite Plans"
              plans={categorizedPlans['SMS']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="URL Shortener Plans"
              plans={categorizedPlans['URL Shortener']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
            <PlanCategorySection
              title="QR Code Generator Plans"
              plans={categorizedPlans['QR Code Generator']}
              currentPlanId={userPlanId?.toString()}
              projectId={activeProjectId}
            />
          </>
        )}
      </div>
    </div>
  );
}
