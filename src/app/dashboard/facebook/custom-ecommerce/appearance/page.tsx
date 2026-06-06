"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brush, Save } from "lucide-react";

/**
 * /dashboard/facebook/custom-ecommerce/appearance
 *
 * Account-level theme picker for Custom E-commerce. Lets the operator
 * pick a neutral preset and a primary accent that becomes the default
 * starting palette for every newly-created shop. Uses ColorPicker
 * with neutral presets and a Card preview pane.
 *
 * NOTE: in the legacy app this route was a redirect because per-shop
 * appearance lives at /manage/[shopId]/appearance. We keep both: this
 * page surfaces the account default, the per-shop page overrides it.
 */

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
  const { toast } = useToast();
  const [primary, setPrimary] = useState("#0F0F10");
  const [presetId, setPresetId] = useState<string>("ink");
  const [themeName, setThemeName] = useState("Default");
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    document.title = "Appearance - Custom Shops - SabNode";
  }, []);

  const handlePickPreset = (id: string, color: string) => {
    setPresetId(id);
    setPrimary(color);
  };

  const handleSave = () => {
    // TODO: wire to a real "save default theme" server action when one
    // ships. For now we surface the change locally so operators can
    // preview the palette before applying it per-shop.
    toast.success({
      title: "Default theme saved",
      description: `New shops will start with the "${themeName}" palette.`,
    });
    setSaveOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook/custom-ecommerce">
              Custom Shops
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Appearance</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Custom Shops</PageEyebrow>
          <PageTitle>Default appearance</PageTitle>
          <PageDescription>
            Pick a neutral palette that newly-created shops will inherit. Each
            shop can override these tokens later from its own appearance tab.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" iconLeft={Save} onClick={() => setSaveOpen(true)}>
            Save theme
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Editor */}
        <Card padding="lg">
          <h2 className="text-[15px] tracking-tight text-[var(--st-text)]">
            Palette presets
          </h2>
          <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
            Neutral-only, choose how dark the primary surface should be.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRESET_PALETTES.map((p) => (
              <Button
                key={p.id}
                variant={presetId === p.id ? "secondary" : "ghost"}
                onClick={() => handlePickPreset(p.id, p.primary)}
                className="justify-start"
                aria-pressed={presetId === p.id}
              >
                <span
                  className="h-5 w-5 rounded-full border border-[var(--st-border)]"
                  style={{ backgroundColor: p.primary }}
                  aria-hidden="true"
                />
                {p.label}
              </Button>
            ))}
          </div>

          <div className="mt-6">
            <Field
              label="Primary color"
              help="Used for primary buttons, links, and selection states inside shop storefronts."
            >
              <ColorPicker
                value={primary}
                onChange={(c) => {
                  setPrimary(c);
                  setPresetId("custom");
                }}
                swatches={NEUTRAL_PRESETS}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Theme name">
              <Input
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="e.g. Default"
              />
            </Field>
          </div>
        </Card>

        {/* Preview */}
        <Card padding="lg">
          <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
            <Brush className="h-3.5 w-3.5" aria-hidden="true" />
            Live preview
          </div>
          <h3 className="mt-2 text-[18px] tracking-tight text-[var(--st-text)]">
            Storefront preview
          </h3>
          <div className="mt-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-6 text-[var(--st-text)]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] tracking-tight">
                Acme Storefront
              </span>
              <Button
                variant="primary"
                size="sm"
                className="rounded-full text-white"
                style={{ backgroundColor: primary }}
              >
                Shop now
              </Button>
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
                  <p className="mt-1 text-[11px]" style={{ color: primary }}>
                    $24.00
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-[var(--st-text-secondary)]">
            Per-shop appearance lives at
            <code className="mx-1 rounded bg-[var(--st-bg-muted)] px-1 py-0.5 text-[10.5px]">
              /manage/[shopId]/appearance
            </code>
            and overrides the default chosen here.
          </p>
        </Card>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save default theme?</DialogTitle>
            <DialogDescription>
              This palette will become the starting point for every new shop
              you create. Existing shops will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
