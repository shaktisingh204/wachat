
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { LoaderCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import type { FormField, WithId, CrmForm } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';

interface EmbeddedFormProps {
  form: WithId<CrmForm>;
}

export const EmbeddedForm: React.FC<EmbeddedFormProps> = ({ form }) => {
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const containerRef = useRef<HTMLDivElement>(null);
    const settings = form.settings || {};

    // Notify parent window of height changes
    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const height = entry.contentRect.height;
                    window.parent.postMessage({ type: 'sabnodeFormHeight', height: height, formId: form._id.toString() }, '*');
                }
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [form._id]);

    const validationSchema = useMemo(() => {
        const schemaObject: { [key: string]: z.ZodType<any, any> } = {};
        (settings.fields || []).forEach((field: FormField) => {
            if (field.type === 'hidden' || field.type === 'html') return;
            const fieldName = field.fieldId || field.id;
            let fieldSchema: z.ZodType<any, any>;

            switch(field.type) {
                case 'email': fieldSchema = z.string().email({ message: "Invalid email address" }); break;
                case 'url': fieldSchema = z.string().url({ message: "Invalid URL" }); break;
                case 'number': fieldSchema = z.string().refine(val => !val || !isNaN(Number(val)), { message: "Must be a number" }); break;
                case 'checkbox':
                    fieldSchema = z.boolean();
                    if(field.required) fieldSchema = fieldSchema.refine(val => val === true, { message: `${field.label} is required` });
                    break;
                case 'acceptance':
                    fieldSchema = z.boolean().refine(val => val === true, { message: `You must accept the terms.` });
                    break;
                case 'select':
                    if (field.multiple) fieldSchema = z.array(z.string()).nonempty({ message: `${field.label} is required` });
                    else fieldSchema = z.string();
                    break;
                default: fieldSchema = z.string();
            }

            if (field.required && !['checkbox', 'acceptance', 'select'].includes(field.type)) {
                 if (fieldSchema instanceof z.ZodString) {
                    fieldSchema = fieldSchema.min(1, { message: `${field.label} is required` });
                }
            } else if (!field.required) {
                 fieldSchema = fieldSchema.optional();
            }

            schemaObject[fieldName] = fieldSchema;
        });
        return z.object(schemaObject);
    }, [settings.fields]);
    
    const formHook = useForm<z.infer<typeof validationSchema>>({
        resolver: zodResolver(validationSchema),
        defaultValues: (settings.fields || []).reduce((acc: any, field: FormField) => {
            const fieldName = field.fieldId || field.id;
            acc[fieldName] = field.defaultValue || (field.type === 'checkbox' || field.type === 'acceptance' ? false : (field.multiple ? [] : ''));
            return acc;
        }, {})
    });
    
    const { control, handleSubmit, formState: { errors } } = formHook;

    async function onSubmit(data: z.infer<typeof validationSchema>) {
        startTransition(async () => {
            setSubmissionStatus('submitting');
            setErrorMessage('');
            try {
                // Correctly clone the data to prevent mutation errors on read-only objects
                const dataToSend = JSON.parse(JSON.stringify(data));
                
                const response = await fetch(`/api/crm/forms/submit/${form._id.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend),
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Submission failed.');
                }
                setSuccessMessage(result.message || 'Thank you! Your submission has been received.');
            } catch (error: any) {
                setSubmissionStatus('error');
                setErrorMessage(error.message || "An unknown error occurred.");
            }
        });
    }

    if (successMessage) {
        return <div ref={containerRef} className="p-8 text-center border-2 border-dashed rounded-lg text-green-600 border-green-200 bg-green-50"><CheckCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">{successMessage}</h3></div>;
    }

    const uniqueId = `form-${form._id.toString()}`;
    const dynamicStyles = `
      body { background-color: transparent !important; }
      #${uniqueId} {
        max-width: ${settings.formWidth || 480}px;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      #${uniqueId} .form-field {
        color: ${settings.fieldColor || 'inherit'};
        background-color: ${settings.fieldBgColor || 'transparent'};
        border-color: ${settings.fieldBorderColor || 'hsl(var(--input))'};
        border-radius: ${settings.fieldBorderRadius}px;
        padding: ${settings.fieldPadding}px;
        font-family: ${settings.fieldTypography?.fontFamily};
        border-width: ${settings.fieldBorderWidth || 1}px;
        border-style: ${settings.fieldBorderType || 'solid'};
      }
      #${uniqueId} .form-field:focus {
        border-color: ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
        box-shadow: 0 0 0 1px ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
      }
      #${uniqueId} .submit-button {
        color: ${settings.buttonColor || 'hsl(var(--primary-foreground))'};
        background-color: ${settings.buttonBgColor || 'hsl(var(--primary))'};
        font-family: ${settings.buttonTypography?.fontFamily};
        border-radius: ${settings.buttonBorderRadius}px;
        padding: ${settings.buttonPadding}px;
        border-style: ${settings.buttonBorderType || 'none'};
        box-shadow: ${settings.buttonBoxShadow === 'none' ? 'none' : 'var(--tw-shadow)'};
      }
       #${uniqueId} .submit-button:hover {
        color: ${settings.buttonHoverColor};
        background-color: ${settings.buttonHoverBgColor};
      }
    `;

    // @ts-ignore
    const SubmitIcon = settings.buttonIcon ? LucideIcons[settings.buttonIcon] : null;

    return (
        <div ref={containerRef} className="p-2">
            <style>{dynamicStyles}</style>
            <div id={uniqueId}>
                <div className="text-center mb-6">
                    {settings.logoUrl && <Image src={settings.logoUrl} alt="Logo" width={80} height={80} className="object-contain mx-auto" />}
                    <h1 className="text-2xl font-bold mt-4">{settings.title || 'Form Title'}</h1>
                    <p className="text-muted-foreground">{settings.description}</p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-12" style={{gap: `${settings.fieldSpacing || 24}px`}}>
                        {(settings.fields || []).map((field: FormField) => {
                            const widthClasses: { [key: string]: string } = { '100%': 'col-span-12', '50%': 'col-span-12 sm:col-span-6', '33.33%': 'col-span-12 sm:col-span-4', '25%': 'col-span-12 sm:col-span-3' };
                            const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];
                            
                            if (field.type === 'hidden') return <Controller key={field.id} name={field.fieldId || field.id} control={control} render={({ field: controllerField }) => <input type="hidden" {...controllerField} />} />;
                            
                            const fieldName = field.fieldId || field.id;

                            return (
                                <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                                    {field.labelPosition !== 'hidden' && <Label htmlFor={fieldName} style={{color: settings.labelColor, fontFamily: settings.labelTypography?.fontFamily, marginBottom: field.labelPosition !== 'inline' ? `${settings.labelSpacing || 8}px` : '0'}} className={cn(field.labelPosition === 'inline' && 'flex-shrink-0', field.type === 'checkbox' && 'hidden')}>{field.label} {field.required && '*'}</Label>}
                                    <div className="w-full">
                                        <Controller
                                            name={fieldName}
                                            control={control}
                                            render={({ field: controllerField }) => {
                                                const commonProps = { ...controllerField, id: fieldName, placeholder: field.placeholder, className: cn('form-field', sizeClasses) };
                                                const fieldOptions = (field.options || '').split('\n').map(o => o.trim());

                                                switch(field.type) {
                                                    case 'textarea': return <Textarea {...commonProps} />;
                                                    case 'select': return <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}><SelectTrigger className={cn('form-field', sizeClasses)}><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger><SelectContent>{fieldOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>;
                                                    case 'checkbox': return <div className="flex items-center gap-2 pt-2"><Checkbox id={fieldName} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><Label htmlFor={fieldName} className="font-normal">{field.label}</Label></div>;
                                                    case 'acceptance': return <div className="flex items-center gap-2 pt-2"><Checkbox id={fieldName} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><Label htmlFor={fieldName} className="font-normal">{field.defaultValue || 'I agree to the terms.'}</Label></div>;
                                                    case 'radio': return <RadioGroup onValueChange={controllerField.onChange} defaultValue={controllerField.value} className="flex flex-col gap-2 pt-2">{fieldOptions.map(opt => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} id={`${fieldName}-${opt}`} /><Label htmlFor={`${fieldName}-${opt}`} className="font-normal">{opt}</Label></div>)}</RadioGroup>
                                                    case 'file': return <Input {...commonProps} type="file" accept={field.allowedFileTypes} multiple={field.multiple} />;
                                                    default: return <Input {...commonProps} type={field.type} />;
                                                }
                                            }}
                                        />
                                        {field.description && <p className="text-xs pt-1" style={{color: settings.descriptionColor, fontFamily: settings.descriptionTypography?.fontFamily}}>{field.description}</p>}
                                        {errors[fieldName] && <p className="text-sm font-medium text-destructive">{errors[fieldName]?.message as string}</p>}
                                    </div>
                                </div>
                            )
                        })}
                        {submissionStatus === 'error' && <div className="col-span-12 p-4 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2"><AlertCircle className="h-4 w-4"/><p>{errorMessage}</p></div>}
                    </div>
                    <div style={{display: 'flex', justifyContent: settings.buttonAlign || 'flex-start', flexDirection: 'column', alignItems: settings.buttonAlign === 'center' ? 'center' : settings.buttonAlign === 'right' ? 'flex-end' : 'flex-start', paddingTop: '1rem' }}>
                        <Button id={settings.buttonId} type="submit" size={settings.buttonSize} className="submit-button" disabled={isPending}>
                            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                            {SubmitIcon && settings.buttonIconPosition === 'left' && <SubmitIcon className="mr-2 h-4 w-4" style={{marginRight: `${settings.buttonIconSpacing || 8}px`, width: settings.buttonIconSize, height: settings.buttonIconSize}}/>}
                            {settings.submitButtonText || 'Submit'}
                            {SubmitIcon && settings.buttonIconPosition === 'right' && <SubmitIcon className="ml-2 h-4 w-4" style={{marginLeft: `${settings.buttonIconSpacing || 8}px`, width: settings.buttonIconSize, height: settings.buttonIconSize}}/>}
                        </Button>
                        {settings.footerText && <p className="text-xs text-muted-foreground text-center pt-2" dangerouslySetInnerHTML={{ __html: settings.footerText }}></p>}
                    </div>
                </form>
            </div>
        </div>
    );
};
