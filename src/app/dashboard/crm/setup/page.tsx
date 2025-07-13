
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveCrmIndustry } from "@/app/actions/crm.actions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

const industries = [
    { name: "Manufacturing", description: "For businesses that produce goods." },
    { name: "Retail & eCommerce", description: "For online stores and physical shops." },
    { name: "Services (IT, Consulting, Agencies)", description: "For service-based businesses." },
    { name: "Construction & Real Estate", description: "For builders and real estate agents." },
    { name: "Wholesale & Distribution", description: "For businesses that sell in bulk." },
    { name: "Healthcare", description: "For clinics, hospitals, and practitioners." },
    { name: "Education", description: "For schools, colleges, and online courses." },
    { name: "Logistics & Transport", description: "For companies managing supply chains." },
    { name: "Accounting & Finance", description: "For financial services firms." },
    { name: "Food & Beverage", description: "For restaurants, cafes, and food producers." },
    { name: "Pharma & Life Sciences", description: "For pharmaceutical companies." },
    { name: "Nonprofits & NGOs", description: "For non-profit organizations." },
    { name: "Media & Creative Agencies", description: "For marketing and creative firms." },
    { name: "Hospitality (Hotels, Resorts)", description: "For the travel and lodging industry." },
];

export default function CrmSetupPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSelect = async () => {
        if (!selectedIndustry) {
            toast({ title: "Please select an industry", variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await saveCrmIndustry(selectedIndustry);
            if (result.success) {
                toast({ title: "CRM Setup Complete!", description: "Your CRM has been customized for your industry." });
                router.push('/dashboard/crm');
                router.refresh(); // Important to get the new user state
            } else {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold font-headline">Welcome to the CRM Suite!</h1>
                <p className="text-muted-foreground mt-2">To get started, please select the industry that best describes your business. This will help us tailor the CRM to your needs.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {industries.map(industry => (
                    <Card 
                        key={industry.name} 
                        onClick={() => setSelectedIndustry(industry.name)}
                        className={`cursor-pointer transition-all ${selectedIndustry === industry.name ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`}
                    >
                        <CardHeader>
                            <CardTitle className="text-base flex justify-between items-start">
                                {industry.name}
                                {selectedIndustry === industry.name && <Check className="h-5 w-5 text-primary" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">{industry.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex justify-center">
                <Button size="lg" onClick={handleSelect} disabled={!selectedIndustry || isPending}>
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue
                </Button>
            </div>
        </div>
    );
}
