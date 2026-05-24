'use server';

const googleTrends = require('google-trends-api');

export async function getKeywordTrends(keyword: string) {
  try {
    const res = await googleTrends.interestOverTime({
      keyword: keyword,
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    });

    const parsedData = JSON.parse(res);
    
    // google-trends-api returns data in parsedData.default.timelineData
    if (parsedData?.default?.timelineData) {
      const data = parsedData.default.timelineData.map((item: any) => ({
        time: item.formattedTime,
        value: item.value[0] || 0,
        formattedAxisTime: item.formattedAxisTime
      }));

      return { success: true, data };
    } else {
      return { success: false, error: 'No data returned' };
    }
  } catch (error: any) {
    console.error('Google Trends API Error:', error);
    return { success: false, error: error.message || 'Failed to fetch trends data' };
  }
}
