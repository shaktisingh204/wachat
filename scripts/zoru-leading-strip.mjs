#!/usr/bin/env node
/**
 * Brace-aware stripper for `leading={...}` / `trailing={...}` props.
 *
 * Regex can't handle nested braces in JSX expressions like
 * `leading={<LuDownload className="h-4 w-4" strokeWidth={1.75}/>}`.
 * This walks the source character-by-character, tracking JSX brace
 * depth, and removes whole prop expressions cleanly.
 *
 * It also handles the common case of converting a stripped
 * `leading={icon}` into a child by NOT actually trying to inline the
 * icon — that's too risky in the general case. We just strip the
 * prop. Pages will lose the icon visually but compile cleanly.
 * Hand-fixes can re-add icons as children where wanted.
 */

import fs from 'node:fs';

function stripJsxBraceProp(src, propName) {
  let out = '';
  let i = 0;
  const target = ` ${propName}=`;
  while (i < src.length) {
    if (src.slice(i, i + target.length) === target && src[i + target.length] === '{') {
      // Skip through the prop expression with brace counting.
      let depth = 1;
      let j = i + target.length + 1;
      while (j < src.length && depth > 0) {
        const c = src[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '"' || c === "'") {
          // Skip string contents.
          const quote = c;
          j++;
          while (j < src.length && src[j] !== quote) {
            if (src[j] === '\\') j++;
            j++;
          }
        }
        j++;
      }
      // depth==0 means we just consumed the closing `}`. Skip past it.
      i = j;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

const files = process.argv.slice(2);
let touched = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const original = s;
  s = stripJsxBraceProp(s, 'leading');
  s = stripJsxBraceProp(s, 'trailing');
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    touched++;
  }
}
console.log(`leading/trailing stripper: touched ${touched}/${files.length}`);
