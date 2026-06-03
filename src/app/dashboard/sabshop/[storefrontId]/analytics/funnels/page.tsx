"use client";

import React from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  CardFooter
} from "@/components/zoruui/card";
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "@/components/zoruui/page-header";
import { Progress } from "@/components/zoruui/progress";
import { 
  ShoppingCart, 
  CreditCard, 
  CheckCircle2,
  MousePointerClick,
  Eye,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { Badge } from "@/components/zoruui/badge";
import { Separator } from "@/components/zoruui/separator";

export default function FunnelsPage() {
  const funnelSteps = [
    {
      id: "view",
      name: "Product Views",
      icon: Eye,
      count: 45200,
      dropoff: null,
      conversionFromPrevious: null,
      color: "bg-slate-500",
      trend: "+12%"
    },
    {
      id: "click",
      name: "Product Clicks",
      icon: MousePointerClick,
      count: 18450,
      dropoff: 26750,
      conversionFromPrevious: 40.8,
      color: "bg-blue-500",
      trend: "+8%"
    },
    {
      id: "cart",
      name: "Add to Cart",
      icon: ShoppingCart,
      count: 6200,
      dropoff: 12250,
      conversionFromPrevious: 33.6,
      color: "bg-indigo-500",
      trend: "+15%"
    },
    {
      id: "checkout",
      name: "Initiate Checkout",
      icon: CreditCard,
      count: 3100,
      dropoff: 3100,
      conversionFromPrevious: 50.0,
      color: "bg-purple-500",
      trend: "-2%"
    },
    {
      id: "purchase",
      name: "Successful Purchase",
      icon: CheckCircle2,
      count: 1850,
      dropoff: 1250,
      conversionFromPrevious: 59.6,
      color: "bg-green-500",
      trend: "+5%"
    }
  ];

  const maxCount = funnelSteps[0].count;
  const overallConversion = ((funnelSteps[funnelSteps.length - 1].count / maxCount) * 100).toFixed(2);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader className="pb-0">
          <PageHeaderHeading>Conversion Funnels</PageHeaderHeading>
          <PageHeaderDescription>
            Track user journey from product discovery to final purchase.
          </PageHeaderDescription>
        </PageHeader>
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div>
              <p className="text-sm font-medium opacity-80">Overall Conversion</p>
              <p className="text-3xl font-bold">{overallConversion}%</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Main Purchase Funnel</CardTitle>
            <CardDescription>
              Last 30 days of data across all active campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row h-full rounded-b-xl overflow-hidden">
              {funnelSteps.map((step, index) => {
                const isLast = index === funnelSteps.length - 1;
                const percentageOfTotal = (step.count / maxCount) * 100;
                
                return (
                  <div key={step.id} className="flex-1 flex flex-col relative group">
                    <div className="p-6 flex-1 border-b md:border-b-0 md:border-r border-border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${step.color} bg-opacity-10 dark:bg-opacity-20`}>
                          <step.icon className={`h-5 w-5 ${step.color.replace('bg-', 'text-')}`} />
                        </div>
                        <Badge variant={step.trend.startsWith('+') ? 'default' : 'destructive'} className="text-xs font-normal">
                          {step.trend.startsWith('+') ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {step.trend}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-lg mb-1">{step.name}</h3>
                      <div className="text-3xl font-bold mb-6">{step.count.toLocaleString()}</div>
                      
                      <div className="space-y-2 mt-auto">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Of Total</span>
                          <span className="font-medium">{percentageOfTotal.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentageOfTotal} className={`h-2 ${step.color.replace('bg-', 'text-')}`} />
                      </div>
                      
                      {index > 0 && (
                        <div className="mt-6 pt-4 border-t border-border/50">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">From Previous</span>
                            <span className="font-medium text-green-500">{step.conversionFromPrevious}%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Drop-off</span>
                            <span className="text-red-500 font-medium">-{step.dropoff?.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {!isLast && (
                      <div className="hidden md:flex absolute top-1/2 -right-4 z-10 -translate-y-1/2 bg-background border border-border rounded-full p-1.5 shadow-sm">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Drop-off Analysis</CardTitle>
              <CardDescription>Where users are leaving the funnel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {funnelSteps.slice(1).map((step, i) => {
                  const dropoffPercent = step.dropoff ? (step.dropoff / funnelSteps[i].count * 100).toFixed(1) : "0";
                  return (
                    <div key={step.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{funnelSteps[i].name} → {step.name}</span>
                        </div>
                        <span className="text-sm text-red-500 font-medium">
                          {dropoffPercent}% drop
                        </span>
                      </div>
                      <Progress value={Number(dropoffPercent)} className="h-2 [&>div]:bg-red-500" />
                      <p className="text-xs text-muted-foreground text-right">
                        {step.dropoff?.toLocaleString()} users lost
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Optimization Opportunities</CardTitle>
              <CardDescription>AI-generated insights to improve conversion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50">
                  <h4 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    High Cart Abandonment
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    50% of users who add to cart do not initiate checkout. Consider sending automated abandoned cart emails with a 5% discount code within 2 hours.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4" />
                    Checkout Friction
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Drop-off between checkout initiation and purchase is 40.4%. Adding a guest checkout option and Apple/Google Pay could improve this by an estimated 12%.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Additional icons needed for the lower section
import { AlertTriangle, Lightbulb } from "lucide-react";
