const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

function computeSideBySideDiff(text1, text2, ignoreWhitespace = false) {
  if (ignoreWhitespace) {
    // How to handle ignore whitespace with diff-match-patch?
    // We could pre-process the lines for line-diffs?
    // Let's keep it simple first.
  }

  // 1. Line-level diff
  const a = dmp.diff_linesToChars_(text1, text2);
  const lineDiffs = dmp.diff_main(a.chars1, a.chars2, false);
  dmp.diff_charsToLines_(lineDiffs, a.lineArray);
  
  const rows = []; // { left: {text, type}, right: {text, type}, equal: boolean }
  
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
      // Check if next is insertion
      if (i + 1 < lineDiffs.length && lineDiffs[i+1][0] === 1) {
        const nextDiff = lineDiffs[i+1];
        const nextText = nextDiff[1];
        const nextLines = nextText.replace(/\n$/, '').split('\n');
        
        // Character level diff between the deleted block and inserted block!
        // To do this line by line, we can just diff the blocks and then assign back to lines,
        // or just diff line by line.
        // Usually, diffing line by line is better for side-by-side alignment if counts match.
        // If counts don't match, we might just align them sequentially and leave blanks.
        
        const maxLines = Math.max(lines.length, nextLines.length);
        for (let j = 0; j < maxLines; j++) {
          const l1 = lines[j] ?? null;
          const l2 = nextLines[j] ?? null;
          
          if (l1 !== null && l2 !== null) {
            // Char diff
            const charDiffs = dmp.diff_main(l1, l2);
            dmp.diff_cleanupSemantic(charDiffs);
            
            const leftChars = [];
            const rightChars = [];
            charDiffs.forEach(([cop, ctext]) => {
              if (cop === 0) {
                leftChars.push({type: 'equal', text: ctext});
                rightChars.push({type: 'equal', text: ctext});
              } else if (cop === -1) {
                leftChars.push({type: 'delete', text: ctext});
              } else if (cop === 1) {
                rightChars.push({type: 'insert', text: ctext});
              }
            });
            rows.push({ left: leftChars, right: rightChars, equal: false });
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

console.log(JSON.stringify(computeSideBySideDiff("hello world\nline 2\ncommon", "hello new world\nline 2 mod\nextra\ncommon"), null, 2));
