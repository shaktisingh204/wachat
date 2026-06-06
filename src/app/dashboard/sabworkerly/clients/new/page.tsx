import React from 'react';
import { PageHeader, ZoruPageTitle } from '@/components/sabcrm/20ui/compat';
import { ClientForm } from './_form';

export default function NewClientPage() {
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Add client</ZoruPageTitle>
            </PageHeader>
            <ClientForm />
        </div>
    );
}
