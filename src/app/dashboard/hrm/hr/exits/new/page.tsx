import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { ExitForm } from './exit-form';

export default function NewExitPage() {
    return (
        <div className="space-y-6">
            <CrmPageHeader title="New exit" />
            <ExitForm />
        </div>
    );
}
