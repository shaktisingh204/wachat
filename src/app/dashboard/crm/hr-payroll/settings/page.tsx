
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, CalendarDays, Percent, Bell, Shield, Settings } from 'lucide-react';

const PlaceholderCard = ({ title, description }: { title: string, description: string }) => (
    <Card className="text-center py-16">
        <CardHeader>
            <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                <Settings className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This feature is under development and will be available soon.</p>
        </CardContent>
    </Card>
);

export default function HrmSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Settings className="h-8 w-8" />
                        HRM Settings
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Configure payroll, attendance, leave, compliance, and notification rules for your organization.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="pay_cycle" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    <TabsTrigger value="pay_cycle"><CalendarDays className="mr-2 h-4 w-4"/>Pay Cycle</TabsTrigger>
                    <TabsTrigger value="attendance"><ListChecks className="mr-2 h-4 w-4"/>Attendance</TabsTrigger>
                    <TabsTrigger value="leave_policy"><CalendarDays className="mr-2 h-4 w-4"/>Leave Policy</TabsTrigger>
                    <TabsTrigger value="tax_deduction"><Percent className="mr-2 h-4 w-4"/>Tax & Deductions</TabsTrigger>
                    <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4"/>Notifications</TabsTrigger>
                    <TabsTrigger value="access_control"><Shield className="mr-2 h-4 w-4"/>Access Control</TabsTrigger>
                </TabsList>
                <TabsContent value="pay_cycle" className="mt-6">
                    <PlaceholderCard title="Pay Cycle Configuration" description="Define your company's pay period (e.g., monthly, weekly) and payroll processing dates." />
                </TabsContent>
                <TabsContent value="attendance" className="mt-6">
                    <PlaceholderCard title="Attendance Rules" description="Set rules for late entry, early exit, overtime, and shift timings." />
                </TabsContent>
                <TabsContent value="leave_policy" className="mt-6">
                    <PlaceholderCard title="Leave Policy Setup" description="Create and assign different leave types like Casual Leave (CL), Sick Leave (SL), and Paid Leave (PL)." />
                </TabsContent>
                <TabsContent value="tax_deduction" className="mt-6">
                    <PlaceholderCard title="Tax & Deduction Rules" description="Manage formulas and rules for all statutory and custom deductions and allowances." />
                </TabsContent>
                <TabsContent value="notifications" className="mt-6">
                    <PlaceholderCard title="Notification Settings" description="Configure email and SMS notification templates for HR-related events." />
                </TabsContent>
                <TabsContent value="access_control" className="mt-6">
                     <PlaceholderCard title="Role-based Access Control" description="Define permissions and roles for different users within the HR module." />
                </TabsContent>
            </Tabs>
        </div>
    );
}
