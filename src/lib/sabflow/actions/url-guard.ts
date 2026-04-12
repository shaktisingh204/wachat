'use server';

/**
 * Validates a user-provided URL before server-side fetching to mitigate SSRF.
 * Rules:
 *  - Scheme must be http or https
 *  - Host must not resolve to a private/loopback/link-local IP literal
 *  - Host must not be a metadata endpoint (169.254.169.254, metadata.google.internal)
 *
 * This is a lightweight string-level check — production deployments should
 * pair this with a network-level egress allowlist.
 */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('URL is required.');
    }

    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        throw new Error(`Invalid URL: "${raw}"`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`URL scheme "${url.protocol}" is not allowed. Use http or https.`);
    }

    const host = url.hostname.toLowerCase();

    // Reject empty hostnames
    if (!host) {
        throw new Error('URL host is missing.');
    }

    // Block well-known metadata endpoints
    const metadataHosts = new Set([
        '169.254.169.254',
        'metadata.google.internal',
        'metadata.goog',
        'instance-data',
    ]);
    if (metadataHosts.has(host)) {
        throw new Error(`Requests to metadata service "${host}" are not allowed.`);
    }

    // Block common local aliases
    const localHosts = new Set(['localhost', 'ip6-localhost', 'ip6-loopback', '0.0.0.0']);
    if (localHosts.has(host)) {
        throw new Error(`Requests to local host "${host}" are not allowed.`);
    }

    // Check IPv4 literals for private ranges
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        const parts = host.split('.').map(Number);
        if (parts.some(p => p < 0 || p > 255)) {
            throw new Error(`Invalid IPv4 literal: ${host}`);
        }
        const [a, b] = parts;
        const isPrivate =
            a === 10 ||                              // 10.0.0.0/8
            (a === 172 && b >= 16 && b <= 31) ||     // 172.16.0.0/12
            (a === 192 && b === 168) ||              // 192.168.0.0/16
            a === 127 ||                             // 127.0.0.0/8 loopback
            (a === 169 && b === 254) ||              // 169.254.0.0/16 link-local
            a === 0 ||                               // 0.0.0.0/8
            a >= 224;                                // multicast & reserved
        if (isPrivate) {
            throw new Error(`Requests to private IP "${host}" are not allowed.`);
        }
    }

    // Check IPv6 loopback / link-local / unique-local literals
    // Bracketed form: [::1], [fe80::...], [fc00::...]
    if (host.startsWith('[') && host.endsWith(']')) {
        const ipv6 = host.slice(1, -1);
        if (ipv6 === '::1' || ipv6.startsWith('fe80') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
            throw new Error(`Requests to private IPv6 "${ipv6}" are not allowed.`);
        }
    }
    // Unbracketed IPv6 (rare, but handle)
    if (host.includes(':')) {
        if (host === '::1' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) {
            throw new Error(`Requests to private IPv6 "${host}" are not allowed.`);
        }
    }

    return url;
}
