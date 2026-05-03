/**
 * Data center regions and their data residency constraints.
 *
 * Used by the multi-tenant orchestrator to pin a tenant's storage and
 * processing to a specific region (`tenant.regionPreference`) while still
 * allowing the global control plane to render dashboards across regions.
 *
 * `dataResidency.strict` is the gate enforced by the compliance middleware —
 * when true, no async job may write a row to a region whose
 * `cloudRegion` is not listed in `allowedJurisdictions`.
 */

import type { RegionConfig, RegionKey } from './types';

const REGIONS: Record<RegionKey, RegionConfig> = {
    'us-east': {
        key: 'us-east',
        label: 'US East (N. Virginia)',
        countries: ['US', 'CA', 'MX'],
        cloudRegion: 'us-east-1',
        timezone: 'America/New_York',
        dataResidency: {
            strict: false,
            allowedJurisdictions: ['US', 'CA'],
            compliance: ['SOC2', 'HIPAA', 'CCPA', 'PCI-DSS'],
        },
        latencyTargetMs: 80,
    },
    'us-west': {
        key: 'us-west',
        label: 'US West (Oregon)',
        countries: ['US', 'CA', 'MX'],
        cloudRegion: 'us-west-2',
        timezone: 'America/Los_Angeles',
        dataResidency: {
            strict: false,
            allowedJurisdictions: ['US', 'CA'],
            compliance: ['SOC2', 'HIPAA', 'CCPA', 'PCI-DSS'],
        },
        latencyTargetMs: 80,
    },
    'eu-west': {
        key: 'eu-west',
        label: 'EU West (Ireland)',
        countries: ['IE', 'GB', 'PT', 'ES', 'FR', 'NL', 'BE'],
        cloudRegion: 'eu-west-1',
        timezone: 'Europe/Dublin',
        dataResidency: {
            strict: true,
            allowedJurisdictions: ['EU', 'EEA', 'GB'],
            compliance: ['GDPR', 'SOC2', 'ISO-27001', 'PCI-DSS'],
        },
        latencyTargetMs: 90,
    },
    'eu-central': {
        key: 'eu-central',
        label: 'EU Central (Frankfurt)',
        countries: ['DE', 'AT', 'CH', 'PL', 'CZ', 'IT'],
        cloudRegion: 'eu-central-1',
        timezone: 'Europe/Berlin',
        dataResidency: {
            strict: true,
            allowedJurisdictions: ['EU', 'EEA'],
            compliance: ['GDPR', 'SOC2', 'ISO-27001', 'C5', 'BDSG'],
        },
        latencyTargetMs: 90,
    },
    'in-mumbai': {
        key: 'in-mumbai',
        label: 'India (Mumbai)',
        countries: ['IN'],
        cloudRegion: 'ap-south-1',
        timezone: 'Asia/Kolkata',
        dataResidency: {
            // RBI / DPDP guidance — payments data must remain in India.
            strict: true,
            allowedJurisdictions: ['IN'],
            compliance: ['DPDP', 'RBI', 'ISO-27001', 'SOC2'],
        },
        latencyTargetMs: 110,
    },
    'ap-singapore': {
        key: 'ap-singapore',
        label: 'Asia Pacific (Singapore)',
        countries: ['SG', 'MY', 'ID', 'PH', 'VN', 'TH', 'HK'],
        cloudRegion: 'ap-southeast-1',
        timezone: 'Asia/Singapore',
        dataResidency: {
            strict: false,
            allowedJurisdictions: ['SG', 'MY', 'AU', 'JP'],
            compliance: ['PDPA', 'ISO-27001', 'SOC2'],
        },
        latencyTargetMs: 120,
    },
    'ap-sydney': {
        key: 'ap-sydney',
        label: 'Asia Pacific (Sydney)',
        countries: ['AU', 'NZ'],
        cloudRegion: 'ap-southeast-2',
        timezone: 'Australia/Sydney',
        dataResidency: {
            strict: true,
            allowedJurisdictions: ['AU', 'NZ'],
            compliance: ['IRAP', 'Privacy Act', 'ISO-27001', 'SOC2'],
        },
        latencyTargetMs: 110,
    },
    'sa-brazil': {
        key: 'sa-brazil',
        label: 'South America (São Paulo)',
        countries: ['BR', 'AR', 'CL', 'UY', 'PE', 'CO'],
        cloudRegion: 'sa-east-1',
        timezone: 'America/Sao_Paulo',
        dataResidency: {
            strict: true,
            allowedJurisdictions: ['BR'],
            compliance: ['LGPD', 'ISO-27001', 'SOC2'],
        },
        latencyTargetMs: 130,
    },
};

export function listRegions(): RegionConfig[] {
    return Object.values(REGIONS);
}

export function getRegion(key: RegionKey | string): RegionConfig | undefined {
    return REGIONS[key as RegionKey];
}

export function getRegionOrThrow(key: RegionKey | string): RegionConfig {
    const r = getRegion(key);
    if (!r) throw new Error(`Unknown region: ${key}`);
    return r;
}

/** Resolve the best region for an ISO country code. Falls back to `us-east`. */
export function regionForCountry(countryCode: string): RegionConfig {
    const cc = countryCode.toUpperCase();
    for (const r of Object.values(REGIONS)) {
        if (r.countries.includes(cc)) return r;
    }
    return REGIONS['us-east'];
}

/**
 * Returns true when data originating in `originCountry` may legally be stored
 * in `region`. Used as a final gate before persisting tenant rows.
 */
export function canStoreIn(originCountry: string, region: RegionKey): boolean {
    const r = REGIONS[region];
    if (!r) return false;
    if (!r.dataResidency.strict) return true;
    const cc = originCountry.toUpperCase();
    if (r.dataResidency.allowedJurisdictions.includes(cc)) return true;
    if (cc === 'EU' && r.dataResidency.allowedJurisdictions.includes('EU')) return true;
    return false;
}

export const REGION_KEYS: readonly RegionKey[] = Object.keys(REGIONS) as RegionKey[];
