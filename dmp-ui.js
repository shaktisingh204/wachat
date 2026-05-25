const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

function computeSideBySideDiff(text1, text2, ignoreWhitespace) {
  const a = dmp.diff_linesToChars_(text1, text2);
  const lineDiffs = dmp.diff_main(a.chars1, a.chars2, false);
  dmp.diff_charsToLines_(lineDiffs, a.lineArray);
  
  const rows = [];
  
  for (let i = 0; i < lineDiffs.length; i++) {
    const diff = lineDiffs[i];
    const op = diff[0];
    const text = diff[1];
    const lines = text.replace(/\n$/, '').split('\n');
    
    if (op === 0) {
      lines.forEach(l => {
        rows.push({ left: [{type: 'equal', text: l}], right: [{type: 'equal', text: l}], equal: true });
      });
    } else if (op === -1) {
      if (i + 1 < lineDiffs.length && lineDiffs[i+1][0] === 1) {
        const nextDiff = lineDiffs[i+1];
        const nextText = nextDiff[1];
        const nextLines = nextText.replace(/\n$/, '').split('\n');
        
        const maxLines = Math.max(lines.length, nextLines.length);
        for (let j = 0; j < maxLines; j++) {
          const l1 = lines[j] ?? null;
          const l2 = nextLines[j] ?? null;
          
          if (l1 !== null && l2 !== null) {
            const isEq = ignoreWhitespace ? l1.replace(/\s+/g, '') === l2.replace(/\s+/g, '') : l1 === l2;
            if (isEq) {
              rows.push({ left: [{type: 'equal', text: l1}], right: [{type: 'equal', text: l2}], equal: true });
            } else {
              const charDiffs = dmp.diff_main(l1, l2);
              dmp.diff_cleanupSemantic(charDiffs);
              
              const leftChars = [];
              const rightChars = [];
              charDiffs.forEach(([cop, ctext]) => {
                const isWs = ignoreWhitespace && /^\s+$/.test(ctext);
                if (cop === 0) {
                  leftChars.push({type: 'equal', text: ctext});
                  rightChars.push({type: 'equal', text: ctext});
                } else if (cop === -1) {
                  leftChars.push({type: isWs ? 'equal' : 'delete', text: ctext});
                } else if (cop === 1) {
                  rightChars.push({type: isWs ? 'equal' : 'insert', text: ctext});
                }
              });
              rows.push({ left: leftChars, right: rightChars, equal: false });
            }
          } else if (l1 !== null) {
            rows.push({ left: [{type: 'delete', text: l1}], right: null, equal: false });
          } else if (l2 !== null) {
            rows.push({ left: null, right: [{type: 'insert', text: l2}], equal: false });
          }
        }
        i++; // skip the next insertion
      } else {
        lines.forEach(l => {
          rows.push({ left: [{type: 'delete', text: l}], right: null, equal: false });
        });
      }
    } else if (op === 1) {
      lines.forEach(l => {
        rows.push({ left: null, right: [{type: 'insert', text: l}], equal: false });
      });
    }
  }
  
  return rows;
}
console.log(JSON.stringify(computeSideBySideDiff("hello\nworld", "hello", false), null, 2));
