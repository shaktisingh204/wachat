'use client';

import { useMemo } from 'react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import type { WithId, ShortUrl } from '@/lib/definitions';

export function UrlShortenerGeoAnalytics({ urls }: { urls: WithId<ShortUrl>[] }) {
  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const url of urls) {
      if (url.analytics) {
        for (const entry of url.analytics) {
          if (entry.geo && entry.geo.country) {
            counts[entry.geo.country] = (counts[entry.geo.country] || 0) + 1;
          }
        }
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return sorted;
  }, [urls]);

  if (topCountries.length === 0) return null;

  return (
    <Card padding="none">
      <CardHeader>
        <CardTitle>Geographic analytics (top countries)</CardTitle>
      </CardHeader>
      <CardBody>
        <Table density="compact" hover>
          <THead>
            <Tr>
              <Th>Country</Th>
              <Th align="right">Clicks</Th>
            </Tr>
          </THead>
          <TBody>
            {topCountries.map(([country, count]) => (
              <Tr key={country}>
                <Td>{country}</Td>
                <Td align="right">
                  <Badge tone="accent">{count.toLocaleString()}</Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
