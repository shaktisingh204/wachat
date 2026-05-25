'use client';

import { Button, Input, Card, ZoruCardContent, cn, Progress, Badge } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiSsl } from '@/lib/seo-tools/api-client';

interface SslData {
  host: string;
  authorized: boolean;
  authorizationError?: string;
  protocol: string;
  cipher?: { name: string; standardName: string; version: string };
  subject: Record<string, string> | null;
  issuer: Record<string, string> | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  fingerprint: string | null;
  fingerprint256: string | null;
  serialNumber: string | null;
  error?: string;
}

const isWeakCipher = (cipherName?: string) => {
  if (!cipherName) return false;
  const upper = cipherName.toUpperCase();
  return upper.includes('RC4') || upper.includes('DES') || upper.includes('MD5') || upper.includes('NULL') || upper.includes('EXP');
};

const isWeakProtocol = (protocol?: string) => {
  if (!protocol) return false;
  return protocol === 'TLSv1' || protocol === 'TLSv1.1' || protocol === 'SSLv3' || protocol === 'SSLv2';
};

function getExplanation(err: string) {
  if (!err) return '';
  if (err === 'DEPTH_ZERO_SELF_SIGNED_CERT') return 'The certificate is self-signed and not trusted by default.';
  if (err === 'CERT_HAS_EXPIRED') return 'The certificate has expired and is no longer valid.';
  if (err === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 'The certificate chain is incomplete or the issuer is unknown.';
  if (err === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'The domain does not match the names on the certificate.';
  return `Error: ${err}`;
}

export default function SslCheckerPage() {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SslData | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await apiSsl(host);
      if (r.error) setError(r.error);
      else setData(r as SslData);
    } catch (e: any) {
      setError(e.message || 'Failed to check SSL');
    } finally { setLoading(false); }
  };

  const getTrustScore = (data: SslData) => {
    let score = 100;
    if (!data.authorized) score -= 50;
    if (isWeakProtocol(data.protocol)) score -= 30;
    if (isWeakCipher(data.cipher?.name)) score -= 20;
    if (data.daysRemaining !== null) {
      if (data.daysRemaining <= 0) score -= 50;
      else if (data.daysRemaining < 30) score -= 20;
    }
    return Math.max(0, score);
  };

  return (
    <ToolShell title="SSL Certificate Checker" description="Inspect the SSL certificate of any host.">
      <div className="flex gap-2">
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {data && (
        <Card><ZoruCardContent className="p-4 space-y-6 text-sm">
          {(() => {
            const score = getTrustScore(data);
            const daysRemaining = data.daysRemaining;
            const expiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining < 30;
            const expired = daysRemaining !== null && daysRemaining <= 0;
            
            return (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-base">Trust Meter</span>
                    <Badge variant={score >= 80 ? "success" : score >= 50 ? "warning" : "danger"}>
                      Score: {score}/100
                    </Badge>
                  </div>
                  <Progress 
                    value={score} 
                    indicatorClassName={score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <span className="font-semibold block mb-1">Host:</span>
                      {data.host}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Trusted:</span> 
                      {data.authorized ? (
                        <span className="text-green-600 font-medium">✅ Yes</span>
                      ) : (
                        <div className="text-red-500 flex flex-col items-start gap-1">
                          <span className="font-medium">⚠️ No</span>
                          {data.authorizationError && (
                            <span className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                              {getExplanation(data.authorizationError)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Protocol:</span>
                      {data.protocol ? (
                        <span className={cn(isWeakProtocol(data.protocol) && "text-red-600 font-medium")}>
                          {data.protocol} {isWeakProtocol(data.protocol) && <Badge variant="danger" className="ml-2">Weak</Badge>}
                        </span>
                      ) : '—'}
                    </div>

                    {data.cipher && (
                      <div>
                        <span className="font-semibold block mb-1">Cipher Suite:</span>
                        <div className={cn(isWeakCipher(data.cipher.name) && "text-red-600 font-medium")}>
                          {data.cipher.name} {isWeakCipher(data.cipher.name) && <Badge variant="danger" className="ml-2">Weak</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Version: {data.cipher.version}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="font-semibold block mb-1">Subject:</span> 
                      {data.subject?.CN || '—'}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Issuer:</span> 
                      {data.issuer?.CN || data.issuer?.O || '—'}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Valid from:</span> 
                      {data.validFrom || '—'}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Valid to:</span> 
                      {data.validTo || '—'}
                    </div>
                    
                    <div>
                      <span className="font-semibold block mb-1">Days remaining:</span> 
                      <div className="flex items-center gap-2">
                        {daysRemaining !== null ? (
                          <span className={cn(
                            "font-medium",
                            expiringSoon && "text-amber-600 font-bold",
                            expired && "text-red-600 font-bold",
                            !expiringSoon && !expired && "text-green-600"
                          )}>
                            {daysRemaining}
                          </span>
                        ) : '—'}
                        {expiringSoon && <Badge variant="warning">Expiring Soon</Badge>}
                        {expired && <Badge variant="danger">Expired</Badge>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="font-mono text-xs break-all bg-muted p-3 rounded-md mt-4 border">
                  <span className="font-semibold block mb-1 font-sans text-sm">SHA-256 Fingerprint:</span>
                  {data.fingerprint256 || '—'}
                </div>
              </>
            );
          })()}
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}
