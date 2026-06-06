"use client";

import React, { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/sabcrm/20ui/zoru/card";
import { Button } from "@/components/sabcrm/20ui/zoru/button";
import { Input } from "@/components/sabcrm/20ui/zoru/input";
import { Label } from "@/components/sabcrm/20ui/zoru/label";
import { Switch } from "@/components/sabcrm/20ui/zoru/switch";
import { Badge } from "@/components/sabcrm/20ui/zoru/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/sabcrm/20ui/zoru/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/sabcrm/20ui/zoru/select";
import { 
  Briefcase, 
  Building2, 
  FileText, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  Download,
  Settings2,
  Percent
} from "lucide-react";

export default function B2BPage() {
  const companies = [
    { id: "COMP-001", name: "Acme Corp", tier: "Gold Partner", status: "Approved", netTerms: "Net 30", creditLimit: "$50,000" },
    { id: "COMP-002", name: "Global Tech LLC", tier: "Silver Partner", status: "Pending", netTerms: "None", creditLimit: "$0" },
    { id: "COMP-003", name: "Retail Solutions Inc", tier: "Standard", status: "Approved", netTerms: "Net 15", creditLimit: "$10,000" },
  ];

  const priceLists = [
    { name: "Wholesale Tier 1", discount: "20% off retail", companiesCount: 45, lastUpdated: "2 days ago" },
    { name: "Distributor Premium", discount: "Custom fixed prices", companiesCount: 12, lastUpdated: "1 week ago" },
    { name: "Volume Movers", discount: "Tiered by quantity", companiesCount: 8, lastUpdated: "1 month ago" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-primary" />
            B2B Wholesale
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage company accounts, custom price lists, and net payment terms.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button><Building2 className="mr-2 h-4 w-4" /> Invite Company</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Company Accounts */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Accounts</CardTitle>
                <CardDescription>Review and approve incoming wholesale applications.</CardDescription>
              </div>
              <div className="flex items-center gap-2 relative w-full sm:w-auto">
                <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
                <Input placeholder="Search companies..." className="pl-9 w-full sm:w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Tier / Price List</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Net Terms</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/5">{c.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === "Approved" ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 flex items-center gap-1 w-max">
                            <CheckCircle className="h-3 w-3" /> Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-yellow-600 bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20 flex items-center gap-1 w-max">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.netTerms}</TableCell>
                      <TableCell className="text-right font-medium">{c.creditLimit}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Price Lists */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Price Lists</CardTitle>
                <CardDescription>Custom pricing rules assigned to specific buyer groups.</CardDescription>
              </div>
              <Button variant="outline" size="sm">Create New</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {priceLists.map((pl, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Percent className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{pl.name}</h4>
                      <p className="text-sm text-muted-foreground">{pl.discount} • {pl.companiesCount} companies</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground hidden sm:inline-block">Updated {pl.lastUpdated}</span>
                    <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* B2B Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Global Settings</CardTitle>
            <CardDescription>Configure store-wide B2B preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Net Terms</Label>
                <p className="text-sm text-muted-foreground">Allow delayed payments</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-approve Accounts</Label>
                <p className="text-sm text-muted-foreground">Skip manual review</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Tax Exemption</Label>
                <p className="text-sm text-muted-foreground">Allow tax ID uploads</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="pt-4 border-t space-y-3">
              <Label>Default Price List for New Accounts</Label>
              <Select defaultValue="standard">
                <SelectTrigger>
                  <SelectValue placeholder="Select price list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Retail (No Discount)</SelectItem>
                  <SelectItem value="tier1">Wholesale Tier 1</SelectItem>
                  <SelectItem value="distributor">Distributor Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
