import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

import { ProvidersClient, ProviderRow, ProviderCatalogItem } from "./providers-client";

export const dynamic = "force-dynamic";

async function loadProviders(workspaceId: string): Promise<ProviderRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col.find({ workspaceId }).limit(50).toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    provider: d.provider,
    region: d.region,
    isDefault: !!d.isDefault,
    status: d.status ?? "active",
    lastError: d.lastError,
    // Provide defaults for mocked features
    sendVolume24h: Math.floor(Math.random() * 10000),
    lastSuccessfulSend: d.lastSuccessfulSend || "Just now",
    pricingTier: "Enterprise",
  }));
}

const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  { id: "twilio", name: "Twilio", available: true, region: "US/EU/APAC" },
  { id: "vonage", name: "Vonage (Nexmo)", available: false, region: "Global" },
  { id: "messagebird", name: "MessageBird / Bird", available: false, region: "Global" },
  { id: "plivo", name: "Plivo", available: false, region: "Global" },
  { id: "sinch", name: "Sinch", available: false, region: "Global" },
  { id: "infobip", name: "Infobip", available: false, region: "Global" },
  { id: "aws_sns", name: "AWS SNS", available: false, region: "Global" },
  { id: "telnyx", name: "Telnyx", available: false, region: "US/EU" },
  { id: "msg91", name: "MSG91", available: false, region: "IN" },
  { id: "gupshup", name: "Gupshup", available: false, region: "IN/APAC" },
];

export default async function SabsmsProvidersPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadProviders(workspaceId) : [];

  return <ProvidersClient initialRows={rows} catalog={PROVIDER_CATALOG} />;
}
