

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserPlus, Trophy, DollarSign, Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CRM Dashboard | SabNode',
};

async function getCrmStats() {
    const session = await getSession();
    if (!session?.user) return { contactCount: 0, dealCount: 0, dealsWon: 0, pipelineValue: 0, currency: 'USD' };
    
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [contactCount, deals] = await Promise.all([
            db.collection('crm_contacts').countDocuments({ userId: userObjectId }),
            db.collection('crm_deals').find({ userId: userObjectId }).project({ value: 1, stage: 1, currency: 1 }).toArray()
        ]);
        
        const dealsWon = deals.filter(d => d.stage === 'Won').length;
        const pipelineValue = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').reduce((sum, deal) => sum + deal.value, 0);

        return {
            contactCount,
            dealCount: deals.length,
            dealsWon,
            pipelineValue,
            currency: deals[0]?.currency || 'USD'
        }
    } catch(e) {
        return { contactCount: 0, dealCount: 0, dealsWon: 0, pipelineValue: 0, currency: 'USD' };
    }
}

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
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
  const session = await getSession();
  if (!session?.user) {
      redirect('/login');
  }
  
  // Redirect to setup if industry is not set
  if (!session.user.crmIndustry) {
      redirect('/dashboard/crm/setup');
  }

  const stats = await getCrmStats();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">CRM Dashboard</h1>
        <p className="text-muted-foreground">An overview of your customer relationships, leads, and deals.</p>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Contacts" value={stats.contactCount.toLocaleString()} icon={Users} />
            <StatCard title="Total Deals" value={stats.dealCount.toLocaleString()} icon={Handshake}/>
            <StatCard title="Deals Won" value={stats.dealsWon.toLocaleString()} icon={Trophy} />
            <StatCard title="Pipeline Revenue" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: stats.currency || 'USD' }).format(stats.pipelineValue)} icon={DollarSign} />
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
