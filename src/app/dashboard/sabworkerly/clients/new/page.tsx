import React from 'react';
import { PageHeader, PageTitle } from '@/components/sabcrm/20ui';
import { ClientForm } from './_form';

export default function NewClientPage() {
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Add client</PageTitle>
            </PageHeader>
            <ClientForm />
        </div>
    );
}
