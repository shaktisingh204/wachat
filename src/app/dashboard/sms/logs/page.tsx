import { ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import SmsLogsTable from "./sms-logs-table";

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
