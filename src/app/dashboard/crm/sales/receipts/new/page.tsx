
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentType = 'receipt' | 'advance';

export default function RecordNewPaymentPage() {
    const [selectedType, setSelectedType] = useState<PaymentType | null>(null);

    const cards = [
        {
            type: 'receipt' as PaymentType,
            title: 'Payment Receipt',
            description: 'Record a payment made against a specific invoice.'
        },
        {
            type: 'advance' as PaymentType,
            title: 'Client Advance',
            description: 'Record an advance payment received from a client without an invoice.'
        }
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/sales/receipts">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Receipts
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Record New Payment</h1>
                <p className="text-muted-foreground mt-2">Which payment would you like to record?</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {cards.map((card) => (
                    <Card 
                        key={card.type}
                        onClick={() => setSelectedType(card.type)}
                        className={cn(
                            "cursor-pointer hover:border-primary transition-all",
                            selectedType === card.type && 'border-primary ring-2 ring-primary'
                        )}
                    >
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle>{card.title}</CardTitle>
                                {selectedType === card.type && <CheckCircle className="h-5 w-5 text-primary" />}
                            </div>
                            <CardDescription>{card.description}</CardDescription>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <div className="flex justify-end">
                <Button disabled={!selectedType}>
                    Submit
                </Button>
            </div>
        </div>
    );
}
