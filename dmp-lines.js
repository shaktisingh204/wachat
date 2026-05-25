const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

function diffLines(text1, text2) {
  var a = dmp.diff_linesToChars_(text1, text2);
  var lineText1 = a.chars1;
  var lineText2 = a.chars2;
  var lineArray = a.lineArray;

  var diffs = dmp.diff_main(lineText1, lineText2, false);
  dmp.diff_charsToLines_(diffs, lineArray);
  return diffs;
}

console.log(diffLines("Hello\nWorld\nFoo", "Hello\nUniverse\nFoo\nBar"));
