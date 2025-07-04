
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone, Users, Newspaper, Wrench, Settings, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

const features = [
    { href: '/dashboard/facebook/ads', icon: Megaphone, title: 'Ads Manager', description: 'Create and monitor Click-to-WhatsApp ads.' },
    { href: '/dashboard/facebook/pages', icon: Newspaper, title: 'Connected Pages', description: 'View all connected Facebook Pages.' },
    { href: '/dashboard/facebook/audiences', icon: Users, title: 'Audiences', description: 'Manage custom and lookalike audiences.' },
    { href: '/dashboard/facebook/all-projects', icon: Wrench, title: 'Project Connections', description: 'Connect your projects to Facebook.' },
    { href: '/dashboard/facebook/settings', icon: Settings, title: 'Connection Settings', description: 'View your connected account IDs.' },
];

export default function FacebookDashboardPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><LayoutGrid/> Facebook Dashboard</h1>
                <p className="text-muted-foreground">Manage your Facebook marketing assets and advertising campaigns.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map(feature => (
                    <Link href={feature.href} key={feature.href} className="block">
                        <Card className="hover:bg-muted transition-colors h-full">
                            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                <feature.icon className="h-6 w-6 text-primary" />
                                <CardTitle className="text-lg">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
