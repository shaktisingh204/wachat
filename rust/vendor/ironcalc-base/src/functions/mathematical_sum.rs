use crate::expressions::types::CellReferenceIndex;

use crate::{
    calc_result::CalcResult, expressions::parser::Node, expressions::token::Error, model::Model,
};

type TwoMatricesResult = (i32, i32, Vec<Option<f64>>, Vec<Option<f64>>);

// Helper to check if two shapes are the same or compatible 1D shapes
fn is_same_shape_or_1d(rows1: i32, cols1: i32, rows2: i32, cols2: i32) -> bool {
    (rows1 == rows2 && cols1 == cols2)
        || (rows1 == 1 && cols2 == 1 && cols1 == rows2)
        || (rows2 == 1 && cols1 == 1 && cols2 == rows1)
}

impl<'a> Model<'a> {
    // SUMX2MY2(array_x, array_y) - Returns the sum of the difference of squares
    pub(crate) fn fn_sumx2my2(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        let result = match self.fn_get_two_matrices(args, cell) {
            Ok(s) => s,
            Err(s) => return s,
        };

        let (_, _, values_left, values_right) = result;

        let mut sum = 0.0;
        for (x_opt, y_opt) in values_left.into_iter().zip(values_right.into_iter()) {
            let x = x_opt.unwrap_or(0.0);
            let y = y_opt.unwrap_or(0.0);
            sum += x * x - y * y;
        }

        CalcResult::Number(sum)
    }

    // SUMX2PY2(array_x, array_y) - Returns the sum of the sum of squares
    pub(crate) fn fn_sumx2py2(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        let result = match self.fn_get_two_matrices(args, cell) {
            Ok(s) => s,
            Err(s) => return s,
        };

        let (_rows, _cols, values_left, values_right) = result;

        let mut sum = 0.0;
        for (x_opt, y_opt) in values_left.into_iter().zip(values_right.into_iter()) {
            let x = x_opt.unwrap_or(0.0);
            let y = y_opt.unwrap_or(0.0);
            sum += x * x + y * y;
        }

        CalcResult::Number(sum)
    }

    // SUMXMY2(array_x, array_y) - Returns the sum of squares of differences
    pub(crate) fn fn_sumxmy2(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        let result = match self.fn_get_two_matrices(args, cell) {
            Ok(s) => s,
            Err(s) => return s,
        };

        let (_, _, values_left, values_right) = result;

        let mut sum = 0.0;
        for (x_opt, y_opt) in values_left.into_iter().zip(values_right.into_iter()) {
            let x = x_opt.unwrap_or(0.0);
            let y = y_opt.unwrap_or(0.0);
            let diff = x - y;
            sum += diff * diff;
        }

        CalcResult::Number(sum)
    }

    // Helper function to extract and validate two matrices (ranges or arrays) with compatible shapes.
    // Returns (rows, cols, values_left, values_right) or an error.
    pub(crate) fn fn_get_two_matrices(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> Result<TwoMatricesResult, CalcResult> {
        if args.len() != 2 {
            return Err(CalcResult::new_args_number_error(cell));
        }
        let x_range = self.evaluate_node_in_context(&args[0], cell);
        let y_range = self.evaluate_node_in_context(&args[1], cell);

        let result = match (x_range, y_range) {
            (
                CalcResult::Range {
                    left: l1,
                    right: r1,
                },
                CalcResult::Range {
                    left: l2,
                    right: r2,
                },
            ) => {
                if l1.sheet != l2.sheet {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "Ranges are in different sheets".to_string(),
                    ));
                }
                let rows1 = r1.row - l1.row + 1;
                let cols1 = r1.column - l1.column + 1;
                let rows2 = r2.row - l2.row + 1;
                let cols2 = r2.column - l2.column + 1;
                if !is_same_shape_or_1d(rows1, cols1, rows2, cols2) {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "Ranges must be of the same shape".to_string(),
                    ));
                }
                let values_left = self.values_from_range(l1, r1)?;
                let values_right = self.values_from_range(l2, r2)?;
                (rows1, cols1, values_left, values_right)
            }
            (
                CalcResult::Array(left),
                CalcResult::Range {
                    left: l2,
                    right: r2,
                },
            ) => {
                let rows2 = r2.row - l2.row + 1;
                let cols2 = r2.column - l2.column + 1;

                let rows1 = left.len() as i32;
                let cols1 = if rows1 > 0 { left[0].len() as i32 } else { 0 };
                if !is_same_shape_or_1d(rows1, cols1, rows2, cols2) {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "Array and range must be of the same shape".to_string(),
                    ));
                }
                let values_left = match self.values_from_array(left) {
                    Err(error) => {
                        return Err(CalcResult::new_error(
                            Error::VALUE,
                            cell,
                            format!("Error in first array: {:?}", error),
                        ));
                    }
                    Ok(v) => v,
                };
                let values_right = self.values_from_range(l2, r2)?;
                (rows2, cols2, values_left, values_right)
            }
            (
                CalcResult::Range {
                    left: l1,
                    right: r1,
                },
                CalcResult::Array(right),
            ) => {
                let rows1 = r1.row - l1.row + 1;
                let cols1 = r1.column - l1.column + 1;

                let rows2 = right.len() as i32;
                let cols2 = if rows2 > 0 { right[0].len() as i32 } else { 0 };
                if !is_same_shape_or_1d(rows1, cols1, rows2, cols2) {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "Range and array must be of the same shape".to_string(),
                    ));
                }
                let values_left = self.values_from_range(l1, r1)?;
                let values_right = match self.values_from_array(right) {
                    Err(error) => {
                        return Err(CalcResult::new_error(
                            Error::VALUE,
                            cell,
                            format!("Error in second array: {:?}", error),
                        ));
                    }
                    Ok(v) => v,
                };
                (rows1, cols1, values_left, values_right)
            }
            (CalcResult::Array(left), CalcResult::Array(right)) => {
                let rows1 = left.len() as i32;
                let rows2 = right.len() as i32;
                let cols1 = if rows1 > 0 { left[0].len() as i32 } else { 0 };
                let cols2 = if rows2 > 0 { right[0].len() as i32 } else { 0 };

                if !is_same_shape_or_1d(rows1, cols1, rows2, cols2) {
                    return Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "Arrays must be of the same shape".to_string(),
                    ));
                }
                let values_left = match self.values_from_array(left) {
                    Err(error) => {
                        return Err(CalcResult::new_error(
                            Error::VALUE,
                            cell,
                            format!("Error in first array: {:?}", error),
                        ));
                    }
                    Ok(v) => v,
                };
                let values_right = match self.values_from_array(right) {
                    Err(error) => {
                        return Err(CalcResult::new_error(
                            Error::VALUE,
                            cell,
                            format!("Error in second array: {:?}", error),
                        ));
                    }
                    Ok(v) => v,
                };
                (rows1, cols1, values_left, values_right)
            }
            _ => {
                return Err(CalcResult::new_error(
                    Error::VALUE,
                    cell,
                    "Both arguments must be ranges or arrays".to_string(),
                ));
            }
        };
        Ok(result)
    }

    // Helper: evaluates one argument as a matrix of optional numbers.
    // Ranges and arrays keep their shape; scalars become a 1x1 matrix.
    // Non-numeric entries are returned as None.
    fn matrix_from_node(
        &mut self,
        arg: &Node,
        cell: CellReferenceIndex,
    ) -> Result<(i32, i32, Vec<Option<f64>>), CalcResult> {
        match self.evaluate_node_in_context(arg, cell) {
            CalcResult::Range { left, right } => {
                let rows = right.row - left.row + 1;
                let cols = right.column - left.column + 1;
                let values = self.values_from_range(left, right)?;
                Ok((rows, cols, values))
            }
            CalcResult::Array(array) => {
                let rows = array.len() as i32;
                let cols = if rows > 0 { array[0].len() as i32 } else { 0 };
                match self.values_from_array(array) {
                    Ok(values) => Ok((rows, cols, values)),
                    Err(error) => Err(CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        format!("Error in array argument: {:?}", error),
                    )),
                }
            }
            CalcResult::Number(value) => Ok((1, 1, vec![Some(value)])),
            CalcResult::Boolean(_) | CalcResult::String(_) => Ok((1, 1, vec![None])),
            CalcResult::EmptyCell | CalcResult::EmptyArg => Ok((1, 1, vec![Some(0.0)])),
            error @ CalcResult::Error { .. } => Err(error),
        }
    }

    // SUMPRODUCT(array1, [array2], ...)
    // Multiplies the corresponding entries of the given arrays and returns the
    // sum of those products. All arrays must have the same dimensions;
    // non-numeric entries are treated as zero.
    pub(crate) fn fn_sumproduct(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        if args.is_empty() {
            return CalcResult::new_args_number_error(cell);
        }

        let (rows, cols, first) = match self.matrix_from_node(&args[0], cell) {
            Ok(m) => m,
            Err(e) => return e,
        };

        let mut products: Vec<f64> = first.iter().map(|v| v.unwrap_or(0.0)).collect();

        for arg in &args[1..] {
            let (r, c, values) = match self.matrix_from_node(arg, cell) {
                Ok(m) => m,
                Err(e) => return e,
            };
            if r != rows || c != cols {
                return CalcResult::new_error(
                    Error::VALUE,
                    cell,
                    "SUMPRODUCT arrays must have the same dimensions".to_string(),
                );
            }
            for (product, value) in products.iter_mut().zip(values.iter()) {
                *product *= value.unwrap_or(0.0);
            }
        }

        CalcResult::Number(products.iter().sum())
    }

    // SERIESSUM(x, n, m, coefficients)
    // Returns the sum of the power series:
    //   a_1*x^n + a_2*x^(n+m) + ... + a_i*x^(n+(i-1)*m)
    pub(crate) fn fn_seriessum(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        if args.len() != 4 {
            return CalcResult::new_args_number_error(cell);
        }
        let x = match self.get_number(&args[0], cell) {
            Ok(f) => f,
            Err(s) => return s,
        };
        let n = match self.get_number(&args[1], cell) {
            Ok(f) => f,
            Err(s) => return s,
        };
        let m = match self.get_number(&args[2], cell) {
            Ok(f) => f,
            Err(s) => return s,
        };
        let (_, _, coefficients) = match self.matrix_from_node(&args[3], cell) {
            Ok(v) => v,
            Err(e) => return e,
        };

        let mut sum = 0.0;
        for (index, coefficient) in coefficients.iter().enumerate() {
            let a = match coefficient {
                Some(f) => *f,
                None => {
                    return CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "SERIESSUM coefficients must be numbers".to_string(),
                    )
                }
            };
            sum += a * x.powf(n + (index as f64) * m);
        }

        if !sum.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for SERIESSUM".to_string(),
            );
        }

        CalcResult::Number(sum)
    }

    // MULTINOMIAL(number1, [number2], ...)
    // Returns (sum of args)! / (product of args!). Arguments are truncated to
    // integers; any negative argument produces #NUM!.
    pub(crate) fn fn_multinomial(&mut self, args: &[Node], cell: CellReferenceIndex) -> CalcResult {
        if args.is_empty() {
            return CalcResult::new_args_number_error(cell);
        }

        let mut numbers: Vec<f64> = Vec::new();
        for arg in args {
            match self.evaluate_node_in_context(arg, cell) {
                CalcResult::Number(value) => numbers.push(value),
                CalcResult::Range { left, right } => {
                    let values = match self.values_from_range(left, right) {
                        Ok(v) => v,
                        Err(e) => return e,
                    };
                    // blanks/non-numeric cells in a range are ignored
                    numbers.extend(values.into_iter().flatten());
                }
                CalcResult::Array(array) => {
                    let values = match self.values_from_array(array) {
                        Ok(v) => v,
                        Err(error) => {
                            return CalcResult::new_error(
                                Error::VALUE,
                                cell,
                                format!("Error in array argument: {:?}", error),
                            )
                        }
                    };
                    numbers.extend(values.into_iter().flatten());
                }
                CalcResult::Boolean(_) | CalcResult::String(_) => {
                    return CalcResult::new_error(
                        Error::VALUE,
                        cell,
                        "MULTINOMIAL arguments must be numeric".to_string(),
                    )
                }
                CalcResult::EmptyCell | CalcResult::EmptyArg => {}
                error @ CalcResult::Error { .. } => return error,
            }
        }

        // Multinomial coefficient computed as a product of binomial factors to
        // avoid evaluating large factorials directly:
        //   (a_1 + ... + a_k)! / (a_1! * ... * a_k!) = prod_i C(a_1+...+a_i, a_i)
        let mut total: u64 = 0;
        let mut result = 1.0;
        for value in numbers {
            let a = value.trunc();
            if a < 0.0 {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "MULTINOMIAL arguments must be >= 0".to_string(),
                );
            }
            if a > 170.0 * 100.0 {
                // guard against absurd inputs that would overflow even stepwise
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "MULTINOMIAL argument too large".to_string(),
                );
            }
            let a = a as u64;
            for k in 1..=a {
                total += 1;
                result *= (total as f64) / (k as f64);
            }
        }

        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for MULTINOMIAL".to_string(),
            );
        }

        CalcResult::Number(result.round())
    }
}
