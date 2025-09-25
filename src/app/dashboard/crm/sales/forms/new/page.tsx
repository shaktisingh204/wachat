
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, CheckCircle, Eye } from 'lucide-react';
import { CrmFormPreview } from '@/components/wabasimplify/crm-form-preview';
import { WebsiteBlockEditor } from '@/components/wabasimplify/website-builder/website-block-editor';
import { Separator } from '@/components/ui/separator';

export default function NewCrmFormPage() {
    const [settings, setSettings] = useState({
        title: 'My New Form',
        description: 'Fill out the details below.',
        fields: [
            { id: 'field_name', type: 'text', label: 'Name', placeholder: 'Enter your name', required: true, columnWidth: '100%' },
            { id: 'field_email', type: 'email', label: 'Email', placeholder: 'Enter your email', required: true, columnWidth: '100%' },
        ],
        submitButtonText: 'Submit',
    });

    const handleUpdate = (id: string, newSettings: any) => {
        // In the context of a single form editor, the 'id' is not used, but we keep the signature
        // consistent with the block editor which can manage multiple blocks.
        setSettings(newSettings);
    };

    const handleRemove = (id: string) => {
        // This function is required by the editor but doesn't make sense for a single form.
        // We'll just log it for now.
        console.log(`Remove action called for block ${id}, but not applicable here.`);
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b bg-background">
                <div>
                     <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
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

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_380px] gap-0 min-h-0">
                {/* Form Builder Canvas */}
                <div className="lg:col-span-2 xl:col-span-1 bg-muted/30 p-4 sm:p-6 md:p-8 overflow-y-auto">
                   <CrmFormPreview
                        title={settings.title}
                        description={settings.description}
                        fields={settings.fields}
                        settings={settings}
                   />
                </div>

                {/* Right Sidebar */}
                <div className="hidden lg:block lg:col-span-1 xl:col-span-1 bg-background border-l overflow-y-auto">
                    <WebsiteBlockEditor
                        selectedBlock={{ id: 'form-editor', type: 'form', settings: settings, children: [] }}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                        availableProducts={[]}
                    />
                </div>
            </main>
        </div>
    );
}
