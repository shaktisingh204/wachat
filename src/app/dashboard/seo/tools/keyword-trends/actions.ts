'use server';

// @ts-ignore
import googleTrends from 'google-trends-api';

export async function getKeywordTrends(keyword: string) {
  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setMonth(today.getMonth() - 11); // Last 12 months

    const res = await googleTrends.interestOverTime({
      keyword,
      startTime: startDate,
      endTime: today,
    });
    
    const parsed = JSON.parse(res);
    const timelineData = parsed.default.timelineData;
    
    // Group into 12 months
    const monthlyData: Record<string, number[]> = {};
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    // Initialize monthly averages
    timelineData.forEach((item: any) => {
      const date = new Date(Number(item.time) * 1000);
      const monthStr = months[date.getMonth()];
      if (!monthlyData[monthStr]) {
        monthlyData[monthStr] = [];
      }
      monthlyData[monthStr].push(item.value[0]);
    });

    const result = months.map(m => {
      const values = monthlyData[m];
      if (!values || values.length === 0) return 0;
      const sum = values.reduce((a, b) => a + b, 0);
      return Math.round(sum / values.length);
    });

    // We want the last 12 months in order.
    const sortedResult = [];
    const sortedMonths = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(today.getMonth() - i);
      const mStr = months[d.getMonth()];
      sortedMonths.push(mStr);
      sortedResult.push(result[d.getMonth()]);
    }

    return { data: sortedResult, months: sortedMonths };
  } catch (err) {
    console.error('Error fetching trends:', err);
    return { error: 'Failed to fetch trends data' };
  }
}
