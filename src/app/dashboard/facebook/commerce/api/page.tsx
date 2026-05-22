"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from "react";
import Link from "next/link";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Package,
  RotateCw,
  Server,
  Settings,
  ShoppingBag,
  Webhook,
  } from "lucide-react";

/**
 * /dashboard/facebook/commerce/api — Meta Suite Commerce API reference
 * + integration config.
 *
 * Two stacked surfaces:
 *   1. Integration config form — webhook URL, signing secret, key
 *      preview. Read-only by default with an explicit "Rotate key"
 *      destructive action that opens a ZoruAlertDialog.
 *   2. API reference cards — overview of the Meta APIs that power the
 *      Commerce builder. Same content as the legacy page, restyled.
 *
 * Pure ZoruUI primitives. No coloured gradients.
 */

import * as React from "react";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";
import { RotateApiKeyConfirmDialog } from "../../_components/commerce-api-dialogs";

const API_AREAS = [
  {
    title: "Business setup",
    icon: Settings,
    apis: ["Graph API", "Business Management API"],
    description: "Merchant registration and business asset management.",
  },
  {
    title: "Catalogs & products",
    icon: ShoppingBag,
    apis: ["Product Catalog API"],
    description:
      "Upload, manage and organize products and product collections.",
  },
  {
    title: "Shops",
    icon: LayoutGrid,
    apis: ["Commerce API"],
    description: "Create and configure your Facebook Shop storefront.",
  },
  {
    title: "Orders & fulfillment",
    icon: Package,
    apis: ["Commerce Orders API"],
    description: "Handle orders, payments (where applicable) and fulfillment.",
  },
  {
    title: "Ads (optional)",
    icon: Megaphone,
    apis: ["Marketing API"],
    description: "Boost products and create dynamic catalog ads.",
  },
  {
    title: "Messaging (optional)",
    icon: MessageSquare,
    apis: ["Messenger Platform API"],
    description: "Customer communication for orders and support.",
  },
  {
    title: "Automation",
    icon: Webhook,
    apis: ["Webhooks"],
    description:
      "Real-time notifications for orders, messages and product updates.",
  },
] as const;

const PLACEHOLDER_KEY = "sk_meta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export default function CommerceApiPage() {
  const { toast } = useZoruToast();
  const [showKey, setShowKey] = useState(false);
  const [keyValue, setKeyValue] = useState(PLACEHOLDER_KEY);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [rotateOpen, setRotateOpen] = useState(false);

  // Hydrate from local storage so config "sticks" across navigations.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setWebhookUrl(localStorage.getItem("commerceWebhookUrl") ?? "");
    setSigningSecret(localStorage.getItem("commerceSigningSecret") ?? "");
    const autoRaw = localStorage.getItem("commerceAutoSync");
    if (autoRaw !== null) setAutoSync(autoRaw === "true");
  }, []);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("commerceWebhookUrl", webhookUrl);
      localStorage.setItem("commerceSigningSecret", signingSecret);
      localStorage.setItem("commerceAutoSync", String(autoSync));
    }
    toast({
      title: "Configuration saved",
      description: "Commerce API settings updated for this project.",
      variant: "success",
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      toast({
        title: "API key copied",
        description: "The current key has been copied to your clipboard.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Couldn't access the clipboard. Copy manually instead.",
        variant: "destructive",
      });
    }
  };

  const handleRotate = async () => {
    // Issue a placeholder key so the UI can demonstrate the rotation
    // flow until the server-side endpoint is wired up.
    const next =
      "sk_meta_" +
      Array.from({ length: 32 })
        .map(() => Math.floor(Math.random() * 36).toString(36))
        .join("");
    setKeyValue(next);
    setShowKey(true);
  };

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="API" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="API & integrations"
        description="Configure the Commerce API key, webhook endpoint and review the Meta APIs that power your Facebook Shop."
      />

      {/* ── Integration config ── */}
      <Card className="mt-6">
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Integration configuration
          </ZoruCardTitle>
          <ZoruCardDescription>
            Manage credentials and the webhook endpoint Meta will call when
            commerce events occur.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="api-key">Commerce API key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                value={keyValue}
                readOnly
                type={showKey ? "text" : "password"}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={showKey ? "Hide key" : "Show key"}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff /> : <Eye />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy key"
                onClick={handleCopy}
              >
                <Copy />
              </Button>
            </div>
            <p className="text-[11.5px] text-zoru-ink-muted">
              Treat this value as a secret. Rotate it if it has ever been
              shared, committed or leaked.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://example.com/webhooks/meta-commerce"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="signing-secret">Signing secret</Label>
            <Input
              id="signing-secret"
              type="password"
              placeholder="Used to verify Meta webhook signatures"
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zoru-ink">
                Auto-sync catalog
              </p>
              <p className="text-[11.5px] text-zoru-ink-muted">
                Pull catalog changes from Meta every 30 minutes.
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={autoSync}
              onCheckedChange={setAutoSync}
            />
          </div>
        </ZoruCardContent>
        <ZoruCardFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setRotateOpen(true)}
          >
            <RotateCw />
            Rotate API key
          </Button>
          <Button onClick={handleSave}>
            <KeyRound />
            Save configuration
          </Button>
        </ZoruCardFooter>
      </Card>

      <Alert className="mt-6">
        <KeyRound className="h-4 w-4" />
        <ZoruAlertTitle>Need to wire a webhook?</ZoruAlertTitle>
        <ZoruAlertDescription>
          Webhook subscriptions and signing live under{" "}
          <Link
            href="/dashboard/facebook/webhooks"
            className="underline-offset-2 hover:underline"
          >
            Meta Suite › Webhooks
          </Link>
          . Configure your endpoint there and return here to plug in the
          signing secret.
        </ZoruAlertDescription>
      </Alert>

      {/* ── API reference cards ── */}
      <section className="mt-8">
        <h2 className="text-[15px] font-medium text-zoru-ink">
          Meta API reference
        </h2>
        <p className="mt-1 text-sm text-zoru-ink-muted">
          The Meta APIs that power the Commerce builder. Click through to
          official docs on the link below.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {API_AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <Card key={area.title} className="flex h-full flex-col">
                <ZoruCardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface-2 text-zoru-ink">
                      <Icon className="h-4 w-4" />
                    </div>
                    <ZoruCardTitle className="text-base">
                      {area.title}
                    </ZoruCardTitle>
                  </div>
                  <ZoruCardDescription>{area.description}</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="mt-auto flex flex-wrap gap-2">
                  {area.apis.map((api) => (
                    <Badge key={api} variant="outline">
                      {api}
                    </Badge>
                  ))}
                </ZoruCardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-zoru-ink-muted">
          For detailed documentation, see the{" "}
          <Link
            href="https://developers.facebook.com/docs/commerce-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zoru-ink underline-offset-2 hover:underline"
          >
            Meta Commerce Platform docs
          </Link>
          .
        </p>
      </section>

      <RotateApiKeyConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        onRotate={handleRotate}
      />
    </CommercePage>
  );
}
