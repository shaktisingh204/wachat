"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Input,
  Label,
  Badge,
  ZoruStatCard,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Accordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
  ZoruAccordion03,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordion03Content,
  RadioGroup,
  ZoruRadioCard,
  Separator,
} from "@/components/zoruui";
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
        <ZoruStatCard
          label="Overall Trust Score"
          value="95 / 100"
          delta={5}
          period="Excellent standing based on recent vetting"
          className="bg-gradient-to-br from-zoru-bg to-green-50/30 dark:to-green-900/10 border-green-200/50"
        />
        <ZoruStatCard
          label="Registered Brands"
          value="12 Active"
          period="Across 4 different verticals"
        />
        <ZoruStatCard
          label="Vetting Upgrades"
          value="3 Eligible"
          period="Upgrade for higher throughput"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-zoru-line overflow-hidden shadow-sm">
            <div className="bg-zoru-surface border-b px-4 sm:px-6 py-4 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-zoru-primary/10 flex items-center justify-center text-zoru-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Premium Brand Registration</h2>
                <p className="text-sm text-zoru-ink-muted">Complete the multi-step verification process to register a new entity.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <ZoruCardContent className="p-0">
                <ZoruAccordion03 type="single" defaultValue="step-1" collapsible className="p-4 sm:p-6">
                  <ZoruAccordion03Item value="step-1">
                    <ZoruAccordion03Trigger>1. Entity Profile & Legal Information</ZoruAccordion03Trigger>
                    <ZoruAccordion03Content className="space-y-6">
                      <div className="grid gap-4 mt-2">
                        <Label>Entity Type</Label>
                        <RadioGroup defaultValue="private" name="entityType" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <ZoruRadioCard value="private" label="Private Company" description="LLC, Inc, Corp" icon={<Briefcase className="h-4 w-4" />} />
                          <ZoruRadioCard value="public" label="Public Company" description="Traded on exchange" icon={<Globe className="h-4 w-4" />} />
                          <ZoruRadioCard value="nonprofit" label="Non-Profit (501c3)" description="Registered charity" icon={<ShieldCheck className="h-4 w-4" />} />
                          <ZoruRadioCard value="gov" label="Government" description="Local or Federal" icon={<Building2 className="h-4 w-4" />} />
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
                            <ZoruSelectTrigger>
                              <ZoruSelectValue placeholder="Select vertical" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                              <ZoruSelectItem value="tech">Technology & Software</ZoruSelectItem>
                              <ZoruSelectItem value="retail">Retail & Ecommerce</ZoruSelectItem>
                              <ZoruSelectItem value="finance">Financial Services</ZoruSelectItem>
                              <ZoruSelectItem value="healthcare">Healthcare</ZoruSelectItem>
                            </ZoruSelectContent>
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
                          <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Select country" />
                          </ZoruSelectTrigger>
                          <ZoruSelectContent>
                            <ZoruSelectItem value="us">United States</ZoruSelectItem>
                            <ZoruSelectItem value="ca">Canada</ZoruSelectItem>
                            <ZoruSelectItem value="uk">United Kingdom</ZoruSelectItem>
                          </ZoruSelectContent>
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
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                            <Input name="email" type="email" placeholder="support@acme.com" className="pl-9" required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Support Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                            <Input name="phone" type="tel" placeholder="+1 (800) 555-0199" className="pl-9" required />
                          </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Website URL</Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                            <Input name="website" type="url" placeholder="https://www.acme.com" className="pl-9" required />
                          </div>
                        </div>
                      </div>
                    </ZoruAccordion03Content>
                  </ZoruAccordion03Item>
                </ZoruAccordion03>
              </ZoruCardContent>
              <div className="p-4 sm:p-6 bg-zoru-surface border-t flex flex-col sm:flex-row justify-end gap-3">
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
            <ZoruCardHeader>
              <ZoruCardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zoru-primary" /> TCR Verification Status
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zoru-ink-muted">EIN Verification</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zoru-ink-muted">Address Matching</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zoru-ink-muted">Vetting Class</span>
                  <span className="font-medium">Standard</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">
                <Zap className="mr-2 h-4 w-4 text-amber-500" /> Apply for Enhanced Vetting
              </Button>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle className="text-base">Quick Help</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <Accordion type="single" collapsible className="w-full">
                <ZoruAccordionItem value="item-1">
                  <ZoruAccordionTrigger className="text-xs py-3 text-left">Why is EIN required?</ZoruAccordionTrigger>
                  <ZoruAccordionContent className="text-xs">
                    The Campaign Registry uses the Employer Identification Number to verify the legal existence of the business with the IRS.
                  </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="item-2">
                  <ZoruAccordionTrigger className="text-xs py-3 text-left">What if I don't have a website?</ZoruAccordionTrigger>
                  <ZoruAccordionContent className="text-xs">
                    You must provide a valid social media presence or other online footprint if a website is not available, otherwise vetting may be rejected.
                  </ZoruAccordionContent>
                </ZoruAccordionItem>
              </Accordion>
            </ZoruCardContent>
          </Card>
        </div>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Number ↔ Campaign Assignment Matrix</ZoruCardTitle>
          <ZoruCardDescription>Manage your inventory of 10DLC numbers and their active campaign associations.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="overflow-x-auto">
          <SabsmsDataTable
            rowKey={(r) => r.number}
            columns={[
              { id: "number", header: "Number", render: (r) => <span className="font-mono whitespace-nowrap">{r.number}</span> },
              { id: "campaign", header: "Assigned Campaign", render: (r) => <span className="font-medium whitespace-nowrap">{r.campaign}</span> },
              { id: "throughput", header: "Throughput (TPM)", render: (r) => <span className="whitespace-nowrap">{r.throughput}</span> },
              { id: "status", header: "Status", render: (r) => (
                <Badge variant="secondary" className={r.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap' : 'whitespace-nowrap'}>
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
        </ZoruCardContent>
      </Card>
    </div>
  );
}
