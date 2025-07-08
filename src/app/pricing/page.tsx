
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Check } from 'lucide-react';

const plans = [
    {
        name: 'Basic',
        price: '₹499',
        description: 'For individuals and small teams getting started.',
        features: [
            '1 Project',
            '1,000 Monthly Contacts',
            'Basic Flow Builder',
            'Email Support'
        ],
        cta: 'Choose Basic'
    },
    {
        name: 'Pro',
        price: '₹1499',
        description: 'For growing businesses that need more power.',
        isPopular: true,
        features: [
            '5 Projects',
            '10,000 Monthly Contacts',
            'Advanced Flow Builder',
            'AI Assistant',
            'Priority Support'
        ],
        cta: 'Choose Pro'
    },
    {
        name: 'Business',
        price: 'Contact Us',
        description: 'For large organizations with custom needs.',
        features: [
            'Unlimited Projects',
            'Custom Contact Limits',
            'Dedicated Account Manager',
            'API Access',
            'Custom Integrations'
        ],
        cta: 'Contact Sales'
    }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
            <Link href="/" className="text-primary hover:underline mb-4 inline-block">
                &larr; Back to Home
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold font-headline">Pricing Plans</h1>
            <p className="mt-4 text-lg text-muted-foreground">Choose the perfect plan for your business needs.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {plans.map(plan => (
                <Card key={plan.name} className={`flex flex-col h-full ${plan.isPopular ? 'border-2 border-primary shadow-2xl' : ''}`}>
                    <CardHeader>
                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                        <div className="pt-4">
                            <span className="text-4xl font-bold">{plan.price}</span>
                            {plan.price.startsWith('₹') && <span className="text-muted-foreground">/mo</span>}
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4">
                        <ul className="space-y-3">
                            {plan.features.map(feature => (
                                <li key={feature} className="flex items-start">
                                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                         <Button className="w-full" size="lg" variant={plan.isPopular ? 'default' : 'outline'}>
                            {plan.cta}
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
