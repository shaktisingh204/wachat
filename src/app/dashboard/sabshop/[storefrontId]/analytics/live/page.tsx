"use client";

import React, { useState, useEffect } from "react";
import { Users, ShoppingCart, Globe, Activity, ArrowUpRight, ArrowDownRight, MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody, CardDescription, CardFooter } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '@/components/sabcrm/20ui';
import { Progress } from '@/components/sabcrm/20ui';

export default function LiveAnalyticsPage() {
  const [activeVisitors, setActiveVisitors] = useState(142);
  const [liveCartTotal, setLiveCartTotal] = useState(12450.50);
  
  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setActiveVisitors((prev) => prev + Math.floor(Math.random() * 5) - 2);
      setLiveCartTotal((prev) => prev + (Math.random() * 50) - 20);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const activeCountries = [
    { name: "United States", visitors: 45, percentage: 32 },
    { name: "United Kingdom", visitors: 28, percentage: 20 },
    { name: "Germany", visitors: 22, percentage: 15 },
    { name: "Canada", visitors: 18, percentage: 13 },
    { name: "Australia", visitors: 12, percentage: 8 },
    { name: "India", visitors: 17, percentage: 12 },
  ].sort((a, b) => b.visitors - a.visitors);

  const topPages = [
    { path: "/products/new-arrivals", visitors: 34 },
    { path: "/checkout", visitors: 22 },
    { path: "/products/summer-sale", visitors: 18 },
    { path: "/", visitors: 15 },
    { path: "/cart", visitors: 12 },
  ];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <PageHeader>
          <PageHeaderHeading>Live Analytics</PageHeaderHeading>
          <PageHeaderDescription>
            Real-time monitoring of your storefront activity.
          </PageHeaderDescription>
        </PageHeader>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-500 bg-green-50 border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            Live Connection
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Visitors
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold">{activeVisitors}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+12%</span> from last hour
            </p>
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Live Cart Total
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold">${liveCartTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <Activity className="h-3 w-3 mr-1 text-blue-500" />
              <span>Updating in real-time</span>
            </p>
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Carts
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold">{Math.floor(activeVisitors * 0.45)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="font-medium">45%</span> of visitors
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Checkouts in Progress
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardBody>
            <div className="text-4xl font-bold">14</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowDownRight className="h-3 w-3 mr-1 text-red-500" />
              <span className="text-red-500 font-medium">-2</span> from last 5 mins
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Active Countries</CardTitle>
            <CardDescription>
              Geographic distribution of your current visitors.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {activeCountries.map((country, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4">
                    <MapPin className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{country.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {country.visitors} active visitors
                    </p>
                  </div>
                  <div className="w-1/3 flex items-center gap-2">
                    <Progress value={country.percentage} className="h-2" />
                    <span className="text-xs font-medium w-8 text-right">{country.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Active Pages</CardTitle>
            <CardDescription>
              Pages with the most active visitors right now.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {topPages.map((page, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-[250px]">
                      {page.path}
                    </span>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {page.visitors}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
              Updated every 5 seconds
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
