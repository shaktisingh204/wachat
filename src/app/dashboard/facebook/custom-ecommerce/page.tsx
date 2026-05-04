"use client";

/**
 * /dashboard/facebook/custom-ecommerce — Custom E-commerce shop list.
 *
 * Lists every connected Facebook page as a manageable shop tile and
 * exposes a create-shop dialog. Pure ZoruUI — no clay-*, no
 * @/components/ui/*, no wabasimplify visuals. Same data + handlers.
 */

import * as React from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  Plus,
  ShoppingBag,
  Store,
} from "lucide-react";

import { getProjects } from "@/app/actions/project.actions";
import { createEcommShop } from "@/app/actions/custom-ecommerce.actions";
import type { Project } from "@/lib/definitions";
import type { WithId } from "mongodb";
import { useProject } from "@/context/project-context";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  useZoruToast,
} from "@/components/zoruui";

import {
  FeatureLock,
  FeatureLockOverlay,
} from "@/app/dashboard/facebook/_components/feature-lock";
import { FacebookGlyph } from "@/app/dashboard/facebook/_components/icons";

const initialFormState: { message?: string; error?: string; shopId?: string } =
  {};

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-2">
          <ZoruSkeleton className="h-9 w-64" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <ZoruSkeleton className="h-9 w-40 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}

function ShopCard({ project }: { project: WithId<Project> }) {
  const router = useRouter();

  const handleManageShop = () => {
    try {
      localStorage.setItem("activeProjectId", project._id.toString());
    } catch {
      // ignore — non-critical
    }
    router.push(
      `/dashboard/facebook/custom-ecommerce/manage/${project._id.toString()}`,
    );
  };

  return (
    <ZoruCard className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
          <FacebookGlyph className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] tracking-tight text-zoru-ink leading-tight">
            {project.name}
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-zoru-ink-muted">
            Page ID: {project.facebookPageId ?? "—"}
          </p>
        </div>
      </div>
      <p className="mt-4 flex-1 text-[13px] text-zoru-ink-muted">
        Manage products, pages, and automation for this Facebook Page.
      </p>
      <div className="mt-4">
        <ZoruButton onClick={handleManageShop} className="w-full">
          Manage shop <ArrowRight />
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

function CreateShopSubmit() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      Create shop
    </ZoruButton>
  );
}

interface CreateShopDialogProps {
  projects: WithId<Project>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function CreateShopDialog({
  projects,
  open,
  onOpenChange,
  onSuccess,
}: CreateShopDialogProps) {
  const [state, formAction] = useActionState(createEcommShop, initialFormState);
  const { toast } = useZoruToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");

  useEffect(() => {
    if (open && projects[0]) {
      setSelectedProjectId(projects[0]._id.toString());
    }
  }, [open, projects]);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Shop created", description: state.message });
      onSuccess();
      onOpenChange(false);
    }
    if (state.error) {
      toast({
        title: "Could not create shop",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSuccess, onOpenChange]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={selectedProjectId} />
          <input type="hidden" name="currency" value={currency} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Create new shop</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a Facebook page, name your storefront, and choose a currency.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="ecomm-shop-project">Facebook page</ZoruLabel>
            <ZoruSelect
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <ZoruSelectTrigger id="ecomm-shop-project">
                <ZoruSelectValue placeholder="Select a Facebook page" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {projects.map((p) => (
                  <ZoruSelectItem key={p._id.toString()} value={p._id.toString()}>
                    {p.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="ecomm-shop-name">Shop name</ZoruLabel>
            <ZoruInput
              id="ecomm-shop-name"
              name="name"
              placeholder="e.g., My T-Shirt Store"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="ecomm-shop-currency">Currency</ZoruLabel>
            <ZoruSelect value={currency} onValueChange={setCurrency}>
              <ZoruSelectTrigger id="ecomm-shop-currency">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="USD">USD — US Dollar</ZoruSelectItem>
                <ZoruSelectItem value="EUR">EUR — Euro</ZoruSelectItem>
                <ZoruSelectItem value="INR">INR — Indian Rupee</ZoruSelectItem>
                <ZoruSelectItem value="GBP">GBP — British Pound</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <CreateShopSubmit />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default function CustomEcommerceShopListPage() {
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { sessionUser } = useProject();

  const isAllowed = sessionUser?.plan?.features?.ecommerce ?? false;

  useEffect(() => {
    setIsClient(true);
    document.title = "Custom Shops · SabNode";
  }, []);

  const fetchProjects = useCallback(() => {
    startLoading(async () => {
      const projectsData = (await getProjects(undefined, "facebook")) as
        | WithId<Project>[]
        | { projects?: WithId<Project>[] };
      // Guard against either shape: array OR { projects } wrapper.
      const list = Array.isArray(projectsData)
        ? projectsData
        : (projectsData?.projects ?? []);
      setProjects(list);
    });
  }, []);

  useEffect(() => {
    if (isClient) fetchProjects();
  }, [isClient, fetchProjects]);

  if (!isClient || isLoading) return <PageSkeleton />;

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
            <ZoruBreadcrumbPage>Custom Shops</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="relative mt-5">
        <FeatureLockOverlay
          isAllowed={isAllowed}
          featureName="Custom E-commerce"
        />
        <FeatureLock isAllowed={isAllowed}>
          <ZoruPageHeader>
            <ZoruPageHeading>
              <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
              <ZoruPageTitle>Custom Shops</ZoruPageTitle>
              <ZoruPageDescription>
                Select a Facebook page to manage its e-commerce storefront,
                products, and automation.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <ZoruButton
                onClick={() => setCreateOpen(true)}
                disabled={projects.length === 0}
              >
                <Plus /> Create new shop
              </ZoruButton>
            </ZoruPageActions>
          </ZoruPageHeader>

          <div className="mt-6">
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ShopCard key={project._id.toString()} project={project} />
                ))}
              </div>
            ) : (
              <ZoruEmptyState
                icon={<Store />}
                title="No Facebook pages connected"
                description="Connect your Facebook account on the Meta Suite Connections page to start building custom shops."
                action={
                  <ZoruButton asChild>
                    <Link href="/dashboard/facebook/all-projects">
                      Open Connections <ArrowRight />
                    </Link>
                  </ZoruButton>
                }
              />
            )}
          </div>
        </FeatureLock>
      </div>

      <CreateShopDialog
        projects={projects}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchProjects}
      />
    </div>
  );
}
