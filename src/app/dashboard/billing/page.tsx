import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSession } from '@/app/actions';
import type { User } from '@/app/actions';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Billing & Plans | Wachat',
};

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-center gap-2">
        <Check className="h-5 w-5 text-primary" />
        <span className="text-muted-foreground">{children}</span>
    </li>
);

export default async function BillingPage() {
    const session = await getSession();
    const userPlan = session?.user?.plan || 'free';

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Billing & Plans</h1>
                <p className="text-muted-foreground">Manage your subscription and view plan details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                <Card className={cn(userPlan === 'free' && "border-2 border-primary")}>
                    <CardHeader>
                        <CardTitle>Free</CardTitle>
                        <CardDescription>Perfect for getting started and exploring the platform's core features.</CardDescription>
                        <div className="text-4xl font-bold pt-4">$0 <span className="text-sm font-normal text-muted-foreground">/ month</span></div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm">
                            <PlanFeature>1 Project</PlanFeature>
                            <PlanFeature>1 Agent</PlanFeature>
                            <PlanFeature>5 Custom User Attributes</PlanFeature>
                            <PlanFeature>Basic Campaign Analytics</PlanFeature>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" disabled={userPlan === 'free'}>
                            Current Plan
                        </Button>
                    </CardFooter>
                </Card>

                <Card className={cn(userPlan === 'pro' && "border-2 border-primary")}>
                    <CardHeader>
                        <CardTitle>Pro</CardTitle>
                        <CardDescription>For growing businesses that need more power and collaboration features.</CardDescription>
                         <div className="text-4xl font-bold pt-4">$49 <span className="text-sm font-normal text-muted-foreground">/ month</span></div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm">
                            <PlanFeature>5 Projects</PlanFeature>
                            <PlanFeature>10 Agents</PlanFeature>
                            <PlanFeature>20 Custom User Attributes</PlanFeature>
                            <PlanFeature>Advanced Campaign Analytics</PlanFeature>
                            <PlanFeature>Role-based Permissions</PlanFeature>
                            <PlanFeature>Priority Support</PlanFeature>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        {userPlan === 'pro' ? (
                            <Button className="w-full" disabled>Current Plan</Button>
                        ) : (
                             <Button className="w-full">Upgrade to Pro</Button>
                        )}
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Enterprise</CardTitle>
                        <CardDescription>Tailored solutions for large-scale operations and unique requirements.</CardDescription>
                         <div className="text-4xl font-bold pt-4">Custom</div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <ul className="space-y-2 text-sm">
                            <PlanFeature>Unlimited Projects</PlanFeature>
                            <PlanFeature>Unlimited Agents & Roles</PlanFeature>
                            <PlanFeature>Unlimited User Attributes</PlanFeature>
                            <PlanFeature>Custom Integrations</PlanFeature>
                            <PlanFeature>Dedicated Account Manager</PlanFeature>
                             <PlanFeature>On-premise Deployment Option</PlanFeature>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full">Contact Sales</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
