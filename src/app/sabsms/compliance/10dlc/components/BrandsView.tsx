"use client";

import React, { useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardBody, Input, Label, Badge, StatCard, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Accordion, AccordionItem, AccordionTrigger, AccordionContent, ZoruAccordion03, ZoruAccordion03Item, ZoruAccordion03Trigger, ZoruAccordion03Content, RadioGroup, RadioCard, Separator } from '@/components/sabcrm/20ui/compat';
import { SabsmsDataTable } from "@/components/sabsms/page-toolkit";
import {
  Building2,
  Briefcase,
  Globe,
  ShieldCheck,
  Phone,
  Mail,
  Zap,
} from "lucide-react";
import { registerBrand } from "../actions";

export function BrandsView() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await registerBrand(formData);
      alert(res.message);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Overall Trust Score"
          value="95 / 100"
          delta={5}
          period="Excellent standing based on recent vetting"
          className="bg-gradient-to-br from-[var(--st-bg)] to-[var(--st-bg-muted)]/30 dark:to-[var(--st-text)]/10 border-[var(--st-border)]/50"
        />
        <StatCard
          label="Registered Brands"
          value="12 Active"
          period="Across 4 different verticals"
        />
        <StatCard
          label="Vetting Upgrades"
          value="3 Eligible"
          period="Upgrade for higher throughput"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[var(--st-border)] overflow-hidden shadow-sm">
            <div className="bg-[var(--st-bg-secondary)] border-b px-4 sm:px-6 py-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Premium Brand Registration</h2>
                <p className="text-sm text-[var(--st-text-secondary)]">Complete the multi-step verification process to register a new entity.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <CardBody className="p-0">
                <ZoruAccordion03 type="single" defaultValue="step-1" collapsible className="p-4 sm:p-6">
                  <ZoruAccordion03Item value="step-1">
                    <ZoruAccordion03Trigger>1. Entity Profile & Legal Information</ZoruAccordion03Trigger>
                    <ZoruAccordion03Content className="space-y-6">
                      <div className="grid gap-4 mt-2">
                        <Label>Entity Type</Label>
                        <RadioGroup defaultValue="private" name="entityType" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <RadioCard value="private" label="Private Company" description="LLC, Inc, Corp" icon={<Briefcase className="h-4 w-4" />} />
                          <RadioCard value="public" label="Public Company" description="Traded on exchange" icon={<Globe className="h-4 w-4" />} />
                          <RadioCard value="nonprofit" label="Non-Profit (501c3)" description="Registered charity" icon={<ShieldCheck className="h-4 w-4" />} />
                          <RadioCard value="gov" label="Government" description="Local or Federal" icon={<Building2 className="h-4 w-4" />} />
                        </RadioGroup>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label>Legal Business Name</Label>
                          <Input name="legalName" placeholder="Acme Corporation Inc." required />
                        </div>
                        <div className="space-y-2">
                          <Label>Employer Identification Number (EIN)</Label>
                          <Input name="ein" placeholder="XX-XXXXXXX" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Doing Business As (DBA)</Label>
                          <Input name="dba" placeholder="Optional" />
                        </div>
                        <div className="space-y-2">
                          <Label>Vertical / Industry</Label>
                          <Select name="vertical" defaultValue="tech">
                            <SelectTrigger>
                              <SelectValue placeholder="Select vertical" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tech">Technology & Software</SelectItem>
                              <SelectItem value="retail">Retail & Ecommerce</SelectItem>
                              <SelectItem value="finance">Financial Services</SelectItem>
                              <SelectItem value="healthcare">Healthcare</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </ZoruAccordion03Content>
                  </ZoruAccordion03Item>

                  <ZoruAccordion03Item value="step-2" className="mt-4">
                    <ZoruAccordion03Trigger>2. Business Location</ZoruAccordion03Trigger>
                    <ZoruAccordion03Content className="space-y-5">
                      <div className="space-y-2 mt-2">
                        <Label>Street Address</Label>
                        <Input name="street" placeholder="123 Main Street" required />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-5">
                        <div className="space-y-2 sm:col-span-1">
                          <Label>City</Label>
                          <Input name="city" placeholder="San Francisco" required />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                          <Label>State / Province</Label>
                          <Input name="state" placeholder="CA" required />
                        </div>
                        <div className="space-y-2 sm:col-span-1">
                          <Label>Postal Code</Label>
                          <Input name="postal" placeholder="94105" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Select name="country" defaultValue="us">
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="ca">Canada</SelectItem>
                            <SelectItem value="uk">United Kingdom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </ZoruAccordion03Content>
                  </ZoruAccordion03Item>

                  <ZoruAccordion03Item value="step-3" className="mt-4">
                    <ZoruAccordion03Trigger>3. Contact & Support Information</ZoruAccordion03Trigger>
                    <ZoruAccordion03Content className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-5 mt-2">
                        <div className="space-y-2">
                          <Label>Support Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input name="email" type="email" placeholder="support@acme.com" className="pl-9" required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Support Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input name="phone" type="tel" placeholder="+1 (800) 555-0199" className="pl-9" required />
                          </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Website URL</Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input name="website" type="url" placeholder="https://www.acme.com" className="pl-9" required />
                          </div>
                        </div>
                      </div>
                    </ZoruAccordion03Content>
                  </ZoruAccordion03Item>
                </ZoruAccordion03>
              </CardBody>
              <div className="p-4 sm:p-6 bg-[var(--st-bg-secondary)] border-t flex flex-col sm:flex-row justify-end gap-3">
                <Button type="button" variant="outline" className="w-full sm:w-auto">Save Draft</Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit for Verification"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--st-text)]" /> TCR Verification Status
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">EIN Verification</span>
                  <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">Verified</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Address Matching</span>
                  <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">Pending</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Vetting Class</span>
                  <span className="font-medium">Standard</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">
                <Zap className="mr-2 h-4 w-4 text-[var(--st-text)]" /> Apply for Enhanced Vetting
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Help</CardTitle>
            </CardHeader>
            <CardBody>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-xs py-3 text-left">Why is EIN required?</AccordionTrigger>
                  <AccordionContent className="text-xs">
                    The Campaign Registry uses the Employer Identification Number to verify the legal existence of the business with the IRS.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-xs py-3 text-left">What if I don't have a website?</AccordionTrigger>
                  <AccordionContent className="text-xs">
                    You must provide a valid social media presence or other online footprint if a website is not available, otherwise vetting may be rejected.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Number ↔ Campaign Assignment Matrix</CardTitle>
          <CardDescription>Manage your inventory of 10DLC numbers and their active campaign associations.</CardDescription>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <SabsmsDataTable
            rowKey={(r) => r.number}
            columns={[
              { id: "number", header: "Number", render: (r) => <span className="font-mono whitespace-nowrap">{r.number}</span> },
              { id: "campaign", header: "Assigned Campaign", render: (r) => <span className="font-medium whitespace-nowrap">{r.campaign}</span> },
              { id: "throughput", header: "Throughput (TPM)", render: (r) => <span className="whitespace-nowrap">{r.throughput}</span> },
              { id: "status", header: "Status", render: (r) => (
                <Badge variant="secondary" className={r.status === 'Active' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)] whitespace-nowrap' : 'whitespace-nowrap'}>
                  {r.status}
                </Badge>
              )},
            ]}
            rows={[
              { number: "+1 234 567 8900", campaign: "Marketing 2026", throughput: "4,000", status: "Active" },
              { number: "+1 987 654 3210", campaign: "OTP Alerts", throughput: "12,000", status: "Active" },
              { number: "+1 555 123 4567", campaign: "Customer Support", throughput: "4,000", status: "Pending Verification" },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
