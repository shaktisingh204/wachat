

import { Check, X, History } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSession, getPlans } from '@/app/actions';
import { Separator } from '@/components/ui/separator';
import { PlanPurchaseButton } from '@/components/wabasimplify/plan-purchase-button';
import { CreditPurchaseButton } from '@/components/wabasimplify/credit-purchase-button';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Billing & Plans | SabNode',
};
export const dynamic = 'force-dynamic';


const PlanFeature = ({ children, included }: { children: React.ReactNode, included: boolean }) => (
    <li className="flex items-center gap-3">
        {included ? <Check className="h-5 w-5 text-primary flex-shrink-0" /> : <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
        <span className={cn("text-sm", !included && "text-muted-foreground line-through")}>{children}</span>
    </li>
);

const creditPacks = [
    { credits: 5000, amount: 500, description: 'Starter Pack', gradient: 'card-gradient-blue' },
    { credits: 12000, amount: 1000, description: 'Growth Pack', gradient: 'card-gradient-green' },
    { credits: 30000, amount: 2500, description: 'Business Pack', gradient: 'card-gradient-purple' },
];

export default async function BillingPage() {
    const session = await getSession();
    const plans = await getPlans({ isPublic: true });
    const userPlanId = session?.user?.plan?._id;

    const gradientClasses = ['card-gradient-purple', 'card-gradient-blue', 'card-gradient-green'];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Billing & Plans</h1>
                    <p className="text-muted-foreground">Manage your subscription, purchase credits, and view your history.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/billing/history">
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
                        <Card key={pack.credits} className={cn("flex flex-col text-center card-gradient", pack.gradient)}>
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

            <div>
                <h2 className="text-2xl font-bold font-headline">Upgrade Your Plan</h2>
                <p className="text-muted-foreground">Unlock more features and increase your limits by upgrading your plan.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {plans.map((plan, index) => (
                    <Card key={plan._id.toString()} className={cn("flex flex-col card-gradient", gradientClasses[index % gradientClasses.length], userPlanId?.toString() === plan._id.toString() && "border-2 border-primary")}>
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
                            <PlanPurchaseButton plan={plan} currentPlanId={userPlanId?.toString()} />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
