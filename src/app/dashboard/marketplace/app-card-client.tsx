"use client";

import { useState } from "react";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Badge,
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Button,
  useZoruToast
} from "@/components/sabcrm/20ui/zoru";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { App, AppPricing } from "@/lib/marketplace";
import { installMarketplaceAppAction, submitAppReviewAction } from "./actions";

function PriceBadge({ pricing }: { pricing: AppPricing }) {
  if (pricing.type === "free") {
    return <Badge variant="secondary">Free</Badge>;
  }
  const label =
    pricing.type === "subscription"
      ? "Subscription"
      : pricing.type === "one-time"
        ? "One-time"
        : "Usage-based";
  const formatted =
    pricing.amount !== undefined && pricing.currency
      ? `${pricing.currency} ${(pricing.amount / 100).toFixed(2)}`
      : null;
  return (
    <Badge variant="outline" className="whitespace-nowrap">
      {formatted ? `${formatted} · ${label}` : label}
    </Badge>
  );
}

export function AppCardClient({ app, isInstalled }: { app: App; isInstalled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const { toast } = useZoruToast();
  const router = useRouter();

  const handleInstall = async () => {
    try {
      setInstalling(true);
      await installMarketplaceAppAction(app.appId);
      toast({
        title: "App installed",
        description: `${app.manifest.name} has been successfully installed.`,
        variant: "default",
      });
      router.refresh(); // Refresh data like installCount and isInstalled status
    } catch (err: any) {
      toast({
        title: "Install failed",
        description: err.message || "An error occurred during installation.",
        variant: "destructive",
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleRate = async (value: number) => {
    if (!isInstalled) return;
    setRating(value);
    setSubmittingRating(true);
    try {
      await submitAppReviewAction(app.appId, value);
      toast({
        title: "Rating submitted",
        description: `Thank you for rating ${app.manifest.name}.`,
        variant: "default",
      });
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Failed to submit rating",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <ZoruDialogTrigger asChild>
        <button className="group focus:outline-none text-left h-full w-full">
          <Card interactive className="h-full flex flex-col">
            <ZoruCardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {app.manifest.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={app.manifest.iconUrl}
                      alt=""
                      className="h-10 w-10 rounded-md border border-[var(--st-border)] object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-base font-semibold text-[var(--st-text-secondary)]">
                      {app.manifest.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <ZoruCardTitle className="text-base">
                      {app.manifest.name}
                    </ZoruCardTitle>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      by {app.manifest.publisher.name}
                    </span>
                  </div>
                </div>
                <PriceBadge pricing={app.manifest.pricing} />
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="flex flex-col gap-3 flex-grow">
              {app.manifest.description ? (
                <ZoruCardDescription className="line-clamp-3">
                  {app.manifest.description}
                </ZoruCardDescription>
              ) : (
                <ZoruCardDescription className="italic text-[var(--st-text-secondary)]">
                  No description provided.
                </ZoruCardDescription>
              )}
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {app.manifest.categories.slice(0, 3).map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-[10px]">
                    {cat}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                <div className="flex items-center gap-2">
                  <span>v{app.manifest.version}</span>
                  <span>•</span>
                  <span>
                    {app.installCount.toLocaleString()} install{app.installCount === 1 ? "" : "s"}
                  </span>
                </div>
                {app.averageRating !== null && app.averageRating !== undefined && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-[var(--st-warn)] text-[var(--st-warn)]" />
                    <span>{app.averageRating.toFixed(1)}</span>
                    <span className="text-[var(--st-text-secondary)]/70">({app.reviewCount})</span>
                  </div>
                )}
              </div>
            </ZoruCardContent>
          </Card>
        </button>
      </ZoruDialogTrigger>
      
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <div className="flex items-center gap-4 mb-4">
            {app.manifest.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.manifest.iconUrl}
                alt=""
                className="h-16 w-16 rounded-lg border border-[var(--st-border)] object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-2xl font-semibold text-[var(--st-text-secondary)]">
                {app.manifest.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <ZoruDialogTitle className="text-xl mb-1">{app.manifest.name}</ZoruDialogTitle>
              <div className="flex items-center gap-3 text-sm text-[var(--st-text-secondary)]">
                <span>by {app.manifest.publisher.name}</span>
                {app.averageRating !== null && app.averageRating !== undefined && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[var(--st-warn)] text-[var(--st-warn)]" />
                    <span className="font-medium text-[var(--st-text)]">{app.averageRating.toFixed(1)}</span>
                    <span>({app.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <ZoruDialogDescription className="text-base text-[var(--st-text)] whitespace-pre-wrap mt-2">
            {app.manifest.description || "No description provided."}
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        
        <div className="py-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Categories</h4>
            <div className="flex flex-wrap gap-2">
              {app.manifest.categories.map((cat) => (
                <Badge key={cat} variant="secondary">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center bg-[var(--st-bg-secondary)] p-3 rounded-lg border border-[var(--st-border)]">
            <div>
              <div className="text-sm font-medium">Pricing</div>
              <div className="text-sm text-[var(--st-text-secondary)] capitalize">
                {app.manifest.pricing.type.replace("-", " ")}
              </div>
            </div>
            <PriceBadge pricing={app.manifest.pricing} />
          </div>

          {isInstalled && (
            <div className="flex items-center justify-between bg-[var(--st-bg-secondary)] p-3 rounded-lg border border-[var(--st-border)]">
              <div className="text-sm font-medium">Rate this App</div>
              <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={submittingRating}
                    onMouseEnter={() => setHoverRating(star)}
                    onClick={() => handleRate(star)}
                    className="focus:outline-none transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        (hoverRating || rating) >= star
                          ? "fill-[var(--st-warn)] text-[var(--st-warn)]"
                          : "text-[var(--st-border)]"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between text-sm text-[var(--st-text-secondary)] pt-2 border-t border-[var(--st-border)]">
            <span>Version {app.manifest.version}</span>
            <span>{app.installCount.toLocaleString()} total installs</span>
          </div>
        </div>
        
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={installing}>
            Close
          </Button>
          {!isInstalled ? (
            <Button onClick={handleInstall} disabled={installing}>
              {installing ? "Installing..." : "Install App"}
            </Button>
          ) : (
            <Button disabled variant="secondary">
              Installed
            </Button>
          )}
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
