
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getAdAccounts } from '@/app/actions/ad-manager.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle, Megaphone, Wrench, Facebook } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        </div>
    );
}

function AdAccountCard({ account }: { account: any }) {
    const router = useRouter();

    const handleManage = () => {
        localStorage.setItem('activeAdAccountId', account.id);
        localStorage.setItem('activeAdAccountName', account.name);
        router.push('/dashboard/ad-manager/campaigns');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{account.name}</CardTitle>
                <CardDescription>Account ID: {account.account_id}</CardDescription>
            </CardHeader>
            <CardContent>
                <Badge><CheckCircle className="mr-1 h-3 w-3" /> Connected</Badge>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleManage}>Manage Campaigns</Button>
            </CardFooter>
        </Card>
    );
}

export default function AdAccountsPage() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const { accounts: accountsData } = await getAdAccounts();
            setAccounts(accountsData);
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Wrench className="h-8 w-8"/>
                    Ad Accounts
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect and manage your Meta Ad Accounts.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Ad Accounts</CardTitle>
                    <CardDescription>A list of all your available ad accounts.</CardDescription>
                </CardHeader>
                <CardContent>
                     {accounts.length > 0 ? (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {accounts.map(acc => (
                                <AdAccountCard key={acc.id} account={acc} />
                            ))}
                        </div>
                     ) : (
                        <p className="text-sm text-muted-foreground">No Ad Accounts have been connected yet.</p>
                     )}
                </CardContent>
                <CardFooter>
                     <Link href={`/api/auth/meta-suite/login?includeAds=true`}>
                        <Button variant="outline">
                            <Facebook className="mr-2 h-4 w-4" />
                            Connect or Re-sync Ad Accounts
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
