/**
 * SabFlow — Custom domain router
 *
 * Internal landing route for inbound requests that arrive with a Host header
 * matching a user-registered custom domain.  The proxy rewrites such
 * requests to `/_domain/{host}` (and preserves the original path); this
 * component looks the host up in `sabflow_custom_domains`, verifies its
 * status, and renders the matching flow.
 *
 * If the domain is unknown, unverified, or the flow is unpublished, a 404
 * is returned.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDomainByName } from '@/lib/sabflow/domains/db';
import { getSabFlowById, getSabFlowsByUserId } from '@/lib/sabflow/db';
import { ChatWindow } from '@/components/sabflow/chat/ChatWindow';
import '@/components/sabflow/sabflow.css';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = {
  params: Promise<{ host: string; path?: string[] }>;
};

// Edge cache the domain resolution to avoid DB trips on every request
const getCachedDomain = unstable_cache(
  async (decodedHost: string) => {
    return await getDomainByName(decodedHost);
  },
  ['custom-domain-resolution'],
  { revalidate: 60 } // Cache for 60 seconds
);

async function resolveFlowIdForHost(host: string, pathSegments: string[] = []): Promise<string | null> {
  let decodedHost = '';
  try {
    decodedHost = decodeURIComponent(host);
  } catch (e) {
    return null;
  }

  const domain = await getCachedDomain(decodedHost);
  if (!domain || domain.status !== 'verified') return null;

  const currentPath = '/' + pathSegments.join('/');

  // Multi-flow routing: Check if the current path matches any pathMappings
  if (domain.pathMappings && domain.pathMappings.length > 0) {
    // Sort mappings by length descending so more specific paths match first
    const sortedMappings = [...domain.pathMappings].sort((a, b) => b.path.length - a.path.length);
    for (const mapping of sortedMappings) {
      if (currentPath.startsWith(mapping.path)) {
        return mapping.flowId;
      }
    }
  }

  if (domain.flowId) return domain.flowId;

  // Workspace-scoped: default to the most recently updated PUBLISHED flow
  // owned by the workspace.
  const flows = await getSabFlowsByUserId(domain.workspaceId);
  const published = flows.find((f) => f.status === 'PUBLISHED');
  return published?._id ? String(published._id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, path = [] } = await params;
  const flowId = await resolveFlowIdForHost(host, path);
  if (!flowId) return { title: 'Not found' };

  const flow = await getSabFlowById(flowId);
  if (!flow) return { title: 'Not found' };

  return {
    title: flow.name,
    description: `Chat with the ${flow.name} automated assistant.`,
  };
}

export default async function CustomDomainPage({ params }: Props) {
  const { host, path = [] } = await params;
  const flowId = await resolveFlowIdForHost(host, path);
  if (!flowId) notFound();

  const flow = await getSabFlowById(flowId);
  if (!flow || flow.status !== 'PUBLISHED') notFound();

  // Serialise — MongoDB ObjectId is not plain JSON, convert to string.
  const serialised = JSON.parse(JSON.stringify(flow)) as typeof flow & {
    _id: string;
  };

  return <ChatWindow flow={serialised} />;
}
