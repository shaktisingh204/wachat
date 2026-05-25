const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

function diffToSideBySide(a, b, ignoreWhitespace = false) {
  if (ignoreWhitespace) {
    // maybe we just strip spaces for diffing, but we need to keep original text?
    // dmp doesn't easily support ignoreWhitespace while preserving original text.
  }
  
  const diffs = dmp.diff_main(a, b);
  dmp.diff_cleanupSemantic(diffs);
  
  let leftLines = [];
  let rightLines = [];
  
  let currentLeftLine = [];
  let currentRightLine = [];
  
  diffs.forEach(([op, text]) => {
    const lines = text.split('\n');
    lines.forEach((lineText, i) => {
      if (i > 0) {
        // new line
        if (op === 0) {
          leftLines.push(currentLeftLine);
          rightLines.push(currentRightLine);
          currentLeftLine = [];
          currentRightLine = [];
        } else if (op === -1) {
          leftLines.push(currentLeftLine);
          currentLeftLine = [];
        } else if (op === 1) {
          rightLines.push(currentRightLine);
          currentRightLine = [];
        }
      }
      
      if (lineText) {
        if (op === 0) {
          currentLeftLine.push({ type: 'equal', text: lineText });
          currentRightLine.push({ type: 'equal', text: lineText });
        } else if (op === -1) {
          currentLeftLine.push({ type: 'delete', text: lineText });
        } else if (op === 1) {
          currentRightLine.push({ type: 'insert', text: lineText });
        }
      }
    });
  });
  
  leftLines.push(currentLeftLine);
  rightLines.push(currentRightLine);
  
  // Now we have leftLines and rightLines, but they might not be aligned!
  // To align them, we'd need to do another LCS on the lines, which is basically what diffLines does.
  
  return { leftLines, rightLines };
}

console.log(JSON.stringify(diffToSideBySide("line1\nline2", "line1\nline2a\nline3"), null, 2));
