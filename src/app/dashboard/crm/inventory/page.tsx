
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart, Clock, AlertTriangle, Package } from 'lucide-react';
import {Calendar} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function InventoryDashboardPage() {
    return (
        <div className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Stock Value" value="$0" icon={BarChart} />
                <StatCard title="Low Stock Items" value="0" icon={AlertTriangle}/>
                <StatCard title="Items Out of Stock" value="0" icon={Package} />
                <StatCard title="Avg. Stock Days" value="0" icon={Clock} />
            </div>
             <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Reports Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Advanced inventory reports are under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
