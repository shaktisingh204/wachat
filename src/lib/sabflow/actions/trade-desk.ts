'use server';

const TTD_BASE = 'https://api.thetradedesk.com/v3';

export async function executeTradeDeskAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.token) return { error: 'token is required.' };

        const buildHeaders = (): Record<string, string> => ({
            'TT-USER-TOKEN': inputs.token,
            'Content-Type': 'application/json',
        });

        const apiGet = async (path: string, query: Record<string, string> = {}) => {
            const qs = new URLSearchParams(query).toString();
            const url = qs ? `${TTD_BASE}/${path}?${qs}` : `${TTD_BASE}/${path}`;
            const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
            const data = await res.json();
            if (!res.ok) return { error: data?.Message || data?.message || 'TradeDesk GET failed.' };
            return { output: data };
        };

        const apiPost = async (path: string, body: any) => {
            const res = await fetch(`${TTD_BASE}/${path}`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.Message || data?.message || 'TradeDesk POST failed.' };
            return { output: data };
        };

        const apiPut = async (path: string, body: any) => {
            const res = await fetch(`${TTD_BASE}/${path}`, {
                method: 'PUT',
                headers: buildHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.Message || data?.message || 'TradeDesk PUT failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'listAdvertisers': {
                const body: any = {
                    PageStartIndex: inputs.pageStartIndex || 0,
                    PageSize: inputs.pageSize || 25,
                };
                if (inputs.partnerId) body.PartnerId = inputs.partnerId;
                return apiPost('advertiser/query/partner', body);
            }

            case 'getAdvertiser': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                return apiGet(`advertiser/${inputs.advertiserId}`);
            }

            case 'createAdvertiser': {
                if (!inputs.partnerId) return { error: 'partnerId is required.' };
                if (!inputs.advertiserName) return { error: 'advertiserName is required.' };
                const body: any = {
                    PartnerId: inputs.partnerId,
                    AdvertiserName: inputs.advertiserName,
                    Description: inputs.description || '',
                    AttributionClickLookbackWindowInSeconds: inputs.clickLookback || 2592000,
                    AttributionImpressionLookbackWindowInSeconds: inputs.impressionLookback || 1296000,
                    ClickDedupWindowInSeconds: inputs.clickDedup || 2592000,
                };
                if (inputs.domain) body.Domain = inputs.domain;
                return apiPost('advertiser', body);
            }

            case 'listCampaigns': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    PageStartIndex: inputs.pageStartIndex || 0,
                    PageSize: inputs.pageSize || 25,
                };
                return apiPost('campaign/query/advertiser', body);
            }

            case 'getCampaign': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return apiGet(`campaign/${inputs.campaignId}`);
            }

            case 'createCampaign': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.campaignName) return { error: 'campaignName is required.' };
                if (!inputs.budget) return { error: 'budget is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    CampaignName: inputs.campaignName,
                    Budget: {
                        Amount: inputs.budget,
                        CurrencyCode: inputs.currencyCode || 'USD',
                    },
                    StartDate: inputs.startDate,
                    EndDate: inputs.endDate,
                    Availability: inputs.availability || 'Available',
                };
                if (inputs.campaignConversionReportingColumns) body.CampaignConversionReportingColumns = inputs.campaignConversionReportingColumns;
                return apiPost('campaign', body);
            }

            case 'listAdGroups': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                const body: any = {
                    CampaignId: inputs.campaignId,
                    PageStartIndex: inputs.pageStartIndex || 0,
                    PageSize: inputs.pageSize || 25,
                };
                return apiPost('adgroup/query/campaign', body);
            }

            case 'getAdGroup': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                return apiGet(`adgroup/${inputs.adGroupId}`);
            }

            case 'createAdGroup': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                if (!inputs.adGroupName) return { error: 'adGroupName is required.' };
                const body: any = {
                    CampaignId: inputs.campaignId,
                    AdGroupName: inputs.adGroupName,
                    IndustryCategoryId: inputs.industryCategoryId || 1,
                    RTBAttributes: {
                        BudgetSettings: {
                            Budget: inputs.budget ? { Amount: inputs.budget, CurrencyCode: inputs.currencyCode || 'USD' } : undefined,
                        },
                        BaseBidCPM: inputs.baseBidCpm
                            ? { Amount: inputs.baseBidCpm, CurrencyCode: inputs.currencyCode || 'USD' }
                            : undefined,
                        MaxBidCPM: inputs.maxBidCpm
                            ? { Amount: inputs.maxBidCpm, CurrencyCode: inputs.currencyCode || 'USD' }
                            : undefined,
                    },
                    Availability: inputs.availability || 'Available',
                };
                return apiPost('adgroup', body);
            }

            case 'listAds': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    PageStartIndex: inputs.pageStartIndex || 0,
                    PageSize: inputs.pageSize || 25,
                };
                return apiPost('creative/query/advertiser', body);
            }

            case 'getAd': {
                if (!inputs.creativeId) return { error: 'creativeId is required.' };
                return apiGet(`creative/${inputs.creativeId}`);
            }

            case 'createAd': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.creativeName) return { error: 'creativeName is required.' };
                if (!inputs.width) return { error: 'width is required.' };
                if (!inputs.height) return { error: 'height is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    CreativeName: inputs.creativeName,
                    Width: inputs.width,
                    Height: inputs.height,
                    ClickThroughUrl: inputs.clickThroughUrl || '',
                    CreativeType: inputs.creativeType || 'Banner',
                    Availability: inputs.availability || 'Available',
                };
                if (inputs.imageUrl) body.ImageUrl = inputs.imageUrl;
                return apiPost('creative', body);
            }

            case 'getPerformanceReport': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.reportStartDateInclusive) return { error: 'reportStartDateInclusive is required.' };
                if (!inputs.reportEndDateExclusive) return { error: 'reportEndDateExclusive is required.' };
                const body: any = {
                    ReportScheduleName: inputs.reportName || 'Performance Report',
                    ReportStartDateInclusive: inputs.reportStartDateInclusive,
                    ReportEndDateExclusive: inputs.reportEndDateExclusive,
                    TimezoneCode: inputs.timezoneCode || 'UTC',
                    AdvertiserFilters: [{ AdvertiserId: inputs.advertiserId }],
                    Dimensions: inputs.dimensions || ['Advertiser', 'Campaign'],
                    Metrics: inputs.metrics || ['AdvertiserCost', 'Impressions', 'Clicks'],
                    TimeGrouping: inputs.timeGrouping || 'ByDay',
                    ReportFileFormat: inputs.format || 'CSV',
                };
                return apiPost('myreports/reportexecution', body);
            }

            case 'listAudiences': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    PageStartIndex: inputs.pageStartIndex || 0,
                    PageSize: inputs.pageSize || 25,
                };
                return apiPost('firstpartydata/query/advertiser', body);
            }

            case 'createAudience': {
                if (!inputs.advertiserId) return { error: 'advertiserId is required.' };
                if (!inputs.segmentName) return { error: 'segmentName is required.' };
                const body: any = {
                    AdvertiserId: inputs.advertiserId,
                    SegmentName: inputs.segmentName,
                    Description: inputs.description || '',
                    TTLInMinutes: inputs.ttlInMinutes || 43200,
                    MembershipExpiration: inputs.membershipExpiration || 30,
                };
                return apiPost('firstpartydata', body);
            }

            default:
                return { error: `Unknown actionName: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unexpected error in trade-desk.' };
    }
}
