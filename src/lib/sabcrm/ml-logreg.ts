/**
 * SabCRM — logistic regression — PURE (in-house ML, no Python/ONNX/Rust).
 *
 * `'server-only'`- and I/O-free (unit-testable). Standardizes features, trains
 * a binary logistic-regression classifier by batch gradient descent with L2,
 * and serves a calibrated probability in [0,1]. Used by
 * `./predictive-scoring.server.ts` to predict deal win-likelihood from the
 * project's own won/lost history — entirely in TypeScript, so it trains and
 * serves in-process with zero external toolchain.
 */

/** A trained model: weights live in standardized space + the scaler. */
export interface LogRegModel {
  weights: number[];
  bias: number;
  /** Per-feature mean used to standardize inputs. */
  mean: number[];
  /** Per-feature std (>0) used to standardize inputs. */
  std: number[];
  /** Number of training samples (for confidence reporting). */
  n: number;
}

export interface TrainOpts {
  epochs?: number;
  /** Learning rate. */
  lr?: number;
  /** L2 regularization strength. */
  l2?: number;
}

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Fit per-feature mean + std (std floored to 1 to avoid divide-by-zero). */
export function fitScaler(X: number[][]): { mean: number[]; std: number[] } {
  const n = X.length;
  const d = n > 0 ? X[0].length : 0;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(0);
  if (n === 0) return { mean, std: std.map(() => 1) };
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / n) || 1;
  return { mean, std };
}

function standardize(x: number[], mean: number[], std: number[]): number[] {
  return x.map((v, j) => (v - (mean[j] ?? 0)) / (std[j] || 1));
}

/**
 * Train a logistic-regression model. Returns weights in standardized space +
 * the scaler so `predictProba` can standardize new inputs identically.
 */
export function trainLogReg(
  X: number[][],
  y: number[],
  opts?: TrainOpts,
): LogRegModel {
  const n = X.length;
  const d = n > 0 ? X[0].length : 0;
  const { mean, std } = fitScaler(X);
  const Xs = X.map((row) => standardize(row, mean, std));
  const weights = new Array<number>(d).fill(0);
  let bias = 0;
  if (n === 0 || d === 0) return { weights, bias, mean, std, n };

  const epochs = opts?.epochs ?? 300;
  const lr = opts?.lr ?? 0.1;
  const l2 = opts?.l2 ?? 0.001;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * Xs[i][j];
      const err = sigmoid(z) - y[i];
      for (let j = 0; j < d; j++) gradW[j] += err * Xs[i][j];
      gradB += err;
    }
    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (gradW[j] / n + l2 * weights[j]);
    }
    bias -= lr * (gradB / n);
  }
  return { weights, bias, mean, std, n };
}

/** Probability that a (raw, unstandardized) feature vector is class 1. */
export function predictProba(features: number[], model: LogRegModel): number {
  const xs = standardize(features, model.mean, model.std);
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) z += model.weights[j] * (xs[j] ?? 0);
  return sigmoid(z);
}
