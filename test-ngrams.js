const { STOP_WORDS } = require('./test-stub.js');

function ngramDensity(text, n = 1, filterStopwords = false) {
  const words = text.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
  
  if (words.length < n) return [];
  
  const ngrams = [];
  let validTotal = 0;

  for (let i = 0; i <= words.length - n; i++) {
    const chunk = words.slice(i, i + n);
    
    if (filterStopwords) {
      // Current behavior
      // if (chunk.some(w => STOP_WORDS.has(w))) continue;
      
      // Better behavior:
      if (STOP_WORDS.has(chunk[0]) || STOP_WORDS.has(chunk[chunk.length - 1])) continue;
    }
    
    ngrams.push(chunk.join(' '));
    validTotal++;
  }
  
  if (!validTotal) return [];
  
  const counts = new Map();
  for (const gram of ngrams) {
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count, density: (count / validTotal) * 100 }))
    .sort((a, b) => b.count - a.count);
}

console.log(ngramDensity("shoes in london are very expensive to buy in london", 3, true));
