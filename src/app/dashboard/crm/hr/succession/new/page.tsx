import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { SuccessionForm } from './succession-form';

export default function NewSuccessionPage() {
    return (
        <div className="space-y-6">
            <CrmPageHeader title="New succession plan" />
            <SuccessionForm />
        </div>
    );
}
