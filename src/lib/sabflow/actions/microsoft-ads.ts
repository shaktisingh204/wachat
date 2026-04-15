'use server';

const MS_ADS_BASE = 'https://api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13';

export async function executeMicrosoftAdsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken;
        const developerToken: string = inputs.developerToken;
        const accountId: string = inputs.accountId;
        const customerId: string = inputs.customerId;

        if (!accessToken) return { error: 'accessToken is required.' };
        if (!developerToken) return { error: 'developerToken is required.' };

        const buildHeaders = (): Record<string, string> => ({
            Authorization: `Bearer ${accessToken}`,
            DeveloperToken: developerToken,
            'Content-Type': 'application/json',
            ...(accountId ? { AccountId: accountId } : {}),
            ...(customerId ? { CustomerId: customerId } : {}),
        });

        const post = async (path: string, body: any) => {
            const res = await fetch(`${MS_ADS_BASE}/${path}`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { error: data?.Message || data?.TrackingId || 'Microsoft Ads request failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'getCampaigns': {
                return post('GetCampaignsByAccountId', {
                    AccountId: accountId,
                    CampaignType: inputs.campaignType || 'Search',
                });
            }

            case 'addCampaigns': {
                if (!inputs.campaigns) return { error: 'campaigns array is required.' };
                return post('AddCampaigns', {
                    AccountId: accountId,
                    Campaigns: inputs.campaigns,
                });
            }

            case 'updateCampaigns': {
                if (!inputs.campaigns) return { error: 'campaigns array is required.' };
                return post('UpdateCampaigns', {
                    AccountId: accountId,
                    Campaigns: inputs.campaigns,
                });
            }

            case 'deleteCampaigns': {
                if (!inputs.campaignIds) return { error: 'campaignIds array is required.' };
                return post('DeleteCampaigns', {
                    AccountId: accountId,
                    CampaignIds: inputs.campaignIds,
                });
            }

            case 'getAdGroups': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                return post('GetAdGroupsByCampaignId', {
                    CampaignId: inputs.campaignId,
                });
            }

            case 'addAdGroups': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                if (!inputs.adGroups) return { error: 'adGroups array is required.' };
                return post('AddAdGroups', {
                    CampaignId: inputs.campaignId,
                    AdGroups: inputs.adGroups,
                });
            }

            case 'updateAdGroups': {
                if (!inputs.campaignId) return { error: 'campaignId is required.' };
                if (!inputs.adGroups) return { error: 'adGroups array is required.' };
                return post('UpdateAdGroups', {
                    CampaignId: inputs.campaignId,
                    AdGroups: inputs.adGroups,
                });
            }

            case 'getAds': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                return post('GetAdsByAdGroupId', {
                    AdGroupId: inputs.adGroupId,
                    AdTypes: inputs.adTypes || ['ExpandedTextAd', 'ResponsiveSearchAd'],
                });
            }

            case 'addAds': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                if (!inputs.ads) return { error: 'ads array is required.' };
                return post('AddAds', {
                    AdGroupId: inputs.adGroupId,
                    Ads: inputs.ads,
                });
            }

            case 'updateAds': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                if (!inputs.ads) return { error: 'ads array is required.' };
                return post('UpdateAds', {
                    AdGroupId: inputs.adGroupId,
                    Ads: inputs.ads,
                });
            }

            case 'getKeywords': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                return post('GetKeywordsByAdGroupId', {
                    AdGroupId: inputs.adGroupId,
                });
            }

            case 'addKeywords': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                if (!inputs.keywords) return { error: 'keywords array is required.' };
                return post('AddKeywords', {
                    AdGroupId: inputs.adGroupId,
                    Keywords: inputs.keywords,
                });
            }

            case 'updateKeywords': {
                if (!inputs.adGroupId) return { error: 'adGroupId is required.' };
                if (!inputs.keywords) return { error: 'keywords array is required.' };
                return post('UpdateKeywords', {
                    AdGroupId: inputs.adGroupId,
                    Keywords: inputs.keywords,
                });
            }

            case 'getCampaignPerformance': {
                if (!inputs.startDate) return { error: 'startDate is required (YYYY-MM-DD).' };
                if (!inputs.endDate) return { error: 'endDate is required (YYYY-MM-DD).' };
                const reportBase = 'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13';
                const [sY, sM, sD] = inputs.startDate.split('-');
                const [eY, eM, eD] = inputs.endDate.split('-');
                const body = {
                    ReportRequest: {
                        '__type': 'CampaignPerformanceReportRequest',
                        Format: 'Csv',
                        ReportName: 'CampaignPerformance',
                        ReturnOnlyCompleteData: false,
                        Aggregation: inputs.aggregation || 'Daily',
                        Columns: inputs.columns || ['TimePeriod', 'CampaignId', 'CampaignName', 'Impressions', 'Clicks', 'Spend'],
                        Scope: { AccountIds: [accountId] },
                        Time: {
                            CustomDateRangeStart: { Day: parseInt(sD), Month: parseInt(sM), Year: parseInt(sY) },
                            CustomDateRangeEnd: { Day: parseInt(eD), Month: parseInt(eM), Year: parseInt(eY) },
                        },
                    },
                };
                const res = await fetch(`${reportBase}/SubmitGenerateReport`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Message || 'Failed to submit campaign performance report.' };
                return { output: data };
            }

            case 'getKeywordPerformance': {
                if (!inputs.startDate) return { error: 'startDate is required (YYYY-MM-DD).' };
                if (!inputs.endDate) return { error: 'endDate is required (YYYY-MM-DD).' };
                const reportBase = 'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13';
                const [sY, sM, sD] = inputs.startDate.split('-');
                const [eY, eM, eD] = inputs.endDate.split('-');
                const body = {
                    ReportRequest: {
                        '__type': 'KeywordPerformanceReportRequest',
                        Format: 'Csv',
                        ReportName: 'KeywordPerformance',
                        ReturnOnlyCompleteData: false,
                        Aggregation: inputs.aggregation || 'Daily',
                        Columns: inputs.columns || ['TimePeriod', 'KeywordId', 'Keyword', 'Impressions', 'Clicks', 'Spend', 'AverageCpc'],
                        Scope: { AccountIds: [accountId] },
                        Time: {
                            CustomDateRangeStart: { Day: parseInt(sD), Month: parseInt(sM), Year: parseInt(sY) },
                            CustomDateRangeEnd: { Day: parseInt(eD), Month: parseInt(eM), Year: parseInt(eY) },
                        },
                    },
                };
                const res = await fetch(`${reportBase}/SubmitGenerateReport`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Message || 'Failed to submit keyword performance report.' };
                return { output: data };
            }

            default:
                return { error: `Unknown actionName: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unexpected error in microsoft-ads.' };
    }
}
