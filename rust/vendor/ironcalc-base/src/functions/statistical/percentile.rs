use std::cmp::Ordering;
use std::collections::HashSet;

use crate::constants::{LAST_COLUMN, LAST_ROW};
use crate::expressions::parser::ArrayNode;
use crate::expressions::types::CellReferenceIndex;
use crate::{
    calc_result::CalcResult, expressions::parser::Node, expressions::token::Error, model::Model,
};

// PERCENTILE.INC interpolation: the k-th percentile (k in [0, 1]) of n sorted
// values is found at the 1-based rank 1 + k*(n - 1), interpolating linearly
// between the two surrounding data points.
fn percentile_inc_from_sorted(values: &[f64], k: f64) -> Option<f64> {
    let n = values.len();
    if n == 0 || !(0.0..=1.0).contains(&k) {
        return None;
    }
    let rank = k * ((n - 1) as f64);
    let lower = rank.floor() as usize;
    let fraction = rank - rank.floor();
    if lower + 1 < n {
        Some(values[lower] + fraction * (values[lower + 1] - values[lower]))
    } else {
        Some(values[n - 1])
    }
}

// PERCENTILE.EXC interpolation: the 1-based rank is k*(n + 1), which must lie
// in [1, n]; values of k outside (1/(n+1), n/(n+1)) are out of range.
fn percentile_exc_from_sorted(values: &[f64], k: f64) -> Option<f64> {
    let n = values.len();
    if n == 0 {
        return None;
    }
    let rank = k * ((n + 1) as f64);
    if rank < 1.0 || rank > n as f64 {
        return None;
    }
    let lower = rank.floor() as usize; // 1-based index of the lower data point
    let fraction = rank - rank.floor();
    if lower < n {
        Some(values[lower - 1] + fraction * (values[lower] - values[lower - 1]))
    } else {
        Some(values[n - 1])
    }
}

impl<'a> Model<'a> {
    // Collects the numeric values of the first argument (range, array or
    // scalar) into a sorted vector, mirroring the data handling of LARGE/SMALL.
    fn sorted_numbers_from_first_arg(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> Result<Vec<f64>, CalcResult> {
        let values = match self.evaluate_node_in_context(&args[0], cell) {
            CalcResult::Array(array) => match self.values_from_array(array) {
                Ok(v) => v,
                Err(e) => {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        format!("Unsupported array argument: {:?}", e),
                    ))
                }
            },
            CalcResult::Range { left, right } => self.values_from_range(left, right)?,
            CalcResult::Number(value) => vec![Some(value)],
            error @ CalcResult::Error { .. } => return Err(error),
            _ => {
                return Err(CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Unsupported argument type".to_string(),
                ))
            }
        };
        let mut numbers: Vec<f64> = values.into_iter().flatten().collect();
        numbers.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
        Ok(numbers)
    }

    // PERCENTILE.INC(array, k)
    pub(crate) fn fn_percentile_inc(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 2 {
            return CalcResult::new_args_number_error(cell);
        }
        let numbers = match self.sorted_numbers_from_first_arg(args, cell) {
            Ok(v) => v,
            Err(e) => return e,
        };
        let k = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f,
            Err(s) => return s,
        };
        match percentile_inc_from_sorted(&numbers, k) {
            Some(value) => CalcResult::Number(value),
            None => CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid data or k for PERCENTILE.INC".to_string(),
            ),
        }
    }

    // PERCENTILE.EXC(array, k)
    pub(crate) fn fn_percentile_exc(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 2 {
            return CalcResult::new_args_number_error(cell);
        }
        let numbers = match self.sorted_numbers_from_first_arg(args, cell) {
            Ok(v) => v,
            Err(e) => return e,
        };
        let k = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f,
            Err(s) => return s,
        };
        match percentile_exc_from_sorted(&numbers, k) {
            Some(value) => CalcResult::Number(value),
            None => CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid data or k for PERCENTILE.EXC".to_string(),
            ),
        }
    }

    // QUARTILE.INC(array, quart) with quart 0..=4
    pub(crate) fn fn_quartile_inc(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 2 {
            return CalcResult::new_args_number_error(cell);
        }
        let numbers = match self.sorted_numbers_from_first_arg(args, cell) {
            Ok(v) => v,
            Err(e) => return e,
        };
        let quart = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f.trunc(),
            Err(s) => return s,
        };
        if !(0.0..=4.0).contains(&quart) {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "quart must be between 0 and 4 in QUARTILE.INC".to_string(),
            );
        }
        match percentile_inc_from_sorted(&numbers, quart / 4.0) {
            Some(value) => CalcResult::Number(value),
            None => CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid data for QUARTILE.INC".to_string(),
            ),
        }
    }

    // QUARTILE.EXC(array, quart) with quart 1..=3
    pub(crate) fn fn_quartile_exc(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 2 {
            return CalcResult::new_args_number_error(cell);
        }
        let numbers = match self.sorted_numbers_from_first_arg(args, cell) {
            Ok(v) => v,
            Err(e) => return e,
        };
        let quart = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f.trunc(),
            Err(s) => return s,
        };
        if !(1.0..=3.0).contains(&quart) {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "quart must be between 1 and 3 in QUARTILE.EXC".to_string(),
            );
        }
        match percentile_exc_from_sorted(&numbers, quart / 4.0) {
            Some(value) => CalcResult::Number(value),
            None => CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid data for QUARTILE.EXC".to_string(),
            ),
        }
    }

    // COUNTUNIQUE(value1, [value2], ...)
    // Counts the number of distinct non-empty values across the arguments.
    // Numbers are compared numerically, text case-sensitively, and values of
    // different kinds (number/text/boolean) are always distinct.
    pub(crate) fn fn_countunique(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        if args.is_empty() {
            return CalcResult::new_args_number_error(cell);
        }

        // Keys are prefixed by the kind so that, for instance, the number 1,
        // the text "1" and the boolean TRUE all count separately.
        fn number_key(value: f64) -> String {
            // normalize negative zero so 0 and -0 compare equal
            let value = if value == 0.0 { 0.0 } else { value };
            format!("n:{value}")
        }

        let mut seen: HashSet<String> = HashSet::new();

        for arg in args {
            match self.evaluate_node_in_context(arg, cell) {
                CalcResult::Number(value) => {
                    seen.insert(number_key(value));
                }
                CalcResult::String(value) => {
                    if !value.is_empty() {
                        seen.insert(format!("s:{value}"));
                    }
                }
                CalcResult::Boolean(value) => {
                    seen.insert(format!("b:{value}"));
                }
                CalcResult::EmptyCell | CalcResult::EmptyArg => {}
                error @ CalcResult::Error { .. } => return error,
                CalcResult::Array(array) => {
                    for row in array {
                        for item in row {
                            match item {
                                ArrayNode::Number(value) => {
                                    seen.insert(number_key(value));
                                }
                                ArrayNode::String(value) => {
                                    if !value.is_empty() {
                                        seen.insert(format!("s:{value}"));
                                    }
                                }
                                ArrayNode::Boolean(value) => {
                                    seen.insert(format!("b:{value}"));
                                }
                                ArrayNode::Error(error) => {
                                    return CalcResult::new_error(
                                        error,
                                        cell,
                                        "Error in array argument".to_string(),
                                    )
                                }
                            }
                        }
                    }
                }
                CalcResult::Range { left, right } => {
                    if left.sheet != right.sheet {
                        return CalcResult::new_error(
                            Error::VALUE,
                            cell,
                            "Ranges are in different sheets".to_string(),
                        );
                    }
                    let row1 = left.row;
                    let mut row2 = right.row;
                    let column1 = left.column;
                    let mut column2 = right.column;
                    if row1 == 1 && row2 == LAST_ROW {
                        row2 = match self.workbook.worksheet(left.sheet) {
                            Ok(s) => s.dimension().max_row,
                            Err(_) => {
                                return CalcResult::new_error(
                                    Error::ERROR,
                                    cell,
                                    format!("Invalid worksheet index: '{}'", left.sheet),
                                );
                            }
                        };
                    }
                    if column1 == 1 && column2 == LAST_COLUMN {
                        column2 = match self.workbook.worksheet(left.sheet) {
                            Ok(s) => s.dimension().max_column,
                            Err(_) => {
                                return CalcResult::new_error(
                                    Error::ERROR,
                                    cell,
                                    format!("Invalid worksheet index: '{}'", left.sheet),
                                );
                            }
                        };
                    }
                    for row in row1..=row2 {
                        for column in column1..=column2 {
                            match self.evaluate_cell(CellReferenceIndex {
                                sheet: left.sheet,
                                row,
                                column,
                            }) {
                                CalcResult::Number(value) => {
                                    seen.insert(number_key(value));
                                }
                                CalcResult::String(value) => {
                                    if !value.is_empty() {
                                        seen.insert(format!("s:{value}"));
                                    }
                                }
                                CalcResult::Boolean(value) => {
                                    seen.insert(format!("b:{value}"));
                                }
                                error @ CalcResult::Error { .. } => return error,
                                _ => {}
                            }
                        }
                    }
                }
            }
        }

        CalcResult::Number(seen.len() as f64)
    }
}
