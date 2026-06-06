"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Radio,
  RadioGroup,
  Skeleton,
  useToast,
} from "@/components/sabcrm/20ui";
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
 * Per-shop theme picker. Uses ColorPicker with neutral presets and a
 * Card preview pane (storefront mock), same neutral palette as the
 * account-level appearance page. Save flow goes through a confirmation
 * dialog before persisting.
 *
 * NOTE: the legacy route was a redirect; the active per-shop appearance
 * lives here so the layout sub-nav does not link to it. We keep the page
 * functional for direct navigation (e.g. from the account-level page's
 * footnote) and provide a "Back to settings" CTA.
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

export default function ShopAppearancePage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;
  const { toast } = useToast();

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

  const handlePickPreset = (id: string) => {
    const match = PRESET_PALETTES.find((p) => p.id === id);
    if (!match) return;
    setPresetId(id);
    setPrimary(match.primary);
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
          description: `"${themeName}" is now stored on this shop.`,
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
        <Link href="/dashboard/facebook/custom-ecommerce">
          <Button variant="outline" iconLeft={ArrowLeft}>
            Back to all shops
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Appearance</PageTitle>
          <PageDescription>
            Customize the storefront palette for {shop.name}. Saved themes
            stay attached to this shop; publishing re-applies the active
            theme to the live storefront.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Save} onClick={() => setSaveOpen(true)}>
            Save theme
          </Button>
          <Button variant="primary" onClick={() => setPublishOpen(true)}>
            Publish shop
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card padding="lg">
          <h3 className="text-[15px] tracking-tight text-[var(--st-text)]">
            Palette presets
          </h3>
          <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
            Neutral only. Choose how dark the primary surface should be.
          </p>
          <RadioGroup
            className="mt-4 grid grid-cols-2 gap-2"
            aria-label="Palette preset"
            value={presetId}
            onValueChange={handlePickPreset}
          >
            {PRESET_PALETTES.map((p) => (
              <Radio
                key={p.id}
                value={p.id}
                label={
                  <span className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full border border-[var(--st-border)]"
                      style={{ backgroundColor: p.primary }}
                      aria-hidden="true"
                    />
                    {p.label}
                  </span>
                }
              />
            ))}
          </RadioGroup>

          <div className="mt-6">
            <Field label="Primary color" help="Used for primary buttons, links, and selection states inside the live storefront.">
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
                {shop.name}
              </span>
              <Button
                variant="primary"
                size="sm"
                className="rounded-full text-white"
                style={{ backgroundColor: primary, borderColor: primary }}
                tabIndex={-1}
                aria-hidden="true"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save theme?</DialogTitle>
            <DialogDescription>
              The current palette will be saved to this shop as
              "{themeName}". You can publish it later from this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Save theme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish shop?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-apply the saved theme and refresh the live
              storefront layout. Visitors may see a brief flash while the
              new layout takes effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction intent="primary" onClick={handlePublish}>
              {isPublishing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
