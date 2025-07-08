
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
import React from 'react';


type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea' | 'url' | 'tel' | 'radio' | 'checkbox' | 'select' | 'number' | 'date' | 'time' | 'file' | 'password' | 'hidden';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string;
  columnWidth?: string;
};

interface FormBlockRendererProps {
  settings: {
    title?: string;
    description?: string;
    fields?: FormField[];
    submitButtonText?: string;
    buttonSize?: 'sm' | 'default' | 'lg';
    buttonAlign?: 'left' | 'center' | 'right' | 'justify';
    webhookUrl?: string;
    successMessage?: string;
    redirectUrl?: string;
    fieldSpacing?: string;
    fieldColor?: string;
    fieldBgColor?: string;
    fieldBorderColor?: string;
    fieldFocusBorderColor?: string;
    fieldBorderRadius?: string;
    labelColor?: string;
    labelSpacing?: string;
    buttonColor?: string;
    buttonBgColor?: string;
    buttonHoverColor?: string;
    buttonHoverBgColor?: string;
    buttonBorderRadius?: string;
  };
}

export const FormBlockRenderer: React.FC<FormBlockRendererProps> = ({ settings }) => {
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const validationSchema = useMemo(() => {
        const schemaObject: { [key: string]: z.ZodType<any, any> } = {};
        (settings.fields || []).forEach(field => {
            if (field.type === 'hidden') return;
            let fieldSchema: z.ZodType<any, any>;

            switch(field.type) {
                case 'email':
                    fieldSchema = z.string().email({ message: "Invalid email address" });
                    break;
                case 'checkbox':
                    fieldSchema = z.boolean();
                    if(field.required) {
                        fieldSchema = fieldSchema.refine(val => val === true, { message: "This field must be checked" });
                    }
                    break;
                case 'number':
                    fieldSchema = z.string().refine(val => !isNaN(Number(val)), { message: "Must be a number" });
                    break;
                default:
                    fieldSchema = z.string();
            }

            if (field.required && field.type !== 'checkbox') {
                 fieldSchema = (fieldSchema as z.ZodString).min(1, { message: `${field.label} is required` });
            }
            schemaObject[field.id] = field.required ? fieldSchema : fieldSchema.optional();
        });
        return z.object(schemaObject);
    }, [settings.fields]);

    const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
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

    const uniqueId = React.useId();
    
    const fieldStyle: React.CSSProperties = {
        color: settings.fieldColor,
        backgroundColor: settings.fieldBgColor,
        borderColor: settings.fieldBorderColor,
        borderRadius: settings.fieldBorderRadius ? `${settings.fieldBorderRadius}px` : undefined,
    };
    
    const dynamicStyles = `
      #form-${uniqueId} .form-field:focus-within {
        border-color: ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
        box-shadow: 0 0 0 1px ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
      }
      #form-${uniqueId} .submit-button {
        color: ${settings.buttonColor};
        background-color: ${settings.buttonBgColor};
        border-radius: ${settings.buttonBorderRadius ? `${settings.buttonBorderRadius}px` : undefined};
      }
       #form-${uniqueId} .submit-button:hover {
        color: ${settings.buttonHoverColor};
        background-color: ${settings.buttonHoverBgColor};
      }
    `;

    return (
        <Card className="max-w-lg mx-auto" id={`form-${uniqueId}`}>
            <style>{dynamicStyles}</style>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>{settings.title || 'Contact Form'}</CardTitle>
                    {settings.description && <CardDescription>{settings.description}</CardDescription>}
                </CardHeader>
                <CardContent className="grid grid-cols-12" style={{gap: `${settings.fieldSpacing || 24}px`}}>
                    {(settings.fields || []).map(field => {
                        const widthClasses: { [key: string]: string } = {
                            '100%': 'col-span-12', '50%': 'col-span-12 md:col-span-6',
                            '33.33%': 'col-span-12 md:col-span-4', '25%': 'col-span-12 md:col-span-3',
                        };
                        return (
                            <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'])}>
                                <Label htmlFor={field.id} style={{color: settings.labelColor, marginBottom: `${settings.labelSpacing || 8}px`}}>
                                    {field.label} {field.required && '*'}
                                </Label>
                                <Controller
                                    name={field.id}
                                    control={control}
                                    defaultValue={field.type === 'checkbox' ? false : ''}
                                    render={({ field: controllerField }) => {
                                        const commonProps = { ...controllerField, id: field.id, placeholder: field.placeholder, className: 'form-field', style: fieldStyle };
                                        switch(field.type) {
                                            case 'textarea': return <Textarea {...commonProps} />;
                                            case 'select': return (
                                                <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
                                                    <SelectTrigger style={fieldStyle}><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
                                                    <SelectContent>{(field.options || '').split(',').map(o => o.trim()).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                                </Select>
                                            );
                                            case 'checkbox': return <div className="flex items-center gap-2 pt-2"><Checkbox id={field.id} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><Label htmlFor={field.id} className="font-normal" style={{color: settings.labelColor}}>{field.placeholder}</Label></div>;
                                            case 'radio': return (
                                                <RadioGroup onValueChange={controllerField.onChange} defaultValue={controllerField.value} className="flex flex-col gap-2 pt-2">
                                                     {(field.options || '').split(',').map(o => o.trim()).map(opt => (
                                                         <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} id={`${field.id}-${opt}`} /><Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label></div>
                                                     ))}
                                                </RadioGroup>
                                            )
                                            case 'file': return <Input {...commonProps} type="file" />;
                                            default: return <Input {...commonProps} type={field.type} />;
                                        }
                                    }}
                                />
                                {errors[field.id] && <p className="text-sm font-medium text-destructive">{errors[field.id]?.message as string}</p>}
                            </div>
                        )
                    })}
                     {submissionStatus === 'error' && (
                        <div className="col-span-12 p-4 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                            <AlertCircle className="h-4 w-4"/>
                            <p>{errorMessage}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter style={{justifyContent: settings.buttonAlign || 'flex-start'}}>
                    <Button type="submit" size={settings.buttonSize} className="submit-button" disabled={isSubmitting}>
                        {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        {settings.submitButtonText || 'Submit'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};
