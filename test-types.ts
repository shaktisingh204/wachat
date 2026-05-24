import { RankPosition, CompetitorGap } from './src/lib/seo-suite/types';
import { analyzeGaps, summarizeByCompetitor, GapAnalysisInput } from './src/lib/seo-suite/competitors';

const a: RankPosition = { keyword: 'seo software', engine: 'google', location: 'us', device: 'desktop', position: 12, checkedAt: new Date().toISOString() }
