"use client";

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
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
 * Zoru-only replacement for `@/components/wabasimplify/ecomm-settings-form`.
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
      Save settings
    </ZoruButton>
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
  const { toast } = useZoruToast();
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
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Basic configuration</ZoruCardTitle>
          <ZoruCardDescription>
            Set the fundamental properties for your custom shop.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="shopName">Shop name</ZoruLabel>
              <ZoruInput
                id="shopName"
                name="name"
                placeholder="My Awesome Store"
                defaultValue={shop.name || ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
              <ZoruSelect
                name="currency"
                defaultValue={shop.currency || "USD"}
                required
              >
                <ZoruSelectTrigger id="currency">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="USD">USD — US Dollar</ZoruSelectItem>
                  <ZoruSelectItem value="EUR">EUR — Euro</ZoruSelectItem>
                  <ZoruSelectItem value="INR">
                    INR — Indian Rupee
                  </ZoruSelectItem>
                  <ZoruSelectItem value="GBP">
                    GBP — British Pound
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <ZoruLabel htmlFor="customDomain">Custom domain</ZoruLabel>
              <ZoruSelect
                name="customDomain"
                defaultValue={shop.customDomain || "none"}
              >
                <ZoruSelectTrigger id="customDomain">
                  <ZoruSelectValue placeholder="Select a verified domain…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="none">
                    None (use default)
                  </ZoruSelectItem>
                  {verifiedDomains.map((d) => (
                    <ZoruSelectItem
                      key={d._id.toString()}
                      value={d.hostname}
                    >
                      {d.hostname}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
              <p className="text-xs text-zoru-ink-muted">
                Add and verify domains in the section below.
              </p>
            </div>
          </div>

          <ZoruSeparator />

          <div>
            <h3 className="flex items-center gap-2 text-base tracking-tight text-zoru-ink">
              <CreditCard className="h-4 w-4" /> Payment links
            </h3>
            <p className="mb-4 mt-1 text-sm text-zoru-ink-muted">
              Provide direct payment links for services like Razorpay, Paytm,
              or GPay to enable &ldquo;Pay&rdquo; buttons in your shop flows.
            </p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="paymentLinkRazorpay">
                  Razorpay link
                </ZoruLabel>
                <ZoruInput
                  id="paymentLinkRazorpay"
                  name="paymentLinkRazorpay"
                  placeholder="https://rzp.io/l/yourlink"
                  defaultValue={shop.paymentLinkRazorpay || ""}
                />
              </div>
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="paymentLinkPaytm">Paytm link</ZoruLabel>
                <ZoruInput
                  id="paymentLinkPaytm"
                  name="paymentLinkPaytm"
                  placeholder="https://p.paytm.me/yourlink"
                  defaultValue={shop.paymentLinkPaytm || ""}
                />
              </div>
              <div className="space-y-1.5">
                <ZoruLabel htmlFor="paymentLinkGPay">
                  Google Pay link
                </ZoruLabel>
                <ZoruInput
                  id="paymentLinkGPay"
                  name="paymentLinkGPay"
                  placeholder="gpay://…"
                  defaultValue={shop.paymentLinkGPay || ""}
                />
              </div>
            </div>
          </div>

          <ZoruSeparator />

          <div>
            <h3 className="flex items-center gap-2 text-base tracking-tight text-zoru-ink">
              <Bell className="h-4 w-4" /> Abandoned cart reminder
            </h3>
            <p className="mb-4 mt-1 text-sm text-zoru-ink-muted">
              Automatically send a follow-up message to users who leave items
              in their cart.
            </p>
            <div className="space-y-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line p-4">
              <div className="flex items-center justify-between">
                <ZoruLabel
                  htmlFor="abandonedCart.enabled"
                  className="text-sm tracking-tight text-zoru-ink"
                >
                  Enable reminder
                </ZoruLabel>
                <ZoruSwitch
                  id="abandonedCart.enabled"
                  name="abandonedCart.enabled"
                  defaultChecked={shop.abandonedCart?.enabled || false}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="abandonedCart.delayMinutes">
                    Delay (minutes)
                  </ZoruLabel>
                  <ZoruInput
                    id="abandonedCart.delayMinutes"
                    name="abandonedCart.delayMinutes"
                    type="number"
                    defaultValue={shop.abandonedCart?.delayMinutes || 60}
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="abandonedCart.flowId">
                    Reminder flow
                  </ZoruLabel>
                  <ZoruSelect
                    name="abandonedCart.flowId"
                    defaultValue={shop.abandonedCart?.flowId}
                  >
                    <ZoruSelectTrigger id="abandonedCart.flowId">
                      <ZoruSelectValue placeholder="Select a flow…" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {ecommFlows.map((flow) => (
                        <ZoruSelectItem
                          key={flow._id.toString()}
                          value={flow._id.toString()}
                        >
                          {flow.name}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
            </div>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <SubmitButton />
        </ZoruCardFooter>
      </ZoruCard>
    </form>
  );
}
