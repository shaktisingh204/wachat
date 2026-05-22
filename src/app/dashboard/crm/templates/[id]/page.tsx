import * as React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCrmTemplateById } from '@/app/actions/crm-templates.actions';
import { TemplateStudio } from '../_components/template-studio';

interface TemplatePageProps {
    params: {
        id: string;
    };
}

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
    const template = await getCrmTemplateById(params.id);
    return {
        title: template ? `${template.name} | Campaign Designer Studio` : 'Template Builder Studio | SabNode',
        description: 'Design world-class responsive corporate campaigns.',
    };
}

export default async function TemplateEditPage({ params }: TemplatePageProps) {
    const template = await getCrmTemplateById(params.id);
    
    if (!template) {
        redirect('/dashboard/crm/templates');
    }

    return <TemplateStudio initialTemplate={template} />;
}
