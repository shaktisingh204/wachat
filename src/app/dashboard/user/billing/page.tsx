
'use client';

import { Check, X, History, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSession, handleInitiatePayment } from '@/app/actions';
import { getPlans, planFeatureMap } from '@/app/actions/plan.actions';
import { Separator } from '@/components/ui/separator';
import { PlanPurchaseButton } from '@/components/wabasimplify/plan-purchase-button';
import { CreditPurchaseButton } from '@/components/wabasimplify/credit-purchase-button';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import type { Plan, WithId } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const PlanFeature = ({ children, included }: { children: React.ReactNode, included: boolean }) => (
    <li className="flex items-center gap-3">
        {included ? <Check className="h-5 w-5 text-primary flex-shrink-0" /> : <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
        <span className={cn("text-sm", !included && "text-muted-foreground line-through")}>{children}</span>
    </li>
);

const creditPacks = [
    { credits: 5000, amount: 500, description: 'Starter Pack' },
    { credits: 12000, amount: 1000, description: 'Growth Pack' },
    { credits: 30000, amount: 2500, description: 'Business Pack' },
];

export default function BillingPage() {
    const [isClient, setIsClient] = useState(false);
    const { sessionUser, activeProjectId } = useProject();
    const [plans, setPlans] = useState<any[]>([]);

    useEffect(() => {
        setIsClient(true);
        document.title = 'Billing & Plans | SabNode';
        const fetchData = async () => {
            const plansData = await getPlans({ isPublic: true });
            setPlans(plansData);
        };
        fetchData();
    }, []);

    const userPlanId = sessionUser?.plan?._id;
    const userPlanFeatures = sessionUser?.plan?.features;

    const { allowedFeatures, notAllowedFeatures } = React.useMemo(() => {
        if (!userPlanFeatures) return { allowedFeatures: [], notAllowedFeatures: [] };
        const allowed: any[] = [];
        const notAllowed: any[] = [];
        planFeatureMap.forEach(feature => {
            if (userPlanFeatures[feature.id]) {
                allowed.push(feature);
            } else {
                notAllowed.push(feature);
            }
        });
        return { allowedFeatures: allowed, notAllowedFeatures: notAllowed };
    }, [userPlanFeatures]);


    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Billing & Plans</h1>
                    <p className="text-muted-foreground">Manage your subscription, purchase credits, and view your history.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/user/billing/history">
                        <History className="mr-2 h-4 w-4" />
                        View Billing History
                    </Link>
                </Button>
            </div>

            {userPlanFeatures && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Features in Your Plan</CardTitle>
                        <CardDescription>
                            Your current plan <span className="font-bold text-primary">{sessionUser?.plan?.name}</span> includes the following apps and features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Allowed Apps</h3>
                             <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex w-max space-x-4 pb-4">
                                     {allowedFeatures.map(feature => (
                                        <div key={feature.id} className="text-center w-28 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                                                <feature.icon className="h-8 w-8" />
                                            </div>
                                            <p className="mt-2 text-xs font-medium">{feature.name}</p>
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>
                        <Separator />
                        <div>
                             <h3 className="text-lg font-semibold mb-3">Not Allowed Apps</h3>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {notAllowedFeatures.map(feature => (
                                    <div key={feature.id} className="text-center group cursor-pointer" onClick={() => document.getElementById('upgrade')?.scrollIntoView({ behavior: 'smooth' })}>
                                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mx-auto text-muted-foreground/50 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                                             <feature.icon className="h-8 w-8" />
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground transition-colors group-hover:text-primary">{feature.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Buy Credits</CardTitle>
                    <CardDescription>Top up your account balance to send messages. Unused credits never expire.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {creditPacks.map(pack => (
                        <Card key={pack.credits} className="flex flex-col text-center">
                            <CardHeader>
                                <CardTitle>{pack.credits.toLocaleString()} Credits</CardTitle>
                                <CardDescription>{pack.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-3xl font-bold">₹{pack.amount}</p>
                            </CardContent>
                            <CardFooter>
                                <CreditPurchaseButton credits={pack.credits} amount={pack.amount} />
                            </CardFooter>
                        </Card>
                    ))}
                </CardContent>
            </Card>

            <Separator />

            <div id="upgrade">
                <h2 className="text-2xl font-bold font-headline">Upgrade Your Plan</h2>
                <p className="text-muted-foreground">Unlock more features and increase your limits by upgrading your plan.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {plans.map((plan: WithId<Plan>) => (
                    <Card key={plan._id.toString()} className={cn("flex flex-col", userPlanId?.toString() === plan._id.toString() && "border-2 border-primary")}>
                        <CardHeader className="flex-grow">
                            <CardTitle>{plan.name}</CardTitle>
                            <div className="text-4xl font-bold pt-4">{plan.currency || 'INR'} {plan.price} <span className="text-sm font-normal text-muted-foreground">/ month</span></div>
                            <CardDescription>
                                + Mkt: INR {plan.messageCosts?.marketing ?? 'N/A'} | Util: INR {plan.messageCosts?.utility ?? 'N/A'} | Auth: INR {plan.messageCosts?.authentication ?? 'N/A'}
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-6 space-y-4">
                            <ul className="space-y-3">
                                <PlanFeature included={true}>{plan.projectLimit > 0 ? `${plan.projectLimit} Project(s)` : 'Unlimited Projects'}</PlanFeature>
                                <PlanFeature included={true}>{plan.agentLimit > 0 ? `${plan.agentLimit} Agent(s) per Project` : 'Unlimited Agents'}</PlanFeature>
                                <PlanFeature included={true}>{plan.templateLimit > 0 ? `${plan.templateLimit} Templates` : 'Unlimited Templates'}</PlanFeature>
                                <PlanFeature included={true}>{plan.flowLimit > 0 ? `${plan.flowLimit} Flows` : 'Unlimited Flows'}</PlanFeature>
                                <PlanFeature included={true}>{plan.metaFlowLimit > 0 ? `${plan.metaFlowLimit} Meta Flows` : 'Unlimited Meta Flows'}</PlanFeature>
                                <PlanFeature included={plan.features.campaigns}>Broadcast Campaigns</PlanFeature>
                                <PlanFeature included={plan.features.liveChat}>Live Chat</PlanFeature>
                                <PlanFeature included={plan.features.flowBuilder}>Flow Builder</PlanFeature>
                                <PlanFeature included={plan.features.apiAccess}>API Access</PlanFeature>
                            </ul>
                        </CardContent>
                        <CardFooter className="mt-auto">
                           {isClient && activeProjectId && <PlanPurchaseButton plan={plan} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />}
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
