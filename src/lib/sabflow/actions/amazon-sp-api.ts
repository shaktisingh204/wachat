'use server';

export async function executeAmazonSpApiAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = inputs.endpoint || 'https://sellingpartnerapi-na.amazon.com';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inputs.accessToken}`,
        'x-amz-access-token': inputs.accessToken,
    };
    if (inputs.marketplaceId) headers['x-amz-marketplace-id'] = inputs.marketplaceId;

    try {
        switch (actionName) {
            case 'getOrders': {
                const params = new URLSearchParams();
                if (inputs.marketplaceIds) params.set('MarketplaceIds', inputs.marketplaceIds);
                if (inputs.createdAfter) params.set('CreatedAfter', inputs.createdAfter);
                if (inputs.createdBefore) params.set('CreatedBefore', inputs.createdBefore);
                if (inputs.orderStatuses) params.set('OrderStatuses', inputs.orderStatuses);
                if (inputs.maxResults) params.set('MaxResultsPerPage', String(inputs.maxResults));
                if (inputs.nextToken) params.set('NextToken', inputs.nextToken);
                const res = await fetch(`${baseUrl}/orders/v0/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get orders' };
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/v0/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get order' };
                return { output: data };
            }
            case 'getOrderItems': {
                const params = new URLSearchParams();
                if (inputs.nextToken) params.set('NextToken', inputs.nextToken);
                const res = await fetch(`${baseUrl}/orders/v0/orders/${inputs.orderId}/orderItems?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get order items' };
                return { output: data };
            }
            case 'listCatalogItems': {
                const params = new URLSearchParams();
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                if (inputs.identifiers) params.set('identifiers', inputs.identifiers);
                if (inputs.identifiersType) params.set('identifiersType', inputs.identifiersType);
                if (inputs.includedData) params.set('includedData', inputs.includedData);
                if (inputs.keywords) params.set('keywords', inputs.keywords);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/catalog/2022-04-01/items?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list catalog items' };
                return { output: data };
            }
            case 'getCatalogItem': {
                const params = new URLSearchParams();
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                if (inputs.includedData) params.set('includedData', inputs.includedData);
                const res = await fetch(`${baseUrl}/catalog/2022-04-01/items/${inputs.asin}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get catalog item' };
                return { output: data };
            }
            case 'createReport': {
                const body: Record<string, any> = {
                    reportType: inputs.reportType,
                    marketplaceIds: inputs.marketplaceIds ? inputs.marketplaceIds.split(',') : [],
                };
                if (inputs.dataStartTime) body.dataStartTime = inputs.dataStartTime;
                if (inputs.dataEndTime) body.dataEndTime = inputs.dataEndTime;
                if (inputs.reportOptions) body.reportOptions = inputs.reportOptions;
                const res = await fetch(`${baseUrl}/reports/2021-06-30/reports`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create report' };
                return { output: data };
            }
            case 'getReport': {
                const res = await fetch(`${baseUrl}/reports/2021-06-30/reports/${inputs.reportId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get report' };
                return { output: data };
            }
            case 'getReportDocument': {
                const res = await fetch(`${baseUrl}/reports/2021-06-30/documents/${inputs.reportDocumentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get report document' };
                return { output: data };
            }
            case 'listReports': {
                const params = new URLSearchParams();
                if (inputs.reportTypes) params.set('reportTypes', inputs.reportTypes);
                if (inputs.processingStatuses) params.set('processingStatuses', inputs.processingStatuses);
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.createdSince) params.set('createdSince', inputs.createdSince);
                if (inputs.createdUntil) params.set('createdUntil', inputs.createdUntil);
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                const res = await fetch(`${baseUrl}/reports/2021-06-30/reports?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list reports' };
                return { output: data };
            }
            case 'createFeed': {
                const body: Record<string, any> = {
                    feedType: inputs.feedType,
                    marketplaceIds: inputs.marketplaceIds ? inputs.marketplaceIds.split(',') : [],
                    inputFeedDocumentId: inputs.inputFeedDocumentId,
                };
                if (inputs.feedOptions) body.feedOptions = inputs.feedOptions;
                const res = await fetch(`${baseUrl}/feeds/2021-06-30/feeds`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create feed' };
                return { output: data };
            }
            case 'getFeed': {
                const res = await fetch(`${baseUrl}/feeds/2021-06-30/feeds/${inputs.feedId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get feed' };
                return { output: data };
            }
            case 'getFeedDocument': {
                const res = await fetch(`${baseUrl}/feeds/2021-06-30/documents/${inputs.feedDocumentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get feed document' };
                return { output: data };
            }
            case 'listFeeds': {
                const params = new URLSearchParams();
                if (inputs.feedTypes) params.set('feedTypes', inputs.feedTypes);
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.processingStatuses) params.set('processingStatuses', inputs.processingStatuses);
                if (inputs.createdSince) params.set('createdSince', inputs.createdSince);
                if (inputs.createdUntil) params.set('createdUntil', inputs.createdUntil);
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                const res = await fetch(`${baseUrl}/feeds/2021-06-30/feeds?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list feeds' };
                return { output: data };
            }
            case 'getInventorySummaries': {
                const params = new URLSearchParams();
                params.set('details', inputs.details !== undefined ? String(inputs.details) : 'true');
                if (inputs.granularityType) params.set('granularityType', inputs.granularityType);
                if (inputs.granularityId) params.set('granularityId', inputs.granularityId);
                if (inputs.startDateTime) params.set('startDateTime', inputs.startDateTime);
                if (inputs.sellerSkus) params.set('sellerSkus', inputs.sellerSkus);
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                const res = await fetch(`${baseUrl}/fba/inventory/v1/summaries?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get inventory summaries' };
                return { output: data };
            }
            case 'getSmallAndLightEligibility': {
                const params = new URLSearchParams();
                if (inputs.marketplaceIds) params.set('marketplaceIds', inputs.marketplaceIds);
                const res = await fetch(`${baseUrl}/fba/smallAndLight/v1/enrollments/${inputs.sellerSKU}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get small and light eligibility' };
                return { output: data };
            }
            default:
                return { error: `Unknown Amazon SP-API action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Amazon SP-API action error: ${err.message}`);
        return { error: err.message || 'Amazon SP-API action failed' };
    }
}
