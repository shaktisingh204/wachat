
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { LoaderCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';


type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea' | 'dropdown' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string;
};

interface FormBlockRendererProps {
  settings: {
    title?: string;
    description?: string;
    fields?: FormField[];
    submitButtonText?: string;
    webhookUrl?: string;
    successMessage?: string;
    redirectUrl?: string;
  };
}

export const FormBlockRenderer: React.FC<FormBlockRendererProps> = ({ settings }) => {
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const validationSchema = useMemo(() => {
        const schemaObject: { [key: string]: z.ZodType<any, any> } = {};
        (settings.fields || []).forEach(field => {
            let fieldSchema: z.ZodType<any, any>;
            switch(field.type) {
                case 'email':
                    fieldSchema = z.string().email({ message: "Invalid email address" });
                    break;
                case 'checkbox':
                    fieldSchema = z.boolean();
                    if(field.required) {
                        fieldSchema = fieldSchema.refine(val => val === true, { message: "This field is required" });
                    }
                    break;
                default:
                    fieldSchema = z.string();
            }

            if (field.required && field.type !== 'checkbox') {
                 fieldSchema = (fieldSchema as z.ZodString).min(1, { message: `${field.label} is required` });
            }
            schemaObject[field.id] = fieldSchema;
        });
        return z.object(schemaObject);
    }, [settings.fields]);

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(validationSchema)
    });

    const onSubmit = async (data: any) => {
        setSubmissionStatus('submitting');
        setErrorMessage('');
        
        try {
            if (settings.webhookUrl) {
                const response = await fetch(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) {
                    throw new Error(`Submission failed with status: ${response.status}`);
                }
            }
            setSubmissionStatus('success');
            if (settings.redirectUrl) {
                window.location.href = settings.redirectUrl;
            }
        } catch (error: any) {
            setSubmissionStatus('error');
            setErrorMessage(error.message || "An unknown error occurred.");
        }
    };
    
    if (submissionStatus === 'success') {
        return (
             <div className="p-8 text-center border-2 border-dashed rounded-lg text-green-600 border-green-200 bg-green-50">
                <CheckCircle className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">{settings.successMessage || 'Submission successful!'}</h3>
            </div>
        )
    }

    return (
        <Card className="max-w-lg mx-auto">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>{settings.title || 'Contact Form'}</CardTitle>
                    {settings.description && <CardDescription>{settings.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-6">
                    {(settings.fields || []).map(field => (
                        <div key={field.id} className="space-y-2">
                             <Label htmlFor={field.id}>{field.label} {field.required && '*'}</Label>
                             <Controller
                                name={field.id}
                                control={control}
                                defaultValue={field.type === 'checkbox' ? false : ''}
                                render={({ field: controllerField }) => {
                                    switch(field.type) {
                                        case 'textarea': return <Textarea {...controllerField} id={field.id} placeholder={field.placeholder} />;
                                        case 'dropdown': return (
                                            <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
                                                <SelectTrigger><SelectValue placeholder={field.placeholder || "Select an option"} /></SelectTrigger>
                                                <SelectContent>{(field.options || '').split(',').map(o => o.trim()).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                            </Select>
                                        );
                                        case 'checkbox': return <div className="flex items-center gap-2 pt-2"><Checkbox id={field.id} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><Label htmlFor={field.id} className="font-normal">{field.placeholder}</Label></div>;
                                        default: return <Input {...controllerField} id={field.id} type={field.type} placeholder={field.placeholder} />;
                                    }
                                }}
                             />
                             {errors[field.id] && <p className="text-sm font-medium text-destructive">{errors[field.id]?.message as string}</p>}
                        </div>
                    ))}
                     {submissionStatus === 'error' && (
                        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                            <AlertCircle className="h-4 w-4"/>
                            <p>{errorMessage}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={submissionStatus === 'submitting'}>
                        {submissionStatus === 'submitting' && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        {settings.submitButtonText || 'Submit'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};

    