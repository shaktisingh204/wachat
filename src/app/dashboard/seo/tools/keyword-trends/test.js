const googleTrends = require('google-trends-api');

async function test() {
  const res = await googleTrends.interestOverTime({
    keyword: 'ai tools',
    startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
  });
  console.log(JSON.stringify(JSON.parse(res), null, 2).slice(0, 500));
}

test();
