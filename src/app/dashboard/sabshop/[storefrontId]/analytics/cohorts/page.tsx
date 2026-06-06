"use client";

import React from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription 
} from "@/components/sabcrm/20ui/zoru/card";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "@/components/sabcrm/20ui/zoru/page-header";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/sabcrm/20ui/zoru/table";
import { DollarSign, UserCheck, BarChart3, TrendingUp } from "lucide-react";

export default function CohortsPage() {
  // Generate mock cohort data
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const cohortData = [
    { month: "Jan 2026", users: 1240, retention: [100, 45, 32, 28, 25, 22, 18] },
    { month: "Feb 2026", users: 1450, retention: [100, 48, 35, 31, 28, 24, null] },
    { month: "Mar 2026", users: 1820, retention: [100, 52, 38, 33, 29, null, null] },
    { month: "Apr 2026", users: 2100, retention: [100, 55, 41, 36, null, null, null] },
    { month: "May 2026", users: 2450, retention: [100, 58, 44, null, null, null, null] },
    { month: "Jun 2026", users: 2890, retention: [100, 62, null, null, null, null, null] },
    { month: "Jul 2026", users: 3200, retention: [100, null, null, null, null, null, null] },
  ];

  // Helper to determine cell color based on retention percentage
  const getCellColor = (value: number | null) => {
    if (value === null) return "bg-transparent";
    if (value === 100) return "bg-blue-600 text-white font-medium";
    if (value >= 60) return "bg-blue-500 text-white";
    if (value >= 50) return "bg-blue-400 text-white";
    if (value >= 40) return "bg-blue-300 text-slate-800";
    if (value >= 30) return "bg-blue-200 text-slate-800";
    if (value >= 20) return "bg-blue-100 text-slate-800";
    return "bg-blue-50 text-slate-800";
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-7xl mx-auto">
      <PageHeader>
        <PageHeaderHeading>Cohorts & Retention</PageHeaderHeading>
        <PageHeaderDescription>
          Analyze customer lifecycle, retention rates, and Lifetime Value (LTV).
        </PageHeaderDescription>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$485.50</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+8%</span> vs last year
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Orders/Customer</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3.2</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+0.4</span> vs last year
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day 30 Retention</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">52.4%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+12%</span> vs last year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Purchase Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">38%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+4%</span> vs last year
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Customer Retention Matrix</CardTitle>
          <CardDescription>
            Percentage of customers returning in subsequent months after their first purchase.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Cohort</TableHead>
                <TableHead className="w-[100px] text-right">Users</TableHead>
                {months.map((_, i) => (
                  <TableHead key={i} className="text-center w-[80px]">Month {i}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohortData.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right font-medium">{row.users.toLocaleString()}</TableCell>
                  {row.retention.map((val, j) => (
                    <TableCell key={j} className="p-1 text-center">
                      {val !== null ? (
                        <div className={`w-full h-10 flex items-center justify-center rounded-sm text-sm ${getCellColor(val)}`}>
                          {val}%
                        </div>
                      ) : (
                        <div className="w-full h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-sm text-slate-400 text-sm">
                          -
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
