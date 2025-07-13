
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserPlus, Trophy, DollarSign } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Dashboard | SabNode',
};

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default async function CrmDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">CRM Dashboard</h1>
        <p className="text-muted-foreground">An overview of your customer relationships, leads, and deals.</p>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Contacts" value="1,254" icon={Users} description="+82 this month" />
            <StatCard title="New Leads" value="98" icon={UserPlus} description="+15 this week" />
            <StatCard title="Deals Won" value="32" icon={Trophy} description="This quarter" />
            <StatCard title="Pipeline Revenue" value="$45,231" icon={DollarSign} description="Total value of open deals" />
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
                <CardDescription>
                    More detailed reports, deal pipelines, and contact management features are on their way to the CRM Suite!
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
