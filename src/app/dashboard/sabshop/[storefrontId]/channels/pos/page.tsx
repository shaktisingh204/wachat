"use client";

import React, { useState } from "react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Label } from '@/components/sabcrm/20ui';
import { Switch } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { 
  Store, 
  MonitorSmartphone, 
  Receipt, 
  Users, 
  Settings, 
  Plus,
  RefreshCw,
  Printer,
  Trash2,
  CheckCircle2,
  CreditCard
} from "lucide-react";

export default function POSPage() {
  const terminals = [
    { id: "T-1001", name: "Main Register", status: "Online", location: "Downtown Store", lastSync: "2 mins ago", battery: "100%" },
    { id: "T-1002", name: "Apparel Section", status: "Offline", location: "Downtown Store", lastSync: "5 hours ago", battery: "0%" },
    { id: "T-1003", name: "Pop-up Kiosk", status: "Online", location: "Mall Avenue", lastSync: "Just now", battery: "84%" },
  ];

  const staff = [
    { name: "Alice Johnson", role: "Manager", pin: "****", terminal: "All Terminals" },
    { name: "Bob Smith", role: "Cashier", pin: "****", terminal: "Main Register" },
    { name: "Charlie Davis", role: "Cashier", pin: "****", terminal: "Apparel Section" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-8 w-8 text-primary" />
            Point of Sale
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your in-store terminals, staff PINs, and receipt configurations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Sync Data</Button>
          <Button><Plus className="mr-2 h-4 w-4" /> Add Terminal</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Terminals Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5" /> Connected Terminals</CardTitle>
                <CardDescription>Manage active POS devices across your physical locations.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <THead className="bg-muted/50">
                  <Tr>
                    <Th>Terminal</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {terminals.map((t) => (
                    <Tr key={t.id}>
                      <Td>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.id}</div>
                      </Td>
                      <Td>{t.location}</Td>
                      <Td>
                        <Badge variant={t.status === "Online" ? "default" : "secondary"} className={t.status === "Online" ? "bg-green-500 hover:bg-green-600" : ""}>
                          {t.status}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">Sync: {t.lastSync}</div>
                      </Td>
                      <Td className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>

        {/* Quick Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Receipt Config</CardTitle>
              <CardDescription>Customize printed and digital receipts.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <Label>Header Text</Label>
                <Input placeholder="Welcome to SabShop!" defaultValue="Thank you for shopping with us!" />
              </div>
              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input placeholder="Visit us online at sabshop.com" defaultValue="Follow us @sabshop" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Digital Receipts</Label>
                  <p className="text-sm text-muted-foreground">Email/SMS prompts</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Print Barcodes</Label>
                  <p className="text-sm text-muted-foreground">For easy returns</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardBody>
            <CardFooter>
              <Button className="w-full" variant="outline"><Printer className="mr-2 h-4 w-4" /> Preview Receipt</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Staff Management */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff PINs & Access</CardTitle>
                <CardDescription>Control who can access your POS terminals and what permissions they have.</CardDescription>
              </div>
              <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Staff</Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <THead className="bg-muted/50">
                  <Tr>
                    <Th>Staff Member</Th>
                    <Th>Role</Th>
                    <Th>Assigned Terminal</Th>
                    <Th>PIN</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {staff.map((s, i) => (
                    <Tr key={i}>
                      <Td className="font-medium">{s.name}</Td>
                      <Td>
                        <Badge variant="outline">{s.role}</Badge>
                      </Td>
                      <Td>{s.terminal}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-muted px-2 py-1 rounded text-sm">{s.pin}</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs">Reset</Button>
                        </div>
                      </Td>
                      <Td className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>
        
      </div>
    </div>
  );
}
