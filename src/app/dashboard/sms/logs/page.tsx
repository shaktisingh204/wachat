
import SmsLogsTable from "./sms-logs-table";

export default function SmsLogsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Sending History</h1>
            <SmsLogsTable />
        </div>
    );
}
