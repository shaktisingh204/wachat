
import { notFound } from 'next/navigation';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { EmbeddedForm } from '@/components/wabasimplify/embedded-form';

export default async function EmbeddedCrmFormPage({ params }: { params: { formId: string } }) {
    if (!params.formId) {
        notFound();
    }
    
    const form = await getCrmFormById(params.formId);

    if (!form) {
        notFound();
    }

    return (
        <main className="bg-transparent">
            <EmbeddedForm form={form} />
        </main>
    );
}
