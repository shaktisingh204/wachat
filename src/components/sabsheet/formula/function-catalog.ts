/**
 * Function metadata for the formula UX (autocomplete, signature help, function browser).
 *
 * Signatures are factual; descriptions are written in our own words. Functions the engine accepts
 * but that aren't listed here still autocomplete by name (metadata is an enhancement, not a gate) —
 * the authoritative name list comes from the engine's `functionCatalog()`.
 */

export interface FunctionMeta {
  /** e.g. "SUM(number1, [number2], …)" */
  sig: string;
  /** One-line plain-words description. */
  desc: string;
  cat: string;
}

export const FUNCTION_META: Record<string, FunctionMeta> = {
  // ── Math ────────────────────────────────────────────────────────────────
  SUM: { sig: "SUM(number1, [number2], …)", desc: "Adds all the numbers given.", cat: "Math" },
  SUMIF: { sig: "SUMIF(range, criteria, [sum_range])", desc: "Adds the cells that meet a condition.", cat: "Math" },
  SUMIFS: { sig: "SUMIFS(sum_range, range1, criteria1, …)", desc: "Adds cells matching several conditions.", cat: "Math" },
  SUMPRODUCT: { sig: "SUMPRODUCT(array1, [array2], …)", desc: "Multiplies matching entries and totals the products.", cat: "Math" },
  PRODUCT: { sig: "PRODUCT(number1, [number2], …)", desc: "Multiplies all the numbers given.", cat: "Math" },
  ABS: { sig: "ABS(number)", desc: "Absolute value of a number.", cat: "Math" },
  ROUND: { sig: "ROUND(number, num_digits)", desc: "Rounds to a set number of digits.", cat: "Math" },
  ROUNDUP: { sig: "ROUNDUP(number, num_digits)", desc: "Rounds away from zero.", cat: "Math" },
  ROUNDDOWN: { sig: "ROUNDDOWN(number, num_digits)", desc: "Rounds toward zero.", cat: "Math" },
  INT: { sig: "INT(number)", desc: "Rounds down to the nearest whole number.", cat: "Math" },
  MOD: { sig: "MOD(number, divisor)", desc: "Remainder after division.", cat: "Math" },
  POWER: { sig: "POWER(number, power)", desc: "Raises a number to a power.", cat: "Math" },
  SQRT: { sig: "SQRT(number)", desc: "Square root.", cat: "Math" },
  EXP: { sig: "EXP(number)", desc: "e raised to a power.", cat: "Math" },
  LN: { sig: "LN(number)", desc: "Natural logarithm.", cat: "Math" },
  LOG: { sig: "LOG(number, [base])", desc: "Logarithm in a chosen base (10 by default).", cat: "Math" },
  LOG10: { sig: "LOG10(number)", desc: "Base-10 logarithm.", cat: "Math" },
  PI: { sig: "PI()", desc: "The constant π.", cat: "Math" },
  RAND: { sig: "RAND()", desc: "Random number between 0 and 1.", cat: "Math" },
  RANDBETWEEN: { sig: "RANDBETWEEN(bottom, top)", desc: "Random whole number in a range.", cat: "Math" },
  CEILING: { sig: "CEILING(number, significance)", desc: "Rounds up to a multiple.", cat: "Math" },
  FLOOR: { sig: "FLOOR(number, significance)", desc: "Rounds down to a multiple.", cat: "Math" },
  TRUNC: { sig: "TRUNC(number, [num_digits])", desc: "Cuts a number off at a digit count (no rounding).", cat: "Math" },
  SIGN: { sig: "SIGN(number)", desc: "−1, 0 or 1 depending on the sign.", cat: "Math" },
  SERIESSUM: { sig: "SERIESSUM(x, n, m, coefficients)", desc: "Sum of a power series.", cat: "Math" },
  MULTINOMIAL: { sig: "MULTINOMIAL(number1, [number2], …)", desc: "Multinomial of the given numbers.", cat: "Math" },
  SIN: { sig: "SIN(number)", desc: "Sine of an angle in radians.", cat: "Math" },
  COS: { sig: "COS(number)", desc: "Cosine of an angle in radians.", cat: "Math" },
  TAN: { sig: "TAN(number)", desc: "Tangent of an angle in radians.", cat: "Math" },

  // ── Logical ─────────────────────────────────────────────────────────────
  IF: { sig: "IF(condition, value_if_true, [value_if_false])", desc: "Picks a value based on a condition.", cat: "Logical" },
  IFS: { sig: "IFS(condition1, value1, …)", desc: "First value whose condition is true.", cat: "Logical" },
  IFERROR: { sig: "IFERROR(value, value_if_error)", desc: "Fallback when a formula errors.", cat: "Logical" },
  IFNA: { sig: "IFNA(value, value_if_na)", desc: "Fallback when a formula returns #N/A.", cat: "Logical" },
  AND: { sig: "AND(logical1, [logical2], …)", desc: "TRUE when every condition holds.", cat: "Logical" },
  OR: { sig: "OR(logical1, [logical2], …)", desc: "TRUE when any condition holds.", cat: "Logical" },
  NOT: { sig: "NOT(logical)", desc: "Flips TRUE and FALSE.", cat: "Logical" },
  XOR: { sig: "XOR(logical1, [logical2], …)", desc: "TRUE when an odd number of conditions hold.", cat: "Logical" },
  SWITCH: { sig: "SWITCH(value, case1, result1, …, [default])", desc: "Matches a value against cases.", cat: "Logical" },
  TRUE: { sig: "TRUE()", desc: "The boolean TRUE.", cat: "Logical" },
  FALSE: { sig: "FALSE()", desc: "The boolean FALSE.", cat: "Logical" },

  // ── Lookup ──────────────────────────────────────────────────────────────
  VLOOKUP: { sig: "VLOOKUP(value, table, col_index, [exact])", desc: "Finds a value down the first column, returns from another column.", cat: "Lookup" },
  HLOOKUP: { sig: "HLOOKUP(value, table, row_index, [exact])", desc: "Finds across the first row, returns from another row.", cat: "Lookup" },
  XLOOKUP: { sig: "XLOOKUP(value, lookup_range, return_range, [if_missing], [mode], [search])", desc: "Modern flexible lookup in any direction.", cat: "Lookup" },
  INDEX: { sig: "INDEX(range, row, [column])", desc: "The value at a row/column position in a range.", cat: "Lookup" },
  MATCH: { sig: "MATCH(value, range, [match_type])", desc: "Position of a value within a range.", cat: "Lookup" },
  OFFSET: { sig: "OFFSET(reference, rows, cols, [height], [width])", desc: "A range shifted from a starting cell.", cat: "Lookup" },
  INDIRECT: { sig: "INDIRECT(ref_text)", desc: "Turns text like \"B7\" into a real reference.", cat: "Lookup" },
  ADDRESS: { sig: "ADDRESS(row, column, [abs], [a1], [sheet])", desc: "Builds a cell reference as text.", cat: "Lookup" },
  HYPERLINK: { sig: "HYPERLINK(url, [label])", desc: "A link with display text.", cat: "Lookup" },
  ROW: { sig: "ROW([reference])", desc: "Row number of a reference.", cat: "Lookup" },
  COLUMN: { sig: "COLUMN([reference])", desc: "Column number of a reference.", cat: "Lookup" },
  ROWS: { sig: "ROWS(range)", desc: "How many rows a range covers.", cat: "Lookup" },
  COLUMNS: { sig: "COLUMNS(range)", desc: "How many columns a range covers.", cat: "Lookup" },
  CHOOSE: { sig: "CHOOSE(index, value1, [value2], …)", desc: "Picks a value by position.", cat: "Lookup" },

  // ── Text ────────────────────────────────────────────────────────────────
  CONCAT: { sig: "CONCAT(text1, [text2], …)", desc: "Joins text values together.", cat: "Text" },
  CONCATENATE: { sig: "CONCATENATE(text1, [text2], …)", desc: "Joins text values together (classic form).", cat: "Text" },
  TEXTJOIN: { sig: "TEXTJOIN(delimiter, ignore_empty, text1, …)", desc: "Joins text with a separator.", cat: "Text" },
  LEFT: { sig: "LEFT(text, [num_chars])", desc: "Leading characters of text.", cat: "Text" },
  RIGHT: { sig: "RIGHT(text, [num_chars])", desc: "Trailing characters of text.", cat: "Text" },
  MID: { sig: "MID(text, start, num_chars)", desc: "Characters from the middle of text.", cat: "Text" },
  LEN: { sig: "LEN(text)", desc: "Number of characters.", cat: "Text" },
  LOWER: { sig: "LOWER(text)", desc: "Lowercases text.", cat: "Text" },
  UPPER: { sig: "UPPER(text)", desc: "Uppercases text.", cat: "Text" },
  PROPER: { sig: "PROPER(text)", desc: "Capitalizes each word.", cat: "Text" },
  TRIM: { sig: "TRIM(text)", desc: "Removes extra spaces.", cat: "Text" },
  CLEAN: { sig: "CLEAN(text)", desc: "Strips non-printable characters.", cat: "Text" },
  SUBSTITUTE: { sig: "SUBSTITUTE(text, old, new, [instance])", desc: "Replaces matching text.", cat: "Text" },
  REPLACE: { sig: "REPLACE(text, start, num_chars, new_text)", desc: "Replaces characters by position.", cat: "Text" },
  FIND: { sig: "FIND(needle, haystack, [start])", desc: "Position of text (case-sensitive).", cat: "Text" },
  SEARCH: { sig: "SEARCH(needle, haystack, [start])", desc: "Position of text (case-insensitive).", cat: "Text" },
  TEXT: { sig: "TEXT(value, format_code)", desc: "Formats a value as text using a number format.", cat: "Text" },
  VALUE: { sig: "VALUE(text)", desc: "Converts text to a number.", cat: "Text" },
  CHAR: { sig: "CHAR(number)", desc: "Character for a character code.", cat: "Text" },
  CODE: { sig: "CODE(text)", desc: "Character code of the first character.", cat: "Text" },
  UNICHAR: { sig: "UNICHAR(number)", desc: "Character for a Unicode code point.", cat: "Text" },
  REPT: { sig: "REPT(text, times)", desc: "Repeats text.", cat: "Text" },
  EXACT: { sig: "EXACT(text1, text2)", desc: "TRUE when two texts match exactly.", cat: "Text" },

  // ── Date & time ─────────────────────────────────────────────────────────
  TODAY: { sig: "TODAY()", desc: "Today's date.", cat: "Date" },
  NOW: { sig: "NOW()", desc: "Current date and time.", cat: "Date" },
  DATE: { sig: "DATE(year, month, day)", desc: "Builds a date.", cat: "Date" },
  TIME: { sig: "TIME(hour, minute, second)", desc: "Builds a time.", cat: "Date" },
  YEAR: { sig: "YEAR(date)", desc: "Year part of a date.", cat: "Date" },
  MONTH: { sig: "MONTH(date)", desc: "Month part of a date.", cat: "Date" },
  DAY: { sig: "DAY(date)", desc: "Day part of a date.", cat: "Date" },
  HOUR: { sig: "HOUR(time)", desc: "Hour part of a time.", cat: "Date" },
  MINUTE: { sig: "MINUTE(time)", desc: "Minute part of a time.", cat: "Date" },
  SECOND: { sig: "SECOND(time)", desc: "Second part of a time.", cat: "Date" },
  WEEKDAY: { sig: "WEEKDAY(date, [type])", desc: "Day of the week as a number.", cat: "Date" },
  EDATE: { sig: "EDATE(start_date, months)", desc: "A date shifted by whole months.", cat: "Date" },
  EOMONTH: { sig: "EOMONTH(start_date, months)", desc: "Last day of a shifted month.", cat: "Date" },
  DATEDIF: { sig: "DATEDIF(start, end, unit)", desc: "Difference between dates in a chosen unit.", cat: "Date" },
  DAYS: { sig: "DAYS(end_date, start_date)", desc: "Days between two dates.", cat: "Date" },

  // ── Statistical ─────────────────────────────────────────────────────────
  AVERAGE: { sig: "AVERAGE(number1, [number2], …)", desc: "Arithmetic mean.", cat: "Statistical" },
  AVERAGEIF: { sig: "AVERAGEIF(range, criteria, [avg_range])", desc: "Mean of cells meeting a condition.", cat: "Statistical" },
  AVERAGEIFS: { sig: "AVERAGEIFS(avg_range, range1, criteria1, …)", desc: "Mean with several conditions.", cat: "Statistical" },
  COUNT: { sig: "COUNT(value1, [value2], …)", desc: "Counts numeric cells.", cat: "Statistical" },
  COUNTA: { sig: "COUNTA(value1, [value2], …)", desc: "Counts non-empty cells.", cat: "Statistical" },
  COUNTBLANK: { sig: "COUNTBLANK(range)", desc: "Counts empty cells.", cat: "Statistical" },
  COUNTIF: { sig: "COUNTIF(range, criteria)", desc: "Counts cells meeting a condition.", cat: "Statistical" },
  COUNTIFS: { sig: "COUNTIFS(range1, criteria1, …)", desc: "Counts with several conditions.", cat: "Statistical" },
  COUNTUNIQUE: { sig: "COUNTUNIQUE(value1, [value2], …)", desc: "Counts distinct values.", cat: "Statistical" },
  MAX: { sig: "MAX(number1, [number2], …)", desc: "Largest number.", cat: "Statistical" },
  MIN: { sig: "MIN(number1, [number2], …)", desc: "Smallest number.", cat: "Statistical" },
  MAXIFS: { sig: "MAXIFS(max_range, range1, criteria1, …)", desc: "Largest value under conditions.", cat: "Statistical" },
  MINIFS: { sig: "MINIFS(min_range, range1, criteria1, …)", desc: "Smallest value under conditions.", cat: "Statistical" },
  MEDIAN: { sig: "MEDIAN(number1, [number2], …)", desc: "Middle value.", cat: "Statistical" },
  "PERCENTILE.INC": { sig: "PERCENTILE.INC(array, k)", desc: "k-th percentile (inclusive).", cat: "Statistical" },
  "PERCENTILE.EXC": { sig: "PERCENTILE.EXC(array, k)", desc: "k-th percentile (exclusive).", cat: "Statistical" },
  "QUARTILE.INC": { sig: "QUARTILE.INC(array, quart)", desc: "Quartile of a data set (inclusive).", cat: "Statistical" },
  "QUARTILE.EXC": { sig: "QUARTILE.EXC(array, quart)", desc: "Quartile of a data set (exclusive).", cat: "Statistical" },
  "STDEV.S": { sig: "STDEV.S(number1, [number2], …)", desc: "Standard deviation of a sample.", cat: "Statistical" },
  "STDEV.P": { sig: "STDEV.P(number1, [number2], …)", desc: "Standard deviation of a population.", cat: "Statistical" },
  "VAR.S": { sig: "VAR.S(number1, [number2], …)", desc: "Variance of a sample.", cat: "Statistical" },
  "VAR.P": { sig: "VAR.P(number1, [number2], …)", desc: "Variance of a population.", cat: "Statistical" },
  LARGE: { sig: "LARGE(array, k)", desc: "k-th largest value.", cat: "Statistical" },
  SMALL: { sig: "SMALL(array, k)", desc: "k-th smallest value.", cat: "Statistical" },
  RANK: { sig: "RANK(number, ref, [order])", desc: "Rank of a number in a list.", cat: "Statistical" },
  "NORM.DIST": { sig: "NORM.DIST(x, mean, sd, cumulative)", desc: "Normal distribution.", cat: "Statistical" },
  "NORM.INV": { sig: "NORM.INV(probability, mean, sd)", desc: "Inverse of the normal distribution.", cat: "Statistical" },
  FORECAST: { sig: "FORECAST(x, known_ys, known_xs)", desc: "Linear-trend prediction.", cat: "Statistical" },
  SLOPE: { sig: "SLOPE(known_ys, known_xs)", desc: "Slope of the linear fit.", cat: "Statistical" },
  INTERCEPT: { sig: "INTERCEPT(known_ys, known_xs)", desc: "Intercept of the linear fit.", cat: "Statistical" },
  CORREL: { sig: "CORREL(array1, array2)", desc: "Correlation coefficient.", cat: "Statistical" },

  // ── Financial ───────────────────────────────────────────────────────────
  PMT: { sig: "PMT(rate, nper, pv, [fv], [type])", desc: "Loan payment per period.", cat: "Financial" },
  PV: { sig: "PV(rate, nper, pmt, [fv], [type])", desc: "Present value.", cat: "Financial" },
  FV: { sig: "FV(rate, nper, pmt, [pv], [type])", desc: "Future value.", cat: "Financial" },
  NPV: { sig: "NPV(rate, value1, [value2], …)", desc: "Net present value of cash flows.", cat: "Financial" },
  IRR: { sig: "IRR(values, [guess])", desc: "Internal rate of return.", cat: "Financial" },
  XIRR: { sig: "XIRR(values, dates, [guess])", desc: "IRR for dated cash flows.", cat: "Financial" },
  XNPV: { sig: "XNPV(rate, values, dates)", desc: "NPV for dated cash flows.", cat: "Financial" },
  NPER: { sig: "NPER(rate, pmt, pv, [fv], [type])", desc: "Number of payment periods.", cat: "Financial" },
  RATE: { sig: "RATE(nper, pmt, pv, [fv], [type], [guess])", desc: "Interest rate per period.", cat: "Financial" },
  FVSCHEDULE: { sig: "FVSCHEDULE(principal, schedule)", desc: "Future value under varying rates.", cat: "Financial" },

  // ── Information ─────────────────────────────────────────────────────────
  ISBLANK: { sig: "ISBLANK(value)", desc: "TRUE for an empty cell.", cat: "Info" },
  ISNUMBER: { sig: "ISNUMBER(value)", desc: "TRUE for a number.", cat: "Info" },
  ISTEXT: { sig: "ISTEXT(value)", desc: "TRUE for text.", cat: "Info" },
  ISERROR: { sig: "ISERROR(value)", desc: "TRUE for any error.", cat: "Info" },
  ISNA: { sig: "ISNA(value)", desc: "TRUE for #N/A.", cat: "Info" },
  ISLOGICAL: { sig: "ISLOGICAL(value)", desc: "TRUE for a boolean.", cat: "Info" },
  NA: { sig: "NA()", desc: "The #N/A error.", cat: "Info" },
  TYPE: { sig: "TYPE(value)", desc: "Numeric code for a value's type.", cat: "Info" },
};

/** Categories in browser display order. */
export const FUNCTION_CATEGORIES = [
  "Math",
  "Logical",
  "Lookup",
  "Text",
  "Date",
  "Statistical",
  "Financial",
  "Info",
  "Other",
] as const;
