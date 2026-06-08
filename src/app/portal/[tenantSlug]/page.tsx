import React from "react";
/**
 * Portal dashboard - the post-sign-in landing surface for a customer /
 * vendor / employee end-user. Verifies the `portal_session` cookie, loads
 * the matching `crm_portal_users` row, and renders a minimal grid of
 * role-aware placeholder cards.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import { getPortalSession } from "@/lib/portal/auth";
import {
  Button,
  Card,
  CardTitle,
  CardDescription,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

type PortalRole = "customer" | "vendor" | "employee";

interface PortalTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headerColor?: string;
  logoUrl?: string;
}

interface PortalConfig {
  theme?: PortalTheme;
  layout?: {
    customer?: string[];
    vendor?: string[];
    employee?: string[];
  };
  customWidgets?: {
    id: string;
    title: string;
    description: string;
    href: string;
  }[];
}

interface PortalUserView {
  _id: string;
  name: string;
  email: string;
  portalType: PortalRole;
}

interface CardSpec {
  id: string;
  title: string;
  description: string;
  href: string;
}

const ALL_WIDGETS: Record<PortalRole, CardSpec[]> = {
  vendor: [
    {
      id: "purchase-orders",
      title: "Your purchase orders",
      description: "Open POs awaiting acknowledgement.",
      href: `/purchase-orders`,
    },
    {
      id: "bills",
      title: "Your bills",
      description: "Submitted bills and their payment status.",
      href: `/bills`,
    },
    {
      id: "rfqs",
      title: "Your RFQs",
      description: "Requests for quotation you can respond to.",
      href: `/rfqs`,
    },
    {
      id: "contracts",
      title: "Your contracts",
      description: "Master service agreements and signed contracts.",
      href: `/contracts`,
    },
  ],
  employee: [
    {
      id: "payslips",
      title: "Your payslips",
      description: "Latest payslips and tax statements.",
      href: `/payslips`,
    },
    {
      id: "leaves",
      title: "Your leaves",
      description: "Leave balance and pending requests.",
      href: `/leaves`,
    },
    {
      id: "tasks",
      title: "Your tasks",
      description: "Items assigned to you across projects.",
      href: `/tasks`,
    },
    {
      id: "documents",
      title: "Your documents",
      description: "Onboarding documents and policies.",
      href: `/documents`,
    },
  ],
  customer: [
    {
      id: "orders",
      title: "Your orders",
      description: "Sales orders and their fulfilment status.",
      href: `/orders`,
    },
    {
      id: "invoices",
      title: "Your invoices",
      description: "Open invoices, receipts, and statements.",
      href: `/invoices`,
    },
    {
      id: "tickets",
      title: "Your tickets",
      description: "Support tickets you have opened.",
      href: `/tickets`,
    },
    {
      id: "contracts",
      title: "Your contracts",
      description: "Service contracts and renewals.",
      href: `/contracts`,
    },
  ],
};

function getCardsForRole(
  role: PortalRole,
  tenantSlug: string,
  config?: PortalConfig,
): CardSpec[] {
  const defaultWidgets = ALL_WIDGETS[role] || ALL_WIDGETS["customer"];
  const base = `/portal/${encodeURIComponent(tenantSlug)}`;
  const layoutConfig = config?.layout?.[role];
  const customWidgets = config?.customWidgets || [];

  let resolvedWidgets: CardSpec[] = [];

  if (layoutConfig && Array.isArray(layoutConfig)) {
    resolvedWidgets = layoutConfig
      .map((id) => {
        const builtIn = defaultWidgets.find((w) => w.id === id);
        if (builtIn) return builtIn;
        const custom = customWidgets.find((w) => w.id === id);
        if (custom) return custom;
        return undefined;
      })
      .filter((w): w is CardSpec => w !== undefined);

    if (resolvedWidgets.length === 0) {
      resolvedWidgets = defaultWidgets;
    }
  } else {
    resolvedWidgets = defaultWidgets;
  }

  return resolvedWidgets.map((w) => ({
    ...w,
    // don't prepend base for absolute URLs or custom widget links that are already absolute
    href: w.href.startsWith("http") ? w.href : `${base}${w.href}`,
  }));
}

async function getTenantConfig(tenantSlug: string) {
  const slug = (tenantSlug || "").trim();
  if (!slug) return null;

  try {
    const { db } = await connectToDatabase();

    let query = {};
    if (ObjectId.isValid(slug)) {
      query = { _id: new ObjectId(slug) };
    } else {
      query = { tenantSlug: slug };
    }

    const user = await db
      .collection("users")
      .findOne(query as never, {
        projection: { _id: 1, name: 1, portalConfig: 1 },
      });

    if (!user) return null;

    return {
      tenantId: String(user._id),
      name: (user.name as string) || "Portal",
      config: (user.portalConfig as PortalConfig) || {},
    };
  } catch {
    return null;
  }
}

async function loadPortalUser(
  userId: string,
  tenantId: string,
): Promise<PortalUserView | null> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(tenantId)) return null;
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection("crm_portal_users").findOne(
      {
        _id: new ObjectId(userId),
        userId: new ObjectId(tenantId),
        status: { $ne: "suspended" },
      } as never,
      { projection: { name: 1, email: 1, portalType: 1 } },
    );
    if (!doc) return null;
    const portalType = (doc.portalType ?? "customer") as PortalRole;
    return {
      _id: String(doc._id),
      name: (doc.name as string) ?? "",
      email: (doc.email as string) ?? "",
      portalType:
        portalType === "vendor" || portalType === "employee"
          ? portalType
          : "customer",
    };
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

async function PortalDashboardPageContent({ params }: PageProps) {
  const { tenantSlug } = await params;

  // Strict 404 handling and robust pre-fetch
  const tenantInfo = await getTenantConfig(tenantSlug);
  if (!tenantInfo) {
    notFound();
  }

  const session = await getPortalSession();
  if (!session) {
    redirect(`/portal/${encodeURIComponent(tenantSlug)}/login`);
  }

  if (session.tenantId !== tenantInfo.tenantId) {
    redirect(`/portal/${encodeURIComponent(tenantSlug)}/login`);
  }

  const portalUser = await loadPortalUser(session.userId, tenantInfo.tenantId);
  if (!portalUser) {
    // Session was valid but row is gone / suspended - bounce to login
    redirect(
      `/portal/${encodeURIComponent(tenantSlug)}/login?error=no_account`,
    );
  }

  const theme = tenantInfo.config.theme || {};
  // Tenant-branded colours are user-picked at runtime, so they drive the 20ui
  // accent/background tokens via runtime-computed CSS variables on the wrapper.
  const brandVars: React.CSSProperties = {};
  if (theme.primaryColor) brandVars["--st-accent" as string] = theme.primaryColor;
  if (theme.backgroundColor) brandVars["--st-bg" as string] = theme.backgroundColor;

  const cards = getCardsForRole(
    portalUser.portalType,
    tenantSlug,
    tenantInfo.config,
  );
  const roleLabel =
    portalUser.portalType.charAt(0).toUpperCase() +
    portalUser.portalType.slice(1);

  return (
    <main
      className="20ui min-h-screen bg-[var(--st-bg)] px-6 py-8"
      style={brandVars}
    >
      <div className="mx-auto max-w-[1080px]">
        <PageHeader>
          <PageHeaderHeading>
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt={`${tenantInfo.name} logo`}
                className="mb-3 block h-10 w-auto"
              />
            ) : null}
            <PageEyebrow>Welcome back</PageEyebrow>
            <PageTitle>{portalUser.name || portalUser.email}</PageTitle>
            <PageDescription>
              Signed in as {roleLabel} at {tenantInfo.name}
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <form
              action={`/portal/${encodeURIComponent(tenantSlug)}/auth/sign-out`}
              method="post"
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </PageActions>
        </PageHeader>

        <section className="mt-6">
          {cards.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Nothing here yet"
              description="Your portal does not have any sections configured. Check back soon."
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={c.href}
                  className="block no-underline text-inherit rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                >
                  <Card variant="interactive" padding="md" className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>{c.title}</CardTitle>
                      <ArrowUpRight
                        size={16}
                        className="shrink-0 text-[var(--st-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </div>
                    <CardDescription>{c.description}</CardDescription>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


export default function PortalDashboardPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<div className="20ui p-6 text-[var(--st-text-secondary)]">Loading...</div>}>
      <PortalDashboardPageContent params={params} />
    </React.Suspense>
  );
}
