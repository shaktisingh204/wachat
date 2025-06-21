import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AnalyticsChart } from '@/components/wabasimplify/analytics-chart';
import { ArrowDown, ArrowUp, MessagesSquare, CheckCircle, XCircle } from 'lucide-react';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | WABASimplify",
};


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your message analytics overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,543</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.2%</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUp className="h-3 w-3 text-primary mr-1" />
              +1.2% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Read</CardTitle>
             <CheckCircle className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">75.6%</div>
             <p className="text-xs text-muted-foreground flex items-center">
              <ArrowUp className="h-3 w-3 text-primary mr-1" />
              +5.4% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.8%</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <ArrowDown className="h-3 w-3 text-destructive mr-1" />
              -0.2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message Performance</CardTitle>
          <CardDescription>Performance of your broadcast messages over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsChart />
        </CardContent>
      </Card>
    </div>
  );
}
