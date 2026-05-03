/**
 * Topical authority mapping. Given a seed topic, produce a hub-and-spoke
 * structure that can be used to build internal-linking architecture.
 */
import type { TopicalCluster } from './types';
import { expandKeyword } from './keyword-research';

export type MapTopicalClustersOptions = {
  /** Number of spoke topics to return (after seed). */
  spokeCount?: number;
};

export async function mapTopicalClusters(
  seed: string,
  opts: MapTopicalClustersOptions = {},
): Promise<TopicalCluster> {
  const spokeCount = opts.spokeCount ?? 8;
  const variants = await expandKeyword(seed, { limit: spokeCount * 3 });
  const sorted = [...variants]
    .filter((v) => v.term !== seed.toLowerCase())
    .sort((a, b) => b.volume - a.volume);

  const spokes = dedupe(sorted.map((v) => v.term)).slice(0, spokeCount);
  return { hub: seed, spokes };
}

/**
 * Build a multi-level cluster: each spoke gets its own sub-cluster.
 * Useful for programmatic SEO and silo-style content planning.
 */
export async function mapDeepClusters(
  seed: string,
  spokeCount = 5,
  subSpokeCount = 4,
): Promise<{ hub: string; clusters: TopicalCluster[] }> {
  const top = await mapTopicalClusters(seed, { spokeCount });
  const clusters: TopicalCluster[] = [];
  for (const spoke of top.spokes) {
    const sub = await mapTopicalClusters(spoke, { spokeCount: subSpokeCount });
    clusters.push(sub);
  }
  return { hub: seed, clusters };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
