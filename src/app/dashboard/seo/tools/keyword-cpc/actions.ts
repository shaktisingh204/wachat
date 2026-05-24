'use server';

export async function getLiveCpcData(keyword: string) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return { error: 'DataForSEO credentials not configured. Please set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in your environment.' };
  }

  try {
    const post_array = [{
      keyword: keyword,
      location_name: "United States",
      language_name: "English"
    }];

    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_metrics/live', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(post_array),
      cache: 'no-store'
    });

    if (!response.ok) {
      return { error: `Failed to fetch from DataForSEO: ${response.statusText}` };
    }

    const data = await response.json();
    const task = data.tasks?.[0];
    const item = task?.result?.[0]?.items?.[0];

    if (item && item.keyword_info) {
      return {
        data: {
          cpc: item.keyword_info.cpc,
          search_volume: item.keyword_info.search_volume,
          competition: item.keyword_info.competition,
          competition_level: item.keyword_info.competition_level
        }
      };
    }

    return { error: 'No data found for this keyword.' };
  } catch (err: any) {
    return { error: err.message || 'An error occurred while fetching live data.' };
  }
}
