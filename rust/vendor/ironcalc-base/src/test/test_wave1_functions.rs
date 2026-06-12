#![allow(clippy::unwrap_used)]

// Tests for the Wave 1 function additions: text (CHAR, CODE, UNICHAR, CLEAN,
// PROPER, REPLACE), math (SUMPRODUCT, SERIESSUM, MULTINOMIAL), statistical
// (PERCENTILE.INC/EXC, QUARTILE.INC/EXC, COUNTUNIQUE), lookup (ADDRESS,
// HYPERLINK), financial (FVSCHEDULE), the legacy statistical functions with
// their own argument lists (TDIST, LOGNORMDIST, BETADIST, NEGBINOMDIST,
// HYPGEOMDIST) and a sample of the legacy-name aliases.
// Expected values follow Microsoft's published documentation examples.

use crate::test::util::new_empty_model;

#[test]
fn fn_char_code_unichar() {
    let mut model = new_empty_model();
    model._set("A1", "=CHAR(65)");
    model._set("A2", "=CODE(\"A\")");
    model._set("A3", "=UNICHAR(66)");
    model._set("A4", "=CHAR(0)");
    model._set("A5", "=UNICHAR(0)");
    model._set("A6", "=CODE(\"\")");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"A");
    assert_eq!(model._get_text("A2"), *"65");
    assert_eq!(model._get_text("A3"), *"B");
    assert_eq!(model._get_text("A4"), *"#VALUE!");
    assert_eq!(model._get_text("A5"), *"#VALUE!");
    assert_eq!(model._get_text("A6"), *"#VALUE!");
}

#[test]
fn fn_clean_proper_replace() {
    let mut model = new_empty_model();
    model._set("A1", "=CLEAN(CHAR(9)&\"Monthly report\"&CHAR(10))");
    model._set("A2", "=PROPER(\"this is a TITLE\")");
    model._set("A3", "=PROPER(\"2-way street\")");
    model._set("A4", "=PROPER(\"76BudGet\")");
    model._set("A5", "=REPLACE(\"abcdefghijk\",6,5,\"*\")");
    model._set("A6", "=REPLACE(\"2009\",3,2,\"10\")");
    model._set("A7", "=REPLACE(\"abc\",0,1,\"x\")");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"Monthly report");
    assert_eq!(model._get_text("A2"), *"This Is A Title");
    assert_eq!(model._get_text("A3"), *"2-Way Street");
    assert_eq!(model._get_text("A4"), *"76Budget");
    assert_eq!(model._get_text("A5"), *"abcde*k");
    assert_eq!(model._get_text("A6"), *"2010");
    assert_eq!(model._get_text("A7"), *"#VALUE!");
}

#[test]
fn fn_sumproduct() {
    let mut model = new_empty_model();
    model._set("A1", "=SUMPRODUCT({1,2;3,4},{5,6;7,8})");
    // The same with ranges
    model._set("C1", "3");
    model._set("D1", "4");
    model._set("C2", "8");
    model._set("D2", "6");
    model._set("E1", "2");
    model._set("F1", "7");
    model._set("E2", "6");
    model._set("F2", "7");
    model._set("A2", "=SUMPRODUCT(C1:D2,E1:F2)");
    // Mismatched dimensions
    model._set("A3", "=SUMPRODUCT({1,2,3},{1,2})");
    // Non-numeric entries are treated as zero
    model._set("G1", "text");
    model._set("A4", "=SUMPRODUCT(G1:G2,E1:E2)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"70");
    assert_eq!(model._get_text("A2"), *"124");
    assert_eq!(model._get_text("A3"), *"#VALUE!");
    assert_eq!(model._get_text("A4"), *"0");
}

#[test]
fn fn_seriessum_multinomial() {
    let mut model = new_empty_model();
    // Power series approximation of cos(pi/4) ~ 0.707103
    model._set(
        "A1",
        "=ROUND(SERIESSUM(PI()/4,0,2,{1,-0.5,0.041666667,-0.001388889}),6)",
    );
    model._set("A2", "=MULTINOMIAL(2,3,4)");
    model._set("A3", "=MULTINOMIAL(2,-1)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"0.707103");
    assert_eq!(model._get_text("A2"), *"1260");
    assert_eq!(model._get_text("A3"), *"#NUM!");
}

#[test]
fn fn_percentile_quartile() {
    let mut model = new_empty_model();
    model._set("A1", "=PERCENTILE.INC({1,2,3,4},0.3)");
    model._set("A2", "=PERCENTILE.EXC({1,2,3,6,6,6,7,8,9},0.25)");
    model._set("A3", "=QUARTILE.INC({1,2,4,7,8,9,10,12},1)");
    model._set("A4", "=QUARTILE.EXC({6,7,15,36,39,40,41,42,43,47,49},1)");
    // out-of-range k / quart
    model._set("A5", "=PERCENTILE.EXC({1,2,3,4},0.01)");
    model._set("A6", "=QUARTILE.INC({1,2,4,7},5)");
    model._set("A7", "=QUARTILE.EXC({1,2,4,7},4)");
    model._set("A8", "=PERCENTILE.INC({1,2,3,4},1.5)");
    // boundary values
    model._set("A9", "=PERCENTILE.INC({1,2,3,4},1)");
    model._set("A10", "=QUARTILE.INC({1,2,4,7},0)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"1.9");
    assert_eq!(model._get_text("A2"), *"2.5");
    assert_eq!(model._get_text("A3"), *"3.5");
    assert_eq!(model._get_text("A4"), *"15");
    assert_eq!(model._get_text("A5"), *"#NUM!");
    assert_eq!(model._get_text("A6"), *"#NUM!");
    assert_eq!(model._get_text("A7"), *"#NUM!");
    assert_eq!(model._get_text("A8"), *"#NUM!");
    assert_eq!(model._get_text("A9"), *"4");
    assert_eq!(model._get_text("A10"), *"1");
}

#[test]
fn fn_countunique() {
    let mut model = new_empty_model();
    model._set("A1", "1");
    model._set("A2", "2");
    model._set("A3", "2");
    model._set("A4", "a");
    model._set("A5", "A");
    // A6 is blank on purpose
    model._set("B1", "=COUNTUNIQUE(A1:A6)");
    model._set("B2", "=COUNTUNIQUE(1,2,2,\"x\")");
    // numbers and their text form count separately
    model._set("B3", "=COUNTUNIQUE(1,\"1\")");

    model.evaluate();

    // 1, 2, "a" and "A" (case-sensitive) are distinct; blanks are ignored
    assert_eq!(model._get_text("B1"), *"4");
    assert_eq!(model._get_text("B2"), *"3");
    assert_eq!(model._get_text("B3"), *"2");
}

#[test]
fn fn_address() {
    let mut model = new_empty_model();
    model._set("A1", "=ADDRESS(2,3)");
    model._set("A2", "=ADDRESS(2,3,2)");
    model._set("A3", "=ADDRESS(2,3,3)");
    model._set("A4", "=ADDRESS(2,3,4)");
    model._set("A5", "=ADDRESS(2,3,1,FALSE)");
    model._set("A6", "=ADDRESS(2,3,2,FALSE)");
    model._set("A7", "=ADDRESS(2,3,4,TRUE,\"Sheet2\")");
    model._set("A8", "=ADDRESS(2,3,4,TRUE,\"My Sheet\")");
    model._set("A9", "=ADDRESS(0,3)");
    model._set("A10", "=ADDRESS(2,3,7)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"$C$2");
    assert_eq!(model._get_text("A2"), *"C$2");
    assert_eq!(model._get_text("A3"), *"$C2");
    assert_eq!(model._get_text("A4"), *"C2");
    assert_eq!(model._get_text("A5"), *"R2C3");
    assert_eq!(model._get_text("A6"), *"R2C[3]");
    assert_eq!(model._get_text("A7"), *"Sheet2!C2");
    assert_eq!(model._get_text("A8"), *"'My Sheet'!C2");
    assert_eq!(model._get_text("A9"), *"#VALUE!");
    assert_eq!(model._get_text("A10"), *"#VALUE!");
}

#[test]
fn fn_hyperlink() {
    let mut model = new_empty_model();
    model._set("A1", "=HYPERLINK(\"https://example.com\")");
    model._set("A2", "=HYPERLINK(\"https://example.com\",\"Example\")");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"https://example.com");
    assert_eq!(model._get_text("A2"), *"Example");
}

#[test]
fn fn_fvschedule() {
    let mut model = new_empty_model();
    model._set("A1", "=ROUND(FVSCHEDULE(1,{0.09,0.11,0.1}),5)");
    // blanks in the schedule are treated as a rate of 0
    model._set("C1", "0.09");
    // C2 left blank
    model._set("C3", "0.1");
    model._set("A2", "=ROUND(FVSCHEDULE(100,C1:C3),4)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"1.33089");
    assert_eq!(model._get_text("A2"), *"119.9");
}

#[test]
fn fn_legacy_distributions() {
    let mut model = new_empty_model();
    model._set("A1", "=ROUND(TDIST(1.959999998,60,2),6)");
    model._set("A2", "=ROUND(TDIST(1.959999998,60,1),6)");
    model._set("A3", "=TDIST(-1,60,1)");
    model._set("A4", "=ROUND(LOGNORMDIST(4,3.5,1.2),7)");
    model._set("A5", "=ROUND(BETADIST(2,8,10,1,3),7)");
    model._set("A6", "=ROUND(NEGBINOMDIST(10,5,0.25),6)");
    model._set("A7", "=ROUND(HYPGEOMDIST(1,4,8,20),7)");

    model.evaluate();

    assert_eq!(model._get_text("A1"), *"0.054645");
    assert_eq!(model._get_text("A2"), *"0.027322");
    assert_eq!(model._get_text("A3"), *"#NUM!");
    assert_eq!(model._get_text("A4"), *"0.0390836");
    assert_eq!(model._get_text("A5"), *"0.6854706");
    assert_eq!(model._get_text("A6"), *"0.055049");
    assert_eq!(model._get_text("A7"), *"0.3632611");
}

#[test]
fn legacy_name_aliases() {
    let mut model = new_empty_model();
    // Each legacy name must produce the same value as the modern function
    model._set("A1", "=STDEV(1,2,3,4)");
    model._set("B1", "=STDEV.S(1,2,3,4)");
    model._set("A2", "=STDEVP(1,2,3,4)");
    model._set("B2", "=STDEV.P(1,2,3,4)");
    model._set("A3", "=VAR(1,2,3,4)");
    model._set("B3", "=VAR.S(1,2,3,4)");
    model._set("A4", "=VARP(1,2,3,4)");
    model._set("B4", "=VAR.P(1,2,3,4)");
    model._set("A5", "=NORMDIST(42,40,1.5,TRUE)");
    model._set("B5", "=NORM.DIST(42,40,1.5,TRUE)");
    model._set("A6", "=TINV(0.05,10)");
    model._set("B6", "=T.INV.2T(0.05,10)");
    model._set("A7", "=POISSON(2,5,TRUE)");
    model._set("B7", "=POISSON.DIST(2,5,TRUE)");
    model._set("A8", "=CRITBINOM(6,0.5,0.75)");
    model._set("A9", "=PERCENTILE({1,2,3,4},0.3)");
    model._set("A10", "=QUARTILE({1,2,4,7,8,9,10,12},1)");
    model._set("A11", "=CHIINV(0.050001,10)");
    model._set("B11", "=CHISQ.INV.RT(0.050001,10)");
    model._set("A12", "=WEIBULL(105,20,100,TRUE)");
    model._set("B12", "=WEIBULL.DIST(105,20,100,TRUE)");
    model._set("A13", "=BINOMDIST(6,10,0.5,FALSE)");
    model._set("B13", "=BINOM.DIST(6,10,0.5,FALSE)");

    model.evaluate();

    for row in [1, 2, 3, 4, 5, 6, 7, 11, 12, 13] {
        let legacy = model._get_text(&format!("A{row}"));
        let modern = model._get_text(&format!("B{row}"));
        assert!(
            !legacy.starts_with('#'),
            "row {row}: legacy alias returned {legacy}"
        );
        assert_eq!(legacy, modern, "row {row}: alias and modern value differ");
    }
    assert_eq!(model._get_text("A8"), *"4");
    assert_eq!(model._get_text("A9"), *"1.9");
    assert_eq!(model._get_text("A10"), *"3.5");
}
