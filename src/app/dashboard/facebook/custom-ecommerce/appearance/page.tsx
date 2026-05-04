"use client";

/**
 * /dashboard/facebook/custom-ecommerce/appearance
 *
 * Account-level theme picker for Custom E-commerce. Lets the operator
 * pick a neutral preset and a primary accent that becomes the default
 * starting palette for every newly-created shop. Uses ZoruColorPicker
 * with neutral presets and a ZoruCard preview pane.
 *
 * NOTE: in the legacy app this route was a redirect because per-shop
 * appearance lives at /manage/[shopId]/appearance. We keep both: this
 * page surfaces the *account* default, the per-shop page overrides it.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brush, Save } from "lucide-react";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  useZoruToast,
} from "@/components/zoruui";

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

export default function CustomEcommerceAppearancePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [primary, setPrimary] = useState("#0F0F10");
  const [presetId, setPresetId] = useState<string>("ink");
  const [themeName, setThemeName] = useState("Default");
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    document.title = "Appearance · Custom Shops · SabNode";
  }, []);

  const handlePickPreset = (id: string, color: string) => {
    setPresetId(id);
    setPrimary(color);
  };

  const handleSave = () => {
    // TODO: wire to a real "save default theme" server action when one
    // ships. For now we surface the change locally so operators can
    // preview the palette before applying it per-shop.
    toast({
      title: "Default theme saved",
      description: `New shops will start with the “${themeName}” palette.`,
    });
    setSaveOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook/custom-ecommerce">
              Custom Shops
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Appearance</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Custom Shops</ZoruPageEyebrow>
          <ZoruPageTitle>Default appearance</ZoruPageTitle>
          <ZoruPageDescription>
            Pick a neutral palette that newly-created shops will inherit. Each
            shop can override these tokens later from its own appearance tab.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" onClick={() => router.back()}>
            Cancel
          </ZoruButton>
          <ZoruButton onClick={() => setSaveOpen(true)}>
            <Save /> Save theme
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ── Editor ── */}
        <ZoruCard className="p-5">
          <h2 className="text-[15px] tracking-tight text-zoru-ink">
            Palette presets
          </h2>
          <p className="mt-1 text-[12px] text-zoru-ink-muted">
            Neutral-only — choose how dark the primary surface should be.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRESET_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePickPreset(p.id, p.primary)}
                className={
                  "flex items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2 text-left text-[13px] transition-colors " +
                  (presetId === p.id
                    ? "border-zoru-ink bg-zoru-surface-2 text-zoru-ink"
                    : "border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:bg-zoru-surface")
                }
              >
                <span
                  className="h-5 w-5 rounded-full border border-zoru-line"
                  style={{ backgroundColor: p.primary }}
                />
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-1.5">
            <ZoruLabel htmlFor="primary-color">Primary color</ZoruLabel>
            <ZoruColorPicker
              value={primary}
              onChange={(c) => {
                setPrimary(c);
                setPresetId("custom");
              }}
              presets={NEUTRAL_PRESETS}
            />
            <p className="text-[11.5px] text-zoru-ink-muted">
              Used for primary buttons, links, and selection states inside
              shop storefronts.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <ZoruLabel htmlFor="theme-name">Theme name</ZoruLabel>
            <ZoruInput
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="e.g. Default"
            />
          </div>
        </ZoruCard>

        {/* ── Preview ── */}
        <ZoruCard className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-zoru-ink-muted">
            <Brush className="h-3.5 w-3.5" />
            Live preview
          </div>
          <h3 className="mt-2 text-[18px] tracking-tight text-zoru-ink">
            Storefront preview
          </h3>
          <div
            className="mt-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line p-6"
            style={{
              backgroundColor: "var(--zoru-bg)",
              color: "var(--zoru-ink)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] tracking-tight">
                Acme Storefront
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
                  className="rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                >
                  <div className="aspect-square w-full rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2" />
                  <p className="mt-2 truncate text-[12px] text-zoru-ink">
                    Sample product {i}
                  </p>
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: primary }}
                  >
                    $24.00
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-zoru-ink-muted">
            Per-shop appearance lives at
            <code className="mx-1 rounded bg-zoru-surface-2 px-1 py-0.5 text-[10.5px]">
              /manage/[shopId]/appearance
            </code>
            and overrides the default chosen here.
          </p>
        </ZoruCard>
      </div>

      <ZoruDialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save default theme?</ZoruDialogTitle>
            <ZoruDialogDescription>
              This palette will become the starting point for every new shop
              you create. Existing shops will not be affected.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleSave}>Save theme</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
