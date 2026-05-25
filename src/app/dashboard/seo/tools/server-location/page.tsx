'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

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
      <div className="flex gap-2">
        <Input 
          value={host} 
          onChange={(e) => setHost(e.target.value)} 
          placeholder="example.com" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Locate'}</Button>
      </div>
      
      {error && (
        <Card className="border-red-500">
          <ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent>
        </Card>
      )}
      
      {data && (
        <div className="space-y-4">
          <Card>
            <ZoruCardContent className="p-4 text-sm space-y-2">
              <div><span className="font-semibold">Host:</span> {data.host}</div>
              <div>
                <span className="font-semibold">IPv4 addresses:</span>
                <ul className="mt-1 font-mono text-xs">
                  {data.ipv4.map((ip: string) => (
                    <li key={ip} className="border-t py-1 first:border-0">{ip}</li>
                  ))}
                </ul>
              </div>
            </ZoruCardContent>
          </Card>
          
          {data.geoInfo.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.geoInfo.map((geo, idx) => (
                <Card key={`${geo.ip}-${idx}`} className="overflow-hidden">
                  <div className="bg-muted p-3 border-b font-mono text-sm font-semibold flex justify-between items-center">
                    <span>{geo.ip}</span>
                    <span className="text-xs text-muted-foreground">{geo.country}</span>
                  </div>
                  <ZoruCardContent className="p-0">
                    <div className="p-4 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-muted-foreground">Location:</div>
                        <div className="font-medium">{geo.city}{geo.city && geo.region ? ', ' : ''}{geo.region}</div>
                        
                        <div className="text-muted-foreground">Country:</div>
                        <div className="font-medium">{geo.country}</div>
                        
                        <div className="text-muted-foreground">Organization:</div>
                        <div className="font-medium truncate" title={geo.org || geo.isp}>{geo.org || geo.isp || 'N/A'}</div>
                        
                        <div className="text-muted-foreground">Coordinates:</div>
                        <div className="font-medium">{geo.latitude}, {geo.longitude}</div>
                      </div>
                    </div>
                    {geo.latitude && geo.longitude && (
                      <div className="h-[250px] w-full border-t">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0 }} 
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.longitude-0.05},${geo.latitude-0.05},${geo.longitude+0.05},${geo.latitude+0.05}&layer=mapnik&marker=${geo.latitude},${geo.longitude}`}
                          title={`Map of ${geo.city || geo.country}`}
                        />
                      </div>
                    )}
                  </ZoruCardContent>
                </Card>
              ))}
            </div>
          )}
          
          {data.geoInfo.length === 0 && (
            <Card>
              <ZoruCardContent className="p-4 text-sm text-muted-foreground">
                Geolocation data could not be retrieved for the IP addresses found.
              </ZoruCardContent>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}
