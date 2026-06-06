"use client";

import React, { useState } from "react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  Button,
  Badge,
  Input,
  Label,
  Switch,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Table,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableCell,
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Progress,
  ZoruStatCard,
  ZoruDataTable,
} from "@/components/zoruui";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/zoruui";
import {
  CreditCard,
  Download,
  AlertCircle,
  TrendingUp,
  FileText,
  DollarSign,
  Activity,
  History,
  Lock,
  Globe,
  MessageSquare,
  Image as ImageIcon,
  Zap,
  CreditCard as CreditCardIcon,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/components/zoruui/lib/cn";
import { fmtDate, fmtINR } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";

type BillingRecord = {
  id: string;
  date: string;
  description: string;
  status: "Paid" | "Pending" | "Failed";
  amount: number;
};

const billingHistoryData: BillingRecord[] = [
  { id: "INV-4029", date: "May 01, 2026", description: "Auto Top-Up (10,000 Credits)", status: "Paid", amount: 79.00 },
  { id: "INV-4028", date: "Apr 01, 2026", description: "Monthly Platform Usage", status: "Paid", amount: 124.50 },
  { id: "INV-4027", date: "Mar 01, 2026", description: "Auto Top-Up (5,000 Credits)", status: "Paid", amount: 45.00 },
  { id: "INV-4026", date: "Feb 01, 2026", description: "Monthly Platform Usage", status: "Paid", amount: 98.20 },
  { id: "INV-4025", date: "Jan 01, 2026", description: "Monthly Platform Usage", status: "Paid", amount: 105.00 },
  { id: "INV-4024", date: "Dec 01, 2025", description: "Monthly Platform Usage", status: "Paid", amount: 110.00 },
  { id: "INV-4023", date: "Nov 01, 2025", description: "Auto Top-Up (5,000 Credits)", status: "Paid", amount: 45.00 },
];

const PricingCard = ({ title, price, description, features, recommended, currentPlan }: { title: string, price: string, description: string, features: string[], recommended?: boolean, currentPlan?: boolean }) => {
  return (
    <Card className={cn("relative flex flex-col justify-between p-6 transition-all duration-300", recommended ? "border-[var(--st-text)] shadow-xl shadow-[var(--st-text)]/10 scale-105 z-10" : "border-[var(--st-border)]")}>
      {recommended && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--st-text)] text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide">
          RECOMMENDED
        </div>
      )}
      <div>
        <h3 className="text-xl font-bold text-[var(--st-text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--st-text-secondary)]">{description}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-[var(--st-text)]">{price}</span>
          {price !== "Custom" && <span className="text-sm font-medium text-[var(--st-text-secondary)]">/mo</span>}
        </div>
        <ul className="mt-6 space-y-3">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--st-text)] shrink-0" />
              <span className="text-sm text-[var(--st-text)]">{feat}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8">
        <Button 
          variant={currentPlan ? "outline" : recommended ? "default" : "secondary"} 
          className="w-full"
          disabled={currentPlan}
        >
          {currentPlan ? "Current Plan" : price === "Custom" ? "Contact Sales" : "Upgrade Plan"}
        </Button>
      </div>
    </Card>
  )
}

class BillingErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Billing error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SabsmsPageShell
          title="Billing & Credits"
          description="Manage your SMS balances, auto-top-up rules, subscriptions, and payment methods."
          eyebrow="Settings"
          breadcrumbs={[
            { label: "Settings" },
            { label: "Billing" },
          ]}
        >
          <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
            <ZoruCardHeader>
              <ZoruCardTitle className="text-[var(--st-danger)] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Payment Service Unavailable
              </ZoruCardTitle>
              <ZoruCardDescription>
                We're currently unable to connect to our payment provider.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <p className="text-sm text-[var(--st-text)]">
                Error details: {this.state.error?.message || "Unknown network error"}
              </p>
              <p className="text-sm text-[var(--st-text-secondary)]">
                Your existing credits and messaging capabilities remain unaffected. Please try again later for billing updates.
              </p>
            </ZoruCardContent>
            <ZoruCardFooter>
              <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
                Retry Connection
              </Button>
            </ZoruCardFooter>
          </Card>
        </SabsmsPageShell>
      );
    }

    return this.props.children;
  }
}

function BillingSettingsPageContent() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [lineItemOpen, setLineItemOpen] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  
  // States for Top Up
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [threshold, setThreshold] = useState("1000");

  if (simulateError) {
    throw new Error("Stripe API connection timed out after 5000ms.");
  }

  const billingColumns: ColumnDef<BillingRecord>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => <span>{fmtDate(row.getValue("date"))}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status as string;
        return (
          <Badge 
            variant={
              status === "Paid" ? "success" :
              status === "Pending" ? "warning" :
              "danger"
            }
          >
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const formatted = fmtINR(amount, "USD");
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLineItemOpen(true)}>Details</Button>
            <Button variant="ghost" size="icon-sm" title="Download PDF"><Download className="h-4 w-4"/></Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <SabsmsPageShell
        title="Billing & Credits"
        description="Manage your SMS balances, auto-top-up rules, subscriptions, and payment methods."
        eyebrow="Settings"
        breadcrumbs={[
          { label: "Settings" },
          { label: "Billing" },
        ]}
        primaryAction={{
          label: "Top Up Balance",
          onClick: () => setTopUpOpen(true)
        }}
        secondaryActions={[
          {
            label: "Export Usage CSV",
            icon: <Download className="h-4 w-4" />,
            onSelectAction: () => console.log("Exporting CSV..."),
          },
          {
            label: "Simulate API Error",
            icon: <AlertTriangle className="h-4 w-4 text-[var(--st-danger)]" />,
            onSelectAction: () => setSimulateError(true),
          }
        ]}
        helpTitle="Billing Cycle"
        helpBody="Your SabNode billing is calculated at the end of each month. Prepaid credits are drawn down immediately as you use SabSMS features."
      >
        <Tabs defaultValue="overview" className="mt-6 w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview & Usage</TabsTrigger>
            <TabsTrigger value="plans">Plans & Subscriptions</TabsTrigger>
            <TabsTrigger value="invoices">Invoices & Payments</TabsTrigger>
            <TabsTrigger value="caps">Settings & Caps</TabsTrigger>
            <TabsTrigger value="cost-allocation">Cost Allocation</TabsTrigger>
            <TabsTrigger value="admin">Administration</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-[var(--st-text)]">Credit Balances</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ZoruStatCard 
                  label="Domestic SMS" 
                  value="12,450" 
                  delta={-5.2} 
                  period="vs last month" 
                  icon={<MessageSquare />} 
                />
                <ZoruStatCard 
                  label="International" 
                  value="4,200" 
                  delta={12.5} 
                  period="vs last month" 
                  icon={<Globe />} 
                />
                <ZoruStatCard 
                  label="MMS / Media" 
                  value="850" 
                  delta={2.1} 
                  period="vs last month" 
                  icon={<ImageIcon />} 
                />
                <ZoruStatCard 
                  label="Number Lookups" 
                  value="5,000" 
                  delta={0} 
                  period="vs last month" 
                  icon={<Activity />} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="col-span-1 md:col-span-2">
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[var(--st-text)]" />
                    Detailed Usage & Allowances
                  </ZoruCardTitle>
                  <ZoruCardDescription>Current billing cycle credit consumption against limits</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="font-medium text-[var(--st-text)]">US Domestic SMS</span>
                      <span className="text-[var(--st-text-secondary)]">12,450 / 20,000 credits</span>
                    </div>
                    <Progress value={62.25} indicatorClassName="bg-[var(--st-text-secondary)]" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="font-medium text-[var(--st-text)]">UK International SMS</span>
                      <span className="text-[var(--st-text-secondary)]">4,200 / 5,000 credits</span>
                    </div>
                    <Progress value={84} indicatorClassName="bg-[var(--st-warn)]" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="font-medium text-[var(--st-text)]">MMS / Media</span>
                      <span className="text-[var(--st-text-secondary)]">850 / 1,000 credits</span>
                    </div>
                    <Progress value={85} indicatorClassName="bg-[var(--st-text)]" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="font-medium text-[var(--st-text)]">Network Lookups</span>
                      <span className="text-[var(--st-text-secondary)]">5,000 / 10,000 credits</span>
                    </div>
                    <Progress value={50} indicatorClassName="bg-[var(--st-status-ok)]" />
                  </div>
                </ZoruCardContent>
              </Card>

              <div className="col-span-1 space-y-6">
                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[var(--st-text-secondary)]" />
                      Burn-Rate Forecast
                    </ZoruCardTitle>
                    <ZoruCardDescription>Estimated run-time for current credits</ZoruCardDescription>
                  </ZoruCardHeader>
                  <ZoruCardContent>
                    <div className="text-3xl font-bold text-[var(--st-text)]">14 Days</div>
                    <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Based on an average usage of 1,200 credits/day.</p>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-[var(--st-text-secondary)]">
                        <span>Low</span>
                        <span>Empty</span>
                      </div>
                      <Progress value={75} />
                    </div>
                  </ZoruCardContent>
                </Card>

                <Card>
                  <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[var(--st-warn)]" />
                      Active Features
                    </ZoruCardTitle>
                    <ZoruCardDescription>Current routing capabilities</ZoruCardDescription>
                  </ZoruCardHeader>
                  <ZoruCardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--st-text)]">MMS Routing</span>
                      <Badge variant="success">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--st-text)]">RCS Capabilities</span>
                      <Badge variant="success">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--st-text)]">Alpha Sender ID</span>
                      <Badge variant="outline" className="text-[var(--st-text-secondary)] border-[var(--st-border)]">Pending Review</Badge>
                    </div>
                  </ZoruCardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* PLANS & SUBSCRIPTIONS TAB */}
          <TabsContent value="plans" className="space-y-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--st-text)]">Choose Your Plan</h2>
              <p className="text-sm text-[var(--st-text-secondary)]">Select the plan that best fits your messaging needs.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 items-center max-w-6xl mx-auto">
              <PricingCard 
                title="Starter"
                price="$29"
                description="Perfect for small businesses getting started with SMS."
                features={[
                  "10,000 monthly credits",
                  "US Domestic Routing",
                  "Basic Analytics",
                  "Email Support",
                  "Standard Delivery Speed"
                ]}
              />
              <PricingCard 
                title="Growth"
                price="$99"
                description="Ideal for growing teams with advanced messaging needs."
                recommended={true}
                currentPlan={true}
                features={[
                  "50,000 monthly credits",
                  "Global Routing Access",
                  "MMS & Media Support",
                  "Priority Support",
                  "Dedicated IP Options",
                  "Advanced Analytics Dashboard"
                ]}
              />
              <PricingCard 
                title="Enterprise"
                price="Custom"
                description="Custom tailored volume and features for large organizations."
                features={[
                  "Unlimited credits (Billed per usage)",
                  "Custom Volume Discounts",
                  "RCS Capabilities",
                  "Dedicated Account Manager",
                  "SLA Guarantee 99.99%",
                  "Alpha Sender ID Approval"
                ]}
              />
            </div>
          </TabsContent>

          {/* INVOICES & PAYMENTS TAB */}
          <TabsContent value="invoices" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="col-span-1">
                <ZoruCardHeader>
                  <ZoruCardTitle>Payment Method</ZoruCardTitle>
                  <ZoruCardDescription>Managed via SabNode global billing</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex items-center gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--st-bg-muted)]">
                    <CreditCardIcon className="h-5 w-5 text-[var(--st-text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Visa ending in 4242</p>
                    <p className="text-xs text-[var(--st-text-secondary)]">Expires 12/2028</p>
                  </div>
                  <Badge className="ml-auto" variant="info">Default</Badge>
                </ZoruCardContent>
                <ZoruCardFooter className="pt-4">
                  <Button variant="outline" className="w-full">Update in SabNode</Button>
                </ZoruCardFooter>
              </Card>

              <Card className="col-span-1 md:col-span-2">
                <ZoruCardHeader>
                  <ZoruCardTitle>Current Period Unbilled</ZoruCardTitle>
                  <ZoruCardDescription>Accrued usage outside of prepaid credits</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="text-4xl font-bold text-[var(--st-text)]">$14.50</div>
                  <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                    Will be aggregated and charged at the end of the month alongside your platform subscription.
                  </p>
                </ZoruCardContent>
              </Card>
            </div>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Billing History</ZoruCardTitle>
                <ZoruCardDescription>Past invoices, subscription charges, and top-ups</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruDataTable 
                  columns={billingColumns} 
                  data={billingHistoryData} 
                  filterColumn="description"
                  filterPlaceholder="Search invoices..."
                />
              </ZoruCardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS & CAPS TAB */}
          <TabsContent value="caps" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-[var(--st-text)]" />
                    Auto Top-Up Settings
                  </ZoruCardTitle>
                  <ZoruCardDescription>Automatically purchase credits when running low</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] p-4 shadow-[var(--st-shadow-sm)]">
                    <div>
                      <h4 className="font-medium text-[var(--st-text)]">Enable Auto Top-Up</h4>
                      <p className="text-sm text-[var(--st-text-secondary)]">Prevent message failures due to empty balance</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>When balance falls below</Label>
                      <Input 
                        type="number" 
                        value={threshold} 
                        onChange={(e) => setThreshold(e.target.value)} 
                      />
                      {parseInt(threshold) < 5000 && (
                        <p className="text-xs text-[var(--st-warn)] flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Low threshold may risk service interruption during peak hours.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase credits</Label>
                      <Select defaultValue="5000">
                        <ZoruSelectTrigger>
                          <ZoruSelectValue placeholder="Select amount" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="1000">1,000 credits ($10)</ZoruSelectItem>
                          <ZoruSelectItem value="5000">5,000 credits ($45)</ZoruSelectItem>
                          <ZoruSelectItem value="10000">10,000 credits ($80)</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                  </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button>Save Preferences</Button>
                </ZoruCardFooter>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-[var(--st-warn)]" />
                    Spend Caps
                  </ZoruCardTitle>
                  <ZoruCardDescription>Limit maximum monthly expenditure</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Monthly hard cap ($)</Label>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-[var(--st-text-secondary)]" />
                      <Input type="number" defaultValue="500" />
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)]">SabSMS will suspend sending if this threshold is reached.</p>
                  </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button variant="outline">Update Cap</Button>
                </ZoruCardFooter>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle>Localization & Taxes</ZoruCardTitle>
                  <ZoruCardDescription>Set your billing locale and VAT/GST info</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Display Currency</Label>
                    <Select defaultValue="usd">
                      <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Currency" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="usd">USD ($)</ZoruSelectItem>
                        <ZoruSelectItem value="eur">EUR (€)</ZoruSelectItem>
                        <ZoruSelectItem value="gbp">GBP (£)</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>VAT / GST Number</Label>
                    <Input placeholder="e.g. GB123456789" defaultValue="US987654321" />
                  </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button variant="outline">Save Localization</Button>
                </ZoruCardFooter>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle>Compliance & Documentation</ZoruCardTitle>
                  <ZoruCardDescription>Manage region compliance and tax forms</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="flex items-start gap-3 rounded border border-[var(--st-border)] p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--st-status-ok)]" />
                    <div>
                      <p className="text-sm font-medium">A2P 10DLC Registered</p>
                      <p className="text-xs text-[var(--st-text-secondary)]">Your US sending brand is approved.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Form Upload (W-8 / W-9)</Label>
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--st-border)] p-6 text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)]/50">
                      <div className="text-center">
                        <FileText className="mx-auto mb-2 h-6 w-6" />
                        <span className="text-sm">Drag and drop file, or click to upload</span>
                      </div>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COST ALLOCATION TAB */}
          <TabsContent value="cost-allocation" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-[var(--st-text)]" />
                    Spend by Department
                  </ZoruCardTitle>
                  <ZoruCardDescription>Current billing cycle allocation</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="font-medium text-[var(--st-text)]">Marketing</span>
                        <span className="text-[var(--st-text-secondary)]">$450.00 (45%)</span>
                      </div>
                      <Progress value={45} indicatorClassName="bg-[var(--st-text)]" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="font-medium text-[var(--st-text)]">Support</span>
                        <span className="text-[var(--st-text-secondary)]">$300.00 (30%)</span>
                      </div>
                      <Progress value={30} indicatorClassName="bg-[var(--st-text-secondary)]" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="font-medium text-[var(--st-text)]">Sales</span>
                        <span className="text-[var(--st-text-secondary)]">$150.00 (15%)</span>
                      </div>
                      <Progress value={15} indicatorClassName="bg-[var(--st-warn)]" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2 text-sm">
                        <span className="font-medium text-[var(--st-text)]">Engineering (Alerts)</span>
                        <span className="text-[var(--st-text-secondary)]">$100.00 (10%)</span>
                      </div>
                      <Progress value={10} indicatorClassName="bg-[var(--st-status-ok)]" />
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[var(--st-text-secondary)]" />
                    Spend by Campaign
                  </ZoruCardTitle>
                  <ZoruCardDescription>Top campaigns this month</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <Table>
                    <ZoruTableHeader>
                      <ZoruTableRow>
                        <ZoruTableHead>Campaign</ZoruTableHead>
                        <ZoruTableHead>Tag</ZoruTableHead>
                        <ZoruTableHead className="text-right">Spend</ZoruTableHead>
                      </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                      <ZoruTableRow>
                        <ZoruTableCell>Summer Sale Promo</ZoruTableCell>
                        <ZoruTableCell><Badge variant="outline">Marketing</Badge></ZoruTableCell>
                        <ZoruTableCell className="text-right font-medium">$250.00</ZoruTableCell>
                      </ZoruTableRow>
                      <ZoruTableRow>
                        <ZoruTableCell>Weekly Newsletter</ZoruTableCell>
                        <ZoruTableCell><Badge variant="outline">Marketing</Badge></ZoruTableCell>
                        <ZoruTableCell className="text-right font-medium">$150.00</ZoruTableCell>
                      </ZoruTableRow>
                      <ZoruTableRow>
                        <ZoruTableCell>Server Outage Alerts</ZoruTableCell>
                        <ZoruTableCell><Badge variant="outline">Engineering</Badge></ZoruTableCell>
                        <ZoruTableCell className="text-right font-medium">$75.00</ZoruTableCell>
                      </ZoruTableRow>
                      <ZoruTableRow>
                        <ZoruTableCell>Customer Onboarding</ZoruTableCell>
                        <ZoruTableCell><Badge variant="outline">Support</Badge></ZoruTableCell>
                        <ZoruTableCell className="text-right font-medium">$200.00</ZoruTableCell>
                      </ZoruTableRow>
                    </ZoruTableBody>
                  </Table>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button variant="ghost" className="w-full text-xs text-[var(--st-text-secondary)]">View All Campaigns</Button>
                </ZoruCardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* ADMIN TAB */}
          <TabsContent value="admin" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-[var(--st-text)]/20 bg-[var(--st-text)]/5">
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2 text-[var(--st-text)]">
                    <Lock className="h-4 w-4" /> Admin: Margin Report
                  </ZoruCardTitle>
                  <ZoruCardDescription>Internal visibility of platform margins</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--st-text-secondary)]">Total Carrier Costs (MTD)</span>
                      <span className="font-medium">$1,240.50</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--st-text-secondary)]">Total Billed to Clients</span>
                      <span className="font-medium">$1,850.00</span>
                    </div>
                    <div className="mt-2 border-t border-[var(--st-text)]/20 pt-2 text-sm font-semibold text-[var(--st-text)]">
                      <div className="flex justify-between">
                        <span>Gross Margin</span>
                        <span>32.9%</span>
                      </div>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>

              <Card>
                <ZoruCardHeader>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-[var(--st-text)]" />
                    Route Costs
                  </ZoruCardTitle>
                  <ZoruCardDescription>Base SMS costs per region</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-[var(--st-border)] pb-2 text-sm">
                      <span>United States (US)</span>
                      <span className="font-mono">$0.0079</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--st-border)] pb-2 text-sm">
                      <span>United Kingdom (UK)</span>
                      <span className="font-mono">$0.0350</span>
                    </div>
                    <div className="flex justify-between pb-2 text-sm">
                      <span>Canada (CA)</span>
                      <span className="font-mono">$0.0085</span>
                    </div>
                  </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <Button variant="ghost" className="w-full text-xs">View All Rates</Button>
                </ZoruCardFooter>
              </Card>
            </div>

            <Card>
              <ZoruCardHeader className="flex flex-row items-center justify-between">
                <div>
                  <ZoruCardTitle>Billing Audit Log</ZoruCardTitle>
                  <ZoruCardDescription>History of financial changes across the workspace</ZoruCardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>Timestamp</ZoruTableHead>
                      <ZoruTableHead>User</ZoruTableHead>
                      <ZoruTableHead>Action</ZoruTableHead>
                      <ZoruTableHead>Details</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    <ZoruTableRow>
                      <ZoruTableCell>May 22, 14:30</ZoruTableCell>
                      <ZoruTableCell>Alice Smith</ZoruTableCell>
                      <ZoruTableCell>Spend Cap Updated</ZoruTableCell>
                      <ZoruTableCell>Changed from $300 to $500</ZoruTableCell>
                    </ZoruTableRow>
                    <ZoruTableRow>
                      <ZoruTableCell>May 21, 09:15</ZoruTableCell>
                      <ZoruTableCell>System</ZoruTableCell>
                      <ZoruTableCell>Auto Top-Up</ZoruTableCell>
                      <ZoruTableCell>Threshold reached. 5,000 credits added.</ZoruTableCell>
                    </ZoruTableRow>
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SabsmsPageShell>

      {/* Feature 5: Top-up Modal */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Top Up Balance</ZoruDialogTitle>
            <ZoruDialogDescription>Add prepaid credits to your account immediately.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Package</Label>
              <Select value={topUpAmount} onValueChange={setTopUpAmount}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="100">1,000 Credits ($10.00)</ZoruSelectItem>
                  <ZoruSelectItem value="500">5,000 Credits ($45.00)</ZoruSelectItem>
                  <ZoruSelectItem value="1000">10,000 Credits ($80.00)</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
              <p className="text-sm font-medium">Payment Summary</p>
              <div className="mt-2 flex justify-between text-sm text-[var(--st-text-secondary)]">
                <span>Subtotal</span>
                <span>${topUpAmount === "100" ? "10.00" : topUpAmount === "500" ? "45.00" : "80.00"}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm font-semibold text-[var(--st-text)] border-t border-[var(--st-border)] pt-1">
                <span>Total Charge</span>
                <span>${topUpAmount === "100" ? "10.00" : topUpAmount === "500" ? "45.00" : "80.00"}</span>
              </div>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              This will charge your default payment method (Visa ending in 4242).
            </p>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setTopUpOpen(false)}>Cancel</Button>
            <Button onClick={() => setTopUpOpen(false)}>Confirm Purchase</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Feature 10: Refund Request Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Request Refund</ZoruDialogTitle>
            <ZoruDialogDescription>Submit a refund request for invoice #INV-4029.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded border border-[var(--st-warn)]/20 bg-[var(--st-warn)]/10 p-3 text-sm text-[var(--st-warn)]">
              <AlertTriangle className="mb-1 h-4 w-4 inline mr-1" />
              Refunds for usage-based billing are subject to review. We typically only refund unused prepaid credits or erroneous carrier charges.
            </div>
            <div className="space-y-2">
              <Label>Reason for Refund</Label>
              <Select defaultValue="accidental">
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="accidental">Accidental Purchase</ZoruSelectItem>
                  <ZoruSelectItem value="failure">High Message Failure Rate</ZoruSelectItem>
                  <ZoruSelectItem value="other">Other</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setRefundOpen(false)}>Submit Request</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Feature 11: Per-line-item breakdown Dialog */}
      <Dialog open={lineItemOpen} onOpenChange={setLineItemOpen}>
        <ZoruDialogContent className="sm:max-w-[600px]">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Invoice Details</ZoruDialogTitle>
            <ZoruDialogDescription>Line item breakdown for May 01, 2026</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-4">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Service</ZoruTableHead>
                  <ZoruTableHead>Quantity</ZoruTableHead>
                  <ZoruTableHead>Unit Price</ZoruTableHead>
                  <ZoruTableHead className="text-right">Total</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell>US Domestic SMS</ZoruTableCell>
                  <ZoruTableCell>5,000</ZoruTableCell>
                  <ZoruTableCell>$0.0079</ZoruTableCell>
                  <ZoruTableCell className="text-right">$39.50</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell>UK International SMS</ZoruTableCell>
                  <ZoruTableCell>1,000</ZoruTableCell>
                  <ZoruTableCell>$0.0350</ZoruTableCell>
                  <ZoruTableCell className="text-right">$35.00</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell>Network Lookups</ZoruTableCell>
                  <ZoruTableCell>900</ZoruTableCell>
                  <ZoruTableCell>$0.0050</ZoruTableCell>
                  <ZoruTableCell className="text-right">$4.50</ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
            <div className="mt-4 flex justify-between border-t border-[var(--st-border)] pt-2 font-bold text-[var(--st-text)]">
              <span>Total Invoice Amount</span>
              <span>$79.00</span>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button onClick={() => setLineItemOpen(false)}>Close</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}

export default function BillingSettingsPage() {
  return (
    <BillingErrorBoundary>
      <BillingSettingsPageContent />
    </BillingErrorBoundary>
  );
}
