import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { NewFormWizard } from './new-form-wizard';
import { getCrmForms } from '@/app/actions/crm-forms.actions';
import { getSession } from '@/app/actions/user.actions';
import { AlertCircle } from 'lucide-react';

function NewFormSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <Skeleton className="h-16 w-full" />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_420px] gap-0 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1 p-4">
                    <Skeleton className="h-full w-full" />
                </div>
                <div className="hidden lg:block p-4">
                    <Skeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    );
}

export default async function NewCrmFormPage() {
    const session = await getSession();
    if (!session?.user) return null;

    // Strict check for tenant quota limits
    const { total } = await getCrmForms(1, 1);
    
    // Check plan limit; fallback to 5 if undefined.
    const formLimit = session.user.plan?.appLimits?.crm?.forms ?? 5;

    if (total >= formLimit) {
        return (
            <div className="w-full p-12 text-center mt-20">
                <AlertCircle className="w-16 h-16 text-zoru-ink mx-auto mb-6" />
                <h1 className="text-3xl font-bold text-zoru-ink mb-4">Quota Exceeded</h1>
                <p className="text-lg text-zoru-ink-muted mb-8">
                    You have reached your limit of {formLimit} CRM forms for your current plan. 
                    Please upgrade your plan to create more forms.
                </p>
            </div>
        );
    }

    return (
        <Suspense fallback={<NewFormSkeleton />}>
            <NewFormWizard />
        </Suspense>
    );
}
