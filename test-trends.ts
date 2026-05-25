import { getKeywordTrends } from './src/app/dashboard/seo/tools/keyword-trends/actions';

async function run() {
  const res = await getKeywordTrends('ai tools');
  console.log(res);
}

run();
