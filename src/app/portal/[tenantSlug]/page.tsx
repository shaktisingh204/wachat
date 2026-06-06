import React from "react";
/**
 * Portal dashboard — the post-sign-in landing surface for a customer /
 * vendor / employee end-user. Verifies the `portal_session` cookie, loads
 * the matching `crm_portal_users` row, and renders a minimal grid of
 * role-aware placeholder cards.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import { getPortalSession } from "@/lib/portal/auth";

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
    // Session was valid but row is gone / suspended — bounce to login
    redirect(
      `/portal/${encodeURIComponent(tenantSlug)}/login?error=no_account`,
    );
  }

  const theme = tenantInfo.config.theme || {};
  const bgColor = theme.backgroundColor || "#f9fafb";
  const primaryColor = theme.primaryColor || "#0f172a";
  const textColor = theme.textColor || "#64748b";
  const headerColor = theme.headerColor || primaryColor;

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
      style={{
        minHeight: "100vh",
        background: bgColor,
        padding: 32,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          maxWidth: 1080,
          margin: "0 auto 24px",
        }}
      >
        <div>
          {theme.logoUrl && (
            <img
              src={theme.logoUrl}
              alt={`${tenantInfo.name} Logo`}
              style={{ height: 40, marginBottom: 16, display: "block" }}
            />
          )}
          <p style={{ margin: 0, fontSize: 13, color: textColor }}>
            Welcome back
          </p>
          <h1
            style={{
              margin: "4px 0 0",
              fontSize: 24,
              fontWeight: 700,
              color: headerColor,
            }}
          >
            {portalUser.name || portalUser.email}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: textColor }}>
            Signed in as <strong>{roleLabel}</strong> at {tenantInfo.name}
          </p>
        </div>
        <form
          action={`/portal/${encodeURIComponent(tenantSlug)}/auth/sign-out`}
          method="post"
        >
          <button
            type="submit"
            style={{
              background: "transparent",
              border: `1px solid ${textColor}40`, // slight opacity
              color: textColor,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className="block bg-white rounded-[14px] p-5 border border-[#e2e8f0] text-inherit no-underline shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <h2
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: primaryColor,
              }}
            >
              {c.title}
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: textColor }}>
              {c.description}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}


export default function PortalDashboardPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PortalDashboardPageContent params={params} />
    </React.Suspense>
  );
}
