"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
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

/**
 * /dashboard/facebook/custom-ecommerce — Custom E-commerce shop list.
 *
 * Lists every connected Facebook page as a manageable shop tile and
 * exposes a create-shop dialog. Pure ZoruUI — no clay-*, no
 * @/components/ui/*, no wabasimplify visuals. Same data + handlers.
 */

import * as React from "react";

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
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
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
    <Card className="flex flex-col p-5">
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
        <Button onClick={handleManageShop} className="w-full">
          Manage shop <ArrowRight />
        </Button>
      </div>
    </Card>
  );
}

function CreateShopSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      Create shop
    </Button>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label htmlFor="ecomm-shop-project">Facebook page</Label>
            <Select
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
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ecomm-shop-name">Shop name</Label>
            <Input
              id="ecomm-shop-name"
              name="name"
              placeholder="e.g., My T-Shirt Store"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ecomm-shop-currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <ZoruSelectTrigger id="ecomm-shop-currency">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="USD">USD — US Dollar</ZoruSelectItem>
                <ZoruSelectItem value="EUR">EUR — Euro</ZoruSelectItem>
                <ZoruSelectItem value="INR">INR — Indian Rupee</ZoruSelectItem>
                <ZoruSelectItem value="GBP">GBP — British Pound</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <CreateShopSubmit />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
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
      <Breadcrumb>
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
      </Breadcrumb>

      <div className="relative mt-5">
        <FeatureLockOverlay
          isAllowed={isAllowed}
          featureName="Custom E-commerce"
        />
        <FeatureLock isAllowed={isAllowed}>
          <PageHeader>
            <ZoruPageHeading>
              <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
              <ZoruPageTitle>Custom Shops</ZoruPageTitle>
              <ZoruPageDescription>
                Select a Facebook page to manage its e-commerce storefront,
                products, and automation.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <Button
                onClick={() => setCreateOpen(true)}
                disabled={projects.length === 0}
              >
                <Plus /> Create new shop
              </Button>
            </ZoruPageActions>
          </PageHeader>

          <div className="mt-6">
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ShopCard key={project._id.toString()} project={project} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Store />}
                title="No Facebook pages connected"
                description="Connect your Facebook account on the Meta Suite Connections page to start building custom shops."
                action={
                  <Button asChild>
                    <Link href="/dashboard/facebook/all-projects">
                      Open Connections <ArrowRight />
                    </Link>
                  </Button>
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
