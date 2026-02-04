
import { ModuleLayout } from "@/components/wabasimplify/module-layout";
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
    const Sidebar = (
        <div className="space-y-4 py-4">
            <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                    SMS Suite
                </h2>
                <div className="space-y-1">
                    {navigation.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="flex items-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <item.icon className="mr-2 h-4 w-4" />
                            {item.name}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <ModuleLayout sidebar={Sidebar}>
            {children}
        </ModuleLayout>
    );
}
