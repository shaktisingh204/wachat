'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Separator,
  ScrollArea,
  ZoruScrollBar,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruCard,
  ZoruSeparator,
  ZoruScrollArea,
  ZoruAlert,
} from '@/components/zoruui';
import {
  Check,
  X,
  History,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlans } from '@/app/actions/plan.actions';
import { planFeatureMap } from '@/lib/plans';
import { PlanPurchaseButton } from '@/components/wabasimplify/plan-purchase-button';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Plan, WithId, User } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WalletCard } from '@/components/wabasimplify/wallet-card';
import { motion } from 'framer-motion';

const PlanFeature = ({ children, included }: { children: React.ReactNode; included: boolean }) => (
  <li className="flex items-start gap-3">
    {included ? (
      <div className="mt-0.5 rounded-full bg-zoru-success/20 p-1">
        <Check className="h-3.5 w-3.5 text-zoru-success flex-shrink-0" />
      </div>
    ) : (
      <div className="mt-0.5 rounded-full bg-zoru-surface-3 p-1">
        <X className="h-3.5 w-3.5 text-zoru-ink-muted flex-shrink-0" />
      </div>
    )}
    <span className={cn('text-sm leading-snug', !included && 'text-zoru-ink-muted')}>
      {children}
    </span>
  </li>
);

const PlanCard = ({
  plan,
  currentPlanId,
  projectId,
}: {
  plan: WithId<Plan>;
  currentPlanId?: string;
  projectId?: string | null;
}) => {
  const isCurrentPlan = currentPlanId?.toString() === plan._id.toString();

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <ZoruCard
        className={cn(
          'relative flex flex-col w-[340px] h-full overflow-hidden transition-all duration-300',
          isCurrentPlan
            ? 'border-2 border-zoru-primary shadow-glow-lg bg-zoru-bg'
            : 'border border-zoru-line hover:border-zoru-primary/50 hover:shadow-xl bg-zoru-bg'
        )}
      >
        {isCurrentPlan && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-zoru-primary to-zoru-info" />
        )}
        
        <ZoruCardHeader className="flex-grow pt-8 pb-4">
          <div className="flex justify-between items-start">
            <ZoruCardTitle className="text-xl font-bold">{plan.name}</ZoruCardTitle>
            {isCurrentPlan && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zoru-primary/10 px-2.5 py-0.5 text-xs font-semibold text-zoru-primary">
                <Sparkles className="h-3 w-3" /> Current
              </span>
            )}
          </div>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold tracking-tight text-zoru-ink">
            <span className="text-2xl font-medium text-zoru-ink-muted mr-1">{plan.currency === 'INR' ? '₹' : plan.currency}</span>
            {plan.price}
            <span className="ml-1 text-sm font-medium text-zoru-ink-muted">/mo</span>
          </div>
          <ZoruCardDescription className="mt-4 text-[11px] uppercase tracking-wider font-semibold text-zoru-info-ink">
            + Mkt: ₹{plan.messageCosts?.marketing ?? 'N/A'} • Util: ₹{plan.messageCosts?.utility ?? 'N/A'} • Auth: ₹{plan.messageCosts?.authentication ?? 'N/A'}
          </ZoruCardDescription>
        </ZoruCardHeader>

        <ZoruSeparator className="opacity-60 mx-6 w-auto" />

        <ZoruCardContent className="pt-6 pb-6 flex-grow space-y-4">
          <ul className="space-y-4">
            <PlanFeature included={true}>
              {plan.projectLimit > 0 ? <><strong className="text-zoru-ink">{plan.projectLimit}</strong> Project(s)</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Projects
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.agentLimit > 0 ? <><strong className="text-zoru-ink">{plan.agentLimit}</strong> Agent(s) per Project</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Agents
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.templateLimit > 0 ? <><strong className="text-zoru-ink">{plan.templateLimit}</strong> Templates</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Templates
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.flowLimit > 0 ? <><strong className="text-zoru-ink">{plan.flowLimit}</strong> Flows</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Flows
            </PlanFeature>
            <PlanFeature included={plan.features.apiAccess}>
              API Access included
            </PlanFeature>
          </ul>
        </ZoruCardContent>

        <ZoruCardFooter className="mt-auto pt-4 pb-6">
          <div className="w-full">
            <PlanPurchaseButton plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
          </div>
        </ZoruCardFooter>
      </ZoruCard>
    </motion.div>
  );
};

const PlanCategorySection = ({
  title,
  plans,
  currentPlanId,
  projectId,
}: {
  title: string;
  plans: WithId<Plan>[];
  currentPlanId?: string;
  projectId?: string | null;
}) => {
  if (plans.length === 0) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-zoru-ink">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-zoru-line to-transparent" />
      </div>
      <ZoruScrollArea className="w-full pb-8 -mb-8">
        <div className="flex w-max space-x-6 pb-8 px-2 pt-2">
          {plans.map((plan: WithId<Plan>) => (
            <PlanCard
              key={plan._id.toString()}
              plan={plan}
              currentPlanId={currentPlanId}
              projectId={projectId}
            />
          ))}
        </div>
        <ZoruScrollBar orientation="horizontal" className="opacity-50 hover:opacity-100 transition-opacity" />
      </ZoruScrollArea>
    </motion.div>
  );
};

export default function BillingPage() {
  const [isClient, setIsClient] = useState(false);
  const { sessionUser, activeProjectId } = useProject();
  const [plans, setPlans] = useState<WithId<Plan>[]>([]);
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const paymentTxn = searchParams.get('txn');

  useEffect(() => {
    setIsClient(true);
    document.title = 'Billing & Plans | SabNode';
    const fetchData = async () => {
      const plansData = await getPlans({ isPublic: true });
      setPlans(plansData);
    };
    fetchData();
  }, []);

  const categorizedPlans = useMemo(() => {
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

    plans.forEach((p) => {
      const categoryKey = p.appCategory || 'All-In-One';
      if (categories[categoryKey]) {
        categories[categoryKey].push(p);
      } else {
        categories['All-In-One'].push(p);
      }
    });

    return categories;
  }, [plans]);

  const userPlanId = sessionUser?.plan?._id;

  if (!isClient || !sessionUser) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-zoru-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-zoru-ink-muted">Loading your workspace details...</p>
        </div>
      </div>
    );
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
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-10 max-w-7xl mx-auto"
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
      {paymentStatus === 'success' && (
        <motion.div variants={itemVariants}>
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
        <motion.div variants={itemVariants}>
          <ZoruAlert variant="destructive" className="bg-zoru-danger/10 border-zoru-danger/20 text-zoru-danger-ink">
            <AlertCircle className="h-5 w-5 text-zoru-danger" />
            <ZoruAlertTitle className="text-zoru-danger-ink font-bold">Payment failed</ZoruAlertTitle>
            <ZoruAlertDescription>
              We couldn't process your payment. No funds were deducted. Please try again or contact support.
            </ZoruAlertDescription>
          </ZoruAlert>
        </motion.div>
      )}

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

      {/* Pricing Tiers */}
      <motion.div variants={itemVariants} id="upgrade" className="space-y-12 pb-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4">Upgrade Your Workspace</h2>
          <p className="text-zoru-ink-muted">Find the perfect plan for your business needs. Scale seamlessly as you grow.</p>
        </div>

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
      </motion.div>
    </motion.div>
  );
}
