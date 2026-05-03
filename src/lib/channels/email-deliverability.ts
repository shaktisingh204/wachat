/**
 * SPF / DKIM / DMARC report parser.
 *
 * Email providers (Google, Microsoft, Yahoo, …) deliver aggregate DMARC
 * reports as RUA XML and forensic reports as RUF. This module parses the
 * RUA dialect (RFC 7489 §A.1) into a typed shape SabNode dashboards can
 * surface to tenants.
 *
 * Implementation note: we hand-roll a tiny XML reader rather than pulling
 * a heavy dep. The parser is intentionally lenient and never throws on
 * malformed input — it returns whatever it could extract along with an
 * `errors` array.
 */

export type AuthResult = 'pass' | 'fail' | 'neutral' | 'softfail' | 'none' | 'temperror' | 'permerror';

export interface DmarcRecord {
    sourceIp: string;
    count: number;
    disposition: 'none' | 'quarantine' | 'reject';
    dkim: AuthResult;
    spf: AuthResult;
    headerFrom?: string;
    envelopeFrom?: string;
    /** Per-mechanism auth detail. */
    authDetails: {
        dkimDomain?: string;
        dkimSelector?: string;
        spfDomain?: string;
        spfScope?: 'mfrom' | 'helo';
    };
}

export interface DmarcReport {
    reportId?: string;
    org?: string;
    email?: string;
    domain?: string;
    dateRange?: { begin: number; end: number };
    policy?: { p?: string; sp?: string; pct?: number; adkim?: 's' | 'r'; aspf?: 's' | 'r' };
    records: DmarcRecord[];
    errors: string[];
}

/**
 * Parse a DMARC aggregate (RUA) XML string. Lenient — never throws.
 */
export function parseDmarcReport(xml: string): DmarcReport {
    const errors: string[] = [];
    const out: DmarcReport = { records: [], errors };

    if (!xml || typeof xml !== 'string') {
        errors.push('empty input');
        return out;
    }

    const meta = pickFirst(xml, 'report_metadata');
    if (meta) {
        out.org = textOf(meta, 'org_name');
        out.email = textOf(meta, 'email');
        out.reportId = textOf(meta, 'report_id');
        const dr = pickFirst(meta, 'date_range');
        if (dr) {
            out.dateRange = {
                begin: Number(textOf(dr, 'begin')) || 0,
                end: Number(textOf(dr, 'end')) || 0,
            };
        }
    }

    const policy = pickFirst(xml, 'policy_published');
    if (policy) {
        out.domain = textOf(policy, 'domain');
        out.policy = {
            p: textOf(policy, 'p') || undefined,
            sp: textOf(policy, 'sp') || undefined,
            pct: textOf(policy, 'pct') ? Number(textOf(policy, 'pct')) : undefined,
            adkim: (textOf(policy, 'adkim') as 's' | 'r' | undefined) || undefined,
            aspf: (textOf(policy, 'aspf') as 's' | 'r' | undefined) || undefined,
        };
    }

    for (const recXml of pickAll(xml, 'record')) {
        const row = pickFirst(recXml, 'row');
        const idents = pickFirst(recXml, 'identifiers');
        const authResults = pickFirst(recXml, 'auth_results');
        if (!row) continue;

        const policyEval = pickFirst(row, 'policy_evaluated');

        const dkimBlock = authResults ? pickFirst(authResults, 'dkim') : undefined;
        const spfBlock = authResults ? pickFirst(authResults, 'spf') : undefined;

        const rec: DmarcRecord = {
            sourceIp: textOf(row, 'source_ip'),
            count: Number(textOf(row, 'count')) || 0,
            disposition:
                (textOf(policyEval ?? '', 'disposition') as DmarcRecord['disposition']) || 'none',
            dkim: (textOf(policyEval ?? '', 'dkim') as AuthResult) || 'none',
            spf: (textOf(policyEval ?? '', 'spf') as AuthResult) || 'none',
            headerFrom: idents ? textOf(idents, 'header_from') : undefined,
            envelopeFrom: idents ? textOf(idents, 'envelope_from') : undefined,
            authDetails: {
                dkimDomain: dkimBlock ? textOf(dkimBlock, 'domain') : undefined,
                dkimSelector: dkimBlock ? textOf(dkimBlock, 'selector') : undefined,
                spfDomain: spfBlock ? textOf(spfBlock, 'domain') : undefined,
                spfScope: spfBlock
                    ? ((textOf(spfBlock, 'scope') as 'mfrom' | 'helo' | undefined) || undefined)
                    : undefined,
            },
        };
        out.records.push(rec);
    }

    return out;
}

/**
 * Roll up a parsed report into pass/fail counts useful for dashboards.
 */
export function summariseDmarc(report: DmarcReport): {
    total: number;
    pass: number;
    fail: number;
    quarantined: number;
    rejected: number;
    spfPassRate: number;
    dkimPassRate: number;
} {
    const total = report.records.reduce((s, r) => s + r.count, 0);
    let pass = 0, fail = 0, quarantined = 0, rejected = 0, spfPass = 0, dkimPass = 0;
    for (const r of report.records) {
        const dmarcPass = r.dkim === 'pass' || r.spf === 'pass';
        if (dmarcPass) pass += r.count;
        else fail += r.count;
        if (r.disposition === 'quarantine') quarantined += r.count;
        if (r.disposition === 'reject') rejected += r.count;
        if (r.spf === 'pass') spfPass += r.count;
        if (r.dkim === 'pass') dkimPass += r.count;
    }
    return {
        total,
        pass,
        fail,
        quarantined,
        rejected,
        spfPassRate: total ? spfPass / total : 0,
        dkimPassRate: total ? dkimPass / total : 0,
    };
}

/* ── tiny XML helpers ─────────────────────────────────────────── */

function pickFirst(xml: string, tag: string): string | undefined {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
    return m?.[1];
}

function pickAll(xml: string, tag: string): string[] {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) out.push(m[1]);
    return out;
}

function textOf(xml: string, tag: string): string {
    const inner = pickFirst(xml, tag);
    if (!inner) return '';
    return inner.replace(/<[^>]+>/g, '').trim();
}
