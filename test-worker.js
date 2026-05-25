function workerLogic() {
  self.onmessage = function(e) {
    const { text, rules } = e.data;
    let output = text;
    let error = null;
    let totalMatches = 0;
    
    try {
      for (const rule of rules) {
        if (!rule.find) continue;
        const flags = rule.caseSensitive ? 'g' : 'gi';
        const re = rule.regex 
          ? new RegExp(rule.find, flags) 
          : new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        const matches = output.match(re);
        if (matches) totalMatches += matches.length;
        output = output.replace(re, rule.replace);
      }
    } catch (err) {
      error = err.message || 'Invalid regular expression';
    }
    
    self.postMessage({ output, totalMatches, error });
  };
}

console.log('(' + workerLogic.toString() + ')()');
