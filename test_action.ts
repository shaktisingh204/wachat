import { analyzeKeywordDifficultyAction } from './src/app/dashboard/seo/tools/keyword-difficulty/actions';

async function test() {
  const result = await analyzeKeywordDifficultyAction('react server components');
  console.log(result);
}
test();
