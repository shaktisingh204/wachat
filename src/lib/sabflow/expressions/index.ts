/**
 * Public surface for the SabFlow expression language.
 * Import from `@/lib/sabflow/expressions` rather than from individual files.
 */
export type { ExpressionContext, ExpressionResult } from './types';
export { tokenize, TokenizerError } from './tokenizer';
export type { Token, TokenType } from './tokenizer';
export { parse, ParseError } from './parser';
export type { ASTNode, BinaryOpToken } from './parser';
export { evaluate, coerceToString } from './evaluator';
export { resolveExpression, resolveTemplate } from './resolve';
export { __devTest } from './__tests__';
