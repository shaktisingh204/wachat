'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getAdAccounts, deleteAdAccount } from '@/app/actions/ad-manager.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle, Megaphone, Wrench, Facebook, Trash2, Plus, AlertTriangle, LoaderCircle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useAdManager } from '@/context/ad-manager-context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Assuming this exists

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

function ConnectAccountDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Connect Account
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Connect Meta Ad Account</DialogTitle>
                    <DialogDescription>
                        You will be redirected to Facebook to authorize SabNode to access your Ad Accounts.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-lg flex items-start gap-3">
                        <Facebook className="h-5 w-5 mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium mb-1">Permissions Required</p>
                            <ul className="list-disc list-inside space-y-1 opacity-90">
                                <li>Read Ad Accounts</li>
                                <li>Manage Campaigns</li>
                                <li>Access Insights</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Link href={`/api/auth/ad-manager/login`} className="w-full sm:w-auto">
                        <Button className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            <Facebook className="mr-2 h-4 w-4" />
                            Continue with Facebook
                        </Button>
                    </Link>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DisconnectAccountDialog({ account, onDisconnect }: { account: any, onDisconnect: () => void }) {
    const [open, setOpen] = useState(false);
    const [isDeleting, startDeleteTransition] = useTransition();

    const handleDisconnect = () => {
        startDeleteTransition(async () => {
            await onDisconnect();
            setOpen(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Disconnect Ad Account?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to disconnect <strong>{account.name}</strong>? This will remove it from your dashboard but will not affect the account on Facebook.
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg flex items-center gap-3 my-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-sm">You will need to re-connect via Facebook to access this account again.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDisconnect} disabled={isDeleting}>
                        {isDeleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Disconnect
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AdAccountCard({ account, isActive, onSelect, onDisconnect }: { account: any, isActive: boolean, onSelect: () => void, onDisconnect: () => void }) {
    return (
        <Card className={cn(
            "transition-all duration-200 border-2",
            isActive ? "border-primary shadow-md bg-primary/5" : "hover:border-primary/50"
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">{account.name}</CardTitle>
                        <CardDescription className="mt-1 font-mono text-xs">{account.account_id}</CardDescription>
                    </div>
                    {isActive && <Badge variant="default" className="ml-2">Active</Badge>}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">
                        <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                        Connected
                    </Badge>
                    {account.currency && (
                        <Badge variant="outline" className="font-normal">
                            {account.currency}
                        </Badge>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-2 border-t bg-muted/20">
                <Button variant={isActive ? "default" : "secondary"} size="sm" onClick={onSelect}>
                    <Megaphone className="mr-2 h-4 w-4" />
                    {isActive ? 'Manage Campaigns' : 'Select Account'}
                </Button>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild title="View on Facebook">
                        <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                    <DisconnectAccountDialog account={account} onDisconnect={onDisconnect} />
                </div>
            </CardFooter>
        </Card>
    );
}

export default function AdAccountsPage() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isPageLoading, startPageLoad] = useTransition();
    const { activeAccount, selectAccount } = useAdManager();
    const { toast } = useToast();
    const router = useRouter();

    const fetchAccounts = () => {
        startPageLoad(async () => {
            const { accounts: accountsData, error } = await getAdAccounts();
            if (error) {
                toast({ title: 'Error fetching accounts', description: error, variant: 'destructive' });
            } else {
                setAccounts(accountsData || []);
            }
        });
    }

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSelect = (account: any) => {
        selectAccount({
            id: account.id,
            name: account.name,
            account_id: account.id // Using 'id' field which seems to be the Graph API ID, typically 'act_XXXX' or similar
        });
        toast({ title: 'Account Selected', description: `Now managing ${account.name}` });
        router.push('/dashboard/ad-manager/campaigns');
    };

    const handleDisconnect = async (accountId: string) => {
        const res = await deleteAdAccount(accountId);
        if (res.success) {
            toast({ title: 'Account Disconnected', description: 'The ad account has been removed.' });
            if (activeAccount?.id === accountId) {
                selectAccount(null);
            }
            fetchAccounts();
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
    };

    if (isPageLoading && accounts.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Wrench className="h-8 w-8 text-primary" />
                        Ad Accounts
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Connect and manage your Meta Ad Accounts to run campaigns.
                    </p>
                </div>
                <ConnectAccountDialog />
            </div>

            {accounts.length === 0 ? (
                <Card className="border-dashed border-2 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <Megaphone className="h-12 w-12 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">No Ad Accounts Connected</h3>
                            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                                Connect your Facebook Ad Account to start creating and managing campaigns directly from SabNode.
                            </p>
                        </div>
                        <ConnectAccountDialog />
                    </div>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {accounts.map(acc => (
                        <AdAccountCard
                            key={acc.id}
                            account={acc}
                            isActive={activeAccount?.id === acc.id}
                            onSelect={() => handleSelect(acc)}
                            onDisconnect={() => handleDisconnect(acc.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
