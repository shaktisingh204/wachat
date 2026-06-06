"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Card,
  ZoruColorPicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft,
  Brush,
  LoaderCircle,
  Save } from "lucide-react";

import {
  applyEcommShopTheme,
  getEcommShopById,
  saveEcommShopTheme,
  } from "@/app/actions/custom-ecommerce.actions";
import type { EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/appearance
 *
 * Per-shop theme picker. Uses ZoruColorPicker with neutral presets and a
 * Card preview pane (storefront mock) — same neutral palette as the
 * account-level appearance page. Save flow goes through a confirmation
 * dialog before persisting.
 *
 * NOTE: the legacy route was a redirect; the active per-shop appearance
 * lives here so the layout sub-nav doesn't link to it. We keep the page
 * functional for direct navigation (e.g. from the account-level page's
 * footnote) and provide a "Back to settings" CTA.
 */

import * as React from "react";

const NEUTRAL_PRESETS = [
  "#0F0F10",
  "#1F1F23",
  "#3F3F46",
  "#52525B",
  "#71717A",
  "#A1A1AA",
  "#D4D4D8",
  "#E4E4E7",
  "#F4F4F5",
  "#FAFAFA",
];

const PRESET_PALETTES: { id: string; label: string; primary: string }[] = [
  { id: "ink", label: "Ink", primary: "#0F0F10" },
  { id: "graphite", label: "Graphite", primary: "#3F3F46" },
  { id: "stone", label: "Stone", primary: "#71717A" },
  { id: "fog", label: "Fog", primary: "#A1A1AA" },
];

export default function ShopAppearancePage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;
  const { toast } = useZoruToast();

  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();

  const [primary, setPrimary] = useState("#0F0F10");
  const [presetId, setPresetId] = useState<string>("ink");
  const [themeName, setThemeName] = useState("Default");
  const [saveOpen, setSaveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    getEcommShopById(shopId)
      .then((data) => {
        setShop(data);
        if (data?.appearance?.primaryColor) {
          setPrimary(data.appearance.primaryColor);
          setPresetId("custom");
        }
      })
      .finally(() => setIsLoading(false));
  }, [shopId]);

  const handlePickPreset = (id: string, color: string) => {
    setPresetId(id);
    setPrimary(color);
  };

  const handleSave = () => {
    if (!shop) return;
    startSaving(async () => {
      const result = await saveEcommShopTheme(
        shop._id.toString(),
        themeName || "Default",
      );
      if (result.success) {
        toast({
          title: "Theme saved",
          description: `“${themeName}” is now stored on this shop.`,
        });
      } else {
        toast({
          title: "Could not save theme",
          description: result.error,
          variant: "destructive",
        });
      }
      setSaveOpen(false);
    });
  };

  const handlePublish = () => {
    if (!shop) return;
    startPublishing(async () => {
      const result = await applyEcommShopTheme(shop._id.toString());
      if (result.error) {
        toast({
          title: "Could not publish",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Theme published",
          description: result.message,
        });
      }
      setPublishOpen(false);
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--st-text-secondary)]">
          This shop could not be loaded.
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/facebook/custom-ecommerce">
            <ArrowLeft />
            Back to all shops
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] tracking-tight text-[var(--st-text)]">
            Appearance
          </h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            Customize the storefront palette for {shop.name}. Saved themes
            stay attached to this shop; publishing re-applies the active
            theme to the live storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSaveOpen(true)}>
            <Save />
            Save theme
          </Button>
          <Button onClick={() => setPublishOpen(true)}>
            Publish shop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="p-5">
          <h3 className="text-[15px] tracking-tight text-[var(--st-text)]">
            Palette presets
          </h3>
          <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
            Neutral-only — choose how dark the primary surface should be.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRESET_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePickPreset(p.id, p.primary)}
                className={
                  "flex items-center gap-2 rounded-[var(--st-radius)] border px-3 py-2 text-left text-[13px] transition-colors " +
                  (presetId === p.id
                    ? "border-[var(--st-text)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                    : "border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)]")
                }
              >
                <span
                  className="h-5 w-5 rounded-full border border-[var(--st-border)]"
                  style={{ backgroundColor: p.primary }}
                />
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-1.5">
            <Label htmlFor="primary-color">Primary color</Label>
            <ZoruColorPicker
              value={primary}
              onChange={(c) => {
                setPrimary(c);
                setPresetId("custom");
              }}
              presets={NEUTRAL_PRESETS}
            />
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              Used for primary buttons, links, and selection states inside
              the live storefront.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="theme-name">Theme name</Label>
            <Input
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="e.g. Default"
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
            <Brush className="h-3.5 w-3.5" />
            Live preview
          </div>
          <h3 className="mt-2 text-[18px] tracking-tight text-[var(--st-text)]">
            Storefront preview
          </h3>
          <div
            className="mt-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-6"
            style={{
              backgroundColor: "var(--zoru-bg)",
              color: "var(--zoru-ink)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] tracking-tight">
                {shop.name}
              </span>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-[12px] text-white"
                style={{ backgroundColor: primary }}
              >
                Shop now
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <div className="aspect-square w-full rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]" />
                  <p className="mt-2 truncate text-[12px] text-[var(--st-text)]">
                    Sample product {i}
                  </p>
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: primary }}
                  >
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: shop.currency || "USD",
                    }).format(24)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save theme?</ZoruDialogTitle>
            <ZoruDialogDescription>
              The current palette will be saved to this shop as
              &ldquo;{themeName}&rdquo;. You can publish it later from this
              page.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="animate-spin" /> : null}
              Save theme
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Publish shop?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will re-apply the saved theme and refresh the live
              storefront layout. Visitors may see a brief flash while the
              new layout takes effect.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isPublishing}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handlePublish}>
              {isPublishing ? <LoaderCircle className="animate-spin" /> : null}
              Publish
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
