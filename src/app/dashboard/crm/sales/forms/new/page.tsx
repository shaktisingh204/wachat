
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Code, CheckCircle, Eye, Plus, Trash2, Heading2, Mail, Type } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { CrmFormPreview } from '@/components/wabasimplify/crm-form-preview';

type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
};

const FieldEditor = ({ field, onUpdate, onRemove }: { field: FormField, onUpdate: (id: string, newField: Partial<FormField>) => void, onRemove: (id: string) => void }) => {
    return (
        <Card className="bg-muted/50">
            <CardHeader className="p-3 flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{field.type.charAt(0).toUpperCase() + field.type.slice(1)} Field</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(field.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
                 <div className="space-y-1.5">
                    <Label htmlFor={`label-${field.id}`} className="text-xs">Label</Label>
                    <Input id={`label-${field.id}`} value={field.label} onChange={e => onUpdate(field.id, { label: e.target.value })} />
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor={`placeholder-${field.id}`} className="text-xs">Placeholder</Label>
                    <Input id={`placeholder-${field.id}`} value={field.placeholder || ''} onChange={e => onUpdate(field.id, { placeholder: e.target.value })} />
                </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={checked => onUpdate(field.id, { required: checked })} />
                    <Label htmlFor={`required-${field.id}`}>Required</Label>
                </div>
            </CardContent>
        </Card>
    );
};


export default function NewCrmFormPage() {
    const [formTitle, setFormTitle] = useState('My New Form');
    const [formDescription, setFormDescription] = useState('Fill out the details below.');
    const [fields, setFields] = useState<FormField[]>([
        { id: uuidv4(), type: 'text', label: 'Name', placeholder: 'Enter your name', required: true },
        { id: uuidv4(), type: 'email', label: 'Email', placeholder: 'Enter your email', required: true },
    ]);

    const addField = (type: FormField['type']) => {
        const newField: FormField = {
            id: uuidv4(),
            type,
            label: `New ${type} Field`,
            required: false,
        };
        setFields(prev => [...prev, newField]);
    };

    const updateField = (id: string, newFieldData: Partial<FormField>) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...newFieldData } : f));
    };

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id));
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b bg-background">
                <div>
                     <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard/crm">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard/crm/sales/forms">All Forms</Link></BreadcrumbLink></BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem><BreadcrumbPage>Create Form</BreadcrumbPage></BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                     <h1 className="text-2xl font-bold font-headline mt-2 flex items-center gap-2">
                        <Link href="/dashboard/crm/sales/forms" className="p-1 rounded-md hover:bg-muted">
                           <ArrowLeft className="h-5 w-5" />
                        </Link>
                        Create Form
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline"><Eye className="mr-2 h-4 w-4" />Preview</Button>
                    <Button><CheckCircle className="mr-2 h-4 w-4" />Publish Form</Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto">
                {/* Form Builder Canvas */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Form Builder</CardTitle>
                            <CardDescription>Drag and drop fields to build your form.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="form-title">Form Title</Label>
                                <Input id="form-title" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="form-description">Description</Label>
                                <Input id="form-description" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
                            </div>
                            <Separator/>
                            <div className="space-y-4">
                                {fields.map(field => (
                                    <FieldEditor key={field.id} field={field} onUpdate={updateField} onRemove={removeField} />
                                ))}
                            </div>
                        </CardContent>
                         <CardFooter>
                            <Card className="w-full">
                                <CardHeader><CardTitle className="text-base">Add a Field</CardTitle></CardHeader>
                                <CardContent className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => addField('text')}><Plus className="mr-2 h-4 w-4"/>Text</Button>
                                    <Button variant="outline" size="sm" onClick={() => addField('email')}><Mail className="mr-2 h-4 w-4"/>Email</Button>
                                    <Button variant="outline" size="sm" onClick={() => addField('textarea')}><Type className="mr-2 h-4 w-4"/>Text Area</Button>
                                </CardContent>
                            </Card>
                        </CardFooter>
                    </Card>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Live Preview</CardTitle></CardHeader>
                        <CardContent className="bg-muted p-4 rounded-lg">
                             <CrmFormPreview title={formTitle} description={formDescription} fields={fields} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Get Shareable Code</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                To embed this form, copy and paste the code below into the HTML code on your website.
                            </p>
                             <Button variant="outline" className="w-full">
                                <Code className="mr-2 h-4 w-4" />
                                Get Code
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
