import type { MetadataRoute } from 'next';
import { FEATURES } from '@/lib/features/catalog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sabnode.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,           lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/features`,   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE_URL}/products`,   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/pricing`,    lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/enterprise`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/customers`,  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/partners`,   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/resources`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${SITE_URL}/about-us`,   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contact`,    lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const featureRoutes: MetadataRoute.Sitemap = FEATURES.map(f => ({
    url: `${SITE_URL}/features/${f.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...featureRoutes];
}
