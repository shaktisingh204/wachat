
'use client';

import { Check, X, History, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSession, handleInitiatePayment } from '@/app/actions';
import { getPlans } from '@/app/actions/plan.actions';
import { planFeatureMap } from '@/lib/plans';
import { Separator } from '@/components/ui/separator';
import { PlanPurchaseButton } from '@/components/wabasimplify/plan-purchase-button';
import { CreditPurchaseButton } from '@/components/wabasimplify/credit-purchase-button';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import type { Plan, WithId, User } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


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

const PlanCard = ({ plan, currentPlanId, projectId }: { plan: WithId<Plan>, currentPlanId?: string, projectId?: string | null }) => {
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

const PlanCategorySection = ({ title, plans, currentPlanId, projectId }: { title: string; plans: WithId<Plan>[]; currentPlanId?: string, projectId?: string | null }) => {
    if (plans.length === 0) return null;
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-headline">{title}</h2>
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-6 pb-4">
                    {plans.map((plan: WithId<Plan>) => (
                       <PlanCard key={plan._id.toString()} plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <Separator />
        </div>
    );
}

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
        const categories: Record<string, WithId<Plan>[]> = {
            'All-In-One': [],
            'Wachat': [],
            'CRM': [],
            'Meta Suite': [],
            'Instagram Suite': [],
            'Email': [],
            'SMS': [],
            'URL Shortener': [],
            'QR Code Generator': []
        };

        plans.forEach(p => {
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
            <div className="flex items-center justify-center h-full">
                <p>Loading user and plan data...</p>
            </div>
        )
    }

    const PlanFeaturesGrid = () => (
        <Card>
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1" className="border-b-0">
                    <AccordionTrigger className="p-6">
                        <div className="text-left">
                            <CardTitle>Features Included in Your Plan</CardTitle>
                            <CardDescription className="mt-2">An overview of features available on your current <span className="font-semibold text-primary">{sessionUser?.plan?.name || 'plan'}</span>.</CardDescription>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {planFeatureMap.map(feature => {
                                const isAllowed = sessionUser?.plan?.features?.[feature.id as keyof typeof sessionUser.plan.features] ?? true;
                                const Icon = feature.icon;
                                return (
                                    <div key={feature.id} className="flex items-center gap-3">
                                        {isAllowed ? <Check className="h-5 w-5 text-primary flex-shrink-0" /> : <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                                        <span className={cn("text-sm", !isAllowed && "text-muted-foreground line-through")}>{feature.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );

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
            
            <PlanFeaturesGrid />

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
                <PlanCategorySection title="All-In-One Plans" plans={categorizedPlans['All-In-One']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="Wachat Suite Plans" plans={categorizedPlans['Wachat']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="CRM Suite Plans" plans={categorizedPlans['CRM']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="Meta Suite Plans" plans={categorizedPlans['Meta Suite']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="Instagram Suite Plans" plans={categorizedPlans['Instagram Suite']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="Email Suite Plans" plans={categorizedPlans['Email']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="SMS Suite Plans" plans={categorizedPlans['SMS']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="URL Shortener Plans" plans={categorizedPlans['URL Shortener']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
                <PlanCategorySection title="QR Code Generator Plans" plans={categorizedPlans['QR Code Generator']} currentPlanId={userPlanId?.toString()} projectId={activeProjectId} />
            </div>
        </div>
    );
}
