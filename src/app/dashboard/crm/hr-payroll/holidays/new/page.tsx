import { CrmPageHeader } from '../../../../crm/_components/crm-page-header';
import { HolidayForm } from './holiday-form';

export default function NewHolidayPage() {
    return (
        <div className="space-y-6">
            <CrmPageHeader title="New holiday" />
            <HolidayForm />
        </div>
    );
}
