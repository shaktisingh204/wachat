"use client";

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Switch, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from "react";
import { useFormStatus } from "react-dom";
import { Bell,
  CreditCard,
  LoaderCircle,
  Save } from "lucide-react";

import { updateEcommShopSettings } from "@/app/actions/custom-ecommerce.actions";
import { getEcommFlows } from "@/app/actions/custom-ecommerce-flow.actions";
import type {
  CustomDomain,
  EcommFlow,
  EcommShop,
  } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * Zoru-only replacement for `@/components/zoruui-domain/ecomm-settings-form`.
 *
 * Same `updateEcommShopSettings` server action, same data shape — just new
 * visuals. Mounts inside the per-shop settings page.
 */

import * as React from "react";

const initialState: { message?: string | null; error?: string } = {
  message: null,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
      Save settings
    </Button>
  );
}

interface EcommSettingsFormProps {
  shop: WithId<EcommShop>;
  domains: WithId<CustomDomain>[];
}

export function EcommSettingsForm({ shop, domains }: EcommSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateEcommShopSettings as unknown as (
      prev: typeof initialState,
      formData: FormData,
    ) => Promise<typeof initialState>,
    initialState,
  );
  const { toast } = useToast();
  const [ecommFlows, setEcommFlows] = useState<WithId<EcommFlow>[]>([]);

  useEffect(() => {
    getEcommFlows(shop.projectId.toString()).then(setEcommFlows);
  }, [shop.projectId]);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Settings saved", description: state.message });
    }
    if (state.error) {
      toast({
        title: "Could not save",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const verifiedDomains = domains.filter((d) => d.verified);

  return (
    <form action={formAction}>
      <input type="hidden" name="shopId" value={shop._id.toString()} />
      <Card>
        <CardHeader>
          <CardTitle>Basic configuration</CardTitle>
          <CardDescription>
            Set the fundamental properties for your custom shop.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shopName">Shop name</Label>
              <Input
                id="shopName"
                name="name"
                placeholder="My Awesome Store"
                defaultValue={shop.name || ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select
                name="currency"
                defaultValue={shop.currency || "USD"}
                required
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="INR">
                    INR — Indian Rupee
                  </SelectItem>
                  <SelectItem value="GBP">
                    GBP — British Pound
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="customDomain">Custom domain</Label>
              <Select
                name="customDomain"
                defaultValue={shop.customDomain || "none"}
              >
                <SelectTrigger id="customDomain">
                  <SelectValue placeholder="Select a verified domain…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    None (use default)
                  </SelectItem>
                  {verifiedDomains.map((d) => (
                    <SelectItem
                      key={d._id.toString()}
                      value={d.hostname}
                    >
                      {d.hostname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Add and verify domains in the section below.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="flex items-center gap-2 text-base tracking-tight text-[var(--st-text)]">
              <CreditCard className="h-4 w-4" /> Payment links
            </h3>
            <p className="mb-4 mt-1 text-sm text-[var(--st-text-secondary)]">
              Provide direct payment links for services like Razorpay, Paytm,
              or GPay to enable &ldquo;Pay&rdquo; buttons in your shop flows.
            </p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentLinkRazorpay">
                  Razorpay link
                </Label>
                <Input
                  id="paymentLinkRazorpay"
                  name="paymentLinkRazorpay"
                  placeholder="https://rzp.io/l/yourlink"
                  defaultValue={shop.paymentLinkRazorpay || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentLinkPaytm">Paytm link</Label>
                <Input
                  id="paymentLinkPaytm"
                  name="paymentLinkPaytm"
                  placeholder="https://p.paytm.me/yourlink"
                  defaultValue={shop.paymentLinkPaytm || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentLinkGPay">
                  Google Pay link
                </Label>
                <Input
                  id="paymentLinkGPay"
                  name="paymentLinkGPay"
                  placeholder="gpay://…"
                  defaultValue={shop.paymentLinkGPay || ""}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="flex items-center gap-2 text-base tracking-tight text-[var(--st-text)]">
              <Bell className="h-4 w-4" /> Abandoned cart reminder
            </h3>
            <p className="mb-4 mt-1 text-sm text-[var(--st-text-secondary)]">
              Automatically send a follow-up message to users who leave items
              in their cart.
            </p>
            <div className="space-y-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-4">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="abandonedCart.enabled"
                  className="text-sm tracking-tight text-[var(--st-text)]"
                >
                  Enable reminder
                </Label>
                <Switch
                  id="abandonedCart.enabled"
                  name="abandonedCart.enabled"
                  defaultChecked={shop.abandonedCart?.enabled || false}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="abandonedCart.delayMinutes">
                    Delay (minutes)
                  </Label>
                  <Input
                    id="abandonedCart.delayMinutes"
                    name="abandonedCart.delayMinutes"
                    type="number"
                    defaultValue={shop.abandonedCart?.delayMinutes || 60}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abandonedCart.flowId">
                    Reminder flow
                  </Label>
                  <Select
                    name="abandonedCart.flowId"
                    defaultValue={shop.abandonedCart?.flowId}
                  >
                    <SelectTrigger id="abandonedCart.flowId">
                      <SelectValue placeholder="Select a flow…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ecommFlows.map((flow) => (
                        <SelectItem
                          key={flow._id.toString()}
                          value={flow._id.toString()}
                        >
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}
