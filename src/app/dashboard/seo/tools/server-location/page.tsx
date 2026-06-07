'use client';

import { useState } from 'react';
import { Globe, MapPin, Search } from 'lucide-react';

import {
  Button,
  Input,
  Field,
  Card,
  CardHeader,
  CardBody,
  Alert,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';

interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  org: string;
  isp: string;
}

interface ServerLocationData {
  host: string;
  ipv4: string[];
  geoInfo: GeoLocation[];
}

export default function ServerLocationPage() {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ServerLocationData | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const dns = await apiDnsLookup(host, 'A');
      if (dns.error) { setError(dns.error); return; }

      const ipv4 = dns.records?.A || [];
      const validIpv4 = Array.isArray(ipv4) ? ipv4.filter((ip): ip is string => typeof ip === 'string') : [];

      if (!validIpv4.length) { setError('No A record found'); return; }

      // Fetch geo info for up to 3 IPs
      const geoPromises = validIpv4.slice(0, 3).map(async (ip) => {
        try {
          const res = await fetch(`https://ipwhois.app/json/${ip}`);
          if (res.ok) {
            const geo = await res.json();
            if (geo.success) {
              return geo as GeoLocation;
            }
          }
          return null;
        } catch (err) {
          return null;
        }
      });

      const geoResults = (await Promise.all(geoPromises)).filter((g): g is GeoLocation => g !== null);

      setData({ host, ipv4: validIpv4, geoInfo: geoResults });
    } catch (err: any) {
      setError(err.message || 'An error occurred during lookup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Server Location Checker" description="Resolve server IPs and find their geographical location.">
      <div className="flex items-end gap-2">
        <Field label="Domain or hostname" className="flex-1">
          <Input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
            iconLeft={Globe}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" iconLeft={Search} onClick={run} loading={loading}>
          {loading ? 'Looking up' : 'Locate'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Lookup failed">
          {error}
        </Alert>
      )}

      {data && (
        <div className="space-y-4">
          <Card>
            <CardBody className="text-sm space-y-2">
              <div><span className="font-semibold">Host:</span> {data.host}</div>
              <div>
                <span className="font-semibold">IPv4 addresses:</span>
                <ul className="mt-1 font-mono text-xs">
                  {data.ipv4.map((ip: string) => (
                    <li
                      key={ip}
                      className="border-t border-[var(--st-border)] py-1 first:border-0"
                    >
                      {ip}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>

          {data.geoInfo.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.geoInfo.map((geo, idx) => (
                <Card key={`${geo.ip}-${idx}`} padding="none" className="overflow-hidden">
                  <CardHeader className="flex justify-between items-center font-mono text-sm font-semibold">
                    <span>{geo.ip}</span>
                    {geo.country ? <Badge tone="neutral">{geo.country}</Badge> : null}
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-[var(--st-text-secondary)]">Location:</div>
                      <div className="font-medium">{geo.city}{geo.city && geo.region ? ', ' : ''}{geo.region}</div>

                      <div className="text-[var(--st-text-secondary)]">Country:</div>
                      <div className="font-medium">{geo.country}</div>

                      <div className="text-[var(--st-text-secondary)]">Organization:</div>
                      <div className="font-medium truncate" title={geo.org || geo.isp}>{geo.org || geo.isp || 'N/A'}</div>

                      <div className="text-[var(--st-text-secondary)]">Coordinates:</div>
                      <div className="font-medium">{geo.latitude}, {geo.longitude}</div>
                    </div>
                  </CardBody>
                  {geo.latitude && geo.longitude && (
                    <div className="h-[250px] w-full border-t border-[var(--st-border)]">
                      <iframe
                        width="100%"
                        height="100%"
                        className="border-0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.longitude-0.05},${geo.latitude-0.05},${geo.longitude+0.05},${geo.latitude+0.05}&layer=mapnik&marker=${geo.latitude},${geo.longitude}`}
                        title={`Map of ${geo.city || geo.country}`}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {data.geoInfo.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No geolocation data"
              description="Geolocation data could not be retrieved for the IP addresses found."
            />
          )}
        </div>
      )}
    </ToolShell>
  );
}
