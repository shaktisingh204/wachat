
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmAccountById, updateCrmAccount } from '@/app/actions/crm-accounts.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { WithId, CrmAccount } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const initialState = { message: null, error: null, accountId: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

export default function EditCrmAccountPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as string;
    
    const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
    const [isLoading, startLoading] = useTransition();

    const [state, formAction] = useActionState(updateCrmAccount, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (accountId) {
            startLoading(async () => {
                const fetchedAccount = await getCrmAccountById(accountId);
                setAccount(fetchedAccount);
            });
        }
    }, [accountId]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            if (state.accountId) {
                router.push(`/dashboard/crm/accounts/${state.accountId}`);
            } else {
                router.push('/dashboard/crm/accounts');
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    if (isLoading || !account) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <div className="max-w-2xl mx-auto">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href={`/dashboard/crm/accounts/${accountId}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to Account</Link>
                </Button>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="accountId" value={account._id.toString()} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building className="h-6 w-6" />
                            Edit Account
                        </CardTitle>
                        <CardDescription>Update the details for {account.name}.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Company Name</Label>
                            <Input id="name" name="name" required defaultValue={account.name} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Input id="industry" name="industry" defaultValue={account.industry} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="website">Website</Label>
                                <Input id="website" name="website" type="url" placeholder="https://example.com" defaultValue={account.website} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" name="phone" defaultValue={account.phone} />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
