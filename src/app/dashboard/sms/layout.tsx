
import { ModuleLayout } from "@/components/layouts/module-layout";
import { MessageSquare, FileText, Settings, LayoutGrid, LucideIcon } from "lucide-react";

const navigation = [
    {
        name: 'Overview',
        href: '/dashboard/sms',
        icon: LayoutGrid,
        exact: true
    },
    {
        name: 'Campaigns',
        href: '/dashboard/sms/campaigns',
        icon: MessageSquare
    },
    {
        name: 'DLT Templates',
        href: '/dashboard/sms/templates',
        icon: FileText
    },
    {
        name: 'Configuration',
        href: '/dashboard/sms/config',
        icon: Settings
    }
] as { name: string; href: string; icon: LucideIcon; exact?: boolean }[];

export default function SmsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ModuleLayout
            moduleName="SMS Suite"
            navigation={navigation}
        >
            {children}
        </ModuleLayout>
    );
}
