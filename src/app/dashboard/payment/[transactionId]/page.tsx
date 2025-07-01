

import { getTransactionStatus } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PaymentStatusPage({ params }: { params: { transactionId: string } }) {
    const transaction = await getTransactionStatus(params.transactionId);

    if (!transaction) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto bg-destructive text-destructive-foreground rounded-full h-12 w-12 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8" />
                        </div>
                        <CardTitle className="mt-4">Transaction Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            We could not find this transaction, or you may not have permission to view it.
                        </CardDescription>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button asChild>
                            <Link href="/dashboard/billing">Back to Billing</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }
    
    const isSuccess = transaction.status === 'SUCCESS';

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className={`mx-auto rounded-full h-12 w-12 flex items-center justify-center ${isSuccess ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                        {isSuccess ? <CheckCircle className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                    </div>
                    <CardTitle className="mt-4">Payment {isSuccess ? 'Successful' : 'Failed'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                       {isSuccess 
                        ? "Your plan has been upgraded successfully! You can now enjoy all the new features."
                        : "There was a problem with your payment. Your plan has not been changed. Please try again or contact support."
                       }
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-4 font-mono">
                        Transaction ID: {transaction._id.toString()}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button asChild>
                        <Link href="/dashboard/billing">Back to Billing</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
