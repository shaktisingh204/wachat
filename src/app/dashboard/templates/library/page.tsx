
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { premadeTemplates } from '@/lib/premade-templates';
import type { Template } from '@/app/dashboard/page';
import { BookCopy, ChevronLeft, ImageIcon, Phone, Link as LinkIcon, Star } from 'lucide-react';
import Link from 'next/link';

// New component for the WhatsApp-like preview
const TemplatePreviewCard = ({ template, onUse }: { template: Omit<Template, 'metaId' | 'status' | 'qualityScore'>, onUse: (template: any) => void }) => {
    const headerComponent = template.components.find(c => c.type === 'HEADER');
    const footerComponent = template.components.find(c => c.type === 'FOOTER');
    const buttons = template.components.find(c => c.type === 'BUTTONS')?.buttons || [];

    const renderTextWithVariables = (text: string) => {
        if (!text) return null;
        // Simple regex to find {{...}} and style them.
        const parts = text.split(/({{\d+}})/g);
        return parts.map((part, i) =>
            part.match(/{{\d+}}/) ? (
                <span key={i} className="font-bold text-blue-500">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    const getButtonIcon = (type: string) => {
        switch(type) {
            case 'URL': return <LinkIcon className="h-4 w-4 mr-2" />;
            case 'PHONE_NUMBER': return <Phone className="h-4 w-4 mr-2" />;
            case 'QUICK_REPLY': return <Star className="h-4 w-4 mr-2" />;
            default: return null;
        }
    }

    return (
        <Card className="flex flex-col">
             <CardHeader>
                <CardTitle className="text-base">{template.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</CardTitle>
                <CardDescription>A pre-built template for {template.category.replace(/_/g, ' ').toLowerCase()} use cases.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center bg-slate-200 p-4 rounded-md border">
                {/* The WhatsApp-like message bubble */}
                <div className="w-full max-w-sm mx-auto">
                    <div className="bg-[#dcf8c6] rounded-lg shadow-sm p-3 text-sm text-gray-800 space-y-2">
                        {/* Header */}
                        {headerComponent && (headerComponent.format === 'IMAGE' || headerComponent.format === 'VIDEO' || headerComponent.format === 'DOCUMENT') && (
                            <div className="bg-slate-300 aspect-video rounded-md flex items-center justify-center mb-2">
                                <ImageIcon className="h-10 w-10 text-slate-500" />
                            </div>
                        )}
                        {headerComponent && headerComponent.format === 'TEXT' && (
                            <h3 className="font-bold text-base mb-1">{headerComponent.text}</h3>
                        )}
                        {/* Body */}
                        <p className="whitespace-pre-wrap">
                            {renderTextWithVariables(template.body)}
                        </p>
                        {/* Footer */}
                        {footerComponent && (
                            <p className="text-xs text-gray-500 pt-1">
                                {footerComponent.text}
                            </p>
                        )}
                    </div>
                    {/* Buttons */}
                    {buttons.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {buttons.map((button: any, index: number) => (
                                <div key={index} className="bg-white rounded-lg text-center p-2 text-blue-500 font-medium shadow-sm border flex items-center justify-center">
                                    {getButtonIcon(button.type)}
                                    {button.text}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
             <CardFooter className="mt-auto pt-6">
                <Button className="w-full" onClick={() => onUse(template)}>
                    Use This Template
                </Button>
            </CardFooter>
        </Card>
    );
};


export default function TemplateLibraryPage() {
    const router = useRouter();

    const handleUseTemplate = (template: Omit<Template, 'metaId' | 'status' | 'qualityScore'>) => {
        // We pass the template data to the create page via localStorage
        localStorage.setItem('templateToAction', JSON.stringify(template));
        router.push('/dashboard/templates/create?action=clone');
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/templates">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to My Templates
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BookCopy className="h-8 w-8" />
                        Template Library
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Browse pre-made, high-quality templates to get started quickly.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {premadeTemplates.map((template, index) => (
                    <TemplatePreviewCard key={index} template={template} onUse={handleUseTemplate} />
                ))}
            </div>
        </div>
    );
}
