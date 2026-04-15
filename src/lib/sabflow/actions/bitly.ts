
'use server';

const BITLY_BASE = 'https://api-ssl.bitly.com/v4';

async function bitlyFetch(
    method: string,
    path: string,
    accessToken: string,
    body?: any
): Promise<any> {
    const res = await fetch(`${BITLY_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.description || `Bitly API error ${res.status}`);
    }
    return data;
}

export async function executeBitlyAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        switch (actionName) {
            case 'shortenUrl': {
                const longUrl = String(inputs.longUrl ?? '').trim();
                if (!longUrl) throw new Error('longUrl is required.');
                const body: any = { long_url: longUrl };
                if (inputs.domain) body.domain = String(inputs.domain).trim();
                const data = await bitlyFetch('POST', '/shorten', accessToken, body);
                logger.log(`[Bitly] shortenUrl`);
                return { output: { link: data.link, id: data.id } };
            }

            case 'expandUrl': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                const data = await bitlyFetch('POST', '/expand', accessToken, { bitlink_id: bitlinkId });
                logger.log(`[Bitly] expandUrl`);
                return { output: { longUrl: data.long_url, id: data.id } };
            }

            case 'getLinkClicks': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                const units = inputs.units || 30;
                const unit = inputs.unit || 'day';
                const rollup = inputs.rollup !== undefined ? inputs.rollup : true;
                const data = await bitlyFetch('GET', `/bitlinks/${encodeURIComponent(bitlinkId)}/clicks?units=${units}&unit=${unit}&rollup=${rollup}`, accessToken);
                logger.log(`[Bitly] getLinkClicks for ${bitlinkId}`);
                return { output: data };
            }

            case 'getLinkSummary': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                const units = inputs.units || 30;
                const unit = inputs.unit || 'day';
                const data = await bitlyFetch('GET', `/bitlinks/${encodeURIComponent(bitlinkId)}/clicks/summary?units=${units}&unit=${unit}`, accessToken);
                logger.log(`[Bitly] getLinkSummary for ${bitlinkId}`);
                return { output: data };
            }

            case 'getBitlink': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                const data = await bitlyFetch('GET', `/bitlinks/${encodeURIComponent(bitlinkId)}`, accessToken);
                logger.log(`[Bitly] getBitlink ${bitlinkId}`);
                return { output: data };
            }

            case 'updateBitlink': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                const updateBody: any = {};
                if (inputs.title) updateBody.title = String(inputs.title);
                if (inputs.longUrl) updateBody.long_url = String(inputs.longUrl);
                if (inputs.tags) updateBody.tags = inputs.tags;
                const data = await bitlyFetch('PATCH', `/bitlinks/${encodeURIComponent(bitlinkId)}`, accessToken, updateBody);
                logger.log(`[Bitly] updateBitlink ${bitlinkId}`);
                return { output: data };
            }

            case 'deleteBitlink': {
                const bitlinkId = String(inputs.bitlinkId ?? '').trim();
                if (!bitlinkId) throw new Error('bitlinkId is required.');
                await bitlyFetch('DELETE', `/bitlinks/${encodeURIComponent(bitlinkId)}`, accessToken);
                logger.log(`[Bitly] deleteBitlink ${bitlinkId}`);
                return { output: { deleted: true, bitlinkId } };
            }

            case 'listBitlinks': {
                const groupGuid = String(inputs.groupGuid ?? '').trim();
                if (!groupGuid) throw new Error('groupGuid is required.');
                const size = inputs.size || 50;
                const data = await bitlyFetch('GET', `/groups/${groupGuid}/bitlinks?size=${size}`, accessToken);
                logger.log(`[Bitly] listBitlinks for group ${groupGuid}`);
                return { output: data };
            }

            case 'createBsd': {
                const bsdBody = inputs.bsd || {};
                const data = await bitlyFetch('POST', '/bsds', accessToken, bsdBody);
                logger.log(`[Bitly] createBsd`);
                return { output: data };
            }

            case 'listGroups': {
                const data = await bitlyFetch('GET', '/groups', accessToken);
                logger.log(`[Bitly] listGroups`);
                return { output: data };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await bitlyFetch('GET', `/groups/${groupId}`, accessToken);
                logger.log(`[Bitly] getGroup ${groupId}`);
                return { output: data };
            }

            case 'getOrganization': {
                const orgId = String(inputs.orgId ?? '').trim();
                if (!orgId) throw new Error('orgId is required.');
                const data = await bitlyFetch('GET', `/organizations/${orgId}`, accessToken);
                logger.log(`[Bitly] getOrganization ${orgId}`);
                return { output: data };
            }

            default:
                throw new Error(`Bitly action "${actionName}" is not implemented.`);
        }
    } catch (err: any) {
        const message = err?.message || 'Unknown Bitly error';
        logger.log(`[Bitly] Error: ${message}`);
        return { error: message };
    }
}
