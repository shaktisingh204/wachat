'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Card, ZoruCardHeader as CardHeader, ZoruCardTitle as CardTitle, ZoruCardContent as CardContent } from '@/components/zoruui';
import { CrmFormBuilder } from '@/components/zoruui-domain/crm-form-builder';
import { FileText, UserPlus, FileSignature, ArrowRight } from 'lucide-react';

const TEMPLATES = [
    {
        id: 'blank',
        name: 'Blank Form',
        description: 'Start from scratch with an empty form.',
        icon: FileText,
        fields: []
    },
    {
        id: 'contact_us',
        name: 'Contact Us',
        description: 'Basic contact form with name, email, and message.',
        icon: FileSignature,
        fields: [
            { id: 'f1', type: 'text', label: 'Full Name', required: true },
            { id: 'f2', type: 'email', label: 'Email Address', required: true },
            { id: 'f3', type: 'textarea', label: 'Message', required: true }
        ]
    },
    {
        id: 'lead_gen',
        name: 'Lead Generation',
        description: 'Capture detailed lead information.',
        icon: UserPlus,
        fields: [
            { id: 'f1', type: 'text', label: 'First Name', required: true },
            { id: 'f2', type: 'text', label: 'Last Name', required: true },
            { id: 'f3', type: 'email', label: 'Work Email', required: true },
            { id: 'f4', type: 'text', label: 'Company', required: false },
            { id: 'f5', type: 'text', label: 'Job Title', required: false }
        ]
    }
];

export function NewFormWizard() {
    const [step, setStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
    const [formName, setFormName] = useState('New Form');
    const [isComplete, setIsComplete] = useState(false);

    const handleNext = () => {
        if (step === 1) setStep(2);
        else if (step === 2 && formName.trim()) setIsComplete(true);
    };

    if (isComplete) {
        // Construct the initial form object based on template
        const initialForm = {
            _id: 'temp_new', // handled in saveCrmForm
            name: formName,
            settings: {
                title: formName,
                submitButtonText: 'Submit',
                fields: selectedTemplate.fields
            }
        } as any;

        return <CrmFormBuilder initialForm={initialForm} />;
    }

    return (
        <div className="w-full p-6 mt-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">Create New Form</h1>
                <p className="text-muted-foreground mt-2">
                    {step === 1 ? 'Choose a template to get started quickly.' : 'Give your form a memorable name.'}
                </p>
            </div>

            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {TEMPLATES.map(t => {
                        const Icon = t.icon;
                        const isSelected = selectedTemplate.id === t.id;
                        return (
                            <Card 
                                key={t.id} 
                                className={`cursor-pointer transition-all hover:border-primary ${isSelected ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                onClick={() => setSelectedTemplate(t)}
                            >
                                <CardHeader>
                                    <Icon className="w-8 h-8 mb-2 text-primary" />
                                    <CardTitle className="text-lg">{t.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{t.description}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {step === 2 && (
                <div className="max-w-md">
                    <Label className="text-base mb-2 block">Form Name</Label>
                    <Input 
                        value={formName} 
                        onChange={(e) => setFormName(e.target.value)} 
                        placeholder="e.g., Q3 Marketing Lead Gen"
                        className="text-lg"
                        autoFocus
                    />
                </div>
            )}

            <div className="mt-10 flex items-center justify-between">
                <Button 
                    variant="outline" 
                    onClick={() => setStep(1)} 
                    disabled={step === 1}
                >
                    Back
                </Button>
                <Button 
                    variant="obsidian" 
                    onClick={handleNext}
                    disabled={step === 2 && !formName.trim()}
                >
                    {step === 1 ? 'Next Step' : 'Create Form'} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
