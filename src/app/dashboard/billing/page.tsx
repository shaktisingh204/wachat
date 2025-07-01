

import { Check, X } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSession, getPlans } from '@/app/actions';
import { Separator } from '@/components/ui/separator';
import { PlanPurchaseButton } from '@/components/wabasimplify/plan-purchase-button';

export const metadata: Metadata = {
  title: 'Billing & Plans | Wachat',
};
export const dynamic = 'force-dynamic';


const PlanFeature = ({ children, included }: { children: React.ReactNode, included: boolean }) => (
    <li className="flex items-center gap-3">
        {included ? <Check className="h-5 w-5 text-primary flex-shrink-0" /> : <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
        <span className={cn(!included && "text-muted-foreground line-through")}>{children}</span>
    </li>
);

export default async function BillingPage() {
    const session = await getSession();
    const plans = await getPlans({ isPublic: true });
    const userPlanId = session?.user?.plan?._id;

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Billing & Plans</h1>
                <p className="text-muted-foreground">Manage your subscription and view plan details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {plans.map(plan => (
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
                            <ul className="space-y-3 text-sm">
                                <PlanFeature included={true}>{plan.projectLimit} Project(s)</PlanFeature>
                                <PlanFeature included={true}>{plan.agentLimit} Agent(s) per Project</PlanFeature>
                                <PlanFeature included={true}>{plan.attributeLimit} Custom Attributes</PlanFeature>
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
