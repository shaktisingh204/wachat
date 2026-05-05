
import SmsLogsTable from "./sms-logs-table";
import {
    ZoruPageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
} from '@/components/zoruui';

export default function SmsLogsPage() {
    return (
        <div className="space-y-6">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Sending History</ZoruPageTitle>
                </ZoruPageHeading>
            </ZoruPageHeader>
            <SmsLogsTable />
        </div>
    );
}
