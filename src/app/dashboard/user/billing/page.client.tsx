'use client';

import {
  ZoruCard,
  ZoruButton,
  ZoruSeparator,
  ZoruAlert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  ZoruInput,
  ZoruSelect,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
} from '@/components/zoruui';
import {
  Check,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlans } from '@/app/actions/plan.actions';
import { planFeatureMap } from '@/lib/plans';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Plan, WithId } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WalletCard } from '@/components/zoruui-domain/wallet-card';
import { motion, AnimatePresence } from 'framer-motion';

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
        console.error("Error fetching plans:", error);
        setFetchError("Failed to load plans. Please try again later.");
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
      filteredPlans = filteredPlans.filter(p => p.name.toLowerCase().includes(lowerQuery));
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
      'Wachat': [],
      'CRM': [],
      'Meta Suite': [],
      'Instagram Suite': [],
      'Email': [],
      'SMS': [],
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-10 w-full"
    >
      {/* Hero Header Area */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-zoru-surface-2 p-8 md:p-10 border border-zoru-line shadow-sm">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-zoru-primary/5 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-zoru-info/10 blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-zoru-bg px-3 py-1 text-xs font-semibold text-zoru-primary border border-zoru-line shadow-sm mb-4">
              <Zap className="h-3 w-3" /> Workspace Billing
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zoru-ink mb-3">
              Billing & Plans
            </h1>
            <p className="text-lg text-zoru-ink-muted max-w-xl">
              Manage your subscription, top up your wallet credits, and view your billing history in one place.
            </p>
          </div>
          <ZoruButton asChild variant="outline" className="bg-zoru-bg shadow-sm">
            <Link href="/dashboard/user/billing/history">
              <History className="mr-2 h-4 w-4" />
              View Billing History
            </Link>
          </ZoruButton>
        </div>
      </motion.div>

      {/* Payment Alerts */}
      <AnimatePresence>
        {paymentStatus === 'success' && (
          <motion.div variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <ZoruAlert className="bg-zoru-success/10 border-zoru-success/20 text-zoru-success-ink">
              <CheckCircle2 className="h-5 w-5 text-zoru-success" />
              <ZoruAlertTitle className="text-zoru-success-ink font-bold">Payment successful</ZoruAlertTitle>
              <ZoruAlertDescription>
                Your payment has been processed successfully. Transaction ID: <span className="font-mono bg-white/50 px-1 rounded">{paymentTxn}</span>
              </ZoruAlertDescription>
            </ZoruAlert>
          </motion.div>
        )}
        {paymentStatus === 'failed' && (
          <motion.div variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <ZoruAlert variant="destructive" className="bg-zoru-danger/10 border-zoru-danger/20 text-zoru-danger-ink">
              <AlertCircle className="h-5 w-5 text-zoru-danger" />
              <ZoruAlertTitle className="text-zoru-danger-ink font-bold">Payment failed</ZoruAlertTitle>
              <ZoruAlertDescription>
                We couldn't process your payment. No funds were deducted. Please try again or contact support.
              </ZoruAlertDescription>
            </ZoruAlert>
          </motion.div>
        )}
        {fetchError && (
          <motion.div variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <ZoruAlert variant="destructive" className="bg-zoru-danger/10 border-zoru-danger/20 text-zoru-danger-ink">
              <AlertCircle className="h-5 w-5 text-zoru-danger" />
              <ZoruAlertTitle className="text-zoru-danger-ink font-bold">Failed to load</ZoruAlertTitle>
              <ZoruAlertDescription>{fetchError}</ZoruAlertDescription>
            </ZoruAlert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Plan & Wallet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col">
          <ZoruCard className="flex-1 shadow-md border-zoru-line overflow-hidden flex flex-col">
            <div className="bg-zoru-surface-2 border-b border-zoru-line p-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-zoru-primary" />
                Your Current Plan: <span className="text-zoru-primary">{sessionUser?.plan?.name || 'Free'}</span>
              </h3>
              <p className="text-sm text-zoru-ink-muted mt-1">Here is what is included in your active workspace subscription.</p>
            </div>
            <div className="p-6 bg-zoru-bg flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                {planFeatureMap.map((feature) => {
                  const isAllowed = sessionUser?.plan?.features?.[feature.id as keyof typeof sessionUser.plan.features] ?? true;
                  return (
                    <div key={feature.id} className="flex items-start gap-3">
                      {isAllowed ? (
                        <div className="mt-0.5 rounded-full bg-zoru-success/10 p-1">
                          <Check className="h-3.5 w-3.5 text-zoru-success flex-shrink-0" />
                        </div>
                      ) : (
                        <div className="mt-0.5 rounded-full bg-zoru-surface-3 p-1">
                          <X className="h-3.5 w-3.5 text-zoru-ink-muted flex-shrink-0" />
                        </div>
                      )}
                      <span className={cn("text-sm font-medium", !isAllowed && "text-zoru-ink-subtle line-through decoration-zoru-line-strong")}>
                        {feature.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ZoruCard>
        </motion.div>
        
        <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col h-full">
          <div className="flex-1">
            <WalletCard user={sessionUser} />
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <ZoruSeparator className="my-4 opacity-50" />
      </motion.div>

      {/* Pricing Tiers with Filters */}
      <motion.div variants={itemVariants} id="upgrade" className="space-y-12 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">Upgrade Your Workspace</h2>
            <p className="text-zoru-ink-muted">Find the perfect plan for your business needs. Scale seamlessly as you grow.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
              <ZoruInput
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-[200px]"
              />
            </div>
            <ZoruSelect value={sortBy} onValueChange={setSortBy}>
              <ZoruSelectTrigger className="w-full sm:w-[180px]">
                <ZoruSelectValue placeholder="Sort by" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="price-asc">Price: Low to High</ZoruSelectItem>
                <ZoruSelectItem value="price-desc">Price: High to Low</ZoruSelectItem>
                <ZoruSelectItem value="name-asc">Name: A to Z</ZoruSelectItem>
                <ZoruSelectItem value="name-desc">Name: Z to A</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </div>

        {Object.entries(categorizedPlans).every(([_, plans]) => plans.length === 0) ? (
          <div className="py-12 text-center text-zoru-ink-muted">
            <p>No plans found matching your search.</p>
          </div>
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
      </motion.div>
    </motion.div>
  );
}
