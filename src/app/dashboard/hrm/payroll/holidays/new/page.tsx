import { EntityListShell } from '@/components/crm/entity-list-shell';
import { HolidayForm } from './holiday-form';

export default function NewHolidayPage() {
    return (
        <EntityListShell title="New holiday">
            <HolidayForm />
        </EntityListShell>
    );
}
