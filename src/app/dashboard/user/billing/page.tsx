
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
import { useEffect, useState, useMemo } from 'react';
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

const PlanCard = ({ plan, currentPlanId, projectId }: { plan: WithId<Plan>, currentPlanId?: string, projectId: string }) => {
    return (
        <Card key={plan._id.toString()} className={cn("flex flex-col w-80", currentPlanId?.toString() === plan._id.toString() && "border-2 border-primary")}>
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
                    <PlanFeature included={plan.features.apiAccess}>API Access</PlanFeature>
                </ul>
            </CardContent>
            <CardFooter className="mt-auto">
               <PlanPurchaseButton plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
            </CardFooter>
        </Card>
    );
};

export default function BillingPage() {
    const [isClient, setIsClient] = useState(false);
    const { sessionUser, activeProjectId } = useProject();
    const [plans, setPlans] = useState<WithId<Plan>[]>([]);

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
        const allInOne = plans.filter(p => p.name.toLowerCase().includes('all-in-one'));
        const wachat = plans.filter(p => p.name.toLowerCase().includes('wachat'));
        const crm = plans.filter(p => p.name.toLowerCase().includes('crm'));
        return { allInOne, wachat, crm };
    }, [plans]);

    const userPlanId = sessionUser?.plan?._id;

    if (!isClient || !sessionUser || !activeProjectId) {
        return (
            <div className="flex items-center justify-center h-full">
                <p>Loading user and project data...</p>
            </div>
        )
    }

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
            
            <div id="upgrade" className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold font-headline">All-In-One Plans</h2>
                    <p className="text-muted-foreground">Get access to all features with a single subscription.</p>
                </div>
                 <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-6 pb-4">
                        {categorizedPlans.allInOne.map((plan: WithId<Plan>) => (
                           <PlanCard key={plan._id.toString()} plan={plan} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                
                 <Separator />

                <div>
                    <h2 className="text-2xl font-bold font-headline">Wachat Suite Plans</h2>
                    <p className="text-muted-foreground">Plans focused on WhatsApp Business API features.</p>
                </div>
                 <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-6 pb-4">
                        {categorizedPlans.wachat.map((plan: WithId<Plan>) => (
                           <PlanCard key={plan._id.toString()} plan={plan} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                
                <Separator />
                
                <div>
                    <h2 className="text-2xl font-bold font-headline">CRM Suite Plans</h2>
                    <p className="text-muted-foreground">Plans focused on Customer Relationship Management.</p>
                </div>
                 <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-6 pb-4">
                        {categorizedPlans.crm.map((plan: WithId<Plan>) => (
                           <PlanCard key={plan._id.toString()} plan={plan} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                        ))}
                    </div>
                     <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </div>
    );
}
