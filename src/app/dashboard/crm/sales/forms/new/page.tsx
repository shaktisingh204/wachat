
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, FileText } from 'lucide-react';
import Link from 'next/link';

const pipelines = [
    { id: 'default', name: 'Default Sales Pipeline' },
    { id: 'service', name: 'Customer Service Pipeline' },
    { id: 'enterprise', name: 'Enterprise Deals Pipeline' },
];

const StepIndicator = ({ step, title, currentStep }: { step: number; title: string; currentStep: number }) => (
    <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted border'}`}>
            {currentStep > step ? <Check className="h-5 w-5" /> : step}
        </div>
        <div>
            <p className="text-sm text-muted-foreground">Step {step}</p>
            <p className="font-semibold">{title}</p>
        </div>
    </div>
);

function Step1({ onContinue, selectedPipeline, setSelectedPipeline }: { onContinue: () => void, selectedPipeline: string, setSelectedPipeline: (val: string) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Select a Pipeline</CardTitle>
                <CardDescription>Choose the sales pipeline where new leads from this form will be added.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="pipeline-select">Pipeline</Label>
                    <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                        <SelectTrigger id="pipeline-select">
                            <SelectValue placeholder="Select a pipeline..." />
                        </SelectTrigger>
                        <SelectContent>
                            {pipelines.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={onContinue} disabled={!selectedPipeline}>
                    Save and Continue
                </Button>
            </CardFooter>
        </Card>
    );
}

function Step2({ onBack, selectedPipeline }: { onBack: () => void, selectedPipeline: string }) {
     return (
        <Card>
            <CardHeader>
                <CardTitle>Build Your Form</CardTitle>
                <CardDescription>Add fields to your form for the "{pipelines.find(p => p.id === selectedPipeline)?.name}" pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground py-20 border-2 border-dashed m-6 rounded-lg">
                <p>Form builder UI will be here.</p>
            </CardContent>
            <CardFooter>
                 <Button onClick={onBack} variant="outline">
                    Back
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function NewFormPage() {
    const [step, setStep] = useState(1);
    const [selectedPipeline, setSelectedPipeline] = useState('');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
                <div>
                     <Button variant="ghost" asChild className="-ml-4">
                        <Link href="/dashboard/crm/sales/forms"><ArrowLeft className="mr-2 h-4 w-4" />Back to Forms</Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3 mt-2">
                        <FileText className="h-8 w-8" />
                        Create New Form
                    </h1>
                </div>
                <div className="flex items-start space-x-8">
                    <StepIndicator currentStep={step} step={1} title="Select Pipeline" />
                    <StepIndicator currentStep={step} step={2} title="Build Form" />
                </div>
            </div>

            {step === 1 && (
                <Step1 
                    onContinue={() => setStep(2)}
                    selectedPipeline={selectedPipeline}
                    setSelectedPipeline={setSelectedPipeline}
                />
            )}

            {step === 2 && (
                <Step2 
                    onBack={() => setStep(1)}
                    selectedPipeline={selectedPipeline}
                />
            )}
        </div>
    );
}
