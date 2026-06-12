//! Legacy (pre-2010) statistical functions whose argument lists differ from
//! their modern dotted equivalents, implemented from the publicly documented
//! behavior and sharing the same statrs distributions as the modern versions.

use statrs::distribution::{
    Beta, ContinuousCDF, Discrete, Hypergeometric, LogNormal, NegativeBinomial, StudentsT,
};

use crate::expressions::types::CellReferenceIndex;
use crate::{
    calc_result::CalcResult, expressions::parser::Node, expressions::token::Error, model::Model,
};

impl<'a> Model<'a> {
    // TDIST(x, deg_freedom, tails)
    // tails = 1 returns the right one-tailed probability P(T > x);
    // tails = 2 returns the two-tailed probability P(|T| > x).
    // x must be >= 0.
    pub(crate) fn fn_tdist_compat(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 3 {
            return CalcResult::new_args_number_error(cell);
        }
        let x = match self.get_number_no_bools(&args[0], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let df = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let tails = match self.get_number_no_bools(&args[2], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };

        if x < 0.0 {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "x must be >= 0 in TDIST".to_string(),
            );
        }
        if df < 1.0 {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "deg_freedom must be >= 1 in TDIST".to_string(),
            );
        }
        if tails != 1.0 && tails != 2.0 {
            return CalcResult::new_error(Error::NUM, cell, "tails must be 1 or 2".to_string());
        }

        let dist = match StudentsT::new(0.0, 1.0, df) {
            Ok(d) => d,
            Err(_) => {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Invalid parameters for TDIST".to_string(),
                )
            }
        };

        let right_tail = 1.0 - dist.cdf(x);
        let result = if tails == 1.0 {
            right_tail
        } else {
            (2.0 * right_tail).clamp(0.0, 1.0)
        };

        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for TDIST".to_string(),
            );
        }

        CalcResult::Number(result)
    }

    // LOGNORMDIST(x, mean, standard_dev)
    // Returns the cumulative lognormal distribution at x.
    pub(crate) fn fn_lognormdist_compat(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 3 {
            return CalcResult::new_args_number_error(cell);
        }
        let x = match self.get_number_no_bools(&args[0], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let mean = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let std_dev = match self.get_number_no_bools(&args[2], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };

        if x <= 0.0 || std_dev <= 0.0 {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid parameter for LOGNORMDIST".to_string(),
            );
        }

        let dist = match LogNormal::new(mean, std_dev) {
            Ok(d) => d,
            Err(_) => {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Invalid parameter for LOGNORMDIST".to_string(),
                )
            }
        };

        let result = dist.cdf(x);
        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for LOGNORMDIST".to_string(),
            );
        }

        CalcResult::Number(result)
    }

    // BETADIST(x, alpha, beta, [A], [B])
    // Returns the cumulative beta distribution on the interval [A, B]
    // (defaulting to [0, 1]).
    pub(crate) fn fn_betadist_compat(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        let arg_count = args.len();
        if !(3..=5).contains(&arg_count) {
            return CalcResult::new_args_number_error(cell);
        }
        let x = match self.get_number_no_bools(&args[0], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let alpha = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let beta_param = match self.get_number_no_bools(&args[2], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };
        let a = if arg_count >= 4 {
            match self.get_number_no_bools(&args[3], cell) {
                Ok(f) => f,
                Err(e) => return e,
            }
        } else {
            0.0
        };
        let b = if arg_count >= 5 {
            match self.get_number_no_bools(&args[4], cell) {
                Ok(f) => f,
                Err(e) => return e,
            }
        } else {
            1.0
        };

        if alpha <= 0.0 || beta_param <= 0.0 {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "alpha and beta must be > 0 in BETADIST".to_string(),
            );
        }
        if b == a || x < a || x > b {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "x must be between A and B and A < B in BETADIST".to_string(),
            );
        }

        let t = (x - a) / (b - a);
        let dist = match Beta::new(alpha, beta_param) {
            Ok(d) => d,
            Err(_) => {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Invalid parameters for BETADIST".to_string(),
                )
            }
        };

        let result = dist.cdf(t);
        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for BETADIST".to_string(),
            );
        }

        CalcResult::Number(result)
    }

    // NEGBINOMDIST(number_f, number_s, probability_s)
    // Returns the probability mass of number_f failures before the
    // number_s-th success.
    pub(crate) fn fn_negbinomdist_compat(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 3 {
            return CalcResult::new_args_number_error(cell);
        }
        let number_f = match self.get_number_no_bools(&args[0], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let number_s = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let probability_s = match self.get_number_no_bools(&args[2], cell) {
            Ok(f) => f,
            Err(e) => return e,
        };

        if number_f < 0.0
            || number_s < 1.0
            || !(0.0..=1.0).contains(&probability_s)
            || number_f > (u64::MAX as f64)
        {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid parameter for NEGBINOMDIST".to_string(),
            );
        }

        let dist = match NegativeBinomial::new(number_s, probability_s) {
            Ok(d) => d,
            Err(_) => {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Invalid parameter for NEGBINOMDIST".to_string(),
                )
            }
        };

        let result = dist.pmf(number_f as u64);
        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for NEGBINOMDIST".to_string(),
            );
        }

        CalcResult::Number(result)
    }

    // HYPGEOMDIST(sample_s, number_sample, population_s, number_pop)
    // Returns the hypergeometric probability mass (no cumulative flag).
    pub(crate) fn fn_hypgeomdist_compat(
        &mut self,
        args: &[Node],
        cell: CellReferenceIndex,
    ) -> CalcResult {
        if args.len() != 4 {
            return CalcResult::new_args_number_error(cell);
        }
        let sample_s = match self.get_number_no_bools(&args[0], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let number_sample = match self.get_number_no_bools(&args[1], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let population_s = match self.get_number_no_bools(&args[2], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };
        let number_pop = match self.get_number_no_bools(&args[3], cell) {
            Ok(f) => f.trunc(),
            Err(e) => return e,
        };

        if sample_s < 0.0
            || sample_s > f64::min(number_sample, population_s)
            || sample_s < f64::max(0.0, number_sample + population_s - number_pop)
            || number_sample <= 0.0
            || number_sample > number_pop
            || population_s <= 0.0
            || population_s > number_pop
        {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid parameters for HYPGEOMDIST".to_string(),
            );
        }

        let dist = match Hypergeometric::new(
            number_pop as u64,
            population_s as u64,
            number_sample as u64,
        ) {
            Ok(d) => d,
            Err(_) => {
                return CalcResult::new_error(
                    Error::NUM,
                    cell,
                    "Invalid parameters for HYPGEOMDIST".to_string(),
                )
            }
        };

        let result = dist.pmf(sample_s as u64);
        if !result.is_finite() {
            return CalcResult::new_error(
                Error::NUM,
                cell,
                "Invalid result for HYPGEOMDIST".to_string(),
            );
        }

        CalcResult::Number(result)
    }
}
